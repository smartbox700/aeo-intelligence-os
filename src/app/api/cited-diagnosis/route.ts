import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {requireStaff,assertProjectAccess,sameOrigin,accessEvent,grantCreatedProject,failure} from '@/lib/auth';
import {getStore,mutate} from '@/lib/store';
import {ownedProject} from '@/lib/measurement-service';
import {diagnosisSchema} from '@/lib/cited-diagnosis';
import {attachDiagnosis} from '@/lib/cited-project';
import type {ProjectData} from '@/lib/types';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const user=await requireStaff(req);const id=req.nextUrl.searchParams.get('projectId')??'';assertProjectAccess(user,id);const p=ownedProject(await getStore(),id);await accessEvent(user,'CITED 진단 조회',id);return NextResponse.json({projectId:id,name:p.client.name,profile:{brand:p.client.name,region:p.client.address.slice(0,100),service:p.client.services.slice(0,100),count:10},snapshot:p.client.citedDiagnoses?.at(-1)??null},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{
 const user=await requireStaff(req,['OWNER','MANAGER']);sameOrigin(req);const raw=await req.text();if(Buffer.byteLength(raw)>6000000)throw new Error('진단은 6MB 이내로 입력하세요.');const input=JSON.parse(raw);const data=diagnosisSchema.parse(input.data);const create=input.projectId===null;const projectId=create?randomUUID():String(input.projectId);if(!create)assertProjectAccess(user,projectId);
 const result=await mutate(s=>{let p:ProjectData;if(create){const now=new Date().toISOString();p={id:projectId,organizationId:'local-org',name:data.profile.brand,client:{id:randomUUID(),name:data.profile.brand,aliases:[],website:'',industry:'',address:data.profile.region,bookingUrl:'',services:data.profile.service,experts:'',competitors:[],createdAt:now},questions:[],responses:[],audits:[],tasks:[]};s.projects.push(p);}else p=ownedProject(s,projectId);const snapshot=attachDiagnosis(p,data,user.id);return {projectId,snapshotId:snapshot.id,responseCount:snapshot.responseIds.length};});
 if(create)await grantCreatedProject(user,projectId);await accessEvent(user,'CITED 진단 저장',projectId);return NextResponse.json(result);
 }catch(e){return failure(e);}}
