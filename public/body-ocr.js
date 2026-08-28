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

// Smart Scale の体組成結果画面専用レイアウト。
// ユーザーが毎回同じ2列 x 8段の結果画面をアップロードする前提で、
// 日本語ラベルの認識には依存せず、数値が表示される固定位置から値を取得する。
// 座標は画像サイズに対する比率なので、端末の解像度が変わっても追従する。
const SMART_SCALE_FIELDS = [
  { id: 'input-weight-val',          row: 0, col: 0, decimals: 2, min: 30,  max: 250 },
  { id: 'input-bmi-val',             row: 0, col: 1, decimals: 1, min: 10,  max: 60 },
  { id: 'input-fat-val',             row: 1, col: 0, decimals: 1, min: 3,   max: 70 },
  { id: 'input-heart-val',           row: 1, col: 1, decimals: 0, min: 30,  max: 220 },
  { id: 'input-muscle-val',          row: 2, col: 0, decimals: 2, min: 10,  max: 150 },
  { id: 'input-bmr-val',             row: 2, col: 1, decimals: 0, min: 500, max: 4000 },
  { id: 'input-water-val',           row: 3, col: 0, decimals: 1, min: 20,  max: 80 },
  { id: 'input-fatmass-val',         row: 3, col: 1, decimals: 2, min: 1,   max: 100 },
  { id: 'input-leanbody-val',        row: 4, col: 0, decimals: 2, min: 20,  max: 200 },
  { id: 'input-bone-val',            row: 4, col: 1, decimals: 2, min: 1,   max: 10 },
  { id: 'input-visceralfat-val',     row: 5, col: 0, decimals: 1, min: 1,   max: 30 },
  { id: 'input-proteinrate-val',     row: 5, col: 1, decimals: 1, min: 5,   max: 40 },
  { id: 'input-skeletalmuscle-val',  row: 6, col: 0, decimals: 2, min: 10,  max: 100 },
  { id: 'input-subcutaneous-val',    row: 6, col: 1, decimals: 1, min: 3,   max: 70 },
  { id: 'input-bodyage-val',         row: 7, col: 0, decimals: 0, min: 10,  max: 100 },
];

// スクリーンショット例では、各カードの数値はこの相対位置に並ぶ。
// rowStep は約 12.2% で、最終段まで同じ間隔。
const VALUE_LAYOUT = {
  leftXMin: 0.055,
  leftXMax: 0.465,
  rightXMin: 0.535,
  rightXMax: 0.965,
  firstY: 0.066,
  rowStep: 0.1217,
  yHalfHeight: 0.033,
};

function normalizeNumberToken(token) {
  const normalized = String(token || '')
    .replace(/,/g, '.')
    .replace(/[OoＯｏ]/g, '0')
    .replace(/[Il１]/g, '1')
    .replace(/[ＳS]/g, '5')
    .replace(/[ＢB]/g, '8')
    .replace(/[^0-9.+-]/g, '');
  if (!normalized || normalized === '.' || normalized === '-' || normalized === '+') return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatFieldValue(value, decimals) {
  if (!Number.isFinite(value)) return '';
  if (decimals === 0) return String(Math.round(value));
  return Number(value).toFixed(decimals);
}

function getWordBox(word) {
  const bbox = word?.bbox || {};
  const x0 = Number(bbox.x0);
  const x1 = Number(bbox.x1);
  const y0 = Number(bbox.y0);
  const y1 = Number(bbox.y1);
  if (![x0, x1, y0, y1].every(Number.isFinite)) return null;
  return {
    x0,
    x1,
    y0,
    y1,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
  };
}

function getFieldRegion(field, width, height) {
  const xMin = field.col === 0 ? VALUE_LAYOUT.leftXMin : VALUE_LAYOUT.rightXMin;
  const xMax = field.col === 0 ? VALUE_LAYOUT.leftXMax : VALUE_LAYOUT.rightXMax;
  const yCenter = VALUE_LAYOUT.firstY + (VALUE_LAYOUT.rowStep * field.row);
  return {
    x0: xMin * width,
    x1: xMax * width,
    y0: (yCenter - VALUE_LAYOUT.yHalfHeight) * height,
    y1: (yCenter + VALUE_LAYOUT.yHalfHeight) * height,
    cx: ((xMin + xMax) / 2) * width,
    cy: yCenter * height,
  };
}

function isInsideRegion(box, region) {
  return box.cx >= region.x0 && box.cx <= region.x1 && box.cy >= region.y0 && box.cy <= region.y1;
}

function getNumberCandidates(words, region, field) {
  const candidates = [];

  for (const word of words || []) {
    const box = getWordBox(word);
    if (!box || !isInsideRegion(box, region)) continue;

    // 1 word に「71.70kg」のように単位まで含まれていても数値だけ抜く。
    const rawMatches = String(word.text || '').match(/[+\-]?(?:\d|[OoＯｏIl１ＳSＢB])+(?:[.,](?:\d|[OoＯｏIl１ＳSＢB])+)?/g) || [];
    for (const raw of rawMatches) {
      const value = normalizeNumberToken(raw);
      if (value === null || value < field.min || value > field.max) continue;
      const distance = Math.hypot((box.cx - region.cx) / Math.max(1, region.x1 - region.x0), (box.cy - region.cy) / Math.max(1, region.y1 - region.y0));
      const confidence = Number.isFinite(Number(word.confidence)) ? Number(word.confidence) : 0;
      candidates.push({ value, distance, confidence, raw });
    }
  }

  candidates.sort((a, b) => {
    // 位置を最優先し、同程度ならOCR confidenceが高い候補を採用。
    const aScore = a.distance - (Math.max(0, a.confidence) / 1000);
    const bScore = b.distance - (Math.max(0, b.confidence) / 1000);
    return aScore - bScore;
  });
  return candidates;
}

function parseFixedLayoutWords(data) {
  const width = Number(data?.imageSize?.width) || Number(data?.width) || 0;
  const height = Number(data?.imageSize?.height) || Number(data?.height) || 0;
  const words = Array.isArray(data?.words) ? data.words : [];
  if (!width || !height || words.length === 0) return {};

  const values = {};
  for (const field of SMART_SCALE_FIELDS) {
    const region = getFieldRegion(field, width, height);
    const candidate = getNumberCandidates(words, region, field)[0];
    if (!candidate) continue;
    values[field.id] = formatFieldValue(candidate.value, field.decimals);
  }
  return values;
}

// Tesseractのバージョン差で imageSize が無いケース用。
function inferImageSizeFromWords(words) {
  let maxX = 0;
  let maxY = 0;
  for (const word of words || []) {
    const box = getWordBox(word);
    if (!box) continue;
    maxX = Math.max(maxX, box.x1);
    maxY = Math.max(maxY, box.y1);
  }
  return { width: maxX, height: maxY };
}

function parseBodyTypeFromFixedRegion(data) {
  const words = Array.isArray(data?.words) ? data.words : [];
  const fallbackSize = inferImageSizeFromWords(words);
  const width = Number(data?.imageSize?.width) || Number(data?.width) || fallbackSize.width;
  const height = Number(data?.imageSize?.height) || Number(data?.height) || fallbackSize.height;
  if (!width || !height) return '';

  // 最終段・右カードの値部分だけを見る。
  const region = {
    x0: 0.535 * width,
    x1: 0.965 * width,
    y0: 0.885 * height,
    y1: 0.955 * height,
  };
  const regionWords = words
    .map((word) => ({ word, box: getWordBox(word) }))
    .filter(({ box }) => box && isInsideRegion(box, region))
    .sort((a, b) => (a.box.y0 - b.box.y0) || (a.box.x0 - b.box.x0))
    .map(({ word }) => String(word.text || '').trim())
    .filter(Boolean);

  const joined = regionWords.join('').replace(/\s+/g, '');
  const knownTypes = ['標準的', '標準', '筋肉型', '運動型', 'やせ型', '痩せ型', '肥満型', '隠れ肥満型'];
  const exact = knownTypes.find((type) => joined.includes(type));
  if (exact) return exact;

  // OCRの文字が多少崩れていても、今回の画面で頻出する標準判定は拾う。
  if (/標.{0,2}(準|准)/.test(joined)) return '標準的';
  return '';
}

function parseFallbackText(rawText) {
  // 固定座標取得ができなかった場合のみ使う保険。
  const normalized = String(rawText || '')
    .replace(/[，、]/g, ',')
    .replace(/[．。]/g, '.')
    .replace(/[：]/g, ':')
    .replace(/\r/g, '');
  const values = {};
  const rules = [
    ['input-weight-val', /体重[^\d]{0,20}([\d.,]+)/, 2],
    ['input-bmi-val', /BMI[^\d]{0,20}([\d.,]+)/i, 1],
    ['input-fat-val', /体脂肪率[^\d]{0,20}([\d.,]+)/, 1],
    ['input-heart-val', /心拍数[^\d]{0,20}([\d.,]+)/, 0],
    ['input-muscle-val', /筋肉量[^\d]{0,20}([\d.,]+)/, 2],
    ['input-bmr-val', /基礎代謝(?:量)?[^\d]{0,20}([\d.,]+)/, 0],
    ['input-water-val', /水分量[^\d]{0,20}([\d.,]+)/, 1],
    ['input-fatmass-val', /体脂肪量[^\d]{0,20}([\d.,]+)/, 2],
    ['input-leanbody-val', /除脂肪体重[^\d]{0,20}([\d.,]+)/, 2],
    ['input-bone-val', /骨量[^\d]{0,20}([\d.,]+)/, 2],
    ['input-visceralfat-val', /内臓脂肪[^\d]{0,20}([\d.,]+)/, 1],
    ['input-proteinrate-val', /タンパク質[^\d]{0,20}([\d.,]+)/, 1],
    ['input-skeletalmuscle-val', /骨格筋量[^\d]{0,20}([\d.,]+)/, 2],
    ['input-subcutaneous-val', /皮下脂肪[^\d]{0,20}([\d.,]+)/, 1],
    ['input-bodyage-val', /体内年齢[^\d]{0,20}([\d.,]+)/, 0],
  ];

  for (const [id, pattern, decimals] of rules) {
    const match = normalized.match(pattern);
    const value = normalizeNumberToken(match?.[1]);
    if (value === null) continue;
    values[id] = formatFieldValue(value, decimals);
  }
  return values;
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

function clearBodyCompositionFields() {
  [...SMART_SCALE_FIELDS.map((field) => field.id), 'input-bodytype-val'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
}

function getSelectedBodyImage() {
  return document.getElementById('weight-camera-input')?.files?.[0]
    || document.getElementById('weight-gallery-input')?.files?.[0]
    || null;
}

function setLoading(visible, title = '', detail = '') {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  if (title) {
    const titleEl = overlay.querySelector('p');
    if (titleEl) titleEl.textContent = title;
  }
  if (detail) {
    const detailEl = overlay.querySelector('.loading-subtext');
    if (detailEl) detailEl.textContent = detail;
  }
  overlay.style.display = visible ? 'flex' : 'none';
}

function showResultEditor() {
  const editor = document.getElementById('weight-result-edit-container');
  if (editor) {
    editor.style.display = 'block';
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function ensureOcrHint(button) {
  if (!button || document.getElementById('body-ocr-hint')) return;
  button.textContent = 'OCRで数値を読み取る';
  const hint = document.createElement('div');
  hint.id = 'body-ocr-hint';
  hint.style.cssText = 'margin-top:8px;font-size:11px;line-height:1.5;color:var(--design-muted);text-align:center;';
  hint.textContent = 'Smart Scaleの体組成結果画面専用。16項目の固定位置からOCRで読み取ります。AIは使用しません。';
  button.insertAdjacentElement('afterend', hint);
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
    let values = {};
    if (imageFile) {
      setLoading(true, 'OCRで体組成データを読み取っています...', '固定位置から16項目を認識中');
      const Tesseract = await loadTesseract();
      if (!Tesseract?.recognize) throw new Error('OCRを開始できませんでした。');

      const result = await Tesseract.recognize(imageFile, 'jpn+eng', {
        logger(message) {
          if (message.status !== 'recognizing text') return;
          const percent = Math.max(0, Math.min(100, Math.round((message.progress || 0) * 100)));
          setLoading(true, 'OCRで体組成データを読み取っています...', `固定位置を文字認識中 ${percent}%`);
        },
      });

      const data = result?.data || {};
      // imageSize が返らない環境では word bbox の最大値を画像サイズとして補う。
      if (!data.imageSize) data.imageSize = inferImageSizeFromWords(data.words || []);
      values = parseFixedLayoutWords(data);

      const bodyType = parseBodyTypeFromFixedRegion(data);
      if (bodyType) values['input-bodytype-val'] = bodyType;

      // 固定位置で拾えなかった項目だけ、全文ラベル解析で補完。
      const fallbackValues = parseFallbackText(`${data.text || ''}\n${pastedText}`);
      values = { ...fallbackValues, ...values };
    } else {
      values = parseFallbackText(pastedText);
    }

    const applied = applyParsedValues(values);
    showResultEditor();

    if (applied === 0) {
      window.alert('OCRで数値を特定できませんでした。\n確認欄へ手動で数値を入力して保存してください。');
    } else if (applied < 12) {
      window.alert(`${applied}項目をOCRで読み取りました。\n読み取れなかった項目だけ手動で補ってから保存してください。`);
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
