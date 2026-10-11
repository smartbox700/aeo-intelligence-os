# AEO Intelligence OS — 실전 영업 시뮬레이션 기반 기능 감사

감사일: 2026-10-09 (Asia/Seoul). 대상: 현재 작업 폴더의 1~6단계 실제 코드, PostgreSQL 저장 경로, 기존 테스트. 신규 기능 개발은 수행하지 않았다.

## 1. 결론과 판정 범위

23개 업무 전체 요구 기준: **PASS 5 / PARTIAL 14 / FAIL 4 / NOT_VERIFIED 0**. 이 숫자는 사업 준비율이나 실제 고객 성과 달성률이 아니다. 각 항목의 실제 고객 운영 검증 여부는 아래에서 별도로 표시한다.

현재 제품은 사람이 실제 관측·영업·전문 검수·외부 게시를 수행하는 내부 컨설팅 도구로 활용할 수 있다. 병원명 입력만으로 120개 질문 → 30개 자동 Pre-Scan → 30일 Pilot → 유료 제안 → 지역 Benchmark가 자동으로 이어지는 플랫폼은 아니다. 특히 연구 계획은 질문 최대 20개·소비자 플랫폼 최대 3개이며 시나리오의 120×4×3을 한 계획으로 표현하지 못한다.

판정 기준:

- PASS: 요구된 핵심 기능의 코드와 이번 실행 테스트에서 정상 동작을 확인했다. 합성 입력으로 검증한 소프트웨어 동작과 실제 외부 서비스에서 얻은 관측의 진위는 구분한다.
- PARTIAL: 요구의 일부만 구현됐다. 부분 기능의 시험 성공이 전체 요구 충족을 뜻하지 않는다.
- FAIL: 요구된 기능이 없다. 관련 기반 코드가 있다는 이유로 구현된 것으로 판정하지 않는다.
- NOT_VERIFIED: 요구 기능의 코드가 있으나 실행 검증을 못한 경우. 전체 항목에서는 해당하지 않지만, 실제 외부 AI 수집·실제 의료진 승인·실제 사이트 게시 등의 하위 경로는 NOT_VERIFIED다.

DEMO는 가상 사례, 실제 유형 시험은 합성 원문을 MANUAL_OBSERVATION 또는 CONSUMER_UI_MANUAL 형식으로 넣은 시험이다. **이번 감사에서 실제 AI 소비자 서비스에 질문하거나 실존 치과 고객의 신규 성과를 수집하지 않았다.** 기존 DEMO 완료를 실제 수주·추천 증가·예약 증가로 해석할 수 없다.

## 2. 파일·화면·DB의 실제 연결

저장소 절대 루트: `C:\Users\zhang\Downloads\AEO 마케팅 프로그램\AEO 마케팅 프로그램`.

아래 모든 `src/...`, `tests/...`, `prisma/...`는 이 루트에 실제 존재하는 파일 경로다. 예: `src/lib/visibility.ts`의 절대 경로는 `C:\Users\zhang\Downloads\AEO 마케팅 프로그램\AEO 마케팅 프로그램\src\lib\visibility.ts`다.

- DB 모델 정의: `prisma/schema.prisma`. 매핑·저장·재조회: `src/lib/db.ts`의 `saveProject`, `loadDb`, `src/lib/store.ts`의 `mutate`, `getStore`.
- `Project.operations` JSON: 온보딩, 영업, 계약, 운영 단계, 개선안/승인, 청구, 원가, 수동 전환. 별도 Lead/Pilot/Contract/Partner/Benchmark 테이블은 없다.
- `ClientEntity.payload`: 고객 정보, 측정 연구 계획, 증빙, 검증 사실 및 페이지 스냅샷. `CompetitorEntity.payload`: 경쟁사 정보.
- `QuestionSet`/`Question`: 질문. `ObservationRun`/`AIResponse`/`Mention`/`CitationSource`: 관측·원문·파생 분석·출처. `MeasurementBatch`: 제한된 API 묶음 및 실행 키.
- `WebsiteAudit`/`OptimizationTask.payload`: 진단·개선 과제·실행 기록·스튜디오 버전. `Report.payload`: HTML 보고서와 생성 시점 해시.
- `StaffUser`/`StaffSession`/`AccessEvent`: 직원 인증·프로젝트 배정·접근 이력. 현재 조직 조회는 `local-org` 기준이며 파트너 테넌트 시스템이 아니다.

화면 주소는 로그인 후 `http://127.0.0.1:3000/`의 해당 메뉴다. 메뉴 선택은 `src/components/workspace.tsx`의 탭 상태로 구현돼 있어 메뉴별 독립 URL을 임의로 만들지 않았다. 실행 스튜디오는 `http://127.0.0.1:3000/?view=execution-studio`로 직접 접근한다. 운영 화면 구현은 `src/components/operations-panel.tsx`, 관측은 `src/components/consumer-lab.tsx`, 실행은 `src/components/execution-studio.tsx`를 참조한다.

## 3. 이번에 실행한 검증

| ID | 실제 실행 또는 파일 | 결과·검증 범위 |
|---|---|---|
| T0 | `npm run typecheck` | 성공, TypeScript 오류 없음. 사업 기능 동작 증명은 아님 |
| T1 | `npm test`, `tests/analysis.test.ts`, `tests/entities.test.ts`, `tests/visibility.test.ts` | 전체 89개 중 해당 시험 모두 성공. 합성 원문의 식별·분모·추천 문맥·인용·중복 언급 검증 |
| T2 | `tests/consumer.test.ts`, `tests/manual-observation.test.ts` | 모두 성공. 실제 유형 입력 형식, 입력 키·슬롯 중복, 소속, CSV/JSON, 조건 비교 검증. 실제 서비스 관측 아님 |
| T3 | `tests/measurement.test.ts`, `tests/openai.test.ts`, `tests/gemini.test.ts`, `tests/live-ai.test.ts` | 모두 성공. 모의 전송·응답 파싱·실행 키·실패·상한·비활성 차단. 실제 API 성공 아님 |
| T4 | `tests/operations.test.ts` (9개) | 모두 성공. 온보딩, 업종 초안, 승인/규정 게이트, 단계, 원가, 수동 전환, HTML 보고서, 권한 |
| T5 | `tests/studio.test.ts` (15개), `tests/optimization.test.ts`, `tests/audit.test.ts`, `tests/http-policy.test.ts` 등 | 모두 성공. 사실·초안·Schema·버전·승인·납품·DEMO 적용 대조·SSRF.  실제 게시 아님 |
| T6 | `AEO_TEST_POSTGRES=1`로 `tests/postgres.integration.test.ts` | 성공 1개, 건너뜀 없음. 격리 프로젝트의 DEMO 모의 어댑터 결과 저장/재조회, 기존 Mention/CitationSource ID 보존 |
| E1 | `tests/e2e/core.spec.ts` | 성공. UI 고객 등록·변경·질문·MANUAL_OBSERVATION 합성 응답 저장, 새로고침 후 집계·CSV |
| E2 | `tests/e2e/consumer.spec.ts` | 성공. UI DEMO 원문/증빙 저장, 3플랫폼 입력·DB 재조회·CSV 재입력·조건 경고·유료 차단 |
| E3 | `tests/e2e/operations.spec.ts` | 성공. 의료/법률/커머스 DEMO, 운영 단계·버전 승인·전후 관측·승인 HTML·작업시간·청구/원가·권한 |
| E4 | `tests/e2e/studio.spec.ts` (3개) | 성공. DEMO 치과의 사실·편집·승인·ZIP·적용 대조·후속 대응 쌍, 브랜드 채널별 납품, 보안 |
| E5 | `tests/e2e/lab.spec.ts`, `optimization.spec.ts`, `security.spec.ts` | 모두 성공. 연구소·DEMO 수정·DB 재조회·원문 보존·접근/SSRF 차단 |

실행 결과: Vitest **17개 파일 / 89개 테스트 성공**, 실패 0, 건너뜀 0, 실행 2.65초. Playwright **9개 성공**, 실패 0, 실행 35.5초. UI와 API를 함께 사용하는 기존 테스트의 DB 재조회·산출물 응답 검증을 확인했다. 모든 버튼을 사람이 직접 클릭한 수동 탐색이나 전체 메뉴별 완전 커버리지 시험은 아니다.

첫 `npm test`는 샌드박스의 상위 디렉터리 접근 거부로 설정 로딩에 실패했다. 같은 기존 테스트를 허용된 권한으로 다시 실행해 성공했다. 이는 제품 기능 실패와 구분한다. 최초 명령은 뒤이어 typecheck를 실행하므로 셸 종료 코드만으로 Vitest 성공을 판정하지 않았고, 재실행의 89개 성공 출력을 기준으로 했다. Windows glob 검색 한 번은 경로 구문 오류로 실패해 `rg tests -g '*.ts'`로 수정했다.

환경변수 파일을 변경하거나 키를 출력하지 않았다. 시험 프로세스에만 `LIVE_AI_ENABLED=false`, `FREE_GEMINI_ENABLED=false`를 지정했다. 모의 전송 테스트는 테스트용 값/대역으로 분기 시험을 한다. 유료·무료 외부 AI 호출 0회. 외부 고객에게 연락하거나 이메일을 보내지 않았다.

E2E는 격리 인증 namespace와 3100 포트에서 기존 프로덕션 빌드를 사용했다. `.next/BUILD_ID` 시각(UTC 05:19:13)은 최신 src 파일 시각(UTC 05:19:07)보다 뒤임을 확인했다. 이번에 빌드를 새로 실행하지는 않았으므로 빌드 재현성은 이번 감사에서 NOT_VERIFIED다. 이전 문서의 빌드 성공을 이번 실행 성공으로 재기재하지 않았다.

코드/스키마 수정·삭제·DB 초기화는 하지 않았다. 기존 시험은 격리 시험 데이터 생성/정리, 일부 기존 SAMPLE 작업 상태의 일시 변경/복원, 시험 증빙·결과 파일 갱신 및 감사 접근 기록을 수행한다. 따라서 테스트 실행을 DB에 대한 완전 무변경 읽기로 표현하지 않는다. T6은 기존 관계 ID 보존을 검사하지만 전체 DB 무변경을 증명하지는 않는다. 납품 ZIP·스크린샷 등 기존 시험 산출물은 실제 고객 납품물이 아니다.

## 4. 23개 업무 상세 평가

### 1. 계약 전 잠재고객 등록 — PASS

- 파일/함수/API: `src/app/api/operations/route.ts` POST `action:create`, `src/lib/operations.ts` `onboard`, `salesInput`; 기존 기본 등록은 `src/app/api/workspace/route.ts` POST `action:create`.
- DB: `Project`, `ClientEntity`, `Project.operations.sales`. 신규 온보딩 기본값은 `LEAD`와 `NOT_CONTRACTED`; 계약 없이 등록 가능하다.
- 화면: `/` → 고객사 관리 / 고객사 운영 → 영업·계약 관리(OWNER).
- 시험: E1 등록 버튼→저장→새로고침, E3 운영 프로젝트 생성·재조회, T4 온보딩 성공. 계약 체결 조건으로 등록을 막지 않는다.
- DEMO: 등록·재조회 확인. 실제 유형: E1 일반 고객 등록 경로 확인(합성 고객); 실제 치과 영업/수주는 NOT_VERIFIED.
- 부족/난이도: 주소로 자동 병원 발굴, 별도 리드 중복 식별·활동 CRM 없음. 핵심 등록은 충족; 고도화 중. 우선순위 P2.

### 2. 지역·업종 질문 120개 생성 및 중복 제거 — PARTIAL

- 파일/함수/API: `src/lib/operations-questions.ts` `profileQuestions`, `src/lib/seed.ts` `generateQuestions`; `/api/operations` `profile-questions`, `/api/workspace` `generate`/`question`.
- DB: `QuestionSet`, `Question`; 화면: AI 질문 연구소 / 고객사 운영.
- 시험: E1 예시 질문 생성, E2 5개 질문 추가, E3 업종 질문 생성 성공. 코드상 자동 생성은 각 5개이며 `old.text===q.text`의 정확 문자열 비교로 반복 생성 추가를 방지한다.
- DEMO/실제 유형: 같은 생성 경로를 쓸 수 있으나 120개 생성은 양쪽 모두 미구현. 개별 질문 추가에는 일반적인 중복 제거가 없다.
- 부족/난이도: 지역·진료·의도별 120개 조합, 의미 중복/정규화, 질문 세트 버전·균형 검사. 중. P0.

### 3. 대표 질문 30개 무료 Pre-Scan — PARTIAL

- 파일/함수/API: `src/lib/research.ts` `createStudy`, `src/lib/consumer-observation.ts` `storeConsumerRows`, `/api/observations` `study`/`save`/`import`/`strategy`.
- DB: `Question`, `ClientEntity.payload.researchStudies`, 관측 모델, `WebsiteAudit`; 화면: AI 실측 연구소 / Baseline·Follow-up.
- 시험: T2 계획/입력·전략, E2 저장→분석→재조회 성공. 대표 30개 선정·자동 스캔·영업 보고 연결 시험은 없음.
- DEMO: 소규모 수동 모사 성공. 실제 유형: 합성 입력 처리 성공; 외부 실제 수집 NOT_VERIFIED. 연구 계획 질문 상한20개로 30개 한 계획은 불가.
- 부족/난이도: 대표성 선정, 전용 Scan 묶음, 무료/비용 기준, 완료 커버리지와 Snapshot 자동 연결. 중~상. P0.

### 4. 복수 AI 플랫폼 관측 입력·관리 — PASS

- 파일/함수/API: `src/lib/consumer-config.ts`, `src/lib/consumer-observation.ts` `consumerInput`, `storeConsumerRows`, `parseConsumerImport`, `exportConsumerCsv`; `/api/observations`.
- DB: `ObservationRun`, `AIResponse.payload.consumer`, `CitationSource`, `ClientEntity.payload.evidenceFiles`; 화면: AI 실측 연구소 / AI별 가시성 비교.
- 시험: T2 실제 유형 메타데이터·원문 보존·CSV 왕복, E2 3플랫폼 입력→DB 재조회→중복 재사용성공.
- DEMO: 3플랫폼 E2E 확인. 실제 유형: 스키마/합성 입력 시험 성공. 서비스에서 직접 수집한 데이터의 진위 검증은 NOT_VERIFIED.
- 부족/난이도: 지원은 ChatGPT 웹검색·Gemini 소비자 검색·네이버 AI 브리핑. Google AI Search 전용 입력 및 6개 플랫폼 확장은 없음. API 출력은 소비자 출력과 별도. 확장 중. P1.

### 5. 업체 언급·추천·인용 지표 — PASS

- 파일/함수/API: `src/lib/entity-analysis.ts` `extractEntities`, `src/lib/visibility.ts` `exclusionReason`, `visibilityMetrics`; `/api/workspace`, `/api/observations`, `/api/operations`의 보고서 생성.
- DB: `AIResponse`, `Mention`, `CitationSource`; 화면: AI별 가시성 비교 / AI 실측 연구소 / 고객사 보고서.
- 시험: T1/T2 추천·부정·별칭·불확실성·도메인 경계·분모 시험 성공, E1 새로고침 후100% 집계, E2 비교 화면 성공.
- DEMO/실제 유형: 합성 자료에 대한 계산 성공; 실제 치과 비율값 NOT_VERIFIED. 분모0은 null, 실패 API/검색 미확인/식별 미확정 등을 제외한다.
- 부족/난이도: 인용률은 자사 공식 호스트 인용 응답률이다. 모든 제3자 인용이나 출처 내용의 진위 비율과 다르다. NLP 실제 정확도 평가 세트는 별도 필요. 중. P0(정의/품질), 확장 P1.

### 6. 업체별 경쟁사 비교 — PARTIAL

- 파일/함수/API: `src/lib/visibility.ts` `visibilityMetrics`의 `competitors`, `src/lib/optimization.ts` `collectOptimization`, `analyzeGaps`; `/api/optimization`, `/api/workspace` `audit`.
- DB: `CompetitorEntity`, 관측 모델, `WebsiteAudit.payload.competitorComparisons`; 화면: 경쟁사 분석 / AEO 격차 진단 / AI별 가시성 비교.
- 시험: T1/T5, E2/E5 합성 업체 언급·DEMO 홈페이지 격차·재조회 성공.
- DEMO: 비교 가능. 실제 관측 형식은 지원하나 실존 경쟁병원 비교 수집은 NOT_VERIFIED.
- 부족/난이도: 경쟁사별 언급률은 구현, 시나리오의 추천·인용·Coverage·정확도 전체 비교표는 아님. 홈페이지 비교는 최대2곳으로 Pilot 3곳/유료5곳 범위에 미달. 중. P1.

### 7. 영업용 2페이지 PDF — PARTIAL

- 파일/함수/API: `src/lib/client-report.ts` `createClientReport`, `src/app/api/client-reports/route.ts` GET; `/api/operations` `report`/`report-approval`.
- DB: `Report.payload`(HTML, SHA256, 버전, 승인); 화면: 고객사 보고서 → 승인 HTML → 브라우저 인쇄/PDF 저장.
- 시험: T4 HTML 이스케이프/원본/미측정, E3 생성·승인→HTML 응답→원본 불변 성공. PDF 파일 생성·페이지 수 시험 없음.
- DEMO: HTML 보고서 확인. 실제 유형 보고서 분기 있음; 실제 관측 보고서/PDF 인쇄 결과는 NOT_VERIFIED.
- 부족/난이도: 자동 PDF 바이너리 생성·2페이지 레이아웃/그래프/30개 표본 고정/폰트·페이지 검증 없음. 브라우저 인쇄 가능만으로 PASS 아님. 중. P0.

### 8. 연락·자료 수신 동의·상담 이력 — PARTIAL

- 파일/함수/API: `src/lib/operations-types.ts` `Operations.onboarding`/`sales`, `src/lib/operations.ts` `salesInput`, `/api/operations` `sales`.
- DB: `Project.operations`; 화면: 고객사 운영 / 영업·계약 관리. 
- 시험: E3 온보딩 연락처 저장/권한 마스킹, T4 소속·민감정보 제거 성공. 수신 동의나 활동 이력 기능 시험 없음. 
- DEMO/실제 유형: 연락처·상담 메모 저장 구조는 공통. 실제 연락/동의 취득 NOT_VERIFIED. 
- 부족/난이도: 상담은 문자열 메모, 별도 통화·미팅 이벤트/자료별 동의·철회·후속 연락·송신 이력 없음. `sales` 저장은 값 대체이며 상담 변경 이력을 자동 누적하지 않는다. 중. P0. 

### 9. 30일 무료 Pilot 계약·범위 — PARTIAL

- 파일/함수/API: `src/lib/operations-types.ts` 영업 기간/범위, `src/lib/operations.ts` `salesInput`, `moveStage`; `/api/operations` `sales`/`stage`. 
- DB: `Project.operations.sales`/`workflow`; 화면: 영업·계약 관리 / 고객사 운영. 
- 시험: T4 단계 건너뛰기/증거 검사, E3 운영 단계 성공. Pilot 전용 계약 체결 시험 없음. 
- DEMO: 서비스 단계 모사 가능. 실제 Pilot Agreement/계약 체결 NOT_VERIFIED. 
- 부족/난이도: PILOT 유형·무료 금액·30일 만료·2페이지/FAQ 제공량·중도 종료·게시 권한·사례/통계 활용 동의 없음. 90일 유료 전환 자동 연결 없음. 중. P0. 

### 10. 대량 반복 측정·재측정 스케줄 — PARTIAL

- 파일/함수/API: `src/lib/research.ts` `studyInput`/`createStudy`, `src/lib/measurement-service.ts` `runMeasurement`, `src/lib/studio-workflow.ts` `advanceStudio` followup; `/api/observations`, `/api/measurements`, `/api/execution-studio`. 
- DB: `ClientEntity.payload.researchStudies`, `MeasurementBatch`, `OptimizationTask.payload.studio.followup`; 화면: Baseline·Follow-up / 실행 스튜디오. 
- 시험: T2/T3 소규모 반복·중복 슬롯·상한, E3/E4 후속 계획/응답 연결 성공. 1,440건 부하/스케줄 실행 시험 없음. 
- DEMO/실제 유형: 계획 최대 20질문×3플랫폼×5반복=단계당 300슬롯. 한 번 수동 입력 최대 50행, 일반 반복 입력 스키마는 10이나 연구 계획은 5로 제한. API 묶음은 반복 1, 기본 1질문/최대 3질문. 
- 부족/난이도: 4플랫폼·120질문 계획, 큐/백그라운드 작업·예약 실행·누락 재개·지속 스케줄러 없음. 앱 내 예정일은 자동 호출이 아님. 상. P0. 

### 11. 데이터 검증·중복 제거·비용 통제 — PARTIAL

- 파일/함수/API: `src/lib/consumer-observation.ts` `storeConsumerRows`, `src/lib/visibility.ts` `exclusionReason`, `src/lib/measurement-service.ts` `runMeasurement`, `src/lib/live-ai.ts` `assertLiveAIEnabled`, `src/lib/gemini-provider.ts`; `/api/observations` `verification`, `/api/measurements`. 
- DB: 관측 payload 검증 이력, `MeasurementBatch` 실행 키의 project별 unique, `ClientEntity.payload.freeGeminiAttempts`; 화면: AI 실측 연구소. 
- 시험: T2/T3/T6, E2/E5 중복키·슬롯·소속·차단·할당량·DB 저장 성공. 실제 외부 과금 검증 NOT_VERIFIED. 
- 구현: 키가 있어도 false일 때 호출 전 차단. API 기본 일일 10 / 설정 최대 100질문, 최소 15초, 동시 최대 2, 실패 후 자동 재시도 0. 비용 미확인은 null. 
- 부족/난이도: 소비자 관측 `UNVERIFIED`는 다른 유효 조건을 만족하면 집계될 수 있음(`REJECTED`만 검증 상태로 제외). 동일키/계획슬롯 중복만 막아 새키의 비계획 동일원문 중복은 가능. 통화금액별 하드예산·제공사 청구 대조·일반 질문 의미중복 없음. 검증 정책/확정 보고 게이트 중, 대량 비용관리 상. P0. 

### 12. 공식정보 검증·채널 불일치 — PARTIAL

- 파일/함수/API: `src/lib/studio-facts.ts`의 `saveStudioFact`, `effectiveFactStatus`, `verifiedFacts`; `src/lib/studio-page.ts`의 `parseStudioPage`, `inspectStudioPage`; `/api/execution-studio`의 `fact`, `inspect`, `manual-page`.
- DB: `ClientEntity.payload.studioRepository.facts/pages`, `WebsiteAudit`. 화면: 실행 스튜디오 → 검증 사실정보 / 개선 대상.
- 시험: T5 충돌·만료·증빙·미확인 제외, E4 사실 저장·재조회·채널 구분 모두 성공.
- DEMO: 가상 자료의 검증 상태 처리 확인. 실제 유형: 직원이 증빙을 확인해 등록하는 경로는 있으나 실제 외부 채널 대조는 NOT_VERIFIED.
- 부족: 사실의 자동 진위 판정, 홈페이지/네이버/기타 채널의 운영시간 자동 추출·교차 대조, 네이버 플레이스 자동 읽기/수정 없음. 등록 사실의 충돌 검사는 채널 간 불일치 분석과 다르다.
- 개발 난이도/우선순위: 중~상 / P1.

### 13. 홈페이지·콘텐츠 수정안 생성 — PASS

- 파일/함수/API: `src/lib/studio-generator.ts`의 `TemplateContentGenerator.generate`, `src/lib/studio-workflow.ts`의 `createStudioWork`, `editStudioDraft`; `src/lib/studio-schema.ts`, `src/lib/studio-export.ts`의 `studioDeliveryFiles`, `zipDelivery`; `/api/execution-studio`의 `create/edit/regenerate/export`.
- DB: `OptimizationTask.payload.studio`, `Project.operations.proposals`, 고객별 페이지/검증 사실. 화면: 실행 스튜디오 → 편집기 / 구조화 데이터 / 승인 및 납품.
- 시험: T5 동일 입력 초안·원본 차이·Schema·HTML 보호·ZIP, E4 UI 편집→승인→다운로드 모두 성공.
- DEMO: 수정안·납품 확인. 실제 유형: 같은 코드 경로가 있으나 실존 고객의 문안·외부 게시는 NOT_VERIFIED.
- 부족: 템플릿 초안이므로 전문 의학 설명은 사람이 작성·검수해야 한다. 전체 사이트 리디자인/CMS 자동 게시 없음. 요구는 수정안 생성이므로 PASS이며 게시 성공으로 확대 해석하지 않는다.
- 개발 난이도/우선순위: 콘텐츠 고도화 중, CMS 연결 상 / P1.

### 14. 의료광고 검토·고객 승인 — PARTIAL

- 파일/함수/API: `src/lib/operations.ts`의 `approveProposal`, `src/lib/studio-workflow.ts`의 `draftProblems`, `advanceStudio`, `assertStudioApproved`; `/api/operations`의 `approval`, `/api/execution-studio`의 `internal-review/approval`.
- DB: `Project.operations.proposals`의 현재 버전 승인·이력·규정 검토, `OptimizationTask.payload.studio.internalReview`. 화면: 실행 관리 / 실행 스튜디오.
- 시험: T4/T5 규정 미검토·템플릿·미승인 차단과 버전 수정 후 승인 무효화, E3/E4 승인 저장·재조회·권한 차단 모두 성공.
- DEMO: 가상 검토/승인 기록 확인. 실제 의료진 검토·고객 승인·심의는 NOT_VERIFIED.
- 부족: 직원이 증빙을 기록하는 방식이다. 자동 법률 판정·고객 직접 전자승인은 없다. 매체별 심의 대상/심의 번호·검토자 자격·규제 체크리스트 없음. 문구 휴리스틱은 적법성 보증이 아니다.
- 개발 난이도/우선순위: 중~상 / P0(절차/증빙), 자동화 P1.

### 15. Baseline / Follow-up 비교 — PASS

- 파일/함수/API: `src/lib/research-metrics.ts`의 `conditionWarnings`, `compareStudy`, `src/lib/research.ts`의 `createStudy`; `/api/observations`의 `study/save`, `/api/operations`의 `report`.
- DB: `ClientEntity.payload.researchStudies`의 질문 원문·조건, `AIResponse.payload.consumer`의 단계/반복/시각. 화면: Baseline·Follow-up / 고객사 보고서.
- 시험: T2 동일 조건 대응·조건 변경 경고·역전 시각·슬롯 중복, E2 경고 표시, E3/E4 대응 쌍·보고서·완료 게이트 모두 성공.
- DEMO: 전후 모사 성공. 실제 유형: 합성 메타데이터 시험 성공; 실제 Day 0/Day 30 변화는 NOT_VERIFIED.
- 부족: 신뢰구간/유의성/인과 분석 없음. 모델 미표시는 동일 모델을 보장하지 않는다. 기본 동일 조건 비교는 충족하며 대량 범위는 항목 10의 제한을 받는다.
- 개발 난이도/우선순위: 통계 고도화 중~상 / P1.

### 16. AI 추천 가시성 점수 정의·계산 — FAIL

- 확인 파일/함수: `src/lib/visibility.ts`의 `visibilityMetrics`, `src/lib/analysis.ts`의 `metrics`, `src/lib/optimization.ts`의 `priorityScore`, `src/lib/research.ts`의 `observationStrategy`.
- DB: 관측 기반 비율과 `WebsiteAudit/OptimizationTask`의 개선 우선순위 score는 있지만 독립 가시성 점수 모델은 없다.
- 화면/API: AI별 가시성 비교/보고서에는 비율, 격차 진단에는 우선순위 점수. 종합 추천 가시성 점수 화면/API는 없다.
- 시험: T1 비율 계산, T5 개선 우선순위 계산은 성공. 요구된 종합 점수 시험 없음.
- DEMO/실제: 양쪽 모두 미구현. `priorityScore`는 정확성·관련성·기술·인용·전환 가중 업무 우선순위이며 AI 추천 확률 점수가 아니다.
- 부족: 점수 정의·분모·가중치·결측 처리·버전·표본 범위·비교 가능성. Entity Accuracy는 검토 응답 정확도와 다르고, Query Coverage는 질문별 언급률과 다르다.
- 개발 난이도/우선순위: 수식/제품 중, 타당성 평가 상 / P0(정의), 제품화 P1.

### 17. 상담·예약·구매 전환 추적 — PARTIAL

- 파일/함수/API: `src/lib/operations-types.ts`의 `TrafficRecord`, `src/lib/operations-metrics.ts`의 `trafficMetrics`, `src/lib/consumer-observation.ts`의 `extractActionLinks`; `/api/operations`의 `traffic`.
- DB: `Project.operations.traffic`, `AIResponse.payload.consumer.actionLinks`. 화면: 고객사 운영 / 고객사 보고서.
- 시험: T4 검증된 동일 유형만 합산/null 유지 성공. 실제 예약 시스템 연결 E2E 없음.
- DEMO: 수동 집계 시험 성공. 실제 유형 분기는 있으나 실제 방문·예약·상담 발생/귀속은 NOT_VERIFIED.
- 부족: GA4/서버 이벤트/UTM/예약/전화 연결·전환 중복 제거 없음. 답변의 예약 URL 추출은 실제 클릭/예약이 아니다. 직원이 verified를 표시한 자료의 합산이며 AI 유입 귀속을 자동 확인하지 않는다.
- 개발 난이도/우선순위: 상 / P1.

### 18. 90일 유료 제안·계약 전환 — PARTIAL

- 파일/함수/API: `src/lib/operations.ts`의 `salesInput`, `src/lib/client-report.ts`의 `createClientReport` STRATEGY 유형; `/api/operations`의 `sales/report`.
- DB: `Project.operations.sales`, `Report`. 화면: 영업·계약 관리 / 고객사 보고서.
- 시험: T4 보고서, E3 전략 단계·계약 관련 권한 성공. 90일 영업 제안서/Pilot→WON 계약 전환의 별도 시험 없음.
- DEMO/실제: 범위·금액·계약 기간 기록 경로 있음. 실제 협상/수주는 NOT_VERIFIED.
- 부족: operations의 Proposal은 페이지 개선안이며 영업 제안서가 아니다. Pilot 성과를 가격·90일 범위·수행량·계약서로 변환하는 기능과 서명 완료 후 WON 전환 없음.
- 개발 난이도/우선순위: 중 / P0.

### 19. 월간 운영·갱신·직접 원가 — PARTIAL

- 파일/함수/API: `src/lib/operations-metrics.ts`의 `financeMetrics`, `operationsDashboard`, `src/lib/client-report.ts`의 MONTHLY 유형; `/api/operations`의 `worklog/invoice/cost/sales`.
- DB: `Project.operations.finance/sales.renewalAt`, `OptimizationTask.payload.execution.workLogs`, `Report`. 화면: 수익성 관리 / 영업·계약 관리 / 관제실 / 고객사 보고서.
- 시험: T4 null/부분 입력/기여이익·시간, E3 작업시간·청구·원가 저장·소속/금융 권한·재조회 모두 성공. 갱신 체결/반복 청구 자동화 시험 없음.
- DEMO: 금액 시험이며 실매출 아님. 실제 입금/원가/재계약은 NOT_VERIFIED.
- 부족: 갱신일 조회는 있으나 계약 버전/재계약 원장·자동 청구·월별 원가 배분·알림 없음. `financeMetrics`는 저장된 청구/원가 전체 합산이다. 작업 유형 평균은 작업 1건이 아닌 로그 항목 단위다.
- 개발 난이도/우선순위: 중 / P1.

### 20. 경쟁사 중복 수주·지역 독점 — FAIL

- 확인 파일/함수: `src/lib/operations-types.ts`, `src/lib/operations.ts`의 `salesInput`, `src/lib/auth.ts`의 `assertProjectAccess`, `prisma/schema.prisma`.
- DB: 범용 계약 필드/프로젝트 권한만 존재. 독점 반경·지역/업종 충돌·예외 승인 모델 없음.
- 화면/API: 영업·계약 관리의 메모는 가능하지만 독점 검사 화면/API 없음.
- 시험: T4/E3 프로젝트 접근 차단 성공은 데이터 보호 시험이다. 수주 충돌 검사 시험 없음.
- DEMO/실제: 양쪽 모두 미구현. 인근 경쟁 병원의 고객 등록을 차단하지 않는다.
- 부족: 서비스 지역/반경·업종·유효 기간·중복 수주 경고/차단·예외 증빙.
- 개발 난이도/우선순위: 중~상 / P1(독점 상품 판매 전 필수).

### 21. 지역·업종 Benchmark DB — FAIL

- 확인 파일/함수: `prisma/schema.prisma`, `src/lib/db.ts`의 `loadDb`, `src/lib/research-metrics.ts`, `src/lib/operations-metrics.ts`.
- DB: 프로젝트별 관측과 다중 프로젝트 운영 목록만 있음. Benchmark/Cohort/DatasetRelease 모델 없음.
- 화면/API: 관제실은 운영 현황이다. 지역 시장 통합 Benchmark 화면/API 없음.
- 시험: T6 DB 보존·E3 다고객 운영 성공. 고객 간 Benchmark 생성 시험 없음.
- DEMO/실제: 고객별 자료 누적은 가능하지만 지역·업종 표준화 및 시장 통계 제품은 미구현.
- 부족: 지리/업종 표준화·공통 질문 키·기간/엔진/방법별 코호트·시장 업체 중복·결측/가중·익명 공개 판본·재사용 권한.
- 개발 난이도/우선순위: 상 / P2(첫 고객의 동의/자료 분류는 P0).

### 22. 영업 재활용 자료와 비공개 자료 분리 — PARTIAL

- 파일/함수/API: `src/lib/auth.ts`의 `assertProjectAccess`, `safeWorkspaceProject`, `src/lib/client-report.ts`의 `createClientReport`, `src/lib/studio-export.ts`의 `studioDeliveryFiles`; `/api/workspace`, `/api/client-reports`, `/api/execution-studio`.
- DB: 프로젝트별 자료와 `StaffUser.projectIds`의 직원 배정. 자료 이용권/공개 수준/Benchmark 승인 필드 없음.
- 화면: 직원 권한·이력 / 승인 보고서 / 실행 스튜디오 납품. 재사용 승인 전용 화면 없음.
- 시험: T4 역할별 연락처/금융 마스킹, T5 납품 시 내부 자료 제외, E3/E4 다른 프로젝트·VIEWER 차단 모두 성공.
- DEMO: 공개 납품 화이트리스트와 권한 분리 확인. 실제 고객 비공개 자료의 재사용 동의·익명 처리 운영은 NOT_VERIFIED.
- 부족: 직원 접근 권한은 자료 재사용권이 아니다. OWNER 전체 접근도 재활용 동의가 아니다. 고객 보고서는 원문/출처/전환 증빙을 포함하므로 타 병원 영업용 Benchmark로 바로 사용할 수 없다. PUBLIC/CLIENT_CONFIDENTIAL/INTERNAL 분류·활용 목적/동의/철회·재사용 내보내기 심사 필요.
- 개발 난이도/우선순위: 중~상 / P0.

### 23. SEO 대행사 제휴 확장 — FAIL

- 확인 파일/함수: `prisma/schema.prisma`의 Organization/Project, `src/lib/auth.ts`, `src/lib/operations-types.ts`, `src/lib/db.ts`의 `loadDb`.
- DB: local-org 및 직원별 프로젝트 범위. Partner/Tenant/RevenueShare/PartnerInvoice 모델 없음.
- 화면/API: 직원 배정은 있으나 파트너 포털·브랜딩·정산 API 없음.
- 시험: T4/E3 직원별 고객 범위 보호 성공. 파트너 온보딩·화이트라벨·수익 배분 시험 없음.
- DEMO/실제: 내부 직원 운영만 확인. 제휴 계약/정산을 수동으로 할 수 있다는 것은 프로그램 기능 PASS가 아니다.
- 부족: 파트너 테넌트 분리·브랜드 템플릿·계약 주체/최종 고객 권한·파트너 비율/원가/정산·대량 고객 온보딩.
- 개발 난이도/우선순위: 상 / P2.

## 5. 지표 및 실제 운영에서 드러난 제한

`visibilityMetrics`의 고객 언급률 = 확정 고객 언급이 있는 유효 응답 / 유효 응답, 추천 후보 포함률 = 확정 고객이 RECOMMENDATION인 응답 / 유효·문맥 분석 완료 응답, 공식 인용률 = 자사 공식 호스트가 출처인 유효 응답 / 유효 응답이다. 등록 경쟁사 비교는 경쟁사별 언급 응답률이다. 첫 소개는 원문에 명시 번호가 있는 부분 표본의 순서이며 최고 추천 보장이 아니다.

추가 감사 소견:

1. `exclusionReason`은 UNVERIFIED 소비자 자료를 모두 배제하지 않는다. 최종 영업 보고서의 확정 자료 기준을 별도로 정해야 한다. `accuracy=INACCURATE` 역시 `visibilityMetrics`의 직접 제외 조건은 아니다.
2. `visibilityMetrics`는 입력 배열을 유형별로 자동 분할하지 않는다. 현재 화면/보고서는 유형을 선택하지만 `src/lib/optimization.ts`의 `analyzeGaps`는 실제 경로에서 여러 유형의 유효 관측을 함께 수집한다. 출처별 kind는 남지만 관측 표본 N건 및 근거 묶음은 혼합될 수 있다. 모든 진단 경로에서 유형 분리를 보장한다고 말할 수 없다.
3. `src/lib/client-report.ts`는 선택 기간/유형의 응답을 집계하지만 질문 목록은 프로젝트 전체 `p.questions`다. 30개 Pre-Scan 범위 고정을 별도 구현하지 않으면 질문 120개와 측정 30개의 모수가 혼동될 수 있다.
4. 의료/법률 규정 검토는 사람의 검토 기록과 차단 절차다. 이번 감사는 법규 적합성의 법률 감사가 아니며 규제의 최신 내용을 새로 판정하지 않았다.
5. 웹 분석은 안전한 정적 HTML 검사다. JS 렌더링·전체 사이트·네이버 플레이스/외부 채널 일치·실제 색인·추천 원인까지 증명하지 않는다.
6. `scripts/local-postgres.mjs`의 개발 DB는 Windows 임시 폴더를 쓴다. 실제 고객의 계약/증빙/관측을 영속 보관하려면 저장소·정기 백업/복원 시험이 필요하다. 기존 로그인/역할 검사가 있다는 것만으로 공개 다중 테넌트 서비스 준비가 완료되지는 않는다.

## 6. 최종 기능표

P0: 첫Pilot/대외영업자료의신뢰성과운영범위를위해우선. P1: 유료운영확장/상품약속전필요. P2: 다고객Benchmark·제휴확장. 난이도는기간견적이아니며연동범위/측정방법합의에따라달라진다. 

| 기능 | 판정 | 증거 파일 | 확인한 테스트 | 부족한 부분 | 개발 우선순위 |
|---|---|---|---|---|---|
| 1 계약 전 등록 | PASS | src/lib/operations.ts, src/app/api/operations/route.ts | E1/E3/T4 성공 | 발굴·리드중복CRM | P2·중 |
| 2 120개 질문·중복 | PARTIAL | src/lib/operations-questions.ts, src/lib/seed.ts | E1/E2/E3 성공(5개) | 120개/의미중복/세트버전 | P0·중 |
| 3 30개 Pre-Scan | PARTIAL | src/lib/research.ts, src/lib/consumer-observation.ts | T2/E2 성공(소규모) | 대표선정·30개계획·자동흐름 | P0·중~상 |
| 4 복수플랫폼 입력 | PASS | src/lib/consumer-observation.ts, src/lib/consumer-config.ts | T2/E2 성공 | Google AI/6플랫폼; 실제수집미검증 | P1·중 |
| 5 언급·추천·인용 | PASS | src/lib/visibility.ts, src/lib/entity-analysis.ts | T1/T2/E1/E2 성공 | 실제정확도평가·확정자료정책 | P0·중 |
| 6 경쟁사 비교 | PARTIAL | src/lib/visibility.ts, src/lib/optimization.ts | T1/T5/E2/E5 성공 | 경쟁사전체KPI·3~5홈페이지 | P1·중 |
| 7 2페이지 PDF | PARTIAL | src/lib/client-report.ts, src/app/api/client-reports/route.ts | T4/E3 HTML성공; PDF없음 | PDF생성/고정2페이지검증 | P0·중 |
| 8 연락·동의·상담 | PARTIAL | src/lib/operations-types.ts, src/lib/operations.ts | T4/E3 연락처/권한성공 | 동의·철회·활동이력·발송 | P0·중 |
| 9 30일 Pilot | PARTIAL | src/lib/operations.ts, src/lib/operations-types.ts | T4/E3 단계성공 | Pilot계약/범위한도·활용동의 | P0·중 |
| 10 대량·스케줄 | PARTIAL | src/lib/research.ts, src/lib/measurement-service.ts | T2/T3/E3/E4 소규모성공 | 120×4×3·큐·자동스케줄 | P0·상 |
| 11 검증·중복·비용 | PARTIAL | src/lib/visibility.ts, src/lib/consumer-observation.ts, src/lib/live-ai.ts | T2/T3/T6/E2/E5 성공 | 확정자료게이트·새키중복·금액예산 | P0·중~상 |
| 12 공식정보/채널 | PARTIAL | src/lib/studio-facts.ts, src/lib/studio-page.ts | T5/E4 성공 | 채널별정보추출·교차대조 | P1·중~상 |
| 13 수정안 생성 | PASS | src/lib/studio-generator.ts, src/lib/studio-workflow.ts, src/lib/studio-export.ts | T5/E4 편집·납품 성공 | 전문 문안 검수·외부 게시수동 | P1·중~상 |
| 14 규정·승인 | PARTIAL | src/lib/operations.ts, src/lib/studio-workflow.ts | T4/T5/E3/E4 성공 | 매체/심의체크·고객전자승인 | P0·중~상 |
| 15 전후 비교 | PASS | src/lib/research-metrics.ts, src/lib/research.ts | T2/E2/E3/E4 성공 | 실측성과미검증·통계한계 | P1·중~상 |
| 16 가시성점수 | FAIL | src/lib/visibility.ts, src/lib/optimization.ts | 비율/우선순위만성공 | 독립추천가시성점수정의/계산 | P0정의/P1제품화·중~상 |
| 17 전환 추적 | PARTIAL | src/lib/operations-metrics.ts, src/lib/operations-types.ts | T4 수동합산성공 | 이벤트/예약/전화/귀속연결 | P1·상 |
| 18 유료제안·전환 | PARTIAL | src/lib/operations.ts, src/lib/client-report.ts | T4/E3 일부성공 | 90일영업제안·계약연결 | P0·중 |
| 19 월운영·갱신·원가 | PARTIAL | src/lib/operations-metrics.ts, src/app/api/operations/route.ts | T4/E3 원가/청구성공 | 갱신원장·월배분·반복청구 | P1·중 |
| 20 충돌·독점 | FAIL | src/lib/operations-types.ts, src/lib/auth.ts, prisma/schema.prisma | 프로젝트권한만성공 | 독점범위/기간·수주충돌검사 | P1·중~상 |
| 21 Benchmark DB | FAIL | prisma/schema.prisma, src/lib/db.ts | T6/E3 고객저장만성공 | 공통코호트·익명시장통계 | P2·상 |
| 22 재사용/비공개 분리 | PARTIAL | src/lib/auth.ts, src/lib/client-report.ts, src/lib/studio-export.ts | T4/T5/E3/E4 성공 | 자료분류·재사용동의·내보내기통제 | P0·중~상 |
| 23 SEO 제휴 | FAIL | prisma/schema.prisma, src/lib/auth.ts, src/lib/db.ts | 직원scope만성공 | 파트너테넌트·브랜딩·정산 | P2·상 |

## 7. 사업 판단

### A. 현재 코드만으로 실제 치과 고객사에 제공 가능한 업무

직원이 운영하는 고객 등록·온보딩·경쟁사/질문 관리, 지원하는 3개 소비자 플랫폼에서 담당자가 수집한 원문/출처/조건/증빙 입력과 CSV 관리, 유효 표본의 언급·추천 후보·공식 인용 계산, 제한된 공개 홈페이지 진단·개선 과제, 사실/증빙 검증 상태 관리, 템플릿 수정안과 사람의 최종 편집, 내부/고객/규정 검토 기록, 승인된 HTML/Schema/ZIP 납품, 동일 조건 전후 비교와 HTML 보고서, 수동 청구/입금/작업시간/직접 원가 기록.

이는 제공 가능한 소프트웨어 업무 목록이다. 실제 치과 1곳에서 외부 관측→승인→게시→후속 측정까지 검증된 상용 실적 목록은 아니다. 현재 제약 내 표본/플랫폼 범위를 계약에 명시하고 영속 저장 기반을 먼저 확보해야 한다.

### B. 현재 수동 작업이 필요한 업무

병원 발굴·전화·동의 취득·상담/계약서, 120개 질문 설계/중복 검수/대표 30개 선정, 각 AI 소비자 화면 관측과 출처 증빙 확인, 여러 계획으로 나눈 측정/재측정 일정 실행, 홈페이지/네이버 플레이스 정보 대조, 전문 의학 문안 작성·의료진/광고 검토, CMS 게시와 증빙, 2페이지 영업 자료 편집/PDF 인쇄, 전환 로그 수집/귀속 검토, 90일 제안서와 유료 전환/재계약, 독점 지역 충돌 관리, 공개 자료 재사용권 검토, Benchmark 작성·SEO 제휴 계약/정산.

### C. 첫 실제 고객 수주 전 반드시 보강할 기능과 조건

첫 고객 범위가 소규모 수동 Pilot인지, 첨부 시나리오 전체를 약속하는 상품인지 구분한다. 없는 자동 기능을 모든 첫 고객의 필수로 과장하지 않는다.

**어떤 실제 고객 자료를 받기 전에도 필요한 보강:** 영속 PostgreSQL·정기 백업/복원 검증·증빙 보존 기준. 대외 보고의 자료 확정 기준(UNVERIFIED/부정확 자료 처리) 및 유형별 진단 근거 분리. Pre-Scan 질문 범위/분모/측정 시점 고정. 동의·비공개 자료·사례/통계 재사용 권한의 명시적 기록. 수신 동의 및 의료 검토/고객 승인 증빙은 최소 외부 문서로라도 갖춰야 하며 프로그램 내 구조화 기능은 P0로 추가하는 것이 적절하다.

**글의 120질문·4플랫폼·3회 Pilot을 그대로 판매하려면 필요:** 질문 생성/중복 검수/30개 선정, 계획 상한 확장 및 4번째 플랫폼 입력, 전체 측정 슬롯/누락/진행률과 대량 입력 검증, Pilot 범위/기간/유료 전환 관리, 영업용 2페이지 보고서. 측정은 사람이 할 수 있지만 현재 계획 한도로는 전체 범위를 한 연구 계획에서 일관되게 관리하지 못한다. 자동 수집을 상품으로 약속하면 별도 허용된 수집 연동·큐·쿼터·비용 통제 개발과 실제 수집 시험이 필수다.

**첫 수주를 위해 반드시 자동화할 필요가 없는 후속 영역:** 고객 전자서명(외부 서명 계약 가능), CMS 자동 게시(담당자 게시 가능), 자동 전환 연결(수동 근거 자료로 한계 명시 가능), 지역 Benchmark/화이트라벨(관련 상품 판매 전 개발). 독점 상품은 충돌 관리 체계 없이 판매하지 말고, 공통 시장 데이터는 자료 이용권/비공개 분리 없이 축적 자료를 재판매하지 않는다.

사업 판정: **현재 코드로 소규모 수동 컨설팅 Pilot을 지원할 수 있으나 첨부한 전체 영업·확장 시나리오를 충분히 수행하는 Business OS는 아직 아니다. 89개 단위/통합과 9개 E2E 성공은 구현된 범위의 회귀 검증이며 미구현 사업 기능과 실제 AI 성과를 대신 증명하지 않는다.**
