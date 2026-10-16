# Platform Intelligence 8-10 — Official Platform Knowledge Pack v1

기준일 2026-10-16. 판정: **READY_WITH_WARNINGS**.

공식 자료를 확인한 FACT 23개와 제한된 내부 점검 Rule 6개, RuleSet 4개를 작성하고, 격리 migrated PostgreSQL의 PRODUCTION namespace에서 실제 OWNER 역할 fixture의 명시적 검토 명령으로 등록·검증했다. 실제 사람의 운영 승인이나 원본 배포를 뜻하지 않는다. 원본 DB·UI와 API flags는 그대로다.

## A. Official Sources

공식 문서만 직접 열어 확인했다. 일반 AEO 업체/커뮤니티 자료나 모델 추정을 FACT 출처로 사용하지 않았다. 출처 전체 본문을 보관하지 않고 내부 검토 요약과 그 해시를 보존한다. excerptHash는 내부 요약의 canonical JSON SHA256이며 외부 사이트가 보증한 본문 해시는 아니다. sourceDate는 명시된 업데이트 날짜만 사용하며 날짜가 없거나 상대 날짜만 표시되면 null이다.

| Source ID | Vendor / Platform | Official title / canonical HTTPS URL | Domain | Source date |
| --- | --- | --- | --- | --- |
| OPENAI_BOTS | OpenAI / CHATGPT | [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) | developers.openai.com | 미표시 |
| OPENAI_SEARCH | OpenAI / CHATGPT | [Searching the web with ChatGPT](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt) | help.openai.com | 미표시 |
| GOOGLE_AI_FEATURES | Google / GOOGLE_AI | [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) | developers.google.com | 2025-12-10 |
| GOOGLE_NOINDEX | Google / GOOGLE_AI | [Block Search indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing) | developers.google.com | 2025-12-10 |
| GEMINI_SOURCES | Google / GEMINI | [View related sources from Gemini Apps - Computer - Gemini Apps Help](https://support.google.com/gemini/answer/14143489?hl=en) | support.google.com | 미표시 |
| NAVER_INTRO | Naver / NAVER_AI | [AI 브리핑 소개 : 네이버 검색 고객센터](https://help.naver.com/service/5626/contents/24119) | help.naver.com | 미표시 |
| NAVER_WEB | Naver / NAVER_AI | [공식형/멀티출처형 AI 브리핑 : 네이버 검색 고객센터](https://help.naver.com/service/5626/contents/24120) | help.naver.com | 미표시 |
| CLAUDE_BOTS | Anthropic / CLAUDE | [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) | support.claude.com | 2026-04-07 |
| CLAUDE_SEARCH | Anthropic / CLAUDE | [Enable and use web search](https://support.claude.com/en/articles/10684626-enable-and-use-web-search) | support.claude.com | 미표시 |
| PERPLEXITY_BOTS | Perplexity / PERPLEXITY | [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) | docs.perplexity.ai | 미표시 |

모든 등록 source의 capturedAt/lastVerifiedAt은 2026-10-16T11:34:00.000Z다. 정확한 URL이 없는 SOURCE_URL_REQUIRED 등록 후보는 0개다. 추가 확인한 Google crawler/technical requirements 및 Search Central 2025-05-21 글은 보조 검토에만 사용했고 팩 source 수에 포함하지 않았다. NAVER Search Advisor/SmartPlace의 일반 Search/Place 사실을 AI 브리핑 FACT로 옮기지 않았다.

## B. Production Knowledge / Source Citation Report

격리 팩 DB: **FACT 23 / OBSERVATION 0 / HYPOTHESIS 0**. ChatGPT 5, Google AI 8, Gemini 2, Naver AI 2, Claude 4, Perplexity 2다. 별도 SYNTHETIC namespace의 HYPOTHESIS 1개는 격리 검사 전용이며 위 수에 포함하지 않는다.

| Knowledge ID / version | Platform | Claim summary | Official title / domain | Source date | Verified date | Review status | Rule usage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CHATGPT_OAI_SEARCHBOT_PURPOSE v1 | CHATGPT | OAI-SearchBot은 ChatGPT 검색에서 웹사이트를 발견하고 연결하기 위한 검색 크롤러다. | [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) / developers.openai.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | CHATGPT_SEARCHBOT_ACCESS |
| CHATGPT_CRAWLER_ROLE_SEPARATION v1 | CHATGPT | OAI-SearchBot과 GPTBot의 robots 설정은 독립적으로 관리할 수 있다. | [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) / developers.openai.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| CHATGPT_GPTBOT_TRAINING_PURPOSE v1 | CHATGPT | GPTBot은 모델 학습용 크롤러다. | [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) / developers.openai.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| CHATGPT_USER_REQUEST_PURPOSE v1 | CHATGPT | ChatGPT-User는 사용자 요청에 따른 페이지 접근에 사용된다. | [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) / developers.openai.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| CHATGPT_SEARCH_ELIGIBILITY_NOT_GUARANTEED v1 | CHATGPT | 검색 자격 조건을 충족해도 ChatGPT 검색 결과 배치는 보장되지 않는다. | [Searching the web with ChatGPT](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt) / help.openai.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| GOOGLE_AI_SUPPORTING_LINK_ELIGIBILITY v1 | GOOGLE_AI | AI Overviews와 AI Mode의 supporting link 자격에는 Google Search 색인과 snippet 표시 자격이 필요하다. | [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) / developers.google.com | 2025-12-10 | 2026-10-16 | APPROVED (test OWNER) | GOOGLE_AI_NOINDEX |
| GOOGLE_AI_QUERY_FANOUT v1 | GOOGLE_AI | AI Overviews와 AI Mode는 하위주제와 데이터 소스에 관련 검색을 수행하는 query fan-out을 사용할 수 있다. | [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) / developers.google.com | 2025-12-10 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| GOOGLE_AI_SEARCH_FOUNDATIONS_RELEVANT v1 | GOOGLE_AI | Google Search의 AI 기능에서도 기존 SEO 기본 사항은 관련된다. | [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) / developers.google.com | 2025-12-10 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| GOOGLE_AI_NO_SPECIAL_SCHEMA_REQUIRED v1 | GOOGLE_AI | Google Search의 AI 기능에 등장하기 위한 특별한 AI schema.org markup은 필요하지 않다. | [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) / developers.google.com | 2025-12-10 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| GOOGLE_AI_NO_AI_TEXT_FILES_REQUIRED v1 | GOOGLE_AI | Google Search의 AI 기능을 위한 별도의 AI 텍스트 파일은 필요하지 않다. | [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) / developers.google.com | 2025-12-10 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| GOOGLE_AI_IMPORTANT_CONTENT_TEXTUAL v1 | GOOGLE_AI | Google은 중요한 콘텐츠를 텍스트 형태로 제공하도록 안내한다. | [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) / developers.google.com | 2025-12-10 | 2026-10-16 | APPROVED (test OWNER) | GOOGLE_AI_PAGE_TEXT |
| GOOGLE_AI_CRAWL_CONTROL v1 | GOOGLE_AI | Google Search AI 기능을 위한 크롤링 접근은 robots의 Googlebot 지시로 관리한다. | [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) / developers.google.com | 2025-12-10 | 2026-10-16 | APPROVED (test OWNER) | GOOGLE_AI_CRAWL_ACCESS |
| GOOGLE_AI_NOINDEX_CONTROL v1 | GOOGLE_AI | noindex는 Google Search 색인을 방지하는 지시어다. | [Block Search indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing) / developers.google.com | 2025-12-10 | 2026-10-16 | APPROVED (test OWNER) | GOOGLE_AI_NOINDEX |
| GEMINI_APPS_SOURCES_MAY_APPEAR v1 | GEMINI | Gemini Apps는 응답 내부 또는 아래에 관련 출처 링크를 제공할 수 있다. | [View related sources from Gemini Apps - Computer - Gemini Apps Help](https://support.google.com/gemini/answer/14143489?hl=en) / support.google.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| GEMINI_APPS_NOT_ALL_RESPONSES_HAVE_SOURCES v1 | GEMINI | Gemini Apps의 모든 응답에 관련 링크나 출처가 포함되는 것은 아니다. | [View related sources from Gemini Apps - Computer - Gemini Apps Help](https://support.google.com/gemini/answer/14143489?hl=en) / support.google.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| NAVER_AI_BRIEFING_PURPOSE v1 | NAVER_AI | AI 브리핑은 검색 의도와 맥락을 반영한 요약 답변과 출처 정보, 관련 질문을 제공하는 생성형 AI 기능이다. | [AI 브리핑 소개 : 네이버 검색 고객센터](https://help.naver.com/service/5626/contents/24119) / help.naver.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| NAVER_AI_BRIEFING_WEB_DOCUMENT_SOURCE v1 | NAVER_AI | 공식형 및 멀티출처형 AI 브리핑은 네이버 검색엔진이 수집한 웹문서를 분석해 답변과 출처를 제공한다. | [공식형/멀티출처형 AI 브리핑 : 네이버 검색 고객센터](https://help.naver.com/service/5626/contents/24120) / help.naver.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| CLAUDE_BOT_ROLE_SEPARATION v1 | CLAUDE | Anthropic은 ClaudeBot, Claude-User, Claude-SearchBot을 서로 다른 목적으로 운영한다. | [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) / support.claude.com | 2026-04-07 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| CLAUDE_SEARCHBOT_PURPOSE v1 | CLAUDE | Claude-SearchBot은 검색 결과의 품질을 개선하기 위해 웹 콘텐츠를 탐색하고 분석한다. | [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) / support.claude.com | 2026-04-07 | 2026-10-16 | APPROVED (test OWNER) | CLAUDE_SEARCHBOT_ACCESS |
| CLAUDE_USER_PURPOSE v1 | CLAUDE | Claude-User는 사용자의 질문에 따른 웹사이트 콘텐츠 접근에 사용된다. | [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) / support.claude.com | 2026-04-07 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| CLAUDE_WEB_SEARCH_CITATIONS v1 | CLAUDE | Claude는 웹검색 정보를 사용한 응답에서 출처 인용을 제공한다. | [Enable and use web search](https://support.claude.com/en/articles/10684626-enable-and-use-web-search) / support.claude.com | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |
| PERPLEXITY_SEARCHBOT_PURPOSE v1 | PERPLEXITY | PerplexityBot은 Perplexity 검색 결과에 웹사이트를 발견하고 연결하기 위한 크롤러다. | [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) / docs.perplexity.ai | 미표시 | 2026-10-16 | APPROVED (test OWNER) | PERPLEXITY_SEARCHBOT_ACCESS |
| PERPLEXITY_USER_PURPOSE v1 | PERPLEXITY | Perplexity-User는 사용자 요청에 따른 페이지 접근에 사용된다. | [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) / docs.perplexity.ai | 미표시 | 2026-10-16 | APPROVED (test OWNER) | FACT_ONLY |

모든 Knowledge는 stable ID/version과 draftChecksum, 승인 후 immutable checksum을 가진다. 검토 manifest에는 draftChecksum 및 source excerptHash를, 격리 설치 증거에는 승인된 각 version checksum을 기록했다. 검토 예정일 2026-11-15, 만료일 2027-01-14는 내부 30일/90일 정책이다. 검토 기한이 지난 자료를 영구 CURRENT로 취급하지 않는다.

## C. Rules

| Approved Rule | Platform / channel | Check | Agent / scope | FACT basis |
| --- | --- | --- | --- | --- |
| CHATGPT_SEARCHBOT_ACCESS v2 | CHATGPT / CHATGPT_WEB_SEARCH | ROBOTS_ACCESS | OAI-SearchBot | CHATGPT_OAI_SEARCHBOT_PURPOSE |
| GOOGLE_AI_CRAWL_ACCESS v2 | GOOGLE_AI / GOOGLE_AI_SEARCH | ROBOTS_ACCESS | Googlebot | GOOGLE_AI_CRAWL_CONTROL |
| GOOGLE_AI_NOINDEX v2 | GOOGLE_AI / GOOGLE_AI_SEARCH | NOINDEX | HTML_AND_HEADER | GOOGLE_AI_NOINDEX_CONTROL, GOOGLE_AI_SUPPORTING_LINK_ELIGIBILITY |
| GOOGLE_AI_PAGE_TEXT v2 | GOOGLE_AI / GOOGLE_AI_SEARCH | PAGE_TEXT_PRESENT | 제공된 성공 응답의 텍스트 유무 | GOOGLE_AI_IMPORTANT_CONTENT_TEXTUAL |
| CLAUDE_SEARCHBOT_ACCESS v2 | CLAUDE / CLAUDE_WEB_SEARCH | ROBOTS_ACCESS | Claude-SearchBot | CLAUDE_SEARCHBOT_PURPOSE |
| PERPLEXITY_SEARCHBOT_ACCESS v2 | PERPLEXITY / PERPLEXITY_SEARCH | ROBOTS_ACCESS | PerplexityBot | PERPLEXITY_SEARCHBOT_PURPOSE |

Rule draft v1과 승인 v2를 각각 보존한다. Rule마다 승인된 정확한 FACT version의 checksum을 고정한다. 목적은 제공된 증거의 Internal Readiness 점검이다. robots 결과는 WAF/IP 접근이나 실제 수집·색인·노출을 확인하지 않는다. noindex 부재는 색인 또는 snippet 자격 전체를 증명하지 않는다. 텍스트 유무는 품질·순위 평가가 아니다. 모든 weight=1은 내부 값이며 공식 알고리즘 가중치가 아니다.

## D. RuleSets

| Platform | Official FACT | Approved RuleSet | 상태 |
| --- | --- | --- | --- |
| CHATGPT | 있음 | CHATGPT_GENERAL_V1 v2 | CONFIGURED, 증거 없으면 PARTIAL |
| GOOGLE_AI | 있음 | GOOGLE_AI_GENERAL_V1 v2 | CONFIGURED, 증거 없으면 PARTIAL |
| GEMINI | 있음 | 0개 | FACT_ONLY / NOT_CONFIGURED |
| NAVER_AI | 있음 | 0개 | FACT_ONLY / NOT_CONFIGURED |
| CLAUDE | 있음 | CLAUDE_GENERAL_V1 v2 | CONFIGURED, 증거 없으면 PARTIAL |
| PERPLEXITY | 있음 | PERPLEXITY_GENERAL_V1 v2 | CONFIGURED, 증거 없으면 PARTIAL |

각 RuleSet은 draft v1과 승인 v2를 보존한다. Gemini와 Google AI의 channel/규칙은 분리되며 Gemini Deep Research를 consumer channel로 합치지 않았다. Naver 일반 웹 AI 브리핑과 Place AI 브리핑을 합치지 않았다.

## E. Unsupported Claims

- **SOURCE_EVIDENCE_INSUFFICIENT**: GOOGLE_AI_CORE_SEARCH_FOUNDATION: core ranking/quality systems와 Search index 전체 의존 관계. 확인한 문서의 SEO 및 색인 자격 안내보다 넓은 주장이므로 등록하지 않는다.
- **UNSUPPORTED_AS_OFFICIAL_FACT**: GOOGLE_AI_LLMS_TXT_NOT_REQUIRED: llms.txt를 visibility/ranking 신호로 사용하지 않는다. 별도 AI 텍스트 파일 불필요만 등록한다. 확인한 본문에는 llms.txt 명칭이나 ranking 신호 미사용을 직접 명시하지 않는다.
- **UNSUPPORTED_AS_OFFICIAL_FACT**: FAQ가 citation을 증가시킨다. 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- **UNSUPPORTED_AS_OFFICIAL_FACT**: Schema가 AI 추천을 증가시킨다. 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- **UNSUPPORTED_AS_OFFICIAL_FACT**: 백링크 수가 특정 AI 추천을 증가시킨다. 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- **UNSUPPORTED_AS_OFFICIAL_FACT**: 리뷰 숫자가 모든 네이버 AI 추천을 증가시킨다. 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- **UNSUPPORTED_AS_OFFICIAL_FACT**: llms.txt가 Google AI visibility를 증가시킨다. 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.
- **UNSUPPORTED_AS_OFFICIAL_FACT**: Yeti 허용이 AI 브리핑 추천을 증가시킨다. 이번에 확인한 공식 문서에서 직접 뒷받침되지 않는다.

GOOGLE_AI_CORE_SEARCH_FOUNDATION의 넓은 ranking/quality/index 의존 관계는 확인한 본문이 직접 뒷받침하는 범위를 넘으므로 보류했다. llms.txt 관련 원래 후보도 ranking 신호 미사용까지 단정하지 않고 별도 AI 텍스트 파일 불필요 사실로 좁혔다. 이는 해당 효과가 불가능하다는 반증이 아니라 이번 공식 근거로 승인하지 않았다는 뜻이다. AEO/GEO를 공식 제품명이나 ranking system으로 등록하지 않았다.

## F. Actions

Action Definition **0개**. 기술 Action은 선택적 후보이므로 이번 v1에서는 추가하지 않았다. 효과 주장이나 전략 Action을 생성하지 않았으며 기존 NO_EFFECT_CLAIM 정책을 변경하지 않았다. FAQ_BUILD/BACKLINK_BUILD/LLMS_TXT_CREATE/SCHEMA_FOR_AI, training bot 허용 작업, Gemini/Naver용 근거 없는 Action은 없다.

## G. Governance

팩 ID OFFICIAL_PLATFORM_KNOWLEDGE_PACK, version 1, date 2026-10-16.

- manifest checksum: c2954ea41a4e104720771529ab09ab2aa20011bd6e01e018193d35b429df8b9f
- 실제 설치 version 집합 checksum: ca9ad78b7a6b6df52e33bb98ed71db86380f7d0da6aa9f026fd055cd668e5d12
- 승인 actor: 테스트 OWNER fixture 0768f74a-a638-47eb-b1f2-5aa233ed136d
- 명령: OWNER_REVIEW_OFFICIAL_PACK
- PRODUCTION audit event: 준비 1 + 명시적 검토/등록 1 = 2개
- humanApprovalRecorded: **false**

소스 조회는 승인 경로에 포함되지 않는다. REVIEW_REQUIRED manifest 출력 → draft 제출 → 모든 claim/source hash와 manifest checksum을 명시한 OWNER 명령 → Rule/RuleSet/정책 순서다. 현재 DB의 OWNER를 transaction 안에서 확인하며 MANAGER/ANALYST/VIEWER, 역할 위조, 불완전한 decision, source/claim/manifest 변조, 미지원 Rule, 중복/재승인을 거부한다. Audit에는 actor/명령/manifest hash와 변경된 각 stable ID/version이 남는다. Rule/RuleSet/Knowledge의 버전을 덮어쓰지 않는다. 팩 파일을 import하거나 URL을 발견해 자동 승인하는 코드는 없다.

팩 전용 UI/HTTP 쓰기 endpoint는 추가하지 않았으며 내부 OWNER 명령을 사용한다. 실제 운영 OWNER 검토는 향후 deployment gate에서 수행해야 한다. 상세 계약은 [운영 문서](23-official-pack-operations.md), 검토 가능한 claim/source 목록은 [검토 manifest](22-official-pack-v1-review.json)에 있다.

## H. Persistence

격리 원본 복원 DB에서 기존 baseline을 resolve하고 additive migration만 적용했다. 신규 migration은 만들지 않았다. 실제 PostgreSQL 저장 → 인증 API → WRITE 프로세스 종료 → 별도 READ 프로세스 → 암호화 통합 백업 → 새 DB/첨부 root 복원 → 별도 READ 프로세스의 checksum/API 결과 일치를 확인했다. backup/restore의 data/schema/ID·관계/files 일치도 모두 true다.

추가로 빌드된 실제 Next 서버를 격리 팩 DB와 복원 DB에 각각 새로 기동했다. 로그인 세션을 새로 발급하고 HTTP 네트워크를 통해 같은 Knowledge metadata와 6개 Overview 상태를 확인했다. 두 실제 서버 검사 결과: http-restarted-server=0, http-restored-server=0. 세션 토큰은 manifest에 저장하지 않는다.

## I. API Projection

| Platform | API Readiness | Score | RuleSet |
| --- | --- | --- | --- |
| CHATGPT | PARTIAL | null | CHATGPT_GENERAL_V1 |
| GOOGLE_AI | PARTIAL | null | GOOGLE_AI_GENERAL_V1 |
| GEMINI | NOT_CONFIGURED | null | 없음 |
| NAVER_AI | NOT_CONFIGURED | null | 없음 |
| CLAUDE | PARTIAL | null | CLAUDE_GENERAL_V1 |
| PERPLEXITY | PARTIAL | null | PERPLEXITY_GENERAL_V1 |

기본 policy의 source=null은 고객 증거를 추측해서 선택하지 않는다는 뜻이다. 구성된 4개 플랫폼은 UNKNOWN/PARTIAL이며 score=null이다. 별도 합성 프로젝트 복사본에 명시적 PAGE/AUDIT 증거를 지정해 6개 Rule 각각 PASS/FAIL/UNKNOWN을 검사했다. 실제 고객 score나 영구 평가 결과를 생성하지 않았다. 위 API는 8-9의 실제 인증 HTTP handler를 통과하며 Knowledge/Rules/Actions/Overview/6개 Detail/Readiness/Action candidates에서 원문·출처 본문·개인정보·비밀·파일경로·cross-client lineage·SYNTHETIC sentinel이 노출되지 않는 것을 확인했다. 추천 확률/공식 점수가 아니라는 metadata를 유지한다.

## J. Preservation

원본 read-only hash 비교: data=true, schema=true, 20개 도메인 동일=true. 기존 파일 323개 중 323개 SHA256 동일, 수정/삭제 0개다. 기존 workspace.tsx 사용자 수정과 UI/Route/Prisma schema/migration을 보존했다. 신규 PI 관련 검증 파일 50개의 source/runtime hash도 동일하다.

원본 신규 PI table=false; enabled=false; persistenceEnabled=false. 원본 migration·flag 활성화·UI 변경·고객 score 입력을 수행하지 않았다. 테스트에서 새로 만든 합성 프로젝트도 팩 등록 전후 legacy project checksum이 동일하다.

## K. Tests

| 검사 | 결과 |
| --- | --- |
| 신규 팩 source/scope/governance unit | 23 PASS |
| 전체 unit / 실제 DB / PDF / preservation | 434 PASS, 38개 파일 / phase 6개 기본 skip |
| 실제 PG 팩 준비·OWNER 검토·privacy·audit·합성 check 분기 | PASS |
| 독립 Node 재시작 / 통합 backup 복원 | PASS / PASS |
| 실제 Next HTTP 서버 신규 기동 / 복원 DB 서버 | PASS / PASS |
| Prisma generate / Next build / TypeScript | PASS / PASS / PASS |
| 전체 E2E | 16 PASS / 1 FAIL |
| 원본 DB·20도메인·기존 323파일 / runtime 동일 | PASS |

기본 suite가 skip하는 PostgreSQL 전용 phase를 모두 성공한 것으로 계산하지 않았다. 이번 팩 phase는 실제 DB의 WRITE/READ/복원 READ와 두 실제 서버 HTTP invocation으로 별도 실행했다. 기존 8-8/8-9 phase 증거는 해당 단계 보고서와 백업을 유지한다. 기존 server unit 28개를 포함한 전체 회귀는 통과했다.

이번 E2E의 유일한 실패는 기존 pilot.spec.ts:50:532의 390px mobile overflow다. Studio 3개 흐름과 API boundary E2E는 이번 실행에서 모두 통과했다. 이전 단계의 Studio 배열 순서 민감성 경고가 해결됐다고 간주하지 않는다. full-e2e.log와 test-results에 상세 증거를 보존한다. Next filesystem tracing warning 3개, PreScan/CITED direct Experiment adapter 미지원과 일부 Experiment Metric 지원 한계도 유지한다. 관련 없는 UI/정렬/기존 테스트는 수정하지 않았다.

## L. Production Count

다음은 **격리 migrated 팩 검증 DB의 PRODUCTION namespace** 실제 SQL 집계다. 원본 운영 DB 수와 혼동하지 않는다.

| Domain | 전체 저장 version 수 | 승인 / 의미 |
| --- | --- | --- |
| KNOWLEDGE | 23 | FACT 23 approved, OBSERVATION/HYPOTHESIS 0 |
| RULE | 12 | Approved 6 + immutable draft 6 |
| RULESET | 8 | Approved 4 + immutable draft 4 |
| READINESS_POLICY | 4 | 4 |
| READINESS / OBSERVATION / ACTION / EXECUTION | 0 / 0 / 0 / 0 | 실제 고객 평가/작업 없음 |
| MEASUREMENT / EXPERIMENT / EXPERIMENT_RESULT | 0 / 0 / 0 | 성과 데이터 없음 |
| INSIGHT_POLICY / INSIGHT | 0 / 0 | 집계 없음 |
| PI AuditEvent | 2 | OWNER 준비 및 명시적 review command |

복원 팩 DB도 같은 count와 exact version checksum을 보존한다. 별도 SYNTHETIC namespace에는 격리 확인용 HYPOTHESIS draft 1개와 audit 1개가 있다. 다른 깨끗한 회귀 DB의 13개 PRODUCTION domain count는 모두 0이다. 원본에는 PI table 자체가 없으며 설치된 팩도 없다. 테스트 OWNER fixture의 승인 기록을 실제 사람의 운영 승인으로 표시하지 않는다.

## M. 다음 단계 판정

**READY_WITH_WARNINGS**. 공식 출처와 claim 단위 FACT, 제한된 Rule, exact checksum, 명시적 OWNER fixture 검토, 저장/재시작/복원/API/원본 보존을 검증했다. Gemini/Naver FACT_ONLY는 정상 결과다. 원본 배포나 실제 고객 진단으로 전환하려면 별도의 운영 OWNER 검토와 deployment gate가 남는다. 기존 경고가 있으므로 모든 E2E가 green이라고 주장하지 않는다.

증거 디렉터리: C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/output/stage7-5/platform-8-10-b44aa625-5d11-4878-af8c-79330fda7cde. pack-results.json, pack-process-a/b.log, pack-restored-process-b.log, pack-restart-manifest.json 및 .review.json, pack-second-restore.json, http-results.json, http-restarted-server.log, http-restored-server.log, regression-results.json, full-unit-db-pdf.log, production-build.log, full-typecheck.log, full-e2e.log, final-preservation.json, production-counts.json을 보존한다. 이 로컬 증거 경로에는 DB 비밀번호나 세션 토큰을 출력하지 않았다.
