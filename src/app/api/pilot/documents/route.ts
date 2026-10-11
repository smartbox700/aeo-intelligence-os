import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireStaff,assertProjectAccess,sameOrigin,failure,accessEvent} from '@/lib/auth';
import {getStore,mutate} from '@/lib/store';
import {ownedProject} from '@/lib/measurement-service';
import {readPilotRepo,pilotRepo,assertRepositorySize} from '@/lib/pilot-common';
import {writePilotDocument,readPilotDocument,removePilotDocument} from '@/lib/pilot-documents';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const user=await requireStaff(req,['OWNER','MANAGER']),projectId=req.nextUrl.searchParams.get('projectId')??'';assertProjectAccess(user,projectId);const p=ownedProject(await getStore(),projectId),d=readPilotRepo(p).documents.find(d=>d.id===req.nextUrl.searchParams.get('id')&&d.projectId===projectId);if(!d)throw new Error('문서 소속 오류');if(d.kind==='CONTRACT')await requireStaff(req,['OWNER']);await accessEvent(user,'Pilot 문서 다운로드',projectId);return new NextResponse(new Uint8Array(await readPilotDocument(d)),{headers:{'Content-Type':d.mime,'Content-Disposition':'attachment; filename="pilot-document"; filename*=UTF-8\'\''+encodeURIComponent(d.filename),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{
 const user=await requireStaff(req,['OWNER','MANAGER']);sameOrigin(req);const bytes=await req.arrayBuffer();if(bytes.byteLength>5200000)throw new Error('문서 요청 크기 제한');const form=await new Request(req.url,{method:'POST',headers:{'Content-Type':req.headers.get('content-type')??''},body:bytes}).formData();
 const v=z.object({projectId:z.uuid(),expectedRevision:z.coerce.number().int().min(0),kind:z.enum(['AGREEMENT','CONSENT','APPROVAL','APPLICATION','CONTRACT']),sensitiveDataExcluded:z.literal('true')}).parse(Object.fromEntries(['projectId','expectedRevision','kind','sensitiveDataExcluded'].map(k=>[k,form.get(k)])));
 assertProjectAccess(user,v.projectId);if(v.kind==='CONTRACT')await requireStaff(req,['OWNER']);ownedProject(await getStore(),v.projectId);const file=form.get('file');if(!(file instanceof File))throw new Error('문서를 선택하세요.');const d={...await writePilotDocument(Buffer.from(await file.arrayBuffer()),file.name),projectId:v.projectId,kind:v.kind,sensitiveDataExcluded:true as const,at:new Date().toISOString(),actorId:user.id};
 try{await mutate(s=>{const p=ownedProject(s,v.projectId),repo=pilotRepo(p);if(repo.revision!==v.expectedRevision)throw new Error('문서 저장 충돌 · 최신 화면을 조회하세요.');repo.documents.push(d);repo.revision++;assertRepositorySize(p);});}catch(e){await removePilotDocument(d);throw e;}
 await accessEvent(user,'Pilot 문서 등록',v.projectId);return NextResponse.json({id:d.id});
}catch(e){return failure(e);}}
