# Platform Intelligence 8-9 — Authenticated Server Boundary & Operational Read Model

검증일: 2026-10-16. 기존 UI/Workspace 메뉴/버튼, 기존 Route, Metric, Snapshot, Report를 변경하지 않았다. 원본 DB migration이나 자동 migration, 공식 Production pack 등록, AI 호출·크롤링·게시를 수행하지 않았다. 증거는 gitignored 보호 경로 `output/stage7-5/platform-8-9-current.json`이 가리키는 디렉터리에 보관한다.

## A. Server Architecture

새 catch-all Route는 허용된 GET/POST 주소만 처리한다. 기존 `requireStaff`, `sameOrigin`을 사용한 HTTP boundary → `PlatformApplicationService` → 기존 domain engine/governance → 8-8 PostgreSQL Repository 구조다. Service가 현재 project를 확인하고 whitelist DTO를 만든다. Route에 Prisma query나 별도 승인 로직은 없다. `20-server-api-contract.md`에 정확한 endpoint와 operation을 기록했다.

8-8 변경은 기존 AuditEvent JSON의 optional command context와 실제 변경 domain/stableId/version/recordRevision metadata를 보강한 것뿐이다. 준비 요청처럼 sidecar가 생기지 않는 명시적 command도 기존 AuditEvent에 기록할 수 있다. 기존 event와 audit chain은 호환되며 table/schema migration은 없다.

## B. Auth / Permissions

기존 세션 로그인과 현재 StaffUser를 사용한다. Disabled, 다른 namespace, VIEWER, 미인증 요청은 차단한다. DB에서 다시 읽은 immutable role/projectIds를 사용하므로 caller의 role/actorId를 신뢰하지 않는다. current local-org와 배정 project를 검사한다. 허용된 project에는 `assertProjectAccess`, `allowedProjects`, 기존 `safeWorkspaceProject`와 whitelist projection을 적용한다.

OWNER만 전역 Governance 쓰기·최종 승인·Insight 집계/조회가 가능하다. MANAGER/ANALYST는 승인 catalog metadata를 읽는다. project 조회/분석/명시적 준비는 배정 MANAGER·ANALYST에 허용하고 Execution 연결·측정 동결·Experiment 쓰기는 기존 OWNER/MANAGER 계약을 유지한다. 고객 VIEWER용 상세 API는 추가하지 않았다.

## C. API

실제 GET은 catalog, knowledge, rules, actions, insights 및 project별 overview/platform detail/observations/readiness/action-candidates/executions/experiments다. POST는 해당 resource별 명시적 command를 받으며 catalog/overview/detail에 범용 CRUD를 열지 않았다. RuleSet·정책은 기존 resource의 governance command로 묶었다. Synthetic testing endpoint는 없다.

## D. DTO / Read Models

Overview는 6개 플랫폼 identity/channel 상태, observation 수·최근 시각, Readiness bounds/coverage/confidence, finding counts, open work/experiment 수를 반환한다. Detail은 현재 policy 선택과 readiness items, evidence availability, candidate, 기존 execution/work, experiment/result metadata와 최신 observation metadata를 반환한다. 원문을 복제하지 않는다.

Readiness에는 INTERNAL_READINESS/notProbability/notOfficialPlatformScore를 붙인다. 현재 계산과 저장된 현재 평가를 구분하고 미저장 계산은 evaluationId=null이다. country/region/industry는 현재 source에서 정하며, 정책의 scope를 실제 고객 속성으로 꾸며 넣지 않는다. channel을 생략한 Overview/Detail/Readiness는 같은 서버 선택을 사용한다. 과거 평가의 현재성·유효기간을 재검사한다.

Execution과 Result는 기존 current/stale projection을 사용한다. Insight는 OWNER aggregate projection만 반환한다. Project 담당자에게 개별 cross-client lineage, 고객 이름, 원시 결과 참조를 반환하지 않는다. lineage는 별도 internal privileged method만 제공하며 현재 동의가 철회되면 거절한다.

## E. Governance Commands

Knowledge create/submit/approve/retire, Action create/submit/approve/retire, Rule/RuleSet immutable draft/publish, Readiness policy publish, Insight policy approve/aggregate를 제공한다. 기존 strict 계약을 실행하고 audit actor/review 시간/environment는 서버가 주입한다. Rule/RuleSet의 기존 version을 승인 필드 UPDATE로 덮지 않는다.

Observation capture는 현재 소속 response에서만 context를 만든다. Readiness 평가의 Rule/score/evidenceAsOf는 서버가 선택한다. PREPARE_WORK는 직원의 명시적 selection과 현재 저장 evaluation을 요구하며 createsTask=false다. 실제 Task 생성이나 적용 확정은 자동 수행하지 않는다. EXECUTION_LINK는 기존 Task/Studio 승인·적용·증빙과 관련 Pilot work/권한을 현재 source에서 찾아 기존 8-5 gate로 검증한다.

## F. Security

POST는 기존 sameOrigin과 필수 Origin, JSON body 64 KiB streaming 제한, strict Zod, 직원별 process-local 30회/분 제한을 적용한다. 미정의 body/query와 중복 query, actor/role/environment/current/consent/server-time override를 거절한다. PRODUCTION은 서버 상수이며 브라우저가 Synthetic으로 우회하지 못한다. `createdAt/reviewedAt/checkedAt/cutoffAt`은 서버가 정한다. 명시적인 evidence provenance 시각·관측 window는 기존 domain 입력으로 검증한다.

고정 오류 code만 응답하며 SQL/host/path/stack/Prisma 원문/secret/body 전체를 반환·로그 복사하지 않는다. 민감 GET은 AccessEvent, 모든 command는 기존 PI AuditEvent를 사용한다. 현재 source 검증·record·audit는 같은 transaction이다. API 시작/호출에 migrate deploy/reset/db push를 넣지 않았다.

## G. Persistence / Restart

실제 인증 세션 cookie를 갖춘 NextRequest를 실제 HTTP handler에 전달하고 실제 PostgreSQL Repository까지 실행했다. WRITE 프로세스 종료 후 별도 READ 프로세스에서 동일 Knowledge metadata와 6개 Overview 상태를 확인했다. 암호화 통합 백업을 새 DB/첨부 root에 복원한 다음에도 별도 프로세스의 동일 API projection이 일치했다. 토큰은 증거 manifest에 저장하지 않고 각 프로세스에서 새 세션을 발급했다.

추가로 8-8의 완성된 Synthetic ledger 백업을 별도 복원해 Application Service projection이 현재 Consent를 검사하는 것을 확인했다. 이 테스트는 내부 repository port에만 Synthetic ledger를 명시적으로 연결하고 고정 시계를 주입한다. 실제 HTTP singleton은 항상 PRODUCTION이며 환경/시계 주입 endpoint는 없다. 통계가 보이던 승인된 테스트 cohort에서 동의를 철회하자 통계가 숨겨지고 privileged lineage도 CONSENT_UNAVAILABLE로 거절됐다. 운영 pack을 만들어 이 검사를 우회하지 않았다.

## H. Empty Production State

신규 schema가 적용된 깨끗한 격리 DB에서 Production record 0개 상태를 실제 HTTP handler로 조회했다. 6개 플랫폼 모두 NOT_CONFIGURED/null score이고 Insight items=[]다. 원본에는 신규 table을 아직 만들지 않았으며 API flags도 켜지 않았다. 따라서 이 검증이 원본 migration/활성화를 의미하지 않는다.

Governance 저장/승인/restart 검사는 별도 격리 DB에 명확히 표시한 HYPOTHESIS 테스트 version만 생성했다. 공식 FACT/Rule/RuleSet/Action pack이나 가짜 성과를 운영 등록하지 않았다. Synthetic record가 기본 Production API에 섞이지 않는 것도 검사했다. 최종 Production count의 기준과 테스트 fixture 수는 별도로 기록한다.

| Domain | 깨끗한 migrated 검증 DB의 PRODUCTION count |
| --- | --- |
| Knowledge / Rule / RuleSet | 0 / 0 / 0 |
| Observation Context / Readiness 정책 / Readiness | 0 / 0 / 0 |
| Action / Execution | 0 / 0 |
| Measurement / Experiment / Result | 0 / 0 / 0 |
| Insight 정책 / Insight / AuditEvent | 0 / 0 / 0 |

원본의 신규 table 존재 여부는 false다. 원본에 등록된 운영 PI record는 없으며 위 표를 원본에 schema가 배포됐다는 뜻으로 해석하지 않는다. 분리된 API contract-test DB에는 **PRODUCTION namespace의 생성된 HYPOTHESIS 1개와 승인 audit 3개**, 별도 SYNTHETIC namespace의 격리 확인용 HYPOTHESIS 1개가 있다. 이 fixture를 운영 Count에 합치거나 공식 Pack으로 설명하지 않는다. 원본과 깨끗한 migrated DB에는 이 fixture가 없다. 실제 SQL 집계는 `production-counts.json`에 양쪽을 구분해 보관했다.

## I. Preservation

작업 시작 때 기존 파일 309개와 원본 read-only DB 기준 및 암호화 backup을 기록했다. API persistence 검사, 기존 회귀 검사, 8-8 Consent 검사 모두 DB와 첨부 root를 분리했다. 원본 data/schema·20개 도메인, UI와 기존 Route의 hash, source/runtime parity는 최종 보존 proof로 확인한다. 예상한 기존 파일 변경은 persistence/postgres.ts의 감사 metadata 보강 하나다.

최종 proof에서 **원본 data/schema 동일, 20개 도메인 모두 동일**을 확인했다. 기존 파일 **309개 중 308개 SHA256 동일**, 위 감사 adapter 파일만 의도적으로 수정했다. 삭제나 예상 밖 수정은 없고 기존 workspace.tsx의 사용자 수정·기존 Route·기존 schema/migration 파일도 보존됐다. 관련 소스/Route/테스트 **54개가 실제 검증 runtime과 모두 동일**하다.

## J. Tests

신규 unit은 auth/project/organization read boundary, 6개 empty state, whitelist privacy, client authority override, explicit preparation의 no-task/현재 source gate, global policy scope와 server-time 거절을 다룬다. PostgreSQL 전용 phase는 실제 cookie 인증·disabled/current assignment·OWNER 승인 audit·CAS·immutable·CSRF·payload/rate·feature/file/schema 오류·환경 격리·restart/restore를 실행한다. 기존 E2E에 production route의 인증/기본 fail-closed 검사도 추가했다.

| 검사 | 결과 |
| --- | --- |
| 신규 application/DTO unit | **28/28 PASS** |
| 전체 unit·실제 DB·PDF·rich preservation | **411 PASS**, 37개 파일 |
| 실제 세션 API WRITE/security | PASS |
| 독립 Process B API projection | PASS |
| 통합 backup 후 새 DB의 독립 Process B | PASS |
| 영구 저장된 8-8 source의 Consent 재검사 | PASS |
| Prisma generate / Next production build | PASS / PASS |
| TypeScript --noEmit | PASS |
| 기존+신규 전체 E2E | **15 PASS / 2 기존 WARN(실패)**; 신규 API E2E PASS |
| 원본 data/schema·20개 도메인 / 기존 UI·Route | 모두 보존 |
| git diff --check | PASS; Windows 줄바꿈 안내만 있음 |

기본 full suite의 5개 phase 파일은 안전하게 skip된다. 그중 8-9 파일 2개는 위 4개 독립 Node invocation으로 실제 실행했다. 기존 8-8 전용 3개 phase의 결과는 8-8 보고서와 백업 증거를 보존하며, 이번에는 해당 백업을 새로 복원해 현재 Service의 Consent projection까지 검증했다. skip 자체를 실제 PostgreSQL 성공으로 계산하지 않았다.

최종 E2E 실패는 기존 `pilot.spec.ts:50:532`의 390px overflow와 `studio.spec.ts:49:133`의 작업 배열 순서 비교다. Studio는 실제 승인·적용 검증·후속 연결·화면 확인을 완료한 뒤 기존 프로젝트 before/after의 deep equality에서 실패했다. diff의 제거/추가 property 9개가 모두 동일하고 같은 Task가 배열의 다른 위치에 놓인 것을 확인했다(`studio-order-warning.json`). 앞선 실행에서 통과하기도 한 기존 순서 민감성 경고를 해결된 것으로 간주하거나 최종 실패를 숨기지 않는다. 무관한 UI/정렬/기존 테스트를 수정하지 않았다. Next의 기존 filesystem tracing warning 3개도 유지된다.

증거: `api-results.json`, `api-process-a.log`, `api-process-b.log`, `api-restored-process-b.log`, `api-second-restore.json`, `persisted-consent-projection.log`, `regression-results.json`, `full-unit-db-pdf.log`, `production-build.log`, `full-typecheck.log`, `full-e2e.log`, `source-preservation.json`, `final-preservation.json`, `production-counts.json`.

## K. Remaining Warnings

기존 Pilot 390px mobile overflow, Studio 배열 순서 민감성, Next filesystem tracing warning, PreScan/CITED 직접 experiment adapter 미지원 및 일부 Metric 지원 한계를 유지한다. 단일 process의 쓰기 rate counter는 분산 저장소가 아니며 재시작 시 초기화된다. 현재 범위는 local-org 직원 서버 계약이다. UI 연결·공식 Pack·고객 portal DTO·운영 migration/활성화는 별도 단계다.

## L. Next Stage

**READY_WITH_WARNINGS**. 인증된 직원별 project/organization 경계, strict server command, 현재 권한·source·Consent, 영구 저장/audit와 재시작 후 projection을 검증했다. 8-10의 공식자료 검토·Pack 등록 준비로 진행할 수 있다. 기존 E2E warning 2개와 build warning은 남아 있으므로 전체 E2E가 green이라고 판정하지 않는다. 현 단계에서 score/Action/Insight를 운영 seed로 채우지 않으며 원본 migration·API 활성화·UI 연결도 수행하지 않았다.
