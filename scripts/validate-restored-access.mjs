import {readFile,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const directory=process.argv[2];if(!directory||!/^[-0-9a-f]{36}$/.test(directory))throw new Error('Verified stage7-5 run UUID required');
const cwd=process.cwd(),runtime=path.join(cwd,'output','stage7-5',directory,'runtime');
for(const f of ['tests/e2e/restore-access.spec.ts','tests/e2e/readiness-rehearsal.ts','tests/e2e/prescan.spec.ts','tests/e2e/studio.spec.ts','scripts/integrated-backup.mjs','scripts/db-runtime.mjs','scripts/backup-for-test.mjs'])await cp(path.join(cwd,f),path.join(runtime,f));
const env={...process.env};for(const line of (await readFile(path.join(runtime,'.env'),'utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m)env[m[1]]=m[2];}
const all=process.argv.includes('--all');
const results=[];for(const [label,args] of [['typecheck-final',['node_modules/typescript/bin/tsc','--noEmit']],[all?'e2e-final':'restore-access',['node_modules/@playwright/test/cli.js','test',...(all?[]:['restore-access.spec.ts'])]]]){let output='';const code=await new Promise(resolve=>{const c=spawn(process.execPath,args,{cwd:runtime,env,windowsHide:true});c.stdout.on('data',b=>output+=b);c.stderr.on('data',b=>output+=b);c.on('close',resolve);});await writeFile(path.join(cwd,'output','stage7-5',directory,label+'.log'),output.replaceAll(env.DATABASE_URL,'[ISOLATED_DATABASE_URL]'));results.push({label,exitCode:code});console.log(JSON.stringify(results.at(-1)));if(code!==0)break;}
process.exitCode=results.every(r=>r.exitCode===0)?0:1;
