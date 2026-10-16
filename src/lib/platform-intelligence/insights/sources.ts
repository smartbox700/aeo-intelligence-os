import type {Staff} from '../../auth';
import {assertProjectAccess} from '../../auth';
import type {ProjectData} from '../../types';
import type {Experiment} from '../experiments/contracts';
import type {ExperimentRepository,ExperimentResultRepository,ExperimentResultView} from '../experiments/repository';
import type {ActionExecutionView,ActionExecutionLinkRepository} from '../actions/bridge';
import type {ReadinessEvaluation} from '../readiness/contracts';
import {assertInsightOwner} from './contracts';

/** Trusted server enumeration, never a user-selected list of favorable results. No source payload is retained by the aggregation ledger. */
export interface InsightSourceReader {
  listProjects(actor:Staff):readonly ProjectData[];
  listExperiments(projectId:string,actor:Staff):readonly Experiment[];
  listResults(projectId:string,experimentId:string,actor:Staff):readonly ExperimentResultView[];
  listExecutions(projectId:string,actor:Staff):readonly ActionExecutionView[];
  readReadiness(projectId:string,evaluationId:string,actor:Staff):ReadinessEvaluation|undefined;
}
export function createInsightSourceReader(input:{listProjects(actor:Staff):readonly ProjectData[];experiments:ExperimentRepository;results:ExperimentResultRepository;executions:ActionExecutionLinkRepository;readReadiness:InsightSourceReader['readReadiness']}):InsightSourceReader {
  const access=(actor:Staff,id?:string)=>{assertInsightOwner(actor,'INTERNAL_RESEARCH');if(id)assertProjectAccess(actor,id);};
  return Object.freeze({
    listProjects(actor:Staff){access(actor);return input.listProjects(actor);},
    listExperiments(projectId:string,actor:Staff){access(actor,projectId);return input.experiments.listByProject(projectId,actor).flatMap(latest=>Array.from({length:latest.version},(_,i)=>input.experiments.get(projectId,latest.experimentId,actor,i+1)).filter((e):e is Experiment=>!!e));},
    listResults(projectId:string,id:string,actor:Staff){access(actor,projectId);return input.results.listResults(projectId,id,actor);},
    listExecutions(projectId:string,actor:Staff){access(actor,projectId);return input.executions.listByProject(projectId,actor);},
    readReadiness(projectId:string,id:string,actor:Staff){access(actor,projectId);return input.readReadiness(projectId,id,actor);},
  });
}
