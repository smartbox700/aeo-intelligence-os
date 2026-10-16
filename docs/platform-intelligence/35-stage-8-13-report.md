# 8-13 Controlled Production Deployment — Precheck

최종 상태: BLOCKED (BLOCKED_PRODUCTION_TARGET_UNVERIFIED).

## A. Production Target Verification

현재 연결은 로컬 loopback PostgreSQL입니다. README와 8-12 검증 범위는 로컬 개발/단일 사용자 환경이며, 이 DB와 HTTP 앱을 실제 운영 대상으로 지정한 검증 가능한 정보가 없습니다. 로컬 원본이라는 사실과 실제 Production 배포 대상이라는 사실은 구분합니다. 배포 대상 서버·앱 주소·DB namespace를 추측하지 않았습니다.

HEAD: 96eb523b40c6f0904ef0104bd411d2e7e4a067e6. 8-12 artifact checksum: 7f3effba6e5e523a54a536b164e737ec48f2ff5f087726f46af0d919e7be443e. 코드·설정 변경 0개. Manifest checksum 검증 true.

Data hash: 977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96. Expected 일치: true. Schema hash: 263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43. Expected 일치: true. Legacy tables 18, Project 1, Client 1. PI tables absent: true; flags OFF: true.

## B. Human Approval

첨부의 제한적 배포 요청은 확인했습니다. 채팅 승인을 임의 StaffUser에 연결하지 않았습니다. 실제 운영 OWNER 인증은 미검증이며 humanApprovalRecorded=false입니다. 실제 HUMAN_REVIEW_DECISION 또는 승인 audit를 생성하지 않았습니다.

## C–K. Backup / Migration / Pack / Deployment / Flags / UI / Security / Regression / Post-backup

PRECHECK에서 중지했습니다. 새 운영 백업, 운영 migration, Pack 승인/설치, 앱 배포/재시작, flags 변경, 운영 UI/API mutation, post-deployment backup을 실행하지 않았습니다. 8-12 clone 결과를 운영 배포 결과로 대체하지 않았습니다. DB 접근은 읽기 전용 검사뿐입니다.

## L. Known Risks

8-12의 PILOT_390_OVERFLOW, STUDIO_ORDERING, NEXT_TRACING, PRESCAN_DIRECT_EXPERIMENT_ADAPTER, CITED_DIRECT_EXPERIMENT_ADAPTER, LIMITED_METRICS, GEMINI_NAVER_NO_RULESET, ACTION_EXPERIMENT_INSIGHT_ZERO를 그대로 유지합니다.

## M. Production Counts

Production target이 검증되지 않아 실제 운영 count로 표시하지 않습니다. 현재 확인한 로컬 원본에는 PI 테이블이 없고 기존 18개 테이블만 있습니다.

## N. Final State

BLOCKED_PRODUCTION_TARGET_UNVERIFIED. 첫 Pilot 고객 미선택·미활성화. 계속하려면 실제 운영 앱 주소와 DB namespace의 명시적 지정 및 해당 환경의 실제 OWNER 인증이 필요합니다. URL 비밀번호나 세션 token을 채팅에 붙여 넣지 않습니다.
