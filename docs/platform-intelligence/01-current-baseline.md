# 8-0 현재 시스템 Baseline

기준일: 2026-10-15 / Asia-Seoul. Platform Intelligence 기능을 구현하지 않는 보존 단계다.

## 시작 기준

| 항목 | 시작 값 |
|---|---|
| Git HEAD | `96eb523b40c6f0904ef0104bd411d2e7e4a067e6` |
| Working tree | `?? docs/PLATFORM_INTELLIGENCE_DESIGN.md` |
| package version | 0.1.0 |
| Node / npm | v22.20.0 / 10.9.3 |
| STORAGE_MODE / DB profile | postgres / development (default); local host |
| 실제 설치 버전 | next 16.4.0, react 19.3.0, typescript 5.9.3, @prisma/client 6.19.3, vitest 3.2.7, @playwright/test 1.64.0 |
| 시작 시각(KST) | 2026-10-15 10:17:29 |

### 시작 체크섬 (SHA256)

| 파일 | SHA256 |
|---|---|
| `prisma/schema.prisma` | `5a4f0156617b662fddcc40507f1cc5fc33a3af26eeb0e205ac2094e4c3af7ba7` |
| `src/lib/db.ts` | `c8c426c0f35ffd3d2adfc152bed94eb66bc15fa9c0950500d4798b81de7e1917` |
| `src/lib/store.ts` | `1e5a4c203a3096025e254019460e453b69407f94d9036a3bf3091cc69d1b0451` |
| `src/lib/types.ts` | `9df14fc4d35582e83e2ae994163a3f0bcbbe4c7cd82f616d103572121de58612` |
| `src/lib/prescan.ts` | `7a14dd026e8917c8e2caac7bcc6ef0fa2cd01e48a13e51204311478445baa02a` |
| `src/lib/consumer-observation.ts` | `6ad7d769e032837ec3737590cd27fefe6413a6658028958190054b00268827bf` |
| `src/lib/reporting-metrics.ts` | `a7e7a21a4234416caa817c08ba4cb2005de52524a34da339ad3c37c9f38cd3eb` |
| `src/lib/pilot-measurement.ts` | `4e2d363867eec1285d02687b8bf1b5ba433ddb84c909e826b40915723a7ea092` |
| `src/lib/sales-report.ts` | `84215fd99f883c26f28185d4727f91cacb729ec0c06726612bc9183dbcaed7ff` |
| `src/lib/client-report.ts` | `b1067fcc6fa93f7da25d1b134ebecc4e36ff7fa10e7bfe7033a037e456883d86` |
| `src/lib/cited-project.ts` | `6adeb4b1edff2180d0547a850949f3d21871f80116a8ad06cfefe128e2605cbb` |
| `src/components/workspace.tsx` | `3282d90e8f8eccd020850cbd21f7aa099f76978f50ddc67dc653a8399479c04e` |

전체 tracked 파일 manifest는 protected start.json에 있다. 기존 untracked 설계 문서의 hash는 `9363372a7c8dfbeb284ef734ee465609903868b6da5c4f72f982bec35ab76eca`이며 변경하지 않았다.

시작 시 untracked 상태였던 `docs/PLATFORM_INTELLIGENCE_DESIGN.md`는 사용 중인 기존 설계 자료로 취급해 그대로 보존한다. reset/clean/revert 또는 자동 commit/push를 하지 않는다. 이전 보고서의 ‘17개 모델’은 집계 오류이며 실제 Prisma와 복원 DB는 **18개**다. 이 문서에서 정정하고 원문 보고서는 수정하지 않는다.

## 기존 도메인 소유 위치와 ID/hash/version

프로젝트 루트: `C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램`.

| 영역 | 실제 source | 고정할 식별자·버전·연결 |
|---|---|---|
| Organization/Project | prisma/schema.prisma, src/lib/db.ts | organizationId, Project.id, local-org 소속 |
| Client/Competitor | src/lib/types.ts, db.ts | ClientEntity.id/projectId, competitor.id, 별칭과 공식 URL |
| QuestionSet/Question | schema.prisma, db.ts | setId=`projectId-questions`, Question.id/text/payload. DB QuestionSet≠논리 QuerySetVersion |
| Universe/QueryCandidate | prescan-types.ts, prescan.ts | Universe.id/version, question.id, INTENT_HYPOTHESIS/HUMAN, 제외·유사도 |
| 대표 질문 | prescan.ts:confirmSet | QuerySet.id/version/universeId, 30개 question IDs와 선정 이유 |
| Pre-Scan/Slot | prescan.ts:createPreScan | scan.id/setId/studyId, 3개 screen raw 값, 슬롯 id/status |
| PreScanSnapshot | prescan.ts:createSnapshot/freezeSnapshot | id/scanId/sha256/frozen/data; canonicalSnapshot 계약 |
| Response/Run | types.ts, db.ts, consumer-observation.ts | ResponseRecord.id=관계형 runId, questionId, kind, 원문/시각/provider |
| Mention/Citation | schema.prisma, db.ts, entity-analysis.ts | Mention.id/responseId/entityId/position, CitationSource.id/responseId/url |
| Consumer Observation | consumer-observation.ts, research.ts | screen, actualQuestion, studyId/phase/repetition, inputKey/inputHash, evidenceIds |
| Manual Observation | validation.ts, api/workspace/route.ts | MANUAL_UI/MANUAL_OBSERVATION, 수동 추천/예약 관측과 근거 |
| API Observation | providers.ts, measurement-service.ts, openai-provider.ts | batch.id/idempotencyKey, apiResponseId, requestId, measurement.status, API_OBSERVATION 분리 |
| ClientReport | client-report.ts, operations-types.ts | id/type/version/kind, html/sha256, reporting.version/scope, 승인 이력 |
| SalesReport | sales-report.ts, sales-types.ts | id/version, snapshotId/Hash, dataHash, sourceFingerprints, PDF artifact hash |
| PilotOutcomeReport | pilot-report.ts, pilot-types.ts | id/agreementId/version, html/sha256/dataHash/sourceHash, approval |
| Task/Proposal/Execution | operations.ts, operations-types.ts | taskId/auditId, proposalId/versions, approval.version, execution.history |
| StudioWork | studio-workflow.ts, studio-types.ts | pageId/questionId/proposalId, draft version, exports/deployment/verification version |
| Evidence/Document | evidence.ts, pilot-documents.ts | evidence/document.id, projectId, storageName, sha256/bytes, 파일 소속 |
| Agreement/Consent | pilot-agreement.ts, pilot-common.ts | agreement.id/clientId/projectId, versions, consent.id/category/decision/scope/기간 |
| MeasurementPlan/Before/After | pilot-measurement.ts, research-metrics.ts | plan.id/version/studyId/setVersion/sha256, phase, condition hash, Snapshot fingerprint |
| PaidProposal/Conversion | pilot-sales.ts | proposal.id/version/outcomeHash, contract.id, inheritance의 기존 ID 연결 |
| Auth | auth.ts, api/auth/route.ts | OWNER/MANAGER/ANALYST/VIEWER, projectIds, namespace, session, AccessEvent |
| CITED 연결 | cited-project.ts, api/cited-diagnosis/route.ts | CitedSnapshot.id/digest/responseIds. 수동 체크≠검증된 성과 |

## 실제 DB 확인

원본 연결은 `REPEATABLE READ READ ONLY` 안에서 catalog와 전체 행의 해시만 읽는다. 테스트 writer/빌드 서버는 원본 URL을 사용하지 않는다. 최초 연결은 ECONNREFUSED였으며 기존 PG_VERSION을 확인한 후 서비스 시작을 시도했다. pg_ctl 시작 명령은 exit 1을 보고했으나 이후 읽기 전용 연결/백업/복원은 성공했다. 초기화·reset은 실행하지 않았다.

- DB: PostgreSQL 18.4 on x86_64-windows, compiled by msvc-19.44.35226, 64-bit
- Prisma 선언 모델 18 / 실제 public 테이블 18; 컬럼 94; 인덱스 22.
- PK 18, FK 18, NOT NULL catalog 제약 84.
- unique index 21(PK 18 + 추가 unique 3); pg_constraint contype=u인 별도 UNIQUE constraint는 0. 유일성은 실제 unique index도 확인했다.
- _prisma_migrations: 없음.
- 원본/복원 schemaHash: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`.

### 실제 테이블/컬럼 inventory

| 테이블 | 컬럼(이름: PostgreSQL 타입; ?는 nullable) |
|---|---|
| AIProvider | `id:text`, `name:text` |
| AIResponse | `id:text`, `runId:text`, `questionId:text`, `rawText:text`, `analysisVersion:text`, `payload:jsonb` |
| AccessEvent | `id:text`, `namespace:text`, `userId:text?`, `projectId:text?`, `action:text`, `success:bool`, `at:timestamp` |
| CitationSource | `id:text`, `responseId:text`, `url:text`, `title:text?` |
| ClientEntity | `id:text`, `projectId:text`, `name:text`, `payload:jsonb` |
| CompetitorEntity | `id:text`, `projectId:text`, `name:text`, `payload:jsonb` |
| MeasurementBatch | `id:text`, `projectId:text`, `idempotencyKey:text`, `status:text`, `startedAt:timestamp`, `payload:jsonb` |
| Mention | `id:text`, `responseId:text`, `entityId:text`, `role:text`, `position:int4`, `ambiguous:bool`, `name:text` |
| ObservationRun | `id:text`, `projectId:text`, `providerId:text`, `kind:text`, `observedAt:timestamp`, `region:text`, `model:text`, `cost:numeric?`, `batchId:text?`, `status:text`, `searchUsed:bool?`, `metadata:jsonb?` |
| OptimizationTask | `id:text`, `projectId:text`, `auditId:text`, `status:text`, `payload:jsonb` |
| Organization | `id:text`, `name:text` |
| Project | `id:text`, `organizationId:text`, `name:text`, `operations:jsonb?` |
| Question | `id:text`, `setId:text`, `text:text`, `payload:jsonb` |
| QuestionSet | `id:text`, `projectId:text`, `name:text` |
| Report | `id:text`, `projectId:text`, `kind:text`, `createdAt:timestamp`, `rowCount:int4`, `payload:jsonb?` |
| StaffSession | `id:text`, `tokenHash:text`, `userId:text`, `expiresAt:timestamp`, `createdAt:timestamp` |
| StaffUser | `id:text`, `namespace:text`, `username:text`, `name:text`, `role:text`, `passwordHash:text`, `projectIds:_text?`, `disabled:bool`, `createdAt:timestamp` |
| WebsiteAudit | `id:text`, `projectId:text`, `kind:text`, `payload:jsonb` |

### 실제 index 정의

```sql
CREATE UNIQUE INDEX "AIProvider_pkey" ON public."AIProvider" USING btree (id);
CREATE UNIQUE INDEX "AIResponse_pkey" ON public."AIResponse" USING btree (id);
CREATE INDEX "AccessEvent_namespace_at_idx" ON public."AccessEvent" USING btree (namespace, at);
CREATE UNIQUE INDEX "AccessEvent_pkey" ON public."AccessEvent" USING btree (id);
CREATE UNIQUE INDEX "CitationSource_pkey" ON public."CitationSource" USING btree (id);
CREATE UNIQUE INDEX "ClientEntity_pkey" ON public."ClientEntity" USING btree (id);
CREATE UNIQUE INDEX "CompetitorEntity_pkey" ON public."CompetitorEntity" USING btree (id);
CREATE UNIQUE INDEX "MeasurementBatch_pkey" ON public."MeasurementBatch" USING btree (id);
CREATE UNIQUE INDEX "MeasurementBatch_projectId_idempotencyKey_key" ON public."MeasurementBatch" USING btree ("projectId", "idempotencyKey");
CREATE UNIQUE INDEX "Mention_pkey" ON public."Mention" USING btree (id);
CREATE UNIQUE INDEX "ObservationRun_pkey" ON public."ObservationRun" USING btree (id);
CREATE UNIQUE INDEX "OptimizationTask_pkey" ON public."OptimizationTask" USING btree (id);
CREATE UNIQUE INDEX "Organization_pkey" ON public."Organization" USING btree (id);
CREATE UNIQUE INDEX "Project_pkey" ON public."Project" USING btree (id);
CREATE UNIQUE INDEX "Question_pkey" ON public."Question" USING btree (id);
CREATE UNIQUE INDEX "QuestionSet_pkey" ON public."QuestionSet" USING btree (id);
CREATE UNIQUE INDEX "Report_pkey" ON public."Report" USING btree (id);
CREATE UNIQUE INDEX "StaffSession_pkey" ON public."StaffSession" USING btree (id);
CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON public."StaffSession" USING btree ("tokenHash");
CREATE UNIQUE INDEX "StaffUser_namespace_username_key" ON public."StaffUser" USING btree (namespace, username);
CREATE UNIQUE INDEX "StaffUser_pkey" ON public."StaffUser" USING btree (id);
CREATE UNIQUE INDEX "WebsiteAudit_pkey" ON public."WebsiteAudit" USING btree (id);
```

### 실제 Foreign Key

| 테이블 | FK | 정의 |
|---|---|
| AIResponse | AIResponse_questionId_fkey | `FOREIGN KEY ("questionId") REFERENCES "Question"(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| AIResponse | AIResponse_runId_fkey | `FOREIGN KEY ("runId") REFERENCES "ObservationRun"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| CitationSource | CitationSource_responseId_fkey | `FOREIGN KEY ("responseId") REFERENCES "AIResponse"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| ClientEntity | ClientEntity_projectId_fkey | `FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| CompetitorEntity | CompetitorEntity_projectId_fkey | `FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| MeasurementBatch | MeasurementBatch_projectId_fkey | `FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| Mention | Mention_responseId_fkey | `FOREIGN KEY ("responseId") REFERENCES "AIResponse"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| ObservationRun | ObservationRun_batchId_fkey | `FOREIGN KEY ("batchId") REFERENCES "MeasurementBatch"(id) ON UPDATE CASCADE ON DELETE SET NULL` |
| ObservationRun | ObservationRun_projectId_fkey | `FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| ObservationRun | ObservationRun_providerId_fkey | `FOREIGN KEY ("providerId") REFERENCES "AIProvider"(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| OptimizationTask | OptimizationTask_auditId_fkey | `FOREIGN KEY ("auditId") REFERENCES "WebsiteAudit"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| OptimizationTask | OptimizationTask_projectId_fkey | `FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| Project | Project_organizationId_fkey | `FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| Question | Question_setId_fkey | `FOREIGN KEY ("setId") REFERENCES "QuestionSet"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| QuestionSet | QuestionSet_projectId_fkey | `FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| Report | Report_projectId_fkey | `FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| StaffSession | StaffSession_userId_fkey | `FOREIGN KEY ("userId") REFERENCES "StaffUser"(id) ON UPDATE CASCADE ON DELETE CASCADE` |
| WebsiteAudit | WebsiteAudit_projectId_fkey | `FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON UPDATE CASCADE ON DELETE CASCADE` |

`prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --script --exit-code`는 **복원 DB**에 대해 dry-run으로만 실행했다. exit 0, 출력 `This is an empty migration`으로 차이가 없었다. Migration 파일 생성·DDL 적용은 하지 않았다.

디스크에는 `prisma/migrations/20261008_stage5/migration.sql` 한 개가 있다. 이 SQL은 Project.operations, Report.payload와 직원/세션/접근 이력 관련 증분이다. 실제 DB에 `_prisma_migrations`가 없으므로 과거 적용 시각·순서·성공 이력을 확인할 수 없다. ‘Prisma와 현재 DDL 일치’와 ‘전체 migration history 재현 가능’은 다른 판정이다. 불일치/이력 공백을 수정하지 않았다.

전체 테이블 DDL, 94개 column 정의, indexdef, FK/제약과 migration 목록/checksum은 로컬 보호된 evidence 폴더의 `restored-before.json`, `schema-baseline.json`, `prisma-vs-restored.log`에 보존한다. 고객 원문·DB URL·키·백업 복호화 내용을 이 문서나 Git에 포함하지 않는다.

## 테스트 결과와 변경 분류

| 단계 | 단위/DB/PDF | Build/Typecheck | E2E |
|---|---|---|---|
| 최초 source 검사 | 128 PASS, 조건부 5 SKIP | 미실행 | 미실행 |
| 수정 전 복원 DB | 기존 133 + 새 보존 1 = 134 PASS | 모두 PASS | 16 중 14 PASS / 2 FAIL (기존 Pilot 1 + 새 충돌 재현 1) |
| 최소 UI 수정 후 새 복원 DB | 기존 133 + 새 보존/UI/복원 4 = 137 PASS, SKIP 0 | 모두 PASS | 16 중 14 PASS / 2 FAIL (기존 Pilot, Studio 배열 순서) |
| 변경 전 HEAD 대조군 | 추가 실행 안 함 | control build PASS | 기존 Studio spec 3개×3회: 6 PASS / 3 FAIL, 같은 배열 순서 오류 |

새 workspace 경계 E2E는 수정 후 PASS다. Studio는 처음 baseline에서는 통과했지만, post에서 순서 차이만으로 실패해 변경 전 HEAD로 대조 실행했고 3회 모두 같은 순서 민감성 실패를 재현했다. `db.loadDb`의 tasks 관계에 orderBy가 없고 데이터 내용/ID 변경과 배열 반환 순서는 구분해야 한다. 이 테스트나 writer 정렬은 이번 단계에서 수정하지 않았다.

원본 불변: dataHash `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96` → `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96` (동일). source DDL/모든 domain 비교 및 기존 설계 문서 checksum도 동일.

초기 source 단위 검사에서는 DB/PDF 조건부 5개가 생략됐다. 이후 격리 PostgreSQL 및 PDF 검증을 켜서 기존 테스트를 실행했다. 모든 기존 unit/spec 파일과 기존 기대값은 보존한다.

- 수정 전 새 UI 경계 테스트: CITED view에서 `/api/pilot` 요청 **2회**, 기대 0회로 실패. 실제 패널 충돌 재현이다.
- 기존 `tests/e2e/pilot.spec.ts:50`의 모바일 가로 넘침 검사는 **리팩터링 이전부터 실패**했다. 신규 회귀로 분류하지 않고 CSS나 기대값을 수정하지 않는다.
- 파일 저장 모드의 별도 build와 기존 core + 신규 boundary E2E 2개도 통과했다. 인증은 별도 복원 PostgreSQL을 사용했다.

첫 post-refactor 빌드에서는 새 보존 테스트가 JavaScript 함수의 동적 반환 필드를 타입으로 직접 참조해 실패했다. 새 테스트의 필드 접근만 보완했다. 기존 앱 실패를 숨기거나 기존 기대값을 변경한 것이 아니다. 해당 시도 로그는 `attempt1-*`로 남긴다.
- 최종 빌드의 기존 동적 파일 추적 경고는 별도 warning이다. 배포 범위 검토 문제이며 이번 단계에서 해결하지 않는다.

## UI 최소 변경 범위

`workspace.tsx`의 `tab>=28 → PilotPanel(view=tab-28)`만 명시적 매핑으로 교체한다. `workspace-views.ts`는 기존 28~34를 0~6에 연결하고 35(CITED), 21(Studio), 미래/미등록 탭은 Pilot을 선택하지 않는다.

고객 선택, 메뉴 이름/순서, 기존 URL/Route, `view=cited`, `view=execution-studio`, Pilot 버튼 동작을 유지한다. UI 전체 재작성·새 업무 기능·새 Platform 기능은 없다.

## 재현 절차

기존 로컬 DB가 실행 중이고 의존성이 준비된 상태에서만 수행한다. 각 단계는 출력한 evidence 폴더를 사용한다.

```powershell
node scripts/platform-8-0-baseline.mjs start
node scripts/platform-8-0-baseline.mjs prepare
node scripts/platform-8-0-baseline.mjs baseline
node scripts/platform-8-0-baseline.mjs post-refactor
node scripts/platform-8-0-baseline.mjs final
```

prepare는 원본 읽기 전용 조사와 기존 integrated backup/별도 restore를 수행한다. baseline/post-refactor는 복원된 DB/파일 루트 및 실행 폴더에서만 테스트한다. post-refactor 재실행은 원본 백업에서 새 DB를 복원해 이전 fixture와 분리한다. 과거 수정 전 동작의 재현에는 시작 HEAD의 workspace.tsx가 필요하며, 이미 수정된 소스에서 baseline을 다시 실행하면 과거 버그가 재현된다고 가정하지 않는다.
