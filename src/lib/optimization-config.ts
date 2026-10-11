import type {AnalysisProfile,PriorityWeights} from './types';
export const DEFAULT_WEIGHTS:PriorityWeights={accuracy:30,relevance:25,technical:20,citation:15,conversion:10};
export const SCORE_LABELS={accuracy:'정보 정확성·신뢰성',relevance:'질문·서비스 관련성',technical:'기술 접근성·구조',citation:'실제 인용·정보 격차',conversion:'예약·구매 경로'};
export const PROFILE_LABELS:Record<AnalysisProfile,string>={LOCAL_SERVICE:'지역 전문 서비스',PRODUCT:'상품 판매'};
export const INDUSTRY_PROFILES={medical:'LOCAL_SERVICE',legal:'LOCAL_SERVICE',local:'LOCAL_SERVICE',brand:'LOCAL_SERVICE',coupang:'PRODUCT',naverShopping:'PRODUCT'} as const;
export const PROFILE_KEYS:Record<AnalysisProfile,string[]>={LOCAL_SERVICE:['identity-name','entity','location','contact','services','experts','expert-evidence','faq','schema','booking'],PRODUCT:['identity-name','product-name','manufacturer','model','specification','price','delivery','purchase-terms','product-schema','faq','booking']};
export const COMMON_KEYS=['http','indexing','x-robots','robots-*','title','headings','body','canonical','schema'];
export const QUESTION_PATTERNS:Record<string,RegExp>={location:/위치|주소|근처|부근|지역|역/,contact:/전화|연락|문의/,services:/서비스|진료|임플란트|상담|수리/,experts:/의료진|원장|전문|자격|변호|비교/,'expert-evidence':/의료진|자격|전문|비교/,booking:/예약|구매|상담|토요일|배송/,faq:/어떻게|기준|비교|가능|방법/,price:/가격|비용/,delivery:/배송|배달/,'purchase-terms':/구매|교환|환불|조건/,'product-name':/상품|제품|구매/,manufacturer:/제조|브랜드|비교/,model:/모델|상품|제품/,specification:/규격|사양|비교/,'product-schema':/상품|제품|가격/};
