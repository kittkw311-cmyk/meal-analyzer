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

// Smart Scale の2列×8段レイアウト専用。
// 日本語ラベルではなく、各カードの「大きな数値」がある位置だけを切り出してOCRする。
// アップロード画像の縦横サイズが変わっても比率で追従する。
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

// 実際のSmart Scaleスクリーンショットを基準にした位置。
// 大きな数値の中心は縦方向にほぼ 1/16, 3/16 ... 15/16 と並ぶ。
const VALUE_LAYOUT = {
  leftX0: 0.070,
  leftX1: 0.470,
  rightX0: 0.555,
  rightX1: 0.955,
  firstY: 0.0625,
  rowStep: 0.125,
  halfHeight: 0.025,
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
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    applied += 1;
  });
  return applied;
}

function ensureOcrHint(button) {
  if (!button) return;
  button.textContent = 'OCRで数値を読み取る';
  if (document.getElementById('body-ocr-hint')) return;
  const hint = document.createElement('div');
  hint.id = 'body-ocr-hint';
  hint.style.cssText = 'margin-top:8px;font-size:11px;line-height:1.5;color:var(--design-muted);text-align:center;';
  hint.textContent = 'Smart Scaleの固定レイアウト専用。数値部分だけを切り出してOCRします。AIは使用しません。';
  button.insertAdjacentElement('afterend', hint);
}

function loadImageFromFile(file) {
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

function cropRectForField(field, width, height) {
  const x0Ratio = field.col === 0 ? VALUE_LAYOUT.leftX0 : VALUE_LAYOUT.rightX0;
  const x1Ratio = field.col === 0 ? VALUE_LAYOUT.leftX1 : VALUE_LAYOUT.rightX1;
  const cyRatio = VALUE_LAYOUT.firstY + VALUE_LAYOUT.rowStep * field.row;
  return {
    sx: Math.round(x0Ratio * width),
    sy: Math.round((cyRatio - VALUE_LAYOUT.halfHeight) * height),
    sw: Math.round((x1Ratio - x0Ratio) * width),
    sh: Math.round(VALUE_LAYOUT.halfHeight * 2 * height),
  };
}

function buildNumericComposite(image) {
  const rowHeight = 92;
  const markerWidth = 68;
  const valueWidth = 360;
  const canvas = document.createElement('canvas');
  canvas.width = markerWidth + valueWidth;
  canvas.height = rowHeight * SMART_SCALE_FIELDS.length;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  SMART_SCALE_FIELDS.forEach((field, index) => {
    const rect = cropRectForField(field, image.naturalWidth, image.naturalHeight);
    const temp = document.createElement('canvas');
    temp.width = valueWidth;
    temp.height = rowHeight;
    const tctx = temp.getContext('2d', { willReadFrequently: true });
    tctx.fillStyle = '#fff';
    tctx.fillRect(0, 0, temp.width, temp.height);
    tctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, temp.width, temp.height);

    // 白背景＋濃い文字に寄せて、カードの色や小さなステータス文字を落とす。
    const pixels = tctx.getImageData(0, 0, temp.width, temp.height);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
      const value = gray < 150 ? 0 : 255;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    tctx.putImageData(pixels, 0, 0);

    const y = index * rowHeight;
    // 行番号を人工的に描くことで、OCRが途中の行を落としても項目対応が崩れない。
    ctx.fillStyle = '#000';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1).padStart(2, '0'), 8, y + rowHeight / 2);
    ctx.drawImage(temp, markerWidth, y);
  });

  return canvas;
}

function normalizeNumericText(text) {
  return String(text || '')
    .replace(/[OoＯｏ]/g, '0')
    .replace(/[Il１]/g, '1')
    .replace(/,/g, '.')
    .replace(/[^0-9.\n ]/g, ' ')
    .replace(/[ ]+/g, ' ');
}

function normalizeValueForField(raw, field) {
  if (!raw) return null;
  let cleaned = String(raw).replace(/\s+/g, '').replace(/,/g, '.');
  const dots = cleaned.match(/\./g)?.length || 0;
  if (dots > 1) {
    const first = cleaned.indexOf('.');
    cleaned = cleaned.slice(0, first + 1) + cleaned.slice(first + 1).replace(/\./g, '');
  }
  let value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  // 小数点がOCRで落ちた場合は、項目の想定桁数に合わせて復元する。
  if (value > field.max && field.decimals > 0 && !cleaned.includes('.')) {
    const scaled = value / (10 ** field.decimals);
    if (scaled >= field.min && scaled <= field.max) value = scaled;
  }
  if (value < field.min || value > field.max) return null;
  return field.decimals === 0 ? String(Math.round(value)) : value.toFixed(field.decimals);
}

function parseCompositeText(rawText) {
  const text = normalizeNumericText(rawText);
  const values = {};
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const digits = line.replace(/\s+/g, '');
    // 例: "0171.70" → 行01 / 値71.70
    const indexMatch = digits.match(/^(0[1-9]|1[0-5])(.*)$/);
    if (!indexMatch) continue;
    const fieldIndex = Number(indexMatch[1]) - 1;
    const field = SMART_SCALE_FIELDS[fieldIndex];
    if (!field) continue;
    const valueText = indexMatch[2].match(/[0-9]+(?:\.[0-9]+)?/)?.[0] || '';
    const normalized = normalizeValueForField(valueText, field);
    if (normalized !== null) values[field.id] = normalized;
  }

  return values;
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
  if (/標準的|標準/.test(text)) values['input-bodytype-val'] = '標準的';
  return values;
}

async function recognizeBodyType(Tesseract, image) {
  // 右下カードだけを切り出して日本語OCR。失敗しても数値OCRには影響させない。
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sx = Math.round(0.54 * image.naturalWidth);
    const sy = Math.round(0.895 * image.naturalHeight);
    const sw = Math.round(0.43 * image.naturalWidth);
    const sh = Math.round(0.075 * image.naturalHeight);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const result = await Tesseract.recognize(canvas, 'jpn', { tessedit_pageseg_mode: '7' });
    const text = String(result?.data?.text || '').replace(/\s+/g, '');
    if (/標.{0,2}(準|准)/.test(text)) return '標準的';
    for (const type of ['筋肉型', '運動型', 'やせ型', '痩せ型', '肥満型', '隠れ肥満型']) {
      if (text.includes(type)) return type;
    }
  } catch (error) {
    console.warn('Body type OCR skipped:', error);
  }
  return '';
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
      setLoading(true, 'OCRで体組成データを読み取っています...', 'Smart Scaleの数値部分を切り出し中');
      const [Tesseract, image] = await Promise.all([loadTesseract(), loadImageFromFile(imageFile)]);
      if (!Tesseract?.recognize) throw new Error('OCRを開始できませんでした。');

      const composite = buildNumericComposite(image);
      const result = await Tesseract.recognize(composite, 'eng', {
        tessedit_char_whitelist: '0123456789.,',
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        logger(message) {
          if (message.status !== 'recognizing text') return;
          const percent = Math.max(0, Math.min(100, Math.round((message.progress || 0) * 100)));
          setLoading(true, 'OCRで体組成データを読み取っています...', `数値認識中 ${percent}%`);
        },
      });

      values = { ...values, ...parseCompositeText(result?.data?.text || '') };
      const bodyType = await recognizeBodyType(Tesseract, image);
      if (bodyType) values['input-bodytype-val'] = bodyType;
    }

    const applied = applyParsedValues(values);
    showResultEditor();

    if (applied === 0) {
      window.alert('OCRで数値を特定できませんでした。\n確認欄へ手動で数値を入力して保存してください。');
    } else if (applied < 12) {
      window.alert(`${applied}項目をOCRで読み取りました。\n読み取れなかった項目だけ手動で補ってください。`);
    } else {
      window.alert(`${applied}項目をOCRで読み取りました。\n数値を確認してから保存してください。`);
    }
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
    const button = document.getElementById('btn-analyze-weight');
    if (!button) return;
    ensureOcrHint(button);
    button.addEventListener('click', runBodyOcr, { capture: true });
  });
}
