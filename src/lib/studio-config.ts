import type {DraftType} from './operations-types';
import type {StudioState} from './studio-types';
export const FACT_FIELDS={officialName:'공식 사업체명',officialUrl:'공식 홈페이지',address:'사업장 주소',phone:'대표 연락처',industry:'업종',services:'실제 서비스·진료 분야',experts:'전문가 이름·역할',qualifications:'확인된 자격·전문 분야',hours:'운영시간',bookingUrl:'공식 예약 URL',purchaseUrl:'공식 구매 URL',region:'서비스 제공 지역',brand:'브랜드명',product:'상품명',manufacturer:'제조사',model:'모델·규격',specification:'상품 사양·소재·용량·구성품',features:'증빙된 특장점',certification:'인증·시험 정보',price:'판매가격 (숫자)',currency:'통화 (KRW 등)',delivery:'배송 정책',returns:'반품 정책',officialMaterial:'기타 공식자료'} as const;
export const STUDIO_LABELS:Record<StudioState,string>={DRAFT:'초안',EVIDENCE_REQUIRED:'사실 증빙 필요',INTERNAL_REVIEW:'내부 검토',CLIENT_APPROVAL_REQUIRED:'고객 승인 대기',APPROVED:'승인 완료',READY_FOR_EXPORT:'납품 준비',DEPLOYED:'적용 기록',VERIFIED:'반영 검증',FOLLOWUP_PENDING:'후속 관측 대기',COMPLETED:'관측 연결 완료'};
export const REQUIRED_FACTS:Record<DraftType,string[]>={HOME:['officialName','officialUrl','services'],SERVICE:['officialName','officialUrl','services'],EXPERT:['officialName','officialUrl','experts','qualifications'],BOOKING:['officialName','officialUrl','bookingUrl'],PRODUCT:['officialName','product','specification','purchaseUrl'],BRAND:['officialName','officialUrl','brand'],FAQ:['officialName','officialUrl','services'],SCHEMA:['officialName','officialUrl']};
export const STUDIO_GUIDES=[
 {label:'Schema.org Dentist / MedicalBusiness',url:'https://schema.org/Dentist'},
 {label:'Schema.org LegalService',url:'https://schema.org/LegalService'},
 {label:'Schema.org Product / Offer',url:'https://schema.org/Product'},
 {label:'Google 구조화 데이터 정책',url:'https://developers.google.com/search/docs/appearance/structured-data/sd-policies'},
 {label:'Google 지역 사업체',url:'https://developers.google.com/search/docs/appearance/structured-data/local-business'},
 {label:'Google 상품',url:'https://developers.google.com/search/docs/appearance/structured-data/product-snippet'},
 {label:'Google 변경 기록 (FAQ 리치 결과 종료)',url:'https://developers.google.com/search/updates'},
 {label:'의료법 제56조·제57조',url:'https://www.law.go.kr/법령/의료법'},
 {label:'변호사법 제23조',url:'https://www.law.go.kr/법령/변호사법'},
 {label:'대한변호사협회 광고 규칙·규정',url:'https://koreanbar.or.kr/pages/introduce/list.asp?category=3'}
];
