# Platform Intelligence 8-0 완료 검증 보고서

기준일: 2026-10-15 (Asia/Seoul). 최종 판정: **READY_WITH_WARNINGS**.

기능을 늘리지 않고 시작점·계약·실제 DB·복원·회귀·저장/화면 경계를 고정했다. Registry/Knowledge/Rule/Readiness/Action/Experiment/Insight 구현, Migration, Platform 테이블, 실제 점수, 실제 AI 호출, 자동 크롤링은 추가하지 않았다.

## A. 변경 파일

### 기존 tracked 파일 변경: 1개

- `src/components/workspace.tsx`: Pilot 패널 선택에 `tab>=28` 대신 `pilotViewForTab(tab)` 사용. import/선택 변수/조건/view 전달만 변경. 메뉴/URL/Route/기능/업무 상태를 변경하지 않음.

### 새 파일: 15개

- `src/lib/workspace-views.ts`: 기존 Pilot 탭 28~34의 명시적 매핑.
- `scripts/platform-8-0-preservation.mjs`: 읽기 전용 DDL/행/도메인 hash inventory와 비교 함수.
- `scripts/platform-8-0-baseline.mjs`: 시작 checksum, 기존 통합 백업/별도 복원, 격리 검사와 source 불변 증명 도구.
- `tests/platform-preservation.test.ts`: 원문/버전 변경 탐지 및 비밀 원문을 노출하지 않는 hash-only 출력.
- `tests/platform-rich-preservation.integration.test.ts`: 비어 있지 않은 LOCAL MOCK의 원문/4종 Snapshot/보고서/협약/동의/Studio/첨부 복원 검증.
- `tests/workspace-views.test.ts`: 기존 Pilot 대응·미등록/미래 탭 배제 계약.
- `tests/e2e/workspace-boundary.spec.ts`: CITED/Studio에서 Pilot 미mount, 기존 Pilot 메뉴는 정상 접근.
- `docs/platform-intelligence/01-current-baseline.md`
- `docs/platform-intelligence/02-preservation-contract.md`
- `docs/platform-intelligence/03-platform-legacy-map.md`
- `docs/platform-intelligence/03-platform-legacy-occurrences.md`
- `docs/platform-intelligence/04-metric-contract.md`
- `docs/platform-intelligence/05-integration-boundary.md`
- `docs/platform-intelligence/06-stage-8-1-entry-checklist.md`
- `docs/platform-intelligence/07-validation-report.md`

작업 시작 때 존재하던 untracked `docs/PLATFORM_INTELLIGENCE_DESIGN.md`는 변경 파일에 포함하지 않는다. 그 checksum을 비교해 보존을 확인했다. 기존 테스트/기대값, Prisma schema, migration, package/lockfile, 기존 Route와 계산 함수는 변경하지 않았다. Git commit/push는 수행하지 않았다.

로컬 실행 증거는 gitignore 대상 `output/stage7-5/platform-8-0-628a100d-457e-4494-915c-837a4a80db97/`에 있다. 백업/키·복원 DB 위치는 보호된 결과 JSON에만 기록하며 Git 문서에 비밀 연결값이나 고객 원문을 넣지 않는다.

## B. 데이터 변경 및 불변 증명

**원본 운영/기존 DB 사용자 데이터 변경 없음.** 원본에 대한 조사 transaction은 READ ONLY다. 테스트·fixture 생성·수정·삭제는 `aeo_restore_test_*` DB 및 별도 파일 root에서만 수행했다. 원본 DB는 전체 public 테이블의 행/IDs/hash/DDL을 시작과 종료에 비교했다. AccessEvent/StaffSession도 제외하지 않았다.

| 증거 | 결과 |
|---|---|
| source-before 전체 dataHash | `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96` |
| source-after 전체 dataHash | `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96` |
| schemaHash | `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43` |
| 원본 table data / DDL / domain | 전부 동일 |
| 실제 원본 Project/Client/Question/Response | 1 / 1 / 9 / 5, 복원 후 동일 |
| 원본 rawText 5개 | 공백/줄바꿈 포함 hash 동일 |
| 원본 Task / PageSnapshot | 3 / 1, 동일 |
| 실제 원본 Snapshot/Report/Agreement/Consent | 없는 도메인은 EMPTY_IN_SOURCE로 명시 |
| 원본 첨부 / orphan 파일 | 0 / 0. 빈 영역은 아래 합성 fixture로 보강 |
| 기존 설계 문서 | 시작 checksum 유지 |

### 비어 있지 않은 도메인의 복원 검증

LOCAL MOCK fixture를 **복원된 테스트 DB에만** 만들었다. 기존 서비스로 질문 지도/대표 질문/Pre-Scan과 frozen Snapshot, SalesReport, 협약·동의, Baseline/Follow-up Snapshot, CITED Snapshot, Task/Proposal/Studio 버전, ClientReport/PilotOutcomeReport와 첨부 파일을 생성했다.

| 격리 backup source → 별도 restore | 수량 | ID/record hash |
|---|---:|---|
| Project / Client | 2 / 2 | 동일 |
| Question / Response / 원문 | 139 / 7 / 7 | 동일 |
| Universe / QuerySet | 1 / 1 | 동일 |
| PreScanSnapshot | 1 | 동일 |
| PilotMeasurementSnapshot (Before/After) | 2 | 동일 |
| CitedSnapshot / PageSnapshot | 1 / 2 | 동일 |
| Report (Client/Sales/Pilot) | 3 | 동일 |
| Agreement / Consent / Plan | 1 / 2 / 1 | 동일 |
| Task / Proposal | 4 / 1 | 연결·버전 포함 동일 |
| Evidence image / Pilot document | 1 / 1 | 실제 bytes/길이/SHA256·참조 동일 |

합성 fixture는 반복 E2E에 영향을 주지 않도록 그 fixture의 projectId와 새로 만든 파일만 테스트 DB에서 제거했다. 재복원된 별도 증거 DB와 암호화 백업은 보존했다. 기존 고객/원본 DB의 어떤 행도 이 정리 대상이 아니다. 이 결과는 복원 기술 검증이며 실고객 측정/협약/성과 증거가 아니다.

## C. Test 실행과 실패 분류

| 검사 | 결과 | 설명 |
|---|---|---|
| 변경 전 source unit | 128 PASS / 5 SKIP | DB/PDF 옵션 비활성, 기존 25개 파일 |
| 변경 전 복원 DB unit+PostgreSQL+PDF | 134 PASS / SKIP 0 | 기존 133 + 새 hash 보존 테스트 1 |
| 수정 후 새 복원 DB unit+PostgreSQL+PDF | 137 PASS / SKIP 0 | 기존 133 + 새 보존/복원/UI 테스트 4 |
| 변경 전 build/typecheck | PASS / PASS | source와 분리된 실행 폴더 |
| 수정 후 build/typecheck | PASS / PASS | 기존 warning 3개는 유지 |
| 변경 전 전체 E2E | 14 PASS / 2 FAIL | 기존 Pilot 모바일 + 새 패널 경계 재현 |
| 수정 후 전체 E2E | 14 PASS / 2 FAIL | 기존 Pilot 모바일 + 기존 Studio 배열 순서; 신규 경계 테스트 PASS |
| 변경 전 HEAD Studio 대조군 | 6 PASS / 3 FAIL | 원본 HEAD 화면으로 기존 Studio 3개 test를 3회 반복; 같은 순서 오류 3회 |
| 파일 모드 build | PASS | 현재 수정 화면, workspace=file/인증=격리 PostgreSQL |
| 파일 모드 E2E | 2 PASS / FAIL 0 | 기존 고객 CRUD/저장·재조회·CSV + 새 workspace 경계 |
| 신규 검증 스크립트 문법 | PASS | node --check 2개 |

### 해결한 위험

`workspace.tsx`의 CITED tab 35에서 기존 조건 `tab>=28` 때문에 PilotPanel이 mount되어 Pilot API를 2회 호출했다. 새 E2E가 수정 전 이를 재현했다. 기존 tab 28~34만 매핑하도록 수정한 후 같은 검사와 기존 Pilot 메뉴 접근 검사가 통과했다.

### 해결하지 않은 기존 실패

1. `tests/e2e/pilot.spec.ts:50`: 390px에서 문서 가로 폭이 viewport를 초과함. 변경 전부터 실패했고 수정 후에도 동일. 관련 CSS/기존 기대값은 수정하지 않았다.
2. `tests/e2e/studio.spec.ts:49`: 기존 프로젝트의 tasks 배열 순서만 달라져 deep equality 실패. `db.loadDb`가 해당 관계에 orderBy를 지정하지 않는다. post에서 관측한 뒤 **변경 전 HEAD를 별도 복원 DB에서 3회 실행하여 같은 실패를 재현**했다. ID·필드값의 실제 변경과 반환 순서의 비결정성을 구분한다. 테스트를 무조건 통과시키도록 정렬하거나 기대값을 완화하지 않았다.

새 테스트의 JavaScript 반환 타입 참조 오류로 첫 post build가 한 번 실패했으나 새 테스트 코드만 보완했다. 최종 build/typecheck는 통과했다. 최초 오류 로그는 `attempt1-post-refactor-build.log`로 보존했다.

**E2E 전체 green이라고 보고하지 않는다.** 이번 최소 UI 변경으로 새로 발생한 데이터/Route 회귀는 확인되지 않았지만 위 기존 실패들은 별도 추적해야 한다.

## D. Prisma / DB / Migration

- Prisma schema SHA256: `5a4f0156617b662fddcc40507f1cc5fc33a3af26eeb0e205ac2094e4c3af7ba7`, 변경 없음.
- 실제 DB와 복원 DB: public 테이블 18, 컬럼 94, 인덱스 22, PK 18, FK 18.
- Unique: PK 포함 unique index 21개, 이 중 추가 unique는 MeasurementBatch(projectId,idempotencyKey), StaffSession(tokenHash), StaffUser(namespace,username). 별도 contype=u 제약은 0개이므로 unique index도 함께 점검했다.
- PostgreSQL catalog의 NOT NULL 제약도 원본/복원 비교에 포함했다.
- Prisma 대 복원 DB migrate diff: exit 0 / empty. read-only 비교이며 생성/적용한 migration은 없다.
- 디스크 SQL은 `20261008_stage5` 한 개. 실제 `_prisma_migrations` 테이블은 없음. 과거 적용 이력은 확인 불가하며 복구/생성하지 않았다.
- 실제 DDL·column default/type/nullability·모든 indexdef·FK 정의는 01 및 보호된 JSON에 있다. 기존 integrated backup의 일반 테이블/제약/인덱스 복원은 성공했다.

## E. 남은 위험과 8-1 전 조건

### 하드 blocker

원본 보존/복원/현재 schema 일치에 대한 미확인 하드 blocker는 없다. 다만 이 판정이 신규 DDL 적용이나 외부 API 활성화를 승인하는 것은 아니다.

### 경고

- 전체 migration history가 없으므로 **새 schema 변경 전** baseline/재현 전략을 확정해야 한다.
- Pilot 모바일 overflow 및 Studio 순서 민감성 기존 실패를 이슈로 유지한다. 이후 UI나 저장/정렬을 바꿀 때 각각 별도 작업/회귀 범위로 해결해야 한다.
- 원본에 없는 도메인의 실제 고객 데이터 복원은 검증하지 못했다. 비어 있지 않은 synthetic 도메인은 통과했으며 이를 실고객 실증으로 표현하지 않는다.
- 동적 파일 추적 경고와 공개 배포 보안/배포 파일 범위는 별도다.
- 이번 코드 변경은 저장 계층에 손대지 않았다. 새 repository 구현 때 file mode 동작과 원 transaction/lock/atomicity를 다시 검증해야 한다.

## F. Entry Gate

[06-stage-8-1-entry-checklist.md](./06-stage-8-1-entry-checklist.md)의 개별 PASS/WARN 판정에 따른다. 보존 계약, raw platform map, metric/snapshot 경계, repository ownership, UI 경계 확인, 기존 Route 불변은 PASS다. migration 이력과 suite 전체 green 상태는 WARN다. FAIL을 숨겨 PASS로 승격시키지 않았다.

## G. 최종 판정

**READY_WITH_WARNINGS**

8-0의 보존 증거와 안전한 확장 경계를 마련했다. 8-1은 이 경고를 명시적으로 추적하는 조건에서 플랫폼/채널/legacy alias의 제한된 단계로 착수할 수 있다. 기존 raw 값 자동 치환, 과거 hash 재계산, Platform Score, 실제 AI 호출, 새 Migration/Table 생성은 이번 단계에 포함되지 않는다. 전체 E2E 완전 통과를 전제로 하는 릴리스/배포는 현재 결과로 승인할 수 없다.
