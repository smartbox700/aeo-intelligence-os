import {it,expect} from 'vitest';
import {prisma,saveProject} from '../src/lib/db';
import {PostgresPlatformIntelligenceRepository} from '../src/lib/platform-intelligence/persistence';
import {PlatformApplicationService} from '../src/lib/platform-intelligence/server/service';
import type {PlatformRepositoryPort} from '../src/lib/platform-intelligence/server/service';
import {approveAggregationPolicy} from '../src/lib/platform-intelligence/insights/contracts';
import type {AggregationPolicy} from '../src/lib/platform-intelligence/insights/contracts';
import {recordPilotConsent} from '../src/lib/pilot-agreement';
import {proof} from './pilot-fixture';
it.skipIf(process.env.AEO_PI_SERVER_CONSENT!=='1')('application projection rechecks current consent over the persisted Synthetic 8-8 ledger',async()=>{
 if(!new URL(process.env.DATABASE_URL!).pathname.startsWith('/aeo_restore_test_')||process.env.AEO_STAGE8_ISOLATED!=='1')throw Error('Restored database required');
 const repo=new PostgresPlatformIntelligenceRepository(prisma,{storageMode:'postgres',enabled:'true',persistenceEnabled:'true'}),actor={id:'SYNTHETIC_REVIEWER'},at='2026-10-20T00:00:01.000Z';
 // Explicit test-only repository mapping; neither this environment mapping nor clock is exposed by an HTTP endpoint.
 const port:PlatformRepositoryPort={read:(id,env,work)=>{expect(env).toBe('PRODUCTION');return repo.read(id,'SYNTHETIC',work);},write:async()=>{throw Error('Read-only test projection');}};
 const service=new PlatformApplicationService(port,()=>at);
 try{
 const old=await repo.read(actor,'SYNTHETIC',(s,revision)=>({revision,stored:s.insights.snapshot()[0]}));
 await repo.write(actor,'SYNTHETIC',old.revision,{actorId:actor.id,createdAt:at,reason:'SYNTHETIC test-only explicit small cohort policy'},s=>{const {checksum,reviewStatus,reviewedBy,reviewedAt,reason,consentPolicyVersion,distributionVersion,...input}=old.stored.policy;void checksum;void reviewedBy;void reviewedAt;void reason;void reviewStatus;void consentPolicyVersion;void distributionVersion;const policy=approveAggregationPolicy({...input,version:2,minimumProjectCount:1},s.actor,{actorId:s.actor.id,createdAt:at,reason:'SYNTHETIC test policy only'});s.saveInsightPolicy(policy);s.insights.appendRun({cohort:old.stored.run.cohortSpec,policy,cutoffAt:old.stored.run.cutoffAt,checkedAt:at},1,s.actor,'INTERNAL_RESEARCH',{actorId:s.actor.id,createdAt:at,reason:'SYNTHETIC persisted projection test'});});
 const before=await service.read(actor,{resource:'insights'}) as {items:{aggregationId:string;sourceState:string;distribution:unknown}[]};const available=before.items.find(v=>v.distribution!==null)!;expect(available).toBeDefined();
 const lineage=await service.readOwnerLineage(actor,{aggregationId:available.aggregationId,purpose:'INTERNAL_RESEARCH'});expect(lineage.length).toBeGreaterThan(0);const json=JSON.stringify(before);for(const forbidden of ['projectId','clientKey','resultChecksum','sourceFingerprint','evidenceRefs','lineage','rawText'])expect(json).not.toContain(forbidden);
 const p=await repo.read(actor,'SYNTHETIC',s=>structuredClone(s.project(lineage[0].projectId))),agreement=p.operations!.pilot!.agreements[0],staff=await repo.read(actor,'SYNTHETIC',s=>s.actor);
 recordPilotConsent(p,{id:agreement.id,category:'INTERNAL_RESEARCH',decision:'REVOKED',scope:'SYNTHETIC withdrawn scope',purpose:'SYNTHETIC withdrawal',from:'2026-10-01',to:'2026-12-31',source:'CLIENT_CONFIDENTIAL',proof:proof()},staff);await prisma.$transaction(tx=>saveProject(tx,p));
 const after=await service.read(actor,{resource:'insights'}) as typeof before;expect(after.items.find(v=>v.aggregationId===available.aggregationId)).toMatchObject({sourceState:'STALE_BY_CONSENT_CHANGE',distribution:null});await expect(service.readOwnerLineage(actor,{aggregationId:available.aggregationId,purpose:'INTERNAL_RESEARCH'})).rejects.toMatchObject({code:'CONSENT_UNAVAILABLE'});
 }finally{await prisma.$disconnect();}
},120000);
