# 8-0 Legacy Platform Identification Matrix

이번 단계는 발견한 값을 기록할 뿐 canonical code를 생성하거나 데이터를 변환하지 않는다. type/enum/string, provider, 소비자 제품 화면, API transport, 업종 플랫폼(네이버 쇼핑 등)을 구분한다.

표의 ‘저장’은 지원 코드 경로가 있다는 뜻이다. 해당 raw 값의 실제 고객 관측이 DB에 존재한다는 주장은 아니다. `Report=조건부`는 일반 보고서 scope가 수용할 수 있으나 검증 gate를 통과해야 함을 뜻한다.

| raw value | source·형태 | 저장 | UI | Report | Pre-Scan | Pilot | API |
|---|---|---|---|---|---|---|---|
| CHATGPT_WEB_SEARCH | types.ts ConsumerScreen; consumerInput/studyInput/prescan/pilot-common/sales-report의 Zod enum | consumer.screen/Study/Scan/Agreement/Plan JSON | ConsumerLab/PreScan/Pilot | Sales/Pilot/일반 | Y | Y | N: 소비자 화면 |
| GEMINI_CONSUMER_SEARCH | 위 3종 enum의 Gemini 값 | 위와 동일 | 위와 동일 | 위와 동일 | Y | Y | N: 소비자 화면 |
| NAVER_AI_BRIEFING | 위 3종 enum의 Naver 값 | 위와 동일 | 위와 동일 | 위와 동일 | Y | Y | N: 소비자 화면 |
| ChatGPT | providers.ts 목록, validation.ts provider enum, consumer-config provider, CITED platforms, seed.ts | ResponseRecord.provider/AIProvider.id/ObservationRun.providerId | 대시보드·입력·CITED | Y/조건부 | screen mapping | screen mapping | 소비자 이름이지 OpenAI API 증명 아님 |
| Gemini | providers.ts/validation.ts/consumer-config/CITED/seed | 위와 동일 | Y | Y/조건부 | screen mapping | screen mapping | API Grounding과 별개 |
| 네이버 AI 검색 | providers.ts, validation.ts, seed.ts; 문자열 | legacy response/provider | 일반 수동 입력·대시보드 | 일반 조건부 | 해당 string 직접 사용 안 함 | 직접 사용 안 함 | N |
| 네이버 AI 브리핑 | consumer-config.ts의 NAVER_AI_BRIEFING.provider | consumer 수집 response/provider | ConsumerLab·대시보드 | Y/조건부 | Y | Y | N |
| OpenAI | measurementInput.provider literal, OpenAIWebSearchAdapter.id, 대시보드 API 행 | API 배치·response/provider | MeasurementLab·API 지표 | API_OBSERVATION 조건부 | N | N | 구현+LIVE_AI_ENABLED gate |
| Gemini API Grounding | FreeGeminiAdapter.id string | 호출 허용 시 API response 가능 | 무료 API 설정/차단 안내 | 조건부 API 관측 | N | N | adapter 구현; 무료 계정 verifier fail-closed |
| Google AI | cited-diagnosis.ts platforms const, CITED UI | CitedSnapshot 및 attachDiagnosis의 MANUAL_OBSERVATION provider | CITED | CITED/일반 조건부 | N | N | N |
| Claude | CITED platforms const | 위와 동일 | CITED | 위와 동일 | N | N | N |
| Perplexity | CITED platforms const | 위와 동일 | CITED | 위와 동일 | N | N | N |
| MOCK_TEST | tests/postgres.integration.test.ts의 모의 adapter.id | 격리 테스트용 DB provider 생성 가능 | 실제 서비스 지원 목록 아님 | 실제 성과로 사용 금지 | N | N | 모의 transport |
| WEBSITE / NAVER / COUPANG | studio-types.ts PageSnapshot/StudioDraft.channel | 페이지/납품 채널 | ExecutionStudio | 콘텐츠 산출물 맥락 | 소비자 screen 아님 | 작업 target 맥락 | AI platform 아님 |
| MEDICAL / LEGAL / BRAND / ECOMMERCE / COMMERCE / PRODUCT / LOCAL_SERVICE | Query/Onboarding/Optimization의 업종·프로필 enum | 고객/질문/분석 프로필 | 각 업무 화면 | 업종 문맥 | 업종 문맥 | 업종 문맥 | AI platform 아님 |

## 전체 source 출현 위치

`03-platform-legacy-occurrences.md`는 generated code를 제외한 src의 모든 TypeScript/TSX에서 위 플랫폼 관련 literal의 **파일·행·값** 출현을 기록한다. 코드 본문/키/응답 원문은 덤프하지 않는다. 파생 검사표일 뿐 registry나 alias mapping의 실행 구현이 아니다.

주요 파일은 `types.ts`, `providers.ts`, `consumer-config.ts`, `consumer-observation.ts`, `research.ts`, `prescan.ts`, `pilot-common.ts`, `pilot-types.ts`, `sales-report.ts`, `measurement-service.ts`, `openai-provider.ts`, `gemini-provider.ts`, `validation.ts`, `cited-diagnosis.ts`, `workspace.tsx`, `consumer-lab.tsx`, `pilot-panel.tsx`, `prescan-panel.tsx`, `sales-report-panel.tsx`, `cited-workspace.tsx`다.

## 8-1 alias 계획에서 지킬 것

1. 원 provider/screen 값을 보존한다. 동일 표기라도 method와 채널이 다르면 독립 scope다.
2. `네이버 AI 검색`과 `네이버 AI 브리핑`을 근거 없이 같은 제품 화면으로 단정하지 않는다.
3. `Google AI`만으로 AI Overview/AI Mode 등 구체 제품 화면을 추정하지 않는다.
4. OpenAI API 관측을 ChatGPT 소비자 관측으로 backfill하지 않는다.
5. MOCK/DEMO와 CLIENT 실제 관측을 alias로 승격하거나 혼합하지 않는다.
6. 기존 raw string·legacy condition에 새 enum을 직접 덮어쓰지 않고 sidecar mappingVersion/reviewStatus를 별도로 제안한다.

## 실제 원본 DB 값 (읽기 전용 관측)

ObservationRun: ChatGPT/DEMO 2, Gemini/DEMO 2, 네이버 AI 검색/DEMO 1. AIResponse의 consumer.screen은 5개 모두 없음(null). AIProvider에는 ChatGPT, Gemini, MOCK_TEST, 네이버 AI 검색, 네이버 AI 브리핑이 있다. Provider catalog에 존재해도 현재 응답이 존재한다는 뜻은 아니다. 실제/유료 API 관측이 있다고 추정하지 않는다.

검색용 bots OAI-SearchBot/GPTBot/Googlebot은 audit.ts의 robots 검사 대상이지 provider identity가 아니다. gpt-5.6-luna와 gemini-2.5-flash는 코드에 있는 model/default 값이지 실행 당시 모델·공식 지원 보장의 증거가 아니다.
