import {getChannel} from './channels';
import {getPlatform,PLATFORM_REGISTRY_VERSION} from './registry';
import {getProvider,getProviders} from './providers';
import type {CanonicalPlatformContext,PlatformCode} from './types';

const platformAliases:Readonly<Record<string,PlatformCode>> = Object.freeze({
  ChatGPT:'CHATGPT',Gemini:'GEMINI','네이버 AI 검색':'NAVER_AI','네이버 AI 브리핑':'NAVER_AI',
  'Naver AI':'NAVER_AI',Claude:'CLAUDE',Perplexity:'PERPLEXITY','Google AI':'GOOGLE_AI','Google AI Search':'GOOGLE_AI',
});
/** Exact, case-sensitive, versioned vocabulary. Never normalizes the source record. */
export function resolveLegacyAlias(value:unknown):CanonicalPlatformContext {
  const base:CanonicalPlatformContext={platformCode:null,channelCode:null,providerCode:null,observationMethod:null,resolutionConfidence:'UNRESOLVED',resolutionSource:'NONE',registryVersion:PLATFORM_REGISTRY_VERSION,issues:Object.freeze([])};
  if(typeof value!=='string')return Object.freeze(base);
  const channel=getChannel(value==='Gemini API Grounding'?'GEMINI_API_GROUNDING':value);
  if(channel)return Object.freeze({...base,platformCode:channel.platformCode,channelCode:channel.code,providerCode:getPlatform(channel.platformCode)!.providerCode,resolutionConfidence:'EXACT',resolutionSource:'LEGACY_ALIAS'});
  const platform=getPlatform(value)??(Object.hasOwn(platformAliases,value)?getPlatform(platformAliases[value]):undefined);
  if(platform)return Object.freeze({...base,platformCode:platform.code,providerCode:platform.providerCode,resolutionConfidence:value===platform.code?'EXACT':'HIGH',resolutionSource:'LEGACY_ALIAS'});
  const provider=getProvider(value)??getProviders().find(item=>item.displayName===value);
  return Object.freeze(provider?{...base,providerCode:provider.code,resolutionConfidence:'EXACT',resolutionSource:'LEGACY_ALIAS'}:base);
}
