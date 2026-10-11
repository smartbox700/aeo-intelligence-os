import {randomUUID} from 'node:crypto';
import type {ProjectData, Question, Store} from './types';
import {analyzeMentions,ANALYSIS_VERSION} from './analysis';
import {addMeasurementQuestions} from './test-questions';
export function generateQuestions():Question[]{return ['홍제역 근처 임플란트 상담할 만한 치과는?','서대문구에서 임플란트 치과를 비교하려면?','홍제역에서 토요일 임플란트 상담이 가능한 치과는?','임플란트 상담 전 의료진의 어떤 정보를 확인해야 하나?','홍제역 부근에서 임플란트 예약 방법을 확인해줘.'].map((text,i)=>({id:randomUUID(),text,intent:['지역·서비스','비교','일정','전문가 정보','예약'][i],importance:3,commercialIntent:i===3?2:4,createdAt:new Date().toISOString()}));}
export function seed():Store{
 const at='2026-10-08T00:00:00.000Z';
 const p:ProjectData={id:randomUUID(),organizationId:'local-org',name:'홍제역 임플란트 · SAMPLE',client:{id:randomUUID(),name:'홍제 A치과',aliases:['홍제A치과'],industry:'치과',address:'서울 서대문구 홍제역 일대 (가상)',website:'https://hongje-a.example',bookingUrl:'https://hongje-a.example/reservation',services:'임플란트 상담 (가상 사례)',experts:'미등록 · 자격 검증 필요',createdAt:at,competitors:[{id:randomUUID(),name:'홍제 B치과',aliases:[],website:'https://hongje-b.example'},{id:randomUUID(),name:'홍제 C치과',aliases:[],website:'https://hongje-c.example'}]},questions:generateQuestions(),responses:[],audits:[],tasks:[]};
 p.responses=p.questions.map((q,i)=>{const rawText=['SAMPLE: 홍제 B치과와 홍제 A치과의 공식 안내를 비교하세요. 예약 가능 여부는 확인되지 않았습니다.','SAMPLE: 홍제 B치과, 홍제 C치과의 공개된 진료 정보를 비교해 보세요.','SAMPLE: 홍제 A치과의 토요일 상담 여부는 공식 안내 확인이 필요합니다.','SAMPLE: 홍제 A치과를 포함해 의료진 자격 및 진료 항목을 공식 홈페이지에서 확인하세요.','SAMPLE: 홍제 C치과 예약 안내를 확인하세요. 실제 예약 가능 여부는 미검증입니다.'][i];return {id:randomUUID(),questionId:q.id,provider:['ChatGPT','Gemini','네이버 AI 검색'][i%3],model:'SAMPLE · 실제 측정 아님',kind:'DEMO',observedAt:at,region:'서울 서대문구 홍제역',rawText,citations:[i===1||i===4?'https://hongje-b.example/':'https://hongje-a.example/'],mentions:analyzeMentions(rawText,p.client),analysisVersion:ANALYSIS_VERSION,createdAt:at,cost:null,accuracy:'UNREVIEWED'};});
 const auditId=randomUUID();
 p.audits=[{id:auditId,kind:'DEMO',url:p.client.website,at,findings:[{key:'title',label:'페이지 제목',status:'warn',evidence:'SAMPLE HTML: <title>홈</title>',recommendation:'업체명, 지역, 주요 진료 안내가 식별 가능한 제목으로 수정'},{key:'schema',label:'구조화 데이터',status:'warn',evidence:'SAMPLE HTML에 JSON-LD 없음',recommendation:'검증된 사업체 정보로 Schema.org 데이터 추가'},{key:'booking',label:'예약 안내',status:'warn',evidence:'SAMPLE HTML에 예약 링크 없음',recommendation:'공식 예약 URL과 예약 절차를 본문에 표시'}]}];
 p.tasks=p.audits[0].findings.map(f=>({id:randomUUID(),auditId,title:f.label+' 개선',evidence:f.evidence,action:f.recommendation,expectedArea:'정보 접근성과 이해 가능성',priority:'P2',status:'TODO',hypothesis:true}));
 addMeasurementQuestions(p);
 return {schemaVersion:1,projects:[p]};
}
