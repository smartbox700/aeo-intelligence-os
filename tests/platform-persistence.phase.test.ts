import {it,expect} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {prisma,saveProject} from '../src/lib/db';
import {PostgresPlatformIntelligenceRepository} from '../src/lib/platform-intelligence/persistence';
import {readinessFixture} from './platform-readiness.fixture';
import {fact,command,at} from './platform-knowledge.fixture';
import {evaluatePlatformReadiness} from '../src/lib/platform-intelligence/readiness/engine';
import {buildResponseObservationContext} from '../src/lib/platform-intelligence/observations/adapters';
import {canonicalChecksum} from '../src/lib/platform-intelligence/knowledge/contracts';

// This file runs in independent Node processes, only against an explicitly selected restored database.
it.skipIf(!process.env.AEO_PI_PHASE)('persists and reloads governed Platform records across process exit',async()=>{
 const database=new URL(process.env.DATABASE_URL!).pathname.slice(1);
 if(!database.startsWith('aeo_restore_test_')||process.env.AEO_STAGE8_ISOLATED!=='1')throw Error('Restored database required');
 const repo=new PostgresPlatformIntelligenceRepository(prisma,{storageMode:'postgres',enabled:'true',persistenceEnabled:'true'}),actor={id:'SYNTHETIC_REVIEWER'},manifest=process.env.AEO_PI_MANIFEST!;
 try{
 if(process.env.AEO_PI_PHASE==='WRITE'){
  const f=readinessFixture();f.page.body='';f.project.tasks=[];f.project.id='PI_PERSISTENCE_SYNTHETIC_PROJECT';f.project.client.id='PI_PERSISTENCE_SYNTHETIC_CLIENT';f.project.organizationId='local-org';f.response.consumer!.projectId=f.project.id;f.scope.projectId=f.project.id;f.policyInput.scope.projectId=f.project.id;
  await prisma.staffUser.upsert({where:{id:actor.id},create:{...actor,namespace:'local',username:'pi-synthetic-reviewer',name:'SYNTHETIC ONLY',passwordHash:'DISABLED_TEST_HASH',role:'OWNER',projectIds:[],disabled:false},update:{disabled:false,role:'OWNER'}});
  await prisma.$transaction(tx=>saveProject(tx,f.project));
  await repo.write(actor,'SYNTHETIC',0,command(),s=>{
   const k={...fact(),knowledgeId:'FACT_READINESS_TEST_0'};s.knowledge.createDraft(k,command());s.knowledge.submitForReview(k.knowledgeId,1,command());s.knowledge.approve(k.knowledgeId,1,command());
   s.saveRule(f.rules[0]);s.saveRuleSet(f.set);
  });
  // A second transaction proves hydration and audit-driven draft transitions, rather than only an initial insert.
  const {createReadinessRuleSet}=await import('../src/lib/platform-intelligence/readiness/contracts');
  await repo.write(actor,'SYNTHETIC',1,command(),s=>{
   const p=s.project(f.project.id),policy=createReadinessRuleSet(f.policyInput,s.rules);s.saveReadinessPolicy(policy);
   const context=buildResponseObservationContext(p,f.response.id,f.supplements);s.observations.append(context,0,command());
   const evaluation=evaluatePlatformReadiness({project:p,scope:f.scope,ruleSet:policy,catalog:s.rules,knowledge:s.knowledge,contexts:[context]});s.readiness.appendEvaluation(evaluation,0,command());
  });
  await repo.write(actor,'SYNTHETIC',2,command(),s=>s.knowledge.createDraft({...fact(),knowledgeId:'PI_DRAFT'},command()));
  await repo.write(actor,'SYNTHETIC',3,command(),s=>s.knowledge.submitForReview('PI_DRAFT',1,command()));
  await expect(repo.write(actor,'SYNTHETIC',3,command(),()=>undefined)).rejects.toThrow('Stale');
  const before=await repo.read(actor,'SYNTHETIC',(s,revision)=>({revision,checksum:canonicalChecksum(s.snapshot())}));
  await expect(repo.write(actor,'SYNTHETIC',4,command(),s=>{s.knowledge.createDraft({...fact(),knowledgeId:'ROLLBACK'},command());throw Error('ROLLBACK_TEST');})).rejects.toThrow('ROLLBACK_TEST');
  await expect(repo.read(actor,'SYNTHETIC',s=>s.knowledge.createDraft({...fact(),knowledgeId:'READ_MUTATION'},command()))).rejects.toThrow('Read-only');
  expect(await repo.read(actor,'SYNTHETIC',(s,revision)=>({revision,checksum:canonicalChecksum(s.snapshot())}))).toEqual(before);
  const concurrent=await Promise.allSettled(['CAS_A','CAS_B'].map(id=>repo.write(actor,'SYNTHETIC',4,command(),s=>s.knowledge.createDraft({...fact(),knowledgeId:id},command()))));expect(concurrent.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const state=await repo.read(actor,'SYNTHETIC',(s,revision)=>({revision,checksum:canonicalChecksum(s.snapshot()),domains:[...new Set(s.snapshot().records.map(r=>r.domain))].sort(),projectId:f.project.id}));
  expect(state.revision).toBe(5);expect(state.domains).toEqual(['KNOWLEDGE','OBSERVATION','READINESS','READINESS_POLICY','RULE','RULESET']);await writeFile(manifest,JSON.stringify(state));
 }else{
  const expected=JSON.parse(await readFile(manifest,'utf8'));
  const actual=await repo.read(actor,'SYNTHETIC',(s,revision)=>({revision,checksum:canonicalChecksum(s.snapshot()),domains:[...new Set(s.snapshot().records.map(r=>r.domain))].sort(),projectId:s.project(expected.projectId).id}));expect(actual).toEqual(expected);
  expect(await repo.read(actor,'PRODUCTION',(s,revision)=>({revision,n:s.snapshot().records.length}))).toEqual({revision:0,n:0});
 }
 }finally{await prisma.$disconnect();}
},120000);

