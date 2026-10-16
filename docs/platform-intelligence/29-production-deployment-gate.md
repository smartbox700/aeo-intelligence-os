# 8-12 Production Deployment Gate

최종 상태: **READY_FOR_HUMAN_DEPLOYMENT_APPROVAL**. 사람 승인 전 기술 검증 결과이며 운영 배포 완료가 아닙니다. 현재 로컬 단일 사용자 환경을 대상으로 합니다.

| Gate | 결과 |
|---|---|
| codeFreeze | PASS |
| dataProtection | PASS |
| migration | PASS |
| knowledgeReview | PASS |
| security | PASS |
| recovery | PASS |
| regression | PASS_WITH_WARNING |
| pilot | PASS |

G4는 TECHNICALLY_READY_FOR_HUMAN_REVIEW입니다. G8은 미실행 Pilot 체크리스트 준비 통과입니다. 실제 운영 활성화의 모든 조건이 충족됐다는 뜻이 아닙니다.

humanApprovalRecorded=false. 원본 PI migration 미적용, flags OFF, 실제 고객 입력·score·Action·Experiment·Insight 생성 없음.

Artifact checksum: 7f3effba6e5e523a54a536b164e737ec48f2ff5f087726f46af0d919e7be443e. 생성 시각: 2026-10-16T14:55:20.689Z. codeHash는 생성 코드를 제외한 앱 소스·Prisma·설정·dependency lock을 결합합니다. 생성 Prisma client는 검증 빌드에서 다시 생성했고 별도 hash 목록으로 기록했습니다.

현재 HEAD와 tracked-file manifest 및 미커밋 앱 소스 hash를 기록했으며 commit/reset하지 않았습니다. 변경 시 이 gate는 재검증해야 합니다. 보호 증거 위치는 output/stage7-5/platform-8-12-current.json 포인터로 확인합니다.

## 사람이 확인할 Known Risks

- PILOT_390_OVERFLOW — NON_BLOCKING: Existing pilot.spec.ts:50:532 failure reproduced; PI 390px has zero overflow. Candidate for human risk acceptance; not accepted yet.
- STUDIO_ORDERING — NON_BLOCKING: Historical array ordering sensitivity retained; current three Studio browser tests pass.
- NEXT_TRACING — NON_BLOCKING: Existing three filesystem tracing warnings; build succeeds. Protected diagnostic logs only.
- PRESCAN_DIRECT_EXPERIMENT_ADAPTER — DEFERRED: Unavailable; no adapter substitution or unsupported attribution.
- CITED_DIRECT_EXPERIMENT_ADAPTER — DEFERRED: Unavailable; no adapter substitution or unsupported attribution.
- LIMITED_METRICS — DEFERRED: Only supported comparable metric contracts may aggregate; Naver without equivalent rank excluded.
- GEMINI_NAVER_NO_RULESET — NON_BLOCKING: FACT_ONLY/NOT_CONFIGURED is intentional; separate manual observation remains possible.
- ACTION_EXPERIMENT_INSIGHT_ZERO — NON_BLOCKING: No actual work/evidence yet; zero records is expected, no synthetic production scores.

모든 위험은 사람 수락 전 후보이며 ownerAccepted=false입니다. 배포 전 [Pack 검토](30-human-pack-review.md), [migration 절차](31-production-migration-runbook.md), [Pilot 조건](32-first-pilot-runbook.md), [복구 절차](33-recovery-runbook.md)를 함께 확인합니다.
