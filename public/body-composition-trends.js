const BODY_TREND_METRICS = [
  { key:'bmi', label:'BMI推移', unit:'', decimals:1 },
  { key:'fatRate', label:'体脂肪率推移', unit:'%', decimals:1 },
  { key:'heartRate', label:'心拍数推移', unit:'bpm', decimals:0 },
  { key:'muscleMass', label:'筋肉量推移', unit:'kg', decimals:2 },
  { key:'bmr', label:'基礎代謝量推移', unit:'kcal', decimals:0 },
  { key:'waterRate', label:'水分量推移', unit:'%', decimals:1 },
  { key:'fatMass', label:'体脂肪量推移', unit:'kg', decimals:2 },
  { key:'leanBodyMass', label:'除脂肪体重推移', unit:'kg', decimals:2 },
  { key:'boneMass', label:'骨量推移', unit:'kg', decimals:2 },
  { key:'visceralFat', label:'内臓脂肪レベル推移', unit:'', decimals:1 },
  { key:'proteinRate', label:'タンパク質推移', unit:'%', decimals:1 },
  { key:'skeletalMuscleMass', label:'骨格筋量推移', unit:'kg', decimals:2 },
  { key:'subcutaneousFat', label:'皮下脂肪推移', unit:'%', decimals:1 },
  { key:'bodyAge', label:'体内年齢推移', unit:'歳', decimals:0 },
];

const bodyTrendCharts = new Map();
const bodyTrendRanges = new Map(BODY_TREND_METRICS.map(metric => [metric.key, 'month']));
let bodyTrendRecords = [];

function toDate(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T00:00:00+09:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startDateForRange(range) {
  const now = new Date();
  const start = new Date(now);
  if (range === 'week') start.setDate(start.getDate() - 6);
  else if (range === 'year') start.setFullYear(start.getFullYear() - 1);
  else start.setMonth(start.getMonth() - 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatDateLabel(date, range) {
  if (range === 'year') return `${date.getFullYear()}/${date.getMonth() + 1}`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function filteredRecords(metric, range) {
  const start = startDateForRange(range);
  return bodyTrendRecords
    .map(record => ({ record, date: toDate(record?.date) }))
    .filter(item => item.date && item.date >= start && Number.isFinite(Number(item.record?.[metric.key])))
    .sort((a, b) => a.date - b.date);
}

function buildDatasets(metric, range) {
  const filtered = filteredRecords(metric, range);
  const labels = [...new Set(filtered.map(item => formatDateLabel(item.date, range)))];
  const types = [ ['morning','朝'], ['night','夜'], ['other','その他'] ];
  const datasets = types.map(([key, label]) => {
    const byLabel = new Map();
    filtered
      .filter(item => (item.record?.measurementType || 'other') === key)
      .forEach(item => byLabel.set(formatDateLabel(item.date, range), Number(item.record[metric.key])));
    return {
      label,
      data: labels.map(labelKey => byLabel.has(labelKey) ? byLabel.get(labelKey) : null),
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: .28,
      spanGaps: true,
      fill: false,
    };
  }).filter(dataset => dataset.data.some(value => value !== null));
  return { labels, datasets };
}

function renderMetricChart(metric) {
  const canvas = document.getElementById(`body-trend-chart-${metric.key}`);
  if (!canvas || !globalThis.Chart) return;
  const range = bodyTrendRanges.get(metric.key) || 'month';
  const { labels, datasets } = buildDatasets(metric, range);
  const empty = document.getElementById(`body-trend-empty-${metric.key}`);
  if (empty) empty.hidden = datasets.length > 0;

  bodyTrendCharts.get(metric.key)?.destroy();
  bodyTrendCharts.delete(metric.key);

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { display:false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = Number(context.raw);
              if (!Number.isFinite(value)) return '';
              const suffix = metric.unit ? ` ${metric.unit}` : '';
              return `${context.dataset.label}: ${value.toFixed(metric.decimals)}${suffix}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display:false },
          ticks: { maxRotation:0, autoSkip:true },
        },
        y: {
          beginAtZero:false,
          ticks: {
            callback(value) {
              const numeric = Number(value);
              return Number.isFinite(numeric) ? numeric.toFixed(metric.decimals) : value;
            },
          },
        },
      },
    },
  });
  bodyTrendCharts.set(metric.key, chart);
}

function renderAllBodyTrendCharts() {
  BODY_TREND_METRICS.forEach(renderMetricChart);
}

function installBodyTrendStyles() {
  if (document.getElementById('body-composition-trend-style')) return;
  const style = document.createElement('style');
  style.id = 'body-composition-trend-style';
  style.textContent = `
    .body-trend-card{margin-top:14px}
    .body-trend-chart-wrap{position:relative;height:260px}
    .body-trend-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--design-muted,#8194a0);font-size:.9rem;pointer-events:none}
    .body-trend-empty[hidden]{display:none!important}
    .overview-chart-legend-swatch.other{background:currentColor;opacity:.45}
    @media(max-width:520px){.body-trend-chart-wrap{height:230px}}
  `;
  document.head.appendChild(style);
}

function trendCardMarkup(metric) {
  return `
    <div class="card overview-trend-card body-trend-card" id="body-trend-card-${metric.key}">
      <div class="overview-trend-header">
        <h3 class="chart-title"><svg class="icon-svg" style="margin-right: 6px; color: var(--design-primary); vertical-align: -2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>${metric.label}</h3>
        <div class="overview-chart-range" role="group" aria-label="${metric.label}の表示期間">
          <button type="button" class="overview-chart-range-btn" data-body-metric="${metric.key}" data-body-range="week">週</button>
          <button type="button" class="overview-chart-range-btn is-active" data-body-metric="${metric.key}" data-body-range="month">月</button>
          <button type="button" class="overview-chart-range-btn" data-body-metric="${metric.key}" data-body-range="year">年</button>
        </div>
      </div>
      <div class="chart-container overview-trend-chart-container body-trend-chart-wrap">
        <canvas id="body-trend-chart-${metric.key}"></canvas>
        <div id="body-trend-empty-${metric.key}" class="body-trend-empty" hidden>この期間のデータがありません</div>
      </div>
      <div class="overview-chart-legend" aria-label="グラフの凡例">
        <span class="overview-chart-legend-item"><span class="overview-chart-legend-swatch morning" aria-hidden="true"></span><span>朝</span></span>
        <span class="overview-chart-legend-item"><span class="overview-chart-legend-swatch night" aria-hidden="true"></span><span>夜</span></span>
        <span class="overview-chart-legend-item"><span class="overview-chart-legend-swatch other" aria-hidden="true"></span><span>その他</span></span>
      </div>
    </div>`;
}

function installBodyTrendCards() {
  const overview = document.getElementById('tab-overview');
  const weightCard = overview?.querySelector('.overview-trend-card');
  if (!overview || !weightCard || document.getElementById('body-trend-card-fatRate')) return;

  const holder = document.createElement('div');
  holder.id = 'body-composition-trend-stack';
  holder.innerHTML = BODY_TREND_METRICS.map(trendCardMarkup).join('');
  weightCard.insertAdjacentElement('afterend', holder);

  holder.querySelectorAll('[data-body-metric][data-body-range]').forEach(button => {
    button.addEventListener('click', () => {
      const metricKey = button.dataset.bodyMetric;
      const range = button.dataset.bodyRange || 'month';
      bodyTrendRanges.set(metricKey, range);
      holder.querySelectorAll(`[data-body-metric="${metricKey}"]`).forEach(btn => {
        btn.classList.toggle('is-active', btn === button);
      });
      const metric = BODY_TREND_METRICS.find(item => item.key === metricKey);
      if (metric) renderMetricChart(metric);
    });
  });
}

async function loadBodyTrendRecords() {
  try {
    const response = await fetch('/api/body-composition', { cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    bodyTrendRecords = Array.isArray(payload) ? payload : [];
  } catch (error) {
    console.error('Failed to load body composition trends:', error);
    bodyTrendRecords = [];
  }
  renderAllBodyTrendCharts();
}

function installBodyCompositionTrends() {
  if (typeof document === 'undefined') return;
  const install = () => {
    installBodyTrendStyles();
    installBodyTrendCards();
    loadBodyTrendRecords();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
}

installBodyCompositionTrends();
