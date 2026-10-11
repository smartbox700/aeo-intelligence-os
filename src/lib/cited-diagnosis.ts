import {z} from 'zod';

export const platforms=['ChatGPT','Gemini','Claude','Perplexity','Google AI'] as const;
export const categories={brand:'브랜드 확인',recommendation:'추천',information:'정보 탐색',comparison:'선택 기준',local:'지역 탐색'} as const;
export type Query={id:string;type:keyof typeof categories;text:string};
const short=z.string().trim().min(1).max(100);
export const profileSchema=z.object({brand:short,region:short,service:short,count:z.union([z.literal(10),z.literal(50)])});
export type Profile=z.infer<typeof profileSchema>;
const observationSchema=z.object({queryId:z.string(),platform:z.enum(platforms),status:z.enum(['unmeasured','observed']),mentioned:z.boolean(),recommended:z.boolean(),cited:z.boolean(),rawText:z.string().max(20000),observedAt:z.string().max(40),model:z.string().max(100)}).superRefine((r,ctx)=>{
 if(r.status==='observed'&&(!r.rawText.trim()||!Number.isFinite(Date.parse(r.observedAt))||!r.model.trim()))ctx.addIssue({code:'custom',message:'관측에는 원문, 유효한 날짜, 모델·모드가 필요합니다.'});
 if((r.recommended||r.cited)&&!r.mentioned)ctx.addIssue({code:'custom',message:'추천·인용을 선택하려면 브랜드 언급을 확인하세요.'});
});
export type Observation=z.infer<typeof observationSchema>;
export const diagnosisSchema=z.object({version:z.literal(1),profile:profileSchema,observations:z.array(observationSchema).max(250)}).superRefine((d,ctx)=>{
 const queries=new Set(generateQueries(d.profile).map(q=>q.id));const slots=new Set<string>();
 for(const r of d.observations){const key=r.queryId+'|'+r.platform;if(!queries.has(r.queryId)||slots.has(key))ctx.addIssue({code:'custom',message:'질문 소속 또는 중복 관측 오류'});slots.add(key);}
});
export type Diagnosis=z.infer<typeof diagnosisSchema>;
export const diagnosisStorageKey='cited-manual-diagnosis-v1';

export function generateQueries(profile:Profile):Query[]{
 const {brand:b,region:r,service:s}=profileSchema.parse(profile);
 const templates:Record<Query['type'],string[]>={
  brand:[`${b}의 공식 홈페이지는?`,`${b}의 ${s} 서비스 안내를 확인해줘.`,`${b}의 공식 연락 방법은?`,`${b}의 위치를 확인해줘.`,`${b}의 운영시간은 어디서 확인하나?`,`${b}의 상담 예약 방법은?`,`${b}의 담당자 정보를 공식 출처로 확인해줘.`,`${b}의 서비스 범위는?`,`${b}의 공식 공지 채널은?`,`${b}에 상담 전 확인할 사항은?`],
  recommendation:[`${r}에서 ${s} 상담할 업체를 추천해줘.`,`${r}의 ${s} 업체를 선택할 때 후보를 알려줘.`,`${s} 상담을 제공하는 ${r} 업체는?`,`${r} 근처에서 ${s} 관련 상담할 곳을 알려줘.`,`${r}에서 ${s} 공식 안내가 잘 정리된 업체를 찾아줘.`,`${s} 상담을 처음 받는 사람이 ${r}에서 고려할 업체는?`,`${r}의 ${s} 업체와 선택 이유를 알려줘.`,`${r}에서 ${s} 상담 후보들의 공식 출처를 알려줘.`],
  information:['절차','비용 확인 방법','준비 자료','상담 전 질문','서비스 범위','기간 확인 방법','계약 전 확인사항','추가 비용 확인','취소 조건 확인','개인정보 처리 확인','공식 자격 확인','설명 자료 확인','진행 상황 확인','상담 후 후속 절차','주의할 광고 표현'].map(t=>`${s}의 ${t}에 대해 알려줘.`),
  comparison:['공식 정보','서비스 범위','상담 절차','비용 안내','접근성','담당자 정보','연락 채널','계약 조건','개인정보 보호','사후 안내'].map(t=>`${s} 업체를 비교할 때 ${t}는 어떻게 확인하나?`),
  local:['위치','이동 경로','운영시간','예약 채널','주차 안내','접근성','공식 업체 목록'].map(t=>`${r}의 ${s} 업체 ${t}를 확인하려면?`)
 };
 const all=(Object.keys(templates) as Query['type'][]).flatMap(type=>templates[type].map((text,i)=>({id:`${type}-${i+1}`,type,text})));
 return profile.count===50?all:all.filter(q=>({brand:2,recommendation:4,information:2,comparison:1,local:1}[q.type])>=Number(q.id.split('-')[1]));
}
export function metrics(d:Diagnosis,platform:typeof platforms[number]){
 const queries=generateQueries(d.profile);const observed=d.observations.filter(r=>r.platform===platform&&r.status==='observed');
 const recommendationIds=new Set(queries.filter(q=>q.type==='recommendation').map(q=>q.id));const recommendations=observed.filter(r=>recommendationIds.has(r.queryId));
 const rate=(n:number,total:number)=>total?Math.round(n/total*1000)/10:null;
 return {planned:queries.length,observed:observed.length,mentioned:rate(observed.filter(r=>r.mentioned).length,observed.length),cited:rate(observed.filter(r=>r.cited).length,observed.length),recommendation:rate(recommendations.filter(r=>r.recommended).length,recommendations.length),recommendationObserved:recommendations.length,recommendationPlanned:recommendationIds.size};
}
