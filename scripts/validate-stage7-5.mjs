import {cp,mkdir,writeFile,readFile,symlink,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {backupIntegrated,restoreIntegrated} from './integrated-backup.mjs';
import {loadEnvironment,connection,connect,inventory,digest,protectDirectory} from './db-runtime.mjs';
await loadEnvironment();
const cwd=process.cwd(),out=path.join(cwd,'output','stage7-5',randomUUID()),runtime=path.join(out,'runtime');
await protectDirectory(out);
const backup=await backupIntegrated(),restore=await restoreIntegrated(backup.file,backup.keyFile);
const original=connection(),url=new URL(process.env.DATABASE_URL);url.pathname='/'+restore.database;
const beforeDb=await connect(original);const before=await inventory(beforeDb);await beforeDb.end();
await mkdir(runtime,{recursive:true});
for(const name of await readdir(cwd))if(!['node_modules','.next','.git','.pnpm-store','data','output','tmp','test-results','playwright-report','.env','tsconfig.tsbuildinfo'].includes(name))await cp(path.join(cwd,name),path.join(runtime,name),{recursive:true});
let dependencies=path.join(cwd,'node_modules');
if(process.argv.includes('--clean')){
 const candidates=(await readdir(path.join(cwd,'output','stage7-5'))).filter(n=>n.startsWith('environment-'));
 for(const candidate of candidates){const directory=path.join(cwd,'output','stage7-5',candidate);const result=JSON.parse(await readFile(path.join(directory,'result.json')).catch(()=>'{"offlineCleanInstall":{"code":-1}}'));if(result.offlineCleanInstall?.code===0)dependencies=path.join(directory,'clean-install','node_modules');}
 if(dependencies===path.join(cwd,'node_modules'))throw new Error('No verified offline clean dependency install');
}
await symlink(dependencies,path.join(runtime,'node_modules'),'junction');
await writeFile(path.join(runtime,'.env'),'DATABASE_URL='+url.href+'\nSTORAGE_MODE=postgres\nLIVE_AI_ENABLED=false\nFREE_GEMINI_ENABLED=false\nAEO_FILES_ROOT='+restore.filesRoot+'\nNEXT_TELEMETRY_DISABLED=1\n',{mode:0o600});
const env={...process.env,DATABASE_URL:url.href,STORAGE_MODE:'postgres',AEO_FILES_ROOT:restore.filesRoot,AEO_TEST_POSTGRES:'1',AEO_TEST_PDF:'1',LIVE_AI_ENABLED:'false',FREE_GEMINI_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'};
const results=[];
async function run(label,args,timeout=300000){const start=Date.now(),log=path.join(out,label+'.log');let output='';const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:runtime,env,windowsHide:true});const timer=setTimeout(()=>child.kill(),timeout);child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',()=>resolve(-1));child.on('close',code=>{clearTimeout(timer);resolve(code??-1);});});await writeFile(log,output.replaceAll(url.href,'[ISOLATED_DATABASE_URL]'));const result={label,exitCode,elapsedMs:Date.now()-start,log};results.push(result);console.log(JSON.stringify(result));return exitCode===0;}
// Add actual bytes and references to the isolated copy only.
const db=await connect({...original,database:restore.database});const id=randomUUID(),clientId=randomUUID(),docId=randomUUID(),evidenceId=randomUUID();
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6XkAAAAASUVORK5CYII=','base64'),sha256=createHash('sha256').update(png).digest('hex');
await mkdir(path.join(restore.filesRoot,'pilot-documents'),{recursive:true});await mkdir(path.join(restore.filesRoot,'evidence'),{recursive:true});
await writeFile(path.join(restore.filesRoot,'pilot-documents',docId+'.png'),png);await writeFile(path.join(restore.filesRoot,'evidence',evidenceId+'.png'),png);
await writeFile(path.join(restore.filesRoot,'sales-brand.json'),JSON.stringify({company:'LOCAL MOCK 회사 설정',contact:'LOCAL MOCK'}));
await db.query('INSERT INTO "Project" (id,"organizationId",name,operations) VALUES ($1,$2,$3,$4)',[id,'local-org','LOCAL MOCK backup fixture',{pilot:{documents:[{id:docId,projectId:id,storageName:docId+'.png',sha256,bytes:png.length,kind:'AGREEMENT'}]}}]);
await db.query('INSERT INTO "ClientEntity" (id,"projectId",name,payload) VALUES ($1,$2,$3,$4)',[clientId,id,'LOCAL MOCK',{evidenceFiles:[{id:evidenceId,storageName:evidenceId+'.png',sha256,bytes:png.length}]}]);
const oldUrl=process.env.DATABASE_URL,oldRoot=process.env.AEO_FILES_ROOT;process.env.DATABASE_URL=url.href;process.env.AEO_FILES_ROOT=restore.filesRoot;
const attachmentBackup=await backupIntegrated(),attachmentRestore=await restoreIntegrated(attachmentBackup.file,attachmentBackup.keyFile);
results.push({label:'attachment-restore',...attachmentRestore});
await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(742910)');
let finished=false;const blockedBackup=backupIntegrated().then(b=>{finished=true;return b;});await new Promise(r=>setTimeout(r,300));
const waited=!finished;await db.query('COMMIT');await blockedBackup;results.push({label:'writer-lock-consistency',ok:waited});
await writeFile(path.join(restore.filesRoot,'evidence',evidenceId+'.png'),Buffer.from('CORRUPTED LOCAL MOCK'));
let rejected=false;try{await backupIntegrated();}catch{rejected=true;}results.push({label:'corrupt-source-file-rejected',ok:rejected});
await writeFile(path.join(restore.filesRoot,'evidence',evidenceId+'.png'),png);
await db.query('DELETE FROM "ClientEntity" WHERE id=$1',[clientId]);await db.query('DELETE FROM "Project" WHERE id=$1',[id]);await db.end();
for(const file of [path.join(restore.filesRoot,'pilot-documents',docId+'.png'),path.join(restore.filesRoot,'evidence',evidenceId+'.png'),path.join(restore.filesRoot,'sales-brand.json')])await unlink(file);
process.env.DATABASE_URL=oldUrl;if(oldRoot===undefined)delete process.env.AEO_FILES_ROOT;else process.env.AEO_FILES_ROOT=oldRoot;
await run('typecheck',['node_modules/typescript/bin/tsc','--noEmit']);
await run('unit-db-pdf',['node_modules/vitest/vitest.mjs','run','--maxWorkers=1']);
const built=await run('build',['node_modules/next/dist/bin/next','build']);
if(built)await run('e2e',['node_modules/@playwright/test/cli.js','test'],600000);
const finalDb=await connect(original),after=await inventory(finalDb);await finalDb.end();
const nonvolatile=i=>Object.fromEntries(Object.entries(i.tables).filter(([t])=>!['AccessEvent','StaffSession'].includes(t)));
const preservation={label:'original-preservation',schemaUnchanged:before.schemaHash===after.schemaHash,nonvolatileRowsUnchanged:digest(nonvolatile(before))===digest(nonvolatile(after)),allRowsUnchanged:before.dataHash===after.dataHash};results.push(preservation);
await writeFile(path.join(out,'results.json'),JSON.stringify({at:new Date().toISOString(),restore,attachmentBackup,results,externalAiCalls:0,dependencies,realObservation:'NOT_RUN'},null,2));
console.log(JSON.stringify({out,preservation,results:results.map(({label,exitCode,ok})=>({label,exitCode,ok}))},null,2));
process.exitCode=results.some(r=>r.exitCode!==undefined&&r.exitCode!==0)||!preservation.nonvolatileRowsUnchanged?1:0;
