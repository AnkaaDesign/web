// Skill-assessment statistics PDF — thin wrapper over the productivity
// generator (the generator itself is generic: title + subtitle + filter chips
// + ECharts option + summary metrics + standard Ankaa footer).
//
// Titles/subtitles are synthesized from the axis composition (xAxis × yAxis,
// + optional compare dimension) instead of a discrete viewMode, mirroring how
// the rebuilt statistics page composes views.

import type { EChartsOption } from 'echarts';
import { format } from 'date-fns';
import {
  exportProductivityPdf,
  type ProductivityPdfOptions,
} from './productivity-pdf-generator';
import type {
  SkillStatsOverviewData,
  SkillStatsComparisonData,
  SkillStatsEvolutionData,
  SkillStatsBaseFilters,
  SkillStatsXAxisMode,
  SkillStatsYAxisMode,
  SkillStatsCompareMode,
  SkillStatsChartType,
} from '@/types/skill-analytics';

const X_AXIS_LABELS: Record<SkillStatsXAxisMode, string> = {
  skill: 'Por Competência',
  topic: 'Por Tópico',
  sector: 'Por Setor',
  user: 'Por Colaborador',
  campaign: 'Evolução por Campanha',
};

const Y_AXIS_LABELS: Record<SkillStatsYAxisMode, string> = {
  averageScore: 'Média de Pontuação',
  volume: 'Volume',
  distribution: 'Distribuição de Notas',
};

const COMPARE_LABELS: Record<SkillStatsCompareMode, string> = {
  none: '',
  sector: 'Setor',
  user: 'Colaborador',
  skill: 'Competência',
  position: 'Cargo',
};

const fmt = (n: number | null | undefined, decimals = 2) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(n);

// Resolved display names for the single-selection scopes. When exactly one
// campaign/sector/collaborator is selected we print its NAME (no count label);
// for two or more we fall back to a "<n> <plural>" count.
export interface SkillStatsScopeNames {
  campaign?: string | null;
  sector?: string | null;
  user?: string | null;
}

function buildFilterLines(
  filters: SkillStatsBaseFilters,
  names?: SkillStatsScopeNames,
): string[] {
  const lines: string[] = [];
  if (filters.periodStart || filters.periodEnd) {
    const a = filters.periodStart
      ? format(new Date(filters.periodStart), 'dd/MM/yyyy')
      : '…';
    const b = filters.periodEnd
      ? format(new Date(filters.periodEnd), 'dd/MM/yyyy')
      : '…';
    lines.push(`Período: ${a} → ${b}`);
  }
  // For campaign/sector/collaborator: a single selection shows the entity's
  // name directly; multiple selections show the quantity instead.
  const scope = (ids: string[] | undefined, name: string | null | undefined, plural: string) => {
    const n = ids?.length ?? 0;
    if (!n) return;
    if (n === 1 && name) lines.push(name);
    else lines.push(`${n} ${plural}`);
  };
  scope(filters.assessmentIds, names?.campaign, 'campanhas');
  scope(filters.sectorIds, names?.sector, 'setores');
  if (filters.skillIds?.length) {
    lines.push(`${filters.skillIds.length} competência(s)`);
  }
  if (filters.topicIds?.length) {
    lines.push(`${filters.topicIds.length} tópico(s)`);
  }
  scope(filters.userIds, names?.user, 'colaboradores');
  if (filters.includeInProgress) lines.push('Inclui avaliações em andamento');
  return lines;
}

export interface SkillStatsPdfOptions {
  overview: SkillStatsOverviewData | null;
  comparison: SkillStatsComparisonData | null;
  evolution: SkillStatsEvolutionData | null;
  xAxisMode: SkillStatsXAxisMode;
  yAxisMode: SkillStatsYAxisMode;
  compareMode: SkillStatsCompareMode;
  chartType: SkillStatsChartType;
  chartOption: EChartsOption | null;
  filters: SkillStatsBaseFilters;
  /** Names for single-selection scopes; counts are used when 2+ are selected. */
  scopeNames?: SkillStatsScopeNames;
}

export async function exportSkillStatsPdf(opts: SkillStatsPdfOptions): Promise<void> {
  if (!opts.chartOption) {
    throw new Error('Gráfico não disponível para exportação');
  }

  const title = 'Estatísticas de Competências';
  const xLabel = X_AXIS_LABELS[opts.xAxisMode];
  const yLabel = Y_AXIS_LABELS[opts.yAxisMode];
  const compareLabel = opts.compareMode !== 'none'
    ? ` × ${COMPARE_LABELS[opts.compareMode]}`
    : '';
  const subtitle = `${xLabel}${compareLabel} — ${yLabel}`;

  // Build a summary block from whichever endpoint payload happens to be loaded.
  // Overview is the most common, comparison/evolution have a couple of extras.
  const singleUser = opts.filters.userIds?.length === 1;
  const singleCampaign = opts.filters.assessmentIds?.length === 1;

  const summary: ProductivityPdfOptions['summaryStats'] = (() => {
    const s = opts.overview?.summary;
    const base: ProductivityPdfOptions['summaryStats'] = [];
    if (s) {
      // "Colaboradores avaliados" / "Campanhas" are redundant when a single
      // collaborator/campaign is already named in the subtitle, so drop them then.
      if (!singleUser) {
        base.push({ label: 'Colaboradores avaliados', value: String(s.totalEvaluated) });
      }
      base.push(
        { label: 'Média geral', value: fmt(s.overallAverage) },
        {
          label: 'Taxa de avaliação',
          value: `${((s.submissionRate ?? 0) * 100).toFixed(1)}%`,
        },
      );
      // Per-competência averages, inline alongside the headline metrics:
      // "Média <Competência>: <valor>".
      for (const p of opts.overview?.bySkill ?? []) {
        if (p.average == null) continue;
        base.push({ label: `Média ${p.skillName}`, value: fmt(p.average) });
      }
      if (!singleCampaign) {
        base.push({ label: 'Campanhas', value: String(s.assessmentsCount) });
      }
    }

    if (opts.comparison) {
      base.push({
        label: 'Itens comparados',
        value: String(opts.comparison.entities.length),
      });
    } else if (opts.evolution) {
      base.push({ label: 'Pontos no tempo', value: String(opts.evolution.points.length) });
    }

    return base;
  })();

  const fileSuffix = `competencias-${opts.xAxisMode}-${opts.yAxisMode}`;

  await exportProductivityPdf({
    title,
    subtitle,
    filterLines: buildFilterLines(opts.filters, opts.scopeNames),
    chartOption: opts.chartOption,
    summaryStats: summary,
    fileSuffix,
  });
}
