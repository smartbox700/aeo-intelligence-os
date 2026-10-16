# Platform Intelligence 8-2 — Knowledge & Rule Registry

## A. 구현 파일

| 신규 파일 | 책임 |
|---|---|
| `src/lib/platform-intelligence/knowledge/contracts.ts` | strict 입력 schema, 지식·scope·provenance·validity·audit 계약, 독립 canonical JSON SHA256 |
| `src/lib/platform-intelligence/knowledge/repository.ts` | Repository interface와 명시적 ephemeral in-memory 구현, 검토 상태 전이·버전·감사 이력·조회 |
| `src/lib/platform-intelligence/rules/registry.ts` | 읽기 전용 Rule/RuleSet 구성, 근거/범위/승인 검증, 체크섬 고정, 사용 가능 Rule 조회 |
| `tests/platform-knowledge.fixture.ts` | 테스트 전용 synthetic 문서·관측·가설·Rule/RuleSet 입력 |
| `tests/platform-knowledge.test.ts` | 신규 계약·검증·보존 테스트 35개 |
| 이 보고서 | 설계·검증·보존·다음 단계 판정 |

기존 8-0/8-1 파일을 대체하지 않고 신규 모듈로 추가했다. UI/Route/점수 엔진/DB 저장 연결이 없으며, 기존 platform-intelligence/index.ts도 수정하지 않았다. 신규 소비자는 knowledge/contracts, knowledge/repository, rules/registry를 명시적으로 import한다. 별도의 flag나 외부 전송은 없다. SHA256은 서버용 node:crypto를 사용하므로 향후 클라이언트 UI에서는 서버 projection을 통해 접근한다.

## B. Knowledge Contract

### Type / Review Status

지식 유형 FACT / OBSERVATION / HYPOTHESIS와 승인 상태 DRAFT / REVIEW_REQUIRED / APPROVED / RETIRED는 별개다. FACT라는 분류만으로 승인되지 않는다.

`createDraft → submitForReview → approve`를 순서대로 호출한다. 각 명령에 actorId, createdAt, reason이 필수이며, 승인 시 provenance.reviewedBy/reviewedAt을 명령의 검토자·시각으로 기록한다. 입력에서 reviewer를 미리 넣어 DRAFT를 self-approve할 수 없다. 감사 이벤트는 이전/이후 체크섬과 작업 종류를 함께 append한다. 같은 버전의 DRAFT/REVIEW_REQUIRED projection은 바뀔 수 있지만 이전 반환 객체와 감사 이벤트는 불변이다. 버전의 최초 createdAt도 유지한다.

### Scope / Provenance

Scope: canonical platformCode/channelCode, country, language, industry, surface, projectId. channel이 있으면 소속 platform이 필수다. industry는 현재 operations-types.IndustryProfile과 같은 MEDICAL / LEGAL / COMMERCE / BRAND만 허용한다. DENTAL은 이번 단계에서 추가하지 않았다. 향후 sub-industry 계층 후보로 남긴다.

Provenance: sourceType, sourceReference, 선택적 HTTPS sourceUrl/sourceTitle/sourceDate/excerptHash, capturedAt, evidenceRefs, reviewedBy/reviewedAt. 출처가 없는 FACT DRAFT를 보관할 수 있지만 승인할 수 없다. APPROVED FACT에는 공식 출처 유형(OFFICIAL_DOCUMENT / OFFICIAL_HELP / OFFICIAL_TECHNICAL_DOC), reference, HTTPS URL, lastVerifiedAt, 검토자가 필요하다. 미래의 출처를 검증했다고 승인할 수 없다.

URL과 공식 sourceType만으로 사이트의 공인 여부·주장 진실성을 자동 증명하지 않는다. 해당 출처가 공식인지와 claim을 실제 뒷받침하는지는 **사람의 검토 책임**이다. 웹 조회·자동 FACT 생성·실제 플랫폼 FACT 입력을 수행하지 않았다.

OBSERVATION은 `claim=REFERENCED_INTERNAL_OBSERVATION`이라는 고정 설명과 projectId 및 evidenceRefs를 사용한다. 고객 원문·인용문·sourceTitle/sourceUrl 복사를 허용하지 않는다. AI_RESPONSE / CITATION / MENTION / SNAPSHOT / EVIDENCE / EXPERIMENT의 projectId+ID만 참조하며, 다른 프로젝트 evidenceRef는 거부한다. 참조 대상의 실제 존재·권한·동의는 향후 persistence bridge가 기존 project 권한 검사와 함께 확인해야 한다. 이번 메모리 구현은 DB를 읽지 않으며 고객 참조를 따라가지 않는다.

프로젝트 지식은 기본 list/get/getVersion/listVersions에서 숨긴다. 읽는 쪽이 신뢰 가능한 authorizedProjectIds를 전달해야 한다. 이 인자는 인증 토큰이 아니므로 향후 HTTP 입력에서 그대로 신뢰하면 안 된다. 현재 Route/UI와 연결하지 않았다. in-memory mutation contract와 감사 조회 또한 내부 테스트/향후 adapter 경계이며 공개 관리 API가 아니다.

### Version / Validity

Stable knowledgeId와 양의 정수 version을 분리한다. 신규 버전은 직전 버전+1과 정확한 supersedes를 요구한다. 같은 버전 재작성 및 stale 검토 전이를 거부한다. APPROVED는 직접 수정하지 않으며 새 DRAFT 버전을 만들어 다시 검토한다. 유형 변경도 새 버전과 새 검토를 거친다. HYPOTHESIS/OBSERVATION을 반복 조회·승인한다고 FACT가 되지 않는다. FACT로 새 버전을 내더라도 공식 출처 승인 gate를 다시 통과해야 한다.

`retire`는 최신 APPROVED를 덮어쓰지 않고 다음 RETIRED 버전을 append한다. 이전 approved record/checksum은 남는다. 현재 구현의 retire 대상은 최신 APPROVED 버전이며 DRAFT 철회 관리 UI/워크플로는 구현하지 않았다.

validFrom, lastVerifiedAt, reviewDueAt, expiresAt, supersedes를 보관한다. 호출자가 명시한 평가 시각(at)으로 CURRENT / NOT_YET_VALID / REVIEW_DUE / EXPIRED / RETIRED를 계산한다. 전역 시계에 의존하지 않는다. expiresAt보다 평가 시각이 늦으면 EXPIRED다. 검토 기한이 지나도 보존된 APPROVED를 고치지 않고 REVIEW_DUE projection으로 사용을 차단한다. 은퇴의 효력도 평가 시각으로 검사하며, 재초안이 생겨도 과거 은퇴 이력이 사라지지 않는다.

list/get은 최신 버전 projection이고, getVersion/listVersions는 과거 재현용이다. 특정 버전 payload/checksum은 이후 새 버전 생성에도 유지한다. 전체 repository snapshot이 달라지면 최신 조회는 달라질 수 있으며, 과거 재현은 version·checksum과 명시적 평가 시각을 함께 고정해야 한다.

## C. Rule Contract

### Rule / RuleSet

Rule에는 ruleId/version, name/description, platformScope/channelScope/industryScope, 추가 country/language/surface/project scope, checkType, knowledgeRefs, basis, severity, weightCandidate, actionRefs, reviewStatus, effectiveAt, retiredAt, audit/reviewer가 있다. weightCandidate는 사용되지 않는 metadata이며 점수 함수는 없다.

Rule knowledgeRefs는 stable ID+정확한 version+role(CONFIRMED / SUPPORTING / EXPERIMENTAL)을 가진다. 구성 시 참조한 Knowledge checksum도 knowledgeChecksums에 고정한다. APPROVED Rule의 reviewer/시각 및 승인된 유효 근거를 검증한다. Rule은 정적 snapshot을 구성할 때 검증하며 편집/승인 관리 화면이나 mutation endpoint를 만들지 않았다.

RuleSet은 stable ruleSetId/version과 정확한 Rule 버전들을 참조하고 ruleChecksums 및 자체 checksum을 보관한다. APPROVED RuleSet에는 승인된 CONFIRMED Rule만 넣을 수 있다. 없는 참조·중복 버전·중복 RuleSet 참조를 거부한다. 실제 6개 플랫폼용 완성 RuleSet은 없다.

읽기 API: getRuleVersion/listRuleVersions, getRuleSetVersion/listRuleSetVersions, listApplicableRules. 미래 Readiness에서 사용할 수 있는 목록은 APPROVED+CONFIRMED만 반환하며, 최신 Rule 버전이 DRAFT/RETIRED이면 이전 버전을 자동 fallback하지 않는다. 평가 시각과 scope가 명확하고 근거가 여전히 유효해야 한다. experimental metadata는 버전 조회로만 읽을 수 있다.

### CheckType

| 등록 유형 | 기존 코드 근거 | 한계 |
|---|---|---|
| ROBOTS_ACCESS | robots.ts:robotAccess | 제공된 robots/agent/path의 로컬 해석. 실제 크롤링·접근 보장 아님 |
| NOINDEX | audit.ts:inspectHtml, 기존 header 검사 | 명시 설정만 해석. 실제 Google 색인 여부 검증 아님 |
| PAGE_TEXT_PRESENT | studio-page.ts:parseStudioPage | 제공 HTML의 추출 본문 |
| STRUCTURED_DATA_PRESENT | studio-page.ts:parseStudioPage | JSON-LD 존재/파싱. 플랫폼 적용/추천 효과 검증 아님 |
| CITATION_PRESENT | types.ts:ResponseRecord.citations | 기존 관측 citation 자료. 원문의 자동 검증 승격 아님 |

각 checkType에 근거 코드와 unknownWhen 설명을 둔다. 결과 계약은 PASS / FAIL / UNKNOWN / NOT_APPLICABLE이다. **8-2에는 검사 실행기 자체를 추가하지 않았다.** 자료가 없을 때 UNKNOWN을 유지할 향후 계약이며 실제 검사 결과를 만들어내지 않는다. Google Index / Merchant Center / Naver Place 등 미검증 자동 확인 유형은 등록하지 않았다.

### 근거 정책

- CONFIRMED Rule에는 APPROVED FACT의 CONFIRMED 참조가 최소 하나 필요하다.
- FACT의 platform/channel scope와 확정 근거 Rule의 platform/channel scope가 정확히 맞아야 한다. 플랫폼만 아는 FACT를 특정 소비자 채널 FACT로 확대하지 않는다.
- Knowledge의 country/language/industry/surface/project 제약도 Rule에서 더 넓힐 수 없다.
- APPROVED OBSERVATION은 프로젝트 scope 안에서 SUPPORTING만 허용한다. 단독 확정 근거로 승격하지 않는다.
- HYPOTHESIS는 EXPERIMENTAL 역할과 실험용 Rule에만 연결한다. CONFIRMED Rule에 가설을 보조 역할로 우회 첨부하는 것도 막는다.
- 만료·검토 기한 경과·은퇴·미승인 Knowledge로 신규 APPROVED Rule을 구성할 수 없다. 기존 Rule 버전의 metadata를 고치지 않고 현재 사용 가능 조회에서 제외한다.

## D. Validation

strict Zod 객체는 선언되지 않은 필드를 거부한다. code/eval/expression/javascript 필드, 미등록 checkType, 자유문자열 platform/channel, 잘못된 channel 소속, source 없는 FACT 승인, reviewer 없는 승인, 미래 검증/역행 감사 시각, 잘못된 validity 구간, immutable 버전 overwrite, 존재하지 않는 knowledge/rule 참조, scope 확대, 프로젝트 경계 위반을 차단한다. description/claim은 실행되지 않는 텍스트이며 JavaScript나 eval 실행 경로가 없다.

Knowledge/Rule/RuleSet checksum은 이 모듈의 canonical JSON SHA256이다. 객체 key는 정렬하고 배열 순서는 보존한다. 비유한 숫자와 JSON이 아닌 값은 거부한다. 입력 객체를 복제한 뒤 결과를 재귀 freeze하므로 caller 객체를 얼리거나 이후 caller 변경을 보관하지 않는다. 기존 Snapshot/hash 함수에는 영향을 주지 않는다.

Audit와 repository는 메모리 수명 범위다. 프로세스 재시작 후 유지되는 저장소라고 주장하지 않는다. 향후 DB persistence는 원본을 복사하지 않는 scope bridge, actor 권한, unique(id,version), expected revision, transaction과 영구 audit를 별도로 구현해야 한다.

## E. Seed

Production Knowledge **0개**, Rule **0개**, RuleSet **0개**. 실제 플랫폼 알고리즘·최적화 FACT seed는 없다.

Synthetic FACT_TEST_001 / OBS_TEST_001 / HYP_TEST_001, 테스트용 Rule/RuleSet은 tests 경로에만 있다. 출처 URL은 example.invalid이며 실제 공식 출처가 아니다. 테스트는 승인 gate의 구조를 검증할 뿐 실제 플랫폼 지식으로 해석할 수 없다. Production 모듈에서 fixture를 import하지 않는다.

## F. Preservation

보호된 검증 디렉터리: `output/stage7-5/platform-8-2-6284109c-b423-4979-b94e-842f12ac6cb9`. 기존 8-0/8-1 pointer와 증거는 그대로 유지한다. 시작 시 기존 tracked/untracked 파일 전체 체크섬과 read-only 원본 DB 상태를 기록했다.

원본 DB 테스트를 피하기 위해 기존 통합 백업→별도 aeo_restore_test_* 복원 DB에서 전체 테스트를 실행한다. 신규 Platform/Knowledge/Rule 테이블을 만들지 않는다. 원본 provider/screen/rawText, 질문, Snapshot/Report와 hash, Pilot/Agreement/Consent, metric, Route, Prisma는 이번 단계 수정 대상이 아니다.

최종 `final-preservation.json` 결과:

- 원본 DB 전체 data hash 전/후 동일: `977578a2668cd3fd0d0621af43ecd4944c3200eb0784c56c5c9030a56eefdf96`.
- 원본 schema hash 동일: `263a66cb769240e4fedab3785ee07236af706f9064324707e95acb9c9935af43`. DDL/컬럼/인덱스/제약도 동일.
- 20개 도메인 보존 비교 모두 equal=true. 빈 영역은 EMPTY_IN_SOURCE로 구분한다. 비어 있지 않은 synthetic Snapshot/Report/Agreement/Consent/Studio/첨부는 rich preservation 테스트로 따로 검증했다.
- 작업 전 존재하던 tracked/untracked 파일 중 변경 **0개**. 기존 workspace.tsx의 8-0 수정과 8-1 모듈/테스트/보고서도 시작 시 내용 그대로다.
- Prisma schema 파일 SHA256 동일: `5a4f0156617b662fddcc40507f1cc5fc33a3af26eeb0e205ac2094e4c3af7ba7`.
- 통합 백업→격리 복원 data/schema/IDs/관계/files 일치. 원본 첨부 fileCount/referenceCount는 0이며 synthetic 테스트와 혼동하지 않는다.
- 원본 StaffSession/AccessEvent도 변경 예외로 빼지 않았다. 8-0/8-1과 원본 전체 데이터 해시도 같다.

원본 DB UPDATE, Snapshot/Report 재생성, 기존 raw/enum 치환, metric/Route/Prisma 변경이 없음을 확인했다. git status에 보이는 기존 수정/미추적 파일을 reset하거나 덮어쓰지 않았다.

## G. Tests

신규 35개 테스트가 통과했다. FACT/source/reviewer gate, 유형·상태 분리, 버전 append 및 불변성, scope, 프로젝트 참조, 만료/은퇴, canonical checksum, HYPOTHESIS 차단, 허용 checkType, 실행 payload 거부, 기존 resolver/raw/Snapshot hash 보존을 포함한다.

현재 완료된 격리 검증:

- 신규 Knowledge/Rule 테스트: **35/35 통과**.
- 전체 단위·PostgreSQL·PDF·rich preservation: **30개 파일, 206/206 통과**. 기존 8-1까지의 171개를 포함한다.
- Next production build: **통과**. 기존 동적 파일 추적 경고 **3개** 유지.
- TypeScript `tsc --noEmit`: **통과**.
- `git diff --check`: **통과**.

전체 E2E: **15 통과 / 1 실패**. 실패는 기존 `tests/e2e/pilot.spec.ts:50:532`의 390px 모바일 scrollWidth 검사이며 8-0/8-1과 같은 위치다. PreScan→Snapshot→PDF·승인/다운로드, Consumer, CITED, Reporting, Backup/Restore 접근 제어, Studio, workspace 경계 검사가 통과했다.

기존 WARN:

1. `_prisma_migrations` 없는 전체 migration 이력 부재: 유지. 이번 단계는 schema 변경이 없으며 새 migration/table을 만들지 않았다.
2. Pilot 모바일 overflow: 이번에도 재현. 범위 밖이므로 화면/기대값을 수정하지 않았다.
3. Studio 배열 순서 민감성: 이번 실행 통과. 과거 반복 재현 경고가 해결됐다고 판정하지 않는다.
4. 기존 build 동적 파일 추적 경고 3개: 유지.

**신규 FAIL은 발견되지 않았다. 전체 E2E가 green인 것은 아니다.** 검증 runner exit 1은 기존 Pilot 실패를 숨기지 않은 결과다. file-mode 전용 E2E는 이번 단계 재실행하지 않았다. 신규 모듈은 기존 저장소/UI에서 import되지 않으며, 기존 8-0 file-mode 보존 결과와 이번 순수 계약 검증을 근거로 제한한다. Production persistence, 실제 공식 출처의 사실 검증, 실제 고객 지식·점수 검증은 구현/실증 범위가 아니다.

## H. 8-3 준비 판정

**READY_WITH_WARNINGS**

8-3이 canonical identity와 함께 참조할 지식 유형·검토·출처·유효기간·불변 버전·checksum 및 Rule/RuleSet 참조 계약을 준비했다. 신규 회귀 없이 원본 DB와 기존 파일 보존을 확인했다. 위 기존 경고를 유지하는 조건에서 다음 제한된 구현 단계로 진행할 수 있다.

이 판정은 공개 배포·DB schema 변경·API 활성화 승인이 아니다. 영구 repository로 전환할 때는 위 권한/참조/동의·원자성·감사 경계를 구현해야 한다. Readiness Score와 실제 고객 점수는 이번 단계에 없다.
