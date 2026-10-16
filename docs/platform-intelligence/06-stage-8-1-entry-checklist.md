# 8-1 Entry Gate

이 문서는 8-0 검증 결과에 대한 출입 기준이다. 새 Registry 구현은 아직 시작하지 않는다.

**최종 판정: READY_WITH_WARNINGS**

보존/복원과 최소 UI 경계 수정은 확인했다. 모든 E2E가 통과한 READY_FOR_8_1 상태라고 주장하지 않는다. 아래 경고를 기존 결함으로 추적하고, 스키마 변경 전 migration baseline 전략을 확정하는 조건의 착수 판정이다.

| Gate | 판정 | 근거 |
|---|---|---|
| 기존 테스트 Baseline 기록 | PASS | 원래 테스트와 추가 테스트 결과·실패 분류 기록 |
| 기존 데이터 Backup 가능 | PASS | 기존 AES-GCM integrated backup 성공 |
| Restore 후 핵심 ID/hash 동일 | PASS | 실제 source+비어 있지 않은 LOCAL MOCK 복원 비교 모두 동일 |
| Prisma/실제 DB 차이 파악 | WARN | 현재 DDL diff=0이나 migration history 없음 |
| Legacy Platform 문자열 Map | PASS | 실제 DB 분포·문자열 Matrix·source 출현표 |
| Metric Contract 확정 | PASS | 분모/단위/gate/버전 및 CITED 별도 ID 문서화; 함수 무변경 |
| Snapshot Contract 확정 | PASS | 4종 hash 경계·stale·보고서 연결; 원 hash 무변경 |
| raw provider 값 보존 원칙 | PASS | 운영 데이터 자동 변환 없음; sidecar 계획만 |
| Platform Intelligence 저장 경계 | PASS | 기존 graph writer와 신규 repository 소유 경계; 미구현 |
| workspace 신규 view 위험 확인 | PASS | 수정 전 Pilot 요청2회 재현; 명시 매핑 후 신규 E2E PASS |
| 기존 URL/Route 변경 없음 | PASS | tracked Route checksum 전부 동일; view 인자 유지 |
| 회귀 suite 완전 green | WARN | 기존 Pilot 모바일 및 Studio 순서 민감성 실패 잔존. 숨기지 않음 |

## 8-1에서 먼저 확인할 주의사항

1. Migration 이력 테이블이 없다. 8-1에서 스키마를 바꾸기 전 현재 DDL baseline과 재현 전략을 승인해야 한다. 없는 과거 이력을 만들어 적용된 것처럼 표시하지 않는다.
2. 기존 Pilot 모바일 가로 넘침 E2E는 수정 전부터 실패했다. 다음 단계에서 UI를 확장하려면 별도 이슈로 추적하고 해결/제외 근거를 명시한다. 이 테스트를 삭제하거나 기대값을 완화하지 않는다.
3. 기존 Studio 기존 프로젝트 배열 비교는 변경 전 HEAD에서도 3회 실패했다. order-sensitive 비교와 무정렬 관계 읽기 문제를 별도 추적하고 기존 기대값은 유지한다.
4. 실제 원본 DB에 없는 Snapshot/Agreement/Consent/Report의 보존은 LOCAL MOCK 격리 복원 증거로 검증했다. 이것을 실고객 실증이나 성과 사례로 해석하지 않는다.
5. 기존 동적 파일 추적 빌드 경고는 유지된다. 공개 배포 전 배포 파일 범위를 확인한다.

## 8-1에 허용할 착수 범위

보존 계약 아래 플랫폼/채널/legacy alias의 설계·읽기 전용 경계부터 시작한다. 원 raw 값 자동 변환, 과거 Snapshot/보고서 재계산, feature flag 기본 활성화, 실제 AI/API/크롤러/점수 구현은 이 gate 통과와 별개이며 자동 허용되지 않는다.

관련 계약은 02(불변 데이터/스냅샷), 03(legacy map), 04(지표), 05(repository/UI/flag)다. 전체 실행 결과와 실패 분류는 07 문서에서 확인한다.
