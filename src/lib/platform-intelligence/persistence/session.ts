import type {Staff} from '../../auth';
import {assertProjectAccess,allowedProjects} from '../../auth';
import type {ProjectData} from '../../types';
import {canonicalChecksum,immutable} from '../knowledge/contracts';
import type {AuditCommand,KnowledgeVersion,KnowledgeDraft} from '../knowledge/contracts';
import {createInMemoryKnowledgeRepository} from '../knowledge/repository';
import type {KnowledgeAudit} from '../knowledge/repository';
import {createRuleRegistry} from '../rules/registry';
import type {RuleVersion,RuleSetVersion,RuleInput,RuleSetInput,PlatformRuleRegistry} from '../rules/registry';
import {createInMemoryObservationContextRepository} from '../observations/repository';
import type {ObservationContextVersion} from '../observations/repository';
import {createInMemoryReadinessRepository} from '../readiness/repository';
import type {StoredReadinessEvaluation} from '../readiness/repository';
import {createReadinessRuleSet} from '../readiness/contracts';
import type {ReadinessRuleSetVersion} from '../readiness/contracts';
import {createInMemoryActionDefinitionRepository} from '../actions/definitions';
import type {ActionDefinition,ActionDefinitionAudit} from '../actions/definitions';
import {createInMemoryActionExecutionRepository} from '../actions/bridge';
import type {ActionExecutionLink} from '../actions/bridge';
import {assertMeasurementSnapshot} from '../experiments/snapshots';
import type {MeasurementSnapshot} from '../experiments/snapshots';
import {createInMemoryExperimentRepositories} from '../experiments/repository';
import type {StoredExperimentResult} from '../experiments/repository';
import type {Experiment} from '../experiments/contracts';
import {createInMemoryInsightAggregationRepository} from '../insights/repository';
import type {InsightStoredRun} from '../insights/repository';
import {createInsightSourceReader} from '../insights/sources';
import {assertAggregationPolicy} from '../insights/contracts';
import type {AggregationPolicy} from '../insights/contracts';
import type {PersistenceDomain,PersistenceEnvelope,Environment} from './contracts';

export type RepositoryAuditState={knowledge:KnowledgeAudit[];action:ActionDefinitionAudit[]};
export type SessionRecord={domain:PersistenceDomain;stableId:string;version:number;projectId:string|null;responseId:string|null;taskId:string|null;payload:unknown;contractVersion:string;reviewStatus:string|null;writeActor:string|null};
/** Transaction-scoped hydration of existing synchronous contracts, not a fallback storage mode. */
export function createPlatformSession(actor:Staff,environment:Environment,projects:readonly ProjectData[],envelopes:readonly PersistenceEnvelope[],audits:RepositoryAuditState){
  const records=<T>(domain:PersistenceDomain)=>envelopes.filter(e=>e.domain===domain).map(e=>e.payload as T);
  const projectMap=new Map(projects.map(p=>[p.id,immutable(structuredClone(p))]));
  function project(id:string){assertProjectAccess(actor,id);const p=projectMap.get(id);if(!p||p.organizationId!=='local-org')throw Error('Platform source project denied');return p;}
  const authorize=(id:string,pid:string)=>{try{if(id!==actor.id||actor.disabled||actor.role==='VIEWER')return false;project(pid);return true;}catch{return false;}};
  const knowledge=createInMemoryKnowledgeRepository({records:records<KnowledgeVersion>('KNOWLEDGE'),audit:audits.knowledge});
  const ruleRecords=records<RuleVersion>('RULE'),setRecords=records<RuleSetVersion>('RULESET');
  const catalog=()=>createRuleRegistry([],[],knowledge,{rules:ruleRecords,sets:setRecords});
  const rules:PlatformRuleRegistry={getRuleVersion:(...args)=>catalog().getRuleVersion(...args),listRuleVersions:(...args)=>catalog().listRuleVersions(...args),getRuleSetVersion:(...args)=>catalog().getRuleSetVersion(...args),listRuleSetVersions:(...args)=>catalog().listRuleSetVersions(...args),listApplicableRules:(...args)=>catalog().listApplicableRules(...args)};
  const observations=createInMemoryObservationContextRepository({authorize,ownsResponse:(pid,id,qid)=>project(pid).responses.some(r=>r.id===id&&r.questionId===qid),ownsQuery:(pid,id)=>project(pid).questions.some(q=>q.id===id),ownsReference:(pid,id,kind)=>{
    const p=project(pid);if(kind==='EVIDENCE')return !!p.client.evidenceFiles?.some(v=>v.id===id);if(kind==='STUDY')return !!p.client.researchStudies?.some(v=>v.id===id);if(kind==='PRESCAN')return !!p.client.preScanRepository?.scans.some(v=>v.id===id);if(kind==='PLAN')return !!p.operations?.pilot?.agreements.some(a=>a.plans.some(v=>v.id===id));return !!p.client.preScanRepository?.snapshots.some(v=>v.id===id)||!!p.client.citedDiagnoses?.some(v=>v.id===id)||!!p.operations?.pilot?.agreements.some(a=>a.snapshots.some(v=>v.id===id));
  }},records<ObservationContextVersion>('OBSERVATION'));
  const readiness=createInMemoryReadinessRepository({authorize,ownsEvidence:(pid,ref)=>{const p=project(pid);if(ref.projectId!==pid)return false;if(ref.kind==='PAGE')return !!p.client.studioRepository?.pages.some(v=>v.id===ref.id)||p.tasks.some(t=>t.studio?.verification?.page.id===ref.id);if(ref.kind==='AUDIT')return p.audits.some(v=>v.id===ref.id);if(ref.kind==='RESPONSE')return p.responses.some(v=>v.id===ref.id);return !!observations.get(pid,ref.id,actor.id);}},records<StoredReadinessEvaluation>('READINESS'));
  const actions=createInMemoryActionDefinitionRepository({knowledge,rules},{records:records<ActionDefinition>('ACTION'),audit:audits.action});
  const executions=createInMemoryActionExecutionRepository({readProject:(pid,staff)=>{if(staff.id!==actor.id)throw Error('Transaction actor mismatch');return project(pid);}},records<ActionExecutionLink>('EXECUTION'));
  const policies=records<ReadinessRuleSetVersion>('READINESS_POLICY'),measurements=records<MeasurementSnapshot>('MEASUREMENT'),insightPolicies=records<AggregationPolicy>('INSIGHT_POLICY');
  for(const policy of policies){const {contractVersion,sourceRuleSetChecksum,selectionChecksum,checksum,...input}=policy;void contractVersion;void sourceRuleSetChecksum;void selectionChecksum;const rebuilt=createReadinessRuleSet(input,rules);if(rebuilt.checksum!==checksum)throw Error('Stored Readiness policy integrity mismatch');}
  const experiments=createInMemoryExperimentRepositories({authorizeProject:(pid,staff)=>authorize(staff.id,pid),loadSources:(e,staff)=>{
    if(staff.id!==actor.id)throw Error('Experiment transaction actor mismatch');const p=project(e.projectId),before=measurements.find(m=>m.ref.checksum===e.beforeSnapshotRef.checksum),after=measurements.find(m=>m.ref.checksum===e.afterSnapshotRef.checksum),evaluation=readiness.getEvaluation(p.id,e.readinessEvaluationId,actor.id)?.evaluation;
    if(!before||!after||!evaluation)throw Error('Persisted experiment sources missing');return {project:p,before,after,readiness:evaluation,actionViews:executions.listByProject(p.id,actor),definitions:actions};
  }},{definitions:records<Experiment>('EXPERIMENT'),results:records<StoredExperimentResult>('EXPERIMENT_RESULT')});
  const insightReader=createInsightSourceReader({listProjects:()=>[...projectMap.values()],experiments:experiments.experiments,results:experiments.results,executions,readReadiness:(pid,id)=>readiness.getEvaluation(pid,id,actor.id)?.evaluation});
  const insights=createInMemoryInsightAggregationRepository(insightReader,records<InsightStoredRun>('INSIGHT').sort((a,b)=>a.revision-b.revision));
  const same=(a:unknown,b:unknown)=>canonicalChecksum(a)===canonicalChecksum(b);
  function owner(){if(actor.disabled||actor.role!=='OWNER')throw Error('OWNER registry governance required');}
  function saveRule(input:RuleInput){owner();if(input.audit.actorId!==actor.id||input.reviewStatus==='APPROVED'&&input.reviewedBy!==actor.id)throw Error('Rule reviewer actor mismatch');if(ruleRecords.some(r=>r.ruleId===input.ruleId&&r.version===input.version))throw Error('Immutable Rule version already exists');const r=createRuleRegistry([input],[],knowledge).getRuleVersion(input.ruleId,input.version)!;ruleRecords.push(r);return r;}
  function saveRuleSet(input:RuleSetInput){owner();if(input.audit.actorId!==actor.id||input.reviewStatus==='APPROVED'&&input.reviewedBy!==actor.id)throw Error('RuleSet reviewer actor mismatch');if(setRecords.some(r=>r.ruleSetId===input.ruleSetId&&r.version===input.version))throw Error('Immutable RuleSet version already exists');const inputs=ruleRecords.map(({checksum,registryVersion,knowledgeChecksums,...v})=>{void checksum;void registryVersion;void knowledgeChecksums;return v;});const r=createRuleRegistry(inputs,[input],knowledge).getRuleSetVersion(input.ruleSetId,input.version)!;setRecords.push(r);return r;}
  function saveReadinessPolicy(policy:ReadinessRuleSetVersion){owner();const {contractVersion,sourceRuleSetChecksum,selectionChecksum,checksum,...input}=policy;void contractVersion;void sourceRuleSetChecksum;void selectionChecksum;if(!same(createReadinessRuleSet(input,rules),policy))throw Error('Readiness policy checksum mismatch');if(policies.some(p=>p.ruleSetId===policy.ruleSetId&&p.ruleSetVersion===policy.ruleSetVersion))throw Error('Immutable Readiness policy version');policies.push(immutable(structuredClone(policy)));return policy;}
  function saveMeasurement(snapshot:MeasurementSnapshot){assertMeasurementSnapshot(project(snapshot.ref.projectId),snapshot);if(snapshot.ref.kind!==environment)throw Error('Measurement environment mismatch');if(measurements.some(m=>m.ref.checksum===snapshot.ref.checksum))throw Error('Immutable measurement already exists');measurements.push(immutable(structuredClone(snapshot)));return snapshot;}
  function saveInsightPolicy(policy:AggregationPolicy){owner();assertAggregationPolicy(policy);if(policy.environment!==environment||policy.reviewedBy!==actor.id)throw Error('Insight policy actor/environment mismatch');if(insightPolicies.some(p=>p.policyId===policy.policyId&&p.version===policy.version))throw Error('Immutable Insight policy version');insightPolicies.push(immutable(structuredClone(policy)));return policy;}
  function snapshot(){
    const list:SessionRecord[]=[];
    const add=(domain:PersistenceDomain,stableId:string,version:number,payload:unknown,contractVersion:string,projectId:string|null=null,responseId:string|null=null,taskId:string|null=null,reviewStatus:string|null=null,writeActor:string|null=null)=>list.push({domain,stableId,version,payload,contractVersion,projectId,responseId,taskId,reviewStatus,writeActor});
    for(const v of knowledge.snapshot().records)add('KNOWLEDGE',v.knowledgeId,v.version,v,v.registryVersion,v.scope.projectId??null,null,null,v.reviewStatus,v.actorId);
    for(const v of ruleRecords)add('RULE',v.ruleId,v.version,v,v.registryVersion,v.projectId??null,null,null,v.reviewStatus,v.audit.actorId);
    for(const v of setRecords)add('RULESET',v.ruleSetId,v.version,v,v.registryVersion,null,null,null,v.reviewStatus,v.audit.actorId);
    for(const v of observations.snapshot())add('OBSERVATION',v.responseId,v.revision,v,v.context.contextVersion,v.projectId,v.responseId,null,null,v.audit.actorId);
    for(const v of policies)add('READINESS_POLICY',v.ruleSetId,v.ruleSetVersion,v,v.contractVersion,v.scope.projectId??null,null,null,'APPROVED',v.reviewedBy);
    for(const v of readiness.snapshot())add('READINESS',v.evaluation.evaluationId,1,v,v.evaluation.evaluationVersion,v.evaluation.scope.projectId,null,null,null,v.audit.actorId);
    for(const v of actions.snapshot().records)add('ACTION',v.actionId,v.version,v,v.registryVersion,null,null,null,v.reviewStatus,actions.snapshot().audit.filter(a=>a.actionId===v.actionId&&a.version===v.version).at(-1)?.actorId??v.createdBy);
    for(const v of executions.snapshot())add('EXECUTION',v.executionId,v.revision,v,'action-execution-link-v1',v.projectId,null,v.references.taskId,null,v.audit.actorId);
    for(const v of measurements)add('MEASUREMENT',v.ref.checksum,1,v,'measurement-reference-v1',v.ref.projectId);
    for(const v of experiments.snapshot().definitions)add('EXPERIMENT',v.experimentId,v.version,v,v.contractVersion,v.projectId,null,null,null,v.createdBy);
    for(const v of experiments.snapshot().results)add('EXPERIMENT_RESULT',v.result.experimentId,v.result.resultVersion,v,v.result.contractVersion,v.result.projectId,null,null,null,v.audit.actorId);
    for(const v of insightPolicies)add('INSIGHT_POLICY',v.policyId,v.version,v,'insight-aggregation-policy-v1',null,null,null,'APPROVED',v.reviewedBy);
    for(const v of insights.snapshot())add('INSIGHT',v.run.aggregationId,1,v,v.run.aggregationVersion,null,null,null,null,v.audit.actorId);
    return {records:list,audit:{knowledge:knowledge.snapshot().audit,action:actions.snapshot().audit}};
  }
  return Object.freeze({actor,environment,project,projectOptions:()=>allowedProjects(actor,[...projectMap.values()]).map(p=>({projectId:p.id,label:p.client.name})),knowledge,rules,saveRule,saveRuleSet,observations,readiness,saveReadinessPolicy,actions,executions,saveMeasurement,experiments:experiments.experiments,results:experiments.results,insights,saveInsightPolicy,snapshot});
}
export type PlatformSession=ReturnType<typeof createPlatformSession>;
