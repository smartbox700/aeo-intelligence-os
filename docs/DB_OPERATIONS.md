# 로컬 개발 DB 운영 · 7-1 / 7-5단계

## 7-5 통합 암호화 백업 (현재 기본 명령)

`npm run db:backup`은 이제 `scripts/integrated-backup.mjs`를 실행한다. 아래 7-1의 gzip 설명은 **기존 비암호화 DB 전용 형식**이며 `npm run db:backup:legacy`에서만 사용한다. 기존 백업은 삭제하거나 암호화된 것으로 표시하지 않는다.

DB public 일반 테이블, DB에 이미 포함된 PDF 바이너리·원본, DB가 참조하는 `pilot-documents`와 `evidence`, 존재하는 `sales-brand.json`을 AES-256-GCM으로 암호화한다. DB PDF를 별도 파일로 중복 복제하지 않는다. 인증된 내부 manifest에 백업 시작/종료 시각, 파일 경로·바이트 수·SHA-256, 프로젝트/자료 ID 연결, DB 행·관계·스키마 해시를 저장한다. 없는 회사 설정은 없음으로 보존하고 참조 없는 파일은 개수만 기록하며 삭제하지 않는다.

파일 기본 루트는 `data`, 격리 실행에서는 `AEO_FILES_ROOT`를 지정한다. 백업은 저장소와 파일 저장소 밖 `%LOCALAPPDATA%/AEOIntelligenceOS/backups`에 둔다. 키는 별도 `backup-keys/integrated.key`에 생성하며 `AEO_BACKUP_KEY_FILE`로 기존 32바이트 키를 지정할 수 있다. Windows는 현재 사용자/SYSTEM 전용 ACL, 다른 OS는0700/0600을 적용한다. 키 바이트를 로그·명령 인수·백업에 넣지 않는다. **키를 잃으면 복원 불가**다. 기본 키와 백업이 같은 PC에 있으므로 디스크 분실·동일 계정 침해 대비에는 키를 별도 안전한 장소와 분리 보관하고 암호화 사본을 다른 매체에 보관해야 한다. 외부 반출/자동 스케줄은 아직 실행하지 않았다.

백업은 앱 writer 공통 advisory lock742910을 먼저 확보한 뒤 REPEATABLE READ READ ONLY 트랜잭션을 연다. 회사 설정 쓰기도 이 잠금을 공유한다. 첨부는 UUID 불변 파일이며 DB 연결 확정은 잠금 내에서 이루어진다. 복사 전후 실제 파일 바이트와 모든 DB 참조 해시를 재검사하고 불일치하면 백업을 실패시킨다. 수동 파일 수정·DB 직접 쓰기·외부 프로세스는 이 잠금을 따르지 않으므로 백업 중 금지하고 유지보수 시간에는 중지한다. 증빙 업로드 대기 중의 미연결 파일은 고객 자료로 간주해 임의 삭제하지 않는다.

`npm run db:restore:test`는 새 백업을 만든 후 새 UUID DB와 별도 `restore-tests/<DB>/files`에 복원한다. 기존 암호화 파일은 `npm run db:restore:test -- 'C:\\전용백업\\integrated-....aeo.enc'`로 지정한다. GCM 인증, 경로·중복·참조·해시를 먼저 확인하고 DB 전체 행/ID/FK/스키마와 실제 파일 바이트를 비교한다. 원본 DB/파일에 복원하지 않는다. 실패·성공 결과와 격리 자료는 보호된 `restore-result.json`과 함께 보존하며 자동 DROP/삭제하지 않는다. 이전 gzip은 `node scripts/db-admin.mjs restore-test <기존파일>`로 검증한다.

복원 자료의 고객별 접근은 DB의 StaffUser 배정과 API 권한 검사를 그대로 사용한다. 파일 저장소를 public에 노출하거나 OS 폴더 접근을 고객 권한으로 대체하지 않는다. 실운영 사용자는 기본 개발 계정이 아닌 개별 계정으로 배정한다.

스케줄러 미등록. 등록 전 백업 주기·용량·보존 기간·암호키 책임자·실패 알림·외부 사본 보관을 사용자와 확정하고 승인을 받는다. 현재 논리 백업의 지원 스키마 제한은 아래와 동일하다. 역할/서버 설정/확장까지 필요한 다른 환경 운영에는 공식 pg_dump와 별도 인프라 복원 절차가 추가로 필요하다.

## 설정과 영속 데이터

현재 Windows에는 embedded-postgres 패키지가 제공하는 PostgreSQL 18 계열 서버가 있다. 별도 시스템 PostgreSQL 설치나 Windows 서비스 설치는 수행하지 않았다. 실행 바이너리는 사용자 영역 `%LOCALAPPDATA%\AEOIntelligenceOS\postgres-native-18.4`, 기본 데이터는 `%LOCALAPPDATA%\AEOIntelligenceOS\postgres\development`에 둔다. 바이너리/데이터 경로는 Windows PostgreSQL에서 사용 가능한 ASCII 경로를 사용한다. 비ASCII 사용자 경로라면 `AEO_STATE_DIR`과 `AEO_PG_DIR`을 ASCII 사용자 전용 경로로 설정한다.

연결은 기존 `.env` 또는 프로세스의 `DATABASE_URL`에서 사용자·비밀번호·DB·포트를 읽는다. 비밀번호를 코드에 두지 않는다. `AEO_DB_ENV=development`를 개발 환경 식별에 사용할 수 있다. `production`이면 개발 서버 실행기/로컬 이전을 거부한다. 운영 DB는 별도 인프라·자격증명·승인 절차로 관리한다. 현재 도구는 로컬 loopback만 허용한다.

선택 설정:

| 설정 | 용도 |
|---|---|
| AEO_STATE_DIR | 데이터/도구 기본 루트, 기본 `%LOCALAPPDATA%\AEOIntelligenceOS` |
| AEO_PG_DIR | 개발 클러스터 데이터 폴더. 기존 폴더를 삭제/초기화하지 않음 |
| AEO_BACKUP_DIR | 저장소 밖의 절대 백업 폴더. 기본 state 루트의 backups |
| AEO_PG_BIN | 이미 설치된 PostgreSQL bin을 사용하는 경우 |
| DATABASE_URL | 로컬 DB 연결. 로그/명령 인수에 비밀번호를 출력하지 않음 |

`node scripts/local-postgres.mjs`로 시작한다. 데이터 디렉터리는 재부팅/앱 재시작 후에도 유지된다. Windows 서비스/시스템 자동 시작 등록은 하지 않았다. 재부팅 후 이 명령을 실행한 다음 앱을 시작한다. 이미 서버가 실행 중이면 중복 시작하지 않는다. 기존 임시 클러스터가 있는데 영속 폴더가 없으면 자동으로 빈 DB를 만들지 않고 승인된 이전을 요구한다.

## 현재 DB 확인과 백업

프로젝트 루트에서 실행한다.

```powershell
npm run db:health
npm run db:backup
```

health는 실제 `SHOW data_directory`, 임시 폴더 여부, 테이블별 개수와 해시를 표시한다. URL·비밀번호·키·고객 원문은 출력하지 않는다. 백업은 `.aeo.gz`와 `.manifest.json`을 함께 만든다. Windows는 현재 사용자와 SYSTEM에만 접근을 부여하고 상속을 제거한 전용 폴더를 사용한다. Linux 계열은 디렉터리 0700/파일 0600이다. 데이터·백업·환경변수·키는 Git 제외다. 저장소 하위 백업 경로는 거부한다.

백업은 gzip 압축된 논리 아카이브다. 현재 번들에는 pg_dump/pg_restore가 없어 설치 없이 가능한 동등 절차를 구현했다. 일반 public 테이블의 열 형식·기본값·NOT NULL·PK/unique/check/FK·독립 인덱스·전체 행을 하나의 REPEATABLE READ 스냅샷에서 저장한다. 사용자 계정/세션 등 앱 테이블도 포함한다. 모든 테이블의 개수·ID 목록·전체 행 해시와 스키마/관계 해시를 manifest에 저장한다.

범용 PostgreSQL 덤프의 대체품은 아니다. sequence/view/materialized view/partition/foreign table/custom enum/domain/public routine/사용자 trigger/identity/generated 열은 지원하지 않으며 발견하면 실패한다. DB 역할·서버 설정·권한/owner·코멘트·public 외 스키마·확장 전체는 이 백업 범위가 아니다. 운영 환경이나 스키마 확장 시 공식 pg_dump와 별도 운영 절차를 마련한다. 백업 파일은 **암호화되지 않은 민감 자료**다. 현재 접근 제한을 적용했지만 외부 장치/클라우드로 복사할 때는 조직의 암호화·키 보관 정책을 적용해야 한다.

## 격리 복원과 재시작 시험

```powershell
npm run db:restore:test -- 'C:\사용자전용백업폴더\aeo-....aeo.gz'
npm run db:restart:test
```

복원은 백업 체크섬을 먼저 검증하고 새 UUID의 `aeo_restore_test_*` DB를 생성한다. 기존 DB에 복원하거나 DROP/덮어쓰지 않는다. 행 데이터·개수·모든 ID·FK/스키마/인덱스 일치 검증 후 결과 파일을 백업 옆에 보존한다. 격리 DB는 검토를 위해 남기며 자동 삭제하지 않는다. 테스트 DB 정리는 이름/소유/목적을 확인한 뒤 별도로 승인해 수행한다.

restart:test는 별도 영속 시험 폴더·임의 loopback 포트에 서버를 만들고 실제 현재 자료의 논리 복사본을 복원한다. 서버 정상 종료→재시작→전체 데이터/스키마 해시 일치를 확인하고 시험 서버만 종료한다. 원본 서버에는 영향을 주지 않는다. 남은 시험 폴더도 고객 자료의 복사본이므로 보호와 보존 기간 관리가 필요하다.

## 기존 임시 클러스터의 승인된 이전

백업/복원 일치 검증 후 사용자 승인을 받은 경우에만 실행한다.

```powershell
# 먼저 앱을 중지해 변경을 막는다. 기존 DB는 명령이 정상 종료한다.
npm run db:migrate:local -- --approved
npm run db:health
```

임시 개발 클러스터→전용 영속 루트만 허용한다. 대상이 비어 있지 않으면 덮어쓰지 않는다. 최신 백업을 다시 확보하고 정상 종료한 원본 클러스터를 복사해 같은 loopback 포트로 시작한다. 원본 디렉터리는 그대로 보존하며 데이터/스키마 해시를 비교한다. 이는 물리 이전이므로 서버 버전/기존 역할·자격증명도 유지한다. 자동 schema push/reset/migrate를 실행하지 않는다.

이전 실패 시 새 서버를 중지하고 원본 서버 재시작을 시도한다. 원본·대상·백업을 삭제하지 말고 health의 실제 폴더를 확인한다. 정상 복구가 안 되면 앱을 중지한 채 원본 폴더를 대상으로 같은 버전 pg_ctl을 사용해 시작한다. 비어 있지 않은 대상에 initdb를 다시 실행하지 않는다. 논리 복원 실패는 격리 DB에만 영향을 주며 원본은 유지된다. 체크섬/행 일치 실패는 성공으로 처리하지 않고 해당 결과를 보존한다.

## 자동 백업 제안

현재는 개발자 수동 실행이다. 실제 고객 운영 시 사용자 로그인/DB 실행 상태와 백업 보존 기간·디스크 용량을 정한 뒤 매일 백업, 주간 격리 복원, 별도 암호화 사본을 제안한다. 이번 단계에서 Windows Task Scheduler/서비스/자동 백업 스케줄을 등록하거나 변경하지 않았다.
