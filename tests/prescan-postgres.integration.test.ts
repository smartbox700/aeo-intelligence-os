import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {seed} from '../src/lib/seed';
import {onboard} from '../src/lib/operations';
import {generateUniverse,selectQueries,confirmSet,createPreScan,repository,saveScanRows,scanProgress,createSnapshot,freezeSnapshot,snapshotHash} from '../src/lib/prescan';
import {mutate,getStore} from '../src/lib/store';
it.skipIf(process.env.AEO_TEST_POSTGRES!=='1')('7-2 PostgreSQL: 120/30/90·수동 원문·버전·중단/재개·고정 Snapshot DB 재조회',async()=>{
 const env=await readFile('.env','utf8');process.env.DATABASE_URL=env.split(/\r?\n/).find(l=>l.startsWith('DATABASE_URL='))!.slice(13);process.env.STORAGE_MODE='postgres';
 const p=seed().projects[0];p.id=randomUUID();p.client.id=randomUUID();p.client.name='LOCAL MOCK · 7-2 DB 격리 · 실제 성과 아님';p.client.industry='치과';p.client.competitors=[];p.questions=[];p.responses=[];p.audits=[];p.tasks=[];p.batches=[];p.reports=[];delete p.operations;delete p.client.researchStudies;
 onboard(p,{kind:'CLIENT',profile:'MEDICAL',brandName:p.client.name,contactName:'',contactChannel:'',region:'홍제역',businessGoal:'시험',objectives:[],accountOwner:'시험',facts:{}});
 const u=generateUniverse(p,{profile:'MEDICAL',region:'서울 서대문구 홍제역',services:['임플란트','충치','스케일링','보철'],website:'https://local-mock.example/',officialConfirmed:true,goal:'상담'},'test');const set=confirmSet(p,{universeId:u.id,questionIds:selectQueries(u).questionIds,reason:'모의 선정 다양성 확인'},'test');const scan=createPreScan(p,{setId:set.id,screens:['CHATGPT_WEB_SEARCH','GEMINI_CONSUMER_SEARCH','NAVER_AI_BRIEFING'],date:'2026-10-09',owner:'시험'},'test');
 const q=set.questions[0];saveScanRows(p,{scanId:scan.id,observation:{projectId:p.id,questionId:q.id,kind:'CONSUMER_UI_MANUAL',screen:'CHATGPT_WEB_SEARCH',model:'LOCAL MOCK',actualQuestion:q.text,questionSubmittedAt:'2026-10-01T00:00:00Z',answerRecordedAt:'2026-10-01T00:01:00Z',country:'대한민국',region:'서울 서대문구 홍제역',searchUsage:'USED',rawText:'LOCAL MOCK DB 보존 시험. 실제 AI 답변 아님.',citations:[],consumerScreenConfirmed:true,observer:'시험 수집자',studyId:scan.studyId,phase:'BASELINE',repetition:1,evidenceIds:[],inputKey:randomUUID()}});const snap=createSnapshot(p,scan.id,'test');freezeSnapshot(p,snap.id);
 const before=(await getStore()).projects.map(p=>p.id);await mutate(s=>s.projects.push(p));
 try{const saved=(await getStore()).projects.find(v=>v.id===p.id)!;expect(repository(saved).universes[0].questions).toHaveLength(120);expect(repository(saved).sets[0].questions).toHaveLength(30);expect(scanProgress(saved,repository(saved).scans[0])).toMatchObject({total:90,collected:1,verified:0,unmeasured:89});expect(saved.responses[0].rawText).toBe(p.responses[0].rawText);expect(repository(saved).snapshots[0]).toEqual(snap);expect(snapshotHash(repository(saved).snapshots[0].data)).toBe(snap.sha256);expect(repository(saved).snapshots[0].data).not.toHaveProperty('rawText');}
 finally{await mutate(s=>{s.projects=s.projects.filter(v=>v.id!==p.id);});for(const id of before)expect((await getStore()).projects.some(p=>p.id===id)).toBe(true);const {prisma}=await import('../src/lib/db');await prisma.$disconnect();}
},60000);
