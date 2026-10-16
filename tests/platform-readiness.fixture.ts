import {observationProject} from './platform-observation.fixture';
import {fact,rule,ruleSet,command,at} from './platform-knowledge.fixture';
import {createInMemoryKnowledgeRepository} from '../src/lib/platform-intelligence/knowledge/repository';
import {createRuleRegistry} from '../src/lib/platform-intelligence/rules/registry';
import type {CheckType,RuleInput} from '../src/lib/platform-intelligence/rules/registry';
import {createReadinessRuleSet} from '../src/lib/platform-intelligence/readiness/contracts';
import type {ReadinessRulePolicy,ReadinessRuleSetInput,EvaluationScope} from '../src/lib/platform-intelligence/readiness/contracts';
import {parseStudioPage} from '../src/lib/studio-page';
import {buildResponseObservationContext} from '../src/lib/platform-intelligence/observations/adapters';

export function readinessFixture(types:CheckType[]=['PAGE_TEXT_PRESENT'],editRule?:(rule:RuleInput,index:number)=>void){
  const project=observationProject();project.client.website='https://example.invalid/';
  const page=parseStudioPage('<html><head><script type="application/ld+json">{"@type":"Organization"}</script></head><body>SYNTHETIC PAGE ONLY</body></html>',project.client.website,'MANUAL');page.id='PAGE_TEST';page.at=at;
  project.client.studioRepository={facts:[],pages:[page]};
  project.audits=[{id:'AUDIT_TEST',origin:'WEBSITE',kind:'LIVE',url:project.client.website,at,findings:[{key:'robots-SYNTHETIC_AGENT',label:'SYNTHETIC ONLY',status:'pass',evidence:'SYNTHETIC POLICY ONLY',recommendation:'SYNTHETIC'}]}];
  const response=project.responses[0];response.consumer!.searchUsage='USED';response.verification={status:'VERIFIED',reviewer:'SYNTHETIC_REVIEWER',sourceConfirmed:true,note:'SYNTHETIC ONLY',at,history:[]};
  const supplements={modelVersion:'SYNTHETIC_V1',language:'ko-KR',loggedIn:'NO' as const,personalizationState:'DISABLED' as const,freshConversation:'TRUE' as const};
  const context=buildResponseObservationContext(project,response.id,supplements);
  const knowledge=createInMemoryKnowledgeRepository();
  const rules=types.map((checkType,index)=>{
    const k=fact();k.knowledgeId='FACT_READINESS_TEST_'+index;
    knowledge.createDraft(k,command());knowledge.submitForReview(k.knowledgeId,1,command());knowledge.approve(k.knowledgeId,1,command());
    const r={...rule(),ruleId:'RULE_READINESS_TEST_'+index,checkType,weightCandidate:999,knowledgeRefs:[{knowledgeId:k.knowledgeId,version:1,role:'CONFIRMED' as const}],actionRefs:['SYNTHETIC_ACTION_REF']};editRule?.(r,index);return r;
  });
  const set={...ruleSet(),ruleSetId:'RULESET_READINESS_TEST',ruleRefs:rules.map(r=>({ruleId:r.ruleId,version:r.version}))};
  const catalog=createRuleRegistry(rules,[set],knowledge);
  const checks:ReadinessRulePolicy[]=rules.map(r=>({ruleId:r.ruleId,ruleVersion:1,weight:1,maxAgeSeconds:30*86400,source:{kind:r.checkType==='ROBOTS_ACCESS'?'AUDIT':r.checkType==='CITATION_PRESENT'?'RESPONSE':'PAGE',id:r.checkType==='ROBOTS_ACCESS'?'AUDIT_TEST':r.checkType==='CITATION_PRESENT'?response.id:page.id},...(r.checkType==='ROBOTS_ACCESS'?{robotsAgent:'SYNTHETIC_AGENT'}:{}),...(r.checkType==='NOINDEX'?{noindexScope:'HTML_META' as const}:{})}));
  const policyInput:ReadinessRuleSetInput={ruleSetId:set.ruleSetId,ruleSetVersion:1,environment:'SYNTHETIC',scope:{projectId:project.id,platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH'},scorePolicy:{version:'readiness-weighted-bounds-v1',weightSource:'EXPLICIT_RULE_WEIGHTS',credits:{PASS:1,WARN:0.5,FAIL:0}},checks,reviewedBy:'SYNTHETIC_REVIEWER',reviewedAt:at,reason:'SYNTHETIC TEST ONLY; no official platform score'};
  const binding=createReadinessRuleSet(policyInput,catalog);
  const scope:EvaluationScope={projectId:project.id,platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',country:null,language:null,industry:'MEDICAL',region:null,surface:null,evidenceAsOf:at};
  return {project,page,response,context,supplements,knowledge,rules,set,catalog,checks,policyInput,binding,scope};
}
