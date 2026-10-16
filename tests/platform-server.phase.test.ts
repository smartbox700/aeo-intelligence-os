import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {NextRequest} from 'next/server';
import {prisma,saveProject} from '../src/lib/db';
import {createSession,publicStaff} from '../src/lib/auth';
import {platformHttpHandler,createPlatformHttpHandler} from '../src/lib/platform-intelligence/server/http';
import {PlatformApplicationService} from '../src/lib/platform-intelligence/server/service';
import {PostgresPlatformIntelligenceRepository} from '../src/lib/platform-intelligence/persistence';
import {observationProject} from './platform-observation.fixture';
import {fact} from './platform-knowledge.fixture';

const enabled={storageMode:'postgres',enabled:'true',persistenceEnabled:'true'};
it.skipIf(!process.env.AEO_PI_SERVER_PHASE)('real authenticated HTTP boundary, read models and restart over isolated PostgreSQL',async()=>{
 if(!new URL(process.env.DATABASE_URL!).pathname.startsWith('/aeo_restore_test_')||process.env.AEO_STAGE8_ISOLATED!=='1')throw Error('Isolated database required');
 const manifest=process.env.AEO_PI_SERVER_MANIFEST!,repo=new PostgresPlatformIntelligenceRepository(prisma,enabled);
 async function request(parts:string[],token?:string,body?:unknown,extra:Record<string,string>={},handler=platformHttpHandler){const req=new NextRequest('http://127.0.0.1:3100/api/platform-intelligence/'+parts.join('/'),{method:body===undefined?'GET':'POST',headers:{host:'127.0.0.1:3100',...(token?{cookie:'aeo_session='+token}:{}),...(body===undefined?{}:{origin:'http://127.0.0.1:3100','content-type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});const response=await handler(req,{params:Promise.resolve({segments:parts})});return {status:response.status,value:await response.json(),headers:response.headers};}
 async function login(role:string,projectIds:string[]=[]){const id=randomUUID(),user=await prisma.staffUser.create({data:{id,namespace:process.env.AEO_AUTH_NAMESPACE??'local',username:'pi89-'+id,name:'PRIVATE_STAFF_SENTINEL',passwordHash:'DISABLED_TEST_HASH',role,projectIds,disabled:false}});return {id,token:await createSession(publicStaff(user))};}
 try{
 if(process.env.AEO_PI_SERVER_PHASE==='WRITE'){
  const ids={a:randomUUID(),b:randomUUID()};for(const [name,id]of Object.entries(ids)){const p=observationProject();p.id=id;p.client.id=randomUUID();p.client.name='PRIVATE_CLIENT_'+name;p.questions[0].id=randomUUID();p.responses[0].id=randomUUID();p.responses[0].questionId=p.questions[0].id;p.responses[0].consumer!.projectId=id;p.responses[0].rawText='PRIVATE_RAW_'+name;p.tasks=[];p.audits=[];p.reports=[];p.salesReports=[];p.pilotReports=[];await prisma.$transaction(tx=>saveProject(tx,p));}
  const owner=await login('OWNER'),manager=await login('MANAGER',[ids.a]),analyst=await login('ANALYST',[ids.a]),viewer=await login('VIEWER',[ids.a]);
  expect((await request(['catalog'])).status).toBe(401);expect((await request(['catalog'],viewer.token)).status).toBe(403);
  const state=await request(['projects',ids.a,'overview'],manager.token);expect(state.status).toBe(200);expect(state.headers.get('cache-control')).toContain('no-store');expect(state.value.platforms).toHaveLength(6);for(const platform of state.value.platforms)expect(platform.readiness).toMatchObject({status:'NOT_CONFIGURED',score:null,lowerBound:null,upperBound:null,notProbability:true,notOfficialPlatformScore:true});
  expect((await request(['projects',ids.b,'overview'],manager.token)).value.error.code).toBe('PROJECT_ACCESS_DENIED');
  const hidden={...fact(),knowledgeId:'SYNTHETIC_MUST_NOT_LEAK',knowledgeType:'HYPOTHESIS' as const,claim:'SYNTHETIC TEST ONLY; not a platform fact'};await repo.write(owner,'SYNTHETIC',0,{actorId:owner.id,createdAt:new Date().toISOString(),reason:'SYNTHETIC isolation fixture only'},s=>s.knowledge.createDraft(hidden,{actorId:owner.id,createdAt:new Date().toISOString(),reason:'SYNTHETIC only'}));
  for(const resource of ['overview','observations','readiness','action-candidates','executions','experiments']){const r=await request(['projects',ids.a,resource],analyst.token);expect(r.status).toBe(200);const json=JSON.stringify(r.value);for(const forbidden of ['PRIVATE_RAW','PRIVATE_CLIENT','PRIVATE_STAFF','inputKey','storageName','sessionToken','proof','lineage','SYNTHETIC_MUST_NOT_LEAK'])expect(json).not.toContain(forbidden);}
  expect((await request(['projects',ids.a,'platforms','CHATGPT'],manager.token)).status).toBe(200);
  expect((await request(['insights'],owner.token)).value.items).toEqual([]);expect((await request(['insights'],manager.token)).status).toBe(403);
  const beforeCounts=await prisma.$queryRawUnsafe<{n:number}[]>('SELECT count(*)::int n FROM "PlatformIntelligenceRecord" WHERE environment=\'PRODUCTION\'');expect(beforeCounts[0].n).toBe(0);
  const at=new Date(Date.now()-60000).toISOString(),draft={...fact(),knowledgeId:'PI89_HYPOTHESIS_TEST_ONLY',knowledgeType:'HYPOTHESIS',claim:'Generated contract test hypothesis; not an official platform fact',provenance:{sourceType:'MANUAL_RESEARCH',sourceReference:'GENERATED_TEST_ONLY',capturedAt:at,evidenceRefs:[]},validity:{validFrom:at,lastVerifiedAt:at,reviewDueAt:new Date(Date.now()+86400000).toISOString(),expiresAt:new Date(Date.now()+2*86400000).toISOString()}};
  const create={operation:'KNOWLEDGE_CREATE',expectedRevision:0,reason:'Generated isolated contract test only',data:draft};
  expect((await request(['knowledge'],owner.token,create,{origin:'https://attacker.invalid'})).status).toBe(403);
  expect((await request(['knowledge'],owner.token,create,{origin:''})).status).toBe(403);
  for(const key of ['actorId','role','authorizedProjectIds','environment','checkedAt','cutoffAt','sourceState','consentState'])expect((await request(['knowledge'],owner.token,{...create,[key]:'FORGED'})).status).toBe(400);
  expect((await request(['knowledge'],owner.token,{...create,reason:'X'.repeat(66000)})).status).toBe(400);
  expect((await request(['knowledge'],manager.token,create)).status).toBe(403);expect((await request(['knowledge'],analyst.token,create)).status).toBe(403);
  expect((await request(['knowledge'],owner.token,create)).value).toMatchObject({revision:1,result:{id:draft.knowledgeId,reviewStatus:'DRAFT'}});
  expect((await request(['knowledge'],analyst.token)).value.items).toEqual([]);
  const transition=(operation:string,expectedRevision:number)=>({operation,expectedRevision,reason:'Generated isolated approval test',id:draft.knowledgeId,version:1});
  expect((await request(['knowledge'],owner.token,transition('KNOWLEDGE_SUBMIT',1))).value.revision).toBe(2);
  expect((await request(['knowledge'],manager.token,transition('KNOWLEDGE_APPROVE',2))).status).toBe(403);
  expect((await request(['knowledge'],owner.token,transition('KNOWLEDGE_APPROVE',2))).value.revision).toBe(3);
  expect((await request(['knowledge'],analyst.token)).value.items).toHaveLength(1);
  expect((await request(['knowledge'],owner.token,{...create,expectedRevision:3})).value.error.code).toBe('REVISION_CONFLICT');
  expect((await request(['knowledge'],owner.token,transition('KNOWLEDGE_APPROVE',0))).value.error.code).toBe('REVISION_CONFLICT');
  const events=await prisma.$queryRawUnsafe<{createdBy:string;details:{command:{operation:string;targetDomain:string;stableId:string}}}[]>('SELECT "createdBy",details FROM "PlatformIntelligenceAuditEvent" WHERE environment=\'PRODUCTION\' ORDER BY revision');expect(events[2]).toMatchObject({createdBy:owner.id,details:{command:{operation:'KNOWLEDGE_APPROVE',targetDomain:'KNOWLEDGE',stableId:draft.knowledgeId}}});
  const current=await repo.read(owner,'PRODUCTION',s=>s.project(ids.a));const responseId=current.responses[0].id;
  const capture={operation:'OBSERVATION_CAPTURE',expectedRevision:3,reason:'Generated project boundary test',responseId};
  expect((await request(['projects',ids.b,'observations'],owner.token,capture)).status).toBe(404);
  expect((await request(['projects',ids.b,'observations'],manager.token,capture)).status).toBe(403);
  const oldMode=process.env.STORAGE_MODE,oldFlag=process.env.PLATFORM_INTELLIGENCE_ENABLED;try{process.env.PLATFORM_INTELLIGENCE_ENABLED='false';expect((await request(['catalog'],owner.token)).value.error.code).toBe('FEATURE_DISABLED');process.env.PLATFORM_INTELLIGENCE_ENABLED='true';process.env.STORAGE_MODE='file';expect((await request(['catalog'],owner.token)).value.error.code).toBe('PERSISTENCE_UNAVAILABLE');}finally{process.env.STORAGE_MODE=oldMode;process.env.PLATFORM_INTELLIGENCE_ENABLED=oldFlag;}
  await prisma.$executeRawUnsafe('ALTER TABLE "PlatformIntelligenceRecord" RENAME TO "PI89_SchemaUnavailableTest"');try{const r=await request(['catalog'],owner.token);expect(r.status).toBe(503);expect(r.value.error.code).toBe('PERSISTENCE_SCHEMA_UNAVAILABLE');expect((await prisma.$queryRawUnsafe<{missing:boolean}[]>('SELECT to_regclass(\'public."PlatformIntelligenceRecord"\') IS NULL AS missing'))[0].missing).toBe(true);}finally{await prisma.$executeRawUnsafe('ALTER TABLE "PI89_SchemaUnavailableTest" RENAME TO "PlatformIntelligenceRecord"');}
  await prisma.staffUser.update({where:{id:manager.id},data:{disabled:true}});expect((await request(['catalog'],manager.token)).status).toBe(401);
  await prisma.staffUser.update({where:{id:analyst.id},data:{projectIds:[ids.b]}});expect((await request(['projects',ids.a,'overview'],analyst.token)).status).toBe(403);
  const knowledge=(await request(['knowledge'],owner.token)).value,overview=(await request(['projects',ids.a,'overview'],owner.token)).value;
  // Tokens are created again in Process B; no credential is stored in the manifest.
  await writeFile(manifest,JSON.stringify({ownerId:owner.id,projectId:ids.a,knowledge,platforms:overview.platforms.map((p:{platformCode:string;readiness:{status:string;score:null}})=>({code:p.platformCode,status:p.readiness.status,score:p.readiness.score}))}));
  let limited=false;for(let i=0;i<35;i++){const r=await request(['knowledge'],owner.token,transition('KNOWLEDGE_APPROVE',0));if(r.status===429){limited=true;break;}}expect(limited).toBe(true);
 }else{
  const old=JSON.parse(await readFile(manifest,'utf8')),user=await prisma.staffUser.findUniqueOrThrow({where:{id:old.ownerId}}),token=await createSession(publicStaff(user));
  expect((await request(['knowledge'],token)).value).toEqual(old.knowledge);const overview=(await request(['projects',old.projectId,'overview'],token)).value;expect(overview.platforms.map((p:{platformCode:string;readiness:{status:string;score:null}})=>({code:p.platformCode,status:p.readiness.status,score:p.readiness.score}))).toEqual(old.platforms);
 }
 }finally{await prisma.$disconnect();}
},120000);
