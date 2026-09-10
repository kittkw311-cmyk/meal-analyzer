function toNumber(id) {
  const value = Number(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : null;
}

function setValue(id, value, decimals) {
  const input = document.getElementById(id);
  if (!input || !Number.isFinite(value)) return;
  input.value = value.toFixed(decimals);
  input.dispatchEvent(new Event('input', { bubbles:true }));
  input.dispatchEvent(new Event('change', { bubbles:true }));
}

function reconcileSmartScaleDisplay() {
  if (typeof document === 'undefined') return;

  const muscle = toNumber('input-muscle-val');
  const bone = toNumber('input-bone-val');
  const fatMass = toNumber('input-fatmass-val');
  const currentLean = toNumber('input-leanbody-val');
  const currentWeight = toNumber('input-weight-val');

  if (muscle !== null && bone !== null) {
    const derivedLean = muscle + bone;
    if (derivedLean >= 20 && derivedLean <= 200 &&
        (currentLean === null || Math.abs(currentLean - derivedLean) <= 0.6)) {
      setValue('input-leanbody-val', derivedLean, 2);

      if (fatMass !== null) {
        const derivedWeight = derivedLean + fatMass;
        if (derivedWeight >= 30 && derivedWeight <= 250 &&
            (currentWeight === null || Math.abs(currentWeight - derivedWeight) <= 0.6)) {
          setValue('input-weight-val', derivedWeight, 2);
        }
      }
    }
  }
}

function getBodyImageFile() {
  return document.getElementById('weight-camera-input')?.files?.[0]
    || document.getElementById('weight-gallery-input')?.files?.[0]
    || null;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('水分量OCR用画像を読み込めませんでした。')); };
    image.src = url;
  });
}

function buildWaterCanvas(image, mode = 'gray') {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 260;
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Smart Scaleの左4段目（水分量）。通常OCRより上下左右を広めに取り、
  // 51.3 の小数点や末尾桁が欠けにくいようにする。
  const sx = Math.round(image.naturalWidth * 0.055);
  const sy = Math.round(image.naturalHeight * 0.394);
  const sw = Math.round(image.naturalWidth * 0.405);
  const sh = Math.round(image.naturalHeight * 0.061);
  ctx.drawImage(image, sx, sy, sw, sh, 18, 14, canvas.width - 36, canvas.height - 28);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114;
    let value = gray;
    if (mode === 'contrast') value = Math.max(0, Math.min(255, (gray - 132) * 1.9 + 132));
    if (mode === 'threshold180') value = gray < 180 ? 0 : 255;
    if (mode === 'threshold205') value = gray < 205 ? 0 : 255;
    if (mode === 'threshold225') value = gray < 225 ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function normalizeWaterCandidate(raw) {
  const token = String(raw || '')
    .replace(/[OoＯｏ]/g, '0')
    .replace(/[Il１|]/g, '1')
    .replace(/[，,]/g, '.')
    .match(/\d+(?:\.\d+)?/)?.[0];
  if (!token) return null;
  let value = Number(token);
  if (!Number.isFinite(value)) return null;
  if (!token.includes('.') && value >= 200 && value <= 800) value /= 10;
  if (value < 20 || value > 80) return null;
  return value.toFixed(1);
}

async function recoverWaterValue() {
  if (toNumber('input-water-val') !== null) return;
  const file = getBodyImageFile();
  if (!file || !globalThis.Tesseract?.createWorker) return;

  const image = await loadImage(file);
  const worker = await globalThis.Tesseract.createWorker('eng', 1);
  const candidates = [];
  try {
    await worker.setParameters({
      tessedit_char_whitelist:'0123456789.,',
      tessedit_pageseg_mode:'7',
      preserve_interword_spaces:'0',
      user_defined_dpi:'300',
    });
    for (const mode of ['gray', 'contrast', 'threshold180', 'threshold205', 'threshold225']) {
      const result = await worker.recognize(buildWaterCanvas(image, mode));
      const normalized = normalizeWaterCandidate(result?.data?.text || '');
      if (normalized !== null) candidates.push({ value:normalized, confidence:Number(result?.data?.confidence || 0) });
    }
  } finally {
    await worker.terminate();
  }

  if (!candidates.length) return;
  const previousWater = Number((await fetch('/api/body-composition', { cache:'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []))?.[0]?.waterRate);
  const grouped = new Map();
  for (const candidate of candidates) {
    const entry = grouped.get(candidate.value) || { value:candidate.value, votes:0, confidence:0 };
    entry.votes += 1;
    entry.confidence += candidate.confidence;
    grouped.set(candidate.value, entry);
  }
  const best = [...grouped.values()].map(entry => {
    let score = entry.votes * 40 + entry.confidence / entry.votes;
    if (Number.isFinite(previousWater)) score -= Math.abs(Number(entry.value) - previousWater) * 2;
    return { ...entry, score };
  }).sort((a, b) => b.score - a.score)[0];

  if (best) setValue('input-water-val', Number(best.value), 1);
}

function recoverWaterAfterMainOcr() {
  const analyzeButton = document.getElementById('btn-analyze-weight');
  if (!analyzeButton) return;
  let attempts = 0;
  const wait = () => {
    attempts += 1;
    if (!analyzeButton.disabled) {
      if (toNumber('input-water-val') === null) recoverWaterValue().catch(error => console.warn('Water OCR recovery failed:', error));
      return;
    }
    if (attempts < 240) window.setTimeout(wait, 250);
  };
  window.setTimeout(wait, 250);
}

function installSmartScaleReconcileFix() {
  if (typeof document === 'undefined') return;

  let queued = false;
  const queueReconcile = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      reconcileSmartScaleDisplay();
    });
  };

  document.addEventListener('input', event => {
    if (event.target?.closest?.('#weight-result-edit-container')) queueReconcile();
  });

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#btn-save-weight')) reconcileSmartScaleDisplay();
    if (event.target?.closest?.('#btn-analyze-weight')) recoverWaterAfterMainOcr();
  }, true);
}

installSmartScaleReconcileFix();
