import type {Staff} from '../../auth';
import {assertProjectAccess} from '../../auth';
import type {ProjectData} from '../../types';
import {canonicalChecksum,immutable,timestamp} from '../knowledge/contracts';
import {assertExperiment} from '../experiments/contracts';
import type {Experiment} from '../experiments/contracts';
import type {ExperimentResultView} from '../experiments/repository';
import {assertReadinessEvaluation} from '../readiness/repository';
import type {InsightSourceReader} from './sources';
import {inspectInsightConsent} from './consent';
import {assertInsightCohort,assertAggregationPolicy,assertInsightOwner,AGGREGATION_VERSION,CONSENT_POLICY_VERSION} from './contracts';
import type {InsightCohort,AggregationPolicy} from './contracts';

type Lineage={candidateId:string;projectId:string;clientKey:string;experimentId:string|null;experimentVersion:number|null;executionId:string|null;resultVersion:number|null;resultChecksum:string|null;sourceFingerprint:string;consentStateHash:string;consentAllowed:boolean;reasons:string[];selected:boolean};
type Eligible={lineage:Lineage;delta:number;afterTo:string;rawN:number;pairedN:number};
export type AggregationRequest={cohort:InsightCohort;policy:AggregationPolicy;cutoffAt:string;checkedAt:string;actor:Staff;purpose:'INTERNAL_RESEARCH';reader:InsightSourceReader};
const rounded=(n:number)=>Number(n.toFixed(12));
function distribution(values:number[]){
  const sorted=values.slice().sort((a,b)=>a-b),n=sorted.length;
  if(!n)return null;
  const quantile=(p:number)=>{const position=(n-1)*p,lo=Math.floor(position);return rounded(sorted[lo]+(sorted[Math.ceil(position)]-sorted[lo])*(position-lo));};
  const positiveCount=sorted.filter(v=>v>0).length,zeroCount=sorted.filter(v=>v===0).length,negativeCount=sorted.filter(v=>v<0).length;
  return {meanDelta:rounded(sorted.reduce((a,b)=>a+b,0)/n),medianDelta:quantile(.5),minDelta:sorted[0],maxDelta:sorted[n-1],q1:quantile(.25),q3:quantile(.75),positiveCount,zeroCount,negativeCount,positiveShare:positiveCount/n};
}
export function aggregateInsightCohort(request:AggregationRequest){
  const {actor,purpose,reader,cutoffAt,checkedAt}=request;assertInsightOwner(actor,purpose);timestamp.parse(cutoffAt);timestamp.parse(checkedAt);
  const cohort=assertInsightCohort(request.cohort),policy=assertAggregationPolicy(request.policy);
  if(policy.environment!==cohort.environment||Date.parse(policy.reviewedAt)>Date.parse(checkedAt)||Date.parse(cutoffAt)>Date.parse(checkedAt))throw Error('Insight policy/environment/cutoff invalid');
  const projects=[...reader.listProjects(actor)].sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(projects.map(p=>p.id)).size!==projects.length)throw Error('Duplicate project source enumeration');
  const lineage:Lineage[]=[],eligible:Eligible[]=[];
  function scopeReasons(project:ProjectData,evaluationId:string,platform:string,channel:string|null,ruleId:string){
    const reasons:string[]=[],readiness=reader.readReadiness(project.id,evaluationId,actor);
    let scope:ReturnType<typeof assertReadinessEvaluation>['scope']|undefined,scopeHash:string|null=null;
    try{if(!readiness)throw Error('Missing readiness');const valid=assertReadinessEvaluation(readiness);if(valid.scope.projectId!==project.id||valid.evaluationId!==evaluationId||valid.scope.platformCode!==platform||valid.scope.channelCode!==channel)throw Error('Wrong project/scope');scope=valid.scope;scopeHash=valid.checksum;}catch{reasons.push('SCOPE_UNAVAILABLE');}
    if(platform!==cohort.platformCode)reasons.push('WRONG_PLATFORM');if(channel!==cohort.channelCode)reasons.push('WRONG_CHANNEL');
    if(scope?.industry!==cohort.industry)reasons.push(scope?.industry?'WRONG_INDUSTRY':'UNKNOWN_INDUSTRY');
    if(cohort.subIndustry)reasons.push('SUBINDUSTRY_UNAVAILABLE');if(cohort.regionGroup)reasons.push('REGION_GROUP_UNAVAILABLE');
    for(const field of ['country','language'] as const)if(cohort[field]&&scope?.[field]!==cohort[field])reasons.push(scope?.[field]?'WRONG_'+field.toUpperCase():'UNKNOWN_'+field.toUpperCase());
    if(cohort.ruleId&&cohort.ruleId!==ruleId)reasons.push('WRONG_RULE');
    const issue=readiness?.items.find(i=>i.ruleId===ruleId)?.checkType;if(cohort.issueType&&cohort.issueType!==issue)reasons.push('WRONG_ISSUE_TYPE');
    return {reasons,scopeHash};
  }
  for(const project of projects){
    assertProjectAccess(actor,project.id);if(project.organizationId!=='local-org')throw Error('Insight project organization denied');
    const allDefinitions=reader.listExperiments(project.id,actor),definitions=allDefinitions.filter(e=>Date.parse(e.createdAt)<=Date.parse(cutoffAt));
    const latest=new Map<string,Experiment>();for(const raw of definitions){const e=assertExperiment(raw);if(e.projectId!==project.id)throw Error('Foreign Experiment source');const prev=latest.get(e.experimentId);if(prev?.version===e.version)throw Error('Duplicate Experiment version');if(!prev||e.version>prev.version)latest.set(e.experimentId,e);}
    const executions=reader.listExecutions(project.id,actor),covered=new Set(definitions.flatMap(e=>e.actionExecutionRefs.map(r=>r.executionId)));
    for(const e of [...latest.values()].sort((a,b)=>a.experimentId.localeCompare(b.experimentId))){
      const views=reader.listResults(project.id,e.experimentId,actor).filter(v=>Date.parse(v.stored.audit.createdAt)<=Date.parse(cutoffAt)&&Date.parse(v.stored.result.evidenceAsOf)<=Date.parse(cutoffAt));
      if(new Set(views.map(v=>v.stored.result.resultVersion)).size!==views.length)throw Error('Duplicate Experiment result version');
      const view=views.slice().sort((a,b)=>b.stored.result.resultVersion-a.stored.result.resultVersion)[0],r=view?.stored.result;
      const reasons:string[]=[],scope=scopeReasons(project,e.readinessEvaluationId,e.platformCode,e.channelCode,e.readinessItemRef.ruleId);reasons.push(...scope.reasons);
      if(e.environment!==cohort.environment||cohort.environment==='PRODUCTION'&&project.operations?.kind==='DEMO')reasons.push('WRONG_ENVIRONMENT');
      if(!e.actionExecutionRefs.some(a=>a.actionId===cohort.actionId))reasons.push('WRONG_ACTION');
      else if(!e.actionExecutionRefs.some(a=>a.actionId===cohort.actionId&&a.actionVersion===cohort.actionVersion))reasons.push('WRONG_ACTION_VERSION');
      if(e.metric.namespace!==cohort.metric.namespace||e.metric.metricId!==cohort.metric.metricId||e.metric.metricVersion!==cohort.metric.metricVersion)reasons.push('WRONG_METRIC_VERSION_OR_NAMESPACE');
      const currentDefinition=allDefinitions.filter(v=>v.experimentId===e.experimentId).sort((a,b)=>b.version-a.version)[0];
      if(e.status==='RETIRED'||currentDefinition?.status==='RETIRED')reasons.push('EXPERIMENT_ABORTED');
      if(!r){const applied=e.actionExecutionRefs.every(a=>executions.some(v=>v.record.executionId===a.executionId&&v.sourceState==='CURRENT'&&v.currentActualAppliedAt));reasons.push(applied?'NO_FOLLOW_UP':'ACTION_NOT_APPLIED');}
      if(e.actionExecutionRefs.length!==1)reasons.push('MULTIPLE_ACTIONS');
      if(e.confounders.length)reasons.push('CONFOUNDER_PRESENT');
      const consent=inspectInsightConsent(project,e,checkedAt);reasons.push(...consent.reasons);
      let delta:number|null=null;
      if(r&&view){
        for(const ref of e.actionExecutionRefs){const execution=executions.find(v=>v.record.executionId===ref.executionId);
          if(!execution||execution.record.projectId!==project.id)reasons.push('ACTION_SOURCE_MISSING');
          else if(execution.sourceState!=='CURRENT')reasons.push('ACTION_SOURCE_CHANGED');
          else if(!execution.currentActualAppliedAt||execution.currentActualAppliedAt!==execution.record.references.actualAppliedAt)reasons.push('ACTION_NOT_APPLIED');
          else if(execution.record.checksum!==ref.checksum||execution.record.revision!==ref.revision)reasons.push('ACTION_SOURCE_VERSION_CHANGED');
        }
        const {checksum,...body}=r,{checksum:storedChecksum,...storedBody}=view.stored;
        if(canonicalChecksum(body)!==checksum||canonicalChecksum(storedBody)!==storedChecksum||r.projectId!==project.id||r.experimentId!==e.experimentId||r.experimentChecksum!==e.checksum||r.experimentVersion!==e.version)reasons.push('INVALID_OR_SUPERSEDED_RESULT');
        if(view.sourceState!=='CURRENT')reasons.push('STALE');
        if(r.environment!==cohort.environment||r.beforeRef.kind!==cohort.environment||r.afterRef.kind!==cohort.environment)reasons.push('WRONG_ENVIRONMENT');
        if(r.status!=='RESULT_AVAILABLE')reasons.push('NOT_COMPARABLE');
        if(r.delta===null||!Number.isFinite(r.delta)||view.currentDelta!==r.delta)reasons.push('NULL_OR_INVALID_DELTA');
        if(r.attributionType!=='OBSERVED_AFTER_ACTION')reasons.push('INSUFFICIENT_EVIDENCE');
        if(r.comparisonWarnings.length||r.comparisonReasons.length||r.pairedN<1||r.pairs.some(p=>p.comparison.status!=='COMPARABLE'))reasons.push('COMPARISON_QUALITY');
        if(r.confounders.length)reasons.push('CONFOUNDER_PRESENT');
        if(r.actionExecutions.length!==1)reasons.push('MULTIPLE_ACTIONS');
        if(r.unit!==cohort.unit)reasons.push('WRONG_UNIT');
        if(r.platformCode!==cohort.platformCode)reasons.push('WRONG_PLATFORM');if(r.channelCode!==cohort.channelCode)reasons.push('WRONG_CHANNEL');
        if(canonicalChecksum(r.metric)!==canonicalChecksum(cohort.metric))reasons.push('WRONG_METRIC_VERSION_OR_NAMESPACE');
        if(!r.actionExecutions.every(a=>a.actionId===cohort.actionId&&a.actionVersion===cohort.actionVersion))reasons.push('WRONG_ACTION_VERSION');
        const applied=r.actionExecutions.map(a=>Date.parse(a.actualAppliedAt)),last=Math.max(...applied),from=(Date.parse(r.observationWindow.afterFrom)-last)/86400000,to=(Date.parse(r.observationWindow.afterTo)-last)/86400000;
        if(!Number.isFinite(from)||!Number.isFinite(to)||from<cohort.observationWindow.minDaysAfterAction||to>cohort.observationWindow.maxDaysAfterAction||from>to)reasons.push('OUTSIDE_OBSERVATION_WINDOW');
        if(!Number.isSafeInteger(r.rawObservationCount)||!Number.isSafeInteger(r.pairedN)||r.rawObservationCount<2*r.pairedN)reasons.push('INVALID_SAMPLE_COUNTS');
        delta=r.delta===null?null:cohort.unit==='PERCENTAGE_POINTS'?rounded(r.delta*100):r.delta;
        if(delta!==null&&(!Number.isFinite(delta)||cohort.unit==='PERCENTAGE_POINTS'&&Math.abs(delta)>100||cohort.unit==='COUNT'&&!Number.isSafeInteger(delta)))reasons.push('INVALID_DELTA_UNIT');
      }
      const item:Lineage={candidateId:canonicalChecksum([project.id,e.experimentId]),projectId:project.id,clientKey:canonicalChecksum(project.client.id),experimentId:e.experimentId,experimentVersion:e.version,executionId:null,resultVersion:r?.resultVersion??null,resultChecksum:r?.checksum??null,
        sourceFingerprint:canonicalChecksum({experiment:e.checksum,stored:view?.stored.checksum??null,sourceState:view?.sourceState??null,currentDelta:view?.currentDelta??null,scope:scope.scopeHash}),consentStateHash:canonicalChecksum({state:consent.stateHash,allowed:consent.allowed,reasons:consent.reasons}),consentAllowed:consent.allowed,reasons:[...new Set(reasons)].sort(),selected:false};
      lineage.push(item);if(!item.reasons.length&&delta!==null&&r)eligible.push({lineage:item,delta,afterTo:r.observationWindow.afterTo,rawN:r.rawObservationCount,pairedN:r.pairedN});
    }
    // Executed work without an Experiment must remain visible in the missingness denominator.
    for(const v of executions.filter(v=>!covered.has(v.record.executionId)&&Date.parse(v.record.audit.createdAt)<=Date.parse(cutoffAt))){
      const r=v.record;if(r.projectId!==project.id)throw Error('Foreign Action source');
      const reasons=[v.sourceState!=='CURRENT'?'ACTION_SOURCE_CHANGED':!v.currentActualAppliedAt?'ACTION_NOT_APPLIED':'NO_FOLLOW_UP'];
      if(r.environment!==cohort.environment)reasons.push('WRONG_ENVIRONMENT');if(r.selection.actionId!==cohort.actionId)reasons.push('WRONG_ACTION');else if(r.selection.actionVersion!==cohort.actionVersion)reasons.push('WRONG_ACTION_VERSION');
      const ready=reader.readReadiness(project.id,r.evaluationId,actor),scope=scopeReasons(project,r.evaluationId,ready?.scope.platformCode??'',ready?.scope.channelCode??null,r.selection.ruleId);reasons.push(...scope.reasons);
      lineage.push({candidateId:canonicalChecksum([project.id,r.executionId]),projectId:project.id,clientKey:canonicalChecksum(project.client.id),experimentId:null,experimentVersion:null,executionId:r.executionId,resultVersion:null,resultChecksum:null,sourceFingerprint:canonicalChecksum({record:r.checksum,state:v.sourceState,actual:v.currentActualAppliedAt,scope:scope.scopeHash}),consentStateHash:canonicalChecksum('NO_EXPERIMENT_CONSENT_REFERENCES'),consentAllowed:false,reasons:[...new Set(reasons)].sort(),selected:false});
    }
  }
  const ordered=eligible.slice().sort((a,b)=>Date.parse(b.afterTo)-Date.parse(a.afterTo)||a.lineage.projectId.localeCompare(b.lineage.projectId)||a.lineage.experimentId!.localeCompare(b.lineage.experimentId!)||(b.lineage.resultVersion??0)-(a.lineage.resultVersion??0));
  const projectsSeen=new Set<string>(),clientsSeen=new Set<string>(),selected:Eligible[]=[];
  for(const item of ordered){const l=item.lineage;if(projectsSeen.has(l.projectId))l.reasons.push('PROJECT_ALREADY_CONTRIBUTED');else if(clientsSeen.has(l.clientKey))l.reasons.push('SHARED_CLIENT_NOT_INDEPENDENT');else{l.selected=true;selected.push(item);projectsSeen.add(l.projectId);clientsSeen.add(l.clientKey);}}
  lineage.sort((a,b)=>a.candidateId.localeCompare(b.candidateId));for(const l of lineage)l.reasons.sort();
  const counts:Record<string,number>={};for(const l of lineage)for(const reason of l.reasons)counts[reason]=(counts[reason]??0)+1;
  const byReason=Object.fromEntries(Object.entries(counts).sort(([a],[b])=>a.localeCompare(b))),insufficient=selected.length<policy.minimumProjectCount;
  const stats=distribution(selected.map(v=>v.delta));let interpretationStatus:'INSUFFICIENT_COHORT'|'DESCRIPTIVE_ONLY'|'REPEATED_PATTERN'=insufficient?'INSUFFICIENT_COHORT':'DESCRIPTIVE_ONLY';
  const repeated=policy.repeatedPattern;if(!insufficient&&cohort.environment==='SYNTHETIC'&&repeated&&stats&&selected.length>=repeated.minimumProjects){const n=repeated.direction==='POSITIVE'?stats.positiveCount:repeated.direction==='NEGATIVE'?stats.negativeCount:stats.zeroCount;if(n/selected.length>=repeated.minimumDirectionShare)interpretationStatus='REPEATED_PATTERN';}
  const consentStateHash=canonicalChecksum(lineage.map(l=>({candidate:l.candidateId,state:l.consentStateHash}))),sourceHash=canonicalChecksum({cohort:cohort.checksum,policy:policy.checksum,consentPolicy:CONSENT_POLICY_VERSION,cutoffAt,lineage,consentStateHash});
  const body={aggregationVersion:AGGREGATION_VERSION,classification:'AGGREGATED_OBSERVATION' as const,cohortSpec:cohort,cohortChecksum:cohort.checksum,policyChecksum:policy.checksum,policyId:policy.policyId,policyVersion:policy.version,consentPolicyVersion:CONSENT_POLICY_VERSION,
    cutoffAt,checkedAt,environment:cohort.environment,metric:{...cohort.metric,unit:cohort.unit},action:{id:cohort.actionId,version:cohort.actionVersion},platformCode:cohort.platformCode,channelCode:cohort.channelCode,
    selectionBias:{candidateCount:lineage.length,eligibleCandidateCount:eligible.length,includedCount:selected.length,excludedCount:lineage.length-selected.length},
    included:{projectCount:selected.length,experimentCount:selected.length,rawObservationCount:selected.reduce((s,v)=>s+v.rawN,0),pairedObservationCount:2*selected.reduce((s,v)=>s+v.pairedN,0)},
    excluded:{total:lineage.length-selected.length,byReason},distribution:insufficient?null:stats,privacyStatus:insufficient?'SMALL_COHORT_SUPPRESSED' as const:'AGGREGATE_ONLY' as const,interpretationStatus,
    dataQuality:'DESCRIPTIVE_ONLY' as const,lineage,sourceHash,consentStateHash};
  const aggregationId='insight-aggregation-'+canonicalChecksum({cohort:cohort.checksum,cutoffAt,checkedAt,sourceHash});return immutable({...body,aggregationId,checksum:canonicalChecksum({...body,aggregationId})});
}
export type InsightAggregationRun=ReturnType<typeof aggregateInsightCohort>;
