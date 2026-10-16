# Platform Intelligence Layer 확장 설계 보고서

작성일: 2026-10-15 (Asia/Seoul)

조사 기준: 로컬 Git HEAD `96eb523b40c6f0904ef0104bd411d2e7e4a067e6`.

**최종 판정: 2. 부분 Refactoring 필요.** 고객·질문·관측·검증·스냅샷·실행·Pilot을 재사용하는 점진 확장이 적합하다. 플랫폼 식별, 버전이 있는 지식/규칙, 플랫폼 준비도, 표준 Action 연결, 실험 결과 및 동의 기반 학습 집계는 보강해야 한다.

## 조사 범위와 변경 여부

- 실제 TypeScript 서비스·컴포넌트·Route, Prisma 스키마, 기존 SQL, 저장 계층, 테스트 및 격리 검증 스크립트를 읽었다. 주요 근거는 문서 끝 S01~S30이다.
- **이번 작업은 이 보고서 작성뿐이다. 애플리케이션 코드·테스트·Route·Prisma 스키마·Migration을 수정하지 않았다.**
- DB 연결, 데이터 조회/변경, 초기화, 백업/복원, 빌드, 테스트, 크롤링 및 외부 AI 호출은 실행하지 않았다. 일부 초기화·검증 함수는 DB 쓰기를 수반하므로 호출하지 않고 구현만 조사했다.
- 아래의 ‘현재’는 저장소에 있는 구현을 뜻한다. 실행 중 DB의 실제 DDL·데이터량·직원 배정·동의 유효성이나 현재 환경변수 값까지 확인했다는 의미는 아니다. 이 문서는 현재 테스트 통과를 새로 인증하지 않는다.
- 플랫폼별 공식 문서를 조사하거나 새 FACT를 등록하지 않았다. 요청서의 플랫폼별 체크 예시는 후보 설계 입력이며 공식 특성으로 확정하지 않는다.

## A. 현재 구조

### A-1. 기술 Stack와 디렉터리

| 항목 | 실제 구현 |
|---|---|
| 앱 | Next.js App Router, React, TypeScript. manifest 범위는 Next `^16.0.0`, React/React DOM `^19.0.0`, TypeScript `^5.9.0` [S01] |
| 서버 | Next Route Handler, Node.js crypto/fs/http/https. Zod 입력 검증 |
| UI | Tailwind CSS 4 계열, 일반 CSS, lucide-react. 여러 업무 화면을 `Workspace`의 숫자 탭으로 선택 [S25] |
| 저장 | PostgreSQL + Prisma `^6.19.0`; `STORAGE_MODE=postgres`가 아니면 로컬 `data/workspace.json` [S02][S04] |
| 기타 | cheerio HTML 해석, ipaddr.js 공개 IP 판별, embedded-postgres 로컬 실행 도구 |
| 검사 | Vitest, Playwright/Edge. 현재 파일 기준 단위 테스트 25개 파일, E2E 13개 spec 파일. 테스트 케이스 실행 수와는 다름 [S29] |
| 주요 경로 | `src/app` 페이지/API, `src/components` 업무 UI, `src/lib` 도메인/서비스/지표, `prisma` 스키마/SQL, `tests`, `scripts`, `docs` |

공개 화면은 `/`, `/welcome`, `/diagnosis`, `/report`, `/blog/aeo-marketing-1`이다. `/os`는 인증된 기존 OS를 연다. `/`는 비로그인 시 랜딩, 로그인 시 기존 OS를 유지한다. CITED 진단과 OS는 이미 고객 프로젝트로 연결돼 있으므로 Platform Intelligence를 별도 고객 앱으로 만들 필요가 없다. [S24][S25]

### A-2. DB 구조: 관계형 테이블과 JSON 도메인이 혼합되어 있다

Prisma 선언에는 다음 17개 모델이 있다. **`PreScan`, `PilotAgreement`, `ResearchStudy`라는 독립 테이블이 이미 있다는 가정은 틀리다.** [S02][S03]

| 관계형 모델 | 현재 역할 |
|---|---|
| `Organization`, `Project` | 조직·고객 프로젝트. `Project.operations`는 JSON |
| `ClientEntity`, `CompetitorEntity` | 고객/경쟁사 기본 식별자와 JSON payload |
| `QuestionSet`, `Question` | 프로젝트의 질문 관계와 질문 payload |
| `AIProvider` | 응답의 provider 문자열을 ID로 저장. 정규화된 6개 Platform Registry와 다름 |
| `ObservationRun`, `AIResponse` | 관측 메타데이터와 질문별 원문/파생 분석 payload |
| `Mention`, `CitationSource` | 응답별 언급 및 출처 URL 관계 |
| `WebsiteAudit`, `OptimizationTask` | 홈페이지/관측 진단 및 개선 작업 payload |
| `MeasurementBatch` | 프로젝트+idempotencyKey 유일성, API/DEMO 배치 |
| `Report` | 일반 고객/영업/Pilot 보고서를 payload category로 구분 |
| `StaffUser`, `StaffSession`, `AccessEvent` | 직원 역할·프로젝트 ID 배열, 세션, 접근 이력 |

주요 관계는 다음과 같다.

```text
Organization → Project
  ├─ ClientEntity / CompetitorEntity
  ├─ QuestionSet → Question → AIResponse
  ├─ ObservationRun → AIResponse → Mention / CitationSource
  ├─ MeasurementBatch → ObservationRun
  ├─ WebsiteAudit → OptimizationTask
  └─ Report
```

`db.saveProject()`는 질문들을 `projectId + '-questions'`라는 한 QuestionSet에 저장한다. 따라서 DB의 QuestionSet은 논리적 `QuerySetVersion` 하나하나와 1:1이 아니다. 확정 질문 세트의 버전·이유·가설 질문 지도는 고객 payload에서 보존된다. [S03][S05]

| 논리 도메인 | 현재 영속 위치 |
|---|---|
| 질문 지도·대표 질문·Pre-Scan·Pre-Scan Snapshot | `ClientEntity.payload.preScanRepository` |
| ResearchStudy·조건·반복 수 | `ClientEntity.payload.researchStudies` |
| 검증 사실·원본 페이지 | `ClientEntity.payload.studioRepository` |
| 증빙 이미지 메타데이터 | `ClientEntity.payload.evidenceFiles` + 별도 파일 |
| CITED 수동 진단 버전 | `ClientEntity.payload.citedDiagnoses` |
| 온보딩·수정안·영업·재무·작업 절차 | `Project.operations` |
| 협약·동의·Pilot 작업·측정계획·Pilot Snapshot | `Project.operations.pilot` |
| 일반/영업/Pilot 결과 보고서 | `Report.payload`; 영업은 `AEO_SALES_SNAPSHOT`, Pilot은 `PILOT_OUTCOME` category |

### A-3. Observation 구조

`ResponseRecord`가 공통 관측 레코드다. 기존 필드와 저장 규칙을 유지해야 한다. [S05][S09][S10]

| 요청 차원 | 실제 보유 구조 및 한계 |
|---|---|
| client/project | `ProjectData.id`, 고객 ID; consumer 경로는 `consumer.projectId`도 검증 |
| query/intent | `questionId`, 실제 `questionText`, `Question.intent`; intent는 자유 문자열 |
| platform | `provider:string`, 소비자 경로는 `consumer.screen`; 통일된 platform code 없음 |
| model/channel | `model`, 3개 `ConsumerScreen`; 로그인·언어·새 대화 여부 등은 독립된 정규 필드가 아님 |
| 시각·응답 | `observedAt`, `rawText`; consumer는 질문 입력/답변 기록 시각도 저장 |
| 언급·추천·경쟁사 | `mentions`, `entityAnalysis.entities`의 role/context/review와 identity 근거 |
| 순서 | `Mention.position`과 `ExtractedEntity.introductionOrder`가 다름. ‘1위’ 지표는 명시적 추천 번호를 사용 |
| citation/source | `citations[]`, API `measurement.citedSources`, 엔티티 `sourceUrls` |
| method/evidence | `DataKind`, `consumer.method`, `evidenceIds`, `verification` |
| run number | `consumer.repetition`, `studyId`, `phase`; 모든 입력 경로에 공통인 필드는 아님 |

`DataKind`는 `DEMO`, `MANUAL_UI`, `MANUAL_OBSERVATION`, `CONSUMER_UI_MANUAL`, `API`, `API_OBSERVATION`이다. 이는 FACT/OBSERVATION/HYPOTHESIS의 지식 분류와 별개의 축이다.

소비자 수동 입력은 프로젝트/질문/증빙 소속, 원문, 실제 질문, 국가/지역, 검색 사용, 미래 시각, 계획·단계·반복 번호를 검증한다. 입력 키에 대한 해시를 보존하고, 계획 안에서 질문×화면×단계×반복 슬롯의 중복을 막는다. [S09]

반복 측정은 **없지 않다**. `createStudy()`는 반복 수 1~5, 입력은 repetition 1~10을 받되 계획 소속이면 study의 반복 수 이하만 허용한다. 반면 현재 Pre-Scan과 Pilot 계획 생성은 repetitions=1이다. `MeasurementBatch.repetitions`도 타입상 1로 고정되어 있다. [S05][S06][S08][S09][S13]

`ObservationRun`이라는 DB 모델 이름만 보고 ‘질문 전체를 묶는 1회 실험 run’으로 재해석하면 안 된다. 현재 writer는 응답마다 `ObservationRun.id = AIResponse.id = ResponseRecord.id`로 저장한다. [S03]

### A-4. Query·Pre-Scan

- `UniverseVersion`, `QueryCandidate`, `QuerySetVersion`으로 지도/대표 질문을 버전 관리한다. 질문은 `INTENT_HYPOTHESIS` 또는 `HUMAN` 출처다. 검색량이나 실제 추천 확률로 주장하지 않는다. [S06]
- `generateUniverse()`는 공식 URL 확인과 업종/지역/서비스 입력을 요구한다. 자동 템플릿은 현재 MEDICAL의 치과 조건이 중심이며 LEGAL/BRAND/ECOMMERCE는 준비 중 경고와 수동 보충 경로가 있다. [S06][S07]
- `confirmSet()`은 고유 질문 **30개**를 확정한다. `createPreScan()`은 LEAD 상태, 확정 질문 세트, 현재 3개 screen 중 선택을 요구한다. [S06]
- 30×선택 플랫폼의 슬롯, 실패/제외/재포함, 수집·검증 진행률, 플랫폼/intent별 분석이 있다.
- `PreScanSnapshot`은 canonical JSON과 SHA256, frozen 상태를 보존한다. [S06]

### A-5. Client·Sales·Pilot·Agreement

온보딩은 `MEDICAL`, `LEGAL`, `COMMERCE`, `BRAND` 업종과 공식 사실, 업무 단계, 담당자를 관리한다. 개선 작업은 기존 `Task → Proposal → ExecutionDetail → StudioWork`와 연결된다. 검토·고객 승인·규정 검토·적용 증빙·재측정 연결을 재사용할 수 있다. [S17][S18][S19]

Pilot에는 다음 흐름이 구현돼 있다. [S13][S14][S15]

```text
Pre-Scan frozen Snapshot → SalesReport
  → PilotAgreement(버전/합의 증빙)
  → 항목별 Consent / Milestone / PilotWork
  → MeasurementPlan → Baseline/Follow-up Snapshot
  → PilotOutcomeReport → PaidProposal → ContractConversion
```

Pilot은 프로젝트/고객/CLIENT-DEMO 소속, optimistic revision, 협약 버전, 적용된 작업 버전과 증빙을 검사한다. 합의 후 ACTIVE가 되어야 수행할 수 있으며 홈페이지 수정/콘텐츠 발행 동의가 별도로 존재한다. 의료·법률 작업은 현재 버전의 규정 검토와 필요한 외부 심의 완료 기록을 요구하는 경로가 있다. [S14][S15]

`INTERNAL_RESEARCH`, `ANONYMIZED_STATISTICS`, `PUBLIC_CASE_STUDY`, `NAMED_SALES_CASE` 동의 종류는 이미 선언돼 있다. 하지만 ‘종류가 있다’는 것과 ‘새 Learning 집계가 해당 동의를 자동으로 검사한다’는 것은 다르다. 후자는 아직 없다. [S14][S15]

### A-6. Snapshot·Report·지표

| 종류 | 현재 의미와 재사용 범위 |
|---|---|
| `PreScanSnapshot` | 확정 질문·관측 진행/분석·증빙 참조를 frozen/hash로 보존 |
| `PilotMeasurementSnapshot` | 기준/후속의 유효 관측 ID·제외 사유·지문·조건·계산 버전·계획 해시 |
| `PageSnapshot` | 페이지 원본·구조·기술 단서·추출 사실·SHA256. KPI Snapshot과 다른 개념 |
| `CitedSnapshot` | 사용자 수동 체크가 포함된 진단 데이터와 연결 원문 ID. 자동으로 ‘검증된 성과’가 되지 않음 |
| `ClientReport` | 질문/플랫폼/기간 scope, 검증된 지표, HTML/hash, 승인 상태 |
| `SalesReport` | frozen Pre-Scan Snapshot 기반 보고서. 근거 지문·해시와 승인/PDF artifact 관리 |
| `PilotOutcomeReport` | 계획·작업·동의·전후 비교를 연결한 결과 보고서. 근거 변경 감지 |

`confirmedMetrics()`는 미검증/거부/부정확/내부연구 전용/질문 소속 불일치/출처 대조 부족 등을 제외하고 계산 버전을 기록한다. 추천·공식 호스트 인용·명시적 첫 추천·Query Coverage 정의가 있다. [S10]

`compareStudy()`는 조건 일치 및 반복별 대응 표본을 찾는다. `pilotComparison()`은 동일 계획 Snapshot, 지문 freshness, 모델 미표시, 작은 표본, 대응 pair를 검사하고 percentage point 차이와 비인과적 한계를 출력한다. 일반 비교 함수는 호출 scope에 따라 여러 화면을 포함할 수 있으므로 새 플랫폼 비교에는 **플랫폼+채널별로 먼저 분리**해 적용해야 한다. [S12][S13]

### A-7. 현재 플랫폼 식별은 분산되어 있다

| 경로 | 실제 코드 상태 |
|---|---|
| 소비자 관측/Pre-Scan/Pilot | `CHATGPT_WEB_SEARCH`, `GEMINI_CONSUMER_SEARCH`, `NAVER_AI_BRIEFING` 3종 enum과 max(3) 검증이 여러 서비스에 존재 |
| 공통 Provider 목록 | ChatGPT, Gemini, ‘네이버 AI 검색’ 문자열 [S21] |
| 소비자 provider | ChatGPT, Gemini, ‘네이버 AI 브리핑’ 문자열 [S08] |
| API 측정 | `measurementInput.provider`는 `OpenAI` literal. OpenAI Web Search Adapter 구현이 있으며 호출 gate가 있음 [S21] |
| Gemini API | `Gemini API Grounding` adapter와 parser가 있으나 무료 계정 검증기는 현재 실패하도록 되어 있어 기본 실행 불가 [S21] |
| CITED 진단 | ChatGPT, Gemini, Claude, Perplexity, Google AI 5개 이름. Naver AI 없음. 질문×플랫폼 1개 슬롯이며 반복 차원 없음 [S24] |
| 기존 대시보드 | 3개 provider 배열로 플랫폼 행을 렌더링하는 부분이 있어 Claude/Perplexity/Google AI가 자동 반영되지 않음 [S25] |

따라서 Claude/Perplexity 응답 원문을 일반 MANUAL_OBSERVATION으로 보관할 수 있다는 사실이, 해당 플랫폼의 Pre-Scan·계약·Pilot·반복 실험이 전부 지원된다는 뜻은 아니다.

### A-8. Role/Permission

| 역할 | 실제 권한 요약 |
|---|---|
| OWNER | local-org 전체 프로젝트 접근, 직원/금액/계약/범위 예외 등 관리 경로 |
| MANAGER | 배정된 프로젝트 운영, 관측 검증, 승인/저장·Pilot 관리. 계약 제안/전환 등 일부는 OWNER 전용 |
| ANALYST | 배정 프로젝트 관측·분석 및 일부 초안 작업. 관측 verification은 OWNER/MANAGER; Pilot API는 허용하지 않음 |
| VIEWER | 고객 보고서 전용. 허용 프로젝트의 승인 보고서 및 확정 보고 목적 검사. workspace 원문 API 접근 불가 |

권한은 `requireStaff()`, `assertProjectAccess()`, `allowedProjects()`, `safeWorkspaceProject()`와 각 Route의 추가 분기로 나뉜다. 프로젝트는 `local-org`에 묶여 있고 StaffUser.projectIds는 FK가 없는 문자열 배열이다. 완성된 범용 멀티테넌트 권한 시스템으로 가정하지 않는다. [S20][S26]

## B. 재사용 가능한 기존 기능

### B-1. AEO Core 항목별 매핑

| 신규 요구 항목 | 재사용할 실제 구조 | 현재 한계 |
|---|---|---|
| Entity | ClientEntity/CompetitorEntity, EntityAnalysis, VerifiedFact | 전사 Entity 지식그래프가 아님 |
| Query Universe | UniverseVersion/QuerySetVersion, 질문/intent/선정 이유 | 업종 템플릿 제한, 플랫폼별 coverage 정책 없음 |
| Content | PageSnapshot, StudioDraft, Proposal/StudioWork 버전 | 콘텐츠 평가가 플랫폼별 규칙 pack과 연결되지 않음 |
| Evidence | EvidenceFile, PilotDocument, 원문·URL·해시·검증 이력 | 통합 evidence reference 및 규칙별 근거 연결이 없음 |
| Authority | 공식 출처/자격·외부 근거 단서, SOURCE_CREDIBILITY 유형 | Authority 공식 점수·외부 평판 지표는 없음. 단서를 점수로 과장하면 안 됨 |
| Freshness | fact.checkedAt/expiresAt, effectiveFactStatus, page/response 시각 | 플랫폼 지식/Rule 만료 정책은 없음 |
| Crawlability | safeFetch, robots 해석, HTTP/색인 설정 findings | 현재 관측 URL/경로의 기술 단서. 검색 색인 등록·AI 접근 성공을 보장하지 않음 |
| Structured Data | JSON-LD 구문/기본 구조, studio-schema 검증 | 플랫폼 노출 보장이나 전체 Schema.org 의미 인증 아님 |
| Local Data | 주소·연락·예약·지역·공식 정보 일관성 | Place/Business Profile 실제 등록·품질을 확인하는 API 없음 |
| Product Data | PRODUCT 프로필, 상품/제조사/가격/배송/반품 facts | Merchant/쇼핑 데이터 피드 운영 시스템 없음 |
| Actionability | 예약/구매 CTA와 공식 URL 검증, 관측 actionLinks | 예약 가능 사실·실제 전환은 별도 근거 필요 |
| Query Coverage | confirmedMetrics의 서로 다른 질문 기반 지표 | 계획 질문 전체 대비 측정률과 언급 coverage를 구분해야 함 |

기존 Homepage audit는 `OAI-SearchBot`, `GPTBot`, `Googlebot`, `*`의 홈페이지 경로 robots 해석을 수행한다. 이는 이미 있는 검사 코드의 사실이며, 그 출력이 특정 플랫폼의 추천 알고리즘을 입증한다는 뜻은 아니다. 새 규칙은 이 검사를 evidence로 참조할 수 있다. [S16]

### B-2. 재사용 원칙

1. 고객·질문·응답·원문·증빙을 새 테이블에 복제해 ‘두 번째 고객 OS’를 만들지 않는다.
2. 기존 확정 관측 gate와 동일 조건 비교를 새 플랫폼 scope로 감싼다. 미검증 CITED 체크를 verified로 승격하지 않는다.
3. 표준 Action은 기존 Task/Proposal/StudioWork/PilotWork를 **참조**한다. 별도 작업 상태·고객 승인 체계를 중복 구현하지 않는다.
4. 기존 Snapshot/Report는 원본과 hash를 보존한다. 새 버전의 규칙이나 플랫폼명이 생겨도 과거 payload를 다시 쓰지 않는다.
5. 현재 우선순위 점수 `priorityScore()`와 `accuracy/relevance/technical/citation/conversion` 가중치는 작업 우선순위다. 플랫폼 Readiness 점수로 이름만 바꿔 사용하지 않는다. [S17]

## C. 부족한 기능

| 구분 | 현재 없는 것 / 필요한 확장 |
|---|---|
| 식별 | 6개 정규 platform code, 플랫폼과 제품 채널·provider의 분리, legacy alias 해석 이력 |
| 지식 | FACT/OBSERVATION/HYPOTHESIS의 공통 구분, 공식 출처·검증일·적용 범위·유효기간·폐기 이력 |
| 규칙 | 수정 가능한 Check/Weight/Action 연결, 불변 RuleSetVersion과 승인·활성화 절차 |
| Readiness | 고객×플랫폼×채널×룰 버전별 평가, 항목 근거, unknown/해당없음, confidence/coverage |
| 관측 | 6개 플랫폼 공통 조건/반복/증빙 식별. 새로운 Google/Claude/Perplexity 수동 채널 지원 |
| 실험 | 표준 Action 버전과 실제 적용일·전후 Snapshot의 명시적 연결, attribution, 교란요인 |
| 학습 | 업종×문제×Action×플랫폼×KPI별 재현 가능한 cohort, 동의·비식별·누락/실패 포함 집계 |
| 저장/API | Registry/Readiness/Experiment 전용 repository, 동시성·원자성·버전된 read model |
| UI | 기존 고객 선택 아래 플랫폼 Overview/Detail, Rule/Action 관리와 실험·Insight 화면 |

현재 타입/Prisma에서 PlatformRule/Readiness/Experiment/ActionLibrary/Learning의 독립 도메인은 발견되지 않았다. 유사 기능이 있다는 것과 해당 요구가 완성됐다는 것은 구분한다.

## D. 권장 Architecture

### D-1. 기존 도메인을 감싸는 모듈 구조

아래는 **구현 제안**이다. 현재 파일/Route가 생겼다는 뜻이 아니다.

```text
기존 Project / Query / Facts / Pages / Evidence / Task / Pilot
                         │
                    AEO Core Facade
                         │
                Platform Registry + Adapter
                 │                    │
          Rule/Knowledge         Observation Scope
                 │                    │
           Readiness Engine      기존 검증·지표·Snapshot
                 │                    │
          Issue → Action Library → 기존 실행/승인/적용 증빙
                                      │
                            Experiment Before/After
                                      │
                       동의·품질 gate → Learning/Insight
```

권장 경계는 `src/lib/platform-intelligence/{registry,knowledge,readiness,observations,actions,experiments,insights}` 같은 모듈이다. Core는 기존 객체를 읽는 facade이고, Adapter는 플랫폼 식별/가능 기능/증빙 해석을 제공한다. **Adapter 등록은 외부 API 연결이나 자동 수집을 의미하지 않는다.**

플랫폼별 switch와 점수식을 6개 복제하기보다 공통 평가기 + 승인된 RuleSetVersion의 데이터로 실행한다. 규칙 실행은 허용된 checkType과 검증된 입력만 사용하고 DB에 저장한 JavaScript/eval이나 임의 URL 요청은 허용하지 않는다.

### D-2. Platform / Channel / Provider / Method를 분리

| 플랫폼 코드 제안 | 기존 값의 연결 방안 |
|---|---|
| CHATGPT | `CHATGPT_WEB_SEARCH` → ChatGPT 소비자 웹검색 채널. provider ChatGPT는 추가 조건이 있을 때 채널을 확정 |
| GOOGLE_AI | 새로 명시적 수동 채널을 정의. ‘Google AI’ 기존 단순 이름은 실제 제품 화면 불명확이면 channel 미확정 유지 |
| GEMINI | `GEMINI_CONSUMER_SEARCH` 소비자 채널. Gemini API Grounding은 별도 API 채널 |
| NAVER_AI | `NAVER_AI_BRIEFING` → 브리핑 채널. ‘네이버 AI 검색’ 일반 이름은 브리핑과 무조건 동일시하지 않음 |
| CLAUDE | CITED의 Claude 표본은 기존 조건을 보존. 새 관측부터 실제 화면/검색 모드를 명시 |
| PERPLEXITY | CITED의 Perplexity 표본도 동일 원칙 |

`OpenAI`는 제공사/transport 이름이지 ChatGPT 소비자 제품 관측의 증거가 아니다. 기존 OpenAI API 행을 ChatGPT 웹검색 성과로 일괄 backfill하지 않는다. API 제품 채널은 provider와 함께 보존하고 platform 귀속/비교가능성은 명시적으로 검토한다. 플랫폼이 미확정인 legacy 행도 원문을 보존하되 플랫폼 확정 집계에서는 제외 사유를 보인다.

각 채널의 capability는 `manualSupported`, `apiAdapterImplemented`, `apiEnabled`, `evidenceRequirements`, `supportedObservationModes`, `comparisonPolicyVersion`, `verifiedAt` 등을 구분한다. ‘플랫폼이 API를 제공함’, ‘우리 코드에 adapter가 있음’, ‘현재 실행이 허용됨’은 다른 상태다. 지원 여부를 확인하지 않은 기능은 UNKNOWN으로 둔다.

### D-3. Knowledge 분류와 검증 상태는 독립이다

- `knowledgeType`: FACT / OBSERVATION / HYPOTHESIS.
- `reviewStatus`: DRAFT / REVIEW_REQUIRED / APPROVED / RETIRED.
- `validity`: validFrom, lastVerifiedAt, reviewDueAt, expiresAt.
- `scope`: platform, channel, 국가/언어, 제품/기능 범위.
- `provenance`: 원 출처, 문서/관측/실험 참조, 확인 시각, excerpt/hash, 검토자.

FACT는 범위가 명확한 공식 자료와 검토 기록이 있어야 승인할 수 있다. 공개 웹사이트 HTML이나 FAQ가 인용된 사례는 해당 시점의 OBSERVATION이다. 반복 성공이나 높은 confidence만으로 HYPOTHESIS를 FACT로 자동 변경하지 않는다.

기존 `VerifiedFact.status=VERIFIED`는 **고객 공식 정보 확인 상태**다. 플랫폼 알고리즘에 관한 FACT 분류와 같지 않다. `DataKind`, `classification`, `verification.status`, `knowledgeType` 네 축을 각각 유지한다.

### D-4. Readiness는 플랫폼별 내부 진단이다

평가 scope는 `(project, platform, channel, ruleSetVersion, evidenceAsOf)`로 고정한다. UI에는 ‘내부 준비도’, 평가 시각·증빙 범위·검사 coverage·Rule Version을 항상 표시한다. 공식 점수/추천 확률/예상 순위를 출력하지 않는다.

Check 결과는 PASS / WARN / FAIL / UNKNOWN / NOT_APPLICABLE로 구분한다. 정해진 checkType이 기존 PageSnapshot/VerifiedFact/Audit/확정 관측을 읽고 근거 ID/해시와 판정 이유를 남긴다. N/A에도 업종/플랫폼별 비적용 사유가 필요하다.

권장 계산 정책은 다음과 같다.

- 가중치는 음수가 아니고, WARN의 부분 점수도 버전 규칙에 명시한다.
- 적용 가능한 항목의 총 가중치 W, 확인 완료 항목의 가중치 K, 확인된 획득 점수 P를 기록한다.
- W=0이면 Score=null. UNKNOWN/만료 근거가 남은 경우 완성 Score=null과 coverage=K/W를 표시하고, 필요하면 하한 `100×P/W`, 상한 `100×(P+W-K)/W`를 참고 범위로 표시한다.
- 모든 점수화 대상이 확인되면 `100×P/W`로 계산한다. unknown을 0점으로 단정하거나 분모에서 빼서 좋은 점수를 만들지 않는다.
- 점수와 Confidence는 별도다. 검증된/만료된 근거 비율, 관측 수·반복 수·모델 불명확 여부를 근거로 confidence 사유를 표시한다. confidence를 추천 가능성으로 설명하지 않는다.
- HYPOTHESIS 체크는 기본 score에서 분리해 실험 후보로 제시한다. 탐색적 가설 점수를 도입하려면 별도 opt-in 정책/RuleSetVersion과 표시가 필요하다.

Google Index, Place/Business Profile, Merchant 등록, 실제 봇 방문은 현재 코드의 robots/meta 점검만으로 확인할 수 없다. 증빙이 없으면 UNKNOWN으로 두고 수동 확인 요청으로 남긴다. 새 자동 조회나 크롤링을 이 설계에 끼워 넣지 않는다.

### D-5. Observation 확장과 지표 계약

기존 ResponseRecord/ObservationRun을 유지하고 옆에 canonical context를 추가한다. 기존 원문/ID/enum 문자열을 일괄 치환하지 않는다. 새 관측에는 platform/channel, method, model/표시 불명 상태, 지역/국가/언어, 검색/로그인/개인화 상태, 새 대화·반복 정보, 계획/질문 원문 hash, 관측 시각, evidence를 받는다. 미확인은 명시적 UNKNOWN/null이다.

지표 키와 계산 버전은 고정 계약이다. 기존 `CALCULATION_VERSION`의 분모를 조용히 바꾸지 않는다.

1. Mention/Citation/Recommendation은 서로 다른 numerator/denominator를 보존한다.
2. 현재 확정 추천률은 문맥 분석 완료 표본 기반이고, CITED 추천률은 추천형 질문 기반이다. 동일 이름 아래 합치지 않고 지표 ID/정의/버전을 구분한다.
3. 현재 Query Coverage는 ‘관측된 고유 질문 중 언급된 질문’이다. ‘전체 계획 질문 중 언급된 질문’과 ‘측정 완료 질문 비율’은 별도 지표로 둔다.
4. legacy API, 소비자 화면, DEMO, 수동 초안을 합산한 플랫폼 점수를 만들지 않는다.
5. rate는 내부 0~1로 정규화하고, 표시는 %; 변화는 percentage points로 저장한다. CITED의 0~100 출력은 변환 경계를 명시한다.
6. 동일 원문을 여러 입력 경로로 복사한 것을 독립 반복으로 세지 않는다. 기존 inputKey/identity 외에 source identity와 세션/반복 조건을 보강하되 원문을 같다는 이유만으로 정상 반복을 삭제하지 않는다.

### D-6. Experiment와 Learning

실험은 기존 Pilot/ResearchStudy 위에 다음 연결을 추가한다.

```text
검증된 Before Snapshot
  → ActionDefinitionVersion
  → 기존 Task/ProposalVersion/PilotWork + 실제 적용 증빙/시각
  → 같은 조건의 After Snapshot
  → ExperimentResultVersion
```

필수 비교 gate는 같은 프로젝트·플랫폼·채널·method·고정 질문·조건·계산 버전, 유효한 검증/동의, 대응 반복, before≤실제 적용시각<after다. planned date나 Task 생성 시각을 실제 action date로 쓰지 않는다. 동시 작업, 모델 변경, 질문 변경, 계절/외부 노출 등 교란요인을 notes와 confounders에 기록한다.

Attribution은 `OBSERVED_AFTER_ACTION`, `CORRELATED`, `INSUFFICIENT_EVIDENCE`를 사용한다. 차이가 양수여도 자동으로 ‘Action이 개선시켰다’고 표시하지 않는다. 여러 Action이 겹치면 bundle/다중 intervention으로 표시하고 각 Action에 성과를 중복 귀속하지 않는다. 조건 불일치/미검증/모델 미표시 등으로 비교 불가능하면 delta=null과 사유를 남긴다.

Learning 1차는 학습모델이 아니라 **동의가 있는 Experiment 결과의 재현 가능한 통계 read model**이다. 업종 코드, Action 버전, 문제 분류, platform/channel, method, 지표/계산 버전, window, cohort 포함/제외 기준을 고정한다. DENTAL은 MEDICAL을 단순 이름 치환하지 않고 확인된 하위 업종 코드로 추가한다.

프로젝트 수, 실험 수, 관측 수, 고유 질문 수, 반복 수를 따로 출력한다. 한 고객이 100회 측정했다고 100개 고객으로 세지 않는다. 우선 프로젝트별 대응 delta를 계산한 후 프로젝트 균등 평균과 중앙값/분포를 출력한다. 음수·0·실패·누락 실험도 표시해 성공 사례만 선택하지 않는다. 동일 프로젝트의 중첩 기간/반복 실험은 독립 표본으로 취급하지 않는다.

조직 내부 연구에는 유효한 INTERNAL_RESEARCH 목적/동의 확인, 고객 간 비식별 통계에는 ANONYMIZED_STATISTICS, 실명/사례 공개에는 별도 동의가 필요하다. 기존 동의가 없거나 보유 기간/목적이 불명확하면 초기 집계에서 제외한다. 작은 cohort는 재식별 위험을 검토해 숨긴다. 예를 들어 최소 5개 고객 같은 기준은 향후 승인할 내부 정책 후보이며 법적 익명성을 보장하는 수치가 아니다.

## E. DB 변경안

아래는 논리적 Entity/Table 제안이다. **Migration이나 Prisma 변경은 아직 작성하지 않는다.** 새 테이블은 모든 기존 업무를 정규화하는 대신 공유·버전·조회가 필요한 새 도메인부터 추가한다. 작은 Check 항목은 불변 RuleSetVersion의 JSON spec, 평가 항목은 평가 payload에 보관하는 방식으로 시작할 수 있다.

| 제안 Entity/Table | 주요 Field | 관계·기존 구조 연결 |
|---|---|---|
| Platform | code(PK), name, status, registryVersion | 6개 안정 ID. 기존 AIProvider를 대체/개명하지 않음 |
| PlatformChannel | id, platformCode(nullable), providerCode, product/surface, mode, capabilitySpec, version, comparisonPolicy, lastVerifiedAt | 플랫폼/채널 관계. 제공사 API가 소비자 플랫폼과 동일하다는 뜻이 아님 |
| PlatformAlias | scope, legacyValue, mappingVersion, targetPlatform/channel, confidence, reviewer, status | alias는 product/channel 근거 부족 시 미확정. 과거 raw 문자열 보존 |
| PlatformKnowledgeVersion | knowledgeId+version, platform/channel, type, claim, sourceRefs, scope, verifiedBy/At, expiresAt, reviewStatus, supersedes | 불변 지식 버전. 고객 관측을 근거로 쓸 때 해당 project 권한 유지 |
| PlatformRuleSetVersion | ruleSetId+version, platform/channel, industryScope, checkSpec[], knowledgeVersionRefs, weightPolicy, checksum, approval, effectiveAt | checkSpec에 checkId/type/조건/가중치/N/A 정책/ActionVersion refs. 임의 실행 코드 금지 |
| PlatformReadinessEvaluation | id, projectId, platform/channel, ruleSetVersionId, evidenceAsOf, items[], sourceHash, score/null, bounds, coverage, confidenceReason, actorId | 기존 Audit/PageSnapshot/VerifiedFact/관측 참조. 변경 시 새 평가 생성 |
| ObservationPlatformContext | responseId(PK/FK AIResponse), projectId, platform/channel, method, modelStatus, locale, conditionSpec/hash, studyRef, phase, runNumber, mappingVersion, sourceIdentity | 기존 AIResponse와 0..1 확장. consumer 값과 충돌하면 명시적 오류/재검토 |
| ActionDefinition / ActionDefinitionVersion | stableCode, version, name/category/설명, industries/platforms, expectedEffectCategory, knowledge/evidenceLevel, review/active | 기존 ProposalType/DraftType는 유지하고 mapping. 버전 비활성화가 과거 실행을 삭제하지 않음 |
| ActionExecutionLink | id, projectId, actionVersionId, taskId(FK), proposalId/version, studioVersion, pilotAgreement/work refs, actualAppliedAt, proofRefs, status | 실제 상태·승인은 기존 Task/Proposal/Studio/Pilot가 원본. 여기는 참조와 적용 지문 |
| MeasurementSnapshotReference | id, projectId, sourceType, sourceId, sourceHash, kind, plan/조건 hash, metricVersion, verifiedScope, frozen metric projection | 기존 PreScan/Pilot Snapshot을 참조. JSON 내부 ID에는 DB FK가 없으므로 서비스에서 소속·hash 검증. 원본을 대체하지 않음 |
| Experiment | id, projectId, platform/channel, kind, issueRef, querySet/plan refs, before/afterSnapshotRef, window, status, revision, actorId | 기존 Study/Pilot계획·Snapshot과 연결. 한 고객 내 실험 |
| ExperimentActionLink | experimentId, actionExecutionLinkId, role, overlapNote | 여러 Action의 bundle/교란 연결. 같은 project를 강제 |
| ExperimentResultVersion | experimentId+version, metricVersion, numerator/denominator, pairedN, delta/null, attributionType, confidenceReason, excluded[], sourceHash, notes | 원본/승인/검증 변경 시 stale 처리, 재검증 후 새 결과 버전 |
| InsightAggregationRun (후기 선택) | id, cohortSpec/hash, aggregationVersion, cutoff, consentPolicyVersion, sourceResultRefs/hash, excludedCounts, summary | 초기에는 query service로 충분. 필요할 때만 materialized 결과·lineage 영속화 |

### E-1. 무결성과 보존

- 새 평가/실험/참조에는 projectId와 플랫폼/채널의 유효한 관계를 검사한다. 플랫폼 Registry가 전역이라고 고객 원문을 전역 공개하지 않는다.
- `ObservationPlatformContext`는 AIResponse FK를 사용하고 해당 run의 project와 일치해야 한다. Task link도 프로젝트가 같아야 한다. 복합 FK/unique 설계 또는 동일 transaction 내 검증으로 교차 프로젝트 참조를 차단한다.
- JSON 속 Proposal/Pilot/Legacy Snapshot ID는 문자열 FK처럼 보이지만 실제 DB FK가 아니다. `sourceType + sourceId + projectId + sourceHash`와 검증된 resolver를 사용한다. polymorphic ID만 저장하고 소속 검사를 생략하지 않는다.
- Rule/Knowledge/Action은 안정 ID와 불변 버전을 분리한다. 새 버전 공개는 과거 평가/실험 결과의 해시나 점수를 바꾸지 않는다.
- 1차 Snapshot 재사용은 검증된 Pilot/Pre-Scan을 우선한다. CITED Snapshot은 자체 수동 체크라서 그대로 확정 Before로 쓰지 않는다. 필요한 원문/조건을 검증한 뒤 별도 검증 Snapshot을 생성한다.
- 출처 철회/동의 만료는 보존된 원본을 과거에 없었던 것처럼 수정하지 않고, 사용 가능성·현재 결과 stale/제외 상태를 새로 기록한다. 향후 실제 삭제 요구는 별도 보유/삭제 정책과 함께 다룬다.

### E-2. 저장 계층에서 필요한 부분 Refactoring

현재 `mutate()`는 전체 프로젝트 graph를 읽고 전역 advisory lock 아래 모든 프로젝트를 `saveProject()`한다. Registry/Insight까지 이 JSON에 넣으면 모든 저장이 지식/통계를 통째로 읽고 다시 쓰게 된다. [S03][S04]

새 catalog/readiness/experiment repository는 별도 관계형 저장을 사용하되, 기존 Task 연결 등은 **같은 transaction과 기존 동시성 계약**에서 처리하는 좁은 bridge를 설계한다. 독립 `mutate()` 두 번으로 ‘Task는 생겼는데 Experiment link는 실패’하는 상태를 만들지 않는다. 신설 데이터가 legacy writer에 의해 무시/유실되지 않도록 load/save/export/backup/restore 경계를 함께 검증한다.

로컬 파일 모드는 기존 기능을 유지한다. 새 기능 초기 활성화는 PostgreSQL 전용 flag로 제한하는 방안이 안전하다. 파일 모드에도 제공하려면 같은 repository 계약의 versioned JSON 구현과 보존 테스트를 먼저 추가해야 한다. JSON에 몰래 저장하거나 일부 결과만 영속화하는 타협은 피한다.

현재 migrations 디렉터리에서 확인한 SQL은 stage5의 추가 컬럼/직원·세션·이력 관련 증분이다. 이것만으로 새 환경의 전체 DB를 재현할 수 있다고 단정할 수 없다. 스키마 변경 전 live DDL과 Prisma의 차이 확인, 현재 baseline 확보, 복원 검증이 별도 선행 작업이다. [S02][S28]

## F. UI/API 변경안

### F-1. 고객 선택을 공유하는 8개 화면

| 화면 | 기존 UI 재사용 | 제안 내용 |
|---|---|---|
| Client Platform Overview | Workspace 고객 선택, 플랫폼 비교, CitedWorkspace | 6개 플랫폼 카드: 내부 준비도/null, coverage, 관측 표본, 최신 평가, 미지원/미확인 표시 |
| Platform Detail | ConsumerLab 플랫폼 비교, 기존 지표/원문 | 채널/모델/method 필터, FACT/OBSERVATION/HYPOTHESIS 탭, 근거와 Rule Version |
| Readiness Check | OptimizationPanel의 finding/gap/작업 흐름 | 판정·근거·UNKNOWN/N/A 이유·Action 후보. 기존 우선순위 점수와 다른 이름/위치 |
| Observation | ConsumerLab, PreScanPanel, CITED 입력 | 공통 플랫폼 선택기로 확장. 질문·고객·수집 조건/반복/evidence/검증을 공유하고 입력 종류는 보존 |
| Issue → Action | 기존 과제/실행 관리/ExecutionStudio | 기존 taskId에 ActionVersion을 연결. 고객 승인/규정검토·실제 적용 기록은 기존 화면에서 수행 |
| Experiment Before/After | Baseline·Follow-up, Pilot 측정 연결/성과 보고 | 대응 pair/제외 사유, 실제 적용일, bundle/교란, delta와 attribution 표시 |
| Action Library | 새 내부 관리 탭 | 표준 코드·버전·적용 범위·근거 수준·활성 상태. OWNER 승인/발행 |
| Learning/Insight Dashboard | 운영 관제실의 고객 선택/권한 필터 재사용 | 고객별 또는 승인된 cohort의 표본·분포·누락/제외. 소표본 억제·비식별·출처 역추적 |

각 카드/점수에서 원 관측·Snapshot·Task·합의 근거로 이동할 수 있어야 한다. 별도 고객 목록이나 같은 데이터의 새 수기 입력 화면을 만들지 않는다. 전체 6개 플랫폼 행은 표시하되 미관측/미지원에 임의 Score를 채우지 않는다.

### F-2. 기존 Route 보존과 신설 API 제안

기존 `/api/workspace`, `/api/observations`, `/api/prescan`, `/api/measurements`, `/api/optimization`, `/api/operations`, `/api/execution-studio`, `/api/sales-reports`, `/api/pilot`, `/api/client-reports`, `/api/cited-diagnosis`와 증빙 Route는 그대로 유지한다. 지금 URL을 개명하지 않는다.

새 API 후보는 `/api/platform-intelligence/catalog`, `/knowledge`, `/readiness`, `/actions`, `/experiments`, `/insights`이다. project 데이터 API에는 projectId/권한, CSRF/동일 출처, Zod, 요청량/크기, expectedRevision/expectedVersion, accessEvent를 적용한다. 신규 6개 플랫폼 관측은 우선 versioned endpoint 또는 명시적 schemaVersion으로 추가해 구형 CSV/JSON을 깨지 않는다. 실제 이름·payload는 다음 구현 단계에서 확정한다.

| 작업 | 권한 제안 |
|---|---|
| 공통 catalog/승인 지식 읽기 | 내부 직원. 공개할 지식은 별도 projection |
| 규칙/Knowledge/Action 초안 | OWNER/MANAGER. 승인·발행·전사 weight 변경은 OWNER |
| 배정 고객 관측/분석 초안 | 현재 ANALYST 권한을 유지. 관측 검증/준비도 확정은 OWNER/MANAGER |
| 실험 계획/Action 적용 확정 | 해당 프로젝트 OWNER/MANAGER + 기존 고객 승인/동의 gate |
| 고객 간 Insight | 초기 OWNER + 유효한 이용 목적/동의/비식별 정책. 권한 없는 고객을 aggregate에 섞지 않음 |
| VIEWER | 기존 승인 보고서의 정제된 결과만. 원문·Rule 편집·Experiment API 접근 불가 |

### F-3. UI 확장 전 확인할 현재 결합

`workspace.tsx`는 숫자 탭과 `tab>=28` 같은 범위 분기로 PilotPanel을 렌더링한다. 새 CITED 탭 35도 이 범위에 들어가므로 CITED 화면에서 PilotPanel이 함께 mount될 수 있다. 실제 오류가 발생했다고 실행 검증한 것은 아니지만, 코드상 추가 패널/권한 요청의 위험이 있다. 신규 메뉴 추가 전에 안정적인 view ID와 명시적 모듈 경계로 정리하는 부분 Refactoring을 권한다. 기존 URL·view=execution-studio/cited 호환은 유지해야 한다. **이번 분석에서는 수정하지 않았다.** [S25]

## G. 단계별 구현계획

| 단계 | 범위 | 다음 단계로 넘어가는 기준 |
|---|---|---|
| 8-0 보존 기준·경계 | 실제 DB baseline/복원 증명, Route/role/기존 hash·ID inventory, 읽기/쓰기 경계 및 UI view 계약 | 격리 실행에서 현재 회귀 기준 확보. 원본 불변 확인 |
| 8-1 Platform Registry | 6개 platform, channel/provider 구분, legacy alias와 미확정 상태, feature flag | 문자열만 있던 행을 소비자 채널로 오인하지 않음. 기존 import/보고서 출력 그대로 |
| 8-2 Knowledge/Rule Registry | FACT/OBSERVATION/HYPOTHESIS, 출처·검증일·만료·불변 RuleSetVersion·승인 | 공식 출처 없는 FACT 발행 차단, 이전 버전 재현, 임의 코드 실행 금지 |
| 8-3 Observation 확장 | 새 context bridge, 6개 수동 채널, 반복/조건/evidence, versioned 입력 | 기존 3개 screen/CSV/JSON/Pre-Scan/Pilot 테스트 유지. 새 반복·오류·누락/중복 테스트 |
| 8-4 Platform Readiness | 기존 Core evidence resolver, 내부 점수/null/coverage, 6개 카드+Detail | 같은 evidence+Rule Version에서 같은 결과. unknown/N/A/만료 처리 확인 |
| 8-5 Action Library | 버전된 표준 Action, 기존 Task/Proposal/Studio/PilotWork 연결 | 승인·규정검토·실제 적용 증빙을 우회하는 새 상태 경로 없음 |
| 8-6 Experiment Engine | 검증 Snapshot refs, 실제 적용 시각, 대응 비교, attribution/confounders | 소속·조건·버전 불일치 차단. 다중 Action/무변화/악화/비교불가 재현 |
| 8-7 Insight Aggregation | 동의 확인, 업종/Action/platform/window별 cohort, 지표 lineage | 프로젝트 수와 관측 수 구분. 동의 철회·실패/누락·중복/소표본 정책 통과 |
| 8-8 업무 UX 정리 | 고객 컨텍스트, 기존 메뉴에 통합, 승인 보고서 projection | 진단→원문→Action→실험→리포트 이동과 권한 회귀 통과 |
| 8-9 전체 회귀·복원 | 원문/ID/관계/증빙/해시 보존, 전체 기존 테스트+신규 테스트, backup restore | 새 테이블 및 동의/증빙을 포함한 복원 후 재현 가능 |
| 8-10 Pilot Validation | 동의한 소수 고객의 실제 수동 관측, 플랫폼별 Before/After | 모의 결과와 구분한 검증 보고. 알고리즘/인과/성과 보장 문구 없음 |

Observation context를 Readiness보다 먼저 둔 이유는 platform/channel 식별이 없는 현재 데이터를 기반으로 플랫폼 점수를 먼저 만들면 잘못된 분모를 고착시키기 때문이다. UI는 8-4부터 각 기능과 함께 만들고 8-8에서 전체 흐름을 정리한다. 회귀 검사는 8-9에만 몰아서 하지 않고 **모든 단계의 종료 조건**으로 적용한다.

### 보존해야 할 테스트와 추가 검사

- 현재 단위 테스트 25개 파일과 E2E 13개 spec을 삭제하거나 기대값을 새 점수에 맞춰 무조건 바꾸지 않는다.
- `prescan`, `consumer`, `reporting`, `pilot`, `studio`, `operations`, `sales-report`, `visibility`, `measurement`, `cited-project`, `integrated-backup`, PostgreSQL integration 테스트를 보존한다.
- 신규: alias 충돌/미확정 mapping, API와 UI 분리, 6개 플랫폼 scope, FACT 검증 gate, Rule 만료·버전 고정, unknown/N/A 점수, response/context 소속, 반복·구형 import 호환, Action 실제 적용시각/버전, Snapshot stale, 권한/동의 철회, 소표본 및 중복 집계를 검사한다.
- 정적/단위 → 격리 PostgreSQL → 복원된 실행 폴더 E2E → 도메인 회귀 순서로 진행한다. `scripts/test-cited-integration.mjs`와 통합 백업/복원 도구는 기존 격리 검증 패턴으로 재사용할 수 있다. 이 스크립트 자체는 현재 일부 E2E만 실행하므로 전체 회귀를 대신하지 않는다. [S28][S29]

## H. 위험요소

| 위험 | 현재 근거 | 설계 대응 |
|---|---|---|
| 데이터 호환성 | provider/ConsumerScreen/CITED 이름과 범위가 다름 | 기존 raw 값·enum·원문 보존, sidecar mapping과 미확정 상태, 구형 입출력 회귀 |
| Migration | 관계형+JSON 혼합, 전체 graph writer, baseline 재현 미확인 | additive/nullable 확장, 복원 DB에서 shadow 비교 후 적용. 이번 단계 Migration 없음 |
| 원문·해시 훼손 | db writer는 rawText 불변, Pilot/Sales는 전체 근거 지문 검사 | 보강 metadata가 기존 hash 범위를 바꾸는지 구분. 기존 해시 함수에 새 필드를 소급 추가하지 않음 |
| 중복 Domain | QuerySetVersion≠DB QuestionSet, 여러 Snapshot·진단 흐름 | 원본 도메인 재사용, scope/ref adapter, 새로운 고객·관측 저장소 금지 |
| Hard Coding | 3개 screen enum/max(3), provider 배열, code weights, 숫자 탭 | 정규 catalog와 versioned checks. feature flag·호환 facade로 점진 전환 |
| Rule Versioning | 지식/플랫폼 규칙의 공통 registry 없음 | 불변 Knowledge/Rule/Action version, 발행·만료·supersedes, 평가 source hash |
| 측정 재현성 | 모델 미표시, 반복 경로 차이, 채널 조건 불완전 | 조건 hash·미확인 상태, 대응 pair/표본/제외 사유, API≠소비자 화면 |
| 지표 의미 충돌 | 기존 확정 추천률과 CITED 추천률의 분모/단위 차이 | metric ID/정의/버전/단위 명시. 구버전 결과 재계산/덮어쓰기 금지 |
| 개인정보·권한 | 원문/증빙/동의는 고객별, local-org 단일 조직, JSON에는 native FK 없음 | 서비스 소속 검증+역할별 projection. 전사 지식에 고객 원문 복제 금지, 목적·동의·기간 확인 |
| Industry Compliance | MEDICAL/LEGAL 승인·규정검토 경로가 있음 | Action link에도 동일 gate 적용. 과장/의료·법률 광고 적합성을 알고리즘으로 자동 인증하지 않음 |
| DEMO와 API | 유료 호출 guard, 무료 Gemini도 fail-closed. 모의 자료가 CLIENT 같은 구조를 쓸 수 있음 | 데이터 출처/실험 목적을 함께 검증. 스키마의 kind만으로 실제 성과라고 판정하지 않음. 실행 기능 자동 활성화 금지 |
| 잘못된 FACT | robots 허용/HTML 구조를 플랫폼 공식 추천 조건으로 오인 가능 | 검사 결과는 해당 페이지 OBSERVATION, 플랫폼 지식 FACT는 공식 근거+범위+검증일 필요 |
| 인과·선택 편향 | 현재 전후 비교는 단독 인과를 보증하지 않음 | attribution 제한, 교란/동시 Action/누락·실패 공개, 실제 고객 수 기준 집계 |
| 성능·동시성 | 전체 graph load/save와 전역 advisory lock | 새 도메인 repository 및 제한된 read model, 같은 transaction의 연결 작업, revision 검증 |
| UI/권한 결합 | 숫자 탭 범위가 신규 탭을 함께 렌더링할 수 있음 | 안정 view ID와 명시적 패널 선택, 배정 고객 유지·금지 API 요청 회귀 |

이번 보고서는 의료·법률 규정의 최신 법률 해석을 제공하지 않는다. 확인한 것은 현재 코드의 검토 gate와 신규 기능이 이를 유지해야 한다는 설계 요구다.

## I. 최종 판정

**2. 부분 Refactoring 필요.**

그대로 확장 가능하다고 보기 어려운 이유는 플랫폼 식별/지원 범위가 여러 문자열·enum·UI에 분산되어 있고, 모든 데이터 경로의 조건/반복/검증 수준이 같지 않기 때문이다. 전역 규칙/고객 준비도/실험/학습을 현재 전체 JSON graph writer에 단순 추가하면 버전·권한·집계 성능과 원자성을 관리하기 어렵다.

반면 구조 전체를 교체할 이유는 없다. 이미 프로젝트 소속 검증, 원문 불변 저장, 별도 검증 이력, frozen/hash Snapshot, 조건별 반복 비교, 실제 작업 버전·승인, 고객 동의, Pilot/계약 상속, 격리 복원 도구가 있다. 이 기반은 유지할 가치가 높다.

권장 착수 범위는 **8-0 보존 기준 확립 → 8-1 플랫폼/채널 식별 → 8-2 지식/규칙 버전 → 8-3 관측 context 확장**이다. 이후 준비도·Action·실험·통계로 진행한다. 이 보고서의 플랫폼 예시를 공식 FACT나 실제 점수로 seed하는 작업, Migration, 구현, 데이터 재작성은 아직 시작하지 않는다.

## 코드 근거 색인

아래 링크의 행 번호는 조사한 HEAD 기준이다. 하나의 긴 행에 함수 전체가 있는 파일은 해당 함수 시작 행을 가리킨다.

| 근거 | 확인한 파일/기능 |
|---|---|
| [S01] | package.json: manifest와 build/test/DB 스크립트 |
| [S02] | prisma/schema.prisma: 17개 모델/관계 |
| [S03] | db.ts: JSON↔도메인, 고정 QuestionSet, 원문 불변, 3종 Report 분류 |
| [S04] | store.ts: PostgreSQL/file 분기, 전체 graph mutate와 advisory lock |
| [S05] | types.ts: Entity/ResponseRecord/DataKind/ConsumerObservation/Study |
| [S06] | prescan.ts: Query Universe/30문항/3화면/계획/Snapshot |
| [S07] | query-templates.ts: 자동 질문 업종 지원 범위 |
| [S08] | consumer-config.ts: 3개 소비자 서비스 label/provider |
| [S09] | consumer-observation.ts: 입력 조건·반복·중복·증빙·CSV |
| [S10] | reporting-metrics.ts: 확정 gate, 지표 정의와 분모 |
| [S11] | visibility.ts: 유효 표본·추천·인용·순서 |
| [S12] | research-metrics.ts: 조건 경고와 반복 pair 비교 |
| [S13] | pilot-measurement.ts: 계획·Snapshot·freshness·전후 비교 |
| [S14] | pilot-types.ts: 협약/동의/작업/스냅샷/보고서/계약 |
| [S15] | pilot-common.ts: 역할·소속·동의·revision 관련 서비스 기반 |
| [S16] | audit.ts: 안전 전송·robots/HTML/구조화 데이터 검사 |
| [S17] | optimization.ts: 기존 작업 우선순위와 Gap/Task |
| [S18] | operations.ts: 온보딩·수정안·승인·실행 |
| [S19] | studio-workflow.ts: 기존 Task/Proposal 재사용과 페이지/사실/승인 버전 |
| [S20] | auth.ts: 역할·프로젝트 배정·정보 projection |
| [S21] | measurement-service.ts: ProviderAdapter 호출 gate 및 API 입력 |
| [S22] | sales-report.ts: frozen Snapshot/근거 변경/영업 보고서 |
| [S23] | client-report.ts: 확정 지표의 고객 보고서 |
| [S24] | cited-project.ts: CITED 진단을 기존 질문·원문에 연결 |
| [S25] | workspace.tsx: 고객 컨텍스트·3개 provider UI·숫자 탭/패널 분기 |
| [S26] | api/client-reports/route.ts: VIEWER와 승인 보고서 접근 |
| [S27] | api/pilot/route.ts: 관리 역할·project scope·expectedRevision |
| [S28] | scripts/test-cited-integration.mjs: 원본과 분리된 복원 DB/실행 폴더 |
| [S29] | tests/prescan.test.ts: 질문/슬롯/해시/원문/분리 회귀 사례 |
| [S30] | studio-facts.ts: 고객 사실의 검증/만료·출처·변경 이력 |

[S01]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/package.json:1>
[S02]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/prisma/schema.prisma:9>
[S03]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/db.ts:9>
[S04]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/store.ts:14>
[S05]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/types.ts:3>
[S06]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/prescan.ts:22>
[S07]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/query-templates.ts:1>
[S08]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/consumer-config.ts:2>
[S09]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/consumer-observation.ts:11>
[S10]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/reporting-metrics.ts:5>
[S11]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/visibility.ts:3>
[S12]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/research-metrics.ts:5>
[S13]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/pilot-measurement.ts:12>
[S14]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/pilot-types.ts:5>
[S15]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/pilot-common.ts:15>
[S16]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/audit.ts:85>
[S17]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/optimization.ts:9>
[S18]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/operations.ts:25>
[S19]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/studio-workflow.ts:37>
[S20]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/auth.ts:18>
[S21]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/measurement-service.ts:10>
[S22]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/sales-report.ts:20>
[S23]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/client-report.ts:19>
[S24]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/cited-project.ts:6>
[S25]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/components/workspace.tsx:18>
[S26]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/app/api/client-reports/route.ts:8>
[S27]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/app/api/pilot/route.ts:17>
[S28]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/scripts/test-cited-integration.mjs:1>
[S29]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/tests/prescan.test.ts:1>
[S30]: <C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/src/lib/studio-facts.ts:9>
