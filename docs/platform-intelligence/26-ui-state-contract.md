# 내부 운영 UI 상태 계약

| 서버 상태 / 값 | 직원에게 표시 | 동작 |
| --- | --- | --- |
| PARTIAL | 증거 확인 필요 | 고객 증거가 부족함을 설명. 낮은 성능으로 해석하지 않음 |
| NOT_CONFIGURED + FACT 있음 | 공식 확인 정보는 있으나 현재 승인 RuleSet 없음 | 중립색. 공식 정보는 표시 |
| NOT_CONFIGURED + FACT 없음 | 진단 규칙 미구성 | 임의 FACT/점수 생성 없음 |
| score=null | 평가 보류 | 0으로 대체하지 않음 |
| 실제 score=0 | 0 / 100 | 실제 내부 점검 결과일 때만 표시 |
| PASS / WARN / FAIL | 정상 / 주의 / 확인된 문제 | 상태 텍스트와 색상 병행 |
| UNKNOWN | 증거 부족 · Evidence needed | reasonCode에 따른 다음 확인 사항 안내 |
| NOT_APPLICABLE | N/A · 대상 아님 | 점검 범위 설명 |
| REVIEW_DUE / EXPIRED / 7일 이내 due | 재검토 필요 | 과거 자료를 CURRENT로 표시하지 않음 |
| humanApprovalRecorded=false | 운영 승인 전 검증 팩 | 실제 운영 OWNER 승인 완료로 표현하지 않음 |
| Action 0 | 등록된 표준 작업 없음 | 임의 작업 생성 없음 |
| Work 0 | 연결된 기존 업무 없음 | 별도 업무 상태 생성 없음 |
| Experiment 0 | 아직 비교 가능한 Before/After 실험 없음 | 예시 성과 주입 없음 |
| Insight 0 | 아직 집계 가능한 운영 실험 데이터 없음 | Synthetic 통계 주입 없음 |
| SOURCE_CHANGED / SOURCE_MISSING | 원본 업무 상태 변경, 재확인 필요 | 현재 완료로 표시하지 않음 |
| OBSERVED_AFTER_ACTION | 작업 이후 관찰됨 | 인과적 효과 표현 금지 |
| INSUFFICIENT_EVIDENCE / NOT_COMPARABLE | 근거 부족 / 비교 불가 | delta 미확정은 평가 보류 |
| stale experiment | 결과 재검토 필요 | 수치 숨김 |
| stale/suppressed Insight | 이용 조건 또는 충분한 집계 근거 재확인 | 분포·개별 결과 표시 없음 |

점수 근처에는 “내부 준비도는 공식 플랫폼 점수나 추천 확률이 아닙니다.”를 짧게 표시한다. 집계에는 “관찰된 패턴이며 인과효과나 향후 성과를 보장하지 않습니다.”를 표시한다. 양수·0·음수를 같은 구조로 보여준다. 비율 자체는 %, 비율 차이는 기존 서버 displayDelta의 %p를 사용한다.

## 오류

| Code | 안전한 안내 |
| --- | --- |
| FEATURE_DISABLED | AI 플랫폼 진단 기능 비활성 |
| PERSISTENCE_UNAVAILABLE | 필요한 저장소 사용 불가 |
| PERSISTENCE_SCHEMA_UNAVAILABLE | Platform Intelligence 저장소가 아직 활성화되지 않음 |
| PROJECT_ACCESS_DENIED | 해당 고객 접근 권한 없음 |
| FORBIDDEN | 해당 화면의 직원 권한 없음 |
| UNAUTHENTICATED | 재로그인 필요 |
| NOT_CONFIGURED | 승인 진단 RuleSet 없음 |
| SOURCE_CHANGED | 원본 상태 변경, 재확인 필요 |
| CONSENT_UNAVAILABLE | 현재 이용 동의 확인 필요 |
| REVISION_CONFLICT | 다른 변경 저장됨, 새로고침 필요 |
| RATE_LIMITED | 잠시 후 재시도 |
| 기타/JSON 오류/네트워크 오류 | 안전한 일반 재확인 안내 |

서버 message/stack/SQL/파일경로를 그대로 표시하지 않는다. 오류에서 재시도할 수 있으며 자동 migration·외부 호출로 복구하지 않는다. 로딩에는 role=status, 오류에는 role=alert를 사용한다. 표는 이름 있는 내부 스크롤 영역이며 키보드 접근 가능하다. 상세/고객 변경 시 이전 fetch를 abort한다.

## API 투영

Catalog의 projectOptions는 현재 권한으로 볼 수 있는 고객의 projectId/label 두 필드만 제공한다. PI 직접 진입은 이 최소 projection을 기존 고객 선택기에 재사용하며 원문이 포함된 기존 Workspace 전체 조회를 하지 않는다. 일반 Workspace 메뉴로 나가면 기존 조회를 다시 이용한다.

Overview의 `pack`은 factCount/reviewRequiredCount/packStatus/humanApprovalRecorded만 포함한다. Detail의 officialFacts는 승인된 8-10 공개 FACT에 한정된 summary/source link/검토 시각/Rule usage다. 점검 basis도 이 안전한 집합만 사용한다. 기존 고객 raw answer, 파일, 증빙 ID, 토큰, 계정·연락처, 승인자, source 본문, cross-client lineage는 새 투영에 포함하지 않는다. 기술 ID와 version은 기본 화면에서 접어 둔다.

전역 Knowledge 승인/Rule 편집 UI, 임의 URL 조회, 점수 재계산, 새 Action/Experiment/Insight 생성 UI는 없다. 현재 미저장 진단에서는 업무 준비가 비활성이다. 저장된 현재 진단에서만 기존 PREPARE_WORK를 호출하고 createsTask=false 계약을 확인한다. UI 메뉴 숨김과 무관하게 서버가 최종 권한을 결정한다.
