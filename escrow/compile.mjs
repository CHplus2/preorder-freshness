import fs from 'node:fs';
import solc from 'solc';
const source = fs.readFileSync(new URL('./PreorderEscrow.sol', import.meta.url),'utf8');
const output = JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'PreorderEscrow.sol':{content:source}},settings:{evmVersion:'shanghai',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
const errors=(output.errors || []).filter(e=>e.severity==='error');
if(errors.length) throw Error(errors.map(e=>e.formattedMessage).join('\n'));
export const artifact=output.contracts['PreorderEscrow.sol'].PreorderEscrow;
if(process.argv[1]?.endsWith('compile.mjs')) {
 fs.mkdirSync(new URL('./artifacts/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('./artifacts/PreorderEscrow.json',import.meta.url),JSON.stringify(artifact,null,2));
 console.log('Compiled Sepolia/local-only escrow');
}
