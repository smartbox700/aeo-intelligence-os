import type {AuditCommand,KnowledgeDraft} from '../src/lib/platform-intelligence/knowledge/contracts';
import type {RuleInput,RuleSetInput} from '../src/lib/platform-intelligence/rules/registry';
export const at='2026-10-15T00:00:00Z';
export const command=(createdAt=at):AuditCommand=>({actorId:'SYNTHETIC_REVIEWER',createdAt,reason:'SYNTHETIC TEST ONLY; no platform claim'});
export function fact():KnowledgeDraft {return {
  knowledgeId:'FACT_TEST_001',version:1,knowledgeType:'FACT',claim:'SYNTHETIC fixture statement, not a real platform fact',
  scope:{platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH'},
  provenance:{sourceType:'OFFICIAL_DOCUMENT',sourceReference:'SYNTHETIC_OFFICIAL_REFERENCE',sourceUrl:'https://example.invalid/test-only',capturedAt:at,evidenceRefs:[]},
  validity:{validFrom:at,lastVerifiedAt:at,reviewDueAt:'2026-11-01T00:00:00Z',expiresAt:'2026-12-01T00:00:00Z'},
};}
export function rule():RuleInput {return {
  ruleId:'RULE_TEST_001',version:1,name:'SYNTHETIC RULE',description:'SYNTHETIC metadata only; no score or check execution',
  platformScope:'CHATGPT',channelScope:'CHATGPT_WEB_SEARCH',checkType:'PAGE_TEXT_PRESENT',
  knowledgeRefs:[{knowledgeId:'FACT_TEST_001',version:1,role:'CONFIRMED'}],basis:'CONFIRMED',
  severity:'INFO',weightCandidate:null,actionRefs:[],reviewStatus:'APPROVED',effectiveAt:at,retiredAt:null,
  audit:command(),reviewedBy:'SYNTHETIC_REVIEWER',reviewedAt:at,
};}
export function ruleSet():RuleSetInput {return {ruleSetId:'RULESET_TEST_001',version:1,name:'SYNTHETIC RULESET',ruleRefs:[{ruleId:'RULE_TEST_001',version:1}],reviewStatus:'APPROVED',effectiveAt:at,retiredAt:null,audit:command(),reviewedBy:'SYNTHETIC_REVIEWER',reviewedAt:at};}
