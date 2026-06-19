#!/usr/bin/env node
// Live test: route a tiny ETH->USDC swap through FeeRouter on mainnet.
// DRY-RUN first (callStatic + estimateGas). Only broadcasts if BROADCAST=1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ethers } = require('ethers');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const RPC_URL = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com';
const PK = process.env.DEPLOYER_PK;
const FEE_ROUTER = process.env.FEE_ROUTER;
const AMOUNT_ETH = process.env.AMOUNT_ETH || '0.001';
const BROADCAST = process.env.BROADCAST === '1';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const POOL_FEE = 500; // 0.05% WETH/USDC pool

function fail(m){console.error('ERROR:',m);process.exit(1);}
if(!PK) fail('DEPLOYER_PK not set');
if(!FEE_ROUTER) fail('FEE_ROUTER not set');

const swapRouterAbi = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256)'
];
const feeRouterAbi = JSON.parse(fs.readFileSync(path.join(root,'contracts','out','FeeRouter.json'),'utf8')).abi;

async function main(){
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const net = await provider.getNetwork();
  if(net.chainId!==1n) fail('not mainnet');
  const wallet = new ethers.Wallet(PK, provider);
  const user = await wallet.getAddress();

  const total = ethers.parseEther(AMOUNT_ETH);
  const feeBps = 30n;
  const feeAmt = total*feeBps/10000n;
  const forwardAmt = total-feeAmt;

  // Build SwapRouter02 calldata; amountIn MUST equal forwarded value (post-fee).
  const iface = new ethers.Interface(swapRouterAbi);

  // Live quote -> slippage-protected minimum (1%).
  const quoter = new ethers.Contract(
    '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    ['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256,uint160,uint32,uint256)'],
    provider
  );
  const q = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: WETH, tokenOut: USDC, amountIn: forwardAmt, fee: POOL_FEE, sqrtPriceLimitX96: 0n,
  });
  const expectedOut = q[0];
  const minOut = (expectedOut * 9900n) / 10000n; // 1% slippage
  console.log('quote out :', ethers.formatUnits(expectedOut, 6), 'USDC');
  console.log('min out   :', ethers.formatUnits(minOut, 6), 'USDC (1% slippage)');

  const params = {
    tokenIn: WETH, tokenOut: USDC, fee: POOL_FEE, recipient: user,
    amountIn: forwardAmt, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n,
  };
  const routerCalldata = iface.encodeFunctionData('exactInputSingle',[params]);

  const fr = new ethers.Contract(FEE_ROUTER, feeRouterAbi, wallet);

  console.log('user/recipient:', user);
  console.log('total in  :', ethers.formatEther(total),'ETH');
  console.log('fee 0.3%  :', ethers.formatEther(feeAmt),'ETH ->', await fr.feeRecipient());
  console.log('forwarded :', ethers.formatEther(forwardAmt),'ETH -> swap');

  // DRY-RUN: static call + gas estimate
  try {
    await fr.routeSwap.staticCall(routerCalldata, { value: total });
    console.log('\n[dry-run] staticCall OK (would not revert)');
  } catch(e){
    fail('[dry-run] staticCall REVERTED: '+(e.shortMessage||e.message));
  }
  const gas = await fr.routeSwap.estimateGas(routerCalldata,{value:total});
  const feeData = await provider.getFeeData();
  console.log('[dry-run] est gas:',gas.toString(),'cost:',ethers.formatEther(gas*feeData.gasPrice),'ETH');

  if(!BROADCAST){
    console.log('\nDRY-RUN ONLY. Set BROADCAST=1 to send for real.');
    return;
  }

  const usdc = new ethers.Contract(USDC,['function balanceOf(address) view returns(uint256)'],provider);
  const before = await usdc.balanceOf(user);
  console.log('\nBroadcasting...');
  const tx = await fr.routeSwap(routerCalldata,{value:total});
  console.log('tx:',tx.hash);
  const rc = await tx.wait();
  console.log('mined block',rc.blockNumber,'status',rc.status);
  const after = await usdc.balanceOf(user);
  console.log('USDC received:', ethers.formatUnits(after-before,6),'USDC');
}
main().catch(e=>fail(e.message||String(e)));
