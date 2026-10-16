import type {PlatformSession} from '../persistence';
import type {PlatformCode} from '../types';
import {officialPack} from '../official-pack/manifest';
import {validityAt,canonicalChecksum} from '../knowledge/contracts';
/** Explicit public-source whitelist; never projects customer Knowledge, arbitrary URL/claim or a fixture. */
export function operationalFacts(s:PlatformSession,code:PlatformCode,at:string){
 return officialPack.facts.filter(f=>f.scope.platformCode===code).flatMap(expected=>{
  const k=s.knowledge.get(expected.knowledgeId);
  if(!k||k.version!==expected.version||k.knowledgeType!=='FACT'||k.reviewStatus!=='APPROVED'||canonicalChecksum(k.scope)!==canonicalChecksum(expected.scope)||k.claim!==expected.claim||k.provenance.sourceType!==expected.provenance.sourceType||k.provenance.sourceReference!==expected.provenance.sourceReference||k.provenance.sourceUrl!==expected.provenance.sourceUrl||k.provenance.excerptHash!==expected.provenance.excerptHash)return [];
  const source=officialPack.sources.find(source=>source.id===expected.sourceId)!,validity=validityAt(k,at);
  const soon=[k.validity.reviewDueAt,k.validity.expiresAt].some(date=>date&&Date.parse(date)<=Date.parse(at)+7*86400000);
  return [{knowledgeId:k.knowledgeId,version:k.version,knowledgeType:'FACT' as const,claimSummary:k.claim,platformCode:code,channelCode:k.scope.channelCode!,source:{title:source.title,domain:source.officialDomain,url:source.canonicalUrl},lastVerifiedAt:k.validity.lastVerifiedAt??null,reviewDueAt:k.validity.reviewDueAt??null,expiresAt:k.validity.expiresAt??null,reviewStatus:k.reviewStatus,validity,reviewRequired:validity!=='CURRENT'||soon,ruleUsage:officialPack.rules.filter(r=>r.knowledgeIds.includes(k.knowledgeId)&&s.rules.getRuleVersion(r.ruleId,2)?.reviewStatus==='APPROVED').map(r=>r.ruleId)}];
 });
}
export function operationalPack(s:PlatformSession,code:PlatformCode,at:string){const facts=operationalFacts(s,code,at);return {factCount:facts.length,reviewRequiredCount:facts.filter(f=>f.reviewRequired).length,packStatus:facts.length?'VALIDATION_PACK' as const:'NOT_INSTALLED' as const,humanApprovalRecorded:false as const};}
export type OperationalFact=ReturnType<typeof operationalFacts>[number];
