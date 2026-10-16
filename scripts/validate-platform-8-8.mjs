import {readFile,writeFile,mkdir,cp,symlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {loadEnvironment,connection,connect} from './db-runtime.mjs';
import {readOnlyState,compareDomain} from './platform-8-0-preservation.mjs';
import {restoreIntegrated} from './integrated-backup.mjs';
await loadEnvironment();const source=process.cwd(),{out}=JSON.parse(await readFile('output/stage7-5/platform-8-8-current.json','utf8'));
const backup=JSON.parse(await readFile(path.join(out,'backup.json'),'utf8')),restored=await restoreIntegrated(backup.file,backup.keyFile),config=connection();
await writeFile(path.join(out,'regression-source-restore.json'),JSON.stringify(restored,null,2));
if(!restored.ok||!restored.database.startsWith('aeo_restore_test_')||restored.database===config.database)throw Error('Isolated DB required');
const runtime=path.join(out,'runtime');await mkdir(runtime,{recursive:true});
for(const name of await readdir(source))if(!['node_modules','.git','.next','.pnpm-store','data','output','tmp','test-results','playwright-report','.env','tsconfig.tsbuildinfo'].includes(name))await cp(path.join(source,name),path.join(runtime,name),{recursive:true});
try{await symlink(path.join(source,'node_modules'),path.join(runtime,'node_modules'),'junction');}catch(e){if(e.code!=='EEXIST')throw e;}
const url=new URL(process.env.DATABASE_URL);url.pathname='/'+restored.database;
const env={...process.env,DATABASE_URL:url.href,STORAGE_MODE:'postgres',AEO_FILES_ROOT:restored.filesRoot,LIVE_AI_ENABLED:'false',FREE_GEMINI_ENABLED:'false',AEO_TEST_POSTGRES:'1',AEO_TEST_PDF:'1',AEO_STAGE8_ISOLATED:'1',NEXT_TELEMETRY_DISABLED:'1',PLATFORM_INTELLIGENCE_ENABLED:'false',PLATFORM_INTELLIGENCE_PERSISTENCE_ENABLED:'false'};delete env.AEO_PI_PHASE;
await writeFile(path.join(runtime,'.env'),`DATABASE_URL=${url.href}\nSTORAGE_MODE=postgres\nAEO_FILES_ROOT=${restored.filesRoot}\nLIVE_AI_ENABLED=false\nFREE_GEMINI_ENABLED=false\n`,{mode:0o600});
const results={};
async function run(label,args){const value=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:runtime,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',e=>resolve({exitCode:-1,log:e.message}));child.on('exit',exitCode=>resolve({exitCode,log}));});await writeFile(path.join(out,label+'.log'),value.log.replaceAll(url.href,'[ISOLATED_DATABASE_URL]'));results[label]={exitCode:value.exitCode};await writeFile(path.join(out,'regression-proof.json'),JSON.stringify(results,null,2));console.log(label+': '+value.exitCode);return value.exitCode===0;}
if(!await run('regression-baseline',['node_modules/prisma/build/index.js','migrate','resolve','--applied','0_legacy_baseline'])||!await run('regression-partial',['node_modules/prisma/build/index.js','migrate','resolve','--applied','20261008_stage5'])||!await run('regression-migration',['node_modules/prisma/build/index.js','migrate','deploy']))throw Error('Regression migration failed');
await run('full-unit-db-pdf',['node_modules/vitest/vitest.mjs','run','--maxWorkers=1']);
if(await run('production-build',['node_modules/prisma/build/index.js','generate'])){
 if(await run('next-build',['node_modules/next/dist/bin/next','build'])){await run('full-typecheck',['node_modules/typescript/bin/tsc','--noEmit']);await run('full-e2e',['node_modules/@playwright/test/cli.js','test']);}
}
const db=await connect(config);let after;try{after=await readOnlyState(db);}finally{await db.end();}
const before=JSON.parse(await readFile(path.join(out,'source-before.json'),'utf8'));
await writeFile(path.join(out,'source-after.json'),JSON.stringify(after,null,2));await writeFile(path.join(out,'source-preservation-proof.json'),JSON.stringify({dataUnchanged:before.inventory.dataHash===after.inventory.dataHash,schemaUnchanged:before.inventory.schemaHash===after.inventory.schemaHash,domains:compareDomain(before.domain,after.domain)},null,2));
