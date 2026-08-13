import express from 'express';

const originalFetch = globalThis.fetch?.bind(globalThis);
const originalExpressJson = express.response.json;

const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const TRANSIENT_ERROR_PATTERN = /(?:\b429\b|\b503\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|temporar(?:y|ily)|try again later)/i;
const FRIENDLY_TRANSIENT_MESSAGE = '現在AIが混雑しています。少し時間をおいて、もう一度お試しください。';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRequestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input.url === 'string') return input.url;
  return '';
}

function isGeminiRequest(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'generativelanguage.googleapis.com'
      || hostname.endsWith('.aiplatform.googleapis.com');
  } catch {
    return false;
  }
}

function getRetryAfterMs(response) {
  const retryAfter = response.headers?.get?.('retry-after');
  if (!retryAfter) return 0;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const retryDate = Date.parse(retryAfter);
  return Number.isNaN(retryDate) ? 0 : Math.max(0, retryDate - Date.now());
}

function containsTransientAiError(value) {
  if (typeof value === 'string') return TRANSIENT_ERROR_PATTERN.test(value);
  if (!value || typeof value !== 'object') return false;

  try {
    return TRANSIENT_ERROR_PATTERN.test(JSON.stringify(value));
  } catch {
    return false;
  }
}

function sanitizeTransientAiErrorBody(body) {
  if (!body || typeof body !== 'object' || !containsTransientAiError(body)) return body;

  const sanitized = Array.isArray(body) ? [...body] : { ...body };
  for (const key of ['detail', 'details', 'message']) {
    if (key in sanitized && containsTransientAiError(sanitized[key])) {
      sanitized[key] = FRIENDLY_TRANSIENT_MESSAGE;
    }
  }

  if ('error' in sanitized && containsTransientAiError(sanitized.error)) {
    sanitized.error = FRIENDLY_TRANSIENT_MESSAGE;
  }

  return sanitized;
}

express.response.json = function jsonWithFriendlyTransientErrors(body) {
  const responseBody = this.statusCode >= 400 ? sanitizeTransientAiErrorBody(body) : body;
  return originalExpressJson.call(this, responseBody);
};

if (originalFetch) {
  globalThis.fetch = async function fetchWithGeminiRetry(input, init) {
    const url = getRequestUrl(input);
    if (!isGeminiRequest(url)) {
      return originalFetch(input, init);
    }

    const requestTemplate = typeof Request !== 'undefined' && input instanceof Request
      ? input
      : null;

    for (let attempt = 0; ; attempt += 1) {
      try {
        const retryInput = requestTemplate ? requestTemplate.clone() : input;
        const response = await originalFetch(retryInput, init);

        if (!TRANSIENT_STATUS_CODES.has(response.status) || attempt >= RETRY_DELAYS_MS.length) {
          return response;
        }

        const waitMs = Math.max(RETRY_DELAYS_MS[attempt], getRetryAfterMs(response));
        console.warn(`[Gemini] transient HTTP ${response.status}; retry ${attempt + 1}/${RETRY_DELAYS_MS.length} in ${waitMs}ms`);
        await sleep(waitMs);
      } catch (error) {
        if (attempt >= RETRY_DELAYS_MS.length) throw error;

        const waitMs = RETRY_DELAYS_MS[attempt];
        console.warn(`[Gemini] network error; retry ${attempt + 1}/${RETRY_DELAYS_MS.length} in ${waitMs}ms: ${error?.message || error}`);
        await sleep(waitMs);
      }
    }
  };
}

await import('./server.js');
