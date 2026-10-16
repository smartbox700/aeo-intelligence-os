import {readFile,writeFile,mkdir,cp,symlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {loadEnvironment,connection,connect} from './db-runtime.mjs';
import {restoreIntegrated,backupIntegrated} from './integrated-backup.mjs';
import {readOnlyState,compareDomain} from './platform-8-0-preservation.mjs';
await loadEnvironment();const source=process.cwd(),{out}=JSON.parse(await readFile('output/stage7-5/platform-8-12-current.json','utf8')),phase='regression',config=connection();

const originalBackup=JSON.parse(await readFile(path.join(out,'backup.json'),'utf8')),restored=await restoreIntegrated(originalBackup.file,originalBackup.keyFile);
if(!restored.ok||!restored.database.startsWith('aeo_restore_test_')||restored.database===config.database)throw Error('Isolated DB required');
await writeFile(path.join(out,phase+'-restore.json'),JSON.stringify(restored,null,2));
const url=new URL(process.env.DATABASE_URL);url.pathname='/'+restored.database;
let runtime=source;
if(phase==='regression'){
 runtime=path.join(out,'runtime');await mkdir(runtime,{recursive:true});
 for(const name of await readdir(source))if(!['node_modules','.git','.next','.pnpm-store','data','output','tmp','test-results','playwright-report','.env','tsconfig.tsbuildinfo'].includes(name))await cp(path.join(source,name),path.join(runtime,name),{recursive:true});
 try{await symlink(path.join(source,'node_modules'),path.join(runtime,'node_modules'),'junction');}catch(e){if(e.code!=='EEXIST')throw e;}
 await writeFile(path.join(runtime,'.env'),`DATABASE_URL=${url.href}\nSTORAGE_MODE=postgres\nAEO_FILES_ROOT=${restored.filesRoot}\nLIVE_AI_ENABLED=false\nFREE_GEMINI_ENABLED=false\n`,{mode:0o600});
}
const env={...process.env,DATABASE_URL:url.href,STORAGE_MODE:'postgres',AEO_FILES_ROOT:restored.filesRoot,LIVE_AI_ENABLED:'false',FREE_GEMINI_ENABLED:'false',AEO_TEST_POSTGRES:'1',AEO_TEST_PDF:'1',AEO_STAGE8_ISOLATED:'1',NEXT_TELEMETRY_DISABLED:'1',PLATFORM_INTELLIGENCE_ENABLED:phase==='pack'?'true':'false',PLATFORM_INTELLIGENCE_PERSISTENCE_ENABLED:phase==='pack'?'true':'false',AEO_PI_PACK_MANIFEST:path.join(out,'pack-restart-manifest.json')};
for(const key of ['AEO_PI_PHASE','AEO_PI_SERVER_PHASE','AEO_PI_PACK_PHASE'])delete env[key];if(phase==='pack')env.AEO_AUTH_NAMESPACE='pi810-tests';
const results={};async function run(label,args,extra={}){const value=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:runtime,env:{...env,...extra},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',e=>resolve({exitCode:-1,log:e.message}));child.on('exit',exitCode=>resolve({exitCode,log}));});await writeFile(path.join(out,label+'.log'),value.log.replaceAll(url.href,'[ISOLATED_DATABASE_URL]'));results[label]={exitCode:value.exitCode};await writeFile(path.join(out,phase+'-results.json'),JSON.stringify(results,null,2));console.log(label+': '+value.exitCode);return value.exitCode===0;}
for(const [label,args]of [['baseline',['migrate','resolve','--applied','0_legacy_baseline']],['partial',['migrate','resolve','--applied','20261008_stage5']],['migration',['migrate','deploy']]])if(!await run(phase+'-'+label,['node_modules/prisma/build/index.js',...args]))throw Error('Isolated migration failed');

 await run('full-unit-db-pdf',['node_modules/vitest/vitest.mjs','run','--maxWorkers=1']);
 if(await run('prisma-generate',['node_modules/prisma/build/index.js','generate'])&&await run('production-build',['node_modules/next/dist/bin/next','build'])){await run('full-typecheck',['node_modules/typescript/bin/tsc','--noEmit']);await run('full-e2e',['node_modules/@playwright/test/cli.js','test']);}
 const db=await connect(config);let after;try{after=await readOnlyState(db);}finally{await db.end();}const before=JSON.parse(await readFile(path.join(out,'predeploy-source-state.json'),'utf8'));await writeFile(path.join(out,'regression-source-after.json'),JSON.stringify(after,null,2));await writeFile(path.join(out,'regression-source-preservation.json'),JSON.stringify({dataUnchanged:before.inventory.dataHash===after.inventory.dataHash,schemaUnchanged:before.inventory.schemaHash===after.inventory.schemaHash,domains:compareDomain(before.domain,after.domain)},null,2));
