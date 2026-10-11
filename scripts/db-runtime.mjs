import {readFile,mkdir,cp,chmod} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

export async function loadEnvironment(){
 const text=await readFile('.env','utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
 for(const line of text.split(/\r?\n/)){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
}
export const require=createRequire(createRequire(import.meta.url).resolve('embedded-postgres'));
export function connection(){
 const raw=process.env.DATABASE_URL;if(!raw)throw new Error('DATABASE_URL 설정 필요');
 const u=new URL(raw);if(!['postgres:','postgresql:'].includes(u.protocol))throw new Error('PostgreSQL 연결 설정 필요');
 return {host:u.hostname,port:Number(u.port||5432),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:decodeURIComponent(u.pathname.slice(1))};
}
export function localConnection(c){if(!['127.0.0.1','localhost','::1'].includes(c.host))throw new Error('이 도구는 로컬 개발 DB만 지원합니다. 운영 DB에는 별도 승인/도구가 필요합니다.');if(!c.user||!c.password||!c.database)throw new Error('DB 사용자·비밀번호·이름 설정 필요');}
export function stateRoot(){return path.resolve(process.env.AEO_STATE_DIR||path.join(process.env.LOCALAPPDATA||path.join(homedir(),'.local','share'),'AEOIntelligenceOS'));}
export function dataDirectory(){return path.resolve(process.env.AEO_PG_DIR||path.join(stateRoot(),'postgres','development'));}
export function isInside(parent,child){const rel=path.relative(path.resolve(parent),path.resolve(child));return !rel||(!rel.startsWith('..')&&!path.isAbsolute(rel));}
export async function protectDirectory(dir){
 await mkdir(dir,{recursive:true,mode:0o700});
 if(process.platform==='win32'){
  const identity=(await run('whoami',[],{capture:true})).trim();
  await run('icacls',[dir,'/inheritance:r','/grant:r',identity+':(OI)(CI)F','SYSTEM:(OI)(CI)F']);
 }else await chmod(dir,0o700);
}
export async function nativeBin(){
 if(process.env.AEO_PG_BIN)return path.resolve(process.env.AEO_PG_BIN);
 if(process.platform!=='win32')throw new Error('AEO_PG_BIN에 PostgreSQL bin 경로를 설정하세요.');
 const native=await import(pathToFileURL(require.resolve('@embedded-postgres/windows-x64')).href);
 const nativeRoot=path.dirname(path.dirname(native.postgres));const cache=path.join(stateRoot(),'postgres-native-18.4');
 if(!existsSync(path.join(cache,'bin','postgres.exe'))){await protectDirectory(cache);await cp(nativeRoot,cache,{recursive:true});}
 return path.join(cache,'bin');
}
export function executable(bin,name){return path.join(bin,name+(process.platform==='win32'?'.exe':''));}
export function pgEnvironment(c){return {...process.env,PGHOST:c.host,PGPORT:String(c.port),PGUSER:c.user,PGPASSWORD:c.password,PGDATABASE:c.database};}
export async function run(exe,args,{env=process.env,capture=false}={}){
 return new Promise((resolve,reject)=>{const child=spawn(exe,args,{env,windowsHide:true,cwd:tmpdir()});let out='';child.stdout.on('data',v=>out+=v);child.stderr.on('data',()=>{});child.on('error',()=>reject(new Error('로컬 도구 실행 실패: '+path.basename(exe))));child.on('exit',code=>{child.stdout.destroy();child.stderr.destroy();code===0?resolve(capture?out:''):reject(new Error(path.basename(exe)+' 실패 (exit '+code+'). 연결 설정·권한·디스크 공간을 확인하세요. 비밀정보 보호를 위해 도구 stderr는 출력하지 않습니다.'));});});
}
export async function connect(c){const {Client}=require('pg');const client=new Client(c);await client.connect();return client;}
export function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
export function digest(value){return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
export async function inventory(client){
 const names=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
 const tables={};for(const name of names){const quoted='"'+name.replaceAll('"','""')+'"';const rows=(await client.query('SELECT row_to_json(t) AS row FROM public.'+quoted+' t ORDER BY row_to_json(t)::text')).rows.map(r=>r.row);tables[name]={count:rows.length,sha256:digest(rows),ids:rows.filter(r=>r.id!==undefined).map(r=>r.id).sort()};}
 const schema=(await client.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
 const constraints=(await client.query("SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid::regclass::text,conname")).rows;
 return {tables,schemaHash:digest({schema,constraints}),dataHash:digest(tables)};
}
export const safeCounts=inv=>Object.fromEntries(Object.entries(inv.tables).map(([name,v])=>[name,v.count]));
export async function logicalArchive(client){
 const unsupported=(await client.query("SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('S','v','m','p','f')")).rows[0].n;
 const customTypes=(await client.query("SELECT count(*)::int AS n FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype IN ('e','d')")).rows[0].n;
 const routines=(await client.query("SELECT count(*)::int AS n FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows[0].n;
 const triggers=(await client.query("SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal")).rows[0].n;
 if(unsupported||customTypes||routines||triggers)throw new Error('현재 논리 백업은 일반 테이블만 지원합니다. sequence/view/partition/custom type/routine/trigger가 있으면 pg_dump를 사용하세요.');
 const tables=[],names=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
 const quote=s=>'"'+s.replaceAll('"','""')+'"';
 for(const name of names){
  const columns=(await client.query("SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,pg_get_expr(d.adbin,d.adrelid) AS default_value,a.attidentity,a.attgenerated FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum",['public.'+quote(name)])).rows;
  if(columns.some(c=>c.attidentity||c.attgenerated))throw new Error('identity/generated 열은 pg_dump가 필요합니다.');
  const ddl='CREATE TABLE public.'+quote(name)+' ('+columns.map(c=>quote(c.name)+' '+c.type+(c.required?' NOT NULL':'')+(c.default_value?' DEFAULT '+c.default_value:'')).join(',')+')';
  const rows=(await client.query('SELECT row_to_json(t) AS row FROM public.'+quote(name)+' t ORDER BY row_to_json(t)::text')).rows.map(r=>r.row);
  tables.push({name,columns,ddl,rows});
 }
 const constraints=(await client.query("SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition,k.contype FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid WHERE k.connamespace='public'::regnamespace ORDER BY CASE WHEN k.contype='f' THEN 1 ELSE 0 END,c.relname,k.conname")).rows.map(r=>'ALTER TABLE public.'+quote(r.table_name)+' ADD CONSTRAINT '+quote(r.conname)+' '+r.definition);
 const indexes=(await client.query("SELECT i.indexdef FROM pg_indexes i WHERE i.schemaname='public' AND NOT EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conindid=('public.'||quote_ident(i.indexname))::regclass) ORDER BY i.indexname")).rows.map(r=>r.indexdef);
 return {format:'aeo-logical-v1',tables,constraints,indexes};
}
export async function restoreArchive(client,archive){
 if(archive.format!=='aeo-logical-v1')throw new Error('지원하지 않는 백업 형식');
 const quote=s=>'"'+s.replaceAll('"','""')+'"';await client.query('BEGIN');
 try{for(const table of archive.tables){await client.query(table.ddl);for(const row of table.rows){const values=table.columns.map(c=>c.type==='json'||c.type==='jsonb'?JSON.stringify(row[c.name]):row[c.name]);await client.query('INSERT INTO public.'+quote(table.name)+' ('+table.columns.map(c=>quote(c.name)).join(',')+') VALUES ('+values.map((_,i)=>'$'+(i+1)).join(',')+')',values);}}for(const ddl of [...archive.constraints,...archive.indexes])await client.query(ddl);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}
}
