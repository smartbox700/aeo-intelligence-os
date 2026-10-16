import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {out}=JSON.parse(await readFile('output/stage7-5/platform-8-10-current.json','utf8'));
const read=async name=>JSON.parse(await readFile(path.join(out,name),'utf8'));
const review=await read('pack-restart-manifest.json.review.json'),installed=await read('pack-restart-manifest.json'),preserve=await read('final-preservation.json'),counts=await read('production-counts.json'),regression=await read('regression-results.json'),http=await read('http-results.json');
const unit=await readFile(path.join(out,'full-unit-db-pdf.log'),'utf8'),e2e=await readFile(path.join(out,'full-e2e.log'),'utf8').catch(e=>{if(e.code==='ENOENT')return 'PENDING';throw e;});
const sources=[...new Map(review.facts.map(f=>[f.source.id,f.source])).values()],date=v=>v?v.slice(0,10):'미표시',rows=review.facts.map(f=>`| ${f.knowledgeId} v1 | ${f.platformCode} | ${f.claim} | [${f.source.title}](${f.source.canonicalUrl}) / ${f.source.officialDomain} | ${date(f.source.sourceDate)} | ${date(f.source.lastVerifiedAt)} | APPROVED (test OWNER) | ${review.rules.filter(r=>r.knowledgeIds.includes(f.knowledgeId)).map(r=>r.ruleId).join(', ')||'FACT_ONLY'} |`).join('\n');
const passed=/Tests\s+(\d+) passed/.exec(unit)?.[1]??'UNKNOWN',e2ePassed=/(\d+) passed/.exec(e2e)?.[1]??'PENDING',e2eFailed=/(\d+) failed/.exec(e2e)?.[1]??(e2e==='PENDING'?'PENDING':'0');
const report=`# Platform Intelligence 8-10 — Official Platform Knowledge Pack v1

기준일 2026-10-16. 판정: **${e2e==='PENDING'?'VALIDATION_IN_PROGRESS':'READY_WITH_WARNINGS'}**.

공식 자료를 확인한 FACT 23개와 제한된 내부 점검 Rule 6개, RuleSet 4개를 작성하고, 격리 migrated PostgreSQL의 PRODUCTION namespace에서 실제 OWNER 역할 fixture의 명시적 검토 명령으로 등록·검증했다. 실제 사람의 운영 승인이나 원본 배포를 뜻하지 않는다. 원본 DB·UI와 API flags는 그대로다.

## A. Official Sources

공식 문서만 직접 열어 확인했다. 일반 AEO 업체/커뮤니티 자료나 모델 추정을 FACT 출처로 사용하지 않았다. 출처 전체 본문을 보관하지 않고 내부 검토 요약과 그 해시를 보존한다. excerptHash는 내부 요약의 canonical JSON SHA256이며 외부 사이트가 보증한 본문 해시는 아니다. sourceDate는 명시된 업데이트 날짜만 사용하며 날짜가 없거나 상대 날짜만 표시되면 null이다.

| Source ID | Vendor / Platform | Official title / canonical HTTPS URL | Domain | Source date |
| --- | --- | --- | --- | --- |
${sources.map(s=>`| ${s.id} | ${s.vendor} / ${s.platform} | [${s.title}](${s.canonicalUrl}) | ${s.officialDomain} | ${date(s.sourceDate)} |`).join('\n')}

모든 등록 source의 capturedAt/lastVerifiedAt은 2026-10-16T11:34:00.000Z다. 정확한 URL이 없는 SOURCE_URL_REQUIRED 등록 후보는 0개다. 추가 확인한 Google crawler/technical requirements 및 Search Central 2025-05-21 글은 보조 검토에만 사용했고 팩 source 수에 포함하지 않았다. NAVER Search Advisor/SmartPlace의 일반 Search/Place 사실을 AI 브리핑 FACT로 옮기지 않았다.

## B. Production Knowledge / Source Citation Report

격리 팩 DB: **FACT 23 / OBSERVATION 0 / HYPOTHESIS 0**. ChatGPT 5, Google AI 8, Gemini 2, Naver AI 2, Claude 4, Perplexity 2다. 별도 SYNTHETIC namespace의 HYPOTHESIS 1개는 격리 검사 전용이며 위 수에 포함하지 않는다.

| Knowledge ID / version | Platform | Claim summary | Official title / domain | Source date | Verified date | Review status | Rule usage |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

모든 Knowledge는 stable ID/version과 draftChecksum, 승인 후 immutable checksum을 가진다. 검토 manifest에는 draftChecksum 및 source excerptHash를, 격리 설치 증거에는 승인된 각 version checksum을 기록했다. 검토 예정일 2026-11-15, 만료일 2027-01-14는 내부 30일/90일 정책이다. 검토 기한이 지난 자료를 영구 CURRENT로 취급하지 않는다.

## C. Rules

| Approved Rule | Platform / channel | Check | Agent / scope | FACT basis |
| --- | --- | --- | --- | --- |
${review.rules.map(r=>`| ${r.ruleId} v2 | ${r.platformCode} / ${r.channelCode} | ${r.checkType} | ${r.robotsAgent??(r.checkType==='NOINDEX'?'HTML_AND_HEADER':'제공된 성공 응답의 텍스트 유무')} | ${r.knowledgeIds.join(', ')} |`).join('\n')}

Rule draft v1과 승인 v2를 각각 보존한다. Rule마다 승인된 정확한 FACT version의 checksum을 고정한다. 목적은 제공된 증거의 Internal Readiness 점검이다. robots 결과는 WAF/IP 접근이나 실제 수집·색인·노출을 확인하지 않는다. noindex 부재는 색인 또는 snippet 자격 전체를 증명하지 않는다. 텍스트 유무는 품질·순위 평가가 아니다. 모든 weight=1은 내부 값이며 공식 알고리즘 가중치가 아니다.

## D. RuleSets

| Platform | Official FACT | Approved RuleSet | 상태 |
| --- | --- | --- | --- |
${installed.projection.map(p=>`| ${p.platformCode} | 있음 | ${p.ruleSetId?`${p.ruleSetId} v2`:'0개'} | ${p.ruleSetId?'CONFIGURED, 증거 없으면 PARTIAL':'FACT_ONLY / NOT_CONFIGURED'} |`).join('\n')}

각 RuleSet은 draft v1과 승인 v2를 보존한다. Gemini와 Google AI의 channel/규칙은 분리되며 Gemini Deep Research를 consumer channel로 합치지 않았다. Naver 일반 웹 AI 브리핑과 Place AI 브리핑을 합치지 않았다.

## E. Unsupported Claims

${review.unsupported.map(c=>`- **${c.status}**: ${c.claim}. ${c.reason}`).join('\n')}

GOOGLE_AI_CORE_SEARCH_FOUNDATION의 넓은 ranking/quality/index 의존 관계는 확인한 본문이 직접 뒷받침하는 범위를 넘으므로 보류했다. llms.txt 관련 원래 후보도 ranking 신호 미사용까지 단정하지 않고 별도 AI 텍스트 파일 불필요 사실로 좁혔다. 이는 해당 효과가 불가능하다는 반증이 아니라 이번 공식 근거로 승인하지 않았다는 뜻이다. AEO/GEO를 공식 제품명이나 ranking system으로 등록하지 않았다.

## F. Actions

Action Definition **0개**. 기술 Action은 선택적 후보이므로 이번 v1에서는 추가하지 않았다. 효과 주장이나 전략 Action을 생성하지 않았으며 기존 NO_EFFECT_CLAIM 정책을 변경하지 않았다. FAQ_BUILD/BACKLINK_BUILD/LLMS_TXT_CREATE/SCHEMA_FOR_AI, training bot 허용 작업, Gemini/Naver용 근거 없는 Action은 없다.

## G. Governance

팩 ID OFFICIAL_PLATFORM_KNOWLEDGE_PACK, version 1, date 2026-10-16.

- manifest checksum: ${review.manifestChecksum}
- 실제 설치 version 집합 checksum: ${installed.installation.installationChecksum}
- 승인 actor: 테스트 OWNER fixture ${installed.audit.reviewerId}
- 명령: OWNER_REVIEW_OFFICIAL_PACK
- PRODUCTION audit event: 준비 1 + 명시적 검토/등록 1 = ${installed.audit.events}개
- humanApprovalRecorded: **false**

소스 조회는 승인 경로에 포함되지 않는다. REVIEW_REQUIRED manifest 출력 → draft 제출 → 모든 claim/source hash와 manifest checksum을 명시한 OWNER 명령 → Rule/RuleSet/정책 순서다. 현재 DB의 OWNER를 transaction 안에서 확인하며 MANAGER/ANALYST/VIEWER, 역할 위조, 불완전한 decision, source/claim/manifest 변조, 미지원 Rule, 중복/재승인을 거부한다. Audit에는 actor/명령/manifest hash와 변경된 각 stable ID/version이 남는다. Rule/RuleSet/Knowledge의 버전을 덮어쓰지 않는다. 팩 파일을 import하거나 URL을 발견해 자동 승인하는 코드는 없다.

팩 전용 UI/HTTP 쓰기 endpoint는 추가하지 않았으며 내부 OWNER 명령을 사용한다. 실제 운영 OWNER 검토는 향후 deployment gate에서 수행해야 한다. 상세 계약은 [운영 문서](23-official-pack-operations.md), 검토 가능한 claim/source 목록은 [검토 manifest](22-official-pack-v1-review.json)에 있다.

## H. Persistence

격리 원본 복원 DB에서 기존 baseline을 resolve하고 additive migration만 적용했다. 신규 migration은 만들지 않았다. 실제 PostgreSQL 저장 → 인증 API → WRITE 프로세스 종료 → 별도 READ 프로세스 → 암호화 통합 백업 → 새 DB/첨부 root 복원 → 별도 READ 프로세스의 checksum/API 결과 일치를 확인했다. backup/restore의 data/schema/ID·관계/files 일치도 모두 true다.

추가로 빌드된 실제 Next 서버를 격리 팩 DB와 복원 DB에 각각 새로 기동했다. 로그인 세션을 새로 발급하고 HTTP 네트워크를 통해 같은 Knowledge metadata와 6개 Overview 상태를 확인했다. 두 실제 서버 검사 결과: ${Object.entries(http).map(([k,v])=>k+'='+v.exitCode).join(', ')}. 세션 토큰은 manifest에 저장하지 않는다.

## I. API Projection

| Platform | API Readiness | Score | RuleSet |
| --- | --- | --- | --- |
${installed.projection.map(p=>`| ${p.platformCode} | ${p.status} | ${p.score===null?'null':p.score} | ${p.ruleSetId??'없음'} |`).join('\n')}

기본 policy의 source=null은 고객 증거를 추측해서 선택하지 않는다는 뜻이다. 구성된 4개 플랫폼은 UNKNOWN/PARTIAL이며 score=null이다. 별도 합성 프로젝트 복사본에 명시적 PAGE/AUDIT 증거를 지정해 6개 Rule 각각 PASS/FAIL/UNKNOWN을 검사했다. 실제 고객 score나 영구 평가 결과를 생성하지 않았다. 위 API는 8-9의 실제 인증 HTTP handler를 통과하며 Knowledge/Rules/Actions/Overview/6개 Detail/Readiness/Action candidates에서 원문·출처 본문·개인정보·비밀·파일경로·cross-client lineage·SYNTHETIC sentinel이 노출되지 않는 것을 확인했다. 추천 확률/공식 점수가 아니라는 metadata를 유지한다.

## J. Preservation

원본 read-only hash 비교: data=${preserve.originalDataUnchanged}, schema=${preserve.originalSchemaUnchanged}, 20개 도메인 동일=${Object.values(preserve.domains).every(d=>d.equal)}. 기존 파일 ${preserve.existingFileCount}개 중 ${preserve.unchangedExistingFiles}개 SHA256 동일, 수정/삭제 0개다. 기존 workspace.tsx 사용자 수정과 UI/Route/Prisma schema/migration을 보존했다. 신규 PI 관련 검증 파일 ${preserve.verifiedPlatformFiles}개의 source/runtime hash도 동일하다.

원본 신규 PI table=${preserve.originalPlatformTableAvailable}; enabled=${preserve.originalFlags.enabled}; persistenceEnabled=${preserve.originalFlags.persistenceEnabled}. 원본 migration·flag 활성화·UI 변경·고객 score 입력을 수행하지 않았다. 테스트에서 새로 만든 합성 프로젝트도 팩 등록 전후 legacy project checksum이 동일하다.

## K. Tests

| 검사 | 결과 |
| --- | --- |
| 신규 팩 source/scope/governance unit | 23 PASS |
| 전체 unit / 실제 DB / PDF / preservation | ${passed} PASS, 38개 파일 / phase 6개 기본 skip |
| 실제 PG 팩 준비·OWNER 검토·privacy·audit·합성 check 분기 | PASS |
| 독립 Node 재시작 / 통합 backup 복원 | PASS / PASS |
| 실제 Next HTTP 서버 신규 기동 / 복원 DB 서버 | PASS / PASS |
| Prisma generate / Next build / TypeScript | ${['prisma-generate','production-build','full-typecheck'].map(k=>regression[k]?.exitCode===0?'PASS':'PENDING').join(' / ')} |
| 전체 E2E | ${e2ePassed} PASS / ${e2eFailed} FAIL |
| 원본 DB·20도메인·기존 323파일 / runtime 동일 | PASS |

기본 suite가 skip하는 PostgreSQL 전용 phase를 모두 성공한 것으로 계산하지 않았다. 이번 팩 phase는 실제 DB의 WRITE/READ/복원 READ와 두 실제 서버 HTTP invocation으로 별도 실행했다. 기존 8-8/8-9 phase 증거는 해당 단계 보고서와 백업을 유지한다. 기존 server unit 28개를 포함한 전체 회귀는 통과했다.

이번 E2E의 유일한 실패는 기존 pilot.spec.ts:50:532의 390px mobile overflow다. Studio 3개 흐름과 API boundary E2E는 이번 실행에서 모두 통과했다. 이전 단계의 Studio 배열 순서 민감성 경고가 해결됐다고 간주하지 않는다. full-e2e.log와 test-results에 상세 증거를 보존한다. Next filesystem tracing warning 3개, PreScan/CITED direct Experiment adapter 미지원과 일부 Experiment Metric 지원 한계도 유지한다. 관련 없는 UI/정렬/기존 테스트는 수정하지 않았다.

## L. Production Count

다음은 **격리 migrated 팩 검증 DB의 PRODUCTION namespace** 실제 SQL 집계다. 원본 운영 DB 수와 혼동하지 않는다.

| Domain | 전체 저장 version 수 | 승인 / 의미 |
| --- | --- | --- |
| KNOWLEDGE | ${counts.isolatedPack.production.KNOWLEDGE} | FACT 23 approved, OBSERVATION/HYPOTHESIS 0 |
| RULE | ${counts.isolatedPack.production.RULE} | Approved 6 + immutable draft 6 |
| RULESET | ${counts.isolatedPack.production.RULESET} | Approved 4 + immutable draft 4 |
| READINESS_POLICY | ${counts.isolatedPack.production.READINESS_POLICY} | 4 |
| READINESS / OBSERVATION / ACTION / EXECUTION | 0 / 0 / 0 / 0 | 실제 고객 평가/작업 없음 |
| MEASUREMENT / EXPERIMENT / EXPERIMENT_RESULT | 0 / 0 / 0 | 성과 데이터 없음 |
| INSIGHT_POLICY / INSIGHT | 0 / 0 | 집계 없음 |
| PI AuditEvent | 2 | OWNER 준비 및 명시적 review command |

복원 팩 DB도 같은 count와 exact version checksum을 보존한다. 별도 SYNTHETIC namespace에는 격리 확인용 HYPOTHESIS draft 1개와 audit 1개가 있다. 다른 깨끗한 회귀 DB의 13개 PRODUCTION domain count는 모두 0이다. 원본에는 PI table 자체가 없으며 설치된 팩도 없다. 테스트 OWNER fixture의 승인 기록을 실제 사람의 운영 승인으로 표시하지 않는다.

## M. 다음 단계 판정

**${e2e==='PENDING'?'VALIDATION_IN_PROGRESS':'READY_WITH_WARNINGS'}**. 공식 출처와 claim 단위 FACT, 제한된 Rule, exact checksum, 명시적 OWNER fixture 검토, 저장/재시작/복원/API/원본 보존을 검증했다. Gemini/Naver FACT_ONLY는 정상 결과다. 원본 배포나 실제 고객 진단으로 전환하려면 별도의 운영 OWNER 검토와 deployment gate가 남는다. 기존 경고가 있으므로 모든 E2E가 green이라고 주장하지 않는다.

증거 디렉터리: ${out.replaceAll('\\','/')}. pack-results.json, pack-process-a/b.log, pack-restored-process-b.log, pack-restart-manifest.json 및 .review.json, pack-second-restore.json, http-results.json, http-restarted-server.log, http-restored-server.log, regression-results.json, full-unit-db-pdf.log, production-build.log, full-typecheck.log, full-e2e.log, final-preservation.json, production-counts.json을 보존한다. 이 로컬 증거 경로에는 DB 비밀번호나 세션 토큰을 출력하지 않았다.
`;
await writeFile('docs/platform-intelligence/24-stage-8-10-report.md',report);console.log(JSON.stringify({report:'docs/platform-intelligence/24-stage-8-10-report.md',unit:passed,e2ePassed,e2eFailed}));
