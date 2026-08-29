const MEAL_OCR_APP_VERSION = 'v1.0.4';
const MEAL_OCR_TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let mealOcrTesseractLoader = null;
let mealOcrBusy = false;
let mealOcrSaveBusy = false;

function setMealOcrVersion() {
  const version = document.querySelector('.app-version');
  if (version) version.textContent = MEAL_OCR_APP_VERSION;
}

function loadMealOcrTesseract() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if (mealOcrTesseractLoader) return mealOcrTesseractLoader;

  mealOcrTesseractLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-physilog-tesseract]');
    if (existing) {
      if (globalThis.Tesseract) return resolve(globalThis.Tesseract);
      existing.addEventListener('load', () => resolve(globalThis.Tesseract), { once: true });
      existing.addEventListener('error', () => reject(new Error('OCRライブラリを読み込めませんでした。')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = MEAL_OCR_TESSERACT_URL;
    script.async = true;
    script.dataset.physilogTesseract = '1';
    script.onload = () => resolve(globalThis.Tesseract);
    script.onerror = () => reject(new Error('OCRライブラリを読み込めませんでした。'));
    document.head.appendChild(script);
  });

  return mealOcrTesseractLoader;
}

function getMealOcrImageFile() {
  return document.getElementById('meal-camera-input')?.files?.[0]
    || document.getElementById('meal-gallery-input')?.files?.[0]
    || null;
}

function loadMealOcrImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした。'));
    };
    image.src = url;
  });
}

function buildMealOcrCanvas(image, mode = 'normal') {
  const maxWidth = 1800;
  const scale = Math.min(2.2, Math.max(1, maxWidth / Math.max(1, image.naturalWidth)));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  if (mode === 'normal') return canvas;

  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    let value = gray;
    if (mode === 'contrast') value = Math.max(0, Math.min(255, (gray - 128) * 1.75 + 128));
    if (mode === 'threshold') value = gray < 190 ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function normalizeOcrText(rawText) {
  const fullWidthDigits = '０１２３４５６７８９';
  let text = String(rawText || '');
  text = text.replace(/[０-９]/g, char => String(fullWidthDigits.indexOf(char)));
  return text
    .replace(/[，、]/g, ',')
    .replace(/[．。]/g, '.')
    .replace(/[：]/g, ':')
    .replace(/ｇ/gi, 'g')
    .replace(/ＫＣＡＬ/gi, 'kcal')
    .replace(/㎉/g, 'kcal')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n');
}

const NUTRITION_LABELS = {
  calories: [
    /エネルギー/i,
    /熱\s*量/i,
    /カロリー/i,
    /calor(?:ie|ies)/i,
    /energy/i,
  ],
  protein: [
    /たんぱく質/i,
    /タンパク質/i,
    /蛋白質/i,
    /protein/i,
  ],
  fat: [
    /脂\s*質/i,
    /脂\s*肪/i,
    /total\s*fat/i,
    /\bfat\b/i,
  ],
  carbs: [
    /炭水化物/i,
    /炭水化物量/i,
    /糖質(?:量)?/i,
    /carbohydrate(?:s)?/i,
    /total\s*carb/i,
  ],
};

function findUnitValue(text, unit, max) {
  const unitPattern = unit === 'kcal' ? '(?:kcal|kcalories?)' : '(?:g|gram(?:s)?)';
  const regex = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*${unitPattern}`, 'i');
  const match = String(text || '').match(regex);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

function findLooseValue(text, max) {
  const values = [...String(text || '').matchAll(/(?:^|[^\d])(-?\d+(?:\.\d+)?)(?!\d)/g)]
    .map(match => Number(match[1]))
    .filter(value => Number.isFinite(value) && value >= 0 && value <= max);
  return values[0] ?? null;
}

function lineMatchesAny(line, patterns) {
  return patterns.some(pattern => pattern.test(line));
}

function extractNutritionValue(lines, patterns, { unit, max }) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!lineMatchesAny(line, patterns)) continue;

    const sameLine = findUnitValue(line, unit, max);
    if (sameLine !== null) return sameLine;

    const context = [line, lines[index + 1] || '', lines[index + 2] || ''].join(' ');
    const nearbyUnit = findUnitValue(context, unit, max);
    if (nearbyUnit !== null) return nearbyUnit;

    const labelStripped = patterns.reduce((value, pattern) => value.replace(pattern, ' '), line);
    const looseSameLine = findLooseValue(labelStripped, max);
    if (looseSameLine !== null) return looseSameLine;

    for (let offset = 1; offset <= 2; offset += 1) {
      const nextLine = lines[index + offset] || '';
      if (!nextLine) continue;
      if (Object.values(NUTRITION_LABELS).some(group => lineMatchesAny(nextLine, group))) break;
      const looseNearby = findLooseValue(nextLine, max);
      if (looseNearby !== null) return looseNearby;
    }
  }
  return null;
}

function parseNutritionFromOcr(rawText) {
  const text = normalizeOcrText(rawText);
  const lines = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const calories = extractNutritionValue(lines, NUTRITION_LABELS.calories, { unit: 'kcal', max: 5000 });
  const protein = extractNutritionValue(lines, NUTRITION_LABELS.protein, { unit: 'g', max: 500 });
  const fat = extractNutritionValue(lines, NUTRITION_LABELS.fat, { unit: 'g', max: 500 });
  const carbs = extractNutritionValue(lines, NUTRITION_LABELS.carbs, { unit: 'g', max: 1000 });

  const basisMatches = [...text.matchAll(/(?:100\s*(?:g|ml)|1\s*(?:食|包装|個|本|袋|枚|パック)|一\s*(?:食|包装|個|本|袋|枚|パック)|当たり|あたり)/gi)]
    .map(match => match[0].replace(/\s+/g, ''));
  const basis = [...new Set(basisMatches)].slice(0, 4);

  return { calories, protein, fat, carbs, basis, rawText: text };
}

function mergeParsedNutrition(primary, secondary) {
  const merged = {};
  for (const key of ['calories', 'protein', 'fat', 'carbs']) {
    merged[key] = primary[key] ?? secondary[key] ?? null;
  }
  merged.basis = [...new Set([...(primary.basis || []), ...(secondary.basis || [])])].slice(0, 4);
  merged.rawText = `${primary.rawText || ''}\n${secondary.rawText || ''}`.trim();
  return merged;
}

function setMealOcrLoading(visible, title = '', detail = '') {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  if (title) overlay.querySelector('p')?.replaceChildren(document.createTextNode(title));
  if (detail) overlay.querySelector('.loading-subtext')?.replaceChildren(document.createTextNode(detail));
  overlay.style.display = visible ? 'flex' : 'none';
}

function getMealType() {
  const active = document.querySelector('#meal-type-chips .chip.active');
  return active?.dataset?.type || 'snack';
}

function fillMealOcrResult(parsed) {
  const mappings = [
    ['meal-ocr-calories', parsed.calories, 0],
    ['meal-ocr-protein', parsed.protein, 1],
    ['meal-ocr-fat', parsed.fat, 1],
    ['meal-ocr-carbs', parsed.carbs, 1],
  ];

  for (const [id, value, decimals] of mappings) {
    const input = document.getElementById(id);
    if (!input) continue;
    input.value = value === null || value === undefined
      ? ''
      : decimals === 0 ? String(Math.round(value)) : Number(value).toFixed(decimals);
  }

  const mealText = document.getElementById('meal-text-input')?.value?.trim() || '';
  const nameInput = document.getElementById('meal-ocr-name');
  if (nameInput && !nameInput.value.trim() && mealText) {
    nameInput.value = mealText.split('\n')[0].slice(0, 80);
  }

  const panel = document.getElementById('meal-ocr-result');
  if (panel) panel.hidden = false;

  const status = document.getElementById('meal-ocr-status');
  if (status) {
    const count = [parsed.calories, parsed.protein, parsed.fat, parsed.carbs].filter(value => value !== null && value !== undefined).length;
    const basisText = parsed.basis?.length ? ` 基準表記: ${parsed.basis.join(' / ')}` : '';
    status.textContent = count === 4
      ? `4項目を読み取りました。数値が「100g当たり」か「1食当たり」かも確認してください。${basisText}`
      : `${count}/4項目を読み取りました。空欄は手入力できます。${basisText}`;
    status.dataset.state = count === 4 ? 'success' : 'warning';
  }
}

async function runMealNutritionOcr() {
  if (mealOcrBusy) return;
  const imageFile = getMealOcrImageFile();
  if (!imageFile) {
    window.alert('栄養成分表示が写っている写真を選択してください。');
    return;
  }

  mealOcrBusy = true;
  const button = document.getElementById('btn-meal-nutrition-ocr');
  if (button) button.disabled = true;
  setMealOcrLoading(true, '栄養成分表示をOCRで読み取っています...', 'カロリー・P・F・Cを検索中');

  try {
    const [Tesseract, image] = await Promise.all([
      loadMealOcrTesseract(),
      loadMealOcrImage(imageFile),
    ]);

    if (!Tesseract?.createWorker) throw new Error('OCRワーカーを起動できませんでした。');
    const worker = await Tesseract.createWorker('jpn+eng', 1);
    let parsed;
    try {
      await worker.setParameters({
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });

      const first = await worker.recognize(buildMealOcrCanvas(image, 'normal'));
      const firstParsed = parseNutritionFromOcr(first?.data?.text || '');
      const complete = [firstParsed.calories, firstParsed.protein, firstParsed.fat, firstParsed.carbs].every(value => value !== null);

      if (complete) {
        parsed = firstParsed;
      } else {
        setMealOcrLoading(true, '栄養成分表示をOCRで読み取っています...', '読み取りにくい文字を再確認中');
        const second = await worker.recognize(buildMealOcrCanvas(image, 'contrast'));
        parsed = mergeParsedNutrition(firstParsed, parseNutritionFromOcr(second?.data?.text || ''));
      }
    } finally {
      await worker.terminate();
    }

    fillMealOcrResult(parsed);
  } catch (error) {
    console.error('Meal nutrition OCR failed:', error);
    const panel = document.getElementById('meal-ocr-result');
    if (panel) panel.hidden = false;
    const status = document.getElementById('meal-ocr-status');
    if (status) {
      status.textContent = 'OCRで十分に読み取れませんでした。数値は手入力してそのまま登録できます。';
      status.dataset.state = 'warning';
    }
    window.alert('栄養成分表示のOCRに失敗しました。\n確認欄へカロリー・P・F・Cを手入力できます。');
  } finally {
    setMealOcrLoading(false);
    if (button) button.disabled = false;
    mealOcrBusy = false;
  }
}

function numberFromInput(id) {
  const raw = document.getElementById(id)?.value;
  if (raw === '' || raw === undefined || raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function saveMealFromOcr() {
  if (mealOcrSaveBusy) return;

  const calories = numberFromInput('meal-ocr-calories');
  const protein = numberFromInput('meal-ocr-protein');
  const fat = numberFromInput('meal-ocr-fat');
  const carbohydrates = numberFromInput('meal-ocr-carbs');

  if ([calories, protein, fat, carbohydrates].some(value => value === null)) {
    window.alert('カロリー・P・F・Cの4項目を確認してください。\n読み取れなかった項目は手入力できます。');
    return;
  }

  const nameInput = document.getElementById('meal-ocr-name');
  const mealText = document.getElementById('meal-text-input')?.value?.trim() || '';
  const name = nameInput?.value?.trim() || mealText.split('\n')[0]?.trim() || '栄養成分表 OCR';
  const date = document.getElementById('meal-date-input')?.value || '';
  const image = getMealOcrImageFile();

  const button = document.getElementById('btn-save-meal-ocr');
  mealOcrSaveBusy = true;
  if (button) button.disabled = true;
  setMealOcrLoading(true, 'OCRで読み取った栄養を登録しています...', '写真と栄養値を保存中');

  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('calories', String(Math.round(calories)));
    formData.append('protein', String(protein));
    formData.append('fat', String(fat));
    formData.append('carbohydrates', String(carbohydrates));
    formData.append('mealDate', date);
    formData.append('mealType', getMealType());
    formData.append('servingAmount', '1');
    formData.append('baseServingAmount', '1');
    formData.append('servingUnit', '個');
    if (image) formData.append('image', image);

    const response = await fetch('/api/history/preset', { method: 'POST', body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'OCR栄養値の登録に失敗しました。');

    window.alert(`登録しました。\n${name}\n${Math.round(calories)} kcal / P ${protein.toFixed(1)}g / F ${fat.toFixed(1)}g / C ${carbohydrates.toFixed(1)}g`);
    window.location.reload();
  } catch (error) {
    console.error('Meal OCR save failed:', error);
    window.alert(`保存に失敗しました。\n${error.message || ''}`);
  } finally {
    setMealOcrLoading(false);
    if (button) button.disabled = false;
    mealOcrSaveBusy = false;
  }
}

function ensureMealOcrStyles() {
  if (document.getElementById('meal-ocr-style')) return;
  const style = document.createElement('style');
  style.id = 'meal-ocr-style';
  style.textContent = `
    .meal-ocr-panel{display:grid;gap:9px;padding:11px;border:1px solid #36576a;border-radius:14px;background:#102431;margin-top:2px}
    .meal-ocr-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .meal-ocr-title{font-size:13px;font-weight:800;color:#fff}
    .meal-ocr-note{font-size:10px;line-height:1.45;color:#b7c7d0}
    #btn-meal-nutrition-ocr{width:100%;min-height:44px;border-radius:12px;background:#126b62;border:1px solid #24d7c4;color:#fff;font-weight:800}
    #meal-ocr-result[hidden]{display:none!important}
    #meal-ocr-result{display:grid;gap:9px}
    .meal-ocr-name{width:100%;padding:10px 11px;border-radius:10px;border:1px solid #3d6074;background:#071923;color:#fff;font:inherit;font-weight:700;outline:none}
    .meal-ocr-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
    .meal-ocr-field{display:grid;gap:4px;min-width:0}
    .meal-ocr-field label{font-size:10px;font-weight:800;color:#dbe8ee}
    .meal-ocr-field input{width:100%;min-width:0;padding:8px 5px;border-radius:8px;border:1px solid #3d6074;background:#071923;color:#fff;text-align:right;font-weight:800;font-size:14px}
    #meal-ocr-status{font-size:10px;line-height:1.45;color:#b7c7d0}
    #meal-ocr-status[data-state="warning"]{color:#ffd27a}
    #meal-ocr-status[data-state="success"]{color:#7ee4b8}
    #btn-save-meal-ocr{width:100%;min-height:44px;border-radius:12px;background:linear-gradient(135deg,#168f5c,#1fbf78);border:1px solid #42d995;color:#fff;font-weight:800}
    @media(max-width:420px){.meal-ocr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

function ensureMealOcrPanel() {
  const modal = document.getElementById('meal-analysis-modal');
  if (!modal || document.getElementById('meal-ocr-panel')) return;

  const actions = modal.querySelector('.meal-analysis-actions');
  if (!actions) return;

  const panel = document.createElement('section');
  panel.id = 'meal-ocr-panel';
  panel.className = 'meal-ocr-panel';
  panel.innerHTML = `
    <div class="meal-ocr-head">
      <span class="meal-ocr-title">栄養成分表示をOCR</span>
    </div>
    <div class="meal-ocr-note">商品の栄養成分表示が写った写真から、カロリー・たんぱく質・脂質・炭水化物を読み取ります。フォーマットは固定でなくてもOKです。AIは使用しません。</div>
    <button type="button" id="btn-meal-nutrition-ocr">栄養成分表をOCRで読み取る</button>
    <div id="meal-ocr-result" hidden>
      <input type="text" id="meal-ocr-name" class="meal-ocr-name" maxlength="100" placeholder="メニュー名（空欄なら補足テキストを使用）">
      <div class="meal-ocr-grid">
        <div class="meal-ocr-field"><label for="meal-ocr-calories">kcal</label><input type="number" min="0" step="1" id="meal-ocr-calories" placeholder="---"></div>
        <div class="meal-ocr-field"><label for="meal-ocr-protein">P (g)</label><input type="number" min="0" step="0.1" id="meal-ocr-protein" placeholder="--.-"></div>
        <div class="meal-ocr-field"><label for="meal-ocr-fat">F (g)</label><input type="number" min="0" step="0.1" id="meal-ocr-fat" placeholder="--.-"></div>
        <div class="meal-ocr-field"><label for="meal-ocr-carbs">C (g)</label><input type="number" min="0" step="0.1" id="meal-ocr-carbs" placeholder="--.-"></div>
      </div>
      <div id="meal-ocr-status">読み取った数値を確認してから登録してください。</div>
      <button type="button" id="btn-save-meal-ocr">OCR内容で登録</button>
    </div>
  `;

  actions.insertAdjacentElement('beforebegin', panel);
  document.getElementById('btn-meal-nutrition-ocr')?.addEventListener('click', runMealNutritionOcr);
  document.getElementById('btn-save-meal-ocr')?.addEventListener('click', saveMealFromOcr);
}

function initMealNutritionOcr() {
  setMealOcrVersion();
  ensureMealOcrStyles();
  ensureMealOcrPanel();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMealNutritionOcr, { once: true });
  } else {
    initMealNutritionOcr();
  }
}
