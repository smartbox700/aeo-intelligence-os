import {z} from 'zod';
import type {ProjectData} from './types';
export const classificationInput=z.enum(['PUBLIC_RESEARCH','CLIENT_CONFIDENTIAL','INTERNAL']);
export function verifyObservation(p:ProjectData,input:unknown,actorId:string){
 const v=z.object({responseId:z.string(),status:z.enum(['UNVERIFIED','VERIFIED','REJECTED']),reviewer:z.string().trim().min(2).max(100),note:z.string().trim().min(5).max(2000),sourceConfirmed:z.boolean().default(false),classification:classificationInput.optional()}).parse(input);
 const r=p.responses.find(r=>r.id===v.responseId);if(!r)throw new Error('이 프로젝트의 관측만 검증할 수 있습니다.');
 if(v.status==='VERIFIED'){
  if(r.consumer&&v.reviewer.normalize('NFKC').replace(/\s/g,'').toLowerCase()===r.consumer.observer.normalize('NFKC').replace(/\s/g,'').toLowerCase())throw new Error('관측자와 별도의 검증자를 기록하세요.');
  if(r.kind!=='DEMO'&&!v.sourceConfirmed)throw new Error('실제 관측의 출처·조건·원문을 대조했는지 확인하세요.');
  if(!r.rawText.trim()||!p.questions.some(q=>q.id===r.questionId))throw new Error('원문·질문 소속 확인 필요');
 }
 const at=new Date().toISOString();r.verification={status:v.status,reviewer:v.reviewer,note:v.note,at,sourceConfirmed:v.sourceConfirmed,actorId,history:[...(r.verification?.history??[]),{status:v.status,reviewer:v.reviewer,note:v.note,at,sourceConfirmed:v.sourceConfirmed,actorId}]};
 if(v.classification){(r.classificationHistory??=[]).push({at,actorId,from:r.classification??'CLIENT_CONFIDENTIAL',to:v.classification,note:v.note});r.classification=v.classification;}
 return r;
}
