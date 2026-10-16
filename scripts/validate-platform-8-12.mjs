import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import path from 'node:path';
import {loadEnvironment,connection,connect,protectDirectory,digest} from './db-runtime.mjs';
import {backupIntegrated,restoreIntegrated} from './integrated-backup.mjs';
import {readOnlyState,compareDomain} from './platform-8-0-preservation.mjs';
await loadEnvironment();
const source=process.cwd(),out=path.resolve('output/stage7-5/platform-8-12-'+randomUUID());
await protectDirectory(out);
const save=(name,value)=>writeFile(path.join(out,name+'.json'),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
await writeFile('output/stage7-5/platform-8-12-current.json',JSON.stringify({out}));
async function files(dir){let rows=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())rows.push(...await files(p));else if(entry.isFile())rows.push({path:path.relative(source,p).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(p)).digest('hex')});}return rows.sort((a,b)=>a.path.localeCompare(b.path));}
const appFiles=[...await files('src'),...await files('prisma')].sort((a,b)=>a.path.localeCompare(b.path));
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean),trackedFiles=[];
for(const p of tracked)trackedFiles.push({path:p,sha256:await readFile(p).then(b=>createHash('sha256').update(b).digest('hex')).catch(()=>null)});
await save('freeze',{head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),trackedFileManifestHash:digest(trackedFiles),trackedFiles,appFiles,codeHash:digest(appFiles),piSourceHash:digest(appFiles.filter(f=>f.path.startsWith('src/lib/platform-intelligence/'))),uiSourceHash:digest(appFiles.filter(f=>f.path.startsWith('src/components/')||f.path.startsWith('src/app/'))),schemaHash:appFiles.find(f=>f.path==='prisma/schema.prisma').sha256,migrationHash:digest(appFiles.filter(f=>f.path.startsWith('prisma/migrations/'))),createdAt:new Date().toISOString()});
async function state(database){const db=await connect({...connection(),...(database?{database}:{})});try{return await readOnlyState(db);}finally{await db.end();}}
const before=await state();await save('predeploy-source-state',before);
const backup=await backupIntegrated();await save('backup',backup);
const restored=await restoreIntegrated(backup.file,backup.keyFile);await save('restore-proof',restored);
if(!restored.ok||!restored.database.startsWith('aeo_restore_test_')||restored.database===connection().database)throw Error('Verified isolated restore required');
const cloneBefore=await state(restored.database);await save('clone-before',cloneBefore);
await save('backup-verification',{encrypted:backup.encrypted,keySeparated:!path.dirname(backup.keyFile).startsWith(path.dirname(backup.file)),restore:restored.ok,data:before.inventory.dataHash===cloneBefore.inventory.dataHash,schema:before.inventory.schemaHash===cloneBefore.inventory.schemaHash,domains:compareDomain(before.domain,cloneBefore.domain),attachments:{files:backup.files,references:backup.references,coverage:backup.references?'PRESENT':'EMPTY_IN_SOURCE'},staffAndSessionTables: Object.fromEntries(Object.entries(before.inventory.tables).filter(([n])=>/Staff|Session/.test(n)).map(([n,v])=>[n,{equal:digest(v)===digest(cloneBefore.inventory.tables[n]),count:v.count}]))});
const url=new URL(process.env.DATABASE_URL);url.pathname='/'+restored.database;
async function run(label,args){const result=await new Promise(resolve=>{const child=spawn(process.execPath,['node_modules/prisma/build/index.js',...args],{cwd:source,env:{...process.env,DATABASE_URL:url.href},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',()=>resolve({exitCode:-1,log:'Process start failed'}));child.on('exit',exitCode=>resolve({exitCode,log}));});await writeFile(path.join(out,label+'.log'),result.log.replaceAll(url.href,'[ISOLATED_DATABASE_URL]'));console.log(label+': '+result.exitCode);return result;}
const baseline=await run('baseline',['migrate','resolve','--applied','0_legacy_baseline']);
const historical=await run('historical',['migrate','resolve','--applied','20261008_stage5']);
const migration=await run('migration',['migrate','deploy']);
const cloneAfter=await state(restored.database);await save('clone-after',cloneAfter);
const diff=await run('schema-diff',['migrate','diff','--from-url',url.href,'--to-schema-datamodel','prisma/schema.prisma','--script','--exit-code']);
const redeploy=await run('redeploy',['migrate','deploy']);const cloneAgain=await state(restored.database);
const legacyNames=Object.keys(before.inventory.tables),pick=state=>({tables:Object.fromEntries(legacyNames.map(n=>[n,state.inventory.tables[n]])),columns:state.ddl.columns.filter(r=>legacyNames.includes(r.table_name)),indexes:state.ddl.indexes.filter(r=>legacyNames.includes(r.tablename)),constraints:state.ddl.constraints.filter(r=>legacyNames.includes(r.table_name))});
await save('migration-rehearsal',{baseline:baseline.exitCode,historical:historical.exitCode,migration:migration.exitCode,legacyTableCount:legacyNames.length,legacyPreserved:digest(pick(cloneBefore))===digest(pick(cloneAfter)),domains:compareDomain(cloneBefore.domain,cloneAfter.domain),addedTables:Object.keys(cloneAfter.inventory.tables).filter(n=>!legacyNames.includes(n)),schemaDiffExitCode:diff.exitCode,schemaDiffEmpty:diff.exitCode===0,redeployExitCode:redeploy.exitCode,redeployNoOp:digest(cloneAfter)===digest(cloneAgain),failureSimulation:'NOT_RUN'});
const after=await state();await save('source-after',after);await save('source-preservation',{dataUnchanged:before.inventory.dataHash===after.inventory.dataHash,schemaUnchanged:before.inventory.schemaHash===after.inventory.schemaHash,domains:compareDomain(before.domain,after.domain),piTablesAbsent:!Object.keys(after.inventory.tables).some(n=>n.startsWith('PlatformIntelligence')),flagsOff:process.env.PLATFORM_INTELLIGENCE_ENABLED!=='true'&&process.env.PLATFORM_INTELLIGENCE_PERSISTENCE_ENABLED!=='true',humanApprovalRecorded:false});
console.log(JSON.stringify({out,restored:restored.ok,schemaDiffExitCode:diff.exitCode}));
