import type {ProjectData,ResponseRecord} from '../../types';
import {visibilityMetrics} from '../../visibility';
import {confirmedMetrics,CALCULATION_VERSION} from '../../reporting-metrics';
import type {ExperimentDraft} from './contracts';

/** Adapt existing counters/definitions after the explicit-asOf eligibility gate; no clock or new metric semantics. */
export function pairedMetric(project:ProjectData,rows:ResponseRecord[],metric:ExperimentDraft['metric']){
  if(metric.namespace!=='confirmedMetrics'||metric.metricVersion!==CALCULATION_VERSION)throw Error('Unknown metric namespace/version');
  const kinds=new Set(rows.map(r=>r.kind));if(kinds.size>1)throw Error('Consumer/API/method aggregation denied');
  const m=visibilityMetrics(rows,project);
  const templates=confirmedMetrics({...project,responses:[]},{kind:rows[0]?.kind??'CONSUMER_UI_MANUAL'}).definitions;
  const countMap={clientCount:m.clientCount,recommendations:m.recommendations,citations:m.citations};
  if(metric.metricId in countMap){const numerator=countMap[metric.metricId as keyof typeof countMap];return {numerator,denominator:null,value:numerator,unit:'COUNT' as const,definition:'confirmedMetrics.'+metric.metricId};}
  const numerator=metric.metricId==='Brand Mention Rate'?m.clientCount:metric.metricId==='Recommendation Inclusion Rate'?m.recommendations:m.citations;
  const denominator=metric.metricId==='Recommendation Inclusion Rate'?m.recommendationN:m.n;
  return {numerator,denominator,value:denominator?numerator/denominator:null,unit:'PERCENTAGE_POINTS' as const,definition:templates.find(t=>t.key===metric.metricId)!.definition};
}
