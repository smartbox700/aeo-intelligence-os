# Platform Intelligence 8-8 — Operational Persistence & Production Governance

검증일: 2026-10-16. 원본 DB migration/초기화, 원본 고객 데이터 수정, commit/push, UI/API 추가 및 Production pack 작성은 수행하지 않았다. 증거 위치는 gitignored 보호 경로 `output/stage7-5/platform-8-8-current.json` 포인터로 확인한다. 접속 비밀과 고객 원문은 이 보고서에 넣지 않는다.

## A. Migration Baseline

원본 legacy 18개 테이블과 당시 Prisma schema가 일치하지만 migration history가 없는 상태를 확인했다. `0_legacy_baseline` 전체 DDL과 PostgreSQL migration lock을 추가하고 기존 `20261008_stage5` 부분 migration은 그대로 보존했다. 복원 DB에서 두 기존 상태를 resolve한 다음 새 `20261015_platform_intelligence`를 deploy했다. 빈 DB에서는 세 migration을 처음부터 deploy하고 datasource/schema diff가 비어 있음을 확인했다.

기존 테이블의 data/columns/index/constraints 보존을 별도로 비교했다. 처음 생성한 baseline SQL에 섞인 Prisma 업데이트 안내문은 빈 DB 실행 실패로 발견해 제거했으며, 수정 후 새 빈 DB에서 재검증했다. 이 과정의 실패·복구 실험은 모두 격리 DB다. 원본은 `_prisma_migrations`조차 생성하지 않았다. 운영 적용은 [baseline 문서](16-migration-baseline.md)의 별도 절차가 필요하다.

## B. Schema

물리적으로 versioned Record envelope와 AuditEvent 두 테이블을 추가한다. 13개 logical domain으로 Knowledge, Rule, RuleSet, Observation Context, Readiness 정책/평가, Action, Execution link, 측정 manifest, Experiment/Result, Insight 정책/Run을 저장한다. 이중 checksum, stable identity/version, recordRevision, 명시적 environment, scope/FK, contract/registry version, actor/time/reason, 이전 checksum을 보존한다.

Project/AIResponse/Task/Staff FK는 Restrict이며 기존 고객 행을 삭제하거나 변경하지 않는다. Project 내부 JSON의 Proposal/Studio/Pilot/Consent/기타 증빙은 같은 transaction에서 resolver로 재검증한다. 기존 원문·첨부·기존 snapshot/report를 별도 PI 원장에 복제하지 않는다. [architecture](15-persistence-architecture.md)에 domain별 key와 scope를 정리했다.

## C. Repository

Postgres adapter가 기존 synchronous Repository 계약을 transaction 안에서 hydrate한다. 기존 엔진에는 DB 호출을 넣지 않았다. 기존 메모리 구현 변경은 optional 초기 상태 복원과 snapshot export, 기존 schema export다. 운영 저장 실패 시 메모리 성공으로 우회하지 않는다. 공개 진입점은 `src/lib/platform-intelligence/persistence/index.ts`다.

정책·측정도 저장하므로 재시작 후 실험을 현재 원본으로 다시 검사할 수 있다. source가 바뀌면 역사적 record/checksum은 유지하고 현재 projection을 STALE로 만든다.

## D. Transaction / Concurrency

Serializable transaction과 기존 legacy writer/통합 backup이 공유하는 advisory lock을 사용한다. 현재 인증 권한·project 원본 읽기, source/reference 검증, PI record 변경, audit event 저장이 한 transaction이다. 실패는 rollback된다. expectedRevision CAS와 draft envelope checksum CAS가 중복/경쟁 저장을 차단한다.

실제 PostgreSQL 검사에서 callback 중간 실패 후 snapshot/revision이 동일했고, read-only callback의 저장 시도도 거절됐다. 같은 expectedRevision으로 동시에 두 개를 쓰면 한 요청만 성공했다. Approved version 덮어쓰기 시도는 실패하고 새 version을 추가해도 과거 approved checksum은 동일했다.

## E. Governance

DB에서 실제 StaffUser를 매번 읽고 immutable 권한 객체로 session에 전달한다. OWNER 전역 governance, project execution의 OWNER/MANAGER, 기존 분석 범위와 disabled/namespace/project 차단을 적용한다. 조회 session 안의 role 변경 시도도 거절된다. Knowledge/Action의 검토 전이와 승인 유효기간·provenance는 기존 strict 계약을 유지한다.

audit chain과 record head를 상호 대조해 누락·부분 변조를 탐지한다. 의도적으로 DB reason을 바꾼 후 조회 거절을 확인하고 격리 테스트에서 복원했다. 전체 DB/audit를 재작성할 수 있는 관리자에 대한 서명 시스템은 구현 범위가 아니다. 운영 쓰기는 adapter 경로로 제한해야 한다.

## F. Backup / Restore

기존 통합 backup의 동적 public-table archive가 새 Record/AuditEvent와 migration history를 포함한다. PI 13개 domain을 저장한 DB를 암호화 백업하고 새 DB/첨부 root에 복원했다. 전체 data/schema, ID/FK 및 파일 manifest 검사가 통과했다. 그 복원 DB에서 별도 Process B가 같은 저장 snapshot checksum과 domain/identity를 읽었다.

배포 전 legacy backup을 새 DB로 복원하는 경로도 반복 실행했다. 운영 DB에 DROP/역방향 migration을 적용하지 않았으며 실제 운영 연결 전환도 하지 않았다. 실패 시 새 복원 대상으로 전환하는 운영 절차는 [deployment checklist](18-operational-deployment-checklist.md)에 기록했다.

## G. Restart Persistence

독립 Node 프로세스로 다음을 실행했다. 첫 프로세스 종료 후 다음 프로세스를 시작하며, 객체나 메모리 저장소를 공유하지 않는다.

1. WRITE: Knowledge 승인, Rule/RuleSet, Observation, Readiness 정책/평가와 draft 전이·rollback/CAS를 저장한다.
2. CHAIN: 기존 Studio에서 실제 내부 검토·고객 승인·납품·적용·수동 HTML 대조 검증을 수행한 합성 fixture를 사용한다. Action 승인, 기존 Task link, Before/After manifest, Experiment와 **RESULT_AVAILABLE / pairedN=2** 결과, Insight 정책/Run까지 저장한다.
3. READ: 13개 domain, 전체 session checksum, revision, project identity를 새 프로세스에서 동일하게 읽는다. PRODUCTION record와 audit는 0이다.
4. RESTORED READ: 통합 백업으로 새 DB를 만든 후 같은 manifest를 다시 검증한다.
5. SECURITY: 복원 DB에서 실제 권한 차단, 변조 탐지, version 보존, 현재 Consent 철회와 원본 검증 상태 변경을 검사한다.

Consent 철회 후 과거 Insight checksum은 유지되고 `STALE_BY_CONSENT_CHANGE` 및 통계/lineage suppression을 확인했다. 원본 관측의 검증 상태 변경 후 과거 ExperimentResult는 STALE이며 저장 checksum은 그대로다. legacy save가 관측 rawText 덮어쓰기를 방지하는 것도 확인했다. PI snapshot에는 fixture 원문과 inputKey가 복제되지 않았다.

검사는 로컬에서 생성한 SYNTHETIC 자료이며 실제 고객 성과·실제 AI 호출·공식 플랫폼 규칙 증명이 아니다.

## H. File Mode / Flags

PostgreSQL이 아니면 `PERSISTENCE_UNAVAILABLE`, 두 명시 flag 중 하나라도 없으면 `PERSISTENCE_DISABLED`, 새 테이블이 없으면 `PERSISTENCE_SCHEMA_UNAVAILABLE`다. 기본 flags와 `.env`를 켜지 않았다. 자동 migration과 ephemeral fallback은 없다. UI/route를 연결하지 않았으므로 기존 프로그램 화면은 그대로다.

## I. Preservation

원본 DB의 시작·종료 data/schema hash와 20개 도메인을 read-only transaction으로 비교한다. 기존 사용자 workspace.tsx와 8-0~8-7 보고서를 보존한다. 의도한 수정은 Prisma schema와 기존 Repository/strict schema export 9개 파일이며 기존 엔진·화면 동작을 수정하지 않았다.

원본 기준 data hash는 `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96`, schema hash는 `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`다. 최종 보존 수치와 검증 runtime parity는 `final-preservation.json`에 남긴다.

최종 확인: **원본 data/schema 동일, 20개 도메인 모두 동일**. 기존 289개 파일 중 279개는 SHA256 동일하고 위 목적의 10개만 변경됐다. 삭제·예상 밖 변경은 없으며 workspace.tsx의 작업 시작 당시 사용자 수정도 동일하다. PI 소스/전용 테스트 **44개가 검증 runtime 사본과 모두 동일**하다.

## J. Tests

| 검사 | 최종 결과 |
| --- | --- |
| 신규 persistence 경계 단위 검사 | 6/6 PASS |
| 전체 단위·실제 DB·PDF·rich preservation | **383 PASS**, 36개 파일 |
| PostgreSQL 전용 phase | **WRITE / CHAIN / READ / RESTORED READ / SECURITY 모두 PASS** |
| 빈 DB 전체 migration / 최종 schema diff | PASS / empty |
| legacy 복원 DB baseline resolve + additive migration | PASS; 기존 18개 테이블 보존 |
| Prisma generate / Next production build | PASS / PASS |
| TypeScript --noEmit | PASS |
| 기존 전체 E2E | **15 PASS / 1 기존 실패** |
| 원본 data/schema·20개 도메인 / 기존 workspace 수정 | 모두 보존 |
| git diff --check | PASS; 기존 Windows 줄바꿈 안내만 있음 |

전체 suite의 전용 phase 파일 3개는 기본 실행에서 안전하게 skip된다. 별도 격리 DB에서 실제로 실행한 위 5개 독립 프로세스 invocation이 그 3개 test definition을 검증한다. 기본 suite skip을 영속화 검증 성공으로 계산하지 않았다.

기존 화면 검사는 PI fixture와 고객명으로 충돌한 첫 실행을 분리하고, 별도의 깨끗한 legacy 복원 DB에 동일 migration을 적용해 재실행했다. 첫 로그는 `pre-isolation-e2e.log`로 보존한다. 최종 유일한 E2E 실패는 이전 단계와 같은 `tests/e2e/pilot.spec.ts:50:532`의 390px mobile overflow다. Studio는 최종 실행에서 통과했지만 이전 배열 순서 민감성 경고는 해결됐다고 판정하지 않는다. Next의 기존 filesystem tracing warning 3개도 유지한다.

주요 증거: `migration-proof.json`, `blank-deploy.log`, `blank-diff.log`, `process-a.log`, `process-chain.log`, `process-b.log`, `restored-process-b.log`, `restored-security.log`, `restart-proof.json`, `persistence-restore.json`, `regression-proof.json`, `full-unit-db-pdf.log`, `full-e2e.log`, `final-preservation.json`. 원본/PI 데이터/기존 화면 검증은 DB와 첨부 root를 분리했으며 실제 AI 호출을 차단했다.

## K. Actual Production Counts

| 항목 | 격리 migrated DB의 PRODUCTION 저장 수 |
| --- | --- |
| Knowledge / Rule / RuleSet | 0 / 0 / 0 |
| Observation / Readiness 정책 / Readiness | 0 / 0 / 0 |
| Action / Execution | 0 / 0 |
| Measurement / Experiment / Result | 0 / 0 / 0 |
| Insight 정책 / Insight / AuditEvent | 0 / 0 / 0 |

원본 DB에는 신규 테이블을 아직 만들지 않았다. 따라서 위 0은 격리 migrated DB의 실제 조회 값이며 원본에 배포됐다는 의미가 아니다. 기존 production seed 배열도 계속 비어 있다.

## L. Next Stage

**READY_WITH_WARNINGS**. 영속화·migration baseline·전체 도메인 재시작·현재 권한/Consent·통합 백업 복원 계약을 격리 PostgreSQL에서 확인했다. 8-9의 인증된 서버 진입점과 기존 화면 DTO 연결 작업을 진행할 수 있다. Production pack 작성은 공식자료 검토·별도 승인 후 진행한다. PreScan/CITED 직접 실험 adapter와 일부 Metric 지원 한계, 기존 Pilot mobile overflow, Studio 배열 순서 민감성, Next build filesystem tracing 경고는 별도 미해결 항목이다.

Migration baseline/영속화의 구조적 결손은 격리 DB에서 해결했지만 원본 활성화·운영 migration 완료로 오해해서는 안 된다.
