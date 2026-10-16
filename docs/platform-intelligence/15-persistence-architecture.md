# Platform Intelligence 8-8 — Persistence Architecture

기존 synchronous Repository 계약을 transaction-scoped PostgreSQL adapter로 감싼다. 엔진은 DB를 직접 읽지 않는다. UI/API 연결은 8-9 범위이며 이 단계에서 추가하지 않는다. 운영 정의나 합성 예제를 운영 pack으로 등록하지 않는다.

## 저장 모델

물리 테이블은 `PlatformIntelligenceRecord`, `PlatformIntelligenceAuditEvent` 두 개다. Record의 domain discriminator에 따라 아래의 기존 strict TypeScript 계약으로 검증한다.

| Domain | stableId / version | 범위 |
| --- | --- | --- |
| KNOWLEDGE | knowledgeId / version | 전역 또는 project |
| RULE | ruleId / version | 전역 또는 project |
| RULESET | ruleSetId / version | 전역 |
| OBSERVATION | responseId / revision | project + 기존 AIResponse FK |
| READINESS_POLICY | ruleSetId / ruleSetVersion | scoring policy의 project scope |
| READINESS | evaluationId / 1 | project; payload에 project ledger revision |
| ACTION | actionId / version | 전역 |
| EXECUTION | executionId / revision | project + 기존 OptimizationTask FK |
| MEASUREMENT | reference checksum / 1 | project; 원본 관측을 복제하지 않는 동결 manifest |
| EXPERIMENT | experimentId / version | project |
| EXPERIMENT_RESULT | experimentId / resultVersion | project |
| INSIGHT_POLICY | policyId / version | 전역 |
| INSIGHT | aggregationId / 1 | OWNER 전용 cross-project; payload에 ledger revision |

Unique key는 `(environment, domain, stableId, version)`이며 ID는 이 identity의 SHA256이다. envelope에는 recordRevision, scope/FK, payload, full-payload checksum, envelopeChecksum, contractVersion, registryVersion, createdBy/createdAt/reason, previousChecksum을 저장한다. payload의 자체 checksum과 envelope의 full-payload checksum은 구분한다. 각 payload의 원래 승인자·생성자와 audit도 유지한다. envelope createdBy는 해당 저장 revision의 실제 인증된 작성자다.

기존 Project, AIResponse, Task, Studio, Proposal, Pilot, Snapshot, Report를 새 테이블로 복제하지 않는다. 원본 text, citation body, 첨부 bytes, 계정 ID나 로그인 비밀을 sidecar에 넣지 않는다. 측정에는 response ID, sourceHash, canonical context, query/plan reference와 checksum만 남긴다. Citation/Mention처럼 안정적인 canonical ID resolver가 없는 Knowledge evidence 종류는 추측해 연결하지 않고 저장을 거절한다.

## Repository 사용

`persistence/index.ts`가 공개 진입점이다. `PostgresPlatformIntelligenceRepository.read(actor, environment, callback)`은 기존 계약으로 hydrate한 session을 제공한다. `write(actor, environment, expectedRevision, audit, callback)`은 session 변경분을 검증해 commit한다. callback에 전달되는 `revision`을 다음 CAS에 사용한다. session은 transaction 밖에 보관하거나 재사용하지 않는다.

session은 knowledge/rules/observations/readiness/actions/executions/experiments/results/insights와 정책·측정 저장 메서드를 제공한다. 기존 메모리 구현에는 optional initial state와 snapshot export만 추가했다. 운영 adapter에서 메모리는 transaction 내부 계산 공간이며 영구 저장 실패 시 성공으로 돌려주는 fallback이 아니다.

## Transaction과 무결성

1. 두 feature flag와 PostgreSQL 모드를 확인한다. 새 테이블이 없으면 `PERSISTENCE_SCHEMA_UNAVAILABLE`이며 자동 migration하지 않는다.
2. Serializable transaction에서 기존 writer/backup과 같은 advisory lock `742910`을 획득한다.
3. StaffUser를 DB에서 다시 읽어 namespace, disabled, role, projectIds를 확인한다. 호출자가 보낸 role은 신뢰하지 않는다.
4. audit chain, 모든 envelope의 checksum/identity/scope, audit가 가리키는 최신 record head를 검증한다. 삭제·누락·단순 변조도 거절한다.
5. 같은 transaction의 현재 legacy source와 허용된 project만 읽어 동결 session을 만든다.
6. 변경된 payload의 strict 계약, environment, 현재 reference 소속·버전·checksum, 실제 audit actor를 확인한다.
7. Record 변경과 audit event를 같은 transaction에 저장한다. draft UPDATE도 기존 envelopeChecksum CAS가 필요하다. 예외는 모두 rollback된다.

expectedRevision은 environment별 audit revision이다. 동시에 같은 revision으로 쓰면 한 요청만 성공한다. 다른 요청은 stale 또는 PostgreSQL serialization/unique 충돌로 실패하며 서버가 최신 상태를 다시 읽어야 한다. 무조건적인 자동 재시도는 하지 않는다.

Approved Knowledge/Action은 덮어쓸 수 없으며 새 버전으로 퇴역한다. Rule/RuleSet와 나머지 이력은 append-only다. Knowledge/Action의 DRAFT/REVIEW_REQUIRED 전이는 같은 version의 recordRevision을 올리고, 기존 before/after checksum과 review operation을 audit chain에 남긴다. 모든 과거 draft payload 자체를 별도 사본으로 보관하는 모델은 아니다.

DB CHECK/FK/unique와 adapter 검증을 함께 사용한다. DB 관리자 권한의 임의 SQL을 차단하는 trigger나 암호학적 서명 시스템은 없다. 따라서 운영 서비스의 PI 쓰기 진입점은 이 adapter로 제한해야 한다. SHA256은 우발적·부분 변조 탐지이며 DB와 전체 audit를 동시에 재작성하는 관리자에 대한 인증 수단은 아니다.

## 조회와 stale

과거 결과를 현재 source로 덮어쓰지 않는다. Execution은 현재 Task/Studio/Approval 상태를, ExperimentResult는 현재 measurement manifest와 Action view를, Insight는 현재 source와 Consent를 다시 확인한다. STALE/동의 변경이면 기존 checksum은 보존하고 현재 결과 projection은 숨긴다. 소표본 집계도 기존 suppression 정책을 유지한다.

전역 registry lookup 자체는 역사적 버전을 복원한다. 이후 운영 가능 여부·유효기간·동의와 효과 계산의 gate는 기존 엔진 및 현재 projection 계약을 따른다. 원시 session snapshot은 서버 검증용이며 고객 화면에 노출할 public DTO가 아니다.
