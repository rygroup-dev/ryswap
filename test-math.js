const CURVE = {
  totalSupply: 1_000_000_000,
  curveSupply: 800_000_000,
  virtualEth: 1.0,
  graduationEth: 4.0,
};

function initialCurve() {
  return {
    ethReserve: 0,
    tokenReserve: CURVE.curveSupply,
    virtualEth: CURVE.virtualEth,
    virtualToken: CURVE.curveSupply,
    soldSupply: 0,
  };
}

function k(c) {
  return c.virtualEth * c.virtualToken;
}

function buy(c, ethIn) {
  const x = c.virtualEth + c.ethReserve;
  const newX = x + ethIn;
  const newY = k(c) / newX;
  const tokensOut = c.tokenReserve - newY;
  return {
    tokensOut,
    curve: {
      ...c,
      ethReserve: c.ethReserve + ethIn,
      tokenReserve: newY,
      soldSupply: c.soldSupply + tokensOut,
    },
  };
}

function sell(c, tokensIn) {
  const x = c.virtualEth + c.ethReserve;
  const newY = c.tokenReserve + tokensIn;
  const newX = k(c) / newY;
  const ethOut = x - newX;
  return {
    ethOut,
    curve: {
      ...c,
      ethReserve: c.ethReserve - ethOut,
      tokenReserve: newY,
      soldSupply: c.soldSupply - tokensIn,
    },
  };
}

const initial = initialCurve();
const bought = buy(initial, 1);
console.log("After buying 1 ETH:");
console.log("  tokensOut:", bought.tokensOut);
console.log("  ethReserve:", bought.curve.ethReserve);
console.log("  tokenReserve:", bought.curve.tokenReserve);

const bal = bought.tokensOut;
const sold = sell(bought.curve, bal / 2);
console.log("After selling half the tokens:");
console.log("  ethOut:", sold.ethOut);
console.log("  ethReserve before:", bought.curve.ethReserve);
console.log("  ethReserve after:", sold.curve.ethReserve);
console.log("  Difference:", bought.curve.ethReserve - sold.curve.ethReserve);
console.log("  Close to 0?", Math.abs(bought.curve.ethReserve - sold.curve.ethReserve) < 1e-15);
