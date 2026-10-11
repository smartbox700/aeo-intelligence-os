import {existsSync} from 'node:fs';
import {cp,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {backup,restoreTest} from './db-admin.mjs';
import {loadEnvironment,connection,localConnection,dataDirectory,nativeBin,executable,run,connect,inventory,protectDirectory,isInside,stateRoot} from './db-runtime.mjs';
await loadEnvironment();
if(!process.argv.includes('--approved'))throw new Error('기존 DB 중지/이전은 사용자의 사전 승인 후 --approved로 실행하세요.');
const c=connection();localConnection(c);if(process.env.AEO_DB_ENV==='production')throw new Error('운영 DB 이전은 지원하지 않습니다.');
const current=await connect(c);let source,before;
try{source=(await current.query('SHOW data_directory')).rows[0].data_directory;before=await inventory(current);}finally{await current.end();}
const target=dataDirectory();if(!isInside(tmpdir(),source)||!isInside(stateRoot(),target)||isInside(source,target))throw new Error('임시 개발 DB에서 전용 영속 폴더로의 이전만 허용합니다.');
if(existsSync(target)&&(await readdir(target)).length)throw new Error('대상 폴더에 기존 파일이 있습니다. 덮어쓰지 않습니다.');
const saved=await backup();if(saved.manifest.dataHash!==before.dataHash)throw new Error('백업 중 데이터가 변경되었습니다. 앱을 중지하고 다시 실행하세요.');
const restored=await restoreTest(saved.file);if(!restored.ok||!restored.idsAndRelationsMatch)throw new Error('최신 백업 복원 검증 실패. 이전하지 않습니다.');
const check=await connect(c);try{if((await inventory(check)).dataHash!==before.dataHash)throw new Error('복원 검증 중 원본 데이터가 변경되었습니다. 이전하지 않습니다.');}finally{await check.end();}
const bin=await nativeBin(),ctl=executable(bin,'pg_ctl');
await run(ctl,['-D',source,'-m','fast','-w','stop']);
let started=false;
try{
 await protectDirectory(target);await cp(source,target,{recursive:true,force:false,errorOnExist:true});
 await run(ctl,['-D',target,'-l',path.join(target,'server.log'),'-o','-h 127.0.0.1 -p '+c.port+' -c shared_buffers=16MB -c max_connections=20','-w','start']);started=true;
 const db=await connect(c);let after;try{after=await inventory(db);}finally{await db.end();}
 if(after.dataHash!==before.dataHash||after.schemaHash!==before.schemaHash)throw new Error('이전 후 데이터/스키마 불일치');
 const idsAndRelationsMatch=JSON.stringify(after.tables)===JSON.stringify(before.tables);if(!idsAndRelationsMatch)throw new Error('이전 후 ID/관계 불일치');
 const result={ok:true,at:new Date().toISOString(),source,target,backup:saved.file,restoreDatabase:restored.database,restoreVerified:true,dataMatches:true,schemaMatches:true,idsAndRelationsMatch,sourcePreserved:true};
 await writeFile(path.join(stateRoot(),'migration-result.json'),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result,null,2));
}catch(e){
 if(started)await run(ctl,['-D',target,'-m','fast','-w','stop']).catch(()=>{});
 await run(ctl,['-D',source,'-l',path.join(source,'server.log'),'-o','-h 127.0.0.1 -p '+c.port+' -c shared_buffers=16MB -c max_connections=20','-w','start']).catch(()=>{});
 throw new Error('이전 실패. 원본 DB 재시작을 시도했습니다. 두 폴더와 백업을 보존하고 db:health로 확인하세요.');
}
