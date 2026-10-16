# Platform Intelligence 8-11 — 내부 운영 UI

기존 Workspace의 고객 선택과 직원 인증을 재사용한다. 새 관리 사이트나 공개 고객 Portal은 만들지 않았다. 새 메뉴는 **AI 플랫폼 진단**, OWNER 전용 전사 메뉴는 **학습 인사이트**다. View ID는 `platform-intelligence`와 `platform-insights`이며 기존 숫자 탭과는 명시적 매핑으로 연결한다. Pilot의 기존 28~34 매핑과 CITED/Studio의 독립 mounting을 유지한다.

직원 흐름은 고객 선택 → 여섯 플랫폼 개요 → 플랫폼 상세 → 준비도 점검/공식 근거 → 증거/관측 → 표준 작업 후보 → 기존 업무 → 실험이다. 학습 인사이트는 고객 화면과 분리한다. 새 고객 목록·업무 상태·성과 지표는 만들지 않는다.

## 구성

`src/components/platform-intelligence/operations.tsx`는 개요/상세/집계 로딩과 명시적 PREPARE_WORK 요청을 담당한다. `sections.tsx`는 공식 정보, 점검 표, 증거, 기존 업무, 실험, 집계의 표시를 맡는다. `client.ts`는 기존 `/api/platform-intelligence`만 호출하며 domain engine이나 Prisma를 실행하지 않는다. `ui-state.ts`는 안전한 상태 문구와 표시 형식을 정의한다. CSS Module은 새 PI 화면에만 적용한다.

기존 `server/read-model.ts`의 읽기 응답을 필요한 범위에서 확장했다. 개요에는 플랫폼별 공식 FACT 수와 검증 팩 상태, 상세에는 공식 FACT 요약/안전한 링크/확인·검토 기한/Rule 연결, 각 점검의 공식 근거가 포함된다. `server/operations-projection.ts`는 8-10 릴리스와 stable ID/version/FACT/승인 상태/claim/scope/source reference/URL/hash가 일치하는 공개 자료만 투영한다. 고객 Knowledge, HYPOTHESIS, SYNTHETIC namespace, 임의 출처/claim은 표시하지 않는다. 원본 provenance·본문·evidence IDs·reviewer·파일경로를 내보내지 않는다. 글로벌 Knowledge API의 기존 metadata 계약은 그대로다.

기존 업무의 Task/Execution/Studio 상태와 현재 Pilot work 상태를 재사용하며, 명시적으로 연결된 Proposal의 승인 상태만 추가로 표시한다. SOURCE_CHANGED/SOURCE_MISSING이면 과거 DONE을 현재 완료로 보여주지 않는다. 실험은 기존 window/action reference와 현재 결과의 값/표시 delta/주의사항만 투영한다. `displayDelta`를 그대로 사용해 비율 차이와 %p를 혼동하지 않는다. Metric 정의·계산·분모는 변경하지 않았다.

## Flags와 권한

서버 요청 시 STORAGE_MODE=postgres와 두 PI flags가 모두 true일 때 메뉴를 노출한다. 브라우저에 환경변수나 DB 설정을 전달하지 않고 boolean만 전달한다. 기본 flags off에서는 새 메뉴/API 호출이 없으며, PI 직접 진입에는 안전한 비활성 안내를 표시한다. flags가 켜져 있지만 schema가 없는 격리 legacy DB에서도 저장소 미활성 안내를 표시한다. migration을 자동 실행하지 않는다.

서버가 조회마다 현재 직원 역할·프로젝트 배정·조직·동의를 확인한다. UI의 역할별 메뉴 숨김은 UX일 뿐 승인 경계가 아니다. VIEWER의 PI 직접 URL은 서버 Page에서 404, API는 403으로 거절한다. 배정 MANAGER/ANALYST는 해당 고객의 PI를 조회하며, 다른 고객 URL은 안전한 접근 거절 상태다. Insight는 기존 OWNER 전용 API를 사용한다. 클라이언트가 role/environment/current clock/consent를 선택하지 않는다.

## 데이터와 화면

PI 직접 진입은 기존 인증 Catalog API의 projectOptions로 고객 ID·이름만 받아 기존 선택기에 넣는다. Session에 추가한 읽기 전용 selector projection은 기존 allowedProjects로 현재 배정·조직을 확인하며, 이 조회도 AccessEvent에 기록한다. PI 초기화에서 원문을 포함하는 legacy Workspace API를 호출하지 않는다. 일반 Workspace 메뉴로 이동하면 기존 전체 조회를 필요한 시점에 수행한다. 새 고객 DB나 별도 고객 선택 UI는 없다.

개요는 서버 Registry 순서의 여섯 카드를 한 번의 Overview API로 받는다. 카드별 추가 요청은 하지 않으며 상세를 열 때 해당 Detail API 한 번을 호출한다. 고객 변경·상세 종료 시 요청을 abort하고 key가 다른 응답을 버려 이전 고객 데이터를 새 고객 화면에 남기지 않는다.

팩만 등록된 상태에서 구성된 네 플랫폼은 PARTIAL/UNKNOWN, score=null이다. 표시명은 내부 준비도이며 null을 평가 보류로 표시한다. Gemini/Naver는 공식 정보 2건과 진단 규칙 미구성을 중립적으로 표시한다. UNKNOWN은 빨간 FAIL과 구분한다. 확인된 문제와 증거 부족을 별도로 센다. 공식 schema 불필요 사실을 schema 필수 점검으로 바꾸거나 llms.txt 작업을 제안하지 않는다.

공식 FACT에는 claim summary, title/domain, 새 창의 HTTPS 링크, FACT/APPROVED, verified/review due/expiry, Rule 연결을 표시한다. 재검토 예정일 또는 만료일이 7일 이내이거나 지났으면 재검토 필요를 표시한다. 이는 UI 운영 안내이며 공식 플랫폼 주장이 아니다. 현재 팩은 `humanApprovalRecorded=false`이므로 **운영 승인 전 검증 팩**을 명시한다. 새 승인 UI는 만들지 않았다.

Action/Experiment/Insight가 0개인 현재 상태를 그대로 표시한다. 향후 후보에는 업무명/category/priority, 승인·컴플라이언스 조건과 효과 검증 전 상태를 표시한다. 업무 준비는 현재 저장된 evaluation이 있을 때 명시적인 PREPARE_WORK만 보낸다. 평가가 미저장 상태면 버튼을 비활성화하고 필요한 조건을 안내한다. 자동 평가 저장·Task 생성·Execution 연결·사이트 수정은 하지 않는다. 서버의 createsTask=false를 확인하며, 실제 승인은 기존 업무 절차를 이용한다.

실험의 양수/0/음수 변화는 같은 구조로 표시하며 작업 이후 관찰됨/근거 부족/비교 불가를 구분한다. stale 결과의 수치는 숨긴다. 집계는 Observed Volume과 Observed Outcome을 분리하고 양수/0/음수·제외를 함께 표시한다. sourceState가 CURRENT가 아니거나 privacy suppression이면 통계를 숨긴다. 원문·개별 고객 결과·lineage는 표시하지 않는다.

새 UI는 외부 AI·crawler를 호출하지 않는다. 공식 링크는 직원이 클릭할 때만 열리며 URL 입력/수정 UI는 없다. 390px에서 카드 그리드를 한 열로 전환하고 표는 내부 스크롤에 가둔다. 색상과 상태 텍스트를 함께 쓰고 실제 button/link/summary를 사용한다. Desktop 상단 줄바꿈 보정도 PI CSS scope에만 적용한다.
