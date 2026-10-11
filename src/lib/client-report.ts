import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import type {ProjectData} from './types';
import type {ClientReport} from './operations-types';
import type {Staff} from './auth';
import {REPORT_LABELS,INDUSTRIES} from './operations-config';
import {visibilityMetrics} from './visibility';
import {compareStudy} from './research-metrics';
import {trafficMetrics} from './operations-metrics';
import {confirmedMetrics,CALCULATION_VERSION} from './reporting-metrics';
export const escapeHtml=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const pct=(v:number|null)=>v===null?'검증된 관측 데이터 없음':(v*100).toFixed(1)+'%';
const list=(items:string[])=>items.length?'<ul>'+items.map(v=>'<li>'+escapeHtml(v)+'</li>').join('')+'</ul>':'<p>데이터 없음</p>';
export function redactReportSecrets(text:string){
 let result=text.replace(/sk-(?:proj-|ant-)?[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/[^\s<>"']+/g,'[REDACTED]');
 for(const [key,value] of Object.entries(process.env))if(/KEY|SECRET|PASSWORD|TOKEN|DATABASE_URL/.test(key)&&value&&value.length>=8){result=result.replaceAll(value,'[REDACTED]').replaceAll(escapeHtml(value),'[REDACTED]');}
 return result;
}
export function createClientReport(p:ProjectData,input:unknown,actor:Staff){
 const o=p.operations;if(!o)throw new Error('온보딩 필요');
 const v=z.object({type:z.enum(['INITIAL','STRATEGY','MONTHLY','BEFORE_AFTER']),kind:z.enum(['CONSUMER_UI_MANUAL','MANUAL_OBSERVATION','MANUAL_UI','API_OBSERVATION','API','DEMO']),from:z.iso.date(),to:z.iso.date(),purpose:z.string().trim().min(5).max(2000),questionIds:z.array(z.string()).min(1).max(1000).optional(),providers:z.array(z.string().trim().min(1)).min(1).max(20).optional()}).refine(v=>v.from<=v.to,'보고 기간 순서 오류').parse(input);
 if(o.kind==='DEMO'&&v.kind!=='DEMO')throw new Error('DEMO 고객은 DEMO 보고서로만 생성하세요.');
 if(o.kind==='CLIENT'&&v.kind==='DEMO')throw new Error('실제 고객 보고서에 DEMO 자료를 섞을 수 없습니다.');
 const from=new Date(v.from+'T00:00:00+09:00').toISOString(),to=new Date(v.to+'T23:59:59.999+09:00').toISOString();
 const scope={kind:v.kind,from,to,questionIds:v.questionIds,providers:v.providers},confirmed=confirmedMetrics(p,scope);
 const selected=p.questions.filter(q=>confirmed.questionIds.includes(q.id));
 const candidates=p.responses.filter(r=>r.kind===v.kind&&confirmed.questionIds.includes(r.questionId)&&r.observedAt>=from&&r.observedAt<=to&&(!v.providers?.length||v.providers.includes(r.provider)));
 // DEMO remains an explicitly labelled rehearsal. Real reports always use the strict gate.
 const rows=v.kind==='DEMO'?candidates:confirmed.rows,m=v.kind==='DEMO'?visibilityMetrics(rows,{...p,questions:selected}):confirmed;
 const version=(p.reports??[]).filter(r=>r.type===v.type).length+1,at=new Date().toISOString();
 const reporting={version:CALCULATION_VERSION,purpose:v.kind==='DEMO'?'DEMO_PREVIEW' as const:'EXTERNAL_CONFIRMED' as const,scope:{...scope,questionIds:confirmed.questionIds},registeredQuestions:p.questions.length,selectedQuestions:selected.length,measuredQuestions:v.kind==='DEMO'?new Set(rows.map(r=>r.questionId)).size:confirmed.measuredQuestionCount,excludedRows:v.kind==='DEMO'?[]:confirmed.excludedRows,definitions:v.kind==='DEMO'?[]:confirmed.definitions,conditions:confirmed.context.conditions};
 let body='<h1>'+REPORT_LABELS[v.type]+'</h1><div class="notice">'+(v.kind==='DEMO'?'DEMO · 가상 고객·검증용 데이터. 실제 성과 보고서가 아닙니다.':'외부 제출용 확정 통계 · 검증된 실제 관측만 사용. 성과·순위·인과관계 보장 없음.')+'</div>';
 body+='<h2>'+escapeHtml(p.client.name)+'</h2><p>'+escapeHtml(v.purpose)+'</p><p>분석 기간 '+v.from+' ~ '+v.to+' (KST) · 관측 방식 '+v.kind+' · 계산 버전 '+CALCULATION_VERSION+' · 검증 '+(v.kind==='DEMO'?'DEMO 모사':'VERIFIED 및 출처 대조')+'</p>';
 body+='<h2>분석 대상과 질문 세트</h2><p>등록 질문 '+p.questions.length+' · 선택 질문 '+selected.length+' · 유효 측정 질문 '+reporting.measuredQuestions+' · 미측정 질문은 관측 표본이 아닙니다.</p>'+list(selected.map(q=>q.text))+'<h3>실제 관측 질문 스냅샷</h3>'+list([...new Set(rows.map(r=>r.consumer?.actualQuestion||r.measurement?.questionText||r.questionText||''))]);
 body+='<h2>실제 저장된 측정 결과</h2><p>전체 '+m.total+' / 유효 '+m.n+' / 제외 '+m.excluded+'건.</p>'+(m.n?'':'<p>검증된 관측 데이터 없음 · 데이터 없음 · 측정 전</p>');
 const metrics=v.kind==='DEMO'?[{key:'고객사 언급',numerator:m.clientCount,denominator:m.n,rate:m.mentionRate,definition:'DEMO 유효 응답 기준'},{key:'추천 후보',numerator:m.recommendations,denominator:m.recommendationN,rate:m.recommendationRate,definition:'DEMO 문맥 분석 완료 응답 기준'},{key:'공식 인용',numerator:m.citations,denominator:m.n,rate:m.citationRate,definition:'DEMO 공식 호스트 기준'}]:confirmed.definitions;
 body+='<table><tr><th>지표</th><th>정의 / 계산식</th><th>분자 / 분모</th><th>비율</th></tr>'+metrics.map(d=>'<tr><td>'+d.key+'</td><td>'+escapeHtml(d.definition)+'</td><td>'+d.numerator+' / '+d.denominator+'</td><td>'+pct(d.rate)+'</td></tr>').join('')+'</table>';
 if(v.kind!=='DEMO')body+='<p>선택 세트 측정 커버리지 '+confirmed.measuredQuestionCount+'/'+selected.length+' · '+pct(confirmed.measurementCoverage)+'</p>'+list(confirmed.warnings);
 body+='<h3>관측 플랫폼 및 조건</h3>'+list([...new Set(rows.map(r=>r.provider+' · '+r.model+' · '+r.region))])+'<h3>주요 경쟁사</h3>'+list(m.competitors.map(c=>c.name+': 언급 '+c.count+'/'+c.n+' · '+pct(c.rate)));
 // Confidential raw answers, evidence notes, work logs, finance, contacts and internal task notes are never serialized to external HTML.
 body+='<h2>검증 근거</h2><p>관측 원문과 검증 이력은 해당 고객 프로젝트의 권한 있는 내부 담당자가 조회합니다. 이 보고서는 비공개 원문·내부 증빙을 자동 공개하지 않습니다.</p>';
 body+='<h2>고객 승인된 개선안</h2>'+list(o.proposals.filter(pr=>pr.approval.status==='APPROVED'&&pr.approval.version===pr.versions.at(-1)?.version).map(pr=>pr.section+' · 승인 버전 '+pr.approval.version));
 body+='<h2>개선 전후 비교</h2>';const studies=(p.client.researchStudies??[]).filter(s=>s.kind===v.kind&&s.conditions.every(c=>confirmed.questionIds.includes(c.questionId)));
 body+=studies.length?studies.map(s=>{const c=compareStudy({...p,responses:rows},s,{confirmed:v.kind!=='DEMO'});return '<h3>'+escapeHtml(s.name)+'</h3><p>예정 각 단계 '+c.expected+' · 유효 대응 쌍 '+c.pairs.length+' · 고객 언급 '+pct(c.baselineMetrics.mentionRate)+' → '+pct(c.followMetrics.mentionRate)+'</p><p>조건 변경 '+c.warnings.length+'건은 비교 제외. '+(c.smallSample?'작은 표본 · 효과 확정 불가. ':'대응 쌍 수는 인과 증명이 아닙니다. ')+(c.modelUnknown?'모델 미표시 · 동일 모델 보장 불가. ':'')+'날짜 차이와 외부 정보 변화에 주의하세요.</p>';}).join(''):'<p>데이터 없음 · 연결된 동일 조건 재측정 계획 없음</p>';
 const traffic=trafficMetrics(p,o.kind,from,to);body+='<h2>확인 가능한 AI 유입·전환</h2>'+list([['AI 유입',traffic.visits],['상담',traffic.consultations],['예약',traffic.bookings],['구매',traffic.purchases]].map(([label,metric])=>label+': '+((metric as typeof traffic.visits).count??'데이터 없음')));
 body+='<h2>데이터 출처와 측정 한계</h2><p>'+escapeHtml(INDUSTRIES[o.onboarding.profile].review)+'</p><p>AI 내부 Retrieval Presence를 추정하지 않습니다. 개선 우선순위는 추천 확률이 아닙니다. API 출력은 소비자 웹 UI와 별도 관측 방식입니다. 계약·내부 원가·연락처·작업 메모·관측 원문·비공개 증빙은 포함하지 않습니다.</p>';
 const html=redactReportSecrets('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+escapeHtml(p.client.name+' '+REPORT_LABELS[v.type])+'</title><style>body{font:15px/1.8 Arial,sans-serif;max-width:960px;margin:40px auto;color:#172746;padding:20px}h1{font-size:30px}h2{margin-top:32px;border-bottom:1px solid #ccd6e6}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd6e6;padding:10px;text-align:left}.notice{background:#eef3fe;padding:16px}li{margin:7px 0}@media print{button{display:none}body{margin:0;max-width:none}}</style></head><body><button onclick="window.print()">브라우저 인쇄 / PDF 저장</button><p>생성 시각 '+at+' · 원본 버전 '+version+'</p>'+body+'</body></html>');
 const report:ClientReport={id:randomUUID(),type:v.type,version,kind:v.kind,at,from:v.from,to:v.to,purpose:v.purpose,rowCount:rows.length,html,sha256:createHash('sha256').update(html).digest('hex'),generatedBy:actor.id,status:'DRAFT',approvedBy:null,approvedAt:null,approvalNote:'',responseIds:rows.map(r=>r.id),auditIds:p.audits.filter(a=>a.kind===(v.kind==="DEMO"?"DEMO":"LIVE")&&a.at>=from&&a.at<=to).map(a=>a.id),taskIds:p.tasks.filter(t=>p.audits.some(a=>a.id===t.auditId&&a.kind===(v.kind==="DEMO"?"DEMO":"LIVE"))&&(p.audits.some(a=>a.id===t.auditId&&a.at>=from&&a.at<=to)||t.execution?.history.some(h=>h.at>=from&&h.at<=to))).map(t=>t.id),reporting};
 (p.reports??=[]).push(report);return report;
}