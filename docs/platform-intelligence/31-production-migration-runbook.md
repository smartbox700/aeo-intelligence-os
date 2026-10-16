# 8-12 승인 후 운영 적용 절차 — 현재 실행 금지

현재 원본 DB에는 baseline resolve 또는 PI migration을 실행하지 않았다. Flags는 OFF, 사람 승인은 미기록 상태다. 아래는 사람 OWNER 승인 후 별도 작업에서 사용할 절차다. 검증된 로컬 단일 사용자 환경을 대상으로 하며 공개 서비스 운영 승인을 뜻하지 않는다.

1. 사람 OWNER가 정확한 artifact·Pack·Known Risks·복구 경로를 검토하고 별도 deployment approval record와 감사 이벤트를 기록한다. 테스트 OWNER 승인이나 브라우저 boolean은 대체할 수 없다.
2. 유지보수 시간, 트래픽·쓰기 중지, 담당자, 중단 기준을 확정한다. 최종 백업 전에 새 쓰기를 차단한다.
3. 운영 연결 설정을 보안 채널에서 확인한다. URL·비밀번호·키·세션 토큰을 명령 출력이나 보고서에 기록하지 않는다.
4. 암호화 최종 통합 백업과 첨부 manifest를 생성하고 복호화 키를 별도 보관한다. 새 격리 DB와 파일 root 복원에서 데이터·스키마·ID·관계·파일·직원·인증 상태를 확인한다. 백업 실패 시 중단한다.
5. 배포 manifest의 코드·schema·migration·Pack checksum 및 검증 빌드 식별자를 비교한다. 변경 또는 schema drift가 있으면 이 gate는 무효다. 현재 상태의 백업 clone에 동일 절차를 다시 리허설한다.
6. migration 이력이 없는 기존 18개 테이블의 정확한 기준 상태를 확인한다. 이번에 검증한 상태에 한해 `prisma migrate resolve --applied 0_legacy_baseline`, 이어 `prisma migrate resolve --applied 20261008_stage5`를 사용한다. 이미 적용된 이력은 재표시하지 않는다. 상태가 다르면 중단하고 조사한다.
7. 검토한 migration만 포함된 artifact에서 `prisma migrate deploy`를 실행한다. 이 단계가 PI 두 테이블을 추가한다. 실패하면 flags OFF로 유지하고 해당 DB를 PI 운영에 사용하지 않는다. 실패 이력을 임의로 성공 처리하지 않는다.
8. 기존 18개 테이블의 데이터·PK·FK·열·인덱스·제약조건을 백업 직전 상태와 비교한다. 추가 테이블은 PI Record/Audit와 migration bookkeeping뿐이어야 한다.
9. `prisma migrate diff --from-url <보안 설정> --to-schema-datamodel prisma/schema.prisma --script --exit-code`의 결과가 empty/exit 0인지 확인한다. 비밀 URL을 shell history에 직접 입력하지 않는 승인된 실행기를 사용한다. ALTER/DROP 또는 diff가 있으면 중단한다. 재배포 no-op도 확인한다.
10. 검증된 앱 artifact를 배포하고 PI의 두 flags는 계속 OFF로 둔다. 로그인, 기존 Workspace·PreScan·Consumer·CITED·Reports·Pilot·Studio 및 첨부 접근을 점검한다.
11. 사람이 공식 URL과 FACT 23·Rule 6·RuleSet 4·정책 4·미지원 주장을 다시 검토한다. reviewDue 이후면 공식 출처 재검증 전 활성화 금지, expiry 이후도 금지한다. Pack draft 생성과 검토는 명시적인 OWNER 작업이며 자동 seed/승인하지 않는다.
12. 사람의 Pack 결정과 별도 운영 승인 audit를 검증한다. 현재 `HUMAN_REVIEW_DECISION`은 PENDING template이며 실행 가능한 승인 명령이 아니다. 실제 기록 절차를 마련하고 검증하기 전 활성화하지 않는다.
13. 담당 직원과 1개 승인 고객으로 범위를 제한해 flags를 통제 활성화한다. Pack 0 및 검토된 Pack의 여섯 상태, null score, 권한, 감사로그, privacy를 smoke test한다.
14. Pilot 체크리스트의 동의·접근·관측 계획·증거·복구 조건을 모두 사람이 확인한 뒤 별도 단계에서 시작한다. 외부 자동 질문이나 고객 사이트 변경은 이 절차에 포함되지 않는다.

중단 조건: checksum 불일치, 백업·복원 불일치, legacy 변경, schema diff, failed migration, 권한/개인정보 실패, 새 회귀 실패, Pack 검토기한 경과, 실제 승인 기록 부재. DB down/drop 대신 verified backup을 새 DB로 복원하고 통제된 연결 전환을 사용한다.
