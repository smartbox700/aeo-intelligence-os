# 개발자 인수인계

이 저장소는 AEO Intelligence OS의 최신 소스와 Platform Intelligence, 격리 수동 사용성 테스트 도구를 포함합니다. **실제 운영 서버 배포는 완료하지 않았습니다.** 실제 Production target과 OWNER 인증은 미확인 상태이며 실제 고객 Pilot은 시작하지 않았습니다.

## 먼저 읽을 문서

1. [프로젝트 실행과 기능](../README.md)
2. [개발 규칙](../AGENTS.md)
3. [로컬 PostgreSQL·백업 운영](DB_OPERATIONS.md)
4. [가상 데이터 실사용 테스트 실행](platform-intelligence/37-manual-usability-guide.md)
5. [실사용 테스트 검증 결과](platform-intelligence/39-manual-usability-report.md)
6. [사용자 피드백 양식](platform-intelligence/38-manual-usability-feedback.md)
7. [배포 전 검증과 승인 대기 결과](platform-intelligence/34-stage-8-12-report.md)
8. [운영 대상 확인 중단 사유](platform-intelligence/36-stage-8-13a-report.md)

## 테스트와 실행

의존성은 lockfile에 맞춰 설치하고 `.env.example`을 참고해 개발자 본인의 로컬 DB를 설정합니다. 환경 파일·비밀번호·실제 DB·암호화 백업·키는 이 저장소에 포함하지 않습니다. 로컬 PostgreSQL 준비 방법은 DB 운영 문서를 확인하세요.

개발자의 로컬 reference DB 연결이 준비된 다음 프로젝트 루트에서 실행합니다.

```powershell
npm run pi:manual-test:setup
npm run pi:manual-test:start
```

이 명령은 별도 `aeo_manual_usability_test` DB와 무시되는 `output/manual-usability/runtime` 앱 사본을 사용합니다. 기본 주소는 `http://127.0.0.1:3013/os?view=platform-intelligence`, 사용자 이름은 `manual-owner`입니다. 임시 비밀번호는 시작한 터미널에만 표시됩니다. 운영 계정·DB를 사용하지 마세요. 종료는 Ctrl+C입니다.

```powershell
npm run pi:manual-test:scenario -- all
npm run pi:manual-test:reset
```

시나리오 전환과 초기화 전에 서버를 종료합니다. 테스트 fixture는 일반 앱 코드에 설치하지 않고 격리 사본에서만 실행합니다. 테스트 runtime을 운영 배포 대상으로 사용하면 안 됩니다.

## 현재 검증 결과와 남은 사항

- 단위·실DB·PDF 461 PASS, 특수 phase 9 SKIP.
- 일반 앱 production build·타입 검사 PASS.
- 일반 앱 전체 E2E 16 PASS / 기존 2 FAIL / 시나리오 전용 6 SKIP.
- 기존 실패: Pilot 390px horizontal overflow, Studio task 배열 순서 비교 민감성.
- Manual 브라우저 initial/all/negative/zero/insufficient 각 PASS. 자동 외부 요청 0, PI 390px overflow 0.
- Gemini/Naver는 FACT_ONLY이며 Readiness RuleSet이 없습니다. 증거 없음은 null이며 0점으로 대체하지 않습니다.
- 실제 운영 migration·Pack human approval·flags 활성화·고객 Pilot은 미실행입니다. `humanApprovalRecorded=false`입니다.

기존 배포 gate 이후 package/scripts 변경이 있으므로 향후 실제 운영 배포에는 최신 코드에 대한 gate 재검증이 필요합니다. 기존 8-12의 승인 대기 결과를 새 커밋의 배포 승인으로 재사용하지 않습니다.

## 포함하지 않은 것

로컬 `.env`, DB 파일, 실제 고객 자료, 첨부, 백업·암호화 키, 세션, `node_modules`, 생성 Prisma client, 빌드 및 실행 결과물은 전달하지 않습니다. 의존성과 Prisma client는 각 개발 환경에서 설치·생성합니다. 상세 실행 증거는 로컬 보호 경로에 있으며 Git 저장소에는 검증 보고서만 포함합니다.
