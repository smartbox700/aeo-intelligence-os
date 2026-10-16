import {canonicalChecksum,immutable,knowledgeDraftSchema} from '../knowledge/contracts';
import type {KnowledgeDraft} from '../knowledge/contracts';
import type {PlatformCode,PlatformChannelCode} from '../types';
import type {CheckType} from '../rules/registry';

/** Reviewed source summaries, not downloaded document bodies or a production seed. */
const capturedAt='2026-10-16T11:34:00.000Z';
export const PACK_ID='OFFICIAL_PLATFORM_KNOWLEDGE_PACK';
export const channels={CHATGPT:'CHATGPT_WEB_SEARCH',GOOGLE_AI:'GOOGLE_AI_SEARCH',GEMINI:'GEMINI_CONSUMER_SEARCH',NAVER_AI:'NAVER_AI_BRIEFING',CLAUDE:'CLAUDE_WEB_SEARCH',PERPLEXITY:'PERPLEXITY_SEARCH'} as const;
function source(id:string,vendor:string,platform:PlatformCode,title:string,url:string,summary:string,sourceDate:string|null=null){
 return {id,vendor,platform,title,officialDomain:new URL(url).hostname,canonicalUrl:url,capturedAt,lastVerifiedAt:capturedAt,sourceDate,summary,excerptKind:'INTERNAL_CLAIM_SUMMARY' as const,excerptHash:canonicalChecksum(summary)};
}
export const sources=immutable([
 source('OPENAI_BOTS','OpenAI','CHATGPT','Overview of OpenAI Crawlers','https://developers.openai.com/api/docs/bots','검색용 OAI-SearchBot, 학습용 GPTBot, 사용자 요청용 ChatGPT-User는 구분된다. 검색 봇과 학습 봇의 robots 설정은 독립적이다. 검색 봇 접근에는 robots와 네트워크 허용을 확인한다.'),
 source('OPENAI_SEARCH','OpenAI','CHATGPT','Searching the web with ChatGPT','https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt','검색 대상 조건을 충족해도 ChatGPT 검색 결과의 배치는 보장되지 않는다.'),
 source('GOOGLE_AI_FEATURES','Google','GOOGLE_AI','AI features and your website','https://developers.google.com/search/docs/appearance/ai-features','AI Search 링크 자격은 색인과 snippet 자격을 요구하나 노출을 보장하지 않는다. query fan-out을 사용할 수 있다. 기존 SEO 기본 사항, Googlebot 접근과 텍스트 콘텐츠가 관련된다. 특별한 AI schema나 AI 텍스트 파일은 필요하지 않다.','2025-12-10T00:00:00.000Z'),
 source('GOOGLE_NOINDEX','Google','GOOGLE_AI','Block Search indexing with noindex','https://developers.google.com/search/docs/crawling-indexing/block-indexing','noindex는 Google Search 색인을 방지한다. Googlebot이 지시어를 읽으려면 크롤링을 허용해야 한다.','2025-12-10T00:00:00.000Z'),
 source('GEMINI_SOURCES','Google','GEMINI','View related sources from Gemini Apps - Computer - Gemini Apps Help','https://support.google.com/gemini/answer/14143489?hl=en','Gemini Apps는 응답 안이나 아래에 관련 출처 링크를 제공할 수 있지만 모든 응답에 제공하는 것은 아니다.'),
 source('NAVER_INTRO','Naver','NAVER_AI','AI 브리핑 소개 : 네이버 검색 고객센터','https://help.naver.com/service/5626/contents/24119','AI 브리핑은 생성형 AI로 검색 의도와 맥락을 이해하고 요약 답변, 출처 정보와 관련 질문을 제공한다.'),
 source('NAVER_WEB','Naver','NAVER_AI','공식형/멀티출처형 AI 브리핑 : 네이버 검색 고객센터','https://help.naver.com/service/5626/contents/24120','공식형 및 멀티출처형 AI 브리핑은 네이버 검색엔진이 수집한 웹문서를 분석해 답변과 출처를 제공한다.'),
 source('CLAUDE_BOTS','Anthropic','CLAUDE','Does Anthropic crawl data from the web, and how can site owners block the crawler?','https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler','ClaudeBot, Claude-User, Claude-SearchBot의 목적은 구분된다. 검색 봇은 검색 결과 개선에, 사용자 봇은 질문에 따른 페이지 접근에 사용된다. 봇은 robots 지시를 존중한다.','2026-04-07T00:00:00.000Z'),
 source('CLAUDE_SEARCH','Anthropic','CLAUDE','Enable and use web search','https://support.claude.com/en/articles/10684626-enable-and-use-web-search','Claude는 웹검색 정보를 사용한 응답에서 출처 인용을 제공한다.'),
 source('PERPLEXITY_BOTS','Perplexity','PERPLEXITY','Perplexity Crawlers','https://docs.perplexity.ai/docs/resources/perplexity-crawlers','PerplexityBot은 검색 결과의 사이트 연결을 위한 봇이며 학습용이 아니다. Perplexity-User는 사용자 요청에 따른 접근용이다. 검색 봇의 robots와 네트워크 허용을 안내한다.'),
]);
function fact(knowledgeId:string,platformCode:keyof typeof channels,sourceId:string,claim:string){
 const s=sources.find(s=>s.id===sourceId)!;
 const data:KnowledgeDraft=knowledgeDraftSchema.parse({knowledgeId,version:1,knowledgeType:'FACT',claim,scope:{platformCode,channelCode:channels[platformCode]},provenance:{sourceType:'OFFICIAL_DOCUMENT',sourceReference:`${PACK_ID}:1:${sourceId}`,sourceUrl:s.canonicalUrl,sourceTitle:s.title,...(s.sourceDate?{sourceDate:s.sourceDate}:{}),capturedAt:s.capturedAt,excerptHash:s.excerptHash,evidenceRefs:[]},validity:{validFrom:capturedAt,lastVerifiedAt:s.lastVerifiedAt,reviewDueAt:'2026-11-15T11:34:00.000Z',expiresAt:'2027-01-14T11:34:00.000Z'}});
 return {...data,sourceId,draftChecksum:canonicalChecksum(data)};
}
export const facts=immutable([
 fact('CHATGPT_OAI_SEARCHBOT_PURPOSE','CHATGPT','OPENAI_BOTS','OAI-SearchBot은 ChatGPT 검색에서 웹사이트를 발견하고 연결하기 위한 검색 크롤러다.'),
 fact('CHATGPT_CRAWLER_ROLE_SEPARATION','CHATGPT','OPENAI_BOTS','OAI-SearchBot과 GPTBot의 robots 설정은 독립적으로 관리할 수 있다.'),
 fact('CHATGPT_GPTBOT_TRAINING_PURPOSE','CHATGPT','OPENAI_BOTS','GPTBot은 모델 학습용 크롤러다.'),
 fact('CHATGPT_USER_REQUEST_PURPOSE','CHATGPT','OPENAI_BOTS','ChatGPT-User는 사용자 요청에 따른 페이지 접근에 사용된다.'),
 fact('CHATGPT_SEARCH_ELIGIBILITY_NOT_GUARANTEED','CHATGPT','OPENAI_SEARCH','검색 자격 조건을 충족해도 ChatGPT 검색 결과 배치는 보장되지 않는다.'),
 fact('GOOGLE_AI_SUPPORTING_LINK_ELIGIBILITY','GOOGLE_AI','GOOGLE_AI_FEATURES','AI Overviews와 AI Mode의 supporting link 자격에는 Google Search 색인과 snippet 표시 자격이 필요하다.'),
 fact('GOOGLE_AI_QUERY_FANOUT','GOOGLE_AI','GOOGLE_AI_FEATURES','AI Overviews와 AI Mode는 하위주제와 데이터 소스에 관련 검색을 수행하는 query fan-out을 사용할 수 있다.'),
 fact('GOOGLE_AI_SEARCH_FOUNDATIONS_RELEVANT','GOOGLE_AI','GOOGLE_AI_FEATURES','Google Search의 AI 기능에서도 기존 SEO 기본 사항은 관련된다.'),
 fact('GOOGLE_AI_NO_SPECIAL_SCHEMA_REQUIRED','GOOGLE_AI','GOOGLE_AI_FEATURES','Google Search의 AI 기능에 등장하기 위한 특별한 AI schema.org markup은 필요하지 않다.'),
 fact('GOOGLE_AI_NO_AI_TEXT_FILES_REQUIRED','GOOGLE_AI','GOOGLE_AI_FEATURES','Google Search의 AI 기능을 위한 별도의 AI 텍스트 파일은 필요하지 않다.'),
 fact('GOOGLE_AI_IMPORTANT_CONTENT_TEXTUAL','GOOGLE_AI','GOOGLE_AI_FEATURES','Google은 중요한 콘텐츠를 텍스트 형태로 제공하도록 안내한다.'),
 fact('GOOGLE_AI_CRAWL_CONTROL','GOOGLE_AI','GOOGLE_AI_FEATURES','Google Search AI 기능을 위한 크롤링 접근은 robots의 Googlebot 지시로 관리한다.'),
 fact('GOOGLE_AI_NOINDEX_CONTROL','GOOGLE_AI','GOOGLE_NOINDEX','noindex는 Google Search 색인을 방지하는 지시어다.'),
 fact('GEMINI_APPS_SOURCES_MAY_APPEAR','GEMINI','GEMINI_SOURCES','Gemini Apps는 응답 내부 또는 아래에 관련 출처 링크를 제공할 수 있다.'),
 fact('GEMINI_APPS_NOT_ALL_RESPONSES_HAVE_SOURCES','GEMINI','GEMINI_SOURCES','Gemini Apps의 모든 응답에 관련 링크나 출처가 포함되는 것은 아니다.'),
 fact('NAVER_AI_BRIEFING_PURPOSE','NAVER_AI','NAVER_INTRO','AI 브리핑은 검색 의도와 맥락을 반영한 요약 답변과 출처 정보, 관련 질문을 제공하는 생성형 AI 기능이다.'),
 fact('NAVER_AI_BRIEFING_WEB_DOCUMENT_SOURCE','NAVER_AI','NAVER_WEB','공식형 및 멀티출처형 AI 브리핑은 네이버 검색엔진이 수집한 웹문서를 분석해 답변과 출처를 제공한다.'),
 fact('CLAUDE_BOT_ROLE_SEPARATION','CLAUDE','CLAUDE_BOTS','Anthropic은 ClaudeBot, Claude-User, Claude-SearchBot을 서로 다른 목적으로 운영한다.'),
 fact('CLAUDE_SEARCHBOT_PURPOSE','CLAUDE','CLAUDE_BOTS','Claude-SearchBot은 검색 결과의 품질을 개선하기 위해 웹 콘텐츠를 탐색하고 분석한다.'),
 fact('CLAUDE_USER_PURPOSE','CLAUDE','CLAUDE_BOTS','Claude-User는 사용자의 질문에 따른 웹사이트 콘텐츠 접근에 사용된다.'),
 fact('CLAUDE_WEB_SEARCH_CITATIONS','CLAUDE','CLAUDE_SEARCH','Claude는 웹검색 정보를 사용한 응답에서 출처 인용을 제공한다.'),
 fact('PERPLEXITY_SEARCHBOT_PURPOSE','PERPLEXITY','PERPLEXITY_BOTS','PerplexityBot은 Perplexity 검색 결과에 웹사이트를 발견하고 연결하기 위한 크롤러다.'),
 fact('PERPLEXITY_USER_PURPOSE','PERPLEXITY','PERPLEXITY_BOTS','Perplexity-User는 사용자 요청에 따른 페이지 접근에 사용된다.'),
]);
function rule(ruleId:string,platformCode:keyof typeof channels,checkType:CheckType,knowledgeIds:string[],robotsAgent?:string){return {ruleId,platformCode,channelCode:channels[platformCode] as PlatformChannelCode,checkType,knowledgeIds,...(robotsAgent?{robotsAgent}:{})};}
export const rules=immutable([
 rule('CHATGPT_SEARCHBOT_ACCESS','CHATGPT','ROBOTS_ACCESS',['CHATGPT_OAI_SEARCHBOT_PURPOSE'],'OAI-SearchBot'),
 rule('GOOGLE_AI_CRAWL_ACCESS','GOOGLE_AI','ROBOTS_ACCESS',['GOOGLE_AI_CRAWL_CONTROL'],'Googlebot'),
 rule('GOOGLE_AI_NOINDEX','GOOGLE_AI','NOINDEX',['GOOGLE_AI_NOINDEX_CONTROL','GOOGLE_AI_SUPPORTING_LINK_ELIGIBILITY']),
 rule('GOOGLE_AI_PAGE_TEXT','GOOGLE_AI','PAGE_TEXT_PRESENT',['GOOGLE_AI_IMPORTANT_CONTENT_TEXTUAL']),
 rule('CLAUDE_SEARCHBOT_ACCESS','CLAUDE','ROBOTS_ACCESS',['CLAUDE_SEARCHBOT_PURPOSE'],'Claude-SearchBot'),
 rule('PERPLEXITY_SEARCHBOT_ACCESS','PERPLEXITY','ROBOTS_ACCESS',['PERPLEXITY_SEARCHBOT_PURPOSE'],'PerplexityBot'),
]);
export const unsupported=immutable([
 {claim:'GOOGLE_AI_CORE_SEARCH_FOUNDATION: core ranking/quality systems와 Search index 전체 의존 관계',status:'SOURCE_EVIDENCE_INSUFFICIENT',reason:'확인한 문서의 SEO 및 색인 자격 안내보다 넓은 주장이므로 등록하지 않는다.'},
 {claim:'GOOGLE_AI_LLMS_TXT_NOT_REQUIRED: llms.txt를 visibility/ranking 신호로 사용하지 않는다',status:'UNSUPPORTED_AS_OFFICIAL_FACT',reason:'별도 AI 텍스트 파일 불필요만 등록한다. 확인한 본문에는 llms.txt 명칭이나 ranking 신호 미사용을 직접 명시하지 않는다.'},
 ...['FAQ가 citation을 증가시킨다','Schema가 AI 추천을 증가시킨다','백링크 수가 특정 AI 추천을 증가시킨다','리뷰 숫자가 모든 네이버 AI 추천을 증가시킨다','llms.txt가 Google AI visibility를 증가시킨다','Yeti 허용이 AI 브리핑 추천을 증가시킨다'].map(claim=>({claim,status:'UNSUPPORTED_AS_OFFICIAL_FACT',reason:'이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.'})),
]);
const content={packId:PACK_ID,version:1,packDate:'2026-10-16',freshnessPolicy:{reviewAfterDays:30,expireAfterDays:90,meaning:'INTERNAL_OPERATIONAL_POLICY'},sources,facts,rules,unsupported,actions:[],weightPolicy:'INTERNAL_EQUAL_WEIGHT_1',approvalPolicy:'EXPLICIT_OWNER_REVIEW_COMMAND_REQUIRED'};
export const officialPack=immutable({...content,manifestChecksum:canonicalChecksum(content)});
export type OfficialPack=typeof officialPack;
export function knowledgeDraft(f:typeof facts[number]):KnowledgeDraft {const {sourceId,draftChecksum,...data}=f;void sourceId;void draftChecksum;return knowledgeDraftSchema.parse(data);}
