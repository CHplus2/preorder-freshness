import fs from 'node:fs';
import solc from 'solc';
import {createHash} from 'node:crypto';
import {keccak256} from 'ethers';
const source = fs.readFileSync(new URL('./PreorderEscrow.sol', import.meta.url),'utf8');
const output = JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'PreorderEscrow.sol':{content:source}},settings:{evmVersion:'shanghai',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}})));
const errors=(output.errors || []).filter(e=>e.severity==='error');
if(errors.length) throw Error(errors.map(e=>e.formattedMessage).join('\n'));
export const artifact=output.contracts['PreorderEscrow.sol'].PreorderEscrow;
export const clientManifest={chain_id:11155111,compiler:solc.version(),source_sha256:createHash('sha256').update(source).digest('hex'),
 runtime_keccak256:keccak256('0x'+artifact.evm.deployedBytecode.object),abi:artifact.abi};
const manifestPath=new URL('../frontend/src/contracts/preorderEscrow.json',import.meta.url);
if(process.argv.includes('--sync-client')){
 fs.mkdirSync(new URL('../frontend/src/contracts/',import.meta.url),{recursive:true});
 fs.writeFileSync(manifestPath,JSON.stringify(clientManifest,null,2)+'\n');
}else if(JSON.stringify(JSON.parse(fs.readFileSync(manifestPath,'utf8')))!==JSON.stringify(clientManifest)){
 throw Error('Escrow client manifest is stale. Review the source change, then run node compile.mjs --sync-client.');
}
if(process.argv[1]?.endsWith('compile.mjs')) {
 fs.mkdirSync(new URL('./artifacts/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('./artifacts/PreorderEscrow.json',import.meta.url),JSON.stringify(artifact,null,2));
 console.log('Compiled Sepolia/local-only escrow');
}
