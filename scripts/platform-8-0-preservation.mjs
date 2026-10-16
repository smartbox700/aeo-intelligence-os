import {createHash} from 'node:crypto';
import {digest,inventory,logicalArchive} from './db-runtime.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
/** Hash-only proof: never emit customer names, original answers or credentials. */
export function domainContract(archive){
 const tables=Object.fromEntries(archive.tables.map(t=>[t.name,t.rows]));
 const records={};
 const put=(kind,id,value)=>{(records[kind]??=[]).push({id,sha256:digest(value)});};
 for(const p of tables.Project??[]){
  put('projects',p.id,{id:p.id,organizationId:p.organizationId});
  for(const proposal of p.operations?.proposals??[])put('proposals',p.id+':'+proposal.id,proposal);
  for(const a of p.operations?.pilot?.agreements??[]){
   put('agreements',p.id+':'+a.id,a);
   for(const c of a.consents??[])put('consents',a.id+':'+c.id,c);
   for(const s of a.snapshots??[])put('pilotSnapshots',a.id+':'+s.id,s);
   for(const plan of a.plans??[])put('pilotPlans',a.id+':'+plan.id,plan);
  }
  for(const d of p.operations?.pilot?.documents??[])put('pilotDocuments',p.id+':'+d.id,d);
 }
 for(const c of tables.ClientEntity??[]){
  put('clients',c.id,{id:c.id,projectId:c.projectId});
  const p=c.payload??{};
  for(const s of p.preScanRepository?.snapshots??[])put('preScanSnapshots',c.id+':'+s.id,s);
  for(const s of p.preScanRepository?.sets??[])put('querySets',c.id+':'+s.id,s);
  for(const u of p.preScanRepository?.universes??[])put('queryUniverses',c.id+':'+u.id,u);
  for(const s of p.citedDiagnoses??[])put('citedSnapshots',c.id+':'+s.id,s);
  for(const e of p.evidenceFiles??[])put('evidence',c.id+':'+e.id,e);
  for(const page of p.studioRepository?.pages??[])put('pageSnapshots',c.id+':'+page.id,page);
 }
 for(const q of tables.Question??[])put('questions',q.id,q);
 for(const r of tables.ObservationRun??[])put('observationRuns',r.id,{id:r.id,projectId:r.projectId,providerId:r.providerId,observedAt:r.observedAt,model:r.model,region:r.region,kind:r.kind});
 for(const r of tables.AIResponse??[]){put('rawText',r.id,{runId:r.runId,questionId:r.questionId,rawSha256:hash(r.rawText),screen:r.payload?.consumer?.screen??null,observedAt:r.payload?.observedAt,provider:r.payload?.provider});put('responses',r.id,r);}
 for(const r of tables.Report??[])put('reports',r.id,r);
 for(const t of tables.OptimizationTask??[])put('taskStudioRelations',t.id,t);
 for(const kind of Object.keys(records))records[kind].sort((a,b)=>a.id.localeCompare(b.id));
 const required=['projects','clients','questions','responses','rawText','observationRuns','queryUniverses','querySets','preScanSnapshots','reports','pilotSnapshots','pilotPlans','agreements','consents','taskStudioRelations','proposals','pageSnapshots','citedSnapshots','evidence','pilotDocuments'];
 return Object.fromEntries(required.map(kind=>[kind,{count:records[kind]?.length??0,sha256:digest(records[kind]??[])}]));
}
export function compareDomain(before,after){return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(after)])].map(k=>[k,{beforeCount:before[k]?.count??0,afterCount:after[k]?.count??0,equal:digest(before[k])===digest(after[k]),coverage:before[k]?.count?'PRESENT':'EMPTY_IN_SOURCE'}]));}
export async function readOnlyState(db){
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const readOnly=(await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only;
  const inv=await inventory(db),archive=await logicalArchive(db);
  const columns=(await db.query("SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
  const indexes=(await db.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname")).rows;
  const constraints=(await db.query("SELECT c.relname AS table_name,k.conname,k.contype,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid WHERE k.connamespace='public'::regnamespace ORDER BY c.relname,k.conname")).rows;
  const migrationTable=archive.tables.find(t=>t.name==='_prisma_migrations');
  const migrationHistory=migrationTable?migrationTable.rows.map(r=>({migrationName:r.migration_name,checksum:r.checksum,finishedAt:r.finished_at,rolledBackAt:r.rolled_back_at,appliedStepsCount:r.applied_steps_count})):null;
  const version=(await db.query('SELECT version() AS version')).rows[0].version;
  await db.query('COMMIT');
  return {readOnly,version,inventory:inv,domain:domainContract(archive),ddl:{tables:archive.tables.map(t=>({name:t.name,ddl:t.ddl})),columns,indexes,constraints,migrationHistory}};
 }catch(e){await db.query('ROLLBACK');throw e;}
}
