# Platform Intelligence 8-4 — Evidence-Based Platform Readiness Engine

## A. 구현 파일

| 신규 파일 | 역할 |
|---|---|
| `src/lib/platform-intelligence/readiness/contracts.ts` | 평가 scope, 8-2 RuleSet에 결합하는 승인 정책, 명시적 가중치·freshness·검사 범위·결과 타입 |
| `readiness/evidence.ts` | 기존 project의 PageSnapshot/Audit/Response와 8-3 context를 읽는 5개 evaluator registry |
| `readiness/engine.ts` | 승인·FACT·scope·유효기간 gate, W/K/P·범위·Coverage·Confidence, 6개 production 상태 projection |
| `readiness/repository.ts` | 결과 schema/체크섬·계산 정합성, scoped append-only repository 및 메모리 adapter |
| `tests/platform-readiness.fixture.ts` | 테스트 전용 Synthetic FACT/RuleSet/HTML/Audit/관측 fixture |
| `tests/platform-readiness.test.ts` | 신규 30개 테스트 |
| 이 보고서 | A–J 검증·보존·범위와 한계 |

기존 8-0~8-3 모듈과 기존 metric/Route/UI/Prisma를 대체하거나 수정하지 않았다. 신규 함수는 내부 호출용이며 현재 운영 Route에서 자동 실행하지 않는다. 외부 HTTP/AI/crawler 호출 경로가 없다.

## B. Readiness Contract

**Internal Readiness**는 승인된 내부 Rule과 사용 가능한 Evidence에 대한 평가다. 추천·노출 확률, 공식 플랫폼 알고리즘 점수 또는 성과 보장이 아니다.

### Version / Scope

- evaluationVersion: `platform-readiness-evaluation-v1`
- 정책 확장 contractVersion: `readiness-ruleset-policy-v1`
- scorePolicy.version: `readiness-weighted-bounds-v1`
- confidencePolicyVersion: `readiness-evidence-confidence-v1`

scope는 projectId / canonical platformCode / channelCode(nullable) / evidenceAsOf와 country/language/industry/region/surface(nullable)를 포함한다. scope와 제공된 project.id가 다르면 거부한다. country/language 등 문자열을 임의 통합하거나 현재 날짜·위치를 기본값으로 추정하지 않는다.

8-2 RuleSet 원본은 수정하지 않았다. `createReadinessRuleSet`은 정확한 source RuleSet ID/version/checksum, Rule ID/version/checksum에 승인된 8-4 score/freshness/검사 정책을 결합하고 별도의 immutable checksum으로 봉인한다. 고객 증빙 선택은 정책 정의와 분리한다. 결과에는 다음 세 checksum을 구분해 기록한다.

- sourceRuleSetChecksum: 기존 8-2 RuleSetVersion의 checksum.
- ruleSetChecksum: 그 원본과 승인된 8-4 정책 전체를 함께 고정한 checksum.
- evidenceSelectionChecksum: 해당 평가에 선택한 Rule별 source kind/ID 및 projectId의 checksum. 없는 증빙을 요청한 경우도 선택 입력은 고정된다.

정책 checksum의 checks에서는 source selector를 제외한다. 따라서 새 PageSnapshot/Response를 선택한 재평가에는 같은 RuleSet 버전을 사용할 수 있다. 가중치·credit·freshness·검사 범위를 바꾸면 정책 checksum이 달라지며 저장 계약이 새 RuleSet 버전을 요구한다. 선택 hash 또는 정책 hash를 임의로 바꾼 binding은 INVALID다. 정확한 재생성에는 해당 정책과 증빙 선택 입력도 보관해야 하며, checksum만으로 누락된 원본/입력을 복원하지 않는다.

source/check policy는 RuleSet의 각 Rule을 중복 없이 정확히 하나씩 포함해야 한다. 구체적인 고객 page/audit/response ID를 선택하는 정책에는 projectId binding이 필수다. Global FACT/Rule 정의와 고객 원문을 섞지 않으며, 이 binding은 고객별 참조와 평가 조건을 고정하는 메모리 artifact다. 공식 Knowledge의 출처·claim을 고객 Evidence에서 자동 생성하지 않는다.

### Result / Check Status

Check: PASS / WARN / FAIL / UNKNOWN / NOT_APPLICABLE.

- PASS/FAIL: 검증 가능한 현재 근거로 해당 제한된 검사를 판단함.
- WARN: 부분 파싱 등 승인된 검사 범위 안에서 명확한 경고가 있음.
- UNKNOWN: 자료·조건·검증·날짜·채널 등이 부족하거나 판단할 수 없음. FAIL이 아님.
- N/A: 알려진 업종/채널/국가 등의 적용 범위가 다름. 항목과 이유는 결과에 남긴다.

Evaluation: READY / PARTIAL / NOT_CONFIGURED / INVALID / STALE.

- READY는 적용 가능한 검사의 판단이 모두 끝났다는 뜻이다. 모든 검사가 FAIL이어도 평가 자체는 READY일 수 있다.
- PARTIAL은 UNKNOWN 또는 적용 가능한 Rule이 없는 경우다.
- NOT_CONFIGURED는 승인 RuleSet이 없다는 뜻이다. score/range/coverage 모두 null이다.
- INVALID는 잘못된 정책/checksum/scope 또는 미승인·가설 근거 등으로 평가를 확정할 수 없다는 뜻이다.
- STALE은 Knowledge/Rule 은퇴·유효기간·검토 기한 또는 Evidence freshness 문제다. 확정 score/range를 전부 null로 격리한다.

결과는 evaluationId, scope, 정확한 RuleSet ID/version/세 checksum, environment(PRODUCTION/SYNTHETIC), allowDemo, 정책 버전, status/reasonCode, score/lowerBound/upperBound/coverage, W/K/P, confidence, counts, items, checksum을 보관한다. items에는 Rule 버전/checksum, Knowledge 버전/checksum/type/lastVerifiedAt, evidenceRefs, reasonCode, evaluatedAt, freshness/quality, FAIL actionCandidateRefs만 있다. 원문·HTML·고객 문서·citation URL·계정·토큰은 결과에 복사하지 않는다.

### Reproducibility / Checksum

현재 시각이나 랜덤 ID를 사용하지 않는다. 명시적 evidenceAsOf와 동일한 source graph·정확한 정책/Knowledge/Rule 버전이면 같은 결과와 ID/checksum을 만든다. evaluationId는 결과 내용의 canonical SHA256에서 파생한다. 저장된 과거 평가를 현재 source graph로 조용히 덮어쓰지 않는다.

다만 현재 DB의 수정된 검증 상태를 보고 과거 프로젝트 전체를 자동 복원하는 역사 DB는 아니다. 과거 결과 재생성에는 당시 source graph 또는 evidenceRefs의 checksum에 맞는 원본 버전이 필요하다. 현재 데이터가 달라졌으면 새 평가로 남기며, 기존 저장 결과는 그대로 읽는다.

## C. Rule Evaluation

### 공통 gate

정확한 APPROVED RuleSet/CONFIRMED APPROVED Rule과 pin된 checksum을 요구한다. Rule/정책의 발효·검토 시각이 evidenceAsOf보다 미래면 INVALID다. Knowledge reference의 존재·project scope·checksum·승인·공식 FACT 출처·검증 시각·validity를 다시 검사한다.

확정 근거에는 APPROVED FACT가 최소 하나 필요하다. supporting OBSERVATION은 보조 참조만 가능하다. HYPOTHESIS/EXPERIMENTAL은 확정 평가에서 거부한다. Knowledge의 알려진 platform/channel/country/industry 제약을 Rule에서 넓힐 수 없다. 만료/검토 기한/은퇴를 기존 PASS로 유지하지 않는다.

| checkType | Evidence / 판정 | 판단하지 않는 것 |
|---|---|---|
| ROBOTS_ACCESS | 선택한 기존 WebsiteAudit의 정확한 `robots-{명시 agent}` 결과 1개. pass→PASS, fail→FAIL, 미상/누락/중복→UNKNOWN | 실제 봇 방문·검색 수집 성공. 플랫폼 이름으로 bot agent를 추정하지 않음 |
| NOINDEX | PageSnapshot의 명시적 meta/header noindex/none 존재. 검사 범위를 HTML_META 또는 HTML_AND_HEADER로 정책에 명시 | 실제 검색엔진 색인 상태·플랫폼 순위 |
| PAGE_TEXT_PRESENT | 성공적으로 파싱된 PageSnapshot.body의 비공백 텍스트 존재 | 좋은 콘텐츠·효과·품질 |
| STRUCTURED_DATA_PRESENT | 파싱된 JSON-LD object/array 존재. 일부 파싱 오류 또는 미지원 primitive shape는 WARN, 부재/전체 오류는 FAIL | 플랫폼 지원·Schema eligibility·추천 효과 |
| CITATION_PRESENT | 동일 project/platform/channel의 source-consistent 8-3 context와 검증된 ResponseRecord citation 존재/부재 | citation이 존재하면 실제 웹검색을 했다는 추정·추천 효과 |

NOINDEX가 HTML_AND_HEADER인 경우, 수동 HTML만 있고 header 기록이 없으면 UNKNOWN이다. HTML_META 정책은 제공된 HTML meta만 평가한다. 명시적인 noindex가 확인되면 그 범위의 FAIL은 가능하다. 이는 검색엔진 전체 색인 여부 판정이 아니다.

각 검사에 기존 코드로 없는 유형을 추가하지 않았다. Google Index/Merchant Center/Naver Place/Shopping 등록이나 임의 알고리즘 검사는 없다. `READINESS_EVALUATORS`에는 위 5개만 등록되며 eval/JavaScript 실행 경로가 없다.

### Citation 및 source 검증

8-3 context checksum/identity를 검증하고 기존 adapter로 현재 응답·질문·조건과 연결이 일치하는지 재확인한다. CITED는 명시된 snapshot reference를 사용한다. 다른 Platform은 UNKNOWN, 필요한 channel이 null/다른 channel이어도 UNKNOWN이다. scope에 명시한 locale과 다르거나 미상이면 PASS/FAIL로 사용하지 않는다.

VERIFIED, sourceConfirmed=true, 유효한 검토 시각≤evidenceAsOf를 요구한다. INACCURATE, 실패/미완결 API 관측, 미검증 응답, 중복·부재 context, 잘못된 citation URL은 UNKNOWN이다. Citation URL은 기록된 HTTP(S) 참조만 검사하며 외부 페이지를 조회하지 않는다. citation이 없다는 FAIL도 이런 검증 gate를 통과한 관측에 대해서만 가능하다.

### Evidence freshness / 프로젝트 격리

Evidence는 전달된 project graph 내부의 ID로만 조회한다. 다른 고객의 객체 목록이나 전역 응답을 검색하지 않는다. missing source는 UNKNOWN이다. timestamp가 없거나 엄격한 ISO 시각이 아니면 UNKNOWN, evidenceAsOf 이후 source도 UNKNOWN이다. 명시적인 maxAgeSeconds/evidenceExpiresAt을 넘으면 STALE/UNKNOWN이다. maxAge는 임의 기본값으로 넣지 않고 승인 정책에 필수로 둔다.

Page/Audit의 DEMO와 관측 DEMO는 기본 제외한다. `allowDemo=true`는 SYNTHETIC 정책에서만 허용하고 결과에 표시한다. Production 설정에서 override하면 INVALID다.

PageSnapshot/Audit는 기록된 technical evidence이며 독립적인 사람 검증이 있다고 과장하지 않는다. Citation은 기존 관측 검증을 사용한다. VerifiedFact, EvidenceFile, PreScan/Pilot Snapshot을 별도의 공식 FACT로 바꾸거나 새로운 점수 근거로 복제하지 않았다. 현재 5개 check에 직접 필요한 page/audit/response/context만 읽고, 기존 observation의 원 도메인 연결은 8-3 adapter를 재사용한다.

## D. Scoring

단순 평균이나 weightCandidate의 묵시적 사용은 없다. 정책은 `EXPLICIT_RULE_WEIGHTS`와 각 Rule의 양의 정수 weight를 명시해야 한다. missing/중복/0/음수 weight는 거부한다. weightCandidate는 읽어서 자동 채택하지 않는다.

PASS=1, FAIL=0, WARN은 승인 정책의 [0,1] 값이다. 이는 내부 계산 정책이며 공식 플랫폼 가중치가 아니다.

```text
W = NOT_APPLICABLE을 제외한 Rule weight 총합
K = PASS/WARN/FAIL로 확인된 Rule weight 총합
P = Σ(확인된 Rule weight × 정책의 status credit)
coverage = K / W
lowerBound = 100 × P / W
upperBound = 100 × (P + W - K) / W
```

UNKNOWN은 K/P에 넣지 않으므로 완전 score를 만들지 않는다. N/A는 W에서 빼되 항목/이유를 유지한다. W>0이고 K=W인 유효 평가에만 단일 score를 반환한다. W=0은 score/range/coverage=null이다. STALE/INVALID는 score/range=null로 격리하고 사용 가능한 근거의 Coverage와 counts만 남긴다. NOT_CONFIGURED는 0점이 아니다.

Synthetic 혼합 테스트 예: PASS weight 2, WARN weight 3(credit .5), FAIL weight 5, UNKNOWN weight 7, N/A weight 101. W=17, K=10, P=3.5, Coverage=10/17, bounds=100×3.5/17 ~ 100×10.5/17이다. 이는 실제 고객·플랫폼 결과가 아닌 계산 계약 검증이다.

## E. Confidence

버전 `readiness-evidence-confidence-v1`의 보수적 내부 정책:

- INSUFFICIENT: 미설정/INVALID/STALE/W=0/K=0 또는 coverage<.25.
- HIGH: coverage=1이고 모든 확인 weight가 검증된 관측 Evidence이며 필요한 observation context가 COMPLETE.
- MEDIUM: coverage≥.75이고 확인된 근거의 context가 명확하나 독립 검증 조건이 HIGH에 미달.
- LOW: 그 밖의 사용 가능한 평가. 모델 미상 등 partial context도 여기에 제한.

Page/Audit는 기술 기록으로 사용 가능하지만 관측의 사람 검증과 동일 취급하지 않아 단독으로 HIGH를 만들지 않는다. score 값 자체를 confidence 계산에 넣지 않는다. Synthetic 검증에서 모두 PASS인 score 100과 검증된 citation 부재 FAIL인 score 0 모두 HIGH가 가능함을 확인했다. 이는 평가 근거가 명확하다는 뜻이며 고객 성과 가능성이 높다는 뜻이 아니다.

## F. Production RuleSet 상태

실제 Production Knowledge **0개**, Rule **0개**, RuleSet **0개**, Readiness policy binding **0개**.

`evaluateProductionReadiness(project,evidenceAsOf)`는 6개 Platform 모두 NOT_CONFIGURED / NO_APPROVED_RULESET, score/range/coverage=null을 반환한다. Google AI/Gemini는 공급사가 같아도 별도 scope다. Naver Place/Shopping 상태·미검증 요인을 점수에 넣지 않는다.

Synthetic FACT/RuleSet/HTML/Audit/관측은 tests 경로에만 있고 example.invalid 등 명백한 합성 fixture를 사용한다. Production 모듈이 fixture를 import하지 않는다. 실제 Platform Knowledge Pack이나 FACT를 작성·자동 수집하지 않았다.

## G. UI

이번 단계에는 내부 탭/카드와 공개 고객 화면을 추가하지 않았다. 요청의 선택적인 UI 확장 대신 Engine/조회 projection까지 구현했다. 기존 Workspace 메뉴·Route는 그대로다.

향후 내부 화면은 6개 production projection을 사용해 현재는 Not configured / Unavailable만 표시할 수 있다. 관측 수는 score와 별개여야 한다. SYNTHETIC/environment 또는 allowDemo 결과는 production UI에서 제외해야 하며, 명시된 환경 필드를 제공했다. 실제 승인 Pack이 생기면 items의 상태·reasonCode·Evidence/Rule/Knowledge refs·lastVerifiedAt·FAIL actionCandidateRefs로 상세를 구성할 수 있다. UNKNOWN은 evidence needed로 취급한다. Action 실행·효과는 없다.

## H. Preservation

증거 디렉터리: `output/stage7-5/platform-8-4-2889109c-eb2a-4de0-92c0-c8890e3b062d` (보호·Git 제외). 시작 시 기존 tracked/untracked 파일 SHA256과 원본 DB를 read-only로 기록했다. 통합 백업을 별도 aeo_restore_test_* DB로 복원하여 테스트한다.

기존 raw/provider/screen/Question/Snapshot/Report/hash/Metric/Route/Prisma 및 기존 8-0~8-3 코드를 수정하지 않는다. 새 영구 Table/Migration/DB 저장, 기존 Project.operations에 결과 저장도 없다.

최종 `final-complete-proof.json`:

- 원본 전체 data hash 전/후 동일: `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96`.
- schema hash 동일: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`. DDL/컬럼/인덱스/제약 비교도 동일.
- 20개 도메인 모두 equal=true. 비어 있는 source 영역은 EMPTY_IN_SOURCE로 구분하며 비어 있지 않은 Synthetic 도메인은 기존 rich preservation 테스트로 검증했다.
- 기존 tracked/untracked 파일 변경 **0개**. 기존 workspace.tsx의 미커밋 8-0 수정과 8-1~8-3 코드/테스트/보고서를 그대로 보존했다.
- Prisma schema SHA256 동일: `5a4f0156617b662fddcc40507f1cc5fc33a3af26eeb0e205ac2094e4c3af7ba7`.
- 최종 신규 코드/fixture/테스트 6개 파일은 검증 runtime과 hash가 일치한다.
- 원본 StaffSession/AccessEvent도 예외 없이 비교했다. 원본 data hash는 이전 8-0~8-3 증거와도 같다.

백업→격리 복원은 data/schema/IDs/관계/files 일치했다. 실제 원본 첨부 referenceCount/fileCount는 0이며, Synthetic의 비어 있지 않은 첨부·문서·Snapshot·Report 검증과 혼동하지 않는다. 기존 보고서/지표 재계산이나 source UPDATE는 하지 않았다.

### Result repository

PlatformReadinessRepository는 appendEvaluation/getEvaluation/getVersion/listByProject/listByPlatform을 제공한다. project ledger revision과 expectedRevision, actorId/createdAt/reason, previous checksum을 기록한다. 같은 evaluation ID 재작성과 stale revision을 거부한다. 같은 대상 scope·RuleSet ID/version에 다른 정책 checksum을 끼워 넣어 저장하려면 새 RuleSet 버전을 요구한다.

반환값은 재귀 freeze하며 과거 평가를 덮어쓰지 않는다. strict result schema, checksum/결정적 ID, W/K/P/counts/Coverage/bounds 정합성과 evidence projectId를 검사한다. 주입된 신뢰 가능한 guard가 actor 프로젝트 권한과 source reference 소속을 검증한다. 순수 engine에는 이미 권한 검증된 project graph를 전달해야 한다. checksum은 서명이 아니며 권한 검사나 원본 진실성 증명을 대체하지 않는다.

저장은 메모리 테스트 adapter다. 재시작 후 유지되는 운영 persistence라고 주장하지 않는다. 향후 DB 도입에는 migration baseline, actor/프로젝트 scope, 정확한 버전 uniqueness·트랜잭션·원본 보유/삭제·영구 감사가 필요하다. 이번 구현은 추가 migration 없이 다음 제한된 runtime 단계를 준비한다.

## I. Tests

신규 **30개 통과**. 6개 미설정, 5종 evaluator PASS/FAIL/UNKNOWN, WARN·N/A, 가중치 범위/단일 score/Coverage, Knowledge 만료·검토 기한·은퇴, Evidence 시각/expiry, Platform/channel/locale/project 분리, DEMO gate, 독립 Confidence, 결정적 checksum·v1/v2 보존, 정책 변조·HYPOTHESIS 차단, 원문 불변, scoped append-only 저장, 수동 HTML header 미상, 동일 RuleSet에서 새 증빙 선택·과거 평가 보존 등을 포함한다.

최종 코드 동기화 후 격리 전체 단위·PostgreSQL·PDF·rich preservation **32개 파일, 274/274 통과**. 8-3까지의 244개를 포함한다. production build/타입 검사도 재통과했고 기존 동적 파일 추적 build 경고 3개가 유지된다. 최종 정책/증빙 선택 분리와 버전 고정 guard를 포함한 소스가 검증 runtime과 일치한다.

전체 E2E: **15 통과 / 1 실패**. 실패는 기존 `tests/e2e/pilot.spec.ts:50:532`의 390px 모바일 scrollWidth 검사이며 이전 단계와 같은 위치다. PreScan→Snapshot→PDF/승인/다운로드, Consumer, CITED, Reporting, Backup/Restore 권한, Studio, workspace 경계 검사가 통과했다.

E2E 이후 신규 engine 내부의 정책/증빙 선택 분리와 append guard를 보강했고 위 전체 274개·build·typecheck를 재검증했다. 기존 UI/Route 및 그 연결은 바뀌지 않아 E2E를 추가 반복하지 않았다.

유지되는 기존 WARN:

1. 전체 migration 이력 부재: 그대로다. 새 schema/Migration/Table은 없다.
2. Pilot 모바일 overflow: 재현됐으며 관련 구현·기대값은 바꾸지 않았다.
3. Studio 배열 순서 민감성: 이번 실행 통과지만 이전 반복 재현 경고를 해결된 것으로 승격하지 않는다.
4. 기존 build 동적 파일 추적 경고 3개.

**신규 FAIL은 발견되지 않았다. 전체 E2E green 상태는 아니다.** 초기 통합 runner exit 1은 기존 Pilot 실패를 유지한 결과이며, 최종 engine 재검증 runner는 exit 0이다. `git diff --check`도 통과했다.

file-mode 전용 E2E는 별도 재실행하지 않았다. 신규 engine은 기존 UI/storage에서 자동 import되지 않으며, 이전 file-mode 보존 결과와 이번 순수 계약 검증을 근거로 제한한다. 실제 Platform Pack·실제 고객 score·운영 영구 persistence·공개 UI는 실증/구현 범위가 아니다.

## J. 다음 단계 판정

**READY_WITH_WARNINGS**

승인 Knowledge/정확한 RuleSet/현재 유효한 Evidence를 기반으로 내부 평가를 재현하고, 부족한 근거는 UNKNOWN으로 남기는 엔진을 마련했다. Production RuleSet은 0개이며 6개 Platform 모두 NOT_CONFIGURED가 정상이다. 기존 DB·raw·hash·metric·코드를 보존했고 신규 회귀는 발견되지 않았다.

8-5의 제한된 runtime 확장 기반은 준비됐다. 기존 경고와 메모리 persistence 한계를 유지하며, 실제 Knowledge Pack 도입·UI 노출·DB 도입은 별도 검증 범위다. 이 판정은 공개 배포·schema 변경·API 활성화 승인이 아니다. Action 효과·Experiment·Learning·외부 자동 호출은 이번 범위가 아니다.
