import type {PlatformChannel} from './types';

const definitions:readonly [PlatformChannel['code'],PlatformChannel['platformCode'],string,PlatformChannel['mode'],PlatformChannel['status'],boolean,boolean][] = [
  ['CHATGPT_WEB_SEARCH','CHATGPT','ChatGPT 웹 검색','CONSUMER','ACTIVE',true,false],
  ['GOOGLE_AI_SEARCH','GOOGLE_AI','Google AI Search','CONSUMER','PLANNED',false,false],
  ['GEMINI_CONSUMER_SEARCH','GEMINI','Gemini 소비자용 검색','CONSUMER','ACTIVE',true,false],
  ['GEMINI_API_GROUNDING','GEMINI','Gemini API Grounding','API','LIMITED',false,true],
  ['NAVER_AI_BRIEFING','NAVER_AI','네이버 AI 브리핑','CONSUMER','ACTIVE',true,false],
  ['CLAUDE_WEB_SEARCH','CLAUDE','Claude 웹 검색','CONSUMER','PLANNED',false,false],
  ['PERPLEXITY_SEARCH','PERPLEXITY','Perplexity 검색','CONSUMER','PLANNED',false,false],
];
const channels:readonly PlatformChannel[] = Object.freeze(definitions.map(([code,platformCode,displayName,mode,status,manualSupported,apiAdapterImplemented])=>Object.freeze({
  code,platformCode,displayName,mode,status,manualSupported,apiAdapterImplemented,apiEnabled:false,verifiedAt:null,
  notes:manualSupported?'기존 consumer-config 및 수동 관측 경로 기준. 외부 제품 동작을 검증한 시각은 없음.':apiAdapterImplemented?'기존 FreeGeminiAdapter 존재. 계정 무료 등급 검증 미연결로 fail-closed. 실행 권한은 이 catalog가 부여하지 않음.':'식별용 예약 채널. 구조화된 관측 UI 및 API adapter 미구현.',
})));
export const getChannels = ():readonly PlatformChannel[] => channels;
export const getChannel = (code:string):PlatformChannel|undefined => channels.find(value=>value.code===code);
export const getPlatformChannels = (platformCode:string):readonly PlatformChannel[] => Object.freeze(channels.filter(value=>value.platformCode===platformCode));
