# AEO Intelligence OS 개발 규칙

- 사용자 요청과 docs/PRD.md를 기준으로 MVP를 유지한다.
- 관측 사실과 개선 가설을 구분한다. 추천 순위 또는 인과를 보장하지 않는다.
- 원문은 불변으로 보존하고 분석 버전을 기록한다.
- DEMO / MANUAL_UI / API 유형을 혼합 집계하지 않는다.
- 모든 데이터 조회·수정은 소속 프로젝트를 검증한다.
- 외부 요청은 src/lib/audit.ts의 안전한 전송만 사용한다. DNS 검증 후 IP를 고정하고 각 리디렉션을 재검증한다.
- 키, 실제 개인정보, .env, 로컬 데이터 파일은 Git에 추가하지 않는다.
- 타입 검사, 단위 테스트, 핵심 흐름 테스트 및 빌드를 실행한다. 미검증 사항은 명시한다.
- 이 버전은 로컬 단일 사용자용이다. 인증·권한·감사로그 없이 공개 서비스로 배포하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
