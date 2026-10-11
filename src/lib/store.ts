import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import type {Store} from './types';
import {seed} from './seed';
const dir=path.join(process.cwd(),'data'); const file=path.join(dir,'workspace.json');
let queue:Promise<unknown>=Promise.resolve();
let dbReady:Promise<void>|undefined;
async function ensureDb(){const db=await import('./db');await (dbReady??=db.initializeDb().catch(e=>{dbReady=undefined;throw e;}));return db;}
async function read():Promise<Store>{
 if(process.env.STORAGE_MODE==='postgres'){const db=await ensureDb();return db.loadDb();}
 await mkdir(dir,{recursive:true});
 try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const s=seed();await writeFile(file,JSON.stringify(s,null,2),'utf8');return s;}
}
export function mutate<T>(fn:(s:Store)=>T|Promise<T>):Promise<T>{
 const result=queue.then(async()=>{
  if(process.env.STORAGE_MODE==='postgres'){
   const db=await ensureDb();
   return db.prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(742910)`;
    const s=await db.loadDb(tx);const before=s.projects.map(p=>p.id);const value=await fn(s);
    // Remove runs first because responses reference questions in the same project.
    const removed=before.filter(id=>!s.projects.some(p=>p.id===id));
    await tx.observationRun.deleteMany({where:{projectId:{in:removed}}});
    await tx.project.deleteMany({where:{id:{in:removed},organizationId:'local-org'}});
    for(const p of s.projects)await db.saveProject(tx,p);
    return value;
   },{timeout:60000});
  }
  const s=await read();const value=await fn(s);await writeFile(file+'.tmp',JSON.stringify(s,null,2),'utf8');await rename(file+'.tmp',file);return value;
 });queue=result.catch(()=>{});return result;
}
export function getStore():Promise<Store>{const result=queue.then(read);queue=result.catch(()=>{});return result;}
