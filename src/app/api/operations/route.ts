import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {getStore,mutate} from '@/lib/store';
import {ownedProject} from '@/lib/measurement-service';
import {requireStaff,assertProjectAccess,allowedProjects,safeWorkspaceProject,accessEvent,grantCreatedProject,failure,sameOrigin} from '@/lib/auth';
import {onboard,requireOperations,salesInput,workflowChecks,moveStage,propose,editProposal,approveProposal,updateExecution,money} from '@/lib/operations';
import {INDUSTRIES,STAGES} from '@/lib/operations-config';
import {operationsDashboard,financeMetrics} from '@/lib/operations-metrics';
import {createClientReport} from '@/lib/client-report';
import {clientSchema} from '@/lib/validation';
import {profileQuestions} from '@/lib/operations-questions';
import type {ProjectData} from '@/lib/types';
import {checkSalesStage,transitionPilotSales} from '@/lib/pilot-sales';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const user=await requireStaff(req);const all=allowedProjects(user,(await getStore()).projects);const id=req.nextUrl.searchParams.get('projectId');if(id){assertProjectAccess(user,id);const p=all.find(p=>p.id===id);if(!p)throw new Error('프로젝트 없음');await accessEvent(user,'고객사 운영 자료 조회',id);return NextResponse.json({project:safeWorkspaceProject(p,user),checks:p.operations?workflowChecks(p):null},{headers:{'Cache-Control':'no-store'}});}await accessEvent(user,'운영 관제실 조회');return NextResponse.json({projects:all.map(p=>safeWorkspaceProject(p,user)),summary:operationsDashboard(all),finance:user.role==='OWNER'?all.map(p=>({id:p.id,...financeMetrics(p)})):null,user},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{const user=await requireStaff(req);sameOrigin(req);const text=await req.text();if(Buffer.byteLength(text)>150000)throw new Error('요청 크기 제한');const input=JSON.parse(text);
 if(['create','onboarding','stage','start-project','bind-study','approval','execution','report-approval','traffic'].includes(input.action))await requireStaff(req,['OWNER','MANAGER']);if(['sales','invoice','cost'].includes(input.action))await requireStaff(req,['OWNER']);if(input.action!=='create')assertProjectAccess(user,String(input.projectId));
 const result=await mutate(s=>{
  if(input.action==='create'){const c=clientSchema.parse(input.client),id=randomUUID();const p:ProjectData={id,organizationId:'local-org',name:c.name,client:{...c,id:randomUUID(),createdAt:new Date().toISOString(),competitors:c.competitors.map(c=>({...c,id:randomUUID()}))},questions:[],responses:[],audits:[],tasks:[],reports:[]};onboard(p,input.onboarding);s.projects.push(p);return {projectId:id};}
  const p=ownedProject(s,z.string().parse(input.projectId));
  if(input.action==='onboarding'){onboard(p,input.onboarding);return {ok:true};}
  const o=requireOperations(p);
  if(input.action==='start-project'){if(!p.questions.length)p.questions=profileQuestions(p);moveStage(p,'BASELINE_PENDING',user,'기초 정보·업종 질문 확인 후 AEO 업무 시작');return {ok:true};}
  if(input.action==='profile-questions'){const questions=profileQuestions(p);const fresh=questions.filter(q=>!p.questions.some(old=>old.text===q.text));p.questions.push(...fresh);return {added:fresh.length};}
  if(input.action==='sales'){const sales=salesInput.parse(input.sales);if(o.pilot){if(sales.contractStatus!==o.sales.contractStatus||sales.contractRevenue!==o.sales.contractRevenue||sales.contractStart!==o.sales.contractStart||sales.contractEnd!==o.sales.contractEnd)throw new Error('Pilot 계약 조건은 계약 전환에서 확인하세요.');}if(sales.stage!==o.sales.stage){checkSalesStage(p,sales.stage);transitionPilotSales(p,{stage:sales.stage,note:'영업·계약 관리에서 담당자 상태 변경'},user);}o.sales=sales;if(o.pilot)o.pilot.revision++;return {ok:true};}
  if(input.action==='bind-study'){const id=z.string().parse(input.studyId);const study=p.client.researchStudies?.find(s=>s.id===id);if(!study||study.kind!==(o.kind==='DEMO'?'DEMO':'CONSUMER_UI_MANUAL'))throw new Error('이 고객 유형에 맞는 프로젝트 측정 계획을 선택하세요.');o.workflow.studyId=id;o.workflow.owner=z.string().trim().max(100).parse(input.owner);return {ok:true};}
  if(input.action==='stage'){moveStage(p,z.enum(STAGES as [typeof STAGES[number],...typeof STAGES[number][]]).parse(input.stage),user,z.string().parse(input.note));return {ok:true};}
  if(input.action==='proposal')return {proposalId:propose(p,input.proposal,user).id};
  if(input.action==='proposal-edit'){editProposal(p,input.proposal,user);return {ok:true};}
  if(input.action==='approval'){approveProposal(p,input.approval,user);return {ok:true};}
  if(input.action==='execution'){updateExecution(p,input.task,user);return {ok:true};}
  if(input.action==='worklog'){const v=z.object({taskId:z.string(),minutes:z.number().int().min(1).max(1440),hourlyCost:money,at:z.iso.datetime(),note:z.string().trim().min(5).max(2000)}).parse(input.log);if(user.role!=='OWNER'&&v.hourlyCost!==null)throw new Error('원가 단가는 OWNER만 등록할 수 있습니다.');const t=p.tasks.find(t=>t.id===v.taskId&&t.execution);if(!t)throw new Error('작업 소속 오류');t.execution!.workLogs.push({...v,id:randomUUID(),actorId:user.id});return {ok:true};}
  if(input.action==='invoice'){const v=z.object({id:z.string().optional(),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),amount:money,paid:money,status:z.enum(['DRAFT','ISSUED','PARTIAL','PAID']),note:z.string().trim().max(2000)}).parse(input.invoice);if(v.status==='PAID'&&(v.amount===null||v.paid===null||v.paid<v.amount))throw new Error('입금 완료에는 확인한 청구·입금액이 필요합니다.');if(v.id){const old=o.finance.invoices.find(r=>r.id===v.id);if(!old)throw new Error('청구 기록 소속 오류');(old.history??=[]).push({at:new Date().toISOString(),actorId:user.id,note:v.note,previous:{month:old.month,amount:old.amount,paid:old.paid,status:old.status,note:old.note}});Object.assign(old,v);}else o.finance.invoices.push({...v,id:randomUUID()});return {ok:true};}
  if(input.action==='cost'){const v=z.object({id:z.string().optional(),at:z.iso.datetime(),type:z.enum(['EXTERNAL_SERVICE','CONTENT','OUTSOURCING','API','OTHER']),amount:money,note:z.string().trim().max(2000)}).parse(input.cost);if(v.id){const old=o.finance.costs.find(r=>r.id===v.id);if(!old)throw new Error('원가 기록 소속 오류');(old.history??=[]).push({at:new Date().toISOString(),actorId:user.id,note:v.note,previous:{at:old.at,type:old.type,amount:old.amount,note:old.note}});Object.assign(old,v);}else o.finance.costs.push({...v,id:randomUUID()});return {ok:true};}
  if(input.action==='traffic'){const count=z.number().int().min(0).max(1000000000).nullable();const v=z.object({at:z.iso.datetime(),kind:z.enum(['CLIENT','DEMO']),method:z.string().trim().min(2).max(200),evidence:z.string().trim().min(5).max(2000),verified:z.boolean(),visits:count,consultations:count,bookings:count,purchases:count}).parse(input.record);if(v.kind!==o.kind)throw new Error('실제/DEMO 전환 자료를 혼합할 수 없습니다.');o.traffic.push({...v,id:randomUUID()});return {ok:true};}
  if(input.action==='report'){const report=createClientReport(p,input.report,user);return {reportId:report.id};}
  if(input.action==='report-approval'){const v=z.object({reportId:z.string(),note:z.string().trim().min(5).max(2000)}).parse(input);const r=p.reports?.find(r=>r.id===v.reportId);if(!r)throw new Error('보고서 소속 오류');if(r.kind!=='DEMO'&&r.reporting?.purpose!=='EXTERNAL_CONFIRMED')throw new Error('이전 보고서는 내부 보존용입니다. 검증 게이트를 적용한 새 보고서를 생성하세요.');if(r.status==='APPROVED')throw new Error('최종 승인된 버전은 변경할 수 없습니다. 새 보고서를 생성하세요.');r.status='APPROVED';r.approvedBy=user.id;r.approvedAt=new Date().toISOString();r.approvalNote=v.note;return {ok:true};}
  throw new Error('운영 작업 오류');
 });if(input.action==='create'&&'projectId' in result&&result.projectId)await grantCreatedProject(user,result.projectId);await accessEvent(user,'운영 저장:'+String(input.action),input.projectId??('projectId' in result?result.projectId:undefined));return NextResponse.json(result);
 }catch(e){return failure(e);}}
