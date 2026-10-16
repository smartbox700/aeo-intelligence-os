import {z} from 'zod';
import type {Staff} from '../../auth';
import {canonicalChecksum,immutable,identifier,timestamp,industrySchema,platformSchema,channelSchema,auditCommandSchema} from '../knowledge/contracts';
import type {AuditCommand} from '../knowledge/contracts';
import {metricRefSchema} from '../experiments/contracts';
import {getChannel} from '../channels';

export const COHORT_VERSION='insight-cohort-v1' as const;
export const AGGREGATION_VERSION='insight-aggregation-v1' as const;
export const CONSENT_POLICY_VERSION='current-research-and-statistics-consent-v1' as const;
export const DISTRIBUTION_VERSION='equal-project-type7-quantiles-v1' as const;
export const cohortInputSchema=z.strictObject({
  industry:industrySchema,subIndustry:identifier.nullable().default(null),platformCode:platformSchema,channelCode:channelSchema,
  actionId:identifier,actionVersion:z.number().int().positive(),metric:metricRefSchema,unit:z.enum(['PERCENTAGE_POINTS','COUNT']),
  observationWindow:z.strictObject({minDaysAfterAction:z.number().nonnegative(),maxDaysAfterAction:z.number().nonnegative()}),environment:z.enum(['PRODUCTION','SYNTHETIC']),
  country:identifier.nullable().default(null),language:identifier.nullable().default(null),regionGroup:identifier.nullable().default(null),issueType:identifier.nullable().default(null),ruleId:identifier.nullable().default(null),
  singleActionOnly:z.literal(true).default(true),attributionType:z.literal('OBSERVED_AFTER_ACTION').default('OBSERVED_AFTER_ACTION'),comparisonQuality:z.literal('NO_WARNINGS').default('NO_WARNINGS'),
}).superRefine((v,ctx)=>{
  if(getChannel(v.channelCode)?.platformCode!==v.platformCode)ctx.addIssue({code:'custom',message:'Cohort platform/channel mismatch'});
  if(v.unit!==(v.metric.metricId.endsWith(' Rate')?'PERCENTAGE_POINTS':'COUNT'))ctx.addIssue({code:'custom',message:'Cohort metric/unit mismatch'});
  if(v.observationWindow.minDaysAfterAction>v.observationWindow.maxDaysAfterAction)ctx.addIssue({code:'custom',message:'Cohort day interval reversed'});
});
export type CohortInput=z.input<typeof cohortInputSchema>;
export type InsightCohort=Readonly<z.infer<typeof cohortInputSchema>&{contractVersion:typeof COHORT_VERSION;checksum:string}>;
export function createInsightCohort(input:CohortInput):InsightCohort {const body={...cohortInputSchema.parse(input),contractVersion:COHORT_VERSION};return immutable({...body,checksum:canonicalChecksum(body)});}
export function assertInsightCohort(raw:InsightCohort){const {checksum,contractVersion,...input}=raw,expected=createInsightCohort(input);if(contractVersion!==COHORT_VERSION||expected.checksum!==checksum)throw Error('Cohort integrity mismatch');return expected;}
const repeated=z.strictObject({minimumProjects:z.number().int().positive(),direction:z.enum(['POSITIVE','ZERO','NEGATIVE']),minimumDirectionShare:z.number().min(0).max(1)});
export const policyInputSchema=z.strictObject({policyId:identifier,version:z.number().int().positive(),environment:z.enum(['PRODUCTION','SYNTHETIC']),minimumProjectCount:z.number().int().positive(),
  projectSelection:z.literal('LATEST_ELIGIBLE_AFTER_TO'),independence:z.literal('ONE_PROJECT_ONE_CLIENT_CONTRIBUTION'),privacy:z.literal('SUPPRESS_SMALL_COHORT'),repeatedPattern:repeated.nullable(),
}).superRefine((v,ctx)=>{if(v.environment==='PRODUCTION'&&v.repeatedPattern)ctx.addIssue({code:'custom',message:'Production repeated-pattern thresholds are not enabled in v1'});});
export type AggregationPolicyInput=z.infer<typeof policyInputSchema>;
export type AggregationPolicy=Readonly<AggregationPolicyInput&{reviewStatus:'APPROVED';reviewedBy:string;reviewedAt:string;reason:string;consentPolicyVersion:typeof CONSENT_POLICY_VERSION;distributionVersion:typeof DISTRIBUTION_VERSION;checksum:string}>;
export function assertInsightOwner(actor:Staff,purpose:string){if(actor.disabled||actor.role!=='OWNER'||purpose!=='INTERNAL_RESEARCH')throw Error('OWNER internal research purpose required');}
export function approveAggregationPolicy(input:AggregationPolicyInput,actor:Staff,rawAudit:AuditCommand):AggregationPolicy {
  assertInsightOwner(actor,'INTERNAL_RESEARCH');const audit=auditCommandSchema.parse(rawAudit);if(audit.actorId!==actor.id)throw Error('Insight policy audit actor mismatch');
  const body={...policyInputSchema.parse(input),reviewStatus:'APPROVED' as const,reviewedBy:actor.id,reviewedAt:audit.createdAt,reason:audit.reason,consentPolicyVersion:CONSENT_POLICY_VERSION,distributionVersion:DISTRIBUTION_VERSION};return immutable({...body,checksum:canonicalChecksum(body)});
}
export function assertAggregationPolicy(policy:AggregationPolicy){
  const {checksum,reviewStatus,reviewedBy,reviewedAt,reason,consentPolicyVersion,distributionVersion,...input}=policy;policyInputSchema.parse(input);identifier.parse(reviewedBy);timestamp.parse(reviewedAt);z.string().trim().min(1).max(1000).parse(reason);
  if(reviewStatus!=='APPROVED'||consentPolicyVersion!==CONSENT_POLICY_VERSION||distributionVersion!==DISTRIBUTION_VERSION||canonicalChecksum({...input,reviewStatus,reviewedBy,reviewedAt,reason,consentPolicyVersion,distributionVersion})!==checksum)throw Error('Approved aggregation policy integrity mismatch');return policy;
}
export const productionAggregationPolicies:readonly AggregationPolicy[]=Object.freeze([]);
export const productionInsightRecords:readonly never[]=Object.freeze([]);
