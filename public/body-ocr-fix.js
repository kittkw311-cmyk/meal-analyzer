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

function installBodyOcrReturnFix() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  let watchdogTimer = null;
  let finalStageTimer = null;

  const clearWatchdogs = () => {
    if (watchdogTimer) window.clearTimeout(watchdogTimer);
    if (finalStageTimer) window.clearTimeout(finalStageTimer);
    watchdogTimer = null;
    finalStageTimer = null;
  };

  const ensureStyle = () => {
    if (document.getElementById('body-ocr-return-fix-style')) return;
    const style = document.createElement('style');
    style.id = 'body-ocr-return-fix-style';
    style.textContent = `
      #loading-overlay.body-ocr-force-hidden{display:none!important;pointer-events:none!important}
      .body-ocr-result-notice{margin:10px 0 12px;padding:10px 12px;border:1px solid var(--design-border,#36576a);border-radius:10px;background:rgba(20,184,166,.08);color:inherit;font-size:12px;line-height:1.5}
    `;
    document.head.appendChild(style);
  };

  const closeOcrOverlay = () => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('body-ocr-force-hidden');
      overlay.style.setProperty('display', 'none', 'important');
      overlay.setAttribute('aria-hidden', 'true');
    }
    const editor = document.getElementById('weight-result-edit-container');
    if (editor) {
      editor.style.display = 'block';
      requestAnimationFrame(() => editor.scrollIntoView({ behavior:'smooth', block:'start' }));
    }
  };

  const showNotice = message => {
    const editor = document.getElementById('weight-result-edit-container');
    if (!editor) return;
    let notice = document.getElementById('body-ocr-result-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'body-ocr-result-notice';
      notice.className = 'body-ocr-result-notice';
      editor.prepend(notice);
    }
    notice.textContent = String(message || '').replace(/\n+/g, ' ');
  };

  const forceReturn = message => {
    clearWatchdogs();
    const analyzeButton = document.getElementById('btn-analyze-weight');
    if (analyzeButton) analyzeButton.disabled = false;
    closeOcrOverlay();
    showNotice(message || 'OCR処理の待機を終了しました。読み取れた項目を確認して、必要な箇所だけ手入力してください。');
  };

  const prepareForOcr = () => {
    clearWatchdogs();
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.remove('body-ocr-force-hidden');
      overlay.style.removeProperty('display');
      overlay.removeAttribute('aria-hidden');
    }
    document.getElementById('body-ocr-result-notice')?.remove();
    watchdogTimer = window.setTimeout(() => {
      forceReturn('OCRが長時間応答しなかったため処理待ちを終了しました。読み取れた項目を確認してください。');
    }, 30000);
  };

  const isBodyOcrResultMessage = message => {
    const text = String(message || '');
    return /(?:\d+\/15項目を読み取りました|体組成15項目を読み取りました|数値15項目を読み取りました|OCRで数値を特定できませんでした|OCR読み取りに失敗しました)/.test(text);
  };

  const install = () => {
    ensureStyle();
    const analyzeButton = document.getElementById('btn-analyze-weight');
    if (analyzeButton && analyzeButton.dataset.returnFixBound !== '1') {
      analyzeButton.dataset.returnFixBound = '1';
      analyzeButton.addEventListener('click', prepareForOcr, true);
      const buttonObserver = new MutationObserver(() => {
        if (!analyzeButton.disabled) {
          clearWatchdogs();
          closeOcrOverlay();
        }
      });
      buttonObserver.observe(analyzeButton, { attributes:true, attributeFilter:['disabled'] });
    }

    const subtext = document.querySelector('#loading-overlay .loading-subtext');
    if (subtext && subtext.dataset.bodyOcrFinalWatch !== '1') {
      subtext.dataset.bodyOcrFinalWatch = '1';
      const finalObserver = new MutationObserver(() => {
        const text = String(subtext.textContent || '');
        if (/15\/15/.test(text) && !finalStageTimer) {
          finalStageTimer = window.setTimeout(() => {
            forceReturn('最終項目のOCR応答待ちを打ち切りました。読み取れた項目を確認してください。');
          }, 4500);
        }
      });
      finalObserver.observe(subtext, { childList:true, subtree:true, characterData:true });
    }

    if (!window.__physilogBodyOcrAlertWrapped) {
      window.__physilogBodyOcrAlertWrapped = true;
      const nativeAlert = window.alert.bind(window);
      window.alert = message => {
        if (isBodyOcrResultMessage(message)) {
          clearWatchdogs();
          closeOcrOverlay();
          showNotice(message);
          return;
        }
        nativeAlert(message);
      };
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
}

installSmartScaleReconcileFix();
installBodyOcrReturnFix();
