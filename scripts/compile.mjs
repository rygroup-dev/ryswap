#!/usr/bin/env node
// Compile contracts/src/FeeRouter.sol with solc and write artifact to contracts/out/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const solc = require('solc');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcPath = path.join(root, 'contracts', 'src', 'FeeRouter.sol');
const outDir = path.join(root, 'contracts', 'out');

const source = fs.readFileSync(srcPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'FeeRouter.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: {
      '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  let fatal = false;
  for (const e of output.errors) {
    console.error(e.formattedMessage);
    if (e.severity === 'error') fatal = true;
  }
  if (fatal) process.exit(1);
}

const c = output.contracts['FeeRouter.sol']['FeeRouter'];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'FeeRouter.json'),
  JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }, null, 2)
);

console.log('Compiled FeeRouter ->', path.join(outDir, 'FeeRouter.json'));
console.log('Bytecode size:', c.evm.bytecode.object.length / 2, 'bytes');
