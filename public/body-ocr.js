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

const FIELD_DEFINITIONS = [
  { id: 'input-weight-val', labels: [/^体重$/, /体重\s*[:：]?/i, /weight/i], decimals: 2 },
  { id: 'input-bmi-val', labels: [/\bBMI\b/i], decimals: 1 },
  { id: 'input-fat-val', labels: [/体脂肪率/, /体脂肪\s*率/, /body\s*fat\s*(rate|%)/i], decimals: 1 },
  { id: 'input-heart-val', labels: [/心拍数/, /心拍/, /heart\s*rate/i], decimals: 0 },
  { id: 'input-muscle-val', labels: [/筋肉量(?!.*骨格)/, /muscle\s*mass/i], decimals: 2 },
  { id: 'input-bmr-val', labels: [/基礎代謝(?:量)?/, /\bBMR\b/i], decimals: 0 },
  { id: 'input-water-val', labels: [/水分量/, /体水分(?:率)?/, /body\s*water/i], decimals: 1 },
  { id: 'input-fatmass-val', labels: [/体脂肪量/, /fat\s*mass/i], decimals: 2 },
  { id: 'input-leanbody-val', labels: [/除脂肪体重/, /除脂肪量/, /lean\s*body/i], decimals: 2 },
  { id: 'input-bone-val', labels: [/骨量/, /bone\s*mass/i], decimals: 2 },
  { id: 'input-visceralfat-val', labels: [/内臓脂肪(?:レベル)?/, /visceral\s*fat/i], decimals: 1 },
  { id: 'input-proteinrate-val', labels: [/タンパク質(?:率)?/, /たんぱく質(?:率)?/, /protein\s*(rate|%)/i], decimals: 1 },
  { id: 'input-skeletalmuscle-val', labels: [/骨格筋(?:量)?/, /skeletal\s*muscle/i], decimals: 2 },
  { id: 'input-subcutaneous-val', labels: [/皮下脂肪(?:率)?/, /subcutaneous\s*fat/i], decimals: 1 },
  { id: 'input-bodyage-val', labels: [/体内年齢/, /身体年齢/, /body\s*age/i], decimals: 0 },
];

const ALL_LABEL_PATTERNS = FIELD_DEFINITIONS.flatMap((field) => field.labels);

function normalizeOcrText(text) {
  return String(text || '')
    .replace(/[，、]/g, ',')
    .replace(/[．。]/g, '.')
    .replace(/[：]/g, ':')
    .replace(/\u3000/g, ' ')
    .replace(/[|｜]/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function normalizeNumberToken(token) {
  const normalized = String(token || '')
    .replace(/,/g, '.')
    .replace(/[OoＯｏ]/g, '0')
    .replace(/[Il１]/g, '1')
    .replace(/[^0-9.+-]/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function getLineNumber(line) {
  const tokens = String(line || '').match(/[+-]?(?:\d{1,4}(?:[.,]\d{1,3})?|[OoＯｏIl１](?:[.,]\d+)?)/g) || [];
  for (const token of tokens) {
    const value = normalizeNumberToken(token);
    if (value !== null) return value;
  }
  return null;
}

function lineContainsAnyLabel(line) {
  return ALL_LABEL_PATTERNS.some((pattern) => pattern.test(line));
}

function findValueForField(lines, definition) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!definition.labels.some((pattern) => pattern.test(line))) continue;

    const sameLineValue = getLineNumber(line);
    if (sameLineValue !== null) return sameLineValue;

    for (let offset = 1; offset <= 2; offset += 1) {
      const nextLine = lines[index + offset];
      if (!nextLine) break;
      if (lineContainsAnyLabel(nextLine)) break;
      const nextValue = getLineNumber(nextLine);
      if (nextValue !== null) return nextValue;
    }
  }
  return null;
}

function parseBodyType(lines) {
  const bodyTypeLabels = [/ボディタイプ/, /体型/, /body\s*type/i];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const matched = bodyTypeLabels.find((pattern) => pattern.test(line));
    if (!matched) continue;
    const sameLine = line.replace(matched, '').replace(/^\s*[:：-]?\s*/, '').trim();
    if (sameLine && !/^[-.\d\s]+$/.test(sameLine)) return sameLine.slice(0, 30);
    const next = lines[index + 1]?.trim();
    if (next && !lineContainsAnyLabel(next)) return next.slice(0, 30);
  }
  return '';
}

function parseBodyCompositionText(rawText) {
  const text = normalizeOcrText(rawText);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const values = {};

  FIELD_DEFINITIONS.forEach((definition) => {
    const value = findValueForField(lines, definition);
    if (value === null) return;
    values[definition.id] = definition.decimals === 0
      ? String(Math.round(value))
      : value.toFixed(definition.decimals).replace(/0+$/, '').replace(/\.$/, '');
  });

  const bodyType = parseBodyType(lines);
  if (bodyType) values['input-bodytype-val'] = bodyType;

  return { text, values };
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
  [...FIELD_DEFINITIONS.map((field) => field.id), 'input-bodytype-val'].forEach((id) => {
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
  hint.textContent = 'AIは使用しません。写真内の文字・数値をOCRで読み取り、確認画面に反映します。';
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
    let sourceText = pastedText;
    if (imageFile) {
      setLoading(true, 'OCRで体組成データを読み取っています...', '写真内の文字と数値を認識中');
      const Tesseract = await loadTesseract();
      if (!Tesseract?.recognize) throw new Error('OCRを開始できませんでした。');

      const result = await Tesseract.recognize(imageFile, 'jpn+eng', {
        logger(message) {
          if (message.status !== 'recognizing text') return;
          const percent = Math.max(0, Math.min(100, Math.round((message.progress || 0) * 100)));
          setLoading(true, 'OCRで体組成データを読み取っています...', `文字認識中 ${percent}%`);
        },
      });
      sourceText = `${result?.data?.text || ''}\n${pastedText}`.trim();
    }

    const parsed = parseBodyCompositionText(sourceText);
    const applied = applyParsedValues(parsed.values);
    showResultEditor();

    if (applied === 0) {
      window.alert('OCRで数値を特定できませんでした。\n写真はそのまま使えるので、確認欄へ手動で数値を入力して保存してください。');
    } else {
      window.alert(`${applied}項目をOCRで読み取りました。\n数値を確認・修正してから保存してください。`);
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
