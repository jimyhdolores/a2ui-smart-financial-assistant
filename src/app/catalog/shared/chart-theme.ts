import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  Tema y fábricas de gráficos (ApexCharts)                             ║
 * ║                                                                       ║
 * ║  Devuelven objetos de opciones ya alineados a una paleta suave y      ║
 * ║  coherente con el tema Material 3 (azul/teal). Cada componente del    ║
 * ║  catálogo solo pasa sus datos; el estilo vive aquí (DRY).             ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

/** Configuración que cada `<apx-chart>` consume campo a campo. */
export interface ChartConfig {
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  chart: ApexChart;
  labels?: string[];
  colors?: string[];
  plotOptions?: ApexPlotOptions;
  dataLabels?: ApexDataLabels;
  legend?: ApexLegend;
  stroke?: ApexStroke;
  fill?: ApexFill;
  tooltip?: ApexTooltip;
  xaxis?: ApexXAxis;
  yaxis?: ApexYAxis;
  grid?: ApexGrid;
}

/** Paleta multi-tono suave para categorías (donas/barras). */
export const CHART_PALETTE = [
  '#3f6bd8', // azul (primary)
  '#00a9a5', // teal
  '#f2a93b', // ámbar
  '#e05263', // coral
  '#7c5cfc', // violeta
  '#54b45b', // verde
  '#38bdf8', // celeste
  '#94a3b8', // gris azulado
];

/** Colores semánticos por estado/riesgo. */
export const STATUS_COLOR: Record<string, string> = {
  good: '#2e7d32',
  low: '#2e7d32',
  warning: '#f59e0b',
  medium: '#f59e0b',
  risk: '#d32f2f',
  high: '#d32f2f',
};

const FONT = 'Roboto, sans-serif';

/** Dona de categorías. */
export function donutChart(labels: string[], values: number[]): ChartConfig {
  return {
    series: values,
    labels,
    colors: CHART_PALETTE,
    chart: { type: 'donut', height: 240, fontFamily: FONT, animations: { enabled: true } },
    legend: { position: 'bottom', fontFamily: FONT, markers: { size: 6 } },
    dataLabels: { enabled: false },
    stroke: { width: 2, colors: ['#ffffff'] },
    plotOptions: {
      pie: {
        donut: {
          size: '68%',
          labels: {
            show: true,
            total: { show: true, label: 'Total', fontFamily: FONT, fontWeight: 600 },
          },
        },
      },
    },
    tooltip: { y: { formatter: (v: number) => `$${v.toFixed(2)}` } },
  };
}

/** Área de tendencia (gasto por semana). */
export function areaChart(categories: string[], values: number[], name = 'Gasto'): ChartConfig {
  return {
    series: [{ name, data: values }],
    colors: ['#3f6bd8'],
    chart: {
      type: 'area',
      height: 200,
      fontFamily: FONT,
      toolbar: { show: false },
      sparkline: { enabled: false },
      animations: { enabled: true },
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] },
    },
    grid: { borderColor: '#eceff4', strokeDashArray: 4 },
    xaxis: { categories, labels: { style: { fontFamily: FONT } } },
    yaxis: { labels: { formatter: (v: number) => `$${Math.round(v)}` } },
    tooltip: { y: { formatter: (v: number) => `$${v.toFixed(2)}` } },
  };
}

/** Barras horizontales pequeñas (categorías de gasto hormiga). */
export function barChart(categories: string[], values: number[]): ChartConfig {
  return {
    series: [{ name: 'Gasto', data: values }],
    colors: ['#f2a93b'],
    chart: { type: 'bar', height: 180, fontFamily: FONT, toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%' } },
    dataLabels: { enabled: true, formatter: (v: number) => `$${v}`, style: { fontFamily: FONT } },
    grid: { show: false },
    xaxis: { categories, labels: { show: false } },
    yaxis: { labels: { style: { fontFamily: FONT } } },
    tooltip: { y: { formatter: (v: number) => `$${v.toFixed(2)}` } },
  };
}

/** Progreso radial (una sola métrica en %). */
export function radialChart(pct: number, label: string, color = '#3f6bd8'): ChartConfig {
  return {
    series: [Math.max(0, Math.min(100, Math.round(pct)))],
    labels: [label],
    colors: [color],
    chart: { type: 'radialBar', height: 240, fontFamily: FONT },
    plotOptions: {
      radialBar: {
        hollow: { size: '62%' },
        track: { background: '#eceff4' },
        dataLabels: {
          name: { fontFamily: FONT, fontSize: '14px', offsetY: 20 },
          value: { fontFamily: FONT, fontSize: '30px', fontWeight: 700, offsetY: -12, formatter: (v: number) => `${v}%` },
        },
      },
    },
    stroke: { lineCap: 'round' },
  };
}

/** Gauge semicircular (capacidad de crédito / uso de la línea). */
export function gaugeChart(pct: number, label: string, color = '#3f6bd8'): ChartConfig {
  return {
    series: [Math.max(0, Math.min(100, Math.round(pct)))],
    labels: [label],
    colors: [color],
    chart: { type: 'radialBar', height: 260, fontFamily: FONT, sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -110,
        endAngle: 110,
        hollow: { size: '60%' },
        track: { background: '#eceff4', strokeWidth: '100%' },
        dataLabels: {
          name: { fontFamily: FONT, fontSize: '13px', offsetY: 24 },
          value: { fontFamily: FONT, fontSize: '30px', fontWeight: 700, offsetY: -8, formatter: (v: number) => `${v}%` },
        },
      },
    },
    stroke: { lineCap: 'round' },
  };
}
