import {it,expect} from 'vitest';
import {domainContract,compareDomain} from '../scripts/platform-8-0-preservation.mjs';
it('보존 증거에는 원문·고객명을 노출하지 않고 변경된 원문/버전/관계를 탐지한다',()=>{
 const archive={tables:[{name:'Project',rows:[{id:'p',organizationId:'org',operations:{proposals:[{id:'proposal',versions:[{version:1}]}],pilot:{agreements:[{id:'agreement',versions:[{version:1}],consents:[{id:'consent',decision:'GRANTED'}],snapshots:[{id:'snap',sha256:'old'}]}]}}}]},{name:'ClientEntity',rows:[{id:'client',projectId:'p',payload:{name:'PRIVATE-NAME',preScanRepository:{snapshots:[{id:'before',sha256:'frozen'}]}}}]},{name:'AIResponse',rows:[{id:'r',runId:'run',questionId:'q',rawText:'PRIVATE-RAW',payload:{provider:'ChatGPT',consumer:{screen:'CHATGPT_WEB_SEARCH'}}}]}]};
 const before=domainContract(archive);expect(JSON.stringify(before)).not.toContain('PRIVATE');expect(compareDomain(before,domainContract(archive)).rawText.equal).toBe(true);
 const changed=structuredClone(archive);(changed.tables[2].rows[0] as {rawText:string}).rawText='changed';expect(compareDomain(before,domainContract(changed)).rawText.equal).toBe(false);
 const version=structuredClone(archive);(version.tables[0].rows[0] as any).operations.proposals[0].versions[0].version=2;expect(compareDomain(before,domainContract(version)).proposals.equal).toBe(false);
 expect(compareDomain(before,before).pilotPlans.coverage).toBe('EMPTY_IN_SOURCE');
});
