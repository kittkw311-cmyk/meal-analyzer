import express from 'express';
import { google } from 'googleapis';
import { exec } from 'child_process';
import 'dotenv/config';

// .env から認証情報を取得
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret || clientId.includes('YOUR_') || clientSecret.includes('YOUR_')) {
  console.error('\x1b[31mエラー: .env ファイルに GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を設定してから実行してください。\x1b[0m');
  console.log('\n設定手順:');
  console.log('1. https://console.cloud.google.com/ で「デスクトップ アプリケーション」のOAuthクライアントIDを作成');
  console.log('2. 取得したクライアントIDとクライアントシークレットを .env に貼り付けて保存');
  process.exit(1);
}

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

// OAuth2 クライアントの初期化
const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  REDIRECT_URI
);

const app = express();
let server;

// 認可URLの生成
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // リフレッシュトークンを取得するために必須
  prompt: 'consent',     // 常に同意画面を出してリフレッシュトークンを確実に取得する
  scope: ['https://www.googleapis.com/auth/drive.file']
});

// コールバックを受け取るエンドポイント
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    res.send('認可コードが見つかりませんでした。再度お試しください。');
    return;
  }

  try {
    // 認可コードからトークンを取得
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n\x1b[32m==================================================');
    console.log('🎉 認証に成功しました！');
    console.log('==================================================\x1b[0m\n');
    
    if (tokens.refresh_token) {
      console.log('以下のリフレッシュトークンを .env に設定してください：\n');
      console.log(`\x1b[36mGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\x1b[0m\n`);
    } else {
      console.log('\x1b[33m警告: リフレッシュトークンが発行されませんでした。\x1b[0m');
      console.log('すでに以前このアプリを連携している可能性があります。');
      console.log('Googleアカウントのセキュリティ設定から一度「MealNutri AI」の権限を削除し、再実行してください。\n');
    }
    
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
        <h2 style="color: #4CAF50;">🎉 連携が成功しました！</h2>
        <p>ターミナル（コンソール）に戻って、表示されたリフレッシュトークンを .env にコピーしてください。</p>
        <p style="color: #666; font-size: 13px;">このブラウザタブは閉じて大丈夫です。</p>
      </div>
    `);
  } catch (err) {
    console.error('トークン取得中にエラーが発生しました:', err.message);
    res.send('エラーが発生しました。詳細はターミナルを確認してください。');
  } finally {
    // サーバーを停止してプロセスを終了
    setTimeout(() => {
      server.close(() => {
        console.log('一時サーバーを停止しました。');
        process.exit(0);
      });
    }, 1000);
  }
});

// サーバー起動
server = app.listen(PORT, () => {
  console.log('一時サーバーを起動しました。');
  console.log(`ブラウザが開かない場合は、以下のURLに直接アクセスしてください：\n`);
  console.log(`\x1b[34m${authUrl}\x1b[0m\n`);

  // 自動的にブラウザを開く
  const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${startCmd} "${authUrl.replace(/"/g, '\\"')}"`);
});
