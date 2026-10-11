export type RobotDecision={allowed:boolean|null;evidence:string};
/** RFC-style path matching for the current homepage only; not a crawler permission grant. */
export function robotAccess(text:string,agent:string,path:string):RobotDecision{
 const groups:{agents:string[];rules:{allow:boolean;path:string}[]}[]=[];let current={agents:[] as string[],rules:[] as {allow:boolean;path:string}[]};
 for(const original of text.split(/\r?\n/)){const line=original.split('#')[0].trim();const match=line.match(/^([\w-]+)\s*:\s*(.*)$/);if(!match)continue;const field=match[1].toLowerCase(),value=match[2].trim();if(field==='user-agent'){if(current.rules.length){groups.push(current);current={agents:[],rules:[]};}current.agents.push(value.toLowerCase());}else if((field==='allow'||field==='disallow')&&current.agents.length&&value)current.rules.push({allow:field==='allow',path:value});}
 if(current.agents.length)groups.push(current);if(!groups.length)return {allowed:null,evidence:'해석 가능한 User-agent 그룹 없음'};
 const target=agent.toLowerCase();const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&target.includes(a)));const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 const rules=selected.flatMap(g=>g.rules).filter(r=>{
  const anchor=r.path.endsWith('$');const pattern=(anchor?r.path.slice(0,-1):r.path).split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');try{return new RegExp('^'+pattern+(anchor?'$':'')).test(path);}catch{return false;}
 }).sort((a,b)=>b.path.replace(/[*$]/g,'').length-a.path.replace(/[*$]/g,'').length||Number(b.allow)-Number(a.allow));
 return {allowed:rules[0]?.allow??true,evidence:rules.length?`${agent}: ${rules[0].allow?'Allow':'Disallow'} ${rules[0].path} → ${path}`:`${agent}: ${path}에 일치하는 차단 규칙 없음`};
}
