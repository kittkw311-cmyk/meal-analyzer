const JST_TIME_ZONE = 'Asia/Tokyo';
const DAY_MS = 86400000;
const MEASUREMENT_TYPE_PRIORITY = {
  night: 3,
  morning: 2,
  other: 1,
};

const jstDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const jstDateLabelFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: JST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
});

const jstTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: JST_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const jstDateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: JST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function toValidDate(dateLike) {
  const date = new Date(dateLike);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function roundToDecimals(value, decimals = 1, fallback = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const factor = 10 ** decimals;
  return Math.round(numeric * factor) / factor;
}

export function formatNumber(value, decimals = 1, fallback = '') {
  const rounded = roundToDecimals(value, decimals, null);
  if (rounded === null) return fallback;
  return decimals === 0 ? String(Math.round(rounded)) : rounded.toFixed(decimals);
}

export function formatJstDateKey(dateLike) {
  const date = toValidDate(dateLike);
  if (!date) return '';
  return jstDateFormatter.format(date);
}

export function getJstDateParts(dateLike) {
  const date = toValidDate(dateLike);
  if (!date) return { year: 0, month: 0, day: 0 };
  const parts = jstDateFormatter.formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(map.year || 0),
    month: Number(map.month || 0),
    day: Number(map.day || 0),
  };
}

export function getJstTimeParts(dateLike) {
  const date = toValidDate(dateLike);
  if (!date) return { hour: 0, minute: 0, second: 0 };
  const parts = jstTimeFormatter.formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
    second: Number(map.second || 0),
  };
}

export function buildJstDateTimeIso(dateKey, fallbackDate = new Date()) {
  const match = typeof dateKey === 'string' ? dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return fallbackDate.toISOString();
  const { hour, minute, second } = getJstTimeParts(fallbackDate);
  return `${match[1]}-${match[2]}-${match[3]}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+09:00`;
}

export function normalizeDateInputToIso(dateInput, fallbackDate = new Date()) {
  if (typeof dateInput !== 'string') return fallbackDate.toISOString();
  const trimmed = dateInput.trim();
  if (!trimmed) return fallbackDate.toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return buildJstDateTimeIso(trimmed, fallbackDate);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? fallbackDate.toISOString() : parsed.toISOString();
}

export function formatJstDateLabel(dateKey) {
  const match = typeof dateKey === 'string' ? dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return '';
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return jstDateLabelFormatter.format(date).replace(/\s+/g, '');
}

export function formatJstDateTimeDisplay(dateLike) {
  const date = toValidDate(dateLike);
  if (!date) return '';
  return jstDateTimeFormatter.format(date).replace(/\s+/g, ' ');
}

export function addDaysToJstDateKey(dateLike, offsetDays) {
  const { year, month, day } = getJstDateParts(dateLike);
  if (!year || !month || !day) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return formatJstDateKey(date);
}

export function getMeasurementTypePriority(measurementType) {
  return MEASUREMENT_TYPE_PRIORITY[measurementType] || 0;
}

export function compareWeightRecords(a, b, { dateOrder = 'asc' } = {}) {
  const dateA = formatJstDateKey(a?.date);
  const dateB = formatJstDateKey(b?.date);
  if (dateA !== dateB) {
    return dateOrder === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
  }
  const diff = getMeasurementTypePriority(a?.measurementType) - getMeasurementTypePriority(b?.measurementType);
  return dateOrder === 'desc' ? -diff : diff;
}

export function sortWeightRecords(records, { dateOrder = 'asc' } = {}) {
  return [...(Array.isArray(records) ? records : [])].sort((a, b) => compareWeightRecords(a, b, { dateOrder }));
}

export function calculateAgeFromBirthDate(birthDateValue, referenceDate = new Date()) {
  if (!birthDateValue) return null;
  const birthDate = new Date(`${birthDateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = toValidDate(referenceDate);
  if (!today) return null;
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function getCurrentJstTimeParts(referenceDate = new Date()) {
  const { hour, minute, second } = getJstTimeParts(referenceDate);
  return {
    hour: pad2(hour),
    minute: pad2(minute),
    second: pad2(second),
  };
}

export function buildMealDateFromDateInput(dateValue) {
  if (!dateValue) return new Date().toISOString();
  const { hour, minute, second } = getCurrentJstTimeParts(new Date());
  return `${dateValue}T${hour}:${minute}:${second}+09:00`;
}

export function daysBetweenJstDateKeys(targetDateKey, referenceDateLike = new Date()) {
  const targetMatch = typeof targetDateKey === 'string' ? targetDateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!targetMatch) return null;
  const referenceKey = formatJstDateKey(referenceDateLike);
  const referenceMatch = referenceKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!referenceMatch) return null;
  const targetUtc = Date.UTC(Number(targetMatch[1]), Number(targetMatch[2]) - 1, Number(targetMatch[3]));
  const referenceUtc = Date.UTC(Number(referenceMatch[1]), Number(referenceMatch[2]) - 1, Number(referenceMatch[3]));
  return Math.round((targetUtc - referenceUtc) / DAY_MS);
}
