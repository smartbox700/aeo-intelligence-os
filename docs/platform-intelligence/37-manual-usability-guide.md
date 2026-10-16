# 대표 실사용 테스트

이 환경은 가상 데이터만 사용하는 로컬 테스트입니다. 운영 배포와 첫 고객 Pilot은 중단된 상태입니다. 현재 원본 `aeo` DB와 별개의 `aeo_manual_usability_test` DB를 사용합니다.

## 처음 실행

PowerShell에서 다음을 실행합니다.

```powershell
cd 'C:\Users\zhang\Downloads\AEO 마케팅 프로그램\AEO 마케팅 프로그램'
npm run pi:manual-test:setup
npm run pi:manual-test:start
```

주소는 `http://127.0.0.1:3013/os?view=platform-intelligence`입니다. 사용자 이름은 `manual-owner`입니다. **임시 비밀번호는 start 명령을 실행한 PowerShell에만 표시**됩니다. 파일·로그·보고서에 저장하지 않습니다. 서버를 새로 시작하면 비밀번호를 새로 발급하므로 가장 최근 터미널 출력을 사용하세요. 창은 로그인한 뒤에도 켜 두세요. 다른 프로그램이 3013 포트를 사용하면 종료하거나 `$env:AEO_MANUAL_PORT='3014'`처럼 다른 포트를 지정합니다.

화면 상단의 **테스트 환경 · 가상 데이터 · 실제 고객 데이터가 아닙니다** 배너를 확인하고 **AI 플랫폼 진단** 메뉴에서 **[TEST] 새봄치과 수원점**을 선택합니다. 첫 실행은 증거 없음 상태입니다. 네 플랫폼은 PARTIAL, Gemini/Naver는 NOT_CONFIGURED이며 점수는 평가 보류입니다.

## 시나리오 바꾸기

서버 터미널에서 **Ctrl+C**로 먼저 종료합니다. 다음 중 한 명령을 실행한 뒤 다시 `npm run pi:manual-test:start`를 실행하고 새 비밀번호로 로그인합니다. 시나리오 전환은 테스트 DB 전체를 선택한 가상 상태로 다시 구성하므로 작성한 테스트 메모는 별도 문서에 보관하세요.

| 명령 뒤 이름 | 확인할 내용 |
|---|---|
| `initial` | 증거 없음, UNKNOWN과 null, FACT_ONLY |
| `chatgpt-fail` | OAI-SearchBot 차단 FAIL과 작업 후보 |
| `google-mixed` | Googlebot PASS / noindex FAIL / 텍스트 PASS, Claude UNKNOWN, Perplexity PASS |
| `positive` | 30개 질문, Before 3/30=10.0%, After 7/30=23.3%, +13.3%p |
| `negative` | 30개 질문, 20.0% → 10.0%, -10%p |
| `zero` | 10.0% → 10.0%, 0%p |
| `insufficient` | 모델 조건 변경으로 NOT_COMPARABLE, 변화량 표시 보류 |
| `insight` | 독립 가상 프로젝트 A +5, B +3, C 0, D -2%p, E 비교 불가·제외 |
| `all` | 주 고객의 양수 실험 + 다섯 가상 집계 프로젝트를 함께 확인 |

예를 들어 전체 흐름을 보려면:

```powershell
npm run pi:manual-test:scenario -- all
npm run pi:manual-test:start
```

ChatGPT 상세에서 **업무 준비**를 누르면 준비 조건을 확인할 수 있습니다. 이 버튼은 `createsTask=false`이며 새 Task를 만들지 않습니다. 아래 **기존 업무 상태**에는 seed 단계에서 별도로 만든 가상 Task와 Studio 승인·적용 증빙이 연결돼 있습니다. **실행 스튜디오에서 확인**으로 같은 가상 업무를 확인할 수 있습니다. 실제 사이트를 수정하거나 납품을 발송하지 않습니다.

**Before / Action / After 실험**에서 Before·After 비율과 관찰 변화량을 확인하세요. Action 적용 이후의 관찰 변화이며 인과효과가 아닙니다. **학습 인사이트**에서는 관측량과 변화 분포, 양수·0·음수·제외를 함께 확인하세요. `all`은 주 고객까지 집계에 포함하므로 `insight` 단독 시나리오와 평균·고객 수가 다릅니다.

## 확인할 질문

- [ ] 고객 상태가 첫 화면에서 이해되는가?
- [ ] 플랫폼별 차이가 명확한가?
- [ ] FAIL과 UNKNOWN의 차이가 이해되는가?
- [ ] 공식 근거를 쉽게 확인할 수 있는가?
- [ ] 문제 발생 시 해야 할 일이 이해되는가?
- [ ] 업무 진행 상태가 이해되는가?
- [ ] Before/After 변화가 이해되는가?
- [ ] 좋은 결과와 나쁜 결과가 모두 보이는가?
- [ ] Insight가 과장되지 않는가?
- [ ] 이 화면으로 고객에게 설명할 수 있는가?

## 종료와 초기화

서버는 PowerShell에서 **Ctrl+C**로 종료합니다. 초기 상태로 돌아가려면 서버를 종료한 후 아래를 실행합니다.

```powershell
npm run pi:manual-test:reset
npm run pi:manual-test:start
```

이 명령들은 marker로 소유권을 확인한 manual 전용 DB만 초기화합니다. 원본 DB·운영 설정·기존 백업은 수정하지 않습니다. 합성 증거는 시간이 지나면 기존 freshness 정책에 따라 오래된 상태가 될 수 있으므로 reset하면 최신 가상 증거를 다시 만듭니다. Official Pack 검토기한이 지난 경우 무리하게 우회하지 않습니다.

외부 AI·사이트 수집은 실행하지 마세요. 이 환경의 서버는 외부 네트워크를 차단합니다. 공식 출처 링크를 사람이 직접 클릭하면 브라우저가 외부 공식 문서를 열 수 있지만 자동 테스트는 링크를 클릭하지 않습니다.
