# 8-0 데이터·Snapshot 보존 계약

이 계약은 향후 개발 시 **자동·소급 치환 금지**를 규정한다. 고객이 정상 업무로 새 관측/검증/동의/보고서 버전을 추가하는 절차까지 금지하는 것은 아니다. 기존 원본 변경이 필요한 정정/삭제 요구는 별도 승인된 보유·정정 정책으로 처리한다.

## 1. 불변 범위

| 보존 대상 | 계약 |
|---|---|
| Project/Client/Competitor IDs | 새 Platform에 맞춰 재발급·병합·치환하지 않는다 |
| Universe/QuerySet/Question IDs | 질문 변경은 새 버전/ID 규칙을 유지. 과거 관측의 questionText와 연결은 보존 |
| AIResponse/ObservationRun IDs | 기존 1응답=1run 저장 의미와 FK를 보존. 새 batch/run 의미로 재해석하지 않는다 |
| rawText | 공백/줄바꿈 포함 원본 그대로. derived analysis나 검증 payload와 분리 |
| observedAt/model/region | 기존 조건을 새 기본값으로 backfill하지 않는다. 불명확성은 그대로 기록 |
| provider/screen raw 값 | `ChatGPT`를 `CHATGPT`로 UPDATE하지 않는다. 별도 sidecar mapping이 원 값/매핑 버전/근거를 참조 |
| Evidence/Document IDs·bytes/hash | 파일 내용과 소속·길이·sha256·문서 참조 관계를 보존 |
| Mention/Citation IDs | derived 관계 내용이 같으면 ID를 다시 만들지 않는 기존 writer를 유지 |
| Report/Snapshot IDs·hashes | 기존 결과 재생성·재계산·덮어쓰기 금지. 새 결과는 새 버전 |
| Agreement/Approval/Proposal/Studio versions | 최신 플랫폼 룰을 과거 승인 범위에 적용하지 않는다. 당시 버전·적용/검증 증거를 유지 |
| DataKind/classification/verification | DEMO/API/UI/수동, 비공개 분류, 검증 상태를 새 플랫폼 구분과 혼합하지 않는다 |

운영 코드의 `db.saveProject()`는 AIResponse.rawText를 update하지 않는다. 새 metadata는 기존 rawText나 과거 sourceFingerprint의 입력을 바꾸지 않는 별도 scope/version에서 관리한다.

## 2. Snapshot 네 종류의 hash 경계

| Snapshot | freeze 대상/hash 범위 | source reference | 현재 stale/검증 조건 | 보고서 연결 |
|---|---|---|---|---|
| PreScanSnapshot | `canonicalSnapshot(data)`를 `snapshotHash()` SHA256. id/scanId/actorId/at/frozen은 data 밖 | scanId, set/universe, response/evidence IDs | freeze 시 data hash 일치 검사. Sales는 frozen·hash·sourceFingerprints도 검사 | SalesReport.snapshotId/snapshotHash 및 PilotAgreement의 기준 source |
| PilotMeasurementSnapshot | data 전체: calculationVersion, kind, planHash, responseIds, excluded, fingerprints, 플랫폼 지표/조건 | planId, BASELINE/FOLLOW_UP, PRESCAN/PILOT | `pilotSnapshotFresh`: 계획/조건·data hash·계산 버전·response fingerprints 불일치 시 stale. 비교는 동일 계획/조건 gate | PilotOutcomeReport와 전후 비교 |
| PageSnapshot | `parseStudioPage()`에 전달한 **HTML 원문**의 SHA256. snapshot JSON 전체 hash가 아님 | page.id/url/at/kind/channel/auditId, 추출 본문/기술 정보 | 전체 원 HTML이 없으면 추출 body로 hash를 재계산할 수 없음. 실제 적용 확인은 별도 page/버전으로 기록 | StudioWork.pageId, 적용/검증 page와 Task/Proposal |
| CitedSnapshot | Zod로 해석한 Diagnosis data의 `JSON.stringify(data)` SHA256 digest. id/at/actorId/responseIds는 범위 밖 | 질문×platform 체크/원문과 연결 responseIds | 동일 digest 중복 저장 방지. frozen 상태나 범용 stale gate 없음. 자동 verified로 승격하지 않음 | CITED 리포트 및 기존 원문 bridge |

`canonicalSnapshot()`의 정렬/소수 처리와 일반 `digest()`(보존 검증용 JSON 정렬)는 같은 함수가 아니다. 보존 도구의 SHA256은 stored record를 비교하는 **증거용 hash**이며, 기존 Snapshot hash를 갱신하거나 재발급하지 않는다.

## 3. 보고서와 승인 hash

- ClientReport: HTML SHA256, reporting.version/definitions/scope, 승인 버전 원본을 유지한다.
- SalesReport: snapshotHash, publicData/brand/narrative/chart의 dataHash, sourceFingerprints, 실제 PDF bytes의 artifact.sha256과 다운로드 이력을 보존한다. 근거 변경은 새 검토/버전이 필요하다.
- PilotOutcomeReport: HTML sha256, dataHash, 협약/작업/동의/계획/스냅샷 등의 sourceHash를 보존한다. 새 ActionDefinition metadata를 기존 함수의 입력에 소급 추가하지 않는다.
- 기존 근거/동의가 변경되면 결과가 stale해지는 규칙을 우회하지 않는다. 보존된 과거 기록과 현재 사용 가능성은 분리한다.

## 4. 원본 불변 검증 방식

`platform-8-0-preservation.mjs`는 읽기 전용 transaction에서 전체 public table count/IDs/행 hash/DDL을 읽고, 주요 도메인별 hash-only manifest를 만든다. 원문이나 고객명·비밀번호를 로그로 내보내지 않는다.

최종 source-before/source-after의 모든 table dataHash 및 DDL/인덱스/제약을 비교한다. AccessEvent/StaffSession도 이번 검증에서는 예외로 빼지 않는다. 사용자가 동시에 정상 업무를 수행해 값이 달라졌다면 ‘불변 증명 성공’으로 숨기지 않고 별도 재측정한다.

실제 source에 Snapshot/Report/Agreement/Consent가 0개인 영역은 `EMPTY_IN_SOURCE`로 표시한다. 이 상태의 equality만으로 비어 있지 않은 도메인 복원을 입증하지 않는다. 별도 **LOCAL MOCK 전용 복원 DB**에서 질문 지도·Pre-Scan·Sales/Client/Pilot Report·Before/After·협약/동의·Proposal/Studio·CITED Snapshot·증빙 이미지/문서를 생성하고 백업→재복원하여 비교한다. 테스트 fixture를 기존 운영 고객으로 변환하거나 원본 DB에 추가하지 않는다.

## 5. 명시적 금지

기존 DB reset/삭제, raw provider UPDATE, Snapshot/Report 재생성, 원 hash 변경, 기존 테스트 기대값 임의 변경, Migration/Platform table 생성, 실제 AI 호출, 자동 크롤링은 8-0에 포함하지 않는다.
