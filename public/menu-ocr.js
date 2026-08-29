const MEAL_OCR_APP_VERSION = 'v1.0.6';
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
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした。')); };
    image.src = url;
  });
}

function buildMealOcrCanvas(image, mode = 'auto') {
  const maxWidth = 2000;
  const scale = Math.min(2.5, Math.max(1, maxWidth / Math.max(1, image.naturalWidth)));
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

  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data;
  let luminanceSum = 0;
  const sampleStep = Math.max(4, Math.floor(data.length / 8000 / 4) * 4);
  let sampleCount = 0;
  for (let i = 0; i < data.length; i += sampleStep) {
    luminanceSum += data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114;
    sampleCount += 1;
  }
  const averageLuminance = sampleCount ? luminanceSum / sampleCount : 255;
  const darkSource = averageLuminance < 125;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114;
    let value = darkSource ? 255 - gray : gray;
    if (mode === 'contrast') value = Math.max(0, Math.min(255, (value - 128) * 1.9 + 128));
    if (mode === 'binary') value = value < 160 ? 0 : 255;
    if (mode === 'softBinary') value = value < 190 ? 0 : 255;
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
    .replace(/[．。·・]/g, '.')
    .replace(/[：]/g, ':')
    .replace(/[OoＯｏ](?=\d|\.|g)/g, '0')
    .replace(/(?<=\d)[OoＯｏ]/g, '0')
    .replace(/ｇ/gi, 'g')
    .replace(/ＫＣＡＬ/gi, 'kcal')
    .replace(/㎉/g, 'kcal')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n');
}

const NUTRITION_LABELS = {
  calories: [/エネルギー/i, /熱\s*量/i, /カロリー/i, /calor(?:ie|ies)/i, /energy/i],
  protein: [/たんぱく\s*質/i, /タンパク\s*質/i, /蛋白\s*質/i, /protein/i],
  fat: [/脂\s*質/i, /total\s*fat/i, /\bfat\b/i],
  carbs: [/炭水化物(?:量)?/i, /糖質(?:量)?/i, /carbohydrate(?:s)?/i, /total\s*carb/i],
};

function firstLabelMatch(line, patterns) {
  let best = null;
  for (const pattern of patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const regex = new RegExp(pattern.source, flags);
    const match = regex.exec(line);
    if (match && (!best || match.index < best.index)) best = match;
  }
  return best;
}

function numericUnitMatches(text, unit, max) {
  const unitPattern = unit === 'kcal' ? '(?:kcal|kca[l1]|kcai|cal)' : '(?:g|gram(?:s)?)';
  const regex = new RegExp(`(?:約|およそ)?\\s*(\\d{1,5}(?:\\.\\d{1,3})?)\\s*${unitPattern}`, 'ig');
  return [...String(text || '').matchAll(regex)]
    .map(match => {
      const rawNumber = match[1];
      return {
        value: Number(rawNumber),
        index: match.index || 0,
        raw: match[0],
        rawNumber,
        hadDecimal: rawNumber.includes('.'),
        leadingZeroInteger: unit !== 'kcal' && /^0\d+$/.test(rawNumber),
      };
    })
    .filter(item => Number.isFinite(item.value) && item.value >= 0 && item.value <= max);
}

function suspiciousContext(text, value, key) {
  const compact = String(text || '').replace(/\s+/g, ' ');
  if (key === 'protein' && value === 100 && /(?:アミノ酸|amino).{0,10}(?:スコア|score)?\s*100/i.test(compact)) return true;
  if (/スコア\s*100/i.test(compact) && value === 100) return true;
  return false;
}

function extractNutritionCandidates(lines, patterns, { unit, max, key }) {
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const labelMatch = firstLabelMatch(line, patterns);
    if (!labelMatch) continue;

    const afterLabel = line.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 52);
    for (const item of numericUnitMatches(afterLabel, unit, max)) {
      if (!suspiciousContext(line, item.value, key)) candidates.push({ ...item, score: 120 - item.index, source: 'same-line' });
    }

    for (let offset = 1; offset <= 1; offset += 1) {
      const nextLine = lines[index + offset] || '';
      if (!nextLine || Object.values(NUTRITION_LABELS).some(group => firstLabelMatch(nextLine, group))) break;
      for (const item of numericUnitMatches(nextLine.slice(0, 42), unit, max)) {
        if (!suspiciousContext(nextLine, item.value, key)) candidates.push({ ...item, score: 65 - item.index, source: 'next-line' });
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function parseNutritionFromOcr(rawText) {
  const text = normalizeOcrText(rawText);
  const lines = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const candidateMap = {
    calories: extractNutritionCandidates(lines, NUTRITION_LABELS.calories, { unit: 'kcal', max: 5000, key: 'calories' }),
    protein: extractNutritionCandidates(lines, NUTRITION_LABELS.protein, { unit: 'g', max: 500, key: 'protein' }),
    fat: extractNutritionCandidates(lines, NUTRITION_LABELS.fat, { unit: 'g', max: 500, key: 'fat' }),
    carbs: extractNutritionCandidates(lines, NUTRITION_LABELS.carbs, { unit: 'g', max: 1000, key: 'carbs' }),
  };
  const basisMatches = [...text.matchAll(/(?:100\s*(?:g|ml)|1\s*(?:食|包装|個|本|袋|枚|パック)|一\s*(?:食|包装|個|本|袋|枚|パック)|当たり|あたり)/gi)]
    .map(match => match[0].replace(/\s+/g, ''));
  return {
    calories: candidateMap.calories[0]?.value ?? null,
    protein: candidateMap.protein[0]?.value ?? null,
    fat: candidateMap.fat[0]?.value ?? null,
    carbs: candidateMap.carbs[0]?.value ?? null,
    candidates: candidateMap,
    basis: [...new Set(basisMatches)].slice(0, 4),
    rawText: text,
  };
}

function decimalVariantsForCandidate(candidate, key) {
  if (!candidate || !Number.isFinite(candidate.value)) return [];
  const result = [{ value: candidate.value, penalty: 0, reason: candidate.hadDecimal ? 'explicit-decimal' : 'raw' }];
  if (key === 'calories') return result;

  const rawNumber = String(candidate.rawNumber || '');
  if (candidate.leadingZeroInteger && /^0\d+$/.test(rawNumber)) {
    const digits = rawNumber.slice(1);
    if (digits) {
      const oneDecimal = Number(`0.${digits}`);
      if (Number.isFinite(oneDecimal)) result.push({ value: oneDecimal, penalty: 2, reason: 'leading-zero-decimal' });
    }
  }

  if (!candidate.hadDecimal && candidate.value >= 10) {
    result.push({ value: candidate.value / 10, penalty: 24, reason: 'decimal-shift-1' });
  }
  if (!candidate.hadDecimal && candidate.value >= 100) {
    result.push({ value: candidate.value / 100, penalty: 34, reason: 'decimal-shift-2' });
  }

  if (!candidate.hadDecimal && candidate.value > 0 && candidate.value < 10) {
    result.push({ value: candidate.value / 10, penalty: 16, reason: 'possible-missing-leading-zero-decimal' });
  }

  const deduped = new Map();
  for (const item of result) {
    const value = Math.round(item.value * 1000) / 1000;
    const existing = deduped.get(String(value));
    if (!existing || item.penalty < existing.penalty) deduped.set(String(value), { ...item, value });
  }
  return [...deduped.values()];
}

function chooseBestAcrossRuns(runs) {
  const valuesFor = key => {
    const votes = new Map();
    for (const run of runs) {
      const source = run?.candidates?.[key] || [];
      source.slice(0, 3).forEach((candidate, index) => {
        for (const variant of decimalVariantsForCandidate(candidate, key)) {
          const mapKey = String(variant.value);
          const current = votes.get(mapKey) || { value: variant.value, votes: 0, score: 0, explicitDecimalVotes: 0, correctionPenalty: 0 };
          current.votes += index === 0 ? 2 : 1;
          current.score += candidate.score || 0;
          current.correctionPenalty += variant.penalty;
          if (candidate.hadDecimal && variant.value === candidate.value) current.explicitDecimalVotes += index === 0 ? 2 : 1;
          if (variant.reason === 'leading-zero-decimal') current.score += 18;
          votes.set(mapKey, current);
        }
      });
    }
    return [...votes.values()]
      .map(item => ({ ...item, rank: item.votes * 100 + item.score + item.explicitDecimalVotes * 30 - item.correctionPenalty }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 8);
  };

  const calorieOptions = valuesFor('calories').filter(x => x.value >= 1);
  const proteinOptions = valuesFor('protein');
  const fatOptions = valuesFor('fat');
  const carbOptions = valuesFor('carbs');
  const fallback = key => valuesFor(key)[0]?.value ?? null;

  let best = null;
  for (const kcal of calorieOptions.slice(0, 5)) {
    for (const p of proteinOptions.slice(0, 6)) {
      for (const f of fatOptions.slice(0, 6)) {
        for (const c of carbOptions.slice(0, 6)) {
          const macroKcal = p.value * 4 + f.value * 9 + c.value * 4;
          const energyDelta = Math.abs(macroKcal - kcal.value);
          const energyPenalty = energyDelta / Math.max(12, kcal.value * .22);
          const evidenceReward = (kcal.rank + p.rank + f.rank + c.rank) / 260;
          const score = energyPenalty - evidenceReward;
          if (!best || score < best.score) {
            best = { score, calories: kcal.value, protein: p.value, fat: f.value, carbs: c.value, energyDelta };
          }
        }
      }
    }
  }

  const selected = best && best.energyDelta <= Math.max(22, best.calories * .38)
    ? best
    : {
        calories: fallback('calories'),
        protein: fallback('protein'),
        fat: fallback('fat'),
        carbs: fallback('carbs'),
      };

  if (Number.isFinite(selected.calories)) {
    for (const key of ['protein', 'fat', 'carbs']) {
      const value = selected[key];
      if (!Number.isFinite(value)) continue;
      const factor = key === 'fat' ? 9 : 4;
      if (value * factor > selected.calories * 1.35) selected[key] = null;
    }
  }

  selected.basis = [...new Set(runs.flatMap(run => run.basis || []))].slice(0, 4);
  selected.rawText = runs.map(run => run.rawText || '').join('\n');
  return selected;
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
    input.value = value === null || value === undefined ? '' : decimals === 0 ? String(Math.round(value)) : Number(value).toFixed(decimals);
  }
  const mealText = document.getElementById('meal-text-input')?.value?.trim() || '';
  const nameInput = document.getElementById('meal-ocr-name');
  if (nameInput && !nameInput.value.trim() && mealText) nameInput.value = mealText.split('\n')[0].slice(0, 80);
  const panel = document.getElementById('meal-ocr-result');
  if (panel) panel.hidden = false;
  const status = document.getElementById('meal-ocr-status');
  if (status) {
    const count = [parsed.calories, parsed.protein, parsed.fat, parsed.carbs].filter(value => value !== null && value !== undefined).length;
    const basisText = parsed.basis?.length ? ` 基準表記: ${parsed.basis.join(' / ')}` : '';
    status.textContent = count === 4
      ? `4項目を読み取りました。先頭0や小数点落ちも補正候補として比較しています。${basisText}`
      : `${count}/4項目を読み取りました。誤認の可能性が高い値は空欄にしています。${basisText}`;
    status.dataset.state = count === 4 ? 'success' : 'warning';
  }
}

async function runMealNutritionOcr() {
  if (mealOcrBusy) return;
  const imageFile = getMealOcrImageFile();
  if (!imageFile) { window.alert('栄養成分表示が写っている写真を選択してください。'); return; }
  mealOcrBusy = true;
  const button = document.getElementById('btn-meal-nutrition-ocr');
  if (button) button.disabled = true;
  setMealOcrLoading(true, '栄養成分表示をOCRで読み取っています...', '複数パターンでカロリー・P・F・Cを確認中');

  try {
    const [Tesseract, image] = await Promise.all([loadMealOcrTesseract(), loadMealOcrImage(imageFile)]);
    if (!Tesseract?.createWorker) throw new Error('OCRワーカーを起動できませんでした。');
    const worker = await Tesseract.createWorker('jpn+eng', 1);
    const runs = [];
    try {
      await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300', tessedit_pageseg_mode: '6' });
      const modes = ['auto', 'contrast', 'binary', 'softBinary'];
      for (let index = 0; index < modes.length; index += 1) {
        setMealOcrLoading(true, '栄養成分表示をOCRで読み取っています...', `文字を再確認中 ${index + 1}/${modes.length}`);
        const result = await worker.recognize(buildMealOcrCanvas(image, modes[index]));
        runs.push(parseNutritionFromOcr(result?.data?.text || ''));
      }
    } finally {
      await worker.terminate();
    }
    fillMealOcrResult(chooseBestAcrossRuns(runs));
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
    .meal-ocr-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.meal-ocr-title{font-size:13px;font-weight:800;color:#fff}
    .meal-ocr-note{font-size:10px;line-height:1.45;color:#b7c7d0}#btn-meal-nutrition-ocr{width:100%;min-height:44px;border-radius:12px;background:#126b62;border:1px solid #24d7c4;color:#fff;font-weight:800}
    #meal-ocr-result[hidden]{display:none!important}#meal-ocr-result{display:grid;gap:9px}.meal-ocr-name{width:100%;padding:10px 11px;border-radius:10px;border:1px solid #3d6074;background:#071923;color:#fff;font:inherit;font-weight:700;outline:none}
    .meal-ocr-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.meal-ocr-field{display:grid;gap:4px;min-width:0}.meal-ocr-field label{font-size:10px;font-weight:800;color:#dbe8ee}.meal-ocr-field input{width:100%;min-width:0;padding:8px 5px;border-radius:8px;border:1px solid #3d6074;background:#071923;color:#fff;text-align:right;font-weight:800;font-size:14px}
    #meal-ocr-status{font-size:10px;line-height:1.45;color:#b7c7d0}#meal-ocr-status[data-state="warning"]{color:#ffd27a}#meal-ocr-status[data-state="success"]{color:#7ee4b8}#btn-save-meal-ocr{width:100%;min-height:44px;border-radius:12px;background:linear-gradient(135deg,#168f5c,#1fbf78);border:1px solid #42d995;color:#fff;font-weight:800}@media(max-width:420px){.meal-ocr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
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
    <div class="meal-ocr-head"><span class="meal-ocr-title">栄養成分表示をOCR</span></div>
    <div class="meal-ocr-note">商品の栄養成分表示からカロリー・たんぱく質・脂質・炭水化物を読み取ります。フォーマット固定ではなく、項目名・単位・小数点候補を照合します。AIは使用しません。</div>
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
    </div>`;
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMealNutritionOcr, { once: true });
  else initMealNutritionOcr();
}
