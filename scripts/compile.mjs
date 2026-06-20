#!/usr/bin/env node
// Compile every Solidity contract in contracts/src/ and write artifacts to contracts/out/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const solc = require('solc');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'contracts', 'src');
const outDir = path.join(root, 'contracts', 'out');

const sourceFiles = fs
  .readdirSync(srcDir)
  .filter((file) => file.endsWith('.sol'))
  .sort();

if (sourceFiles.length === 0) {
  throw new Error(`No Solidity files found in ${srcDir}`);
}

const sources = Object.fromEntries(
  sourceFiles.map((file) => [file, { content: fs.readFileSync(path.join(srcDir, file), 'utf8') }])
);

const input = {
  language: 'Solidity',
  sources,
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

fs.mkdirSync(outDir, { recursive: true });
for (const file of sourceFiles) {
  const fileContracts = output.contracts[file];
  for (const [contractName, compiled] of Object.entries(fileContracts)) {
    if (!compiled.evm?.bytecode?.object) continue;
    const outPath = path.join(outDir, `${contractName}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify({ abi: compiled.abi, bytecode: '0x' + compiled.evm.bytecode.object }, null, 2)
    );
    console.log(`Compiled ${contractName} -> ${outPath}`);
    console.log('Bytecode size:', compiled.evm.bytecode.object.length / 2, 'bytes');
  }
}
