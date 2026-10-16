import {z} from 'zod';
import {identifier,platformSchema,channelSchema,knowledgeDraftSchema} from '../knowledge/contracts';
import {ruleSchema,ruleSetSchema} from '../rules/registry';
import {actionDraftSchema} from '../actions/definitions';
import {experimentDraftSchema} from '../experiments/contracts';
import {cohortInputSchema,policyInputSchema} from '../insights/contracts';
import {rulePolicySchema,scorePolicySchema,evaluationScopeSchema} from '../readiness/contracts';

const positive=z.number().int().positive(),revision=z.number().int().nonnegative();
// Derive HTTP fields from domain shapes, then execute the full refined domain schema in the service.
function client(shape:z.ZodRawShape,excluded:string[]){return z.strictObject(Object.fromEntries(Object.entries(shape).filter(([key])=>!excluded.includes(key))));}
const base={expectedRevision:revision,reason:z.string().trim().min(1).max(600)};
const version={id:identifier,version:positive};
const choice={evaluationId:identifier,ruleId:identifier,ruleVersion:positive,actionId:identifier,actionVersion:positive};
const platform={platformCode:platformSchema,channelCode:channelSchema.nullable().default(null)};
const command=<T extends string,S extends z.ZodRawShape>(operation:T,shape:S)=>z.strictObject({...base,operation:z.literal(operation),...shape});
export const commandSchema=z.discriminatedUnion('operation',[
 command('KNOWLEDGE_CREATE',{data:knowledgeDraftSchema}),
 command('KNOWLEDGE_SUBMIT',version),command('KNOWLEDGE_APPROVE',version),command('KNOWLEDGE_RETIRE',version),
 command('RULE_DRAFT',{data:client(ruleSchema.shape,['audit','reviewedBy','reviewedAt','reviewStatus','retiredAt'])}),
 command('RULE_PUBLISH',{data:client(ruleSchema.shape,['audit','reviewedBy','reviewedAt','reviewStatus','retiredAt'])}),
 command('RULESET_DRAFT',{data:client(ruleSetSchema.shape,['audit','reviewedBy','reviewedAt','reviewStatus','retiredAt'])}),
 command('RULESET_PUBLISH',{data:client(ruleSetSchema.shape,['audit','reviewedBy','reviewedAt','reviewStatus','retiredAt'])}),
 command('ACTION_CREATE',{data:client(actionDraftSchema.shape,['environment','effectClaimStatus','retiredAt'])}),
 command('ACTION_SUBMIT',version),command('ACTION_APPROVE',version),command('ACTION_RETIRE',version),
 command('READINESS_POLICY_PUBLISH',{data:z.strictObject({ruleSetId:identifier,ruleSetVersion:positive,scope:client(evaluationScopeSchema.shape,['evidenceAsOf','projectId']).extend({projectId:identifier.nullable()}),scorePolicy:scorePolicySchema,checks:z.array(rulePolicySchema).min(1).max(1000)})}),
 command('INSIGHT_POLICY_APPROVE',{data:client(policyInputSchema.shape,['environment'])}),
 command('OBSERVATION_CAPTURE',{responseId:identifier}),
 command('READINESS_EVALUATE',platform),
 command('PREPARE_WORK',choice),
 command('EXECUTION_LINK',{...choice,taskId:identifier,expectedLinkRevision:revision}),
 command('MEASUREMENT_FREEZE',{phase:z.enum(['BASELINE','FOLLOW_UP']),from:z.iso.datetime(),to:z.iso.datetime(),studyId:identifier.nullable()}),
 command('EXPERIMENT_CREATE',{data:client(experimentDraftSchema.shape,['environment','projectId'])}),
 command('EXPERIMENT_RESULT',{experimentId:identifier,version:positive,expectedResultRevision:revision}),
 command('INSIGHT_AGGREGATE',{cohort:client(cohortInputSchema.shape,['environment']),policyId:identifier,policyVersion:positive}),
]);
export type ServerCommand=z.infer<typeof commandSchema>;
export const querySchema=z.strictObject({resource:z.enum(['catalog','knowledge','rules','actions','overview','platform','observations','readiness','action-candidates','executions','experiments','insights']),projectId:identifier.optional(),platformCode:platformSchema.optional(),channelCode:channelSchema.optional()});
export type ServerQuery=z.infer<typeof querySchema>;
const forbidden=new Set(['actorId','authorizedProjectIds','environment','checkedAt','cutoffAt','createdAt','reviewedAt','reviewedBy','sourceState','consentState','effectClaimStatus']);
export function rejectClientAuthority(value:unknown):void{if(Array.isArray(value)){value.forEach(rejectClientAuthority);return;}if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(forbidden.has(key))throw Error('CLIENT_AUTHORITY_OVERRIDE');rejectClientAuthority(v);}}
