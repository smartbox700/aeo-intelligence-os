import {writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {loadEnvironment,connection,localConnection,stateRoot,protectDirectory,nativeBin,executable,run,connect,inventory,logicalArchive,restoreArchive,safeCounts} from './db-runtime.mjs';
await loadEnvironment();const source=connection();localConnection(source);
const origin=await connect(source);let archive;try{await origin.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');archive=await logicalArchive(origin);await origin.query('COMMIT');}finally{await origin.end();}
const port=await new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const n=server.address().port;server.close(()=>resolve(n));});});
const dir=path.join(stateRoot(),'postgres','restart-test-'+randomUUID()),bin=await nativeBin(),ctl=executable(bin,'pg_ctl');await protectDirectory(dir);
await protectDirectory(stateRoot());const passwordFile=path.join(stateRoot(),'init-password-'+randomUUID()+'.txt');try{await writeFile(passwordFile,source.password+'\n',{mode:0o600});await run(executable(bin,'initdb'),['-D',dir,'-U',source.user,'--auth=password','--pwfile='+passwordFile,'--encoding=UTF8','--locale=C']);}finally{await unlink(passwordFile).catch(()=>{});}
const c={...source,port,database:'postgres'},start=()=>run(ctl,['-D',dir,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p '+port+' -c shared_buffers=16MB -c max_connections=20','-w','start']),stop=()=>run(ctl,['-D',dir,'-m','fast','-w','stop']);
let running=false;
try{
 await start();running=true;let db=await connect(c);let before;
 try{await restoreArchive(db,archive);const project=(await db.query('SELECT id FROM "Project" ORDER BY id LIMIT 1')).rows[0];if(project)await db.query('INSERT INTO "Report" (id,"projectId",kind,"rowCount",payload) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),project.id,'DEMO',0,JSON.stringify({testOnly:true,html:'LOCAL MOCK · 재시작 검증용 보고서',verification:'NOT_REAL_PERFORMANCE'})]);before=await inventory(db);}finally{await db.end();}
 await stop();running=false;await start();running=true;db=await connect(c);let after;try{after=await inventory(db);}finally{await db.end();}
 const ok=before.dataHash===after.dataHash&&before.schemaHash===after.schemaHash;
 const result={at:new Date().toISOString(),ok,isolated:true,directory:dir,port,counts:safeCounts(after),dataMatches:before.dataHash===after.dataHash,schemaMatches:before.schemaHash===after.schemaHash,sourceUntouched:true};
 await writeFile(path.join(stateRoot(),'restart-test-result.json'),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result,null,2));if(!ok)process.exitCode=1;
}finally{if(running)await stop();}
