---
title: "AWS Lambda Web Functionsが出た：Honoのサーバーをそのまま置けて、待ち時間にCPU課金がかかりにくい"
date: "2026-10-14"
author: yasuna
emoji: "⚡"
category: "気になったニュース"
tags:
  - AWS
  - Lambda
  - サーバーレス
  - Node.js
  - 個人開発
draft: false
description: "AWS Lambda に、ポートで待ち受ける普通の HTTP サーバーをそのまま載せられる Web Functions が出た。1つの実行環境で最大128リクエストを同時にさばき、DB や API を待っている時間には CPU の課金がほとんどかからない。発表記事を読んで、気になったところと Cloudflare Workers とのちがいをまとめた。"
---

# はじめに

AWS が **Lambda Web Functions** を発表しました。

```linkcard
https://aws.amazon.com/jp/blogs/aws/announcing-aws-lambda-web-functions-for-fast-consistent-web-app-performance-anywhere/
```

結論、**Express や Hono で書いた「ポートで待ち受ける普通のサーバー」を、書き換えずに Lambda に載せられる**ようになった、という発表です。

Lambda というと「イベントを受け取る関数（handler）を書くもの」で、Web アプリを載せるならアダプターをかませるのが定番でした。今回はそこが要らなくなります。

わたしはまだ触っていないので、この記事は発表記事を読んで気になったところのメモです。

# Lambda が3種類になった

今回の発表で、Lambda は3つの形に分かれました。どれも同じ Firecracker の隔離の上で動いていて、書き方（プログラミングモデル）が違います。

| 形 | 書き方 | 課金 | 向いているもの |
|---|---|---|---|
| **Event Functions** | イベントを受け取って返す。1環境で1リクエスト | 実行時間（wall-clock） | キューの処理、ほかの AWS サービスからの呼び出し |
| **Web Functions**（新） | ポートで HTTP を待ち受ける。1環境で同時に複数 | CPU を使った時間（active CPU） | Web アプリ、API、SSR |
| **MicroVMs** | 状態を持つサンドボックス。寿命は自分で管理 | — | ユーザーが書いたコードなど、信頼できないコードの実行 |

**Event Functions** は、いままで「Lambda 関数」と呼んでいたものです。書き方を区別するために名前が付きました。

3つは組み合わせて使う前提で、たとえば「裏の非同期処理は Event Functions、ユーザーが触る API と SSR は Web Functions、コード実行の機能は MicroVMs」のように、同じアカウントの中で使い分けられるそうです。

# どこがうれしいのか

## その１：コードを書き換えなくていい

発表記事の例は、ふつうの Express です。

```js
import express from 'express';

const app = express();
const [host, port] = process.env.AWS_LAMBDA_HTTP_ENDPOINT.split(':');

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Lambda Web Functions!' });
});

app.listen(port, host, () => {
  console.log(`Server running on port ${port}`);
});
```

手元で `node index.js` で動かすのと同じコードです。違うのは、待ち受けるホストとポートを `AWS_LAMBDA_HTTP_ENDPOINT` という環境変数から読むところだけ。手元では `AWS_LAMBDA_HTTP_ENDPOINT=127.0.0.1:3000 node index.js` のように自分で入れて動かせます。

Express のほかに、Hono、Fastify、Next.js など Node.js のフレームワークならなんでも載るそうです。

わたしは Hono をよく使うので、Hono ならこう書けそうです（発表記事の例ではなく、まだ動かしていないので参考程度に）。

```js
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();
const [hostname, port] = process.env.AWS_LAMBDA_HTTP_ENDPOINT.split(':');

app.get('/', (c) => c.json({ message: 'Hello from Lambda Web Functions!' }));

serve({ fetch: app.fetch, hostname, port: Number(port) });
```

Hono は Cloudflare Workers でもそのまま動くので、**同じアプリを Cloudflare と Lambda の両方に置ける**のがうれしいところです。

## その２：待っている時間に CPU の課金がかかりにくい

個人的にいちばん気になったのはここです。

- 1つの実行環境で、**最大128リクエストを同時に**さばく
- 課金は **CPU を実際に使った時間**で測る
- データベースの返事や API の返事を待っている時間は、CPU をほとんど使わない
- ただしメモリは、実行環境がある間ずっと課金される

いままでの Lambda は、関数が動いている時間（待ち時間も含む）で課金されていました。Web アプリはだいたい「DB を待つ」「外部 API を待つ」が中心なので、**待ち時間に払っていた分が減る**ということですね。

発表記事でも、SSR や API のバックエンドに並んで、**AI の推論結果をトークンごとにストリーミングで返すエンドポイント**が例に挙がっていました。

これは AITuber のバックエンドにかなり近い形です。LLM の API に投げて、返事がちょっとずつ流れてくるのを待って、それを配信側に流す。処理の大半は「待っている時間」なので、active CPU 課金と相性がよさそうです。

## その３：デプロイが1コマンド

```bash
aws lambda-web deploy --name my-web-app --code ./my-app
```

これだけで、ソースをまとめて Web Function を作り、最初のリビジョンを出して、HTTPS の URL まで返してくれるそうです。発表記事では1分かからなかったとのこと。

同じコマンドをもう一度流せば、新しいリビジョンが上がって URL がそちらを向きます。

複数リージョンに出すのも、`--regions` を足すだけです。

```bash
aws lambda-web deploy --name my-web-app --code ./my-app \
    --regions us-east-1,eu-west-1,ap-northeast-1
```

3つのリージョンにコードが複製されて、**1つのグローバル URL** から、呼んだ人にいちばん近いリージョンへ振り分けてくれます（できるかぎり、という扱いです）。

## その４：カナリアリリースが API 1回

リビジョンごとに流す割合を決められます。

```bash
aws lambda-web update-web-function-endpoint \
    --function-name my-web-app \
    --endpoint-name dev \
    --auto-deployment-mode Disabled \
    --revision-weights '[{"revisionId": "<current-revision-id>", "weight": 90}, {"revisionId": "<new-revision-id>", "weight": 10}]'
```

いまのリビジョンに90%、新しいリビジョンに10%。ほかの道具なしで、少しずつ新しいコードに切り替えられます。

## その５：CloudFront の裏に隠せる

Web Function のエンドポイントを **CloudFront のオリジン**にできます。静的なファイルは CloudFront のキャッシュから返して、動的なリクエストだけ Web Function に流す形です。

さらに、エンドポイントに **OAC（origin access control）** を付けると、自分の CloudFront からしか呼べなくなります。S3 を CloudFront の裏に隠すのと同じやり方を、アプリ側に認証を足さずに Web Function にも使える、ということです。

# 使えるところ

- リージョン：バージニア北部、オハイオ、オレゴン、**東京**、アイルランド
- ランタイム：Node.js 24（`nodejs24.x`）、Arm64
- VPC の中のリソースにもつなげる

東京リージョンが最初から入っているのはうれしいです。

まずは hello world を出すだけなら、これで試せるそうです。

```bash
aws lambda-web deploy --name hello-world --hello-world
```

料金の細かいところは、Lambda の料金ページを見てください。

# Cloudflare Workers とくらべてみた

「Hono が載る」「CPU を使った時間で課金」と聞くと、**Cloudflare Workers** を思い出す人も多いと思います。わたしもそうでした。

そこで、ふだん使っている Workers とならべてみました。Workers 側は、わたしが使ってきて知っている範囲のことなので、料金や制限の細かい数字は公式のページで確かめてください。

| | Cloudflare Workers | Lambda Web Functions |
|---|---|---|
| 動く場所 | Cloudflare の世界中の拠点。リージョンは選ばない | 選んだリージョン（いまは5つ）。グローバル URL で近いところへ |
| 書き方 | リクエストを受け取る関数（`fetch`）。ポートでは待ち受けない | ポートで待ち受けるふつうのサーバー |
| 中身 | V8 の isolate。Node.js の機能は互換レイヤーで一部 | Firecracker の上で動く、ふつうの Node.js 24 |
| 課金 | CPU を使った時間 | CPU を使った時間＋メモリ（実行環境がある間ずっと） |
| つなぎやすい先 | D1・KV・R2・Workers AI など Cloudflare の部品 | VPC の中の DB、AWS のサービス |

## 書き方のちがい

Hono で書くと、ちがいはいちばん最後の行だけです。

```js
// Cloudflare Workers：アプリをそのまま渡す
export default app;

// Lambda Web Functions：ポートで待ち受ける
serve({ fetch: app.fetch, hostname, port: Number(port) });
```

アプリの中身（ルーティングや処理）は同じまま、**入り口だけ差し替えれば両方に置ける**のが Hono のいいところです。

## 課金の考え方は近い

どちらも「**待っている時間には CPU の課金がかかりにくい**」という点では同じ方向を向いています。AI の返事を待つ、DB を待つ、が中心のアプリは、どちらに置いても待ち時間で損をしにくいです。

ちがうのはメモリの扱いで、Web Functions は**実行環境がある間ずっとメモリが課金される**と発表記事に書いてあります。アクセスが少なく、ぽつぽつ呼ばれるだけのアプリだと、ここがどのくらい効くかは計算してみたいところです。

## どっちを選ぶか

わたしなりの分け方はこんな感じです。

- **Workers が合いそう**
  - 世界中どこからでも速く返したい、リージョンを考えたくない
  - D1・R2・Workers AI など、Cloudflare の部品だけで完結する
  - アクセスが少ない個人サイト（無料枠の範囲で収まりやすい）
- **Web Functions が合いそう**
  - Node.js の機能をフルに使う npm パッケージを使いたい（Workers の互換レイヤーで動かないもの）
  - すでにある Express や Next.js のサーバーを、そのまま持っていきたい
  - VPC の中の DB や、AWS のほかのサービスとつなぎたい

**「Cloudflare の中で完結するなら Workers、AWS につなぐなら Web Functions」**くらいの分け方が、いまのところいちばん分かりやすそうです。

# わたしの使い道で考えてみた

ちなみに、わたしの個人サイト「スヤスヤ」は Cloudflare Pages に置いていて、掲示板も Cloudflare の Functions で作っています。書きこみを AI（ゆうちゅす）が先に読んでから通す仕組みです。

そこで、もしこれを Web Functions で作るなら、と考えてみました。

- 掲示板の処理はほとんど「AI の判定を待つ」「DB を待つ」なので、**待ち時間に CPU 課金がかかりにくいのは相性がいい**
- Hono で書いているので、入り口を差し替えれば Lambda にも置ける
- ただ、掲示板は D1（Cloudflare のデータベース）と Workers AI に乗っているので、**いまの形なら Cloudflare のままがいちばん素直**
- AWS 側の DB や、Node.js の機能をフルに使うライブラリが必要になったら、Web Functions に移す候補になる

前に書いた AI クローラーの記事でも、従量課金のサーバーは**請求の見積もり**が大事、という話をしました。Web Functions は「待ち時間が安い」タイプの従量課金なので、**API を待つ時間が長いアプリほど得をする**、という見方で選ぶとよさそうです。

# まとめ

- Lambda に **Web Functions** が増えて、Event Functions・Web Functions・MicroVMs の3つになった
- **Hono や Express のサーバーを書き換えずに**載せられる。違うのは待ち受けるポートを環境変数から読むところだけ
- 1つの実行環境で最大128リクエストを同時に処理して、**CPU を使った時間で課金**。待ち時間が長い Web アプリや、AI のストリーミングに向いている
- デプロイは1コマンド、複数リージョンもグローバル URL も、カナリアリリースも簡単
- 東京リージョンで使える。ランタイムは Node.js 24 の Arm64
- Cloudflare Workers とは課金の考え方が近い。**Cloudflare の中で完結するなら Workers、AWS につなぐなら Web Functions** が分かりやすい分け方

触ってみたら、また記事にします。AITuber のバックエンドを1本載せてみて、料金がどうなるかを見てみたいです！
