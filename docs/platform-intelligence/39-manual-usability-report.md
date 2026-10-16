# Manual Usability Acceptance — 완료 보고서

최종 상태: **READY_WITH_WARNINGS**. 운영 배포와 8-13A/B provisioning은 진행하지 않았습니다. 실제 사용자의 수동 수락 판정은 아직 수행 전입니다.

## A. Manual Test Architecture

원본 앱 소스는 수정하지 않았습니다. CLI가 ignored 보호 경로에 앱 사본을 만들고, 그 사본에만 SYNTHETIC 환경의 service adapter·테스트 배너·표시 formatter를 적용합니다. 도메인 엔진과 HTTP command/인증 계약은 기존 구현을 사용합니다. 개발 서버는 loopback에만 bind합니다. 일반 production build에는 manual fixture·banner·전용 route가 없습니다. UI 시나리오 응답을 브라우저에서 가로채서 만든 결과가 아니라, 실제 테스트 DB의 저장 데이터를 실제 API로 읽습니다.

## B. Isolated Database

DB는 정확히 aeo_manual_usability_test입니다. 새 빈 DB에 전체 migration을 적용했고 원본/기존 backup 데이터를 복사하지 않았습니다. DB 소유 marker, host category, storage mode, NODE_ENV, opt-in flag를 확인합니다. 다른 DB·remote host·production 모드는 거부합니다. Reset은 marker가 있는 정확한 테스트 DB의 데이터만 초기화하며 migration 이력은 유지합니다.

## C. Test Login

manual-owner는 가상 OWNER입니다. Setup/start 시 임시 비밀번호를 무작위 생성하고 scrypt hash만 DB에 저장합니다. 비밀번호는 사용자 터미널에 한 번만 표시하며 로그·artifact·이 보고서에는 저장하지 않습니다. Start마다 갱신되므로 최신 터미널 출력을 사용합니다. 자동 검증에서는 표시를 억제하고 별도 메모리 내 무작위 암호로 실제 로그인 API를 검증했습니다. Production Staff/session을 복사하지 않았습니다.

## D. Synthetic Customer

[TEST] 새봄치과 수원점, MEDICAL, saebom-dental.example.invalid, [TEST] 경쟁업체 3곳을 사용합니다. 질문·응답·증빙·Task·Studio·동의는 모두 생성된 가상 자료입니다. PI 저장 environment는 전부 SYNTHETIC이며 PRODUCTION row=0을 매 시나리오에서 확인했습니다. Official Pack은 원본 공식 contents/manifest checksum을 유지한 테스트 설치이며 실제 사람 운영 승인이 아닙니다. 설치 checksum에는 가상 승인자/시각이 포함되므로 8-10 test OWNER 설치 checksum과 같다고 주장하지 않습니다.

## E. Readiness Scenarios

Initial은 4 PARTIAL/null, Gemini/Naver NOT_CONFIGURED/null입니다. ChatGPT blocked FAIL, Google PASS/FAIL/PASS, Claude UNKNOWN, Perplexity PASS, Gemini/Naver FACT_ONLY가 실제 엔진/API에서 확인됐습니다. 증거가 있는 수치도 내부 준비도일 뿐 추천 확률이나 공식 점수가 아닙니다. UNKNOWN을 FAIL로 바꾸지 않았습니다. 증거 freshness와 Pack validity를 우회하지 않습니다.

## F. Action Flow

SEARCHBOT_ACCESS_REVIEW_TEST와 NOINDEX_REVIEW_TEST는 SYNTHETIC, NO_EFFECT_CLAIM입니다. FAIL finding에 실제 후보가 연결됩니다. 기존 PREPARE_WORK command는 createsTask=false이며 브라우저 클릭 전후 Task count가 동일했습니다. Seed가 별도로 생성한 [TEST] Task는 실제 ActionExecutionLink로 연결되고 Studio 내부 검토·가상 고객 승인·가상 적용·로컬 HTML 대조·proofRefs·CURRENT를 사용합니다. 실제 외부 사이트 수정/작업 발송 없음.

## G. Experiment Flow

실제 Question/Response 및 measurement snapshot, experiment/result 저장 계약을 사용합니다. 질문 30개를 각 Before/After에서 관측한 합성 자료로 3/30=10.0% → 7/30=23.3%, +13.3%p를 계산했습니다. Negative 20% → 10%, -10%p, Zero 10% → 10%, 0%p도 검증했습니다. 모델이 달라진 자료는 NOT_COMPARABLE이며 delta=null입니다. UI는 Action 적용 이후 관찰된 변화로 표시하며 인과효과를 주장하지 않습니다.

## H. Insight Flow

다섯 독립 가상 프로젝트 중 +5,+3,0,-2%p 네 곳이 포함되고 모델 변경 프로젝트 1곳은 제외됩니다. insight 단독 시나리오의 평균/중앙값은 각각 1.5%p, 양수2/0변화1/음수1, 제외1입니다. 실제 8-7 집계 엔진·동의 gate·CURRENT 검사·privacy suppression을 사용했습니다. all은 주 고객 +13.3%p도 포함하므로 평균 3.8667%p, 중앙값3%p, 포함5/제외1입니다. 사용자에게 관찰된 패턴이며 인과효과나 향후 성과를 보장하지 않는다고 표시합니다.

## I. Production Guards

실제 생성 runtime guard를 production / non-loopback / reference DB / mode-off에서 실행해 모두 거부함을 확인했습니다. source guard matrix 및 fetch/DNS/direct socket 외부 차단 테스트 통과. manual subprocess에서 제공사 키를 제거하고 paid/free AI flags OFF, 전역 outbound transport guard를 적용합니다. 실제 브라우저의 자동 외부 요청은 0건입니다. 공식 문서 링크를 사용자가 직접 클릭하는 동작은 자동 테스트에 포함하지 않았습니다.

## J. Preservation

8-12 기준 앱·Prisma·migration 파일 hash 변경 0. 원본 data/schema/20 domains 전후 동일, PI 테이블 absent, 운영 flags OFF, 원본 .env 불변, humanApprovalRecorded=false. package.json에는 실행 명령 4개, .gitignore에는 manual 보호 경로만 추가했습니다. 향후 운영 배포 시 package/config 변경을 포함해 배포 gate를 다시 확인해야 합니다. 기존 backup 파일을 수정하지 않았습니다.

## K. Tests

- 전체 단위/실DB/PDF: 461 PASS, 특수 phase 9 SKIP.
- 일반 앱 Prisma generate / production build / tsc: PASS. 최신 harness tsc도 PASS.
- 일반 앱 전체 E2E: 16 PASS / 기존 2 FAIL / 별도 시나리오 6 SKIP.
- 기존 실패: Pilot 390px overflow, Studio task 배열 순서 비교 민감성. 이번 범위에서 수정하거나 숨기지 않았습니다.
- Manual 실제 브라우저 initial / all / negative / zero / insufficient: 각 1 PASS. 여섯 카드/상세, 원본·루트 Workspace 배너, 390px overflow 0, 외부 자동 요청 0. 초기 all 테스트 이후 루트 배너 검증을 추가했고 zero/insufficient에서 추가 경로를 확인했습니다.
- CLI 시나리오 initial / chatgpt-fail / google-mixed / positive / negative / zero / insufficient / insight / all: 실제 DB/domain 검증 PASS.
- 실제 runtime guard 4조건, guard/network unit 2개 PASS. 일반 production bundle에서 fixture marker 0건.

초기 seed에서 발견한 누락 Organization, 경쟁업체 ID 충돌, 감사/동의 시각 순서는 fixture 생성 로직에서 수정했습니다. UI 결과를 하드코딩하거나 엔진의 보호 조건을 완화하지 않았습니다. Browser launcher DB 설정과 초기 Insights 로딩 완료 대기 역시 검증 harness에서 보정했습니다.

## L. User Start Instructions

[대표 실사용 테스트 안내](37-manual-usability-guide.md)와 [피드백 양식](38-manual-usability-feedback.md)을 제공합니다. Setup → Start 후 3013 포트에서 수동 확인합니다. 비밀번호는 start PowerShell 출력에만 있습니다. 서버 종료 Ctrl+C, 시나리오 변경/초기화 후 다시 start합니다. 완료 시 DB는 initial로 초기화했고 서버는 실행하지 않았습니다.

## M. Final State

READY_WITH_WARNINGS. 사용자가 직접 테스트할 준비가 됐습니다. 기존 두 회귀 경고와 Next tracing 경고를 유지합니다. 실제 사용자 수락 결과·실제 고객 성과·운영 배포 완료로 해석하지 않습니다. humanApprovalRecorded=false.
