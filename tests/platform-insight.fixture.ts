import {experimentFixture,actor,resultAt} from './platform-experiment.fixture';
import {activate,pilotFixture,proof} from './pilot-fixture';
import {recordPilotConsent} from '../src/lib/pilot-agreement';
import {createReadinessRuleSet} from '../src/lib/platform-intelligence/readiness/contracts';
import {evaluatePlatformReadiness} from '../src/lib/platform-intelligence/readiness/engine';
import {canonicalChecksum} from '../src/lib/platform-intelligence/knowledge/contracts';
import {sealExperiment} from '../src/lib/platform-intelligence/experiments/contracts';
import type {Experiment} from '../src/lib/platform-intelligence/experiments/contracts';
import {evaluateExperiment} from '../src/lib/platform-intelligence/experiments/engine';
import type {ExperimentResult} from '../src/lib/platform-intelligence/experiments/engine';
import type {ExperimentResultView} from '../src/lib/platform-intelligence/experiments/repository';
import {approveAggregationPolicy,createInsightCohort} from '../src/lib/platform-intelligence/insights/contracts';
import type {InsightSourceReader} from '../src/lib/platform-intelligence/insights/sources';
import {command} from './platform-knowledge.fixture';

export const cutoffAt='2026-10-19T00:00:00Z',checkedAt='2026-10-20T00:00:00Z';
export function resultView(result:ExperimentResult):ExperimentResultView {const content={result,audit:command(resultAt),previousChecksum:null};return {stored:{...content,checksum:canonicalChecksum(content)},sourceState:'CURRENT',currentDelta:result.delta};}
/** Real 8-6 results over generated observations; PRODUCTION is a contract test, never an operational seed. */
export function insightProject(index:number,beforePositive=0,afterPositive=5,n=100,environment:'PRODUCTION'|'SYNTHETIC'='SYNTHETIC'){
  const f=experimentFixture(environment),p=f.project;p.id='SYNTHETIC_PROJECT_'+index;p.client.id='SYNTHETIC_CLIENT_'+index;p.client.name='PRIVATE_CLIENT_NAME_'+index;
  const localPilot=activate(pilotFixture());p.operations=structuredClone(localPilot.p.operations)!;
  const agreement=p.operations.pilot!.agreements[0];agreement.projectId=p.id;agreement.clientId=p.client.id;
  for(const category of ['INTERNAL_RESEARCH','ANONYMIZED_STATISTICS'] as const)recordPilotConsent(p,{id:agreement.id,category,decision:'GRANTED',scope:'SYNTHETIC cross-project test only',purpose:'SYNTHETIC internal research only',from:'2026-10-01',to:'2026-12-31',source:'CLIENT_CONFIDENTIAL',proof:proof()},actor);
  p.responses=[];for(const phase of ['BASELINE','FOLLOW_UP'] as const)for(let run=1;run<=n;run++){const r=f.response(phase+'_'+run,phase,run,run<=(phase==='BASELINE'?beforePositive:afterPositive));r.consumer!.projectId=p.id;r.rawText='PRIVATE_RAW_SECRET_'+phase+'_'+run;r.entityAnalysis!.entities.forEach(e=>{e.matchedEntityId=p.client.id;e.name=p.client.name;});p.responses.push(r);}
  f.scope.projectId=p.id;const binding=createReadinessRuleSet({...f.policyInput,environment,scope:{...f.policyInput.scope,projectId:p.id}},f.catalog);
  const readiness=evaluatePlatformReadiness({project:p,scope:f.scope,ruleSet:binding,catalog:f.catalog,knowledge:f.knowledge});
  const {checksum,...body}=f.views[0].record;void checksum;
  const record={...body,projectId:p.id,evaluationId:readiness.evaluationId,evaluationChecksum:readiness.checksum,references:{...body.references,proofRefs:body.references.proofRefs.map(ref=>({...ref,projectId:p.id}))}};
  f.views[0]={...f.views[0],record:{...record,checksum:canonicalChecksum(record)}};
  const i=f.inputs();i.input.experimentId='SYNTHETIC_EXP_'+index;i.input.readinessEvaluationId=readiness.evaluationId;i.input.consentRefs=agreement.consents.filter(c=>['INTERNAL_RESEARCH','ANONYMIZED_STATISTICS'].includes(c.category)).map(c=>({projectId:p.id,agreementId:agreement.id,consentId:c.id}));
  const e=sealExperiment(i.input,actor.id,resultAt,'SYNTHETIC reviewed experiment'),sources={...i.sources,readiness},r=evaluateExperiment(e,sources,actor,resultAt,1);
  return {p,readiness,executions:f.views,experiments:[e] as Experiment[],views:[resultView(r)],agreement,f};
}
export function insightFixture(values:[number,number,number][]=[[0,5,100],[0,3,100],[0,0,100],[2,0,100]],environment:'PRODUCTION'|'SYNTHETIC'='SYNTHETIC'){
  const projects=values.map(([b,a,n],i)=>insightProject(i+1,b,a,n,environment));
  const reader:InsightSourceReader={listProjects:()=>projects.map(p=>p.p),listExperiments:id=>projects.find(p=>p.p.id===id)!.experiments,listResults:(id,exp)=>projects.find(p=>p.p.id===id)!.views.filter(v=>v.stored.result.experimentId===exp),listExecutions:id=>projects.find(p=>p.p.id===id)!.executions,readReadiness:id=>projects.find(p=>p.p.id===id)?.readiness};
  const cohort=createInsightCohort({industry:'MEDICAL',platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',actionId:projects[0]?.f.action.actionId??'SYNTHETIC_EXPERIMENT_ACTION',actionVersion:1,metric:{namespace:'confirmedMetrics',metricId:'Brand Mention Rate',metricVersion:'verified-observation-v1'},unit:'PERCENTAGE_POINTS',observationWindow:{minDaysAfterAction:0,maxDaysAfterAction:14},environment});
  const policy=approveAggregationPolicy({policyId:'SYNTHETIC_APPROVED_POLICY',version:1,environment,minimumProjectCount:2,projectSelection:'LATEST_ELIGIBLE_AFTER_TO',independence:'ONE_PROJECT_ONE_CLIENT_CONTRIBUTION',privacy:'SUPPRESS_SMALL_COHORT',repeatedPattern:null},actor,command(resultAt));
  return {projects,reader,cohort,policy,cutoffAt,checkedAt,actor,purpose:'INTERNAL_RESEARCH' as const};
}
/** Simulate trusted upstream revisions for isolated aggregation gate/selection tests. */
export function reviseResult(project:ReturnType<typeof insightProject>,change:(r:ExperimentResult)=>ExperimentResult){project.views[0]=resultView(change(structuredClone(project.views[0].stored.result)));const {checksum,...body}=project.views[0].stored.result;project.views[0]=resultView({...body,checksum:canonicalChecksum(body)});}
export function addExperiment(project:ReturnType<typeof insightProject>,id:string,afterTo:string,delta:number){
  const {checksum,status,createdBy,createdAt,reason,contractVersion,...draft}=project.experiments[0];void checksum;void status;void createdBy;void reason;void contractVersion;
  const e=sealExperiment({...draft,experimentId:id,window:{...draft.window,afterTo}},actor.id,createdAt,'SYNTHETIC source selection fixture');
  const {checksum:resultChecksum,...r}=project.views[0].stored.result;void resultChecksum;const body={...r,experimentId:id,experimentChecksum:e.checksum,delta,displayDelta:delta*100,observationWindow:{...r.observationWindow,afterTo}};
  project.experiments.push(e);project.views.push(resultView({...body,checksum:canonicalChecksum(body)}));
}
