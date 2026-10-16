# Platform Intelligence 8-8 — Production Governance

Production Knowledge/Rule/Action pack을 이 단계에서 만들지 않는다. SYNTHETIC fixture는 격리 DB에만 저장하며 실제 고객 성과나 공식 플랫폼 규칙으로 소개하지 않는다.

## 권한과 승인

매 transaction마다 DB StaffUser의 현재 namespace/disabled/role/projectIds를 읽는다. OWNER만 전역 Knowledge/Rule/RuleSet, Action, Readiness 정책, Insight 정책·Run을 관리한다. project Execution/Experiment/Result는 기존 8-5의 OWNER/MANAGER 쓰기 권한과 project 소속 검사를 유지한다. Observation/Readiness/측정 manifest는 허용된 project 범위의 기존 분석 권한을 따른다. VIEWER, disabled, 다른 namespace와 존재하지 않는 staff는 adapter 접근을 거절한다.

Knowledge와 Action은 DRAFT → REVIEW_REQUIRED → APPROVED 전이와 provenance/공식 자료·유효기간 gate를 통과해야 한다. 승인된 내용을 바꾸려면 새 version과 supersedes를 기록한다. RETIRED도 과거 승인 버전을 삭제하지 않는 새 버전이다. Rule/RuleSet은 기존 strict registry의 검토자·기준 Knowledge·checksum gate를 통과한 immutable version으로 추가한다. Action의 효과 주장은 `NO_EFFECT_CLAIM`을 유지한다.

외부 request에서 staff ID를 직접 받아 adapter에 넘기지 않는다. 후속 8-9 서버 진입점이 기존 인증 세션과 same-origin 검사를 먼저 수행한 뒤 그 staff identity를 전달해야 한다. adapter는 그 identity의 현재 권한을 다시 검사한다. 서버 전용 session/snapshot은 raw source를 포함한 내부 구조이므로 클라이언트에 직렬화하지 않는다.

## 환경과 빈 운영 상태

모든 record와 audit는 명시적인 PRODUCTION 또는 SYNTHETIC namespace다. 같은 stableId/version도 환경별 unique key와 audit revision을 갖는다. payload에 선언된 환경도 일치해야 한다. 합성 Insight 정책·Action·Experiment·Readiness를 Production으로 연결하지 않는다. 실제 AI 호출, 외부 크롤링이나 고객 데이터 생성은 이 검증에 사용하지 않았다.

원본 DB에는 새 schema가 아직 없다. 따라서 현재 UI나 기존 메모리 production pack은 계속 비어 있고, 영구 adapter를 활성화하면 자동 schema 생성 대신 명시적 schema-unavailable을 반환한다. 격리 DB에서는 실제 SQL 조회와 별도 프로세스 조회로 PRODUCTION record/audit가 0임을 확인한다.

## Consent와 privacy

집계 허용 여부를 저장 시점의 boolean만으로 결정하지 않는다. 결과 조회와 재집계에서 기존 Pilot agreement와 현재 INTERNAL_RESEARCH/ANONYMIZED_STATISTICS의 범위·기간·증빙·철회를 다시 읽는다. 철회하면 기존 Run checksum을 보존하되 `STALE_BY_CONSENT_CHANGE`로 표시하고 통계와 lineage 사용을 막는다. source가 달라지면 기존 결과를 덮지 않고 STALE projection을 반환한다.

개별 고객 이름, 응답 원문, 첨부, 계정 비밀이나 개인별 지표를 Insight projection에 넣지 않는다. 소표본 suppression, 독립 고객 단위 집계, 제외 사유와 무효·미측정 결과를 기존 8-7 계약대로 유지한다. 집계 결과를 FACT, 인과효과, 순위 개선 보장이나 Action ranking의 자동 근거로 승격하지 않는다.

DB 감사 체인에는 실제 actor, 시각, 이유, 변경 ID와 전후 envelope checksum 및 review operation이 남는다. 운영 DB 사용자와 암호화 백업 키는 최소 접근으로 관리한다. 관리자 SQL 전체 변조에 대한 서명·외부 불변 감사 저장소는 이번 범위가 아니므로 운영 쓰기는 adapter 경로로 제한한다.
