import {existsSync} from 'node:fs';
import {writeFile,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {loadEnvironment,connection,localConnection,dataDirectory,protectDirectory,stateRoot,nativeBin,executable,run,connect} from './db-runtime.mjs';
await loadEnvironment();
if(process.env.AEO_DB_ENV==='production')throw new Error('운영 DB는 이 개발용 실행기로 시작하지 않습니다.');
const c=connection();localConnection(c);const dir=dataDirectory(),bin=await nativeBin();
const legacy=path.join(tmpdir(),'aeo-intelligence-os-postgres');
if(!process.env.AEO_PG_DIR&&!existsSync(path.join(dir,'PG_VERSION'))&&existsSync(path.join(legacy,'PG_VERSION')))throw new Error('기존 임시 DB가 있습니다. 백업·복원 검증과 승인된 이전을 먼저 수행하세요. 새 DB로 대체하지 않습니다.');
if(!existsSync(path.join(dir,'PG_VERSION'))){
 if(existsSync(dir)&&(await readdir(dir)).length)throw new Error('데이터 폴더가 비어 있지 않습니다. 초기화하지 않습니다.');
 await protectDirectory(dir);await protectDirectory(stateRoot());const passwordFile=path.join(stateRoot(),'init-password-'+process.pid+'.txt');
 try{await writeFile(passwordFile,c.password+'\n',{mode:0o600});await run(executable(bin,'initdb'),['-D',dir,'-U',c.user,'--auth=password','--pwfile='+passwordFile,'--encoding=UTF8','--locale=C']);}finally{await unlink(passwordFile).catch(()=>{});}
}
await protectDirectory(dir);
const ctl=executable(bin,'pg_ctl');
await run(ctl,['-D',dir,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p '+c.port+' -c shared_buffers=16MB -c max_connections=20','-w','start']);
const admin=await connect({...c,database:'postgres'});
try{if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[c.database])).rowCount)await admin.query('CREATE DATABASE "'+c.database.replaceAll('"','""')+'"');}finally{await admin.end();}
console.log('개발용 PostgreSQL: '+c.host+':'+c.port+' / '+c.database+' · 영속 데이터: '+dir+' · 종료: Ctrl+C');
let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;try{await run(ctl,['-D',dir,'-m','fast','-w','stop']);process.exit(0);}catch{console.error('정상 종료 실패. 데이터 폴더를 삭제하지 말고 db:health로 확인하세요.');process.exitCode=1;}}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);setInterval(()=>{},60000);