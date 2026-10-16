import {it,expect} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {prisma,saveProject} from '../src/lib/db';
import {PostgresPlatformIntelligenceRepository} from '../src/lib/platform-intelligence/persistence';
import {experimentFixture,actor,resultAt} from './platform-experiment.fixture';
import {insightFixture,checkedAt,cutoffAt} from './platform-insight.fixture';
import {command} from './platform-knowledge.fixture';
import {canonicalChecksum} from '../src/lib/platform-intelligence/knowledge/contracts';
import {freezeExperimentMeasurement} from '../src/lib/platform-intelligence/experiments/snapshots';
import {onboard} from '../src/lib/operations';
import {attachStudioPage,createStudioWork,currentStudio,editStudioDraft,advanceStudio,verifyStudioDeployment} from '../src/lib/studio-workflow';
import {saveStudioFact} from '../src/lib/studio-facts';
import {parseStudioPage,demoPageHtml} from '../src/lib/studio-page';
import {renderStudioHtml} from '../src/lib/studio-export';

it.skipIf(process.env.AEO_PI_PHASE!=='CHAIN')('persists the real Studio → Action → Experiment → Insight chain',async()=>{
 if(!new URL(process.env.DATABASE_URL!).pathname.startsWith('/aeo_restore_test_')||process.env.AEO_STAGE8_ISOLATED!=='1')throw Error('Isolated database required');
 const repo=new PostgresPlatformIntelligenceRepository(prisma,{storageMode:'postgres',enabled:'true',persistenceEnabled:'true'}),manifest=process.env.AEO_PI_MANIFEST!,old=JSON.parse(await readFile(manifest,'utf8'));
 try{
 const p=await repo.read(actor,'SYNTHETIC',s=>structuredClone(s.project(old.projectId))),f=experimentFixture(),insight=insightFixture([[0,2,2]]);
 for(const r of f.project.responses){r.consumer!.projectId=p.id;r.entityAnalysis!.entities.forEach(e=>e.matchedEntityId=p.client.id);p.responses.push(r);}
 onboard(p,{kind:'CLIENT',profile:'MEDICAL',brandName:p.client.name,contactName:'',contactChannel:'',region:'',businessGoal:'SYNTHETIC persistence verification',objectives:[],accountOwner:'SYNTHETIC',facts:{}});
 p.operations!.pilot=structuredClone(insight.projects[0].p.operations!.pilot!);const agreement=p.operations!.pilot!.agreements[0];agreement.projectId=p.id;agreement.clientId=p.client.id;
 const values={officialName:'홍제 A치과',officialUrl:p.client.website,address:'서울 서대문구 합성 테스트 주소',services:'임플란트 상담',phone:'02-0000-0000',hours:'Mo-Fr 09:00-18:00',bookingUrl:p.client.website+'/reservation'};
 for(const [key,value]of Object.entries(values))saveStudioFact(p,{key,value,source:'SYNTHETIC ONLY',sourceUrl:'',evidence:'SYNTHETIC generated evidence only',status:'VERIFIED',checkedAt:new Date().toISOString(),expiresAt:''},actor);
 const page=attachStudioPage(p,parseStudioPage(demoPageHtml(),p.client.website+'/','MANUAL')),task=createStudioWork(p,{pageId:page.id,questionId:p.questions[0].id,type:'HOME',assignee:'SYNTHETIC'},actor);
 editStudioDraft(p,task.id,currentStudio(p,task.id).version.draft,actor);
 advanceStudio(p,task.id,'internal-review',{note:'합성 자료 대조 검토',factsReviewed:true},actor);
 advanceStudio(p,task.id,'approval',{approved:true,customerReviewer:'합성 고객',note:'합성 문안 검토 완료',evidence:'합성 승인서 증빙',legalReviewed:true,legalNote:'합성 의료광고 검토 기록'},actor);
 advanceStudio(p,task.id,'ready',{note:'합성 승인 버전 납품'},actor);
 const ctx=currentStudio(p,task.id),version=ctx.version.version;ctx.work.exports.push({version,at:new Date().toISOString(),actorId:actor.id,sha256:canonicalChecksum('SYNTHETIC_EXPORT')});
 const appliedAt=new Date().toISOString();advanceStudio(p,task.id,'deploy',{note:'합성 적용 시뮬레이션',evidence:'합성 HTML 적용 증빙',at:appliedAt},actor);
 verifyStudioDeployment(p,task.id,parseStudioPage(renderStudioHtml(ctx.version.draft,true),page.url,'MANUAL'),actor,'SYNTHETIC owned HTML comparison evidence');expect(ctx.work.verification?.passed).toBe(true);
 await prisma.$transaction(tx=>saveProject(tx,p));
 await repo.write(actor,'SYNTHETIC',old.revision,command(resultAt),s=>{
  const {checksum,registryVersion,reviewStatus,createdBy,createdAt,reviewedBy,reviewedAt,reason,...draft}=f.action;void checksum;void registryVersion;void reviewStatus;void createdBy;void createdAt;void reviewedBy;void reviewedAt;void reason;
  s.actions.createDraft(draft,s.actor,command());s.actions.submitForReview(draft.actionId,1,s.actor,command());const action=s.actions.approve(draft.actionId,1,s.actor,command());
  const evaluation=s.readiness.listByProject(p.id,actor.id)[0].evaluation,selection={ruleId:evaluation.items[0].ruleId,ruleVersion:1,actionId:action.actionId,actionVersion:1,actionChecksum:action.checksum};
  const link=s.executions.linkExistingTask({project:s.project(p.id),evaluation,definitions:s.actions,rules:s.rules,actor:s.actor,asOf:resultAt,maxEvaluationAgeSeconds:30*86400,allowSynthetic:true},selection,{taskId:task.id,proposalId:ctx.proposal.id,proposalVersion:version,studioVersion:version,plannedAt:null,actualAppliedAt:appliedAt,proofRefs:[{projectId:p.id,kind:'PAGE',id:ctx.work.verification!.page.id},{projectId:p.id,kind:'STUDIO_VERSION',id:task.id,version},{projectId:p.id,kind:'APPROVAL',id:ctx.proposal.id,version}]},0,command(resultAt));
  const snapshot=(before:boolean)=>freezeExperimentMeasurement(s.project(p.id),{sourceId:before?'SYNTHETIC_BEFORE':'SYNTHETIC_AFTER',environment:'SYNTHETIC',questionIds:p.questions.map(q=>q.id),studyId:null,phase:before?'BASELINE':'FOLLOW_UP',from:before?'2026-10-15T01:00:00Z':'2026-10-17T00:00:00Z',to:before?'2026-10-15T23:00:00Z':'2026-10-17T23:00:00Z',frozenAt:'2026-10-17T23:00:00Z'},f.supplements);
  const before=snapshot(true),after=snapshot(false);s.saveMeasurement(before);s.saveMeasurement(after);
  const input={...f.inputs().input,projectId:p.id,readinessEvaluationId:evaluation.evaluationId,beforeSnapshotRef:before.ref,afterSnapshotRef:after.ref,actionExecutionRefs:[{executionId:link.executionId,revision:link.revision,checksum:link.checksum,actionId:action.actionId,actionVersion:1,actionChecksum:action.checksum,role:'PRIMARY' as const}],querySetRef:before.querySetRef,measurementPlanRef:before.measurementPlanRef,consentRefs:agreement.consents.filter(c=>['INTERNAL_RESEARCH','ANONYMIZED_STATISTICS'].includes(c.category)).map(c=>({projectId:p.id,agreementId:agreement.id,consentId:c.id}))};
  s.experiments.createDraft(input,s.actor,command(resultAt));const result=s.results.appendResult(p.id,input.experimentId,1,0,s.actor,command(resultAt));expect(result.result.status).toBe('RESULT_AVAILABLE');expect(result.result.pairedN).toBe(2);
 });
 await repo.write(actor,'SYNTHETIC',old.revision+1,command(checkedAt),s=>{s.saveInsightPolicy(insight.policy);s.insights.appendRun({cohort:insight.cohort,policy:insight.policy,cutoffAt,checkedAt},0,s.actor,'INTERNAL_RESEARCH',command(checkedAt));expect(s.insights.snapshot()[0].run.lineage.length).toBeGreaterThan(0);});
 const state=await repo.read(actor,'SYNTHETIC',(s,revision)=>{const text=JSON.stringify(s.snapshot());for(const raw of p.responses.map(r=>r.rawText))expect(text).not.toContain(raw);expect(text).not.toContain('inputKey');return {revision,checksum:canonicalChecksum(s.snapshot()),domains:[...new Set(s.snapshot().records.map(r=>r.domain))].sort(),projectId:p.id};});expect(state.domains).toHaveLength(13);await writeFile(manifest,JSON.stringify(state));
 }finally{await prisma.$disconnect();}
},120000);
