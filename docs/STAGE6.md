# 6단계 · AEO Execution Engine v1.0

현재 화면: `http://127.0.0.1:3000/?view=execution-studio` → **AEO 실행 스튜디오**. 기존 디자인·직원 로그인·고객사 배정을 유지한다. 이 버전은 로컬 내부 운영용이다.

## 1. 기존 5단계 실제 구현 상태

Next.js 16.4 / React 19 / TypeScript / Prisma 6 / PostgreSQL. 파일 저장소도 남아 있으나 직원 인증에는 PostgreSQL이 필요하다. 고객 등록·업종별 온보딩·AI 질문·유형별 관측·경쟁사 비교·안전한 홈페이지 진단·최적화 과제·수정안 버전·고객 승인·실행 기록·Baseline/Follow-up·승인 HTML 보고서·영업/수익성·직원 권한이 존재한다.

기존 `OptimizationTask`의 payload (`Task`), `ExecutionDetail`, `Operations.proposals`, `ProposalVersion`, `Approval`을 재사용한다. 새 고객 승인 테이블이나 중복 업무 시스템을 만들지 않는다. 자동 사이트 게시, 실제 소비자 AI 자동 수집, 고객 전자서명, CMS 연결, 전체 웹사이트 중복 콘텐츠 검색은 기존·신규 모두 미구현이다.

현재 PC DB를 기준으로 개발 전 고객 1개, 질문 9개, 응답 5개, 진단 1개, 과제 3개를 백업했다. 다른 PC의 PostgreSQL 데이터는 이번 개발에서 복원하지 않았다. 다른 PC의 더 오래된 JSON 백업과 현재 PC 데이터는 구별해야 한다.

## 2. 새 기능

| 우선순위 | 실제 구현 |
| --- | --- |
| P0 | 검증 사실 저장·이력·만료, 공식 페이지 분석, 진단/질문/과제 연결, 원본/수정안 편집, 버전 무효화, 내부 검토/고객 승인, 다운로드, 적용 증빙, 공개 HTML 재점검, 권한/보안 검증 |
| P1 | Schema 부분집합 생성·검사, Question-to-Content 템플릿, UTF-8 ZIP, 기존 동일 조건 재측정 계획·응답 연결 |
| P2 기본 | 브랜드 홈페이지/네이버/쿠팡 채널 분리, 제공 상품 HTML 분석, 확인된 상품명·사양·가격·판매 정책 문안, 의료/법률/브랜드/상품 템플릿, 기존 작업시간·원가 화면 연결 |
| P2 미구현 | 플랫폼 API·자동 상품 등록, 상품 옵션별 전용 편집기, 이미지/OCR 검사, 고급 업종별 문장 생성, 스튜디오 전용 수익성 자동 분류 |

## 3. 생성 가능한 결과물

공식 서비스/전문가/상담·예약/상품/브랜드/필요한 FAQ 템플릿, 제목·메타·H1 변경안, 확인 사실 안내 문단, 공개 HTML 수정 초안, 적용 지시서, 개발자 체크리스트, JSON-LD, UTF-8 공개 사실 CSV 및 납품 ZIP.

ZIP: `01_고객사_진단요약.md`, `02_홈페이지_수정지시서.md`, `03_콘텐츠_수정안.md`, `04_구조화데이터.json`, `05_적용체크리스트.txt`, `06_검수및재측정계획.md`, HTML 초안, CSV. JSON-LD를 생성하지 않은 경우 JSON 파일은 `null`로 명시한다. 전체 홈페이지 교체 파일이 아니라 필요한 구역을 반영하기 위한 수정 초안이다.

템플릿이 지원하지 않는 자유 문장 생성은 사람이 편집한다. `ContentGenerator` 인터페이스를 분리했으며 이 단계 구현은 `TemplateContentGenerator`뿐이다. 내부 증빙·직원 연락처·관측 원문·원가·키를 패키지에 직렬화하지 않는다.

## 4. 데이터 모델

- `Entity.studioRepository.facts`: 항목, 값, 출처/URL/내부 증빙, 확인일/확인자, 상태, 만료일, 갱신일, 이전 값 이력. VERIFIED라도 증빙이 없거나 만료하면 사용하지 않는다. 가격/통화는 확인 후 24시간 경과 시 만료 처리한다. 충돌하는 VERIFIED 값은 선택하지 않는다.
- `Entity.studioRepository.pages`: DEMO/LIVE/MANUAL 및 WEBSITE/NAVER/COUPANG 구분, URL, 원본 SHA256, 수집 시각, title/description/H1/H2/H3, 안전하게 추출한 본문/링크, JSON-LD, 기술/본문 단서, 관련 Audit ID.
- `Task.studio`: 페이지/질문/기존 Proposal 연결, 수정안 버전, 상태, 내부 검토, 버전별 내보내기 해시, 적용 기록, 대조 결과, 재측정 계획/응답, 상태 이력 및 이전 적용·검증·후속 기록 보존.
- 기존 `ClientEntity.payload`, `OptimizationTask.payload`, `Project.operations` JSON에 저장하므로 **DB 초기화·추가 스키마 마이그레이션 없음**.

문안 또는 연결 사실을 바꾸면 기존 승인이 무효가 된다. 과거 버전·승인 이력·적용 증빙은 보존한다. 모든 적용·완료 전 현재 버전과 사실의 유효성을 서버에서 재검증한다. 기존 5단계 API로 스튜디오 승인/실행 절차를 우회할 수 없다.

## 5. 사용 화면·경로

`/`의 사이드바 또는 `/?view=execution-studio`. `GET/POST /api/execution-studio`가 조회/저장/내보내기/검증을 담당한다. `?projectId=...&preview=작업ID`는 로그인·소속 확인 후 저장된 안전 HTML을 반환한다.

1. **고객사 운영**에서 실제/DEMO 및 업종 온보딩. 순수 기존 SAMPLE은 스튜디오의 `DEMO 실행 준비` 버튼으로 준비 가능하다. 실제 고객에는 DEMO 준비를 적용하지 않는다.
2. **검증 사실정보**에서 내용과 증빙·확인 상태 저장. 기존 등록 정보나 웹페이지 단서를 자동 VERIFIED로 바꾸지 않는다.
3. **개선 대상**에서 공식 도메인의 페이지를 분석하고 질문/진단 과제를 연결한다. 네이버/쿠팡은 판매자 제공 HTML을 사용하며 수동 자료로 표시한다.
4. **개선안 편집기**에서 원본과 비교하고 사람이 최종안을 저장한다. FAQ는 적합한 질문 의도에서만 선택한다.
5. **구조화 데이터**에서 오류/중복/표시 내용 일치를 확인한다. 원본과 같은 유형의 JSON-LD가 있으면 기존 코드를 정비한 뒤 재분석하거나 새 JSON-LD를 비운다.
6. **승인 및 납품**에서 증빙 대조·내부 검토 → 고객 승인 및 규정 검토 → 납품 준비 → 파일 다운로드.
7. 실제 권한 있는 담당자가 반영한 후 적용일·증빙을 등록한다. 홈페이지는 공개 HTML을 다시 읽어 승인 버전과 비교한다. 마켓플레이스는 담당자 제공 HTML과 수동 검수 증빙을 대조한다.
8. 기존 Baseline/Follow-up 화면에서 같은 질문·플랫폼·모델·지역·검색 조건의 계획을 등록하고, 적용 후 유효 관측을 연결한다. 동일 조건 대응 쌍이 있어야 완료 가능하다.

상태: DRAFT → EVIDENCE_REQUIRED 또는 INTERNAL_REVIEW → CLIENT_APPROVAL_REQUIRED → APPROVED → READY_FOR_EXPORT → DEPLOYED → VERIFIED → FOLLOWUP_PENDING → COMPLETED. 예정일은 앱 내부 업무 기록이며 자동 AI 호출·외부 스케줄러가 아니다.

## 6. 홍제 A치과 시뮬레이션

별도 가상 프로젝트에서 DEMO 원본·기존 DEMO 관측·7개 가상 공식 사실 등록, 사람 최종 버전, 내부/고객/규정 검토, 납품 ZIP, 적용 증빙, 제목/메타/H1/본문/경로/JSON-LD 대조, 같은 조건의 DEMO Baseline/Follow-up을 연결해 COMPLETED를 검증했다. 원문은 특정 치과를 추천하지 않는 일반 안내이며 실제 AI 추천 응답이나 고객 실적을 생성하지 않았다.

시험 프로젝트·격리 인증 계정은 테스트 종료 시 정리했다. `data/backups/stage6-simulation.json`, `stage6-hongje-demo-delivery.zip`, `stage6-studio-demo.png`에 증빙을 남겼다. DEMO 페이지는 로컬 생성 HTML의 대조이며 실제 홈페이지를 수정한 것이 아니다.

## 7~8. 테스트·기존 회귀

검증 사실만 사용, 미확인/충돌/만료 차단, 소속 분리, 결정적 초안, 전후 비교, JSON-LD 구문/값/중복/리뷰 차단, 승인 없는 내보내기/적용/완료 차단, 기존 API 우회 차단, 버전 재승인, 비밀자료 제외, XSS/SSRF, 실제 DB 저장·재조회 및 관계 ID 보존을 검사한다.

최종 실행 결과는 [STAGE6-VALIDATION.md](STAGE6-VALIDATION.md)에 기록한다. 공개 실제 고객 페이지/CMS 적용, 실제 마켓플레이스 수정, 실제 AI 수집 성공은 별도 운영 검증이 필요하다.

## 9. 비용

`LIVE_AI_ENABLED=false`, `FREE_GEMINI_ENABLED=false` 유지. 스튜디오에는 AI 제공사 호출 경로가 없다. 유료·무료 AI 호출 0회. 홈페이지 읽기는 기존 안전한 HTTP 수집으로 제한하며 검색 API/AI 호출을 사용하지 않는다.

## 10. 데이터 보존·보안

기존 데이터 백업 후 업무 ID·원문·payload·관계 내용을 대조했다. 기존 writer가 변경 없는 Mention/CitationSource도 재생성하는 것을 발견하여 값이 같은 관계는 유지하도록 수정했다. 시험 중 재생성된 기존 내부 관계 ID 12개는 내용 일치·ID 충돌 검증 후 원래 백업 ID로 복원했다. 원문/업무 내용은 변경하지 않았다.

모든 API는 직원 역할·프로젝트 소속·Origin·요청 크기를 검증한다. 사실 검증·승인·납품·적용·검증은 OWNER/MANAGER만, 초안 생성·편집은 허용된 ANALYST도 가능하다. VIEWER는 기존 승인 보고서만 열람한다.

공개 페이지는 safeFetch의 DNS/IP 고정·사설/예약/메타데이터 IP 차단·리디렉션별 재검증·robots 정책·응답 1MB·총 요청 12회/40초 제한을 사용한다. 원본 HTML/스크립트는 실행하지 않는다. 미리보기는 이스케이프된 HTML 및 sandbox iframe/CSP를 사용한다. JSON-LD의 `<`는 유니코드로 이스케이프해 script 탈출을 차단한다. 키 탐지는 보조 수단이며 입력 자체에 비밀정보를 넣지 않아야 한다.

## 11. 실제 고객 운영 전 한계

사실 상태는 직원이 증빙을 확인한 기록이며 자동 진위 판정이 아니다. 페이지 검사도 정적 HTML 기준으로 JS 렌더링·모바일 실기기·전체 사이트·영구 적용을 보증하지 않는다. 의료/법률 문장은 최종 전문 담당자 검토와 심의 대상 확인이 필요하다. 공개 서비스 배포·지속 백업·영속 DB·전자서명·외부 CMS 권한은 별도 보강이 필요하다. 현재 개발 DB는 Windows 임시 폴더에 있으며 상용 고객 자료의 영속 보관용이 아니다.

## 12. 7단계 권고

영속 PostgreSQL 및 복원 검증 → 고객별 CMS 읽기/적용 권한과 승인된 변경의 롤백 → 사실 만료·충돌 알림 → 옵션별 상품정보와 플랫폼별 편집 검증 → 의료/법률 검토자 전자승인 → 조건 일치 관측 자료 누적 및 통계 한계 표시. AI 연결은 향후 별도 비용 승인·쿼터·제공사 정책 검증 후 진행한다.

## 공식 검토 근거 · 2026-10-09

Schema.org [Dentist](https://schema.org/Dentist), [MedicalClinic](https://schema.org/MedicalClinic), [LegalService](https://schema.org/LegalService), [Organization](https://schema.org/Organization), [LocalBusiness](https://schema.org/LocalBusiness), [Product](https://schema.org/Product), [Offer](https://schema.org/Offer), [BreadcrumbList](https://schema.org/BreadcrumbList), [FAQPage](https://schema.org/FAQPage)의 지원 부분집합을 사용한다.

Google [구조화 데이터 정책](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business), [Product](https://developers.google.com/search/docs/appearance/structured-data/product-snippet), [Breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)을 참고했다. [최신 변경 기록](https://developers.google.com/search/updates)은 2026년 FAQ 리치 결과 종료 및 문서 삭제를 안내한다. Schema.org 정의와 Google 검색 표시 지원은 별개이며 네이버/쿠팡 표시 지원을 주장하지 않는다.

[의료법 제56·57조](https://www.law.go.kr/법령/의료법), [변호사법 제23조](https://www.law.go.kr/법령/변호사법), [대한변호사협회 현행 광고 규칙·규정 목록](https://koreanbar.or.kr/pages/introduce/list.asp?category=3)을 검토자가 확인하는 경로로 제공한다. 자동 법률 준수 판정은 제공하지 않는다.
