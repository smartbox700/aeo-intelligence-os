import {spawn} from 'node:child_process';
const mode=process.argv[2]??'unit';
if(!['unit','pilot','e2e'].includes(mode))throw new Error('unit / pilot / e2e 모드를 선택하세요.');
const args=mode==='e2e'?['node_modules/@playwright/test/cli.js','test']:['node_modules/vitest/vitest.mjs','run',...(mode==='pilot'?['tests/pilot.test.ts']:[]),'--maxWorkers=1'];
const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true,env:{...process.env,LIVE_AI_ENABLED:'false',FREE_GEMINI_ENABLED:'false',...(mode!=='e2e'?{AEO_TEST_POSTGRES:'1'}:{}),...(mode==='unit'?{AEO_TEST_PDF:'1'}:{})}});
child.on('exit',code=>{process.exitCode=code??1;});
