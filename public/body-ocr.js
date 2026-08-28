const APP_VERSION = 'v1.0.3';
const BODY_OCR_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let tesseractLoader = null;
let lastRecognizedBodyType = '';
let bodySaveInProgress = false;

const SMART_SCALE_FIELDS = [
  { id:'input-weight-val', row:0, col:0, decimals:2, min:30, max:250, key:'weight', previousKey:'weight', tolerance:5 },
  { id:'input-bmi-val', row:0, col:1, decimals:1, min:10, max:60, key:'bmi', previousKey:'bmi', tolerance:3 },
  { id:'input-fat-val', row:1, col:0, decimals:1, min:3, max:70, key:'fatRate', previousKey:'fatRate', tolerance:8 },
  { id:'input-heart-val', row:1, col:1, decimals:0, min:30, max:220, key:'heartRate', previousKey:'heartRate', tolerance:45 },
  { id:'input-muscle-val', row:2, col:0, decimals:2, min:10, max:150, key:'muscleMass', previousKey:'muscleMass', tolerance:8 },
  { id:'input-bmr-val', row:2, col:1, decimals:0, min:500, max:4000, key:'bmr', previousKey:'bmr', tolerance:450 },
  { id:'input-water-val', row:3, col:0, decimals:1, min:20, max:80, key:'waterRate', previousKey:'waterRate', tolerance:10 },
  { id:'input-fatmass-val', row:3, col:1, decimals:2, min:1, max:100, key:'fatMass', previousKey:'fatMass', tolerance:8 },
  { id:'input-leanbody-val', row:4, col:0, decimals:2, min:20, max:200, key:'leanBodyMass', previousKey:'leanBodyMass', tolerance:8 },
  { id:'input-bone-val', row:4, col:1, decimals:2, min:1, max:10, key:'boneMass', previousKey:'boneMass', tolerance:1 },
  { id:'input-visceralfat-val', row:5, col:0, decimals:1, min:1, max:30, key:'visceralFat', previousKey:'visceralFat', tolerance:5 },
  { id:'input-proteinrate-val', row:5, col:1, decimals:1, min:5, max:40, key:'proteinRate', previousKey:'proteinRate', tolerance:5 },
  { id:'input-skeletalmuscle-val', row:6, col:0, decimals:2, min:10, max:100, key:'skeletalMuscleMass', previousKey:'skeletalMuscleMass', tolerance:7 },
  { id:'input-subcutaneous-val', row:6, col:1, decimals:1, min:3, max:70, key:'subcutaneousFat', previousKey:'subcutaneousFat', tolerance:8 },
  { id:'input-bodyage-val', row:7, col:0, decimals:0, min:10, max:100, key:'bodyAge', previousKey:'bodyAge', tolerance:10 },
];

const VALUE_LAYOUT = {
  leftX0: 0.080,
  leftX1: 0.405,
  rightX0: 0.575,
  rightX1: 0.910,
  firstY: 0.0685,
  rowStep: 0.1183,
  halfHeight: 0.0135,
};

function ensureAppVersion() {
  const version = document.querySelector('.app-version');
  if (version) version.textContent = APP_VERSION;
}

function loadTesseract() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if (tesseractLoader) return tesseractLoader;
  tesseractLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-physilog-tesseract]');
    if (existing) {
      if (globalThis.Tesseract) return resolve(globalThis.Tesseract);
      existing.addEventListener('load', () => resolve(globalThis.Tesseract), { once:true });
      existing.addEventListener('error', () => reject(new Error('OCRライブラリを読み込めませんでした。')), { once:true });
      return;
    }
    const script = document.createElement('script');
    script.src = BODY_OCR_SCRIPT_URL;
    script.async = true;
    script.dataset.physilogTesseract = '1';
    script.onload = () => resolve(globalThis.Tesseract);
    script.onerror = () => reject(new Error('OCRライブラリを読み込めませんでした。'));
    document.head.appendChild(script);
  });
  return tesseractLoader;
}

function getSelectedBodyImage() {
  return document.getElementById('weight-camera-input')?.files?.[0]
    || document.getElementById('weight-gallery-input')?.files?.[0]
    || null;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした。')); };
    image.src = url;
  });
}

function setLoading(visible, title='', detail='') {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  if (title) overlay.querySelector('p')?.replaceChildren(document.createTextNode(title));
  if (detail) overlay.querySelector('.loading-subtext')?.replaceChildren(document.createTextNode(detail));
  overlay.style.display = visible ? 'flex' : 'none';
}

function showResultEditor() {
  const editor = document.getElementById('weight-result-edit-container');
  if (!editor) return;
  editor.style.display = 'block';
  editor.scrollIntoView({ behavior:'smooth', block:'start' });
}

function fieldValue(id) {
  return String(document.getElementById(id)?.value || '').trim();
}

function clearBodyCompositionFields() {
  [...SMART_SCALE_FIELDS.map(field => field.id), 'input-bodytype-val'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
  lastRecognizedBodyType = '';
}

function applyParsedValues(values) {
  let applied = 0;
  Object.entries(values).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (!input || value === '' || value === null || value === undefined) return;
    input.value = String(value).trim();
    if (id === 'input-bodytype-val') lastRecognizedBodyType = input.value;
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
    applied += 1;
  });
  return applied;
}

function cropRectForField(field, width, height) {
  const x0 = field.col === 0 ? VALUE_LAYOUT.leftX0 : VALUE_LAYOUT.rightX0;
  const x1 = field.col === 0 ? VALUE_LAYOUT.leftX1 : VALUE_LAYOUT.rightX1;
  const cy = VALUE_LAYOUT.firstY + VALUE_LAYOUT.rowStep * field.row;
  return {
    sx: Math.max(0, Math.round(x0 * width)),
    sy: Math.max(0, Math.round((cy - VALUE_LAYOUT.halfHeight) * height)),
    sw: Math.round((x1 - x0) * width),
    sh: Math.round(VALUE_LAYOUT.halfHeight * 2 * height),
  };
}

function buildFieldCanvas(image, field, mode='gray') {
  const rect = cropRectForField(field, image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 170;
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 18, 12, canvas.width - 36, canvas.height - 24);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114;
    let value = gray;
    if (mode === 'contrast') value = Math.max(0, Math.min(255, (gray - 128) * 1.7 + 128));
    if (mode === 'threshold190') value = gray < 190 ? 0 : 255;
    if (mode === 'threshold215') value = gray < 215 ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function normalizeValueForField(raw, field) {
  if (!raw) return null;
  let cleaned = String(raw)
    .replace(/[OoＯｏ]/g, '0')
    .replace(/[Il１|]/g, '1')
    .replace(/[，,]/g, '.')
    .replace(/[^0-9.]/g, '');
  if (!cleaned) return null;

  const dots = cleaned.match(/\./g)?.length || 0;
  if (dots > 1) {
    const first = cleaned.indexOf('.');
    cleaned = cleaned.slice(0, first + 1) + cleaned.slice(first + 1).replace(/\./g, '');
  }

  let value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  if (!cleaned.includes('.') && field.decimals > 0) {
    const preferred = value / (10 ** field.decimals);
    if (preferred >= field.min && preferred <= field.max) value = preferred;
    else if (value > field.max) {
      for (let places = 1; places <= 3; places += 1) {
        const candidate = value / (10 ** places);
        if (candidate >= field.min && candidate <= field.max) {
          value = candidate;
          break;
        }
      }
    }
  }

  if (value < field.min || value > field.max) return null;
  return field.decimals === 0 ? String(Math.round(value)) : value.toFixed(field.decimals);
}

async function getPreviousBodyComposition() {
  try {
    const response = await fetch('/api/body-composition', { cache:'no-store' });
    if (!response.ok) return null;
    const records = await response.json();
    if (!Array.isArray(records) || !records.length) return null;
    return records[0] || null;
  } catch {
    return null;
  }
}

function chooseBestCandidate(candidates, field, previousRecord) {
  if (!candidates.length) return null;
  const previous = Number(previousRecord?.[field.previousKey]);
  const grouped = new Map();

  for (const candidate of candidates) {
    const entry = grouped.get(candidate.value) || { value:candidate.value, votes:0, confidence:0 };
    entry.votes += 1;
    entry.confidence += Number(candidate.confidence || 0);
    grouped.set(candidate.value, entry);
  }

  const ranked = [...grouped.values()].map(entry => {
    const numeric = Number(entry.value);
    let score = entry.votes * 35 + entry.confidence / Math.max(1, entry.votes);
    if (Number.isFinite(previous)) {
      const delta = Math.abs(numeric - previous);
      score -= Math.min(120, (delta / Math.max(.1, field.tolerance)) * 65);
      if (delta <= field.tolerance) score += 25;
    }
    return { ...entry, score };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return null;
  if (Number.isFinite(previous) && Math.abs(Number(best.value) - previous) > field.tolerance * 2.2) return null;
  return best.value;
}

async function recognizeOneField(worker, image, field, previousRecord) {
  const candidates = [];
  for (const mode of ['gray', 'contrast', 'threshold190', 'threshold215']) {
    const result = await worker.recognize(buildFieldCanvas(image, field, mode));
    const text = String(result?.data?.text || '').trim();
    const normalized = normalizeValueForField(text, field);
    if (normalized !== null) {
      candidates.push({ value: normalized, confidence: Number(result?.data?.confidence || 0), text });
    }
  }
  return chooseBestCandidate(candidates, field, previousRecord);
}

function reconcileSmartScaleValues(values) {
  const get = id => Number(values[id]);
  const set = (id, value, decimals) => {
    if (!Number.isFinite(value)) return;
    values[id] = decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals);
  };

  const weight = get('input-weight-val');
  let fatRate = get('input-fat-val');
  let fatMass = get('input-fatmass-val');
  let lean = get('input-leanbody-val');
  const bone = get('input-bone-val');
  let muscle = get('input-muscle-val');

  if (Number.isFinite(weight) && Number.isFinite(fatMass)) {
    const derivedLean = weight - fatMass;
    if (derivedLean >= 20 && derivedLean <= 200 && (!Number.isFinite(lean) || Math.abs(lean - derivedLean) > .45)) {
      lean = derivedLean;
      set('input-leanbody-val', lean, 2);
    }
  }

  if (Number.isFinite(weight) && Number.isFinite(fatRate)) {
    const derivedFatMass = weight * fatRate / 100;
    if (derivedFatMass >= 1 && derivedFatMass <= 100 && (!Number.isFinite(fatMass) || Math.abs(fatMass - derivedFatMass) > .9)) {
      fatMass = derivedFatMass;
      set('input-fatmass-val', fatMass, 2);
    }
  }

  if (Number.isFinite(weight) && Number.isFinite(fatMass)) {
    const derivedFatRate = fatMass / weight * 100;
    if (derivedFatRate >= 3 && derivedFatRate <= 70 && (!Number.isFinite(fatRate) || Math.abs(fatRate - derivedFatRate) > 1.4)) {
      fatRate = derivedFatRate;
      set('input-fat-val', fatRate, 1);
    }
  }

  if (Number.isFinite(lean) && Number.isFinite(bone)) {
    const derivedMuscle = lean - bone;
    if (derivedMuscle >= 10 && derivedMuscle <= 150 && (!Number.isFinite(muscle) || Math.abs(muscle - derivedMuscle) > .35)) {
      set('input-muscle-val', derivedMuscle, 2);
    }
  }

  return values;
}

async function recognizeNumericFields(Tesseract, image, previousRecord) {
  if (!Tesseract?.createWorker) throw new Error('OCRワーカーを開始できませんでした。');
  const worker = await Tesseract.createWorker('eng', 1);
  const values = {};
  try {
    await worker.setParameters({
      tessedit_char_whitelist:'0123456789.,',
      tessedit_pageseg_mode:'7',
      preserve_interword_spaces:'0',
      user_defined_dpi:'300',
    });

    for (let index = 0; index < SMART_SCALE_FIELDS.length; index += 1) {
      const field = SMART_SCALE_FIELDS[index];
      setLoading(true, 'OCRで体組成データを読み取っています...', `固定カードを認識中 ${index + 1}/${SMART_SCALE_FIELDS.length}`);
      const value = await recognizeOneField(worker, image, field, previousRecord);
      if (value !== null) values[field.id] = value;
    }
  } finally {
    await worker.terminate();
  }
  return reconcileSmartScaleValues(values);
}

function buildBodyTypeCanvas(image, threshold=null) {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 240;
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sx = Math.round(.535 * image.naturalWidth);
  const sy = Math.round(.884 * image.naturalHeight);
  const sw = Math.round(.405 * image.naturalWidth);
  const sh = Math.round(.045 * image.naturalHeight);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  if (threshold !== null) {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114;
      const binary = gray < threshold ? 0 : 255;
      data[i] = binary;
      data[i + 1] = binary;
      data[i + 2] = binary;
      data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  return canvas;
}

function parseBodyTypeText(rawText) {
  const text = String(rawText || '').replace(/\s+/g, '');
  if (/標.{0,4}(準|准).{0,2}的/.test(text) || /標.{0,4}(準|准)/.test(text)) return '標準的';
  if (/隠.{0,3}れ?.{0,3}肥.{0,3}満/.test(text)) return '隠れ肥満型';
  if (/筋.{0,3}肉/.test(text)) return '筋肉型';
  if (/運.{0,3}動/.test(text)) return '運動型';
  if (/やせ|痩/.test(text)) return 'やせ型';
  if (/肥.{0,3}満/.test(text)) return '肥満型';
  return '';
}

async function recognizeBodyType(Tesseract, image) {
  for (const threshold of [null, 205, 175]) {
    try {
      const result = await Tesseract.recognize(buildBodyTypeCanvas(image, threshold), 'jpn', {
        tessedit_pageseg_mode:'7',
      });
      const parsed = parseBodyTypeText(result?.data?.text || '');
      if (parsed) return parsed;
    } catch (error) {
      console.warn('Body type OCR attempt skipped:', error);
    }
  }
  return '';
}

function parsePastedText(rawText) {
  const text = String(rawText || '').replace(/[，、]/g, ',').replace(/[．。]/g, '.');
  const values = {};
  const rules = [
    ['input-weight-val', /体重[^\d]{0,20}([\d.,]+)/, 0],
    ['input-bmi-val', /BMI[^\d]{0,20}([\d.,]+)/i, 1],
    ['input-fat-val', /体脂肪率[^\d]{0,20}([\d.,]+)/, 2],
    ['input-heart-val', /心拍数[^\d]{0,20}([\d.,]+)/, 3],
    ['input-muscle-val', /筋肉量[^\d]{0,20}([\d.,]+)/, 4],
    ['input-bmr-val', /基礎代謝(?:量)?[^\d]{0,20}([\d.,]+)/, 5],
    ['input-water-val', /水分量[^\d]{0,20}([\d.,]+)/, 6],
    ['input-fatmass-val', /体脂肪量[^\d]{0,20}([\d.,]+)/, 7],
    ['input-leanbody-val', /除脂肪体重[^\d]{0,20}([\d.,]+)/, 8],
    ['input-bone-val', /骨量[^\d]{0,20}([\d.,]+)/, 9],
    ['input-visceralfat-val', /内臓脂肪[^\d]{0,20}([\d.,]+)/, 10],
    ['input-proteinrate-val', /タンパク質[^\d]{0,20}([\d.,]+)/, 11],
    ['input-skeletalmuscle-val', /骨格筋量[^\d]{0,20}([\d.,]+)/, 12],
    ['input-subcutaneous-val', /皮下脂肪[^\d]{0,20}([\d.,]+)/, 13],
    ['input-bodyage-val', /体内年齢[^\d]{0,20}([\d.,]+)/, 14],
  ];
  for (const [id, regex, fieldIndex] of rules) {
    const raw = text.match(regex)?.[1];
    const normalized = normalizeValueForField(raw, SMART_SCALE_FIELDS[fieldIndex]);
    if (normalized !== null) values[id] = normalized;
  }
  const bodyType = parseBodyTypeText(text);
  if (bodyType) values['input-bodytype-val'] = bodyType;
  return reconcileSmartScaleValues(values);
}

function normalizeBodyTypeBeforeSave() {
  const input = document.getElementById('input-bodytype-val');
  if (!input) return '';
  let value = String(input.value || lastRecognizedBodyType || '').trim();
  if (value === '標準') value = '標準的';
  if (value) {
    lastRecognizedBodyType = value;
    input.value = value;
  }
  return value;
}

function reconcileConfirmationFields() {
  const values = {};
  SMART_SCALE_FIELDS.forEach(field => {
    const value = fieldValue(field.id);
    if (value !== '') values[field.id] = value;
  });
  reconcileSmartScaleValues(values);
  applyParsedValues(values);
}

async function saveBodyCompositionFromConfirmation(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (bodySaveInProgress) return;

  reconcileConfirmationFields();
  const weight = fieldValue('input-weight-val');
  const fatRate = fieldValue('input-fat-val');
  const muscleMass = fieldValue('input-muscle-val');
  if (!weight && !fatRate && !muscleMass) {
    window.alert('体重、体脂肪率、筋肉量のいずれかを入力してください。');
    return;
  }

  const bodyType = normalizeBodyTypeBeforeSave();

  bodySaveInProgress = true;
  const button = event.currentTarget;
  button.disabled = true;
  setLoading(true, '体組成データを保存しています...', '確認した項目をGoogle Driveへ保存中');

  try {
    const formData = new FormData();
    SMART_SCALE_FIELDS.forEach(field => formData.append(field.key, fieldValue(field.id)));
    formData.append('bodyType', bodyType);
    formData.append('date', fieldValue('weight-date-input'));
    const activeChip = document.querySelector('#weight-type-chips .weight-chip.active');
    formData.append('measurementType', activeChip?.dataset?.type || 'morning');
    formData.append('textInput', fieldValue('weight-text-input'));
    const image = getSelectedBodyImage();
    if (image) formData.append('image', image);

    const response = await fetch('/api/body-composition', { method:'POST', body:formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'データの保存に失敗しました。');

    const savedBodyType = String(payload?.bodyType || '').trim();
    if (bodyType && savedBodyType !== bodyType) {
      throw new Error('入力したボディタイプが保存結果に反映されませんでした。');
    }

    const bodyTypeText = savedBodyType || '未設定';
    window.alert(`体組成データを保存しました。\n筋肉量: ${fieldValue('input-muscle-val') || '--'} kg\nボディタイプ: ${bodyTypeText}`);
    window.location.reload();
  } catch (error) {
    console.error('Body composition save failed:', error);
    window.alert(`保存に失敗しました。\n${error.message || ''}`);
  } finally {
    setLoading(false);
    button.disabled = false;
    bodySaveInProgress = false;
  }
}

async function runBodyOcr(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const button = event.currentTarget;
  const imageFile = getSelectedBodyImage();
  const pastedText = fieldValue('weight-text-input');
  if (!imageFile && !pastedText) {
    window.alert('体組成計の写真を選択するか、数値テキストを入力してください。');
    return;
  }

  button.disabled = true;
  clearBodyCompositionFields();
  try {
    let values = parsePastedText(pastedText);
    if (imageFile) {
      setLoading(true, 'OCRで体組成データを読み取っています...', 'Smart Scale画像を準備中');
      const [Tesseract, image, previousRecord] = await Promise.all([
        loadTesseract(),
        loadImageFromFile(imageFile),
        getPreviousBodyComposition(),
      ]);

      const recognized = await recognizeNumericFields(Tesseract, image, previousRecord);
      values = reconcileSmartScaleValues({ ...values, ...recognized });

      setLoading(true, 'OCRで体組成データを読み取っています...', 'ボディタイプを認識中（任意）');
      const bodyType = await recognizeBodyType(Tesseract, image);
      if (bodyType) {
        lastRecognizedBodyType = bodyType;
        values['input-bodytype-val'] = bodyType;
      }
    }

    applyParsedValues(values);
    reconcileConfirmationFields();
    showResultEditor();
    const bodyTypeInput = document.getElementById('input-bodytype-val');
    if (bodyTypeInput) bodyTypeInput.placeholder = '任意（読み取れなくても保存できます）';

    const filledNumericCount = SMART_SCALE_FIELDS.filter(field => fieldValue(field.id) !== '').length;
    if (filledNumericCount === 0) {
      window.alert('OCRで数値を特定できませんでした。\n確認欄へ手動で入力してください。');
    } else if (filledNumericCount < SMART_SCALE_FIELDS.length) {
      window.alert(`${filledNumericCount}/${SMART_SCALE_FIELDS.length}項目を読み取りました。\n空欄だけ確認・手入力して保存してください。\nボディタイプは空欄のままでも保存できます。`);
    } else if (!normalizeBodyTypeBeforeSave()) {
      window.alert('数値15項目を読み取りました。\nボディタイプは読み取れませんでしたが、そのまま保存できます。');
    } else {
      window.alert('体組成15項目とボディタイプを読み取りました。\n数値を確認してから保存してください。');
    }
  } catch (error) {
    console.error('Body composition OCR failed:', error);
    showResultEditor();
    window.alert('OCR読み取りに失敗しました。\n確認欄へ手動で数値を入力して保存できます。\nボディタイプは任意です。');
  } finally {
    setLoading(false);
    button.disabled = false;
  }
}

function ensureBodyCompositionStyles() {
  if (document.getElementById('body-ocr-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'body-ocr-ui-style';
  style.textContent = `
    #weight-result-edit-container.body-comp-results-edit-card{background:#132b3a!important;border:1px solid #294759!important}
    #weight-result-edit-container .results-edit-title{color:#f8fafc!important;opacity:1!important}
    #weight-result-edit-container .result-edit-field{background:#102431!important;border:1px solid #36576a!important;box-shadow:none!important}
    #weight-result-edit-container .result-edit-field .label{color:#e6f0f5!important;opacity:1!important;font-weight:700!important}
    #weight-result-edit-container .input-number-v2{background:#071923!important;color:#fff!important;border:1px solid #3d6074!important;box-shadow:none!important;font-weight:800!important;opacity:1!important}
    #weight-result-edit-container .input-number-v2::placeholder{color:#758b97!important;opacity:1!important;font-weight:600!important}
    #input-bodytype-val:not(:placeholder-shown){border-color:#38d996!important}
    #btn-save-weight{background:linear-gradient(135deg,#168f5c,#1fbf78)!important;border:1px solid #42d995!important;color:#fff!important;font-weight:800!important;box-shadow:0 8px 22px rgba(31,191,120,.22)!important;opacity:1!important}
    #btn-save-weight:disabled{background:#29414d!important;border-color:#3e5965!important;color:#9eb0b8!important;box-shadow:none!important;opacity:.72!important}
    .floating-entry-actions{position:absolute;left:14px;bottom:76px;z-index:7000;display:flex;flex-direction:column;gap:10px;pointer-events:none}
    .floating-entry-btn{pointer-events:auto;width:54px;height:54px;border-radius:50%;border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.32);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:transform .16s ease,filter .16s ease;background:#173445}
    .floating-entry-btn.meal{background:linear-gradient(135deg,#148866,#20b981)}
    .floating-entry-btn.body{background:linear-gradient(135deg,#17677e,#20a4bf)}
    .floating-entry-btn:active{transform:scale(.92)}
    .floating-entry-btn svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .floating-entry-btn .fab-label{position:absolute;left:64px;white-space:nowrap;background:#0c1e29;color:#fff;border:1px solid #294759;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800;opacity:0;transform:translateX(-4px);pointer-events:none;transition:opacity .15s ease,transform .15s ease;box-shadow:0 4px 12px rgba(0,0,0,.25)}
    .floating-entry-btn:focus-visible .fab-label,.floating-entry-btn:hover .fab-label{opacity:1;transform:translateX(0)}
    @media(max-width:480px){.floating-entry-actions{left:12px;bottom:72px}.floating-entry-btn{width:50px;height:50px}.floating-entry-btn svg{width:22px;height:22px}}
  `;
  document.head.appendChild(style);
}

function ensureOcrHint(button) {
  if (!button) return;
  button.textContent = 'OCRで数値を読み取る';
  let hint = document.getElementById('body-ocr-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'body-ocr-hint';
    hint.style.cssText = 'margin-top:8px;font-size:11px;line-height:1.5;color:#b7c7d0;text-align:center;';
    button.insertAdjacentElement('afterend', hint);
  }
  hint.textContent = 'Smart Scale固定レイアウト専用OCR（Tesseract.js）。数値を読み取り、ボディタイプは任意項目として扱います。AIは使用しません。';
}

function ensureFloatingEntryActions() {
  if (document.getElementById('floating-entry-actions')) return;
  const host = document.querySelector('.app-container') || document.body;
  const wrap = document.createElement('div');
  wrap.id = 'floating-entry-actions';
  wrap.className = 'floating-entry-actions';
  wrap.setAttribute('aria-label', 'クイック登録');
  wrap.innerHTML = `
    <button type="button" class="floating-entry-btn meal" id="floating-open-meal" aria-label="メニュー登録" title="メニュー登録">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v8c0 1.1.9 2 2 2h3v3"/></svg>
      <span class="fab-label">メニュー登録</span>
    </button>
    <button type="button" class="floating-entry-btn body" id="floating-open-weight" aria-label="体組成登録" title="体組成登録">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8a4 4 0 0 1 8 0"/><path d="M12 8l2-2"/></svg>
      <span class="fab-label">体組成登録</span>
    </button>`;
  host.appendChild(wrap);

  document.getElementById('floating-open-meal')?.addEventListener('click', () => {
    document.getElementById('btn-open-meal-entry')?.click();
  });
  document.getElementById('floating-open-weight')?.addEventListener('click', () => {
    document.getElementById('btn-open-weight-entry')?.click();
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    ensureAppVersion();
    ensureBodyCompositionStyles();
    ensureFloatingEntryActions();

    const bodyTypeInput = document.getElementById('input-bodytype-val');
    if (bodyTypeInput) bodyTypeInput.placeholder = '任意（読み取れなくても保存できます）';

    const analyzeButton = document.getElementById('btn-analyze-weight');
    if (analyzeButton) {
      ensureOcrHint(analyzeButton);
      analyzeButton.addEventListener('click', runBodyOcr, { capture:true });
    }

    const saveButton = document.getElementById('btn-save-weight');
    if (saveButton) {
      saveButton.addEventListener('click', saveBodyCompositionFromConfirmation, { capture:true });
    }
  });
}
