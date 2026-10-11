import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {seed} from '../src/lib/seed';
import {onboard} from '../src/lib/operations';
import {storeConsumerRows} from '../src/lib/consumer-observation';
import {verifyObservation} from '../src/lib/observation-verification';
import {confirmedMetrics,confirmedExclusion} from '../src/lib/reporting-metrics';
import {visibilityMetrics} from '../src/lib/visibility';
import {createClientReport} from '../src/lib/client-report';
import {analyzeGaps} from '../src/lib/optimization';
import {compareStudy} from '../src/lib/research-metrics';
import {createStudy} from '../src/lib/research';
import type {ProjectData,ResponseRecord} from '../src/lib/types';
import type {Staff} from '../src/lib/auth';
const actor:Staff={id:'local-test-reviewer',name:'검토자',username:'test',role:'OWNER',disabled:false,projectIds:[]};
function project(){const p=seed().projects[0];p.responses=[];p.audits=[];p.tasks=[];onboard(p,{kind:'CLIENT',profile:'MEDICAL',brandName:p.client.name,contactName:'INTERNAL-CONTACT',contactChannel:'INTERNAL-CHANNEL',region:'서울',businessGoal:'내부 목표',objectives:[],accountOwner:'담당자',facts:{}});return p;}
function row(p:ProjectData,questionId=p.questions[0].id,verified=true){
 const q=p.questions.find(q=>q.id===questionId)!;
 storeConsumerRows(p,[{questionId,kind:'CONSUMER_UI_MANUAL',screen:'CHATGPT_WEB_SEARCH',model:'LOCAL MOCK',actualQuestion:q.text,questionSubmittedAt:'2026-10-01T00:00:00Z',answerRecordedAt:'2026-10-01T00:01:00Z',country:'대한민국',region:'서울',searchUsage:'USED',rawText:`1. **${p.client.name}** — 상담 후보입니다.`,citations:[p.client.website],consumerScreenConfirmed:true,observer:'수집자',studyId:null,phase:'UNASSIGNED',repetition:1,evidenceIds:[],inputKey:randomUUID()}]);
 const r=p.responses.at(-1)!;if(verified)verifyObservation(p,{responseId:r.id,status:'VERIFIED',reviewer:'검토자',note:'로컬 합성 자료의 원문·출처·조건 대조',sourceConfirmed:true},actor.id);return r;
}
const reportInput={type:'INITIAL',kind:'CONSUMER_UI_MANUAL',from:'2026-10-01',to:'2026-10-31',purpose:'로컬 합성 자료의 보고서 검증'};
it('T4: 내부 연구와 확정 보고는 분리하고 미검증·거부·부정확·출처 미확인 자료를 제외한다',()=>{
 const p=project(),r=row(p,undefined,false);expect(visibilityMetrics(p.responses,p).n).toBe(1);expect(confirmedMetrics(p,{kind:r.kind}).n).toBe(0);
 verifyObservation(p,{responseId:r.id,status:'VERIFIED',reviewer:'검토자',note:'로컬 원문 대조',sourceConfirmed:true},actor.id);expect(confirmedMetrics(p,{kind:r.kind}).n).toBe(1);
 r.accuracy='INACCURATE';expect(confirmedExclusion(p,r)).toContain('부정확');r.accuracy='UNREVIEWED';r.verification!.sourceConfirmed=false;expect(confirmedMetrics(p,{kind:r.kind}).n).toBe(0);
 r.verification!.sourceConfirmed=true;r.verification!.status='REJECTED';expect(confirmedMetrics(p,{kind:r.kind}).n).toBe(0);
 r.verification!.status='VERIFIED';r.classification='INTERNAL';expect(confirmedMetrics(p,{kind:r.kind}).n).toBe(0);
});
it('T5: 실제 고객 보고서에 DEMO는 차단하며 유효 표본 없음은 0%가 아니다',()=>{
 const p=project();row(p,undefined,false);const demo=structuredClone(p.responses[0]);demo.id=randomUUID();demo.kind='DEMO';p.responses.push(demo);
 const r=createClientReport(p,reportInput,actor);expect(r.rowCount).toBe(0);expect(r.html).toContain('검증된 관측 데이터 없음');expect(r.html).not.toContain('>0.0%</td>');expect(()=>createClientReport(p,{...reportInput,kind:'DEMO'},actor)).toThrow('섞을');expect(confirmedMetrics(p,{kind:'DEMO'}).n).toBe(0);
});
it('T6: API와 웹 UI는 별도 표본이며 격차 분석도 한 관측 방식의 ID만 사용한다',()=>{
 const p=project(),r=row(p);const api:ResponseRecord={...structuredClone(r),id:randomUUID(),kind:'API_OBSERVATION',provider:'OpenAI',consumer:undefined,questionText:r.consumer!.actualQuestion,measurement:{batchId:'local-mock',questionText:r.consumer!.actualQuestion,status:'SUCCEEDED',searchUsed:true,apiResponseId:'mock',requestId:'mock',apiStatus:'completed',usage:null,searchCalls:[],citedSources:[],rawOutput:null,errorCode:null,errorMessage:null,durationMs:1,costEstimate:{usd:null,basis:'LOCAL MOCK',rates:null}}};p.responses.push(api);
 expect(confirmedMetrics(p,{kind:'CONSUMER_UI_MANUAL'}).rows.map(r=>r.id)).toEqual([r.id]);expect(confirmedMetrics(p,{kind:'API_OBSERVATION'}).rows.map(r=>r.id)).toEqual([api.id]);
 const a={id:'a',kind:'LIVE' as const,url:p.client.website,at:new Date().toISOString(),findings:[]};expect(analyzeGaps(p,a).observationGroups).toEqual([{kind:r.kind,responseIds:[r.id]}]);expect(analyzeGaps(p,a,{kind:'API_OBSERVATION',confirmed:true}).citedSources.every(s=>s.responseId===api.id)).toBe(true);
});
it('T7: 등록120·선택30·측정30의 분모/질문 목록과 Coverage를 정확히 보존한다',()=>{
 const p=project();p.questions=Array.from({length:120},(_,i)=>({...p.questions[0],id:randomUUID(),text:'LOCAL MOCK 질문 '+i}));const ids=p.questions.slice(0,30).map(q=>q.id);for(const id of ids)row(p,id);
 const m=confirmedMetrics(p,{kind:'CONSUMER_UI_MANUAL',questionIds:ids});expect(m.n).toBe(30);expect(m.registeredQuestionCount).toBe(120);expect(m.selectedQuestionCount).toBe(30);expect(m.measuredQuestionCount).toBe(30);expect(m.definitions.find(d=>d.key==='Query Coverage')).toMatchObject({numerator:30,denominator:30,rate:1});
 const all=confirmedMetrics(p,{kind:'CONSUMER_UI_MANUAL',questionIds:p.questions.map(q=>q.id)});expect(all.measurementCoverage).toBe(.25);expect(all.definitions.find(d=>d.key==='Query Coverage')?.denominator).toBe(30);
 const r=createClientReport(p,{...reportInput,questionIds:ids},actor);expect(r.reporting?.selectedQuestions).toBe(30);expect(r.html).toContain('등록 질문 120 · 선택 질문 30 · 유효 측정 질문 30');expect(r.html).not.toContain('LOCAL MOCK 질문 119');expect(r.responseIds).toHaveLength(30);
});
it('T8: 다른 고객 소속·내부 원문·증빙·연락처·작업 메모와 키는 외부 HTML에서 제외한다',()=>{
 const p=project(),r=row(p);r.rawText+=' INTERNAL-PRIVATE-RAW sk-proj-xxxxxxxxxxxxxxxxxxxxx';r.verification!.note='INTERNAL-PRIVATE-EVIDENCE';p.operations!.sales.consultationNotes='INTERNAL-SALES';const other=project();other.responses=[r];expect(confirmedMetrics(other,{kind:r.kind}).n).toBe(0);
 const report=createClientReport(p,reportInput,actor);expect(report.html).not.toContain('INTERNAL-');expect(report.html).not.toContain('sk-proj-');expect(()=>confirmedMetrics(p,{kind:r.kind,questionIds:[other.questions[0].id]})).toThrow('소속');
});
it('T9: 원문을 바꾸지 않고 검증·분류 감사 이력을 남기며 기존 자료를 자동 승격하지 않는다',()=>{
 const p=project(),r=row(p,undefined,false),raw=r.rawText;expect(r.verification!.status).toBe('UNVERIFIED');
 expect(()=>verifyObservation(p,{responseId:r.id,status:'VERIFIED',reviewer:'수집자',note:'로컬 원문 확인',sourceConfirmed:true},actor.id)).toThrow('별도');
 expect(()=>verifyObservation(p,{responseId:r.id,status:'VERIFIED',reviewer:'검토자',note:'로컬 원문 확인'},actor.id)).toThrow('출처');
 verifyObservation(p,{responseId:r.id,status:'VERIFIED',reviewer:'검토자',note:'로컬 원문 확인',sourceConfirmed:true,classification:'INTERNAL'},actor.id);
 verifyObservation(p,{responseId:r.id,status:'REJECTED',reviewer:'검토자',note:'재검토 결과 제외',sourceConfirmed:true},actor.id);
 expect(r.rawText).toBe(raw);expect(r.verification!.history).toHaveLength(2);expect(r.verification!.history[0].actorId).toBe(actor.id);expect(r.classificationHistory![0].from).toBe('CLIENT_CONFIDENTIAL');
});
it('동일 결과에 새 입력 키를 주더라도 확정 표본에서는 중복 집계하지 않는다',()=>{
 const p=project(),r=row(p),copy=structuredClone(r);copy.id=randomUUID();copy.consumer!.inputKey=randomUUID();p.responses.push(copy);const m=confirmedMetrics(p,{kind:r.kind});expect(m.n).toBe(1);expect(m.excludedRows[0].reason).toContain('중복');
});
it('첫 소개는 명시적 번호를 분모로 삼고 조건·계산 버전을 함께 저장한다',()=>{
 const p=project(),r=row(p);const m=confirmedMetrics(p,{kind:r.kind});expect(m.definitions.find(d=>d.key==='First Mention Rate')).toMatchObject({numerator:1,denominator:1,rate:1});expect(m.context.version).toBe('verified-observation-v1');r.model='';expect(confirmedMetrics(p,{kind:r.kind}).n).toBe(0);
});
it('확정 Baseline/Follow-up은 같은 조건의 검증된 대응 쌍만 비교한다',()=>{
 const p=project(),s=createStudy(p,{name:'LOCAL MOCK 전후',kind:'CONSUMER_UI_MANUAL',questionIds:[p.questions[0].id],screens:[{screen:'CHATGPT_WEB_SEARCH',model:'LOCAL MOCK'}],country:'대한민국',region:'서울',repetitions:1});const base=row(p),follow=row(p,undefined,false);base.consumer!.studyId=s.id;base.consumer!.phase='BASELINE';follow.consumer!.studyId=s.id;follow.consumer!.phase='FOLLOW_UP';follow.observedAt='2026-10-02T00:01:00Z';expect(compareStudy(p,s,{confirmed:true}).pairs).toHaveLength(0);verifyObservation(p,{responseId:follow.id,status:'VERIFIED',reviewer:'검토자',note:'로컬 원문 대조',sourceConfirmed:true},actor.id);expect(compareStudy(p,s,{confirmed:true}).pairs).toHaveLength(1);follow.region='다른 지역';expect(compareStudy(p,s,{confirmed:true}).pairs).toHaveLength(0);
});
