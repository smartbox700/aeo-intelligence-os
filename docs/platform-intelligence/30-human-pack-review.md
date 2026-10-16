# 8-12 사람 OWNER Pack 검토 자료

승인 대기 자료이며 실제 운영 승인이 아닙니다. `humanApprovalRecorded=false`. 8-10 test OWNER 기록은 검증 fixture입니다.

공식 FACT 23개, Rule 6개, RuleSet 4개, 정책 4개를 검토합니다. 검증일 2026-10-16, 검토기한 2026-11-15 11:34 UTC, 만료 2027-01-14 11:34 UTC. 배포 시점에 재확인하며 기한 경과 시 공식 출처를 다시 검증합니다. 외부 문서를 이번 단계에서 자동 재조회하거나 갱신하지 않았습니다.

## CHATGPT · CHATGPT_OAI_SEARCHBOT_PURPOSE

OAI-SearchBot은 ChatGPT 검색에서 웹사이트를 발견하고 연결하기 위한 검색 크롤러다.

출처: [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: CHATGPT_SEARCHBOT_ACCESS

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## CHATGPT · CHATGPT_CRAWLER_ROLE_SEPARATION

OAI-SearchBot과 GPTBot의 robots 설정은 독립적으로 관리할 수 있다.

출처: [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## CHATGPT · CHATGPT_GPTBOT_TRAINING_PURPOSE

GPTBot은 모델 학습용 크롤러다.

출처: [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## CHATGPT · CHATGPT_USER_REQUEST_PURPOSE

ChatGPT-User는 사용자 요청에 따른 페이지 접근에 사용된다.

출처: [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## CHATGPT · CHATGPT_SEARCH_ELIGIBILITY_NOT_GUARANTEED

검색 자격 조건을 충족해도 ChatGPT 검색 결과 배치는 보장되지 않는다.

출처: [Searching the web with ChatGPT](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GOOGLE_AI · GOOGLE_AI_SUPPORTING_LINK_ELIGIBILITY

AI Overviews와 AI Mode의 supporting link 자격에는 Google Search 색인과 snippet 표시 자격이 필요하다.

출처: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: GOOGLE_AI_NOINDEX

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GOOGLE_AI · GOOGLE_AI_QUERY_FANOUT

AI Overviews와 AI Mode는 하위주제와 데이터 소스에 관련 검색을 수행하는 query fan-out을 사용할 수 있다.

출처: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GOOGLE_AI · GOOGLE_AI_SEARCH_FOUNDATIONS_RELEVANT

Google Search의 AI 기능에서도 기존 SEO 기본 사항은 관련된다.

출처: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GOOGLE_AI · GOOGLE_AI_NO_SPECIAL_SCHEMA_REQUIRED

Google Search의 AI 기능에 등장하기 위한 특별한 AI schema.org markup은 필요하지 않다.

출처: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GOOGLE_AI · GOOGLE_AI_NO_AI_TEXT_FILES_REQUIRED

Google Search의 AI 기능을 위한 별도의 AI 텍스트 파일은 필요하지 않다.

출처: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GOOGLE_AI · GOOGLE_AI_IMPORTANT_CONTENT_TEXTUAL

Google은 중요한 콘텐츠를 텍스트 형태로 제공하도록 안내한다.

출처: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: GOOGLE_AI_PAGE_TEXT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GOOGLE_AI · GOOGLE_AI_CRAWL_CONTROL

Google Search AI 기능을 위한 크롤링 접근은 robots의 Googlebot 지시로 관리한다.

출처: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: GOOGLE_AI_CRAWL_ACCESS

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GOOGLE_AI · GOOGLE_AI_NOINDEX_CONTROL

noindex는 Google Search 색인을 방지하는 지시어다.

출처: [Block Search indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: GOOGLE_AI_NOINDEX

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GEMINI · GEMINI_APPS_SOURCES_MAY_APPEAR

Gemini Apps는 응답 내부 또는 아래에 관련 출처 링크를 제공할 수 있다.

출처: [View related sources from Gemini Apps - Computer - Gemini Apps Help](https://support.google.com/gemini/answer/14143489?hl=en)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## GEMINI · GEMINI_APPS_NOT_ALL_RESPONSES_HAVE_SOURCES

Gemini Apps의 모든 응답에 관련 링크나 출처가 포함되는 것은 아니다.

출처: [View related sources from Gemini Apps - Computer - Gemini Apps Help](https://support.google.com/gemini/answer/14143489?hl=en)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## NAVER_AI · NAVER_AI_BRIEFING_PURPOSE

AI 브리핑은 검색 의도와 맥락을 반영한 요약 답변과 출처 정보, 관련 질문을 제공하는 생성형 AI 기능이다.

출처: [AI 브리핑 소개 : 네이버 검색 고객센터](https://help.naver.com/service/5626/contents/24119)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## NAVER_AI · NAVER_AI_BRIEFING_WEB_DOCUMENT_SOURCE

공식형 및 멀티출처형 AI 브리핑은 네이버 검색엔진이 수집한 웹문서를 분석해 답변과 출처를 제공한다.

출처: [공식형/멀티출처형 AI 브리핑 : 네이버 검색 고객센터](https://help.naver.com/service/5626/contents/24120)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## CLAUDE · CLAUDE_BOT_ROLE_SEPARATION

Anthropic은 ClaudeBot, Claude-User, Claude-SearchBot을 서로 다른 목적으로 운영한다.

출처: [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## CLAUDE · CLAUDE_SEARCHBOT_PURPOSE

Claude-SearchBot은 검색 결과의 품질을 개선하기 위해 웹 콘텐츠를 탐색하고 분석한다.

출처: [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: CLAUDE_SEARCHBOT_ACCESS

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## CLAUDE · CLAUDE_USER_PURPOSE

Claude-User는 사용자의 질문에 따른 웹사이트 콘텐츠 접근에 사용된다.

출처: [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## CLAUDE · CLAUDE_WEB_SEARCH_CITATIONS

Claude는 웹검색 정보를 사용한 응답에서 출처 인용을 제공한다.

출처: [Enable and use web search](https://support.claude.com/en/articles/10684626-enable-and-use-web-search)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## PERPLEXITY · PERPLEXITY_SEARCHBOT_PURPOSE

PerplexityBot은 Perplexity 검색 결과에 웹사이트를 발견하고 연결하기 위한 크롤러다.

출처: [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: PERPLEXITY_SEARCHBOT_ACCESS

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## PERPLEXITY · PERPLEXITY_USER_PURPOSE

Perplexity-User는 사용자 요청에 따른 페이지 접근에 사용된다.

출처: [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

FACT 근거: 해당 공식 문서에 한정한 제품·봇·출처 동작 설명. 원문은 사람이 직접 대조해야 한다. excerptHash는 내부 요약의 무결성 값이며 공식 문서 본문 인증이 아니다.

사용 Rule: 없음 — 설명용 FACT

의미하지 않는 것: 접근 허용·색인 자격은 실제 크롤링·노출·인용·추천·순위 또는 개선 효과를 보장하지 않는다. 다른 플랫폼·채널로 일반화하지 않는다.

## Rule / RuleSet / 정책

- CHATGPT_SEARCHBOT_ACCESS: ROBOTS_ACCESS; CHATGPT_OAI_SEARCHBOT_PURPOSE; agent=OAI-SearchBot
- GOOGLE_AI_CRAWL_ACCESS: ROBOTS_ACCESS; GOOGLE_AI_CRAWL_CONTROL; agent=Googlebot
- GOOGLE_AI_NOINDEX: NOINDEX; GOOGLE_AI_NOINDEX_CONTROL, GOOGLE_AI_SUPPORTING_LINK_ELIGIBILITY
- GOOGLE_AI_PAGE_TEXT: PAGE_TEXT_PRESENT; GOOGLE_AI_IMPORTANT_CONTENT_TEXTUAL
- CLAUDE_SEARCHBOT_ACCESS: ROBOTS_ACCESS; CLAUDE_SEARCHBOT_PURPOSE; agent=Claude-SearchBot
- PERPLEXITY_SEARCHBOT_ACCESS: ROBOTS_ACCESS; PERPLEXITY_SEARCHBOT_PURPOSE; agent=PerplexityBot

- CHATGPT_GENERAL_V1 v2: CHATGPT_SEARCHBOT_ACCESS; 정책은 weight=1, maxAge=86400, source=null, NOINDEX는 HTML_AND_HEADER.
- GOOGLE_AI_GENERAL_V1 v2: GOOGLE_AI_CRAWL_ACCESS, GOOGLE_AI_NOINDEX, GOOGLE_AI_PAGE_TEXT; 정책은 weight=1, maxAge=86400, source=null, NOINDEX는 HTML_AND_HEADER.
- CLAUDE_GENERAL_V1 v2: CLAUDE_SEARCHBOT_ACCESS; 정책은 weight=1, maxAge=86400, source=null, NOINDEX는 HTML_AND_HEADER.
- PERPLEXITY_GENERAL_V1 v2: PERPLEXITY_SEARCHBOT_ACCESS; 정책은 weight=1, maxAge=86400, source=null, NOINDEX는 HTML_AND_HEADER.

정책은 내부 증거 점검이며 공식 추천·순위 가중치가 아닙니다. 증거 미선택 시 점수 null입니다.

## 봇·채널 구분

- CHATGPT: OAI-SearchBot 검색 / GPTBot 학습 / ChatGPT-User 사용자 요청
- GOOGLE_AI: Search 색인·snippet 자격과 실제 AI 노출 보장은 다르다.
- GEMINI: 출처 제공에 관한 FACT만 확인. 사이트 Readiness 검사에 연결할 공식 근거가 없어 FACT_ONLY.
- NAVER_AI: 브리핑 설명·웹문서 출처 FACT만 확인. Yeti·리뷰 수를 추천 점검 규칙으로 만들 근거가 없어 FACT_ONLY.
- CLAUDE: Claude-SearchBot 검색 / ClaudeBot 학습 / Claude-User 사용자 요청
- PERPLEXITY: PerplexityBot 검색 / Perplexity-User 사용자 요청

## 승인하지 않은 주장

- GOOGLE_AI_CORE_SEARCH_FOUNDATION: core ranking/quality systems와 Search index 전체 의존 관계: 확인한 문서의 SEO 및 색인 자격 안내보다 넓은 주장이므로 등록하지 않는다.
- GOOGLE_AI_LLMS_TXT_NOT_REQUIRED: llms.txt를 visibility/ranking 신호로 사용하지 않는다: 별도 AI 텍스트 파일 불필요만 등록한다. 확인한 본문에는 llms.txt 명칭이나 ranking 신호 미사용을 직접 명시하지 않는다.
- FAQ가 citation을 증가시킨다: 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- Schema가 AI 추천을 증가시킨다: 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- 백링크 수가 특정 AI 추천을 증가시킨다: 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- 리뷰 숫자가 모든 네이버 AI 추천을 증가시킨다: 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- llms.txt가 Google AI visibility를 증가시킨다: 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- Yeti 허용이 AI 브리핑 추천을 증가시킨다: 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.

FAQ/schema/백링크/리뷰/llms.txt/Yeti의 효과는 향후 별도 실험 대상으로 남깁니다.

## 사람 승인 기록

보호 증거의 human-review-decision-template.json을 사람이 채웁니다. PENDING/null 상태는 유효한 승인이 아닙니다. 현재 자동 실행 명령 또는 공개 승인 endpoint는 없습니다. 별도 감사 이벤트와 deployment approval record가 기록되기 전 운영 활성화 금지.

## 배포 직전 URL 확인

- [ ] [공식 출처](https://developers.openai.com/api/docs/bots) 본문·접근성·주장 일치 재확인
- [ ] [공식 출처](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt) 본문·접근성·주장 일치 재확인
- [ ] [공식 출처](https://developers.google.com/search/docs/appearance/ai-features) 본문·접근성·주장 일치 재확인
- [ ] [공식 출처](https://developers.google.com/search/docs/crawling-indexing/block-indexing) 본문·접근성·주장 일치 재확인
- [ ] [공식 출처](https://support.google.com/gemini/answer/14143489?hl=en) 본문·접근성·주장 일치 재확인
- [ ] [공식 출처](https://help.naver.com/service/5626/contents/24119) 본문·접근성·주장 일치 재확인
- [ ] [공식 출처](https://help.naver.com/service/5626/contents/24120) 본문·접근성·주장 일치 재확인
- [ ] [공식 출처](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) 본문·접근성·주장 일치 재확인
- [ ] [공식 출처](https://support.claude.com/en/articles/10684626-enable-and-use-web-search) 본문·접근성·주장 일치 재확인
- [ ] [공식 출처](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) 본문·접근성·주장 일치 재확인
