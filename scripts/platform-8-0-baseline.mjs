import {readFile,writeFile,mkdir,cp,symlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {loadEnvironment,connection,localConnection,connect,digest,isInside,protectDirectory} from './db-runtime.mjs';
import {backupIntegrated,restoreIntegrated} from './integrated-backup.mjs';
import {readOnlyState,compareDomain} from './platform-8-0-preservation.mjs';
await loadEnvironment();
const source=process.cwd(),phase=process.argv[2]??'prepare';
if(!['start','prepare','baseline','post-refactor','final'].includes(phase))throw new Error('Unsupported preservation phase');
if(phase==='start'){
 const git=(...args)=>execFileSync('git',args,{cwd:source,encoding:'utf8',windowsHide:true}).trim();
 const startOut=path.join(source,'output','stage7-5','platform-8-0-'+randomUUID());await protectDirectory(startOut);
 const files=git('ls-files').split('\n').filter(Boolean),sourceSha256={};for(const file of files)sourceSha256[file]=createHash('sha256').update(await readFile(file)).digest('hex');
 const design=await readFile('docs/PLATFORM_INTELLIGENCE_DESIGN.md').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 const c0=connection();const installed={};for(const name of ['next','react','typescript','@prisma/client','vitest','@playwright/test'])installed[name]=JSON.parse(await readFile(path.join('node_modules',name,'package.json'),'utf8')).version;
 const npm=execFileSync(process.execPath,[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'--version'],{encoding:'utf8',windowsHide:true}).trim();
 const start={at:new Date().toISOString(),head:git('rev-parse','HEAD'),workingTree:git('status','--short'),packageVersion:JSON.parse(await readFile('package.json','utf8')).version,installed,schemaSha256:sourceSha256['prisma/schema.prisma'],sourceSha256,untrackedDesignSha256:design?createHash('sha256').update(design).digest('hex'):null,storageMode:process.env.STORAGE_MODE??'file',dbMode:process.env.AEO_DB_ENV??'development (default)',dbHostClass:['localhost','127.0.0.1','::1'].includes(c0.host)?'local':'remote',node:process.version,npm,out:startOut};
 await writeFile(path.join(startOut,'start.json'),JSON.stringify(start,null,2),{mode:0o600});await writeFile('output/stage7-5/platform-8-0-current.json',JSON.stringify({out:startOut}));console.log('Captured preservation start: '+startOut);process.exit(0);
}
const {out}=JSON.parse(await readFile('output/stage7-5/platform-8-0-current.json','utf8'));
if(!isInside(path.join(source,'output','stage7-5'),out))throw new Error('Evidence directory outside intended workspace');
const runtime=path.join(out,'runtime');const c=connection();localConnection(c);
const save=(name,value)=>writeFile(path.join(out,name),JSON.stringify(value,null,2),{mode:0o600});
const initial=JSON.parse(await readFile(path.join(out,'start.json'),'utf8'));
const runResults=[];
async function state(config){const db=await connect(config);try{return await readOnlyState(db);}finally{await db.end();}}
async function run(label,args,env={},accepted=[0]){
 const started=Date.now();let output='';
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:runtime,windowsHide:true,env:{...process.env,...env}});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',()=>resolve(-1));child.on('close',exit=>resolve(exit??-1));});
 for(const value of [process.env.DATABASE_URL,env.DATABASE_URL])if(value)output=output.replaceAll(value,'[REDACTED_DATABASE_URL]');
 await writeFile(path.join(out,label+'.log'),output,{mode:0o600});const result={label,exitCode:code,accepted:accepted.includes(code),elapsedMs:Date.now()-started};runResults.push(result);await save(label+'.json',result);console.log(JSON.stringify(result));return result;
}
async function copyRuntime(){
 await mkdir(runtime,{recursive:true});
 for(const name of await readdir(source))if(!['node_modules','.git','.next','.pnpm-store','data','output','tmp','test-results','playwright-report','.env','tsconfig.tsbuildinfo'].includes(name))await cp(path.join(source,name),path.join(runtime,name),{recursive:true});
 try{await symlink(path.join(source,'node_modules'),path.join(runtime,'node_modules'),'junction');}catch(e){if(e.code!=='EEXIST')throw e;}
}
if(phase==='prepare'){
 await protectDirectory(out);
 const before=await state(c);await save('source-before.json',before);
 const backup=await backupIntegrated();await save('backup.json',backup);
 const restore=await restoreIntegrated(backup.file,backup.keyFile);await save('restore.json',restore);
 if(!restore.ok||restore.database===c.database||!restore.database.startsWith('aeo_restore_test_'))throw new Error('Isolated restore guard');
 const restored=await state({...c,database:restore.database});await save('restored-before.json',restored);
 await save('restored-domain-comparison.json',compareDomain(before.domain,restored.domain));
 if(before.inventory.dataHash!==restored.inventory.dataHash||before.inventory.schemaHash!==restored.inventory.schemaHash)throw new Error('Source/restore mismatch');
 await copyRuntime();
 const u=new URL(process.env.DATABASE_URL);u.pathname='/'+restore.database;
 await writeFile(path.join(runtime,'.env'),`DATABASE_URL=${u.href}\nSTORAGE_MODE=postgres\nLIVE_AI_ENABLED=false\nFREE_GEMINI_ENABLED=false\nAEO_FILES_ROOT=${restore.filesRoot}\nNEXT_TELEMETRY_DISABLED=1\n`,{mode:0o600});
 const schemaSource=await readFile('prisma/schema.prisma','utf8');const modelNames=[...schemaSource.matchAll(/^model (\w+)/gm)].map(m=>m[1]);
 const diskMigrations=[];for(const dir of await readdir('prisma/migrations')){const file=path.join('prisma/migrations',dir,'migration.sql');const sql=await readFile(file,'utf8');diskMigrations.push({directory:dir,sha256:createHash('sha256').update(sql).digest('hex'),sql});}
 await save('schema-baseline.json',{modelNames,liveTables:restored.ddl.tables.map(t=>t.name),diskMigrations,dbMigrationHistory:restored.ddl.migrationHistory});
 console.log(JSON.stringify({phase,out,restoreOk:restore.ok,sourceTables:before.ddl.tables.length,domainCoverage:before.domain}));
}else if(phase==='baseline'||phase==='post-refactor'){
 const backup=JSON.parse(await readFile(path.join(out,'backup.json'),'utf8'));
 const restore=phase==='post-refactor'?await restoreIntegrated(backup.file,backup.keyFile):JSON.parse(await readFile(path.join(out,'restore.json'),'utf8'));if(!restore.database.startsWith('aeo_restore_test_')||restore.database===c.database)throw new Error('Refusing tests against source');
 if(phase==='post-refactor')await save('post-refactor-restore.json',restore);
 if(phase==='post-refactor')await cp(path.join(source,'src/components/workspace.tsx'),path.join(runtime,'src/components/workspace.tsx'));
 if(phase==='post-refactor')for(const name of ['src/lib/workspace-views.ts','tests/workspace-views.test.ts','tests/e2e/workspace-boundary.spec.ts','tests/platform-rich-preservation.integration.test.ts','scripts/platform-8-0-preservation.mjs'])await cp(path.join(source,name),path.join(runtime,name));
 const u=new URL(process.env.DATABASE_URL);u.pathname='/'+restore.database;
 await writeFile(path.join(runtime,'.env'),`DATABASE_URL=${u.href}\nSTORAGE_MODE=postgres\nLIVE_AI_ENABLED=false\nFREE_GEMINI_ENABLED=false\nAEO_FILES_ROOT=${restore.filesRoot}\nNEXT_TELEMETRY_DISABLED=1\n`,{mode:0o600});
 const env={DATABASE_URL:u.href,STORAGE_MODE:'postgres',AEO_FILES_ROOT:restore.filesRoot,LIVE_AI_ENABLED:'false',FREE_GEMINI_ENABLED:'false',AEO_TEST_POSTGRES:'1',AEO_TEST_PDF:'1',AEO_STAGE8_ISOLATED:phase==='post-refactor'?'1':'0',NEXT_TELEMETRY_DISABLED:'1'};
 if(phase==='baseline')await run('prisma-vs-restored',['node_modules/prisma/build/index.js','migrate','diff','--from-schema-datamodel','prisma/schema.prisma','--to-schema-datasource','prisma/schema.prisma','--script','--exit-code'],env,[0,2]);
 await run(phase+'-unit-db-pdf',['node_modules/vitest/vitest.mjs','run','--maxWorkers=1'],env);
 const build=await run(phase+'-build',['node_modules/next/dist/bin/next','build'],env);
 if(build.accepted){await run(phase+'-typecheck',['node_modules/typescript/bin/tsc','--noEmit'],env);await run(phase+'-e2e',['node_modules/@playwright/test/cli.js','test'],env);}
 const after=await state(c),before=JSON.parse(await readFile(path.join(out,'source-before.json'),'utf8'));
 await save(phase+'-source-proof.json',{dataUnchanged:after.inventory.dataHash===before.inventory.dataHash,schemaUnchanged:digest(after.ddl)===digest(before.ddl),domain:compareDomain(before.domain,after.domain)});
 if(runResults.some(r=>!r.accepted))process.exitCode=1;
}else{
 const before=JSON.parse(await readFile(path.join(out,'source-before.json'),'utf8')),after=await state(c);await save('source-after.json',after);
 const changedSource=[];for(const [file,checksum] of Object.entries(initial.sourceSha256)){const actual=createHash('sha256').update(await readFile(file)).digest('hex');if(actual!==checksum)changedSource.push({file,before:checksum,after:actual});}
 const designSha=createHash('sha256').update(await readFile('docs/PLATFORM_INTELLIGENCE_DESIGN.md')).digest('hex');
 const proof={at:new Date().toISOString(),dataUnchanged:before.inventory.dataHash===after.inventory.dataHash,schemaUnchanged:digest(before.ddl)===digest(after.ddl),domain:compareDomain(before.domain,after.domain),changedSource,existingDesignPreserved:designSha===initial.untrackedDesignSha256,sourceBeforeHash:before.inventory.dataHash,sourceAfterHash:after.inventory.dataHash,sourceSchemaHash:after.inventory.schemaHash};
 await save('final-preservation.json',proof);console.log(JSON.stringify(proof));if(!proof.dataUnchanged||!proof.schemaUnchanged||!proof.existingDesignPreserved)process.exitCode=1;
}
