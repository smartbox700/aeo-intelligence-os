import {describe,it,expect} from 'vitest';
import {canonicalChecksum} from '../src/lib/platform-intelligence/knowledge/contracts';
import {buildObservationContext,queryTextHash,assertObservationContext} from '../src/lib/platform-intelligence/observations/context';
import {buildResponseObservationContext,buildCitedObservationContext} from '../src/lib/platform-intelligence/observations/adapters';
import {compareObservationContexts} from '../src/lib/platform-intelligence/observations/comparison';
import {createInMemoryObservationContextRepository} from '../src/lib/platform-intelligence/observations/repository';
import {attachDiagnosis} from '../src/lib/cited-project';
import {generateQueries,platforms} from '../src/lib/cited-diagnosis';
import {pilotFixture,activate,baseline} from './pilot-fixture';
import {storeConsumerRows} from '../src/lib/consumer-observation';
import {observationInput,observationProject,observationAt} from './platform-observation.fixture';

describe('Canonical Observation Context',()=>{
  it('resolves exact screens through registry v1 and has a versioned complete condition',()=>{
    const context=buildObservationContext(observationInput());
    expect(context).toMatchObject({platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',providerCode:'OPENAI',status:'COMPLETE',contextVersion:'observation-context-v1',conditionVersion:'observation-condition-v1',registryVersion:'platform-registry-v1'});
    expect(assertObservationContext(context)).toEqual(context);expect(Object.isFrozen(context.evidenceRefs)).toBe(true);
    expect(context).not.toHaveProperty('queryText');expect(context).not.toHaveProperty('rawText');
  });
  it('keeps provider-only OpenAI unresolved and product names channel-free',()=>{
    const base=observationInput();delete base.consumerScreen;
    expect(buildObservationContext({...base,provider:'OpenAI',observationMethod:'API_OBSERVATION'})).toMatchObject({platformCode:null,channelCode:null,providerCode:'OPENAI',status:'UNRESOLVED'});
    expect(buildObservationContext(base)).toMatchObject({platformCode:'CHATGPT',channelCode:null,status:'PARTIAL'});
  });
  it('separates Gemini API grounding from consumer search',()=>{
    const base=observationInput(),consumer=buildObservationContext({...base,provider:'Gemini',consumerScreen:'GEMINI_CONSUMER_SEARCH'});
    const api=buildObservationContext({...base,provider:'Gemini API Grounding',consumerScreen:undefined,observationMethod:'API_OBSERVATION'});
    expect(consumer.channelCode).toBe('GEMINI_CONSUMER_SEARCH');expect(api.channelCode).toBe('GEMINI_API_GROUNDING');
    expect(api.conditionHash).not.toBe(consumer.conditionHash);expect(compareObservationContexts(api,consumer).status).toBe('NOT_COMPARABLE');
    expect(compareObservationContexts(consumer,buildObservationContext(base)).status).toBe('NOT_COMPARABLE');
  });
  it('keeps unknown model, locale, login and personalization explicit',()=>{
    const p=observationProject();p.responses[0].model='미표시';p.responses[0].region='';delete p.responses[0].consumer;
    expect(buildResponseObservationContext(p,p.responses[0].id)).toMatchObject({modelStatus:'UNKNOWN',modelName:null,modelVersion:null,country:null,region:null,language:null,loggedIn:'UNKNOWN',personalizationState:'UNKNOWN',freshConversation:'UNKNOWN',searchUsed:'UNKNOWN'});
  });
  it('does not infer search use from citations or treat the current edited question as historical text',()=>{
    const p=observationProject(),r=p.responses[0];const before=buildResponseObservationContext(p,r.id);
    expect(before.searchUsed).toBe('UNKNOWN');p.questions[0].text='後で編集した質問';expect(buildResponseObservationContext(p,r.id).queryTextHash).toBe(before.queryTextHash);
    delete r.questionText;delete r.consumer;expect(buildResponseObservationContext(p,r.id).queryTextHash).toBeNull();
  });
  it.each([
    {provider:'Gemini'}, {observationMethod:'API_OBSERVATION' as const},
    {sourceIssues:['QUESTION_TEXT_CONFLICT'] as const},
  ])('retains raw data but marks contradictory evidence as conflict %#',change=>{
    const context=buildObservationContext({...observationInput(),...change,sourceIssues:change.sourceIssues?[...change.sourceIssues]:undefined});
    expect(context.status).toBe('CONFLICT');expect(compareObservationContexts(context,buildObservationContext(observationInput())).status).toBe('NOT_COMPARABLE');
  });
  it('detects consumer project, method, timestamp and question evidence conflicts',()=>{
    const p=observationProject(),r=p.responses[0];r.consumer!.projectId='OTHER';r.consumer!.method='DEMO';r.consumer!.actualQuestion='different';r.consumer!.answerRecordedAt='2026-10-02T00:00:00Z';
    const context=buildResponseObservationContext(p,r.id);expect(context.status).toBe('CONFLICT');expect(context.issues).toEqual(expect.arrayContaining(['PROJECT_MISMATCH','METHOD_CONFLICT','QUESTION_TEXT_CONFLICT','OBSERVED_AT_CONFLICT']));
  });
  it('hashes exact UTF-8 question text, including whitespace, line endings and Unicode',()=>{
    expect(queryTextHash('질문')).toBe(queryTextHash('질문'));
    for(const text of ['질문 ',' 질문','질\n문','질\r\n문','다른 질문'])expect(queryTextHash(text)).not.toBe(queryTextHash('질문'));
    expect(queryTextHash('a\nb')).not.toBe(queryTextHash('a\r\nb'));expect(queryTextHash('é')).not.toBe(queryTextHash('e\u0301'));
  });
  it('excludes response IDs, time, run, study and phase from condition while retaining distinct contexts',()=>{
    const a=buildObservationContext(observationInput()),b=buildObservationContext({...observationInput(),responseId:'RESPONSE_TEST_2',observedAt:'2026-10-02T00:00:00Z',runNumber:2,studyId:'STUDY_TEST',phase:'FOLLOW_UP'});
    expect(a.conditionHash).toBe(b.conditionHash);expect(a.checksum).not.toBe(b.checksum);expect(a.runNumber).toBe(1);expect(b.runNumber).toBe(2);expect(compareObservationContexts(a,b).status).toBe('COMPARABLE');
  });
  it.each([
    {observationMethod:'DEMO' as const},{region:'BUSAN'},{modelVersion:'v2'},{queryText:'실제 다른 문구'},
    {searchUsed:'FALSE' as const},{loggedIn:'YES' as const},{personalizationState:'ENABLED' as const},{freshConversation:'FALSE' as const},
  ])('changes condition hash for changed comparison field %#',change=>expect(buildObservationContext({...observationInput(),...change}).conditionHash).not.toBe(buildObservationContext(observationInput()).conditionHash));
  it('preserves DEMO method instead of promoting a consumer screen to real observation',()=>{
    const context=buildObservationContext({...observationInput(),observationMethod:'DEMO'});expect(context.observationMethod).toBe('DEMO');
    expect(compareObservationContexts(context,buildObservationContext(observationInput())).status).toBe('NOT_COMPARABLE');
  });
  it.each(['email','phone','accountId','cookie','sessionToken','gps','apiKey','rawText'])('rejects private/unrecognized context field %s',field=>expect(()=>buildObservationContext({...observationInput(),[field]:'PRIVATE'})).toThrow());
  it.each(['person@example.invalid','010-1234-5678','37.566500,126.978000'])('rejects sensitive stored location metadata %s',region=>expect(()=>buildObservationContext({...observationInput(),region})).toThrow());
  it('rejects tampered context hashes and invalid model claims',()=>{
    const context=buildObservationContext(observationInput());expect(()=>assertObservationContext({...context,region:'OTHER'})).toThrow();
    expect(()=>buildObservationContext({...observationInput(),modelStatus:'UNKNOWN'})).toThrow();
    expect(()=>buildObservationContext({...observationInput(),evidenceRefs:[{projectId:'OTHER',id:'EVIDENCE_TEST',kind:'EVIDENCE'}]})).toThrow();
  });
  it('produces warnings for unknown model/fresh conversation, hard failures for unknown channel/query or cross-project comparisons',()=>{
    const a=buildObservationContext({...observationInput(),modelStatus:'UNKNOWN',modelName:null,modelVersion:null,freshConversation:'UNKNOWN'});
    const b=buildObservationContext({...observationInput(),responseId:'RESPONSE_TEST_2',modelStatus:'UNKNOWN',modelName:null,modelVersion:null,freshConversation:'UNKNOWN'});
    expect(compareObservationContexts(a,b)).toMatchObject({status:'COMPARABLE_WITH_WARNINGS',warnings:expect.arrayContaining(['UNKNOWN_modelName','UNKNOWN_freshConversation'])});
    expect(compareObservationContexts(a,buildObservationContext({...observationInput(),projectId:'OTHER'})).status).toBe('NOT_COMPARABLE');
    expect(compareObservationContexts(buildObservationContext({...observationInput(),consumerScreen:undefined}),a).status).toBe('NOT_COMPARABLE');
    expect(compareObservationContexts(buildObservationContext({...observationInput(),queryText:null}),a).status).toBe('NOT_COMPARABLE');
    expect(compareObservationContexts(buildObservationContext(observationInput()),buildObservationContext({...observationInput(),region:'BUSAN'})).status).toBe('NOT_COMPARABLE');
  });
  it('keeps raw provider/screen/text, Snapshot and Report hashes unchanged during repeated projections',()=>{
    const p=observationProject(),before=canonicalChecksum(p);for(let n=0;n<10;n++)buildResponseObservationContext(p,p.responses[0].id);
    expect(canonicalChecksum(p)).toBe(before);const json=JSON.stringify(buildResponseObservationContext(p,p.responses[0].id));
    for(const privateValue of ['SYNTHETIC PRIVATE RAW','SYNTHETIC_PERSON_NOT_TO_COPY','SYNTHETIC_SECRET_NOT_TO_COPY','https://example.invalid/citation'])expect(json).not.toContain(privateValue);
  });
});

describe('existing observation adapters and sidecar repository',()=>{
  it('reads PreScan, Research and Pilot source links without changing snapshots, plans or reports',()=>{
    const f=activate(pilotFixture(1)),prescanResponse=f.p.responses[0],beforeScan=canonicalChecksum(f.p);
    expect(buildResponseObservationContext(f.p,prescanResponse.id).sourceDomain).toBe('PRESCAN');expect(canonicalChecksum(f.p)).toBe(beforeScan);
    const plan=baseline(f),condition=plan.conditions[0];
    storeConsumerRows(f.p,[{projectId:f.p.id,questionId:condition.questionId,kind:'CONSUMER_UI_MANUAL',screen:condition.screen,model:condition.model,actualQuestion:condition.actualQuestion,questionSubmittedAt:'2026-10-14T00:00:00Z',answerRecordedAt:'2026-10-14T00:01:00Z',country:condition.country,region:condition.region,searchUsage:'USED',rawText:'SYNTHETIC FOLLOWUP ONLY',citations:[],consumerScreenConfirmed:true,observer:'SYNTHETIC TEST',studyId:plan.studyId,phase:'FOLLOW_UP',repetition:1,evidenceIds:[],inputKey:'00000000-0000-4000-8000-000000000083'}]);
    const afterSetup=canonicalChecksum(f.p),context=buildResponseObservationContext(f.p,f.p.responses.at(-1)!.id);
    expect(context).toMatchObject({sourceDomain:'PILOT',studyId:plan.studyId,phase:'FOLLOW_UP',runNumber:1});expect(context.status).not.toBe('CONFLICT');expect(canonicalChecksum(f.p)).toBe(afterSetup);
    const research=structuredClone(f.p);delete research.operations;delete research.client.preScanRepository;expect(buildResponseObservationContext(research,research.responses.at(-1)!.id).sourceDomain).toBe('RESEARCH');
  });
  it('reads all five CITED platforms without inventing channels or changing stored payload/digest',()=>{
    const p=observationProject(),profile={brand:p.client.name,region:'SEOUL',service:'SYNTHETIC',count:10 as const},query=generateQueries(profile)[0];
    const snapshot=attachDiagnosis(p,{version:1,profile,observations:platforms.map(platform=>({queryId:query.id,platform,status:'observed',mentioned:false,recommended:false,cited:false,rawText:'SYNTHETIC CITED RAW',observedAt:observationAt,model:'SYNTHETIC_MODEL'}))},'SYNTHETIC_ACTOR');
    const before=canonicalChecksum(p),contexts=snapshot.responseIds.map(id=>buildCitedObservationContext(p,snapshot.id,id));
    expect(contexts.map(c=>c.platformCode)).toEqual(['CHATGPT','GEMINI','CLAUDE','PERPLEXITY','GOOGLE_AI']);expect(contexts.every(c=>c.channelCode===null&&c.observationMethod==='MANUAL_OBSERVATION'&&c.searchUsed==='UNKNOWN')).toBe(true);expect(canonicalChecksum(p)).toBe(before);
    snapshot.digest='tampered';expect(()=>buildCitedObservationContext(p,snapshot.id,snapshot.responseIds[0])).toThrow();
  });
  it('reads API measurement search evidence without inferring ChatGPT or copying provider response tokens',()=>{
    const p=observationProject(),r=p.responses[0];delete r.consumer;r.provider='OpenAI';r.kind='API_OBSERVATION';
    r.measurement={batchId:'BATCH_TEST',questionText:r.questionText!,status:'SUCCEEDED',searchUsed:true,apiResponseId:'PRIVATE_API_RESPONSE_ID',requestId:'PRIVATE_REQUEST_ID',apiStatus:'completed',usage:null,searchCalls:[],citedSources:[],rawOutput:{private:'PRIVATE_API_PAYLOAD'},errorCode:null,errorMessage:null,durationMs:1,costEstimate:{usd:null,basis:'SYNTHETIC',rates:null}};
    const context=buildResponseObservationContext(p,r.id);expect(context).toMatchObject({platformCode:null,channelCode:null,providerCode:'OPENAI',searchUsed:'TRUE',sourceDomain:'API'});
    expect(JSON.stringify(context)).not.toContain('PRIVATE_API');r.measurement.status='FAILED';expect(buildResponseObservationContext(p,r.id).searchUsed).toBe('UNKNOWN');
  });
  it('enforces scoped references and append-only sidecar revisions without merging repeated runs',()=>{
    const repo=createInMemoryObservationContextRepository({authorize:(actor,p)=>actor==='ACTOR_TEST'&&p==='PROJECT_TEST',ownsResponse:(p,r,q)=>p==='PROJECT_TEST'&&['RESPONSE_TEST','RESPONSE_TEST_2'].includes(r)&&q==='QUERY_TEST',ownsQuery:(p,q)=>p==='PROJECT_TEST'&&['QUERY_TEST','UNRELATED_OWNED_QUERY'].includes(q),ownsReference:(p,id)=>p==='PROJECT_TEST'&&id==='EVIDENCE_TEST'});
    const a=buildObservationContext({...observationInput(),evidenceRefs:[{projectId:'PROJECT_TEST',id:'EVIDENCE_TEST',kind:'EVIDENCE'}]}),audit={actorId:'ACTOR_TEST',createdAt:observationAt,reason:'SYNTHETIC SIDECAR TEST'};
    const v1=repo.append(a,0,audit),v2=repo.append(buildObservationContext({...observationInput(),language:'en-US'}),1,audit);
    expect(v2.previousChecksum).toBe(v1.checksum);expect(repo.getVersion(a.projectId,a.responseId,1,'ACTOR_TEST')).toEqual(v1);expect(repo.listVersions(a.projectId,a.responseId,'ACTOR_TEST')).toHaveLength(2);
    expect(()=>repo.append(a,0,audit)).toThrow();expect(()=>repo.get(a.projectId,a.responseId,'OTHER_ACTOR')).toThrow();
    expect(()=>repo.append(buildObservationContext({...observationInput(),queryId:'OTHER_QUERY'}),0,audit)).toThrow();
    expect(()=>repo.append(buildObservationContext({...observationInput(),queryId:'UNRELATED_OWNED_QUERY'}),2,audit)).toThrow();
    expect(()=>repo.append(buildObservationContext({...observationInput(),evidenceRefs:[{projectId:'PROJECT_TEST',id:'MISSING',kind:'EVIDENCE'}]}),2,audit)).toThrow();
    const repeated=repo.append(buildObservationContext({...observationInput(),responseId:'RESPONSE_TEST_2',runNumber:2}),0,audit);expect(repeated.revision).toBe(1);expect(repeated.context.conditionHash).toBe(a.conditionHash);
  });
});
