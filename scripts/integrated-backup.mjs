import {readFile,writeFile,lstat,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {loadEnvironment,connection,localConnection,stateRoot,isInside,protectDirectory,connect,inventory,logicalArchive,restoreArchive,digest} from './db-runtime.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const quote=s=>'"'+s.replaceAll('"','""')+'"';
export function safeFile(name){if(!/^(pilot-documents|evidence)\/[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/.test(name)&&name!=='sales-brand.json')throw new Error('Invalid attachment path');return name;}
export function references(archive){
 const refs=[];
 for(const t of archive.tables){
  if(t.name==='Project')for(const r of t.rows)for(const d of r.operations?.pilot?.documents??[]){if(d.projectId!==r.id)throw new Error('Document project ownership mismatch');refs.push({projectId:r.id,table:t.name,id:d.id,kind:d.kind,path:safeFile('pilot-documents/'+d.storageName),sha256:d.sha256,bytes:d.bytes});}
  if(t.name==='ClientEntity')for(const r of t.rows)for(const d of r.payload?.evidenceFiles??[])refs.push({projectId:r.projectId,table:t.name,id:d.id,kind:'OBSERVATION',path:safeFile('evidence/'+d.storageName),sha256:d.sha256,bytes:d.bytes});
 }
 for(const r of refs)if(refs.some(other=>other.path===r.path&&other.projectId!==r.projectId))throw new Error('Cross-project attachment reference');
 return refs.sort((a,b)=>a.path.localeCompare(b.path)||a.projectId.localeCompare(b.projectId));
}
async function bytesAt(root,name){safeFile(name);const dir=path.dirname(path.join(root,name));for(const p of [root,dir,path.join(root,name)])if((await lstat(p)).isSymbolicLink())throw new Error('Symlink storage is not supported');return readFile(path.join(root,name));}
async function collect(root,refs){
 const files=[];
 for(const name of [...new Set(refs.map(r=>r.path))]){const b=await bytesAt(root,name);if(refs.filter(r=>r.path===name).some(r=>r.sha256!==hash(b)||r.bytes!==b.length))throw new Error('Referenced attachment integrity failure');files.push({path:name,sha256:hash(b),bytes:b.length,base64:b.toString('base64')});}
 try{const b=await bytesAt(root,'sales-brand.json');JSON.parse(b.toString());files.push({path:'sales-brand.json',sha256:hash(b),bytes:b.length,base64:b.toString('base64')});}catch(e){if(e.code!=='ENOENT')throw e;}
 return files;
}
export function seal(payload,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('aeo-integrated-v1'));const body=Buffer.concat([cipher.update(gzipSync(JSON.stringify(payload))),cipher.final()]);return Buffer.from(JSON.stringify({format:'aeo-integrated-v1',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),body:body.toString('base64')}));}
export function unseal(bytes,key){const e=JSON.parse(bytes.toString());if(e.format!=='aeo-integrated-v1')throw new Error('Unsupported backup');const d=createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'));d.setAAD(Buffer.from(e.format));d.setAuthTag(Buffer.from(e.tag,'base64'));return JSON.parse(gunzipSync(Buffer.concat([d.update(Buffer.from(e.body,'base64')),d.final()])).toString());}
export async function backupIntegrated(){
 await loadEnvironment();const c=connection();localConnection(c);
 const root=path.resolve(process.env.AEO_FILES_ROOT||'data'),dest=path.resolve(process.env.AEO_BACKUP_DIR||path.join(stateRoot(),'backups'));
 if(isInside(process.cwd(),dest)||isInside(root,dest)||isInside(dest,root))throw new Error('Backup must be outside repository and storage');
 await protectDirectory(dest);
 const keyFile=path.resolve(process.env.AEO_BACKUP_KEY_FILE||path.join(stateRoot(),'backup-keys','integrated.key'));
 if(isInside(process.cwd(),keyFile)||isInside(dest,keyFile)||isInside(root,keyFile))throw new Error('Key must be separate from repository, files and backups');
 await protectDirectory(path.dirname(keyFile));let key;
 try{key=await readFile(keyFile);}catch(e){if(e.code!=='ENOENT')throw e;key=randomBytes(32);await writeFile(keyFile,key,{flag:'wx',mode:0o600});}if(key.length!==32)throw new Error('Backup key must be 32 bytes');
 const db=await connect(c);let locked=false;
 try{
  // Acquire the writer lock before opening the MVCC snapshot.
  await db.query('SELECT pg_advisory_lock(742910)');locked=true;
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const startedAt=new Date().toISOString(),inv=await inventory(db),archive=await logicalArchive(db),refs=references(archive),files=await collect(root,refs);
  const recheck=await collect(root,refs);if(digest(files)!==digest(recheck))throw new Error('Files changed during backup');
  const orphans={};for(const dir of ['evidence','pilot-documents'])orphans[dir]=(await readdir(path.join(root,dir)).catch(e=>{if(e.code==='ENOENT')return [];throw e;})).filter(n=>!refs.some(r=>r.path===dir+'/'+n)).length;
  const payload={version:'aeo-integrated-v1',startedAt,completedAt:new Date().toISOString(),database:c.database,inventory:inv,archive,references:refs,files,brandPresent:files.some(f=>f.path==='sales-brand.json'),orphanCounts:orphans};
  const file=path.join(dest,'integrated-'+startedAt.replace(/[:.]/g,'-')+'-'+randomUUID()+'.aeo.enc');
  await writeFile(file,seal(payload,key),{flag:'wx',mode:0o600});await db.query('COMMIT');
  const result={ok:true,file,keyFile,encrypted:true,startedAt,completedAt:payload.completedAt,dataHash:inv.dataHash,schemaHash:inv.schemaHash,files:files.length,references:refs.length,brandPresent:payload.brandPresent,orphanCounts:orphans};
  await writeFile(file+'.result.json',JSON.stringify(result,null,2),{flag:'wx',mode:0o600});return result;
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{if(locked)await db.query('SELECT pg_advisory_unlock(742910)').catch(()=>{});await db.end();}
}
export async function restoreIntegrated(file,keyFile){
 await loadEnvironment();const c=connection();localConnection(c);
 const name='aeo_restore_test_'+randomUUID().replaceAll('-',''),root=path.join(stateRoot(),'restore-tests',name,'files'),source=path.resolve(process.env.AEO_FILES_ROOT||'data');
 if(isInside(source,root)||isInside(root,source)||isInside(process.cwd(),root))throw new Error('Restore storage must be isolated');
 const result={at:new Date().toISOString(),database:name,filesRoot:root,ok:false,sourceUntouched:true};
 const admin=await connect({...c,database:'postgres'});
 try{
  const payload=unseal(await readFile(file),await readFile(keyFile));
  if(payload.version!=='aeo-integrated-v1'||digest(references(payload.archive))!==digest(payload.references))throw new Error('Reference manifest mismatch');
  const seen=new Set();for(const f of payload.files){safeFile(f.path);if(seen.has(f.path))throw new Error('Duplicate file');seen.add(f.path);const b=Buffer.from(f.base64,'base64');if(hash(b)!==f.sha256||b.length!==f.bytes)throw new Error('File manifest mismatch');}
  for(const r of payload.references)if(!payload.files.some(f=>f.path===r.path&&f.sha256===r.sha256&&f.bytes===r.bytes))throw new Error('Missing reference');
  if(payload.brandPresent!==seen.has('sales-brand.json'))throw new Error('Brand manifest mismatch');
  await protectDirectory(path.dirname(root));await mkdir(root,{recursive:false,mode:0o700});
  await admin.query('CREATE DATABASE '+quote(name)+' TEMPLATE template0');
  const db=await connect({...c,database:name});let actual;try{await restoreArchive(db,payload.archive);actual=await inventory(db);}finally{await db.end();}
  for(const f of payload.files){await mkdir(path.dirname(path.join(root,f.path)),{recursive:true,mode:0o700});await writeFile(path.join(root,f.path),Buffer.from(f.base64,'base64'),{flag:'wx',mode:0o600});}
  const files=await collect(root,payload.references);
  Object.assign(result,{dataMatches:actual.dataHash===payload.inventory.dataHash,schemaMatches:actual.schemaHash===payload.inventory.schemaHash,idsAndRelationsMatch:digest(actual.tables)===digest(payload.inventory.tables),filesMatch:digest(files)===digest(payload.files),referenceCount:payload.references.length,fileCount:files.length,brandPresent:payload.brandPresent});
  result.ok=result.dataMatches&&result.schemaMatches&&result.idsAndRelationsMatch&&result.filesMatch;
  if(!result.ok)throw new Error('Restore mismatch');return result;
 }catch(e){result.failure=e.message;throw e;}finally{await admin.end();await protectDirectory(path.dirname(root));await writeFile(path.join(path.dirname(root),'restore-result.json'),JSON.stringify(result,null,2),{mode:0o600});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv[2]==='restore-test'&&process.argv[3]){await loadEnvironment();const key=process.argv[4]||process.env.AEO_BACKUP_KEY_FILE||path.join(stateRoot(),'backup-keys','integrated.key');console.log(JSON.stringify(await restoreIntegrated(path.resolve(process.argv[3]),path.resolve(key)),null,2));}
  else{const b=await backupIntegrated();console.log(JSON.stringify(b,null,2));if(['verify','restore-test'].includes(process.argv[2]))console.log(JSON.stringify(await restoreIntegrated(b.file,b.keyFile),null,2));}
 }catch{console.error('Integrated backup/restore failed. Source preserved; inspect protected restore result.');process.exitCode=1;}
}
