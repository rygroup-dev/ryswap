// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FeeRouter
/// @notice Non-custodial fee-skim wrapper around a Uniswap-style SwapRouter02 on
///         Robinhood Chain (4663). Takes a transparent platform fee in BPS, then
///         forwards the remainder to the swap router. The router always sends the
///         swap output directly to the end user (recipient set inside the encoded
///         router calldata). This contract never custodies user funds beyond the
///         single atomic transaction.
///
/// @dev    Design rules:
///         - Fee is taken on the INPUT side (ETH in), in basis points, capped.
///         - Owner can only update feeBps (<= MAX_FEE_BPS) and feeRecipient.
///         - Contract holds no balance between txs; any dust is sweepable by owner.
///         - No upgradeability, no proxy, no hidden mint. Pure pass-through.
contract FeeRouter {
    // ----------------------------------------------------------------- errors
    error NotOwner();
    error ZeroAddress();
    error FeeTooHigh();
    error InsufficientValue();
    error SwapFailed();
    error FeeTransferFailed();

    // ----------------------------------------------------------------- events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeConfigUpdated(uint96 feeBps, address indexed feeRecipient);
    event Routed(
        address indexed user,
        uint256 amountIn,
        uint256 feeAmount,
        uint256 forwardedAmount
    );
    event Swept(address indexed to, uint256 amount);

    // -------------------------------------------------------------- constants
    /// @notice Hard cap so the owner can never set a predatory fee. 100 = 1%.
    uint96 public constant MAX_FEE_BPS = 100; // 1.00% max
    uint96 public constant BPS_DENOMINATOR = 10_000;

    // ------------------------------------------------------------------ state
    address public owner;
    /// @notice Immutable target swap router (SwapRouter02-style) on 4663.
    address public immutable swapRouter;
    uint96 public feeBps;
    address public feeRecipient;

    // -------------------------------------------------------------- modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _swapRouter, uint96 _feeBps, address _feeRecipient) {
        if (_swapRouter == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        owner = msg.sender;
        swapRouter = _swapRouter;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeConfigUpdated(_feeBps, _feeRecipient);
    }

    // --------------------------------------------------------------- admin
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setFeeConfig(uint96 _feeBps, address _feeRecipient) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        emit FeeConfigUpdated(_feeBps, _feeRecipient);
    }

    // ---------------------------------------------------------------- core
    /// @notice Skim fee from msg.value, forward remainder to the swap router with
    ///         the user-provided calldata. The router output recipient MUST be set
    ///         to the end user inside `routerCalldata` (e.g. exactInputSingle.recipient).
    /// @param routerCalldata ABI-encoded call for the SwapRouter02 (e.g. multicall
    ///        / exactInputSingle). The frontend builds this; we only forward value.
    /// @return result Raw return data from the swap router.
    function routeSwap(bytes calldata routerCalldata)
        external
        payable
        returns (bytes memory result)
    {
        if (msg.value == 0) revert InsufficientValue();

        uint256 feeAmount = (msg.value * feeBps) / BPS_DENOMINATOR;
        uint256 forwardAmount = msg.value - feeAmount;

        // Pay platform fee first (transparent, separate transfer).
        if (feeAmount > 0) {
            (bool feeOk, ) = feeRecipient.call{value: feeAmount}("");
            if (!feeOk) revert FeeTransferFailed();
        }

        // Forward remainder to the swap router with the user's calldata.
        (bool ok, bytes memory ret) = swapRouter.call{value: forwardAmount}(routerCalldata);
        if (!ok) {
            // bubble up revert reason from router
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }

        emit Routed(msg.sender, msg.value, feeAmount, forwardAmount);
        return ret;
    }

    // ---------------------------------------------------------------- sweep
    /// @notice Recover any stuck native dust (should normally be zero).
    function sweep(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = address(this).balance;
        (bool ok, ) = to.call{value: bal}("");
        if (!ok) revert SwapFailed();
        emit Swept(to, bal);
    }

    receive() external payable {}
}
