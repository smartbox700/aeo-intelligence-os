import {readFile,access,writeFile,mkdir,cp,readdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {nativeBin,executable,loadEnvironment} from './db-runtime.mjs';
await loadEnvironment();
const root=path.join(process.cwd(),'output','stage7-5','environment-'+randomUUID());await mkdir(root,{recursive:true});
const exists=async p=>access(p).then(()=>true,()=>false);
const python=process.env.AEO_PDF_PYTHON||path.join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');
async function run(exe,args,cwd=process.cwd(),env=process.env,timeout=120000){return new Promise(resolve=>{let text='';const child=spawn(exe,args,{cwd,env,windowsHide:true}),timer=setTimeout(()=>child.kill(),timeout);child.stdout.on('data',b=>text+=b);child.stderr.on('data',b=>text+=b);child.on('error',()=>resolve({code:-1,text:'EXECUTION_FAILED'}));child.on('close',code=>{clearTimeout(timer);resolve({code:code??-1,text});});});}
const engineFiles=await readdir('node_modules/@prisma/engines');
const result={node:process.version,postgres:await run(executable(await nativeBin(),'postgres'),['--version']),python:await run(python,['-c','import sys,pypdf;print(sys.version);print(pypdf.__version__)']),koreanFont:await exists(path.join(process.env.WINDIR||'C:/Windows','Fonts','malgun.ttf')),edge:await exists('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'),playwright:JSON.parse(await readFile('node_modules/@playwright/test/package.json')).version,prismaPackage:JSON.parse(await readFile('node_modules/prisma/package.json')).version,generatedEngine:await exists('src/generated/prisma/query_engine-windows.dll.node'),schemaEngineInstalled:engineFiles.some(n=>n.startsWith('schema-engine')),networkDownloads:0};
// Copy the DLL and rename the copy, never replace the loaded production DLL.
const dll=path.join(root,'engine-copy.dll.node');await cp('src/generated/prisma/query_engine-windows.dll.node',dll);await rename(dll,dll+'.renamed');result.isolatedDllRename=true;
const clean=path.join(root,'clean-install');await mkdir(clean);for(const f of ['package.json','package-lock.json'])await cp(f,path.join(clean,f));
const npm=path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
result.offlineCleanInstall=await run(process.execPath,[npm,'ci','--offline','--ignore-scripts','--no-audit','--no-fund'],clean,{...process.env,npm_config_offline:'true',NEXT_TELEMETRY_DISABLED:'1'});
await writeFile(path.join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,...result},null,2));
