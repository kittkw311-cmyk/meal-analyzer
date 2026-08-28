const BODY_OCR_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let tesseractLoader = null;

function loadTesseract() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if (tesseractLoader) return tesseractLoader;
  tesseractLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-physilog-tesseract]');
    if (existing) {
      existing.addEventListener('load', () => resolve(globalThis.Tesseract), { once: true });
      existing.addEventListener('error', () => reject(new Error('OCRライブラリを読み込めませんでした。')), { once: true });
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

const SMART_SCALE_FIELDS = [
  { id: 'input-weight-val',         row: 0, col: 0, decimals: 2, min: 30,  max: 250 },
  { id: 'input-bmi-val',            row: 0, col: 1, decimals: 1, min: 10,  max: 60 },
  { id: 'input-fat-val',            row: 1, col: 0, decimals: 1, min: 3,   max: 70 },
  { id: 'input-heart-val',          row: 1, col: 1, decimals: 0, min: 30,  max: 220 },
  { id: 'input-muscle-val',         row: 2, col: 0, decimals: 2, min: 10,  max: 150 },
  { id: 'input-bmr-val',            row: 2, col: 1, decimals: 0, min: 500, max: 4000 },
  { id: 'input-water-val',          row: 3, col: 0, decimals: 1, min: 20,  max: 80 },
  { id: 'input-fatmass-val',        row: 3, col: 1, decimals: 2, min: 1,   max: 100 },
  { id: 'input-leanbody-val',       row: 4, col: 0, decimals: 2, min: 20,  max: 200 },
  { id: 'input-bone-val',           row: 4, col: 1, decimals: 2, min: 1,   max: 10 },
  { id: 'input-visceralfat-val',    row: 5, col: 0, decimals: 1, min: 1,   max: 30 },
  { id: 'input-proteinrate-val',    row: 5, col: 1, decimals: 1, min: 5,   max: 40 },
  { id: 'input-skeletalmuscle-val', row: 6, col: 0, decimals: 2, min: 10,  max: 100 },
  { id: 'input-subcutaneous-val',   row: 6, col: 1, decimals: 1, min: 3,   max: 70 },
  { id: 'input-bodyage-val',        row: 7, col: 0, decimals: 0, min: 10,  max: 100 },
];

const VALUE_LAYOUT = {
  leftX0: 0.072,
  leftX1: 0.455,
  rightX0: 0.552,
  rightX1: 0.938,
  firstY: 0.0685,
  rowStep: 0.1183,
  halfHeight: 0.0185,
};

function getSelectedBodyImage() {
  return document.getElementById('weight-camera-input')?.files?.[0]
    || document.getElementById('weight-gallery-input')?.files?.[0]
    || null;
}

function setLoading(visible, title = '', detail = '') {
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
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearBodyCompositionFields() {
  [...SMART_SCALE_FIELDS.map((field) => field.id), 'input-bodytype-val'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
}

function applyParsedValues(values) {
  let applied = 0;
  Object.entries(values).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (!input || value === '' || value === null || value === undefined) return;
    input.value = String(value).trim();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    applied += 1;
  });
  return applied;
}

function ensureBodyCompositionStyles() {
  if (document.getElementById('body-ocr-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'body-ocr-ui-style';
  style.textContent = `
    #weight-result-edit-container.body-comp-results-edit-card {
      background: #132b3a !important;
      border: 1px solid #294759 !important;
    }
    #weight-result-edit-container .results-edit-title {
      color: #f8fafc !important;
      opacity: 1 !important;
    }
    #weight-result-edit-container .result-edit-field {
      background: #102431 !important;
      border: 1px solid #36576a !important;
      box-shadow: none !important;
    }
    #weight-result-edit-container .result-edit-field .label {
      color: #e6f0f5 !important;
      opacity: 1 !important;
      font-weight: 700 !important;
    }
    #weight-result-edit-container .input-number-v2,
    #weight-result-edit-container #input-bodytype-val {
      background: #071923 !important;
      color: #ffffff !important;
      border: 1px solid #3d6074 !important;
      box-shadow: none !important;
      font-weight: 800 !important;
      opacity: 1 !important;
    }
    #weight-result-edit-container .input-number-v2::placeholder {
      color: #91a6b3 !important;
      opacity: 1 !important;
    }
    #btn-save-weight {
      background: linear-gradient(135deg, #168f5c, #1fbf78) !important;
      border: 1px solid #42d995 !important;
      color: #ffffff !important;
      font-weight: 800 !important;
      box-shadow: 0 8px 22px rgba(31, 191, 120, .22) !important;
      opacity: 1 !important;
    }
    #btn-save-weight:hover,
    #btn-save-weight:focus-visible {
      filter: brightness(1.08) !important;
    }
    #btn-save-weight:disabled {
      background: #29414d !important;
      border-color: #3e5965 !important;
      color: #9eb0b8 !important;
      box-shadow: none !important;
      opacity: .72 !important;
    }
  `;
  document.head.appendChild(style);
}

function ensureOcrHint(button) {
  if (!button) return;
  button.textContent = 'OCRで数値を読み取る';
  if (document.getElementById('body-ocr-hint')) return;
  const hint = document.createElement('div');
  hint.id = 'body-ocr-hint';
  hint.style.cssText = 'margin-top:8px;font-size:11px;line-height:1.5;color:#b7c7d0;text-align:center;';
  hint.textContent = 'Smart Scale専用OCR。各数値を1項目ずつ読み取り、確認欄へ反映します。AIは使用しません。';
  button.insertAdjacentElement('afterend', hint);
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

function cropRectForField(field, width, height) {
  const x0Ratio = field.col === 0 ? VALUE_LAYOUT.leftX0 : VALUE_LAYOUT.rightX0;
  const x1Ratio = field.col === 0 ? VALUE_LAYOUT.leftX1 : VALUE_LAYOUT.rightX1;
  const cyRatio = VALUE_LAYOUT.firstY + VALUE_LAYOUT.rowStep * field.row;
  return {
    sx: Math.max(0, Math.round(x0Ratio * width)),
    sy: Math.max(0, Math.round((cyRatio - VALUE_LAYOUT.halfHeight) * height)),
    sw: Math.round((x1Ratio - x0Ratio) * width),
    sh: Math.round(VALUE_LAYOUT.halfHeight * 2 * height),
  };
}

function buildFieldCanvas(image, field, threshold = 185) {
  const rect = cropRectForField(field, image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 150;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 16, 10, canvas.width - 32, canvas.height - 20);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * .299) + (data[i + 1] * .587) + (data[i + 2] * .114);
    const binary = gray < threshold ? 0 : 255;
    data[i] = binary; data[i + 1] = binary; data[i + 2] = binary; data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function normalizeValueForField(raw, field) {
  if (!raw) return null;
  let cleaned = String(raw)
    .replace(/[OoＯｏ]/g, '0')
    .replace(/[Il１]/g, '1')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const dots = cleaned.match(/\./g)?.length || 0;
  if (dots > 1) {
    const first = cleaned.indexOf('.');
    cleaned = cleaned.slice(0, first + 1) + cleaned.slice(first + 1).replace(/\./g, '');
  }
  let value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  if (value > field.max && field.decimals > 0 && !cleaned.includes('.')) {
    const preferredScale = value / (10 ** field.decimals);
    if (preferredScale >= field.min && preferredScale <= field.max) value = preferredScale;
    else {
      for (let places = 1; places <= 3; places += 1) {
        const candidate = value / (10 ** places);
        if (candidate >= field.min && candidate <= field.max) { value = candidate; break; }
      }
    }
  }
  if (value < field.min || value > field.max) return null;
  return field.decimals === 0 ? String(Math.round(value)) : value.toFixed(field.decimals);
}

function parsePastedText(rawText) {
  const text = String(rawText || '').replace(/[，、]/g, ',').replace(/[．。]/g, '.');
  const values = {};
  const rules = [
    ['input-weight-val', /体重[^\d]{0,20}([\d.,]+)/, 0], ['input-bmi-val', /BMI[^\d]{0,20}([\d.,]+)/i, 1],
    ['input-fat-val', /体脂肪率[^\d]{0,20}([\d.,]+)/, 2], ['input-heart-val', /心拍数[^\d]{0,20}([\d.,]+)/, 3],
    ['input-muscle-val', /筋肉量[^\d]{0,20}([\d.,]+)/, 4], ['input-bmr-val', /基礎代謝(?:量)?[^\d]{0,20}([\d.,]+)/, 5],
    ['input-water-val', /水分量[^\d]{0,20}([\d.,]+)/, 6], ['input-fatmass-val', /体脂肪量[^\d]{0,20}([\d.,]+)/, 7],
    ['input-leanbody-val', /除脂肪体重[^\d]{0,20}([\d.,]+)/, 8], ['input-bone-val', /骨量[^\d]{0,20}([\d.,]+)/, 9],
    ['input-visceralfat-val', /内臓脂肪[^\d]{0,20}([\d.,]+)/, 10], ['input-proteinrate-val', /タンパク質[^\d]{0,20}([\d.,]+)/, 11],
    ['input-skeletalmuscle-val', /骨格筋量[^\d]{0,20}([\d.,]+)/, 12], ['input-subcutaneous-val', /皮下脂肪[^\d]{0,20}([\d.,]+)/, 13],
    ['input-bodyage-val', /体内年齢[^\d]{0,20}([\d.,]+)/, 14],
  ];
  for (const [id, regex, fieldIndex] of rules) {
    const raw = text.match(regex)?.[1];
    const normalized = normalizeValueForField(raw, SMART_SCALE_FIELDS[fieldIndex]);
    if (normalized !== null) values[id] = normalized;
  }
  if (/標準的|標準/.test(text)) values['input-bodytype-val'] = '標準的';
  return values;
}

async function recognizeOneField(worker, image, field) {
  for (const threshold of [195, 160]) {
    const result = await worker.recognize(buildFieldCanvas(image, field, threshold));
    const normalized = normalizeValueForField(String(result?.data?.text || '').trim(), field);
    if (normalized !== null) return normalized;
  }
  return null;
}

async function recognizeNumericFields(Tesseract, image) {
  if (!Tesseract?.createWorker) throw new Error('OCRワーカーを開始できませんでした。');
  const worker = await Tesseract.createWorker('eng', 1);
  const values = {};
  try {
    await worker.setParameters({ tessedit_char_whitelist: '0123456789.,', tessedit_pageseg_mode: '7', preserve_interword_spaces: '0' });
    for (let index = 0; index < SMART_SCALE_FIELDS.length; index += 1) {
      const field = SMART_SCALE_FIELDS[index];
      setLoading(true, 'OCRで体組成データを読み取っています...', `数値を個別認識中 ${index + 1}/${SMART_SCALE_FIELDS.length}`);
      const value = await recognizeOneField(worker, image, field);
      if (value !== null) values[field.id] = value;
    }
  } finally {
    await worker.terminate();
  }
  return values;
}

async function recognizeBodyType(Tesseract, image) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 520; canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sx = Math.round(.52 * image.naturalWidth);
    const sy = Math.round(.872 * image.naturalHeight);
    const sw = Math.round(.46 * image.naturalWidth);
    const sh = Math.round(.075 * image.naturalHeight);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const result = await Tesseract.recognize(canvas, 'jpn', { tessedit_pageseg_mode: '7' });
    const text = String(result?.data?.text || '').replace(/\s+/g, '');
    if (/標.{0,3}(準|准)/.test(text)) return '標準的';
    for (const type of ['筋肉型', '運動型', 'やせ型', '痩せ型', '肥満型', '隠れ肥満型']) if (text.includes(type)) return type;
  } catch (error) {
    console.warn('Body type OCR skipped:', error);
  }
  return '';
}

function normalizeBodyTypeBeforeSave() {
  const input = document.getElementById('input-bodytype-val');
  if (!input) return;
  let value = String(input.value || '').trim();
  if (/^標準$/.test(value)) value = '標準的';
  if (!value) {
    const visibleText = input.closest('.result-edit-field')?.textContent || '';
    if (/標準的|標準/.test(visibleText)) value = '標準的';
  }
  if (value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function runBodyOcr(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const button = event.currentTarget;
  const imageFile = getSelectedBodyImage();
  const pastedText = document.getElementById('weight-text-input')?.value?.trim() || '';
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
      const [Tesseract, image] = await Promise.all([loadTesseract(), loadImageFromFile(imageFile)]);
      values = { ...values, ...(await recognizeNumericFields(Tesseract, image)) };
      setLoading(true, 'OCRで体組成データを読み取っています...', 'ボディタイプを確認中');
      const bodyType = await recognizeBodyType(Tesseract, image);
      if (bodyType) values['input-bodytype-val'] = bodyType;
    }
    const applied = applyParsedValues(values);
    normalizeBodyTypeBeforeSave();
    showResultEditor();
    if (applied === 0) window.alert('OCRで数値を特定できませんでした。\n確認欄へ手動で数値を入力して保存してください。');
    else if (applied < 12) window.alert(`${applied}項目をOCRで読み取りました。\n読み取れなかった項目だけ手動で補ってください。`);
    else window.alert(`${applied}項目をOCRで読み取りました。\n数値を確認してから保存してください。`);
  } catch (error) {
    console.error('Body composition OCR failed:', error);
    showResultEditor();
    window.alert('OCR読み取りに失敗しました。\n確認欄へ手動で数値を入力して保存できます。');
  } finally {
    setLoading(false);
    button.disabled = false;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const analyzeButton = document.getElementById('btn-analyze-weight');
    ensureBodyCompositionStyles();
    if (analyzeButton) {
      ensureOcrHint(analyzeButton);
      analyzeButton.addEventListener('click', runBodyOcr, { capture: true });
    }
    const saveButton = document.getElementById('btn-save-weight');
    if (saveButton) saveButton.addEventListener('click', normalizeBodyTypeBeforeSave, { capture: true });
  });
}
