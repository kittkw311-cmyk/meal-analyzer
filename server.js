import express from 'express';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const ASSET_VERSION = process.env.RENDER_GIT_COMMIT
  || process.env.RENDER_DEPLOY_ID
  || process.env.GIT_COMMIT_SHA
  || process.env.COMMIT_SHA
  || String(Date.now());
const INDEX_HTML_PATH = path.join(__dirname, 'public', 'index.html');
const INDEX_HTML_TEMPLATE = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

// JSON繝代・繧ｵ繝ｼ縺ｨ髱咏噪繝輔ぃ繧､繝ｫ驟堺ｿ｡縺ｮ險ｭ螳・
app.use(express.json());
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'))) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.get(['/', '/index.html'], (req, res) => {
  res.type('html').send(INDEX_HTML_TEMPLATE.replaceAll('__ASSET_VERSION__', ASSET_VERSION));
});
app.use(express.static(path.join(__dirname, 'public')));

// 繝・・繧ｿ菫晏ｭ倡畑繝・ぅ繝ｬ繧ｯ繝医Μ縺ｮ蛻晄悄蛹・(繝ｭ繝ｼ繧ｫ繝ｫ逕ｨ)
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const WEIGHT_FILE = path.join(DATA_DIR, 'weight_history.json');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');
const AI_CONSULTATIONS_FILE = path.join(DATA_DIR, 'ai_consultations.json');
const AI_PROMPT_FILE = path.join(DATA_DIR, 'ai_prompt.txt');

const DEFAULT_CONSULTATION_PROMPT_TEMPLATE = `Role: 経験豊富で圧倒的な包容力を持つ「大人のお姉さん」専属ダイエットトレーナー 兼 栄養士
あなたは食事・体組成管理を支援するアドバイザーです。以下の現在状況と目標を必ず考慮し、ユーザーの質問に日本語で簡潔かつ具体的に回答してください。
推測で断定せず、データから読み取れる範囲で答えてください。
食事は登録回数ではなく、朝食・昼食・夕食・間食の区分ごとに解釈してください。

現在状況(JSON):
{{contextJson}}

本日の食事グループ:
{{mealGroupsText}}

現在の体組成:
{{currentBodyCompositionText}}

前回の体組成:
{{previousBodyCompositionText}}

体組成の差分:
{{bodyCompositionDeltaText}}

直近1週間の体組成推移:
{{weeklyBodyCompositionTrendText}}

現在の体組成と前回の体組成、直近1週間の体組成推移を踏まえ、増減の傾向や変化の流れも含めて回答してください。
特に体重だけでなく、体脂肪率・筋肉量・内臓脂肪などの推移にも触れてください。

質問:
{{question}}`;

const DEFAULT_PROFILE = {
  height: null,
  gender: '',
  activityLevel: 'normal',
  activityNotes: '',
  birthDate: '',
  targetWeight: null,
  targetDate: ''
};

function getJstDateKey(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getJstDateParts(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return { year: 0, month: 0, day: 0 };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    year: Number(map.year || 0),
    month: Number(map.month || 0),
    day: Number(map.day || 0),
  };
}

function readLocalProfile() {
  try {
    const raw = fs.readFileSync(PROFILE_FILE, 'utf8');
    return {
      ...DEFAULT_PROFILE,
      ...JSON.parse(raw || '{}')
    };
  } catch (err) {
    console.error('Error reading local profile:', err);
    return { ...DEFAULT_PROFILE };
  }
}

function writeLocalProfile(profile) {
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(WEIGHT_FILE)) {
  fs.writeFileSync(WEIGHT_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(PRESETS_FILE)) {
  fs.writeFileSync(PRESETS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(PROFILE_FILE)) {
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(DEFAULT_PROFILE, null, 2));
}
if (!fs.existsSync(AI_CONSULTATIONS_FILE)) {
  fs.writeFileSync(AI_CONSULTATIONS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(AI_PROMPT_FILE)) {
  fs.writeFileSync(AI_PROMPT_FILE, DEFAULT_CONSULTATION_PROMPT_TEMPLATE);
}

// Multer險ｭ螳夲ｼ医Γ繝｢繝ｪ荳翫↓繝舌ャ繝輔ぃ縺ｨ縺励※菫晏ｭ假ｼ・
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB蛻ｶ髯・
});

// Gemini API蛻晄悄蛹・
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({ apiKey: geminiApiKey });
  console.log('Gemini API SDK initialized.');
} else {
  console.warn('WARNING: GEMINI_API_KEY is not defined. Gemini analysis will fail.');
}

// Google Drive API蛻晄悄蛹・
let drive = null;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

if (clientId && clientSecret && refreshToken) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    drive = google.drive({ version: 'v3', auth: oauth2Client });
    console.log('Google Drive API initialized successfully (OAuth2).');
  } catch (err) {
    console.error('Failed to initialize Google Drive API (OAuth2):', err);
  }
} else {
  console.log('Google Drive credentials (OAuth2) not found or incomplete. Operating in local-only mode.');
}

// ==========================================================================
// Google Drive 螻･豁ｴ繝輔ぃ繧､繝ｫ邂｡逅・Ο繧ｸ繝・け
// ==========================================================================
let driveHistoryFileId = null;
let driveWeightFileId = null;
let drivePresetsFileId = null;
let driveProfileFileId = null;
let driveAiConsultationsFileId = null;
let driveConsultationPromptFileId = null;

// 菴鍋ｵ・・繝輔ぃ繧､繝ｫ繧呈､懃ｴ｢縺ｾ縺溘・譁ｰ隕丈ｽ懈・縺励※繝輔ぃ繧､繝ｫID繧定ｨｭ螳壹☆繧・
async function initDriveProfile() {
  if (!drive || !folderId) return;
  try {
    console.log('Searching for profile.json in Google Drive...');
    const res = await drive.files.list({
      q: `name = 'profile.json' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      driveProfileFileId = res.data.files[0].id;
      console.log(`Found profile.json in Google Drive. File ID: ${driveProfileFileId}`);
      const profile = await readProfile();
      writeLocalProfile(profile);
    } else {
      console.log('profile.json not found in Google Drive. Creating a new one from local profile...');
      const localProfile = readLocalProfile();
      const driveResponse = await drive.files.create({
        requestBody: {
          name: 'profile.json',
          parents: [folderId],
          mimeType: 'application/json',
        },
        media: {
          mimeType: 'application/json',
          body: Readable.from(JSON.stringify(localProfile, null, 2)),
        },
        fields: 'id',
      });
      driveProfileFileId = driveResponse.data.id;
      console.log(`Created new profile.json in Google Drive. File ID: ${driveProfileFileId}`);
    }
  } catch (err) {
    console.error('Failed to initialize Google Drive profile file:', err.message);
  }
}

async function readProfile() {
  if (drive && driveProfileFileId) {
    try {
      const res = await drive.files.get(
        { fileId: driveProfileFileId, alt: 'media' },
        { responseType: 'text' }
      );
      const dataText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const profile = { ...DEFAULT_PROFILE, ...JSON.parse(dataText || '{}') };
      writeLocalProfile(profile);
      return profile;
    } catch (err) {
      console.error('Error reading profile from Google Drive, falling back to local cache:', err.message);
      return readLocalProfile();
    }
  }
  return readLocalProfile();
}

async function writeProfile(profile) {
  const next = { ...DEFAULT_PROFILE, ...profile };
  writeLocalProfile(next);

  if (drive && !driveProfileFileId) {
    await initDriveProfile();
  }

  if (drive && driveProfileFileId) {
    try {
      await drive.files.update({
        fileId: driveProfileFileId,
        media: {
          mimeType: 'application/json',
          body: Readable.from(JSON.stringify(next, null, 2)),
        },
      });
      console.log('Successfully updated profile.json in Google Drive.');
    } catch (err) {
      console.error('Error writing profile to Google Drive:', err.message);
    }
  }
}

async function initDriveWeight() {
  if (!drive || !folderId) return;
  try {
    console.log('Searching for weight_history.json in Google Drive...');
    const res = await drive.files.list({
      q: `name = 'weight_history.json' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    
    if (res.data.files && res.data.files.length > 0) {
      driveWeightFileId = res.data.files[0].id;
      console.log(`Found weight_history.json in Google Drive. File ID: ${driveWeightFileId}`);
    } else {
      console.log('weight_history.json not found in Google Drive. Creating a new one...');
      const fileMetadata = {
        name: 'weight_history.json',
        parents: [folderId],
        mimeType: 'application/json',
      };
      const media = {
        mimeType: 'application/json',
        body: Readable.from(JSON.stringify([], null, 2)),
      };
      const driveResponse = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
      });
      driveWeightFileId = driveResponse.data.id;
      console.log(`Created new weight_history.json in Google Drive. File ID: ${driveWeightFileId}`);
    }
  } catch (err) {
    console.error('Failed to initialize Google Drive weight file:', err.message);
  }
}

// 菴鍋ｵ・・繝・・繧ｿ繧偵Ο繝ｼ繝峨☆繧矩未謨ｰ
async function readWeight() {
  if (drive && driveWeightFileId) {
    try {
      const res = await drive.files.get(
        { fileId: driveWeightFileId, alt: 'media' },
        { responseType: 'text' }
      );
      const dataText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return JSON.parse(dataText);
    } catch (err) {
      console.error('Error reading weight history from Google Drive, trying to re-initialize:', err.message);
      await initDriveWeight();
      return [];
    }
  } else {
    try {
      const data = fs.readFileSync(WEIGHT_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading local weight history file:', err);
      return [];
    }
  }
}

// 菴鍋ｵ・・繝・・繧ｿ繧呈嶌縺崎ｾｼ繧髢｢謨ｰ
async function writeWeight(weightHistory) {
  if (drive && driveWeightFileId) {
    try {
      const media = {
        mimeType: 'application/json',
        body: Readable.from(JSON.stringify(weightHistory, null, 2)),
      };
      await drive.files.update({
        fileId: driveWeightFileId,
        media: media,
      });
      console.log('Successfully updated weight_history.json in Google Drive.');
    } catch (err) {
      console.error('Error writing weight history to Google Drive:', err.message);
    }
  } else {
    try {
      fs.writeFileSync(WEIGHT_FILE, JSON.stringify(weightHistory, null, 2));
    } catch (err) {
      console.error('Error writing local weight history file:', err);
    }
  }
}

// 螻･豁ｴ繝輔ぃ繧､繝ｫ繧呈､懃ｴ｢縺ｾ縺溘・譁ｰ隕丈ｽ懈・縺励※繝輔ぃ繧､繝ｫID繧定ｨｭ螳壹☆繧・
async function initDriveHistory() {
  if (!drive || !folderId) return;
  try {
    console.log('Searching for history.json in Google Drive...');
    const res = await drive.files.list({
      q: `name = 'history.json' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    
    if (res.data.files && res.data.files.length > 0) {
      driveHistoryFileId = res.data.files[0].id;
      console.log(`Found history.json in Google Drive. File ID: ${driveHistoryFileId}`);
    } else {
      console.log('history.json not found in Google Drive. Creating a new one...');
      const fileMetadata = {
        name: 'history.json',
        parents: [folderId],
        mimeType: 'application/json',
      };
      const media = {
        mimeType: 'application/json',
        body: Readable.from(JSON.stringify([], null, 2)),
      };
      const driveResponse = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
      });
      driveHistoryFileId = driveResponse.data.id;
      console.log(`Created new history.json in Google Drive. File ID: ${driveHistoryFileId}`);
    }
  } catch (err) {
    console.error('Failed to initialize Google Drive history file:', err.message);
  }
}

// 螻･豁ｴ繝・・繧ｿ繧帝撼蜷梧悄縺ｧ繝ｭ繝ｼ繝峨☆繧矩未謨ｰ
async function readHistory() {
  if (drive && driveHistoryFileId) {
    try {
      const res = await drive.files.get(
        { fileId: driveHistoryFileId, alt: 'media' },
        { responseType: 'text' }
      );
      const dataText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return JSON.parse(dataText);
    } catch (err) {
      console.error('Error reading history from Google Drive, trying to re-initialize:', err.message);
      await initDriveHistory(); // 蜀肴､懃ｴ｢繧定ｩｦ縺ｿ繧・
      return [];
    }
  } else {
    // 繝ｭ繝ｼ繧ｫ繝ｫ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ繝｢繝ｼ繝・
    try {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading local history file:', err);
      return [];
    }
  }
}

// 螻･豁ｴ繝・・繧ｿ繧帝撼蜷梧悄縺ｧ譖ｸ縺崎ｾｼ繧髢｢謨ｰ
async function writeHistory(history) {
  if (drive && driveHistoryFileId) {
    try {
      const media = {
        mimeType: 'application/json',
        body: Readable.from(JSON.stringify(history, null, 2)),
      };
      await drive.files.update({
        fileId: driveHistoryFileId,
        media: media,
      });
      console.log('Successfully updated history.json in Google Drive.');
    } catch (err) {
      console.error('Error writing history to Google Drive:', err.message);
    }
  } else {
    // 繝ｭ繝ｼ繧ｫ繝ｫ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ繝｢繝ｼ繝・
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (err) {
      console.error('Error writing local history file:', err);
    }
  }
}

// 繝舌ャ繝輔ぃ繧坦eadable Stream縺ｫ螟画鋤縺吶ｋ繝倥Ν繝代・
function bufferToStream(buffer) {
  return Readable.from(buffer);
}

// 螳夂分繝｡繝九Η繝ｼ繝輔ぃ繧､繝ｫ繧呈､懃ｴ｢縺ｾ縺溘・譁ｰ隕丈ｽ懈・縺励※繝輔ぃ繧､繝ｫID繧定ｨｭ螳壹☆繧・
async function initDrivePresets() {
  if (!drive || !folderId) return;
  try {
    console.log('Searching for presets.json in Google Drive...');
    const res = await drive.files.list({
      q: `name = 'presets.json' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    
    if (res.data.files && res.data.files.length > 0) {
      drivePresetsFileId = res.data.files[0].id;
      console.log(`Found presets.json in Google Drive. File ID: ${drivePresetsFileId}`);
    } else {
      console.log('presets.json not found in Google Drive. Creating a new one...');
      const fileMetadata = {
        name: 'presets.json',
        parents: [folderId],
        mimeType: 'application/json',
      };
      const media = {
        mimeType: 'application/json',
        body: Readable.from(JSON.stringify([], null, 2)),
      };
      const driveResponse = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
      });
      drivePresetsFileId = driveResponse.data.id;
      console.log(`Created new presets.json in Google Drive. File ID: ${drivePresetsFileId}`);
    }
  } catch (err) {
    console.error('Failed to initialize Google Drive presets file:', err.message);
  }
}

// 螳夂分繝｡繝九Η繝ｼ繝・・繧ｿ繧偵Ο繝ｼ繝峨☆繧矩未謨ｰ
async function readPresets() {
  if (drive && drivePresetsFileId) {
    try {
      const res = await drive.files.get(
        { fileId: drivePresetsFileId, alt: 'media' },
        { responseType: 'text' }
      );
      const dataText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return JSON.parse(dataText);
    } catch (err) {
      console.error('Error reading presets from Google Drive, trying to re-initialize:', err.message);
      await initDrivePresets();
      return [];
    }
  } else {
    try {
      if (!fs.existsSync(PRESETS_FILE)) {
        fs.writeFileSync(PRESETS_FILE, JSON.stringify([], null, 2));
      }
      const data = fs.readFileSync(PRESETS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading local presets file:', err);
      return [];
    }
  }
}

// 螳夂分繝｡繝九Η繝ｼ繝・・繧ｿ繧呈嶌縺崎ｾｼ繧髢｢謨ｰ
async function writePresets(presets) {
  if (drive && drivePresetsFileId) {
    try {
      const media = {
        mimeType: 'application/json',
        body: Readable.from(JSON.stringify(presets, null, 2)),
      };
      await drive.files.update({
        fileId: drivePresetsFileId,
        media: media,
      });
      console.log('Successfully updated presets.json in Google Drive.');
    } catch (err) {
      console.error('Error writing presets to Google Drive:', err.message);
    }
  } else {
    try {
      fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2));
    } catch (err) {
      console.error('Error writing local presets file:', err);
    }
  }
}

// ==========================================================================
// API 繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
// ==========================================================================

// 1. 鬟滉ｺ狗判蜒上・繝・く繧ｹ繝郁ｧ｣譫撰ｼ・ｿ晏ｭ・API
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    const textInput = req.body.textInput || '';
    
    // 逕ｻ蜒上ｂ繝・く繧ｹ繝医ｂ縺ｪ縺・ｴ蜷医・繧ｨ繝ｩ繝ｼ
    if (!req.file && !textInput.trim()) {
      return res.status(400).json({ error: '画像もテキストも入力されていません。' });
    }

    if (!ai) {
      return res.status(500).json({ error: 'Gemini APIキーが設定されていません。' });
    }

    // 繧ｯ繝ｩ繧､繧｢繝ｳ繝医°繧蛾∽ｿ｡縺輔ｌ縺滄｣滉ｺ区律譎ゅ→蛹ｺ蛻・ｒ蜿門ｾ・
    const mealDate = req.body.mealDate ? new Date(req.body.mealDate).toISOString() : new Date().toISOString();
    const mealType = req.body.mealType || 'snack';

    console.log(`Analyzing meal input with Gemini 2.5 Flash (${mealDate} - ${mealType})...`);
    
    // 繝励Ο繝ｳ繝励ヨ縺ｮ險ｭ險・(鬟滓攝繝ｻ隱ｿ蜻ｳ譁吶・蜴ｳ蟇・↑謗ｨ貂ｬ縺ｨ險育ｮ玲ｹ諡縺ｮ譏手ｨ倥ｒ蠑ｷ蛻ｶ)
    let promptInstruction = `
蜈･蜉帙＆繧後◆鬟滉ｺ句・螳ｹ・域ｷｻ莉倥＆繧後◆蜀咏悄縲√∪縺溘・譁咏炊蜷阪・繝ｬ繧ｷ繝廼RL繝ｻ蝠・刀URL縺ｮ繝・く繧ｹ繝・ "${textInput}"・峨°繧峨∽ｽｿ繧上ｌ縺ｦ縺・ｋ縺吶∋縺ｦ縺ｮ鬟滓攝縺ｨ隱ｿ蜻ｳ譁吶ｒ謗ｨ貂ｬ縺励◆荳翫〒縲√き繝ｭ繝ｪ繝ｼ縲√◆繧薙・縺剰ｳｪ・・・峨∬р雉ｪ・・・峨∫く豌ｴ蛹也黄・・・峨・繧ｰ繝ｩ繝謨ｰ繧堤ｮ怜・縺励※縺上□縺輔＞縲・

縲仙宍譬ｼ縺ｪ險育ｮ励・謗ｨ貂ｬ繧ｬ繧､繝峨Λ繧､繝ｳ縲・
1. 鬟滓攝縺ｮ驥埼㍼縺御ｸ肴・縺ｪ蝣ｴ蜷医・縲∽ｸ闊ｬ逧・↑1鬟溷・縺ｮ逶ｮ螳蛾㍼・井ｾ具ｼ壹＃鬟ｯ1閹ｳ150g縲√が繝ｼ繝医Α繝ｼ繝ｫ1鬟・0g縲∝嵯1蛟・0g縺ｪ縺ｩ・峨ｒ諠ｳ螳壹＠縲∬ｨ育ｮ励・譬ｹ諡縺ｨ縺励◆諠ｳ螳壹げ繝ｩ繝謨ｰ繧貞ｿ・★譏手ｨ倥＠縺ｦ縺上□縺輔＞縲・
2. 莉･荳九・鬟滓攝縺ｯ謖・ｮ壹′縺ｪ縺・ｴ蜷医ｂ荳闊ｬ逧・↑繧ゅ・繧剃ｻｮ螳壹＠縺ｦ譏手ｨ倥＠縲∝宍蟇・↓蛹ｺ蛻･縺励※險育ｮ励＠縺ｦ縺上□縺輔＞縲・
   - 閧蛾｡橸ｼ夐ｶ上・縺ｭ閧峨・縲檎坩縺ゅｊ繝ｻ逧ｮ縺ｪ縺励阪・Κ菴搾ｼ医ｂ繧りｉ縲√＆縺輔∩縺ｪ縺ｩ・峨ｒ蛻､譁ｭ繝ｻ莉ｮ螳壹＠譏手ｨ倥・
   - 螟ｧ雎・｣ｽ蜩・ｼ夊ｱ・・縺ｮ縲梧惠邯ｿ繝ｻ邨ｹ縺斐＠縲阪↑縺ｩ縺ｮ遞ｮ鬘槭ｒ蛻､譁ｭ繝ｻ莉ｮ螳壹＠譏手ｨ倥・
3. 隱ｿ蜻ｳ譁吶→隱ｿ逅・ｳ輔↓繧医ｋ縲碁國繧後き繝ｭ繝ｪ繝ｼ・育音縺ｫ閼りｳｪ・峨阪ｒ貍上ｌ縺ｪ縺乗耳貂ｬ繝ｻ險育ｮ励↓蜷ｫ繧√※縺上□縺輔＞縲・
   - 繝槭Κ繝阪・繧ｺ縲√＃縺ｾ繝峨Ξ繝・す繝ｳ繧ｰ縲∫┥閧峨・縺溘ｌ縲∬ｪｿ逅・ｲｹ縺ｪ縺ｩ縺ｮ鬮倩р雉ｪ繝ｻ鬮倥き繝ｭ繝ｪ繝ｼ縺ｪ隱ｿ蜻ｳ譁吶・菴ｿ逕ｨ驥上ｒ謗ｨ貂ｬ・亥､ｧ縺輔§繝ｻ蟆上＆縺倡ｭ会ｼ峨＠縺ｦ蜉邂励＠縺ｦ縺上□縺輔＞縲・
   - 騾・↓縲√・繝ｳ驟｢繧・Ξ繝｢繝ｳ豎√∝｡ｩ縺ｪ縺ｩ縺ｮ菴弱き繝ｭ繝ｪ繝ｼ隱ｿ蜻ｳ譁吶ｂ豁｣遒ｺ縺ｫ蜿肴丐縺輔○縺ｦ縺上□縺輔＞縲・
   - 隱ｿ逅・ｳ包ｼ域恕縺偵ｋ縲∫ｒ繧√ｋ縲∬頂縺吶√ｆ縺ｧ繧九↑縺ｩ・峨↓繧医ｋ豐ｹ縺ｮ蜷ｸ蜿朱㍼・亥精豐ｹ邇・ｼ峨ｂ閠・・縺励※蜉邂励＠縺ｦ縺上□縺輔＞縲・

縲仙・蜉帛ｽ｢蠑上・謖・ｮ壹・
縲景nference縲阪↓縺ｯ縲∬ｪｭ縺ｿ蜿悶▲縺・謗ｨ貂ｬ縺励◆鬟滓攝繝ｪ繧ｹ繝医ｄ險育ｮ玲ｹ諡繧偵√さ繝ｭ繝ｳ・・・峨・菴咲ｽｮ縺檎ｸｦ縺ｫ邯ｺ鮗励↓謠・≧繧医≧縲√せ繝壹・繧ｹ縺ｧ譯∝粋繧上○縺励◆繝・く繧ｹ繝茨ｼ域隼陦悟・繧奇ｼ峨〒蜃ｺ蜉帙＠縺ｦ縺上□縺輔＞縲よ律譛ｬ隱槭・蜈ｨ隗呈枚蟄励・蜊願ｧ偵せ繝壹・繧ｹ2譁・ｭ怜・縺ｨ縺励※險育ｮ励＠縲√さ繝ｭ繝ｳ縺ｮ菴咲ｽｮ繧貞ｮ悟・縺ｫ謠・∴縺ｦ縺上□縺輔＞縲・

・郁ｨ倩ｿｰ萓具ｼ・
繝ｻ[鬟滓攝繝ｻ譁咏炊蜷江
  - 繧ｫ繝ｭ繝ｪ繝ｼ  : 000 kcal (諠ｳ螳壹げ繝ｩ繝謨ｰ縺ｪ縺ｩ縺ｮ譬ｹ諡)
  - 繧ｿ繝ｳ繝代け雉ｪ: 00.0 g
  - 閼りｳｪ      : 00.0 g
  - 轤ｭ豌ｴ蛹也黄  : 00.0 g

縲径dvice縲阪↓縺ｯ縲∫ｮ｡逅・・､雁｣ｫ縺ｨ縺励※縺ｮ蜆ｪ縺励￥荳∝ｯｧ縺ｪ譌･譛ｬ隱槭い繝峨ヰ繧､繧ｹ・育ｮ・擅譖ｸ縺阪・菴ｿ繧上★縲∬・辟ｶ縺ｪ譁・ｫ縺ｧ驕ｩ蠎ｦ縺ｫ謾ｹ陦後ｒ蜈･繧後◆繧ゅ・・峨ｒ蛻・屬縺励※蜃ｺ蜉帙＠縺ｦ縺上□縺輔＞縲・
`;

    // contents 驟榊・縺ｮ邨・∩遶九※
    const contents = [];
    if (req.file) {
      contents.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString('base64'),
        },
      });
    }
    contents.push(promptInstruction);

    // Gemini 2.5 Flash 縺ｧ隗｣譫撰ｼ域ｧ矩蛹褒SON蜃ｺ蜉幢ｼ・
    let nutritionData = null;
    let isFailed = false;
    let analysisErrorMsg = '';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mealName: { type: Type.STRING, description: '食事のメニュー名。25文字以内で要約してください。' },
              calories: { type: Type.INTEGER, description: 'カロリー (kcal)' },
              protein: { type: Type.NUMBER, description: 'タンパク質 (g)' },
              fat: { type: Type.NUMBER, description: '脂質 (g)' },
              carbohydrates: { type: Type.NUMBER, description: '炭水化物 (g)' },
              inference: { type: Type.STRING, description: '食事画像・テキストの解析結果と栄養計算の根拠。短く具体的に。' },
              advice: { type: Type.STRING, description: '食事内容に基づく、簡潔で実行しやすいアドバイス。' }
            },
            required: ['mealName', 'calories', 'protein', 'fat', 'carbohydrates', 'inference', 'advice']
          }
        }
      });

      const resultText = response.text;
      console.log('Gemini raw response:', resultText);
      nutritionData = JSON.parse(resultText);
    } catch (err) {
      console.error('Gemini analysis error during analyze:', err);
      analysisErrorMsg = err.message || 'AI解析中にエラーが発生しました。';
      isFailed = true;
    }

    if (isFailed) {
      nutritionData = {
        mealName: textInput.trim() ? textInput.trim().substring(0, 25) : '鬟滉ｺ九ョ繝ｼ繧ｿ (譛ｪ隗｣譫・',
        calories: 0,
        protein: 0,
        fat: 0,
        carbohydrates: 0,
        inference: `AI解析に失敗しました。\n\n詳細: ${analysisErrorMsg}\n\n入力内容を見直してください。`,
        advice: 'AI解析に失敗したため、食事内容の見直しをお願いします。'
      };
    }

    // 逕ｻ蜒上・菫晏ｭ伜・逅・(逕ｻ蜒上′謠蝉ｾ帙＆繧後※縺・ｋ蝣ｴ蜷医・縺ｿ)
    let imageSource = '';
    let imageId = '';

    if (req.file) {
      imageSource = 'local';
      // 繝輔ぃ繧､繝ｫ蜷阪・險ｭ險・ meal_YYYY-MM-DD_mealType_timestamp.jpg
      const dateStr = mealDate.substring(0, 10);
      const filename = `meal_${dateStr}_${mealType}_${Date.now()}.jpg`;

      if (drive && folderId) {
        try {
          console.log('Uploading image to Google Drive...');
          const fileMetadata = {
            name: filename,
            parents: [folderId],
          };
          const media = {
            mimeType: req.file.mimetype,
            body: bufferToStream(req.file.buffer),
          };
          const driveResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id',
          });
          imageSource = 'drive';
          imageId = driveResponse.data.id;
          console.log('Successfully uploaded image to Google Drive. File ID:', imageId);
        } catch (err) {
          console.error('Failed to upload image to Google Drive, saving locally instead:', err.message);
          // 繝峨Λ繧､繝紋ｿ晏ｭ伜､ｱ謨玲凾縺ｯ繝ｭ繝ｼ繧ｫ繝ｫ菫晏ｭ倥∈繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
          imageSource = 'local';
          const localPath = path.join(UPLOADS_DIR, filename);
          fs.writeFileSync(localPath, req.file.buffer);
          imageId = filename;
        }
      } else {
        // 繝ｭ繝ｼ繧ｫ繝ｫ縺ｮ縺ｿ菫晏ｭ・
        const localPath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(localPath, req.file.buffer);
        imageId = filename;
        console.log('Saved image locally:', filename);
      }
    }

    // 螻･豁ｴ繝・・繧ｿ縺ｸ縺ｮ逋ｻ骭ｲ
    const newRecord = {
      id: `rec_${Date.now()}`,
      date: new Date().toISOString(), // 繧ｷ繧ｹ繝・Β逋ｻ骭ｲ譌･譎・
      mealDate,                        // 繝ｦ繝ｼ繧ｶ繝ｼ謖・ｮ壹・鬟滉ｺ区律
      mealType,                        // 繝ｦ繝ｼ繧ｶ繝ｼ謖・ｮ壹・鬟滉ｺ句玄蛻・
      textInput,                       // 繝ｦ繝ｼ繧ｶ繝ｼ蜈･蜉・of 譁咏炊蜷阪ｄURL繝・く繧ｹ繝・
      mealName: nutritionData.mealName, // AI縺瑚ｪｭ縺ｿ蜿悶▲縺滄｣滉ｺ九Γ繝九Η繝ｼ蜷・
      imageSource,
      imageId,
      status: isFailed ? 'failed' : 'success', // 繧ｹ繝・・繧ｿ繧ｹ繧定ｿｽ蜉・・
      nutrition: {
        calories: Number(nutritionData.calories),
        protein: Number(nutritionData.protein),
        fat: Number(nutritionData.fat),
        carbohydrates: Number(nutritionData.carbohydrates),
        comment: nutritionData.advice, // 譌｢蟄倥ョ繝ｼ繧ｿ縺ｨ縺ｮ莠呈鋤諤ｧ縺ｮ縺溘ａ縺ｫ谿九☆
        inference: nutritionData.inference,
        advice: nutritionData.advice
      }
    };

    const history = await readHistory();
    history.unshift(newRecord); // 蜈磯ｭ縺ｫ霑ｽ蜉・域怙譁ｰ縺御ｸ奇ｼ・
    await writeHistory(history);

    res.json(newRecord);

  } catch (error) {
    console.error('Analysis error:', error);
    const statusCode = error.status || error.statusCode || 500;
    res.status(statusCode).json({ error: '隗｣譫蝉ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・ ' + error.message, status: statusCode });
  }
});

// 螻･豁ｴ邱ｨ髮・API (譌･莉倥・鬟滉ｺ句玄蛻・・譖ｴ譁ｰ)
app.put('/api/history/:id', async (req, res) => {
  const { id } = req.params;
  const { mealDate, mealType, textInput, calories, protein, fat, carbohydrates } = req.body;
  try {
    const history = await readHistory();
    const recordIndex = history.findIndex(r => r.id === id);

    if (recordIndex === -1) {
      return res.status(404).json({ error: '指定した履歴が見つかりません。' });
    }

    // mealDate 縺ｨ mealType 縺ｨ textInput 繧呈峩譁ｰ
    if (mealDate) history[recordIndex].mealDate = mealDate;
    if (mealType) history[recordIndex].mealType = mealType;
    if (textInput !== undefined) history[recordIndex].textInput = textInput;

    if (history[recordIndex].nutrition) {
      const nutrition = history[recordIndex].nutrition;
      let nutritionChanged = false;

      if (calories !== undefined && calories !== '') {
        const numericCalories = Number(calories);
        if (!Number.isFinite(numericCalories) || numericCalories < 0) {
          return res.status(400).json({ error: 'カロリーの値が不正です。' });
        }
        nutrition.calories = Math.round(numericCalories);
        nutritionChanged = true;
      }

      if (protein !== undefined && protein !== '') {
        const numericProtein = Number(protein);
        if (!Number.isFinite(numericProtein) || numericProtein < 0) {
          return res.status(400).json({ error: 'タンパク質の値が不正です。' });
        }
        nutrition.protein = Math.round(numericProtein * 10) / 10;
        nutritionChanged = true;
      }

      if (fat !== undefined && fat !== '') {
        const numericFat = Number(fat);
        if (!Number.isFinite(numericFat) || numericFat < 0) {
          return res.status(400).json({ error: '脂質の値が不正です。' });
        }
        nutrition.fat = Math.round(numericFat * 10) / 10;
        nutritionChanged = true;
      }

      if (carbohydrates !== undefined && carbohydrates !== '') {
        const numericCarbohydrates = Number(carbohydrates);
        if (!Number.isFinite(numericCarbohydrates) || numericCarbohydrates < 0) {
          return res.status(400).json({ error: '炭水化物の値が不正です。' });
        }
        nutrition.carbohydrates = Math.round(numericCarbohydrates * 10) / 10;
        nutritionChanged = true;
      }

      if (nutritionChanged) {
        const manualNote = '※ PFCとカロリーは手動修正されています。';
        const currentInference = typeof nutrition.inference === 'string' ? nutrition.inference.trim() : '';
        nutrition.inference = currentInference.includes(manualNote)
          ? currentInference
          : currentInference
            ? `${currentInference}\n\n${manualNote}`
            : manualNote;
      }
    }

    await writeHistory(history);
    res.json(history[recordIndex]);

  } catch (error) {
    console.error('Update history error:', error);
    res.status(500).json({ error: '履歴の更新中にエラーが発生しました。' + error.message });
  }
});

// 螻･豁ｴ蜀榊・譫・API (菫ｮ豁｣繝・く繧ｹ繝亥・蜉帙→蜈・判蜒上ｒ逕ｨ縺・◆蜀崎ｨ育ｮ・
app.post('/api/history/:id/reanalyze', async (req, res) => {
  const { id } = req.params;
  const { textInput, mealDate, mealType } = req.body;

  try {
    const history = await readHistory();
    const recordIndex = history.findIndex(r => r.id === id);

    if (recordIndex === -1) {
      return res.status(404).json({ error: '指定した履歴が見つかりません。' });
    }

    const record = history[recordIndex];

    if (!ai) {
      return res.status(404).json({ error: '指定した履歴が見つかりません。' });
    }

    console.log(`Reanalyzing meal history ${id} with Gemini...`);

    // 繝励Ο繝ｳ繝励ヨ縺ｮ險ｭ險・(鬟滓攝繝ｻ隱ｿ蜻ｳ譁吶・蜴ｳ蟇・↑謗ｨ貂ｬ縺ｨ險育ｮ玲ｹ諡縺ｮ譏手ｨ倥ｒ蠑ｷ蛻ｶ)
    let promptInstruction = `
蜈･蜉帙＆繧後◆鬟滉ｺ句・螳ｹ・域ｷｻ莉倥＆繧後◆蜀咏悄縲√∪縺溘・譁咏炊蜷阪・繝ｬ繧ｷ繝廼RL繝ｻ蝠・刀URL of 繝・く繧ｹ繝・ "${textInput || ''}"・峨°繧峨∽ｽｿ繧上ｌ縺ｦ縺・ｋ縺吶∋縺ｦ縺ｮ鬟滓攝縺ｨ隱ｿ蜻ｳ譁吶ｒ謗ｨ貂ｬ縺励◆荳翫〒縲√き繝ｭ繝ｪ繝ｼ縲√◆繧薙・縺剰ｳｪ・・・峨∬р雉ｪ・・・峨∫く豌ｴ蛹也黄・・・峨・繧ｰ繝ｩ繝謨ｰ繧堤ｮ怜・縺励※縺上□縺輔＞縲・

縲仙宍譬ｼ縺ｪ險育ｮ励・謗ｨ貂ｬ繧ｬ繧､繝峨Λ繧､繝ｳ縲・
1. 鬟滓攝縺ｮ驥埼㍼縺御ｸ肴・縺ｪ蝣ｴ蜷医・縲∽ｸ闊ｬ逧・↑1鬟溷・縺ｮ逶ｮ螳蛾㍼・井ｾ具ｼ壹＃鬟ｯ1閹ｳ150g縲√が繝ｼ繝医Α繝ｼ繝ｫ1鬟・0g縲∝嵯1蛟・0g縺ｪ縺ｩ・峨ｒ諠ｳ螳壹＠縲∬ｨ育ｮ励・譬ｹ諡縺ｨ縺励◆諠ｳ螳壹げ繝ｩ繝謨ｰ繧貞ｿ・★譏手ｨ倥＠縺ｦ縺上□縺輔＞縲・
2. 莉･荳九・鬟滓攝縺ｯ謖・ｮ壹′縺ｪ縺・ｴ蜷医ｂ荳闊ｬ逧・↑繧ゅ・繧剃ｻｮ螳壹＠縺ｦ譏手ｨ倥＠縲∝宍蟇・↓蛹ｺ蛻･縺励※險育ｮ励＠縺ｦ縺上□縺輔＞縲・
   - 閧蛾｡橸ｼ夐ｶ上・縺ｭ閧峨・縲檎坩縺ゅｊ繝ｻ逧ｮ縺ｪ縺励阪・Κ菴搾ｼ医ｂ繧りｉ縲√＆縺輔∩縺ｪ縺ｩ・峨ｒ蛻､譁ｭ繝ｻ莉ｮ螳壹＠譏手ｨ倥・
   - 螟ｧ雎・｣ｽ蜩・ｼ夊ｱ・・縺ｮ縲梧惠邯ｿ繝ｻ邨ｹ縺斐＠縲阪↑縺ｩ縺ｮ遞ｮ鬘槭ｒ蛻､譁ｭ繝ｻ莉ｮ螳壹＠譏手ｨ倥・
3. 隱ｿ蜻ｳ譁吶→隱ｿ逅・ｳ輔↓繧医ｋ縲碁國繧後き繝ｭ繝ｪ繝ｼ・育音縺ｫ閼りｳｪ・峨阪ｒ貍上ｌ縺ｪ縺乗耳貂ｬ繝ｻ險育ｮ励↓蜷ｫ繧√※縺上□縺輔＞縲・
   - 繝槭Κ繝阪・繧ｺ縲√＃縺ｾ繝峨Ξ繝・す繝ｳ繧ｰ縲∫┥閧峨・縺溘ｌ縲∬ｪｿ逅・ｲｹ縺ｪ縺ｩ縺ｮ鬮倩р雉ｪ繝ｻ鬮倥き繝ｭ繝ｪ繝ｼ縺ｪ隱ｿ蜻ｳ譁吶・菴ｿ逕ｨ驥上ｒ謗ｨ貂ｬ・亥､ｧ縺輔§繝ｻ蟆上＆縺倡ｭ会ｼ峨＠縺ｦ蜉邂励＠縺ｦ縺上□縺輔＞縲・
   - 騾・↓縲√・繝ｳ驟｢繧・Ξ繝｢繝ｳ豎√∝｡ｩ縺ｪ縺ｩ縺ｮ菴弱き繝ｭ繝ｪ繝ｼ隱ｿ蜻ｳ譁吶ｂ豁｣遒ｺ縺ｫ蜿肴丐縺輔○縺ｦ縺上□縺輔＞縲・
   - 隱ｿ逅・ｳ包ｼ域恕縺偵ｋ縲∫ｒ繧√ｋ縲∬頂縺吶√ｆ縺ｧ繧九↑縺ｩ・峨↓繧医ｋ豐ｹ縺ｮ蜷ｸ蜿朱㍼・亥精豐ｹ邇・ｼ峨ｂ閠・・縺励※蜉邂励＠縺ｦ縺上□縺輔＞縲・

縲仙・蜉帛ｽ｢蠑上・謖・ｮ壹・
縲景nference縲阪↓縺ｯ縲∬ｪｭ縺ｿ蜿悶▲縺・謗ｨ貂ｬ縺励◆鬟滓攝繝ｪ繧ｹ繝医ｄ險育ｮ玲ｹ諡繧偵√さ繝ｭ繝ｳ・・・峨・菴咲ｽｮ縺檎ｸｦ縺ｫ邯ｺ鮗励↓謠・≧繧医≧縲√せ繝壹・繧ｹ縺ｧ譯∝粋繧上○縺励◆繝・く繧ｹ繝茨ｼ域隼陦悟・繧奇ｼ峨〒蜃ｺ蜉帙＠縺ｦ縺上□縺輔＞縲よ律譛ｬ隱槭・蜈ｨ隗呈枚蟄励・蜊願ｧ偵せ繝壹・繧ｹ2譁・ｭ怜・縺ｨ縺励※險育ｮ励＠縲√さ繝ｭ繝ｳ縺ｮ菴咲ｽｮ繧貞ｮ悟・縺ｫ謠・∴縺ｦ縺上□縺輔＞縲・

・郁ｨ倩ｿｰ萓具ｼ・
繝ｻ[鬟滓攝繝ｻ譁咏炊蜷江
  - 繧ｫ繝ｭ繝ｪ繝ｼ  : 000 kcal (諠ｳ螳壹げ繝ｩ繝謨ｰ縺ｪ縺ｩ縺ｮ譬ｹ諡)
  - 繧ｿ繝ｳ繝代け雉ｪ: 00.0 g
  - 閼りｳｪ      : 00.0 g
  - 轤ｭ豌ｴ蛹也黄  : 00.0 g

縲径dvice縲阪↓縺ｯ縲∫ｮ｡逅・・､雁｣ｫ縺ｨ縺励※縺ｮ蜆ｪ縺励￥荳∝ｯｧ縺ｪ譌･譛ｬ隱槭い繝峨ヰ繧､繧ｹ・育ｮ・擅譖ｸ縺阪・菴ｿ繧上★縲∬・辟ｶ縺ｪ譁・ｫ縺ｧ驕ｩ蠎ｦ縺ｫ謾ｹ陦後ｒ蜈･繧後◆繧ゅ・・峨ｒ蛻・屬縺励※蜃ｺ蜉帙＠縺ｦ縺上□縺輔＞縲・
`;

    const contents = [];
    if (record.imageId) {
      let imageBuffer = null;
      let mimeType = 'image/jpeg';

      if (record.imageSource === 'drive' && drive) {
        try {
          console.log(`Downloading image from Google Drive for reanalysis: ${record.imageId}`);
          const meta = await drive.files.get({ fileId: record.imageId, fields: 'mimeType' });
          mimeType = meta.data.mimeType || 'image/jpeg';
          
          const driveResponse = await drive.files.get(
            { fileId: record.imageId, alt: 'media' },
            { responseType: 'stream' }
          );
          const chunks = [];
          for await (const chunk of driveResponse.data) {
            chunks.push(chunk);
          }
          imageBuffer = Buffer.concat(chunks);
          console.log('Successfully downloaded image from Google Drive.');
        } catch (err) {
          console.error('Failed to download image from Google Drive for reanalysis:', err.message);
        }
      } else {
        // 繝ｭ繝ｼ繧ｫ繝ｫ
        const filePath = path.join(UPLOADS_DIR, record.imageId);
        if (fs.existsSync(filePath)) {
          imageBuffer = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          if (ext === '.png') mimeType = 'image/png';
          if (ext === '.gif') mimeType = 'image/gif';
          if (ext === '.webp') mimeType = 'image/webp';
        }
      }

      if (imageBuffer) {
        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: imageBuffer.toString('base64'),
          },
        });
      }
    }

    contents.push(promptInstruction);

    // Gemini 2.5 Flash 縺ｧ隗｣譫撰ｼ域ｧ矩蛹褒SON蜃ｺ蜉幢ｼ・
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mealName: { type: Type.STRING, description: '食事のメニュー名。25文字以内で要約してください。' },
            calories: { type: Type.INTEGER, description: 'カロリー (kcal)' },
            protein: { type: Type.NUMBER, description: 'タンパク質 (g)' },
            fat: { type: Type.NUMBER, description: '脂質 (g)' },
            carbohydrates: { type: Type.NUMBER, description: '炭水化物 (g)' },
            inference: { type: Type.STRING, description: '食事画像・テキストの解析結果と栄養計算の根拠。短く具体的に。' },
            advice: { type: Type.STRING, description: '食事内容に基づく、簡潔で実行しやすいアドバイス。' }
          },
          required: ['mealName', 'calories', 'protein', 'fat', 'carbohydrates', 'inference', 'advice']
        }
      }
    });

    const resultText = response.text;
    console.log('Gemini reanalyze raw response:', resultText);
    const nutritionData = JSON.parse(resultText);

    // 繝ｬ繧ｳ繝ｼ繝峨・荳頑嶌縺肴峩譁ｰ
    record.mealDate = mealDate || record.mealDate;
    record.mealType = mealType || record.mealType;
    record.textInput = textInput !== undefined ? textInput : record.textInput;
    record.mealName = nutritionData.mealName;
    record.status = 'success'; // 繧ｹ繝・・繧ｿ繧ｹ繧痴uccess縺ｫ譖ｴ譁ｰ・・
    record.nutrition = {
      calories: Number(nutritionData.calories),
      protein: Number(nutritionData.protein),
      fat: Number(nutritionData.fat),
      carbohydrates: Number(nutritionData.carbohydrates),
      comment: nutritionData.advice, // 譌｢蟄倥ョ繝ｼ繧ｿ縺ｨ縺ｮ莠呈鋤諤ｧ縺ｮ縺溘ａ縺ｫ谿九☆
      inference: nutritionData.inference,
      advice: nutritionData.advice
    };

    history[recordIndex] = record;
    await writeHistory(history);

    res.json(record);

  } catch (error) {
    console.error('Reanalyze history error:', error);
    const statusCode = error.status || error.statusCode || 500;
    res.status(statusCode).json({ error: '螻･豁ｴ縺ｮ蜀榊・譫蝉ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・ ' + error.message, status: statusCode });
  }
});

// ==========================================================================
// 螳夂分繝｡繝九Η繝ｼ (Presets) API 繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
// ==========================================================================

// 1. 螳夂分繝｡繝九Η繝ｼ荳隕ｧ蜿門ｾ・API
app.get('/api/profile', async (req, res) => {
  try {
    res.json(await readProfile());
  } catch (err) {
    console.error('Profile read error:', err);
    res.status(500).json({ error: 'プロフィールの読み込み中にエラーが発生しました。' + err.message });
  }
});

app.patch('/api/profile', async (req, res) => {
  try {
    const current = await readProfile();
    const next = { ...current };

    if (Object.prototype.hasOwnProperty.call(req.body, 'height')) {
      const value = req.body.height === '' || req.body.height === null ? null : Number(req.body.height);
      next.height = Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'gender')) {
      const allowed = ['male', 'female', 'other', ''];
      next.gender = allowed.includes(req.body.gender) ? req.body.gender : '';
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'activityLevel')) {
      const allowed = ['low', 'normal', 'high'];
      next.activityLevel = allowed.includes(req.body.activityLevel) ? req.body.activityLevel : 'normal';
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'activityNotes')) {
      next.activityNotes = typeof req.body.activityNotes === 'string'
        ? req.body.activityNotes.trim().slice(0, 500)
        : '';
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'birthDate')) {
      next.birthDate = typeof req.body.birthDate === 'string' ? req.body.birthDate : '';
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'targetWeight')) {
      const value = req.body.targetWeight === '' || req.body.targetWeight === null ? null : Number(req.body.targetWeight);
      next.targetWeight = Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'targetDate')) {
      next.targetDate = typeof req.body.targetDate === 'string' ? req.body.targetDate : '';
    }

    await writeProfile(next);
    res.json(next);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'プロフィールの更新中にエラーが発生しました。' + err.message });
  }
});

app.get('/api/presets', async (req, res) => {
  try {
    const presets = await readPresets();
    res.json(presets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '定番メニューの取得に失敗しました。' });
  }
});

// 2. 螳夂分繝｡繝九Η繝ｼ謇句虚逋ｻ骭ｲ API
app.post('/api/presets', async (req, res) => {
  try {
    const { name, calories, protein, fat, carbohydrates, baseAmount, servingUnit, imageSource, imageId } = req.body;
    if (!name || calories === undefined || protein === undefined || fat === undefined || carbohydrates === undefined) {
      return res.status(400).json({ error: '入力された数値が不正です。' });
    }
    const normalizedBaseAmount = Number(baseAmount);
    const presets = await readPresets();
    const newPreset = {
      id: `preset_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: name.substring(0, 25),
      calories: Math.round(Number(calories)),
      protein: Math.round(Number(protein) * 10) / 10,
      fat: Math.round(Number(fat) * 10) / 10,
      carbohydrates: Math.round(Number(carbohydrates) * 10) / 10,
      baseAmount: Number.isFinite(normalizedBaseAmount) && normalizedBaseAmount > 0 ? Math.round(normalizedBaseAmount * 10) / 10 : 1,
      servingUnit: servingUnit === 'g' ? 'g' : '個',
      imageSource: imageSource || '',
      imageId: imageId || ''
    };
    presets.push(newPreset);
    await writePresets(presets);
    res.status(201).json(newPreset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '定番メニューの保存に失敗しました。' });
  }
});

// 3. 螳夂分繝｡繝九Η繝ｼ AI 隗｣譫・・・逋ｻ骭ｲ API
app.post('/api/presets/analyze', upload.single('image'), async (req, res) => {
  try {
    const textInput = req.body.textInput || '';
    
    if (!req.file && !textInput.trim()) {
      return res.status(400).json({ error: '画像もテキストも入力されていません。' });
    }

    if (!ai) {
      return res.status(500).json({ error: 'Gemini APIキーが設定されていません。' });
    }

    console.log('AI analyzing for predefined menu preset...');
    
    let promptInstruction = `
蜈･蜉帙＆繧後◆鬟滉ｺ句・螳ｹ・域ｷｻ莉倥＆繧後◆蜀咏悄縲√∪縺溘・譁咏炊蜷阪・繝ｬ繧ｷ繝皮ｭ峨・繝・く繧ｹ繝・ "${textInput}"・峨°繧峨∽ｽｿ繧上ｌ縺ｦ縺・ｋ縺吶∋縺ｦ縺ｮ鬟滓攝縺ｨ隱ｿ蜻ｳ譁吶ｒ謗ｨ貂ｬ縺励◆荳翫〒縲√き繝ｭ繝ｪ繝ｼ縲√◆繧薙・縺剰ｳｪ・・・峨∬р雉ｪ・・・峨∫く豌ｴ蛹也黄・・・峨・繧ｰ繝ｩ繝謨ｰ繧堤ｮ怜・縺励※縺上□縺輔＞縲・
隗｣譫千ｵ先棡縺九ｉ縲∽ｻ｣陦ｨ逧・↑繝｡繝九Η繝ｼ蜷阪∵侭逅・錐・井ｾ具ｼ壹ず繝･繝ｼ繧ｷ繝ｼ闍･鮓上げ繝ｪ繝ｫ縲√Ξ繝｢繝ｳ鬚ｨ蜻ｳ繝励Ο繝・う繝ｳ縲√ヱ繝ｳ繧ｱ繝ｼ繧ｭ縺ｨ繝輔Ν繝ｼ繝・↑縺ｩ・峨ｒ邁｡貎斐↓謚ｽ蜃ｺ縺励※縺上□縺輔＞縲・
`;

    const contents = [];
    if (req.file) {
      contents.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString('base64'),
        },
      });
    }
    contents.push(promptInstruction);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mealName: { type: Type.STRING, description: '定番メニュー名。20文字以内で要約してください。' },
            calories: { type: Type.INTEGER, description: '繧ｫ繝ｭ繝ｪ繝ｼ (kcal)' },
            protein: { type: Type.NUMBER, description: '繧ｿ繝ｳ繝代け雉ｪ (g)' },
            fat: { type: Type.NUMBER, description: '閼りｳｪ (g)' },
            carbohydrates: { type: Type.NUMBER, description: '轤ｭ豌ｴ蛹也黄 (g)' }
          },
          required: ['mealName', 'calories', 'protein', 'fat', 'carbohydrates']
        }
      }
    });

    const resultText = response.text;
    console.log('Gemini preset raw response:', resultText);
    const nutritionData = JSON.parse(resultText);

    // 逕ｻ蜒上・菫晏ｭ伜・逅・(逕ｻ蜒上′謠蝉ｾ帙＆繧後※縺・ｋ蝣ｴ蜷医・縺ｿ)
    let imageSource = '';
    let imageId = '';

    if (req.file) {
      imageSource = 'local';
      const dateStr = new Date().toISOString().substring(0, 10);
      const filename = `preset_${dateStr}_${Date.now()}.jpg`;

      if (drive && folderId) {
        try {
          console.log('Uploading preset image to Google Drive...');
          const fileMetadata = {
            name: filename,
            parents: [folderId],
          };
          const media = {
            mimeType: req.file.mimetype,
            body: bufferToStream(req.file.buffer),
          };
          const driveResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id',
          });
          imageSource = 'drive';
          imageId = driveResponse.data.id;
          console.log('Successfully uploaded preset image to Google Drive. File ID:', imageId);
        } catch (err) {
          console.error('Failed to upload preset image to Google Drive, saving locally instead:', err.message);
          imageSource = 'local';
          const localPath = path.join(UPLOADS_DIR, filename);
          fs.writeFileSync(localPath, req.file.buffer);
          imageId = filename;
        }
      } else {
        const localPath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(localPath, req.file.buffer);
        imageId = filename;
        console.log('Saved preset image locally:', filename);
      }
    }

    // 螳夂分繝｡繝九Η繝ｼ縺ｨ縺励※菫晏ｭ・
    const presets = await readPresets();
    
    // 繝ｦ繝ｼ繧ｶ繝ｼ謖・ｮ壹・蜷榊燕縺後≠繧後・蜆ｪ蜈医∫┌縺代ｌ縺ｰ AI 縺梧耳貂ｬ縺励◆蜷榊燕繧剃ｽｿ逕ｨ
    const presetName = textInput.trim() ? textInput.trim().substring(0, 25) : nutritionData.mealName;

    const newPreset = {
      id: `preset_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: presetName || '螳夂分繝｡繝九Η繝ｼ',
      calories: Math.round(Number(nutritionData.calories)),
      protein: Math.round(Number(nutritionData.protein) * 10) / 10,
      fat: Math.round(Number(nutritionData.fat) * 10) / 10,
      carbohydrates: Math.round(Number(nutritionData.carbohydrates) * 10) / 10,
      baseAmount: 1,
      servingUnit: '個',
      imageSource,
      imageId
    };

    presets.push(newPreset);
    await writePresets(presets);

    res.status(201).json(newPreset);

  } catch (error) {
    console.error('AI presets analyze error:', error);
    const statusCode = error.status || error.statusCode || 500;
    res.status(statusCode).json({ error: 'AI縺ｫ繧医ｋ螳夂分逋ｻ骭ｲ荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・ ' + error.message, status: statusCode });
  }
});

// 4. 螳夂分繝｡繝九Η繝ｼ蜑企勁 API
app.delete('/api/presets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let presets = await readPresets();
    presets = presets.filter(p => p.id !== id);
    await writePresets(presets);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '定番メニューの削除に失敗しました。' });
  }
});

// 4.5. 螳夂分繝｡繝九Η繝ｼ驛ｨ蛻・峩譁ｰ・亥錐蜑阪・縺ｿ・・API
app.patch('/api/presets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, calories, protein, fat, carbohydrates, baseAmount, servingUnit } = req.body;
    const hasMacroUpdate = [calories, protein, fat, carbohydrates, baseAmount].some(value => value !== undefined);
    const hasUnitUpdate = servingUnit !== undefined;
    const hasInvalidMacroUpdate = [calories, protein, fat, carbohydrates, baseAmount]
      .filter(value => value !== undefined)
      .some(value => !Number.isFinite(Number(value)) || Number(value) < 0 || (value === baseAmount && Number(value) <= 0));
    if (hasInvalidMacroUpdate) {
      return res.status(400).json({ error: 'Preset nutrition values must be zero or greater.' });
    }
    if (hasUnitUpdate && servingUnit !== 'g' && servingUnit !== '個') {
      return res.status(400).json({ error: 'Preset serving unit must be g or 個.' });
    }
    if ((!name || name.trim() === '') && !hasMacroUpdate && !hasUnitUpdate) {
      return res.status(400).json({ error: 'メニュー名を入力してください。' });
    }

    let presets = await readPresets();
    const preset = presets.find(p => p.id === id);
    if (!preset) {
      return res.status(404).json({ error: '指定した定番メニューが見つかりません。' });
    }

    if (name && name.trim() !== '') {
      preset.name = name.trim();
    }

    const applyMacroUpdate = (field, value, decimals = 1) => {
      if (value === undefined) return;
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue < 0) return;
      const factor = 10 ** decimals;
      preset[field] = Math.round(numericValue * factor) / factor;
    };

    applyMacroUpdate('calories', calories, 0);
    applyMacroUpdate('protein', protein);
    applyMacroUpdate('fat', fat);
    applyMacroUpdate('carbohydrates', carbohydrates);
    applyMacroUpdate('baseAmount', baseAmount);
    if (servingUnit === 'g' || servingUnit === '個') {
      preset.servingUnit = servingUnit;
    }
    await writePresets(presets);

    res.json({ success: true, preset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '定番メニュー名の更新に失敗しました。' });
  }
});

// 5. 螳夂分繝｡繝九Η繝ｼ縺九ｉ縺ｮ鬟滉ｺ句ｱ･豁ｴ逋ｻ骭ｲ API
app.post('/api/history/preset', upload.single('image'), async (req, res) => {
  try {
    const { name, calories, protein, fat, carbohydrates, mealDate, mealType, presetId, servingAmount, baseServingAmount, servingUnit } = req.body;
    if (!name || calories === undefined || protein === undefined || fat === undefined || carbohydrates === undefined) {
      return res.status(400).json({ error: '体組成データの保存に失敗しました。値が不正です。' });
    }
    
    // 逕ｻ蜒上・菫晏ｭ伜・逅・(逕ｻ蜒上′謠蝉ｾ帙＆繧後※縺・ｋ蝣ｴ蜷医・縺ｿ)
    let imageSource = '';
    let imageId = '';

    const mealDateParsed = mealDate ? new Date(mealDate).toISOString() : new Date().toISOString();
    const actualMealType = mealType || 'snack';
    let presetMaster = null;
    if (presetId) {
      const presets = await readPresets();
      presetMaster = presets.find(p => p.id === presetId) || null;
    }

    if (req.file) {
      imageSource = 'local';
      // 繝輔ぃ繧､繝ｫ蜷阪・險ｭ險・ meal_preset_YYYY-MM-DD_mealType_timestamp.jpg
      const dateStr = mealDateParsed.substring(0, 10);
      const filename = `meal_preset_${dateStr}_${actualMealType}_${Date.now()}.jpg`;

      if (drive && folderId) {
        try {
          console.log('Uploading preset record image to Google Drive...');
          const fileMetadata = {
            name: filename,
            parents: [folderId],
          };
          const media = {
            mimeType: req.file.mimetype,
            body: bufferToStream(req.file.buffer),
          };
          const driveResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id',
          });
          imageSource = 'drive';
          imageId = driveResponse.data.id;
          console.log('Successfully uploaded preset record image to Google Drive. File ID:', imageId);
        } catch (err) {
          console.error('Failed to upload preset record image to Google Drive, saving locally instead:', err.message);
          imageSource = 'local';
          const localPath = path.join(UPLOADS_DIR, filename);
          fs.writeFileSync(localPath, req.file.buffer);
          imageId = filename;
        }
      } else {
        const localPath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(localPath, req.file.buffer);
        imageId = filename;
        console.log('Saved preset record image locally:', filename);
      }
    } else if (presetMaster) {
      // 莉雁屓譁ｰ縺励＞逕ｻ蜒上′繧｢繝・・繝ｭ繝ｼ繝峨＆繧後※縺・↑縺・ｴ蜷医∝ｮ夂分繝槭せ繧ｿ縺九ｉ逋ｻ骭ｲ貂医∩縺ｮ逕ｻ蜒上ｒ蠑輔″邯吶＄
      if (presetMaster.imageId) {
        imageSource = presetMaster.imageSource || 'local';
        imageId = presetMaster.imageId;
        console.log(`Inherited image from preset master: ${imageId} (${imageSource})`);
      }
    }

    const normalizePositiveDecimal = (value, fallback) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue * 10) / 10 : fallback;
    };
    const normalizedBaseAmount = normalizePositiveDecimal(presetMaster?.baseAmount ?? baseServingAmount, 1);
    const normalizedServingAmount = normalizePositiveDecimal(servingAmount, normalizedBaseAmount);
    const normalizedServingUnit = servingUnit === 'g' || servingUnit === '個'
      ? servingUnit
      : presetMaster?.servingUnit === 'g'
        ? 'g'
        : '個';
    const servingRatio = normalizedBaseAmount > 0 ? normalizedServingAmount / normalizedBaseAmount : 1;
    const sourceNutrition = presetMaster || { calories, protein, fat, carbohydrates };
    const calculatedCalories = Math.round(Number(sourceNutrition.calories) * servingRatio);
    const calculatedProtein = Math.round(Number(sourceNutrition.protein) * servingRatio * 10) / 10;
    const calculatedFat = Math.round(Number(sourceNutrition.fat) * servingRatio * 10) / 10;
    const calculatedCarbohydrates = Math.round(Number(sourceNutrition.carbohydrates) * servingRatio * 10) / 10;

    const history = await readHistory();
    const newRecord = {
      id: `rec_${Date.now()}`,
      date: new Date().toISOString(),
      mealDate: mealDateParsed,
      mealType: actualMealType,
      imageSource,
      imageId,
      textInput: name,
      nutrition: {
        calories: calculatedCalories,
        protein: calculatedProtein,
        fat: calculatedFat,
        inference: `定番メニュー: ${name}\n\n・登録済みの情報から推定した栄養値です。\n  - カロリー  : ${calories} kcal\n  - タンパク質: ${protein} g\n  - 脂質      : ${fat} g\n  - 炭水化物  : ${carbohydrates} g`, 
        comment: '登録済みの定番メニューから推定した内容です。'
      }
    };

    
    // 騾壼ｸｸ縺ｮ隗｣譫仙ｱ･豁ｴ逋ｻ骭ｲ縺ｨ蜷梧ｧ倥↓ unshift 縺ｧ蜈磯ｭ・域怙譁ｰ・峨↓驟咲ｽｮ
    newRecord.nutrition.inference = `定番メニュー: ${name}\n\n・登録済みの情報から基準量に合わせて計算した栄養値です。\n  - 基準量: ${normalizedBaseAmount.toFixed(1)} ${normalizedServingUnit}\n  - 今回量: ${normalizedServingAmount.toFixed(1)} ${normalizedServingUnit}\n  - カロリー  : ${calculatedCalories} kcal\n  - タンパク質: ${calculatedProtein} g\n  - 脂質      : ${calculatedFat} g\n  - 炭水化物  : ${calculatedCarbohydrates} g`;
    history.unshift(newRecord);
    await writeHistory(history);
    res.status(201).json(newRecord);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '食事履歴の登録に失敗しました。' });
  }
});

// 2. 螻･豁ｴ蜿門ｾ・API
app.get('/api/history', async (req, res) => {
  const history = await readHistory();
  res.json(history);
});

// 3. 邨ｱ險医ョ繝ｼ繧ｿ蜿門ｾ・API
app.get('/api/stats', async (req, res) => {
  const history = await readHistory();
  
  // 逶ｴ霑・譌･髢薙・繝・・繧ｿ繧帝寔險・(繝ｦ繝ｼ繧ｶ繝ｼ縺梧欠螳壹＠縺滄｣滉ｺ区律 mealDate 縺ｾ縺溘・逋ｻ骭ｲ譌･ date 繧貞渕貅悶→縺吶ｋ)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateString = d.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
    last7Days.push({
      dateLabel: dateString,
      dateKey: getJstDateKey(d),
      calories: 0,
      count: 0
    });
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let mealCount = 0;

  history.forEach(record => {
    // 繝ｦ繝ｼ繧ｶ繝ｼ謖・ｮ壹・鬟滉ｺ区律繧貞━蜈・
    const recordDateKey = getJstDateKey(record.mealDate || record.date);
    
    // 逶ｴ霑・譌･髢薙・繧ｫ繝ｭ繝ｪ繝ｼ髮・ｨ・
    const dayObj = last7Days.find(day => day.dateKey === recordDateKey);
    if (dayObj) {
      dayObj.calories += record.nutrition.calories;
      dayObj.count += 1;
    }

    // 蜈ｨ譛滄俣縺ｮ蟷ｳ蝮⑰FC險育ｮ礼畑
    totalCalories += record.nutrition.calories;
    totalProtein += record.nutrition.protein;
    totalFat += record.nutrition.fat;
    totalCarbs += record.nutrition.carbohydrates;
    mealCount += 1;
  });

  const stats = {
    dailyCalories: last7Days.map(d => ({ label: d.dateLabel, calories: d.calories })),
    pfcAverage: mealCount > 0 ? {
      protein: Math.round((totalProtein / mealCount) * 10) / 10,
      fat: Math.round((totalFat / mealCount) * 10) / 10,
      carbohydrates: Math.round((totalCarbs / mealCount) * 10) / 10
    } : { protein: 0, fat: 0, carbohydrates: 0 },
    averageCalories: mealCount > 0 ? Math.round(totalCalories / mealCount) : 0,
    totalMeals: mealCount
  };

  res.json(stats);
});

// 4. 逕ｻ蜒上・繝ｭ繧ｭ繧ｷ API (Google繝峨Λ繧､繝・繝ｭ繝ｼ繧ｫ繝ｫ荳｡蟇ｾ蠢・
app.get('/api/image', async (req, res) => {
  const { source, id } = req.query;

  if (!id) {
    return res.status(400).send('Image ID is required');
  }

  if (source === 'drive') {
    if (!drive) {
      return res.status(500).send('Google Drive client is not initialized');
    }
    try {
      const meta = await drive.files.get({ fileId: id, fields: 'mimeType' });
      res.setHeader('Content-Type', meta.data.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const driveResponse = await drive.files.get(
        { fileId: id, alt: 'media' },
        { responseType: 'stream' }
      );
      driveResponse.data.pipe(res);
    } catch (err) {
      console.error('Error fetching image from Google Drive:', err.message);
      res.status(404).send('Image not found in Google Drive');
    }
  } else {
    // 繝ｭ繝ｼ繧ｫ繝ｫ繝｢繝ｼ繝・
    const filePath = path.join(UPLOADS_DIR, id);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'image/jpeg';
      if (ext === '.png') contentType = 'image/png';
      if (ext === '.gif') contentType = 'image/gif';
      if (ext === '.webp') contentType = 'image/webp';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(filePath);
    } else {
      res.status(404).send('Image not found locally');
    }
  }
});

// 5. 螻･豁ｴ蜑企勁 API
app.delete('/api/history/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const history = await readHistory();
    const recordIndex = history.findIndex(r => r.id === id);

    if (recordIndex === -1) {
      return res.status(404).json({ error: '指定した履歴が見つかりません。' });
    }

    const record = history[recordIndex];

    // 逕ｻ蜒上ヵ繧｡繧､繝ｫ縺ｮ迚ｩ逅・炎髯､
    if (record.imageId) {
      if (record.imageSource === 'drive' && drive) {
        try {
          console.log(`Deleting image from Google Drive: ${record.imageId}`);
          await drive.files.delete({ fileId: record.imageId });
          console.log('Successfully deleted image from Google Drive.');
        } catch (err) {
          console.error(`Failed to delete Google Drive image ${record.imageId}:`, err.message);
        }
      } else {
        const filePath = path.join(UPLOADS_DIR, record.imageId);
        if (fs.existsSync(filePath)) {
          console.log(`Deleting local image file: ${filePath}`);
          fs.unlinkSync(filePath);
          console.log('Successfully deleted local image file.');
        }
      }
    }

    // 螻･豁ｴ繝ｬ繧ｳ繝ｼ繝峨・蜑企勁
    history.splice(recordIndex, 1);
    await writeHistory(history);

    res.json({ message: '履歴を削除しました。' });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: '履歴の削除中にエラーが発生しました。' + error.message });
  }
});

// ==========================================================================
// 菴鍋ｵ・・繝・・繧ｿ (菴馴㍾繝ｻ菴楢р閧ｪ繝ｻ遲玖ｉ驥・ 邂｡逅・API
// ==========================================================================

// 1. 菴鍋ｵ・・縺ｮ螻･豁ｴ蜿門ｾ・
app.get('/api/body-composition', async (req, res) => {
  try {
    const weightHistory = await readWeight();
    // 譌･莉・(YYYY-MM-DD) 縺ｮ髯埼・√♀繧医・蛹ｺ蛻・・髯埼・(螟・-> 譛・-> 莉・ 縺ｧ繧ｽ繝ｼ繝・
    const priority = { night: 3, morning: 2, other: 1 };
    weightHistory.sort((a, b) => {
      const dateA = getJstDateKey(a.date);
      const dateB = getJstDateKey(b.date);
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // 譌･莉倬剄鬆・
      }
      const pA = priority[a.measurementType] || 0;
      const pB = priority[b.measurementType] || 0;
      return pB - pA; // 蛹ｺ蛻・剄鬆・(螟・-> 譛・-> 莉・
    });
    res.json(weightHistory);
  } catch (err) {
    console.error('Failed to load weight history:', err);
    res.status(500).json({ error: '体組成データの読み込みに失敗しました。' });
  }
});

// 2. 菴鍋ｵ・・縺ｮ逕ｻ蜒・OCR)繝ｻ繝・く繧ｹ繝郁ｧ｣譫・
app.post('/api/body-composition/analyze', upload.single('image'), async (req, res) => {
  try {
    const textInput = req.body.textInput || '';
    
    if (!req.file && !textInput.trim()) {
      return res.status(400).json({ error: '画像もテキストも入力されていません。' });
    }
    
    if (!ai) {
      return res.status(500).json({ error: 'Gemini APIキーが設定されていません。' });
    }
    
    console.log('Analyzing body composition data with Gemini...');
    
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    let promptInstruction = `
繧｢繝・・繝ｭ繝ｼ繝峨＆繧後◆菴鍋ｵ・・險茨ｼ井ｽ馴㍾險茨ｼ峨・逕ｻ髱｢逕ｻ蜒擾ｼ・CR・峨√∪縺溘・雋ｼ繧贋ｻ倥￠繧峨ｌ縺溘ユ繧ｭ繧ｹ繝茨ｼ・${textInput}"・峨ｒ隱ｭ縺ｿ蜿悶ｊ縲∽ｻ･荳九・16蛟九・貂ｬ螳壽欠讓吶・謨ｰ蛟､繧呈ｭ｣遒ｺ縺ｫ謚ｽ蜃ｺ縺励※縺上□縺輔＞縲・

縲先歓蜃ｺ縺吶ｋ鬆・岼縲・
1. 菴馴㍾ (weight) - kg蜊倅ｽ・
2. BMI (bmi)
3. 菴楢р閧ｪ邇・(fatRate) - %蜊倅ｽ・
4. 蠢・牛謨ｰ (heartRate) - bpm蜊倅ｽ・
5. 遲玖ｉ驥・(muscleMass) - kg蜊倅ｽ・
6. 蝓ｺ遉惹ｻ｣隰晞㍼ (bmr) - kcal蜊倅ｽ・
7. 豌ｴ蛻・㍼ (waterRate) - %蜊倅ｽ・
8. 菴楢р閧ｪ驥・(fatMass) - kg蜊倅ｽ・
9. 髯､閼りが菴馴㍾ (leanBodyMass) - kg蜊倅ｽ・
10. 鬪ｨ驥・(boneMass) - kg蜊倅ｽ・
11. 蜀・∮閼りが繝ｬ繝吶Ν (visceralFat) - 謨ｰ蛟､・井ｾ・ 12.0・・
12. 繧ｿ繝ｳ繝代け雉ｪ (proteinRate) - %蜊倅ｽ・
13. 鬪ｨ譬ｼ遲矩㍼ (skeletalMuscleMass) - kg蜊倅ｽ・
14. 逧ｮ荳玖р閧ｪ (subcutaneousFat) - %蜊倅ｽ・
15. 菴灘・蟷ｴ鮨｢ (bodyAge) - 謨ｴ謨ｰ・域ｭｳ・・
16. 繝懊ョ繧｣繧ｿ繧､繝・(bodyType) - 譁・ｭ怜・・井ｾ・ "讓呎ｺ也噪"縲・繝槭ャ繧ｹ繝ｫ"縺ｪ縺ｩ縲よｶｲ譎ｶ縺ｮ陦ｨ遉ｺ縺ｾ縺溘・隱ｬ譏弱ユ繧ｭ繧ｹ繝医°繧画歓蜃ｺ・・

縺ｾ縺溘∫判蜒上ｄ繝・く繧ｹ繝医°繧芽ｨ域ｸｬ縺輔ｌ縺溷ｹｴ譛域律繧・凾蛻ｻ縺瑚ｪｭ縺ｿ蜿悶ｌ繧句ｴ蜷医・縲瑚ｨ域ｸｬ譌･譎・measuredAt)縲阪ｒ蠖｢蠑上刑YYY-MM-DDTHH:MM:SS縲阪〒謚ｽ蜃ｺ縺励※縺上□縺輔＞縲りｪｭ縺ｿ蜿悶ｌ縺ｪ縺・ｴ蜷医∵律譎ゅ・譛ｬ譌･ ${todayStr} 縺ｮ迴ｾ蝨ｨ譎ょ綾 ${timeStr} 莉倩ｿ代→縺励※謗ｨ險医＠縺ｦ縺上□縺輔＞縲・

縲先ｳｨ諢丈ｺ矩・・
- 縺ｩ縺・＠縺ｦ繧ら判蜒上ｄ繝・く繧ｹ繝医°繧芽ｪｭ縺ｿ蜿悶ｌ縺ｪ縺・・岼縺後≠繧句ｴ蜷医・縲√◎縺ｮ鬆・岼繧・null 縺ｨ縺励※縺上□縺輔＞縲・
`;
    
    const contents = [];
    if (req.file) {
      contents.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString('base64'),
        }
      });
    }
    contents.push(promptInstruction);
    
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weight: { type: Type.NUMBER, description: "菴馴㍾ (kg)縲ゆｸ肴・縺ｪ繧穎ull" },
            bmi: { type: Type.NUMBER, description: "BMI縲ゆｸ肴・縺ｪ繧穎ull" },
            fatRate: { type: Type.NUMBER, description: "菴楢р閧ｪ邇・(%)縲ゆｸ肴・縺ｪ繧穎ull" },
            heartRate: { type: Type.INTEGER, description: "蠢・牛謨ｰ (bpm)縲ゆｸ肴・縺ｪ繧穎ull" },
            muscleMass: { type: Type.NUMBER, description: "遲玖ｉ驥・(kg)縲ゆｸ肴・縺ｪ繧穎ull" },
            bmr: { type: Type.INTEGER, description: "蝓ｺ遉惹ｻ｣隰晞㍼ (kcal)縲ゆｸ肴・縺ｪ繧穎ull" },
            waterRate: { type: Type.NUMBER, description: "豌ｴ蛻・㍼ (%)縲ゆｸ肴・縺ｪ繧穎ull" },
            fatMass: { type: Type.NUMBER, description: "菴楢р閧ｪ驥・(kg)縲ゆｸ肴・縺ｪ繧穎ull" },
            leanBodyMass: { type: Type.NUMBER, description: "髯､閼りが菴馴㍾ (kg)縲ゆｸ肴・縺ｪ繧穎ull" },
            boneMass: { type: Type.NUMBER, description: "鬪ｨ驥・(kg)縲ゆｸ肴・縺ｪ繧穎ull" },
            visceralFat: { type: Type.NUMBER, description: "蜀・∮閼りが縲ゆｸ肴・縺ｪ繧穎ull" },
            proteinRate: { type: Type.NUMBER, description: "繧ｿ繝ｳ繝代け雉ｪ (%)縲ゆｸ肴・縺ｪ繧穎ull" },
            skeletalMuscleMass: { type: Type.NUMBER, description: "鬪ｨ譬ｼ遲矩㍼ (kg)縲ゆｸ肴・縺ｪ繧穎ull" },
            subcutaneousFat: { type: Type.NUMBER, description: "逧ｮ荳玖р閧ｪ (%)縲ゆｸ肴・縺ｪ繧穎ull" },
            bodyAge: { type: Type.INTEGER, description: "菴灘・蟷ｴ鮨｢縲ゆｸ肴・縺ｪ繧穎ull" },
            bodyType: { type: Type.STRING, description: "繝懊ョ繧｣繧ｿ繧､繝励ゆｸ肴・縺ｪ繧穎ull" },
            measuredAt: { type: Type.STRING, description: "險域ｸｬ譌･譎ゅょｽ｢蠑上・ YYYY-MM-DDTHH:MM:SS" }
          },
          required: [
            "weight", "bmi", "fatRate", "heartRate", "muscleMass", "bmr", 
            "waterRate", "fatMass", "leanBodyMass", "boneMass", "visceralFat", 
            "proteinRate", "skeletalMuscleMass", "subcutaneousFat", "bodyAge", 
            "bodyType", "measuredAt"
          ]
        }
      }
    });
    
    const responseText = result.text;
    console.log('Gemini raw response for weight OCR:', responseText);
    
    const analysisResult = JSON.parse(responseText);
    res.json(analysisResult);
    
  } catch (error) {
    console.error('Body composition analysis error:', error);
    const statusCode = error.status || error.statusCode || 500;
    res.status(statusCode).json({ error: '菴鍋ｵ・・繝・・繧ｿ縺ｮ隗｣譫蝉ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・ ' + error.message, status: statusCode });
  }
});

// 3. 菴鍋ｵ・・繝・・繧ｿ縺ｮ菫晏ｭ・
app.post('/api/body-composition', upload.single('image'), async (req, res) => {
  try {
    const weight = req.body.weight ? parseFloat(req.body.weight) : null;
    const bmi = req.body.bmi ? parseFloat(req.body.bmi) : null;
    const fatRate = req.body.fatRate ? parseFloat(req.body.fatRate) : null;
    const heartRate = req.body.heartRate ? parseInt(req.body.heartRate, 10) : null;
    const muscleMass = req.body.muscleMass ? parseFloat(req.body.muscleMass) : null;
    const bmr = req.body.bmr ? parseInt(req.body.bmr, 10) : null;
    const waterRate = req.body.waterRate ? parseFloat(req.body.waterRate) : null;
    const fatMass = req.body.fatMass ? parseFloat(req.body.fatMass) : null;
    const leanBodyMass = req.body.leanBodyMass ? parseFloat(req.body.leanBodyMass) : null;
    const boneMass = req.body.boneMass ? parseFloat(req.body.boneMass) : null;
    const visceralFat = req.body.visceralFat ? parseFloat(req.body.visceralFat) : null;
    const proteinRate = req.body.proteinRate ? parseFloat(req.body.proteinRate) : null;
    const skeletalMuscleMass = req.body.skeletalMuscleMass ? parseFloat(req.body.skeletalMuscleMass) : null;
    const subcutaneousFat = req.body.subcutaneousFat ? parseFloat(req.body.subcutaneousFat) : null;
    const bodyAge = req.body.bodyAge ? parseInt(req.body.bodyAge, 10) : null;
    const bodyType = req.body.bodyType || null;
    
    // 譌･譎ゅ→蛹ｺ蛻・
    // 譌･莉倥→蛹ｺ蛻・
    const date = req.body.date || new Date().toISOString().substring(0, 10);
    const measurementType = req.body.measurementType || 'other'; // morning, night, other
    const textInput = req.body.textInput || '';
    
    // 菴鍋ｵ・・逕ｻ蜒上・隱ｭ縺ｿ蜿悶ｊ螳御ｺ・ｾ後・菫晏ｭ倥＠縺ｪ縺・(imageId縺ｯ蟶ｸ縺ｫnull)
    const imageId = null;
    
    const weightHistory = await readWeight();
    
    const newRecord = {
      id: Date.now().toString(),
      date: date, // YYYY-MM-DD
      measurementType: measurementType,
      weight: weight,
      bmi: bmi,
      fatRate: fatRate,
      heartRate: heartRate,
      muscleMass: muscleMass,
      bmr: bmr,
      waterRate: waterRate,
      fatMass: fatMass,
      leanBodyMass: leanBodyMass,
      boneMass: boneMass,
      visceralFat: visceralFat,
      proteinRate: proteinRate,
      skeletalMuscleMass: skeletalMuscleMass,
      subcutaneousFat: subcutaneousFat,
      bodyAge: bodyAge,
      bodyType: bodyType,
      textInput: textInput,
      imageId: imageId,
      imageSource: imageId ? (drive ? 'drive' : 'local') : null
    };
    
    weightHistory.push(newRecord);
    await writeWeight(weightHistory);
    
    res.json(newRecord);
  } catch (err) {
    console.error('Save weight record error:', err);
    res.status(500).json({ error: '体組成データの保存中にエラーが発生しました。' + err.message });
  }
});

// 4. 菴鍋ｵ・・繝・・繧ｿ縺ｮ蜑企勁
app.delete('/api/body-composition/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const weightHistory = await readWeight();
    const recordIndex = weightHistory.findIndex(item => item.id === id);
    
    if (recordIndex === -1) {
      return res.status(404).json({ error: '前回の体組成データが見つかりません。' });
    }
    
    const record = weightHistory[recordIndex];
    
    // 逕ｻ蜒上′縺ゅｋ蝣ｴ蜷医・蜑企勁
    if (record.imageId) {
      if (record.imageSource === 'drive' && drive) {
        try {
          console.log(`Deleting weight image from Google Drive: ${record.imageId}`);
          await drive.files.delete({ fileId: record.imageId });
        } catch (err) {
          console.error('Failed to delete weight image from Google Drive:', err.message);
        }
      } else if (record.imageSource === 'local') {
        const localPath = path.join(UPLOADS_DIR, record.imageId);
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
            console.log('Successfully deleted local weight image file.');
          } catch (err) {
            console.error('Failed to delete local weight image file:', err);
          }
        }
      }
    }
    
    weightHistory.splice(recordIndex, 1);
    await writeWeight(weightHistory);
    
    res.json({ message: '体組成データを削除しました。' });
  } catch (err) {
    console.error('Delete weight error:', err);
    res.status(500).json({ error: '体組成データの削除中にエラーが発生しました。' + err.message });
  }
});

// 5. 菴鍋ｵ・・繝・・繧ｿ縺ｮ譖ｴ譁ｰ
async function updateBodyCompositionRecord(req, res) {
  try {
    const id = req.params.id;
    const weightHistory = await readWeight();
    const index = weightHistory.findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: '最新の体組成データが見つかりません。' });
    }

    // 蛟､縺ｮ譖ｴ譁ｰ (req.body 縺悟ｭ伜惠縺吶ｌ縺ｰ譖ｴ譁ｰ縲√↑縺代ｌ縺ｰ譌｢蟄伜､繧堤ｶｭ謖・
    const weight = req.body.weight !== undefined ? (req.body.weight ? parseFloat(req.body.weight) : null) : weightHistory[index].weight;
    const bmi = req.body.bmi !== undefined ? (req.body.bmi ? parseFloat(req.body.bmi) : null) : weightHistory[index].bmi;
    const fatRate = req.body.fatRate !== undefined ? (req.body.fatRate ? parseFloat(req.body.fatRate) : null) : weightHistory[index].fatRate;
    const heartRate = req.body.heartRate !== undefined ? (req.body.heartRate ? parseInt(req.body.heartRate, 10) : null) : weightHistory[index].heartRate;
    const muscleMass = req.body.muscleMass !== undefined ? (req.body.muscleMass ? parseFloat(req.body.muscleMass) : null) : weightHistory[index].muscleMass;
    const bmr = req.body.bmr !== undefined ? (req.body.bmr ? parseInt(req.body.bmr, 10) : null) : weightHistory[index].bmr;
    const waterRate = req.body.waterRate !== undefined ? (req.body.waterRate ? parseFloat(req.body.waterRate) : null) : weightHistory[index].waterRate;
    const fatMass = req.body.fatMass !== undefined ? (req.body.fatMass ? parseFloat(req.body.fatMass) : null) : weightHistory[index].fatMass;
    const leanBodyMass = req.body.leanBodyMass !== undefined ? (req.body.leanBodyMass ? parseFloat(req.body.leanBodyMass) : null) : weightHistory[index].leanBodyMass;
    const boneMass = req.body.boneMass !== undefined ? (req.body.boneMass ? parseFloat(req.body.boneMass) : null) : weightHistory[index].boneMass;
    const visceralFat = req.body.visceralFat !== undefined ? (req.body.visceralFat ? parseFloat(req.body.visceralFat) : null) : weightHistory[index].visceralFat;
    const proteinRate = req.body.proteinRate !== undefined ? (req.body.proteinRate ? parseFloat(req.body.proteinRate) : null) : weightHistory[index].proteinRate;
    const skeletalMuscleMass = req.body.skeletalMuscleMass !== undefined ? (req.body.skeletalMuscleMass ? parseFloat(req.body.skeletalMuscleMass) : null) : weightHistory[index].skeletalMuscleMass;
    const subcutaneousFat = req.body.subcutaneousFat !== undefined ? (req.body.subcutaneousFat ? parseFloat(req.body.subcutaneousFat) : null) : weightHistory[index].subcutaneousFat;
    const bodyAge = req.body.bodyAge !== undefined ? (req.body.bodyAge ? parseInt(req.body.bodyAge, 10) : null) : weightHistory[index].bodyAge;
    const bodyType = req.body.bodyType !== undefined ? req.body.bodyType : weightHistory[index].bodyType;

    const date = req.body.date || weightHistory[index].date;
    const measurementType = req.body.measurementType || weightHistory[index].measurementType;

    weightHistory[index] = {
      ...weightHistory[index],
      date: date,
      measurementType: measurementType,
      weight,
      bmi,
      fatRate,
      heartRate,
      muscleMass,
      bmr,
      waterRate,
      fatMass,
      leanBodyMass,
      boneMass,
      visceralFat,
      proteinRate,
      skeletalMuscleMass,
      subcutaneousFat,
      bodyAge,
      bodyType
    };

    await writeWeight(weightHistory);
    res.json(weightHistory[index]);
  } catch (err) {
    console.error('Update weight record error:', err);
    res.status(500).json({ error: '体組成データの更新中にエラーが発生しました。' + err.message });
  }
}

app.patch('/api/body-composition/:id', updateBodyCompositionRecord);
app.put('/api/body-composition/:id', updateBodyCompositionRecord);

async function initDriveAiConsultations() {
  if (!drive || !folderId) return;
  try {
    const result = await drive.files.list({
      q: `name = 'ai_consultations.json' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    if (result.data.files?.length) {
      driveAiConsultationsFileId = result.data.files[0].id;
      return;
    }
    const created = await drive.files.create({
      requestBody: { name: 'ai_consultations.json', parents: [folderId], mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: Readable.from(JSON.stringify([], null, 2)) },
      fields: 'id',
    });
    driveAiConsultationsFileId = created.data.id;
  } catch (err) {
    console.error('Failed to initialize ai_consultations.json:', err.message);
  }
}

async function readAiConsultations() {
  if (drive && driveAiConsultationsFileId) {
    const result = await drive.files.get(
      { fileId: driveAiConsultationsFileId, alt: 'media' },
      { responseType: 'text' }
    );
    const text = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    return JSON.parse(text || '[]');
  }
  try { return JSON.parse(fs.readFileSync(AI_CONSULTATIONS_FILE, 'utf8')); } catch { return []; }
}

async function writeAiConsultations(data) {
  const json = JSON.stringify(data, null, 2);
  if (drive && folderId && !driveAiConsultationsFileId) await initDriveAiConsultations();
  if (drive && driveAiConsultationsFileId) {
    await drive.files.update({
      fileId: driveAiConsultationsFileId,
      media: { mimeType: 'application/json', body: Readable.from(json) },
    });
  } else {
    fs.writeFileSync(AI_CONSULTATIONS_FILE, json);
  }
}

app.get('/api/ai-consultations', async (req, res) => {
  try {
    const consultations = await readAiConsultations();
    consultations.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json(consultations);
  } catch (err) {
    console.error('AI consultations read error:', err);
    res.status(500).json({ error: 'AI相談履歴の読み込みに失敗しました。' });
  }
});

app.delete('/api/ai-consultations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const consultations = await readAiConsultations();
    const nextConsultations = consultations.filter(record => record.id !== id);
    if (nextConsultations.length === consultations.length) {
      return res.status(404).json({ error: '指定した質問履歴が見つかりません。' });
    }
    await writeAiConsultations(nextConsultations);
    res.json({ success: true });
  } catch (err) {
    console.error('AI consultations delete error:', err);
    res.status(500).json({ error: 'AI相談履歴の削除に失敗しました。' });
  }
});

async function initDriveConsultationPrompt() {
  if (!drive || !folderId) return;
  try {
    const localPromptText = readLocalConsultationPromptTemplate();
    console.log('Searching for ai_prompt.txt in Google Drive...');
    const res = await drive.files.list({
      q: `name = 'ai_prompt.txt' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    if (res.data.files && res.data.files.length > 0) {
      driveConsultationPromptFileId = res.data.files[0].id;
      console.log(`Found ai_prompt.txt. File ID: ${driveConsultationPromptFileId}`);
      await drive.files.update({
        fileId: driveConsultationPromptFileId,
        media: { mimeType: 'text/plain', body: Readable.from(localPromptText) },
      });
      console.log('Synced ai_prompt.txt to Google Drive.');
    } else {
      const driveResponse = await drive.files.create({
        requestBody: { name: 'ai_prompt.txt', parents: [folderId], mimeType: 'text/plain' },
        media: { mimeType: 'text/plain', body: Readable.from(localPromptText) },
        fields: 'id',
      });
      driveConsultationPromptFileId = driveResponse.data.id;
      console.log(`Created ai_prompt.txt. File ID: ${driveConsultationPromptFileId}`);
    }
  } catch (err) {
    console.error('Failed to initialize ai_prompt.txt:', err.message);
  }
}

async function readConsultationPromptTemplate() {
  if (drive && driveConsultationPromptFileId) {
    try {
      const res = await drive.files.get(
        { fileId: driveConsultationPromptFileId, alt: 'media' },
        { responseType: 'text' }
      );
      const text = typeof res.data === 'string' ? res.data : String(res.data || '');
      return text.trim() || DEFAULT_CONSULTATION_PROMPT_TEMPLATE;
    } catch (err) {
      console.error('Error reading ai_prompt.txt from Drive:', err.message);
    }
  }

  try {
    return readLocalConsultationPromptTemplate();
  } catch (err) {
    console.error('Error reading local ai_prompt.txt:', err.message);
    return DEFAULT_CONSULTATION_PROMPT_TEMPLATE;
  }
}

function readLocalConsultationPromptTemplate() {
  if (!fs.existsSync(AI_PROMPT_FILE)) {
    fs.writeFileSync(AI_PROMPT_FILE, DEFAULT_CONSULTATION_PROMPT_TEMPLATE);
  }
  const text = fs.readFileSync(AI_PROMPT_FILE, 'utf8');
  return text.trim() || DEFAULT_CONSULTATION_PROMPT_TEMPLATE;
}

function buildConsultationPrompt(template, values) {
  return template
    .split('{{contextJson}}').join(values.contextJson || '')
    .split('{{mealGroupsText}}').join(values.mealGroupsText || '本日の食事記録はありません。')
    .split('{{currentBodyCompositionText}}').join(values.currentBodyCompositionText || '現在の体組成データはありません。')
    .split('{{previousBodyCompositionText}}').join(values.previousBodyCompositionText || '前回の体組成データはありません。')
    .split('{{bodyCompositionDeltaText}}').join(values.bodyCompositionDeltaText || '体組成の差分を算出できません。')
    .split('{{weeklyBodyCompositionTrendText}}').join(values.weeklyBodyCompositionTrendText || '直近7日間の体組成記録はありません。')
    .split('{{question}}').join(values.question || '');
}

function sortBodyCompositionRecords(weightHistory) {
  const priority = { night: 3, morning: 2, other: 1 };
  return weightHistory
    .filter(item => Number.isFinite(Number(item.weight)))
    .slice()
    .sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff || (priority[b.measurementType] || 0) - (priority[a.measurementType] || 0);
    });
}

function groupMealEntriesByType(meals) {
  const labels = { morning: '朝食', noon: '昼食', night: '夕食', snack: '間食' };
  const grouped = { morning: [], noon: [], night: [], snack: [] };
  meals.forEach(item => {
    const key = ['morning', 'noon', 'night', 'snack'].includes(item.mealType) ? item.mealType : 'snack';
    grouped[key].push(item);
  });
  return Object.entries(grouped)
    .map(([key, items]) => ({
      mealType: key,
      mealTypeLabel: labels[key],
      items,
      calories: items.reduce((sum, item) => sum + Number(item.nutrition?.calories || 0), 0),
      protein: items.reduce((sum, item) => sum + Number(item.nutrition?.protein || 0), 0),
      fat: items.reduce((sum, item) => sum + Number(item.nutrition?.fat || 0), 0),
      carbohydrates: items.reduce((sum, item) => sum + Number(item.nutrition?.carbohydrates || 0), 0),
    }))
    .filter(group => group.items.length > 0);
}

function formatBodyCompositionValue(value, unit = '') {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return `${value}${unit}`;
  const text = Number.isInteger(num) ? String(num) : num.toFixed(1);
  return `${text}${unit}`;
}

function formatBodyCompositionRecord(record) {
  if (!record) return 'データなし';
  const items = [
    ['日付', record.date || null],
    ['区分', record.measurementType || null],
    ['体重', formatBodyCompositionValue(record.weight, 'kg')],
    ['BMI', formatBodyCompositionValue(record.bmi)],
    ['体脂肪率', formatBodyCompositionValue(record.fatRate, '%')],
    ['筋肉量', formatBodyCompositionValue(record.muscleMass, 'kg')],
    ['基礎代謝', formatBodyCompositionValue(record.bmr, 'kcal')],
    ['体水分率', formatBodyCompositionValue(record.waterRate, '%')],
    ['体脂肪量', formatBodyCompositionValue(record.fatMass, 'kg')],
    ['除脂肪量', formatBodyCompositionValue(record.leanBodyMass, 'kg')],
    ['骨量', formatBodyCompositionValue(record.boneMass, 'kg')],
    ['内臓脂肪', formatBodyCompositionValue(record.visceralFat)],
    ['タンパク質率', formatBodyCompositionValue(record.proteinRate, '%')],
    ['骨格筋量', formatBodyCompositionValue(record.skeletalMuscleMass, 'kg')],
    ['皮下脂肪率', formatBodyCompositionValue(record.subcutaneousFat, '%')],
    ['体年齢', formatBodyCompositionValue(record.bodyAge, '歳')],
    ['体型', record.bodyType || null],
  ].filter(([, value]) => value !== null);
  return items.length
    ? items.map(([label, value]) => `${label}: ${value}`).join(' / ')
    : 'データなし';
}

function formatBodyCompositionDelta(current, previous) {
  if (!current || !previous) return '比較できるデータがありません。';
  const fields = [
    ['体重', 'weight', 'kg'],
    ['BMI', 'bmi', ''],
    ['体脂肪率', 'fatRate', '%'],
    ['筋肉量', 'muscleMass', 'kg'],
    ['基礎代謝', 'bmr', 'kcal'],
    ['体水分率', 'waterRate', '%'],
    ['体脂肪量', 'fatMass', 'kg'],
    ['除脂肪量', 'leanBodyMass', 'kg'],
    ['骨量', 'boneMass', 'kg'],
    ['内臓脂肪', 'visceralFat', ''],
    ['タンパク質率', 'proteinRate', '%'],
    ['骨格筋量', 'skeletalMuscleMass', 'kg'],
    ['皮下脂肪率', 'subcutaneousFat', '%'],
    ['体年齢', 'bodyAge', '歳'],
  ];
  const parts = fields
    .map(([label, key, unit]) => {
      const currentValue = Number(current[key]);
      const previousValue = Number(previous[key]);
      if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return null;
      const diff = currentValue - previousValue;
      const sign = diff > 0 ? '+' : '';
      const formattedDiff = Number.isInteger(diff) ? String(diff) : diff.toFixed(1);
      return `${label}: ${sign}${formattedDiff}${unit}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : '比較できる差分がありません。';
}

function formatBodyCompositionTrend(records, referenceDate = new Date()) {
  if (!Array.isArray(records) || records.length === 0) {
    return '直近7日間の体組成記録はありません。';
  }

  const priority = { night: 3, morning: 2, other: 1 };
  const endDate = new Date(referenceDate);
  const startDate = new Date(referenceDate);
  startDate.setDate(startDate.getDate() - 6);
  const startKey = getJstDateKey(startDate);
  const endKey = getJstDateKey(endDate);

  if (!startKey || !endKey) {
    return '直近7日間の体組成記録はありません。';
  }

  const dailyRecords = new Map();
  records.forEach(record => {
    const dateKey = getJstDateKey(record.date);
    if (!dateKey || dateKey < startKey || dateKey > endKey) return;
    const current = dailyRecords.get(dateKey);
    if (!current || (priority[record.measurementType] || 0) > (priority[current.measurementType] || 0)) {
      dailyRecords.set(dateKey, record);
    }
  });

  const selectedRecords = [...dailyRecords.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([, record]) => record);

  if (selectedRecords.length === 0) {
    return `直近7日間（${startKey}〜${endKey}）の体組成記録はありません。`;
  }

  const formatDateLabel = dateKey => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).format(date);
  };

  const formatSnapshot = record => {
    const items = [
      `体重 ${formatBodyCompositionValue(record.weight, 'kg') || '---'}`,
      `体脂肪率 ${formatBodyCompositionValue(record.fatRate, '%') || '---'}`,
      `筋肉量 ${formatBodyCompositionValue(record.muscleMass, 'kg') || '---'}`,
      `内臓脂肪 ${formatBodyCompositionValue(record.visceralFat) || '---'}`,
    ];
    return items.join(' / ');
  };

  const trendFields = [
    ['体重', 'weight', 'kg'],
    ['体脂肪率', 'fatRate', '%'],
    ['筋肉量', 'muscleMass', 'kg'],
    ['内臓脂肪', 'visceralFat', ''],
    ['体年齢', 'bodyAge', '歳'],
  ];

  const trendParts = [];
  if (selectedRecords.length >= 2) {
    const first = selectedRecords[0];
    const last = selectedRecords[selectedRecords.length - 1];
    trendFields.forEach(([label, key, unit]) => {
      const firstValue = Number(first[key]);
      const lastValue = Number(last[key]);
      if (!Number.isFinite(firstValue) || !Number.isFinite(lastValue)) return;
      const diff = lastValue - firstValue;
      const sign = diff > 0 ? '+' : '';
      const formattedDiff = Number.isInteger(diff) ? String(diff) : diff.toFixed(1);
      trendParts.push(`${label}: ${sign}${formattedDiff}${unit}`);
    });
  }

  const lines = [
    `対象期間: ${formatDateLabel(startKey)}〜${formatDateLabel(endKey)}`,
    ...selectedRecords.map(record => {
      const dateLabel = formatDateLabel(getJstDateKey(record.date));
      const typeLabel = record.measurementType === 'night'
        ? '夜'
        : record.measurementType === 'morning'
          ? '朝'
          : 'その他';
      return `- ${dateLabel} ${typeLabel}: ${formatSnapshot(record)}`;
    }),
  ];

  if (trendParts.length > 0) {
    lines.push(`傾向: ${trendParts.join(' / ')}`);
  } else {
    lines.push('傾向: 比較できる十分な記録がありません。');
  }

  return lines.join('\n');
}

function formatMealGroups(mealGroups) {
  if (!mealGroups || mealGroups.length === 0) return '本日の食事記録はありません。';
  return mealGroups.map(group => {
    const entries = group.items.map(item => {
      const name = item.mealName || item.nutrition?.mealName || item.textInput || '未設定';
      return `- ${name} (${Math.round(Number(item.nutrition?.calories || 0))}kcal / P:${Math.round(Number(item.nutrition?.protein || 0) * 10) / 10}g / F:${Math.round(Number(item.nutrition?.fat || 0) * 10) / 10}g / C:${Math.round(Number(item.nutrition?.carbohydrates || 0) * 10) / 10}g)`;
    }).join('\n');
    return `${group.mealTypeLabel}\n${entries}`;
  }).join('\n\n');
}
app.post('/api/ai-consultation', async (req, res) => {
  try {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question) return res.status(400).json({ error: '質問を入力してください。' });
    if (question.length > 500) return res.status(400).json({ error: '質問は500文字以内で入力してください。' });
    if (!ai) return res.status(500).json({ error: 'Gemini APIキーが設定されていません。' });

    const [history, weights, profile] = await Promise.all([readHistory(), readWeight(), readProfile()]);
    const today = getJstDateKey(new Date());
    const todayMeals = history.filter(item => getJstDateKey(item.mealDate || item.date) === today);
    const totals = todayMeals.reduce((sum, item) => ({
      calories: sum.calories + Number(item.nutrition?.calories || 0),
      protein: sum.protein + Number(item.nutrition?.protein || 0),
      fat: sum.fat + Number(item.nutrition?.fat || 0),
      carbohydrates: sum.carbohydrates + Number(item.nutrition?.carbohydrates || 0),
    }), { calories: 0, protein: 0, fat: 0, carbohydrates: 0 });
    const mealGroups = groupMealEntriesByType(todayMeals);

    const bodyCompositionHistory = sortBodyCompositionRecords(weights);
    const currentBodyComposition = bodyCompositionHistory[0] || null;
    const previousBodyComposition = bodyCompositionHistory[1] || null;
    const weeklyBodyCompositionTrend = formatBodyCompositionTrend(bodyCompositionHistory, new Date());

    const context = {
      date: today,
      currentWeightKg: currentBodyComposition ? Number(currentBodyComposition.weight) : null,
      weightMeasuredAt: currentBodyComposition?.date || null,
      todayNutrition: {
        calories: Math.round(totals.calories),
        proteinG: Math.round(totals.protein * 10) / 10,
        fatG: Math.round(totals.fat * 10) / 10,
        carbohydratesG: Math.round(totals.carbohydrates * 10) / 10,
        recordedEntryCount: todayMeals.length,
        mealTypeCount: mealGroups.length,
      },
      mealGroups,
      targetWeightKg: profile.targetWeight ?? null,
      targetDate: profile.targetDate || null,
      heightCm: profile.height ?? null,
      activityLevel: profile.activityLevel || null,
      activityNotes: profile.activityNotes || null,
      currentBodyComposition,
      previousBodyComposition,
      weeklyBodyCompositionTrend,
      bodyCompositionDelta: currentBodyComposition && previousBodyComposition
        ? {
            weightKg: Number(currentBodyComposition.weight) - Number(previousBodyComposition.weight),
            bmi: Number(currentBodyComposition.bmi) - Number(previousBodyComposition.bmi),
            fatRate: Number(currentBodyComposition.fatRate) - Number(previousBodyComposition.fatRate),
            muscleMassKg: Number(currentBodyComposition.muscleMass) - Number(previousBodyComposition.muscleMass),
            bmrKcal: Number(currentBodyComposition.bmr) - Number(previousBodyComposition.bmr),
            waterRate: Number(currentBodyComposition.waterRate) - Number(previousBodyComposition.waterRate),
            fatMassKg: Number(currentBodyComposition.fatMass) - Number(previousBodyComposition.fatMass),
            leanBodyMassKg: Number(currentBodyComposition.leanBodyMass) - Number(previousBodyComposition.leanBodyMass),
            boneMassKg: Number(currentBodyComposition.boneMass) - Number(previousBodyComposition.boneMass),
            visceralFat: Number(currentBodyComposition.visceralFat) - Number(previousBodyComposition.visceralFat),
            proteinRate: Number(currentBodyComposition.proteinRate) - Number(previousBodyComposition.proteinRate),
            skeletalMuscleMassKg: Number(currentBodyComposition.skeletalMuscleMass) - Number(previousBodyComposition.skeletalMuscleMass),
            subcutaneousFat: Number(currentBodyComposition.subcutaneousFat) - Number(previousBodyComposition.subcutaneousFat),
            bodyAge: Number(currentBodyComposition.bodyAge) - Number(previousBodyComposition.bodyAge),
          }
        : null,
    };

    const consultationPromptTemplate = await readConsultationPromptTemplate();
    const prompt = buildConsultationPrompt(consultationPromptTemplate, {
      contextJson: JSON.stringify(context, null, 2),
      mealGroupsText: formatMealGroups(mealGroups),
      currentBodyCompositionText: formatBodyCompositionRecord(currentBodyComposition),
      previousBodyCompositionText: formatBodyCompositionRecord(previousBodyComposition),
      bodyCompositionDeltaText: formatBodyCompositionDelta(currentBodyComposition, previousBodyComposition),
      weeklyBodyCompositionTrendText: weeklyBodyCompositionTrend,
      question,
    });

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const answer = aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!answer) throw new Error('AIから回答を取得できませんでした。');

    const record = {
      id: `consultation-${Date.now()}`,
      question,
      answer,
      context,
      createdAt: new Date().toISOString(),
    };
    const consultations = await readAiConsultations();
    consultations.push(record);
    await writeAiConsultations(consultations);
    res.json(record);
  } catch (err) {
    console.error('AI consultation error:', err);
    res.status(500).json({ error: 'AI相談の保存中にエラーが発生しました。' + err.message });
  }
});

// 繧ｵ繝ｼ繝舌・襍ｷ蜍募・逅・
(async () => {
  if (drive && folderId) {
    await initDriveProfile();
    await initDriveHistory();
    await initDriveWeight();
    await initDrivePresets();
    await initDriveConsultationPrompt();
    await initDriveAiConsultations();
  }
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
})();




