# 8-0 Integration / Storage / UI Boundary

## 기존 OS가 계속 소유

Project, ClientEntity, Question/Query Universe/확정 질문, AIResponse/ObservationRun, rawText, Task/Proposal/ExecutionDetail/StudioWork, Evidence/Document, Pilot/Agreement/Consent, Snapshot, Report와 인증/권한을 기존 모듈이 소유한다. 신규 레이어가 고객·질문·응답·승인·작업 상태를 중복 보관하지 않는다.

## 향후 Platform Intelligence가 소유

Platform Registry, PlatformChannel, Alias Mapping, PlatformKnowledgeVersion, RuleSetVersion, ReadinessEvaluation, ActionDefinitionVersion, 기존 실행을 참조하는 Experiment, Insight cohort/aggregation lineage다. 이번 단계에는 이들을 구현하거나 테이블/점수/파일 골격을 대량 생성하지 않는다.

향후 모듈 후보는 `src/lib/platform-intelligence/{registry,knowledge,rules,observations,readiness,actions,experiments,insights}`다. 이 문서가 현재 경계를 정의하므로 빈 기능 파일/새 route는 필요 없다.

## Repository 인터페이스 설계 — 문서만

| 계약 후보 | 책임 | 금지 |
|---|---|---|
| PlatformCatalogRepository | approved platform/channel/alias 버전 읽기, expectedVersion 기반 발행 | 원 provider/screen 값 UPDATE |
| PlatformKnowledgeRepository | FACT/OBSERVATION/HYPOTHESIS·출처·유효기간·승인 이력 | 고객 VerifiedFact와 platform FACT를 동일 분류로 혼합 |
| PlatformRuleRepository | 불변 RuleSetVersion과 check/weight/action 참조 | DB JavaScript/eval, 공식 알고리즘 주장 |
| PlatformReadinessRepository | project-scope 평가·근거 hash·unknown/null/coverage·룰 버전 | 기존 priorityScore 의미 변경, 가설을 공식 사실로 승격 |
| PlatformObservationContextRepository | responseId FK/sidecar, platform/channel/method·조건 mapping | 기존 AIResponse/consumer 원본·enum 자동 치환 |
| PlatformExperimentRepository | 기존 snapshot/task/proposal version 참조와 attribution | 독립 고객/질문/작업 상태 체계, 비인과 결과의 인과 확정 |
| PlatformInsightRepository | 동의/권한 내 cohort와 집계 lineage | project 권한 우회, 작은 표본·실패/누락 은폐 |

각 write는 projectId/actor/expectedRevision을 받고 소속과 현재 version을 검증한다. Catalog는 전역 공통 데이터, 관측/실험/Readiness는 고객 데이터이므로 같은 JSON blob이나 권한 projection으로 섞지 않는다.

## Storage 경계

기존 `store.mutate()`는 전역 graph를 읽고 advisory lock 742910 아래 모든 Project를 saveProject한다. 신규 catalog/knowledge/experiment를 `Project.operations`나 ClientEntity.payload에 관성적으로 계속 넣지 않는다. 8-1부터는 별도 repository를 제안하되 기존 Task 등과 원자적 연결이 필요하면 **같은 DB transaction/lock 및 expectedVersion**을 공유하는 제한된 bridge를 먼저 설계한다.

두 번의 독립 mutate로 한쪽만 성공하는 저장을 만들지 않는다. 전체 writer를 이번 단계에서 바꾸거나 새 table을 생성하지 않는다. 기존 file mode는 기존 기능을 그대로 유지하며, PostgreSQL 신규 repository를 준비하지 못했을 때 file mode에 반쪽 저장을 하지 않는다.

## Feature Flag 계획 — 미구현

후보 `PLATFORM_INTELLIGENCE_ENABLED`, 기본 false/fail-closed. 초기는 PostgreSQL에서만 추가로 활성화하는 방안을 권한다. 기존 file mode/화면/Route에 새 모듈 import·DB 접근을 강제하지 않는다. flag true만으로 외부 API나 크롤링을 허용하지 않는다. 권한·지원 채널·유효한 규칙·검증 gate는 별도로 검사한다.

## UI view 경계

기존 Pilot view는 28→0, 29→1, 30→2, 31→3, 32→4, 33→5, 34→6이다. 35는 CITED이고 Pilot이 아니다. 무한 범위 `tab>=28`을 명시적 매핑으로 바꾸는 최소 수정만 수행했다.

- `src/lib/workspace-views.ts:pilotViewForTab`은 신규 플랫폼 기능이 아닌 현재 UI 선택 함수다.
- 기존 menu index/label, URL/Route, projectId, view=cited, view=execution-studio와 기존 onNavigate를 유지한다.
- 미등록/미래/음수/NaN/Infinity/분수 탭은 PilotPanel을 mount하지 않는다.
- 다른 22~26/14~20 등 유한 범위나 전체 UI를 이번 단계에 재작성하지 않는다.
- 수정 전/후 E2E로 CITED의 불필요한 Pilot API 요청과 정당한 Pilot 탭의 정상 요청을 구분한다.

## 권한과 데이터 취급

기존 requireStaff/assertProjectAccess/safeWorkspaceProject와 Route별 OWNER/MANAGER/ANALYST/VIEWER 제한을 재사용한다. VIEWER는 승인된 허용 보고서 projection만 본다. 공통 catalog가 전역이라고 고객 원문/재무/동의를 전역 공개하지 않는다. Insight에는 별도 목적·기간·동의와 비식별 기준이 필요하다.

신규 엔진은 HUMAN observation, DEMO, API, FACT/OBSERVATION/HYPOTHESIS, classification, verification을 독립 축으로 다룬다. 안전한 전송/robots 정책과 LIVE_AI_ENABLED/FREE_GEMINI_ENABLED 차단 경로는 우회하지 않는다.
