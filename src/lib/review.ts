import {z} from 'zod';
import {mentionsFromAnalysis} from './entity-analysis';
import type {ProjectData,ResponseRecord} from './types';
export const reviewInput=z.object({entityId:z.string(),matchedEntityId:z.string().nullable(),review:z.enum(['ACCEPTED','REJECTED']),context:z.enum(['RECOMMENDATION','BACKGROUND','NEGATED']),reason:z.string().trim().min(5).max(1000)});
export function reviewEntity(p:ProjectData,r:ResponseRecord,input:z.infer<typeof reviewInput>){
 const a=r.entityAnalysis;const e=a?.entities.find(e=>e.id===input.entityId);if(!a||!e)throw new Error('업체 추출 결과를 찾을 수 없습니다.');
 const registry=[{id:p.client.id,role:'client' as const,name:p.client.name},...p.client.competitors.map(c=>({...c,role:'competitor' as const}))];const matched=input.matchedEntityId?registry.find(x=>x.id===input.matchedEntityId):null;if(input.matchedEntityId&&!matched)throw new Error('이 프로젝트의 업체만 매핑할 수 있습니다.');
 const before=structuredClone(e);e.matchedEntityId=matched?.id??null;e.role=matched?.role??'discovered';e.review=input.review;e.context=input.context;
 if(input.context!=='RECOMMENDATION')e.introductionOrder=null;
 // Never invent an order: restore only an explicit original list number.
 else e.introductionOrder=Number(e.evidenceQuote.match(/^\s*(?:#{1,6}\s*)?(\d+)[.)]/)?.[1])||null;
 e.identityReason='담당자 수정: '+input.reason;e.confidence='MEDIUM';
 a.method='ADMIN_REVIEW';a.status=a.entities.some(e=>e.review==='PENDING')?'REVIEW_REQUIRED':'READY';a.generalGuidance=!a.entities.some(e=>e.review==='ACCEPTED'&&e.context==='RECOMMENDATION');
 a.reviewHistory.push({at:new Date().toISOString(),entityId:e.id,before,after:structuredClone(e),reason:input.reason});r.mentions=mentionsFromAnalysis(a);
}
