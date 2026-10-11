import {requireStaff,assertProjectAccess,allowedProjects,safeWorkspaceProject,grantCreatedProject,accessEvent,failure} from '@/lib/auth';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getStore,mutate} from '@/lib/store';
import {ownedProject} from '@/lib/measurement-service';
import {storeConsumerRows,parseConsumerImport,exportConsumerRows,exportConsumerCsv,EXPORT_FIELDS,addEvidenceQuestions} from '@/lib/consumer-observation';
import {createStudy,observationStrategy} from '@/lib/research';
import {freeGeminiConfig} from '@/lib/gemini-provider';
import {verifyObservation} from '@/lib/observation-verification';
import {confirmedMetrics} from '@/lib/reporting-metrics';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const user=await requireStaff(req); const scopeId=req.nextUrl.searchParams.get('projectId');if(scopeId)assertProjectAccess(user,scopeId); await accessEvent(user,'자료 조회:observations',scopeId??undefined);
 if(!req.nextUrl.searchParams.has('projectId'))return NextResponse.json({mode:'FREE_OBSERVATION',paidEnabled:process.env.LIVE_AI_ENABLED==='true',gemini:freeGeminiConfig()},{headers:{'Cache-Control':'no-store'}});
 const p=ownedProject(await getStore(),req.nextUrl.searchParams.get('projectId')!);const kind=z.enum(['CONSUMER_UI_MANUAL','DEMO']).parse(req.nextUrl.searchParams.get('kind')??'CONSUMER_UI_MANUAL');const csv=req.nextUrl.searchParams.get('format')==='CSV';
 if(req.nextUrl.searchParams.get('purpose')==='confirmed')return NextResponse.json(confirmedMetrics(p,{kind}),{headers:{'Cache-Control':'no-store'}});
 const data=csv?exportConsumerCsv(p,kind):JSON.stringify(exportConsumerRows(p,kind).map(row=>{const r=p.responses.find(r=>r.consumer?.inputKey===row.inputKey)!;return {...row,verification:r.verification,entityAnalysis:r.entityAnalysis,actionLinks:r.consumer?.actionLinks};}),null,2);
 return new NextResponse(data,{headers:{'Content-Type':csv?'text/csv; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="consumer-observations.'+(csv?'csv':'json')+'"','Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{const user=await requireStaff(req);
 const origin=req.headers.get('origin');if(origin&&(new URL(origin).host!==req.headers.get('host')||new URL(origin).protocol!==req.nextUrl.protocol))return NextResponse.json({error:'다른 출처의 요청은 허용되지 않습니다.'},{status:403});
 const raw=await req.text();if(Buffer.byteLength(raw)>3200000)throw new Error('입력 크기 제한 초과');const input=JSON.parse(raw);assertProjectAccess(user,String(input.projectId));if(input.action==='verification')await requireStaff(req,['OWNER','MANAGER']);await accessEvent(user,'자료 접근:observations:'+String(input.action),input.projectId);
 const result=await mutate(s=>{const p=ownedProject(s,z.string().parse(input.projectId));
  if(input.action==='save')return storeConsumerRows(p,[input.observation]);
  if(input.action==='import')return storeConsumerRows(p,parseConsumerImport(z.string().parse(input.text),z.enum(['JSON','CSV']).parse(input.format)));
  if(input.action==='questions')return {added:addEvidenceQuestions(p)};
  if(input.action==='study')return {study:createStudy(p,input.study)};
  if(input.action==='strategy')return observationStrategy(p,z.enum(['CONSUMER_UI_MANUAL','DEMO']).parse(input.kind));
  if(input.action==='verification'){verifyObservation(p,input,user.id);return {ok:true};}
  throw new Error('지원하지 않는 관측 작업');
 });return NextResponse.json(result);
 }catch(e){return failure(e);}}
