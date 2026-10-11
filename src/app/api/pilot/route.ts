import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireStaff,assertProjectAccess,allowedProjects,accessEvent,failure,sameOrigin} from '@/lib/auth';
import {getStore,mutate} from '@/lib/store';
import {ownedProject} from '@/lib/measurement-service';
import {getSalesBrand} from '@/lib/sales-brand';
import {dispatchPilot,pilotState,agreementDraftHtml} from '@/lib/pilot-engine';
import {pilotDashboard} from '@/lib/pilot-dashboard';
import {outcomeForDisplay} from '@/lib/pilot-report';
import {paidProposalHtml} from '@/lib/pilot-sales';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(req:NextRequest){try{
 const user=await requireStaff(req,['OWNER','MANAGER']);
 const store=await getStore(),projectId=req.nextUrl.searchParams.get('projectId');
 if(!projectId){const all=allowedProjects(user,store.projects);const summarize=(kind:'CLIENT'|'DEMO')=>{const d=pilotDashboard(all,kind);return user.role==='OWNER'?d:{kind:d.kind,summary:d.summary,warning:d.warning};};return NextResponse.json({client:summarize('CLIENT'),demo:summarize('DEMO')},{headers});}
 assertProjectAccess(user,projectId);const p=ownedProject(store,projectId);
 await accessEvent(user,'Pilot 조회',projectId);
 const format=req.nextUrl.searchParams.get('format'),id=req.nextUrl.searchParams.get('id');
 if(format&&id){let html='';const brand=await getSalesBrand();
  if(format==='AGREEMENT')html=agreementDraftHtml(p,id,brand,user);
  else if(format==='OUTCOME'){const r=p.pilotReports?.find(r=>r.id===id&&r.projectId===p.id&&r.clientId===p.client.id);if(!r)throw new Error('보고서 소속 오류');html=outcomeForDisplay(p,r);}
  else if(format==='PROPOSAL'){if(user.role!=='OWNER')throw new Error('계약 제안은 OWNER 전용입니다.');html=paidProposalHtml(p,id,brand);}
  else throw new Error('지원하지 않는 문서');
  return new NextResponse(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"}});
 }
 return NextResponse.json(pilotState(p,user),{headers});
}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{
 const user=await requireStaff(req,['OWNER','MANAGER']);sameOrigin(req);
 const raw=await req.text();if(Buffer.byteLength(raw)>200000)throw new Error('Pilot 요청 크기 제한');
 const v=z.object({projectId:z.uuid(),action:z.string().max(40),input:z.unknown(),expectedRevision:z.number().int().min(0)}).strict().parse(JSON.parse(raw));
 assertProjectAccess(user,v.projectId);const brand=await getSalesBrand();
 const result=await mutate(s=>dispatchPilot(ownedProject(s,v.projectId),v.action,v.input,user,v.expectedRevision,brand));
 await accessEvent(user,'Pilot 저장:'+v.action,v.projectId);
 return NextResponse.json({revision:result.revision},{headers});
}catch(e){return failure(e);}}
