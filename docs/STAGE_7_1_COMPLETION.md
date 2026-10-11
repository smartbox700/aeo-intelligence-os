# AEO Intelligence OS — 7-1단계 구현·검증 보고서

검증일: 2026-10-09 (KST). 기존 1~6단계를 유지하며 데이터 보존, 백업/격리 복원, 관측 검증, 확정 보고서의 통계 신뢰성을 강화했다. 신규 영업 기능은 개발하지 않았다.

**현재 상태: 사용자의 명시적 승인 후 실제 개발 DB의 영속 폴더 이전과 재시작·데이터 보존·회귀 검증까지 성공하여 7-1단계를 완료했다.** 2026-10-09 15:43 KST에 앱을 중지하고 다른 DB 연결이 없음을 확인한 후 최신 백업 생성→별도 DB 복원 검증→원본 정상 종료→영속 폴더 복사→재시작·전체 데이터 대조를 수행했다. 원본 DB 폴더와 백업은 삭제하지 않았다. 관리자 설치·운영 DB 변경·7-2 개발은 수행하지 않았다.

## 1. 기존 프로젝트의 문제점

- 실제 서버 데이터가 Windows Temp 폴더에 있어 임시 파일 정리 시 손실 위험이 있었다. 영속 개발 경로와 기존 데이터 이전 절차가 필요했다.
- 내부 연구 집계와 고객 제출 통계의 검증 기준이 충분히 구분되지 않았다. 기존 VERIFIED만으로 실제 출처 대조 여부를 보장할 수 없었다.
- 보고서에 사용할 질문 세트, 유효 관측 질문 수, 제외 사유, 계산 버전의 명시가 부족했다. 등록 질문 수와 관측 표본 수를 혼동할 여지가 있었다.
- 관측 방식이 섞인 격차 분석, 내부 원문·검증 메모 등의 고객 제출 노출, 과거 보고서의 외부 승인 경로를 강화할 필요가 있었다.
- 백업 복원 후 전체 행·ID·관계 비교와 별도 서버 재시작 검증이 필요했다.

근거 검토: `docs/BUSINESS_WORKFLOW_AUDIT.md`, `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/store.ts`, `src/lib/visibility.ts`, `src/lib/research-metrics.ts`, `src/lib/optimization.ts`, `src/lib/client-report.ts`, 관련 API·화면·기존 테스트.

## 2. 수정·추가한 코드 파일

아래 경로는 프로젝트 루트 `C:\Users\zhang\Downloads\AEO 마케팅 프로그램\AEO 마케팅 프로그램` 기준이다.

| 파일 | 변경 내용 |
|---|---|
| `scripts/db-runtime.mjs` | 환경 연결, 접근 제한 폴더, 네이티브 도구 실행, 일관된 행/ID/스키마 해시, 논리 아카이브/복원 |
| `scripts/local-postgres.mjs` | 사용자 영역 영속 개발 데이터 경로, 기존 임시 DB 발견 시 빈 DB 자동 생성 방지, 환경 자격증명 |
| `scripts/db-admin.mjs` | health, 백업, 체크섬 확인 및 격리 DB 복원/비교 |
| `scripts/db-migrate-local.mjs` | 승인 후에만 실행하는 임시→영속 cold copy, 원본 보존·일치 검증·실패 복구 시도 |
| `scripts/db-persistence-test.mjs` | 별도 폴더/포트의 복제 서버 정상 종료·재시작·전후 해시 확인 |
| `scripts/db-preservation-check.mjs` | 기준 백업과 기존 업무 테이블 전체 행/ID/스키마 비교 |
| `src/lib/reporting-metrics.ts` | `confirmedExclusion`, `confirmedMetrics`, 단일 관측 방식·질문/플랫폼/기간 범위·중복 제거·지표 정의 |
| `src/lib/observation-verification.ts` | `verifyObservation`, 출처 대조·검증/분류 이력·행위자 기록 |
| `src/lib/client-report.ts` | 확정 통계 보고서, 표본/분모/실제 질문 스냅샷, 비공개 내용 제외, 비밀 값 가림 |
| `src/lib/research-metrics.ts` | `compareStudy`에 검증된 동일 조건 대응 쌍 비교 옵션 |
| `src/lib/optimization.ts` | `analyzeGaps`/`collectOptimization`의 단일 관측 방식 범위 및 사용 ID 추적 |
| `src/lib/types.ts`, `src/lib/operations-types.ts` | 선택적 분류/검증 감사 이력/보고서 계산 메타데이터 타입 |
| `src/lib/consumer-observation.ts` | 새 소비자 관측의 기본 비공개 분류 |
| `src/app/api/observations/route.ts` | 검증 저장 및 `purpose=confirmed` 조회, 프로젝트 권한 검사 유지 |
| `src/app/api/optimization/route.ts` | 관측 분석 범위 입력과 질문 소속 검증 |
| `src/app/api/client-reports/route.ts` | 다운로드 권한/키 가림, 이전 실제 보고서의 VIEWER 외부 공개 제한 |
| `src/app/api/operations/route.ts` | 확정 정책 메타데이터 없는 이전 실제 보고서 외부 승인 제한 |
| `src/app/api/workspace/route.ts` | 새 수동 관측 기본 비공개 분류 |
| `src/components/consumer-lab.tsx`, `workspace.tsx` | 출처 대조 체크·분류 선택·검증 저장 UI, 내부 연구 안내 |
| `src/components/operations-panel.tsx` | 보고서 질문/플랫폼 선택과 확정 통계 안내 |
| `src/components/measurement-lab.tsx` | API 내부 연구 통계와 고객 제출 통계 구분 안내 |
| `tests/reporting.test.ts`, `tests/e2e/reporting.spec.ts` | 새 7-1 단위 시험 9개 및 브라우저 통합 시험 1개 |
| `package.json`, `.gitignore`, `docs/DB_OPERATIONS.md` | DB 운영 명령, 데이터/백업/환경/키 Git 제외, 복구 절차 |

`prisma/schema.prisma`와 `.env`는 변경하지 않았다. 기존 JSON payload의 선택적 필드를 활용하여 schema push/reset/migration을 실행하지 않았다. 검증 이력이 없는 과거 자료를 자동 VERIFIED로 승격하거나 공개 분류로 전환하지 않았다.

## 3. PostgreSQL 영속화 방식과 현재 적용 상태

기본 영속 경로는 `C:\Users\zhang\AppData\Local\AEOIntelligenceOS\postgres\development`. `AEO_STATE_DIR`, `AEO_PG_DIR`, `AEO_PG_BIN`으로 조정 가능하다. 기존 embedded-postgres의 PostgreSQL 바이너리를 사용자 영역에서 사용하며 관리자 설치/Windows 서비스 등록을 하지 않았다. 개발 실행기는 production을 거부하고 loopback 연결만 허용한다. 계정·비밀번호·DB·포트는 `DATABASE_URL`에서 읽는다.

최종 `npm run db:health` 결과의 실제 사용 경로는 **`C:/Users/zhang/AppData/Local/AEOIntelligenceOS/postgres/development`**, `temporary: false`다. 기존 원본 `C:/Users/zhang/AppData/Local/Temp/aeo-intelligence-os-postgres`는 정상 종료된 상태로 보존했다.

사용자 승인 후 앱 리스너를 중지하고 DB의 다른 연결 0건을 확인하여 `npm run db:migrate:local -- --approved`를 실행했다. 이전기는 최신 백업의 별도 DB 복원과 ID/관계 일치까지 확인해야만 원본을 정상 종료하도록 강화했다. 원본을 비어 있는 영속 대상에 복사하여 동일 포트로 시작했고 전체 행/ID/관계/스키마 일치를 확인했다. 오류는 발생하지 않았다. 실패 시 새 서버를 중지하고 원본 재시작을 시도하는 복구 절차와 원본 보존 규칙을 유지했다.

영속 폴더는 재부팅 후 남지만 서버 자동 시작은 등록하지 않았다. 이후 `node scripts/local-postgres.mjs`와 `npm start`를 실행한다. 운영 환경은 별도 DB·자격증명·백업 정책이 필요하다.

## 4. 기존 데이터 보존 여부

기준 백업과 최종 E2E 완료 후 현재 DB의 16개 비휘발 업무 테이블은 전체 행 SHA-256과 모든 ID가 일치했다. 스키마/제약/인덱스 해시도 일치했다. 비교 도구는 로그인/접근 기록인 `StaffSession`, `AccessEvent`만 불변 비교에서 제외하며, 이번 최종 개수는 이 두 테이블도 기준과 같았다.

| 주요 모델 | 기준 / 최종 개수 |
|---|---:|
| Project / ClientEntity | 1 / 1 각각 |
| Question / QuestionSet | 9 / 9, 1 / 1 |
| AIResponse / ObservationRun | 5 / 5 각각 |
| WebsiteAudit / OptimizationTask | 2 / 2, 3 / 3 |
| CitationSource / Mention / CompetitorEntity | 5 / 5, 7 / 7, 2 / 2 |
| Report / MeasurementBatch | 0 / 0 각각 |
| AIProvider / Organization / StaffUser | 5 / 5, 1 / 1, 1 / 1 |
| AccessEvent / StaffSession | 10 / 10, 1 / 1 |

전체 원본 데이터 해시: `792bf5da25b8aa6874e372108b20c5ee48d91fa443c30e17463be9622462b8ff`.
스키마 해시: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`.

E2E는 별도 LOCAL MOCK/DEMO 프로젝트만 만들고 시험 후 해당 시험 자료를 정리했다. 기존 고객사 자료는 수정/삭제하지 않았다. 재시작 시험용 Report 1건은 격리 복제 DB에만 넣었으며 원본 Report는 여전히 0건이다.

## 5. 백업 및 복원 테스트 결과

최신 이전 직전 백업: `C:\Users\zhang\AppData\Local\AEOIntelligenceOS\backups\aeo-2026-10-09T06-43-24-507Z-d6b469e2-b13e-42ab-8ae1-e8f558ea0a34.aeo.gz`.
옆에 `.aeo.gz.manifest.json`, `.aeo.gz.restore-test.json`이 있다.

최신 복원 대상: `aeo_restore_test_bbc33d99f8fd4896b95b5e4232496d89`. 결과 `ok/dataMatches/schemaMatches/idsAndRelationsMatch/sourceUntouched = true`. 기존 DB를 덮어쓰지 않고 새 UUID DB로 복원했다. 체크섬, 18개 테이블 전체 개수·행·ID·FK/제약이 일치했다. 독립 인덱스 4개의 정의도 백업·복원 DB·영속 DB 사이에 별도 대조하여 모두 일치했다. 인덱스 정의 해시: `712b616b369fbb1f298749fb5096b05c48b88165176d5ece73696ee325706f58`. 격리 DB와 이전 백업도 보존했다.

실제 영속 DB는 15:43:56 KST에 정상 종료→재시작하여 전체 18개 테이블의 개수/ID/행 해시와 스키마 해시가 일치함을 확인했다. 결과는 `C:\Users\zhang\AppData\Local\AEOIntelligenceOS\persistent-restart-result.json`, 이전 결과는 같은 루트의 `migration-result.json`에 있다. 원본 Report는 0건 그대로이며 기존 격리 재시작 시험의 Report 1건과 구분한다.

최종 재시작 시험은 `C:\Users\zhang\AppData\Local\AEOIntelligenceOS\postgres\restart-test-56343da9-9026-4bfc-915a-50e9fb9c25f3`, 별도 포트 63176에서 수행했다. 현재 데이터 복제본에 명백히 LOCAL MOCK인 Report 1건을 추가한 뒤 정상 종료→재시작했고 전체 데이터·스키마가 일치했다. 시험 서버만 정상 종료했다. 결과는 state 루트의 `restart-test-result.json`에 있다.

백업은 현재 스키마를 지원하는 gzip 논리 아카이브다. 번들에 pg_dump/pg_restore가 없어 새 설치 없이 구현했다. public 일반 테이블·행·열 형식/기본값/NOT NULL·PK/unique/check/FK·독립 인덱스를 REPEATABLE READ 스냅샷으로 저장한다. sequence/view/materialized view/partition/foreign table/custom enum/domain/public routine/사용자 trigger/identity/generated 열은 발견 시 실패한다. 역할·권한·owner·public 외 스키마·확장 전체는 백업 범위가 아니다. 향후 스키마 확장/운영 배포에서는 공식 pg_dump 기반 절차를 마련해야 한다.

백업은 저장소 밖의 `AEO_BACKUP_DIR`을 지원하고 Windows 폴더 상속을 제거하여 현재 사용자와 SYSTEM만 접근하도록 한다. 암호화 자체는 구현하지 않았다. 자동 백업·Windows 스케줄러 등록은 하지 않았다. 매일 백업·주간 격리 복원·별도 암호화 사본을 제안하며 세부 절차는 `docs/DB_OPERATIONS.md`에 있다.

## 6. AI 데이터 검증 방식

내부 연구 화면은 UNVERIFIED를 포함할 수 있고 안내 배너로 표시한다. 고객 제출용 실제 보고서는 `confirmedExclusion`을 적용한다. UNVERIFIED/REJECTED/DEMO/INACCURATE/INTERNAL, 출처 정보 부족, 프로젝트·질문 소속 오류, 원문/모델/지역/시각 부족, 실제 질문 스냅샷 부재, 업체 식별 미완료, 기존 API 정보 부족 등은 제외한다. 동일 관측 이벤트를 새 입력 키로 저장한 중복도 확정 표본에서 제외한다. 서로 다른 시각의 반복 관측은 별개 표본일 수 있다.

VERIFIED에는 검증자·근거·시각·`sourceConfirmed: true`가 필요하다. 사람이 화면/출처/조건/원문을 실제 대조했음을 명시적으로 확인해야 한다. 프로그램이 외부 AI의 실제 출처를 자동 인증하는 것은 아니다. 소비자 관측에는 관측자와 다른 검증자 이름을 요구한다. 로그인 행위자 ID를 이력에 기록한다. 역할 OWNER/MANAGER만 검증을 저장할 수 있다.

검증 저장은 원문을 변경하지 않고 상태/근거/행위자/분류 변경 이력을 누적한다. 기본 분류는 CLIENT_CONFIDENTIAL이며 PUBLIC_RESEARCH/INTERNAL로의 변경은 명시적 입력과 이력으로 관리한다. PUBLIC_RESEARCH 선택 자체가 외부 공유나 Benchmark 공개를 실행하지 않는다. 기존 자료는 기본 비공개로 해석하고 자동 변경하지 않는다.

## 7. 확정 보고서의 통계 계산 방식

계산 버전은 `verified-observation-v1`. 실제 보고서는 관측 방식 하나, 선택 질문 ID, 플랫폼 필터, KST 기간을 저장하고 동일 범위의 검증 유효 응답만 사용한다. 등록/선택/유효 측정 질문 수, 유효 응답 수, 제외 수·ID·사유, 실제 질문 스냅샷을 보존한다. 분모 0은 null 및 “검증된 관측 데이터 없음”이며 0%로 포장하지 않는다.

| 지표 | 분자 / 분모 |
|---|---|
| Brand Mention Rate | 확정 고객 언급 응답 / 검증된 유효 응답 |
| Recommendation Inclusion Rate | 확정 고객 추천 후보 응답 / 검증된 문맥 분석 완료 응답 |
| Official Citation Rate | 자사 공식 호스트 인용 응답 / 검증된 유효 응답 |
| First Mention Rate | 명시적 번호 1번의 고객 추천 응답 / 명시적 추천 번호가 있는 검증 응답 |
| Query Coverage | 검증된 고객 언급이 있는 서로 다른 질문 / 검증 관측이 있는 서로 다른 질문 |
| 선택 세트 측정 커버리지 | 유효 측정 질문 / 선택 질문 |

등록120·선택30·측정30 사례에서 관측 표본은30이며120을 관측 분모로 사용하지 않는다. 선택120·측정30이면 측정 커버리지25%이며 Query Coverage 분모는 실제 측정 질문30이다. API/소비자 웹 UI/수동 입력을 별도로 처리하고 다중 플랫폼·모델·지역·검색 조건에는 경고한다. Baseline/Follow-up은 검증된 동일 조건의 대응 쌍으로 비교하며 작은 표본/모델 미표시/조건 변경 한계를 표시한다.

`analyzeGaps`도 실제 분석에서 관측 방식 하나를 선택하고 `gap-rules-v2-single-method` 및 사용 관측 ID를 저장한다. 명시적 질문·플랫폼·기간·confirmed 범위를 받을 수 있다. 고객/경쟁사 홈페이지 진단의 프로젝트·대상 구분을 유지한다. 기존 작업/진단 연결 ID는 내부 보고서 payload에 보존한다. Retrieval Presence나 추천 확률/임의 종합 성과 점수를 만들지 않았다.

## 8. DEMO/실제 구분과 고객사 자료 보호

DEMO 프로젝트는 DEMO 보고서만, CLIENT 프로젝트는 실제 방식 보고서만 생성한다. DEMO 보고서는 DEMO_PREVIEW, 실제 보고서는 EXTERNAL_CONFIRMED 정책을 저장한다. 기존 실제 보고서 원본은 삭제하지 않지만 확정 정책 메타데이터가 없는 이전 보고서는 VIEWER 외부 조회/신규 승인에서 제한하고 새 정책으로 다시 생성하도록 한다.

외부 HTML에는 관측 원문, 내부 검증 근거/증빙, 작업 메모, 연락처, 원가/계약 내용을 자동 포함하지 않는다. 고객이 승인한 개선안은 섹션과 승인 버전만 요약한다. 저장/다운로드 시 알려진 비밀 환경 값과 키/DB URL 패턴을 가린다. 프로젝트 접근 검사와 역할 제한을 유지하며 다른 프로젝트 보고서 요청을 거부한다. 내부 스태프 조회 API는 해당 프로젝트의 권한 있는 직원용이고 고객 포털/공유 기능이 아니다.

## 9. 단위·통합·E2E 결과

이전 후 최종 결과: 단위/실제 PostgreSQL 모의 통합 시험 **98/98 (18개 파일)**, 브라우저 E2E **10/10 (37.5초)**, TypeScript 검사 성공. E2E는 실제 UI 클릭→API 저장→DB 재조회→보고서 생성까지 확인했다. 새 CLIENT 유형 시험 자료도 LOCAL MOCK·실제 성과 아님으로 명시했으며 외부 AI를 호출하지 않았다. 첫 단위 실행에서는 통합 시험 환경 플래그가 없어 1개가 skip되어, E2E가 끝난 후 `AEO_TEST_POSTGRES=1`로 전체를 다시 실행하여 skip 없이 모두 통과했다.

| 요구 시험 | 결과 | 실행 근거 |
|---|---|---|
| T1 PostgreSQL 재시작 | PASS (실제 영속 DB 및 격리 서버) | 실제 DB 정상 종료/재시작 후 모든 행·ID/관계·스키마 일치; 이전 격리 시험에는 Report 저장도 확인 |
| T2 별도 DB 복원 | PASS | `db-admin.mjs restore-test`, 새 UUID DB 복원 성공 |
| T3 ID/관계 보존 | PASS | 복원 전체 테이블·ID·FK/스키마/인덱스 일치; 최종 원본 보존 대조 성공 |
| T4 미검증 제외 | PASS | `tests/reporting.test.ts` T4; E2E 검증 전 rowCount0→출처 확인 후1 |
| T5 DEMO 제외 | PASS | T5 실제 프로젝트 DEMO 거부, 빈 표본 null; 기존 DEMO 회귀 유지 |
| T6 방식 분리 | PASS | T6 API/UI 분리와 격차 분석 사용 ID 검사 |
| T7 120/30 분모 | PASS | T7 등록/선택/측정,25% 측정 커버리지 및 Query Coverage 분모30 확인 |
| T8 고객 비공개 분리 | PASS | T8 프로젝트 소속/키/메모/연락처 제외; E2E 다른 프로젝트 접근 거부 |
| T9 원문/감사 이력 | PASS | T9 원문 불변·검증/분류 이력; E2E actorId·DB 이력 및 이전 보고서 해시 보존 |
| T10 1~6단계 회귀 | PASS | 기존 단위89개+새9개, 기존 E2E9개+새1개 모두 성공 |
| T11 외부 AI 차단 | PASS (실제 호출0) | 기존 OpenAI/무료 Gemini 차단 단위 및 E2E; 테스트 transport는 로컬 mock |
| T12 필요한 migration 보존 | PASS (폴더 이전), 스키마 변경 N/A | 사용자 승인 후 최신 백업/복원 검증을 거쳐 실제 이전 성공; 전후 개수·ID/관계·행/스키마 해시 동일 |

시험 중 문제와 조치: pg_dump 부재로 현재 스키마 논리 아카이브와 지원 불가 유형 거부를 구현했다. initdb 비밀번호 파일을 데이터 폴더 밖에 두어 비어 있지 않은 폴더 오류를 해결했다. daemon 상속 pipe 때문에 실행 완료가 대기하던 문제를 수정했다. 다른 프로젝트 질문 자동 선택을 차단했다. 보고서 비공개 분리 중 기존 taskIds 연결 누락으로 완료 전환 회귀가 발생해 내부 연결 ID를 복구하고 E2E 재검증했다.

이전 작업 전에는 `npm run build`의 Prisma 재생성이 실행 프로세스의 DLL 잠금 때문에 한 번 EPERM으로 실패하여 기존 client로 직접 Next build를 실행했다. 이번 승인 후 앱을 중지한 상태에서는 **`npm run build` 전체(Prisma generate 및 Next production build)가 성공했다.** 기존 Prisma 동적 tracing 경고 2건은 남아 있다. 이전 작업 전 보존 확인 명령의 manifest 파일명 오류(ENOENT)도 정확한 경로로 재실행하여 해결했다.

이번 최종 시험 후 `db-preservation-check.mjs`와 `npm run db:health`를 다시 실행했다. 최신 이전 백업의 전체 데이터 해시와 현재 영속 DB 해시는 같고, 16개 업무 테이블의 행/ID 불변 및 스키마 일치를 확인했다. 18개 테이블 전체 counts/dataHash는 위 기준 그대로이며 두 휘발 테이블도 이번에는 변화가 없다. 앱은 영속 DB에 연결하여 포트3000으로 다시 시작했다.

## 10. 해결되지 않은 위험

1. 실제 사용 DB의 Temp 의존은 해결했다. 보존한 원본 임시 폴더를 이전 이후 최신 DB로 오인하여 시작하지 않아야 한다. 현재 연결 경로는 health로 확인한다. 원본과 백업 정리는 이번 작업에서 하지 않았다.
2. 백업은 암호화되지 않았다. 접근 제한은 적용했지만 실제 고객 운영에는 별도 암호화 사본·보존 기간·디스크 용량·복원 책임자 정책이 필요하다. 시험 복제본도 민감 자료이며 자동 삭제하지 않았다.
3. 현 논리 백업은 현재 public 일반 테이블 스키마용이다. 범용 pg_dump·역할/권한/확장 백업을 대체하지 않는다.
4. VERIFIED는 사람의 명시적 대조 기록이다. 실제 관측 진위를 자동 보증하거나 검증자 이름이 별도 사람임을 신원 인증하지는 않는다. 실제 고객 자료를 조사하여 자동 VERIFIED로 전환하지 않았다.
5. 환경/패턴 키 가림은 보조 수단이다. 내부 입력에 임의 비밀을 적지 않아야 하며 원문을 포함하는 백업/직원 CSV 등은 권한 있는 내부 자료로 관리한다.
6. 재부팅 자동 시작/백업 스케줄러, 운영 DB 서비스, Benchmark 공유, 신규 플랫폼 연동은 구현하지 않았다. Prisma DLL 잠금 및 production 배포 tracing 경고는 별도 배포 검증이 필요하다.

## 11. 사용자가 직접 확인할 방법

앱은 `http://127.0.0.1:3000/`으로 다시 시작했다. 기존 로그인과 프로젝트 선택을 사용한다.

1. AI 실측 연구소/응답 화면에서 내부 연구 배너, 관측 유형, 검증 상태를 확인한다. OWNER/MANAGER가 검증자·근거·출처 대조 체크를 입력하고 저장하면 상태/이력이 기록되며 원문은 유지된다.
2. 고객사 보고서에서 실제 관측 방식·기간·질문·플랫폼을 선택하여 새 원본 버전을 생성한다. 미검증 자료뿐이면 “검증된 관측 데이터 없음”을 확인한다. 검증 자료가 있으면 분자/분모·등록/선택/측정 질문 수·계산 버전·조건을 확인한다. 합성 자료를 실제 성과로 사용하지 않는다.
3. 프로젝트 루트에서 `npm run db:health`로 실제 dataDirectory가 사용자 영역 `AEOIntelligenceOS/postgres/development`이고 temporary false임을 확인한다.
4. `npm run db:backup`, `npm run db:restore:test -- '백업.aeo.gz'`, `npm run db:restart:test`로 수동 백업/격리 검증을 수행한다. 상세 설정과 실패 복구는 `docs/DB_OPERATIONS.md`를 따른다.
5. 실제 DB 이전은 이번 승인으로 완료했다. 같은 이전 명령을 다시 실행하지 않는다. 데이터 폴더 삭제, db push/reset, 덮어쓰기 복원을 실행하지 않는다.

## 12. 7-2단계 준비 상태

질문 범위·검증 상태·분류·계산 버전·제외 사유·단일 관측 방식·실제 DB 영속화·보존/복원 시험 기반을 갖췄다. 기존 진단·분석·개선·실행 스튜디오·납품 연결은 이전 후 회귀 시험으로 유지됨을 확인했다. 실제 고객 온보딩 전 정기 백업/복원 운영을 정해야 한다. 7-2단계는 시작하지 않았다.

120개 질문 생성기, 30개 Pre-Scan 자동화, 2페이지 영업 PDF, Pilot 계약, SaaS 구독, 네이버·쿠팡 신규 연동, 파트너 포털은 추가하지 않았다. LIVE_AI_ENABLED=false와 FREE_GEMINI_ENABLED=false를 유지했고 유료/무료 외부 AI 호출은 0회다. 7-2와 “실전기능 시리즈a”의 사업 기능 구현을 자동 시작하지 않는다.
