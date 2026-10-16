import {z} from 'zod';
import type {Staff} from '../../auth';
import {canonicalChecksum,immutable,timestamp} from '../knowledge/contracts';
import type {PlatformSession} from '../persistence';
import {PostgresPlatformIntelligenceRepository} from '../persistence';
import {createReadinessRuleSet} from '../readiness/contracts';
import {officialPack,knowledgeDraft,channels,PACK_ID} from './manifest';
import type {OfficialPack} from './manifest';

const vendors={CHATGPT:['OpenAI',['developers.openai.com','help.openai.com']],GOOGLE_AI:['Google',['developers.google.com']],GEMINI:['Google',['support.google.com']],NAVER_AI:['Naver',['help.naver.com']],CLAUDE:['Anthropic',['support.claude.com']],PERPLEXITY:['Perplexity',['docs.perplexity.ai']]} as const;
export function assertOfficialSource(source:OfficialPack['sources'][number]){
 const url=new URL(source.canonicalUrl),allowed=vendors[source.platform];
 if(!allowed||source.vendor!==allowed[0]||url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.hostname!==source.officialDomain||!(allowed[1] as readonly string[]).includes(url.hostname))throw Error('Official HTTPS vendor/domain required');
 if(source.excerptKind!=='INTERNAL_CLAIM_SUMMARY'||source.excerptHash!==canonicalChecksum(source.summary))throw Error('Source summary integrity mismatch');
 for(const at of [source.capturedAt,source.lastVerifiedAt])timestamp.parse(at);
}
/** Exact reviewed release: changing a claim, scope, source or Rule needs a new reviewed release. */
export function assertOfficialPack(pack:OfficialPack=officialPack){
 const {manifestChecksum,...body}=pack;
 for(const s of pack.sources)assertOfficialSource(s);
 if(canonicalChecksum(body)!==manifestChecksum||manifestChecksum!==officialPack.manifestChecksum)throw Error('Pack release checksum mismatch');
 for(const f of pack.facts){const s=pack.sources.find(s=>s.id===f.sourceId);if(!s||s.platform!==f.scope.platformCode||f.scope.channelCode!==channels[s.platform]||f.draftChecksum!==canonicalChecksum(knowledgeDraft(f))||f.provenance.excerptHash!==s.excerptHash||f.provenance.sourceUrl!==s.canonicalUrl)throw Error('Claim/source/scope mismatch');}
}
export function reviewManifest(){assertOfficialPack();return immutable({packId:PACK_ID,version:1,manifestChecksum:officialPack.manifestChecksum,status:'REVIEW_REQUIRED',humanApprovalRecorded:false,
 facts:officialPack.facts.map(f=>({knowledgeId:f.knowledgeId,version:f.version,platformCode:f.scope.platformCode,channelCode:f.scope.channelCode,claim:f.claim,draftChecksum:f.draftChecksum,source:officialPack.sources.find(s=>s.id===f.sourceId)!})),
 rules:officialPack.rules,unsupported:officialPack.unsupported,actions:[],freshnessPolicy:officialPack.freshnessPolicy});}
const reviewSchema=z.strictObject({operation:z.literal('OWNER_REVIEW_OFFICIAL_PACK'),manifestChecksum:z.string().regex(/^[a-f0-9]{64}$/),expectedRevision:z.number().int().nonnegative(),reason:z.string().trim().min(10).max(500),
 decisions:z.array(z.strictObject({knowledgeId:z.string(),version:z.literal(1),draftChecksum:z.string(),sourceExcerptHash:z.string(),decision:z.literal('APPROVE')})),
 ruleIds:z.array(z.string())});
export type OwnerPackReview=z.infer<typeof reviewSchema>;
type Port=Pick<PostgresPlatformIntelligenceRepository,'read'|'write'>;
function owner(s:PlatformSession){if(s.actor.role!=='OWNER'||s.actor.disabled||s.environment!=='PRODUCTION')throw Error('Current OWNER in PRODUCTION required');}
function audit(id:string,at:string,reason:string){return {actorId:id,createdAt:at,reason:`${PACK_ID}:1:${officialPack.manifestChecksum} ${reason}`};}
export function packState(s:PlatformSession){owner(s);const ids=new Set<string>([...officialPack.facts.map(f=>f.knowledgeId),...officialPack.rules.map(r=>r.ruleId),...officialPack.rules.map(r=>r.platformCode+'_GENERAL_V1')]);
 const records=s.snapshot().records.filter(r=>ids.has(r.stableId)).map(r=>({domain:r.domain,stableId:r.stableId,version:r.version,checksum:(r.payload as {checksum:string}).checksum,reviewStatus:r.reviewStatus})).sort((a,b)=>a.domain.localeCompare(b.domain)||a.stableId.localeCompare(b.stableId)||a.version-b.version);
 return {packId:PACK_ID,version:1,manifestChecksum:officialPack.manifestChecksum,records,installationChecksum:canonicalChecksum(records)};
}
/** Source fetching is deliberately absent. Preparing drafts never approves anything. */
export class OfficialPackGovernance {
 constructor(private readonly repository:Port=new PostgresPlatformIntelligenceRepository(),private readonly clock:()=>string=()=>new Date().toISOString()){}
 async prepareDrafts(identity:Pick<Staff,'id'>,expectedRevision:number){assertOfficialPack();const a=audit(identity.id,this.clock(),'Prepare review-required official FACT drafts; no approval');
  return this.repository.write(identity,'PRODUCTION',expectedRevision,a,s=>{owner(s);for(const f of officialPack.facts){s.knowledge.createDraft(knowledgeDraft(f),a);s.knowledge.submitForReview(f.knowledgeId,f.version,a);}return packState(s);},{operation:'OFFICIAL_PACK_PREPARE',targetDomain:'KNOWLEDGE',stableId:PACK_ID,version:1});
 }
 /** Internal OWNER command; no browser route, client reviewer, auto approval, or original DB migration. */
 async ownerReview(identity:Pick<Staff,'id'>,raw:unknown){assertOfficialPack();const c=reviewSchema.parse(raw);
  if(c.manifestChecksum!==officialPack.manifestChecksum||c.decisions.length!==officialPack.facts.length||new Set(c.decisions.map(d=>d.knowledgeId)).size!==c.decisions.length)throw Error('Exact complete manifest review required');
  for(const f of officialPack.facts){const d=c.decisions.find(d=>d.knowledgeId===f.knowledgeId);if(!d||d.draftChecksum!==f.draftChecksum||d.sourceExcerptHash!==f.provenance.excerptHash)throw Error('Explicit claim/source checksum review required');}
  if(canonicalChecksum([...c.ruleIds].sort())!==canonicalChecksum(officialPack.rules.map(r=>r.ruleId).sort()))throw Error('Exact supported Rule review required');
  const at=this.clock(),a=audit(identity.id,at,c.reason);
  return this.repository.write(identity,'PRODUCTION',c.expectedRevision,a,s=>{owner(s);
   for(const f of officialPack.facts){const current=s.knowledge.getVersion(f.knowledgeId,1);if(!current||current.reviewStatus!=='REVIEW_REQUIRED')throw Error('Prepared unapproved draft required');const {reviewStatus,actorId,createdAt,reason,checksum,registryVersion,...data}=current;void reviewStatus;void actorId;void createdAt;void reason;void checksum;void registryVersion;if(canonicalChecksum(data)!==f.draftChecksum)throw Error('Draft changed after source review');s.knowledge.approve(f.knowledgeId,1,a);}
   for(const r of officialPack.rules){const input={ruleId:r.ruleId,version:1,name:r.ruleId,description:'Internal Readiness: supplied evidence only. Robots findings do not verify WAF/IP access, crawling, indexing, ranking, citation or recommendation. No effect claim.',platformScope:r.platformCode,channelScope:r.channelCode,checkType:r.checkType,knowledgeRefs:r.knowledgeIds.map(knowledgeId=>({knowledgeId,version:1,role:'CONFIRMED' as const})),basis:'CONFIRMED' as const,severity:'INFO' as const,weightCandidate:1,actionRefs:[],reviewStatus:'DRAFT' as const,effectiveAt:at,retiredAt:null,audit:a};
    s.saveRule(input);s.saveRule({...input,version:2,reviewStatus:'APPROVED',reviewedBy:s.actor.id,reviewedAt:at});
   }
   for(const code of new Set(officialPack.rules.map(r=>r.platformCode))){const rules=officialPack.rules.filter(r=>r.platformCode===code),set={ruleSetId:code+'_GENERAL_V1',version:1,name:code+' official evidence checks v1',ruleRefs:rules.map(r=>({ruleId:r.ruleId,version:2})),reviewStatus:'DRAFT' as const,effectiveAt:at,retiredAt:null,audit:a};
    s.saveRuleSet(set);s.saveRuleSet({...set,version:2,reviewStatus:'APPROVED',reviewedBy:s.actor.id,reviewedAt:at});
    s.saveReadinessPolicy(createReadinessRuleSet({ruleSetId:set.ruleSetId,ruleSetVersion:2,environment:'PRODUCTION',scope:{projectId:null,platformCode:code,channelCode:channels[code]},scorePolicy:{version:'readiness-weighted-bounds-v1',weightSource:'EXPLICIT_RULE_WEIGHTS',credits:{PASS:1,WARN:0.5,FAIL:0}},checks:rules.map(r=>({ruleId:r.ruleId,ruleVersion:2,weight:1,maxAgeSeconds:86400,source:null,...('robotsAgent'in r?{robotsAgent:r.robotsAgent}:{}),...(r.checkType==='NOINDEX'?{noindexScope:'HTML_AND_HEADER' as const}:{})})),reviewedBy:s.actor.id,reviewedAt:at,reason:'Internal equal weights, not official ranking; evidence must be explicitly selected. '+officialPack.manifestChecksum},s.rules));
   }
   return packState(s);
  },{operation:'OWNER_REVIEW_OFFICIAL_PACK',targetDomain:'KNOWLEDGE',stableId:PACK_ID,version:1});
 }
}
