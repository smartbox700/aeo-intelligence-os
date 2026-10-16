import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {loadEnvironment,connection,connect} from './db-runtime.mjs';
import {readOnlyState,compareDomain} from './platform-8-0-preservation.mjs';
await loadEnvironment();const {out}=JSON.parse(await readFile('output/stage7-5/platform-8-8-current.json','utf8'));
const before=JSON.parse(await readFile(path.join(out,'source-before.json'),'utf8')),files=JSON.parse(await readFile(path.join(out,'files-before.json'),'utf8'));
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const modified=[],missing=[];for(const [file,sha]of Object.entries(files)){try{if(await hash(file)!==sha)modified.push(file);}catch(e){if(e.code!=='ENOENT')throw e;missing.push(file);}}
const allowed=['prisma/schema.prisma','src/lib/platform-intelligence/knowledge/repository.ts','src/lib/platform-intelligence/rules/registry.ts','src/lib/platform-intelligence/observations/repository.ts','src/lib/platform-intelligence/readiness/repository.ts','src/lib/platform-intelligence/actions/definitions.ts','src/lib/platform-intelligence/actions/bridge.ts','src/lib/platform-intelligence/experiments/repository.ts','src/lib/platform-intelligence/experiments/snapshots.ts','src/lib/platform-intelligence/insights/repository.ts'];
const db=await connect(connection());let after;try{after=await readOnlyState(db);}finally{await db.end();}
const runtime=path.join(out,'runtime'),runtimeMismatches=[];
const candidates=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8',windowsHide:true}).split(/\r?\n/).filter(file=>file.startsWith('src/lib/platform-intelligence/')||file.startsWith('tests/platform-persistence'));
for(const file of candidates){try{if(await hash(file)!==await hash(path.join(runtime,file)))runtimeMismatches.push(file);}catch{runtimeMismatches.push(file);}}
const domains=compareDomain(before.domain,after.domain),proof={at:new Date().toISOString(),originalDataUnchanged:before.inventory.dataHash===after.inventory.dataHash,originalSchemaUnchanged:before.inventory.schemaHash===after.inventory.schemaHash,domains,existingFileCount:Object.keys(files).length,unchangedExistingFiles:Object.keys(files).length-modified.length-missing.length,intentionalModifiedFiles:modified,missingFiles:missing,unexpectedModifiedFiles:modified.filter(f=>!allowed.includes(f)),workspacePreserved:await hash('src/components/workspace.tsx')===files['src/components/workspace.tsx'],verifiedPlatformFiles:candidates.length,runtimeMismatches};
await writeFile(path.join(out,'final-preservation.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({...proof,domains:Object.values(domains).every(d=>d.equal)},null,2));
if(!proof.originalDataUnchanged||!proof.originalSchemaUnchanged||Object.values(domains).some(d=>!d.equal)||missing.length||proof.unexpectedModifiedFiles.length||runtimeMismatches.length)process.exitCode=1;
