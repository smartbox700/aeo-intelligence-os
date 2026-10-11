import {requireStaff,assertProjectAccess,allowedProjects,safeWorkspaceProject,grantCreatedProject,accessEvent,failure} from '@/lib/auth';
import {reserveWebsiteInspection} from '@/lib/website-limits';
import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {getStore,mutate} from '@/lib/store';
import {clientSchema,questionSchema,responseSchema} from '@/lib/validation';
import {analyzeMentions,ANALYSIS_VERSION,exportCsv} from '@/lib/analysis';
import {generateQuestions} from '@/lib/seed';
import {auditWebsite,tasksFromAudit,compareCompetitorWebsites} from '@/lib/audit';
import type {ProjectData} from '@/lib/types';
import {extractEntities,mentionsFromAnalysis} from '@/lib/entity-analysis';
export const runtime='nodejs';
export const dynamic='force-dynamic';

function project(s:Awaited<ReturnType<typeof getStore>>,id:string){const p=s.projects.find(p=>p.id===id&&p.organizationId==='local-org');if(!p)throw new Error('프로젝트를 찾을 수 없습니다.');return p;}
export async function GET(req:NextRequest){try{const user=await requireStaff(req); const scopeId=req.nextUrl.searchParams.get('projectId');if(scopeId)assertProjectAccess(user,scopeId); await accessEvent(user,'자료 조회:workspace',scopeId??undefined);
 if(req.nextUrl.searchParams.get('export')){const s=await getStore();const p=project(s,req.nextUrl.searchParams.get('projectId')??'');const kind=req.nextUrl.searchParams.get('kind')??'MANUAL_OBSERVATION';if(!['DEMO','MANUAL_UI','MANUAL_OBSERVATION','API','API_OBSERVATION','CONSUMER_UI_MANUAL'].includes(kind))throw new Error('유형 오류');return new NextResponse(exportCsv(p,kind),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="aeo-report.csv"','Cache-Control':'no-store'}});}
 return NextResponse.json({schemaVersion:1,projects:allowedProjects(user,(await getStore()).projects).map(p=>safeWorkspaceProject(p,user)),storageMode:process.env.STORAGE_MODE==='postgres'?'PostgreSQL':'로컬 파일',scope:'staff-project-scoped'},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{const user=await requireStaff(req);
 const origin=req.headers.get('origin');if(origin&&(new URL(origin).host!==req.headers.get('host')||new URL(origin).protocol!==req.nextUrl.protocol))return NextResponse.json({error:'다른 출처의 요청은 허용되지 않습니다.'},{status:403});
 if(Number(req.headers.get('content-length')||0)>200000)return NextResponse.json({error:'요청 크기 제한 초과'},{status:413});
 const raw=await req.text();if(Buffer.byteLength(raw)>200000)throw new Error('요청 크기 제한 초과');
 const input=JSON.parse(raw);if(input.action!=='create')assertProjectAccess(user,String(input.projectId));if(['create','update'].includes(input.action))await requireStaff(req,['OWNER','MANAGER']);if(input.action==='delete')await requireStaff(req,['OWNER']);if(input.action==='task')await requireStaff(req,['OWNER','MANAGER']);await accessEvent(user,'자료 접근:workspace:'+String(input.action),input.projectId);const now=new Date().toISOString();
 if(input.action==='audit'){
  const p=project(await getStore(),input.projectId);if(!p.client.website)throw new Error('홈페이지 URL을 등록하세요.');
  const release=reserveWebsiteInspection(p.id,p.audits.filter(a=>a.kind==='LIVE').map(a=>a.at).sort().at(-1));try{
  const audit=await auditWebsite(p.client);audit.competitorComparisons=await compareCompetitorWebsites(p.client,audit);await mutate(s=>{const current=project(s,p.id);current.audits.push(audit);current.tasks.push(...tasksFromAudit(audit));});
  return NextResponse.json({ok:true});}finally{release();}
 }
 const result=await mutate(s=>{
  if(input.action==='create'){
   const c=clientSchema.parse(input.client);const id=randomUUID();const p:ProjectData={id,organizationId:'local-org',name:c.name,client:{...c,id:randomUUID(),competitors:c.competitors.map(e=>({...e,id:randomUUID()})),createdAt:now},questions:[],responses:[],audits:[],tasks:[]};s.projects.push(p);return {projectId:id};
  }
  const p=project(s,input.projectId);
  switch(input.action){
   case 'update':{const c=clientSchema.parse(input.client);const known=new Set(p.client.competitors.map(c=>c.id));p.client={...p.client,...c,competitors:c.competitors.map(e=>({...e,id:e.id&&known.has(e.id)?e.id:randomUUID()}))};p.name=c.name;break;}
   case 'delete':s.projects=s.projects.filter(e=>e.id!==p.id);break;
   case 'generate':if(!p.questions.length)p.questions=generateQuestions();else throw new Error('질문 세트가 이미 있습니다. 개별 질문을 추가하세요.');break;
   case 'question':p.questions.push({...questionSchema.parse(input.question),id:randomUUID(),createdAt:now});break;
   case 'response':{const r=responseSchema.parse(input.response);if(!p.questions.some(q=>q.id===r.questionId))throw new Error('이 프로젝트에 속한 질문을 선택하세요.');const analysis=extractEntities(r.rawText,p.client);for(const name of r.manualObservation?.recommendedNames??[]){const matches=analysis.entities.filter(e=>e.name===name&&e.context!=='NEGATED');if(!matches.length)throw new Error('관찰한 추천 업체는 원문 분석에서 확인된 정확한 업체명이어야 합니다. 부정·제외된 업체는 추천으로 입력할 수 없습니다.');for(const e of matches){const before={...e};e.context='RECOMMENDATION';analysis.reviewHistory.push({at:now,entityId:e.id,before,after:{...e},reason:'입력 담당자의 수동 추천 관찰 기록'});analysis.method='ADMIN_REVIEW';}}p.responses.push({...r,classification:"CLIENT_CONFIDENTIAL",questionText:p.questions.find(q=>q.id===r.questionId)!.text,id:randomUUID(),createdAt:now,citations:[...new Set(r.citations)],mentions:mentionsFromAnalysis(analysis),entityAnalysis:analysis,analysisVersion:analysis.version,cost:null,accuracy:'UNREVIEWED'});break;}
   case 'reanalyze':p.responses=p.responses.map(r=>{if(r.entityAnalysis?.reviewHistory.length)return r;const analysis=extractEntities(r.rawText,p.client,r.measurement?.citedSources);return {...r,mentions:mentionsFromAnalysis(analysis),entityAnalysis:analysis,analysisVersion:analysis.version};});break;
   case 'task':{const t=p.tasks.find(t=>t.id===input.taskId);if(t?.execution)throw new Error('이 작업은 AEO 실행 관리에서 승인·실행 상태를 변경하세요.');if(!t||!['TODO','DOING','DONE'].includes(input.status))throw new Error('과제/상태 오류');if(input.status==='DONE'&&t.reviewRequired&&t.reviewStatus!=='APPROVED')throw new Error('담당자 검토 승인 후 완료할 수 있습니다.');t.status=input.status;break;}
   case 'review':{const r=p.responses.find(r=>r.id===input.responseId);if(!r||!['UNREVIEWED','ACCURATE','INACCURATE'].includes(input.accuracy))throw new Error('응답/검토 오류');r.accuracy=input.accuracy;break;}
   default:throw new Error('지원하지 않는 작업');
  }return {ok:true};
 });if(input.action==='create'&&'projectId' in result&&result.projectId)await grantCreatedProject(user,result.projectId);return NextResponse.json(result);
}catch(e){return failure(e);}}




