# Platform Intelligence 8-8 — Operational Deployment Checklist

현재 상태는 로컬 구현·격리 검증이며 원본 DB migration이나 공개 배포를 수행하지 않았다. UI/API는 기존 상태를 유지한다.

## 대상 DB에 적용하기 전

1. 실제 대상의 DB identity, PostgreSQL/Prisma 버전, 현재 schema와 migration history를 확인한다. 이 작업의 복원 대상과 운영 대상을 혼동하지 않는다.
2. DB·첨부·브랜드·참조를 포함한 암호화 통합 백업을 만들고, 새 DB와 첨부 root로 복원해 hash/ID/FK/파일 참조를 확인한다. 키와 백업은 저장소 밖의 보호된 위치에 둔다.
3. `16-migration-baseline.md`에 따라 현재 schema가 legacy baseline과 일치하는지 확인한다. drift나 예상하지 않은 history가 있으면 먼저 그 차이를 해결한다.
4. 별도 복원 DB에서 baseline resolve → 신규 migration deploy 또는 빈 DB deploy를 실행하고 기존 테이블 hash·DDL을 확인한다. 원본에 reset/db push로 맞추지 않는다.
5. 쓰기를 잠시 정지한 유지보수 구간에서 승인된 실제 대상만 migration한다. baseline/기존 부분 migration applied 표시와 신규 additive deploy를 구분한다. 이 문서 작성 중에는 이 운영 단계를 실행하지 않았다.

## 활성화

기본값은 꺼짐이다. PostgreSQL과 다음 두 환경변수가 모두 필요하다.

```dotenv
STORAGE_MODE=postgres
PLATFORM_INTELLIGENCE_ENABLED=true
PLATFORM_INTELLIGENCE_PERSISTENCE_ENABLED=true
```

file 모드는 `PERSISTENCE_UNAVAILABLE`, 하나라도 flag가 없으면 `PERSISTENCE_DISABLED`, schema가 없으면 `PERSISTENCE_SCHEMA_UNAVAILABLE`로 실패한다. 메모리 fallback이나 자동 migration은 없다. flags를 켜는 것만으로 기존 UI가 이 adapter를 호출하지는 않는다. 8-9에서 인증된 서버 경로와 기존 화면의 안전한 DTO 연결을 따로 구현해야 한다.

## 승인 전 검증

- 실제 승인된 정의를 등록하기 전 PRODUCTION Knowledge/Rule/RuleSet/Action/Experiment/Insight와 정책 수가 0인지 확인한다. fixture를 운영 seed로 옮기지 않는다.
- 정확한 actor와 project 권한으로 전체 저장 흐름, stale revision, 동시 쓰기 충돌, transaction rollback, approved overwrite 거부를 확인한다.
- Process A 종료 → 별도 Process B 조회에서 동일 ID/version/checksum/lineage를 확인한다. 서버 프로세스 메모리를 공유한 검사는 재시작 증거가 아니다.
- 신규 두 테이블과 migration history가 통합 백업·새 DB 복원에 포함되는지 확인한다. 현재 Consent 철회와 source 수정 후 과거 결과가 숨겨지는지 확인한다.
- 전체 단위/DB/PDF/보존 검사, Prisma generate, Next build, typecheck, E2E를 수행한다. 기존 warning을 성공으로 덮어 쓰지 않는다.

## 복구와 운영

오류 시 flags를 비활성화하고 쓰기를 중단한다. schema를 파괴적으로 되돌리는 대신 승인한 pre-deployment backup을 새 DB/첨부 root로 복원해 검증한 뒤 연결을 전환한다. 기존 source와 실패 DB는 증거 보존 정책에 따른다. 독립 백업 복원은 실제 수행했고, 운영 연결 전환은 수행하지 않았다.

모든 audit/revision/ID/checksum과 STALE·SYNTHETIC 표시를 후속 UI에서 유지한다. DB 관리 계정으로 adapter를 우회하는 일상 쓰기를 허용하지 않는다. 기존 PreScan/CITED 직접 실험 adapter, 일부 Metric 한계, Pilot mobile overflow와 Studio 순서 민감성은 별도 개선 항목이다.
