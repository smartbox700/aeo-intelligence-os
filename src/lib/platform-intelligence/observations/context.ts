import {createHash} from 'node:crypto';
import {z} from 'zod';
import {resolvePlatformIdentity} from '../resolver';
import {PLATFORM_REGISTRY_VERSION} from '../registry';
import {canonicalChecksum,immutable,identifier,timestamp,platformSchema,channelSchema} from '../knowledge/contracts';

export const OBSERVATION_CONTEXT_VERSION='observation-context-v1' as const;
export const OBSERVATION_CONDITION_VERSION='observation-condition-v1' as const;
export const QUERY_TEXT_HASH_VERSION='query-text-utf8-exact-v1' as const;
const sourceIssueSchema=z.enum(['PROJECT_MISMATCH','QUESTION_TEXT_CONFLICT','METHOD_CONFLICT','STUDY_MISMATCH','STUDY_CONDITION_MISMATCH','SEARCH_CONFLICT','OBSERVED_AT_CONFLICT']);
const issueSchema=z.enum([...sourceIssueSchema.options,'UNKNOWN_consumerScreen','UNKNOWN_channel','UNKNOWN_platformName','UNKNOWN_provider','UNKNOWN_METHOD','INVALID_CONSUMER_SCREEN','CONFLICT_platformCode','CONFLICT_channelCode','CONFLICT_providerCode','CONFLICT_METHOD_CHANNEL']);
const tri=z.enum(['TRUE','FALSE','UNKNOWN']);
const method=z.enum(['DEMO','MANUAL_UI','MANUAL_OBSERVATION','CONSUMER_UI_MANUAL','API','API_OBSERVATION']);
// Regions are supplied observation conditions, never collected device locations.
const text=z.string().min(1).max(200).refine(value=>!/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)&&!/(?:\+?82[- ]?)?0?1[016789][- ]?\d{3,4}[- ]?\d{4}/.test(value)&&!/-?\d{1,3}\.\d{3,}\s*[,/]\s*-?\d{1,3}\.\d{3,}/.test(value),'Personal identifiers or precise coordinates are not context metadata');
export const contextEvidenceSchema=z.strictObject({projectId:identifier,id:identifier,kind:z.enum(['EVIDENCE','SNAPSHOT','STUDY','PLAN','PRESCAN'])});
const metadataShape={
  modelName:text.nullable().default(null),modelDisplay:text.nullable().default(null),modelVersion:text.nullable().default(null),modelStatus:z.enum(['KNOWN','UNKNOWN']).default('UNKNOWN'),
  intent:text.nullable().default(null),country:text.nullable().default(null),region:text.nullable().default(null),language:text.nullable().default(null),
  searchUsed:tri.default('UNKNOWN'),loggedIn:z.enum(['YES','NO','UNKNOWN']).default('UNKNOWN'),
  personalizationState:z.enum(['ENABLED','DISABLED','UNKNOWN']).default('UNKNOWN'),freshConversation:tri.default('UNKNOWN'),
  studyId:identifier.nullable().default(null),phase:z.enum(['BASELINE','FOLLOW_UP','UNASSIGNED']).nullable().default(null),runNumber:z.number().int().positive().nullable().default(null),
  observedAt:timestamp.nullable().default(null),evidenceRefs:z.array(contextEvidenceSchema).default([]),
  sourceDomain:z.enum(['LEGACY','CONSUMER','RESEARCH','PRESCAN','PILOT','CITED','API']).default('LEGACY'),
};
export const observationInputSchema=z.strictObject({
  projectId:identifier,responseId:identifier,queryId:identifier.nullable().default(null),queryText:z.string().max(10000).nullable().default(null),
  provider:z.string().nullable().optional(),consumerScreen:z.string().nullable().optional(),platformName:z.string().nullable().optional(),channel:z.string().nullable().optional(),
  observationMethod:method.nullable().default(null),...metadataShape,
  sourceIssues:z.array(sourceIssueSchema).default([]),
}).superRefine((v,ctx)=>{
  if(v.evidenceRefs.some(ref=>ref.projectId!==v.projectId))ctx.addIssue({code:'custom',message:'Evidence project mismatch'});
  if(v.modelStatus==='KNOWN'&&!v.modelName)ctx.addIssue({code:'custom',message:'KNOWN model requires a recorded model name'});
  if(v.modelStatus==='UNKNOWN'&&(v.modelName||v.modelVersion))ctx.addIssue({code:'custom',message:'UNKNOWN model cannot have inferred name/version'});
});
export type ObservationInput=z.input<typeof observationInputSchema>;
export const observationContextSchema=z.strictObject({
  projectId:identifier,responseId:identifier,queryId:identifier.nullable(),...metadataShape,
  platformCode:platformSchema.nullable(),channelCode:channelSchema.nullable(),providerCode:z.enum(['OPENAI','GOOGLE','NAVER','ANTHROPIC','PERPLEXITY']).nullable(),
  observationMethod:method.nullable(),queryTextHash:z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  resolutionConfidence:z.enum(['EXACT','HIGH','LOW','UNRESOLVED']),resolutionSource:z.enum(['CHANNEL','CONSUMER_SCREEN','PLATFORM_NAME','LEGACY_PROVIDER','LEGACY_ALIAS','NONE','CONFLICT']),
  registryVersion:z.literal(PLATFORM_REGISTRY_VERSION),contextVersion:z.literal(OBSERVATION_CONTEXT_VERSION),conditionVersion:z.literal(OBSERVATION_CONDITION_VERSION),queryHashVersion:z.literal(QUERY_TEXT_HASH_VERSION),
  status:z.enum(['COMPLETE','PARTIAL','UNRESOLVED','CONFLICT']),issues:z.array(issueSchema),conditionHash:z.string().regex(/^[a-f0-9]{64}$/),checksum:z.string().regex(/^[a-f0-9]{64}$/),
});
export type CanonicalObservationContext=Readonly<z.infer<typeof observationContextSchema>>;
/** Exact UTF-8 text; no trim, newline conversion, Unicode normalization or case folding. */
export const queryTextHash=(value:string):string=>createHash('sha256').update(value,'utf8').digest('hex');
export const CONDITION_FIELDS=Object.freeze(['platformCode','channelCode','providerCode','observationMethod','modelName','modelVersion','modelStatus','country','region','language','searchUsed','loggedIn','personalizationState','freshConversation','queryTextHash'] as const);
type ConditionCarrier=Pick<CanonicalObservationContext,typeof CONDITION_FIELDS[number]>;
export function observationCondition(context:ConditionCarrier){
  return immutable({version:OBSERVATION_CONDITION_VERSION,registryVersion:PLATFORM_REGISTRY_VERSION,queryHashVersion:QUERY_TEXT_HASH_VERSION,...Object.fromEntries(CONDITION_FIELDS.map(key=>[key,context[key]]))});
}
function statusFor(content:ConditionCarrier & Pick<CanonicalObservationContext,'queryId'|'observedAt'|'intent'|'runNumber'|'resolutionSource'|'issues'>):CanonicalObservationContext['status'] {
  if(content.resolutionSource==='CONFLICT'||content.issues.some(issue=>sourceIssueSchema.safeParse(issue).success))return 'CONFLICT';
  if(!content.platformCode)return 'UNRESOLVED';
  const incomplete=CONDITION_FIELDS.some(key=>content[key]===null||content[key]==='UNKNOWN')||!content.queryId||!content.observedAt||!content.intent||content.runNumber===null;
  return incomplete?'PARTIAL':'COMPLETE';
}
export function buildObservationContext(raw:ObservationInput):CanonicalObservationContext {
  const input=observationInputSchema.parse(raw);
  const identity=resolvePlatformIdentity({provider:input.provider,consumerScreen:input.consumerScreen,platformName:input.platformName,channel:input.channel,method:input.observationMethod});
  const {queryText,provider,consumerScreen,platformName,channel,sourceIssues,...metadata}=input;void provider;void consumerScreen;void platformName;void channel;
  const issues=z.array(issueSchema).parse([...identity.issues,...sourceIssues]);
  const content={...metadata,...identity,issues,queryTextHash:queryText===null?null:queryTextHash(queryText),contextVersion:OBSERVATION_CONTEXT_VERSION,conditionVersion:OBSERVATION_CONDITION_VERSION,queryHashVersion:QUERY_TEXT_HASH_VERSION};
  const status=statusFor(content);
  const record={...content,status,conditionHash:canonicalChecksum(observationCondition(content))};
  return immutable(observationContextSchema.parse({...record,checksum:canonicalChecksum(record)}));
}
export function assertObservationContext(raw:CanonicalObservationContext):CanonicalObservationContext {
  const parsed=observationContextSchema.parse(raw),{checksum,...content}=parsed;
  if(canonicalChecksum(content)!==checksum||canonicalChecksum(observationCondition(parsed))!==parsed.conditionHash)throw Error('Observation context checksum mismatch');
  const resolved=resolvePlatformIdentity({platformName:parsed.platformCode,channel:parsed.channelCode,provider:parsed.providerCode,method:parsed.observationMethod});
  if(resolved.issues.length||resolved.platformCode!==parsed.platformCode||resolved.channelCode!==parsed.channelCode||resolved.providerCode!==parsed.providerCode)throw Error('Invalid canonical observation identity');
  if(parsed.evidenceRefs.some(ref=>ref.projectId!==parsed.projectId)||parsed.modelStatus==='UNKNOWN'&&(parsed.modelName||parsed.modelVersion)||parsed.modelStatus==='KNOWN'&&!parsed.modelName||parsed.status!==statusFor(parsed))throw Error('Inconsistent observation context metadata');
  return immutable(parsed);
}
