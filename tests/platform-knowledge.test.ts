import {describe,it,expect} from 'vitest';
import {canonicalChecksum,knowledgeDraftSchema,knowledgeTypeSchema,reviewStatusSchema,validityAt} from '../src/lib/platform-intelligence/knowledge/contracts';
import {createInMemoryKnowledgeRepository,productionKnowledge} from '../src/lib/platform-intelligence/knowledge/repository';
import {CHECK_TYPES,createRuleRegistry,productionRules,productionRuleSets} from '../src/lib/platform-intelligence/rules/registry';
import {resolvePlatformIdentity} from '../src/lib/platform-intelligence/resolver';
import {at,command,fact,rule,ruleSet} from './platform-knowledge.fixture';
import type {KnowledgeDraft} from '../src/lib/platform-intelligence/knowledge/contracts';

function approved(input=fact()){
  const repo=createInMemoryKnowledgeRepository();repo.createDraft(input,command());repo.submitForReview(input.knowledgeId,1,command());repo.approve(input.knowledgeId,1,command());return repo;
}
describe('versioned Knowledge contract',()=>{
  it('separates type from review status and has no production/synthetic seeds',()=>{
    expect(knowledgeTypeSchema.options).toEqual(['FACT','OBSERVATION','HYPOTHESIS']);
    expect(reviewStatusSchema.options).toEqual(['DRAFT','REVIEW_REQUIRED','APPROVED','RETIRED']);
    expect(productionKnowledge).toEqual([]);expect(productionRules).toEqual([]);expect(productionRuleSets).toEqual([]);
  });
  it('requires sequential human review; approval records reviewer and immutable audit lineage',()=>{
    const repo=createInMemoryKnowledgeRepository();const draft=repo.createDraft(fact(),command());
    expect(draft.reviewStatus).toBe('DRAFT');expect(()=>repo.approve(draft.knowledgeId,1,command())).toThrow();
    repo.submitForReview(draft.knowledgeId,1,command());expect(repo.get(draft.knowledgeId)?.reviewStatus).toBe('REVIEW_REQUIRED');
    const record=repo.approve(draft.knowledgeId,1,command());expect(record.reviewStatus).toBe('APPROVED');
    expect(record.provenance.reviewedBy).toBe('SYNTHETIC_REVIEWER');expect(record.provenance.reviewedAt).toBe(at);
    expect(repo.auditTrail().map(e=>e.operation)).toEqual(['CREATE_DRAFT','SUBMIT','APPROVE']);
    expect(repo.auditTrail()[2].beforeChecksum).toBe(repo.auditTrail()[1].afterChecksum);
    expect(Object.isFrozen(record.provenance.evidenceRefs)).toBe(true);
    expect(()=>Reflect.set(record.provenance,'sourceReference','overwrite')).not.toThrow();
    expect(record.provenance.sourceReference).toBe('SYNTHETIC_OFFICIAL_REFERENCE');
  });
  it.each(['missing-reference','missing-url','not-official','missing-verification','future-verification'] as const)('rejects FACT approval: %s',problem=>{
    const input=fact();
    if(problem==='missing-reference')delete input.provenance.sourceReference;
    if(problem==='missing-url')delete input.provenance.sourceUrl;
    if(problem==='not-official')input.provenance.sourceType='MANUAL_RESEARCH';
    if(problem==='missing-verification')delete input.validity.lastVerifiedAt;
    if(problem==='future-verification')input.validity.lastVerifiedAt='2026-10-16T00:00:00Z';
    const repo=createInMemoryKnowledgeRepository();repo.createDraft(input,command());repo.submitForReview(input.knowledgeId,1,command());
    expect(()=>repo.approve(input.knowledgeId,1,command())).toThrow();expect(repo.get(input.knowledgeId)?.reviewStatus).toBe('REVIEW_REQUIRED');
  });
  it('rejects missing actors/reasons, self-approval, backward time, stale versions and overwrite',()=>{
    const repo=approved();const v1=repo.get('FACT_TEST_001')!,hash=v1.checksum;
    expect(()=>repo.createDraft(fact(),command())).toThrow();expect(()=>repo.approve(v1.knowledgeId,1,command())).toThrow();
    const input=fact();input.version=2;input.supersedes={knowledgeId:input.knowledgeId,version:1};
    expect(()=>repo.createDraft(input,{...command(),actorId:''})).toThrow();
    expect(()=>repo.createDraft(input,{...command(),reason:''})).toThrow();
    input.provenance.reviewedBy='forged';expect(()=>repo.createDraft(input,command())).toThrow();delete input.provenance.reviewedBy;
    expect(()=>repo.createDraft(input,command('2026-10-14T00:00:00Z'))).toThrow();
    const v2=repo.createDraft(input,command());expect(v2.version).toBe(2);expect(repo.getVersion(v1.knowledgeId,1)?.checksum).toBe(hash);
    expect(repo.listVersions(v1.knowledgeId).map(v=>v.version)).toEqual([1,2]);expect(v1.reviewStatus).toBe('APPROVED');
  });
  it.each([
    {platformCode:'ChatGPT'},{platformCode:'CHATGPT',channelCode:'NAVER_AI_BRIEFING'},
    {channelCode:'CHATGPT_WEB_SEARCH'},{industry:'DENTAL'},
  ])('rejects invalid canonical/industry scope %#',scope=>expect(()=>knowledgeDraftSchema.parse({...fact(),scope})).toThrow());
  it('distinguishes expired, review-due, future and retired without rewriting historical versions',()=>{
    const repo=approved(),v1=repo.get('FACT_TEST_001')!;
    expect(repo.inspect(v1.knowledgeId,1,'2026-12-02T00:00:00Z')?.validity).toBe('EXPIRED');
    expect(validityAt(v1,'2026-11-02T00:00:00Z')).toBe('REVIEW_DUE');
    expect(validityAt(v1,'2026-10-14T00:00:00Z')).toBe('NOT_YET_VALID');
    const retired=repo.retire(v1.knowledgeId,1,command('2026-10-16T00:00:00Z'));
    expect(retired.version).toBe(2);expect(repo.inspect(v1.knowledgeId,1,'2026-10-17T00:00:00Z')?.validity).toBe('RETIRED');
    expect(repo.inspect(v1.knowledgeId,1,at)?.validity).toBe('CURRENT');expect(repo.getVersion(v1.knowledgeId,1)).toEqual(v1);
  });
  it('keeps observations reference-only and denies unscoped or cross-project reads',()=>{
    const observation:KnowledgeDraft={...fact(),knowledgeId:'OBS_TEST_001',knowledgeType:'OBSERVATION',claim:'REFERENCED_INTERNAL_OBSERVATION',scope:{platformCode:'CHATGPT',projectId:'PROJECT_TEST_A'},provenance:{sourceType:'INTERNAL_OBSERVATION',capturedAt:at,evidenceRefs:[{projectId:'PROJECT_TEST_A',kind:'AI_RESPONSE',id:'RESPONSE_TEST'}]}};
    const repo=approved(observation),access={authorizedProjectIds:['PROJECT_TEST_A']};
    expect(repo.list()).toEqual([]);expect(repo.get(observation.knowledgeId)).toBeUndefined();expect(repo.getVersion(observation.knowledgeId,1)).toBeUndefined();expect(repo.listVersions(observation.knowledgeId)).toEqual([]);
    expect(repo.list({...access,platformCode:'CHATGPT',knowledgeType:'OBSERVATION',reviewStatus:'APPROVED'})).toHaveLength(1);
    expect(repo.getVersion(observation.knowledgeId,1,access)?.knowledgeType).toBe('OBSERVATION');
    expect(()=>approved({...observation,claim:'Customer raw response'})).toThrow();
    expect(()=>approved({...observation,scope:{platformCode:'CHATGPT',projectId:'OTHER'}})).toThrow();
  });
  it('does not promote repeated observations/hypotheses; a new FACT version needs fresh official review',()=>{
    const input={...fact(),knowledgeId:'HYP_TEST_001',knowledgeType:'HYPOTHESIS' as const};input.provenance.sourceType='MANUAL_RESEARCH';delete input.provenance.sourceUrl;
    const repo=approved(input);for(let n=0;n<10;n++)expect(repo.get(input.knowledgeId)?.knowledgeType).toBe('HYPOTHESIS');
    const promoted={...input,version:2,knowledgeType:'FACT' as const,supersedes:{knowledgeId:input.knowledgeId,version:1}};
    repo.createDraft(promoted,command());repo.submitForReview(input.knowledgeId,2,command());expect(()=>repo.approve(input.knowledgeId,2,command())).toThrow();
    expect(repo.getVersion(input.knowledgeId,1)?.knowledgeType).toBe('HYPOTHESIS');
  });
  it('canonicalizes object keys, preserves array order and changes checksums with new versions',()=>{
    expect(canonicalChecksum({b:2,a:{d:4,c:3}})).toBe(canonicalChecksum({a:{c:3,d:4},b:2}));
    expect(canonicalChecksum([1,2])).not.toBe(canonicalChecksum([2,1]));expect(()=>canonicalChecksum({bad:NaN})).toThrow();
    const repo=approved(),before=repo.get('FACT_TEST_001')!;const input=fact();input.version=2;input.supersedes={knowledgeId:input.knowledgeId,version:1};
    expect(repo.createDraft(input,command()).checksum).not.toBe(before.checksum);
  });
  it('keeps retirement history effective after a new draft and preserves original creation time',()=>{
    const repo=createInMemoryKnowledgeRepository();repo.createDraft(fact(),command());
    repo.submitForReview('FACT_TEST_001',1,command('2026-10-15T01:00:00Z'));
    expect(()=>repo.approve('FACT_TEST_001',1,command())).toThrow();
    const v1=repo.approve('FACT_TEST_001',1,command('2026-10-15T02:00:00Z'));expect(v1.createdAt).toBe(at);
    repo.retire(v1.knowledgeId,1,command('2026-10-16T00:00:00Z'));
    const v3={...fact(),version:3,supersedes:{knowledgeId:v1.knowledgeId,version:2}};
    repo.createDraft(v3,command('2026-10-17T00:00:00Z'));
    expect(repo.inspect(v1.knowledgeId,1,'2026-10-18T00:00:00Z')?.validity).toBe('RETIRED');
  });
  it('rejects invalid date intervals and never freezes or retains a caller-owned draft',()=>{
    const input=fact(),repo=createInMemoryKnowledgeRepository();repo.createDraft(input,command());
    input.claim='changed caller copy';expect(repo.get(input.knowledgeId)?.claim).not.toBe(input.claim);
    expect(()=>repo.createDraft({...fact(),validity:{validFrom:at,expiresAt:'2026-10-14T00:00:00Z'}},command())).toThrow();
    expect(()=>validityAt(approved().get('FACT_TEST_001')!,'not-a-date')).toThrow();
  });
});

describe('Rule/RuleSet registry validation',()=>{
  it('pins knowledge checksums and RuleSet rule checksums deterministically',()=>{
    const repo=approved(),registry=createRuleRegistry([rule()],[ruleSet()],repo),same=createRuleRegistry([rule()],[ruleSet()],repo);
    expect(registry.getRuleVersion('RULE_TEST_001',1)?.knowledgeChecksums).toEqual([repo.get('FACT_TEST_001')!.checksum]);
    expect(registry.getRuleSetVersion('RULESET_TEST_001',1)?.checksum).toBe(same.getRuleSetVersion('RULESET_TEST_001',1)?.checksum);
    const rules=registry.listApplicableRules({platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',industry:'MEDICAL',at});expect(rules).toHaveLength(1);
    expect(Object.isFrozen(rules[0].knowledgeRefs)).toBe(true);expect(Object.isFrozen(registry.getRuleSetVersion('RULESET_TEST_001',1)?.ruleRefs)).toBe(true);
    expect(registry.listApplicableRules({platformCode:'GEMINI',at})).toEqual([]);
    expect(registry.listApplicableRules({platformCode:'CHATGPT',at})).toEqual([]);
    expect(registry.listApplicableRules({platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',at:'2026-12-02T00:00:00Z'})).toEqual([]);
  });
  it.each(['eval','GOOGLE_INDEX','MERCHANT_CENTER','NAVER_PLACE','__proto__'])('rejects unsupported checkType %s',checkType=>expect(()=>createRuleRegistry([{...rule(),checkType} as any],[],approved())).toThrow());
  it.each(['code','eval','expression','javascript'])('rejects executable payload field %s',key=>expect(()=>createRuleRegistry([{...rule(),[key]:'globalThis.bad=true'}],[],approved())).toThrow());
  it('registers only existing evidence capabilities without implementing check execution',()=>{
    expect(Object.keys(CHECK_TYPES)).toEqual(['ROBOTS_ACCESS','NOINDEX','PAGE_TEXT_PRESENT','STRUCTURED_DATA_PRESENT','CITATION_PRESENT']);
    expect(Object.values(CHECK_TYPES).every(v=>!!v.source&&!!v.unknownWhen)).toBe(true);
  });
  it('requires existing, current, approved knowledge and matching platform/channel scope',()=>{
    const repo=approved();expect(()=>createRuleRegistry([{...rule(),knowledgeRefs:[{knowledgeId:'MISSING',version:1,role:'CONFIRMED'}]}],[],repo)).toThrow();
    expect(()=>createRuleRegistry([{...rule(),channelScope:'NAVER_AI_BRIEFING'}],[],repo)).toThrow();
    const broad=fact();delete broad.scope.channelCode;expect(()=>createRuleRegistry([rule()],[],approved(broad))).toThrow();
    const draftRepo=createInMemoryKnowledgeRepository();draftRepo.createDraft(fact(),command());expect(()=>createRuleRegistry([rule()],[],draftRepo)).toThrow();
    repo.retire('FACT_TEST_001',1,command());expect(()=>createRuleRegistry([rule()],[],repo)).toThrow();
  });
  it('keeps hypotheses experimental and never returns them as confirmed applicable Rules',()=>{
    const hypothesis={...fact(),knowledgeId:'HYP_TEST_001',knowledgeType:'HYPOTHESIS' as const},repo=approved(hypothesis);
    const candidate={...rule(),knowledgeRefs:[{knowledgeId:hypothesis.knowledgeId,version:1,role:'EXPERIMENTAL' as const}]};
    expect(()=>createRuleRegistry([candidate],[],repo)).toThrow();
    const registry=createRuleRegistry([{...candidate,basis:'EXPERIMENTAL'}],[],repo);
    expect(registry.listApplicableRules({platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',at})).toEqual([]);
    expect(()=>createRuleRegistry([{...candidate,basis:'EXPERIMENTAL'}],[ruleSet()],repo)).toThrow();
  });
  it('allows scoped observations only as supporting evidence with authorized project context',()=>{
    const repo=approved();const obs:KnowledgeDraft={...fact(),knowledgeId:'OBS_TEST_001',knowledgeType:'OBSERVATION',claim:'REFERENCED_INTERNAL_OBSERVATION',scope:{platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',projectId:'PROJECT_TEST_A'},provenance:{sourceType:'CLIENT_EVIDENCE',capturedAt:at,evidenceRefs:[{projectId:'PROJECT_TEST_A',kind:'CITATION',id:'CITATION_TEST'}]}};
    repo.createDraft(obs,command());repo.submitForReview(obs.knowledgeId,1,command());repo.approve(obs.knowledgeId,1,command());
    const input={...rule(),projectId:'PROJECT_TEST_A',knowledgeRefs:[...rule().knowledgeRefs,{knowledgeId:obs.knowledgeId,version:1,role:'SUPPORTING' as const}]};
    const registry=createRuleRegistry([input],[],repo);
    expect(registry.listApplicableRules({platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',projectId:'PROJECT_TEST_A',at})).toEqual([]);
    expect(registry.listApplicableRules({platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',projectId:'PROJECT_TEST_A',authorizedProjectIds:['PROJECT_TEST_A'],at})).toHaveLength(1);
    expect(()=>createRuleRegistry([{...input,projectId:undefined}],[],repo)).toThrow();
  });
  it('rejects duplicate immutable versions, unreviewed Rules and missing RuleSet references',()=>{
    const repo=approved();expect(()=>createRuleRegistry([rule(),rule()],[],repo)).toThrow();
    expect(()=>createRuleRegistry([{...rule(),reviewedBy:undefined}],[],repo)).toThrow();
    expect(()=>createRuleRegistry([], [ruleSet()],repo)).toThrow();
    expect(()=>createRuleRegistry([rule()],[ruleSet(),ruleSet()],repo)).toThrow();
    const registry=createRuleRegistry([rule(),{...rule(),version:2,name:'SYNTHETIC v2'}],[ruleSet(),{...ruleSet(),version:2,ruleRefs:[{ruleId:'RULE_TEST_001',version:2}]}],repo);
    expect(registry.listRuleVersions('RULE_TEST_001')).toHaveLength(2);expect(registry.listRuleSetVersions('RULESET_TEST_001')).toHaveLength(2);
    expect(registry.getRuleSetVersion('RULESET_TEST_001',1)?.checksum).not.toBe(registry.getRuleSetVersion('RULESET_TEST_001',2)?.checksum);
  });
  it('preserves resolver identity, complete raw records and existing Snapshot hashes',()=>{
    const legacy={provider:'ChatGPT',consumerScreen:'CHATGPT_WEB_SEARCH',method:'DEMO' as const,rawText:'원문\r\n  그대로',snapshot:{sha256:'OLD_HASH',data:{provider:'네이버 AI 검색'}}};
    const before=canonicalChecksum(legacy),identity=resolvePlatformIdentity(legacy);const repo=approved();createRuleRegistry([rule()],[ruleSet()],repo);
    expect(resolvePlatformIdentity(legacy)).toEqual(identity);expect(canonicalChecksum(legacy)).toBe(before);expect(legacy.snapshot.sha256).toBe('OLD_HASH');
  });
  it('excludes unapproved, retired and not-yet-reviewed Rules without altering versions',()=>{
    const repo=approved(),input=rule(),query={platformCode:'CHATGPT' as const,channelCode:'CHATGPT_WEB_SEARCH' as const,at};
    const draft=createRuleRegistry([{...input,reviewStatus:'DRAFT',reviewedBy:undefined,reviewedAt:undefined}],[],repo);
    expect(draft.listApplicableRules(query)).toEqual([]);
    const future=createRuleRegistry([{...input,audit:command('2026-10-16T00:00:00Z'),reviewedAt:'2026-10-16T00:00:00Z'}],[],repo);
    expect(future.listApplicableRules(query)).toEqual([]);
    const registry=createRuleRegistry([input],[],repo),v1=registry.getRuleVersion(input.ruleId,1);
    repo.retire('FACT_TEST_001',1,command('2026-10-16T00:00:00Z'));
    expect(registry.listApplicableRules({...query,at:'2026-10-17T00:00:00Z'})).toEqual([]);
    expect(registry.getRuleVersion(input.ruleId,1)).toEqual(v1);
  });
});
