import {z} from 'zod';
import {canonicalChecksum,immutable,identifier,timestamp,platformSchema,channelSchema} from '../knowledge/contracts';
import {getChannel} from '../channels';
import {CALCULATION_VERSION} from '../../reporting-metrics';

export const EXPERIMENT_VERSION='before-action-after-v1' as const;
export const PAIRING_VERSION='exact-query-run-condition-v1' as const;
export const ATTRIBUTION_VERSION='descriptive-attribution-v1' as const;
export const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const metricIds=['Brand Mention Rate','Recommendation Inclusion Rate','Official Citation Rate','clientCount','recommendations','citations'] as const;
export const metricRefSchema=z.strictObject({metricId:z.enum(metricIds),metricVersion:z.literal(CALCULATION_VERSION),namespace:z.literal('confirmedMetrics')});
export const snapshotRefSchema=z.strictObject({sourceType:z.enum(['VERIFIED_OBSERVATION_SET','PILOT_MEASUREMENT']),sourceId:identifier,sourceHash:hash,checksum:hash,projectId:identifier,kind:z.enum(['PRODUCTION','SYNTHETIC']),conditionHash:hash,metricVersion:z.literal(CALCULATION_VERSION),frozenAt:timestamp});
export type MeasurementSnapshotReference=z.infer<typeof snapshotRefSchema>;
export const confounderSchema=z.enum(['MODEL_CHANGED','CHANNEL_CHANGED','QUERY_CHANGED','COMPETITOR_CHANGED','WEBSITE_MAJOR_CHANGE','SEASONALITY','EXTERNAL_MEDIA_EXPOSURE','PAID_CAMPAIGN','UNKNOWN_EXTERNAL_CHANGE','MULTIPLE_ACTIONS']);
export const experimentDraftSchema=z.strictObject({
  experimentId:identifier,version:z.number().int().positive(),projectId:identifier,platformCode:platformSchema,channelCode:channelSchema,
  environment:z.enum(['PRODUCTION','SYNTHETIC']),issueRef:identifier.nullable(),readinessEvaluationId:identifier,
  readinessItemRef:z.strictObject({ruleId:identifier,ruleVersion:z.number().int().positive()}),
  beforeSnapshotRef:snapshotRefSchema,afterSnapshotRef:snapshotRefSchema,
  actionExecutionRefs:z.array(z.strictObject({executionId:identifier,revision:z.number().int().positive(),checksum:hash,actionId:identifier,actionVersion:z.number().int().positive(),actionChecksum:hash,role:z.enum(['PRIMARY','CO_INTERVENTION','CONFOUNDER'])})).min(1).max(100),
  querySetRef:z.strictObject({id:identifier,checksum:hash}),measurementPlanRef:z.strictObject({id:identifier,checksum:hash}),metric:metricRefSchema,
  window:z.strictObject({beforeFrom:timestamp,beforeTo:timestamp,afterFrom:timestamp,afterTo:timestamp}),
  confounders:z.array(confounderSchema),
  consentRefs:z.array(z.strictObject({projectId:identifier,agreementId:identifier,consentId:identifier})),
}).superRefine((v,ctx)=>{
  if(getChannel(v.channelCode)?.platformCode!==v.platformCode)ctx.addIssue({code:'custom',message:'Experiment channel/platform mismatch'});
  if(v.beforeSnapshotRef.projectId!==v.projectId||v.afterSnapshotRef.projectId!==v.projectId||v.consentRefs.some(r=>r.projectId!==v.projectId))ctx.addIssue({code:'custom',message:'Experiment source project mismatch'});
  if(v.beforeSnapshotRef.kind!==v.environment||v.afterSnapshotRef.kind!==v.environment)ctx.addIssue({code:'custom',message:'Experiment environment mismatch'});
  if(Date.parse(v.window.beforeFrom)>Date.parse(v.window.beforeTo)||Date.parse(v.window.afterFrom)>Date.parse(v.window.afterTo)||Date.parse(v.window.beforeTo)>=Date.parse(v.window.afterFrom))ctx.addIssue({code:'custom',message:'Invalid separated observation windows'});
  const ids=v.actionExecutionRefs.map(r=>r.executionId);if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Duplicate Action execution'});
  if(!v.actionExecutionRefs.some(r=>r.role==='PRIMARY'))ctx.addIssue({code:'custom',message:'Explicit tracked PRIMARY Action required'});
});
export type ExperimentDraft=z.infer<typeof experimentDraftSchema>;
export type Experiment=Readonly<ExperimentDraft&{status:'DRAFT'|'RETIRED';createdBy:string;createdAt:string;reason:string;contractVersion:typeof EXPERIMENT_VERSION;checksum:string}>;
export function sealExperiment(input:ExperimentDraft,actorId:string,at:string,reason:string,status:Experiment['status']='DRAFT'):Experiment {
  const draft=experimentDraftSchema.parse(input);identifier.parse(actorId);timestamp.parse(at);z.string().trim().min(1).max(1000).parse(reason);
  const body={...draft,status,createdBy:actorId,createdAt:at,reason,contractVersion:EXPERIMENT_VERSION};return immutable({...body,checksum:canonicalChecksum(body)});
}
export function assertExperiment(raw:Experiment):Experiment {
  const {checksum,status,createdBy,createdAt,reason,contractVersion,...draft}=raw;
  if(!['DRAFT','RETIRED'].includes(status)||contractVersion!==EXPERIMENT_VERSION)throw Error('Invalid Experiment contract');
  const expected=sealExperiment(draft,createdBy,createdAt,reason,status);if(expected.checksum!==checksum)throw Error('Experiment checksum mismatch');return expected;
}
