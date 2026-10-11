import {PrismaClient, Prisma} from '../generated/prisma';
import type {Store,ProjectData,Entity,Question,ResponseRecord,Audit,Task,Competitor} from './types';
import {seed} from './seed';
const g=globalThis as unknown as {aeoPrisma?:PrismaClient};
export const prisma=g.aeoPrisma??new PrismaClient();
g.aeoPrisma=prisma;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const relationFingerprint=(rows:Record<string,unknown>[])=>JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
export async function loadDb(dbClient:Prisma.TransactionClient=prisma):Promise<Store>{
 const rows=await dbClient.project.findMany({where:{organizationId:'local-org'},include:{clients:true,competitors:true,sets:{include:{questions:true}},runs:{include:{responses:true}},audits:true,tasks:true,batches:true,reports:true},orderBy:{name:'asc'}});
return {schemaVersion:1,projects:rows.map(p=>({id:p.id,organizationId:p.organizationId,name:p.name,operations:p.operations? p.operations as unknown as import('./operations-types').Operations:undefined,salesReports:p.reports.filter(r=>r.payload&&(r.payload as {category?:string}).category==="AEO_SALES_SNAPSHOT").map(r=>r.payload as unknown as import("./sales-types").SalesReport),pilotReports:p.reports.filter(r=>(r.payload as {category?:string})?.category==="PILOT_OUTCOME").map(r=>r.payload as unknown as import("./pilot-types").PilotOutcomeReport),reports:p.reports.filter(r=>r.payload&&(r.payload as {category?:string}).category!=="AEO_SALES_SNAPSHOT"&&(r.payload as {category?:string}).category!=="PILOT_OUTCOME").map(r=>r.payload as unknown as import('./operations-types').ClientReport),client:{...(p.clients[0].payload as unknown as Entity),competitors:p.competitors.map(c=>c.payload as unknown as Competitor).sort((a,b)=>{const ids=((p.clients[0].payload as unknown as Entity).competitors??[]).map(c=>c.id);const ai=ids.indexOf(a.id),bi=ids.indexOf(b.id);return (ai<0?ids.length:ai)-(bi<0?ids.length:bi)||a.id.localeCompare(b.id);})},questions:p.sets.flatMap(s=>s.questions.map(q=>q.payload as unknown as Question)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)),responses:p.runs.flatMap(r=>r.responses.map(a=>({...a.payload as unknown as ResponseRecord,rawText:a.rawText}))),audits:p.audits.map(a=>a.payload as unknown as Audit),tasks:p.tasks.map(t=>t.payload as unknown as Task),batches:p.batches.map(b=>b.payload as unknown as import('./types').MeasurementBatch)}))};
}
export async function saveProject(tx:Prisma.TransactionClient,p:ProjectData){
 await tx.project.upsert({where:{id:p.id},create:{id:p.id,name:p.name,organizationId:p.organizationId,operations:p.operations?json(p.operations):undefined},update:{name:p.name,operations:p.operations?json(p.operations):undefined}});
 await tx.clientEntity.upsert({where:{id:p.client.id},create:{id:p.client.id,projectId:p.id,name:p.client.name,payload:json(p.client)},update:{name:p.client.name,payload:json(p.client)}});
 await tx.competitorEntity.deleteMany({where:{projectId:p.id}});
 if(p.client.competitors.length)await tx.competitorEntity.createMany({data:p.client.competitors.map(c=>({id:c.id,projectId:p.id,name:c.name,payload:json(c)}))});
 const setId=p.id+'-questions';
 await tx.questionSet.upsert({where:{id:setId},create:{id:setId,projectId:p.id,name:'소비자 질문'},update:{}});
 for(const q of p.questions)await tx.question.upsert({where:{id:q.id},create:{id:q.id,setId,text:q.text,payload:json(q)},update:{text:q.text,payload:json(q)}});
 for(const b of p.batches??[])await tx.measurementBatch.upsert({where:{id:b.id},create:{id:b.id,projectId:p.id,idempotencyKey:b.idempotencyKey,status:b.status,startedAt:new Date(b.startedAt),payload:json(b)},update:{status:b.status,payload:json(b)}});
 for(const r of p.responses){
  await tx.aIProvider.upsert({where:{id:r.provider},create:{id:r.provider,name:r.provider},update:{}});
  await tx.observationRun.upsert({where:{id:r.id},create:{id:r.id,projectId:p.id,providerId:r.provider,kind:r.kind,observedAt:new Date(r.observedAt),region:r.region,model:r.model,cost:r.cost,batchId:r.measurement?.batchId,status:r.measurement?.status??'LEGACY',searchUsed:r.measurement?.searchUsed,metadata:r.measurement?json(r.measurement):undefined},update:{}});
  // Original rawText is never updated; only derived analysis/review payload changes.
  await tx.aIResponse.upsert({where:{id:r.id},create:{id:r.id,runId:r.id,questionId:r.questionId,rawText:r.rawText,analysisVersion:r.analysisVersion,payload:json(r)},update:{analysisVersion:r.analysisVersion,payload:json(r)}});
  const mentions=r.mentions.map(m=>({entityId:m.entityId,role:m.role,position:m.position,ambiguous:m.ambiguous,name:m.name,responseId:r.id}));
  const oldMentions=await tx.mention.findMany({where:{responseId:r.id},select:{entityId:true,role:true,position:true,ambiguous:true,name:true,responseId:true}});
  if(relationFingerprint(mentions)!==relationFingerprint(oldMentions)){await tx.mention.deleteMany({where:{responseId:r.id}});if(mentions.length)await tx.mention.createMany({data:mentions});}
  const citations=r.citations.map(url=>({responseId:r.id,url,title:r.measurement?.citedSources.find(c=>c.url===url)?.title??null}));
  const oldCitations=await tx.citationSource.findMany({where:{responseId:r.id},select:{responseId:true,url:true,title:true}});
  if(relationFingerprint(citations)!==relationFingerprint(oldCitations)){await tx.citationSource.deleteMany({where:{responseId:r.id}});if(citations.length)await tx.citationSource.createMany({data:citations});}
 }
 for(const r of p.reports??[])await tx.report.upsert({where:{id:r.id},create:{id:r.id,projectId:p.id,kind:r.kind,rowCount:r.rowCount,payload:json(r)},update:{payload:json(r)}});
 for(const r of p.salesReports??[])await tx.report.upsert({where:{id:r.id},create:{id:r.id,projectId:p.id,kind:r.publicData.kind,rowCount:r.publicData.validResponses,payload:json(r)},update:{payload:json(r)}});
 for(const r of p.pilotReports??[])await tx.report.upsert({where:{id:r.id},create:{id:r.id,projectId:p.id,kind:r.kind,rowCount:r.data.comparison.platforms.reduce((n,s)=>n+s.followupN,0),payload:json(r)},update:{payload:json(r)}});
 for(const a of p.audits)await tx.websiteAudit.upsert({where:{id:a.id},create:{id:a.id,projectId:p.id,kind:a.kind,payload:json(a)},update:{}});
 for(const t of p.tasks)await tx.optimizationTask.upsert({where:{id:t.id},create:{id:t.id,projectId:p.id,auditId:t.auditId,status:t.status,payload:json(t)},update:{status:t.status,payload:json(t)}});
}
export async function initializeDb(){await prisma.$transaction(async tx=>{
 // Shared lock serializes initialization and writers across application processes.
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(742910)`;
 const existing=await tx.organization.findUnique({where:{id:'local-org'}});
 await tx.organization.upsert({where:{id:'local-org'},create:{id:'local-org',name:'로컬 워크스페이스'},update:{}});
 if(!existing)for(const p of seed().projects)await saveProject(tx,p);
},{timeout:30000});}
