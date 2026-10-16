# 8-12 최종 검증 보고서

**READY_FOR_HUMAN_DEPLOYMENT_APPROVAL** — 사람 운영 승인 전 중지.

## A. Deployment Artifact

HEAD 96eb523b40c6f0904ef0104bd411d2e7e4a067e6, artifact 7f3effba6e5e523a54a536b164e737ec48f2ff5f087726f46af0d919e7be443e, build 472TDgO-84sFfC_wNeQam. 원본 앱 소스 변경 0, 검증 runtime의 비생성 소스·설정 차이 0. generated Prisma는 현재 schema에서 재생성하여 별도 checksum으로 결합했습니다. 배포 manifest는 exclusive 생성했으며 변경 시 새 검증 artifact가 필요합니다.

## B. Production Backup

암호화 백업·별도 key·새 DB/파일 root 복원 통과. 원본 첨부 참조 수 0, 파일 수 0; 원본에 없는 첨부는 EMPTY_IN_SOURCE로 보고하며 비어 있지 않은 첨부 접근은 restore-access E2E의 격리 fixture로 별도 검증했습니다. 비밀 URL·key·password·세션 token은 보고서에 넣지 않았습니다.

## C. Migration Rehearsal

현재 백업 clone에 baseline resolve 두 건 후 PI migration 적용, Prisma diff empty/exit 0, 재배포 no-op. 신규 테이블은 PI Record/Audit와 _prisma_migrations뿐입니다. 별도 conflict clone은 migration 실패, 성공 이력 없음, 실제 인증 API 503 안전 차단. 실패 clone은 운영 불가로 격리하고 백업을 새 DB로 재복원했습니다.

## D. Legacy Preservation

기존 18개 테이블 rows/IDs/PK/FK/columns/indexes/constraints/data hashes 동일. 20 도메인 모두 동일. 빈 도메인은 빈 상태의 일치이며 존재하지 않는 데이터의 기능 검증으로 과장하지 않았습니다.

## E. Knowledge Human Review Packet

FACT 23·Rule 6·RuleSet 4·정책 4, 출처 URL·verified/due/expiry·미지원 주장·봇/채널 구분을 정리했습니다. 정확한 복원 정책 payload도 보호 증거 readiness-policies-exact.json에 보관했습니다. 팩 설치 checksum ca9ad78b7a6b6df52e33bb98ed71db86380f7d0da6aa9f026fd055cd668e5d12은 test OWNER 검증 설치의 값이며 원본 운영 설치는 없습니다. PENDING 승인 template만 준비했고 사람 승인·공식 source 자동 갱신은 없습니다.

## F. Security Gate

PASS. 실제 DB 직원·세션 기반 WRITE/READ 재시작 검증과 실패 schema API 검증 통과. 익명/disabled/VIEWER/잘못된 배정/다른 고객 차단, OWNER 전용 권한, Origin/JSON/64KiB/rate, actor/role/projectIds/environment/CURRENT/consent/humanApprovalRecorded/serverTime 위조 차단을 확인했습니다. API/UI 원문·세션·passwordHash·내부 경로·첨부·lineage·synthetic 노출 차단 검증을 유지했습니다.

## G. Recovery Gate

PASS. PI 테이블 존재+flags OFF에서 현재 앱 회귀 검증. 이전 8-10 production build zoWf2mA0p9yhQK2O_Li-7를 additive schema clone에서 실행했습니다. 이전 앱 E2E의 알려진 Pilot layout 실패는 숨기지 않고 아래 위험에 포함합니다. 실제 DB 전환·운영 flags 변경·down/drop은 실행하지 않았습니다.

## H. Regression / UI Gate

단위/실DB/PDF 459 PASS, 특수 PG phase 6 SKIP. Prisma generate·production build·tsc PASS, gate 추가 테스트 tsc PASS. 전체 E2E 17 PASS / 기존 Pilot 1 FAIL / 별도 UI 4 SKIP. Pack 0 E2E 1 PASS, Pack 복원 UI 3 PASS / legacy 전용 1 SKIP. 6 카드·6 상세·Insights·null score·PI 390px overflow 0을 실제 서버에서 검증했습니다. SOURCE_CHANGED와 미래 실험 표시는 response fixture이며 고객 데이터 저장이 아닙니다. Pack PI records 전후 동일. 새 복원에서 pack restart READ PASS. 초기 restart 검증의 삭제된 UI fixture 참조와 이전 앱 실행 포트 중복은 새 clone/순차 실행으로 해결했으며 최초 실패 로그도 남겼습니다.

## I. Known Risks

- PILOT_390_OVERFLOW: NON_BLOCKING — Existing pilot.spec.ts:50:532 failure reproduced; PI 390px has zero overflow. Candidate for human risk acceptance; not accepted yet.
- STUDIO_ORDERING: NON_BLOCKING — Historical array ordering sensitivity retained; current three Studio browser tests pass.
- NEXT_TRACING: NON_BLOCKING — Existing three filesystem tracing warnings; build succeeds. Protected diagnostic logs only.
- PRESCAN_DIRECT_EXPERIMENT_ADAPTER: DEFERRED — Unavailable; no adapter substitution or unsupported attribution.
- CITED_DIRECT_EXPERIMENT_ADAPTER: DEFERRED — Unavailable; no adapter substitution or unsupported attribution.
- LIMITED_METRICS: DEFERRED — Only supported comparable metric contracts may aggregate; Naver without equivalent rank excluded.
- GEMINI_NAVER_NO_RULESET: NON_BLOCKING — FACT_ONLY/NOT_CONFIGURED is intentional; separate manual observation remains possible.
- ACTION_EXPERIMENT_INSIGHT_ZERO: NON_BLOCKING — No actual work/evidence yet; zero records is expected, no synthetic production scores.

## J. First Pilot Readiness

고객 미지정 template·모든 미체크 전제조건·관측 계획을 준비했습니다. 1고객/OWNER+담당자/4플랫폼, Gemini/Naver FACT_ONLY 유지, 서비스·로그인 우회 금지, Naver 동등 rank 없으면 통합 순위 제외, Search/Place 대체 금지. 실제 Pilot 미시작.

## K. Original Production Preservation

Data 977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96, schema 263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43. 전후 동일, 20 domains 동일, PI tables absent, flags OFF. 사용자 workspace.tsx와 원본 .env는 수정하지 않았습니다.

## L. Human Approval State

humanApprovalRecorded=false. test OWNER를 실제 사람 승인으로 승격하지 않았습니다. HUMAN_REVIEW_DECISION은 PENDING/null template이며 별도 실제 승인 record/audit가 생기기 전 운영 활성화 금지입니다.

## M. Final Gate

READY_FOR_HUMAN_DEPLOYMENT_APPROVAL. Blocking issues 0. 이 결과는 승인 대기용 기술 검증이며 운영 배포·공개 서비스 승인·첫 고객 활성화를 뜻하지 않습니다. 모든 운영 변경은 사람 승인 이후 별도 단계입니다.
