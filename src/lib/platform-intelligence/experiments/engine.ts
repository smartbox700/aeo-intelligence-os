import type {Staff} from '../../auth';
import type {ProjectData} from '../../types';
import {assertActionAccess} from '../actions/candidates';
import type {ActionExecutionView} from '../actions/bridge';
import type {ActionDefinitionRepository} from '../actions/definitions';
import {assertActionDefinition} from '../actions/definitions';
import type {ReadinessEvaluation} from '../readiness/contracts';
import {assertReadinessEvaluation} from '../readiness/repository';
import {compareObservationContexts,OBSERVATION_COMPARISON_VERSION} from '../observations/comparison';
import {canonicalChecksum,immutable,timestamp} from '../knowledge/contracts';
import {assertExperiment,EXPERIMENT_VERSION,PAIRING_VERSION,ATTRIBUTION_VERSION} from './contracts';
import type {Experiment} from './contracts';
import {assertMeasurementSnapshot} from './snapshots';
import type {MeasurementSnapshot,SnapshotObservation} from './snapshots';
import {pairedMetric} from './metrics';

export type ExperimentSources={project:ProjectData;before:MeasurementSnapshot;after:MeasurementSnapshot;actionViews:readonly ActionExecutionView[];definitions:ActionDefinitionRepository;readiness:ReadinessEvaluation};
export function evaluateExperiment(raw:Experiment,sources:ExperimentSources,actor:Staff,evidenceAsOf:string,resultVersion:number){
  const experiment=assertExperiment(raw),{project,before,after,definitions}=sources;assertActionAccess(actor,experiment.projectId);timestamp.parse(evidenceAsOf);
  if(!Number.isSafeInteger(resultVersion)||resultVersion<1||Date.parse(evidenceAsOf)<Date.parse(experiment.createdAt))throw Error('Invalid Experiment result version/asOf');
  if(experiment.status==='RETIRED')throw Error('Retired Experiment cannot generate results');
  if(project.id!==experiment.projectId)throw Error('Experiment source project mismatch');
  const readiness=assertReadinessEvaluation(sources.readiness);
  if(readiness.scope.projectId!==project.id||readiness.scope.platformCode!==experiment.platformCode||readiness.scope.channelCode!==experiment.channelCode||readiness.environment!==experiment.environment||readiness.evaluationId!==experiment.readinessEvaluationId||!readiness.items.some(i=>i.ruleId===experiment.readinessItemRef.ruleId&&i.ruleVersion===experiment.readinessItemRef.ruleVersion))throw Error('Readiness Finding scope mismatch');
  assertMeasurementSnapshot(project,before);assertMeasurementSnapshot(project,after);
  for(const [snapshot,ref] of [[before,experiment.beforeSnapshotRef],[after,experiment.afterSnapshotRef]] as const){
    if(canonicalChecksum(snapshot.ref)!==canonicalChecksum(ref)||snapshot.ref.kind!==experiment.environment||Date.parse(snapshot.ref.frozenAt)>Date.parse(evidenceAsOf))throw Error('Pinned snapshot/environment/asOf mismatch');
    if(canonicalChecksum(snapshot.querySetRef)!==canonicalChecksum(experiment.querySetRef)||canonicalChecksum(snapshot.measurementPlanRef)!==canonicalChecksum(experiment.measurementPlanRef))throw Error('Pinned QuerySet/MeasurementPlan mismatch');
  }
  if(before.selection.phase!=='BASELINE'||after.selection.phase!=='FOLLOW_UP'||before.selection.from!==experiment.window.beforeFrom||before.selection.to!==experiment.window.beforeTo||after.selection.from!==experiment.window.afterFrom||after.selection.to!==experiment.window.afterTo)throw Error('Snapshot observation windows mismatch');
  for(const ref of experiment.consentRefs)if(!project.operations?.pilot?.agreements.some(a=>a.id===ref.agreementId&&a.projectId===project.id&&a.consents.some(c=>c.id===ref.consentId)))throw Error('Owned existing consent reference required');
  const actions=experiment.actionExecutionRefs.map(ref=>{
    const view=sources.actionViews.find(v=>v.record.executionId===ref.executionId),record=view?.record;
    if(!record||record.projectId!==project.id||view!.sourceState!=='CURRENT'||!view!.currentActualAppliedAt||!record.references.actualAppliedAt||record.references.actualAppliedAt!==view!.currentActualAppliedAt||!record.references.proofRefs.length)throw Error('CURRENT actually applied Action with proof required');
    const {checksum,...body}=record;if(canonicalChecksum(body)!==checksum||record.checksum!==ref.checksum||record.revision!==ref.revision)throw Error('Action execution checksum/version mismatch');
    const a=definitions.getVersion(ref.actionId,ref.actionVersion);if(!a||a.reviewStatus!=='APPROVED'||assertActionDefinition(a).checksum!==ref.actionChecksum||record.selection.actionId!==ref.actionId||record.selection.actionVersion!==ref.actionVersion||record.selection.actionChecksum!==ref.actionChecksum||record.environment!==experiment.environment||a.environment!==experiment.environment)throw Error('Pinned approved Action definition/environment required');
    if(record.evaluationId!==experiment.readinessEvaluationId||record.evaluationChecksum!==readiness.checksum||record.selection.ruleId!==experiment.readinessItemRef.ruleId||record.selection.ruleVersion!==experiment.readinessItemRef.ruleVersion)throw Error('Action Finding mismatch');
    if(record.references.proofRefs.some(ref=>ref.projectId!==project.id))throw Error('Cross-project Action proof denied');
    if(a.platformScopes.length&&!a.platformScopes.includes(experiment.platformCode)||a.channelScopes.length&&!a.channelScopes.includes(experiment.channelCode)||a.industryScopes.length&&(!readiness.scope.industry||!a.industryScopes.includes(readiness.scope.industry)))throw Error('Action platform/channel/industry scope mismatch');
    const applied=Date.parse(record.references.actualAppliedAt);
    if(applied>Date.parse(evidenceAsOf)||!a.reviewedAt||Date.parse(a.reviewedAt)>applied||Date.parse(a.effectiveAt)>applied||Date.parse(record.audit.createdAt)>Date.parse(evidenceAsOf))throw Error('Action approval/application/asOf chronology invalid');
    const task=project.tasks.find(t=>t.id===record.references.taskId);
    if(!task)throw Error('Action Task source missing');
    if(experiment.environment==='PRODUCTION'&&(!task.studio?.verification||task.studio.verification.mode==='DEMO'||task.studio.verification.page.kind==='DEMO'||project.operations?.kind==='DEMO'))throw Error('Production Action excludes DEMO');
    return {...ref,actualAppliedAt:record.references.actualAppliedAt,sourceChecksum:record.sourceChecksum,proofRefs:record.references.proofRefs};
  });
  const first=Math.min(...actions.map(a=>Date.parse(a.actualAppliedAt))),last=Math.max(...actions.map(a=>Date.parse(a.actualAppliedAt)));
  if(Date.parse(experiment.window.beforeTo)>=first||Date.parse(experiment.window.afterFrom)<=last)throw Error('Before must strictly precede all Actions; After must strictly follow all Actions');
  const excluded:{side:'BEFORE'|'AFTER';responseId:string;reasons:string[]}[]=[],eligible:{BEFORE:SnapshotObservation[];AFTER:SnapshotObservation[]}={BEFORE:[],AFTER:[]};
  const allIds=[...before.observations,...after.observations].map(o=>o.responseId),duplicates=new Set(allIds.filter((id,i)=>allIds.indexOf(id)!==i));
  for(const [side,snapshot] of [['BEFORE',before],['AFTER',after]] as const){
    const identities=new Map<string,number>();for(const o of snapshot.observations)identities.set(o.identityHash,(identities.get(o.identityHash)??0)+1);
    for(const observation of snapshot.observations){
      const reasons=[...observation.reasons],c=observation.context;
      if(c?.platformCode&&c.platformCode!==experiment.platformCode)throw Error('WRONG_PLATFORM');
      if(duplicates.has(observation.responseId)||(identities.get(observation.identityHash)??0)>1)reasons.push('DUPLICATE_SOURCE');
      if(!c?.queryTextHash)reasons.push('UNKNOWN_QUERY_HASH');if(!c?.runNumber)reasons.push('UNPAIRED_RUN');
      if(c?.status==='CONFLICT'||c?.status==='UNRESOLVED')reasons.push('INVALID_CONTEXT');
      if(reasons.length)excluded.push({side,responseId:observation.responseId,reasons:[...new Set(reasons)]});else eligible[side].push(observation);
    }
  }
  const groups=new Map<string,{BEFORE:SnapshotObservation[];AFTER:SnapshotObservation[]}>();
  for(const side of ['BEFORE','AFTER'] as const)for(const o of eligible[side]){const key=canonicalChecksum([o.context!.queryTextHash,o.context!.runNumber]);const group=groups.get(key)??{BEFORE:[],AFTER:[]};group[side].push(o);groups.set(key,group);}
  const pairs:{beforeId:string;afterId:string;queryTextHash:string;runNumber:number;comparison:ReturnType<typeof compareObservationContexts>}[]=[],comparisonReasons:string[]=[],warnings:string[]=[];
  const methods=new Set([...before.observations,...after.observations].map(o=>o.context?.observationMethod).filter(Boolean));if(methods.size>1)comparisonReasons.push('MIXED_OBSERVATION_METHODS');
  for(const [,group] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    if(group.BEFORE.length!==1||group.AFTER.length!==1){
      for(const side of ['BEFORE','AFTER'] as const)for(const o of group[side]){
        const other=eligible[side==='BEFORE'?'AFTER':'BEFORE'].filter(v=>v.context!.runNumber===o.context!.runNumber),reasons=[group.BEFORE.length>1||group.AFTER.length>1?'AMBIGUOUS_RUN':'UNPAIRED_RUN'];
        if(other.length===1&&other[0].context!.queryTextHash!==o.context!.queryTextHash){const diagnostic=compareObservationContexts(o.context!,other[0].context!);reasons.push('QUERY_CHANGED');comparisonReasons.push(...diagnostic.reasons);warnings.push(...diagnostic.warnings);}
        excluded.push({side,responseId:o.responseId,reasons});
      }continue;
    }
    const a=group.BEFORE[0],b=group.AFTER[0],comparison=compareObservationContexts(a.context!,b.context!);
    const reasons=[...comparison.reasons];if(a.context!.channelCode!==experiment.channelCode||b.context!.channelCode!==experiment.channelCode)reasons.push('WRONG_CHANNEL');
    warnings.push(...comparison.warnings);
    if(reasons.length){comparisonReasons.push(...reasons);excluded.push({side:'BEFORE',responseId:a.responseId,reasons},{side:'AFTER',responseId:b.responseId,reasons});continue;}
    pairs.push({beforeId:a.responseId,afterId:b.responseId,queryTextHash:a.context!.queryTextHash!,runNumber:a.context!.runNumber!,comparison});
  }
  const comparable=pairs.length>0&&comparisonReasons.length===0;
  const left=comparable?pairedMetric(project,pairs.map(pair=>project.responses.find(r=>r.id===pair.beforeId)!),experiment.metric):null;
  const right=comparable?pairedMetric(project,pairs.map(pair=>project.responses.find(r=>r.id===pair.afterId)!),experiment.metric):null;
  const delta=left?.value!==null&&left?.value!==undefined&&right?.value!==null&&right?.value!==undefined?Number((right.value-left.value).toFixed(12)):null;
  const confounders=[...new Set([...experiment.confounders,...actions.length>1?['MULTIPLE_ACTIONS' as const]:[]])].sort();
  // A declared descriptive guard, not a statistical/scientific minimum sample threshold.
  if(pairs.length<2)warnings.push('SINGLE_OR_NO_PAIRED_OBSERVATION');
  if(excluded.length)warnings.push('EXCLUDED_OR_UNMATCHED_OBSERVATIONS');
  const attributionType=comparable&&delta!==null&&!warnings.length&&!confounders.length?'OBSERVED_AFTER_ACTION' as const:'INSUFFICIENT_EVIDENCE' as const;
  const status=comparable?'RESULT_AVAILABLE' as const:'NOT_COMPARABLE' as const;
  const sourceHash=canonicalChecksum({before:before.ref,after:after.ref,actions,readinessChecksum:readiness.checksum,metric:experiment.metric,comparisonPolicy:OBSERVATION_COMPARISON_VERSION,pairingPolicy:PAIRING_VERSION,attributionPolicy:ATTRIBUTION_VERSION,experimentChecksum:experiment.checksum,evidenceAsOf});
  const body={experimentId:experiment.experimentId,experimentVersion:experiment.version,experimentChecksum:experiment.checksum,resultVersion,projectId:project.id,platformCode:experiment.platformCode,channelCode:experiment.channelCode,environment:experiment.environment,evidenceAsOf,
    status,beforeRef:before.ref,afterRef:after.ref,actionExecutions:actions,metric:experiment.metric,before:left,after:right,delta,unit:experiment.metric.metricId.endsWith(' Rate')?'PERCENTAGE_POINTS' as const:'COUNT' as const,displayDelta:delta===null?null:experiment.metric.metricId.endsWith(' Rate')?Number((delta*100).toFixed(10)):delta,
    rawObservationCount:allIds.length,eligibleObservationCount:eligible.BEFORE.length+eligible.AFTER.length,pairedN:pairs.length,excludedN:excluded.length,pairs,excluded,
    attributionType,confidence:attributionType==='OBSERVED_AFTER_ACTION'?'DESCRIPTIVE_ONLY' as const:'LIMITED' as const,comparisonWarnings:[...new Set(warnings)].sort(),comparisonReasons:[...new Set(comparisonReasons.length?comparisonReasons:pairs.length?[]:['NO_EXACT_QUERY_RUN_PAIRS'])].sort(),confounders,
    observationWindow:{...experiment.window,actualAppliedAt:actions.map(a=>({executionId:a.executionId,at:a.actualAppliedAt})),daysAfterAction:(Date.parse(experiment.window.afterTo)-last)/86400000},
    consentRefs:experiment.consentRefs,sourceHash,contractVersion:EXPERIMENT_VERSION,pairingPolicy:PAIRING_VERSION,comparisonPolicy:OBSERVATION_COMPARISON_VERSION,attributionPolicy:ATTRIBUTION_VERSION,
    statement:comparable?'Action 이후 동일 조건 비교에서 기록된 변화이며 인과관계를 의미하지 않습니다.':'비교 가능한 동일 조건 관측이 부족하여 변화를 계산하지 않았습니다.'};
  return immutable({...body,checksum:canonicalChecksum(body)});
}
export type ExperimentResult=ReturnType<typeof evaluateExperiment>;
