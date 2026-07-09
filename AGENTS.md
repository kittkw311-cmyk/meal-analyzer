# AGENTS.md

## 目的
このリポジトリでは、AI エージェントが食事・体組成分析 Web アプリ `PhysiLog` の保守と改善を安全に進める。

## プロジェクト概要
- Node.js / Express ベースのローカル Web アプリ
- 食事画像・テキストを AI で解析し、栄養情報を保存する
- 体組成データを保存し、統計や履歴を表示する
- Google Drive 連携に対応する
- 総括タブでは指定日の食事と体組成を参照して AI 分析を行う

## 役割
- Planner: 作業の分解、優先順位付け、方針決定
- Backend Agent: `server.js` の API、保存、集計、外部連携担当
- Frontend Agent: `public/` の UI、表示、操作性、クライアントロジック担当
- QA Agent: `localhost:3000` での動作確認、画面確認、回帰確認担当
- Docs Agent: README、AGENTS.md、運用ルール更新担当

## 作業原則
- 1タスク1目的で進める
- 不明点は推測で進めず確認する
- 変更は小さく分ける
- 既存の仕様や命名を勝手に変えない
- 影響範囲が広い変更は先に相談する
- 実装前に既存ロジックを確認する

## 日付ルール
- 表示用日付は `yyyy/mm/dd` に統一する
- 入力欄 `input type="date"` の値は `YYYY-MM-DD` を使う
- 内部保存は ISO 文字列でもよいが、比較や集計では JST を基準にする
- `new Date(...)` だけで日付比較しない
- UTC と JST を混ぜた比較を避ける

## 集計ルール
- 食事集計は JST の日付キーで行う
- 総括 AI 分析では同日の体組成があれば `night` を優先する
- `night` がなければ `morning` を使う
- `morning` もなければ `other` を使う
- 履歴表示と集計値が一致することを優先する

## 変更後の確認
- `node --check server.js`
- `node --check public/app.js`
- 可能なら `localhost:3000` で画面確認する
- 表示文言や日付表記の統一を確認する
- 集計値と履歴の整合性を確認する

## レビュー基準
- 日付ズレがないか
- 最新データの優先順位が正しいか
- 履歴表示と総括表示で数値が一致しているか
- UI 表示の表記ゆれがないか
- 体組成の参照条件が期待どおりか

## 報告ルール
- 実施内容
- 変更ファイル
- 確認結果
- 残課題
- 次に必要な判断
を簡潔に報告する

## エスカレーション条件
- 要件が曖昧で実装方針が複数ある
- 本番影響や破壊的変更がある
- 認証、秘密情報、外部送信を含む
- テスト失敗の原因が不明
- 仕様変更の合意が必要

## 禁止事項
- 勝手に既存機能を削除しない
- 未確認のまま大きな変更を入れない
- 秘密情報をログや差分に出さない
- テスト未実施で完了扱いにしない
- 参照優先順位を暗黙に変えない

## Design Tokens
- Primary: #0f172a（ダークネイビー）
- Accent: #38bdf8（スカイブルー）
- Background: #f8fafc（オフホワイト）
- Text: #1e293b（チャコール）
- Font-family: 'Zen Kaku Gothic New', sans-serif
- Heading-font: 'Outfit', sans-serif
- Base spacing: 8px grid
- Border-radius: 4px（角丸は控えめに）
- Max-width: 412px（コンテンツ幅）

## Design Reference
- UI やビジュアルデザインを変更する前に、必ず `DESIGN-spacex.md` を読み込む
- デザイン実装では `DESIGN-spacex.md` のトークン、コンポーネント、Do's and Don'ts を参照する
- `AGENTS.md` の既存ルールと `DESIGN-spacex.md` が競合する場合は、実装前に確認する

## Design Anti-patterns（禁止）
- ❌ 青→紫のグラデーション背景を使わない
- ❌ Interフォントを使わない
- ❌ 角丸を12px以上にしない
- ❌ shadcn/uiのデフォルトスタイルをそのまま使わない
- ❌ ダミーテキスト（Lorem ipsum）を残さない
- ❌ 影（box-shadow）を多用しない
- ❌ 装飾のないプレーンなボタンを使わない
