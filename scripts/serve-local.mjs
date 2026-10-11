import {spawn} from 'node:child_process';
import {openSync,closeSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {loadEnvironment,connection,connect} from './db-runtime.mjs';
await loadEnvironment();
mkdirSync('data/logs',{recursive:true});
function launch(args,name){const log=openSync(path.join('data','logs',name+'.log'),'a');const child=spawn(process.execPath,args,{cwd:process.cwd(),detached:true,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',LIVE_AI_ENABLED:'false',FREE_GEMINI_ENABLED:'false'}});child.unref();closeSync(log);return child.pid;}
async function dbReady(){try{const db=await connect(connection());await db.end();return true;}catch{return false;}}
if(!await dbReady()){launch(['scripts/local-postgres.mjs'],'postgres');let ready=false;for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));if(await dbReady()){ready=true;break;}}if(!ready)throw new Error('로컬 DB 시작 확인 시간 초과 · data/logs/postgres.log를 확인하세요.');}
const free=port=>new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});
let port=3000;while(!await free(port)){if(++port>3010)throw new Error('사용 가능한 로컬 포트 없음');}
const pid=launch(['scripts/local-web.mjs',String(port)],'web-'+port);
const url='http://127.0.0.1:'+port;let ready=false;
for(let i=0;i<90;i++){await new Promise(r=>setTimeout(r,500));try{const r=await fetch(url+'/login',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}}
if(!ready)throw new Error('로컬 앱 시작 확인 실패 · data/logs/web-'+port+'.log를 확인하세요.');
console.log(JSON.stringify({url,pid,ready:true,externalAIEnabled:false}));
