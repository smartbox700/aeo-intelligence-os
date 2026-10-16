# Platform Intelligence 8-11 — Internal Operations UI & Workflow Integration

판정: **READY_WITH_WARNINGS**. 기존 Workspace에 직원용 AI 플랫폼 진단과 OWNER 전용 학습 인사이트를 연결했다. 원본 DB migration·flags 활성화·사람의 운영 승인·실제 고객 score 생성은 수행하지 않았다.

## A. UI Architecture

새 UI는 src/components/platform-intelligence의 operations.tsx, sections.tsx, client.ts, ui-state.ts, CSS Module로 구성했다. 기존 8-9 인증 API만 사용하며 브라우저에서 Prisma나 PI domain engine을 실행하지 않는다. 서버의 읽기 투영에 공식 FACT와 점검 근거, 현재 업무/실험의 표시 metadata를 추가했다. 새 API resource나 별도 관리 사이트는 없다.

PI 직접 진입에서 기존 Workspace 전체 응답이 원문까지 가져오는 문제를 피하기 위해 기존 Catalog API에 projectOptions를 추가했다. 이는 현재 권한으로 볼 수 있는 projectId/label 두 필드뿐이다. Session에는 기존 allowedProjects를 이용하는 읽기 전용 selector projection만 추가했으며 Catalog 조회도 AccessEvent에 남긴다. 기존 고객 선택기를 그대로 사용하고 새로운 고객 DB나 별도 목록 UI는 만들지 않았다. 일반 Workspace 메뉴로 나가면 기존 전체 조회를 필요한 시점에 수행한다.

## B. Workspace Integration

메뉴는 **AI 플랫폼 진단**, **학습 인사이트**다. stable View ID는 platform-intelligence / platform-insights이며 기존 tab 36/37에 명시적으로 매핑했다. 기존 Pilot 28~34 매핑, CITED 35, Studio 21을 보존했다. 새 화면에서 PilotPanel을 범위 조건으로 mount하지 않는다. 고객 변경/상세 종료 시 요청을 abort하고 이전 key의 응답을 버린다.

서버가 요청 시 STORAGE_MODE=postgres와 두 PI flags를 확인해 메뉴 표시 boolean을 전달한다. NEXT_PUBLIC build-time flag로 고정하지 않았다. 기본 flags off에서는 메뉴와 PI API 호출이 없고, PI 직접 URL은 안전한 비활성 안내만 표시한다. VIEWER의 PI 직접 URL은 서버 Page에서 404로 거절하며 기존 일반 보고서 화면은 유지한다.

## C. Platform Overview

Catalog로 기존 선택기의 최소 metadata를 받은 뒤 Overview API 한 번으로 Registry 순서의 여섯 카드를 표시한다. 카드마다 API를 연속 호출하지 않고, 상세를 열 때 해당 Detail API만 호출한다.

| Platform | 공식 FACT | Rule | RuleSet | 기본 Readiness / score |
| --- | --- | --- | --- | --- |
| ChatGPT | 5 | 1 | 구성됨 | PARTIAL / null |
| Google AI Search | 8 | 3 | 구성됨 | PARTIAL / null |
| Gemini | 2 | 0 | FACT_ONLY | NOT_CONFIGURED / null |
| Naver AI | 2 | 0 | FACT_ONLY | NOT_CONFIGURED / null |
| Claude | 4 | 1 | 구성됨 | PARTIAL / null |
| Perplexity | 2 | 1 | 구성됨 | PARTIAL / null |

각 카드에는 상태, 내부 준비도, 확인된 문제/증거 부족 수, 증거 충족률, 공식 정보/관측 수, 진행 업무/실험 수를 표시한다. 기본 팩의 source=null을 실제 고객 증거로 추측하지 않으므로 평가 보류가 정상이다.

## D. Platform Detail

내부 준비도 → 준비도 점검 → 증거/관측 → 공식 확인 정보 → 표준 작업 후보 → 기존 업무 → Before/Action/After 실험 순서로 구성했다. 점검은 Rule ID/version, status/reason, evidence availability, 안전한 공식 basis/확인일, 후보 수를 보여준다. 관측은 날짜/channel/method/model status/verification/context completeness만 표시하며 기본 화면에 원문을 복제하지 않는다.

공식 정보는 승인된 8-10 v1의 stable ID/version/type/claim/scope/source type/reference/URL/hash와 일치하는 공개 FACT만 투영한다. 임의 URL, HYPOTHESIS, 고객 Knowledge, 다른 scope의 같은 ID를 표시하지 않는다. claim summary, title/domain, 새 창 HTTPS 링크, FACT/APPROVED, verified/due/expiry, Rule usage를 표시한다. 긴 source 본문이나 provenance 전체는 보내지 않는다. 기본 화면에 불필요한 기술 ID/version은 접어 둔다.

현재 humanApprovalRecorded=false이므로 **운영 승인 전 검증 팩**을 명시한다. APPROVED 레지스트리 상태를 실제 사람이 운영 승인했다는 뜻으로 표시하지 않는다. due/expiry가 7일 이내이거나 지났으면 재검토 필요를 표시한다. 이 7일 안내는 내부 UI 정책이며 Knowledge의 기한을 변경하지 않는다.

## E. Readiness UX

표시명은 내부 준비도다. null은 평가 보류이며 실제 0과 구분한다. PARTIAL은 증거 부족, NOT_CONFIGURED는 승인 규칙 없음으로 설명한다. UNKNOWN과 FAIL은 색상과 문구를 모두 구분하고 N/A를 별도로 표시한다. reasonCode를 바탕으로 robots agent 증거, HTML/header, 페이지 텍스트 등 다음 확인 사항을 안내한다.

점수 근처에 “내부 준비도는 공식 플랫폼 점수나 추천 확률이 아닙니다.”를 표시한다. UI에서 새 점수·weight·Metric을 계산하지 않는다. 서버의 기존 displayDelta를 사용하며 비율 자체는 %, 비율 차이는 %p로 구분한다. stale 실험 결과 수치는 숨긴다.

## F. Fact-only UX

Gemini/Naver에는 공식 정보 2건과 중립적인 RuleSet 미구성 안내를 표시한다. 오류나 빨간 FAIL로 취급하지 않는다. Google AI와 Gemini Consumer/API channel을 구분하며 Naver 일반 웹/Place/Search를 혼합하지 않는다. Google의 special AI schema 불필요 FACT는 그대로 보여주고 mandatory schema check나 llms.txt 추천 작업을 만들지 않았다. 각 검색/학습/user bot을 같은 Rule로 취급하지 않는다.

## G. Work / Experiment / Insight

실제 팩의 Action/Experiment/Insight는 모두 0개다. 등록된 표준 작업 없음, 연결된 기존 업무 없음, 아직 비교 가능한 실험 없음, 집계 가능한 운영 실험 데이터 없음으로 표시한다. 예시 성과나 Synthetic 통계를 실제 운영 데이터로 채우지 않았다.

향후 후보에는 category/priority/approval/compliance와 효과 검증 전 상태를 표시한다. 현재 저장된 진단이 있을 때만 직원의 명시적 PREPARE_WORK를 보낸다. createsTask=false를 확인하며 Task 생성/자동 수정/Execution 연결은 수행하지 않는다. 미저장 진단에서는 필요한 조건을 안내하고 버튼을 비활성화한다.

업무 상태는 기존 Task/Execution/Proposal/Studio/Pilot의 현재 read model만 이용한다. SOURCE_CHANGED/SOURCE_MISSING이면 과거 DONE을 현재 완료처럼 표시하지 않는다. 실험은 Before 기간/값, Action reference, After 기간/값, Observed Delta, attribution, 표본/제외/주의사항을 같은 구조로 표시한다. 양수/0/음수를 동일하게 다룬다.

Insight는 OWNER 전사 화면이며 Observed Volume과 Observed Outcome을 분리한다. 고객/실험/관측 수, 중앙/평균 변화, 양수/0/음수, 제외를 표시하고 sourceState/현재 동의/privacy suppression에 따라 수치를 숨긴다. 관찰된 패턴이며 인과효과나 향후 성과를 보장하지 않는다고 설명한다. 미래 데이터의 UI 표시 검사는 브라우저 응답 fixture로만 수행했으며 DB에 Action/Experiment/Insight를 등록하지 않았다.

## H. Permissions / Privacy

서버의 현재 인증·역할·조직·프로젝트 배정·동의가 최종 경계다. UI 메뉴 숨김은 UX다. 실제 브라우저에서 MANAGER/ANALYST의 배정 고객 조회, 다른 고객 URL/API 거절, 비OWNER Insight 거절, VIEWER Page 404/API 403을 확인했다. 접근 불가 고객을 선택한 URL에서는 다른 고객 이름/카드를 렌더링하지 않는다.

PI 직접 진입에서 /api/workspace 요청이 0회임을 검증했다. PI의 실제 API 응답과 DOM에 rawText, private raw, session token, password hash, DB URL, 파일경로, cross-client lineage, Synthetic sentinel이 없음을 확인했다. 공식 자료 URL과 요약은 명시적인 공개 whitelist다. 일반 Workspace 메뉴로 이동하면 기존 동작대로 조회가 실행되고, PI로 돌아올 때 추가 원문 조회는 하지 않는다. UI load 중 외부 서비스 호출도 0회다.

## I. Responsive

Desktop 1440×1000과 390×844에서 실제 화면을 확인했다. 6개 카드는 3열/2열/1열 responsive grid를 사용하며, 넓은 표는 이름 있는 내부 스크롤 영역에 가둔다. 개요와 6개 상세 모두 document horizontal overflow=0을 검증했다. 버튼/링크/summary는 키보드 접근 가능하며 상태를 색상만으로 전달하지 않는다. Desktop 상단 줄바꿈 보정도 PI CSS scope에만 적용했다.

- [Desktop 개요](<C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/output/stage7-5/platform-8-11-67acf8d9-f347-49a6-9c8f-79a34785d63e/ui-runtime/output/pi811-overview-desktop.png>)
- [390px 개요](<C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/output/stage7-5/platform-8-11-67acf8d9-f347-49a6-9c8f-79a34785d63e/ui-runtime/output/pi811-overview-mobile.png>)
- [390px Google 상세](<C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/output/stage7-5/platform-8-11-67acf8d9-f347-49a6-9c8f-79a34785d63e/ui-runtime/output/pi811-detail-mobile.png>)

## J. Empty / Error States

FEATURE_DISABLED, PERSISTENCE_UNAVAILABLE, PERSISTENCE_SCHEMA_UNAVAILABLE, PROJECT_ACCESS_DENIED, NOT_CONFIGURED, SOURCE_CHANGED, CONSENT_UNAVAILABLE와 로그인/권한/CAS/rate 오류를 구분한다. 서버의 raw message/stack/SQL을 표시하지 않고 안전한 문구와 재시도를 제공한다. 로딩/오류 상태와 이전 요청 취소를 구현했다.

PI schema가 없는 별도 legacy 복원 DB에서 실제 UI가 저장소 미활성 안내를 표시하고 crash하지 않는 것을 확인했다. PI table은 검사 전후 모두 없으며 자동 migration이나 seed가 없다. flags off의 일반 Workspace 회귀도 별도 E2E에서 통과했다.

## K. Preservation

원본 DB data/schema 동일=true/true, 20개 도메인 동일=true. 시작 시 Git 대상 기존 파일 334개 중 325개 동일, 삭제 0개다. 의도적으로 변경한 기존 파일은 다음과 같다.

- src/lib/platform-intelligence/persistence/session.ts
- src/lib/platform-intelligence/server/http.ts
- src/lib/platform-intelligence/server/read-model.ts
- src/lib/platform-intelligence/server/service.ts
- src/lib/workspace-views.ts
- tests/platform-official-pack.phase.test.ts
- src/app/os/page.tsx
- src/app/page.tsx
- src/components/workspace.tsx

Session 변경은 고객 ID/label의 읽기 전용 projection뿐이다. 기존 raw/Metric/Knowledge/Rule/RuleSet/Action/Experiment/Insight engine, 8-10 팩과 migration/Prisma schema는 변경하지 않았다. 기존 workspace.tsx 사용자 수정은 유지하면서 새 view만 연결했다. 기존 8-10 phase privacy assertion은 raw claim payload를 금지하되 승인된 공개 claimSummary는 허용하도록 명확히 했다.

실제 검증 runtime과 관련 소스/테스트 65개 hash가 동일하다. 원본 PI table=false, flags={"enabled":false,"persistenceEnabled":false}. 원본에 팩은 설치하지 않았다. 격리 UI DB의 PI record 변경 없음=true; legacy DB의 table/record 변경 없음=true. 원본 백업은 보호된 외부 경로에 별도 키와 함께 보존했다.

## L. Tests

| 검사 | 최종 결과 |
| --- | --- |
| 신규 UI/state/public projection/selector unit | 25 PASS |
| 전체 unit / 실제 DB / PDF / preservation | 459 PASS, 39개 파일 |
| Prisma generate / Next build / TypeScript | PASS / PASS / PASS |
| flags off 일반 Workspace + 기존 전체 E2E | 17 PASS / 1 기존 FAIL / UI 전용 4개 skip |
| 실제 팩 DB UI E2E | 3 PASS / legacy 전용 1개 skip, exit=0 |
| 실제 legacy DB UI E2E | 1 PASS / pack 전용 3개 skip, exit=0 |
| 두 UI DB의 PI record/table 상태 유지 | PASS |
| 원본 data/schema/20개 도메인 / 예상 밖 파일 변경 0 | PASS |
| git diff --check | PASS, 기존 Windows 줄바꿈 안내 |

UI 전용 4개 테스트는 실제 두 격리 DB에서 모두 실행했다. 기본 full suite의 PostgreSQL phase 6개 skip을 성공으로 계산하지 않았다. 해당 과거 단계의 persistence/restart/backup 증거를 유지하며, 이번 UI는 8-10 암호화 팩 백업을 새 DB로 실제 복원했다. 응답 fixture는 오류 표시·future candidate/prepare·SOURCE_CHANGED·양수/0/음수 실험·집계의 표시 계약을 확인하는 용도이며, 실제 데이터로 등록하지 않았다.

전체 E2E의 남은 실패는 기존 Pilot 390px overflow(pilot.spec.ts:50:532)다. Studio 배열 순서 민감성 경고는 이번에 통과해도 해결된 것으로 취급하지 않는다. Next filesystem tracing warning 3개, PreScan/CITED direct Experiment adapter 미지원 및 일부 Experiment Metric 지원 한계를 유지한다. 관련 없는 Pilot/Studio UI나 Metric을 수정하지 않았다. 앞선 테스트의 Next 접근성 route announcer와 앱 alert 중복 선택은 테스트 범위를 PI root로 한정해 수정했고, 최종 UI E2E는 통과했다.

## M. First Pilot Readiness

직원은 한 Workspace에서 진단 가능한 플랫폼/FACT_ONLY 플랫폼/증거 부족/현재 업무와 빈 상태를 구분할 수 있다. 실제 운영 Pilot 전에는 별도 OWNER 검토, 운영 migration 및 flags 배포 승인, 고객 동의/증거 선택, 표준 작업 승인과 현재 증빙을 확인해야 한다. 지금은 humanApprovalRecorded=false, 실제 고객 score 없음, 운영 flags off 상태다.

격리 UI DB의 PRODUCTION 저장 수는 Knowledge 23(모두 FACT), Rule 12(승인 6 + draft 6), RuleSet 8(승인 4 + draft 4), Readiness 정책 4다. Action/Readiness 결과/Experiment/Insight는 0개다. 별도 SYNTHETIC HYPOTHESIS 1개는 UI에 표시하지 않는다. 깨끗한 회귀 DB의 13개 PRODUCTION domain count는 모두 0이며 원본에는 신규 PI table 자체가 없다. 서로 다른 DB count를 혼합하지 않는다.

운영 설계는 25-operations-ui.md, 상태 계약은 26-ui-state-contract.md, 실제 Pilot gate는 27-first-pilot-readiness-checklist.md에 정리했다.

## N. 다음 판정

**READY_WITH_WARNINGS**. 직원용 UI 통합과 권한·privacy·빈 상태·responsive·읽기 투영·원본 보존을 검증했다. 기존 Pilot 경고와 별도 실제 운영 승인/배포 gate는 남아 있다. 원본 환경에서 UI를 강제로 활성화하거나 검증 팩을 사람의 운영 승인으로 바꾸지 않았다.

증거 디렉터리: C:/Users/zhang/Downloads/AEO 마케팅 프로그램/AEO 마케팅 프로그램/output/stage7-5/platform-8-11-67acf8d9-f347-49a6-9c8f-79a34785d63e. full-unit-db-pdf.log, production-build.log, full-typecheck.log, full-e2e.log, regression-results.json, ui-pack.log/result.json, ui-legacy.log/result.json, 두 UI restore manifest, final-preservation.json, production-counts.json과 실제 PNG를 보존한다. 앞선 시도 로그는 attempt-1/attempt-2에 별도 보존했다.
