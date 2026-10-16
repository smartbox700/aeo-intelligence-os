import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {assertProjectAccess,allowedProjects,safeWorkspaceProject} from '../../auth';
import type {Staff} from '../../auth';
import {PostgresPlatformIntelligenceRepository} from '../persistence';
import type {PlatformSession} from '../persistence';
import type {MutationAuditContext} from '../persistence/postgres';
import {getPlatforms} from '../registry';
import {getChannels,getChannel} from '../channels';
import {knowledgeDraftSchema,identifier} from '../knowledge/contracts';
import {ruleSchema,ruleSetSchema} from '../rules/registry';
import {actionDraftSchema} from '../actions/definitions';
import {createReadinessRuleSet} from '../readiness/contracts';
import {buildResponseObservationContext} from '../observations/adapters';
import {prepareActionWorkRequest} from '../actions/candidates';
import {freezeExperimentMeasurement} from '../experiments/snapshots';
import {experimentDraftSchema} from '../experiments/contracts';
import {approveAggregationPolicy,createInsightCohort} from '../insights/contracts';
import type {AggregationPolicy} from '../insights/contracts';
import {commandSchema,querySchema,rejectClientAuthority} from './contracts';
import type {ServerQuery,ServerCommand} from './contracts';
import {overview,platformDetail,observations,evaluateCurrent,defaultChannel,readinessDto,currentStored,candidateInput,candidatesDto,executionsDto,experimentsDto} from './read-model';
import {PlatformServiceError,serviceError} from './errors';

const projectResources=new Set(['overview','platform','observations','readiness','action-candidates','executions','experiments']);
const projectCommands=new Set(['OBSERVATION_CAPTURE','READINESS_EVALUATE','PREPARE_WORK','EXECUTION_LINK','MEASUREMENT_FREEZE','EXPERIMENT_CREATE','EXPERIMENT_RESULT']);
const managerCommands=new Set(['EXECUTION_LINK','MEASUREMENT_FREEZE','EXPERIMENT_CREATE','EXPERIMENT_RESULT']);
export type PlatformRepositoryPort=Pick<PostgresPlatformIntelligenceRepository,'read'|'write'>;
function owner(s:PlatformSession){if(s.actor.role!=='OWNER')throw new PlatformServiceError('FORBIDDEN');}
function project(s:PlatformSession,id?:string){if(!id)throw new PlatformServiceError('INVALID_INPUT');try{assertProjectAccess(s.actor,id);}catch{throw new PlatformServiceError('PROJECT_ACCESS_DENIED');}let p;try{p=s.project(id);}catch{throw new PlatformServiceError('NOT_FOUND');}if(!allowedProjects(s.actor,[p]).length)throw new PlatformServiceError('PROJECT_ACCESS_DENIED');return p;}
function commandAudit(c:ServerCommand):MutationAuditContext {const domain=c.operation.startsWith('KNOWLEDGE')?'KNOWLEDGE':c.operation.startsWith('RULESET')?'RULESET':c.operation.startsWith('RULE')?'RULE':c.operation.startsWith('ACTION')?'ACTION':c.operation==='READINESS_POLICY_PUBLISH'?'READINESS_POLICY':c.operation==='READINESS_EVALUATE'||c.operation==='PREPARE_WORK'?'READINESS':c.operation==='OBSERVATION_CAPTURE'?'OBSERVATION':c.operation==='MEASUREMENT_FREEZE'?'MEASUREMENT':c.operation==='EXPERIMENT_RESULT'?'EXPERIMENT_RESULT':c.operation==='EXPERIMENT_CREATE'?'EXPERIMENT':c.operation==='INSIGHT_POLICY_APPROVE'?'INSIGHT_POLICY':c.operation==='INSIGHT_AGGREGATE'?'INSIGHT':'EXECUTION';
 const data='data'in c?c.data as Record<string,unknown>:undefined,id='id'in c?c.id:'experimentId'in c?c.experimentId:'evaluationId'in c?(c.operation==='PREPARE_WORK'?c.evaluationId:undefined):'responseId'in c?c.responseId:data?.knowledgeId??data?.ruleId??data?.ruleSetId??data?.actionId??data?.experimentId??data?.policyId;const version=c.operation==='PREPARE_WORK'?1:c.operation==='EXPERIMENT_RESULT'?undefined:'version'in c?c.version:data?.version;
 return {operation:c.operation,targetDomain:domain,...(typeof id==='string'?{stableId:id}:{}),...(typeof version==='number'?{version}:{})};}

/** Server-only application boundary. HTTP cannot select an environment or inject a clock. */
export class PlatformApplicationService {
 constructor(private readonly repository:PlatformRepositoryPort=new PostgresPlatformIntelligenceRepository(),private readonly clock:()=>string=()=>new Date().toISOString()){}
 /** Privileged internal use only; deliberately absent from the HTTP route and employee DTOs. */
 async readOwnerLineage(identity:Pick<Staff,'id'>,input:unknown){try{const v=z.strictObject({aggregationId:identifier,purpose:z.literal('INTERNAL_RESEARCH')}).parse(input);return await this.repository.read(identity,'PRODUCTION',s=>{owner(s);return s.insights.getLineage(v.aggregationId,s.actor,v.purpose,this.clock());});}catch(e){throw serviceError(e);}}
 async read(identity:Pick<Staff,'id'>,input:unknown){try{const q=querySchema.parse(input);return await this.repository.read(identity,'PRODUCTION',(s,revision)=>{const at=this.clock();if(projectResources.has(q.resource)){project(s,q.projectId);return {revision,checkedAt:at,...this.projectRead(s,q,at)};}if(q.projectId||q.platformCode||q.channelCode)throw new PlatformServiceError('INVALID_INPUT');
  if(q.resource==='catalog')return {revision,projectOptions:s.projectOptions(),items:getPlatforms().map(p=>({platformCode:p.code,displayName:p.displayName,status:p.status,channels:getChannels().filter(c=>c.platformCode===p.code).map(c=>({code:c.code,status:c.status,mode:c.mode}))}))};
  if(q.resource==='insights'){owner(s);return {revision,items:s.insights.listRuns(s.actor,'INTERNAL_RESEARCH',at).map(v=>v.projection)};}
  const records=s.snapshot().records;
  if(q.resource==='knowledge')return {revision,items:records.filter(r=>r.domain==='KNOWLEDGE'&&!r.projectId).map(r=>r.payload as ReturnType<typeof s.knowledge.getVersion>).filter((v):v is NonNullable<typeof v>=>!!v&&(s.actor.role==='OWNER'||v.reviewStatus==='APPROVED'&&s.knowledge.inspect(v.knowledgeId,v.version,at)?.validity==='CURRENT')).map(v=>({knowledgeId:v.knowledgeId,version:v.version,knowledgeType:v.knowledgeType,reviewStatus:v.reviewStatus,platformCode:v.scope.platformCode??null,channelCode:v.scope.channelCode??null,validity:s.knowledge.inspect(v.knowledgeId,v.version,at)?.validity??null,checksum:v.checksum}))};
  if(q.resource==='rules')return {revision,rules:records.filter(r=>r.domain==='RULE'&&!r.projectId).map(r=>r.payload as {ruleId:string;version:number;reviewStatus:string;checkType:string;severity:string;effectiveAt:string;retiredAt:string|null;checksum:string}).filter(r=>s.actor.role==='OWNER'||r.reviewStatus==='APPROVED'&&r.effectiveAt<=at&&(!r.retiredAt||r.retiredAt>at)).map(r=>({ruleId:r.ruleId,version:r.version,reviewStatus:r.reviewStatus,checkType:r.checkType,severity:r.severity,checksum:r.checksum})),ruleSets:records.filter(r=>r.domain==='RULESET').map(r=>r.payload as {ruleSetId:string;version:number;reviewStatus:string;checksum:string}).filter(r=>s.actor.role==='OWNER'||r.reviewStatus==='APPROVED').map(r=>({ruleSetId:r.ruleSetId,version:r.version,reviewStatus:r.reviewStatus,checksum:r.checksum}))};
  if(q.resource==='actions')return {revision,items:s.actions.list().filter(d=>s.actor.role==='OWNER'||s.actions.isOperational(d.actionId,d.version,at)).map(d=>({actionId:d.actionId,version:d.version,name:d.name,category:d.category,reviewStatus:d.reviewStatus,effectClaimStatus:d.effectClaimStatus,approvalRequired:d.approvalRequirements,complianceRequired:d.complianceRequirements}))};
  throw new PlatformServiceError('NOT_FOUND');});}catch(e){throw serviceError(e);}}
 private projectRead(s:PlatformSession,q:ServerQuery,at:string){const p=project(s,q.projectId);if(q.channelCode&&(!q.platformCode||getChannel(q.channelCode)?.platformCode!==q.platformCode))throw new PlatformServiceError('INVALID_INPUT');
  if(q.resource==='overview'){if(q.platformCode||q.channelCode)throw new PlatformServiceError('INVALID_INPUT');return overview(s,p,at);}
  if(q.resource==='platform'){if(!q.platformCode)throw new PlatformServiceError('INVALID_INPUT');return platformDetail(s,p,q.platformCode,q.channelCode??defaultChannel(s,p,q.platformCode,at),at);}
  if(q.resource==='observations')return {projectId:p.id,items:observations(safeWorkspaceProject(p,s.actor),q.platformCode)};
  if(q.resource==='executions')return {projectId:p.id,items:executionsDto(s,p,q.platformCode)};
  if(q.resource==='experiments')return {projectId:p.id,items:experimentsDto(s,p,q.platformCode)};
  const codes=q.platformCode?[q.platformCode]:getPlatforms().map(p=>p.code),details=codes.map(code=>platformDetail(s,p,code,q.channelCode??defaultChannel(s,p,code,at),at));
  return q.resource==='readiness'?{projectId:p.id,items:details.map(d=>({platformCode:d.identity.platformCode,...d.readiness,items:d.readinessItems}))}:{projectId:p.id,items:details.flatMap(d=>d.actionCandidates.map(c=>({platformCode:d.identity.platformCode,...c})))};
 }
 async command(identity:Pick<Staff,'id'>,raw:unknown,projectId?:string){try{rejectClientAuthority(raw);const c=commandSchema.parse(raw);if(projectCommands.has(c.operation)!==!!projectId)throw new PlatformServiceError('INVALID_INPUT');const at=this.clock(),audit={actorId:identity.id,createdAt:at,reason:c.reason};
  const value=await this.repository.write(identity,'PRODUCTION',c.expectedRevision,audit,s=>{if(!projectCommands.has(c.operation))owner(s);if(managerCommands.has(c.operation)&&!['OWNER','MANAGER'].includes(s.actor.role))throw new PlatformServiceError('FORBIDDEN');const p=projectId?project(s,projectId):undefined;
   switch(c.operation){
    case 'KNOWLEDGE_CREATE':{const v=s.knowledge.createDraft(knowledgeDraftSchema.parse(c.data),audit);return {id:v.knowledgeId,version:v.version,reviewStatus:v.reviewStatus};}
    case 'KNOWLEDGE_SUBMIT':case 'KNOWLEDGE_APPROVE':case 'KNOWLEDGE_RETIRE':{const fn=c.operation==='KNOWLEDGE_SUBMIT'?'submitForReview':c.operation==='KNOWLEDGE_APPROVE'?'approve':'retire',v=s.knowledge[fn](c.id,c.version,audit);return {id:v.knowledgeId,version:v.version,reviewStatus:v.reviewStatus};}
    case 'RULE_DRAFT':case 'RULE_PUBLISH':{const approved=c.operation==='RULE_PUBLISH',v=s.saveRule(ruleSchema.parse({...c.data,audit,reviewStatus:approved?'APPROVED':'DRAFT',retiredAt:null,...(approved?{reviewedBy:s.actor.id,reviewedAt:at}:{})}));return {id:v.ruleId,version:v.version,reviewStatus:v.reviewStatus};}
    case 'RULESET_DRAFT':case 'RULESET_PUBLISH':{const approved=c.operation==='RULESET_PUBLISH',v=s.saveRuleSet(ruleSetSchema.parse({...c.data,audit,reviewStatus:approved?'APPROVED':'DRAFT',retiredAt:null,...(approved?{reviewedBy:s.actor.id,reviewedAt:at}:{})}));return {id:v.ruleSetId,version:v.version,reviewStatus:v.reviewStatus};}
    case 'ACTION_CREATE':{const v=s.actions.createDraft(actionDraftSchema.parse({...c.data,environment:'PRODUCTION',effectClaimStatus:'NO_EFFECT_CLAIM',retiredAt:null}),s.actor,audit);return {id:v.actionId,version:v.version,reviewStatus:v.reviewStatus};}
    case 'ACTION_SUBMIT':case 'ACTION_APPROVE':case 'ACTION_RETIRE':{const fn=c.operation==='ACTION_SUBMIT'?'submitForReview':c.operation==='ACTION_APPROVE'?'approve':'retire',v=s.actions[fn](c.id,c.version,s.actor,audit);return {id:v.actionId,version:v.version,reviewStatus:v.reviewStatus};}
    case 'READINESS_POLICY_PUBLISH':{const policy=createReadinessRuleSet({...c.data,environment:'PRODUCTION',reviewedBy:s.actor.id,reviewedAt:at,reason:c.reason} as Parameters<typeof createReadinessRuleSet>[0],s.rules);s.saveReadinessPolicy(policy);return {id:policy.ruleSetId,version:policy.ruleSetVersion};}
    case 'INSIGHT_POLICY_APPROVE':{const policy=approveAggregationPolicy({...c.data,environment:'PRODUCTION'} as Parameters<typeof approveAggregationPolicy>[0],s.actor,audit);s.saveInsightPolicy(policy);return {id:policy.policyId,version:policy.version};}
    case 'OBSERVATION_CAPTURE':{if(!p!.responses.some(r=>r.id===c.responseId&&r.kind!=='DEMO'&&r.classification!=='INTERNAL'))throw new PlatformServiceError('NOT_FOUND');const context=buildResponseObservationContext(p!,c.responseId),prior=s.observations.get(p!.id,c.responseId,s.actor.id);const v=s.observations.append(context,prior?.revision??0,audit);return {responseId:v.responseId,revision:v.revision,contextCompleteness:v.context.status};}
    case 'READINESS_EVALUATE':{if(c.channelCode&&getChannel(c.channelCode)?.platformCode!==c.platformCode)throw new PlatformServiceError('INVALID_INPUT');const e=evaluateCurrent(s,p!,c.platformCode,c.channelCode??defaultChannel(s,p!,c.platformCode,at),at);if(e.status==='NOT_CONFIGURED')return readinessDto(e,false);if(['STALE','INVALID'].includes(e.status))throw new PlatformServiceError('SOURCE_CHANGED');s.readiness.appendEvaluation(e,s.readiness.listByProject(p!.id,s.actor.id).length,audit);return readinessDto(e,true);}
    case 'PREPARE_WORK':case 'EXECUTION_LINK':{const e=currentStored(s,p!,c.evaluationId,at),d=s.actions.getVersion(c.actionId,c.actionVersion);if(!d)throw new PlatformServiceError('NOT_FOUND');const selection={ruleId:c.ruleId,ruleVersion:c.ruleVersion,actionId:c.actionId,actionVersion:c.actionVersion,actionChecksum:d.checksum},input=candidateInput(s,p!,e,at);
     if(c.operation==='PREPARE_WORK'){const v=prepareActionWorkRequest(input,selection);return {kind:v.kind,evaluationId:v.evaluationId,selection:{ruleId:c.ruleId,ruleVersion:c.ruleVersion,actionId:c.actionId,actionVersion:c.actionVersion},requiredGates:v.requiredGates,createsTask:false,preparedAt:at};}
     const task=p!.tasks.find(t=>t.id===c.taskId);if(!task)throw new PlatformServiceError('NOT_FOUND');const w=task.studio,version=w?.versions.at(-1)?.version,proposal=p!.operations?.proposals.find(v=>v.id===w?.proposalId);const proofs= w?.verification&&version&&proposal?[{projectId:p!.id,kind:'PAGE' as const,id:w.verification.page.id},{projectId:p!.id,kind:'STUDIO_VERSION' as const,id:task.id,version},{projectId:p!.id,kind:'APPROVAL' as const,id:proposal.id,version}]:[];
     const pilot=p!.operations?.pilot?.agreements.flatMap(agreement=>agreement.work.filter(work=>work.taskId===task.id).map(work=>({agreement,work})))??[];if(pilot.length>1)throw new PlatformServiceError('SOURCE_CHANGED');
     const v=s.executions.linkExistingTask(input,selection,{taskId:task.id,plannedAt:null,actualAppliedAt:w?.deployment?.at??null,proofRefs:proofs,...(w&&version&&proposal?{proposalId:proposal.id,proposalVersion:version,studioVersion:version}:{}),...(pilot.length?{pilotAgreementId:pilot[0].agreement.id,pilotWorkId:pilot[0].work.id}:{})},c.expectedLinkRevision,audit);return {executionId:v.executionId,revision:v.revision};}
    case 'MEASUREMENT_FREEZE':{const v=freezeExperimentMeasurement(p!,{sourceId:randomUUID(),environment:'PRODUCTION',questionIds:p!.questions.map(q=>q.id),studyId:c.studyId,phase:c.phase,from:c.from,to:c.to,frozenAt:at});s.saveMeasurement(v);return {checksum:v.ref.checksum,sourceId:v.ref.sourceId,phase:v.selection.phase};}
    case 'EXPERIMENT_CREATE':{const v=s.experiments.createDraft(experimentDraftSchema.parse({...c.data,projectId:p!.id,environment:'PRODUCTION'}),s.actor,audit);return {experimentId:v.experimentId,version:v.version};}
    case 'EXPERIMENT_RESULT':{const v=s.results.appendResult(p!.id,c.experimentId,c.version,c.expectedResultRevision,s.actor,audit);return {experimentId:v.result.experimentId,resultVersion:v.result.resultVersion,status:v.result.status};}
    case 'INSIGHT_AGGREGATE':{const policy=s.snapshot().records.find(r=>r.domain==='INSIGHT_POLICY'&&r.stableId===c.policyId&&r.version===c.policyVersion)?.payload as AggregationPolicy|undefined;if(!policy)throw new PlatformServiceError('NOT_FOUND');const v=s.insights.appendRun({cohort:createInsightCohort({...c.cohort,environment:'PRODUCTION'} as Parameters<typeof createInsightCohort>[0]),policy,cutoffAt:at,checkedAt:at},s.insights.snapshot().length,s.actor,'INTERNAL_RESEARCH',audit);return {aggregationId:v.aggregationId,projection:v.projection};}
   }
  },commandAudit(c));return {revision:c.expectedRevision+1,result:value};}catch(e){throw serviceError(e);}}
}
