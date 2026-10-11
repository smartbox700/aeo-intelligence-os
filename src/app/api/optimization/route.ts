import {requireStaff,assertProjectAccess,allowedProjects,safeWorkspaceProject,grantCreatedProject,accessEvent,failure} from '@/lib/auth';
import {reserveWebsiteInspection} from '@/lib/website-limits';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {mutate,getStore} from '@/lib/store';
import {ownedProject} from '@/lib/measurement-service';
import {collectOptimization,demoOptimization,optimizationTasks} from '@/lib/optimization';

export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const running=new Set<string>();
const weight=z.number().min(0).max(100);
const settings=z.object({profile:z.enum(['LOCAL_SERVICE','PRODUCT']),weights:z.object({accuracy:weight,relevance:weight,technical:weight,citation:weight,conversion:weight}).refine(w=>Math.abs(Object.values(w).reduce((a,b)=>a+b,0)-100)<.001,'가중치 합계는 100이어야 합니다.')});
const httpUrl=z.url().refine(v=>['http:','https:'].includes(new URL(v).protocol));
export async function POST(req:NextRequest){try{const user=await requireStaff(req);
 const origin=req.headers.get('origin');if(origin&&(new URL(origin).host!==req.headers.get('host')||new URL(origin).protocol!==req.nextUrl.protocol))return NextResponse.json({error:'다른 출처의 요청은 허용되지 않습니다.'},{status:403});
 const text=await req.text();if(Buffer.byteLength(text)>30000)throw new Error('요청 크기 제한 초과');const input=JSON.parse(text);assertProjectAccess(user,String(input.projectId));if(['task','website-change'].includes(input.action))await requireStaff(req,['OWNER','MANAGER']);await accessEvent(user,'자료 접근:optimization:'+String(input.action),input.projectId);const p=ownedProject(await getStore(),z.string().parse(input.projectId));
 if(input.action==='analyze'){
  const kind=z.enum(['LIVE','DEMO']).parse(input.kind);const scope=input.observationScope?z.object({kind:z.enum(['CONSUMER_UI_MANUAL','MANUAL_OBSERVATION','MANUAL_UI','API_OBSERVATION']),questionIds:z.array(z.string()).max(1000).optional(),providers:z.array(z.string()).max(20).optional(),from:z.iso.datetime().optional(),to:z.iso.datetime().optional(),confirmed:z.boolean().default(false)}).parse(input.observationScope):undefined;if(scope?.questionIds?.some(id=>!p.questions.some(q=>q.id===id)))throw new Error('질문 세트 소속 오류');
  if(running.size)throw new Error('홈페이지 비교가 실행 중입니다. 완료 후 다시 시도하세요.');
  
  if(kind==='LIVE'&&!p.client.website)throw new Error('고객사 공식 URL을 등록하세요.');
  const release=kind==='LIVE'?reserveWebsiteInspection(p.id,p.audits.filter(a=>a.kind==='LIVE').map(a=>a.at).sort().at(-1)):()=>{};running.add(p.id);
  try{const audit=kind==='DEMO'?await demoOptimization(p):await collectOptimization(p,undefined,scope);await mutate(s=>{const current=ownedProject(s,p.id);if(JSON.stringify(current.client)!==JSON.stringify(p.client))throw new Error('검사 중 업체 설정이 변경됐습니다. 다시 검사하세요.');current.audits.push(audit);current.tasks.push(...optimizationTasks(audit));});return NextResponse.json({ok:true,auditId:audit.id,gaps:audit.optimization?.gaps.length});}finally{running.delete(p.id);release();}
 }
 const result=await mutate(s=>{const current=ownedProject(s,p.id);
  if(input.action==='settings'){const v=settings.parse(input);current.client.analysisProfile=v.profile;current.client.priorityWeights=v.weights;return {ok:true};}
  if(input.action==='task'){
   const v=z.object({taskId:z.string(),status:z.enum(['TODO','DOING','DONE']),assignee:z.string().trim().max(100),dueDate:z.union([z.literal(''),z.iso.date()]),reviewStatus:z.enum(['PENDING','APPROVED']),note:z.string().trim().max(2000)}).parse(input);
   const t=current.tasks.find(t=>t.id===v.taskId);if(!t)throw new Error('이 프로젝트의 작업이 아닙니다.');if(t.execution)throw new Error('AEO 실행 관리에서 승인·실행 상태를 변경하세요.');if(v.reviewStatus==='APPROVED'&&v.note.length<5)throw new Error('검토 승인에는 사실 확인 근거를 5자 이상 입력하세요.');if(v.status==='DONE'&&t.reviewRequired&&v.reviewStatus!=='APPROVED')throw new Error('담당자 사실·규정 검토 후 완료할 수 있습니다.');
   t.status=v.status;t.assignee=v.assignee;t.dueDate=v.dueDate;t.reviewStatus=v.reviewStatus;t.reviewNote=v.note;(t.history??=[]).push({at:new Date().toISOString(),status:v.status,assignee:v.assignee,note:v.note});return {ok:true};
  }
  if(input.action==='website-change'){const v=z.object({url:httpUrl,at:z.iso.datetime(),note:z.string().trim().min(5).max(2000),verification:z.string().trim().min(5).max(2000),kind:z.enum(["LIVE","DEMO"]).default("LIVE")}).parse(input);(current.client.websiteChanges??=[]).push({...v,id:randomUUID()});return {ok:true};}
  throw new Error('지원하지 않는 작업');
 });return NextResponse.json(result);
}catch(e){return failure(e);}}


