import type {ProjectData} from './types';
import type {DraftType} from './operations-types';
import type {PageSnapshot,StudioDraft} from './studio-types';
import {FACT_FIELDS,REQUIRED_FACTS} from './studio-config';
import {factFingerprint,verifiedFacts} from './studio-facts';
import {generateStudioSchema} from './studio-schema';
export interface ContentGenerator{method:'TEMPLATE';generate(p:ProjectData,page:PageSnapshot,questionId:string,type:DraftType):StudioDraft;}
export class TemplateContentGenerator implements ContentGenerator{
 method='TEMPLATE' as const;
 generate(p:ProjectData,page:PageSnapshot,questionId:string,type:DraftType){
  const q=p.questions.find(q=>q.id===questionId);if(!q)throw new Error('질문 프로젝트 소속 오류');
  const facts=verifiedFacts(p),get=(key:string)=>facts.find(f=>f.key===key)?.value??'[고객사 확인 필요: '+(FACT_FIELDS[key as keyof typeof FACT_FIELDS]??key)+']';
  const required=REQUIRED_FACTS[type],checks=required.filter(k=>!facts.some(f=>f.key===k)).map(k=>'고객사 확인 필요: '+FACT_FIELDS[k as keyof typeof FACT_FIELDS]);
  if(type==='FAQ'&&!/(질문|FAQ|정보|방법|절차|어떻게|무엇|확인)/i.test(q.intent+' '+q.text))throw new Error('이 질문의 의도에는 FAQ를 우선하지 않습니다. 서비스·예약 안내를 선택하세요.');
  const name=type==='PRODUCT'?get('product'):get('officialName'),topic=type==='PRODUCT'?'상품 정보':type==='EXPERT'?'전문가 소개':type==='BOOKING'?'상담·예약 안내':type==='BRAND'?'브랜드 안내':'서비스 안내';
  const title=page.channel!=='WEBSITE'?[facts.find(f=>f.key==='brand'&&!name.includes(f.value))?.value,name].filter(Boolean).join(' '):name+' | '+topic,h1=name+' '+topic;
  const direct=type==='PRODUCT'?name+'의 규격과 구매 조건을 확인할 수 있습니다.':type==='EXPERT'?get('experts')+'의 역할과 확인된 자격은 아래와 같습니다.':type==='BOOKING'?get('officialName')+'의 상담·예약 안내는 공식 경로 '+get('bookingUrl')+'에서 확인하세요.':type==='BRAND'?get('brand')+'의 공식 사업체 정보는 아래와 같습니다.':type==='SCHEMA'?get('officialName')+'의 확인된 사업체 정보를 안내합니다.':get('officialName')+'에서 안내하는 서비스는 '+get('services')+'입니다.';
  const relevant=type==='PRODUCT'?['officialName','officialUrl','product','brand','manufacturer','model','specification','features','certification','price','currency','delivery','returns','purchaseUrl']:type==='EXPERT'?['officialName','officialUrl','experts','qualifications','services','address','phone','hours','bookingUrl']:['officialName','officialUrl','brand','services','address','phone','region','hours','experts','qualifications','bookingUrl'];
  const selected=facts.filter(f=>relevant.includes(f.key)),sections=[{heading:type==='FAQ'?q.text:'질문에 대한 안내',text:direct},{heading:type==='PRODUCT'?'확인된 상품 정보':'공식 확인 정보',text:selected.map(f=>FACT_FIELDS[f.key as keyof typeof FACT_FIELDS]+': '+f.value).join('\n')||'[고객사 확인 필요: 공식 자료]'},
   {heading:'이용 전 확인사항',text:type==='PRODUCT'?'가격의 확인 시각: '+(facts.find(f=>f.key==='price')?.checkedAt??'미확인')+'. 최신 가격·옵션·배송·반품 조건은 공식 구매 화면에서 확인하세요.':'상담 내용·일정·비용·예약 가능 여부는 공식 담당자에게 확인하세요. 치료 효과나 사건 결과를 보장하지 않습니다.'}];
  const link=facts.find(f=>f.key===(type==='PRODUCT'?'purchaseUrl':'bookingUrl'));
  const draft:StudioDraft={method:'TEMPLATE',type,title,description:direct,h1,sections,cta:link?{label:type==='PRODUCT'?'공식 구매 안내':'공식 상담·예약 안내',url:link.value}:null,schema:'',factIds:selected.map(f=>f.id),factFingerprint:factFingerprint(p,selected.map(f=>f.id)),checks,suggestions:[],channel:page.channel,contentDecision:page.body.includes(q.text)?'기존 질문형 콘텐츠 발견: 새 페이지보다 기존 설명 보완 우선':selected.some(f=>page.body.includes(f.value))?'관련 사실 단서가 기존 페이지에 있음: 중복 문단을 확인하고 필요한 구역만 교체':'관련 콘텐츠 단서 부족: 확인된 안내 구역을 추가. 사이트 전체 중복 검색은 수행하지 않음'};
  draft.schema=generateStudioSchema(p,page,draft);
  draft.suggestions=[['title',page.title,title,'페이지 목적과 공식 명칭을 명확하게 설명'],['description',page.description,draft.description,'확인한 서비스만 요약'],['H1',page.h1.join('\n'),h1,'기존 구조를 보존하고 대표 제목을 정리'],['본문',page.body,sections.map(s=>s.heading+'\n'+s.text).join('\n\n'),'질문→답변→공식 정보→이용 전 확인 순서'],['내부 링크',page.links.filter(l=>new URL(l.url).origin===new URL(page.url).origin).map(l=>l.text+' '+l.url).join('\n'),'기존 서비스·전문가·위치 안내 링크 유지. 링크 대상은 담당자 확인','기존 링크를 삭제하지 않고 설명과 위치 개선'],['예약·구매',page.content.booking,draft.cta?.url??'고객사 확인 필요: 공식 경로','검증된 공식 경로만 연결']].map(([field,before,after,reason])=>({field,before,after,reason,question:q.text,evidence:'페이지 원본 '+page.sha256+' · 연결 사실 '+selected.map(f=>f.key).join(', '),confirmation:checks.join('; ')||'원본 증빙·자연스러운 문장·규정 검토'}));
  if(page.channel!=='WEBSITE')draft.suggestions=[['상품명',page.title,draft.title,'확인된 상품명·브랜드·규격으로 판매자 관리 화면에서 수정'],['상품 속성·상세설명',page.body,sections.map(s=>s.heading+' '+s.text).join('\n'),'확인된 소재·용량·구성·정책만 입력'],['이미지 설명','원본 이미지 미검사','공식 상품명과 확인된 사양으로 이미지 설명 작성 · 담당자 원본 이미지 확인','이미지·OCR 검사 미구현'],['배송·반품 정책','원본 상세설명 수동 검토',selected.filter(f=>['delivery','returns'].includes(f.key)).map(f=>f.value).join('\n')||'고객사 확인 필요','플랫폼에서 실제 편집 가능한 정책 항목만 수정']].map(([field,before,after,reason])=>({field,before,after,reason,question:q.text,evidence:'판매자 제공 정보와 연결된 검증 사실',confirmation:'편집 가능한 항목·상품 옵션·최신 판매 조건 확인'}));
  return draft;
 }
}
