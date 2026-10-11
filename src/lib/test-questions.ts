import {randomUUID} from 'node:crypto';
import type {ProjectData} from './types';
export const hongjeMeasurementQuestions=[
 '서울 서대문구 홍제역 근처에서 임플란트 상담을 받을 만한 치과를 찾아줘.',
 '홍제역 근처 임플란트 진료 치과 3곳을 비교하고 의료진, 위치, 예약 방법을 알려줘.',
 '서대문구 홍제역 부근에서 토요일 임플란트 상담이 가능한 치과가 있는지 확인해줘.',
 '홍제역 근처에서 임플란트 상담할 치과를 고를 때 어떤 기준으로 비교해야 할까?',
];
export function addMeasurementQuestions(p:ProjectData){let added=0;for(const [i,text] of hongjeMeasurementQuestions.entries()){if(p.questions.some(q=>q.text===text))continue;p.questions.push({id:randomUUID(),text,intent:['지역·서비스','비교','일정','선택 기준'][i],importance:3,commercialIntent:4,createdAt:new Date().toISOString()});added++;}return added;}
