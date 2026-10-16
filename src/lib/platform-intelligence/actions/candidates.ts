import {assertProjectAccess} from '../../auth';
import type {Staff} from '../../auth';
import type {ProjectData} from '../../types';
import type {PlatformRuleRegistry} from '../rules/registry';
import type {ReadinessEvaluation} from '../readiness/contracts';
import {assertReadinessEvaluation} from '../readiness/repository';
import {canonicalChecksum,immutable,timestamp} from '../knowledge/contracts';
import type {ActionDefinitionRepository} from './definitions';

export type ActionCandidateInput={project:ProjectData;evaluation:ReadinessEvaluation;definitions:ActionDefinitionRepository;rules:PlatformRuleRegistry;actor:Staff;asOf:string;maxEvaluationAgeSeconds:number;allowSynthetic?:boolean};
export function assertActionAccess(actor:Staff,projectId:string,write=false){
  if(actor.disabled||!(write?['OWNER','MANAGER']:['OWNER','MANAGER','ANALYST']).includes(actor.role))throw Error('Action role denied');
  assertProjectAccess(actor,projectId);
}
export function recommendActionCandidates(input:ActionCandidateInput){
  const {project,definitions,rules,actor,asOf}=input,evaluation=assertReadinessEvaluation(input.evaluation);
  assertActionAccess(actor,project.id);timestamp.parse(asOf);
  if(evaluation.scope.projectId!==project.id)throw Error('Action evaluation project mismatch');
  if(!Number.isSafeInteger(input.maxEvaluationAgeSeconds)||input.maxEvaluationAgeSeconds<1)throw Error('Explicit evaluation freshness required');
  const age=(Date.parse(asOf)-Date.parse(evaluation.scope.evidenceAsOf))/1000;
  const usable=age>=0&&age<=input.maxEvaluationAgeSeconds&&!['INVALID','STALE','NOT_CONFIGURED'].includes(evaluation.status)&&(evaluation.environment==='PRODUCTION'||input.allowSynthetic===true);
  const scope=evaluation.scope;
  const findings=evaluation.items.map(item=>{
    const rule=rules.getRuleVersion(item.ruleId,item.ruleVersion);
    const candidates=usable&&rule?.checksum===item.ruleChecksum&&['FAIL','WARN','UNKNOWN'].includes(item.status)?definitions.list().filter(action=>{
      if(action.environment!==evaluation.environment||!definitions.isOperational(action.actionId,action.version,asOf))return false;
      if(!action.applicableFindingStatuses.includes(item.status as 'FAIL'|'WARN'|'UNKNOWN')||!action.applicableCheckTypes.includes(item.checkType as typeof action.applicableCheckTypes[number]))return false;
      if(action.platformScopes.length&&!action.platformScopes.includes(scope.platformCode))return false;
      if(action.channelScopes.length&&(!scope.channelCode||!action.channelScopes.includes(scope.channelCode)))return false;
      if(action.industryScopes.length&&(!scope.industry||!action.industryScopes.includes(scope.industry)))return false;
      if(action.ruleRefs.length&&!action.ruleRefs.some(ref=>ref.id===item.ruleId&&ref.version===item.ruleVersion&&ref.checksum===item.ruleChecksum))return false;
      return item.status!=='UNKNOWN'||(['EVIDENCE','MEASUREMENT','COMPLIANCE'].includes(action.category)&&action.executionMode!=='EXISTING_WORK_DRAFT');
    }).map(action=>({actionId:action.actionId,actionVersion:action.version,actionChecksum:action.checksum,effectClaimStatus:action.effectClaimStatus,
      priority:item.status==='FAIL'&&rule.severity==='HIGH'?(['ROBOTS_ACCESS','NOINDEX'].includes(item.checkType)?'BLOCKER' as const:'HIGH' as const):rule.severity==='LOW'?'LOW' as const:'NORMAL' as const,
      reasonCode:item.status==='UNKNOWN'?'VERIFY_MISSING_EVIDENCE':'REVIEW_READINESS_FINDING',scope})) : [];
    const order={BLOCKER:0,HIGH:1,NORMAL:2,LOW:3};candidates.sort((a,b)=>order[a.priority]-order[b.priority]||a.actionId.localeCompare(b.actionId)||a.actionVersion-b.actionVersion);
    return {ruleId:item.ruleId,ruleVersion:item.ruleVersion,ruleChecksum:item.ruleChecksum,status:item.status,candidates};
  });
  const content={policyVersion:'action-candidate-policy-v1' as const,projectId:project.id,evaluationId:evaluation.evaluationId,evaluationChecksum:evaluation.checksum,asOf,findings};
  return immutable({...content,checksum:canonicalChecksum(content)});
}
export type ActionSelection={ruleId:string;ruleVersion:number;actionId:string;actionVersion:number;actionChecksum:string};
export function prepareActionWorkRequest(input:ActionCandidateInput,selection:ActionSelection){
  const result=recommendActionCandidates(input),finding=result.findings.find(f=>f.ruleId===selection.ruleId&&f.ruleVersion===selection.ruleVersion);
  const candidate=finding?.candidates.find(c=>c.actionId===selection.actionId&&c.actionVersion===selection.actionVersion&&c.actionChecksum===selection.actionChecksum);
  if(!candidate)throw Error('Current eligible human-selected Action candidate required');
  const content={kind:'EXISTING_WORK_DRAFT_REVIEW' as const,projectId:result.projectId,evaluationId:result.evaluationId,evaluationChecksum:result.evaluationChecksum,selection,candidateChecksum:result.checksum,preparedAt:input.asOf,preparedBy:input.actor.id,
    requiredGates:['EXISTING_PROJECT_ACCESS','EXISTING_APPROVAL','EXISTING_COMPLIANCE','EXPLICIT_APPLICATION_PROOF'],createsTask:false as const};
  return immutable({...content,checksum:canonicalChecksum(content)});
}
