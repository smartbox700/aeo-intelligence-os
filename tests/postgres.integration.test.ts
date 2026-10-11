import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import type {ProviderAdapter} from '../src/lib/providers';
import {parseOpenAIResponse} from '../src/lib/openai-provider';
import {fixture} from './fixtures/openai-response';
import {runMeasurement,measurementInput} from '../src/lib/measurement-service';
import {seed} from '../src/lib/seed';
import {mutate,getStore} from '../src/lib/store';
it.skipIf(process.env.AEO_TEST_POSTGRES!=='1')('실제 PostgreSQL: 모의 어댑터 수집·출처·분석·묶음 저장/재조회 (DEMO)',async()=>{
 const env=await readFile('.env','utf8');const url=env.split(/\r?\n/).find(l=>l.startsWith('DATABASE_URL='))?.slice('DATABASE_URL='.length);if(!url)throw new Error('DATABASE_URL 필요');process.env.DATABASE_URL=url;process.env.STORAGE_MODE='postgres';
 const p=seed().projects[0];p.id=randomUUID();p.name='통합 테스트 SAMPLE';p.client.id=randomUUID();p.client.name='통합 테스트 고객';p.responses=[];p.audits=[];p.tasks=[];p.batches=[];
 const before=(await getStore()).projects.map(p=>p.id);const {prisma}=await import('../src/lib/db');const beforeMentionIds=await prisma.mention.findMany({select:{id:true},orderBy:{id:'asc'}}),beforeCitationIds=await prisma.citationSource.findMany({select:{id:true},orderBy:{id:'asc'}});await mutate(s=>s.projects.push(p));
 try{
  const adapter:ProviderAdapter={id:'MOCK_TEST',kind:'DEMO',collect:async input=>parseOpenAIResponse(fixture,input.question,input.batchId,'req_MOCK_TEST',1)};
  const input=measurementInput.parse({projectId:p.id,questionIds:[p.questions[0].id],provider:'OpenAI',region:'서울',idempotencyKey:randomUUID()});
  const result=await runMeasurement(input,adapter);expect(result.batch.kind).toBe('DEMO');expect(result.batch.status).toBe('COMPLETED');
  const stored=(await getStore()).projects.find(v=>v.id===p.id)!;expect(stored.responses).toHaveLength(1);expect(stored.responses[0].kind).toBe('DEMO');expect(stored.responses[0].measurement?.citedSources[0].title).toContain('공식 정보');expect(stored.responses[0].entityAnalysis?.entities[0].name).toBe('가상미소치과');expect(stored.batches?.[0].id).toBe(result.batch.id);
 }finally{await mutate(s=>{s.projects=s.projects.filter(v=>v.id!==p.id);});const after=(await getStore()).projects.map(p=>p.id);for(const id of before)expect(after).toContain(id);expect(await prisma.mention.findMany({select:{id:true},orderBy:{id:'asc'}})).toEqual(beforeMentionIds);expect(await prisma.citationSource.findMany({select:{id:true},orderBy:{id:'asc'}})).toEqual(beforeCitationIds);await prisma.$disconnect();}
},60000);
