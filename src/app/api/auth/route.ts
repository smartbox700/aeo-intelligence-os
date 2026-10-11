import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {namespace,sessionUser,publicStaff,hashPassword,verifyPassword,createSession,destroySession,sessionCookie,requireStaff,sameOrigin,failure,accessEvent,ROLES} from '@/lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const credentials=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,60}$/),password:z.string().min(12).max(200)});
export async function GET(req:NextRequest){try{const user=await sessionUser(req.cookies.get('aeo_session')?.value);return NextResponse.json({user,setupRequired:await prisma.staffUser.count({where:{namespace:namespace()}})===0},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{sameOrigin(req);const text=await req.text();if(Buffer.byteLength(text)>15000)throw new Error('입력 크기 제한');const input=JSON.parse(text);
 if(input.action==='logout'){const user=await sessionUser(req.cookies.get('aeo_session')?.value);await destroySession(req.cookies.get('aeo_session')?.value);if(user)await accessEvent(user,'로그아웃');const res=NextResponse.json({ok:true});res.cookies.set('aeo_session','',{path:'/',httpOnly:true,sameSite:'strict',maxAge:0});return res;}
 if(input.action==='setup'||input.action==='login'){
  const v=credentials.parse(input);let user;
  if(input.action==='setup'){const name=z.string().trim().min(2).max(100).parse(input.name);const passwordHash=await hashPassword(v.password);user=await prisma.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(742911)`;if(await tx.staffUser.count({where:{namespace:namespace()}}))throw new Error('최초 OWNER가 이미 등록되어 있습니다. 로그인하세요.');return tx.staffUser.create({data:{id:randomUUID(),namespace:namespace(),username:v.username,name,role:'OWNER',projectIds:[],passwordHash}});});}
  else{const failed=await prisma.accessEvent.count({where:{namespace:namespace(),action:'로그인 실패',success:false,at:{gte:new Date(Date.now()-15*60000)}}});if(failed>=15)throw new Error('로그인 시도 제한. 15분 후 다시 시도하세요.');user=await prisma.staffUser.findUnique({where:{namespace_username:{namespace:namespace(),username:v.username}}});const valid=user?await verifyPassword(v.password,user.passwordHash):await verifyPassword(v.password,await hashPassword(randomUUID()));if(!user||user.disabled||!valid){await accessEvent(null,'로그인 실패',undefined,false);return NextResponse.json({error:'아이디 또는 비밀번호를 확인하세요.'},{status:401});}}
  const staff=publicStaff(user);await accessEvent(staff,input.action==='setup'?'최초 OWNER 등록':'로그인');return sessionCookie(NextResponse.json({user:staff}),await createSession(staff),req);
 }
 const owner=await requireStaff(req,['OWNER']);
 if(input.action==='users'){const users=await prisma.staffUser.findMany({where:{namespace:namespace()},orderBy:{createdAt:'asc'}});return NextResponse.json({users:users.map(publicStaff),events:await prisma.accessEvent.findMany({where:{namespace:namespace()},orderBy:{at:'desc'},take:100})},{headers:{'Cache-Control':'no-store'}});}
 if(input.action==='user'){
  const v=z.object({id:z.string().optional(),username:credentials.shape.username,name:z.string().trim().min(2).max(100),role:z.enum(ROLES),projectIds:z.array(z.string()).max(500),disabled:z.boolean().default(false),password:z.string().min(12).max(200).optional()}).parse(input.user);
  const projects=await prisma.project.findMany({where:{organizationId:'local-org',id:{in:v.projectIds}}});if(projects.length!==new Set(v.projectIds).size)throw new Error('프로젝트 권한 목록 오류');
  if(v.id){const old=await prisma.staffUser.findFirst({where:{id:v.id,namespace:namespace()}});if(!old)throw new Error('직원 소속 오류');if(v.id===owner.id&&(v.disabled||v.role!=='OWNER'))throw new Error('자신의 OWNER 접근은 해제할 수 없습니다.');await prisma.staffUser.update({where:{id:v.id},data:{name:v.name,role:v.role,projectIds:[...new Set(v.projectIds)],disabled:v.disabled,passwordHash:v.password?await hashPassword(v.password):undefined}});await prisma.staffSession.deleteMany({where:{userId:v.id}});}
  else{if(!v.password)throw new Error('새 직원 비밀번호가 필요합니다.');await prisma.staffUser.create({data:{id:randomUUID(),namespace:namespace(),username:v.username,name:v.name,role:v.role,projectIds:[...new Set(v.projectIds)],disabled:v.disabled,passwordHash:await hashPassword(v.password)}});}
  await accessEvent(owner,'직원 권한·계정 수정');return NextResponse.json({ok:true});
 }throw new Error('인증 작업 오류');
 }catch(e){return failure(e);}}
