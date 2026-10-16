import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireStaff,sameOrigin,accessEvent} from '../../auth';
import {PlatformApplicationService} from './service';
import {commandSchema,querySchema} from './contracts';
import {PlatformServiceError,serviceError,statuses} from './errors';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const limit=new Map<string,{start:number;count:number}>();
function rate(id:string){const now=Date.now(),old=limit.get(id);if(!old||now-old.start>=60000){if(limit.size>=10000)for(const [key,v]of limit)if(now-v.start>=60000)limit.delete(key);if(limit.size>=10000)throw new PlatformServiceError('RATE_LIMITED');limit.set(id,{start:now,count:1});}else if(++old.count>30)throw new PlatformServiceError('RATE_LIMITED');}
const groups:Record<string,readonly string[]>={knowledge:['KNOWLEDGE_CREATE','KNOWLEDGE_SUBMIT','KNOWLEDGE_APPROVE','KNOWLEDGE_RETIRE'],rules:['RULE_DRAFT','RULE_PUBLISH','RULESET_DRAFT','RULESET_PUBLISH','READINESS_POLICY_PUBLISH'],actions:['ACTION_CREATE','ACTION_SUBMIT','ACTION_APPROVE','ACTION_RETIRE'],observations:['OBSERVATION_CAPTURE'],readiness:['READINESS_EVALUATE'],'action-candidates':['PREPARE_WORK'],executions:['EXECUTION_LINK'],experiments:['MEASUREMENT_FREEZE','EXPERIMENT_CREATE','EXPERIMENT_RESULT'],insights:['INSIGHT_POLICY_APPROVE','INSIGHT_AGGREGATE']};
function target(segments:unknown){const parts=z.array(z.string().regex(/^[A-Za-z0-9_-]+$/).max(160)).min(1).max(4).parse(segments);if(parts.length===1&&['catalog','knowledge','rules','actions','insights'].includes(parts[0]))return {resource:parts[0]};if(parts[0]==='projects'&&parts.length===3&&['overview','observations','readiness','action-candidates','executions','experiments'].includes(parts[2]))return {resource:parts[2],projectId:parts[1]};if(parts[0]==='projects'&&parts.length===4&&parts[2]==='platforms')return {resource:'platform',projectId:parts[1],platformCode:parts[3]};throw new PlatformServiceError('NOT_FOUND');}
async function body(req:NextRequest){if(Number(req.headers.get('content-length')??0)>65536)throw new PlatformServiceError('INVALID_INPUT');if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new PlatformServiceError('INVALID_INPUT');const reader=req.body?.getReader();if(!reader)throw new PlatformServiceError('INVALID_INPUT');const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new PlatformServiceError('INVALID_INPUT');}chunks.push(value);}}finally{reader.releaseLock();}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new PlatformServiceError('INVALID_INPUT');}}
export function createPlatformHttpHandler(service=new PlatformApplicationService()){
 return async(req:NextRequest,context:{params:Promise<{segments:string[]}>})=>{try{
  const user=await requireStaff(req,['OWNER','MANAGER','ANALYST']);const t=target((await context.params).segments);
  if(req.method==='GET'){
   const entries=[...req.nextUrl.searchParams.entries()];if(new Set(entries.map(([k])=>k)).size!==entries.length)throw new PlatformServiceError('INVALID_INPUT');const filters=z.strictObject({channelCode:z.string().optional(),platformCode:z.string().optional()}).parse(Object.fromEntries(entries));if(!t.projectId&&entries.length)throw new PlatformServiceError('INVALID_INPUT');if(t.platformCode&&filters.platformCode)throw new PlatformServiceError('INVALID_INPUT');
   const q=querySchema.parse({...t,...filters}),value=await service.read(user,q);if(t.projectId||t.resource==='insights'||t.resource==='catalog')await accessEvent(user,'PI READ:'+t.resource,t.projectId);return NextResponse.json(value,{headers});
  }
  if(req.method!=='POST')throw new PlatformServiceError('NOT_FOUND');
  if([...req.nextUrl.searchParams].length)throw new PlatformServiceError('INVALID_INPUT');
  if(!req.headers.get('origin'))throw new PlatformServiceError('FORBIDDEN');try{sameOrigin(req);}catch{throw new PlatformServiceError('FORBIDDEN');}
  const raw=await body(req),command=commandSchema.parse(raw);if(!groups[t.resource]?.includes(command.operation))throw new PlatformServiceError('INVALID_INPUT');rate(user.id);
  // The repository commits the command and its AuditEvent atomically; do not add a fallible post-commit write.
  const value=await service.command(user,raw,t.projectId);return NextResponse.json(value,{headers});
 }catch(error){const e=serviceError(error);return NextResponse.json({error:{code:e.code,message:e.code}},{status:statuses[e.code],headers});}};
}
export const platformHttpHandler=createPlatformHttpHandler();
