const base='http://127.0.0.1:3000';
const response=await fetch(base+'/api/workspace');const s=await response.json();
if(!response.ok)throw new Error(s.error);
const sample=s.projects.find(p=>p.client.name==='홍제 A치과');
if(!sample)throw new Error('홍제 A치과가 없어 자동으로 새 고객을 만들지 않았습니다.');
const r=await fetch(base+'/api/measurements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'test-questions',projectId:sample.id})});const d=await r.json();if(!r.ok)throw new Error(d.error);
console.log(JSON.stringify({projectId:sample.id,existingResponsesPreserved:sample.responses.length,added:d.added}));
