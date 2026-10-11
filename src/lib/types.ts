import type {Operations,ExecutionDetail,ClientReport} from './operations-types';
import type {StudioRepository,StudioWork} from './studio-types';
export type DataKind = 'DEMO' | 'MANUAL_UI' | 'MANUAL_OBSERVATION' | 'CONSUMER_UI_MANUAL' | 'API' | 'API_OBSERVATION';
export type Entity = {citedDiagnoses?:import("./cited-project").CitedSnapshot[];preScanRepository?:import("./prescan-types").PreScanRepository;studioRepository?:StudioRepository;id:string; name:string; aliases:string[]; website:string; industry:string; address:string; bookingUrl:string; services:string; experts:string; competitors:Competitor[]; researchStudies?:ResearchStudy[];evidenceFiles?:EvidenceFile[];freeGeminiAttempts?:FreeGeminiAttempt[];analysisProfile?:AnalysisProfile; priorityWeights?:PriorityWeights; websiteChanges?:WebsiteChange[]; createdAt:string};
export type Competitor = {id:string;name:string;aliases:string[];website:string;address?:string;bookingUrl?:string};
export type Question = {id:string;text:string;intent:string;importance:number;commercialIntent:number;createdAt:string};
export type Mention = {entityId:string;name:string;role:'client'|'competitor'|'discovered';position:number;ambiguous:boolean};
export type ResponseRecord = {classification?:DataClassification;classificationHistory?:{at:string;actorId:string;from:DataClassification;to:DataClassification;note:string}[];id:string;questionId:string;questionText?:string;provider:string;model:string;kind:DataKind;observedAt:string;region:string;rawText:string;citations:string[];mentions:Mention[];analysisVersion:string;createdAt:string;cost:number|null;accuracy:'UNREVIEWED'|'ACCURATE'|'INACCURATE';consumer?:ConsumerObservation;verification?:ObservationVerification;manualObservation?:{recommendedNames:string[];bookingStatus:'UNVERIFIED'|'CONFIRMED_AVAILABLE'|'CONFIRMED_UNAVAILABLE';bookingEvidence:string;bookingCheckedAt:string|null};measurement?:Measurement;entityAnalysis?:EntityAnalysis};
export type Finding = {key:string;label:string;status:'pass'|'warn'|'fail'|'unknown';evidence:string;recommendation:string};
export type Audit = {id:string;origin?:'WEBSITE'|'OBSERVATION_STRATEGY';kind:'DEMO'|'LIVE';url:string;at:string;findings:Finding[];competitorComparisons?:CompetitorComparison[]; optimization?:OptimizationSnapshot;pages?:OptimizationSnapshot['pages']};
export type Task = {studio?:StudioWork;id:string;execution?:ExecutionDetail;auditId:string;title:string;evidence:string;action:string;expectedArea:string;priority:'P1'|'P2';status:'TODO'|'DOING'|'DONE';hypothesis:boolean;gapId?:string;score?:number;scoreParts?:PriorityWeights;assignee?:string;dueDate?:string;reviewRequired?:boolean;regulatoryReview?:boolean;reviewStatus?:'PENDING'|'APPROVED';reviewNote?:string;history?:{at:string;status:string;assignee:string;note:string}[];observedFact?:string;remeasurement?:string};
export type ProjectData = {pilotReports?:import('./pilot-types').PilotOutcomeReport[];salesReports?:import("./sales-types").SalesReport[];classification?:DataClassification;id:string;operations?:Operations;reports?:ClientReport[];organizationId:string;name:string;client:Entity;questions:Question[];responses:ResponseRecord[];audits:Audit[];tasks:Task[];batches?:MeasurementBatch[]};
export type Store = {schemaVersion:number;projects:ProjectData[]};

export type EntityContext = 'RECOMMENDATION' | 'BACKGROUND' | 'NEGATED';
export type ExtractedEntity = {
 id:string;name:string;matchedEntityId:string|null;role:'client'|'competitor'|'discovered'|'unresolved';
 context:EntityContext;introductionOrder:number|null;confidence:'HIGH'|'MEDIUM'|'LOW';
 evidenceQuote:string;start:number;end:number;identityReason:string;sourceUrls:string[];
 review:'PENDING'|'ACCEPTED'|'REJECTED';
};
export type EntityAnalysis = {
 version:string;method:'CONTEXT_RULES'|'ADMIN_REVIEW';status:'READY'|'REVIEW_REQUIRED';generalGuidance:boolean;
 entities:ExtractedEntity[];reviewHistory:{at:string;entityId:string;before:ExtractedEntity;after:ExtractedEntity;reason:string}[];
};
export type CitedSource={url:string;title:string;start:number|null;end:number|null;messageIndex:number};
export type Usage={inputTokens:number;outputTokens:number;totalTokens:number;cachedInputTokens:number};
export type Measurement={
 batchId:string;questionText:string;status:'SUCCEEDED'|'FAILED'|'INCOMPLETE';searchUsed:boolean;
 apiResponseId:string|null;requestId:string|null;apiStatus:string;usage:Usage|null;
 searchCalls:Record<string,unknown>[];citedSources:CitedSource[];rawOutput:Record<string,unknown>|null;
 errorCode:string|null;errorMessage:string|null;durationMs:number;
 costEstimate:{usd:number|null;basis:string;rates:Record<string,number>|null};
};
export type MeasurementBatch={
 id:string;idempotencyKey:string;provider:string;model:string;region:string;questionIds:string[];questionTexts:string[];
 repetitions:1;kind:'API_OBSERVATION'|'DEMO';status:'RUNNING'|'COMPLETED'|'PARTIAL'|'FAILED'|'INTERRUPTED';
 startedAt:string;finishedAt:string|null;responseIds:string[];error:string|null;
};
export type CompetitorComparison={entityId:string;name:string;url:string;at:string;status:'SUCCEEDED'|'FAILED';error:string|null;findings:Finding[];differences:{key:string;clientEvidence:string;competitorEvidence:string;hypothesis:string}[]};

export type AnalysisProfile='LOCAL_SERVICE'|'PRODUCT';
export type PriorityWeights={accuracy:number;relevance:number;technical:number;citation:number;conversion:number};
export type Gap={id:string;responseIds?:string[];key:string;label:string;clientStatus:string;competitorStates:{id:string;name:string;status:string;evidence:string;url:string}[];questionIds:string[];evidenceUrls:string[];observedFact:string;necessity:string;action:string;reviewRequired:boolean;regulatoryReview:boolean;remeasurement:string;score:number;scoreParts:PriorityWeights};
export type WebsiteChange={id:string;kind?:"LIVE"|"DEMO";at:string;url:string;note:string;verification:string};
export type OptimizationSnapshot={observationGroups?:{kind:DataKind;responseIds:string[]}[];version:string;profile:AnalysisProfile;weights:PriorityWeights;gaps:Gap[];pages:{entityId:string;url:string;status:number;at:string;title:string;headings:string[];excerpt:string}[];citedSources:{responseId:string;kind:DataKind;url:string;entityId:string|null}[]};

export type ConsumerScreen='CHATGPT_WEB_SEARCH'|'GEMINI_CONSUMER_SEARCH'|'NAVER_AI_BRIEFING';
export type ConsumerObservation={projectId:string;screen:ConsumerScreen;actualQuestion:string;questionSubmittedAt:string;answerRecordedAt:string;country:string;searchUsage:'USED'|'NOT_USED'|'UNKNOWN';method:'CONSUMER_UI_MANUAL'|'DEMO';consumerScreenConfirmed:boolean;observer:string;studyId:string|null;phase:'BASELINE'|'FOLLOW_UP'|'UNASSIGNED';repetition:number;evidenceIds:string[];actionLinks:{url:string;quote:string;start:number;end:number}[];inputKey:string;inputHash?:string};
export type ObservationVerification={status:'UNVERIFIED'|'VERIFIED'|'REJECTED';reviewer:string;note:string;at:string|null;sourceConfirmed?:boolean;actorId?:string;history:{status:string;reviewer:string;note:string;at:string;sourceConfirmed?:boolean;actorId?:string}[]};
export type DataClassification='PUBLIC_RESEARCH'|'CLIENT_CONFIDENTIAL'|'INTERNAL';
export type ResearchStudy={id:string;name:string;kind:'CONSUMER_UI_MANUAL'|'DEMO';at:string;repetitions:number;conditions:{questionId:string;actualQuestion:string;screen:ConsumerScreen;model:string;country:string;region:string;searchUsage:'USED'}[]};
export type EvidenceFile={id:string;filename:string;storageName:string;mime:string;bytes:number;sha256:string;at:string;imageExtraction:'NOT_PERFORMED'};
export type FreeGeminiAttempt={id:string;at:string;status:'RESERVED'|'SUCCEEDED'|'FAILED'|'BLOCKED'|'QUOTA_EXCEEDED';networkCalls:number;usage:Usage|null;error:string|null};







