# Platform Intelligence 8-9 — Server API Contract

이 계약은 직원용 내부 운영 API다. UI·메뉴·버튼·고객 portal을 추가하지 않았다. 실제 Platform pack 등록, 자동 Task 생성, AI 호출, 크롤링·게시·플랫폼 로그인 기능이 아니다.

## 구조

`src/app/api/platform-intelligence/[...segments]/route.ts`가 GET/POST를 기존 인증으로 처리하고 `server/http.ts` → `PlatformApplicationService` → 기존 domain 계약 → 8-8 Postgres Repository로 전달한다. Route에는 Prisma query나 승인 엔진을 넣지 않는다. 포괄 route 아래의 허용된 path만 명시적으로 받으며 기존 route 이름은 바꾸지 않는다.

| 실제 GET 주소 | 허용 역할 / 응답 |
| --- | --- |
| `/api/platform-intelligence/catalog` | OWNER/MANAGER/ANALYST; 6개 제품과 channel의 로컬 기능 상태 |
| `/api/platform-intelligence/knowledge` | OWNER: 전역 version metadata; 나머지: 승인되고 현재 유효한 전역 metadata |
| `/api/platform-intelligence/rules` | OWNER: 전역 Rule/RuleSet version metadata; 나머지: 승인 metadata |
| `/api/platform-intelligence/actions` | OWNER: 최신 정의 metadata; 나머지: 현재 operational 승인 metadata |
| `/api/platform-intelligence/insights` | OWNER 전용 집계 projection; 현재 동의/source 재검사 |
| `/api/platform-intelligence/projects/{projectId}/overview` | OWNER 또는 배정된 MANAGER/ANALYST; 6개 플랫폼 요약 |
| `/api/platform-intelligence/projects/{projectId}/platforms/{platformCode}` | 같은 project 권한; identity/channels/readiness/findings/candidates/work/experiments/observation metadata |
| `/api/platform-intelligence/projects/{projectId}/observations` | 같은 project 권한; 관측 운영 metadata |
| `/api/platform-intelligence/projects/{projectId}/readiness` | 같은 project 권한; Readiness DTO와 finding summaries |
| `/api/platform-intelligence/projects/{projectId}/action-candidates` | 같은 project 권한; 현재 후보와 기존 작업 상태 |
| `/api/platform-intelligence/projects/{projectId}/executions` | 같은 project 권한; 기존 작업과 연결된 execution projection |
| `/api/platform-intelligence/projects/{projectId}/experiments` | 같은 project 권한; 실험 및 현재 결과/stale projection |

project GET의 filter는 `platformCode`, `channelCode`만 지원한다. path의 platform과 query가 중복되거나 platform/channel이 충돌하면 거절한다. Overview는 filter를 받지 않는다. query 중복·미정의 필드도 거절한다. channel을 생략하면 서버가 현재 적용 가능한 승인 정책에서 기본 channel을 선택한다. Overview와 Detail/Readiness는 같은 선택을 사용한다. country/region/industry 같은 평가 scope는 현재 project/관측에서 읽으며 정책의 scope를 고객의 실제 속성으로 간주하지 않는다. 현재 기록으로 확정할 수 없는 세부 scope는 null 또는 미설정 상태를 유지한다.

## Command endpoint

모든 POST는 JSON, 정확한 same-origin Origin, 직원 인증, 64 KiB 이내 body, strict input, `expectedRevision`, `reason`이 필요하다. 환경은 항상 서버의 PRODUCTION이며 caller가 수정할 수 없다. 모든 시간과 audit actor는 서버가 만든다.

| POST 주소 | operation | 권한 |
| --- | --- | --- |
| `/knowledge` | KNOWLEDGE_CREATE / KNOWLEDGE_SUBMIT / KNOWLEDGE_APPROVE / KNOWLEDGE_RETIRE | OWNER |
| `/rules` | RULE_DRAFT / RULE_PUBLISH / RULESET_DRAFT / RULESET_PUBLISH / READINESS_POLICY_PUBLISH | OWNER |
| `/actions` | ACTION_CREATE / ACTION_SUBMIT / ACTION_APPROVE / ACTION_RETIRE | OWNER |
| `/insights` | INSIGHT_POLICY_APPROVE / INSIGHT_AGGREGATE | OWNER |
| `/projects/{id}/observations` | OBSERVATION_CAPTURE | OWNER / 배정 MANAGER·ANALYST |
| `/projects/{id}/readiness` | READINESS_EVALUATE | OWNER / 배정 MANAGER·ANALYST |
| `/projects/{id}/action-candidates` | PREPARE_WORK | OWNER / 배정 MANAGER·ANALYST |
| `/projects/{id}/executions` | EXECUTION_LINK | OWNER / 배정 MANAGER |
| `/projects/{id}/experiments` | MEASUREMENT_FREEZE / EXPERIMENT_CREATE / EXPERIMENT_RESULT | OWNER / 배정 MANAGER |

주소는 모두 `/api/platform-intelligence` 아래다. 각 주소는 해당 operation만 허용한다. projectId는 path에서 정하며, 다른 고객의 response/task/evaluation/measurement/experiment를 끼워 넣으면 현재 소속/버전/checksum 검사에서 거절한다. INSIGHT policy·aggregation은 project command가 아니다.

Knowledge/Action의 승인 전이는 기존 lifecycle을 호출한다. Rule/RuleSet은 8-2의 immutable version 계약을 유지하므로 Draft를 같은 version에서 덮어써 승인하지 않는다. OWNER가 새 version을 명시적으로 publish하고 기존 factory가 승인된 Knowledge·scope·checksum을 검증한다. Publish를 단순 필드 UPDATE로 구현하지 않았다. Readiness 정책은 전역 또는 project-bound scope를 명시하고 현재 RuleSet에 연결한다.

READINESS_EVALUATE는 현재 승인 정책과 현재 evidence를 서버 시각으로 계산한다. RuleSet이 없으면 성공 응답에 NOT_CONFIGURED/null score를 반환하며 가짜 평가 record를 만들지 않는다. PREPARE_WORK는 명시적으로 선택한 action/rule/version과 저장된 현재 evaluation을 다시 확인하고 기존 `prepareActionWorkRequest`를 호출한다. **createsTask=false**다. EXECUTION_LINK는 기존 Task만 연결하며 Studio 적용 시각·버전·승인·proof와 관련 Pilot work/권한을 서버가 찾아 기존 8-5 gate에 전달한다. 실제 적용이나 Task 생성 API를 자동 호출하지 않는다.

Mutation 성공 응답은 `{ revision, result }`다. revision은 environment 전체 CAS revision이므로 다른 직원의 저장이 있으면 다시 읽고 충돌을 해결해야 한다. 예상 revision을 생략하거나 서버가 무조건 재시도하지 않는다. 명시적인 준비 요청도 기존 AuditEvent에 기록하므로 record가 추가되지 않아도 revision이 증가할 수 있다.

## DTO

Overview는 항상 6개 플랫폼을 반환한다. Production RuleSet이 없을 때는 모두 NOT_CONFIGURED이며 score/lowerBound/upperBound/coverage는 null이다. Readiness는 다음 의미 표식을 포함한다.

```json
{
  "scoreMeaning": "INTERNAL_READINESS",
  "notProbability": true,
  "notOfficialPlatformScore": true,
  "persistenceState": "COMPUTED_UNSAVED"
}
```

GET에서 현재 계산한 값과 저장된 현재 평가를 구분한다. 저장되지 않은 계산에는 evaluationId=null이며 prepare-work의 근거로 바로 쓰지 못한다. 저장된 평가도 현재 source와 정책·유효기간·서버 freshness를 확인한다. 불일치한 과거 값을 CURRENT라고 돌려주지 않는다. 실제 체크가 설정된 상태에서 계산된 0점은 가능하지만 미설정 상태를 0점으로 바꾸지 않는다.

기본 DTO에는 원문, API key/cookie/token, 내부 첨부 경로/bytes, 연락처, Consent 증빙 원문, DB 정보, cross-client lineage를 넣지 않는다. 증빙은 종류와 가용 여부만 요약한다. raw response 조회는 기존 권한 화면을 사용한다. Insight에는 8-7 aggregate projection만 제공하고, 현재 동의 변경·source 변경·소표본이면 통계를 숨긴다. 별도 서버 메서드 `readOwnerLineage`는 OWNER와 INTERNAL_RESEARCH 목적 및 현재 Consent를 검사하며 HTTP path로 노출하지 않는다.

## 상태와 오류

기본 flags는 비활성 상태다. PostgreSQL과 두 flag가 모두 필요하다. file mode는 PERSISTENCE_UNAVAILABLE, flag 미설정은 FEATURE_DISABLED, 신규 table 부재는 PERSISTENCE_SCHEMA_UNAVAILABLE이다. API가 migration을 실행하지 않는다. 원본 DB에는 아직 migration을 적용하지 않았다.

오류는 `{ error: { code, message } }`이며 message도 고정 code다. UNAUTHENTICATED(401), FORBIDDEN/PROJECT_ACCESS_DENIED(403), NOT_FOUND(404), INVALID_INPUT(400), REVISION_CONFLICT/SOURCE_CHANGED/CONSENT_UNAVAILABLE/NOT_CONFIGURED(409), RATE_LIMITED(429), feature/persistence 상태(503), INTERNAL_ERROR(500)를 사용한다. SQL/stack/path/비밀/Prisma 원문을 반환하거나 body 전체를 로그에 복사하지 않는다.

응답은 private/no-store다. 민감 project/Insight GET은 기존 AccessEvent를 사용한다. POST는 record와 원자적으로 commit되는 기존 8-8 AuditEvent에 operation/target/실제 변경 domain·stableId·version/revision·actor/time/reason을 남긴다. 이미 commit한 뒤 추가 AccessEvent 저장 실패가 성공한 command를 실패로 오인하게 만들지 않도록 POST의 중복 사후 쓰기는 하지 않는다.

쓰기 제한은 직원별 process-local 30회/분이다. 별도 rate-limit 서비스나 전역 분산 제한은 이번 범위가 아니며 재시작하면 이 counter는 초기화된다. 현재 local-org·로컬 운영 계약을 유지한다. 고객 portal DTO, UI 연결, 공식 Pack 입력은 후속 단계다.
