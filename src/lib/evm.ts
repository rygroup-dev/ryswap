const WEI_PER_ETH = 10n ** 18n;

export function parseEthToWei(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;

  const normalized = trimmed.replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(normalized)) {
    throw new Error("Invalid ETH amount.");
  }

  const [wholePartRaw = "0", fractionPartRaw = ""] = normalized.split(".");
  const wholePart = wholePartRaw || "0";
  const fractionPart = `${fractionPartRaw}000000000000000000`.slice(0, 18);

  return BigInt(wholePart) * WEI_PER_ETH + BigInt(fractionPart || "0");
}

export function formatWeiToEth(value: bigint, digits = 6): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / WEI_PER_ETH;
  const fraction = abs % WEI_PER_ETH;

  if (digits <= 0) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const paddedFraction = fraction.toString().padStart(18, "0");
  const visibleFraction = paddedFraction.slice(0, digits).replace(/0+$/, "");

  return visibleFraction
    ? `${negative ? "-" : ""}${whole.toString()}.${visibleFraction}`
    : `${negative ? "-" : ""}${whole.toString()}`;
}

export function applyBps(value: bigint, bps: number): bigint {
  const safeBps = Number.isFinite(bps) ? Math.max(0, Math.trunc(bps)) : 0;
  return (value * BigInt(safeBps)) / 10_000n;
}
