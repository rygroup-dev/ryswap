// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IInboxLike {
    function depositEth(address destAddr) external payable returns (uint256);
}

/// @title DirectBridgeFeeRouter
/// @notice Source-chain wrapper for ETH -> Robinhood Chain deposits. Users send
///         ETH once, the contract skims a transparent fee, then forwards the
///         remainder into the configured Inbox in the same transaction.
/// @dev    This does not bypass Robinhood / Orbit allowlists. The Inbox must
///         still accept this contract as the caller before mainnet activation.
contract DirectBridgeFeeRouter {
    error NotOwner();
    error ZeroAddress();
    error FeeTooHigh();
    error InsufficientValue();
    error FeeTransferFailed();
    error InboxDepositFailed();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeConfigUpdated(uint96 feeBps, address indexed feeRecipient);
    event Deposited(
        address indexed user,
        address indexed destination,
        uint256 amountIn,
        uint256 feeAmount,
        uint256 bridgedAmount,
        uint256 inboxSequence
    );

    uint96 public constant MAX_FEE_BPS = 1000; // 10.00% hard cap for bridge wrapper.
    uint96 public constant BPS_DENOMINATOR = 10_000;

    address public owner;
    address public immutable inbox;
    uint96 public feeBps;
    address public feeRecipient;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _inbox, uint96 _feeBps, address _feeRecipient) {
        if (_inbox == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        owner = msg.sender;
        inbox = _inbox;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;

        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeConfigUpdated(_feeBps, _feeRecipient);
    }

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

    /// @notice One-click ETH deposit into the configured Inbox.
    /// @param destination Recipient address on Robinhood Chain.
    /// @return inboxSequence The sequence number returned by the Inbox deposit.
    function depositEth(address destination) external payable returns (uint256 inboxSequence) {
        if (destination == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert InsufficientValue();

        uint256 feeAmount = (msg.value * feeBps) / BPS_DENOMINATOR;
        uint256 bridgeAmount = msg.value - feeAmount;
        if (bridgeAmount == 0) revert InsufficientValue();

        if (feeAmount > 0) {
            (bool feeOk, ) = feeRecipient.call{value: feeAmount}("");
            if (!feeOk) revert FeeTransferFailed();
        }

        try IInboxLike(inbox).depositEth{value: bridgeAmount}(destination) returns (uint256 seqNum) {
            inboxSequence = seqNum;
        } catch {
            revert InboxDepositFailed();
        }

        emit Deposited(msg.sender, destination, msg.value, feeAmount, bridgeAmount, inboxSequence);
    }

    receive() external payable {}
}
