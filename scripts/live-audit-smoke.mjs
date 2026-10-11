const base='http://127.0.0.1:3000/api/workspace';
async function post(body){const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
const {projectId}=await post({action:'create',client:{name:'공개 웹 진단 SAMPLE',aliases:[],website:'https://example.com',industry:'일반 기업',address:'',bookingUrl:'',services:'',experts:'',competitors:[{name:'공개 웹 비교 SAMPLE',aliases:[],website:'https://example.org'}]}});
try{
 await post({action:'audit',projectId});
 const s=await(await fetch(base)).json();const p=s.projects.find(p=>p.id===projectId);
 console.log(JSON.stringify({kind:p.audits[0].kind,findings:p.audits[0].findings.map(f=>({key:f.key,status:f.status})),comparisons:p.audits[0].competitorComparisons.map(c=>({name:c.name,status:c.status,findings:c.findings.length,differences:c.differences.length})),tasks:p.tasks.length},null,2));
 if(p.audits[0].kind!=='LIVE'||!p.audits[0].findings.some(f=>f.key==='http'&&f.status==='pass')||!p.tasks.length)throw new Error('실제 진단 검증 실패');
 if(!p.audits[0].competitorComparisons.some(c=>c.status==='SUCCEEDED'))throw new Error('공개 비교 홈페이지 진단 미검증');
}finally{await post({action:'delete',projectId});}
