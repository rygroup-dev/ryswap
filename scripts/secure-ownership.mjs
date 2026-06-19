#!/usr/bin/env node
// Secure the FeeRouter: move feeRecipient to clean wallet, THEN transfer ownership.
// Order matters: set fee recipient first (still owner), then hand over ownership.
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
const NEW_WALLET = process.env.NEW_WALLET;
const FEE_BPS = parseInt(process.env.FEE_BPS || '30', 10);
const BROADCAST = process.env.BROADCAST === '1';

function fail(m){console.error('ERROR:',m);process.exit(1);}
if(!PK) fail('DEPLOYER_PK not set');
if(!FEE_ROUTER) fail('FEE_ROUTER not set');
if(!NEW_WALLET) fail('NEW_WALLET not set');
if(!ethers.isAddress(NEW_WALLET)) fail('NEW_WALLET invalid address');

const abi = JSON.parse(fs.readFileSync(path.join(root,'contracts','out','FeeRouter.json'),'utf8')).abi;

async function main(){
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  if((await provider.getNetwork()).chainId!==1n) fail('not mainnet');
  const wallet = new ethers.Wallet(PK, provider);
  const c = new ethers.Contract(FEE_ROUTER, abi, wallet);

  const curOwner = await c.owner();
  const me = await wallet.getAddress();
  console.log('contract owner :', curOwner);
  console.log('signer         :', me);
  console.log('new clean wallet:', NEW_WALLET);
  if(curOwner.toLowerCase()!==me.toLowerCase()) fail('signer is not current owner');

  const newAddr = ethers.getAddress(NEW_WALLET);

  // Dry-run both
  await c.setFeeConfig.staticCall(FEE_BPS, newAddr);
  await c.transferOwnership.staticCall(newAddr);
  console.log('\n[dry-run] setFeeConfig OK, transferOwnership OK');

  if(!BROADCAST){ console.log('\nDRY-RUN ONLY. Set BROADCAST=1 to execute.'); return; }

  console.log('\n1) setFeeConfig(',FEE_BPS,',',newAddr,')');
  let tx = await c.setFeeConfig(FEE_BPS, newAddr);
  console.log('   tx:',tx.hash); await tx.wait();
  console.log('   feeRecipient now:', await c.feeRecipient());

  console.log('2) transferOwnership(',newAddr,')');
  tx = await c.transferOwnership(newAddr);
  console.log('   tx:',tx.hash); await tx.wait();
  console.log('   owner now:', await c.owner());

  console.log('\n✅ Secured. Old leaked wallet no longer controls the contract.');
}
main().catch(e=>fail(e.shortMessage||e.message||String(e)));
