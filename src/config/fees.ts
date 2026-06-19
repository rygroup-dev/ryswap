const defaultFeeBps = Number(import.meta.env.VITE_FEE_BPS || 150);

export const feeConfig = {
  bps: Number.isFinite(defaultFeeBps) ? defaultFeeBps : 150,
  recipient:
    import.meta.env.VITE_FEE_RECIPIENT ||
    "0x327F53A3D8fCb1d35fF549234a982D057aa1976C"
};
