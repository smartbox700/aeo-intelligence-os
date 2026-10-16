import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {loadEnvironment,connection,connect,localConnection} from './db-runtime.mjs';
import {backupIntegrated,restoreIntegrated} from './integrated-backup.mjs';
await loadEnvironment();const source=connection();localConnection(source);
const {out}=JSON.parse(await readFile('output/stage7-5/platform-8-8-current.json','utf8'));
const originalBackup=JSON.parse(await readFile(path.join(out,'backup.json'),'utf8'));
const restored=await restoreIntegrated(originalBackup.file,originalBackup.keyFile);
await writeFile(path.join(out,'persistence-source-restore.json'),JSON.stringify(restored,null,2));
if(!restored.ok||!restored.database.startsWith('aeo_restore_test_')||restored.database===source.database)throw Error('Isolated restored database required');
const url=new URL(process.env.DATABASE_URL);url.pathname='/'+restored.database;
const env={...process.env,DATABASE_URL:url.href,STORAGE_MODE:'postgres',AEO_FILES_ROOT:restored.filesRoot,AEO_STAGE8_ISOLATED:'1',AEO_TEST_POSTGRES:'1',AEO_PI_MANIFEST:path.join(out,'restart-manifest.json')};
async function run(label,args,overrides={}){const result=await new Promise(resolve=>{const p=spawn(process.execPath,args,{env:{...env,...overrides},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';p.stdout.on('data',b=>log+=b);p.stderr.on('data',b=>log+=b);p.on('error',e=>resolve({code:-1,log:e.message}));p.on('exit',code=>resolve({code,log}));});await writeFile(path.join(out,label+'.log'),result.log.replaceAll(url.href,'[ISOLATED_DATABASE_URL]'));if(result.code!==0)throw Error(label+' failed; inspect protected log');console.log(label+': PASS');}
const blank='aeo_restore_test_'+randomUUID().replaceAll('-',''),admin=await connect({...source,database:'postgres'});try{await admin.query('CREATE DATABASE "'+blank+'" TEMPLATE template0');}finally{await admin.end();}
const blankUrl=new URL(url);blankUrl.pathname='/'+blank;
await run('blank-deploy',['node_modules/prisma/build/index.js','migrate','deploy'],{DATABASE_URL:blankUrl.href});
await run('blank-diff',['node_modules/prisma/build/index.js','migrate','diff','--from-schema-datamodel','prisma/schema.prisma','--to-schema-datasource','prisma/schema.prisma','--script','--exit-code'],{DATABASE_URL:blankUrl.href});
await run('clone-baseline',['node_modules/prisma/build/index.js','migrate','resolve','--applied','0_legacy_baseline']);
await run('clone-existing-partial',['node_modules/prisma/build/index.js','migrate','resolve','--applied','20261008_stage5']);
await run('clone-deploy',['node_modules/prisma/build/index.js','migrate','deploy']);
await run('process-a',['node_modules/vitest/vitest.mjs','run','tests/platform-persistence.phase.test.ts'],{AEO_PI_PHASE:'WRITE'});
await run('process-chain',['node_modules/vitest/vitest.mjs','run','tests/platform-persistence-chain.phase.test.ts'],{AEO_PI_PHASE:'CHAIN'});
await run('process-b',['node_modules/vitest/vitest.mjs','run','tests/platform-persistence.phase.test.ts'],{AEO_PI_PHASE:'READ'});
// Integrated backup uses the migrated clone, never the original database.
Object.assign(process.env,env);const backup=await backupIntegrated(),second=await restoreIntegrated(backup.file,backup.keyFile);await writeFile(path.join(out,'persistence-backup.json'),JSON.stringify(backup,null,2));await writeFile(path.join(out,'persistence-restore.json'),JSON.stringify(second,null,2));
const secondUrl=new URL(url);secondUrl.pathname='/'+second.database;
await run('restored-process-b',['node_modules/vitest/vitest.mjs','run','tests/platform-persistence.phase.test.ts'],{AEO_PI_PHASE:'READ',DATABASE_URL:secondUrl.href,AEO_FILES_ROOT:second.filesRoot});
await run('restored-security',['node_modules/vitest/vitest.mjs','run','tests/platform-persistence-security.phase.test.ts'],{AEO_PI_PHASE:'SECURITY',DATABASE_URL:secondUrl.href,AEO_FILES_ROOT:second.filesRoot});
await writeFile(path.join(out,'restart-proof.json'),JSON.stringify({ok:true,blankDatabase:blank,sourceUntouched:true,processAExited:true,independentProcessB:true,integratedRestore:second.ok,checkedAt:new Date().toISOString()},null,2));
