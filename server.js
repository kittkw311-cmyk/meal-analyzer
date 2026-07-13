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

// JSONパーサーと静的ファイル配信の設定
app.use(express.json());
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'))) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// データ保存用ディレクトリの初期化 (ローカル用)
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const WEIGHT_FILE = path.join(DATA_DIR, 'weight_history.json');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');
const AI_CONSULTATIONS_FILE = path.join(DATA_DIR, 'ai_consultations.json');
const AI_PROMPT_FILE = path.join(DATA_DIR, 'ai_prompt.txt');

const DEFAULT_CONSULTATION_PROMPT_TEMPLATE = `あなたは食事・体重管理を支援するアドバイザーです。以下の現在状況と目標を必ず考慮し、ユーザーの質問に日本語で簡潔かつ具体的に回答してください。
断定的な医療診断は避け、食べてよいかを聞かれた場合は、可否だけでなく量・タイミング・その後の調整案を示してください。

現在状況(JSON):
{{contextJson}}

食事の扱い:
記録回数は食事回数ではありません。朝食・昼食・夕食・間食の区分ごとに登録されたメニューを、その区分で食べた内容として扱ってください。

現在の体組成:
{{currentBodyCompositionText}}

前回の体組成:
{{previousBodyCompositionText}}

体組成の増減:
{{bodyCompositionDeltaText}}

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

// Multer設定（メモリ上にバッファとして保存）
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB制限
});

// Gemini API初期化
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({ apiKey: geminiApiKey });
  console.log('Gemini API SDK initialized.');
} else {
  console.warn('WARNING: GEMINI_API_KEY is not defined. Gemini analysis will fail.');
}

// Google Drive API初期化
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
// Google Drive 履歴ファイル管理ロジック
// ==========================================================================
let driveHistoryFileId = null;
let driveWeightFileId = null;
let drivePresetsFileId = null;
let driveProfileFileId = null;
let driveAiConsultationsFileId = null;
let driveConsultationPromptFileId = null;

// 体組成ファイルを検索または新規作成してファイルIDを設定する
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

// 体組成データをロードする関数
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

// 体組成データを書き込む関数
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

// 履歴ファイルを検索または新規作成してファイルIDを設定する
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

// 履歴データを非同期でロードする関数
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
      await initDriveHistory(); // 再検索を試みる
      return [];
    }
  } else {
    // ローカルフォールバックモード
    try {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading local history file:', err);
      return [];
    }
  }
}

// 履歴データを非同期で書き込む関数
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
    // ローカルフォールバックモード
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (err) {
      console.error('Error writing local history file:', err);
    }
  }
}

// バッファをReadable Streamに変換するヘルパー
function bufferToStream(buffer) {
  return Readable.from(buffer);
}

// 定番メニューファイルを検索または新規作成してファイルIDを設定する
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

// 定番メニューデータをロードする関数
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

// 定番メニューデータを書き込む関数
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
// API エンドポイント
// ==========================================================================

// 1. 食事画像・テキスト解析＆保存 API
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    const textInput = req.body.textInput || '';
    
    // 画像もテキストもない場合はエラー
    if (!req.file && !textInput.trim()) {
      return res.status(400).json({ error: '画像がアップロードされていないか、または食事内容のテキストが入力されていません。' });
    }

    if (!ai) {
      return res.status(500).json({ error: 'Gemini APIキーが設定されていません。サーバー管理者にお問い合わせください。' });
    }

    // クライアントから送信された食事日時と区分を取得
    const mealDate = req.body.mealDate ? new Date(req.body.mealDate).toISOString() : new Date().toISOString();
    const mealType = req.body.mealType || 'snack';

    console.log(`Analyzing meal input with Gemini 2.5 Flash (${mealDate} - ${mealType})...`);
    
    // プロンプトの設計 (食材・調味料の厳密な推測と計算根拠の明記を強制)
    let promptInstruction = `
入力された食事内容（添付された写真、または料理名・レシピURL・商品URLのテキスト: "${textInput}"）から、使われているすべての食材と調味料を推測した上で、カロリー、たんぱく質（P）、脂質（F）、炭水化物（C）のグラム数を算出してください。

【厳格な計算・推測ガイドライン】
1. 食材の重量が不明な場合は、一般的な1食分の目安量（例：ご飯1膳150g、オートミール1食30g、卵1個50gなど）を想定し、計算の根拠とした想定グラム数を必ず明記してください。
2. 以下の食材は指定がない場合も一般的なものを仮定して明記し、厳密に区別して計算してください。
   - 肉類：鶏むね肉の「皮あり・皮なし」、部位（もも肉、ささみなど）を判断・仮定し明記。
   - 大豆製品：豆腐の「木綿・絹ごし」などの種類を判断・仮定し明記。
3. 調味料と調理法による「隠れカロリー（特に脂質）」を漏れなく推測・計算に含めてください。
   - マヨネーズ、ごまドレッシング、焼肉のたれ、調理油などの高脂質・高カロリーな調味料の使用量を推測（大さじ・小さじ等）して加算してください。
   - 逆に、ポン酢やレモン汁、塩などの低カロリー調味料も正確に反映させてください。
   - 調理法（揚げる、炒める、蒸す、ゆでるなど）による油の吸収量（吸油率）も考慮して加算してください。

【出力形式の指定】
「inference」には、読み取った/推測した食材リストや計算根拠を、コロン（:）の位置が縦に綺麗に揃うよう、スペースで桁合わせしたテキスト（改行入り）で出力してください。日本語の全角文字は半角スペース2文字分として計算し、コロンの位置を完全に揃えてください。

（記述例）
・[食材・料理名]
  - カロリー  : 000 kcal (想定グラム数などの根拠)
  - タンパク質: 00.0 g
  - 脂質      : 00.0 g
  - 炭水化物  : 00.0 g

「advice」には、管理栄養士としての優しく丁寧な日本語アドバイス（箇条書きは使わず、自然な文章で適度に改行を入れたもの）を分離して出力してください。
`;

    // contents 配列の組み立て
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

    // Gemini 2.5 Flash で解析（構造化JSON出力）
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
              mealName: { type: Type.STRING, description: '解析結果から読み取った食事内容や代表的なメニュー名、料理名（例：ジューシー若鶏グリル、レモン風味プロテイン、パンケーキとフルーツなど）。最大25文字程度。' },
              calories: { type: Type.INTEGER, description: 'カロリー (kcal)' },
              protein: { type: Type.NUMBER, description: 'タンパク質 (g)' },
              fat: { type: Type.NUMBER, description: '脂質 (g)' },
              carbohydrates: { type: Type.NUMBER, description: '炭水化物 (g)' },
              inference: { type: Type.STRING, description: '食材・調味料の推測リストおよび想定グラム数、計算根拠（改行を含む丁寧な箇条書き）' },
              advice: { type: Type.STRING, description: '管理栄養士風の優しく丁寧な日本語による食事アドバイス・提案（箇条書きは使わず、自然な文章で改行を適度に入れたもの）' }
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
        mealName: textInput.trim() ? textInput.trim().substring(0, 25) : '食事データ (未解析)',
        calories: 0,
        protein: 0,
        fat: 0,
        carbohydrates: 0,
        inference: `【AI解析未完了】\n解析中にエラーが発生しました。\n詳細: ${analysisErrorMsg}\n\n「再計算」ボタンを押して再試行してください。`,
        advice: 'AI解析に失敗したため、アドバイスを生成できませんでした。詳細画面の「再計算」から再度解析を行ってください。'
      };
    }

    // 画像の保存処理 (画像が提供されている場合のみ)
    let imageSource = '';
    let imageId = '';

    if (req.file) {
      imageSource = 'local';
      // ファイル名の設計: meal_YYYY-MM-DD_mealType_timestamp.jpg
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
          // ドライブ保存失敗時はローカル保存へフォールバック
          imageSource = 'local';
          const localPath = path.join(UPLOADS_DIR, filename);
          fs.writeFileSync(localPath, req.file.buffer);
          imageId = filename;
        }
      } else {
        // ローカルのみ保存
        const localPath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(localPath, req.file.buffer);
        imageId = filename;
        console.log('Saved image locally:', filename);
      }
    }

    // 履歴データへの登録
    const newRecord = {
      id: `rec_${Date.now()}`,
      date: new Date().toISOString(), // システム登録日時
      mealDate,                        // ユーザー指定の食事日
      mealType,                        // ユーザー指定の食事区分
      textInput,                       // ユーザー入力 of 料理名やURLテキスト
      mealName: nutritionData.mealName, // AIが読み取った食事メニュー名
      imageSource,
      imageId,
      status: isFailed ? 'failed' : 'success', // ステータスを追加！
      nutrition: {
        calories: Number(nutritionData.calories),
        protein: Number(nutritionData.protein),
        fat: Number(nutritionData.fat),
        carbohydrates: Number(nutritionData.carbohydrates),
        comment: nutritionData.advice, // 既存データとの互換性のために残す
        inference: nutritionData.inference,
        advice: nutritionData.advice
      }
    };

    const history = await readHistory();
    history.unshift(newRecord); // 先頭に追加（最新が上）
    await writeHistory(history);

    res.json(newRecord);

  } catch (error) {
    console.error('Analysis error:', error);
    const statusCode = error.status || error.statusCode || 500;
    res.status(statusCode).json({ error: '解析中にエラーが発生しました。: ' + error.message, status: statusCode });
  }
});

// 履歴編集 API (日付・食事区分の更新)
app.put('/api/history/:id', async (req, res) => {
  const { id } = req.params;
  const { mealDate, mealType, textInput } = req.body;
  try {
    const history = await readHistory();
    const recordIndex = history.findIndex(r => r.id === id);

    if (recordIndex === -1) {
      return res.status(404).json({ error: '指定された履歴が見つかりません。' });
    }

    // mealDate と mealType と textInput を更新
    if (mealDate) history[recordIndex].mealDate = mealDate;
    if (mealType) history[recordIndex].mealType = mealType;
    if (textInput !== undefined) history[recordIndex].textInput = textInput;

    await writeHistory(history);
    res.json(history[recordIndex]);

  } catch (error) {
    console.error('Update history error:', error);
    res.status(500).json({ error: '履歴の更新中にエラーが発生しました。: ' + error.message });
  }
});

// 履歴再分析 API (修正テキスト入力と元画像を用いた再計算)
app.post('/api/history/:id/reanalyze', async (req, res) => {
  const { id } = req.params;
  const { textInput, mealDate, mealType } = req.body;

  try {
    const history = await readHistory();
    const recordIndex = history.findIndex(r => r.id === id);

    if (recordIndex === -1) {
      return res.status(404).json({ error: '指定された履歴が見つかりません。' });
    }

    const record = history[recordIndex];

    if (!ai) {
      return res.status(500).json({ error: 'Gemini APIキーが設定されていません。' });
    }

    console.log(`Reanalyzing meal history ${id} with Gemini...`);

    // プロンプトの設計 (食材・調味料の厳密な推測と計算根拠の明記を強制)
    let promptInstruction = `
入力された食事内容（添付された写真、または料理名・レシピURL・商品URL of テキスト: "${textInput || ''}"）から、使われているすべての食材と調味料を推測した上で、カロリー、たんぱく質（P）、脂質（F）、炭水化物（C）のグラム数を算出してください。

【厳格な計算・推測ガイドライン】
1. 食材の重量が不明な場合は、一般的な1食分の目安量（例：ご飯1膳150g、オートミール1食30g、卵1個50gなど）を想定し、計算の根拠とした想定グラム数を必ず明記してください。
2. 以下の食材は指定がない場合も一般的なものを仮定して明記し、厳密に区別して計算してください。
   - 肉類：鶏むね肉の「皮あり・皮なし」、部位（もも肉、ささみなど）を判断・仮定し明記。
   - 大豆製品：豆腐の「木綿・絹ごし」などの種類を判断・仮定し明記。
3. 調味料と調理法による「隠れカロリー（特に脂質）」を漏れなく推測・計算に含めてください。
   - マヨネーズ、ごまドレッシング、焼肉のたれ、調理油などの高脂質・高カロリーな調味料の使用量を推測（大さじ・小さじ等）して加算してください。
   - 逆に、ポン酢やレモン汁、塩などの低カロリー調味料も正確に反映させてください。
   - 調理法（揚げる、炒める、蒸す、ゆでるなど）による油の吸収量（吸油率）も考慮して加算してください。

【出力形式の指定】
「inference」には、読み取った/推測した食材リストや計算根拠を、コロン（:）の位置が縦に綺麗に揃うよう、スペースで桁合わせしたテキスト（改行入り）で出力してください。日本語の全角文字は半角スペース2文字分として計算し、コロンの位置を完全に揃えてください。

（記述例）
・[食材・料理名]
  - カロリー  : 000 kcal (想定グラム数などの根拠)
  - タンパク質: 00.0 g
  - 脂質      : 00.0 g
  - 炭水化物  : 00.0 g

「advice」には、管理栄養士としての優しく丁寧な日本語アドバイス（箇条書きは使わず、自然な文章で適度に改行を入れたもの）を分離して出力してください。
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
        // ローカル
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

    // Gemini 2.5 Flash で解析（構造化JSON出力）
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mealName: { type: Type.STRING, description: '解析結果から読み取った食事内容や代表的なメニュー名、料理名（例：ジューシー若鶏グリル、レモン風味プロテイン、パンケーキとフルーツなど）。最大25文字程度。' },
            calories: { type: Type.INTEGER, description: 'カロリー (kcal)' },
            protein: { type: Type.NUMBER, description: 'タンパク質 (g)' },
            fat: { type: Type.NUMBER, description: '脂質 (g)' },
            carbohydrates: { type: Type.NUMBER, description: '炭水化物 (g)' },
            inference: { type: Type.STRING, description: '食材・調味料の推測リストおよび想定グラム数、計算根拠（改行を含む丁寧な箇条書き）' },
            advice: { type: Type.STRING, description: '管理栄養士風の優しく丁寧な日本語による食事アドバイス・提案（箇条書きは使わず、自然な文章で改行を適度に入れたもの）' }
          },
          required: ['mealName', 'calories', 'protein', 'fat', 'carbohydrates', 'inference', 'advice']
        }
      }
    });

    const resultText = response.text;
    console.log('Gemini reanalyze raw response:', resultText);
    const nutritionData = JSON.parse(resultText);

    // レコードの上書き更新
    record.mealDate = mealDate || record.mealDate;
    record.mealType = mealType || record.mealType;
    record.textInput = textInput !== undefined ? textInput : record.textInput;
    record.mealName = nutritionData.mealName;
    record.status = 'success'; // ステータスをsuccessに更新！
    record.nutrition = {
      calories: Number(nutritionData.calories),
      protein: Number(nutritionData.protein),
      fat: Number(nutritionData.fat),
      carbohydrates: Number(nutritionData.carbohydrates),
      comment: nutritionData.advice, // 既存データとの互換性のために残す
      inference: nutritionData.inference,
      advice: nutritionData.advice
    };

    history[recordIndex] = record;
    await writeHistory(history);

    res.json(record);

  } catch (error) {
    console.error('Reanalyze history error:', error);
    const statusCode = error.status || error.statusCode || 500;
    res.status(statusCode).json({ error: '履歴の再分析中にエラーが発生しました。: ' + error.message, status: statusCode });
  }
});

// ==========================================================================
// 定番メニュー (Presets) API エンドポイント
// ==========================================================================

// 1. 定番メニュー一覧取得 API
app.get('/api/profile', async (req, res) => {
  try {
    res.json(await readProfile());
  } catch (err) {
    console.error('Profile read error:', err);
    res.status(500).json({ error: 'プロフィールの読み込み中にエラーが発生しました。: ' + err.message });
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
    res.status(500).json({ error: 'プロフィールの更新中にエラーが発生しました。: ' + err.message });
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

// 2. 定番メニュー手動登録 API
app.post('/api/presets', async (req, res) => {
  try {
    const { name, calories, protein, fat, carbohydrates, baseAmount, servingUnit, imageSource, imageId } = req.body;
    if (!name || calories === undefined || protein === undefined || fat === undefined || carbohydrates === undefined) {
      return res.status(400).json({ error: '必須項目が不足しています。' });
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
    res.status(500).json({ error: '定番メニューの登録に失敗しました。' });
  }
});

// 3. 定番メニュー AI 解析 ＆ 登録 API
app.post('/api/presets/analyze', upload.single('image'), async (req, res) => {
  try {
    const textInput = req.body.textInput || '';
    
    if (!req.file && !textInput.trim()) {
      return res.status(400).json({ error: '画像がアップロードされていないか、または食事内容のテキストが入力されていません。' });
    }

    if (!ai) {
      return res.status(500).json({ error: 'Gemini APIキーが設定されていません。' });
    }

    console.log('AI analyzing for predefined menu preset...');
    
    let promptInstruction = `
入力された食事内容（添付された写真、または料理名・レシピ等のテキスト: "${textInput}"）から、使われているすべての食材と調味料を推測した上で、カロリー、たんぱく質（P）、脂質（F）、炭水化物（C）のグラム数を算出してください。
解析結果から、代表的なメニュー名、料理名（例：ジューシー若鶏グリル、レモン風味プロテイン、パンケーキとフルーツなど）を簡潔に抽出してください。
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
            mealName: { type: Type.STRING, description: '解析結果から読み取った食事内容や代表的なメニュー名、料理名。最大20文字程度。' },
            calories: { type: Type.INTEGER, description: 'カロリー (kcal)' },
            protein: { type: Type.NUMBER, description: 'タンパク質 (g)' },
            fat: { type: Type.NUMBER, description: '脂質 (g)' },
            carbohydrates: { type: Type.NUMBER, description: '炭水化物 (g)' }
          },
          required: ['mealName', 'calories', 'protein', 'fat', 'carbohydrates']
        }
      }
    });

    const resultText = response.text;
    console.log('Gemini preset raw response:', resultText);
    const nutritionData = JSON.parse(resultText);

    // 画像の保存処理 (画像が提供されている場合のみ)
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

    // 定番メニューとして保存
    const presets = await readPresets();
    
    // ユーザー指定の名前があれば優先、無ければ AI が推測した名前を使用
    const presetName = textInput.trim() ? textInput.trim().substring(0, 25) : nutritionData.mealName;

    const newPreset = {
      id: `preset_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: presetName || '定番メニュー',
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
    res.status(statusCode).json({ error: 'AIによる定番登録中にエラーが発生しました。: ' + error.message, status: statusCode });
  }
});

// 4. 定番メニュー削除 API
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

// 4.5. 定番メニュー部分更新（名前のみ） API
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
      return res.status(404).json({ error: '指定された定番メニューが見つかりません。' });
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

// 5. 定番メニューからの食事履歴登録 API
app.post('/api/history/preset', upload.single('image'), async (req, res) => {
  try {
    const { name, calories, protein, fat, carbohydrates, mealDate, mealType, presetId, servingAmount, baseServingAmount, servingUnit } = req.body;
    if (!name || calories === undefined || protein === undefined || fat === undefined || carbohydrates === undefined) {
      return res.status(400).json({ error: '食事データの作成に失敗しました。値が正しくありません。' });
    }
    
    // 画像の保存処理 (画像が提供されている場合のみ)
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
      // ファイル名の設計: meal_preset_YYYY-MM-DD_mealType_timestamp.jpg
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
      // 今回新しい画像がアップロードされていない場合、定番マスタから登録済みの画像を引き継ぐ
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
        carbohydrates: calculatedCarbohydrates,
        inference: `定番メニュー: ${name}\n\n・登録済みの情報から直接追加しました。\n  - カロリー  : ${calories} kcal\n  - タンパク質: ${protein} g\n  - 脂質      : ${fat} g\n  - 炭水化物  : ${carbohydrates} g`,
        comment: '事前登録された定番メニューから登録されました。'
      }
    };
    
    // 通常の解析履歴登録と同様に unshift で先頭（最新）に配置
    newRecord.nutrition.inference = `定番メニュー: ${name}\n\n・登録済みの情報から量に応じて追加しました。\n  - 基準量: ${normalizedBaseAmount.toFixed(1)} ${normalizedServingUnit}\n  - 今回量: ${normalizedServingAmount.toFixed(1)} ${normalizedServingUnit}\n  - カロリー  : ${calculatedCalories} kcal\n  - タンパク質: ${calculatedProtein} g\n  - 脂質      : ${calculatedFat} g\n  - 炭水化物  : ${calculatedCarbohydrates} g`;
    history.unshift(newRecord);
    await writeHistory(history);
    res.status(201).json(newRecord);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '食事履歴への登録に失敗しました。' });
  }
});

// 2. 履歴取得 API
app.get('/api/history', async (req, res) => {
  const history = await readHistory();
  res.json(history);
});

// 3. 統計データ取得 API
app.get('/api/stats', async (req, res) => {
  const history = await readHistory();
  
  // 直近7日間のデータを集計 (ユーザーが指定した食事日 mealDate または登録日 date を基準とする)
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
    // ユーザー指定の食事日を優先
    const recordDateKey = getJstDateKey(record.mealDate || record.date);
    
    // 直近7日間のカロリー集計
    const dayObj = last7Days.find(day => day.dateKey === recordDateKey);
    if (dayObj) {
      dayObj.calories += record.nutrition.calories;
      dayObj.count += 1;
    }

    // 全期間の平均PFC計算用
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

// 4. 画像プロキシ API (Googleドライブ/ローカル両対応)
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
    // ローカルモード
    const filePath = path.join(UPLOADS_DIR, id);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'image/jpeg';
      if (ext === '.png') contentType = 'image/png';
      if (ext === '.gif') contentType = 'image/gif';
      if (ext === '.webp') contentType = 'image/webp';
      
      res.setHeader('Content-Type', contentType);
      res.sendFile(filePath);
    } else {
      res.status(404).send('Image not found locally');
    }
  }
});

// 5. 履歴削除 API
app.delete('/api/history/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const history = await readHistory();
    const recordIndex = history.findIndex(r => r.id === id);

    if (recordIndex === -1) {
      return res.status(404).json({ error: '指定された履歴が見つかりません。' });
    }

    const record = history[recordIndex];

    // 画像ファイルの物理削除
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

    // 履歴レコードの削除
    history.splice(recordIndex, 1);
    await writeHistory(history);

    res.json({ message: '履歴を正常に削除しました。' });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: '履歴の削除中にエラーが発生しました。: ' + error.message });
  }
});

// ==========================================================================
// 体組成データ (体重・体脂肪・筋肉量) 管理 API
// ==========================================================================

// 1. 体組成の履歴取得
app.get('/api/body-composition', async (req, res) => {
  try {
    const weightHistory = await readWeight();
    // 日付 (YYYY-MM-DD) の降順、および区分の降順 (夜 -> 朝 -> 他) でソート
    const priority = { night: 3, morning: 2, other: 1 };
    weightHistory.sort((a, b) => {
      const dateA = getJstDateKey(a.date);
      const dateB = getJstDateKey(b.date);
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // 日付降順
      }
      const pA = priority[a.measurementType] || 0;
      const pB = priority[b.measurementType] || 0;
      return pB - pA; // 区分降順 (夜 -> 朝 -> 他)
    });
    res.json(weightHistory);
  } catch (err) {
    console.error('Failed to load weight history:', err);
    res.status(500).json({ error: '体組成履歴の読み込みに失敗しました。' });
  }
});

// 2. 体組成の画像(OCR)・テキスト解析
app.post('/api/body-composition/analyze', upload.single('image'), async (req, res) => {
  try {
    const textInput = req.body.textInput || '';
    
    if (!req.file && !textInput.trim()) {
      return res.status(400).json({ error: '画像がアップロードされていないか、またはテキストが入力されていません。' });
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
アップロードされた体組成計（体重計）の画面画像（OCR）、または貼り付けられたテキスト（"${textInput}"）を読み取り、以下の16個の測定指標の数値を正確に抽出してください。

【抽出する項目】
1. 体重 (weight) - kg単位
2. BMI (bmi)
3. 体脂肪率 (fatRate) - %単位
4. 心拍数 (heartRate) - bpm単位
5. 筋肉量 (muscleMass) - kg単位
6. 基礎代謝量 (bmr) - kcal単位
7. 水分量 (waterRate) - %単位
8. 体脂肪量 (fatMass) - kg単位
9. 除脂肪体重 (leanBodyMass) - kg単位
10. 骨量 (boneMass) - kg単位
11. 内臓脂肪レベル (visceralFat) - 数値（例: 12.0）
12. タンパク質 (proteinRate) - %単位
13. 骨格筋量 (skeletalMuscleMass) - kg単位
14. 皮下脂肪 (subcutaneousFat) - %単位
15. 体内年齢 (bodyAge) - 整数（歳）
16. ボディタイプ (bodyType) - 文字列（例: "標準的"、"マッスル"など。液晶の表示または説明テキストから抽出）

また、画像やテキストから計測された年月日や時刻が読み取れる場合は「計測日時(measuredAt)」を形式「YYYY-MM-DDTHH:MM:SS」で抽出してください。読み取れない場合、日時は本日 ${todayStr} の現在時刻 ${timeStr} 付近として推計してください。

【注意事項】
- どうしても画像やテキストから読み取れない項目がある場合は、その項目を null としてください。
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
            weight: { type: Type.NUMBER, description: "体重 (kg)。不明ならnull" },
            bmi: { type: Type.NUMBER, description: "BMI。不明ならnull" },
            fatRate: { type: Type.NUMBER, description: "体脂肪率 (%)。不明ならnull" },
            heartRate: { type: Type.INTEGER, description: "心拍数 (bpm)。不明ならnull" },
            muscleMass: { type: Type.NUMBER, description: "筋肉量 (kg)。不明ならnull" },
            bmr: { type: Type.INTEGER, description: "基礎代謝量 (kcal)。不明ならnull" },
            waterRate: { type: Type.NUMBER, description: "水分量 (%)。不明ならnull" },
            fatMass: { type: Type.NUMBER, description: "体脂肪量 (kg)。不明ならnull" },
            leanBodyMass: { type: Type.NUMBER, description: "除脂肪体重 (kg)。不明ならnull" },
            boneMass: { type: Type.NUMBER, description: "骨量 (kg)。不明ならnull" },
            visceralFat: { type: Type.NUMBER, description: "内臓脂肪。不明ならnull" },
            proteinRate: { type: Type.NUMBER, description: "タンパク質 (%)。不明ならnull" },
            skeletalMuscleMass: { type: Type.NUMBER, description: "骨格筋量 (kg)。不明ならnull" },
            subcutaneousFat: { type: Type.NUMBER, description: "皮下脂肪 (%)。不明ならnull" },
            bodyAge: { type: Type.INTEGER, description: "体内年齢。不明ならnull" },
            bodyType: { type: Type.STRING, description: "ボディタイプ。不明ならnull" },
            measuredAt: { type: Type.STRING, description: "計測日時。形式は YYYY-MM-DDTHH:MM:SS" }
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
    res.status(statusCode).json({ error: '体組成データの解析中にエラーが発生しました。: ' + error.message, status: statusCode });
  }
});

// 3. 体組成データの保存
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
    
    // 日時と区分
    // 日付と区分
    const date = req.body.date || new Date().toISOString().substring(0, 10);
    const measurementType = req.body.measurementType || 'other'; // morning, night, other
    const textInput = req.body.textInput || '';
    
    // 体組成画像は読み取り完了後は保存しない (imageIdは常にnull)
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
    res.status(500).json({ error: '体組成データの保存中にエラーが発生しました。: ' + err.message });
  }
});

// 4. 体組成データの削除
app.delete('/api/body-composition/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const weightHistory = await readWeight();
    const recordIndex = weightHistory.findIndex(item => item.id === id);
    
    if (recordIndex === -1) {
      return res.status(404).json({ error: '対象の体組成データが見つかりません。' });
    }
    
    const record = weightHistory[recordIndex];
    
    // 画像がある場合は削除
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
    
    res.json({ message: '体組成データを正常に削除しました。' });
  } catch (err) {
    console.error('Delete weight error:', err);
    res.status(500).json({ error: '体組成データの削除中にエラーが発生しました。: ' + err.message });
  }
});

// 5. 体組成データの更新
async function updateBodyCompositionRecord(req, res) {
  try {
    const id = req.params.id;
    const weightHistory = await readWeight();
    const index = weightHistory.findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: '更新対象の体組成データが見つかりません。' });
    }

    // 値の更新 (req.body が存在すれば更新、なければ既存値を維持)
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
    res.status(500).json({ error: '体組成データの更新中にエラーが発生しました。: ' + err.message });
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
    .split('{{mealGroupsText}}').join(values.mealGroupsText || '（本日の食事記録なし）')
    .split('{{currentBodyCompositionText}}').join(values.currentBodyCompositionText || '（データなし）')
    .split('{{previousBodyCompositionText}}').join(values.previousBodyCompositionText || '（データなし）')
    .split('{{bodyCompositionDeltaText}}').join(values.bodyCompositionDeltaText || '（比較対象なし）')
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
  if (!record) return '（データなし）';
  const items = [
    ['日時', record.date || null],
    ['区分', record.measurementType || null],
    ['体重', formatBodyCompositionValue(record.weight, 'kg')],
    ['BMI', formatBodyCompositionValue(record.bmi)],
    ['体脂肪率', formatBodyCompositionValue(record.fatRate, '%')],
    ['筋肉量', formatBodyCompositionValue(record.muscleMass, 'kg')],
    ['基礎代謝', formatBodyCompositionValue(record.bmr, 'kcal')],
    ['水分量', formatBodyCompositionValue(record.waterRate, '%')],
    ['体脂肪量', formatBodyCompositionValue(record.fatMass, 'kg')],
    ['除脂肪体重', formatBodyCompositionValue(record.leanBodyMass, 'kg')],
    ['骨量', formatBodyCompositionValue(record.boneMass, 'kg')],
    ['内臓脂肪', formatBodyCompositionValue(record.visceralFat)],
    ['タンパク質', formatBodyCompositionValue(record.proteinRate, '%')],
    ['骨格筋量', formatBodyCompositionValue(record.skeletalMuscleMass, 'kg')],
    ['皮下脂肪', formatBodyCompositionValue(record.subcutaneousFat, '%')],
    ['体内年齢', formatBodyCompositionValue(record.bodyAge, '歳')],
    ['ボディタイプ', record.bodyType || null],
  ].filter(([, value]) => value !== null);
  return items.length
    ? items.map(([label, value]) => `${label}: ${value}`).join(' / ')
    : '（データなし）';
}

function formatBodyCompositionDelta(current, previous) {
  if (!current || !previous) return '（比較対象なし）';
  const fields = [
    ['体重', 'weight', 'kg'],
    ['BMI', 'bmi', ''],
    ['体脂肪率', 'fatRate', '%'],
    ['筋肉量', 'muscleMass', 'kg'],
    ['基礎代謝', 'bmr', 'kcal'],
    ['水分量', 'waterRate', '%'],
    ['体脂肪量', 'fatMass', 'kg'],
    ['除脂肪体重', 'leanBodyMass', 'kg'],
    ['骨量', 'boneMass', 'kg'],
    ['内臓脂肪', 'visceralFat', ''],
    ['タンパク質', 'proteinRate', '%'],
    ['骨格筋量', 'skeletalMuscleMass', 'kg'],
    ['皮下脂肪', 'subcutaneousFat', '%'],
    ['体内年齢', 'bodyAge', '歳'],
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
  return parts.length ? parts.join(' / ') : '（数値比較なし）';
}

function formatMealGroups(mealGroups) {
  if (!mealGroups || mealGroups.length === 0) return '（本日の食事記録なし）';
  return mealGroups.map(group => {
    const entries = group.items.map(item => {
      const name = item.mealName || item.nutrition?.mealName || item.textInput || '不明';
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
    if (!ai) return res.status(500).json({ error: 'Gemini APIが初期化されていません。' });

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
    res.status(500).json({ error: 'AIへの問い合わせ中にエラーが発生しました。: ' + err.message });
  }
});

// サーバー起動処理
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
