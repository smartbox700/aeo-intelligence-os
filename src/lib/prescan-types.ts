import type {ConsumerScreen,Question} from './types';
export type UniverseProfile='MEDICAL'|'LEGAL'|'BRAND'|'ECOMMERCE';
export type QueryCandidate=Question&{region:string;services:string[];excluded:boolean;similarIds:string[];unsuitableReasons?:string[];source:'INTENT_HYPOTHESIS'|'HUMAN';};
export type UniverseVersion={id:string;version:number;at:string;actorId:string;profile:UniverseProfile;region:string;services:string[];goal:string;website:string;label:'검색의도 기반 가설 질문';questions:QueryCandidate[];warnings:string[]};
export type QuerySetVersion={id:string;version:number;at:string;actorId:string;universeId:string;questions:QueryCandidate[];reasons:Record<string,string>;};
export type PreScan={id:string;leadId:string;setId:string;studyId:string;kind:'DEMO'|'CONSUMER_UI_MANUAL';at:string;date:string;owner:string;status:'PLANNED'|'IN_PROGRESS'|'PAUSED'|'COMPLETED';minutes:number;summary:string;screens:ConsumerScreen[];slots:{id:string;questionId:string;screen:ConsumerScreen;status:'PENDING'|'FAILED'|'EXCLUDED';note:string}[];history:{at:string;actorId:string;note:string}[]};
export type PreScanSnapshot={id:string;scanId:string;at:string;actorId:string;frozen:boolean;sha256:string;data:Record<string,unknown>};
export type PreScanRepository={universes:UniverseVersion[];sets:QuerySetVersion[];scans:PreScan[];snapshots:PreScanSnapshot[]};
