# AEO Intelligence OS · 7-5 Operational Readiness

CITED 랜딩·무료 수동 진단·플랫폼별 리포트·실무 가이드를 추가했습니다. 비로그인 첫 화면은 랜딩이며 기존 인증된 운영 화면은 `/os`에서 이용합니다. 진단은 현재 브라우저 탭에 임시 저장하고 JSON 또는 인쇄/PDF로 보관합니다. 서버 고객 DB 자동 연계와 공개 배포는 포함하지 않습니다. 측정 정의·가격 표시·검증 결과는 [CITED 구현 기록](docs/CITED_PUBLIC_MVP.md)을 확인하세요.

7-5는 통합 암호화 백업·별도 DB/파일 복원·오프라인 설치·연속 LOCAL MOCK 리허설을 점검합니다. 준비성 판정과 남은 조건은 [7-5 운영 준비 보고서](docs/STAGE_7_5_READINESS.md), 실제 수동 관측 절차는 [실측 리허설 가이드](docs/MANUAL_PILOT_REHEARSAL.md)를 확인하세요. 실존 고객 관측과 직원 업무시간은 NOT_RUN이며 수주·성과를 보장하지 않습니다.

통합 백업: `npm run db:backup`. 격리 복원: `npm run db:restore:test`. 환경 점검과 오프라인 설치: `node scripts/check-readiness-environment.mjs`. 전체 격리 검증: `npm run validate:readiness` (앞선 오프라인 설치 성공 결과 필요). 백업·키 보관과 지원 범위는 [DB 운영 문서](docs/DB_OPERATIONS.md)를 따릅니다. 원본 환경에서 DB 쓰기 테스트를 직접 실행하지 말고 격리 검증을 사용하세요.

Pre-Scan 영업 보고서 → 30일 협약·권한 → 일정·개선 작업·원가 → 검증 Baseline/Follow-up → 성과 보고서 → 90일 유료 제안 → 별도 계약 확인을 연결했습니다. 새 메뉴는 **30일 무료 실증 계약**, **Pilot 운영센터**, **Pilot 측정 연결**, **30일 성과 보고서**, **90일 유료 제안**, **Pilot 영업 활동**, **Pilot 사업 현황**입니다. [7-4 구현·검증 기록](docs/STAGE_7_4_COMPLETION.md)을 확인하세요. LOCAL MOCK 검증을 실제 고객 성과로 해석하지 않습니다.

```powershell
node scripts/serve-local.mjs
```

기존 영속 PostgreSQL을 사용하며 로컬 개발 앱의 접속 주소를 출력합니다. OWNER/MANAGER 계정으로 로그인해 고객사를 선택합니다. 유료 제안·계약 금액과 원가는 OWNER만 관리합니다. 증빙 파일은 `data/pilot-documents/`를 DB 백업과 함께 별도로 보존하세요.

전체 단위·실제 DB·PDF 검증은 `node scripts/validate-stage7-4.mjs unit`, 브라우저 검증은 `node scripts/validate-stage7-4.mjs e2e`입니다. 현재 환경에서 앱 빌드는 기존 Prisma 생성물로 `node node_modules/next/dist/bin/next build`를 실행해 검증했습니다. Prisma 재생성의 엔진 준비 제한은 7-4 검증 문서에 기록했습니다.

## 기존 6단계 Execution Engine v1.0

**AEO 실행 스튜디오**: 검증 사실·페이지 원본 → 수정안·버전 → 내부 검토·고객 승인 → HTML/JSON/ZIP 납품 → 적용 대조 → 기존 재측정 연결. 유료·무료 AI 호출 없이 템플릿으로 생성합니다. [6단계 사용법·구현 범위](docs/STAGE6.md), [검증 기록](docs/STAGE6-VALIDATION.md). 화면은 `http://127.0.0.1:3000/?view=execution-studio`입니다.

# AEO Intelligence OS · 5단계 Direct Client Operations v1.0

5단계에서 고객 온보딩·프로젝트 단계·승인·실행·고객 보고서·영업/계약·기본 수익성·직원 로그인/권한을 추가했습니다. [5단계 사용법과 한계](docs/STAGE5.md), [검증 결과](docs/STAGE5-VALIDATION.md)를 확인하세요. 최초 접근은 `/login`의 OWNER 등록입니다. 5단계 직원 인증에는 PostgreSQL이 필요합니다.

기존 4단계는 **무료 수동 AI 실측 연구소 / 플랫폼별 가시성 비교 / Baseline·Follow-up / CSV·JSON 일괄 입출력 / 선택 증빙 첨부**를 추가하고 기존 경쟁사·개선 엔진을 유지합니다. [4단계 사용법·검증·한계](docs/STAGE4.md)를 참고하세요. 기존 코드와 데이터를 유지했습니다. 상세 사용법·점수·한계는 [3단계 문서](docs/STAGE3.md)를 참고하세요.

**LIVE_AI_ENABLED=false**로 유료 AI 호출을 차단했습니다. 키가 등록돼 있어도 실측 대기입니다. FREE_GEMINI_ENABLED=false도 기본값입니다. 무료 Gemini는 계정 무료 등급 검증 전 차단합니다. 기본 대시보드는 CONSUMER_UI_MANUAL이며 DEMO는 명시적으로 선택할 때만 집계합니다.

기존 로컬 단일 사용자 MVP에 OpenAI 웹 검색 실측을 추가했습니다. API 출력은 **API_OBSERVATION**, 소비자 화면 수동 관측은 **MANUAL_UI**, 가상 데이터는 **DEMO**로 분리합니다. API 결과는 소비자 ChatGPT의 추천 순위를 뜻하지 않습니다.

## 현재 PC에서 실행

Node.js 22 이상이 필요합니다. 기존 `.env`를 덮어쓰거나 DB를 초기화하지 마세요. 이 PC는 PostgreSQL 모드로 설정되어 있습니다. DB가 이미 실행 중이면 다시 시작할 필요가 없습니다.

```powershell
# DB가 꺼져 있을 때 별도 터미널에서 실행
node scripts/local-postgres.mjs
# 앱 터미널
$pnpmAeo = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
& $pnpmAeo build
& $pnpmAeo start
```

[현재 화면](http://127.0.0.1:3000) → 홍제 A치과 → **AI 실측 연구소**. 기존 DEMO 응답 5개를 보존하고 4단계 실증 질문 5개와 소비자 3개 플랫폼 측정 계획을 준비했습니다. 실제 소비자 응답은 사용자가 입력하기 전 미측정입니다. 가상 고객은 실제 검색에 등장하지 않으면 언급 없음으로 기록됩니다.

개발 시 `pnpm dev`를 사용할 수 있습니다. 새 설치에서만 `pnpm install`, `.env.example`을 참고한 `.env` 작성, `pnpm db:generate`가 필요합니다. 파일 모드는 `STORAGE_MODE=file`이며 `data/workspace.json`에 저장합니다. PostgreSQL 모드와 자동 이관되지 않습니다. 5단계 기존 PostgreSQL 스키마 추가는 백업 후 `node scripts/migrate-stage5.mjs`로 적용하세요. reset 명령은 사용하지 않습니다.

## 실제 API 설정

2단계 API 기능은 보존하지만 이번 단계에서는 유료 호출을 금지합니다. 키를 추가해도 LIVE_AI_ENABLED=false에서 호출되지 않습니다. 향후 유료 호출을 명시적으로 재개할 때 서버 전용 키와 LIVE_AI_ENABLED 설정 후 재시작해야 합니다. 브라우저에 키를 입력하지 않습니다. 키가 없으면 실행 버튼이 비활성화되고 수동 입력은 유지됩니다. 기본 모델은 `gpt-5.6-luna`, 변경은 `OPENAI_MODEL`입니다. 계정의 모델 이용 권한과 잔액이 필요합니다.

기본 제한은 질문 1개 × 반복 1회, 웹 검색 도구 최대 1회, 출력 2,000토큰, 전체 요청 90초, 자동 재시도 0회, 요청 간 15초, 하루 10개 질문입니다. 프로젝트당 동시 1개·전체 2개이며 실행 키로 중복 호출을 막습니다. `AEO_MAX_QUESTIONS`는 최대 3, 여러 질문은 화면 확인이 필요합니다. 환경변수는 `.env.example` 참고. 실패·중단도 일일 제한에 포함하며 실제 청구 여부를 보장하지 않습니다.

토큰 사용량을 저장합니다. 비용은 입력·출력 토큰과 검색 단가 환경변수 3개를 모두 설정할 때만 추정하며, 할인·세금·일부 검색 토큰 비용은 반영하지 않습니다. 미설정 비용은 미확인입니다. 실제 청구는 제공사 대시보드에서 확인하세요.

[공식 web_search 문서](https://developers.openai.com/api/docs/guides/tools-web-search)에 따른 Responses API를 사용합니다. 검색 메타데이터, 인용 URL·제목, 원문, 질문 스냅샷, 상태·오류, 모델·시각·사용량을 저장합니다. 검색을 실제 실행한 성공 응답이면서 업체 식별 검토가 완료되어야 유효 표본입니다.

## 사용과 해석

고객 등록·조회, 경쟁사·별칭, 수동 응답, 기존 CSV·진단·과제를 유지했습니다. 실측 연구소에서 응답 원문·업체 근거·인용·배치 이력을 확인하고 업체 식별을 수정할 수 있습니다. 신규 업체는 실존 검증 완료로 간주하지 않고 검토 대기합니다. 규칙 기반 문맥 분석은 완전한 의미 이해를 보장하지 않습니다. 명시적인 번호만 소개 위치로 저장하며 내부 추천 순위를 생성하지 않습니다.

홈페이지 진단은 공개 HTML·robots·sitemap·색인 헤더·연락처·주소·서비스·전문가·예약 경로·기본 JSON-LD를 점검하고 등록 경쟁사 홈페이지 최대 2곳과 비교합니다. 관측 사실 → 근거 → 개선 가설 → 수정 작업 → 재측정으로 과제를 작성합니다. robots는 홈페이지 경로에 대한 정책 검사이며 전체 사이트 크롤러가 아닙니다. JS 렌더링, 의료 정보의 진위·법적 적합성, 전체 Schema.org 의미 검증은 제공하지 않습니다.

## 검증 및 후속

`pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Edge 브라우저가 필요합니다. 실제 PostgreSQL 모의 통합 테스트는 `$env:AEO_TEST_POSTGRES='1'; pnpm test`로 활성화합니다. 상세 결과는 [검증 기록](docs/VALIDATION.md), 분모 정의는 [측정 문서](docs/MEASUREMENT.md)입니다.

2단계에서 실제 요청은 크레딧 부족 HTTP 429로 실패했습니다. 3단계에는 키가 등록돼 있어도 유료 호출을 차단하며 실제 AI 응답 수집 성공은 미검증입니다. 제공사 응답 모의 테스트와 실제 PostgreSQL 저장·재조회, 브라우저 흐름은 검증했습니다. Gemini Grounding·네이버 공식 검색은 확장 인터페이스만 있으며 소비자 Gemini·네이버 AI 브리핑과 구별합니다. 5단계에 내부 직원 인증·권한·접근 이력을 추가했지만 공개 배포는 지원하지 않습니다. 영속 DB·정기 백업·운영 보안 보강이 필요합니다. 개발 DB는 임시 폴더에 보관하므로 실제 고객 데이터에는 영속 DB와 백업을 사용하세요.

