import {readFile} from 'node:fs/promises';
import {loadEnvironment,connection,localConnection,connect,inventory,safeCounts} from './db-runtime.mjs';
await loadEnvironment();const file=process.argv[2];if(!file)throw new Error('기준 백업의 .manifest.json 경로가 필요합니다.');
const baseline=JSON.parse(await readFile(file,'utf8')),c=connection();localConnection(c);const db=await connect(c);
try{
 const actual=await inventory(db),tables=Object.keys(baseline.tables).filter(name=>!['AccessEvent','StaffSession'].includes(name));
 const checks=tables.map(table=>({table,count:actual.tables[table]?.count,unchanged:actual.tables[table]?.sha256===baseline.tables[table].sha256,idsMatch:JSON.stringify(actual.tables[table]?.ids)===JSON.stringify(baseline.tables[table].ids)}));
 const ok=checks.every(v=>v.unchanged&&v.idsMatch)&&actual.schemaHash===baseline.schemaHash;console.log(JSON.stringify({ok,schemaUnchanged:actual.schemaHash===baseline.schemaHash,counts:safeCounts(actual),checks,excludedVolatileTables:['AccessEvent','StaffSession']},null,2));if(!ok)process.exitCode=1;
}finally{await db.end();}
