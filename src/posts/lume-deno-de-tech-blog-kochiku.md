---
title: "DenoとLumeでテックブログを作った記録"
date: "2026-03-24"
author: yasuna
emoji: "📰"
category: "開発記録"
tags:
  - Lume
  - Deno
  - GitHub Pages
  - 静的サイト
  - Cursor
draft: false
---

個人の技術メモを、検索にも載せやすい形で残したいと思い、静的サイトジェネレータでブログを立ち上げました。**きっかけは**、[逆瀬川ちゃんの「このブログをLumeで作った話」](https://nyosegawa.com/posts/hello-lume/)を読んだことです。Deno での初期化、Simple Blog テーマ、GitHub Pages へのデプロイの流れが一文一文で追いやすく、自分でも同じ系統から試せそうだと感じました。実行環境には **Deno**、生成には **Lume**、見た目の土台には **Simple Blog** テーマを使っています。この記事では、フォルダ構成からデプロイ、途中で噛み合わなかった点の直し方まで、再現の手がかりになるように書きます。

## なぜ Lume にしたか

Node.js 前提のツールも候補でしたが、依存の扱いと設定ファイルが TypeScript で書ける点が気に入り、Lume に寄せました。`_config.ts` にプラグインやフィルタを足していく流れが素直で、Markdown とテンプレート（`.vto`）を `src/` に置けばビルドできるところも、小さく始めるには向いていました。

## レポジトリの骨格

記事本体は `src/posts/` の Markdown です。フロントマターでタイトル・日付・タグを書き、ビルドで HTML が `_site/` に出力されます。テーマ側のレイアウトを `src/_includes/` で上書きし、全体のスタイルは `src/zenn.css` で Material Design 3 の色味に少し寄せています。トップでは本文を並べず、記事カードから各記事へ飛ぶ形にしてあり、カード画像は後述のスクリプトで PNG を生成しています。

設定では **`base_path` プラグイン**を有効にしています。GitHub Pages のプロジェクトサイトは URL が `https://ユーザー名.github.io/リポジトリ名/` のように **パスにリポジトリ名が入る**ため、先頭スラッシュだけのリンクだと意図せずルート直下を指してしまいます。Lume の `base_path` で HTML 上の内部リンクを補正し、OG 画像やサムネのパスは `_config.ts` の **`postOgImage`** と **`thumbUrl`** フィルタで、サイトの `location`（環境変数 `SITE_URL`）から組み立てるようにしました。

## OGP とサムネイル

記事ごとの OGP 用画像と一覧用サムネは、`scripts/generate-og.ts` で生成しています。ビルド手順では `deno task og` を先に回し、そのあと Lume のビルド、という順です。フォントは CI 上で CDN の片方が不安定になることがあったため、取得は **jsDelivr を優先し、unpkg にフォールバック**し、必要なら **`scripts/fonts/` に置いた `.woff`** を読むようにして、同じコマンドでも通りやすくしました。

## 記事ページまわりで足したもの

記事レイアウトの本文先頭に、**「この記事はAIエージェントと一緒に執筆しています」** と小さく出す行を置きました。スタイルは `zenn.css` 側で本文より薄い色にしています。またヘッダー付近に **X・Facebook・LINE・はてな・URL コピー** の共有欄をパーシャルで入れ、`_config.ts` に **`encodeURIComponent`** 用のフィルタを足して、共有用のクエリを組み立てています。

## RSS と JSON Feed のリンク

フィードの本文に出てくる記事内リンクだけ、一時的に意図と違う絶対 URL になることがありました。Lume の feed プラグインが本文中の `/posts/...` を直すとき、URL の解決の仕方で **ホスト直下の `/posts/`** になってしまい、リポジトリ名のパスが抜けるケースです。HTML 側は `base_path` で直る一方、フィード用のページは **`beforeSave` で初めて `site.pages` に載る**ため、同じタイミングで **`feed.xml` と `feed.json` の本文だけ**、正しいプレフィックスに置き換える処理を `_config.ts` に追加しました。

## GitHub Actions と Pages

`main` へ push すると GitHub Actions でビルドし、成果物を GitHub Pages に載せる想定です。環境変数 **`SITE_URL`** はワークフローで `github.repository_owner` と `github.event.repository.name` から組み立てているので、リポジトリ名を変えても追従しやすい形にしています。初回は **リポジトリの Settings → Pages で Source を GitHub Actions** にしないと、`deploy-pages` が 404 を返すことがあります。README にもその手順を短く書いておきました。

リポジトリ名は **`yasuna-tech`** に揃え、README・プロフィールの GitHub リンク、`generate-og.ts` の `SITE_URL` 未設定時のデフォルトなども、公開 URL と一致するように更新しました。

## 編集は Cursor の Composer 2 Fast

このブログの追加や直しは、エディタは **Cursor** で進めました。エージェントを使うときは **Composer 2 Fast** を選ぶことが多く、応答が軽くて待ち時間が短いので、設定ファイルの追記や複数ファイルにまたがる修正、ターミナルでのビルド確認まで、会話のテンポが途切れにくかったです。**めちゃくちゃ快適だった**ので、同じように「小さく試しながら積み上げる」作業にはかなり向いていると感じました。

## まとめ

Deno と Lume、Simple Blog を土台に、記事・一覧・検索・フィードまで一通りつなぎ、GitHub Pages 向けのパスや CI の揺らぎにも少しずつ手を入れました。同じように個人ブログを立ち上げる方の、比較表ではなく **一つの実装例**として読んでもらえればうれしいです。設定の細部はリポジトリの `_config.ts` と README を見てもらうのが確実です。
