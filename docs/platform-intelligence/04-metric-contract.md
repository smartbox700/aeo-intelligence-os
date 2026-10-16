# 8-0 Metric Contract Freeze

**계산식 변경 없음.** 아래 Metric ID는 문서상의 보존 식별자이며 구현에 추가한 Registry가 아니다. 0~1 rate, 0~100 percent, percentage point delta를 구분한다.

## Scope와 gate

confirmedMetrics의 scope는 kind/questionIds/providers/from/to다. 등록 질문과 실제 질문을 구분하며 provider별 비교는 호출자가 적절히 filter해야 한다. kind가 다른 표본은 섞지 않는다.

`confirmedExclusion()` gate는 DEMO, INTERNAL 분류, 지원하지 않는 구형 API, 질문/프로젝트 불일치, 원문·provider·model·region·관측시각·실제질문 부족/미래시각, INACCURATE, 미검증/검증거부, 검증자·근거/시간·sourceConfirmed 부족, EntityAnalysis 미완료, isEligible의 제외 조건을 처리한다. 동일 observationIdentity는 추가로 중복 제외한다. 모델 ‘미표시’는 별도 비교 경고이고 이 문자열만으로 모든 지표에서 자동 제외되는 것은 아니다.

소비자 관측은 consumerScreenConfirmed와 searchUsage=USED, 업체 식별 READY 등이 필요하다. API 관측은 measurement SUCCEEDED/searchUsed=true/식별 READY가 필요하다. 일반 visibility 지표는 confirmedMetrics보다 약한 gate이며 VERIFIED만 사용한다고 표현하면 안 된다.

## Confirmed 지표 (`verified-observation-v1`)

| 문서상 Metric ID | numerator | denominator | unit | source function/gate |
|---|---|---|---|---|
| CONFIRMED_BRAND_MENTION_V1 | clientMention이 확인된 응답 수 | 검증된 eligible 중복 제외 응답 | 0~1/null | confirmedMetrics→visibilityMetrics; 위 gate |
| CONFIRMED_OFFICIAL_CITATION_V1 | 등록 고객 website의 www 제거 hostname과 일치하는 citation이 있는 응답 | 같은 검증 eligible 응답 | 0~1/null | confirmedMetrics→visibilityMetrics/citationMatch |
| CONFIRMED_RECOMMENDATION_V1 | ACCEPTED client entity의 context=RECOMMENDATION인 응답 | 검증 eligible 중 EntityAnalysis READY 응답 | 0~1/null | confirmedMetrics→visibilityMetrics; 추천형 질문 개수 분모가 아님 |
| CONFIRMED_QUERY_COVERAGE_V1 | client 언급이 확인된 서로 다른 선택 질문 수 | 검증 관측이 있는 서로 다른 질문 수 | 0~1/null | confirmedMetrics; 등록/계획 전체 질문 분모가 아님 |
| CONFIRMED_EXPLICIT_FIRST_RECOMMENDATION_V1 | ACCEPTED client 추천 entity의 introductionOrder=1인 응답 | 명시적 번호가 있는 ACCEPTED 추천 entity를 하나 이상 가진 검증 응답 | 0~1/null | confirmedMetrics firstRows; 텍스트 등장 위치와 다름 |
| CONFIRMED_SAMPLE_N_V1 | gate 통과·중복 제외 응답 수 n | 해당 scope 전체 후보 total를 함께 제시 | count | confirmedMetrics.rows.length |
| CONFIRMED_EXCLUDED_N_V1 | scope 후보 중 제외된 응답 수 | 후보 total | count | confirmedMetrics.excludedRows; 사유 동반 |
| CONFIRMED_MEASUREMENT_COVERAGE_V1 | 검증된 관측이 있는 고유 질문 수 | selectedQuestionCount | 0~1/null | confirmedMetrics.measurementCoverage; Query Coverage와 다름 |

등록/선정/측정 질문 수, total/n/excluded는 같이 보존한다. 0/0을 0%로 바꾸지 않는다.

## 기존 일반 화면 지표

| 문서상 Metric ID | numerator / denominator | version/gate |
|---|---|---|
| LEGACY_MENTION_RATE | 모호하지 않은 client mention이 있는 응답 / kind 일치 및 isEligible 응답 | analysis.ts:metrics. `ANALYSIS_VERSION=literal-boundary-v1`은 분석 버전이며 지표 registry 버전은 아님 |
| LEGACY_CITATION_RATE | 공식 hostname 인용 응답 / isEligible 응답 | analysis.ts:citationRate; website 없으면 rate=null. VERIFIED gate 아님 |
| VISIBILITY_MENTION_RATE | EntityAnalysis가 있으면 ACCEPTED client, 없으면 비모호 client mention 응답 / eligible 응답 | visibility.ts:visibilityMetrics; 별도 지표 상수 없음 |
| VISIBILITY_RECOMMENDATION_RATE | ACCEPTED client 추천 응답 / eligible 중 EntityAnalysis READY 응답 | visibility.ts. 확인된 표본과 탐색 표본을 혼동하지 않음 |
| EXPLICIT_POSITION_OBSERVATION | client 추천 entity의 introductionOrder 목록 | 단순 Mention.position(문자 등장 위치)과 다른 자료 |

현재 version 상수가 없는 함수는 이번 단계에서 새 상수를 심지 않는다. 8-1 이후 version을 추가할 때 과거 보고서와 동일 의미인지 문서 ID/정의/함수 checksum으로 대조한다.

## CITED 지표 (별도 계약)

`cited-diagnosis.ts:metrics`, Diagnosis.version=1. UI 입력자의 체크 값이며 confirmed gate를 통과한 지표가 아니다. 이 파일에 별도 CALCULATION_VERSION 상수는 없다.

| 문서상 Metric ID | numerator | denominator | unit |
|---|---|---|---|
| CITED_MANUAL_MENTION_V1 | 선택 platform에서 observed이며 mentioned=true인 응답 | 같은 platform에서 status=observed인 응답 | 소수 1자리 0~100/null |
| CITED_MANUAL_CITATION_CHECK_V1 | 위 표본 중 cited=true | 위 observed 응답 | 0~100/null; URL 검증 지표 아님 |
| CITED_MANUAL_RECOMMENDATION_V1 | recommendation형 질문의 observed 중 recommended=true | 같은 platform의 observed 추천형 질문 응답 | 0~100/null |
| CITED_COLLECTION_N_V1 | observed 슬롯 수 | 계획 질문×5 platform | count; 미측정 분모/현황 표시 |

10문항 시작 진단에는 추천형 4개, 50문항 확장 진단에는 8개다. 실제 분모는 이 중 **관측 완료된 추천형 슬롯**이다. 일반 confirmed recommendation의 분모와 다르므로 이름만 보고 합치지 않는다. CITED 결과를 attachDiagnosis로 원문에 연결해도 VERIFIED나 citation URL이 자동 생성되지 않는다.

## 전후 변화

`research-metrics.ts:compareStudy`는 질문/화면/모델/국가/지역/검색 사용·단계·반복과 시간 순서가 맞는 pair를 찾는다. confirmed 옵션은 추가 검증 gate를 적용한다.

`pilot-measurement.ts:pilotComparison`의 delta는 `(after.rate-before.rate)*100` 기반 percentage points이며 코드의 반올림을 유지한다. 동일 계획, fresh Snapshot, 모델 미표시 여부, pairedN 등을 검사한다. 비교 불가/null을 0 또는 개선으로 바꾸지 않는다. 작은 표본/비인과/성과 미보장 경고도 출력 계약의 일부다.

함수 원본 체크섬은 01 문서와 protected start.json에 고정한다. 8-0에서는 해당 계산 함수·검증 gate·반올림을 변경하지 않는다.
