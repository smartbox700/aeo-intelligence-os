import type {Entity, Mention, ResponseRecord} from './types';
import {isEligible,exclusionReason} from './visibility';
export const ANALYSIS_VERSION='literal-boundary-v1';
const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('ko');
export function analyzeMentions(raw:string,client:Entity):Mention[]{
  const text=normalize(raw);
  const entities=[{...client,role:'client' as const},...client.competitors.map(e=>({...e,role:'competitor' as const}))];
  const found=entities.map(e=>{
    const matches=[e.name,...e.aliases].filter(Boolean).flatMap(alias=>{
      const needle=normalize(alias); const positions:number[]=[];
      let start=0;
      while(start<text.length){const at=text.indexOf(needle,start);if(at<0)break;
        const before=text[at-1]||''; const after=text[at+needle.length]||'';
        // Latin/digit tokens require both boundaries; Korean permits postpositions, not preceding word characters.
        if(!/[\p{L}\p{N}]/u.test(before)&&(!/^[a-z0-9]/i.test(needle)||!/[a-z0-9]/i.test(after)))positions.push(at);
        start=at+needle.length;
      }
      return positions;
    });
    return {entityId:e.id,name:e.name,role:e.role,position:matches.length?Math.min(...matches)+1:0,ambiguous:false};
  }).filter(e=>e.position>0);
  return found.map(m=>({...m,ambiguous:found.some(other=>other.entityId!==m.entityId&&other.position===m.position)})).sort((a,b)=>a.position-b.position);
}
export function metrics(responses:ResponseRecord[],kind:string){
  const rows=responses.filter(r=>r.kind===kind&&isEligible(r)); const n=rows.length;
  const mentions=rows.filter(r=>r.mentions.some(m=>m.role==='client'&&!m.ambiguous)).length;
  const clientMentions=rows.flatMap(r=>r.mentions).filter(m=>m.role==='client'&&!m.ambiguous).length;
  const allMentions=rows.flatMap(r=>r.mentions).filter(m=>!m.ambiguous&&m.role!=='discovered').length;
  const reviewed=rows.filter(r=>r.accuracy!=='UNREVIEWED');
  return {n,mentions,mentionRate:n?mentions/n:null,clientMentions,allMentions,share:allMentions?clientMentions/allMentions:null,reviewed:reviewed.length,accuracy:reviewed.length?reviewed.filter(r=>r.accuracy==='ACCURATE').length/reviewed.length:null};
}
export function citationRate(rows:ResponseRecord[],website:string){
  rows=rows.filter(isEligible);
  if(!website)return {count:0,n:rows.length,rate:null};
  const host=new URL(website).hostname.replace(/^www\./,'');
  const count=rows.filter(r=>r.citations.some(u=>new URL(u).hostname.replace(/^www\./,'')===host)).length;
  return {count,n:rows.length,rate:rows.length?count/rows.length:null};
}
export function csvCell(v:unknown){let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function exportCsv(project:import('./types').ProjectData,kind:string){
 const header=['데이터 유형','측정 시간','플랫폼','모델/서비스','지역','질문','고객 언급','경쟁사 언급','출처 URL','응답 원문','분석 버전','비용 USD','정확도 검토','측정 묶음 ID','API 상태','검색 실행','집계 제외 사유','추천 후보','명시적 소개 번호','출처 제목','입력 토큰','출력 토큰','요청 ID','오류','담당자 관찰 추천','예약 확인 상태','예약 확인 근거','예약 확인 시각'];
 const rows=project.responses.filter(r=>r.kind===kind).map(r=>[r.kind,r.observedAt,r.provider,r.model,r.region,r.measurement?.questionText??project.questions.find(q=>q.id===r.questionId)?.text,r.mentions.some(m=>m.role==='client'&&!m.ambiguous)?1:0,r.mentions.filter(m=>m.role==='competitor'&&!m.ambiguous).map(m=>m.name).join(' | '),r.citations.join(' | '),r.rawText,r.analysisVersion,r.cost,r.accuracy,r.measurement?.batchId,r.measurement?.status,r.measurement?.searchUsed,exclusionReason(r),r.entityAnalysis?.entities.filter(e=>e.context==='RECOMMENDATION'&&e.review==='ACCEPTED').map(e=>e.name).join(' | '),r.entityAnalysis?.entities.filter(e=>e.introductionOrder!==null&&e.review==='ACCEPTED').map(e=>e.name+': '+e.introductionOrder).join(' | '),r.measurement?.citedSources.map(s=>s.title).join(' | '),r.measurement?.usage?.inputTokens,r.measurement?.usage?.outputTokens,r.measurement?.requestId,r.measurement?.errorMessage,r.manualObservation?.recommendedNames.join(" | "),r.manualObservation?.bookingStatus,r.manualObservation?.bookingEvidence,r.manualObservation?.bookingCheckedAt]);
 return '\uFEFF'+[header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}

