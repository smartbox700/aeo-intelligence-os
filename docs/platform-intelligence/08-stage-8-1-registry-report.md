# Platform Intelligence 8-1 — Registry & Legacy Mapping 검증 보고서

## A. 구현

추가 파일:

- `src/lib/platform-intelligence/types.ts`: 플랫폼·채널·공급사·해석 근거와 기존 DataKind를 분리한 readonly 계약.
- `registry.ts`: 6개 플랫폼과 registry version.
- `channels.ts`: 7개 채널의 로컬 구현 상태. 실행 권한과 분리.
- `providers.ts`: 5개 공급사. 공급사만으로 제품을 추정하지 않음.
- `aliases.ts`: 명시적인 legacy 문자열 해석. 원본 정규화·수정 없음.
- `resolver.ts`: 필드 문맥·서로 다른 근거·관측 방식의 충돌을 검사하는 순수 함수.
- `index.ts`: 향후 신규 모듈에서 사용하는 공통 export.
- `tests/platform-identity.test.ts`: 신규 34개 테스트.
- 이 보고서.

기존 consumer-config, enum, 화면, Route, 저장 계층, Prisma, metric, Snapshot/Report 코드는 수정하지 않았다. 8-0의 미커밋 파일도 그대로 보존한다. registry는 외부 요청·DB 접근·환경변수·현재 시각·랜덤 값이 없는 정적 read-model이다. 항상 import할 수 있으며 UI/API 연결이나 feature flag는 추가하지 않았다. 향후 동작 연결 시 기본 비활성 flag와 권한 검사를 별도로 적용해야 한다.

## B. Registry

버전: **`platform-registry-v1`**. 반환된 catalog, record, context, issues는 freeze된다. 배열 순서와 해석 결과는 같은 입력/버전에서 일정하다. 과거 버전 실행 엔진은 이번 범위가 아니다.

| Platform | 표시명 | 공급사 | 로컬 상태 |
|---|---|---|---|
| CHATGPT | ChatGPT | OpenAI / OPENAI | ACTIVE |
| GOOGLE_AI | Google AI Search | Google / GOOGLE | PLANNED |
| GEMINI | Gemini | Google / GOOGLE | ACTIVE |
| NAVER_AI | Naver AI | Naver / NAVER | ACTIVE |
| CLAUDE | Claude | Anthropic / ANTHROPIC | PLANNED |
| PERPLEXITY | Perplexity | Perplexity / PERPLEXITY | PLANNED |

| Channel | Platform | Mode | Status | 수동 UI | API adapter | API enabled |
|---|---|---|---|---|---|---|
| CHATGPT_WEB_SEARCH | CHATGPT | CONSUMER | ACTIVE | true | false | false |
| GOOGLE_AI_SEARCH | GOOGLE_AI | CONSUMER | PLANNED | false | false | false |
| GEMINI_CONSUMER_SEARCH | GEMINI | CONSUMER | ACTIVE | true | false | false |
| GEMINI_API_GROUNDING | GEMINI | API | LIMITED | false | true | false |
| NAVER_AI_BRIEFING | NAVER_AI | CONSUMER | ACTIVE | true | false | false |
| CLAUDE_WEB_SEARCH | CLAUDE | CONSUMER | PLANNED | false | false | false |
| PERPLEXITY_SEARCH | PERPLEXITY | CONSUMER | PLANNED | false | false | false |

모든 verifiedAt은 null이다. ACTIVE는 기존 consumer-config 및 수동 관측 코드 경로가 존재한다는 뜻이며, 외부 제품·공식 알고리즘을 검증했다는 뜻이 아니다. PLANNED는 전용 구조화 UI/adapter가 없다는 뜻이다. 기존 CITED 자유 입력이 없어졌다는 뜻이 아니다.

Gemini API adapter와 parser는 존재하지만 계정 검증 함수가 항상 실패하며 config.available=false이므로 LIMITED/apiEnabled=false다. 이 metadata는 현재 계정의 실행 가능성이나 실행 허가가 아니다. 기존 OpenAI API adapter도 유지되며, 이것을 ChatGPT 소비자 검색 채널의 API adapter로 동일시하지 않았다.

공급사 조회: OPENAI, GOOGLE, NAVER, ANTHROPIC, PERPLEXITY. `getPlatforms`, `getPlatform`, `getChannels`, `getPlatformChannels`, `getProviders`, `getProvider`, `resolveLegacyAlias`, `resolvePlatformIdentity`를 제공한다. 없는 code 조회는 undefined 또는 빈 배열을 반환한다.

## C. Legacy Mapping

아래는 독립 alias 해석이다. null은 채널을 알 수 없다는 뜻이며 DB에 UNKNOWN을 저장하지 않는다.

| Raw legacy 값 | Platform | Channel | Provider | Confidence |
|---|---|---|---|---|
| CHATGPT_WEB_SEARCH | CHATGPT | CHATGPT_WEB_SEARCH | OPENAI | EXACT |
| GEMINI_CONSUMER_SEARCH | GEMINI | GEMINI_CONSUMER_SEARCH | GOOGLE | EXACT |
| NAVER_AI_BRIEFING | NAVER_AI | NAVER_AI_BRIEFING | NAVER | EXACT |
| GEMINI_API_GROUNDING / Gemini API Grounding | GEMINI | GEMINI_API_GROUNDING | GOOGLE | EXACT |
| GOOGLE_AI_SEARCH | GOOGLE_AI | GOOGLE_AI_SEARCH | GOOGLE | EXACT |
| CLAUDE_WEB_SEARCH | CLAUDE | CLAUDE_WEB_SEARCH | ANTHROPIC | EXACT |
| PERPLEXITY_SEARCH | PERPLEXITY | PERPLEXITY_SEARCH | PERPLEXITY | EXACT |
| ChatGPT | CHATGPT | null | OPENAI | HIGH |
| Gemini | GEMINI | null | GOOGLE | HIGH |
| 네이버 AI 검색 | NAVER_AI | null | NAVER | HIGH |
| 네이버 AI 브리핑 / Naver AI | NAVER_AI | null | NAVER | HIGH |
| Google AI / Google AI Search | GOOGLE_AI | null | GOOGLE | HIGH |
| Claude | CLAUDE | null | ANTHROPIC | HIGH |
| Perplexity | PERPLEXITY | null | PERPLEXITY | HIGH |
| OpenAI / OPENAI | null | null | OPENAI | EXACT |
| Google / GOOGLE | null | null | GOOGLE | EXACT |
| Naver / NAVER | null | null | NAVER | EXACT |
| Anthropic / ANTHROPIC | null | null | ANTHROPIC | EXACT |
| 6개 canonical Platform code | 해당 Platform | null | 해당 공급사 | EXACT |
| MOCK_TEST / 미등록 문자열 / 비문자 값 | null | null | null | UNRESOLVED |

`Perplexity`와 `PERPLEXITY`는 제품/회사 이름이 겹친다. 독립 alias 또는 platformName 문맥에서는 제품, **provider 필드에서는 명시적인 공급사**가 우선한다. 따라서 CITED platformName='Perplexity'는 플랫폼으로, provider='Perplexity'만 있으면 공급사만 해석한다. provider='ChatGPT'/'Gemini'는 vendor name이 아니므로 기존 product alias로 해석하되 채널은 null이다.

Observation Method는 기존 DataKind 그대로 별도 전달한다. DEMO를 화면 코드만 보고 CONSUMER_UI_MANUAL로 변경하지 않는다. 입력에 method가 없으면 null이다. Canonical context는 `resolutionConfidence`, `resolutionSource`, `registryVersion`, `issues`를 포함한다.

```ts
resolvePlatformIdentity({provider:'OpenAI', method:'API_OBSERVATION'});
// platformCode:null, channelCode:null, providerCode:'OPENAI'

resolvePlatformIdentity({consumerScreen:'CHATGPT_WEB_SEARCH', method:'CONSUMER_UI_MANUAL'});
// platformCode:'CHATGPT', channelCode:'CHATGPT_WEB_SEARCH', providerCode:'OPENAI'

resolvePlatformIdentity({platformName:'Google AI'});
// platformCode:'GOOGLE_AI', channelCode:null, providerCode:'GOOGLE'
```

## D. Ambiguous / Unresolved

- 이름만 있으면 검색 사용·특정 화면을 입증하지 못하므로 channel=null. CITED 5개 이름도 동일하다.
- '네이버 AI 검색'은 기존 mock provider 명칭이어서 NAVER_AI까지만 HIGH다. '네이버 AI 브리핑'도 consumer-config의 provider이지만 provider 문자열만 있는 과거 행에 실제 screen 근거가 있다고 보장할 수 없어 채널은 비워 둔다. 명시적 NAVER_AI_BRIEFING 코드가 있을 때 EXACT다.
- Gemini, Google AI, Google 공급사는 별개다. 공통 vendor만으로 제품이나 화면을 추정하지 않는다.
- 대소문자·공백을 임의 정규화하지 않는다. 미등록 값은 UNRESOLVED다.
- 미등록 필드를 알려진 필드와 함께 전달해도 이를 무시해 확정하지 않는다. 전체 identity를 UNRESOLVED로 반환하며 issues에 필드명을 남긴다.
- 공급사/플랫폼/화면 코드가 서로 충돌하거나 API 방식에 소비자 채널을 지정하면 전체 identity는 null/UNRESOLVED, source=CONFLICT다. throw 및 추측성 우선 덮어쓰기 없음.
- consumerScreen에 API 채널을 넣는 조합도 거부한다. 알려진 PLANNED 채널을 식별하는 것과 지원 가능 여부는 별개다.

## E. Preservation

검증 증거는 Git에서 제외된 보호 디렉터리 `output/stage7-5/platform-8-1-827df258-0e01-423b-b10f-834eecdb7e17`에 보관한다. `files-before.json`은 기존 tracked/untracked 파일 SHA256, `source-before.json`은 read-only transaction으로 읽은 전체 원본 DB/DDL/도메인 해시다. 8-0 증거와 pointer는 수정하지 않았다.

원본 DB는 read-only로 조회하고 기존 통합 백업을 별도 `aeo_restore_test_*` DB로 복원하여 테스트한다. 복원은 기존 18개 테이블을 재현하며 Platform 테이블·migration을 만들지 않는다. 원본에 없는 Snapshot/Report/동의 영역은 8-0의 LOCAL MOCK 복원 테스트로 검증하며 실제 고객 데이터 실증으로 표현하지 않는다.

최종 `final-preservation.json` 결과:

- 원본 전체 data hash 전/후 동일: `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96`.
- schema hash 동일: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`. DDL/컬럼/인덱스/제약 전체 비교도 동일.
- 기존 tracked/untracked 파일 중 변경된 파일: **0개**. 작업 시작 전부터 수정되어 있던 workspace.tsx와 8-0 신규 문서/스크립트/테스트를 포함한다.
- 20개 도메인 보존 비교 모두 equal=true. 원본에 없는 영역은 EMPTY_IN_SOURCE로 구분한다.
- 통합 백업→격리 복원: data/schema/IDs/관계/files 모두 일치. 원본 첨부 referenceCount/fileCount는 0이며, 별도의 rich preservation 테스트가 비어 있지 않은 synthetic 첨부·Snapshot·보고서·동의를 검증했다.
- 원본 provider/screen/rawText, Snapshot payload/hash, 보고서를 UPDATE하거나 재계산하지 않았다. 원본 DB의 StaffSession/AccessEvent도 변경 예외로 제외하지 않았다.

Prisma schema 파일은 시작 시 SHA256 `5a4f0156617b662fddcc40507f1cc5fc33a3af26eeb0e205ac2094e4c3af7ba7`이며 최종 기존 파일 비교에서 변경 없음이 확인됐다. 원본 DB와 8-0 baseline 해시도 동일하다.

## F. Test

- 신규 identity 테스트: 34/34 통과.
- 복원 DB 전체 단위·PostgreSQL·PDF·rich preservation: 29개 파일, 171/171 통과. 기존 8-0 137개와 신규 34개 포함.
- 격리 runtime production build: 통과. 기존 동적 파일 추적 경고 3개 유지.
- 격리 runtime TypeScript `tsc --noEmit`: 통과.
- 전체 E2E: **15 통과 / 1 실패**. PreScan→Snapshot→PDF, Consumer, CITED, Reports, Backup/Restore 접근 제어, Studio, workspace 경계가 통과했다.
- 실패는 기존 `tests/e2e/pilot.spec.ts:50`의 390px 모바일 overflow 검사다. 데스크톱 검사는 통과했으며 마지막 모바일 scrollWidth 검사에서 실패했다. 8-0과 같은 위치/원인이다.
- Studio task 배열 순서 민감성 검사는 이번 실행에서 통과했다. 8-0 반복 재현으로 확인된 기존 경고를 해결됐다고 판정하지 않는다.
- 전체 migration history 부재도 그대로다. 실제 DB에 `_prisma_migrations`가 없고 디스크에는 부분 이력만 있다. schema 변경을 하지 않았으므로 이번 순수 registry 작업의 blocker는 아니다.
- 기존 WARN을 통과시키기 위한 구현·테스트 기대값 수정은 없다. 신규 FAIL은 발견되지 않았지만 전체 E2E green 상태는 아니다. 검증 runner의 exit 1은 위 기존 E2E 실패를 숨기지 않은 결과다.
- `git diff --check` 통과. 기존 UI/Route/consumer-config/types에는 신규 registry import가 없다. file mode 전용 E2E는 이번 단계에서 재실행하지 않았으며, storage와 연결되지 않은 순수 테스트 및 8-0 file-mode 보존 결과를 근거로 제한한다.

## G. 다음 단계 준비상태

**READY_WITH_WARNINGS**

8-2 Knowledge / Rule Registry가 참조할 canonical identity, readonly catalog, 버전·해석 근거·미확정/충돌 처리 계약을 마련했다. 신규 회귀는 발견되지 않았고 원본 DB와 기존 파일 보존을 확인했다. migration 이력, Pilot 모바일 overflow, Studio 배열 순서 민감성 및 기존 빌드 경고를 계속 추적한다.

이 판정은 8-2의 제한된 확장 착수 가능 판정이다. schema 변경이나 공개 배포, API 활성화의 승인으로 사용하지 않는다. Knowledge/Rule/FACT/Score는 이번 단계에 구현하지 않았다.
