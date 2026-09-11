const BODY_TREND_METRICS = [
  { key:'bmi', label:'BMI推移', valueLabel:'BMI', unit:'', decimals:1 },
  { key:'fatRate', label:'体脂肪率推移', valueLabel:'体脂肪率', unit:'%', decimals:1 },
  { key:'heartRate', label:'心拍数推移', valueLabel:'心拍数', unit:'bpm', decimals:0 },
  { key:'muscleMass', label:'筋肉量推移', valueLabel:'筋肉量', unit:'kg', decimals:2 },
  { key:'bmr', label:'基礎代謝量推移', valueLabel:'基礎代謝量', unit:'kcal', decimals:0 },
  { key:'waterRate', label:'水分量推移', valueLabel:'水分量', unit:'%', decimals:1 },
  { key:'fatMass', label:'体脂肪量推移', valueLabel:'体脂肪量', unit:'kg', decimals:2 },
  { key:'leanBodyMass', label:'除脂肪体重推移', valueLabel:'除脂肪体重', unit:'kg', decimals:2 },
  { key:'boneMass', label:'骨量推移', valueLabel:'骨量', unit:'kg', decimals:2 },
  { key:'visceralFat', label:'内臓脂肪レベル推移', valueLabel:'内臓脂肪レベル', unit:'', decimals:1 },
  { key:'proteinRate', label:'タンパク質推移', valueLabel:'タンパク質', unit:'%', decimals:1 },
  { key:'skeletalMuscleMass', label:'骨格筋量推移', valueLabel:'骨格筋量', unit:'kg', decimals:2 },
  { key:'subcutaneousFat', label:'皮下脂肪推移', valueLabel:'皮下脂肪', unit:'%', decimals:1 },
  { key:'bodyAge', label:'体内年齢推移', valueLabel:'体内年齢', unit:'歳', decimals:0 },
];

const BODY_TREND_RANGE_CONFIG = {
  week: { days:7, maxTicksLimit:7, pointRadius:4, pointHoverRadius:6 },
  month: { days:30, maxTicksLimit:8, pointRadius:3.5, pointHoverRadius:5.5 },
  year: { days:365, maxTicksLimit:12, pointRadius:2.5, pointHoverRadius:4.5 },
};

const bodyTrendCharts = new Map();
const bodyTrendRanges = new Map(BODY_TREND_METRICS.map(metric => [metric.key, 'week']));
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

function formatTooltipDate(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    month:'numeric',
    day:'numeric',
    weekday:'short',
  }).format(date).replace(/\s+/g, '');
}

function measurementTypeLabel(type) {
  if (type === 'morning') return '朝';
  if (type === 'night') return '夜';
  return '';
}

function filteredRecords(metric, range) {
  const start = startDateForRange(range);
  return bodyTrendRecords
    .map(record => ({ record, date:toDate(record?.date) }))
    .filter(item => item.date && item.date >= start && Number.isFinite(Number(item.record?.[metric.key])))
    .sort((a, b) => a.date - b.date);
}

function chartColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = name => styles.getPropertyValue(name).trim();
  return {
    accent:read('--design-accent'),
    card:read('--design-card'),
    muted:read('--design-muted'),
    border:read('--design-border'),
    morning:read('--secondary'),
    night:read('--accent-blue'),
  };
}

function renderMetricChart(metric) {
  const canvas = document.getElementById(`body-trend-chart-${metric.key}`);
  if (!canvas || !globalThis.Chart) return;

  const range = bodyTrendRanges.get(metric.key) || 'week';
  const rangeConfig = BODY_TREND_RANGE_CONFIG[range] || BODY_TREND_RANGE_CONFIG.week;
  const filtered = filteredRecords(metric, range);
  const labels = filtered.map(item => formatDateLabel(item.date, range));
  const values = filtered.map(item => Number(item.record[metric.key]));
  const colors = chartColors();
  const pointColors = filtered.map(item => {
    const type = item.record?.measurementType || 'other';
    if (type === 'night') return colors.night;
    if (type === 'morning') return colors.morning;
    return colors.accent;
  });

  const empty = document.getElementById(`body-trend-empty-${metric.key}`);
  if (empty) empty.hidden = filtered.length > 0;

  bodyTrendCharts.get(metric.key)?.destroy();
  bodyTrendCharts.delete(metric.key);

  const chart = new Chart(canvas.getContext('2d'), {
    type:'line',
    data:{
      labels,
      datasets:[{
        label:metric.valueLabel,
        data:values,
        borderColor:colors.accent,
        backgroundColor:`${colors.accent}1a`,
        borderWidth:3,
        fill:true,
        tension:.25,
        pointBackgroundColor:pointColors,
        pointBorderColor:colors.card,
        pointBorderWidth:2,
        pointRadius:rangeConfig.pointRadius,
        pointHoverRadius:rangeConfig.pointHoverRadius,
      }],
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ display:false },
        tooltip:{
          callbacks:{
            title(items) {
              const item = filtered[items[0]?.dataIndex ?? -1];
              if (!item) return '';
              const typeLabel = measurementTypeLabel(item.record?.measurementType);
              const dateLabel = formatTooltipDate(item.date);
              return typeLabel ? `${dateLabel} ${typeLabel}` : dateLabel;
            },
            label(context) {
              const value = Number(context.parsed.y);
              if (!Number.isFinite(value)) return '';
              const suffix = metric.unit ? ` ${metric.unit}` : '';
              return `${metric.valueLabel} ${value.toFixed(metric.decimals)}${suffix}`;
            },
          },
        },
      },
      scales:{
        y:{
          beginAtZero:false,
          grace:'5%',
          grid:{ color:colors.border },
          ticks:{
            color:colors.muted,
            font:{ size:10, weight:'700' },
            callback(value) {
              const numeric = Number(value);
              return Number.isFinite(numeric) ? numeric.toFixed(metric.decimals) : value;
            },
          },
        },
        x:{
          grid:{ display:false },
          ticks:{
            color:colors.muted,
            font:{ size:10, weight:'700' },
            maxRotation:0,
            autoSkip:true,
            maxTicksLimit:rangeConfig.maxTicksLimit,
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
    .body-trend-card{margin-top:var(--design-space)}
    .body-trend-chart-wrap{position:relative;height:210px}
    .body-trend-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--design-muted,#8194a0);font-size:.9rem;pointer-events:none}
    .body-trend-empty[hidden]{display:none!important}
  `;
  document.head.appendChild(style);
}

function trendCardMarkup(metric) {
  return `
    <div class="card overview-trend-card body-trend-card" id="body-trend-card-${metric.key}">
      <div class="overview-trend-header">
        <h3 class="chart-title"><svg class="icon-svg" style="margin-right: 6px; color: var(--design-primary); vertical-align: -2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>${metric.label}</h3>
        <div class="overview-chart-range" role="group" aria-label="${metric.label}の表示期間">
          <button type="button" class="overview-chart-range-btn active" data-body-metric="${metric.key}" data-body-range="week" aria-pressed="true">週</button>
          <button type="button" class="overview-chart-range-btn" data-body-metric="${metric.key}" data-body-range="month" aria-pressed="false">月</button>
          <button type="button" class="overview-chart-range-btn" data-body-metric="${metric.key}" data-body-range="year" aria-pressed="false">年</button>
        </div>
      </div>
      <div class="chart-container overview-trend-chart-container body-trend-chart-wrap">
        <canvas id="body-trend-chart-${metric.key}"></canvas>
        <div id="body-trend-empty-${metric.key}" class="body-trend-empty" hidden>この期間のデータがありません</div>
      </div>
      <div class="overview-chart-legend" aria-label="グラフの凡例">
        <span class="overview-chart-legend-item"><span class="overview-chart-legend-swatch morning" aria-hidden="true"></span><span>朝</span></span>
        <span class="overview-chart-legend-item"><span class="overview-chart-legend-swatch night" aria-hidden="true"></span><span>夜</span></span>
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
      const range = button.dataset.bodyRange || 'week';
      bodyTrendRanges.set(metricKey, range);
      holder.querySelectorAll(`[data-body-metric="${metricKey}"]`).forEach(btn => {
        const active = btn === button;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
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
