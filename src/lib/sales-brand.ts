import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {cleanBrand} from './sales-report';
import {dataRoot} from './file-storage';
const file=()=>path.join(dataRoot(),'sales-brand.json');
export async function getSalesBrand(){try{return cleanBrand(JSON.parse(await readFile(file(),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return cleanBrand({});throw e;}}
export async function saveSalesBrand(input:unknown){
 const save=async()=>{const brand=cleanBrand(input);await mkdir(path.dirname(file()),{recursive:true});await writeFile(file()+'.tmp',JSON.stringify(brand),{mode:0o600});await rename(file()+'.tmp',file());return brand;};
 if(process.env.STORAGE_MODE!=='postgres')return save();
 const {prisma}=await import('./db');
 return prisma.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(742910)`;return save();},{timeout:60000});
}
