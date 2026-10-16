import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {loadEnvironment} from './db-runtime.mjs';
await loadEnvironment();const source=process.cwd(),{out}=JSON.parse(await readFile('output/stage7-5/platform-8-10-current.json','utf8')),runtime=path.join(out,'runtime'),url=new URL(process.env.DATABASE_URL);
const results={};
for(const [label,file] of [['http-restarted-server','pack-restore.json'],['http-restored-server','pack-second-restore.json']]){
 const restored=JSON.parse(await readFile(path.join(out,file),'utf8'));if(!restored.database.startsWith('aeo_restore_test_'))throw Error('Isolated DB required');url.pathname='/'+restored.database;
 const env={...process.env,DATABASE_URL:url.href,STORAGE_MODE:'postgres',AEO_FILES_ROOT:restored.filesRoot,AEO_AUTH_NAMESPACE:'pi810-tests',PLATFORM_INTELLIGENCE_ENABLED:'true',PLATFORM_INTELLIGENCE_PERSISTENCE_ENABLED:'true',LIVE_AI_ENABLED:'false',FREE_GEMINI_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1',AEO_STAGE8_ISOLATED:'1',AEO_PI_PACK_PHASE:'READ',AEO_PI_PACK_MANIFEST:path.join(out,'pack-restart-manifest.json'),AEO_PI_PACK_HTTP_URL:'http://127.0.0.1:3101'};
 let serverLog='';const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101'],{cwd:runtime,env,windowsHide:true,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
 try{
  let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Server exited');try{if((await fetch(env.AEO_PI_PACK_HTTP_URL+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Server readiness timeout');
  const result=await new Promise(resolve=>{const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/platform-official-pack.phase.test.ts'],{cwd:source,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',e=>resolve({exitCode:-1,log:e.message}));child.on('exit',exitCode=>resolve({exitCode,log}));});await writeFile(path.join(out,label+'.log'),result.log.replaceAll(url.href,'[ISOLATED_DATABASE_URL]'));results[label]={exitCode:result.exitCode};console.log(label+': '+result.exitCode);if(result.exitCode!==0)throw Error('Authenticated network API mismatch');
 }finally{const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await Promise.race([ended,new Promise(resolve=>setTimeout(resolve,3000))]);await writeFile(path.join(out,label+'-server.log'),serverLog.replaceAll(url.href,'[ISOLATED_DATABASE_URL]'));await writeFile(path.join(out,'http-results.json'),JSON.stringify(results,null,2));}
}
