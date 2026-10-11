# AEO Intelligence OS 7-3단계 완료 검증 보고

검증일: 2026-10-09. 대상: 로컬 Windows 개발 프로젝트. 이번 검증의 A치과는 존재하지 않는 LOCAL MOCK이며, 소비자 AI 서비스에 질문하거나 실제 병원 성과를 측정하지 않았다.

## 1. 기존 7-2 코드 점검

`src/lib/prescan.ts`의 120개 질문 지도, 30개 고정 세트, 90개 수동 관측 슬롯, `createSnapshot`/`freezeSnapshot`을 재사용했다. `src/lib/prescan-types.ts`, `reporting-metrics.ts`, `client-report.ts`, `visibility.ts`, `observation-verification.ts`, 기존 UI/API 및 Prisma 스키마를 점검했다. Snapshot에는 고정 고객 정보·질문·기간·플랫폼·확정 지표·연결 응답이 있고 원문은 별도 보존된다. 기존 계산 정책과 검증 게이트를 새 보고서에 재사용했다.

## 2. 신규 파일과 기존 변경

- `src/lib/sales-types.ts`: 공개 보고서 필드, PDF artifact, 상태·버전·이력 타입.
- `src/lib/sales-report.ts`: 생성, 소속 검사, 불변 통계, 서술 새 버전, 근거 철회 검사, 승인·다운로드 제한.
- `src/lib/sales-html.ts`: A4 두 페이지 HTML 레이아웃, 비교 조건과 표본 수 표시.
- `src/lib/sales-pdf.ts`, `scripts/sales-pdf-worker.mjs`, `scripts/validate-sales-pdf.py`: 로컬 PDF 생성·검증.
- `src/lib/sales-brand.ts`: 단일 회사 설정 저장.
- `src/app/api/sales-reports/route.ts`, `src/components/sales-report-panel.tsx`: 인증 API와 화면.
- `tests/sales-report.test.ts`: 정책·실제 PDF·실제 PostgreSQL 재조회 검사.
- `scripts/inspect-preservation-diff.mjs`: 값 노출 없는 필드 차이 진단과 경쟁사 순서만 복구하는 제한적 도구.
- 기존 `workspace.tsx`, `types.ts`, `db.ts`, `auth.ts`, `tests/e2e/prescan.spec.ts`, 의존성/ignore 설정을 최소 범위로 확장했다. Prisma 스키마 변경은 없다.

## 3. 화면과 API

로그인 후 고객사를 선택하고 **무료 AEO 영업 진단서** 메뉴로 진입한다. 고정 Snapshot, 대표 플랫폼, 비교 그래프를 선택한 뒤 초안을 생성한다. HTML 미리보기 → 검토용 실제 PDF 생성 → 내용·부분 표본·의료광고 표현 검토 및 기록 → 제출 승인 → 제출용 PDF 다운로드 순서다.

`GET /api/sales-reports?projectId=...`: 권한 내 목록/회사 설정. `id=...` 추가 시 HTML 미리보기. `format=PDF&mode=INTERNAL|FINAL` 추가 시 저장된 바이너리 PDF. `inline=1`도 지원한다.

`POST /api/sales-reports`: `brand`, `generate`, `edit`, `render`, `approve`. 모든 고객 자료는 프로젝트 소속과 직원 권한을 확인한다. 공개/익명 공유 URL이나 이메일 발송 기능은 만들지 않았다.

## 4. PDF 렌더링 기술

설치된 Microsoft Edge의 Chromium 인쇄 엔진을 Playwright로 실행한다. HTML의 스크립트와 외부 네트워크를 차단하고 `page.pdf`로 실제 `%PDF-` 바이너리를 생성한다. Python `pypdf`로 열어 페이지·크기·텍스트·폰트 포함을 검증한다. 렌더링은 DB 트랜잭션 밖에서 수행하고 저장 전에 최신 버전과 근거를 다시 검사한다.

실행 조건: Windows, Edge, 맑은 고딕, Node 의존성, Python+pypdf. 기본 Python 경로는 현재 Codex 번들 런타임이며 `AEO_PDF_PYTHON`으로 별도 준비한 Python을 지정할 수 있다. 런타임 파일과 작업 디렉터리의 `scripts/`가 필요하다. 관리자 설치나 새로운 브라우저 다운로드를 수행하지 않았다.

## 5. 실제 A4 2페이지 검증

`output/pdf/aeo-sales-local-mock.pdf`, `aeo-sales-zero.pdf`, `aeo-sales-long-name.pdf`를 실제 생성했다. 각각 정확히 2페이지, 각 페이지 약 595.276×841.89pt(A4 세로)이며 pypdf로 열렸다. PDF 헤더·SHA-256도 확인한다. 승인/다운로드 E2E는 API의 실제 PDF 응답을 확인한다. 위 샘플은 내부 검토용 LOCAL MOCK이며 고객 제출용 실제 측정 성과가 아니다.

## 6. 한글·폰트·레이아웃

모든 페이지에서 한글 추출과 U+FFFD 부재, 모든 사용 폰트의 문서 포함을 확인했다. Windows 설치 폰트의 OS/2 fsType을 읽어 제한된 embedding/subsetting 설정이면 중단한다. 폰트 파일을 저장소에 복제하지 않았다. [Microsoft 폰트 FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq)의 문서 포함 조건을 참고했다.

DOM으로 본문 블록의 A4 영역/푸터 침범/서로 겹침을 검사한다. 범위를 넘으면 PDF 저장·승인이 실패한다. PDFium으로 샘플 3개를 총 6장 PNG로 렌더링해 육안 확인했다. 일반/0건/긴 한글 병원명 및 긴 URL에서 한글·표·그래프·페이지 번호가 정상 표시됐고 겹침·잘림이 없었다. 긴 URL은 축약 표시한다. 극단적으로 긴 회사 설정/서술은 생성 제한에 걸릴 수 있어 문구를 줄여 재검수해야 한다.

## 7. 지표와 검증 게이트

`verified-observation-v1`의 `confirmedMetrics`/`confirmedExclusion`을 사용한다. 미검증·거부·내부 전용·부정확·업체 식별 미완료·DEMO·동일 관측 중복을 확정 통계에서 제외한다. 고정 Snapshot에 포함된 응답만 사용하며 현재 조건·응답 ID·지표가 Snapshot과 일치하는지 재검사한다.

| 지표 | 분자 / 분모 |
|---|---|
| Brand Mention Rate | 확정 고객 언급 응답 / 검증 유효 응답 |
| Recommendation Inclusion Rate | 확정 고객 추천 후보 응답 / 검증 문맥 분석 완료 응답 |
| Official Citation Rate | 공식 호스트 인용 응답 / 검증 유효 응답 |
| Query Coverage | 고객 언급이 있는 서로 다른 질문 / 검증 관측이 있는 서로 다른 질문 |

선정 질문, 관측 질문, 검증 질문, 유효 응답을 분리한다. 핵심 지표는 선택한 대표 플랫폼 기준이다. 플랫폼을 통합해 AI 전체 추천 점수로 표시하지 않는다. 경쟁사는 같은 응답 풀의 업체 언급 비교이며 진료 능력 순위가 아니다. 작은 표본(n<5), 모델 불명, 조건/질문 구성 불일치이면 직접 비교 막대 대신 표본/한계를 보여 준다.

개선 기회는 최대 3개다. 관측된 언급·추천·인용 격차 또는 확인된 LIVE 홈페이지 진단에서만 근거를 만들고, 실제 홈페이지와 대조할 다음 작업을 별도로 명시한다. 미언급의 원인이나 치료 효과를 단정하지 않는다.

## 8. Snapshot·Report 버전 보존

기존 Prisma `Report.payload`에 `category=AEO_SALES_SNAPSHOT`으로 저장한다. `loadDb`는 기존 보고서 `p.reports`와 영업 보고서 `p.salesReports`를 분리하고 `saveProject`는 같은 기존 Report 모델에 저장한다. 고객/프로젝트 FK, Snapshot ID·해시·버전, 보고서 ID·버전, 생성자·시각, 계산 정책·공개 필드 해시, 응답/진단 근거 fingerprint, PDF 바이너리·해시·품질·이력을 보존한다.

서술 편집은 새 DRAFT를 생성하고 측정값을 바꾸지 않는다. 새 Snapshot으로 재생성하면 새 근거의 통계와 요약을 생성한다. 새 보고서 승인 시 이전 승인본은 SUPERSEDED로 남는다. 이후 원문·검증·근거가 변경/철회되면 현재 다운로드는 차단되고 새 Snapshot 재검수를 요구한다. PDF와 원본 수치는 자동 덮어쓰기하지 않는다.

## 9. 승인·다운로드 권한

OWNER/MANAGER만 생성·편집·PDF 생성·승인·다운로드 가능하다. 회사 설정 변경은 OWNER만 가능하다. ANALYST는 배정 고객사의 목록/HTML만 확인할 수 있다. VIEWER/익명/담당 외 고객사는 접근하지 못한다. CSRF 동일 출처 검사, 요청 크기 제한, HTML escaping, CSP, no-store, 다운로드 시 PDF 해시 검사 및 재권한 검사를 적용했다.

PDF에는 원문·내부 검증 메모·고객 연락처·원가·계약·비밀키를 포함하지 않는다. 회사 설정의 공개 연락처만 명시적으로 사용한다. workspace 응답에는 PDF base64를 제거하고 다운로드 API에서만 원본을 제공한다. 의료광고/보장 표현 검출은 사전 경고·승인 제한이며 법률 적합성 자동 인증이 아니다.

## 10. DEMO·부분 측정·0건

DEMO는 매 페이지 표시하고 제출 승인을 차단한다. 0건은 자료 없음(null), 측정 전/제출 불가를 표시하며 0% 실적을 생성하지 않는다. 부분 측정은 정확한 질문·응답 표본과 예정/미측정 슬롯을 표시하고 한계 검토 확인이 있어야 승인된다. 실제 회사명·로고·연락처는 자동으로 꾸며 넣지 않고 빈 연락처는 미등록으로 표시한다.

## 11. 실행한 테스트

- 최종 단위·실제 DB·실제 PDF: `AEO_TEST_POSTGRES=1 AEO_TEST_PDF=1 npm test -- --maxWorkers=1` → **21 파일, 115/115 통과**.
- 전체 화면: `npm run test:e2e` → **11/11 통과**. 기존 Pre-Scan E2E를 7-3 생성·PDF·승인·다운로드·서술 새 버전·익명·담당 외 고객사·ANALYST 제한까지 확장했다.
- `npm run typecheck` 통과. `npm run build` 통과. 기존 Prisma 생성물의 동적 파일 tracing 경고 2개는 유지된다.
- 브라우저 E2E와 PDF 단위 검사를 동시에 실행한 시도에서는 PDF 엔진 오류로 실패했다. 단독 PDF 재실행은 7/7 통과했고, 전체 검증은 순차 재실행했다. 동시 실행 자원 경쟁 가능성이 있으나 정확한 OS 오류 원인은 확정하지 않았다. 실패 이력을 성공으로 바꾸어 기록하지 않는다.

| 요청 검증 항목 | 실행한 근거 |
|---|---|
| 바이너리 생성/파일 열기/A4 2페이지 | sales-report 실제 렌더링 3종, pypdf strict parsing |
| 한글/제목·표 경계/겹침/긴 이름·URL | 글꼴·한글 검증, DOM 검사, PNG 6장 시각 검사 |
| 0건/부분 표본/검증 실제 자료만 | zero/partial 정책, 기존 reporting/prescan 검증 테스트 |
| DEMO 제출 제한 | DEMO 단위 승인/다운로드 차단 |
| 타 고객사/역할/익명 제한 | 확장 prescan E2E의 API 권한 검사 |
| 비밀·원문·검증 메모 제외 | privacy sentinel/XSS/로고 차단 단위, 기존 비밀 마스킹 테스트 |
| Snapshot 연결/버전/다운로드 후 보존 | 단위/실제 DB 재조회/화면 다운로드·새 버전 검사 |
| 기존 기능 유지/외부 AI 호출 없음 | 전체 회귀, 기존 live-ai 비용 차단 테스트, 새 엔진 외부 요청 차단 |

## 12. 기존 데이터 보존

작업 전 백업: `C:\Users\zhang\AppData\Local\AEOIntelligenceOS\backups\aeo-2026-10-09T08-20-07-625Z-95c04a75-5616-4463-b1da-da34d4a3a1e7.aeo.gz` 및 동일 이름의 manifest. 기존 DB/원본/백업을 삭제하지 않았다. 격리된 LOCAL MOCK 테스트 고객사만 테스트 종료 시 정리한다. 최종 health와 manifest 비교 결과는 아래 기록.

회사 설정은 `data/sales-brand.json`이며 DB 백업에 포함되지 않는다. 실제 회사 설정을 입력한 뒤 이 파일은 별도로 백업해야 한다. 보고서에 캡처된 회사 설정과 PDF 원본은 DB 백업에 포함된다.

## 13. 외부 AI API 호출

유료/무료 AI 서비스 호출 0회. `LIVE_AI_ENABLED=false`, `FREE_GEMINI_ENABLED=false`를 유지했다. 새 엔진은 AI SDK/API를 호출하지 않고 설치된 로컬 Edge 인쇄만 수행한다. 외부 로고 URL을 받지 않으며 렌더러의 네트워크 요청을 차단한다. 환경변수의 키를 출력하지 않았다.

## 14. 한계·위험

실제 병원 고객 자료/실제 소비자 AI 관측 결과의 품질은 이번 모의 테스트로 인증하지 않는다. 수집 담당자가 실제 화면·원문·조건을 확보하고 별도 검증자가 확인해야 한다. 단일 로컬 Windows용이며 다른 PC/서버는 Edge·폰트·Python+pypdf 실행 환경을 준비해야 한다. OS 차원의 브라우저 장애/과도한 동시 실행에서는 생성 실패 후 재시도가 필요하다. 공식 정보 검증, 의료광고 최종 검토, 실제 연락처 등록 및 고객 전달은 사람이 수행한다. 테스트 PDF는 영업 실적으로 재사용하지 않는다.

## 15. 7-4 준비 상태

고정 Pre-Scan → 공개 필드 선별 → 실제 2페이지 PDF → 내부 검수 → 승인 → 권한 있는 다운로드 흐름을 제공한다. 7-4는 시작하지 않았다. 파일럿 계약, 자동 영업 발송, 신규 AI 측정, 과금, Benchmark 판매, 제휴 포털은 이번 단계에서 구현하지 않았다.

## 최종 검증 기록

판정: **7-3 로컬 Windows 구현 및 모의 업무 검증 완료**. 실제 고객 측정 성과를 인증하는 판정은 아니다.

- 최종 수정 후 단위/DB/PDF 115/115, 화면 11/11, 타입 검사, 프로덕션 빌드 통과.
- 기존 경쟁사 배열의 순서가 DB 재조회에서 바뀐 것을 발견했다. 값·ID 변경 없이 순서만 달라진 것을 백업과 필드 단위로 확인하고 원래 순서로 복구했다. `loadDb`가 저장된 경쟁사 ID 순서를 유지하도록 수정했다. 수정 후 모든 테스트와 보존 검사를 재실행했다.
- `db-preservation-check.mjs` 최종 결과 `ok=true`, `schemaUnchanged=true`. 비휘발 16개 테이블의 전체 행 SHA-256·ID 목록·개수가 백업과 일치했다. FK/관계 컬럼까지 전체 행 및 스키마/제약조건 해시 비교에 포함된다. AccessEvent/StaffSession은 별도 제외하되 최종 health 전체 해시도 작업 전과 일치했다.
- 실제 DB 경로: `C:/Users/zhang/AppData/Local/AEOIntelligenceOS/postgres/development`. `npm run db:health`: `ok=true`, `temporary=false`.
- 전체 dataHash: `792bf5da25b8aa6874e372108b20c5ee48d91fa443c30e17463be9622462b8ff`.
- schemaHash: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`.
- 보존된 개수: 고객사1, 경쟁사2, 질문9, 질문세트1, AI응답5, 관측5, 출처5, 언급7, 기존 보고서0, 홈페이지진단2, 과제3. 모의 영업 PDF 저장·재조회는 격리 고객사에서 검증 후 해당 테스트 고객사만 정리했다.
- 최신 PDF 3종/6페이지 PNG를 최종 시각 재검사했다. 테스트 PDF는 내부 모의 자료로만 제공한다. 원본 개발 DB, 작업 전 백업 및 7-1 보존 원본은 삭제하지 않았다.
- 외부 AI API 호출0회, 7-4 미착수.
