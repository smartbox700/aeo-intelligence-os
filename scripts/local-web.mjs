import next from 'next';
import http from 'node:http';
const port=Number(process.argv[2]);
if(!Number.isInteger(port)||port<3000||port>3010)throw new Error('로컬 포트 범위 오류');
const app=next({dev:true,hostname:'127.0.0.1',port});
await app.prepare();
const handle=app.getRequestHandler();
http.createServer((req,res)=>handle(req,res)).listen(port,'127.0.0.1',()=>console.log('로컬 개발 앱: http://127.0.0.1:'+port));
