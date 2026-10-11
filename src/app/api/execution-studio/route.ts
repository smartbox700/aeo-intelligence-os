import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getStore,mutate} from '@/lib/store';
import {requireStaff,assertProjectAccess,safeWorkspaceProject,accessEvent,sameOrigin,failure} from '@/lib/auth';
import {ownedProject} from '@/lib/measurement-service';
import {saveStudioFact,studioRepo,effectiveFactStatus} from '@/lib/studio-facts';
import {FACT_FIELDS,STUDIO_LABELS,STUDIO_GUIDES} from '@/lib/studio-config';
import {assertTarget,parseStudioPage,inspectStudioPage,demoPageHtml} from '@/lib/studio-page';
import {attachStudioPage,createStudioWork,currentStudio,editStudioDraft,advanceStudio,verifyStudioDeployment,invalidateStudioFacts,prepareStudioDemo,draftProblems} from '@/lib/studio-workflow';
import {renderStudioHtml,studioDeliveryFiles,zipDelivery,deliveryHash} from '@/lib/studio-export';
import {validateStudioSchema} from '@/lib/studio-schema';
import {reserveWebsiteInspection} from '@/lib/website-limits';
import type {PageSnapshot} from '@/lib/studio-types';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const user=await requireStaff(req),id=z.string().min(1).parse(req.nextUrl.searchParams.get('projectId'));assertProjectAccess(user,id);const p=ownedProject(await getStore(),id);await accessEvent(user,'실행 스튜디오 조회',id);
 const preview=req.nextUrl.searchParams.get('preview');if(preview){const {version}=currentStudio(p,preview);return new NextResponse(renderStudioHtml(version.draft,p.operations?.kind==='DEMO'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"}});}
 return NextResponse.json({project:safeWorkspaceProject(p,user),factFields:FACT_FIELDS,states:STUDIO_LABELS,guides:STUDIO_GUIDES,factStatuses:(p.client.studioRepository?.facts??[]).map(f=>({id:f.id,status:effectiveFactStatus(f)})),workChecks:p.tasks.filter(t=>t.studio).map(t=>{const c=currentStudio(p,t.id);return {taskId:t.id,problems:draftProblems(p,c.page,c.version.draft),schema:validateStudioSchema(p,c.page,c.version.draft)};})},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{const user=await requireStaff(req);sameOrigin(req);if(Number(req.headers.get('content-length')??0)>200000)throw new Error('요청 200KB 제한');const raw=await req.text();if(Buffer.byteLength(raw)>200000)throw new Error('요청 200KB 제한');const input=JSON.parse(raw),id=z.string().min(1).parse(input.projectId);assertProjectAccess(user,id);
 const action=z.enum(['demo-init','fact','inspect','demo-page','manual-page','create','edit','regenerate','internal-review','approval','ready','export','deploy','verify','followup','complete']).parse(input.action);
 if(!['create','edit','regenerate'].includes(action))await requireStaff(req,['OWNER','MANAGER']);
 const source=ownedProject(await getStore(),id);let page:PageSnapshot|undefined;
 if(action==='inspect'||action==='verify'){
  const work=action==='verify'?currentStudio(source,z.string().parse(input.taskId)):null;if(work&&work.version.version!==input.expectedVersion)throw new Error('최신 버전으로 다시 조회하세요.');
  if(action==='verify'&&source.operations?.kind==='DEMO'){if(input.simulateApproved!==true)throw new Error('DEMO 시뮬레이션을 명시하세요. 실제 사이트를 수정하거나 읽지 않습니다.');page=parseStudioPage(renderStudioHtml(work!.version.draft,true),work!.page.url,'DEMO',work!.page.channel);}
  else if(action==='verify'&&work!.page.channel!=='WEBSITE'){const html=z.string().min(10).max(60000).parse(input.html);page=parseStudioPage(html,work!.page.url,'MANUAL',work!.page.channel);}
  else {if(source.operations?.kind!=='CLIENT')throw new Error('실제 고객 온보딩 후 공개 페이지를 검사하세요. DEMO는 별도 시뮬레이션을 사용하세요.');const release=reserveWebsiteInspection(id,source.client.studioRepository?.pages.filter(p=>p.kind==='LIVE').at(-1)?.at);try{page=await inspectStudioPage(source,action==='verify'?work!.page.url:z.string().parse(input.url));}finally{release();}}
 }
 if(action==='demo-page'){if(source.operations?.kind!=='DEMO')throw new Error('DEMO 고객만 시뮬레이션 페이지를 사용할 수 있습니다.');const channel=z.enum(['WEBSITE','NAVER','COUPANG']).parse(input.channel??'WEBSITE');page=parseStudioPage(demoPageHtml(source.client.name,source.operations.onboarding.profile),assertTarget(source,z.string().parse(input.url),channel),'DEMO',channel);}
 if(action==='manual-page'){if(source.operations?.kind!=='CLIENT')throw new Error('실제 커머스 고객 온보딩이 필요합니다.');const channel=z.enum(['NAVER','COUPANG']).parse(input.channel);page=parseStudioPage(z.string().min(10).max(60000).parse(input.html),assertTarget(source,z.string().parse(input.url),channel),'MANUAL',channel);}
 const result=await mutate(persisted=>{const p=ownedProject(persisted,id);if(action==='demo-init'){prepareStudioDemo(p);return {ok:true};}
  if(action==='fact'){const fact=saveStudioFact(p,input.fact,user);invalidateStudioFacts(p,fact.key,user);return {factId:fact.id};}
  if(['inspect','demo-page','manual-page'].includes(action)){if(!page)throw new Error('페이지 검사 결과 없음');assertTarget(p,page.url,page.channel);return {pageId:attachStudioPage(p,page).id};}
  if(action==='create')return {taskId:createStudioWork(p,input.work,user).id};
  const taskId=z.string().parse(input.taskId),ctx=currentStudio(p,taskId);if(ctx.version.version!==input.expectedVersion)throw new Error('수정안 버전 충돌. 최신 버전을 조회하세요.');
  if(action==='edit'||action==='regenerate'){editStudioDraft(p,taskId,input.draft,user,action==='regenerate');return {ok:true};}
  if(action==='export'){const files=studioDeliveryFiles(p,taskId),format=z.enum(['zip','html','json','markdown']).parse(input.format??'zip');const bytes=format==='zip'?zipDelivery(files):Buffer.from(format==='html'?files['03_페이지_수정초안.html']:format==='json'?files['04_구조화데이터.json']:files['02_홈페이지_수정지시서.md'],'utf8');ctx.work.exports.push({version:ctx.version.version,at:new Date().toISOString(),actorId:user.id,sha256:deliveryHash(bytes)});ctx.work.history.push({at:new Date().toISOString(),actorId:user.id,state:ctx.work.state,note:'승인된 v'+ctx.version.version+' '+format+' 내보내기 · 적용 완료 아님'});return {bytes,format};}
  if(action==='verify'){if(!page)throw new Error('검증 페이지 없음');return {checks:verifyStudioDeployment(p,taskId,page,user,String(input.evidence??''))};}
  advanceStudio(p,taskId,action,input,user);return {ok:true};
 });await accessEvent(user,'실행 스튜디오 저장:'+action,id);
 if('bytes' in result&&result.bytes){const ext=result.format==='markdown'?'md':result.format,type=result.format==='zip'?'application/zip':result.format==='html'?'text/html':result.format==='json'?'application/json':'text/markdown';return new NextResponse(new Uint8Array(result.bytes),{headers:{'Content-Type':type+'; charset=utf-8','Content-Disposition':"attachment; filename=aeo-delivery."+ext+"; filename*=UTF-8''"+encodeURIComponent('AEO_개선패키지.'+ext),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'"}});}
 return NextResponse.json(result);
 }catch(e){return failure(e);}}
