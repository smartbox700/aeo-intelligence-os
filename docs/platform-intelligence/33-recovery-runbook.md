# 8-12 복구 절차

우선 복구 대상은 기존 고객 서비스다. 첫 조치로 `PLATFORM_INTELLIGENCE_ENABLED=false`를 적용하고 필요하면 `PLATFORM_INTELLIGENCE_PERSISTENCE_ENABLED=false`도 적용한다. 프로세스를 재시작한 뒤 로그인·Workspace·PreScan·Consumer·CITED·Reporting·Pilot·Studio 및 첨부 접근을 확인한다.

추가 PI schema는 남겨 둔다. Flags OFF에서 기존 프로그램이 작동하는지 현재 앱의 전체 회귀로 검증하고, 이전 검증 앱인 8-10 production build를 동일한 additive schema clone에서 실행해 호환성을 확인한다. 이전 앱 artifact와 현재 artifact의 소스·BUILD_ID는 구분해 보관한다. 알려진 Pilot 390px overflow와 Studio 배열 순서 민감성은 OWNER 검토 자료에 남긴다.

앱 문제라면 이전 검증 build와 해당 dependency lock을 배포한다. schema는 additive 상태로 유지한다. migration down/drop 또는 legacy DDL 변경으로 복구하지 않는다. Pack checksum 불일치, failed migration, audit 무결성 실패 시 PI는 비활성 상태를 유지한다.

DB 자체 복구가 필요하면 쓰기·트래픽을 중지하고 사고 시각·마지막 정상 시각·최종 백업 시각을 기록한다. 검증된 배포 전 암호화 백업을 **새 DB / 새 첨부 root**에 복원한다. data/schema/ID/관계/파일/20 도메인/직원 권한을 재비교하고 새 로그인 세션을 만들어 접근을 확인한다. 백업 이후 쓰기는 자동 보존되지 않으므로 변경분 회수 계획과 예상 손실 구간을 사람이 승인해야 한다. 이 단계에서 무손실 RPO나 복구 시간을 보장하지 않는다.

담당 OWNER가 새 DB와 파일 root를 통제된 설정 변경으로 전환한다. 기존 DB는 조사용으로 격리하고 삭제하지 않는다. 인증 세션은 정책에 따라 폐기·재발급하며 저장된 해시를 평문 토큰으로 복원하지 않는다. 기존 서비스 smoke test 후 트래픽을 복구한다. PI 재활성화는 원인 해결과 새로운 사람 승인 이후 별도 수행한다.

이번 단계에서 실행한 것은 격리 DB 리허설이다. 운영 flags 변경·실제 연결 전환·운영 DB rollback은 실행하지 않았다.
