# Platform Intelligence 8-3 — Canonical Observation Context

## A. 구현 파일

| 신규 파일 | 역할 |
|---|---|
| `src/lib/platform-intelligence/observations/context.ts` | 입력/출력 schema, 순수 context 생성, 질문·조건 hash, context checksum·정합성 검증 |
| `observations/adapters.ts` | 기존 ResponseRecord/Consumer/Research/PreScan/Pilot/API/CITED를 읽는 순수 adapter |
| `observations/comparison.ts` | 조건별 비교 가능성·미상 경고 계약 |
| `observations/repository.ts` | versioned sidecar repository interface 및 메모리 테스트 저장 adapter |
| `tests/platform-observation.fixture.ts` | synthetic 입력/프로젝트 fixture |
| `tests/platform-observation.test.ts` | 신규 38개 테스트 |
| 이 보고서 | A–J 검증·보존·한계 보고 |

기존 8-0/8-1/8-2 파일을 수정하지 않고 별도 모듈을 추가했다. 기존 UI/Route/store writer/metric에서 자동 호출하지 않는다. 외부 API·크롤러·점수·KPI delta·학습 경로가 없다. 서버용 SHA256을 사용하며 향후 UI는 권한을 확인한 서버 projection으로 접근해야 한다.

## B. Observation Context Contract

버전:

- contextVersion: **observation-context-v1**
- conditionVersion: **observation-condition-v1**
- queryHashVersion: **query-text-utf8-exact-v1**
- registryVersion: **platform-registry-v1**

| 필드 | 의미 / 미상 처리 |
|---|---|
| projectId / responseId | 기존 소속/응답 식별자. 새 원본 ID를 만들지 않음 |
| platformCode / channelCode / providerCode | 8-1 resolvePlatformIdentity 결과. 미상은 null |
| observationMethod | 기존 DataKind 그대로. 미상은 null |
| modelName / modelDisplay / modelVersion / modelStatus | 기존 명칭과 명시된 supplemental version. 미상은 null/UNKNOWN |
| queryId / queryTextHash | 기존 questionId, 당시 실제 질문의 정확한 UTF-8 SHA256 |
| intent | 기존 질문의 읽는 시점 intent, CITED는 해당 snapshot query category. 조건 hash에는 미포함 |
| country / region / language | 명시된 관측 조건만 기록. 없으면 null |
| searchUsed | TRUE / FALSE / UNKNOWN |
| loggedIn | YES / NO / UNKNOWN. 개인 계정 식별자 없음 |
| personalizationState | ENABLED / DISABLED / UNKNOWN |
| freshConversation | TRUE / FALSE / UNKNOWN |
| studyId / phase / runNumber | 기존 study/BASELINE·FOLLOW_UP·UNASSIGNED/repetition. 근거 없으면 null |
| observedAt | 기존 관측 시각. 없으면 null |
| evidenceRefs | 프로젝트에 속한 EVIDENCE / SNAPSHOT / STUDY / PLAN / PRESCAN의 ID 참조 |
| sourceDomain | LEGACY / CONSUMER / RESEARCH / PRESCAN / PILOT / CITED / API |
| resolutionConfidence / resolutionSource / issues | 8-1 근거·충돌 결과와 제한된 원인 코드. raw 입력값을 issues에 넣지 않음 |
| status | COMPLETE / PARTIAL / UNRESOLVED / CONFLICT |
| conditionHash / checksum | 비교 조건 hash와 context 전체 integrity hash. 기존 Snapshot hash와 별개 |

COMPLETE는 비교 조건 필드와 queryId/intent/observedAt/runNumber가 알려진 metadata 상태다. 학습 표본·유효 보고서·근거 검증 완료·승인·실제 성과를 뜻하지 않는다. 독립적인 수동 관측에는 study가 없을 수 있으므로 study/phase/evidence 개수로 COMPLETE를 강제하지 않는다.

명확한 플랫폼이 있지만 조건이 빠졌으면 PARTIAL이다. OpenAI 공급사만 아는 경우 등 제품을 결정하지 못하면 UNRESOLVED다. 화면/공급사, 관측 방식, 프로젝트, 당시 질문, consumer 시각, study 조건 등이 충돌하면 CONFLICT다. 잘못된 입력 구조/개인정보 필드/깨진 참조는 생성 실패로 처리한다. 어느 경우에도 원본을 삭제·수정하지 않는다.

## C. Platform Mapping

| 원본 근거 | Platform / Channel / Provider | 방식 |
|---|---|---|
| consumer.screen=CHATGPT_WEB_SEARCH | CHATGPT / CHATGPT_WEB_SEARCH / OPENAI | 기존 kind 그대로 |
| consumer.screen=GEMINI_CONSUMER_SEARCH | GEMINI / GEMINI_CONSUMER_SEARCH / GOOGLE | 기존 kind 그대로 |
| consumer.screen=NAVER_AI_BRIEFING | NAVER_AI / NAVER_AI_BRIEFING / NAVER | 기존 kind 그대로 |
| provider=ChatGPT만 존재 | CHATGPT / null / OPENAI | 기존 kind 그대로 |
| provider=OpenAI만 존재 | null / null / OPENAI | API_OBSERVATION이어도 ChatGPT로 추정하지 않음 |
| provider=Gemini API Grounding | GEMINI / GEMINI_API_GROUNDING / GOOGLE | API_OBSERVATION, consumer 검색과 분리 |
| CITED ChatGPT/Gemini/Claude/Perplexity/Google AI | 대응하는 5개 Platform / null / 해당 Provider | MANUAL_OBSERVATION |
| DEMO + 명시적 consumer.screen | 해당 Platform/Channel | DEMO 유지 |

CITED의 Perplexity는 회사·제품 이름이 겹친다. 일반 ResponseRecord provider만 읽으면 공급사까지만 알 수 있다. 전용 CITED adapter는 snapshot의 platformName 문맥을 8-1 resolver에 전달하므로 제품 PERPLEXITY를 안전하게 결정한다. CITED 또는 제품 이름만으로 검색 채널이나 실제 검색 사용을 확정하지 않는다.

6개 Platform과 알려진 PLANNED 채널도 context로 표현할 수 있으나, 식별 가능함이 관측 UI/실제 adapter 지원을 의미하지 않는다. Google AI/Claude/Perplexity용 입력 UI를 추가하지 않았다.

## D. Condition Hash

질문 hash는 **전달된 원문을 그대로 UTF-8 SHA256** 한다. trim, 공백 압축, CRLF→LF, 대소문자 변환, Unicode NFC/NFD 변환을 하지 않는다. 빈 문자열과 null도 다르다. 원문을 context에 저장하지 않고 hash만 둔다.

질문 읽기 우선순위는 consumer.actualQuestion → measurement.questionText → ResponseRecord.questionText다. 존재하는 후보가 서로 다르면 CONFLICT다. 당시 질문이 없으면 현재 수정된 Question.text를 과거 질문으로 보충하지 않고 queryTextHash=null이다. CITED는 검증된 snapshot의 생성 질문을 사용한다.

조건 canonical JSON에는 다음을 포함한다.

```text
version, registryVersion, queryHashVersion
platformCode, channelCode, providerCode, observationMethod
modelName, modelVersion, modelStatus
country, region, language
searchUsed, loggedIn, personalizationState, freshConversation
queryTextHash
```

객체 key는 정렬하고 null/UNKNOWN은 명시적으로 포함한다. country/region/language 문자열은 임의로 KR/대한민국/서울/SEOUL 등으로 통합하지 않는다. 다른 표기는 자동 동등 취급하지 않는 보수적인 정책이다.

**제외:** rawText와 원문 전체, observedAt, projectId/responseId/queryId, studyId/phase/runNumber, intent, modelDisplay, evidenceRefs, sourceDomain, completeness/issues. 관측 시각과 반복은 별도 기록이고 조건 identity가 아니다. 동일 조건의 서로 다른 반복은 같은 conditionHash를 가져도 별개 responseId/context로 보존한다. queryId가 달라도 실제 질문이 같은지 hash로 판단할 수 있다. project 간 비교는 별도 gate로 차단한다.

context 전체 checksum은 위 제외 metadata까지 포함하므로 반복·시각·참조·metadata 변경에 따라 달라진다. query/condition/context checksum은 기존 raw input hash, PreScan/Pilot/CITED/Report hash를 갱신하지 않는다.

## E. Comparison Contract

정책 버전 **observation-comparison-v1**. compareObservationContexts는 integrity/버전/identity를 먼저 검증하고 다음을 반환한다.

- COMPARABLE: 비교 조건이 명시적으로 같고 미상 경고가 없음.
- COMPARABLE_WITH_WARNINGS: 명확한 불일치는 없지만 model/version, locale, login, search, personalization, freshConversation 등의 미상 조건이 있음. 독립성 부족/반복 미상/서로 다른 원 도메인도 경고.
- NOT_COMPARABLE: 다른 project/platform/channel/method/model/명시 locale·search·login·personalization·freshConversation·질문 hash, 충돌 context, 제품 미해석 또는 platform/channel/method/질문 hash 미상.

한쪽만 모델/지역을 아는 경우도 차이가 확인됐다고 단정하지 않고 UNKNOWN 경고로 남긴다. 둘 다 알려진 지역이 다르면 비교 불가다. 둘 다 같은 UNKNOWN이라고 해서 완전한 동일 조건으로 승인하지 않는다. 동일 responseId끼리의 비교는 독립 반복이 아니라는 경고를 준다.

이 helper는 기존 compareStudy/pilotComparison과 연결하지 않았고 결과를 재계산하지 않는다. COMPARABLE도 효과·인과·통계 유의성을 뜻하지 않는다. DEMO와 실제 Consumer/API는 method 차이로 비교가 차단된다. 집계·Learning dataset 생성은 없다.

## F. Existing Integration

### Consumer / Research / PreScan / Pilot

`buildResponseObservationContext(project,responseId,supplements?)`는 전달된 프로젝트 안의 response와 question을 확인한다. consumer.projectId/method/answerRecordedAt/actualQuestion 및 study kind·반복 상한·phase·고정 조건이 맞는지 검사한다. consumer.evidenceIds가 소속 프로젝트의 evidenceFiles에 없으면 거부한다.

기존 consumer.repetition을 runNumber로 그대로 읽는다. study가 있으면 RESEARCH, 해당 study의 scan이 있으면 PRESCAN, plan이 있으면 PILOT을 sourceDomain으로 기록하고 관련 ID를 evidenceRefs에 추가한다. 원래 study/phase를 다른 enum으로 바꾸지 않는다. Pilot의 baseline이 과거 PreScan 응답을 참조하는 경우 원본은 여전히 PreScan study 소속이며, 이를 새 Pilot study 관측으로 치환하지 않는다.

### API

measurement가 있으면 해당 query와 명시된 searchUsed를 읽는다. SUCCEEDED가 아닌 미완결/실패 결과의 boolean 기본값은 검색 수행 증거로 확정하지 않고 UNKNOWN으로 둔다. apiResponseId/requestId/rawOutput/API key를 context에 복사하지 않는다. 기존 adapter/flag를 실행하거나 활성화하지 않는다.

### CITED

`buildCitedObservationContext(project,snapshotId,responseId,supplements?)`는 프로젝트 snapshot의 responseIds에 포함된 MANUAL_OBSERVATION인지 확인한다. 기존 방식인 `SHA256(JSON.stringify(snapshot.data))`로 digest를 **비교만** 한다. stored digest/payload는 바꾸지 않는다. 당시 snapshot 질문·platform·model·rawText·observedAt의 단일 연결을 확인한 뒤 플랫폼 문맥을 해석한다. 기존 16자리 로컬 시각은 기존 attachDiagnosis와 같은 +09:00 규칙으로 비교하며 새 추정 규칙을 추가하지 않는다.

스냅샷 ID를 명시적으로 받으므로 여러 snapshot에 연결된 응답을 최신 snapshot으로 임의 귀속시키지 않는다. 일반 ResponseRecord adapter는 CITED 전용 문맥을 자동 탐색하지 않는다.

### 미상 조건 / 개인정보

기존 모델 문자열이 유효하게 기록돼 있으면 그 이름을 읽는다. 미표시/미상/unknown/auto 등은 UNKNOWN이다. 이름에서 모델 버전을 추출하거나 최신 모델을 채우지 않는다. modelDisplay와 modelVersion은 별개다.

login/personalization/freshConversation/language/modelVersion은 명시적인 supplements로만 추가할 수 있다. 과거 미상 데이터를 자동 backfill하지 않는다. supplements는 실제 관측 근거를 가진 호출자가 제공해야 하며, 나중에 알게 된 현재 계정 상태를 과거 사실처럼 넣으면 안 된다.

원본 rawText/질문 원문/observer/개인 계정 ID/쿠키/세션 토큰/정확한 GPS/API key/실제 citation URL을 context에 복사하지 않는다. 입력 schema는 해당 필드들을 허용하지 않고, 저장되는 텍스트에는 이메일·국내 휴대전화·좌표쌍의 명시 패턴을 거부한다. 이는 범용 개인정보 탐지기가 아니므로 향후 입력 경계에서도 관측 조건만 허용해야 한다. GPS나 사용자 기기 위치를 자동 취득하는 경로가 없다.

## G. Persistence

**runtime context + repository contract + in-memory test adapter**다. Prisma schema/Migration/신규 영구 테이블/Project.operations 저장은 없다.

ObservationPlatformContextRepository는 projectId+responseId 아래 append-only revision을 둔다. get/getVersion/listVersions/append를 제공하고 expectedRevision, actorId/createdAt/reason, 이전 checksum, context checksum을 기록한다. stale revision·감사 시각 역행·변조된 context를 거부한다. 같은 조건의 다른 responseId는 별개의 첫 revision으로 남는다.

테스트 adapter에 주입하는 신뢰 가능한 ObservationReferenceGuard가 actor 프로젝트 접근권, 응답과 queryId의 연결, question 소속, evidence/study/plan/snapshot 참조 소속을 검증한다. 클라이언트가 보내는 projectId나 actorId 자체를 권한으로 신뢰하지 않는다. 최종 adapter 계약에서는 ownsResponse에 queryId도 전달해 같은 프로젝트의 무관한 질문으로 바꿔 연결하는 것을 차단할 수 있게 했다.

이 adapter는 프로세스 종료 후 유지되는 영구 저장소가 아니다. 실제 DB persistence가 필요한 운영 단계에서는 migration baseline 해결, FK/unique(project,response,revision), 소속·삭제 정책·트랜잭션·감사를 별도 설계해야 한다. 8-4의 제한된 runtime projection 구현에 새 DB가 필수인 blocker는 없다.

## H. Preservation

증거 디렉터리: `output/stage7-5/platform-8-3-29058c61-f1c2-4227-a54d-75e31b4caf09`. Git에서 제외된 보호 디렉터리다. 기존 8-0/8-1/8-2 pointer와 증거를 유지한다.

시작 시 tracked/untracked 기존 파일 해시 및 원본 DB를 읽기 전용으로 기록하고, 통합 백업을 별도 aeo_restore_test_* DB에 복원해 전체 회귀를 실행한다. 원본에 없는 도메인은 EMPTY_IN_SOURCE, synthetic 비어 있지 않은 Snapshot/Report/첨부 등은 기존 rich preservation 테스트로 검증한다.

최종 재검증 후 `final-complete-proof.json`:

- 원본 전체 data hash 전/후 동일: `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96`.
- schema hash 동일: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`. 실제 DDL/컬럼/인덱스/제약도 동일.
- 20개 도메인 비교 모두 equal=true. 원본에 없는 도메인을 실제 고객 실증으로 주장하지 않는다.
- 작업 전 존재한 tracked/untracked 파일 중 변경 **0개**. 기존 workspace.tsx의 미커밋 8-0 수정과 8-1/8-2 모듈·테스트·보고서도 그대로 보존했다.
- Prisma schema SHA256 동일: `5a4f0156617b662fddcc40507f1cc5fc33a3af26eeb0e205ac2094e4c3af7ba7`.
- 최종 source와 격리 runtime의 신규 코드/fixture/테스트 6개 파일 hash 일치.
- 원본 StaffSession/AccessEvent도 예외 없이 비교했다. 원본 전체 data hash는 8-0/8-1/8-2 보존 증거와도 같다.

백업→격리 복원 결과도 data/schema/IDs/관계/files 모두 일치했다. 원본 첨부 referenceCount/fileCount는 0이며, 비어 있지 않은 첨부/문서/보고서/Snapshot은 LOCAL MOCK rich preservation 테스트에서 따로 검증했다. 원본 데이터 UPDATE, raw/enum 치환, Snapshot/Report 재생성, 기존 hash/metric/Route/Prisma 변경은 없다.

## I. Tests

신규 synthetic/기존 fixture 테스트 **38개 통과**: 정확한 screen, Gemini API/Consumer, OpenAI provider-only, 미상 모델/지역/로그인, 충돌, exact query hash, condition 필드 변경, 반복·시각 분리, CITED 5개 플랫폼, DEMO, 비교 gate, 개인정보 필드 거부, scoped append-only 저장, 원본 불변 포함. 신규 테스트는 실제 플랫폼 서비스에 요청하지 않는다.

격리 runtime의 전체 단위·PostgreSQL·PDF·rich preservation 테스트 **31개 파일, 244/244 통과**. 8-2까지의 206개를 포함한다. Next production build와 `tsc --noEmit`도 통과했다. 기존 동적 파일 추적 build 경고 3개가 유지된다.

최종 guard 계약 보강 후 격리 runtime에 동기화하여 **전체 244개 재통과**, production build 재통과, 타입 검사 재통과했다. 다른 플랫폼 및 명시된 지역 차이의 비교 불가 검증을 포함한 최종 신규 38개 테스트도 통과했다. 마지막 모든 코드/테스트 파일을 runtime과 hash 비교했다.

전체 E2E: **15 통과 / 1 실패**. 실패는 기존 `tests/e2e/pilot.spec.ts:50:532`의 390px 모바일 scrollWidth 검사이며 이전 단계와 같은 위치다. PreScan→Snapshot→PDF·승인/다운로드, Consumer, CITED, Reporting, Backup/Restore 권한, Studio, workspace 경계 검사가 통과했다. E2E 후 보강된 부분은 신규 sidecar의 응답–질문 참조 guard와 테스트이며 기존 UI/Route는 변경되지 않았다. 해당 최종 계약은 위 전체 단위 재검증 및 build/typecheck로 확인했고 E2E를 추가 반복하지 않았다.

유지되는 기존 WARN:

1. 전체 migration 이력 부재. 이번 단계 schema/Migration/table 추가 없음.
2. Pilot 모바일 overflow. 재현됐으며 해당 화면/기대값을 수정하지 않음.
3. Studio 배열 순서 민감성. 이번 실행 통과지만 이전 반복 재현 경고가 해결됐다고 판단하지 않음.
4. 기존 build 동적 파일 추적 경고 3개.

**신규 FAIL은 발견되지 않았다. 전체 E2E green 상태는 아니다.** 초기 통합 runner exit 1은 기존 Pilot 실패를 그대로 반환한 결과다. 최종 코드 재검증 runner는 exit 0이다. `git diff --check`도 통과했다.

file-mode 전용 E2E는 이번 단계 별도로 재실행하지 않았다. 신규 모듈은 기존 storage/UI에서 import되지 않으며 이전 file-mode 보존 결과와 이번 순수 계약 검증을 근거로 제한한다. 실제 외부 플랫폼, 실제 고객 추가 관측, 영구 persistence, 실제 Readiness/성과를 검증했다고 주장하지 않는다.

## J. 8-4 준비 판정

**READY_WITH_WARNINGS**

8-4가 읽을 canonical observation metadata, 재현 가능한 버전·조건 hash, scoped sidecar 저장 계약과 비교 gate를 준비했다. 기존 DB·raw·hash·코드를 보존했고 신규 회귀는 발견되지 않았다. 위 기존 경고와 runtime-only persistence 한계를 유지하는 조건에서 다음 제한된 단계로 진행할 수 있다.

이 판정은 공개 배포·DB schema 변경·API 활성화 승인이 아니다. Readiness/Score/Action 효과/Experiment delta/Learning은 이번 단계에 없다.
