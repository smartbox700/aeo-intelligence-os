# Platform Intelligence 8-8 — Migration Baseline

원본 DB는 이 작업 전체에서 read-only다. 원본에 migrate deploy/resolve, db push, reset을 실행하지 않았다. 아래 절차는 백업에서 만든 `aeo_restore_test_*` DB와 별도 첨부 root에서 검증했다.

## 확인한 상태

기존 Prisma schema와 복원 DB DDL의 diff는 비어 있다. 원본은 legacy 18개 테이블이 있고 `_prisma_migrations`가 없다. 기존 `20261008_stage5`는 전체 최초 schema가 아닌 부분 migration이므로 이것만으로 빈 DB를 만들 수 없었다.

전체 legacy schema에서 생성한 `0_legacy_baseline/migration.sql`을 먼저 배치했다. 기존 부분 migration은 수정하지 않는다. `migration_lock.toml`은 PostgreSQL을 지정한다. 새 `20261015_platform_intelligence`는 두 sidecar 테이블과 그 CHECK/FK/index만 추가한다. 기존 물리 컬럼이나 고객 테이블을 바꾸지 않는다.

Prisma 6.19.3의 `migrate diff --from-empty --to-schema-datamodel`로 baseline을 만들었다. CLI의 업데이트 안내가 SQL 뒤에 섞인 첫 산출물은 빈 DB 배포 검사에서 실패했고, 안내문을 제거한 SQL로 다시 검증해 통과했다. 실패 실험은 별도의 빈 DB에만 남겼으며 원본이나 정상 복원 DB의 migration history를 조작해 덮지 않았다.

## 두 가지 적용 경로

**현재 데이터가 있는 복원 DB:** legacy schema/DDL diff가 없는지 먼저 확인한 다음, baseline과 이미 실현된 부분 migration을 applied로 resolve한다. 이후 새 migration을 deploy한다.

```powershell
# DATABASE_URL이 승인된 복원/대상 DB인지 먼저 검증한다.
npx prisma migrate resolve --applied 0_legacy_baseline
npx prisma migrate resolve --applied 20261008_stage5
npx prisma migrate deploy
```

**빈 새 DB:** resolve 없이 `prisma migrate deploy`만 실행한다. baseline → 기존 부분 migration → 신규 sidecar migration 순서로 적용된다. 빈 DB 배포 후 Prisma schema와 datasource diff는 비어 있다. 기존 부분 migration의 idempotent 조건 덕분에 baseline에 이미 존재하는 대상을 다시 생성하지 않는다.

이 SQL 적용 이력을 이미 사용 중인 다른 환경이 있다면 그 환경의 실제 schema와 migration history를 따로 확인해야 한다. 위 resolve를 불일치 환경에 일괄 실행해서는 안 된다. 적용한 migration 파일은 이후 수정하지 않는다.

## 보존과 복구

복원 DB migration 전후 legacy 18개 테이블의 row hash, columns, indexes, constraints를 비교해 동일함을 확인했다. 새 PI 두 테이블과 `_prisma_migrations`만 추가된다. 원본은 작업 시작·종료의 전체 data/schema hash 및 20개 도메인으로 별도 비교한다.

롤백은 운영 원본에서 DROP/역방향 SQL을 실행하는 방법이 아니다. 배포 전 암호화 통합 백업을 새로운 DB/첨부 root로 복원하고 read-only 검증 후 연결을 전환하는 절차다. 이번 검사에서는 legacy 백업으로 새 복원 DB를 생성하는 복구 경로와, PI가 포함된 백업의 새 DB 복원을 모두 실행했다. 파일 참조·ID·관계·전체 data/schema checksum이 일치해야 한다.

재현 도구는 `scripts/validate-platform-persistence.mjs`다. 보호된 `output/stage7-5/platform-8-8-current.json`이 가리키는 backup에서 매번 새 격리 DB를 만들고, 원본 DB와 같은 이름이거나 허용되지 않은 접두사면 중단한다. 실제 운영 적용은 아직 실행하지 않았다.

공식 근거: [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining), [Prisma 6 CLI reference](https://www.prisma.io/docs/orm/v6/reference/prisma-cli-reference). 설치된 6.19.3 CLI와 실제 격리 DB 결과를 기준으로 검증했으며 major version upgrade는 하지 않았다.
