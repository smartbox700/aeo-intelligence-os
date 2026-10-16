# Platform Intelligence 8-5 — Versioned Action Library & Delivery Bridge

검증일: 2026-10-15. 최종 판정: **READY_WITH_WARNINGS**.

## A. 구현 파일

- `src/lib/platform-intelligence/actions/definitions.ts`: 정의 스키마, 버전·승인·폐기, 참조 검증, 메모리 저장소.
- `src/lib/platform-intelligence/actions/candidates.ts`: 진단별 후보, 운영 우선순위, 직원의 선택에 대한 업무 초안 요청 계약.
- `src/lib/platform-intelligence/actions/bridge.ts`: 기존 업무·증빙 참조, 적용 검증, 연결 이력, 현재 원본 상태 조회, 중복 방지.
- `src/lib/platform-intelligence/actions/index.ts`: 별도 모듈 진입점.
- `tests/platform-actions.test.ts`: 명시적인 SYNTHETIC 정의와 기존 Studio를 이용한 테스트.

기존 모듈, HTTP route, UI, Prisma, 마이그레이션은 수정하지 않는다. Action 모듈은 아직 운영 화면에서 호출하지 않는다.

## B. Action Definition Contract

`actionId`는 안정적인 업무 분류 ID, `version`은 양의 정수다. 10개 category, canonical platform/channel, 네 업종, 적용 status/checkType, 목적, 입력·출력, 승인·규정 검토·증빙 요구, 불확정 예상 작업량, Knowledge/Rule/Action dependency의 ID·버전·checksum을 갖는다.

`DRAFT → REVIEW_REQUIRED → APPROVED`를 OWNER가 수행한다. 새 내용은 `supersedes`로 직전 버전을 명시한다. APPROVED 버전은 덮어쓰지 않고 폐기도 RETIRED 새 버전을 추가한다. 검토 전 전환은 해당 미승인 버전의 상태를 갱신하며, 이전 반환 객체와 승인·변경 audit checksum은 보존한다. 최신 버전이 미승인/폐기 상태이면 과거 승인 버전으로 자동 fallback하지 않는다.

canonical JSON SHA256을 별도로 계산하고 중첩 객체를 동결한다. 승인자·시각·사유·registryVersion도 checksum에 포함한다. Knowledge는 승인된 최신 유효 전역 참조, Rule은 승인되고 유효한 전역 버전 및 정확한 checksum을 검사한다. 범위가 제한된 참조를 합쳐 전역 범위로 확대하지 않는다. dependency는 승인된 같은 environment의 현재 버전 참조만 허용하는 metadata이며 실행 엔진이 아니다.

이번 구현의 effectClaimStatus는 **NO_EFFECT_CLAIM만 허용**한다. 미래 상태 이름은 타입으로만 남기며 상향 상태, ROI 등 미정의 필드, 추천·노출·인용·매출 효과를 예측하거나 보장하는 문구를 거부한다. 문구 검사는 제한적인 방어 수단이므로 OWNER의 운영적 목적 검토도 필요하다. 법적 적합성이나 효과를 자동 인증하지 않는다.

## C. Candidate Mapping

정합성이 확인된 ReadinessEvaluation의 project·checksum·평가시각을 고정한다. 명시적인 현재 시각과 최대 허용 나이를 사용하며 미래/오래된 평가, INVALID/STALE/NOT_CONFIGURED는 후보가 없다. 기본값은 production만 허용하며 SYNTHETIC은 명시적인 테스트 옵션과 같은 environment의 정의만 사용한다.

각 item의 exact Rule 버전·checksum 및 Action의 status/checkType/platform/channel/industry를 대조한다. Action에 ruleRefs가 있으면 해당 Finding의 정확한 Rule 참조와 일치해야 한다. 기존 actionCandidateRefs의 stable ID는 같은 ID의 승인 정의로 해석할 수 있고, status/checkType 계약으로 관련 후보를 추가할 수 있다. 모든 후보는 실제 정의 버전·checksum으로 고정된다. 후보에 기록한 scope는 원본 평가 scope이며 업종·채널을 추측하지 않는다.

- FAIL: 검토·수정 업무 후보. HIGH severity의 ROBOTS_ACCESS/NOINDEX는 BLOCKER, 다른 HIGH FAIL은 HIGH.
- WARN: 부분 상태 검토 후보. FAIL로 바꾸지 않는다.
- UNKNOWN: EVIDENCE/MEASUREMENT/COMPLIANCE의 수동 검토·확인만 허용한다. 수정 초안 실행 유형은 제외한다.
- PASS/N/A: 이번 단계 후보 없음.

그 외 운영 우선순위는 NORMAL 또는 LOW다. 동일 우선순위는 ID·버전으로 정렬한다. 효과·성공률·예측 점수에 의한 순서는 없다. 한 Finding의 여러 후보와 여러 Finding에 연결하는 같은 Action을 허용한다. 평가·점수·원문은 변경하지 않는다.

## D. Existing Workflow Bridge

`prepareActionWorkRequest`는 사람이 선택한 현재 후보를 재검증하고 `EXISTING_WORK_DRAFT_REVIEW` 요청을 반환한다. Task를 생성하거나 수정하지 않는다. 현재 전역 업무 저장과 runtime Action 저장소 사이에 원자적 저장 계약이 없으므로 Create work item UI/route는 추가하지 않았다. 이는 지침 37의 서비스 계약 단계에 해당한다.

`linkExistingTask`는 주입된 신뢰할 수 있는 project reader로 원본을 다시 읽고 기존 Task에 연결한다. Proposal은 해당 Task의 proposal ID와 최신 버전을 검증한다. StudioWork에는 별도 UUID가 없으므로 기존 taskId와 studioVersion을 사용한다. Pilot은 기존 ownPilot으로 project/client/kind를 검사하고 agreement 안의 work.taskId와 현재 버전을 확인한다. 새 업무 상태나 완료 enum을 만들지 않는다.

조회 결과의 Task.status, ExecutionDetail.status, Studio.state, PilotWork.status는 현재 원본에서 읽는다. SOURCE_CURRENT에 해당하는 `CURRENT`, `SOURCE_CHANGED`, `SOURCE_MISSING`은 연결 정합성 표시이며 업무 상태가 아니다. 원본 변경·증빙 누락·승인 취소·사실 만료는 현재 적용 시각을 null로 노출한다. 과거 연결 버전의 기록은 동결된 이력으로 남는다.

## E. Production Seed

**운영 Action Definition: 0개.** 실제 직원이 승인한 명세가 없는 상태에서 테스트 정의를 운영에 등록하지 않는다. 기존 Production Knowledge/Rule/RuleSet/Readiness 정책도 0개 상태를 유지한다. 모든 테스트 Action은 SYNTHETIC이며 NO_EFFECT_CLAIM이다. 운영 후보를 실제 표시하려면 별도 OWNER 검토로 정의와 관련 정책을 승인해야 한다.

## F. Execution Link

executionId, revision, projectId, evaluationId/checksum, finding Rule ID/version, Action ID/version/checksum, environment, 기존 task/proposal/studio/pilot 참조, plannedAt, actualAppliedAt, proofRefs, audit, sourceChecksum, previousChecksum, link checksum을 저장한다. 감사 기록은 직원·시각·사유를 포함한다. 정의 및 실행 연결 저장소는 별도 계약이다.

`plannedAt`과 `actualAppliedAt`은 입력상 분리된다. 실제 적용 시각은 기본 null이며 Task 생성·완료·예정 시각에서 복사하지 않는다. 이번 단계에 실제 적용 시각을 지원하는 경로는 **현재 승인 버전의 Studio deployment + export + 성공한 verification**이다. 호출자는 deployment.at과 정확히 같은 시각, 현재 Proposal/Studio 버전, verification.page 참조를 명시해야 한다. 승인 후 적용, 적용 후 검증, command 이전 기록인지를 검사한다. Definition이 요구하는 추가 증빙 종류도 필요하다.

PAGE는 기존 원본 페이지 또는 해당 Studio verification.page, EVIDENCE는 고객 첨부, STUDIO_VERSION은 해당 Task 버전, APPROVAL은 정확히 승인된 Proposal 버전, PILOT_DOCUMENT는 해당 프로젝트 문서를 참조한다. 원문을 전역 복제하지 않고 ID와 원본 checksum만 남긴다. 기존 검증자·검증시각은 연결된 Studio 원본에 있다.

Studio가 없는 legacy 업무도 예정/분류 연결은 가능하지만 actualAppliedAt은 null이어야 한다. Pilot 완료 시각도 적용 시각으로 추론하지 않는다. DEMO 적용은 명시적인 SYNTHETIC 연결에만 허용하며 향후 실제 실험에서 제외해야 한다.

같은 project/finding Rule/actionVersion으로 다른 활성 Task 연결이 있으면 거부한다. Task 완료 여부는 현재 Task/ExecutionDetail에서 판단한다. optimistic revision 및 역전 시각 거부, previousChecksum으로 연결 이력을 보존한다.

## G. Permissions / Compliance

기존 Staff와 assertProjectAccess를 재사용하며 disabled 직원도 거부한다.

| 역할 | 허용 |
| --- | --- |
| OWNER | 전역 정의 관리·승인, 후보 검토, 연결 |
| MANAGER | 소속 프로젝트 후보 검토·연결 |
| ANALYST | 소속 프로젝트 후보 검토·초안 요청, 연결 조회 |
| VIEWER | 실행 관리 거부 |

실제 적용 확인은 기존 `assertStudioApproved`를 복제 프로젝트에서 호출하므로 검증 과정이 원본을 초기화·수정하지 않는다. 사실 fingerprint, 공개 문안, 내부 검토, HUMAN_FINAL, 현재 고객 승인, 기존 의료/법률 검토를 우회할 수 없다. MEDICAL/LEGAL 및 별도 규정 검토 요구에는 현재 legal 검토 기록도 필요하다. Task에 별도 검토 플래그가 있으면 APPROVED를 요구한다.

Pilot 적용 연결은 ownPilot/assertPilotActive/assertPermission을 재사용한다. WEBSITE/CONTENT의 현재 동의와, 기존 완료 절차에서 승인·범위·규정 검토를 거친 DONE/current-version completion 및 compliance 기록을 요구한다. 외부 검토가 필요하면 완료 기록도 요구한다. 외부 게시·로그인·AI 호출·자동 크롤링은 수행하지 않는다.

## H. Persistence

ActionDefinitionRepository와 ActionExecutionLinkRepository interface 및 메모리 adapter다. 인스턴스 수명 동안만 보존되며 재시작 시 사라진다. 운영 전 영구 저장·transaction·동시성 계약을 별도 단계에서 정해야 한다. HTTP 경계가 추가되면 기존 session requireStaff/sameOrigin 검사를 반드시 사용해야 한다. 현재 새 경계는 없다.

Prisma/schema/migration/table을 추가하지 않는다. 원본 DB 검증은 읽기 전용이며 회귀·백업 복원 검사는 격리 복원 DB에서 수행한다.

## I. Preservation

기존 DB의 domain hash·DDL·원문·snapshot·metric·Task/Proposal/Studio/Pilot 및 기존 소스 파일의 전후 동일성을 검사한다. 새 Action 서비스는 원본 업무 객체를 수정하지 않으며 실제 적용 연결 전후 project hash 동일성도 테스트한다. 검증 증거는 gitignored 보호 디렉터리의 `platform-8-5-current.json` 포인터가 가리키는 위치에 저장한다. 고객 원문·접속 정보·첨부 데이터는 이 보고서에 포함하지 않는다.

최종 확인 결과: 작업 전 기존 파일 **264개 모두 동일**, 원본 DB **20개 도메인 비교 모두 동일**, DDL 동일. 실제 데이터가 없는 도메인은 기존 합성 rich-preservation 테스트의 백업·격리 복원으로 보완한다. 최종 검사에 사용한 신규 소스·테스트 5개도 작업 디렉터리와 runtime 복사본의 SHA256이 모두 일치한다. 기존 workspace.tsx의 사용자 변경도 그대로 보존했다.

- 원본 데이터 hash: `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96`
- 원본 schema hash: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`
- 증거: `source-before.json`, `final-preservation.json`, `final-code-validation.json`, `final-complete-proof.json`.

## J. Tests

| 검사 | 최종 결과 |
| --- | --- |
| 신규 Action 테스트 | 30/30 PASS |
| 전체 단위·DB·PDF·보존 통합 테스트 | 304/304 PASS, 33개 파일 |
| Next production build | PASS, 기존 tracing warning 3개 |
| TypeScript --noEmit | PASS |
| 기존 전체 E2E | 15 PASS / 1 기존 WARN |
| git diff --check | PASS, 기존 workspace.tsx 줄바꿈 안내만 존재 |
| 원본 DB·DDL·20개 도메인·기존 파일 | 변경 없음 |

신규 검사 범위는 정의 버전·폐기·권한·참조 checksum, 효과 문구/상태 거부, FAIL/WARN/UNKNOWN/PASS 분리, 채널·업종·synthetic·시간 범위, 후보의 다중 연결, 초안 요청의 무변경, Task/Proposal/Studio/Pilot/증빙 소속, 낙관적 revision, 중복 활성 업무, 원본 변경/삭제, Task DONE에서 적용 시각 추론 거부, 기존 Studio 승인·적용·검증을 통한 정상 연결과 승인 취소 후 무효화를 포함한다.

최초 전체 검사에서 승인 변경을 SOURCE_MISSING으로 분류한 신규 오류 1개를 발견해 SOURCE_CHANGED로 수정했다. 수정 및 최종 정의 계약 반영 후 전체 테스트·빌드·타입 검사를 재실행했다. E2E는 변경하지 않은 기존 화면/route의 검증이며, Action 서비스는 UI에서 호출하지 않는다. E2E의 유일한 실패는 이전 단계와 같은 `tests/e2e/pilot.spec.ts:50:532`의 390px 모바일 overflow다. Studio E2E는 이번 실행에서 통과했지만 기존 배열 순서 민감성 경고는 해소됐다고 판정하지 않는다.

원본과 별도로 복원된 테스트 DB·첨부 root만 변경했다. LIVE_AI_ENABLED/FREE_GEMINI_ENABLED는 false이며 실제 외부 AI 호출·고객 사이트 조작은 하지 않았다. 검증용 복원 DB와 보호된 산출물은 검토 증거로 남겼다. Git commit/push는 수행하지 않았다.

## K. 8-6 판정

**READY_WITH_WARNINGS**. 실행 ID·Action 버전·projectId·실제 적용 시각·증빙·평가/Finding 연결 계약은 준비했다. 효과 계산, Before/After 판정, Experiment/Learning 통계는 구현하지 않았다.

8-6에서는 현재 원본과 일치하는 CURRENT 연결, production environment, 실제 적용 기록, 유효한 증빙과 비교 가능한 관측만 사용해야 한다. null 적용 시각, SYNTHETIC/DEMO, SOURCE_CHANGED/SOURCE_MISSING, legacy 완료 시각만 있는 연결은 실제 효과 분석에 사용할 수 없다. 과거 연결은 이력이며 현재 적용 사실과 구분해야 한다. 운영 정의 승인, 영구 저장과 원자적 업무 생성, 실제 UI 연결은 남아 있는 명시적 후속 범위다.

기존 경고인 migration history 부재, Pilot 모바일 overflow, Studio 배열 순서 민감성, build warning, runtime-only Platform Intelligence persistence는 유지한다. 이 단계 통과를 위해 관련 없는 동작을 변경하지 않는다.
