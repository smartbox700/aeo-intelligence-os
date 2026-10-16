# Platform Intelligence 8-6 — Before / Action / After Experiment Engine

검증일: 2026-10-15. 최종 판정: **READY_WITH_WARNINGS**.

## A. 구현 파일

- `src/lib/platform-intelligence/experiments/contracts.ts`: 엄격한 실험·지표·스냅샷 참조 계약, 버전 및 checksum.
- `src/lib/platform-intelligence/experiments/snapshots.ts`: 명시적 시각의 검증 관측 manifest, 기존 Pilot 스냅샷 참조 및 원본 변경 검사.
- `src/lib/platform-intelligence/experiments/metrics.ts`: 기존 verified-observation 지표 정의·카운터 adapter.
- `src/lib/platform-intelligence/experiments/engine.ts`: 적용 적격성, 반복 대응, 비교, 변화량, 귀속 제한, 재현 가능한 결과.
- `src/lib/platform-intelligence/experiments/repository.ts`: ExperimentRepository / ExperimentResultRepository 및 append-only 메모리 adapter.
- `src/lib/platform-intelligence/experiments/index.ts`: 모듈 진입점.
- `tests/platform-experiment.fixture.ts`, `tests/platform-experiments.test.ts`: 합성 입력, 경계·보존·기존 지표 일치 검사.

기존 소스 파일·HTTP route·UI·Prisma·migration은 수정하지 않는다. 기존 데이터에 실험을 자동 등록하지 않는다. Production Knowledge/Rule/Action 및 운영 실험은 0개 상태다.

## B. Experiment Contract

안정적인 experimentId와 양의 version을 분리한다. project/platform/channel/environment, issueRef, Readiness 평가 및 Rule 항목, Before/After 참조, Action 실행 배열, QuerySet/MeasurementPlan 참조, 지표 namespace/ID/version, 관측 window, 교란요인 및 기존 Consent 참조를 갖는다. 생성자·생성시각·사유·contractVersion과 canonical JSON SHA256을 포함해 동결한다.

정의는 DRAFT/RETIRED만 사용한다. 각 결과는 RESULT_AVAILABLE/NOT_COMPARABLE 상태를 별도로 가진다. 단순히 Task가 끝났다는 이유로 정의나 결과를 생성하지 않는다. 직원이 검토한 명세로 명시적으로 저장소를 호출해야 한다.

Action 배열은 executionId, 연결 revision/checksum, actionId/version/checksum, PRIMARY/CO_INTERVENTION/CONFOUNDER 역할을 고정한다. 하나 이상의 PRIMARY를 요구하되 인과관계의 근거로 사용하지 않는다. 동일 실행의 중복 참조를 거부한다. 후속 정의·결과는 새 버전으로 추가하며 이전 버전을 덮어쓰지 않는다. 같은 실험의 D7/D30 등 추가 window는 후속 정의·결과 버전으로 확장할 수 있다.

## C. Before / After Eligibility

MeasurementSnapshotReference는 sourceType/sourceId/sourceHash/projectId/kind/conditionHash/metricVersion/frozenAt/checksum을 갖는다. 실제 응답 원문은 복제하지 않는다. 관측 ID·원본 fingerprint, canonical context, 제외 사유만 보존한다.

VERIFIED_OBSERVATION_SET은 검토한 질문 세트·Study/phase·시간 범위의 모든 관측을 ID 순으로 고정한다. 유리한 response ID만 전달하는 인터페이스는 없다. 질문 소속·중복, Study 소속, explicit frozenAt 및 범위를 검사한다. rawObservationCount는 이 선언 범위의 관측 수이며 전체 프로젝트나 고객 수가 아니다.

검증 관측의 기존 요구사항을 유지한다: 원문/실제 질문/플랫폼/모델/지역/시각, VERIFIED와 검증자·출처 대조·검토 기록, READY 업체 식별, 기존 visibility exclusion 통과. INTERNAL, 부정확 판정, 미검증, DEMO, 검증 시각보다 뒤의 관측을 제외한다. 검증 시각도 명시된 evidenceAsOf를 넘을 수 없다. 기존 confirmedExclusion의 Date.now 의존을 실험에 가져오지 않고 이 적격성 adapter에서 explicit 시각을 사용한다. 기존 지표 정의나 기존 함수는 수정하지 않는다.

Before window의 끝은 **모든 연결 Action 적용 시각보다 엄격히 이전**, After window의 시작은 **모든 적용 시각보다 엄격히 이후**여야 한다. 동일 시각은 허용하지 않는다. 실제 관측이 window 안에 있고, 참조 스냅샷의 범위가 실험과 정확히 같은지도 검사한다. 생성·검증·적용 및 evidenceAsOf 역전은 거부한다.

기존 PILOT_MEASUREMENT를 참조할 때 project/client, phase, plan/study, 원본 SHA256·fingerprint·계산 버전을 기존 pilotSnapshotFresh로 검사한다. PRESCAN에서 가져온 Pilot baseline도 해당 계획의 고정 manifest를 통해 참조한다. 기존 Snapshot이나 그 안의 metrics를 다시 계산·저장하지 않는다. 현재 응답이 바뀌면 참조가 무효화된다.

직접 PreScanSnapshot은 원문 fingerprint가 충분하지 않은 구형 구조까지 자동 승격하지 않는다. CITED 연결 응답도 별도 검증 snapshot adapter가 없으므로 자동 승격하지 않는다. 이 두 직접 경로는 v1에서 미지원이며, 검증된 관측 manifest 또는 fingerprint가 있는 Pilot 경로를 사용한다. API 응답에는 기존 canonical adapter가 반복 번호를 제공하지 않으므로 명확한 run metadata 없이 자동 pairing하지 않는다.

## D. Action Eligibility

신뢰할 수 있는 기존 8-5 ActionExecutionView에서 CURRENT이고 actualAppliedAt 및 proofRefs가 존재해야 한다. project/environment, 연결 revision/checksum, 정의의 정확한 승인 버전/checksum, platform/channel/industry, Readiness 평가 checksum·Rule 항목, 적용 전 정의 승인·유효 시각을 검사한다. 다른 프로젝트 증빙과 Task 누락을 거부한다.

Production은 PRODUCTION 정의·연결·스냅샷만 허용한다. DEMO Studio 검증/페이지/운영 유형, SYNTHETIC, SOURCE_CHANGED/MISSING, 적용 시각 null은 실제 비교에 사용할 수 없다. plannedAt, Task/Pilot 완료 시각은 대체하지 않는다. 실제 업무 승인·규정·증빙 Source of Truth는 8-5 저장소와 기존 도메인이다.

engine 및 loadSources는 내부 서비스 계약이다. CURRENT 플래그나 소스 객체를 클라이언트 JSON에서 신뢰하면 안 되며, 향후 route에서는 인증된 직원과 기존 ActionExecutionLinkRepository의 현재 projection을 사용해야 한다. 현재 새 route는 없다. 테스트의 PRODUCTION 입력은 이 계약을 검사하는 합성 test double이며 실제 운영 seed나 실제 성과가 아니다. 기존 Studio 승인·적용 경로 자체는 보존된 8-5 테스트에서 계속 검사한다.

나중에 Action v2가 생겨도 고정된 v1의 정의·checksum은 바꾸지 않는다. 다만 실행 연결 자체의 revision이나 원본 정합성이 달라지면 과거 결과는 STALE이 된다.

## E. Pairing

`exact-query-run-condition-v1`은 **정확한 UTF-8 queryTextHash + runNumber**로 대응한다. 같은 questionId여도 실제 질문이 달라지면 대응하지 않는다. 반복 번호가 없는 응답, 한 그룹에 여러 후보가 있는 모호한 반복, 중복 ID/동일 관측 내용은 제외한다. 좋은 결과나 가까운 시각을 임의로 고르지 않는다.

각 유일한 대응 쌍에는 8-3 **compareObservationContexts**를 반드시 사용한다. platform/channel/method/query/model/locale/search/login/personalization/freshConversation 조건을 기존 정책으로 검사한다. 비교가 불가능한 대응은 사유와 함께 제외하며 실험 delta는 null이다. 서로 다른 method가 포함된 범위도 합산하지 않는다. 질문이 달라 대응되지 않은 반복은 8-3의 진단 사유도 남긴다.

명백한 질문·반복 대응이 없는 관측은 UNPAIRED_RUN, 모호한 후보는 AMBIGUOUS_RUN으로 기록한다. 남은 유효한 대응 쌍의 계산은 가능하나 제외 표본 경고를 보존해 귀속을 제한한다. 조건 불일치가 있는 경우 유리한 다른 쌍만으로 전체 결과를 통과시키지 않는다.

rawObservationCount, 적격성 gate 이후 eligibleObservationCount, 실제 대응 수 pairedN, 제외된 개별 관측 수 excludedN을 분리한다. pairedN은 쌍 수이며 관측 수는 2×pairedN이다. eligible은 pairing 이전 수이므로 excludedN과 단순히 더하는 값이 아니다. 미대응·부적격 ID와 사유는 결과에 남긴다.

## F. Metric / Delta

지표 namespace는 `confirmedMetrics`, 버전은 기존 **verified-observation-v1**이다. 기존 visibilityMetrics의 카운터와 confirmedMetrics의 정의 문구를 재사용한다. 빈 표본의 기존 정의 조회는 Date.now를 호출하지 않는다. 실제 표본의 적격성은 C의 explicit 시각 adapter가 먼저 확인한다. 테스트에서는 동일 표본의 기존 confirmedMetrics 결과와 분자·분모·값·정의가 일치하는지도 검사한다.

| v1 지원 Metric ID | 분자 / 분모 | 저장 단위 |
| --- | --- | --- |
| Brand Mention Rate | 확정 고객 언급 응답 / 검증된 유효 응답 | 비율 차이 + %p 표시값 |
| Recommendation Inclusion Rate | 확정 고객 추천 후보 응답 / 검증된 문맥 분석 완료 응답 | 비율 차이 + %p 표시값 |
| Official Citation Rate | 자사 공식 호스트 인용 응답 / 검증된 유효 응답 | 비율 차이 + %p 표시값 |
| clientCount / recommendations / citations | 기존 동일 이름의 카운터, denominator=null | 절대 개수 차이 |

CITED 지표와 다른 버전/namespace를 합치지 않는다. Query Coverage와 First Mention Rate는 기존 정의를 수정하지 않고 이번 adapter의 지원 목록에서 제외했다. 임의의 새 Metric을 동일 이름으로 받아들이지 않는다.

비율 before/after 값은 0~1이며 delta는 after-before다. 예를 들어 0.12→0.19면 delta=0.07, displayDelta=7, unit=PERCENTAGE_POINTS로 +7%p를 표시한다. count는 delta와 displayDelta 모두 개수 차이다. before/after의 분자·분모도 함께 보존한다. 양수·0·음수 결과를 같은 절차로 저장한다. 표본이 없으면 0%로 바꾸지 않는다.

## G. Attribution

변화량과 귀속 판단을 분리한다. 비교 가능하고 경고·기록된 교란요인이 없으면 OBSERVED_AFTER_ACTION을 사용할 수 있다. 이는 관측된 전후 차이를 기록한다는 뜻이며 효과·원인·알고리즘 개선을 증명하지 않는다. 정상 결과의 문구에도 인과관계가 아니라는 설명을 고정했다.

경고, 미대응/제외 표본, 단일 쌍 이하, 복수 Action, 교란요인, 지표 계산 불가 상황에서는 INSUFFICIENT_EVIDENCE다. 수치 delta가 양수여도 이 제한을 유지한다. 두 쌍을 과학적 최소 표본이나 유의성 기준으로 주장하지 않는다. 단일 쌍에 대한 보수적인 설명 경고일 뿐이며 두 쌍 이상도 confidence=DESCRIPTIVE_ONLY다.

CORRELATED 자동 승격은 구현하지 않는다. p-value, 통계 신뢰구간, 인과 추론, 성공률, 추천 확률, ROI는 계산하지 않는다. 좋은 결과로 Action의 NO_EFFECT_CLAIM이나 과거 Readiness Score를 바꾸지 않는다.

## H. Confounders

MODEL_CHANGED, CHANNEL_CHANGED, QUERY_CHANGED, COMPETITOR_CHANGED, WEBSITE_MAJOR_CHANGE, SEASONALITY, EXTERNAL_MEDIA_EXPOSURE, PAID_CAMPAIGN, UNKNOWN_EXTERNAL_CHANGE, MULTIPLE_ACTIONS를 명시적으로 기록할 수 있다. 여러 실행을 연결하면 MULTIPLE_ACTIONS를 자동 추가한다. 알려진 조건 변경은 비교 gate에서도 처리한다. 기록되지 않은 외부 요인이 없다고 보증하지 않는다.

실험 window에는 beforeFrom/To, 각 실행의 실제 적용 시각, afterFrom/To, 마지막 적용부터 After 끝까지의 daysAfterAction을 기록한다. 1시간 후와 30일 후 관측은 별도 window/버전으로 구별한다.

## I. Persistence

runtime contract + 메모리 저장소이며 재시작 후 유지되지 않는다. 정의 버전과 결과 버전은 append-only다. optimistic expectedRevision, 직원·시각·사유 감사 기록, 이전 결과 checksum으로 충돌·이력을 관리한다. OWNER/MANAGER가 명시적으로 정의·결과를 저장한다. ANALYST는 소속 프로젝트 조회·계산 검토가 가능하며 VIEWER/disabled 직원은 실행 관리에서 제외한다. 기존 assertProjectAccess와 저장소 project guard를 함께 사용한다.

sourceHash는 Before/After 참조·원본 fingerprint, Action 실행·정의 checksum, Readiness/Rule 참조, 지표 정의 버전, comparison/pairing/attribution 정책, 명세 checksum 및 evidenceAsOf를 묶는다. 현재 소스로 재현해 원본 변화·삭제·실행 무효화를 감지하면 STALE, currentDelta=null을 반환한다. 저장된 과거 수치와 checksum은 그대로 보존한다. 새 자료를 검토한 뒤 새 명세·결과 버전으로 추가해야 한다.

Consent는 project/agreement/consent ID 참조만 갖는다. researchEligibility를 영구 truth로 저장하지 않는다. 향후 학습 사용 때 그 시점의 기존 Consent 결정을 별도로 검사해야 한다. 고객 간 집계는 구현하지 않았다.

## J. Preservation

작업 전 원본 DB를 REPEATABLE READ READ ONLY로 검사하고, 작업 전부터 있던 모든 소스 파일의 SHA256을 기록했다. 전체 회귀 검사는 암호화 통합 백업을 복원한 별도 테스트 DB·별도 첨부 root에서만 실행한다. 원본 DB/schema/raw/snapshot/report/metric/Task/Proposal/Studio/Pilot/Action 및 기존 파일의 전후 동일성을 최종 검사한다.

새 엔진도 계산 전후 프로젝트·Readiness·Action 정의·승인 이력 hash가 같다는 테스트를 통과했다. 기존 Pilot snapshot 자체도 adapter 호출 전후 동일하다. LIVE_AI_ENABLED/FREE_GEMINI_ENABLED=false로 검증하며 외부 AI 호출·자동 크롤링·게시·CMS/플랫폼 계정 조작은 하지 않는다. Git commit/push는 수행하지 않는다.

보호된 검증 증거는 gitignored `output/stage7-5/platform-8-6-current.json` 포인터의 디렉터리에 남긴다. 고객 원문·첨부·접속 비밀은 보고서나 Git에 복사하지 않는다.

최종 확인 결과:

- 작업 전부터 존재한 **270개 파일 SHA256 모두 동일**. 이전 workspace.tsx 수정 및 8-1~8-5 구현·보고서도 그대로 보존했다.
- 원본 DB **20개 도메인 비교 모두 동일**, DDL/schema 동일. 원본에 데이터가 없는 영역은 기존 rich-preservation 합성 통합 백업·복원 테스트로 보완했다.
- 신규 소스 6개와 fixture/test 2개는 실제 검증 runtime의 파일과 SHA256이 모두 일치한다.
- 원본 데이터 hash: `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96`.
- 원본 schema hash: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`.
- 증거 파일: `source-before.json`, `files-before.json`, `final-preservation.json`, `final-complete-proof.json`, 테스트·빌드·E2E 로그.

검증용 복원 DB·첨부 root 및 보호된 산출물은 검토 증거로 남겼다. 원본 DB에는 검증 데이터를 넣지 않았다.

## K. Tests

| 검사 | 결과 |
| --- | --- |
| 신규 Experiment 테스트 | **36/36 PASS** |
| DB·PDF·보존 통합 포함 전체 테스트 | **340/340 PASS**, 34개 파일 |
| Next production build | PASS, 기존 filesystem tracing warning 3개 |
| TypeScript --noEmit | PASS |
| 기존 전체 E2E | **15 PASS / 1 기존 WARN** |
| 원본 DB·DDL·20개 도메인·270개 기존 파일 | 변경 없음 |
| 검증 소스와 현재 신규 소스·테스트 8개 | 모두 일치 |
| git diff --check | PASS, 기존 workspace.tsx 줄바꿈 안내만 존재 |

신규 검사는 유효한 production 계약의 합성 입력, Before/After 엄격한 시각 경계, null/변경/누락 Action, DEMO·환경·project·증빙·정의 pin, 플랫폼/채널/API/질문/모델/지역/검색 차이, 반복 대응·중복·미대응, 양수/0/음수 및 count 단위, 기존 지표 분모·정의 일치, 경고·복수 Action·교란요인의 귀속 제한, 원본 변경·추가·삭제 감지 계약, 결과 이력·퇴역·권한 및 보존을 포함한다. Date.now를 예외로 바꾼 상태에서도 계산이 동일 checksum으로 재현되는지 검사했다.

개별 개발 검사에서 발견한 지표 비교 fixture의 시각 설정, 잘못된 테스트 채널 이름, 제외된 API 표본이 섞인 범위의 엄격한 method 차단, 테스트의 동결 객체 접근 문제를 수정했다. 전체 검증은 해당 수정 이후 최종 소스에서 실행했다.

E2E의 유일한 실패는 이전 단계와 동일한 `tests/e2e/pilot.spec.ts:50:532`의 390px 화면 overflow다. Studio 흐름은 이번 E2E에서 통과했지만 기존 배열 순서 민감성 경고가 해소됐다고 판단하지 않는다. 무관한 화면이나 기존 테스트는 수정하지 않았다.

## L. 8-7 판정

**READY_WITH_WARNINGS**. 같은 조건의 Before·실제 적용 Action·After 및 사용된 버전·증빙·표본·제외 사유를 재현하는 계약을 확보했다. 수치 변화와 귀속 제한을 분리하며 음수·0 변화도 동등하게 보존한다. 운영 Knowledge/Rule/Action 및 실험이 0개이므로 실제 고객 성과나 운영 Insight를 만들어내지 않는다. 내부 서비스 계약만 추가했으며 공개 고객 UI, 자동 실험 생성, 영구 테이블은 없다.

8-7은 CURRENT인 결과와 실제 PRODUCTION 적격성, 현재 Consent, 비교 경고·미대응·교란요인 및 지표 namespace/version을 다시 검사해야 한다. SYNTHETIC/DEMO, STALE, null delta, NOT_COMPARABLE, INSUFFICIENT_EVIDENCE를 실제 Action 효과의 증거로 자동 승격하면 안 된다. 한 실험의 양수 변화로 효과 주장 상태를 자동 변경할 수 없다.

기존 migration history 부재, Pilot 모바일 overflow, Studio 배열 순서 민감성, build warning, runtime-only persistence, 운영 정의 0개 경고를 유지한다. 무관한 문제는 이 단계 통과를 위해 수정하지 않는다. 직접 PreScan/CITED adapter, API 반복 metadata, 더 많은 Metric adapter, 영구 저장과 운영 UI 연결은 명시적인 후속 범위다.
