#!/usr/bin/env node
// Deploy FeeRouter to Robinhood Chain (4663).
//
// SECURITY:
//   - Private key is read ONLY from env var DEPLOYER_PK (never CLI arg, never file in repo).
//   - Nothing here is logged that exposes the key.
//
// Usage:
//   DEPLOYER_PK=0x... \
//   RPC_URL=https://poptye-always-win.poptyedev.com \
//   SWAP_ROUTER=0xCaf681a66D020601342297493863E78C959E5cb2 \
//   FEE_BPS=50 \
//   FEE_RECIPIENT=0xYourFeeWallet \
//   node scripts/deploy.mjs
//
// Defaults are filled from config below if env not set, EXCEPT DEPLOYER_PK and FEE_RECIPIENT.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ethers } = require('ethers');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const RPC_URL = process.env.RPC_URL || 'https://poptye-always-win.poptyedev.com';
const EXPECTED_CHAIN_ID = BigInt(process.env.EXPECTED_CHAIN_ID || '4663');
const SWAP_ROUTER = process.env.SWAP_ROUTER || '0xCaf681a66D020601342297493863E78C959E5cb2';
const FEE_BPS = parseInt(process.env.FEE_BPS || '50', 10); // 0.50% default
const FEE_RECIPIENT = process.env.FEE_RECIPIENT;
const PK = process.env.DEPLOYER_PK;

function fail(msg) {
  console.error('ERROR:', msg);
  process.exit(1);
}

if (!PK) fail('DEPLOYER_PK env var not set. export DEPLOYER_PK=0x... (do NOT paste it in chat).');
if (!FEE_RECIPIENT) fail('FEE_RECIPIENT env var not set.');
if (!ethers.isAddress(FEE_RECIPIENT)) fail('FEE_RECIPIENT is not a valid address.');
if (!ethers.isAddress(SWAP_ROUTER)) fail('SWAP_ROUTER is not a valid address.');
if (FEE_BPS < 0 || FEE_BPS > 100) fail('FEE_BPS out of range (0..100). Contract caps at 100 = 1%.');

const artifact = JSON.parse(
  fs.readFileSync(path.join(root, 'contracts', 'out', 'FeeRouter.json'), 'utf8')
);

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const net = await provider.getNetwork();
  console.log('RPC:', RPC_URL);
  console.log('Chain ID:', net.chainId.toString());
  if (net.chainId !== EXPECTED_CHAIN_ID) {
    fail(`Connected chain ${net.chainId} != expected ${EXPECTED_CHAIN_ID}. Refusing to deploy.`);
  }

  const wallet = new ethers.Wallet(PK, provider);
  const deployer = await wallet.getAddress();
  const bal = await provider.getBalance(deployer);
  console.log('Deployer:', deployer);
  console.log('Balance:', ethers.formatEther(bal), 'ETH');
  if (bal === 0n) fail('Deployer balance is 0. Fund it with a little ETH first.');

  console.log('\nDeploy params:');
  console.log('  swapRouter  :', SWAP_ROUTER);
  console.log('  feeBps      :', FEE_BPS, `(${(FEE_BPS / 100).toFixed(2)}%)`);
  console.log('  feeRecipient:', FEE_RECIPIENT);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(SWAP_ROUTER, FEE_BPS, FEE_RECIPIENT);
  console.log('\nDeploy tx sent:', contract.deploymentTransaction().hash);
  console.log('Waiting for confirmation...');
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log('\n✅ FeeRouter deployed at:', addr);

  // Read-back verification.
  const c = new ethers.Contract(addr, artifact.abi, provider);
  const [owner, sr, fb, fr] = await Promise.all([
    c.owner(),
    c.swapRouter(),
    c.feeBps(),
    c.feeRecipient(),
  ]);
  console.log('\nOn-chain verify:');
  console.log('  owner       :', owner);
  console.log('  swapRouter  :', sr);
  console.log('  feeBps      :', fb.toString());
  console.log('  feeRecipient:', fr);

  const outPath = path.join(root, 'contracts', 'out', 'deployment.4663.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { chainId: 4663, feeRouter: addr, swapRouter: sr, feeBps: Number(fb), feeRecipient: fr, deployer, txHash: contract.deploymentTransaction().hash },
      null,
      2
    )
  );
  console.log('\nSaved deployment ->', outPath);
}

main().catch((e) => fail(e.message || String(e)));
