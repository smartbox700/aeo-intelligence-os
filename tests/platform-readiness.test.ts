import {describe,it,expect} from 'vitest';
import {readinessFixture} from './platform-readiness.fixture';
import {command,at} from './platform-knowledge.fixture';
import {canonicalChecksum} from '../src/lib/platform-intelligence/knowledge/contracts';
import {productionKnowledge} from '../src/lib/platform-intelligence/knowledge/repository';
import {productionRules,productionRuleSets,createRuleRegistry} from '../src/lib/platform-intelligence/rules/registry';
import {createReadinessRuleSet,productionReadinessRuleSets} from '../src/lib/platform-intelligence/readiness/contracts';
import {evaluatePlatformReadiness,evaluateProductionReadiness} from '../src/lib/platform-intelligence/readiness/engine';
import {assertReadinessEvaluation,createInMemoryReadinessRepository} from '../src/lib/platform-intelligence/readiness/repository';
import {READINESS_EVALUATORS} from '../src/lib/platform-intelligence/readiness/evidence';
import {buildResponseObservationContext} from '../src/lib/platform-intelligence/observations/adapters';
function evaluate(f:ReturnType<typeof readinessFixture>,extra:Partial<Parameters<typeof evaluatePlatformReadiness>[0]>={}){return evaluatePlatformReadiness({project:f.project,scope:f.scope,ruleSet:f.binding,catalog:f.catalog,knowledge:f.knowledge,contexts:[f.context],...extra});}

describe('Evidence-Based Internal Readiness',()=>{
  it('returns NOT_CONFIGURED with unavailable scores for all six production platforms',()=>{
    const f=readinessFixture(),results=evaluateProductionReadiness(f.project,at);
    expect(results.map(r=>r.scope.platformCode)).toEqual(['CHATGPT','GOOGLE_AI','GEMINI','NAVER_AI','CLAUDE','PERPLEXITY']);
    for(const r of results){expect(r).toMatchObject({status:'NOT_CONFIGURED',reasonCode:'NO_APPROVED_RULESET',score:null,lowerBound:null,upperBound:null,coverage:null,confidence:'INSUFFICIENT'});expect(assertReadinessEvaluation(r)).toEqual(r);}
    expect([productionKnowledge.length,productionRules.length,productionRuleSets.length,productionReadinessRuleSets.length]).toEqual([0,0,0,0]);
  });
  it('runs only five registered evaluators and passes current approved factual checks',()=>{
    expect(Object.keys(READINESS_EVALUATORS)).toEqual(['ROBOTS_ACCESS','NOINDEX','PAGE_TEXT_PRESENT','STRUCTURED_DATA_PRESENT','CITATION_PRESENT']);
    const f=readinessFixture(['ROBOTS_ACCESS','NOINDEX','PAGE_TEXT_PRESENT','STRUCTURED_DATA_PRESENT','CITATION_PRESENT']),result=evaluate(f);
    expect(result).toMatchObject({status:'READY',score:100,lowerBound:100,upperBound:100,coverage:1,W:5,K:5,P:5,counts:{pass:5,warn:0,fail:0,unknown:0,notApplicable:0}});
    expect(assertReadinessEvaluation(result)).toEqual(result);expect(result.label).toBe('Internal Readiness');
    expect(result.items.every(i=>i.knowledgeRefs[0].knowledgeType==='FACT')).toBe(true);
  });
  it.each(['ROBOTS_ACCESS','NOINDEX','PAGE_TEXT_PRESENT','STRUCTURED_DATA_PRESENT','CITATION_PRESENT'] as const)('returns UNKNOWN for missing %s evidence instead of FAIL',type=>{
    const f=readinessFixture([type]);f.project.audits=[];f.project.client.studioRepository!.pages=[];f.project.responses=[];
    const result=evaluate(f);expect(result.items[0].status).toBe('UNKNOWN');expect(result).toMatchObject({status:'PARTIAL',score:null,lowerBound:0,upperBound:100,coverage:0,confidence:'INSUFFICIENT'});
  });
  it('fails explicit robots blocks, noindex, absent text, absent structured data and verified absent citations',()=>{
    const f=readinessFixture(['ROBOTS_ACCESS','NOINDEX','PAGE_TEXT_PRESENT','STRUCTURED_DATA_PRESENT','CITATION_PRESENT']);
    f.project.audits[0].findings[0].status='fail';f.page.technical.robots='robots: noindex';f.page.body=' ';f.page.jsonLd=[];f.response.citations=[];
    const result=evaluate(f);expect(result).toMatchObject({status:'READY',score:0,coverage:1,counts:{pass:0,warn:0,fail:5,unknown:0,notApplicable:0}});
    expect(result.items.every(i=>i.actionCandidateRefs.includes('SYNTHETIC_ACTION_REF'))).toBe(true);
  });
  it('handles partial JSON-LD parsing as WARN using the explicit credit policy',()=>{
    const f=readinessFixture(['STRUCTURED_DATA_PRESENT']);f.page.jsonLdErrors=['SYNTHETIC PARSE ERROR'];
    expect(evaluate(f)).toMatchObject({score:50,coverage:1,counts:{warn:1},P:0.5});
  });
  it('computes W/K/P and bounds from explicit weights while excluding N/A',()=>{
    const f=readinessFixture(['PAGE_TEXT_PRESENT','STRUCTURED_DATA_PRESENT','NOINDEX','CITATION_PRESENT','PAGE_TEXT_PRESENT'],(r,i)=>{if(i===4)r.industryScope='LEGAL';});
    f.page.jsonLdErrors=['SYNTHETIC'];f.page.technical.robots='robots: noindex';
    const checks=f.checks.map((p,i)=>({...p,weight:[2,3,5,7,101][i],...(i===3?{source:null}:{})}));
    const binding=createReadinessRuleSet({...f.policyInput,checks},f.catalog),result=evaluate(f,{ruleSet:binding});
    expect(result).toMatchObject({W:17,K:10,P:3.5,score:null,counts:{pass:1,warn:1,fail:1,unknown:1,notApplicable:1}});
    expect(result.coverage).toBeCloseTo(10/17);expect(result.lowerBound).toBeCloseTo(100*3.5/17);expect(result.upperBound).toBeCloseTo(100*10.5/17);expect(assertReadinessEvaluation(result)).toEqual(result);
    expect(result.items[4].reasonCode).toBe('INDUSTRY_NOT_APPLICABLE');expect(f.rules[0].weightCandidate).toBe(999);
  });
  it('does not divide by zero or emit zero readiness when all checks are N/A',()=>{
    const f=readinessFixture(['PAGE_TEXT_PRESENT'],r=>{r.industryScope='LEGAL';});
    expect(evaluate(f)).toMatchObject({status:'PARTIAL',reasonCode:'NO_APPLICABLE_RULES',W:0,K:0,score:null,lowerBound:null,upperBound:null,coverage:null});
  });
  it.each(['2026-11-02T00:00:00Z','2026-12-02T00:00:00Z'])('quarantines review-due or expired knowledge at %s',evidenceAsOf=>{
    const f=readinessFixture();const result=evaluate(f,{scope:{...f.scope,evidenceAsOf}});
    expect(result.status).toBe('STALE');expect(result.items[0].status).toBe('UNKNOWN');expect(result.score).toBeNull();expect(result.lowerBound).toBeNull();
  });
  it('does not keep prior PASS after retirement, and preserves the prior evaluation',()=>{
    const f=readinessFixture(),old=evaluate(f),hash=old.checksum;
    f.knowledge.retire('FACT_READINESS_TEST_0',1,command());const next=evaluate(f);
    expect(next.status).toBe('STALE');expect(next.items[0].reasonCode).toBe('KNOWLEDGE_RETIRED');expect(old.checksum).toBe(hash);expect(old.items[0].status).toBe('PASS');
  });
  it('treats stale, future or unsuccessful page evidence as unknown',()=>{
    const f=readinessFixture();f.page.at='2026-01-01T00:00:00Z';expect(evaluate(f)).toMatchObject({status:'STALE',score:null,items:[{status:'UNKNOWN',reasonCode:'EVIDENCE_STALE'}]});
    f.page.at='2026-10-16T00:00:00Z';expect(evaluate(f).items[0].reasonCode).toBe('EVIDENCE_AFTER_AS_OF');
    f.page.at=at;f.page.technical.status=403;expect(evaluate(f).items[0].status).toBe('UNKNOWN');
  });
  it('excludes explicit expired evidence even if the source itself was recently captured',()=>{
    const f=readinessFixture(),binding=createReadinessRuleSet({...f.policyInput,checks:f.checks.map(p=>({...p,evidenceExpiresAt:'2026-10-14T00:00:00Z'}))},f.catalog);
    expect(evaluate(f,{ruleSet:binding}).items[0]).toMatchObject({status:'UNKNOWN',stale:true});
  });
  it('does not reuse Gemini citations for ChatGPT or channel-unknown citations for channel Rules',()=>{
    const f=readinessFixture(['CITATION_PRESENT']);f.response.provider='Gemini';f.response.consumer!.screen='GEMINI_CONSUMER_SEARCH';
    const gemini=buildResponseObservationContext(f.project,f.response.id,f.supplements);expect(evaluate(f,{contexts:[gemini]}).items[0].reasonCode).toBe('WRONG_PLATFORM_EVIDENCE');
    f.response.provider='ChatGPT';delete f.response.consumer;const legacy=buildResponseObservationContext(f.project,f.response.id,f.supplements);
    expect(evaluate(f,{contexts:[legacy]}).items[0].reasonCode).toBe('CHANNEL_UNKNOWN');
  });
  it('rejects stale, unverified or duplicate observation context evidence',()=>{
    const f=readinessFixture(['CITATION_PRESENT']);f.response.verification!.status='UNVERIFIED';expect(evaluate(f).items[0].reasonCode).toBe('VERIFIED_OBSERVATION_NEEDED');
    f.response.verification!.status='VERIFIED';f.response.region='BUSAN';expect(evaluate(f).items[0].status).toBe('UNKNOWN');
    f.response.region='SEOUL';expect(evaluate(f,{contexts:[f.context,f.context]}).items[0].status).toBe('UNKNOWN');
  });
  it('excludes DEMO by default and allows it only for explicit synthetic evaluation',()=>{
    const f=readinessFixture();f.page.kind='DEMO';expect(evaluate(f).items[0].reasonCode).toBe('DEMO_EXCLUDED');expect(evaluate(f,{allowDemo:true}).items[0].status).toBe('PASS');
    const production=createReadinessRuleSet({...f.policyInput,environment:'PRODUCTION'},f.catalog);expect(evaluate(f,{ruleSet:production,allowDemo:true}).status).toBe('INVALID');
  });
  it('keeps confidence independent of readiness score',()=>{
    const f=readinessFixture(['CITATION_PRESENT']),pass=evaluate(f);f.response.citations=[];const fail=evaluate(f);
    expect(pass.score).toBe(100);expect(fail.score).toBe(0);expect(pass.confidence).toBe('HIGH');expect(fail.confidence).toBe('HIGH');
    f.response.model='미표시';const unknownModel=buildResponseObservationContext(f.project,f.response.id,{language:'ko-KR',loggedIn:'NO',personalizationState:'DISABLED',freshConversation:'TRUE'});
    expect(evaluate(f,{contexts:[unknownModel]}).confidence).toBe('LOW');
  });
  it('pins policy/checksums, requires approved weights and preserves v1 after v2 exists',()=>{
    const f=readinessFixture(),old=evaluate(f),oldChecksum=old.checksum;
    expect(evaluate(f)).toEqual(old);expect(old.ruleSetChecksum).toBe(f.binding.checksum);
    const secondSet={...f.set,version:2};const secondCatalog=createRuleRegistry(f.rules,[f.set,secondSet],f.knowledge);
    const second=createReadinessRuleSet({...f.policyInput,ruleSetVersion:2},secondCatalog),next=evaluate(f,{catalog:secondCatalog,ruleSet:second});
    expect(next.checksum).not.toBe(oldChecksum);expect(old.checksum).toBe(oldChecksum);expect(old.ruleSetVersion).toBe(1);
    expect(()=>createReadinessRuleSet({...f.policyInput,checks:[]},f.catalog)).toThrow();
    expect(()=>createReadinessRuleSet({...f.policyInput,checks:f.checks.map(p=>({...p,weight:0}))},f.catalog)).toThrow();
    expect(()=>createReadinessRuleSet({...f.policyInput,scope:{platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH'}},f.catalog)).toThrow();
  });
  it('rejects tampered policy, experimental Rules, wrong scope and cross-project evaluation',()=>{
    const f=readinessFixture();expect(evaluate(f,{ruleSet:{...f.binding,checksum:'0'.repeat(64)}}).status).toBe('INVALID');
    expect(evaluate(f,{scope:{...f.scope,platformCode:'GEMINI',channelCode:'GEMINI_CONSUMER_SEARCH'}}).status).toBe('INVALID');
    expect(()=>evaluate(f,{scope:{...f.scope,projectId:'OTHER'}})).toThrow();
    const experimentalCatalog={...f.catalog,getRuleVersion:(id:string,v:number)=>{const r=f.catalog.getRuleVersion(id,v);return r?{...r,basis:'EXPERIMENTAL' as const}:undefined;}};
    expect(evaluate(f,{catalog:experimentalCatalog}).status).toBe('INVALID');
  });
  it('blocks hypothesis injection and missing approved source knowledge',()=>{
    const f=readinessFixture();const altered={...f.knowledge,inspect:()=>undefined};expect(evaluate(f,{knowledge:altered}).status).toBe('INVALID');
    const hypothesis={...f.knowledge,inspect:(...args:Parameters<typeof f.knowledge.inspect>)=>{const v=f.knowledge.inspect(...args);return v?{...v,record:{...v.record,knowledgeType:'HYPOTHESIS' as const}}:undefined;}};
    const result=evaluate(f,{knowledge:hypothesis});expect(result.status).toBe('INVALID');expect(result.score).toBeNull();
  });
  it('records scoped references and hashes without copying raw evidence, client reports or source text',()=>{
    const f=readinessFixture(['CITATION_PRESENT','PAGE_TEXT_PRESENT']),before=canonicalChecksum(f.project),result=evaluate(f),json=JSON.stringify(result);
    expect(canonicalChecksum(f.project)).toBe(before);for(const text of [f.response.rawText,f.page.body,'SYNTHETIC_PERSON_NOT_TO_COPY','https://example.invalid/citation'])expect(json).not.toContain(text);
    expect(result.items.every(i=>i.evidenceRefs.every(ref=>ref.projectId===f.project.id))).toBe(true);expect(Object.isFrozen(result.items[0].evidenceRefs)).toBe(true);
  });
  it('provides append-only, versioned, project-authorized result storage',()=>{
    const f=readinessFixture(),result=evaluate(f),repo=createInMemoryReadinessRepository({authorize:(actor,p)=>actor==='ACTOR_TEST'&&p===f.project.id,ownsEvidence:(p,ref)=>p===f.project.id&&ref.projectId===p});
    const audit={actorId:'ACTOR_TEST',createdAt:at,reason:'SYNTHETIC TEST STORAGE'};const first=repo.appendEvaluation(result,0,audit);
    f.page.body='';const second=repo.appendEvaluation(evaluate(f),1,audit);expect(second.previousChecksum).toBe(first.checksum);
    expect(repo.getVersion(f.project.id,1,audit.actorId)).toEqual(first);expect(repo.getEvaluation(f.project.id,result.evaluationId,audit.actorId)).toEqual(first);expect(repo.listByProject(f.project.id,audit.actorId)).toHaveLength(2);expect(repo.listByPlatform(f.project.id,'CHATGPT',audit.actorId)).toHaveLength(2);
    expect(()=>repo.getVersion(f.project.id,1,'OTHER')).toThrow();expect(()=>repo.appendEvaluation(result,2,audit)).toThrow();expect(()=>assertReadinessEvaluation({...result,score:12})).toThrow();
    const changedPolicy=createReadinessRuleSet({...f.policyInput,checks:f.checks.map(p=>({...p,weight:2}))},f.catalog);
    expect(()=>repo.appendEvaluation(evaluate(f,{ruleSet:changedPolicy}),2,audit)).toThrow('new RuleSet version');
    const denied=createInMemoryReadinessRepository({authorize:()=>true,ownsEvidence:()=>false});expect(()=>denied.appendEvaluation(result,0,audit)).toThrow();
  });
  it('does not infer absent HTTP noindex headers from supplied manual HTML',()=>{
    const f=readinessFixture(['NOINDEX']);
    const binding=createReadinessRuleSet({...f.policyInput,checks:f.checks.map(p=>({...p,noindexScope:'HTML_AND_HEADER'}))},f.catalog);
    expect(evaluate(f,{ruleSet:binding}).items[0].reasonCode).toBe('HTTP_HEADER_EVIDENCE_NEEDED');
    f.page.technical.xRobotsTag='noindex';expect(evaluate(f,{ruleSet:binding}).items[0].status).toBe('FAIL');
    f.page.technical.xRobotsTag='all';expect(evaluate(f,{ruleSet:binding}).items[0].status).toBe('PASS');
  });
  it('marks synthetic evaluations explicitly and never reuses a customer policy for a different project',()=>{
    const f=readinessFixture();expect(evaluate(f)).toMatchObject({environment:'SYNTHETIC',allowDemo:false});
    const other=structuredClone(f.project);other.id='OTHER_PROJECT';
    expect(evaluate(f,{project:other,scope:{...f.scope,projectId:other.id}})).toMatchObject({status:'INVALID',reasonCode:'RULESET_SCOPE_MISMATCH'});
  });
  it('keeps known values isolated across locale, approval as-of and unknown audit decisions',()=>{
    const f=readinessFixture(['ROBOTS_ACCESS']);f.project.audits[0].findings[0].status='unknown';expect(evaluate(f).items[0].status).toBe('UNKNOWN');
    expect(evaluate(f,{scope:{...f.scope,evidenceAsOf:'2026-10-14T00:00:00Z'}}).status).toBe('INVALID');
    const citation=readinessFixture(['CITATION_PRESENT']);expect(evaluate(citation,{scope:{...citation.scope,country:'US'}}).items[0].status).toBe('UNKNOWN');
  });
  it('rejects invalid scoring code/credit payloads without copying them into INVALID results',()=>{
    const f=readinessFixture(),forged={...f.binding,scorePolicy:{...f.binding.scorePolicy,code:'SYNTHETIC_EXECUTABLE_PAYLOAD'}};
    const result=evaluate(f,{ruleSet:forged});expect(result.status).toBe('INVALID');expect(result.scorePolicy).toBeNull();expect(JSON.stringify(result)).not.toContain('SYNTHETIC_EXECUTABLE_PAYLOAD');
    expect(assertReadinessEvaluation(result)).toEqual(result);
  });
  it('allows new evidence under the same immutable RuleSet while pinning the selected evidence separately',()=>{
    const f=readinessFixture(),old=evaluate(f),page=structuredClone(f.page);page.id='NEW_PAGE_TEST';f.project.client.studioRepository!.pages.push(page);
    const nextBinding=createReadinessRuleSet({...f.policyInput,checks:f.checks.map(p=>({...p,source:{kind:'PAGE',id:page.id}}))},f.catalog);
    expect(nextBinding.checksum).toBe(f.binding.checksum);expect(nextBinding.selectionChecksum).not.toBe(f.binding.selectionChecksum);
    const next=evaluate(f,{ruleSet:nextBinding});expect(next.ruleSetVersion).toBe(old.ruleSetVersion);expect(next.checksum).not.toBe(old.checksum);
    const repo=createInMemoryReadinessRepository({authorize:()=>true,ownsEvidence:()=>true}),audit={actorId:'SYNTHETIC_REVIEWER',createdAt:at,reason:'SYNTHETIC NEW EVIDENCE'};
    repo.appendEvaluation(old,0,audit);repo.appendEvaluation(next,1,audit);expect(repo.listByProject(f.project.id,audit.actorId)).toHaveLength(2);expect(old.items[0].evidenceRefs[0].id).toBe('PAGE_TEST');
    expect(evaluate(f,{ruleSet:{...nextBinding,selectionChecksum:f.binding.selectionChecksum}}).status).toBe('INVALID');
  });
});
