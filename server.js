import express from 'express';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

// JSONパーサーと静的ファイル配信の設定
app.use(express.json());
app.use(express.static('public'));

// データ保存用ディレクトリの初期化 (ローカル用)
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
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

出力JSONには、読み取った/推測した食材リストや計算根拠を箇条書き（改行付き）にした「inference」と、管理栄養士としての優しく丁寧な日本語アドバイス「advice」をそれぞれ分離して出力してください。
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
    const nutritionData = JSON.parse(resultText);

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
      textInput,                       // ユーザー入力の料理名やURLテキスト
      mealName: nutritionData.mealName, // AIが読み取った食事メニュー名
      imageSource,
      imageId,
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
    res.status(500).json({ error: '解析中にエラーが発生しました。: ' + error.message });
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

出力JSONには、読み取った/推測した食材リストや計算根拠を箇条書き（改行付き）にした「inference」と、管理栄養士としての優しく丁寧な日本語アドバイス「advice」をそれぞれ分離して出力してください。
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
    res.status(500).json({ error: '履歴の再分析中にエラーが発生しました。: ' + error.message });
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
      dateKey: d.toDateString(),
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
    const recordDate = new Date(record.mealDate || record.date);
    const recordDateKey = recordDate.toDateString();
    
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

// サーバー起動処理 (非同期初期化後に起動)
(async () => {
  if (drive && folderId) {
    await initDriveHistory();
  }
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
})();
