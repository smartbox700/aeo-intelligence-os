import type {Staff} from '../../auth';
import {canonicalChecksum,immutable} from '../knowledge/contracts';
import {assertInsightOwner} from './contracts';
import type {InsightAggregationRun} from './engine';

export type InsightRunState='CURRENT'|'STALE_BY_CONSENT_CHANGE'|'STALE_BY_SOURCE_CHANGE';
/** Aggregate projection has neither client labels nor source/project IDs, hashes, filenames, text or per-project values. */
export function projectInsightRun(run:InsightAggregationRun,actor:Staff,purpose:'INTERNAL_RESEARCH',state:InsightRunState='CURRENT'){
  assertInsightOwner(actor,purpose);const {checksum,...body}=run;if(canonicalChecksum(body)!==checksum)throw Error('Insight run integrity mismatch');
  const suppressed=state!=='CURRENT'||run.privacyStatus==='SMALL_COHORT_SUPPRESSED';
  return immutable({aggregationId:run.aggregationId,aggregationVersion:run.aggregationVersion,checksum:run.checksum,classification:run.classification,cohort:run.cohortSpec,cutoffAt:run.cutoffAt,sourceState:state,
    privacyStatus:suppressed?'SMALL_OR_STALE_COHORT_SUPPRESSED' as const:'AGGREGATE_ONLY' as const,interpretationStatus:run.interpretationStatus,
    counts:suppressed?null:{...run.included,...run.selectionBias,excludedExperimentCount:run.excluded.total},excludedByReason:suppressed?null:run.excluded.byReason,
    distribution:suppressed?null:run.distribution,observedVolume:suppressed?null:{projects:run.included.projectCount,experiments:run.included.experimentCount,rawObservations:run.included.rawObservationCount,pairedObservations:run.included.pairedObservationCount},
    statement:suppressed?'아직 검증된 운영 실험 데이터가 충분하지 않거나 현재 이용 조건을 다시 확인해야 합니다.':'해당 집단에서 Action 적용 이후 관찰된 분포이며 인과효과나 향후 성과를 보장하지 않습니다.'});
}
export type InsightProjection=ReturnType<typeof projectInsightRun>;
export function formatInsightText(projection:InsightProjection){
  if(!projection.distribution||!projection.counts)return projection.statement;
  const d=projection.distribution,unit=projection.cohort.unit==='PERCENTAGE_POINTS'?'%p':'개';
  return `${projection.cohort.industry} 업종의 ${projection.counts.projectCount}개 적격 프로젝트에서 해당 Action 적용 후 지표의 중앙 변화는 ${d.medianDelta}${unit}, 평균 변화는 ${d.meanDelta}${unit}로 관찰됐습니다. 양수 ${d.positiveCount}개, 변화 없음 ${d.zeroCount}개, 음수 ${d.negativeCount}개입니다. 이는 관찰된 분포이며 Action의 인과효과나 향후 성과를 보장하지 않습니다.`;
}
export function createInsightRecord(projection:InsightProjection){
  return immutable({insightId:projection.aggregationId,aggregationChecksum:projection.checksum,classification:'AGGREGATED_OBSERVATION' as const,environment:projection.cohort.environment,summary:formatInsightText(projection),projection});
}
