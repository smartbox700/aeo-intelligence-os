import type {PlatformOverviewDto,PlatformDetailDto} from '@/lib/platform-intelligence/server/read-model';
import type {InsightProjection} from '@/lib/platform-intelligence/insights/projection';
export type Overview=PlatformOverviewDto&{revision:number};
export type Detail=PlatformDetailDto&{revision:number};
export class OperationsApiError extends Error{constructor(public readonly code:string){super(code);}}
async function request<T>(path:string,signal?:AbortSignal,body?:unknown):Promise<T>{
 const response=await fetch('/api/platform-intelligence/'+path,{signal,cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 let value;try{value=await response.json();}catch{throw new OperationsApiError('INVALID_RESPONSE');}
 if(!response.ok)throw new OperationsApiError(typeof value?.error?.code==='string'?value.error.code:'INTERNAL_ERROR');return value as T;
}
const project=(id:string)=>'projects/'+encodeURIComponent(id);
export const operationsApi={catalog:(signal:AbortSignal)=>request<{revision:number;projectOptions:{projectId:string;label:string}[]}>('catalog',signal),overview:(id:string,signal:AbortSignal)=>request<Overview>(project(id)+'/overview',signal),detail:(id:string,code:string,signal:AbortSignal)=>request<Detail>(project(id)+'/platforms/'+encodeURIComponent(code),signal),insights:(signal:AbortSignal)=>request<{revision:number;items:InsightProjection[]}>('insights',signal),
 prepare:(id:string,input:{expectedRevision:number;evaluationId:string;ruleId:string;ruleVersion:number;actionId:string;actionVersion:number},signal:AbortSignal)=>request<{revision:number;result:{createsTask:false;requiredGates:unknown}}>(project(id)+'/action-candidates',signal,{operation:'PREPARE_WORK',reason:'직원이 현재 진단 근거와 표준 작업의 업무 준비 조건을 확인함',...input})};
