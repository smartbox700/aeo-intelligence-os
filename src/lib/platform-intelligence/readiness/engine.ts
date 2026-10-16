import {canonicalChecksum,immutable,assertFactApproval} from '../knowledge/contracts';
import type {KnowledgeScope} from '../knowledge/contracts';
import type {PlatformKnowledgeRepository} from '../knowledge/repository';
import type {PlatformRuleRegistry,RuleVersion} from '../rules/registry';
import type {ProjectData} from '../../types';
import type {CanonicalObservationContext} from '../observations/context';
import {getPlatforms} from '../registry';
import {createReadinessRuleSet,evaluationScopeSchema,scorePolicySchema,EVALUATION_VERSION,CONFIDENCE_VERSION} from './contracts';
import type {EvaluationScope,ReadinessEvaluation,ReadinessItem,ReadinessRuleSetVersion} from './contracts';
import {resolveReadinessEvidence} from './evidence';

export type ReadinessInput={project:ProjectData;scope:EvaluationScope;ruleSet?:ReadinessRuleSetVersion|null;catalog?:PlatformRuleRegistry;knowledge?:PlatformKnowledgeRepository;contexts?:readonly CanonicalObservationContext[];allowDemo?:boolean};
function scopeDecision(rule:RuleVersion,scope:EvaluationScope):{status:'UNKNOWN'|'NOT_APPLICABLE';reasonCode:string}|null {
  const dimensions=[['platformScope','platformCode'],['channelScope','channelCode'],['countryScope','country'],['languageScope','language'],['industryScope','industry'],['surfaceScope','surface'],['projectId','projectId']] as const;
  for(const [key,target] of dimensions){
    const expected=rule[key];if(expected===undefined)continue;
    if(scope[target]===null)return {status:'UNKNOWN',reasonCode:target.toUpperCase()+'_SCOPE_NEEDED'};
    if(expected!==scope[target])return {status:'NOT_APPLICABLE',reasonCode:target.toUpperCase()+'_NOT_APPLICABLE'};
  }return null;
}
function knowledgeGate(rule:RuleVersion,repository:PlatformKnowledgeRepository,scope:EvaluationScope){
  const refs:ReadinessItem['knowledgeRefs'][number][]=[],ruleScope:KnowledgeScope={platformCode:rule.platformScope,channelCode:rule.channelScope,country:rule.countryScope,language:rule.languageScope,industry:rule.industryScope,surface:rule.surfaceScope,projectId:rule.projectId};
  let confirmed=0;
  for(const [index,ref] of rule.knowledgeRefs.entries()){
    const inspected=repository.inspect(ref.knowledgeId,ref.version,scope.evidenceAsOf,{authorizedProjectIds:[scope.projectId]});
    if(!inspected)return {refs,invalid:true,stale:false,reasonCode:'KNOWLEDGE_REFERENCE_UNAVAILABLE'};
    const k=inspected.record,{checksum,...body}=k;
    if(checksum!==rule.knowledgeChecksums[index]||canonicalChecksum(body)!==checksum)return {refs,invalid:true,stale:false,reasonCode:'KNOWLEDGE_CHECKSUM_MISMATCH'};
    refs.push({knowledgeId:ref.knowledgeId,version:ref.version,role:ref.role,checksum,knowledgeType:k.knowledgeType,lastVerifiedAt:k.validity.lastVerifiedAt??null});
    if(Object.entries(k.scope).some(([key,value])=>value!==undefined&&Reflect.get(ruleScope,key)!==value))return {refs,invalid:true,stale:false,reasonCode:'KNOWLEDGE_SCOPE_EXPANSION'};
    if(k.knowledgeType==='HYPOTHESIS'||ref.role==='EXPERIMENTAL'||k.knowledgeType==='OBSERVATION'&&ref.role!=='SUPPORTING')return {refs,invalid:true,stale:false,reasonCode:'UNCONFIRMED_KNOWLEDGE_BASIS'};
    if(k.reviewStatus!=='APPROVED'||!k.provenance.reviewedBy||!k.provenance.reviewedAt||Date.parse(k.provenance.reviewedAt)>Date.parse(scope.evidenceAsOf))return {refs,invalid:true,stale:false,reasonCode:'KNOWLEDGE_NOT_APPROVED_AS_OF'};
    if(inspected.validity!=='CURRENT')return {refs,invalid:false,stale:true,reasonCode:'KNOWLEDGE_'+inspected.validity};
    if(ref.role==='CONFIRMED'){
      if(k.knowledgeType!=='FACT'||k.scope.platformCode!==rule.platformScope||k.scope.channelCode!==rule.channelScope)return {refs,invalid:true,stale:false,reasonCode:'CONFIRMED_FACT_SCOPE_REQUIRED'};
      try{assertFactApproval(k,{actorId:k.provenance.reviewedBy,createdAt:scope.evidenceAsOf,reason:'Read-only readiness gate'});}catch{return {refs,invalid:true,stale:false,reasonCode:'OFFICIAL_FACT_REQUIRED'};}
      confirmed++;
    }
  }
  return {refs,invalid:confirmed===0,stale:false,reasonCode:confirmed?'KNOWLEDGE_VALID':'CONFIRMED_FACT_REQUIRED'};
}
function seal(content:Omit<ReadinessEvaluation,'evaluationId'|'checksum'>):ReadinessEvaluation {
  const record={evaluationId:'readiness-'+canonicalChecksum(content),...content};return immutable({...record,checksum:canonicalChecksum(record)});
}
export function evaluatePlatformReadiness(input:ReadinessInput):ReadinessEvaluation {
  const scope=evaluationScopeSchema.parse(input.scope),{project,catalog,knowledge}=input;
  if(project.id!==scope.projectId)throw Error('Project readiness scope mismatch');
  const config=input.ruleSet??null;
  const safePolicy=scorePolicySchema.safeParse(config?.scorePolicy);
  const base={evaluationVersion:EVALUATION_VERSION,label:'Internal Readiness' as const,scope,environment:config?.environment??'PRODUCTION' as const,allowDemo:input.allowDemo===true,ruleSetId:config?.ruleSetId??null,ruleSetVersion:config?.ruleSetVersion??null,ruleSetChecksum:config?.checksum??null,sourceRuleSetChecksum:config?.sourceRuleSetChecksum??null,evidenceSelectionChecksum:config?.selectionChecksum??null,scorePolicy:safePolicy.success?safePolicy.data:null,confidencePolicyVersion:CONFIDENCE_VERSION};
  const empty=(status:ReadinessEvaluation['status'],reasonCode:string)=>seal({...base,status,reasonCode,score:null,lowerBound:null,upperBound:null,coverage:null,W:0,K:0,P:0,confidence:'INSUFFICIENT',counts:{pass:0,warn:0,fail:0,unknown:0,notApplicable:0},items:[]});
  if(!config)return empty('NOT_CONFIGURED','NO_APPROVED_RULESET');
  if(!catalog||!knowledge)return empty('INVALID','REGISTRY_DEPENDENCIES_REQUIRED');
  try{
    const {checksum,sourceRuleSetChecksum,selectionChecksum,contractVersion,...raw}=config;void contractVersion;
    const sealed=createReadinessRuleSet(raw,catalog);
    if(sealed.checksum!==checksum||sealed.sourceRuleSetChecksum!==sourceRuleSetChecksum||sealed.selectionChecksum!==selectionChecksum)return empty('INVALID','RULESET_CHECKSUM_MISMATCH');
  }catch{return empty('INVALID','INVALID_APPROVED_RULESET');}
  if(config.scope.projectId!==null&&config.scope.projectId!==scope.projectId||config.scope.platformCode!==scope.platformCode||config.scope.channelCode!==scope.channelCode||(['country','language','industry','region','surface'] as const).some(key=>config.scope[key]!==null&&config.scope[key]!==scope[key]))return empty('INVALID','RULESET_SCOPE_MISMATCH');
  if(input.allowDemo&&config.environment!=='SYNTHETIC')return empty('INVALID','DEMO_OVERRIDE_REQUIRES_SYNTHETIC_RULESET');
  const source=catalog.getRuleSetVersion(config.ruleSetId,config.ruleSetVersion)!;
  if(Date.parse(config.reviewedAt)>Date.parse(scope.evidenceAsOf)||Date.parse(source.audit.createdAt)>Date.parse(scope.evidenceAsOf)||Date.parse(source.effectiveAt)>Date.parse(scope.evidenceAsOf)||!source.reviewedAt||Date.parse(source.reviewedAt)>Date.parse(scope.evidenceAsOf))return empty('INVALID','RULESET_NOT_EFFECTIVE_AS_OF');
  if(source.retiredAt&&Date.parse(source.retiredAt)<=Date.parse(scope.evidenceAsOf))return empty('STALE','RULESET_RETIRED');
  let invalid=false;
  const items:ReadinessItem[]=source.ruleRefs.map(ref=>{
    const rule=catalog.getRuleVersion(ref.ruleId,ref.version)!,policy=config.checks.find(c=>c.ruleId===ref.ruleId&&c.ruleVersion===ref.version)!;
    const common={ruleId:rule.ruleId,ruleVersion:rule.version,ruleChecksum:rule.checksum,checkType:rule.checkType,weight:policy.weight,evaluatedAt:scope.evidenceAsOf,evidenceRefs:[],knowledgeRefs:[],verifiedEvidence:false,contextComplete:false,stale:false,actionCandidateRefs:[]};
    const decision=scopeDecision(rule,scope);if(decision)return {...common,...decision};
    if(!rule.reviewedAt||Date.parse(rule.audit.createdAt)>Date.parse(scope.evidenceAsOf)||Date.parse(rule.reviewedAt)>Date.parse(scope.evidenceAsOf)||Date.parse(rule.effectiveAt)>Date.parse(scope.evidenceAsOf)){invalid=true;return {...common,status:'UNKNOWN',reasonCode:'RULE_NOT_EFFECTIVE_AS_OF'};}
    if(rule.retiredAt&&Date.parse(rule.retiredAt)<=Date.parse(scope.evidenceAsOf))return {...common,status:'UNKNOWN',reasonCode:'RULE_RETIRED',stale:true};
    const gate=knowledgeGate(rule,knowledge,scope);invalid=invalid||gate.invalid;
    if(gate.invalid||gate.stale)return {...common,status:'UNKNOWN',reasonCode:gate.reasonCode,knowledgeRefs:gate.refs,stale:gate.stale};
    const evidence=resolveReadinessEvidence(project,scope,rule,policy,input.contexts??[],input.allowDemo===true);
    return {...common,...evidence,knowledgeRefs:gate.refs,actionCandidateRefs:evidence.status==='FAIL'?rule.actionRefs:[]};
  });
  const counts={pass:0,warn:0,fail:0,unknown:0,notApplicable:0};
  let W=0,K=0,P=0,verifiedWeight=0,complete=true;
  for(const item of items){
    const key={PASS:'pass',WARN:'warn',FAIL:'fail',UNKNOWN:'unknown',NOT_APPLICABLE:'notApplicable'}[item.status] as keyof typeof counts;counts[key]++;
    if(item.status==='NOT_APPLICABLE')continue;W+=item.weight;
    if(item.status==='UNKNOWN')continue;K+=item.weight;P+=item.weight*config.scorePolicy.credits[item.status];
    if(item.verifiedEvidence)verifiedWeight+=item.weight;if(!item.contextComplete)complete=false;
  }
  const stale=items.some(item=>item.stale),coverage=W?K/W:null;
  const status=invalid?'INVALID':stale?'STALE':W>0&&K===W?'READY':'PARTIAL';
  const usable=!invalid&&!stale&&W>0,lowerBound=usable?100*P/W:null,upperBound=usable?100*(P+W-K)/W:null;
  const confidence:ReadinessEvaluation['confidence']=!usable||K===0||(coverage??0)<0.25?'INSUFFICIENT':coverage===1&&verifiedWeight===K&&complete?'HIGH':(coverage??0)>=0.75&&complete?'MEDIUM':'LOW';
  return seal({...base,status,reasonCode:invalid?'INVALID_KNOWLEDGE_BASIS':stale?'STALE_KNOWLEDGE_OR_EVIDENCE':W===0?'NO_APPLICABLE_RULES':K===W?'ALL_APPLICABLE_CHECKS_KNOWN':'EVIDENCE_INCOMPLETE',score:usable&&K===W?lowerBound:null,lowerBound,upperBound,coverage,W,K,P,confidence,counts,items});
}
export function evaluateProductionReadiness(project:ProjectData,evidenceAsOf:string):readonly ReadinessEvaluation[] {
  return Object.freeze(getPlatforms().map(platform=>evaluatePlatformReadiness({project,scope:{projectId:project.id,platformCode:platform.code,channelCode:null,country:null,language:null,industry:null,region:null,surface:null,evidenceAsOf}})));
}
