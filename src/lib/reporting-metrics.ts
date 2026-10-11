import type {DataKind,ProjectData,ResponseRecord} from './types';
import {exclusionReason,visibilityMetrics} from './visibility';
export const CALCULATION_VERSION='verified-observation-v1';
export type MetricScope={kind:DataKind;questionIds?:string[];providers?:string[];from?:string;to?:string};
export function confirmedExclusion(p:ProjectData,r:ResponseRecord):string|null{
 if(r.kind==='DEMO')return 'DEMO는 확정 성과에서 제외';
 if(r.classification==='INTERNAL')return '내부 연구 전용 자료';
 if(!['CONSUMER_UI_MANUAL','MANUAL_OBSERVATION','MANUAL_UI','API_OBSERVATION'].includes(r.kind))return '기존 API 관측의 출처 정보 부족';
 if(!p.questions.some(q=>q.id===r.questionId)||r.consumer&&r.consumer.projectId!==p.id)return '프로젝트·질문 소속 불일치';
 if(!r.rawText.trim()||!r.provider.trim()||!r.model.trim()||!r.region.trim()||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>Date.now()+300000)return '원문·플랫폼·모델·지역·관측 시각 부족';
 if(!(r.consumer?.actualQuestion||r.measurement?.questionText||r.questionText)?.trim())return '실제 질문 원문 부족';
 if(r.accuracy==='INACCURATE')return '부정확 판정 자료';
 const v=r.verification;if(v?.status!=='VERIFIED')return v?.status==='REJECTED'?'검증 거부':'미검증 자료';
 if(!v.reviewer.trim()||v.note.trim().length<5||!v.at||!Number.isFinite(Date.parse(v.at))||Date.parse(v.at)>Date.now()+300000||v.sourceConfirmed!==true)return '검증자·시각·출처 대조 정보 부족';
 if(r.entityAnalysis?.status!=='READY')return '업체 식별 검토 필요';
 return exclusionReason(r);
}
export function observationIdentity(r:ResponseRecord){return JSON.stringify([r.kind,r.provider,r.model,r.questionId,r.consumer?.actualQuestion||r.measurement?.questionText||r.questionText,r.region,r.observedAt,r.consumer?.country,r.consumer?.searchUsage,r.rawText,r.citations.slice().sort()]);}
export function confirmedMetrics(p:ProjectData,scope:MetricScope){
 const selectedIds=scope.questionIds??[...new Set(p.responses.filter(r=>p.questions.some(q=>q.id===r.questionId)&&r.kind===scope.kind&&(!scope.from||r.observedAt>=scope.from)&&(!scope.to||r.observedAt<=scope.to)&&(!scope.providers?.length||scope.providers.includes(r.provider))).map(r=>r.questionId))];
 if(new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!p.questions.some(q=>q.id===id)))throw new Error('보고서 질문 세트 소속·중복 오류');
 const selected=p.questions.filter(q=>selectedIds.includes(q.id));
 const rows=p.responses.filter(r=>r.kind===scope.kind&&selectedIds.includes(r.questionId)&&(!scope.providers?.length||scope.providers.includes(r.provider))&&(!scope.from||r.observedAt>=scope.from)&&(!scope.to||r.observedAt<=scope.to));
 const identities=new Set<string>(),excluded:{id:string;reason:string}[]=[],eligible:ResponseRecord[]=[];
 for(const r of rows){let reason=confirmedExclusion(p,r);const identity=observationIdentity(r);if(!reason&&identities.has(identity))reason='동일 관측 결과 중복';if(reason)excluded.push({id:r.id,reason});else{identities.add(identity);eligible.push(r);}}
 const m=visibilityMetrics(eligible,{...p,questions:selected});
 const firstRows=eligible.filter(r=>r.entityAnalysis?.entities.some(e=>e.review==='ACCEPTED'&&e.context==='RECOMMENDATION'&&e.introductionOrder!==null));
 const first=firstRows.filter(r=>r.entityAnalysis?.entities.some(e=>e.review==='ACCEPTED'&&e.role==='client'&&e.context==='RECOMMENDATION'&&e.introductionOrder===1)).length;
 const measured=[...new Set(eligible.map(r=>r.questionId))],covered=selected.filter(q=>m.questions.some(x=>x.id===q.id&&x.mentions>0)).length;
 const definitions=[
  {key:'Brand Mention Rate',definition:'확정 고객 언급이 있는 응답 / 검증된 유효 응답',numerator:m.clientCount,denominator:m.n,rate:m.mentionRate},
  {key:'Recommendation Inclusion Rate',definition:'확정 고객 추천 후보 응답 / 검증된 문맥 분석 완료 응답',numerator:m.recommendations,denominator:m.recommendationN,rate:m.recommendationRate},
  {key:'Official Citation Rate',definition:'자사 공식 호스트 인용 응답 / 검증된 유효 응답',numerator:m.citations,denominator:m.n,rate:m.citationRate},
  {key:'First Mention Rate',definition:'명시적 번호 1번의 고객 추천 응답 / 명시적 추천 번호가 있는 검증 응답 (단순 문자 위치가 아님)',numerator:first,denominator:firstRows.length,rate:firstRows.length?first/firstRows.length:null},
  {key:'Query Coverage',definition:'검증된 고객 언급이 있는 서로 다른 질문 / 검증 관측이 있는 서로 다른 질문',numerator:covered,denominator:measured.length,rate:measured.length?covered/measured.length:null}
 ];
 const conditions=[...new Set(eligible.map(r=>JSON.stringify([r.provider,r.model,r.region,r.consumer?.country,r.consumer?.searchUsage])))];
 const warnings:string[]=[];
 if(conditions.length>1)warnings.push('플랫폼·모델·지역·검색 조건이 여러 개입니다. 전체값은 선택 표본의 요약이며 동일 조건 비교는 개별 조건별로 확인하세요.');
 if(eligible.some(r=>/미표시|모름|unknown/i.test(r.model)))warnings.push('모델 정보가 미표시입니다. 같은 모델의 비교라고 보장할 수 없습니다.');
 if(eligible.some(r=>(r.consumer?.actualQuestion||r.measurement?.questionText||r.questionText)!==p.questions.find(q=>q.id===r.questionId)?.text))warnings.push('실제 질문 원문과 등록 질문이 다릅니다. 관측 질문 스냅샷을 함께 확인하세요.');
 return {...m,total:rows.length,excluded:excluded.length,rows:eligible,excludedRows:excluded,definitions,questionIds:selected.map(q=>q.id),measuredQuestionIds:measured,registeredQuestionCount:p.questions.length,selectedQuestionCount:selected.length,measuredQuestionCount:measured.length,measurementCoverage:selected.length?measured.length/selected.length:null,context:{version:CALCULATION_VERSION,kind:scope.kind,verification:'VERIFIED',from:scope.from??null,to:scope.to??null,providers:[...new Set(eligible.map(r=>r.provider))],conditions},warnings,emptyMessage:m.n?'':'검증된 관측 데이터 없음'};
}
