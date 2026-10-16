import {z} from 'zod';
import type {Staff} from '../../auth';
import type {PlatformKnowledgeRepository} from '../knowledge/repository';
import type {PlatformRuleRegistry,CheckType} from '../rules/registry';
import {CHECK_TYPES} from '../rules/registry';
import {getChannel} from '../channels';
import {canonicalChecksum,immutable,identifier,timestamp,platformSchema,channelSchema,industrySchema,auditCommandSchema,reviewStatusSchema} from '../knowledge/contracts';
import type {AuditCommand} from '../knowledge/contracts';

export const ACTION_LIBRARY_VERSION='platform-action-library-v1' as const;
export type EffectClaimStatus='NO_EFFECT_CLAIM'|'HYPOTHESIZED'|'OBSERVED'|'EXPERIMENTALLY_SUPPORTED';
const ref=z.strictObject({id:identifier,version:z.number().int().positive(),checksum:z.string().regex(/^[a-f0-9]{64}$/)});
const operationalText=z.string().trim().min(1).max(2000).refine(value=>!/(?:추천|노출|citation|인용|매출|성공률|ROI).{0,25}(?:[0-9]+\s*%|올린다|오른다|증가시킨다|상승시킨다|보장|증가\s*예상|증가\s*예측)|(?:[0-9]+\s*%).{0,15}(?:증가|성공|추천|노출)|(?:increase|boost|guarantee|predict).{0,25}(?:recommendation|exposure|citation|revenue|ROI)|(?:recommendation|exposure|citation|revenue|ROI).{0,25}(?:increase|boost|guaranteed)/i.test(value),'Operational objectives only; effect claims are not supported');
export const actionDraftSchema=z.strictObject({
  actionId:identifier,version:z.number().int().positive(),environment:z.enum(['PRODUCTION','SYNTHETIC']),name:operationalText,description:operationalText,
  category:z.enum(['TECHNICAL','ENTITY','CONTENT','CITATION','LOCAL','STRUCTURED_DATA','EVIDENCE','CONVERSION','MEASUREMENT','COMPLIANCE']),
  industryScopes:z.array(industrySchema),platformScopes:z.array(platformSchema),channelScopes:z.array(channelSchema),
  applicableFindingStatuses:z.array(z.enum(['FAIL','WARN','UNKNOWN','PASS'])).min(1),
  applicableCheckTypes:z.array(z.custom<CheckType>(v=>typeof v==='string'&&Object.hasOwn(CHECK_TYPES,v))).min(1),
  executionMode:z.enum(['MANUAL_REVIEW','MANUAL_VERIFICATION','EXISTING_WORK_DRAFT']),objective:operationalText,
  requiredInputs:z.array(operationalText),expectedOutputs:z.array(operationalText),
  approvalRequirements:z.strictObject({internalReview:z.boolean(),clientApproval:z.boolean()}),
  complianceRequirements:z.array(z.enum(['MEDICAL_REVIEW','LEGAL_REVIEW','EXTERNAL_REVIEW_IF_REQUIRED'])),
  evidenceRequirements:z.array(z.enum(['PAGE','EVIDENCE','STUDIO_VERSION','APPROVAL','PILOT_DOCUMENT'])),
  estimatedEffortMetadata:z.strictObject({size:z.enum(['UNKNOWN','SMALL','MEDIUM','LARGE']),minMinutes:z.number().int().nonnegative().nullable(),maxMinutes:z.number().int().nonnegative().nullable()}),
  effectClaimStatus:z.literal('NO_EFFECT_CLAIM').default('NO_EFFECT_CLAIM'),knowledgeRefs:z.array(ref),ruleRefs:z.array(ref),dependencies:z.array(ref),
  effectiveAt:timestamp,retiredAt:timestamp.nullable(),supersedes:z.strictObject({actionId:identifier,version:z.number().int().positive()}).optional(),
}).superRefine((v,ctx)=>{
  for(const field of ['industryScopes','platformScopes','channelScopes','applicableFindingStatuses','applicableCheckTypes'] as const)if(new Set(v[field]).size!==v[field].length)ctx.addIssue({code:'custom',message:'Duplicate action scope/type'});
  if(v.channelScopes.some(code=>!v.platformScopes.includes(getChannel(code)!.platformCode)))ctx.addIssue({code:'custom',message:'Channel requires its platform scope'});
  if(v.estimatedEffortMetadata.minMinutes!==null&&v.estimatedEffortMetadata.maxMinutes!==null&&v.estimatedEffortMetadata.minMinutes>v.estimatedEffortMetadata.maxMinutes)ctx.addIssue({code:'custom',message:'Invalid effort range'});
  if(v.retiredAt&&Date.parse(v.retiredAt)<Date.parse(v.effectiveAt))ctx.addIssue({code:'custom',message:'Retirement before effectiveAt'});
});
export type ActionDraft=z.infer<typeof actionDraftSchema>;
export type ActionDefinition=Readonly<ActionDraft & {reviewStatus:z.infer<typeof reviewStatusSchema>;createdBy:string;createdAt:string;reviewedBy:string|null;reviewedAt:string|null;reason:string;registryVersion:typeof ACTION_LIBRARY_VERSION;checksum:string}>;
export type ActionDefinitionAudit=Readonly<AuditCommand & {actionId:string;version:number;operation:'CREATE_DRAFT'|'SUBMIT'|'APPROVE'|'RETIRE';beforeChecksum:string|null;afterChecksum:string}>;
export interface ActionDefinitionRepository {
  list():readonly ActionDefinition[];get(id:string):ActionDefinition|undefined;getVersion(id:string,version:number):ActionDefinition|undefined;listVersions(id:string):readonly ActionDefinition[];
  createDraft(input:ActionDraft,actor:Staff,command:AuditCommand):ActionDefinition;
  submitForReview(id:string,version:number,actor:Staff,command:AuditCommand):ActionDefinition;
  approve(id:string,version:number,actor:Staff,command:AuditCommand):ActionDefinition;
  retire(id:string,version:number,actor:Staff,command:AuditCommand):ActionDefinition;
  isOperational(id:string,version:number,asOf:string):boolean;auditTrail():readonly ActionDefinitionAudit[];
}
export function assertActionDefinition(value:ActionDefinition):ActionDefinition {
  const {checksum,reviewStatus,createdBy,createdAt,reviewedBy,reviewedAt,reason,registryVersion,...draft}=value;
  actionDraftSchema.parse(draft);reviewStatusSchema.parse(reviewStatus);identifier.parse(createdBy);timestamp.parse(createdAt);z.string().trim().min(1).max(1000).parse(reason);
  if(reviewedBy!==null)identifier.parse(reviewedBy);if(reviewedAt!==null)timestamp.parse(reviewedAt);
  if(registryVersion!==ACTION_LIBRARY_VERSION||canonicalChecksum({...draft,reviewStatus,createdBy,createdAt,reviewedBy,reviewedAt,reason,registryVersion})!==checksum)throw Error('Action Definition integrity mismatch');
  if(reviewStatus==='APPROVED'&&(!reviewedBy||!reviewedAt))throw Error('Approved Action requires review');
  return value;
}
export function createInMemoryActionDefinitionRepository(deps:{knowledge?:PlatformKnowledgeRepository;rules?:PlatformRuleRegistry}={},initial?:{records:readonly ActionDefinition[];audit:readonly ActionDefinitionAudit[]}):ActionDefinitionRepository & {snapshot():{records:ActionDefinition[];audit:ActionDefinitionAudit[]}} {
  const records=new Map<string,ActionDefinition[]>(),events:ActionDefinitionAudit[]=[];
  const current=(id:string)=>records.get(id)?.at(-1);
  const owner=(actor:Staff,raw:AuditCommand)=>{const command=auditCommandSchema.parse(raw);if(actor.disabled||actor.role!=='OWNER'||actor.id!==command.actorId)throw Error('OWNER is required for global Action registry changes');return command;};
  function save(input:ActionDraft,status:ActionDefinition['reviewStatus'],actor:Staff,command:AuditCommand,before:ActionDefinition|undefined,operation:ActionDefinitionAudit['operation']){
    const previous=events.filter(e=>e.actionId===input.actionId).at(-1);if(previous&&Date.parse(command.createdAt)<Date.parse(previous.createdAt))throw Error('Action audit time reversed');
    const content={...structuredClone(input),reviewStatus:status,createdBy:before?.version===input.version?before.createdBy:actor.id,createdAt:before?.version===input.version?before.createdAt:command.createdAt,reviewedBy:status==='APPROVED'?actor.id:status==='RETIRED'?before?.reviewedBy??null:null,reviewedAt:status==='APPROVED'?command.createdAt:status==='RETIRED'?before?.reviewedAt??null:null,reason:command.reason,registryVersion:ACTION_LIBRARY_VERSION};
    const record=immutable({...content,checksum:canonicalChecksum(content)}),history=records.get(input.actionId)??[];
    records.set(input.actionId,history.filter(v=>v.version!==input.version).concat(record));
    events.push(immutable({...command,actionId:record.actionId,version:record.version,operation,beforeChecksum:before?.checksum??null,afterChecksum:record.checksum}));return record;
  }
  function pending(id:string,version:number,status:ActionDefinition['reviewStatus']){const v=current(id);if(!v||v.version!==version||v.reviewStatus!==status)throw Error('Stale or invalid Action review transition');return v;}
  const draftOf=(v:ActionDefinition)=>{const {reviewStatus,createdBy,createdAt,reviewedBy,reviewedAt,reason,registryVersion,checksum,...draft}=v;void reviewStatus;void createdBy;void createdAt;void reviewedBy;void reviewedAt;void reason;void registryVersion;void checksum;return draft;};
  function validateReferences(v:ActionDraft,asOf:string){
    for(const dependency of v.dependencies){const d=records.get(dependency.id)?.find(d=>d.version===dependency.version);if(!d||d.actionId===v.actionId||d.checksum!==dependency.checksum||!repository.isOperational(d.actionId,d.version,asOf)||d.environment!==v.environment)throw Error('Approved current dependency required');}
    const scopes:{platformCode?:string;channelCode?:string;industry?:string}[]=[];
    for(const ref of v.knowledgeRefs){const k=deps.knowledge?.inspect(ref.id,ref.version,asOf)?.record,valid=deps.knowledge?.inspect(ref.id,ref.version,asOf)?.validity;if(!k||k.scope.projectId||k.checksum!==ref.checksum||k.reviewStatus!=='APPROVED'||valid!=='CURRENT')throw Error('Approved global Knowledge reference required');scopes.push(k.scope);}
    for(const ref of v.ruleRefs){const r=deps.rules?.getRuleVersion(ref.id,ref.version);if(!r||r.projectId||r.checksum!==ref.checksum||r.reviewStatus!=='APPROVED'||Date.parse(r.effectiveAt)>Date.parse(asOf)||(r.retiredAt&&Date.parse(r.retiredAt)<=Date.parse(asOf)))throw Error('Approved global Rule reference required');scopes.push({platformCode:r.platformScope,channelCode:r.channelScope,industry:r.industryScope});}
    for(const [dimension,field] of [['platformCode','platformScopes'],['channelCode','channelScopes'],['industry','industryScopes']] as const){
      if(scopes.length&&scopes.every(s=>s[dimension]!==undefined)){const allowed=new Set(scopes.map(s=>s[dimension]));if(!v[field].length||v[field].some(code=>!allowed.has(code)))throw Error('Action scope expands its references');}
    }
  }
  for(const record of initial?.records??[]){assertActionDefinition(record);records.set(record.actionId,[...(records.get(record.actionId)??[]),immutable(structuredClone(record))].sort((a,b)=>a.version-b.version));}events.push(...(initial?.audit??[]).map(v=>immutable(structuredClone(v))));
  const repository:ActionDefinitionRepository & {snapshot():{records:ActionDefinition[];audit:ActionDefinitionAudit[]}}={
    list:()=>Object.freeze([...records.keys()].sort().map(id=>current(id)!)),get:current,getVersion:(id,version)=>records.get(id)?.find(v=>v.version===version),listVersions:id=>Object.freeze([...(records.get(id)??[])]),
    createDraft(raw,actor,audit){const command=owner(actor,audit),v=actionDraftSchema.parse(raw),prev=current(v.actionId);if(v.version!==(prev?.version??0)+1||!!prev&&(v.supersedes?.actionId!==prev.actionId||v.supersedes.version!==prev.version)||!prev&&v.supersedes)throw Error('Action versions must append with supersedes');return save(v,'DRAFT',actor,command,prev,'CREATE_DRAFT');},
    submitForReview(id,version,actor,audit){const command=owner(actor,audit),v=pending(id,version,'DRAFT');return save(draftOf(v),'REVIEW_REQUIRED',actor,command,v,'SUBMIT');},
    approve(id,version,actor,audit){const command=owner(actor,audit),v=pending(id,version,'REVIEW_REQUIRED');if(Date.parse(v.effectiveAt)>Date.parse(command.createdAt)||v.retiredAt&&Date.parse(v.retiredAt)<=Date.parse(command.createdAt))throw Error('Action must be effective at approval');validateReferences(v,command.createdAt);return save(draftOf(v),'APPROVED',actor,command,v,'APPROVE');},
    retire(id,version,actor,audit){const command=owner(actor,audit),v=pending(id,version,'APPROVED');return save({...draftOf(v),version:version+1,retiredAt:command.createdAt,supersedes:{actionId:id,version}},'RETIRED',actor,command,v,'RETIRE');},
    isOperational(id,version,asOf){timestamp.parse(asOf);const v=current(id);if(!v||v.version!==version||v.reviewStatus!=='APPROVED'||!v.reviewedAt||Date.parse(v.reviewedAt)>Date.parse(asOf)||Date.parse(v.effectiveAt)>Date.parse(asOf)||v.retiredAt&&Date.parse(v.retiredAt)<=Date.parse(asOf))return false;try{assertActionDefinition(v);validateReferences(v,asOf);return true;}catch{return false;}},
    auditTrail:()=>Object.freeze([...events]),
    snapshot:()=>({records:[...records.values()].flat(),audit:[...events]}),
  };return Object.freeze(repository);
}
export const productionActionDefinitions:readonly ActionDefinition[]=Object.freeze([]);
