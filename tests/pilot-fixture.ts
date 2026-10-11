import {randomUUID} from 'node:crypto';
import {seed} from '../src/lib/seed';
import {onboard} from '../src/lib/operations';
import {generateUniverse,selectQueries,confirmSet,createPreScan,saveScanRows,createSnapshot,freezeSnapshot} from '../src/lib/prescan';
import {verifyObservation} from '../src/lib/observation-verification';
import {generateSalesReport,cleanBrand,addInternalArtifact,prepareApproval,commitApproval} from '../src/lib/sales-report';
import {createPilotAgreement,changePilotStatus,recordPilotConsent} from '../src/lib/pilot-agreement';
import {createPilotPlan,freezePilotMeasurement} from '../src/lib/pilot-measurement';
import {addDays,pilotToday} from '../src/lib/pilot-common';
import type {Staff} from '../src/lib/auth';
export const owner:Staff={id:'local-mock-owner',username:'mock',name:'LOCAL MOCK 담당자',role:'OWNER',disabled:false,projectIds:[]};
export const brand=cleanBrand({});
export const proof=()=>({reference:'LOCAL MOCK 합성 증빙 · 실제 고객 아님',documentIds:[],reviewer:'LOCAL MOCK 승인자',checkedAt:new Date().toISOString(),checked:true});
export function pilotFixture(n=1){
 const p=seed().projects[0];p.id=randomUUID();p.client.id=randomUUID();p.client.name='LOCAL MOCK 홍제 A치과 · 실제 성과 아님';p.client.website='https://local-mock.example/';p.questions=[];p.responses=[];p.audits=[];p.tasks=[];p.reports=[];p.batches=[];p.client.competitors=[];delete p.operations;delete p.client.preScanRepository;delete p.client.researchStudies;
 onboard(p,{kind:'CLIENT',profile:'MEDICAL',brandName:p.client.name,contactName:'',contactChannel:'',region:'서울 홍제역',businessGoal:'정보 확인',objectives:[],accountOwner:owner.name,facts:{}});
 const u=generateUniverse(p,{profile:'MEDICAL',region:'서울 홍제역',services:['임플란트','충치','스케일링','보철'],website:p.client.website,officialConfirmed:true,goal:'정보 확인'},owner.id);
 const set=confirmSet(p,{universeId:u.id,questionIds:selectQueries(u).questionIds,reason:'LOCAL MOCK 질문 선정'},owner.id);
 const scan=createPreScan(p,{setId:set.id,screens:['CHATGPT_WEB_SEARCH'],date:pilotToday(),owner:owner.name},owner.id);
 for(let i=0;i<n;i++){const slot=scan.slots[i],q=set.questions.find(q=>q.id===slot.questionId)!;saveScanRows(p,{scanId:scan.id,observation:{projectId:p.id,questionId:q.id,kind:'CONSUMER_UI_MANUAL',screen:slot.screen,model:'LOCAL MOCK',actualQuestion:q.text,questionSubmittedAt:'2026-10-01T00:00:00Z',answerRecordedAt:'2026-10-01T00:01:00Z',country:'대한민국',region:'서울 홍제역',searchUsage:'USED',rawText:'LOCAL MOCK 일반 안내 · 실제 AI 관측 아님',citations:[],consumerScreenConfirmed:true,observer:'LOCAL MOCK 수집자',studyId:scan.studyId,phase:'BASELINE',repetition:1,evidenceIds:[],inputKey:randomUUID()}});verifyObservation(p,{responseId:p.responses.at(-1)!.id,status:'VERIFIED',reviewer:'별도 LOCAL MOCK 검토자',note:'LOCAL MOCK 합성 자료 검증',sourceConfirmed:true},owner.id);}
 const snap=createSnapshot(p,scan.id,owner.id);freezeSnapshot(p,snap.id);
 const report=generateSalesReport(p,{snapshotId:snap.id,primary:'CHATGPT_WEB_SEARCH'},owner,brand);
 if(n){const artifact={id:randomUUID(),mode:'INTERNAL' as const,at:new Date().toISOString(),pdfBase64:'',sha256:'LOCAL MOCK',pages:2 as const,quality:{a4:true,embeddedFonts:true,hangul:true,layout:true}};addInternalArtifact(p,report.id,report.dataHash,artifact,owner);commitApproval(p,prepareApproval(p,{id:report.id,expectedHash:report.dataHash,contentReviewed:true,sampleReviewed:true,medicalReviewed:true,note:'LOCAL MOCK 검수 완료'},owner),{...artifact,mode:'FINAL'});}
 const terms={purpose:'LOCAL MOCK 공식정보 점검',plannedStart:'2026-10-01',plannedEnd:'2026-10-31',owner:owner.name,customerApprover:'LOCAL MOCK 승인자',providedScope:'LOCAL MOCK 정보 확인만 수행',excludedScope:'LOCAL MOCK 외부 게시 제외',questionIds:set.questions.slice(0,Math.max(n,1)).map(q=>q.id),platforms:['CHATGPT_WEB_SEARCH'],competitorIds:[],websitePages:0,contentCount:0,contentScope:'LOCAL MOCK 제작 없음',minutesCap:120,externalCostCap:0,informationRights:'LOCAL MOCK 공식정보 확인',retentionTerms:'LOCAL MOCK 내부 테스트 보존',terminationTerms:'LOCAL MOCK 요청 시 종료',presentationDate:'2026-10-10',serviceFee:0};
 const a=n?createPilotAgreement(p,{scanId:scan.id,salesReportId:report.id,terms},owner):null;
 return {p,a:a!,scan,set,report,terms};
}
export function activate(f:ReturnType<typeof pilotFixture>){const {p,a}=f;for(const status of ['INTERNAL_REVIEW','CLIENT_REVIEW','AGREED'] as const)changePilotStatus(p,{id:a.id,expectedVersion:1,status,note:'LOCAL MOCK 단계 확인',proof:proof()},owner);for(const category of ['OFFICIAL_INFO','PUBLIC_PAGE_ANALYSIS'] as const)recordPilotConsent(p,{id:a.id,category,decision:'GRANTED',scope:'LOCAL MOCK 확인 범위',purpose:'LOCAL MOCK 실증 확인',from:'2026-10-01',to:'2026-12-31',source:'CLIENT_CONFIDENTIAL',proof:proof()},owner);changePilotStatus(p,{id:a.id,expectedVersion:1,status:'ACTIVE',note:'LOCAL MOCK 실증 시작',actualDate:'2026-10-01'},owner);return f;}
export function baseline(f:ReturnType<typeof pilotFixture>){const plan=createPilotPlan(f.p,{id:f.a.id,screens:[{screen:'CHATGPT_WEB_SEARCH',model:'LOCAL MOCK'}],country:'대한민국',region:'서울 홍제역',baselineAt:'2026-10-01',followupAt:addDays(pilotToday(),1)},owner);freezePilotMeasurement(f.p,{id:f.a.id,planId:plan.id,phase:'BASELINE',source:'PRESCAN'},owner);return plan;}
