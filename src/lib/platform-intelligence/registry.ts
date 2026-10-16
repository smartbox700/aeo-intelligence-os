import type {Platform,PlatformCode} from './types';

export const PLATFORM_REGISTRY_VERSION = 'platform-registry-v1' as const;
const definitions:readonly [PlatformCode,string,string,Platform['providerCode'],Platform['status']][] = [
  ['CHATGPT','ChatGPT','OpenAI','OPENAI','ACTIVE'],
  ['GOOGLE_AI','Google AI Search','Google','GOOGLE','PLANNED'],
  ['GEMINI','Gemini','Google','GOOGLE','ACTIVE'],
  ['NAVER_AI','Naver AI','Naver','NAVER','ACTIVE'],
  ['CLAUDE','Claude','Anthropic','ANTHROPIC','PLANNED'],
  ['PERPLEXITY','Perplexity','Perplexity','PERPLEXITY','PLANNED'],
];
const platforms:readonly Platform[] = Object.freeze(definitions.map(([code,displayName,vendor,providerCode,status])=>Object.freeze({
  code,displayName,vendor,providerCode,status,registryVersion:PLATFORM_REGISTRY_VERSION,
  description:`${displayName} 제품 식별자. 상태는 로컬 관측 기능 기준이며 공식 알고리즘·지원 보장을 의미하지 않습니다.`,
})));
export const getPlatforms = ():readonly Platform[] => platforms;
export const getPlatform = (code:string):Platform|undefined => platforms.find(value=>value.code===code);
