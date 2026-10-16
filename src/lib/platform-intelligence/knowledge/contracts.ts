import {createHash} from 'node:crypto';
import {z} from 'zod';
import {getPlatform} from '../registry';
import {getChannel} from '../channels';
import type {PlatformCode,PlatformChannelCode} from '../types';

export const KNOWLEDGE_REGISTRY_VERSION='platform-knowledge-v1' as const;
export const reviewStatusSchema=z.enum(['DRAFT','REVIEW_REQUIRED','APPROVED','RETIRED']);
export const knowledgeTypeSchema=z.enum(['FACT','OBSERVATION','HYPOTHESIS']);
export const industrySchema=z.enum(['MEDICAL','LEGAL','COMMERCE','BRAND']);
export const timestamp=z.iso.datetime();
export const identifier=z.string().trim().min(1).max(160);
export const platformSchema=z.custom<PlatformCode>(value=>typeof value==='string'&&!!getPlatform(value),'Canonical platform required');
export const channelSchema=z.custom<PlatformChannelCode>(value=>typeof value==='string'&&!!getChannel(value),'Canonical channel required');
export const scopeSchema=z.strictObject({
  platformCode:platformSchema.optional(),channelCode:channelSchema.optional(),
  country:identifier.optional(),language:identifier.optional(),industry:industrySchema.optional(),
  surface:identifier.optional(),projectId:identifier.optional(),
}).superRefine((scope,ctx)=>{
  if(scope.channelCode&&getChannel(scope.channelCode)?.platformCode!==scope.platformCode)ctx.addIssue({code:'custom',message:'Channel requires its canonical platform'});
});
export type KnowledgeScope=z.infer<typeof scopeSchema>;
export const evidenceRefSchema=z.strictObject({
  projectId:identifier,kind:z.enum(['AI_RESPONSE','CITATION','MENTION','SNAPSHOT','EVIDENCE','EXPERIMENT']),id:identifier,
});
export const provenanceSchema=z.strictObject({
  sourceType:z.enum(['OFFICIAL_DOCUMENT','OFFICIAL_HELP','OFFICIAL_TECHNICAL_DOC','INTERNAL_OBSERVATION','INTERNAL_EXPERIMENT','CLIENT_EVIDENCE','MANUAL_RESEARCH']),
  sourceReference:identifier.optional(),sourceUrl:z.url().refine(value=>new URL(value).protocol==='https:','HTTPS source URL required').optional(),
  sourceTitle:z.string().min(1).max(500).optional(),sourceDate:timestamp.optional(),capturedAt:timestamp,
  excerptHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),evidenceRefs:z.array(evidenceRefSchema),
  reviewedBy:identifier.optional(),reviewedAt:timestamp.optional(),
});
export const validitySchema=z.strictObject({validFrom:timestamp,lastVerifiedAt:timestamp.optional(),reviewDueAt:timestamp.optional(),expiresAt:timestamp.optional()})
  .superRefine((v,ctx)=>{for(const field of ['reviewDueAt','expiresAt'] as const)if(v[field]&&Date.parse(v[field]!)<Date.parse(v.validFrom))ctx.addIssue({code:'custom',message:`${field} precedes validFrom`});});
export const auditCommandSchema=z.strictObject({actorId:identifier,createdAt:timestamp,reason:z.string().trim().min(1).max(1000)});
export type AuditCommand=z.infer<typeof auditCommandSchema>;
export const versionRefSchema=z.strictObject({knowledgeId:identifier,version:z.number().int().positive()});
export const knowledgeDraftSchema=z.strictObject({
  knowledgeId:identifier,version:z.number().int().positive(),knowledgeType:knowledgeTypeSchema,
  claim:z.string().trim().min(1).max(2000),scope:scopeSchema,provenance:provenanceSchema,validity:validitySchema,
  supersedes:versionRefSchema.optional(),
}).superRefine((v,ctx)=>{
  if(v.knowledgeType==='OBSERVATION'){
    if(v.claim!=='REFERENCED_INTERNAL_OBSERVATION'||!v.scope.projectId||!v.provenance.evidenceRefs.length)ctx.addIssue({code:'custom',message:'Observation stores scoped references only; no customer claim/raw text'});
    if(!['INTERNAL_OBSERVATION','INTERNAL_EXPERIMENT','CLIENT_EVIDENCE'].includes(v.provenance.sourceType))ctx.addIssue({code:'custom',message:'Observation source must be internal evidence'});
    if(v.provenance.sourceTitle||v.provenance.sourceUrl)ctx.addIssue({code:'custom',message:'Observation stores internal IDs/hashes, not copied source titles or URLs'});
  }
  if(v.provenance.evidenceRefs.some(ref=>ref.projectId!==v.scope.projectId))ctx.addIssue({code:'custom',message:'Evidence must belong to the knowledge project scope'});
});
export type KnowledgeDraft=z.infer<typeof knowledgeDraftSchema>;
export type KnowledgeVersion=Readonly<KnowledgeDraft & {reviewStatus:z.infer<typeof reviewStatusSchema>;actorId:string;createdAt:string;reason:string;checksum:string;registryVersion:typeof KNOWLEDGE_REGISTRY_VERSION}>;
export type ValidityStatus='CURRENT'|'NOT_YET_VALID'|'REVIEW_DUE'|'EXPIRED'|'RETIRED';

/** Independent of existing Snapshot hashes. Strict schemas supply JSON-only content. */
export function canonicalChecksum(value:unknown):string {
  const canonical=(v:unknown):unknown=>{
    if(v===null||typeof v==='string'||typeof v==='boolean')return v;
    if(typeof v==='number'&&Number.isFinite(v))return v;
    if(Array.isArray(v))return v.map(canonical);
    if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype)return Object.fromEntries(Object.entries(v).filter(([,item])=>item!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,canonical(item)]));
    throw new Error('Canonical checksum requires JSON values');
  };
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function immutable<T>(value:T):T {
  if(value&&typeof value==='object'){for(const item of Object.values(value))immutable(item);Object.freeze(value);}return value;
}
export function validityAt(record:Pick<KnowledgeVersion,'reviewStatus'|'validity'>,at:string):ValidityStatus {
  timestamp.parse(at);
  if(record.reviewStatus==='RETIRED')return 'RETIRED';
  const t=Date.parse(at),v=record.validity;
  if(t<Date.parse(v.validFrom))return 'NOT_YET_VALID';
  if(v.expiresAt&&Date.parse(v.expiresAt)<t)return 'EXPIRED';
  if(v.reviewDueAt&&Date.parse(v.reviewDueAt)<t)return 'REVIEW_DUE';
  return 'CURRENT';
}
export function assertFactApproval(draft:KnowledgeDraft,command:AuditCommand){
  if(draft.knowledgeType!=='FACT')return;
  const p=draft.provenance;
  if(!['OFFICIAL_DOCUMENT','OFFICIAL_HELP','OFFICIAL_TECHNICAL_DOC'].includes(p.sourceType)||!p.sourceReference||!p.sourceUrl||!draft.validity.lastVerifiedAt)throw new Error('FACT approval requires official source reference, URL and verifiedAt');
  if(Date.parse(draft.validity.lastVerifiedAt)>Date.parse(command.createdAt)||Date.parse(p.capturedAt)>Date.parse(command.createdAt))throw new Error('Cannot verify a future source');
}
