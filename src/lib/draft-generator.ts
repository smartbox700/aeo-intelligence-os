import type {ProjectData} from './types';
import type {DraftType,ProposalVersion} from './operations-types';
import {INDUSTRIES,DRAFT_LABELS} from './operations-config';
export interface DraftGenerator{method:'TEMPLATE'|'AI';generate(p:ProjectData,type:DraftType):Omit<ProposalVersion,'version'|'at'|'actorId'>}
/** Deterministic, no AI/network. Only staff-confirmed values with evidence may enter proposed copy. */
export class TemplateDraftGenerator implements DraftGenerator{
 method='TEMPLATE' as const;
 generate(p:ProjectData,type:DraftType){const o=p.operations;if(!o)throw new Error('온보딩을 먼저 등록하세요.');const profile=INDUSTRIES[o.onboarding.profile];const facts=o.onboarding.facts;
  const value=(key:string,label:string)=>{const f=facts[key];return f?.status==='CONFIRMED'&&f.evidence.trim()?f.value:'[확인 필요: '+label+']';};
  let proposedText=`${DRAFT_LABELS[type]} · 담당자 검토용 초안\n공식 명칭: ${value('officialName','공식 명칭')}\n공식 URL: ${value('officialUrl','홈페이지 소유·공식성')}\n`;
  if(type==='SCHEMA'){const schemaType=o.onboarding.profile==='COMMERCE'?'Product':o.onboarding.profile==='MEDICAL'?(/치과/.test(p.client.industry)?'Dentist':'MedicalClinic'):o.onboarding.profile==='LEGAL'?'LegalService':'Organization';proposedText=JSON.stringify({'@context':'https://schema.org','@type':schemaType,name:value('officialName','공식 명칭'),url:value('officialUrl','공식 URL'),...(o.onboarding.profile==='COMMERCE'?{brand:{'@type':'Brand',name:value('brand','브랜드명')},manufacturer:{'@type':'Organization',name:value('manufacturer','제조사')},model:value('product','상품명·모델')}:{address:{'@type':'PostalAddress',streetAddress:value('location','공식 주소')}})},null,2)+'\n\n검토: 증빙 없는 자리표시자는 게시 전 실제 확인값으로 대체. 적용 사이트·플랫폼의 지원과 권한, Schema 의미 유효성을 별도 확인. 구조화 데이터는 추천을 보장하지 않음.';}
  else{if(type==='FAQ')proposedText+='질문: '+(p.questions[0]?.text??'[확인 필요: 실제 고객 질문]')+'\n답변: 확인된 정보만 아래 항목으로 작성. 확인되지 않은 예약 가능·전문성·성과는 단정하지 않음.\n';if(type==='EXPERT')proposedText+='전문가 이름·역할·자격: '+value('qualifications','자격·소속의 공식 증빙')+'\n';if(type==='BOOKING')proposedText+='예약·구매 방법: '+value(o.onboarding.profile==='COMMERCE'?'purchase':'booking','공식 절차와 연결 URL')+'\n가능 여부: 실제 확인 전 미확인\n';for(const field of profile.fields)proposedText+=field.label+': '+value(field.key,field.label)+'\n';proposedText+='\n'+profile.review;}
  return {beforeText:'[현재 해당 구역의 원문을 확인해 붙여넣으세요. 자동 수집·사실 확인되지 않음.]',proposedText,instruction:'공식 자료와 대조하고 확인 필요 항목의 증빙을 확보한 후 최종 수정안을 작성. 고객 승인 이후 권한 있는 담당자가 직접 반영.',needsEvidence:'등록 정보의 원본 URL, 실제 서비스·상품 자료, 자격·판매 조건 증빙, 담당자 확인. '+profile.review,method:'TEMPLATE' as const};
 }
}
