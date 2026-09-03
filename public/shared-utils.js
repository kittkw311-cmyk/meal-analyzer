import './body-ocr.js';
import './menu-ocr.js';

const DISPLAY_APP_VERSION = 'v1.0.16';
function enforceDisplayAppVersion() {
  const apply = () => {
    const version = document.querySelector('.app-version');
    if (version && version.textContent !== DISPLAY_APP_VERSION) version.textContent = DISPLAY_APP_VERSION;
  };
  if (typeof document === 'undefined') return;
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
}
enforceDisplayAppVersion();

// 記録タブ上部のボタンは見せないが、フロートボタンから呼ばれる
// btn-open-meal-entry / btn-open-weight-entry 自体は DOM に残す。
function hideHistoryQuickActions() {
  if (typeof document === 'undefined') return;
  const hide = () => {
    const actions = document.querySelector('.history-quick-actions');
    if (!actions) return;
    actions.hidden = true;
    actions.style.display = 'none';
    actions.setAttribute('aria-hidden', 'true');
  };
  hide();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hide, { once: true });
}
hideHistoryQuickActions();

// AI相談タブは画面から隠すが、app.js の初期化で参照する要素は DOM に残す。
// 要素を削除すると後続の初期化が途中で止まり、総合タブの目標値・プログレス更新まで到達しない。
function hideAiConsultationTab() {
  if (typeof document === 'undefined') return;
  const hide = () => {
    document.querySelector('.nav-item[data-tab="tab-analyze"]')?.remove();
    const tab = document.getElementById('tab-analyze');
    if (tab) {
      tab.hidden = true;
      tab.style.display = 'none';
      tab.setAttribute('aria-hidden', 'true');
    }
    const modal = document.getElementById('ai-consultation-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  };
  hide();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hide, { once: true });
}
hideAiConsultationTab();

// 「公式情報を検索して登録」は重く精度も安定しないため廃止。
function removeOfficialMealSearchRegistration() {
  if (typeof document === 'undefined') return;
  const remove = () => document.getElementById('btn-analyze-official')?.remove();
  remove();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', remove, { once: true });
}
removeOfficialMealSearchRegistration();

// 写真付きメニュー登録は、料理全体を推定する前に栄養成分表示の読み取りを最優先する。
function installNutritionLabelFirstMealRegistration() {
  if (typeof document === 'undefined') return;

  const install = () => {
    const button = document.getElementById('btn-analyze');
    if (!button || button.dataset.nutritionLabelFirst === '1') return;
    button.dataset.nutritionLabelFirst = '1';

    button.addEventListener('click', async event => {
      const cameraInput = document.getElementById('meal-camera-input');
      const galleryInput = document.getElementById('meal-gallery-input');
      const imageFile = cameraInput?.files?.[0] || galleryInput?.files?.[0] || null;
      if (!imageFile) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = '栄養表示を読み取り中…';

      try {
        const extractForm = new FormData();
        extractForm.append('file', imageFile, imageFile.name || 'meal.jpg');
        const extractResponse = await fetch('/api/presets/extract-nutrition', { method: 'POST', body: extractForm, cache: 'no-store' });
        const extracted = await extractResponse.json().catch(() => ({}));
        if (!extractResponse.ok) throw new Error(extracted.error || '栄養表示の読み取りに失敗しました。');

        const values = [extracted.calories, extracted.protein, extracted.fat, extracted.carbohydrates].map(Number);
        if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('栄養表示からkcal/P/F/Cを正しく取得できませんでした。');

        button.textContent = '読み取った数値を登録中…';
        const selectedType = document.querySelector('#meal-type-chips .chip.active')?.dataset?.type || 'snack';
        const dateValue = document.getElementById('meal-date-input')?.value || '';
        const textInput = document.getElementById('meal-text-input')?.value?.trim() || '';
        const saveForm = new FormData();
        saveForm.append('name', String(extracted.name || textInput || '食事').slice(0, 40));
        saveForm.append('calories', String(values[0]));
        saveForm.append('protein', String(values[1]));
        saveForm.append('fat', String(values[2]));
        saveForm.append('carbohydrates', String(values[3]));
        saveForm.append('mealDate', buildMealDateFromDateInput(dateValue));
        saveForm.append('mealType', selectedType);
        saveForm.append('baseAmount', String(Number(extracted.baseAmount) > 0 ? extracted.baseAmount : 1));
        saveForm.append('servingUnit', extracted.servingUnit === 'g' ? 'g' : '個');
        saveForm.append('image', imageFile, imageFile.name || 'meal.jpg');

        const saveResponse = await fetch('/api/history/preset', { method: 'POST', body: saveForm, cache: 'no-store' });
        const saved = await saveResponse.json().catch(() => ({}));
        if (!saveResponse.ok) throw new Error(saved.error || 'メニューの登録に失敗しました。');

        button.textContent = '登録しました';
        window.setTimeout(() => window.location.reload(), 250);
      } catch (error) {
        console.error('Nutrition-label-first meal registration failed:', error);
        button.textContent = '読み取り失敗・通常AIで再試行';
        button.disabled = false;
        button.dataset.nutritionLabelFallback = '1';
        window.alert(error?.message || '栄養表示の読み取りに失敗しました。');
      } finally {
        if (button.textContent !== '登録しました' && button.dataset.nutritionLabelFallback !== '1') {
          button.textContent = originalText;
          button.disabled = false;
        }
      }
    }, true);
  };

  install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
}
installNutritionLabelFirstMealRegistration();

const JST_TIME_ZONE = 'Asia/Tokyo';
const DAY_MS = 86400000;
const MEASUREMENT_TYPE_PRIORITY = { night: 3, morning: 2, other: 1 };
const jstDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: JST_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const jstDateLabelFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: JST_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
const jstTimeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: JST_TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const jstDateTimeFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: JST_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

function toValidDate(dateLike) { const date = new Date(dateLike); return Number.isNaN(date.getTime()) ? null : date; }
function pad2(value) { return String(value).padStart(2, '0'); }
export function toFiniteNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
export function roundToDecimals(value, decimals = 1, fallback = null) { const numeric = Number(value); if (!Number.isFinite(numeric)) return fallback; const factor = 10 ** decimals; return Math.round(numeric * factor) / factor; }
export function formatNumber(value, decimals = 1, fallback = '') { const rounded = roundToDecimals(value, decimals, null); if (rounded === null) return fallback; return decimals === 0 ? String(Math.round(rounded)) : rounded.toFixed(decimals); }
export function formatJstDateKey(dateLike) { const date = toValidDate(dateLike); return date ? jstDateFormatter.format(date) : ''; }
export function getJstDateParts(dateLike) { const date = toValidDate(dateLike); if (!date) return { year: 0, month: 0, day: 0 }; const map = Object.fromEntries(jstDateFormatter.formatToParts(date).map(part => [part.type, part.value])); return { year: Number(map.year || 0), month: Number(map.month || 0), day: Number(map.day || 0) }; }
export function getJstTimeParts(dateLike) { const date = toValidDate(dateLike); if (!date) return { hour: 0, minute: 0, second: 0 }; const map = Object.fromEntries(jstTimeFormatter.formatToParts(date).map(part => [part.type, part.value])); return { hour: Number(map.hour || 0), minute: Number(map.minute || 0), second: Number(map.second || 0) }; }
export function buildJstDateTimeIso(dateKey, fallbackDate = new Date()) { const match = typeof dateKey === 'string' ? dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null; if (!match) return fallbackDate.toISOString(); const { hour, minute, second } = getJstTimeParts(fallbackDate); return `${match[1]}-${match[2]}-${match[3]}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+09:00`; }
export function normalizeDateInputToIso(dateInput, fallbackDate = new Date()) { if (typeof dateInput !== 'string') return fallbackDate.toISOString(); const trimmed = dateInput.trim(); if (!trimmed) return fallbackDate.toISOString(); if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return buildJstDateTimeIso(trimmed, fallbackDate); const parsed = new Date(trimmed); return Number.isNaN(parsed.getTime()) ? fallbackDate.toISOString() : parsed.toISOString(); }
export function formatJstDateLabel(dateKey) { const match = typeof dateKey === 'string' ? dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null; if (!match) return ''; const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))); return jstDateLabelFormatter.format(date).replace(/\s+/g, ''); }
export function formatJstDateTimeDisplay(dateLike) { const date = toValidDate(dateLike); return date ? jstDateTimeFormatter.format(date).replace(/\s+/g, ' ') : ''; }
export function addDaysToJstDateKey(dateLike, offsetDays) { const { year, month, day } = getJstDateParts(dateLike); if (!year || !month || !day) return ''; const date = new Date(Date.UTC(year, month - 1, day)); date.setUTCDate(date.getUTCDate() + offsetDays); return formatJstDateKey(date); }
export function getMeasurementTypePriority(measurementType) { return MEASUREMENT_TYPE_PRIORITY[measurementType] || 0; }
export function compareWeightRecords(a, b, { dateOrder = 'asc' } = {}) { const dateA = formatJstDateKey(a?.date); const dateB = formatJstDateKey(b?.date); if (dateA !== dateB) return dateOrder === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB); const diff = getMeasurementTypePriority(a?.measurementType) - getMeasurementTypePriority(b?.measurementType); return dateOrder === 'desc' ? -diff : diff; }
export function sortWeightRecords(records, { dateOrder = 'asc' } = {}) { return [...(Array.isArray(records) ? records : [])].sort((a, b) => compareWeightRecords(a, b, { dateOrder })); }
export function calculateAgeFromBirthDate(birthDateValue, referenceDate = new Date()) { if (!birthDateValue) return null; const birthDate = new Date(`${birthDateValue}T00:00:00`); if (Number.isNaN(birthDate.getTime())) return null; const today = toValidDate(referenceDate); if (!today) return null; let age = today.getFullYear() - birthDate.getFullYear(); const monthDiff = today.getMonth() - birthDate.getMonth(); if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1; return age >= 0 ? age : null; }
export function getCurrentJstTimeParts(referenceDate = new Date()) { const { hour, minute, second } = getJstTimeParts(referenceDate); return { hour: pad2(hour), minute: pad2(minute), second: pad2(second) }; }
export function buildMealDateFromDateInput(dateValue) { if (!dateValue) return new Date().toISOString(); const { hour, minute, second } = getCurrentJstTimeParts(new Date()); return `${dateValue}T${hour}:${minute}:${second}+09:00`; }
export function daysBetweenJstDateKeys(targetDateKey, referenceDateLike = new Date()) { const targetMatch = typeof targetDateKey === 'string' ? targetDateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null; if (!targetMatch) return null; const referenceKey = formatJstDateKey(referenceDateLike); const referenceMatch = referenceKey.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!referenceMatch) return null; const targetUtc = Date.UTC(Number(targetMatch[1]), Number(targetMatch[2]) - 1, Number(targetMatch[3])); const referenceUtc = Date.UTC(Number(referenceMatch[1]), Number(referenceMatch[2]) - 1, Number(referenceMatch[3])); return Math.round((targetUtc - referenceUtc) / DAY_MS); }
