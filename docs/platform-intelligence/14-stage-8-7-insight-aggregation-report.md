# Platform Intelligence 8-7 — Insight Aggregation & Learning Engine v1

검증일: 2026-10-15. 최종 판정: **READY_WITH_WARNINGS**.

## A. 구현 파일

- `src/lib/platform-intelligence/insights/contracts.ts`: Cohort·승인 정책·버전·checksum, OWNER 목적 검사, 빈 Production catalog.
- `insights/consent.ts`: 기존 Pilot/Agreement의 현재 목적별 Consent와 증빙·소속·유효기간 검사.
- `insights/sources.ts`: 신뢰할 수 있는 기존 Experiment/Result/Action/Readiness 저장소를 읽는 adapter.
- `insights/engine.ts`: candidate 전수 열거, 현재 품질 gate, 프로젝트·고객 독립성, 분포·제외 통계, sourceHash.
- `insights/projection.ts`: 식별자·원문 없는 집계 projection, 소표본 suppression, 관찰 문구 및 AGGREGATED_OBSERVATION 계약.
- `insights/repository.ts`: InsightAggregationRepository와 append-only 메모리 adapter.
- `insights/index.ts`: 모듈 진입점.
- `tests/platform-insight.fixture.ts`, `tests/platform-insights.test.ts`: 여러 합성 프로젝트와 실제 8-6 계산 결과를 이용한 집계·권한·보존 검사.

기존 소스·UI·route·Prisma/schema/migration/table을 변경하지 않는다. 데이터베이스에 Insight를 seed하지 않는다. 외부 AI 호출·자동 크롤링·고객 시스템 수정은 없다.

## B. Cohort Contract

`insight-cohort-v1`은 industry, canonical platform/channel, **정확한 actionId/version**, Metric namespace/ID/version/unit, 명시적 min/maxDaysAfterAction, environment를 고정한다. country/language/regionGroup/subIndustry/issueType/ruleId filter를 선택할 수 있다. 단일 Action, OBSERVED_AFTER_ACTION, 비교 경고 없음은 v1의 보수적인 고정 조건이다. 같은 명세는 canonical JSON SHA256이 같고 조건 변경은 다른 Cohort가 된다.

MEDICAL/LEGAL/COMMERCE/BRAND enum을 그대로 쓴다. 아직 실제 저장소가 없는 subIndustry와 regionGroup은 요청하면 UNKNOWN에 해당하는 제외 사유를 남긴다. DENTAL 등 값을 임의로 추정·seed하지 않는다. country/language/issueType은 소속과 checksum이 확인된 Readiness scope/item에서 읽으며, 없는 값을 프로젝트 이름·기기 위치·추측으로 채우지 않는다.

Action 전체 버전 자동 통합은 지원하지 않는다. ChatGPT와 Gemini, Google AI와 Gemini, Gemini Consumer와 API, 다른 Metric namespace/version/unit을 섞지 않는다. After window의 시작과 끝 모두 Action 이후 지정된 날짜 범위 안에 있어야 하므로 D7과 D90을 끝 날짜만 보고 묶지 않는다.

집계 정책은 OWNER의 명시적 승인 객체로만 전달한다. minimumProjectCount에는 기본값이 없으며, project selection·독립성·suppression·분포 버전 및 Consent 정책을 checksum에 고정한다. Production 반복 패턴 임계값은 v1에서 활성화하지 않는다. 테스트의 반복 패턴 임계값은 SYNTHETIC 정책에만 명시한다.

## C. Eligibility

신뢰할 수 있는 서버 reader가 프로젝트와 모든 실험 정의·결과 버전을 열거한다. 사용자 요청에 좋은 결과 목록을 전달하는 인터페이스가 아니다. 기존 저장소 adapter는 최신 정의에서 과거 정의 버전도 조회한다. cutoffAt 이전 최신 정의와 최신 결과 버전을 선택하며, 최신 결과가 실패했다고 좋은 과거 결과로 fallback하지 않는다.

다음은 기본 포함 조건이다.

- 같은 환경과 정확한 Cohort scope/Action/Metric/version/unit/window.
- RESULT_AVAILABLE, 현재 result source CURRENT, 유효한 non-null delta.
- OBSERVED_AFTER_ACTION, 비교 경고·이유 없음, 유효한 paired 표본.
- 하나의 Action만 있고 기록된 confounder가 없음.
- 현재 Action도 CURRENT, 실제 적용 시각·원본 연결 revision/checksum이 일치함.
- 현재 목적별 Consent가 모두 유효함.

실험·결과·저장 기록의 checksum과 project/version 소속을 확인한다. 값이 없는 결과, 부적합 비교, STALE, 변경된 Action, 미적용, 중단된 실험은 제외 사유로 남긴다. 나중에 실험이 RETIRED로 바뀐 경우도 새로운 현재 집계에서 이용하지 않는다. 기존 결과를 수정하지 않는다.

SYNTHETIC/DEMO를 운영 집계에 포함하지 않는다. 테스트에 있는 PRODUCTION 데이터는 승인·환경 계약을 검사하는 합성 입력이며 실제 운영 seed나 성과가 아니다. 실제 Source CURRENT의 판단은 기존 8-5/8-6 저장소에서 다시 읽어야 하며, 클라이언트가 전달한 CURRENT JSON을 신뢰하면 안 된다.

## D. Consent Gate

Cross-client 집계에는 **INTERNAL_RESEARCH와 ANONYMIZED_STATISTICS를 모두 요구**한다. PUBLIC_CASE_STUDY/NAMED_SALES_CASE는 대체 허가가 아니다. 기존 `ownPilot`, `permission`, `proofSchema`를 재사용한다. project/client/kind, 협약 확인 증빙, 최신 category별 decision, KST 유효 날짜, 확인 시각, 증빙 문서 소속을 검사한다. 종료된 협약과 모호한 여러 협약 참조는 허용하지 않는다.

8-6의 Consent 참조는 원래 목적과 협약을 찾는 참조일 뿐이다. 그 참조가 가리킨 과거 GRANTED를 그대로 사용하지 않고 **같은 협약·category의 최신 기록**을 검사한다. REVOKED/DENIED/기간 만료/누락/미확인 증빙이면 신규 Run에서 제외한다. 새 동의를 옛 협약 대신 임의로 골라 철회를 우회하지 않는다. v1은 실험당 하나의 명확한 협약 범위를 요구한다.

cutoffAt은 결과 선택 시점, checkedAt은 현재 동의·소스 검사 시점이다. 두 값을 분리하므로 같은 과거 cutoff로 다시 실행해도 그 뒤의 철회를 무시하지 않는다. 현재 날짜를 묵시적으로 읽지 않으며 호출자가 신뢰할 수 있는 서버 시각을 명시해야 한다. 미래 route가 추가되면 이 시각을 클라이언트 입력만으로 신뢰하면 안 된다.

과거 Run은 수정하지 않는다. 조회 시 현재 Consent가 달라졌으면 STALE_BY_CONSENT_CHANGE를 표시하고 통계·표본 수를 숨긴다. 원본만 바뀌면 STALE_BY_SOURCE_CHANGE다. 과거 저장 checksum은 보존한다. 철회 후 현재 이용 요건을 충족하지 않는 lineage 역추적도 거부한다. 보존·삭제에 관한 별도 정책은 이 단계에서 새로 정하지 않는다.

## E. Project-Level Aggregation

기본 정책은 **ONE_PROJECT_ONE_CLIENT_CONTRIBUTION**이다. 먼저 각 프로젝트에서 최신 적격 afterTo를 가진 실험을 고른다. 동률이면 projectId/experimentId/resultVersion으로 결정하며 delta 크기는 선택 기준에 없다. 선택된 프로젝트들의 delta에 같은 비중을 준다.

한 프로젝트에 10개 실험 또는 100개 관측이 있어도 다른 프로젝트의 1개 실험/10개 관측보다 큰 비중을 갖지 않는다. 같은 clientId의 여러 프로젝트도 별도 독립 고객처럼 계산하지 않는다. 최신 순으로 한 프로젝트만 기여하고 나머지는 SHARED_CLIENT_NOT_INDEPENDENT로 제외한다. 독립성 확인에는 내부 client ID hash를 사용하며 고객 이름을 집계 저장소에 복제하지 않는다.

서로 다른 clientId로 중복 등록된 동일 실체를 자동 식별하지는 않는다. 실제 운영 집계를 준비할 때 고객 식별자의 일관성을 별도로 확인해야 한다.

어떤 실험이 선택됐는지는 OWNER 전용 lineage에서만 확인할 수 있다. PROJECT_ALREADY_CONTRIBUTED 및 고객 중복도 제외 통계에 남긴다.

## F. Distribution

동일 가중치 mean/median/min/max, Q1/Q3, positive/zero/negativeCount, positiveShare를 제공한다. Quantile은 `(n-1)*p` 선형 보간인 type-7을 versioned policy로 명시했다. 극단값을 제거하거나 winsorize하지 않는다. 완전한 음수 집단과 0 변화도 정상 결과다.

8-6의 비율 delta는 0~1 차이이므로 집계에서는 100을 곱한 **표시 단위 %p**로 정규화한다. 예: 0.05는 집계 mean/median의 5%p다. count는 원래 절대 개수 차이로 유지한다. 같은 Cohort에 두 단위를 섞지 않는다. Positive Change Share는 관찰된 양수 프로젝트 비중이며 성공률이나 효과 확률이 아니다.

projectCount, experimentCount, rawObservationCount, pairedObservationCount, excludedExperimentCount를 분리한다. 기본 선택 후 projectCount=experimentCount이며, pairedObservationCount는 쌍 수가 아니라 2×pairedN이다. 관측 수는 고객 수가 아니고 mean의 가중치도 아니다. 여러 실험의 중복 관측을 독립 고객으로 세지 않는다.

## G. Exclusion / Bias Controls

candidateCount는 cutoff 범위에서 열거된 실험과 아직 실험에 연결되지 않은 Action 후보 수다. 다른 Cohort 축도 숨기지 않고 WRONG_PLATFORM/CHANNEL/ACTION_VERSION/METRIC/WINDOW 등의 제외 사유를 남긴다. eligibleCandidateCount는 모든 품질·Consent gate를 통과한 실험 수, includedCount는 독립성 선택 후 기여 수, excludedCount는 candidate-included다.

한 후보에 여러 제외 사유가 있을 수 있어 byReason 합은 excluded 총수와 같을 필요가 없다. 최신 실패 결과를 이전 성공 결과로 바꾸거나, 제외된 프로젝트를 분모에서 흔적 없이 제거하지 않는다. NO_FOLLOW_UP, ACTION_NOT_APPLIED, EXPERIMENT_ABORTED, STALE, NOT_COMPARABLE, INSUFFICIENT_EVIDENCE 및 confounder 등의 건수를 보존한다.

Action은 적용됐지만 Experiment가 없거나, DRAFT에 After 결과가 없는 경우도 missingness 후보로 집계한다. 아직 실제 Action 연결 자체가 없는 Task 전체를 잠재 실험처럼 임의 변환하지는 않는다. metadata가 없어 해당 scope를 확인할 수 없으면 별도 제외한다.

명시적으로 승인한 minimumProjectCount 미만이면 INSUFFICIENT_COHORT/SMALL_COHORT_SUPPRESSED다. 기본 projection에서 분포뿐 아니라 표본 수·제외 사유별 수·관측 volume도 숨긴다. 이 기준을 과학적 유의성이나 법적 익명성 보장이라고 표현하지 않는다. 현재 Production 정책은 0개라 임의의 운영 최소 수를 적용하지 않는다.

## H. Insight Classification

기본 분류는 **AGGREGATED_OBSERVATION**이며 FACT가 아니다. 기본 해석은 DESCRIPTIVE_ONLY다. REPEATED_PATTERN도 SYNTHETIC 명시 정책에서 같은 방향의 반복을 시험하는 내부 표시이며 인과관계가 아니다. Production 임계값을 임의로 만들어 이 상태로 승격하지 않는다.

formatter는 중앙·평균 변화, 양수·0·음수 수와 “관찰된 분포이며 인과효과나 향후 성과를 보장하지 않는다”는 문구를 사용한다. 알고리즘 공식·공식 가중치·추천 확률·성공률·ROI·p-value·Bayesian uplift를 생성하지 않는다. 데이터 품질 표시는 DESCRIPTIVE_ONLY이며 높은 효과 확률로 해석할 수 없다.

createInsightRecord는 관찰 분류의 참조·설명 객체만 반환한다. Knowledge FACT/HYPOTHESIS 생성·승인, Action effectClaimStatus 승격, 8-5 Candidate Ranking 및 과거 Readiness 변경 경로는 없다. observedVolume과 observedOutcome(distribution)은 별도 객체이며 표본이 많다는 이유로 Action 순위를 높이지 않는다.

## I. Privacy / Permission

기존 OWNER/MANAGER/ANALYST/VIEWER와 project access를 재사용한다. 초기 Cross-client 집계·조회·lineage는 **disabled가 아닌 OWNER + INTERNAL_RESEARCH 목적**만 허용한다. 다른 역할은 담당 프로젝트 목록이 있어도 집계와 타 고객 source 접근이 불가하다. local-org 밖의 소스를 거부한다.

기본 projection에는 고객 이름, project/client ID, 담당자, rawText, query text/hash, citation URL, 증빙 파일/ID, 개별 결과 참조·sourceHash·프로젝트별 delta가 없다. 전체 출처 원문을 집계 객체로 복사하지 않는다. private lineage에는 프로젝트·실험·결과 버전·checksum·선택/제외 사유만 남기며 이름·원문·증빙 본문은 없다.

OWNER가 목적을 명시하고 현재 이용 요건을 통과한 Run에서만 getLineage로 원본 참조를 확인한다. 실제 source 조회는 기존 프로젝트 권한 경계를 다시 통과해야 한다. 공개 고객 UI나 일반 직원용 Cross-client 화면을 만들지 않았다.

## J. Persistence

InsightAggregationRepository는 appendRun/getRun/listRuns/listByAction/listByPlatform/listByIndustry/getLineage를 제공한다. 메모리 adapter이며 재시작 후 유지되지 않는다. optimistic revision·직원·시각·사유·previousChecksum으로 append-only 이력을 남긴다. 같은 결정적 Run은 중복 저장하지 않는다.

`insight-aggregation-v1`의 sourceHash는 Cohort·승인 정책 checksum, cutoffAt, 포함·제외 후보의 정확한 결과 버전/checksum·원본 상태·scope·선택 사유·현재 Consent 상태 및 Consent 정책 버전을 고정한다. Run identity에는 명시적인 checkedAt도 포함한다. 같은 명세·cutoff·검사 시각·소스·정책이면 순서나 Date.now에 의존하지 않고 같은 checksum이다.

새 실험/Consent/소스 때문에 과거 결과를 조용히 다시 저장하지 않는다. 조회 시 현재 상태를 비교해 오래된 결과를 숨기고, 재집계는 새 Run으로 추가한다. cutoff 이후 새 실험은 그 cutoff의 결과 선택에 들어가지 않는다. 영구 DB/schema/table이나 기존 persistence는 변경하지 않는다.

## K. Preservation

8-7 변경 전 기존 파일과 읽기 전용 원본 DB의 hash를 기록했다. 전체 검증은 통합 백업을 복원한 별도 DB·별도 첨부 root에서 수행한다. 원본에는 합성 데이터를 넣지 않는다. 기존 Project/Experiment/Action/Readiness를 집계 전후 비교하는 신규 테스트도 있다.

검증 증거는 보호된 gitignored `output/stage7-5/platform-8-7-current.json` 포인터의 디렉터리에 남긴다. 고객 원문·접속 비밀은 보고서·Git에 포함하지 않는다. commit/push는 수행하지 않는다. 검증용 복원 자료는 증거로 보존한다.

최종 보존 확인:

- 작업 전 기존 파일 **279개 모두 SHA256 동일**. 이전 사용자 workspace.tsx 수정과 8-1~8-6 구현·보고서를 유지했다.
- 원본 DB의 **20개 도메인 비교 모두 동일**, schema/DDL 동일. 원본에 자료가 없는 도메인은 기존 rich-preservation 합성 통합 백업·복원 검사로 보완했다.
- 신규 소스 7개와 fixture/test 2개의 현재 SHA256은 실제 전체 검증 runtime의 파일과 모두 일치한다.
- 데이터 hash: `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96`.
- schema hash: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`.
- 증거: `source-before.json`, `files-before.json`, `final-preservation.json`, `final-complete-proof.json` 및 검사별 로그.

## L. Tests

| 검사 | 결과 |
| --- | --- |
| 신규 Insight 테스트 | **37/37 PASS** |
| DB·PDF·보존 통합 포함 전체 테스트 | **377/377 PASS**, 35개 파일 |
| Next production build | PASS, 기존 filesystem tracing warning 3개 |
| TypeScript --noEmit | PASS |
| 기존 전체 E2E | **15 PASS / 1 기존 WARN** |
| 원본 DB/schema·20개 도메인·279개 기존 파일 | 변경 없음 |
| 신규 소스·테스트 9개와 검증 사본 | 모두 동일 |
| git diff --check | PASS, 기존 workspace.tsx 줄바꿈 안내만 존재 |

신규 테스트는 정확한 mean/median/Q1/Q3, 양수·0·음수와 극단값 보존, 10개 실험/많은 관측의 과대가중 방지, 최신 적격 실험 선택, 중복 고객 독립성, 두 목적의 현재 Consent와 철회·유효기간·증빙 소속, 실패·미측정·고아 Action·중단, 최신 실패 결과의 과거 성공 fallback 방지, 현재 Action과 결과 재검사, Action/Metric/version/unit/platform/channel/environment/window 분리, 소표본 suppression, 명시 정책, Date.now 없는 결정성·입력 순서 불변, cutoff, append-only, OWNER 목적·privacy 및 보존을 포함한다.

37개 테스트의 분포 fixture는 실제 8-6 엔진으로 생성한 합성 결과를 사용한다. 일부 gate/선택 테스트는 신뢰할 수 있는 upstream projection의 변경을 test double로 모사한다. 운영 고객 자료나 운영 Insight를 사용한 검증은 아니다. 개별 개발 검사에서 발견한 Cohort fixture의 동결 metadata 재입력 오류를 수정한 후 최종 전체 검사를 수행했다.

E2E의 유일한 실패는 이전 단계와 같은 `tests/e2e/pilot.spec.ts:50:532`의 390px 모바일 overflow다. Studio 흐름은 이번 실행에서 통과했지만 기존 배열 순서 민감성 경고가 해결됐다고 판정하지 않는다. 무관한 기존 화면·테스트는 수정하지 않았다. 실제 AI 호출을 차단한 격리 DB/첨부 환경에서 실행했다.

## M. 다음 단계 판정

**READY_WITH_WARNINGS**. 독립 프로젝트 단위로 반복 관찰의 분포를 계산하고, 현재 Consent·품질·출처를 재검사하며, 양수·0·음수·실패·미측정·제외 데이터를 보존하는 runtime 계약을 확보했다. Production Knowledge/Rule/Action/Experiment/Insight 및 승인된 집계 정책은 모두 0개이며 가짜 운영 통계를 만들지 않는다. UI 변화는 없다.

8-8/후속 단계에서는 실제 운영 정의와 최소 표본·privacy 정책 승인, 고객 식별자 일관성, 기존 저장소를 통한 현재 source/Consent 조회, 영구 저장 및 UI 연결을 별도로 다뤄야 한다. Insight를 FACT나 Action 효과 보증으로 승격하거나 후보 Ranking에 자동 반영할 수 없다. SYNTHETIC/DEMO, STALE, suppression, 제외 사유와 표본 단위 구분을 후속 projection에서도 유지해야 한다.

기존 경고인 migration history 부재, Pilot 모바일 overflow, Studio 배열 순서 민감성, build warning, runtime-only persistence, 운영 정의 0개, 직접 PreScan/CITED experiment adapter 미지원, 일부 Metric만 지원을 유지한다. 관련 없는 동작을 바꾸지 않는다. 이 단계는 Machine Learning이나 인과효과 추론이 아니다.
