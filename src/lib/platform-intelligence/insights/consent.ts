import type {ProjectData} from '../../types';
import type {Experiment} from '../experiments/contracts';
import {ownPilot,permission,proofSchema} from '../../pilot-common';
import {canonicalChecksum,immutable,timestamp} from '../knowledge/contracts';
import {CONSENT_POLICY_VERSION} from './contracts';

export function inspectInsightConsent(project:ProjectData,experiment:Pick<Experiment,'consentRefs'|'environment'>,checkedAt:string){
  timestamp.parse(checkedAt);const date=new Date(checkedAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}),reasons:string[]=[],states:unknown[]=[];
  const refs=experiment.consentRefs,agreements=[...new Set(refs.map(r=>r.agreementId))];
  if(refs.some(r=>r.projectId!==project.id))reasons.push('CONSENT_PROJECT_MISMATCH');
  if(agreements.length!==1)reasons.push(agreements.length?'AMBIGUOUS_CONSENT_SCOPE':'MISSING_CONSENT_REFERENCE');
  for(const category of ['INTERNAL_RESEARCH','ANONYMIZED_STATISTICS'] as const){
    let valid=false;
    if(agreements.length===1)try{
      const agreement=ownPilot(project,agreements[0]);
      const referenced=refs.map(ref=>agreement.consents.find(c=>c.id===ref.consentId)).filter(c=>c?.category===category);
      const latest=agreement.consents.filter(c=>c.category===category).at(-1);
      const agreementProof=agreement.versions.at(-1)?.agreement;
      states.push({category,agreementId:agreement.id,agreementStatus:agreement.status,agreementKind:agreement.kind,agreementProofHash:canonicalChecksum(agreementProof??null),referencedIds:referenced.map(c=>c!.id).sort(),latest:latest?{id:latest.id,decision:latest.decision,from:latest.from,to:latest.to,at:latest.at,checksum:canonicalChecksum(latest)}:null});
      const proof=latest?proofSchema.safeParse(latest.proof):null,agreementProofValid=proofSchema.safeParse(agreementProof).success;
      const documents=latest?.proof.documentIds.map(id=>project.operations?.pilot?.documents.find(d=>d.id===id&&d.projectId===project.id))??[];
      states.push({category,documentHashes:documents.map(d=>d?canonicalChecksum(d):null)});
      valid=!!referenced.length&&!!latest&&agreement.status!=='TERMINATED'&&!!agreementProof&&agreementProofValid&&!!proof?.success&&Date.parse(agreementProof.checkedAt)<=Date.parse(checkedAt)&&Date.parse(latest.at)<=Date.parse(checkedAt)&&Date.parse(latest.proof.checkedAt)<=Date.parse(checkedAt)&&documents.every(Boolean)&&permission(agreement,category,date)&&(experiment.environment!=='PRODUCTION'||agreement.kind==='CLIENT');
    }catch{reasons.push('CONSENT_SOURCE_MISSING');}
    if(!valid)reasons.push('CONSENT_'+category+'_REQUIRED');
  }
  return immutable({allowed:reasons.length===0,reasons:[...new Set(reasons)].sort(),stateHash:canonicalChecksum({projectId:project.id,refs:refs.slice().sort((a,b)=>a.consentId.localeCompare(b.consentId)),states,policy:CONSENT_POLICY_VERSION})});
}
