import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {NextRequest} from 'next/server';
import {prisma,saveProject} from '../src/lib/db';
import {createSession,publicStaff} from '../src/lib/auth';
import {PostgresPlatformIntelligenceRepository} from '../src/lib/platform-intelligence/persistence';
import {OfficialPackGovernance,reviewManifest,packState} from '../src/lib/platform-intelligence/official-pack/governance';
import {officialPack,knowledgeDraft,channels} from '../src/lib/platform-intelligence/official-pack/manifest';
import {canonicalChecksum} from '../src/lib/platform-intelligence/knowledge/contracts';
import {platformHttpHandler} from '../src/lib/platform-intelligence/server/http';
import {evaluatePlatformReadiness} from '../src/lib/platform-intelligence/readiness/engine';
import {createReadinessRuleSet} from '../src/lib/platform-intelligence/readiness/contracts';
import type {ReadinessRuleSetVersion} from '../src/lib/platform-intelligence/readiness/contracts';
import {observationProject} from './platform-observation.fixture';
import {parseStudioPage} from '../src/lib/studio-page';

it.skipIf(!process.env.AEO_PI_PACK_PHASE)('official FACT pack: explicit real OWNER fixture, HTTP, Node restart and restored exact checksums',async()=>{
 if(!new URL(process.env.DATABASE_URL!).pathname.startsWith('/aeo_restore_test_')||process.env.AEO_STAGE8_ISOLATED!=='1')throw Error('Isolated migrated DB required');
 const file=process.env.AEO_PI_PACK_MANIFEST!,repo=new PostgresPlatformIntelligenceRepository(prisma,{storageMode:'postgres',enabled:'true',persistenceEnabled:'true'}),governance=new OfficialPackGovernance(repo);
 async function get(parts:string[],token?:string){const r=process.env.AEO_PI_PACK_HTTP_URL?await fetch(process.env.AEO_PI_PACK_HTTP_URL+'/api/platform-intelligence/'+parts.join('/'),{headers:token?{cookie:'aeo_session='+token}:{}}):await platformHttpHandler(new NextRequest('http://127.0.0.1:3100/api/platform-intelligence/'+parts.join('/'),{headers:{host:'127.0.0.1:3100',...(token?{cookie:'aeo_session='+token}:{})}}),{params:Promise.resolve({segments:parts})});return {status:r.status,body:await r.json()};}
 async function login(role:string,projectIds:string[]=[]){const id=randomUUID(),user=await prisma.staffUser.create({data:{id,namespace:process.env.AEO_AUTH_NAMESPACE!,username:'pi810-'+id,name:'SYNTHETIC_OWNER_FIXTURE',passwordHash:'DISABLED_TEST_HASH',role,projectIds,disabled:false}});return {id,token:await createSession(publicStaff(user))};}
 try{
 if(process.env.AEO_PI_PACK_PHASE==='WRITE'){
  const p=observationProject();p.id=randomUUID();p.client.id=randomUUID();p.client.name='SYNTHETIC_ONLY_PRIVATE';p.questions=[];p.responses=[];p.tasks=[];p.audits=[];p.reports=[];p.salesReports=[];p.pilotReports=[];p.client.studioRepository={facts:[],pages:[]};await prisma.$transaction(tx=>saveProject(tx,p));
  const owner=await login('OWNER'),manager=await login('MANAGER',[p.id]),analyst=await login('ANALYST',[p.id]);
  const before=await repo.read(owner,'PRODUCTION',s=>canonicalChecksum(s.project(p.id)));
  expect((await get(['knowledge'])).status).toBe(401);
  await writeFile(file+'.review.json',JSON.stringify(reviewManifest(),null,2));
  await expect(governance.prepareDrafts(manager,0)).rejects.toThrow('OWNER');
  const prepared=await governance.prepareDrafts(owner,0);expect(prepared.records.every(r=>r.reviewStatus==='REVIEW_REQUIRED')).toBe(true);expect((await get(['knowledge'],analyst.token)).body.items).toEqual([]);
  const review={operation:'OWNER_REVIEW_OFFICIAL_PACK',manifestChecksum:officialPack.manifestChecksum,expectedRevision:1,reason:'Isolated test OWNER fixture explicitly reviewed all source summaries and claim checksums; no human production approval',decisions:officialPack.facts.map(f=>({knowledgeId:f.knowledgeId,version:1,draftChecksum:f.draftChecksum,sourceExcerptHash:f.provenance.excerptHash,decision:'APPROVE'})),ruleIds:officialPack.rules.map(r=>r.ruleId)};
  await expect(governance.ownerReview(manager,review)).rejects.toThrow('OWNER');
  await expect(governance.ownerReview(owner,{...review,decisions:review.decisions.slice(1)})).rejects.toThrow('complete');
  const installation=await governance.ownerReview(owner,review);expect(installation.records).toHaveLength(47);
  await expect(governance.ownerReview(owner,{...review,expectedRevision:2})).rejects.toThrow('Prepared');
  await expect(repo.write(owner,'PRODUCTION',2,{actorId:owner.id,createdAt:new Date().toISOString(),reason:'Reject duplicate immutable approved FACT'},s=>s.knowledge.createDraft(knowledgeDraft(officialPack.facts[0]),{actorId:owner.id,createdAt:new Date().toISOString(),reason:'Immutable check'}))).rejects.toThrow();
  await repo.write(owner,'SYNTHETIC',0,{actorId:owner.id,createdAt:new Date().toISOString(),reason:'Synthetic namespace isolation'},s=>s.knowledge.createDraft({...knowledgeDraft(officialPack.facts[0]),knowledgeId:'SYNTHETIC_ISOLATION_SENTINEL',knowledgeType:'HYPOTHESIS',claim:'Synthetic isolation fixture, not an official FACT'},{actorId:owner.id,createdAt:new Date().toISOString(),reason:'Synthetic namespace isolation'}));
  const after=await repo.read(owner,'PRODUCTION',s=>canonicalChecksum(s.project(p.id)));expect(after).toBe(before);
  const evaluations=await repo.read(owner,'PRODUCTION',s=>{
   const project=structuredClone(s.project(p.id)),at=new Date().toISOString(),page=parseStudioPage('<html><head></head><body>SYNTHETIC evidence only</body></html>','https://example.invalid/','MANUAL');page.id='SYNTHETIC_PAGE';page.at=at;page.technical.xRobotsTag='index';project.client.studioRepository={facts:[],pages:[page]};project.audits=[{id:'SYNTHETIC_AUDIT',origin:'WEBSITE',kind:'LIVE',url:'https://example.invalid/',at,findings:officialPack.rules.filter(r=>r.robotsAgent).map(r=>({key:'robots-'+r.robotsAgent,label:'Synthetic agent decision',status:'pass',evidence:'Synthetic supplied robots decision; LIVE is schema fixture metadata, no network request',recommendation:'Review only'}))}];
   const output=[];
   for(const code of ['CHATGPT','GOOGLE_AI','CLAUDE','PERPLEXITY'] as const){const global=s.snapshot().records.find(r=>r.domain==='READINESS_POLICY'&&(r.payload as ReadinessRuleSetVersion).scope.platformCode===code)!.payload as ReadinessRuleSetVersion;const {checksum,selectionChecksum,contractVersion,sourceRuleSetChecksum,...input}=global;void checksum;void selectionChecksum;void contractVersion;void sourceRuleSetChecksum;
    const policy=createReadinessRuleSet({...input,scope:{...input.scope,projectId:project.id},checks:input.checks.map(c=>({...c,source:{kind:c.robotsAgent?'AUDIT':'PAGE',id:c.robotsAgent?'SYNTHETIC_AUDIT':page.id}}))},s.rules);
    const scope={projectId:project.id,platformCode:code,channelCode:channels[code],country:null,language:null,industry:null,region:null,surface:null,evidenceAsOf:at};
    const run=()=>evaluatePlatformReadiness({project,scope,ruleSet:policy,catalog:s.rules,knowledge:s.knowledge});const pass=run();expect(pass.counts.pass).toBe(input.checks.length);
    project.audits[0].findings.forEach(f=>f.status='fail');page.technical.robots='noindex';page.body='';const fail=run();expect(fail.counts.fail).toBe(input.checks.length);
    project.audits[0].findings=[];page.technical.status=0;const unknown=run();expect(unknown.counts.unknown).toBe(input.checks.length);
    project.audits[0].findings=officialPack.rules.filter(r=>r.robotsAgent).map(r=>({key:'robots-'+r.robotsAgent,label:'Synthetic agent decision',status:'pass',evidence:'Synthetic',recommendation:'Review only'}));page.technical.status=200;page.technical.robots='';page.body='SYNTHETIC';
    output.push({platformCode:code,pass:pass.counts,fail:fail.counts,unknown:unknown.counts});
   }return output;
  });
  const knowledge=(await get(['knowledge'],analyst.token)).body;expect(knowledge.items).toHaveLength(23);expect(knowledge.items.every((k:{knowledgeType:string;reviewStatus:string})=>k.knowledgeType==='FACT'&&k.reviewStatus==='APPROVED')).toBe(true);
  const overview=(await get(['projects',p.id,'overview'],analyst.token)).body;expect(overview.platforms).toHaveLength(6);for(const v of overview.platforms){expect(v.readiness.notProbability).toBe(true);if(['GEMINI','NAVER_AI'].includes(v.platformCode))expect(v.readiness).toMatchObject({status:'NOT_CONFIGURED',score:null});else expect(v.readiness.ruleSetId).toBe(v.platformCode+'_GENERAL_V1');}
  const dtos=[];for(const v of overview.platforms){const detail=await get(['projects',p.id,'platforms',v.platformCode],analyst.token);expect(detail.status).toBe(200);dtos.push(detail.body);}for(const parts of [['knowledge'],['rules'],['actions'],['projects',p.id,'readiness'],['projects',p.id,'action-candidates']])dtos.push((await get(parts,analyst.token)).body);
  const json=JSON.stringify(dtos);for(const hidden of ['SYNTHETIC_ISOLATION_SENTINEL','SYNTHETIC_ONLY_PRIVATE','sourceUrl','sourceTitle','excerptHash','rawText','storageName','passwordHash','lineage','"claim":'])expect(json).not.toContain(hidden);
  expect((await get(['actions'],analyst.token)).body.items).toEqual([]);
  const audit=await prisma.$queryRawUnsafe<{createdBy:string;reason:string;details:{command:{operation:string};changes:unknown[]}}[]>('SELECT "createdBy",reason,details FROM "PlatformIntelligenceAuditEvent" WHERE environment=$1 ORDER BY revision','PRODUCTION');expect(audit).toHaveLength(2);expect(audit[1].createdBy).toBe(owner.id);expect(audit[1].reason).toContain(officialPack.manifestChecksum);expect(audit[1].details.command.operation).toBe('OWNER_REVIEW_OFFICIAL_PACK');expect(audit[1].details.changes).toHaveLength(47);
  await writeFile(file,JSON.stringify({ownerId:owner.id,projectId:p.id,installation,knowledge,projection:overview.platforms.map((v:{platformCode:string;readiness:{status:string;ruleSetId:string;score:number|null}})=>({platformCode:v.platformCode,status:v.readiness.status,ruleSetId:v.readiness.ruleSetId,score:v.readiness.score})),evaluations,audit:{events:audit.length,reviewerId:owner.id,approvalKind:'TEST_OWNER_FIXTURE_EXPLICIT_COMMAND',humanApprovalRecorded:false},legacyProjectUnchanged:before===after},null,2));
 }else{
  const prior=JSON.parse(await readFile(file,'utf8')),user=await prisma.staffUser.findUniqueOrThrow({where:{id:prior.ownerId}}),token=await createSession(publicStaff(user));
  expect(await repo.read(user,'PRODUCTION',packState)).toEqual(prior.installation);expect((await get(['knowledge'],token)).body).toEqual(prior.knowledge);
  const overview=(await get(['projects',prior.projectId,'overview'],token)).body;expect(overview.platforms.map((v:{platformCode:string;readiness:{status:string;ruleSetId:string;score:number|null}})=>({platformCode:v.platformCode,status:v.readiness.status,ruleSetId:v.readiness.ruleSetId,score:v.readiness.score}))).toEqual(prior.projection);
 }
 }finally{await prisma.$disconnect();}
},120000);
