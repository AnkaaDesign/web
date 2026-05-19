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

function buildFilterLines(filters: SkillStatsBaseFilters): string[] {
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
  if (filters.assessmentIds?.length) {
    lines.push(`${filters.assessmentIds.length} campanha(s) selecionada(s)`);
  }
  if (filters.sectorIds?.length) {
    lines.push(`${filters.sectorIds.length} setor(es)`);
  }
  if (filters.skillIds?.length) {
    lines.push(`${filters.skillIds.length} competência(s)`);
  }
  if (filters.topicIds?.length) {
    lines.push(`${filters.topicIds.length} tópico(s)`);
  }
  if (filters.userIds?.length) {
    lines.push(`${filters.userIds.length} colaborador(es)`);
  }
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
  const summary: ProductivityPdfOptions['summaryStats'] = (() => {
    const s = opts.overview?.summary;
    const base: ProductivityPdfOptions['summaryStats'] = [];
    if (s) {
      base.push(
        { label: 'Colaboradores avaliados', value: String(s.totalEvaluated) },
        { label: 'Média geral', value: fmt(s.overallAverage) },
        {
          label: 'Submissão',
          value: `${((s.submissionRate ?? 0) * 100).toFixed(1)}%`,
        },
        { label: 'Campanhas', value: String(s.assessmentsCount) },
      );
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
    filterLines: buildFilterLines(opts.filters),
    chartOption: opts.chartOption,
    summaryStats: summary,
    fileSuffix,
  });
}
