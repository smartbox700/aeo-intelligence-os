import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {loadEnvironment,connection,connect,digest} from './db-runtime.mjs';
import {restoreIntegrated} from './integrated-backup.mjs';
import {readOnlyState} from './platform-8-0-preservation.mjs';
await loadEnvironment();const {out}=JSON.parse(await readFile('output/stage7-5/platform-8-12-current.json')),backup=JSON.parse(await readFile(path.join(out,'backup.json')));
const failed=await restoreIntegrated(backup.file,backup.keyFile);if(!failed.ok||!failed.database.startsWith('aeo_restore_test_'))throw Error('Isolated restore required');
await writeFile(path.join(out,'failure-clone.json'),JSON.stringify(failed,null,2));
const url=new URL(process.env.DATABASE_URL);url.pathname='/'+failed.database;
async function run(label,args){const r=await new Promise(resolve=>{const c=spawn(process.execPath,['node_modules/prisma/build/index.js',...args],{env:{...process.env,DATABASE_URL:url.href},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';c.stdout.on('data',v=>log+=v);c.stderr.on('data',v=>log+=v);c.on('exit',exitCode=>resolve({exitCode,log}));});await writeFile(path.join(out,label+'.log'),r.log.replaceAll(url.href,'[ISOLATED_DATABASE_URL]'));return r;}
await run('failure-baseline',['migrate','resolve','--applied','0_legacy_baseline']);await run('failure-historical',['migrate','resolve','--applied','20261008_stage5']);
const db=await connect({...connection(),database:failed.database});let before,after,failedHistory;
try{before=await readOnlyState(db);await db.query('CREATE TABLE "PlatformIntelligenceRecord" ("id" TEXT PRIMARY KEY)');const result=await run('intentional-migration-failure',['migrate','deploy']);after=await readOnlyState(db);failedHistory=(await db.query('SELECT migration_name,finished_at,applied_steps_count FROM _prisma_migrations WHERE migration_name=$1',['20261015_platform_intelligence'])).rows;
const legacy=state=>({tables:Object.fromEntries(Object.entries(state.inventory.tables).filter(([n])=>!n.startsWith('PlatformIntelligence')&&n!=='_prisma_migrations')),domain:state.domain});
const proof={expectedFailure:result.exitCode!==0,migrationRecordedSuccessful:failedHistory.some(r=>r.finished_at!==null),incompleteSchema:true,legacyPreserved:digest(legacy(before))===digest(legacy(after)),operational:false,disposition:'QUARANTINED_DO_NOT_USE; restore verified backup to a NEW database',humanApprovalRecorded:false};
await writeFile(path.join(out,'failure-simulation.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}finally{await db.end();}
const recovered=await restoreIntegrated(backup.file,backup.keyFile);await writeFile(path.join(out,'failure-recovery-restore.json'),JSON.stringify(recovered,null,2));if(!recovered.ok)throw Error('Recovery restore failed');
