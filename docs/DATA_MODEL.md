# 데이터 모델

| 모델 | 책임 | 소유 관계 |
| --- | --- | --- |
| Organization | 로컬/향후 대행사 조직 | 프로젝트 소유 |
| Project | 고객 분석의 경계 | Organization |
| ClientEntity | 업체 프로필·별칭 | Project |
| CompetitorEntity | 비교 업체·별칭 | Project |
| QuestionSet | 질문 묶음 | Project |
| Question | 원문·의도·중요도 | QuestionSet |
| AIProvider | 플랫폼 사전 | 공유 참조 |
| ObservationRun | 플랫폼·모델·유형·시각·지역·비용 | Project |
| AIResponse | 불변 원문·분석 버전·현재 분석 payload | Run / Question |
| Mention | 업체 식별·문자 위치·모호 여부 | AIResponse |
| CitationSource | 응답에서 입력한 출처 URL | AIResponse |
| WebsiteAudit | URL·LIVE/DEMO·시각·검사 근거 | Project |
| OptimizationTask | 근거·수정안·가설·우선순위·상태 | Audit / Project |
| Report | 내보내기 이력 확장용 | Project |

`prisma/schema.prisma`가 스키마의 기준이다. MVP는 변경이 잦은 프로필·검사·조건 필드를 JSON payload로 보관하고 핵심 관계 및 집계 엔티티를 정규화한다. 원문 `AIResponse.rawText`는 upsert의 update 대상에서 제외한다. 현재 언급 분석은 재분석으로 교체 가능하다. DEMO/MANUAL_UI/API_OBSERVATION 및 legacy API는 ObservationRun.kind에 기록한다. 정확도는 수동 검토 상태다. 비용 미기록은 null이다.

MeasurementBatch는 질문 원문 스냅샷·실행 키·지역·모델·상태·응답 ID를 보관하며 projectId/idempotencyKey가 유일하다. ObservationRun은 batchId·상태·검색 여부·API 메타데이터를 추가로 보관한다. CitationSource에는 제목을 저장한다. 업체 분석과 담당자 수정 전후 이력은 응답 payload에 저장한다. 실행 한 건은 한 응답에 대응하며 배치가 여러 질문 실행을 묶는다. 외래키는 관계를 보장하지만 서로 다른 프로젝트 질문과 실행을 결합하는 복합 제약은 아직 없으므로 API에서 소속을 검증한다. 다중 조직 운영 전 조직 기반 repository 및 DB 수준 복합 제약을 추가한다.

고객 삭제 시 Run/Response를 먼저 제거하고 Project를 삭제하여 나머지 관계를 cascade 삭제한다. Report 테이블은 준비되어 있으나 CSV 내보내기 이력 기록은 미구현이다. 파일 모드는 동일한 도메인 데이터를 프로젝트별 aggregate로 보관한다.


## 3단계 추가 필드
기존 payload에 ClientEntity.analysisProfile/priorityWeights/websiteChanges, WebsiteAudit.optimization/pages, OptimizationTask.score/scoreParts/assignee/dueDate/reviewStatus/history, AIResponse.manualObservation/questionText를 추가한다. 기존 DB 관계와 원문 불변 정책을 재사용하며 초기화·기존 기록 유형 변경이 없다. MANUAL_OBSERVATION을 새 유형으로 추가하고 legacy MANUAL_UI를 보존한다.

