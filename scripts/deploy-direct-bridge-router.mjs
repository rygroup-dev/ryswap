#!/usr/bin/env node
// Deploy DirectBridgeFeeRouter to Ethereum mainnet (or another source chain).
//
// Usage:
//   DEPLOYER_PK=0x... \
//   RPC_URL=https://ethereum.publicnode.com \
//   EXPECTED_CHAIN_ID=1 \
//   INBOX=0xYourRobinhoodInbox \
//   FEE_BPS=150 \
//   FEE_RECIPIENT=0xYourFeeWallet \
//   node scripts/deploy-direct-bridge-router.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ethers } = require('ethers');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const RPC_URL = process.env.RPC_URL || 'https://ethereum.publicnode.com';
const EXPECTED_CHAIN_ID = BigInt(process.env.EXPECTED_CHAIN_ID || '1');
const INBOX = process.env.INBOX;
const FEE_BPS = parseInt(process.env.FEE_BPS || '150', 10); // 1.50% default
const FEE_RECIPIENT = process.env.FEE_RECIPIENT;
const PK = process.env.DEPLOYER_PK;

function fail(msg) {
  console.error('ERROR:', msg);
  process.exit(1);
}

if (!PK) fail('DEPLOYER_PK env var not set. export DEPLOYER_PK=0x... (do NOT paste it in chat).');
if (!INBOX) fail('INBOX env var not set.');
if (!FEE_RECIPIENT) fail('FEE_RECIPIENT env var not set.');
if (!ethers.isAddress(INBOX)) fail('INBOX is not a valid address.');
if (!ethers.isAddress(FEE_RECIPIENT)) fail('FEE_RECIPIENT is not a valid address.');
if (FEE_BPS < 0 || FEE_BPS > 1000) fail('FEE_BPS out of range (0..1000). Contract caps at 1000 = 10%.');

const artifact = JSON.parse(
  fs.readFileSync(path.join(root, 'contracts', 'out', 'DirectBridgeFeeRouter.json'), 'utf8')
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
  if (bal === 0n) fail('Deployer balance is 0. Fund it with ETH first.');

  console.log('\nDeploy params:');
  console.log('  inbox       :', INBOX);
  console.log('  feeBps      :', FEE_BPS, `(${(FEE_BPS / 100).toFixed(2)}%)`);
  console.log('  feeRecipient:', FEE_RECIPIENT);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(INBOX, FEE_BPS, FEE_RECIPIENT);
  console.log('\nDeploy tx sent:', contract.deploymentTransaction().hash);
  console.log('Waiting for confirmation...');
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log('\n✅ DirectBridgeFeeRouter deployed at:', addr);

  const c = new ethers.Contract(addr, artifact.abi, provider);
  const [owner, inbox, feeBps, feeRecipient] = await Promise.all([
    c.owner(),
    c.inbox(),
    c.feeBps(),
    c.feeRecipient(),
  ]);
  console.log('\nOn-chain verify:');
  console.log('  owner       :', owner);
  console.log('  inbox       :', inbox);
  console.log('  feeBps      :', feeBps.toString());
  console.log('  feeRecipient:', feeRecipient);

  const outPath = path.join(root, 'contracts', 'out', `deployment.${EXPECTED_CHAIN_ID.toString()}.direct-bridge.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        chainId: Number(EXPECTED_CHAIN_ID),
        directBridgeFeeRouter: addr,
        inbox,
        feeBps: Number(feeBps),
        feeRecipient,
        deployer,
        txHash: contract.deploymentTransaction().hash,
      },
      null,
      2
    )
  );
  console.log('\nSaved deployment ->', outPath);
}

main().catch((e) => fail(e.message || String(e)));
