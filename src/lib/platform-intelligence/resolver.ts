import {resolveLegacyAlias} from './aliases';
import {getChannel} from './channels';
import {getProvider,getProviders} from './providers';
import type {CanonicalPlatformContext,IdentityInput,ResolutionSource} from './types';

/** Pure read-model projection. Unknown supplied fields and contradictions fail closed. */
export function resolvePlatformIdentity(input:IdentityInput):CanonicalPlatformContext {
  const base=resolveLegacyAlias(null);
  const candidates:CanonicalPlatformContext[]=[];
  const issues:string[]=[];
  for(const [field,source] of [['consumerScreen','CONSUMER_SCREEN'],['channel','CHANNEL'],['platformName','PLATFORM_NAME'],['provider','LEGACY_PROVIDER']] as const){
    const value=input[field];if(value==null)continue;
    let resolved=resolveLegacyAlias(value);
    // In the provider field, explicit vendor codes/names take precedence over product aliases.
    if(field==='provider'){
      const provider=getProvider(value)??getProviders().find(item=>item.displayName===value);
      if(provider)resolved={...base,providerCode:provider.code,resolutionConfidence:'EXACT'};
    }
    if(resolved.resolutionConfidence==='UNRESOLVED' || ((field==='channel'||field==='consumerScreen')&&!resolved.channelCode) || (field==='platformName'&&!resolved.platformCode)){
      issues.push(`UNKNOWN_${field}`);continue;
    }
    if(field==='consumerScreen'&&getChannel(resolved.channelCode!)?.mode!=='CONSUMER'){issues.push('INVALID_CONSUMER_SCREEN');continue;}
    candidates.push({...resolved,resolutionSource:source});
  }
  for(const key of ['platformCode','channelCode','providerCode'] as const){
    if(new Set(candidates.map(item=>item[key]).filter(value=>value!==null)).size>1)issues.push(`CONFLICT_${key}`);
  }
  const method=input.method??null;
  if(method!==null&&!['DEMO','MANUAL_UI','MANUAL_OBSERVATION','CONSUMER_UI_MANUAL','API','API_OBSERVATION'].includes(method))issues.push('UNKNOWN_METHOD');
  const channelCode=candidates.find(item=>item.channelCode)?.channelCode??null;
  const channel=channelCode?getChannel(channelCode):undefined;
  if(channel && ((channel.mode==='CONSUMER'&&(method==='API'||method==='API_OBSERVATION')) || (channel.mode==='API'&&(method==='CONSUMER_UI_MANUAL'||method==='MANUAL_UI'))))issues.push('CONFLICT_METHOD_CHANNEL');
  if(issues.length)return Object.freeze({...base,observationMethod:method,resolutionSource:issues.some(item=>item.startsWith('CONFLICT')||item==='INVALID_CONSUMER_SCREEN')?'CONFLICT':'NONE',issues:Object.freeze(issues)});
  const strongest=candidates.find(item=>item.channelCode)??candidates.find(item=>item.platformCode)??candidates[0];
  return Object.freeze({...base,platformCode:candidates.find(item=>item.platformCode)?.platformCode??null,channelCode,providerCode:candidates.find(item=>item.providerCode)?.providerCode??null,observationMethod:method,resolutionConfidence:strongest?.resolutionConfidence??'UNRESOLVED',resolutionSource:strongest?.resolutionSource??'NONE' as ResolutionSource});
}
