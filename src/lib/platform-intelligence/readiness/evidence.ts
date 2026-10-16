import {canonicalChecksum,timestamp} from '../knowledge/contracts';
import {assertObservationContext} from '../observations/context';
import {buildResponseObservationContext,buildCitedObservationContext} from '../observations/adapters';
import type {CanonicalObservationContext} from '../observations/context';
import type {ProjectData} from '../../types';
import type {RuleVersion} from '../rules/registry';
import type {EvaluationScope,ReadinessRulePolicy,ReadinessEvidenceRef,ReadinessItem} from './contracts';

export type EvidenceResult=Pick<ReadinessItem,'status'|'reasonCode'|'evidenceRefs'|'verifiedEvidence'|'contextComplete'|'stale'>;
const unknown=(reasonCode:string,evidenceRefs:readonly ReadinessEvidenceRef[]=[],stale=false):EvidenceResult=>({status:'UNKNOWN',reasonCode,evidenceRefs,stale,verifiedEvidence:false,contextComplete:false});
function evaluateFromEvidence(project:ProjectData,scope:EvaluationScope,rule:RuleVersion,policy:ReadinessRulePolicy,contexts:readonly CanonicalObservationContext[],allowDemo:boolean):EvidenceResult {
  if(project.id!==scope.projectId)throw Error('Project evidence scope mismatch');
  const source=policy.source;if(!source)return unknown('EVIDENCE_NEEDED');
  const page=source.kind==='PAGE'?project.client.studioRepository?.pages.find(p=>p.id===source.id):undefined;
  const audit=source.kind==='AUDIT'?project.audits.find(a=>a.id===source.id):undefined;
  const response=source.kind==='RESPONSE'?project.responses.find(r=>r.id===source.id):undefined;
  if(!page&&!audit&&!response)return unknown('PROJECT_EVIDENCE_NOT_FOUND');
  const record=page??audit??response!,at=page?.at??audit?.at??response!.observedAt;
  const refs:ReadinessEvidenceRef[]=[{projectId:project.id,kind:source.kind,id:source.id,at,checksum:canonicalChecksum(record)}];
  if(!timestamp.safeParse(at).success)return unknown('EVIDENCE_UNDATED');
  const age=(Date.parse(scope.evidenceAsOf)-Date.parse(at))/1000;
  if(age<0)return unknown('EVIDENCE_AFTER_AS_OF',refs);
  if(age>policy.maxAgeSeconds||policy.evidenceExpiresAt&&Date.parse(policy.evidenceExpiresAt)<Date.parse(scope.evidenceAsOf))return unknown('EVIDENCE_STALE',refs,true);
  if((page?.kind==='DEMO'||audit?.kind==='DEMO'||response?.kind==='DEMO')&&!allowDemo)return unknown('DEMO_EXCLUDED',refs);
  const finish=(status:EvidenceResult['status'],reasonCode:string,verifiedEvidence=false,contextComplete=true):EvidenceResult=>({status,reasonCode,evidenceRefs:refs,verifiedEvidence,contextComplete,stale:false});
  if(rule.checkType==='ROBOTS_ACCESS'){
    if(!audit||audit.origin==='OBSERVATION_STRATEGY')return unknown('ROBOTS_AUDIT_NEEDED',refs);
    const decisions=audit.findings.filter(f=>f.key==='robots-'+policy.robotsAgent);
    if(decisions.length!==1)return unknown('ROBOTS_AGENT_EVIDENCE_NEEDED',refs);
    const status=decisions[0].status;
    return status==='pass'?finish('PASS','ROBOTS_RULE_ALLOWED'):status==='fail'?finish('FAIL','ROBOTS_RULE_BLOCKED'):unknown('ROBOTS_DECISION_UNKNOWN',refs);
  }
  if(rule.checkType==='NOINDEX'||rule.checkType==='PAGE_TEXT_PRESENT'||rule.checkType==='STRUCTURED_DATA_PRESENT'){
    if(!page||page.technical.status!==200)return unknown('PARSED_SUCCESSFUL_PAGE_NEEDED',refs);
    if(rule.checkType==='NOINDEX'){
      const directives=page.technical.robots+(policy.noindexScope==='HTML_AND_HEADER'?' '+page.technical.xRobotsTag:'');
      if(/\b(noindex|none)\b/i.test(directives))return finish('FAIL','EXPLICIT_NOINDEX_PRESENT');
      if(policy.noindexScope==='HTML_AND_HEADER'&&page.kind!=='LIVE'&&!page.technical.xRobotsTag.trim())return unknown('HTTP_HEADER_EVIDENCE_NEEDED',refs);
      return finish('PASS','EXPLICIT_NOINDEX_ABSENT_IN_SCOPE');
    }
    if(rule.checkType==='PAGE_TEXT_PRESENT')return page.body.trim()?finish('PASS','PAGE_TEXT_PRESENT'):finish('FAIL','PAGE_TEXT_ABSENT');
    const usable=page.jsonLd.some(v=>v!==null&&typeof v==='object');
    if(usable&&page.jsonLdErrors.length)return finish('WARN','PARTIAL_JSONLD_PARSE');
    if(usable)return finish('PASS','JSONLD_PRESENT_AND_PARSED');
    if(page.jsonLd.length)return finish('WARN','JSONLD_UNSUPPORTED_SHAPE');
    return finish('FAIL',page.jsonLdErrors.length?'JSONLD_PARSE_FAILED':'JSONLD_ABSENT');
  }
  if(rule.checkType==='CITATION_PRESENT'){
    if(!response)return unknown('OBSERVATION_EVIDENCE_NEEDED',refs);
    if(response.measurement&&response.measurement.status!=='SUCCEEDED')return unknown('COMPLETED_OBSERVATION_NEEDED',refs);
    const matches=contexts.filter(c=>c.responseId===response.id&&c.projectId===project.id);
    if(matches.length!==1)return unknown('UNAMBIGUOUS_OBSERVATION_CONTEXT_NEEDED',refs);
    let context:CanonicalObservationContext;
    try{
      context=assertObservationContext(matches[0]);
      const extra={...(context.language?{language:context.language}:{}),...(context.modelVersion?{modelVersion:context.modelVersion}:{}),loggedIn:context.loggedIn,personalizationState:context.personalizationState,freshConversation:context.freshConversation};
      const snapshot=context.evidenceRefs.filter(ref=>ref.kind==='SNAPSHOT');
      const current=context.sourceDomain==='CITED'&&snapshot.length===1?buildCitedObservationContext(project,snapshot[0].id,response.id,extra):buildResponseObservationContext(project,response.id,extra);
      if(context.conditionHash!==current.conditionHash||context.queryId!==response.questionId||context.observedAt!==response.observedAt||context.runNumber!==current.runNumber)return unknown('OBSERVATION_CONTEXT_SOURCE_CHANGED',refs,true);
    }catch{return unknown('INVALID_OBSERVATION_CONTEXT',refs);}
    refs.push({projectId:project.id,kind:'OBSERVATION_CONTEXT',id:response.id,checksum:context.checksum,at:context.observedAt??at});
    if(context.status==='CONFLICT'||context.status==='UNRESOLVED')return unknown('OBSERVATION_IDENTITY_UNRESOLVED',refs);
    if(context.platformCode!==scope.platformCode)return unknown('WRONG_PLATFORM_EVIDENCE',refs);
    if(scope.channelCode&&context.channelCode!==scope.channelCode)return unknown(context.channelCode?'WRONG_CHANNEL_EVIDENCE':'CHANNEL_UNKNOWN',refs);
    for(const key of ['country','language','region'] as const)if(scope[key]!==null&&context[key]!==scope[key])return unknown('OBSERVATION_LOCALE_MISMATCH',refs);
    if(context.observationMethod==='DEMO'&&!allowDemo)return unknown('DEMO_EXCLUDED',refs);
    const verification=response.verification;
    if(response.accuracy==='INACCURATE'||!verification||verification.status!=='VERIFIED'||verification.sourceConfirmed!==true||!verification.at||!Number.isFinite(Date.parse(verification.at))||Date.parse(verification.at)>Date.parse(scope.evidenceAsOf))return unknown('VERIFIED_OBSERVATION_NEEDED',refs);
    if(context.queryTextHash===null)return unknown('HISTORICAL_QUERY_NEEDED',refs);
    const citations=response.citations;
    if(citations.some(url=>{try{const u=new URL(url);return !['http:','https:'].includes(u.protocol)||!!u.username||!!u.password;}catch{return true;}}))return unknown('INVALID_CITATION_REFERENCE',refs);
    return finish(citations.length?'PASS':'FAIL',citations.length?'VERIFIED_CITATION_PRESENT':'VERIFIED_CITATION_ABSENT',true,context.status==='COMPLETE');
  }
  return unknown('UNSUPPORTED_CHECK_TYPE');
}
export const READINESS_EVALUATORS=Object.freeze({ROBOTS_ACCESS:evaluateFromEvidence,NOINDEX:evaluateFromEvidence,PAGE_TEXT_PRESENT:evaluateFromEvidence,STRUCTURED_DATA_PRESENT:evaluateFromEvidence,CITATION_PRESENT:evaluateFromEvidence});
export function resolveReadinessEvidence(...args:Parameters<typeof evaluateFromEvidence>):EvidenceResult {
  const type=args[2].checkType;return Object.hasOwn(READINESS_EVALUATORS,type)?READINESS_EVALUATORS[type](...args):unknown('UNSUPPORTED_CHECK_TYPE');
}
