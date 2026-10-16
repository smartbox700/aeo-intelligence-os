import {immutable} from '../knowledge/contracts';
import {assertObservationContext,CONDITION_FIELDS} from './context';
import type {CanonicalObservationContext} from './context';

export const OBSERVATION_COMPARISON_VERSION='observation-comparison-v1' as const;
export type ObservationComparison=Readonly<{policyVersion:typeof OBSERVATION_COMPARISON_VERSION;status:'COMPARABLE'|'COMPARABLE_WITH_WARNINGS'|'NOT_COMPARABLE';reasons:readonly string[];warnings:readonly string[]}>;
export function compareObservationContexts(a:CanonicalObservationContext,b:CanonicalObservationContext):ObservationComparison {
  a=assertObservationContext(a);b=assertObservationContext(b);
  const reasons:string[]=[],warnings:string[]=[];
  if(a.projectId!==b.projectId)reasons.push('DIFFERENT_PROJECT');
  if(a.status==='CONFLICT'||b.status==='CONFLICT')reasons.push('CONFLICT_CONTEXT');
  if(a.status==='UNRESOLVED'||b.status==='UNRESOLVED')reasons.push('UNRESOLVED_IDENTITY');
  for(const field of CONDITION_FIELDS){
    const left=a[field],right=b[field],unknown=(v:unknown)=>v===null||v==='UNKNOWN';
    if(unknown(left)||unknown(right)){
      if(['platformCode','channelCode','observationMethod','queryTextHash'].includes(field))reasons.push('UNKNOWN_'+field);
      else warnings.push('UNKNOWN_'+field);
    }else if(left!==right)reasons.push('DIFFERENT_'+field);
  }
  if(a.sourceDomain!==b.sourceDomain)warnings.push('DIFFERENT_SOURCE_DOMAIN');
  if(a.responseId===b.responseId)warnings.push('SAME_RESPONSE_NOT_INDEPENDENT_RUN');
  if(a.runNumber===null||b.runNumber===null)warnings.push('UNKNOWN_RUN_NUMBER');
  return immutable({policyVersion:OBSERVATION_COMPARISON_VERSION,status:reasons.length?'NOT_COMPARABLE':warnings.length?'COMPARABLE_WITH_WARNINGS':'COMPARABLE',reasons,warnings});
}
