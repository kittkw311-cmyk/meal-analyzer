function toNumber(id) {
  const value = Number(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : null;
}

function setValue(id, value, decimals) {
  const input = document.getElementById(id);
  if (!input || !Number.isFinite(value)) return;
  input.value = value.toFixed(decimals);
}

function reconcileSmartScaleDisplay() {
  if (typeof document === 'undefined') return;

  const muscle = toNumber('input-muscle-val');
  const bone = toNumber('input-bone-val');
  const fatMass = toNumber('input-fatmass-val');
  const currentLean = toNumber('input-leanbody-val');
  const currentWeight = toNumber('input-weight-val');

  // Smart Scaleの表示では「筋肉量 + 骨量 = 除脂肪体重」、
  // 「除脂肪体重 + 体脂肪量 = 体重」が成立する。
  // 体重そのものをOCRできている場合は小さな差で上書きせず、
  // 除脂肪体重側の小数欠落が疑わしい時だけ整合値を採用する。
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

  // 保存処理より先に最終整合チェックする。
  document.addEventListener('click', event => {
    if (event.target?.closest?.('#btn-save-weight')) reconcileSmartScaleDisplay();
  }, true);
}

installSmartScaleReconcileFix();
