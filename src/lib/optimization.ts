import {randomUUID} from 'node:crypto';
import type {Audit,Entity,Finding,Gap,OptimizationSnapshot,PriorityWeights,ProjectData,Task} from './types';
import {DEFAULT_WEIGHTS,PROFILE_KEYS,COMMON_KEYS,QUESTION_PATTERNS} from './optimization-config';
import {isEligible} from './visibility';
import {confirmedExclusion} from './reporting-metrics';
import type {MetricScope} from './reporting-metrics';
import {auditWebsite} from './audit';

export function priorityScore(factors:PriorityWeights,weights:PriorityWeights=DEFAULT_WEIGHTS){
 const parts=Object.fromEntries(Object.keys(weights).map(key=>{const k=key as keyof PriorityWeights;return [k,Math.round(Math.max(0,Math.min(1,factors[k]))*weights[k]*10)/10];})) as PriorityWeights;
 return {score:Math.round(Object.values(parts).reduce((a,b)=>a+b,0)*10)/10,parts};
}
const host=(url:string)=>{try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '';}};
export function analyzeGaps(p:ProjectData,a:Audit,scope?:MetricScope&{confirmed?:boolean}):OptimizationSnapshot{
 if(a.kind==='LIVE'&&scope?.kind==='DEMO')throw new Error('실제 홈페이지 분석에 DEMO 관측을 연결할 수 없습니다.');
 const profile=p.client.analysisProfile??'LOCAL_SERVICE';const weights=p.client.priorityWeights??DEFAULT_WEIGHTS;
 const allowed=new Set([...COMMON_KEYS,...PROFILE_KEYS[profile]]);
 const kind=a.kind==='DEMO'?'DEMO':scope?.kind??(['CONSUMER_UI_MANUAL','MANUAL_OBSERVATION','MANUAL_UI','API_OBSERVATION'] as const).find(k=>p.responses.some(r=>r.kind===k&&isEligible(r)))??'CONSUMER_UI_MANUAL';
 const rows=p.responses.filter(r=>r.kind===kind&&isEligible(r)&&(!scope?.questionIds||scope.questionIds.includes(r.questionId))&&(!scope?.providers?.length||scope.providers.includes(r.provider))&&(!scope?.from||r.observedAt>=scope.from)&&(!scope?.to||r.observedAt<=scope.to)&&(!scope?.confirmed||!confirmedExclusion(p,r)));
 const sources=rows.flatMap(r=>r.citations.map(url=>({responseId:r.id,kind:r.kind,url,entityId:host(url)===host(p.client.website)?p.client.id:p.client.competitors.find(c=>host(c.website)===host(url))?.id??null})));
 const gaps:Gap[]=a.findings.filter(f=>allowed.has(f.key)&&f.status!=='pass').map(f=>{
  const competitors=(a.competitorComparisons??[]).filter(c=>c.status==='SUCCEEDED').flatMap(c=>{const match=c.findings.find(v=>v.key===f.key);return match?[{id:c.entityId,name:c.name,status:match.status,evidence:match.evidence,url:c.url}]:[];});
  const stronger=competitors.filter(c=>c.status==='pass');const cited=stronger.some(c=>sources.some(s=>s.entityId===c.id));
  const questions=p.questions.filter(q=>QUESTION_PATTERNS[f.key]?.test(q.text));const technical=COMMON_KEYS.includes(f.key);const accuracy=['identity-name','entity','experts','expert-evidence','manufacturer','specification','price','purchase-terms'].includes(f.key);const conversion=['booking','delivery','purchase-terms'].includes(f.key);
  const scoring=priorityScore({accuracy:accuracy?(f.status==='fail'?1:.8):.2,relevance:questions.length?1:0,technical:technical?(f.status==='fail'?1:.8):0,citation:cited?1:stronger.length?.5:0,conversion:conversion?1:0},weights);
  const regulatory=/(병원|치과|의료|변호|법무|법률)/.test(p.client.industry)&&['experts','expert-evidence','services','faq','price'].includes(f.key);
  return {id:randomUUID(),key:f.key,label:f.label,clientStatus:f.status,competitorStates:competitors,questionIds:questions.map(q=>q.id),evidenceUrls:[...new Set([a.url,...stronger.map(c=>c.url),...(a.pages??[]).filter(page=>f.evidence.includes(page.url)||stronger.some(c=>c.evidence.includes(page.url))).map(page=>page.url)])],observedFact:`검사된 고객 HTML: ${f.evidence}${stronger.length?`; 비교 페이지에서 관련 단서 확인: ${stronger.map(c=>c.name).join(', ')}`:''}`,necessity:f.status==='unknown'?'미확인 사항: 담당자 확인 후 수정 여부 결정':'검사 범위에서 누락·구조 문제 단서가 있어 보완 검토 필요',action:f.recommendation,reviewRequired:true,regulatoryReview:regulatory,remeasurement:'담당자가 실제 정보와 수정 페이지를 확인 → 같은 프로필·URL을 재검사 → 같은 질문·플랫폼·모델·지역·출처 유형의 수동 응답으로 비교. 유료 호출은 활성화하지 않음.',score:scoring.score,scoreParts:scoring.parts};
 });
 const rivalCitations=sources.filter(s=>s.entityId&&s.entityId!==p.client.id);const own=sources.filter(s=>s.entityId===p.client.id);
 if(rivalCitations.length&&!own.length){const scoring=priorityScore({accuracy:0,relevance:1,technical:0,citation:1,conversion:0},weights);gaps.push({id:randomUUID(),key:'observed-citations',label:'관측 응답의 공식 출처 격차',clientStatus:'관측 표본에 고객 공식 도메인 인용 없음',competitorStates:p.client.competitors.filter(c=>rivalCitations.some(s=>s.entityId===c.id)).map(c=>({id:c.id,name:c.name,status:'관측 인용 있음',evidence:'등록 공식 호스트와 출처 호스트 일치. 내용의 진위·인용 원인은 미확인.',url:c.website})),questionIds:[...new Set(rows.filter(r=>r.citations.some(u=>rivalCitations.some(s=>s.url===u))).map(r=>r.questionId))],evidenceUrls:[...new Set(rivalCitations.map(s=>s.url))],observedFact:`해당 유형 표본 ${rows.length}건에서 경쟁사 도메인 출처 ${rivalCitations.length}개·고객 공식 출처 0개`,necessity:'인용된 페이지의 질문 대응 정보와 자사 공식 정보를 담당자가 비교',action:'실제 서비스·상품 정보로 질문에 답하는 공식 페이지를 보완하고 사실을 확인. 경쟁사 콘텐츠를 복제하지 않음.',reviewRequired:true,regulatoryReview:/(치과|병원|변호|법무)/.test(p.client.industry),remeasurement:'동일 질문·플랫폼·모델·지역·출처 유형으로 수동 재관측하고 인용의 관련성을 검토',score:scoring.score,scoreParts:scoring.parts});}
 return {version:'gap-rules-v2-single-method',observationGroups:[{kind,responseIds:rows.map(r=>r.id)}],profile,weights:{...weights},gaps:gaps.sort((a,b)=>b.score-a.score),pages:a.pages??[],citedSources:sources};
}
export function optimizationTasks(a:Audit):Task[]{return (a.optimization?.gaps??[]).map(g=>({id:randomUUID(),auditId:a.id,gapId:g.id,title:g.label+' 보완·검토',evidence:g.evidenceUrls.join(' · ')+' · '+g.observedFact,observedFact:g.observedFact,action:g.action,expectedArea:'검증된 정보를 발견·해석하기 쉬운 구조를 만든다는 가설. 추천 순위·확률·효과 미보장.',remeasurement:g.remeasurement,priority:g.score>=50?'P1':'P2',status:'TODO',hypothesis:true,score:g.score,scoreParts:g.scoreParts,assignee:'',dueDate:'',reviewRequired:g.reviewRequired,regulatoryReview:g.regulatoryReview,reviewStatus:'PENDING',reviewNote:'',history:[]}));}
export type WebsiteInspector=(client:Entity,includePages?:boolean)=>Promise<Audit>;
export async function collectOptimization(p:ProjectData,inspect:WebsiteInspector=auditWebsite,scope?:MetricScope&{confirmed?:boolean}):Promise<Audit>{
 const a=await inspect(p.client,true);a.competitorComparisons=[];
 for(const c of p.client.competitors.filter(c=>c.website).slice(0,2))try{
  const result=await inspect({...p.client,...c,id:c.id,address:c.address??'',bookingUrl:c.bookingUrl??'',services:'',experts:'',competitors:[]},true);
  a.competitorComparisons.push({entityId:c.id,name:c.name,url:result.url,at:result.at,status:'SUCCEEDED',error:null,findings:result.findings,differences:[]});a.pages=[...(a.pages??[]),...(result.pages??[])];
 }catch(e){a.competitorComparisons.push({entityId:c.id,name:c.name,url:c.website,at:new Date().toISOString(),status:'FAILED',error:(e as Error).message,findings:[],differences:[]});}
 a.optimization=analyzeGaps(p,a,scope);return a;
}
/** Fictional HTML fixtures, never fetched or represented as real websites. */
export async function demoOptimization(p:ProjectData):Promise<Audit>{
 const {inspectHtml}=await import('./audit');
 const {load}=await import('cheerio');const at=new Date().toISOString();
 const clientHtml='<html><head><title>DEMO 안내 페이지</title></head><body><h1>DEMO · 가상 홈페이지</h1><p>테스트용 가상 안내. 의료진 자격, 치료 효과, 후기, 실제 예약은 확인되지 않았습니다.</p></body></html>';
 const rivalHtml='<html><head><title>DEMO 구조 비교</title></head><body><h1>DEMO 가상 비교 업체</h1><h2>FAQ 자주 묻는 질문</h2><p>가상 위치 안내 / 서비스 소개 / 문의 채널 / 상품명 / 제조사 / 모델 / 규격 / 가격 / 배송 / 교환 환불 안내 항목의 구조 예시. 실제 의료 정보와 판매 조건이 아닙니다.</p></body></html>';
 const make=(e:Entity,html:string):Audit=>{const $=load(html);return {id:randomUUID(),kind:'DEMO',url:e.website||'https://demo.example/',at,findings:inspectHtml(html,e.website||'https://demo.example/',e),pages:[{entityId:e.id,url:e.website||'https://demo.example/',status:200,at,title:$('title').text(),headings:$('h1,h2').map((_,v)=>$(v).text()).get(),excerpt:$('body').text()}]};};
 const result=await collectOptimization(p,async e=>make(e,e.id===p.client.id?clientHtml:rivalHtml));result.kind='DEMO';result.optimization=analyzeGaps(p,result);return result;
}



