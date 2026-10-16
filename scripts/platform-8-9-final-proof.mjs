import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {loadEnvironment,connection,connect} from './db-runtime.mjs';
import {readOnlyState,compareDomain} from './platform-8-0-preservation.mjs';
await loadEnvironment();const {out}=JSON.parse(await readFile('output/stage7-5/platform-8-9-current.json','utf8'));
const before=JSON.parse(await readFile(path.join(out,'source-before.json'),'utf8')),files=JSON.parse(await readFile(path.join(out,'files-before.json'),'utf8'));
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const modified=[],missing=[];for(const [file,sha]of Object.entries(files)){try{if(await hash(file)!==sha)modified.push(file);}catch(e){if(e.code!=='ENOENT')throw e;missing.push(file);}}
const allowed=['src/lib/platform-intelligence/persistence/postgres.ts'];
const db=await connect(connection());let after;try{after=await readOnlyState(db);}finally{await db.end();}
const runtime=path.join(out,'runtime'),runtimeMismatches=[];
const candidates=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8',windowsHide:true}).split(/\r?\n/).filter(file=>file.startsWith('src/lib/platform-intelligence/')||file.startsWith('tests/platform-persistence')||file.startsWith('tests/platform-server')||file.startsWith('src/app/api/platform-intelligence/')||file==='tests/e2e/platform-server-boundary.spec.ts');
for(const file of candidates){try{if(await hash(file)!==await hash(path.join(runtime,file)))runtimeMismatches.push(file);}catch{runtimeMismatches.push(file);}}
const domains=compareDomain(before.domain,after.domain),proof={at:new Date().toISOString(),originalDataUnchanged:before.inventory.dataHash===after.inventory.dataHash,originalSchemaUnchanged:before.inventory.schemaHash===after.inventory.schemaHash,domains,existingFileCount:Object.keys(files).length,unchangedExistingFiles:Object.keys(files).length-modified.length-missing.length,intentionalModifiedFiles:modified,missingFiles:missing,unexpectedModifiedFiles:modified.filter(f=>!allowed.includes(f)),workspacePreserved:await hash('src/components/workspace.tsx')===files['src/components/workspace.tsx'],verifiedPlatformFiles:candidates.length,runtimeMismatches};
await writeFile(path.join(out,'final-preservation.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({...proof,domains:Object.values(domains).every(d=>d.equal)},null,2));
const names=['KNOWLEDGE','RULE','RULESET','OBSERVATION','READINESS_POLICY','READINESS','ACTION','EXECUTION','MEASUREMENT','EXPERIMENT','EXPERIMENT_RESULT','INSIGHT_POLICY','INSIGHT'];
async function counts(file){const r=JSON.parse(await readFile(path.join(out,file),'utf8'));if(!r.database.startsWith('aeo_restore_test_'))throw Error('Isolated DB required');const target=await connect({...connection(),database:r.database});try{await target.query('BEGIN READ ONLY');const rows=(await target.query('SELECT environment,domain,count(*)::int AS count FROM "PlatformIntelligenceRecord" GROUP BY environment,domain ORDER BY environment,domain')).rows,audit=(await target.query('SELECT environment,count(*)::int AS count FROM "PlatformIntelligenceAuditEvent" GROUP BY environment')).rows;await target.query('COMMIT');return {production:Object.fromEntries(names.map(name=>[name,rows.find(r=>r.environment==='PRODUCTION'&&r.domain===name)?.count??0])),rows,audit};}finally{await target.end();}}
await writeFile(path.join(out,'production-counts.json'),JSON.stringify({sourceTableAvailable:after.ddl.tables.some(t=>t.name==='PlatformIntelligenceRecord'),cleanMigrated:await counts('regression-restore.json'),isolatedContractFixtures:await counts('api-restore.json'),fixtureExplanation:'Only generated HYPOTHESIS approval/restart contract fixture; no official FACT/Rule/Action pack. Synthetic isolation fixture is separate.'},null,2));
if(!proof.originalDataUnchanged||!proof.originalSchemaUnchanged||Object.values(domains).some(d=>!d.equal)||missing.length||proof.unexpectedModifiedFiles.length||runtimeMismatches.length)process.exitCode=1;
