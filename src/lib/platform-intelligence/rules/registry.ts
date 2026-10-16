import {z} from 'zod';
import {auditCommandSchema,canonicalChecksum,channelSchema,immutable,industrySchema,platformSchema,reviewStatusSchema,scopeSchema,timestamp,identifier} from '../knowledge/contracts';
import type {KnowledgeScope,KnowledgeVersion} from '../knowledge/contracts';
import type {PlatformKnowledgeRepository,KnowledgeAccess} from '../knowledge/repository';

export const RULE_REGISTRY_VERSION='platform-rules-v1' as const;
/** Existing local evidence capabilities only; these entries do not execute a check. */
export const CHECK_TYPES=immutable({
  ROBOTS_ACCESS:{source:'src/lib/robots.ts:robotAccess',unknownWhen:'robots response/path/agent evidence missing'},
  NOINDEX:{source:'src/lib/audit.ts:inspectHtml',unknownWhen:'HTML/header evidence missing; never proves actual indexing'},
  PAGE_TEXT_PRESENT:{source:'src/lib/studio-page.ts:parseStudioPage',unknownWhen:'No supplied HTML snapshot'},
  STRUCTURED_DATA_PRESENT:{source:'src/lib/studio-page.ts:parseStudioPage',unknownWhen:'No supplied HTML/JSON-LD snapshot; presence does not prove platform eligibility'},
  CITATION_PRESENT:{source:'src/lib/types.ts:ResponseRecord.citations',unknownWhen:'No scoped observation/citation reference'},
});
export type CheckType=keyof typeof CHECK_TYPES;
export type CheckResult='PASS'|'FAIL'|'UNKNOWN'|'NOT_APPLICABLE';
const checkTypeSchema=z.custom<CheckType>(value=>typeof value==='string'&&Object.hasOwn(CHECK_TYPES,value),'Unsupported checkType');
const knowledgeRef=z.strictObject({knowledgeId:identifier,version:z.number().int().positive(),role:z.enum(['CONFIRMED','SUPPORTING','EXPERIMENTAL'])});
export const ruleSchema=z.strictObject({
  ruleId:identifier,version:z.number().int().positive(),name:identifier,description:z.string().min(1).max(2000),
  platformScope:platformSchema.optional(),channelScope:channelSchema.optional(),industryScope:industrySchema.optional(),
  countryScope:identifier.optional(),languageScope:identifier.optional(),surfaceScope:identifier.optional(),projectId:identifier.optional(),
  checkType:checkTypeSchema,knowledgeRefs:z.array(knowledgeRef).min(1),basis:z.enum(['CONFIRMED','EXPERIMENTAL']),
  severity:z.enum(['INFO','LOW','MEDIUM','HIGH']),weightCandidate:z.number().finite().nonnegative().nullable(),actionRefs:z.array(identifier),
  reviewStatus:reviewStatusSchema,effectiveAt:timestamp,retiredAt:timestamp.nullable(),
  audit:auditCommandSchema,reviewedBy:identifier.optional(),reviewedAt:timestamp.optional(),
});
export type RuleInput=z.infer<typeof ruleSchema>;
export type RuleVersion=Readonly<RuleInput & {knowledgeChecksums:readonly string[];checksum:string;registryVersion:typeof RULE_REGISTRY_VERSION}>;
export const ruleSetSchema=z.strictObject({
  ruleSetId:identifier,version:z.number().int().positive(),name:identifier,
  ruleRefs:z.array(z.strictObject({ruleId:identifier,version:z.number().int().positive()})).min(1),
  reviewStatus:reviewStatusSchema,effectiveAt:timestamp,retiredAt:timestamp.nullable(),audit:auditCommandSchema,
  reviewedBy:identifier.optional(),reviewedAt:timestamp.optional(),
});
export type RuleSetInput=z.infer<typeof ruleSetSchema>;
export type RuleSetVersion=Readonly<RuleSetInput & {ruleChecksums:readonly string[];checksum:string;registryVersion:typeof RULE_REGISTRY_VERSION}>;
export type RuleQuery=KnowledgeScope & {at:string;authorizedProjectIds?:readonly string[]};

function ruleScope(rule:RuleInput):KnowledgeScope {
  return scopeSchema.parse({platformCode:rule.platformScope,channelCode:rule.channelScope,industry:rule.industryScope,country:rule.countryScope,language:rule.languageScope,surface:rule.surfaceScope,projectId:rule.projectId});
}
function assertReview(record:RuleInput|RuleSetInput){
  if(record.reviewStatus==='APPROVED'&&(!record.reviewedBy||!record.reviewedAt))throw Error('Approved Rule/RuleSet requires reviewer and reviewedAt');
  if(record.reviewedAt&&Date.parse(record.reviewedAt)>Date.parse(record.audit.createdAt))throw Error('Review time exceeds audit time');
  if(record.retiredAt&&Date.parse(record.retiredAt)<Date.parse(record.effectiveAt))throw Error('Retirement precedes effectiveAt');
  if(record.reviewStatus==='RETIRED'&&!record.retiredAt)throw Error('Retired Rule/RuleSet requires retiredAt');
}
function assertKnowledge(rule:RuleInput,knowledge:PlatformKnowledgeRepository,at:string){
  const scope=ruleScope(rule),access:KnowledgeAccess={authorizedProjectIds:rule.projectId?[rule.projectId]:[]};
  let confirmed=0;
  for(const ref of rule.knowledgeRefs){
    const inspected=knowledge.inspect(ref.knowledgeId,ref.version,at,access);
    if(!inspected)throw Error('Knowledge reference missing or outside project scope');
    const k:KnowledgeVersion=inspected.record;
    // A known narrow scope is never generalized to a broader Rule scope.
    if(Object.entries(k.scope).some(([key,value])=>value!==undefined&&Reflect.get(scope,key)!==value))throw Error('Rule expands knowledge scope');
    if(ref.role==='CONFIRMED'&&(k.knowledgeType!=='FACT'||k.scope.platformCode!==scope.platformCode||k.scope.channelCode!==scope.channelCode))throw Error('Confirmed basis requires FACT with matching platform/channel scope');
    if(rule.basis==='CONFIRMED'&&(k.knowledgeType==='HYPOTHESIS'||ref.role==='EXPERIMENTAL'))throw Error('Hypothesis/experimental evidence cannot support confirmed Rule');
    if(k.knowledgeType==='OBSERVATION'&&ref.role!=='SUPPORTING')throw Error('Observation is supporting evidence only');
    if(k.knowledgeType==='HYPOTHESIS'&&ref.role!=='EXPERIMENTAL')throw Error('Hypothesis requires experimental role');
    if(rule.reviewStatus==='APPROVED'&&(k.reviewStatus!=='APPROVED'||inspected.validity!=='CURRENT'||!k.provenance.reviewedAt||Date.parse(k.provenance.reviewedAt)>Date.parse(at)))throw Error('Approved Rule requires approved, current, non-retired knowledge');
    if(ref.role==='CONFIRMED')confirmed++;
  }
  if(rule.basis==='CONFIRMED'&&confirmed===0)throw Error('Confirmed Rule requires at least one confirmed FACT reference');
}
export interface PlatformRuleRegistry {
  getRuleVersion(id:string,version:number):RuleVersion|undefined;
  listRuleVersions(id:string):readonly RuleVersion[];
  getRuleSetVersion(id:string,version:number):RuleSetVersion|undefined;
  listRuleSetVersions(id:string):readonly RuleSetVersion[];
  listApplicableRules(query:RuleQuery):readonly RuleVersion[];
}
/** Read-only construction: no overwrite API, executable payload, score or production seed. */
export function createRuleRegistry(inputs:readonly RuleInput[],sets:readonly RuleSetInput[],knowledge:PlatformKnowledgeRepository,restored?:{rules:readonly RuleVersion[];sets:readonly RuleSetVersion[]}):PlatformRuleRegistry {
  const rules=new Map<string,RuleVersion>(),ruleSets=new Map<string,RuleSetVersion>();
  const key=(id:string,version:number)=>JSON.stringify([id,version]);
  for(const raw of inputs){
    const rule=ruleSchema.parse(raw);ruleScope(rule);assertReview(rule);assertKnowledge(rule,knowledge,rule.audit.createdAt);
    const id=key(rule.ruleId,rule.version);if(rules.has(id))throw Error('Duplicate immutable Rule version');
    const access={authorizedProjectIds:rule.projectId?[rule.projectId]:[]};
    const knowledgeChecksums=rule.knowledgeRefs.map(ref=>knowledge.getVersion(ref.knowledgeId,ref.version,access)!.checksum);
    const content={...rule,knowledgeChecksums,registryVersion:RULE_REGISTRY_VERSION};rules.set(id,immutable({...content,checksum:canonicalChecksum(content)}));
  }
  for(const raw of sets){
    const set=ruleSetSchema.parse(raw);assertReview(set);
    const refs=set.ruleRefs.map(ref=>{const rule=rules.get(key(ref.ruleId,ref.version));if(!rule)throw Error('RuleSet reference missing');
      if(set.reviewStatus==='APPROVED'){
        if(rule.reviewStatus!=='APPROVED'||rule.basis!=='CONFIRMED'||Date.parse(rule.effectiveAt)>Date.parse(set.effectiveAt)||(rule.retiredAt&&Date.parse(rule.retiredAt)<=Date.parse(set.effectiveAt))||[...rules.values()].some(other=>other.ruleId===rule.ruleId&&other.version>rule.version&&other.reviewStatus==='RETIRED'))throw Error('Approved RuleSet requires effective confirmed approved Rules');
        assertKnowledge(rule,knowledge,set.audit.createdAt);
      }return rule.checksum;});
    if(new Set(set.ruleRefs.map(ref=>key(ref.ruleId,ref.version))).size!==refs.length)throw Error('Duplicate RuleSet reference');
    const id=key(set.ruleSetId,set.version);if(ruleSets.has(id))throw Error('Duplicate immutable RuleSet version');
    const content={...set,ruleChecksums:refs,registryVersion:RULE_REGISTRY_VERSION};ruleSets.set(id,immutable({...content,checksum:canonicalChecksum(content)}));
  }
  for(const rule of restored?.rules??[])rules.set(key(rule.ruleId,rule.version),immutable(structuredClone(rule)));
  for(const set of restored?.sets??[])ruleSets.set(key(set.ruleSetId,set.version),immutable(structuredClone(set)));
  return Object.freeze({
    getRuleVersion:(id:string,version:number)=>rules.get(key(id,version)),
    listRuleVersions:(id:string)=>Object.freeze([...rules.values()].filter(rule=>rule.ruleId===id).sort((a,b)=>a.version-b.version)),
    getRuleSetVersion:(id:string,version:number)=>ruleSets.get(key(id,version)),
    listRuleSetVersions:(id:string)=>Object.freeze([...ruleSets.values()].filter(set=>set.ruleSetId===id).sort((a,b)=>a.version-b.version)),
    listApplicableRules(query:RuleQuery){
      const {at,authorizedProjectIds,...rawScope}=query;timestamp.parse(at);const scope=scopeSchema.parse(rawScope);
      return Object.freeze([...rules.values()].filter(rule=>{
        if([...rules.values()].some(other=>other.ruleId===rule.ruleId&&other.version>rule.version))return false;
        if(rule.reviewStatus!=='APPROVED'||rule.basis!=='CONFIRMED'||!rule.reviewedAt||Date.parse(rule.reviewedAt)>Date.parse(at)||Date.parse(rule.audit.createdAt)>Date.parse(at)||Date.parse(rule.effectiveAt)>Date.parse(at)||(rule.retiredAt&&Date.parse(rule.retiredAt)<=Date.parse(at)))return false;
        const rs=ruleScope(rule);
        if(rs.projectId&&!authorizedProjectIds?.includes(rs.projectId))return false;
        if(Object.entries(rs).some(([k,v])=>v!==undefined&&Reflect.get(scope,k)!==v))return false;
        try{assertKnowledge(rule,knowledge,at);const access={authorizedProjectIds:rule.projectId?[rule.projectId]:[]};return rule.knowledgeRefs.every((ref,index)=>knowledge.getVersion(ref.knowledgeId,ref.version,access)?.checksum===rule.knowledgeChecksums[index]);}catch{return false;}
      }).sort((a,b)=>a.ruleId<b.ruleId?-1:a.ruleId>b.ruleId?1:a.version-b.version));
    },
  });
}
export const productionRules:readonly RuleVersion[]=Object.freeze([]);
export const productionRuleSets:readonly RuleSetVersion[]=Object.freeze([]);
