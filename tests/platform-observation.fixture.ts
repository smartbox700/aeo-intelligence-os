import {seed} from '../src/lib/seed';
import type {ProjectData,ResponseRecord} from '../src/lib/types';
import type {ObservationInput} from '../src/lib/platform-intelligence/observations/context';
export const observationAt='2026-10-01T00:01:00Z';
export function observationInput():ObservationInput {return {
  projectId:'PROJECT_TEST',responseId:'RESPONSE_TEST',queryId:'QUERY_TEST',queryText:'합성 질문\n  그대로',
  provider:'ChatGPT',consumerScreen:'CHATGPT_WEB_SEARCH',observationMethod:'CONSUMER_UI_MANUAL',
  modelName:'SYNTHETIC_MODEL',modelDisplay:'SYNTHETIC_MODEL',modelVersion:'SYNTHETIC_VERSION',modelStatus:'KNOWN',
  intent:'정보 탐색',country:'KR',region:'SEOUL',language:'ko-KR',searchUsed:'TRUE',loggedIn:'NO',personalizationState:'DISABLED',freshConversation:'TRUE',
  studyId:null,phase:'UNASSIGNED',runNumber:1,observedAt:observationAt,sourceDomain:'CONSUMER',evidenceRefs:[],
};}
export function observationProject():ProjectData {
  const project=seed().projects[0];project.id='PROJECT_TEST';
  project.questions=[{id:'QUERY_TEST',text:'합성 질문\n  그대로',intent:'정보 탐색',importance:1,commercialIntent:1,createdAt:observationAt}];
  const response:ResponseRecord={id:'RESPONSE_TEST',questionId:'QUERY_TEST',questionText:project.questions[0].text,provider:'ChatGPT',model:'SYNTHETIC_MODEL',kind:'CONSUMER_UI_MANUAL',observedAt:observationAt,region:'SEOUL',rawText:'SYNTHETIC PRIVATE RAW\r\n  보존',citations:['https://example.invalid/citation'],mentions:[],analysisVersion:'synthetic-test',createdAt:observationAt,cost:null,accuracy:'UNREVIEWED',consumer:{projectId:project.id,screen:'CHATGPT_WEB_SEARCH',actualQuestion:project.questions[0].text,questionSubmittedAt:'2026-10-01T00:00:00Z',answerRecordedAt:observationAt,country:'KR',searchUsage:'UNKNOWN',method:'CONSUMER_UI_MANUAL',consumerScreenConfirmed:true,observer:'SYNTHETIC_PERSON_NOT_TO_COPY',studyId:null,phase:'UNASSIGNED',repetition:1,evidenceIds:[],actionLinks:[],inputKey:'SYNTHETIC_SECRET_NOT_TO_COPY'}};
  project.responses=[response];project.client.researchStudies=[];project.client.evidenceFiles=[];delete project.client.citedDiagnoses;delete project.client.preScanRepository;delete project.operations;return project;
}
