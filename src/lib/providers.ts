import type {DataKind,Measurement} from './types';
export type ProviderInput={question:string;region:string;model:string;batchId:string};
export type ProviderObservation={rawText:string;citations:string[];observedAt:string;model:string;measurement:Measurement};
export interface ProviderAdapter {id:string; kind:DataKind; collect(input:ProviderInput):Promise<ProviderObservation>}
export const providers=[{id:'ChatGPT',mode:'수동 소비자 화면',available:true},{id:'Gemini',mode:'수동 소비자 화면 · API 미연동',available:true},{id:'네이버 AI 검색',mode:'수동 소비자 화면 · API 미연동',available:true}];
export class UnconfiguredAdapter implements ProviderAdapter {
 kind='API_OBSERVATION' as const;
 constructor(public id:string){}
 async collect():Promise<never>{throw new Error('공식 API 어댑터 미연동. 소비자 화면 결과는 수동으로 입력하세요.');}
}
