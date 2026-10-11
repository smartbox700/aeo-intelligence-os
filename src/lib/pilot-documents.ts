import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {imageType} from './evidence';
import type {PilotDocument} from './pilot-types';
import {dataRoot} from './file-storage';
const dir=path.join(dataRoot(),'pilot-documents');
export async function writePilotDocument(bytes:Buffer,filename:string){
 if(bytes.length<12||bytes.length>5000000)throw new Error('증빙은 5MB 이하 PDF/이미지입니다.');
 const type=bytes.subarray(0,5).toString()==='%PDF-'?{mime:'application/pdf',extension:'pdf'}:imageType(bytes);
 const id=randomUUID(),storageName=id+'.'+type.extension;
 await mkdir(dir,{recursive:true});await writeFile(path.join(dir,storageName),bytes,{flag:'wx'});
 return {id,storageName,filename:path.basename(filename).replace(/[\r\n]/g,'').slice(0,100),mime:type.mime,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
function stored(d:Pick<PilotDocument,'storageName'>){if(!/^[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/.test(d.storageName))throw new Error('문서 경로 오류');return path.join(dir,d.storageName);}
export async function readPilotDocument(d:PilotDocument){const bytes=await readFile(stored(d));if(createHash('sha256').update(bytes).digest('hex')!==d.sha256)throw new Error('문서 해시 불일치');return bytes;}
export const removePilotDocument=(d:Pick<PilotDocument,'storageName'>)=>unlink(stored(d));
