# 시스템 구조

Next.js App Router의 단일 애플리케이션. 한국어 클라이언트 화면 → `/api/workspace` → 검증·프로젝트 범위 확인 → 도메인 엔진 → 저장소. Node.js 런타임에서만 DB·DNS·외부 HTTP를 사용한다.

| 모듈 | 위치 | 현재 동작 |
| --- | --- | --- |
| Client Entity | validation / API | 업체 CRUD·별칭·경쟁 업체 |
| Query Intelligence | seed / API | 예시 질문 5개·수동 추가 |
| Response Monitoring | providers / API | 수동 입력, OpenAI 실측·배치 예약/저장 |
| Competitor & Source | analysis | 업체 문맥·근거·검토 이력·출처 저장 |
| Optimization | audit | HTML/robots 진단·경쟁사 비교·근거 과제 |
| Visibility Analytics | analysis / workspace | 표본 지표·필터·CSV |

## 저장소

`STORAGE_MODE=postgres`: Prisma 관계 모델. 프로젝트 데이터를 읽어 도메인 작업 후 트랜잭션으로 저장. PostgreSQL advisory lock으로 초기화 및 쓰기를 직렬화한다. 원문 필드와 분석 payload를 분리한다. 현재 구현은 로컬 워크스페이스 전체를 읽고 upsert하므로 소규모 MVP 대상이다. 확장 시 프로젝트별 repository, pagination, 증분 쓰기, 정규 컬럼 기반 집계로 변경한다.

`STORAGE_MODE=file`: 개발용 JSON 파일. 프로세스 내 쓰기 큐 + 임시 파일의 원자적 rename. 여러 앱 프로세스에서 공유하지 않는다. 저장 오류 시 조용히 메모리 모드로 전환하지 않는다.

## 요청 보호

Zod 입력 검증, 200KB 입력 제한, 웹 URL은 HTTP(S)만 허용, 다른 Origin의 변경 요청 차단, 프로젝트 및 질문/응답/과제 소유 관계 검사. 실행 바인딩은 기본 127.0.0.1. 현재 조직은 `local-org`로 고정되며 이것은 사용자 인증을 대신하지 않는다.

## 홈페이지 진단 보호

HTTP(S), 기본 포트, 자격증명 URL 금지. DNS 모든 응답의 public unicast 여부 확인. 요청 시 검증된 IP로 lookup을 고정하여 DNS rebinding 방지. TLS hostname 검증은 원래 호스트 유지. 각 리디렉션을 다시 검증, 최대 3회. DNS 4초, 전송 전체 8초, 응답 1MB. 프로젝트당 1분 간격. 홈/robots/sitemap을 순차 요청. 실제 리디렉션은 요청 수를 추가한다. DNS 오류·압축 미지원·robots 복합 정책 등은 결과 해석에 포함한다.

이 제한은 단일 프로세스용이다. 공개 운영에서는 공유 rate limiter, 큐, 동시 실행 상한, egress 방화벽, 조직 인증을 추가한다. robots 그룹·우선순위·경로 규칙으로 홈페이지 접근 정책만 검사하며 일반 크롤러는 구현하지 않았다. 점검은 운영자가 등록한 공식 홈페이지의 3개 리소스만 대상으로 한다.

## 확장

ProviderAdapter에서 API 응답의 원문, 출처, 실행 시각, 비용을 반환한다. 사용자 화면과 API 유형을 분리한다. 장기 분석 워커는 저장된 원문을 분석 버전별로 재처리하고 결과를 별도 이력 테이블에 누적할 수 있다. 현재는 원문을 보존하지만 과거 분석 버전의 스냅샷까지 누적하지 않는다.

## 실측 경로
/api/measurements → measurement-service의 프로젝트/질문 검증·영속 배치 예약 → ProviderAdapter → audit.ts의 고정 OpenAI URL/DNS 검증/IP 고정 전송 → 원문·메타데이터 저장 → entity-analysis → visibility. OpenAI POST는 리디렉션·자동 재시도를 하지 않는다. 키는 서버 전용이다. 업체 담당자 수정은 review.ts에서 근거와 전후 이력을 저장한다. 제한과 상태는 README를 따른다.


## 3단계 최적화 경로
/api/optimization → 소속 검증 → website-limits 공유 검사 제한 → 기존 auditWebsite의 robots 선검사/IP 고정 수집 → optimization-config 업종 프로필 → optimization 격차/점수/처방 → 기존 PostgreSQL payload 저장. 실측 유료 전송은 live-ai의 fail-closed 게이트로 차단한다. optimization-panel이 경쟁사·격차·작업·전후 비교 4개 메뉴를 공통으로 제공한다. 정확성 인증과 추천 인과 추정은 하지 않는다.

