const defaultFeeBps = Number(import.meta.env.VITE_FEE_BPS || 50);

export const feeConfig = {
  bps: Number.isFinite(defaultFeeBps) ? defaultFeeBps : 50,
  recipient:
    import.meta.env.VITE_FEE_RECIPIENT ||
    "0x0000000000000000000000000000000000000000"
};
