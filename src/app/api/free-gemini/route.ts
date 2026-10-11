import {requireStaff,assertProjectAccess,allowedProjects,safeWorkspaceProject,grantCreatedProject,accessEvent,failure} from '@/lib/auth';
import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getStore,mutate} from '@/lib/store';
import {ownedProject} from '@/lib/measurement-service';
import {freeGeminiConfig,verifyFreeGeminiTier} from '@/lib/gemini-provider';
export const runtime='nodejs';export const dynamic='force-dynamic';
/** Readiness endpoint only. Account proof connector is deliberately required before enabling execution. */
export async function POST(req:NextRequest){try{const user=await requireStaff(req);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'다른 출처 요청 차단'},{status:403});
 const v=z.object({projectId:z.string(),approved:z.literal(true)}).parse(await req.json());assertProjectAccess(user,v.projectId);await accessEvent(user,'무료 API 준비 점검',v.projectId);ownedProject(await getStore(),v.projectId);
 const c=freeGeminiConfig();const proof=await verifyFreeGeminiTier();const reason=!c.enabled?'FREE_GEMINI_ENABLED=false: 무료 API 비활성':!c.keyConfigured?'GEMINI_API_KEY 미설정':!proof.verified?proof.reason:'무료 계정 검증 이후 실행 연결을 검토해야 합니다.';
 await mutate(s=>{const p=ownedProject(s,v.projectId);const attempts=p.client.freeGeminiAttempts??=[];if(attempts.length>=1000)throw new Error('실행 준비 점검 기록 제한');attempts.push({id:randomUUID(),at:new Date().toISOString(),status:'BLOCKED',networkCalls:0,usage:null,error:reason});});
 return NextResponse.json({error:reason,networkCalls:0,status:'BLOCKED'},{status:400});
 }catch(e){return NextResponse.json({error:(e as Error).message,networkCalls:0},{status:400});}}
