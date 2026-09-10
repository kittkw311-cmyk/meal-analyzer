const BODY_TREND_METRICS = [
  { key:'bmi', label:'BMI', unit:'', decimals:1 },
  { key:'fatRate', label:'体脂肪率', unit:'%', decimals:1 },
  { key:'heartRate', label:'心拍数', unit:'bpm', decimals:0 },
  { key:'muscleMass', label:'筋肉量', unit:'kg', decimals:2 },
  { key:'bmr', label:'基礎代謝量', unit:'kcal', decimals:0 },
  { key:'waterRate', label:'水分量', unit:'%', decimals:1 },
  { key:'fatMass', label:'体脂肪量', unit:'kg', decimals:2 },
  { key:'leanBodyMass', label:'除脂肪体重', unit:'kg', decimals:2 },
  { key:'boneMass', label:'骨量', unit:'kg', decimals:2 },
  { key:'visceralFat', label:'内臓脂肪レベル', unit:'', decimals:1 },
  { key:'proteinRate', label:'タンパク質', unit:'%', decimals:1 },
  { key:'skeletalMuscleMass', label:'骨格筋量', unit:'kg', decimals:2 },
  { key:'subcutaneousFat', label:'皮下脂肪', unit:'%', decimals:1 },
  { key:'bodyAge', label:'体内年齢', unit:'歳', decimals:0 },
];

let bodyTrendChart = null;
let bodyTrendRecords = [];
let bodyTrendRange = 'month';
let bodyTrendMetric = 'fatRate';

function toDate(value) {
  const date = new Date(value);
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

function getMetric() {
  return BODY_TREND_METRICS.find(metric => metric.key === bodyTrendMetric) || BODY_TREND_METRICS[0];
}

function buildDatasets(records, metric) {
  const start = startDateForRange(bodyTrendRange);
  const filtered = records
    .map(record => ({ record, date: toDate(record?.date) }))
    .filter(item => item.date && item.date >= start && Number.isFinite(Number(item.record?.[metric.key])))
    .sort((a, b) => a.date - b.date);

  const measurementTypes = [
    { key:'morning', label:'朝' },
    { key:'night', label:'夜' },
    { key:'other', label:'その他' },
  ];

  return measurementTypes.map(type => ({
    label: type.label,
    data: filtered
      .filter(item => (item.record?.measurementType || 'other') === type.key)
      .map(item => ({ x: item.date, y: Number(item.record[metric.key]) })),
    borderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 5,
    tension: 0.28,
    spanGaps: true,
  })).filter(dataset => dataset.data.length > 0);
}

function renderBodyTrendChart() {
  const canvas = document.getElementById('body-composition-trend-chart');
  if (!canvas || !globalThis.Chart) return;
  const metric = getMetric();
  const datasets = buildDatasets(bodyTrendRecords, metric);
  const empty = document.getElementById('body-composition-trend-empty');
  if (empty) empty.hidden = datasets.some(dataset => dataset.data.length);

  if (bodyTrendChart) bodyTrendChart.destroy();
  bodyTrendChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'nearest', intersect:false },
      parsing: false,
      plugins: {
        legend: { display: true, labels: { usePointStyle:true, boxWidth:8 } },
        tooltip: {
          callbacks: {
            title(items) {
              const x = items?.[0]?.parsed?.x;
              const date = Number.isFinite(x) ? new Date(x) : null;
              return date ? `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}` : '';
            },
            label(context) {
              const value = Number(context.parsed.y);
              return `${context.dataset.label}: ${value.toFixed(metric.decimals)}${metric.unit ? ` ${metric.unit}` : ''}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: bodyTrendRange === 'year' ? 'month' : 'day' },
          ticks: { maxRotation:0, autoSkip:true },
          grid: { display:false },
        },
        y: {
          beginAtZero: false,
          title: { display: !!metric.unit, text: metric.unit },
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
}

function renderBodyTrendChartWithoutTimeAdapter() {
  const canvas = document.getElementById('body-composition-trend-chart');
  if (!canvas || !globalThis.Chart) return;
  const metric = getMetric();
  const start = startDateForRange(bodyTrendRange);
  const filtered = bodyTrendRecords
    .map(record => ({ record, date: toDate(record?.date) }))
    .filter(item => item.date && item.date >= start && Number.isFinite(Number(item.record?.[metric.key])))
    .sort((a, b) => a.date - b.date);
  const labels = [...new Set(filtered.map(item => formatDateLabel(item.date, bodyTrendRange)))];
  const types = [ ['morning','朝'], ['night','夜'], ['other','その他'] ];
  const datasets = types.map(([key,label]) => {
    const byLabel = new Map();
    filtered.filter(item => (item.record?.measurementType || 'other') === key).forEach(item => {
      byLabel.set(formatDateLabel(item.date, bodyTrendRange), Number(item.record[metric.key]));
    });
    return { label, data: labels.map(labelKey => byLabel.has(labelKey) ? byLabel.get(labelKey) : null), borderWidth:2, pointRadius:3, pointHoverRadius:5, tension:.28, spanGaps:true };
  }).filter(dataset => dataset.data.some(value => value !== null));
  const empty = document.getElementById('body-composition-trend-empty');
  if (empty) empty.hidden = datasets.length > 0;
  if (bodyTrendChart) bodyTrendChart.destroy();
  bodyTrendChart = new Chart(canvas.getContext('2d'), {
    type:'line',
    data:{ labels, datasets },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ display:true, labels:{ usePointStyle:true, boxWidth:8 } },
        tooltip:{ callbacks:{ label(context){const value=Number(context.raw);return `${context.dataset.label}: ${value.toFixed(metric.decimals)}${metric.unit ? ` ${metric.unit}` : ''}`;} } },
      },
      scales:{
        x:{ grid:{ display:false }, ticks:{ maxRotation:0, autoSkip:true } },
        y:{ beginAtZero:false, title:{ display:!!metric.unit, text:metric.unit } },
      },
    },
  });
}

function safeRenderBodyTrendChart() {
  try { renderBodyTrendChart(); }
  catch (error) {
    console.warn('Body trend time scale unavailable; using category scale.', error);
    renderBodyTrendChartWithoutTimeAdapter();
  }
}

function installBodyTrendStyles() {
  if (document.getElementById('body-composition-trend-style')) return;
  const style = document.createElement('style');
  style.id = 'body-composition-trend-style';
  style.textContent = `
    .body-composition-trend-card{margin-top:14px}
    .body-composition-trend-controls{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}
    .body-composition-trend-select{min-width:170px;height:40px;border-radius:10px;border:1px solid var(--design-border,#314959);background:var(--design-card,#102431);color:inherit;padding:0 12px;font:inherit}
    .body-composition-trend-range{display:flex;gap:6px}
    .body-composition-trend-range button{min-width:44px;height:36px;border-radius:999px;border:1px solid var(--design-border,#314959);background:transparent;color:inherit;font:inherit;font-weight:700}
    .body-composition-trend-range button.is-active{background:var(--design-primary,#14b8a6);color:#fff;border-color:transparent}
    .body-composition-trend-chart-wrap{position:relative;height:260px}
    .body-composition-trend-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--design-muted,#8194a0);font-size:.9rem;pointer-events:none}
    @media(max-width:520px){.body-composition-trend-controls{align-items:stretch}.body-composition-trend-select{width:100%}.body-composition-trend-range{width:100%}.body-composition-trend-range button{flex:1}.body-composition-trend-chart-wrap{height:230px}}
  `;
  document.head.appendChild(style);
}

function installBodyTrendCard() {
  const overview = document.getElementById('tab-overview');
  const weightCard = overview?.querySelector('.overview-trend-card');
  if (!overview || !weightCard || document.getElementById('body-composition-trend-card')) return;

  const card = document.createElement('div');
  card.id = 'body-composition-trend-card';
  card.className = 'card overview-trend-card body-composition-trend-card';
  card.innerHTML = `
    <div class="overview-trend-header">
      <h3 class="chart-title">体組成推移</h3>
    </div>
    <div class="body-composition-trend-controls">
      <select id="body-composition-trend-metric" class="body-composition-trend-select" aria-label="表示する体組成項目">
        ${BODY_TREND_METRICS.map(metric => `<option value="${metric.key}"${metric.key === bodyTrendMetric ? ' selected' : ''}>${metric.label}</option>`).join('')}
      </select>
      <div class="body-composition-trend-range" role="group" aria-label="表示期間">
        <button type="button" data-body-trend-range="week">週</button>
        <button type="button" data-body-trend-range="month" class="is-active">月</button>
        <button type="button" data-body-trend-range="year">年</button>
      </div>
    </div>
    <div class="body-composition-trend-chart-wrap">
      <canvas id="body-composition-trend-chart"></canvas>
      <div id="body-composition-trend-empty" class="body-composition-trend-empty" hidden>この期間のデータがありません</div>
    </div>`;
  weightCard.insertAdjacentElement('afterend', card);

  card.querySelector('#body-composition-trend-metric')?.addEventListener('change', event => {
    bodyTrendMetric = event.target.value;
    safeRenderBodyTrendChart();
  });
  card.querySelectorAll('[data-body-trend-range]').forEach(button => button.addEventListener('click', () => {
    bodyTrendRange = button.dataset.bodyTrendRange || 'month';
    card.querySelectorAll('[data-body-trend-range]').forEach(btn => btn.classList.toggle('is-active', btn === button));
    safeRenderBodyTrendChart();
  }));
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
  safeRenderBodyTrendChart();
}

function installBodyCompositionTrends() {
  if (typeof document === 'undefined') return;
  const install = () => {
    installBodyTrendStyles();
    installBodyTrendCard();
    loadBodyTrendRecords();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
}

installBodyCompositionTrends();
