# Official Platform Knowledge Pack v1 — 검토와 등록

이 릴리스는 `OFFICIAL_PLATFORM_KNOWLEDGE_PACK` v1, 기준일 2026-10-16이다. 공식 출처 10개, FACT 23개, 제한된 내부 점검 Rule 6개와 RuleSet 4개를 정의한다. 자동 운영 seed가 아니며 기존 productionKnowledge/productionRules/productionRuleSets의 기본 빈 배열을 유지한다.

팩 정의는 `src/lib/platform-intelligence/official-pack/manifest.ts`, 명시적 승인 경계는 같은 폴더의 `governance.ts`에 있다. 사람이 확인할 claim·출처·해시·제외 목록은 [검토 manifest](22-official-pack-v1-review.json)에 보존한다. 출처 본문을 복제하지 않고, 내부 요약의 canonical JSON SHA256를 excerptHash로 사용한다. 이는 공식 사이트가 서명한 본문 해시라는 뜻이 아니다. sourceDate는 확인 가능한 문서의 업데이트 날짜만 기록하며 나머지는 null이다.

1. `reviewManifest()`는 REVIEW_REQUIRED 문서를 반환한다. 조회나 URL 발견은 승인 동작이 아니다.
2. 인증된 내부 호출자가 `prepareDrafts(identity, expectedRevision)`를 실행하면 PRODUCTION namespace에 Knowledge draft를 만들고 REVIEW_REQUIRED로 제출한다. 승인된 FACT나 Rule은 아직 없다.
3. OWNER는 각 claim과 연결된 공식 문서, 플랫폼/channel, source hash, draft checksum, 유한한 검토 기한을 검토한다. URL의 공식 도메인 여부만으로 claim의 진실성을 판정하지 않는다.
4. 검토 결과를 별도 `OWNER_REVIEW_OFFICIAL_PACK` 명령에 넣는다. 입력은 manifestChecksum, expectedRevision, reason, decisions, ruleIds다. decisions에는 모든 Knowledge의 knowledgeId/version/draftChecksum/sourceExcerptHash/decision을 명시한다. 중복·누락·변조된 해시·지원하지 않는 Rule을 거부한다. 실제 reviewer와 시각은 현재 DB의 OWNER와 서버 시각으로 정하며 클라이언트 reviewer 필드는 받지 않는다.
5. `ownerReview(identity, command)`는 현재 OWNER 권한을 재검사하고 FACT 승인 → Rule draft v1/승인 v2 → RuleSet draft v1/승인 v2 → Readiness 정책을 한 transaction으로 저장한다. 중간 실패는 전체 rollback이다. 기존 Rule/RuleSet version을 덮어쓰지 않는다. Knowledge exact version의 승인 checksum을 Rule에 고정한다.
6. 감사 이벤트에는 실제 actor, 명령, stable ID/version별 변경 내역, manifest checksum이 포함된다. 저장 record와 감사 체인은 기존 PostgreSQL repository에서 함께 검증한다. 재승인·동일 version 덮어쓰기를 거부한다.
7. `packState(session)`의 installationChecksum과 각 version checksum을 인증 API, 별도 프로세스, 암호화 통합 백업·복원 뒤 비교한다. manifest checksum은 검토한 릴리스 내용, installation checksum은 reviewer/시각까지 포함된 실제 저장 version 집합을 식별한다.

팩 전용 브라우저 승인 endpoint나 UI는 추가하지 않았다. 위 명령은 내부 서버 모듈의 OWNER 경계다. 테스트가 decisions를 구성하는 코드는 명확한 테스트 fixture이며 실제 사람의 검토를 대체하지 않는다. 검토 JSON의 humanApprovalRecorded=false는 의도적이다. 실제 배포에는 별도 사람이 검토한 OWNER 명령과 deployment gate가 필요하다.

기본 Readiness 정책의 source=null은 고객 증거를 자동 선택하지 않는다는 의미다. 팩만 설치하면 ChatGPT/Google AI/Claude/Perplexity는 구성된 PARTIAL 상태와 UNKNOWN 점검, null score로 표시된다. 증거를 명시적으로 선택한 합성 평가에서만 PASS/FAIL/UNKNOWN을 검증했다. robots 점검은 제공된 robots 판정에 한정되며 WAF/IP 허용, 실제 크롤링·색인·snippet 자격 전체를 증명하지 않는다. Google noindex는 HTML_AND_HEADER 범위를 사용하며 헤더 증거가 없으면 UNKNOWN이다. 텍스트 유무는 콘텐츠 품질 평가가 아니다.

모든 weight는 내부 동일 가중치 1이다. 공식 ranking weight나 추천·인용 확률이 아니다. Gemini와 네이버 AI는 FACT_ONLY이며 RuleSet/Action을 만들지 않는다. Google Search 규칙을 Gemini로 복사하거나 Yeti/Place 조건을 AI 브리핑 일반 규칙으로 옮기지 않는다. Action은 v1에서 0개로 유지한다.

출처 검토일은 2026-10-16, reviewDueAt은 30일 후, expiresAt은 90일 후다. 이 기한은 내부 운영 정책이며 플랫폼의 공식 주장으로 저장하지 않는다. 문서가 바뀌면 새 source 검증과 새 immutable Knowledge/Rule/RuleSet version을 검토한다. SOURCE_URL_REQUIRED 후보는 승인하지 않으며, 이번 팩의 등록된 출처는 모두 정확한 canonical HTTPS URL을 직접 확인했다.

검증 스크립트는 원본 백업을 보호된 외부 경로에 보존한 뒤 `aeo_restore_test_` DB만 복원·migrate한다. `validate-platform-8-10.mjs pack`은 OWNER 검토·별도 Node 프로세스·통합 backup/restore를, `regression`은 분리된 소스 복사본과 다른 DB에서 전체 회귀를 실행한다. `validate-platform-8-10-http.mjs`는 빌드된 Next 서버를 격리 팩 DB와 복원 DB에 각각 새로 띄워 실제 네트워크 API를 확인한다. `platform-8-10-final-proof.mjs`는 원본의 읽기 전용 보존 검사와 격리/복원/깨끗한 DB의 count를 구분한다. 원본 migration·flags·UI는 이 단계에서 변경하지 않는다.
