import {readFile,readdir,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadEnvironment,connection,connect,inventory,stateRoot,safeCounts} from './db-runtime.mjs';
await loadEnvironment();
const baseline=JSON.parse(await readFile(path.join(stateRoot(),'backups','aeo-2026-10-10T01-11-28-895Z-5b2e12f7-56ad-49b0-b4ca-87357c1c10dd.aeo.gz.manifest.json')));
const db=await connect(connection());let inv;try{inv=await inventory(db);}finally{await db.end();}
const root=path.resolve('data'),files={};for(const directory of ['evidence','pilot-documents'])files[directory]=(await readdir(path.join(root,directory)).catch(e=>{if(e.code==='ENOENT')return [];throw e;})).sort();
const brand=await readFile(path.join(root,'sales-brand.json')).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const checks=Object.entries(baseline.tables).filter(([t])=>!['AccessEvent','StaffSession'].includes(t)).map(([t,v])=>({table:t,rowsUnchanged:v.sha256===inv.tables[t].sha256,idsUnchanged:JSON.stringify(v.ids)===JSON.stringify(inv.tables[t].ids)}));
const result={at:new Date().toISOString(),ok:checks.every(c=>c.rowsUnchanged&&c.idsUnchanged)&&baseline.schemaHash===inv.schemaHash,schemaUnchanged:baseline.schemaHash===inv.schemaHash,allRowsUnchanged:baseline.dataHash===inv.dataHash,dataHash:inv.dataHash,schemaHash:inv.schemaHash,counts:safeCounts(inv),checks,sourceFiles:files,brandPresent:brand!==null,brandSha256:brand&&createHash('sha256').update(brand).digest('hex'),aiFlagsDisabled:process.env.LIVE_AI_ENABLED==='false'&&process.env.FREE_GEMINI_ENABLED==='false'};
const run=process.argv[2];
if(run){
 if(!/^[-0-9a-f]{36}$/.test(run))throw new Error('Invalid isolated run');
 const directory=path.resolve('output','stage7-5',run),record=JSON.parse(await readFile(path.join(directory,'results.json')));
 const settings={};for(const line of (await readFile(path.join(directory,'runtime','.env'),'utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m)settings[m[1]]=m[2];}
 const u=new URL(settings.DATABASE_URL);if(!/^aeo_restore_test_[0-9a-f]{32}$/.test(record.restore.database)||u.pathname!=='/'+record.restore.database||path.resolve(settings.AEO_FILES_ROOT)!==path.resolve(record.restore.filesRoot)||path.resolve(record.restore.filesRoot)!==path.join(stateRoot(),'restore-tests',record.restore.database,'files'))throw new Error('Isolated cleanup scope mismatch');
 const brandPath=path.join(record.restore.filesRoot,'sales-brand.json');
 if(!record.restore.brandPresent){const contents=await readFile(brandPath).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(contents){if(JSON.parse(contents).company!=='LOCAL MOCK 복원 회사')throw new Error('Do not remove unknown company settings');await unlink(brandPath);}}
 const c=connection(),copy=await connect({...c,database:record.restore.database});let isolated;try{isolated=await inventory(copy);}finally{await copy.end();}
 const projectDataTables=['Project','ClientEntity','CompetitorEntity','QuestionSet','Question','ObservationRun','AIResponse','CitationSource','Mention','WebsiteAudit','OptimizationTask','Report','MeasurementBatch'];
 const customerRowsUnchanged=projectDataTables.every(t=>isolated.tables[t].sha256===inv.tables[t].sha256);
 const counts={};for(const folder of ['pilot-documents','evidence'])counts[folder]=(await readdir(path.join(record.restore.filesRoot,folder)).catch(e=>{if(e.code==='ENOENT')return [];throw e;})).length;
 result.isolatedCleanup={projectCount:isolated.tables.Project.count,customerRowsUnchanged,files:counts,brandPresent:await readFile(brandPath).then(()=>true,()=>false)};
 result.ok=result.ok&&customerRowsUnchanged&&Object.values(counts).every(n=>n===0)&&!result.isolatedCleanup.brandPresent;
 await writeFile(path.join(directory,'final-preservation.json'),JSON.stringify(result,null,2));
}
console.log(JSON.stringify(result,null,2));if(!result.ok||!result.aiFlagsDisabled)process.exitCode=1;
