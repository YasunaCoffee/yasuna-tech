---
title: "WordPressの後継を名乗るEmDashが面白い：プラグインを「信頼する」仕組みが変わった"
date: "2026-04-02"
author: yasuna
emoji: "📝"
category: "気になったニュース"
tags:
  - Cloudflare
  - WordPress
  - CMS
  - セキュリティ
  - 個人開発
  - AIエージェント
draft: false
description: "CloudflareがWordPressの精神的後継CMSとしてEmDashを発表した。プラグインのセキュリティ設計が根本から変わっていて、個人開発者としてかなり気になる。"
---

こんにちは！yasunaです！

Cloudflareが「WordPressの精神的後継」と称するCMS、**EmDash**を発表しました。

TypeScript製、サーバーレス、Astroベース、MIT License。スペックだけ見てもそそられますが、一番面白いのはプラグインのセキュリティ設計です。

発表：[Introducing EmDash — the spiritual successor to WordPress that solves plugin security](https://blog.cloudflare.com/emdash-wordpress?utm_campaign=cf_blog&utm_content=20260401&utm_medium=organic_social&utm_source=twitter/)（Cloudflare Blog, 2026-04-01）

---

# EmDashとは

## WordPressの何が問題なのか

WordPressは現在でもインターネットの40%以上を支えています。でも24年前に設計されたアーキテクチャは、今の環境に合っていない部分が増えています。

最大の問題は**プラグインのセキュリティ**です：

- WordPressのプラグインはPHPスクリプトとして直接WordPressに組み込まれる
- **隔離がない**：プラグインはデータベースにもファイルシステムにも直接アクセスできる
- プラグインをインストールする＝ほぼすべてへのアクセスを信頼する、ということ
- WordPressのセキュリティ問題の96%がプラグイン由来
- 2025年は過去2年を合わせた数より多くの高深刻度の脆弱性が発見された

## EmDashが提案する解決策

EmDashでは各プラグインが**Dynamic Worker**という隔離されたサンドボックスで動きます。

プラグインはマニフェストに「自分が必要とするもの」を明示的に宣言して、その範囲でのみ動作できます。

```typescript
import { definePlugin } from "emdash";

export default () =>
  definePlugin({
    id: "notify-on-publish",
    version: "1.0.0",
    capabilities: ["read:content", "email:send"],
    hooks: {
      "content:afterSave": async (event, ctx) => {
        if (event.collection !== "posts" || event.content.status !== "published") return;

        await ctx.email!.send({
          to: "editors@example.com",
          subject: `New post published: ${event.content.title}`,
          text: `"${event.content.title}" is now live.`,
        });
      },
    },
  });
```

このプラグインができることは宣言した2つだけ：

- `read:content`：コンテンツのライフサイクルフックにアクセスする
- `email:send`：メール送信機能を使う

外部ネットワークアクセスも不可。必要なら接続先のホスト名を明示的に宣言する必要があります。

---

# 気になったポイント

## 「信頼する」から「確認できる」への転換

今のWordPressプラグインの信頼モデルは：

> このプラグインはWordPress.orgでレビューされている→だから信頼する

中央集権的なマーケットプレイスの評判に依存しています。レビューキューは常に800件以上積まれていて、承認まで2週間以上かかる。

EmDashは違います：

> このプラグインはこれとこれしかできないと宣言している→だから自分で判断できる

OAuthのスコープ同意に近い感覚です。「このアプリはカレンダーの読み取りとメール送信の権限を要求しています」と明示されるやつ。

これは**信頼の構造が変わった**ということです。権威への信頼から、検証可能な宣言への信頼へ。

## ライセンスとマーケットプレイスの問題

WordPressプラグインはWordPressのコードと深く絡み合っているため、GPLライセンスを引き継ぐ必要があるという議論があります。これがマーケットプレイス以外での有料販売を難しくしていました。

EmDashのプラグインはEmDashのコードを一切共有せずに独立して動くので、**ライセンスはプラグイン作者が自由に選べます**。

個人開発者として、これはかなり重要な変化だと感じます。

## AIエージェント時代のマネタイズ：x402

面白いのがx402サポートです。

x402はHTTPベースのマイクロペイメント規格。クライアント（エージェント含む）がリクエストを送ると`402 Payment Required`が返ってきて、支払ってアクセスするフロー。

人間ではなくAIエージェントがウェブを閲覧する未来では、広告モデルが機能しなくなります。EmDashはこれへの答えとして、**エンジニアリング不要でコンテンツへの課金設定**ができる仕組みを内包しています。

ウォレットアドレスを設定して、どのコンテンツをいくらで公開するかを決めるだけ。

## AIネイティブな管理：MCP・CLI・Agent Skills

EmDashには最初からMCPサーバーが内蔵されています。

- **Agent Skills**：EmDashのプラグイン構造・フック・テーマ移行方法などをエージェントに渡せる
- **EmDash CLI**：エージェントがローカル・リモートのEmDashを操作できる
- **MCP Server**：Admin UIと同じ操作をMCP経由でエージェントに実行させられる

「コンテンツの一括移行」「カスタムフィールドの変換」「テーマの調整」といった地味で反復的な作業をエージェントに任せられる設計が最初から入っています。

---

# 個人開発者として思うこと

## Astroベースは個人開発フレンドリー

EmDashのテーマはAstroプロジェクトとして作ります。ページ・レイアウト・コンポーネント・CSSをAstroで書いてテーマにする。

このブログはLumeで作っているので直接は関係ないですが、TypeScriptとDeno周りの感覚は共通しています。Astroは別途学ぶ必要がありますが、コンポーネント設計の考え方は近いものがあります。

## サーバーレスで個人運用のコストが変わる

Cloudflare Workersでゼロにスケールできるということは、アクセスがない時間はコストがほぼゼロということです。

個人の小規模サイトを複数運用する場合、WordPress的な「サーバーを常時立てておく」構成と比べてコスト構造が大きく変わります。

## まだv0.1.0

今日時点でv0.1.0プレビューです。プロダクション利用するにはまだ早いですが、設計の方向性が面白いので追いかけていきたいです。

WordPressを使っているサイトからの移行ツールも既に用意されていて（WXRファイルインポート、またはEmDash Exporterプラグイン経由）、実用化への意気込みは感じます。

---

# おわりに

WordPressは24年かけて世界のウェブの土台になりました。その後継を名乗るのは大きな主張ですが、EmDashが提示している変化——プラグインの信頼モデル・サーバーレス・AIネイティブ——は的を射ていると思います。

特にプラグインのセキュリティ設計は「なぜWordPressはずっとこれが問題だったのか」の構造的な答えになっています。権威によるレビューではなく、宣言による検証へ。

個人開発者として、TypeScript＋Cloudflareという技術スタックが身近なこともあって、EmDashの今後は気になっています。

---

# 参考

- Cloudflare Blog: Introducing EmDash: https://blog.cloudflare.com/emdash-wordpress?utm_campaign=cf_blog&utm_content=20260401&utm_medium=organic_social&utm_source=twitter/
- EmDash Playground: https://playground.emdash.io
- GitHub: https://github.com/cloudflare/emdash
