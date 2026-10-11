import type {ResponseRecord,ProjectData,ExtractedEntity} from './types';

export function exclusionReason(r:ResponseRecord):string|null{
 if(r.kind==='CONSUMER_UI_MANUAL'||r.consumer){if(r.kind!=='DEMO'&&!r.consumer?.consumerScreenConfirmed)return '소비자 화면 관측 미확인';if(r.consumer?.searchUsage!=='USED')return '검색 미사용·미확인';if(r.verification?.status==='REJECTED')return '관측 검증에서 제외';if(r.entityAnalysis?.status!=='READY')return '업체 식별 검토 필요';}
 if(r.kind==='MANUAL_OBSERVATION'&&r.entityAnalysis?.status!=='READY')return '업체 식별 검토 필요';
 if(r.kind==='API_OBSERVATION'){
  if(!r.measurement||r.measurement.status!=='SUCCEEDED')return 'API 오류·미완결';
  if(!r.measurement.searchUsed)return '검색 미실행';
  if(!r.entityAnalysis||r.entityAnalysis.status!=='READY')return '업체 식별 검토 필요';
 }
 return null;
}
export function isEligible(r:ResponseRecord){return !exclusionReason(r);}
const accepted=(r:ResponseRecord)=>r.entityAnalysis?.entities.filter(e=>e.review==='ACCEPTED')??[];
function clientMention(r:ResponseRecord){return r.entityAnalysis?accepted(r).some(e=>e.role==='client'):r.mentions.some(m=>m.role==='client'&&!m.ambiguous);}
function clientRecommendation(r:ResponseRecord){return !!r.entityAnalysis&&accepted(r).some(e=>e.role==='client'&&e.context==='RECOMMENDATION');}
function citationMatch(r:ResponseRecord,website:string){try{const host=new URL(website).hostname.replace(/^www\./,'');return r.citations.some(u=>{try{return new URL(u).hostname.replace(/^www\./,'')===host;}catch{return false;}});}catch{return false;}}
const rate=(n:number,d:number)=>d?n/d:null;
export function visibilityMetrics(rows:ResponseRecord[],p:ProjectData){
 const eligible=rows.filter(isEligible);const reviewed=eligible.filter(r=>r.entityAnalysis?.status==='READY');
 const clientCount=eligible.filter(clientMention).length;const recommendations=reviewed.filter(clientRecommendation).length;const citations=eligible.filter(r=>citationMatch(r,p.client.website)).length;
 const positions=reviewed.flatMap(r=>accepted(r).filter(e=>e.role==='client'&&e.context==='RECOMMENDATION'&&e.introductionOrder!==null).map(e=>({responseId:r.id,questionId:r.questionId,order:e.introductionOrder!})));
 const competitors=p.client.competitors.map(c=>{const count=eligible.filter(r=>r.entityAnalysis?accepted(r).some(e=>e.matchedEntityId===c.id):r.mentions.some(m=>m.entityId===c.id&&!m.ambiguous)).length;return {id:c.id,name:c.name,count,n:eligible.length,rate:rate(count,eligible.length)};});
 const questions=p.questions.map(q=>{const all=rows.filter(r=>r.questionId===q.id);const e=all.filter(isEligible);const mention=e.filter(clientMention).length;return {id:q.id,text:q.text,total:all.length,n:e.length,mentions:mention,rate:rate(mention,e.length)};});
 const days=[...new Set(rows.map(r=>new Date(r.observedAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})))].sort().map(day=>{const all=rows.filter(r=>new Date(r.observedAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})===day);const e=all.filter(isEligible);const count=e.filter(clientMention).length;return {day,total:all.length,n:e.length,mentions:count,rate:rate(count,e.length)};});
 return {total:rows.length,n:eligible.length,excluded:rows.length-eligible.length,clientCount,mentionRate:rate(clientCount,eligible.length),recommendations,recommendationN:reviewed.length,recommendationRate:rate(recommendations,reviewed.length),citations,citationRate:rate(citations,eligible.length),positions,competitors,questions,days};
}
export function candidateCount(entities:ExtractedEntity[]){return entities.filter(e=>e.review!=='REJECTED'&&e.context==='RECOMMENDATION').length;}


