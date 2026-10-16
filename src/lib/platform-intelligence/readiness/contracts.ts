import {z} from 'zod';
import {canonicalChecksum,immutable,identifier,timestamp,platformSchema,channelSchema,industrySchema} from '../knowledge/contracts';
import {getChannel} from '../channels';
import type {PlatformRuleRegistry} from '../rules/registry';

export const EVALUATION_VERSION='platform-readiness-evaluation-v1' as const;
export const CONFIDENCE_VERSION='readiness-evidence-confidence-v1' as const;
export const READINESS_RULESET_VERSION='readiness-ruleset-policy-v1' as const;
export const checkStatusSchema=z.enum(['PASS','WARN','FAIL','UNKNOWN','NOT_APPLICABLE']);
const scopeFields={platformCode:platformSchema,channelCode:channelSchema.nullable(),
  country:identifier.nullable().default(null),language:identifier.nullable().default(null),industry:industrySchema.nullable().default(null),
  region:identifier.nullable().default(null),surface:identifier.nullable().default(null)};
const checkScope=(v:{channelCode:string|null;platformCode:string},ctx:z.RefinementCtx)=>{if(v.channelCode&&getChannel(v.channelCode)?.platformCode!==v.platformCode)ctx.addIssue({code:'custom',message:'Channel/platform mismatch'});};
export const evaluationScopeSchema=z.strictObject({projectId:identifier,...scopeFields,evidenceAsOf:timestamp}).superRefine(checkScope);
export type EvaluationScope=z.infer<typeof evaluationScopeSchema>;
const scopeInput=z.strictObject({...scopeFields,projectId:identifier.nullable().default(null)}).superRefine(checkScope);
const sourceSchema=z.strictObject({kind:z.enum(['PAGE','AUDIT','RESPONSE']),id:identifier});
export const rulePolicySchema=z.strictObject({ruleId:identifier,ruleVersion:z.number().int().positive(),weight:z.number().int().min(1).max(10000),maxAgeSeconds:z.number().int().min(1).max(31536000),source:sourceSchema.nullable(),robotsAgent:identifier.optional(),noindexScope:z.enum(['HTML_META','HTML_AND_HEADER']).optional(),evidenceExpiresAt:timestamp.optional()});
export type ReadinessRulePolicy=z.infer<typeof rulePolicySchema>;
export const scorePolicySchema=z.strictObject({version:z.literal('readiness-weighted-bounds-v1'),weightSource:z.literal('EXPLICIT_RULE_WEIGHTS'),credits:z.strictObject({PASS:z.literal(1),WARN:z.number().min(0).max(1),FAIL:z.literal(0)})});
const bindingSchema=z.strictObject({
  ruleSetId:identifier,ruleSetVersion:z.number().int().positive(),environment:z.enum(['PRODUCTION','SYNTHETIC']),scope:scopeInput,
  scorePolicy:scorePolicySchema,checks:z.array(rulePolicySchema).min(1).max(1000),reviewedBy:identifier,reviewedAt:timestamp,reason:z.string().trim().min(1).max(1000),
});
export type ReadinessRuleSetInput=z.input<typeof bindingSchema>;
export type ReadinessRuleSetVersion=Readonly<z.infer<typeof bindingSchema>&{contractVersion:typeof READINESS_RULESET_VERSION;sourceRuleSetChecksum:string;selectionChecksum:string;checksum:string}>;
/** Versioned extension of 8-2: scoring/freshness policy is sealed with the exact source RuleSet. */
export function createReadinessRuleSet(input:ReadinessRuleSetInput,catalog:PlatformRuleRegistry):ReadinessRuleSetVersion {
  const v=bindingSchema.parse(input),source=catalog.getRuleSetVersion(v.ruleSetId,v.ruleSetVersion);
  if(!source||source.reviewStatus!=='APPROVED'||!source.reviewedAt||Date.parse(source.reviewedAt)>Date.parse(v.reviewedAt))throw Error('Approved exact RuleSet version required');
  const {checksum,...sourceContent}=source;if(canonicalChecksum(sourceContent)!==checksum)throw Error('Source RuleSet checksum mismatch');
  const keys=v.checks.map(c=>JSON.stringify([c.ruleId,c.ruleVersion]));
  if(v.checks.some(c=>c.source!==null)&&!v.scope.projectId)throw Error('Pinned customer evidence requires a project-bound policy');
  if(new Set(keys).size!==keys.length||keys.length!==source.ruleRefs.length)throw Error('Explicit policy must cover each Rule exactly once');
  for(const [index,ref] of source.ruleRefs.entries()){
    const rule=catalog.getRuleVersion(ref.ruleId,ref.version),policy=v.checks.find(c=>c.ruleId===ref.ruleId&&c.ruleVersion===ref.version);
    if(!rule||!policy||rule.checksum!==source.ruleChecksums[index]||rule.reviewStatus!=='APPROVED'||rule.basis!=='CONFIRMED')throw Error('Approved confirmed Rule/checksum required');
    const {checksum:ruleChecksum,...ruleContent}=rule;if(canonicalChecksum(ruleContent)!==ruleChecksum)throw Error('Rule checksum mismatch');
    if(rule.checkType==='ROBOTS_ACCESS'&&!policy.robotsAgent)throw Error('Explicit robots agent policy required; no platform-to-bot inference');
    if(rule.checkType==='NOINDEX'&&!policy.noindexScope)throw Error('Explicit noindex inspection scope required');
    const expected=rule.checkType==='ROBOTS_ACCESS'?'AUDIT':rule.checkType==='CITATION_PRESENT'?'RESPONSE':'PAGE';
    if(policy.source&&policy.source.kind!==expected)throw Error('Check/source kind mismatch');
  }
  const content={...v,contractVersion:READINESS_RULESET_VERSION,sourceRuleSetChecksum:source.checksum};
  // Customer source selections are evaluation inputs, not Rule definitions/weights.
  const policyContent={...content,checks:content.checks.map(({source:selection,...policy})=>{void selection;return policy;})};
  const selectionChecksum=canonicalChecksum({projectId:v.scope.projectId,selections:v.checks.map(c=>({ruleId:c.ruleId,ruleVersion:c.ruleVersion,source:c.source}))});
  return immutable({...content,selectionChecksum,checksum:canonicalChecksum(policyContent)});
}
export const productionReadinessRuleSets:readonly ReadinessRuleSetVersion[]=Object.freeze([]);
export type ReadinessEvidenceRef=Readonly<{projectId:string;kind:'PAGE'|'AUDIT'|'RESPONSE'|'OBSERVATION_CONTEXT';id:string;checksum:string;at:string}>;
export type ReadinessItem=Readonly<{
  ruleId:string;ruleVersion:number;ruleChecksum:string;checkType:string;weight:number;status:z.infer<typeof checkStatusSchema>;reasonCode:string;evaluatedAt:string;
  evidenceRefs:readonly ReadinessEvidenceRef[];knowledgeRefs:readonly {knowledgeId:string;version:number;role:string;checksum:string;knowledgeType:string;lastVerifiedAt:string|null}[];
  verifiedEvidence:boolean;contextComplete:boolean;stale:boolean;actionCandidateRefs:readonly string[];
}>;
export type ReadinessEvaluation=Readonly<{
  evaluationId:string;evaluationVersion:typeof EVALUATION_VERSION;label:'Internal Readiness';scope:EvaluationScope;
  environment:'PRODUCTION'|'SYNTHETIC';allowDemo:boolean;
  ruleSetId:string|null;ruleSetVersion:number|null;ruleSetChecksum:string|null;sourceRuleSetChecksum:string|null;
  evidenceSelectionChecksum:string|null;
  scorePolicy:z.infer<typeof scorePolicySchema>|null;confidencePolicyVersion:typeof CONFIDENCE_VERSION;
  status:'READY'|'PARTIAL'|'NOT_CONFIGURED'|'INVALID'|'STALE';reasonCode:string;
  score:number|null;lowerBound:number|null;upperBound:number|null;coverage:number|null;W:number;K:number;P:number;
  confidence:'HIGH'|'MEDIUM'|'LOW'|'INSUFFICIENT';counts:Readonly<{pass:number;warn:number;fail:number;unknown:number;notApplicable:number}>;
  items:readonly ReadinessItem[];checksum:string;
}>;
