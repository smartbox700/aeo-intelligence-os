# 첫 실제 Pilot 전 점검표

8-11은 격리 DB에서 직원용 UI를 검증하는 단계다. 다음 항목은 **실제 운영 배포 완료 기록이 아니며**, 운영 deployment gate에서 별도로 확인해야 한다.

- [ ] 운영 OWNER가 공식 문서를 직접 검토하고 정확한 manifest/claim/source checksum을 명시한 승인 명령을 기록한다. 현재 팩의 humanApprovalRecorded=false를 실제 승인으로 바꾸어 해석하지 않는다.
- [ ] 원본 DB·첨부의 암호화 백업과 별도 키 보관, 복원 검증을 확인한다.
- [ ] 승인된 배포 절차에서만 운영 migration을 검토·적용한다. 앱 시작/페이지 조회에 migration을 넣지 않는다.
- [ ] 운영 배포의 세 flags/storage 조건과 실제 schema 상태를 확인한다. 원본 .env는 이번 단계에서 활성화하지 않았다.
- [ ] 직원 역할·담당 고객·조직·VIEWER 거절·OWNER Insight 경계를 운영 계정으로 확인한다.
- [ ] 실제 고객의 동의·측정 범위·외부 법률/의료 검토가 필요한지를 기존 업무 절차에서 확인한다.
- [ ] 고객별 증거를 명시적으로 선택하고 source date/freshness/robots agent/HTML+header 범위를 검토한다. 기본 source=null은 UNKNOWN이며 팩 설치만으로 고객 점수가 생기지 않는다.
- [ ] Gemini/Naver의 FACT_ONLY를 그대로 유지한다. Google AI와 Gemini, Naver 일반 웹/Place, 각 검색/학습/user bot을 혼합하지 않는다.
- [ ] Action 0개 상태를 설명한다. 새 표준 작업은 별도 검토·승인 전에는 만들지 않는다. 업무 준비는 Task 생성이나 적용 완료가 아니다.
- [ ] 실제 적용은 기존 Task/Proposal/Studio/Pilot 승인·컴플라이언스·증빙을 이용한다. SOURCE_CHANGED이면 현재 상태를 다시 확인한다.
- [ ] Before/After는 동일 질문·조건·Metric version·기간·동의로 비교 가능한지 확인한다. 지원되지 않는 Metric 및 PreScan/CITED direct adapter 한계를 확인한다.
- [ ] 실제 운영 Insight에 필요한 최소 집단·현재 동의·원본 현재성을 검토한다. 관측량과 관찰된 변화를 분리하고 인과효과로 설명하지 않는다.
- [ ] 390px와 Desktop에서 새 UI와 실제 고객 이름 길이·직원 이름 길이·접근 거절 상태를 확인한다.
- [ ] 기존 Pilot mobile overflow와 Studio 배열 순서 민감성, Next filesystem tracing warning을 별도 위험으로 검토한다. 신규 PI UI 통과가 기존 경고 해결을 의미하지 않는다.

이번 단계는 실제 고객 score, 운영 migration, 원본 flags 활성화, 사람의 운영 승인, 신규 Action/Experiment/Insight 생성을 수행하지 않는다. 구현·테스트 결과와 남은 경고는 8-11 완료 보고서를 기준으로 판단한다.
