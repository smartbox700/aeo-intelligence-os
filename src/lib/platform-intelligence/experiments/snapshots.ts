import {z} from 'zod';
import type {ProjectData,ResponseRecord} from '../../types';
import {exclusionReason} from '../../visibility';
import {observationIdentity,CALCULATION_VERSION} from '../../reporting-metrics';
import {pilotSnapshotFresh} from '../../pilot-measurement';
import {buildResponseObservationContext} from '../observations/adapters';
import type {ObservationSupplements} from '../observations/adapters';
import type {CanonicalObservationContext} from '../observations/context';
import {canonicalChecksum,immutable,identifier,timestamp} from '../knowledge/contracts';
import type {MeasurementSnapshotReference} from './contracts';

export const selectionSchema=z.strictObject({sourceId:identifier,environment:z.enum(['PRODUCTION','SYNTHETIC']),questionIds:z.array(identifier).min(1),studyId:identifier.nullable(),phase:z.enum(['BASELINE','FOLLOW_UP']),from:timestamp,to:timestamp,frozenAt:timestamp,pilotAgreementId:identifier.optional(),pilotSnapshotId:identifier.optional()});
export const supplementsSchema=z.strictObject({language:z.string().optional(),modelVersion:z.string().optional(),loggedIn:z.enum(['YES','NO','UNKNOWN']).optional(),personalizationState:z.enum(['ENABLED','DISABLED','UNKNOWN']).optional(),freshConversation:z.enum(['TRUE','FALSE','UNKNOWN']).optional()});
export type SnapshotSelection=z.infer<typeof selectionSchema>;
export type SnapshotObservation=Readonly<{responseId:string;sourceHash:string;context:CanonicalObservationContext|null;reasons:readonly string[];identityHash:string}>;
export type MeasurementSnapshot=Readonly<{ref:MeasurementSnapshotReference;selection:SnapshotSelection;supplements:ObservationSupplements;querySetRef:{id:string;checksum:string};measurementPlanRef:{id:string;checksum:string};observations:readonly SnapshotObservation[];upstreamHash:string|null}>;

/** Existing verified-observation eligibility, with explicit evidenceAsOf instead of a wall clock. */
export function experimentObservationExclusions(p:ProjectData,r:ResponseRecord,asOf:string):string[]{
  const reasons:string[]=[];
  if(r.kind==='DEMO')reasons.push('DEMO');
  if(r.classification==='INTERNAL')reasons.push('INTERNAL_ONLY');
  if(!['CONSUMER_UI_MANUAL','MANUAL_OBSERVATION','MANUAL_UI','API_OBSERVATION'].includes(r.kind))reasons.push('UNSUPPORTED_METHOD');
  if(!p.questions.some(q=>q.id===r.questionId)||r.consumer&&r.consumer.projectId!==p.id)reasons.push('WRONG_PROJECT');
  if(!r.rawText.trim()||!r.provider.trim()||!r.model.trim()||!r.region.trim()||!Number.isFinite(Date.parse(r.observedAt)))reasons.push('MISSING_OBSERVATION_METADATA');
  if(Date.parse(r.observedAt)>Date.parse(asOf))reasons.push('OBSERVATION_AFTER_EVIDENCE_AS_OF');
  if(!(r.consumer?.actualQuestion||r.measurement?.questionText||r.questionText)?.trim())reasons.push('MISSING_QUERY');
  if(r.accuracy==='INACCURATE')reasons.push('INACCURATE');
  const v=r.verification;
  if(v?.status!=='VERIFIED'||!v.reviewer.trim()||v.note.trim().length<5||!v.sourceConfirmed||!Number.isFinite(Date.parse(v.at??''))||Date.parse(v.at!)>Date.parse(asOf)||Date.parse(v.at!)<Date.parse(r.observedAt))reasons.push('UNVERIFIED');
  if(r.entityAnalysis?.status!=='READY')reasons.push('ENTITY_REVIEW_REQUIRED');
  if(exclusionReason(r))reasons.push('EXISTING_METRIC_EXCLUSION');
  if(p.client.citedDiagnoses?.some(s=>s.responseIds.includes(r.id)))reasons.push('CITED_REQUIRES_SNAPSHOT_ADAPTER');
  return reasons;
}
export function freezeExperimentMeasurement(p:ProjectData,raw:SnapshotSelection,extra:ObservationSupplements={}):MeasurementSnapshot {
  const s=selectionSchema.parse(raw),supplements=supplementsSchema.parse(extra);if(new Set(s.questionIds).size!==s.questionIds.length||s.questionIds.some(id=>!p.questions.some(q=>q.id===id)))throw Error('Snapshot question set ownership/duplicates');
  if(Date.parse(s.from)>Date.parse(s.to)||Date.parse(s.to)>Date.parse(s.frozenAt))throw Error('Snapshot time window invalid');
  if(s.studyId&&!p.client.researchStudies?.some(study=>study.id===s.studyId))throw Error('Owned measurement Study required');
  if(!!s.pilotAgreementId!==!!s.pilotSnapshotId)throw Error('Pilot agreement/snapshot pair required');
  let upstreamHash:string|null=null,pilotIds:string[]|null=null,pilotManifest:string[]|null=null;
  if(s.pilotAgreementId){
    const a=p.operations?.pilot?.agreements.find(a=>a.id===s.pilotAgreementId&&a.projectId===p.id&&a.clientId===p.client.id),snapshot=a?.snapshots.find(v=>v.id===s.pilotSnapshotId);
    if(!a||!snapshot||!pilotSnapshotFresh(p,a,snapshot)||snapshot.phase!==s.phase||Date.parse(snapshot.at)>Date.parse(s.frozenAt)||snapshot.data.calculationVersion!==CALCULATION_VERSION||s.environment==='PRODUCTION'&&snapshot.data.kind!=='CLIENT')throw Error('Current owned verified Pilot snapshot required');
    upstreamHash=canonicalChecksum({snapshot,plan:a.plans.find(plan=>plan.id===snapshot.planId)});pilotIds=snapshot.data.responseIds;pilotManifest=[...pilotIds,...snapshot.data.excluded.map(e=>e.id)];
    if(new Set(pilotIds).size!==pilotIds.length||canonicalChecksum(Object.keys(snapshot.data.fingerprints).sort())!==canonicalChecksum(pilotIds.slice().sort())||pilotManifest.some(id=>!p.responses.some(r=>r.id===id)))throw Error('Pilot response fingerprint manifest required');
    if(!a.plans.some(plan=>plan.id===snapshot.planId&&plan.studyId===s.studyId))throw Error('Pilot measurement plan mismatch');
  }
  const questions=p.questions.filter(q=>s.questionIds.includes(q.id)).sort((a,b)=>a.id.localeCompare(b.id));
  const querySetRef={id:'query-set-'+canonicalChecksum(s.questionIds.slice().sort()),checksum:canonicalChecksum(questions)};
  const study=s.studyId?p.client.researchStudies?.find(study=>study.id===s.studyId):null;
  const measurementPlanRef={id:s.studyId??'explicit-observation-window',checksum:canonicalChecksum({querySetRef,study:study??null})};
  // Freeze all rows in the declared scope; callers cannot cherry-pick response IDs.
  const rows=p.responses.filter(r=>s.questionIds.includes(r.questionId)&&Date.parse(r.observedAt)>=Date.parse(s.from)&&Date.parse(r.observedAt)<=Date.parse(s.to)&&(pilotManifest?pilotManifest.includes(r.id):s.studyId?r.consumer?.studyId===s.studyId&&r.consumer.phase===s.phase:!r.consumer?.studyId)).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate response ID');
  const observations:SnapshotObservation[]=rows.map(r=>{
    const reasons=experimentObservationExclusions(p,r,s.frozenAt);if(pilotIds&&!pilotIds.includes(r.id))reasons.push('NOT_IN_FROZEN_PILOT_SNAPSHOT');
    let context:CanonicalObservationContext|null=null;try{context=buildResponseObservationContext(p,r.id,supplements);}catch{reasons.push('INVALID_CONTEXT');}
    return {responseId:r.id,sourceHash:canonicalChecksum(r),context,reasons,identityHash:canonicalChecksum(observationIdentity(r))};
  });
  const sourceHash=canonicalChecksum({selection:s,querySetRef,measurementPlanRef,upstreamHash,observations,metricContext:{website:p.client.website,competitors:p.client.competitors}});
  const content={sourceType:s.pilotSnapshotId?'PILOT_MEASUREMENT' as const:'VERIFIED_OBSERVATION_SET' as const,sourceId:s.sourceId,sourceHash,projectId:p.id,kind:s.environment,conditionHash:canonicalChecksum(observations.map(o=>o.context?.conditionHash??null)),metricVersion:CALCULATION_VERSION as typeof CALCULATION_VERSION,frozenAt:s.frozenAt};
  return immutable({ref:{...content,checksum:canonicalChecksum(content)},selection:s,supplements,querySetRef,measurementPlanRef,observations,upstreamHash});
}
export function assertMeasurementSnapshot(p:ProjectData,snapshot:MeasurementSnapshot):MeasurementSnapshot {
  if(snapshot.ref.projectId!==p.id)throw Error('Snapshot project mismatch');
  const rebuilt=freezeExperimentMeasurement(p,snapshot.selection,snapshot.supplements);
  if(canonicalChecksum(rebuilt)!==canonicalChecksum(snapshot))throw Error('STALE_SNAPSHOT_SOURCE');return rebuilt;
}
