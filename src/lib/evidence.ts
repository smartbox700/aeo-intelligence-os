import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import type {EvidenceFile} from './types';
import {dataRoot} from './file-storage';
export const evidenceDir=path.join(dataRoot(),'evidence');
export function imageType(bytes:Buffer){if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',extension:'png'};if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',extension:'jpg'};if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return {mime:'image/webp',extension:'webp'};throw new Error('PNG/JPEG/WebP 스크린샷만 지원합니다. SVG·문서·실행 파일은 제외합니다.');}
export async function writeEvidence(bytes:Buffer,filename:string){if(bytes.length<12||bytes.length>3000000)throw new Error('증빙 파일은 3MB 이하 이미지입니다.');const type=imageType(bytes);const id=randomUUID();const e:EvidenceFile={id,filename:path.basename(filename).slice(0,100),storageName:id+'.'+type.extension,mime:type.mime,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),at:new Date().toISOString(),imageExtraction:'NOT_PERFORMED'};await mkdir(evidenceDir,{recursive:true});await writeFile(path.join(evidenceDir,e.storageName),bytes,{flag:'wx'});return e;}
function storedPath(e:EvidenceFile){if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(e.storageName))throw new Error('증빙 경로 오류');return path.join(evidenceDir,e.storageName);}
export async function readEvidence(e:EvidenceFile){const bytes=await readFile(storedPath(e));if(createHash('sha256').update(bytes).digest('hex')!==e.sha256)throw new Error('증빙 해시 불일치');return bytes;}
export const removeUnattachedEvidence=(e:EvidenceFile)=>unlink(storedPath(e));
