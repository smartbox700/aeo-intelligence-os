import {it,expect,vi,afterEach} from 'vitest';
import {OpenAIWebSearchAdapter,measurementConfig} from '../src/lib/openai-provider';
import {postOpenAI} from '../src/lib/audit';
import {runMeasurement,measurementInput} from '../src/lib/measurement-service';
import {seed} from '../src/lib/seed';
import {liveAIEnabled} from '../src/lib/live-ai';
afterEach(()=>vi.unstubAllEnvs());
it('등록 키가 있어도 false이면 전송·어댑터·배치 예약 전에 차단',async()=>{
 vi.stubEnv('LIVE_AI_ENABLED','false');vi.stubEnv('OPENAI_API_KEY','TEST_ONLY_NOT_REAL');const transport=vi.fn();const adapter=new OpenAIWebSearchAdapter(transport);
 expect(measurementConfig()).toMatchObject({configured:true,liveEnabled:false});await expect(postOpenAI({},'TEST_ONLY_NOT_REAL')).rejects.toThrow('LIVE_AI_ENABLED=false');
 await expect(adapter.collect({question:'테스트',region:'서울',batchId:'test',model:'test'})).rejects.toThrow('API 실측 대기');
 const state=seed();const mutation=vi.fn();const repo={read:async()=>state,mutate:mutation};const input=measurementInput.parse({projectId:state.projects[0].id,questionIds:[state.projects[0].questions[0].id],provider:'OpenAI',region:'서울',idempotencyKey:crypto.randomUUID()});
 await expect(runMeasurement(input,adapter,repo)).rejects.toThrow('LIVE_AI_ENABLED=false');expect(transport).not.toHaveBeenCalled();expect(mutation).not.toHaveBeenCalled();
});
it('설정 누락·오타는 기본 차단',()=>{for(const value of ['', 'false','yes','1','tru']){vi.stubEnv('LIVE_AI_ENABLED',value);expect(liveAIEnabled()).toBe(false);}});
