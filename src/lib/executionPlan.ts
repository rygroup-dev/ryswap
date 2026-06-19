import { feeConfig } from "../config/fees";
import { sourceChain, targetChain } from "../config/chains";
import { applyBps, formatWeiToEth, parseEthToWei } from "./evm";
import type {
  ExecutionStep,
  ExecutionStepKey,
  PreparedBridgeExecution
} from "../types/bridge";

function buildSteps(): ExecutionStep[] {
  const steps: Array<{ key: ExecutionStepKey; title: string; description: string }> = [
    {
      key: "feeTransfer",
      title: "Fee transfer on source chain",
      description: `Send the platform fee to ${feeConfig.recipient} on ${sourceChain.name}.`
    },
    {
      key: "bridgeDeposit",
      title: "Bridge deposit",
      description: `Submit the net ETH amount into the live ${sourceChain.name} -> ${targetChain.name} route.`
    },
    {
      key: "destinationReceive",
      title: "rbETH receive",
      description: `User receives rbETH directly on ${targetChain.name} without operator inventory.`
    }
  ];

  return steps.map((step) => ({
    ...step,
    status: "pending"
  }));
}

export function prepareBridgeExecution(amount: string): PreparedBridgeExecution {
  const grossWei = parseEthToWei(amount);
  if (grossWei <= 0n) {
    throw new Error("Enter an amount greater than zero to prepare the bridge flow.");
  }

  const feeWei = applyBps(grossWei, feeConfig.bps);
  const netBridgeWei = grossWei - feeWei;

  if (netBridgeWei <= 0n) {
    throw new Error("Net bridge amount is zero after fee deduction.");
  }

  return {
    grossWei,
    feeWei,
    netBridgeWei,
    grossEthFormatted: formatWeiToEth(grossWei),
    feeEthFormatted: formatWeiToEth(feeWei),
    netEthFormatted: formatWeiToEth(netBridgeWei),
    feeRecipient: feeConfig.recipient,
    routeBindingNote:
      "Execution is currently prepared against the fee-first pass-through model. The final deposit call will bind to the confirmed live ETH -> rbETH route next.",
    steps: buildSteps()
  };
}
