import {it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {pilotFixture,activate,baseline,owner,brand} from './pilot-fixture';
import {parseStudioPage} from '../src/lib/studio-page';
import {attachStudioPage,createStudioWork} from '../src/lib/studio-workflow';
import {createClientReport} from '../src/lib/client-report';
import {createPilotOutcome} from '../src/lib/pilot-report';
import {pilotToday} from '../src/lib/pilot-common';
import {storeConsumerRows} from '../src/lib/consumer-observation';
import {verifyObservation} from '../src/lib/observation-verification';
import {freezePilotMeasurement} from '../src/lib/pilot-measurement';
import {attachDiagnosis} from '../src/lib/cited-project';
import {mutate,getStore} from '../src/lib/store';
import {connection,connect,loadEnvironment,inventory} from '../scripts/db-runtime.mjs';
import {backupIntegrated,restoreIntegrated} from '../scripts/integrated-backup.mjs';
import {readOnlyState,compareDomain} from '../scripts/platform-8-0-preservation.mjs';
it.skipIf(process.env.AEO_STAGE8_ISOLATED!=='1')('LOCAL MOCK: Snapshot/Report/Agreement/Consent/Studio/첨부의 통합 백업·격리 복원',async()=>{
 await loadEnvironment();const config=connection();if(!config.database.startsWith('aeo_restore_test_'))throw new Error('Isolated DB required; original data must not be used');
 const root=process.env.AEO_FILES_ROOT;if(!root||!root.includes('restore-tests'))throw new Error('Isolated attachment root required');
 const fixture=activate(pilotFixture());const plan=baseline(fixture);const p=fixture.p;const question=p.questions.find(q=>q.id===fixture.terms.questionIds[0])!;
 storeConsumerRows(p,[{questionId:question.id,kind:'CONSUMER_UI_MANUAL',screen:'CHATGPT_WEB_SEARCH',model:'LOCAL MOCK',actualQuestion:question.text,questionSubmittedAt:'2026-10-02T00:00:00Z',answerRecordedAt:'2026-10-02T00:01:00Z',country:'대한민국',region:'서울 홍제역',searchUsage:'USED',rawText:'LOCAL MOCK 후속 원문. 실제 AI 관측 아님.',citations:[],consumerScreenConfirmed:true,observer:'LOCAL MOCK 수집자',studyId:plan.studyId,phase:'FOLLOW_UP',repetition:1,evidenceIds:[],inputKey:randomUUID()}]);
 verifyObservation(p,{responseId:p.responses.at(-1)!.id,status:'VERIFIED',reviewer:'별도 LOCAL MOCK 검토자',note:'LOCAL MOCK 합성 자료 대조',sourceConfirmed:true},owner.id);freezePilotMeasurement(p,{id:fixture.a.id,planId:plan.id,phase:'FOLLOW_UP',source:'PILOT'},owner);
 attachDiagnosis(p,{version:1,profile:{brand:p.client.name,region:'서울 홍제역',service:'상담',count:10},observations:[]},owner.id);
 const page=parseStudioPage('<html><head><title>LOCAL MOCK 원본</title></head><body><h1>LOCAL MOCK</h1><p>합성 정보입니다.</p></body></html>',p.client.website,'MANUAL');attachStudioPage(p,page);createStudioWork(p,{pageId:page.id,questionId:p.questions[0].id,type:'FAQ',assignee:'LOCAL MOCK'},owner);
 createClientReport(p,{type:'INITIAL',kind:'CONSUMER_UI_MANUAL',from:'2026-10-01',to:'2026-10-31',purpose:'LOCAL MOCK 보존 검증'},owner);createPilotOutcome(p,{id:fixture.a.id,actualEnd:pilotToday(),remaining:[],nextStrategy:'LOCAL MOCK 후속 기록'},owner,brand);
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6XkAAAAASUVORK5CYII=','base64'),sha256=createHash('sha256').update(bytes).digest('hex'),at=new Date().toISOString();
 const eid=randomUUID(),did=randomUUID();for(const [folder,id] of [['evidence',eid],['pilot-documents',did]]){await mkdir(path.join(root,folder),{recursive:true});await writeFile(path.join(root,folder,id+'.png'),bytes,{flag:'wx'});}
 (p.client.evidenceFiles??=[]).push({id:eid,filename:'LOCAL-MOCK.png',storageName:eid+'.png',mime:'image/png',bytes:bytes.length,sha256,at,imageExtraction:'NOT_PERFORMED'});
 p.operations!.pilot!.documents.push({id:did,kind:'AGREEMENT',projectId:p.id,filename:'LOCAL-MOCK.png',storageName:did+'.png',mime:'image/png',bytes:bytes.length,sha256,at,actorId:owner.id,sensitiveDataExcluded:true});
 await mutate(s=>s.projects.push(p));const saved=(await getStore()).projects.find(v=>v.id===p.id)!;expect(saved.tasks.find(t=>t.studio)?.studio?.proposalId).toBe(p.tasks.find(t=>t.studio)?.execution?.proposalId);
 const beforeDb=await connect(config);let before;try{before=await readOnlyState(beforeDb);}finally{await beforeDb.end();}
 const backup=await backupIntegrated(),restored=await restoreIntegrated(backup.file,backup.keyFile);expect(restored.ok).toBe(true);expect(Reflect.get(restored,'fileCount')).toBeGreaterThanOrEqual(2);
 const target=await connect({...config,database:restored.database});let after;try{after=await readOnlyState(target);}finally{await target.end();}
 const comparison=compareDomain(before.domain,after.domain);expect(Object.values(comparison).every((v:any)=>v.equal)).toBe(true);
 for(const key of ['preScanSnapshots','citedSnapshots','reports','pilotSnapshots','agreements','consents','proposals','taskStudioRelations','evidence','pilotDocuments'])expect(before.domain[key].count,key).toBeGreaterThan(0);
 const check=await connect(config);try{expect((await inventory(check)).dataHash).toBe(before.inventory.dataHash);}finally{await check.end();}
 await mkdir('data/logs',{recursive:true});await writeFile('data/logs/platform-rich-preservation.json',JSON.stringify({label:'LOCAL MOCK ONLY',restoreOk:restored.ok,filesMatch:Reflect.get(restored,'filesMatch'),comparison,sourceOfTestUnchanged:true},null,2));
 // Remove only this generated fixture from the test DB; the separate restored copy remains evidence.
 await mutate(s=>{s.projects=s.projects.filter(item=>item.id!==p.id);});
 for(const [folder,id] of [['evidence',eid],['pilot-documents',did]])await unlink(path.join(root,folder,id+'.png'));
},120000);
