import {readFile,writeFile,chmod} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadEnvironment,connection,localConnection,stateRoot,dataDirectory,isInside,protectDirectory,connect,inventory,safeCounts,logicalArchive,restoreArchive} from './db-runtime.mjs';
await loadEnvironment();
const command=process.argv[2]||'health',c=connection();localConnection(c);
const backupRoot=path.resolve(process.env.AEO_BACKUP_DIR||path.join(stateRoot(),'backups'));
const q=name=>'"'+name.replaceAll('"','""')+'"';
export async function backup(){
 if(isInside(process.cwd(),backupRoot))throw new Error('백업 경로는 저장소 밖이어야 합니다. AEO_BACKUP_DIR을 설정하세요.');
 await protectDirectory(backupRoot);const db=await connect(c);let file;
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const inv=await inventory(db),archive=await logicalArchive(db),stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID();file=path.join(backupRoot,'aeo-'+stamp+'.aeo.gz');
  await writeFile(file,gzipSync(JSON.stringify(archive)),{mode:0o600});
  const checksum=createHash('sha256').update(await readFile(file)).digest('hex');const manifest={version:'aeo-backup-v1',at:new Date().toISOString(),database:c.database,dumpSha256:checksum,...inv};
  await writeFile(file+'.manifest.json',JSON.stringify(manifest,null,2),{mode:0o600});if(process.platform!=='win32')await chmod(file,0o600);
  await db.query('COMMIT');return {file,manifest,counts:safeCounts(inv)};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{await db.end();}
}
export async function restoreTest(file){
 const manifest=JSON.parse(await readFile(file+'.manifest.json','utf8'));
 if(manifest.version!=='aeo-backup-v1'||createHash('sha256').update(await readFile(file)).digest('hex')!==manifest.dumpSha256)throw new Error('백업 파일 검증 실패. 복원을 수행하지 않습니다.');
 const name='aeo_restore_test_'+randomUUID().replaceAll('-',''),admin=await connect({...c,database:'postgres'});let created=false;
 try{
  await admin.query('CREATE DATABASE '+q(name)+' TEMPLATE template0');created=true;
  const restored=await connect({...c,database:name});let actual;try{await restoreArchive(restored,JSON.parse(gunzipSync(await readFile(file)).toString('utf8')));actual=await inventory(restored);}finally{await restored.end();}
  const ok=actual.dataHash===manifest.dataHash&&actual.schemaHash===manifest.schemaHash;
  const result={at:new Date().toISOString(),database:name,ok,counts:safeCounts(actual),dataMatches:actual.dataHash===manifest.dataHash,schemaMatches:actual.schemaHash===manifest.schemaHash,idsAndRelationsMatch:JSON.stringify(actual.tables)===JSON.stringify(manifest.tables),sourceUntouched:true};
  await writeFile(file+'.restore-test.json',JSON.stringify(result,null,2),{mode:0o600});if(!ok)throw new Error('복원 일치 검증 실패. 격리 DB와 복원 결과를 보존합니다: '+name);
  return result;
 }finally{await admin.end();if(created)console.log('격리 복원 DB는 검토를 위해 보존됩니다. 기존 DB를 덮어쓰거나 삭제하지 않았습니다.');}
}
async function main(){
 if(command==='health'){
  const db=await connect(c);try{const inv=await inventory(db),dir=(await db.query('SHOW data_directory')).rows[0].data_directory;console.log(JSON.stringify({ok:true,host:c.host,port:c.port,database:c.database,dataDirectory:dir,configuredPersistentDirectory:dataDirectory(),temporary:/[\\/]temp[\\/]|[\\/]tmp[\\/]/i.test(dir),counts:safeCounts(inv),dataHash:inv.dataHash,schemaHash:inv.schemaHash},null,2));}finally{await db.end();}
 }else if(command==='backup'){const result=await backup();console.log(JSON.stringify({ok:true,file:result.file,counts:result.counts,dataHash:result.manifest.dataHash},null,2));}
 else if(command==='restore-test'){const file=process.argv[3]||(await backup()).file;console.log(JSON.stringify(await restoreTest(path.resolve(file)),null,2));}
 else throw new Error('health / backup / restore-test 명령만 지원합니다.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main().catch(()=>{console.error('DB 관리 작업 실패. 설정·접근권한·DB 상태를 확인하세요. 비밀정보는 출력하지 않습니다.');process.exitCode=1;});
