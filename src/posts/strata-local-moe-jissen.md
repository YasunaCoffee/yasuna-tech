---
title: "Strataで125BのQwen3.8-Flash-Next Coderを3080 Tiで動かした"
date: "2026-10-31"
author: yasuna
emoji: "🪨"
category: "作ってみた"
tags:
  - 作ってみた
  - Strata
  - ローカルLLM
  - OpenCode
  - Tailscale
  - Claude Code
draft: false
description: "GPUとCPU（とSSD）に分けて大きなMoEモデルを動かす推論エンジン「Strata」を、RTX 3080 Ti（VRAM 16GB）＋RAM 32GBのPCで試した記録。125B級のQwen3.8-Flash-Next Coderが39 tok/sで動き、Tailscale＋opencode serve経由でAndroidのOpenCode Mobileから使えるところまで行った。"
---

こんにちは！yasunaです！

今回は、**「RTX 3080 Ti＋RAM 32GBで125B級のコード用モデルが39 tok/sで動いて、スマホから使えるところまで1日で行けた。ただ日本語はダメだった」** という話です。

最新のGPUじゃなくても、2世代前の3080 Tiで100B超えのモデルが実用的な速さで動きます。手元に少し古いゲーミングPCがある人には、けっこう夢のある話だと思います。

作業はほぼ全部 Claude Code にやってもらいました。わたしは「これやりたい」と言って、ドライバーを入れたりPowerShellを開いたりする係です。

# はじめに：Strataってなに

[Strata](https://github.com/Niko1221/Strata) は、MoE（Mixture of Experts）のモデルを**GPUとCPU、さらにSSDにまで分けて**動かす推論エンジンです。

MoEは、全体はめちゃくちゃ大きいけど、1トークンごとに使う「エキスパート」はその一部だけ、という作りです。なので、よく使うところはGPUに、残りのエキスパートはRAMに、RAMにも入りきらない分はSSDから読みながら動かす、ということができます。VRAMが16GBしかない家のPCでも、100B超えのモデルが「遅いけど動く」くらいにはなる、というのが売りです。

コマンドもかなりやさしくて、だいたいこれだけです。

```bash
strata launch --family coder --model IQ1_M --vision off
```

モデルのダウンロードも、GPUに合うエンジン選びも、起動も、全部これがやってくれます。

# 試したPC

| 項目 | 内容 |
|---|---|
| OS | Windows |
| CPU | Core i9-12950HX（16コア） |
| RAM | 32GB |
| GPU | RTX 3080 Ti Laptop（VRAM 16GB） |

RAM 32GBなのがポイントです。Strataの目安は「エキスパートの分＋約10GB」で、標準的な量子化だと44GBくらい欲しいので、32GBはぎりぎり足りない側です。

# 3080 TiでCoderを動かす

## モデル選び

RAM 32GB＋VRAM 16GBで現実的なのは、この2つでした。

| モデル | 特徴 |
|---|---|
| Qwen3.6-35B-A3B（UD-Q4_K_XL） | 22.9GB。汎用で日本語も無難 |
| **Qwen3.8-Flash-Next Coder（IQ1_M）** | 125B級のコード特化。58GBあるので、RAMに入らない分はSSDから読む（低RAMモード） |

せっかくなので大きいほう、**Coder（IQ1_M）** にしました。公式ドキュメントには「コード以外や多言語では弱い」とあって、これが後で効いてきます。

## ハマり1：Claudeアプリの中からインストールすると、隔離フォルダに入る

Claude Code（Windowsのデスクトップアプリ）にインストールまでやってもらったら、普通のPowerShellで `strata` が見つかりません。

原因は、**アプリの中で実行したコマンドのファイルが、アプリ専用の隔離フォルダ**（`...\Packages\Claude_xxxx\LocalCache\...`）に置き換えられることでした。PATHには本来の場所（`%LOCALAPPDATA%\Strata`）が足されるのに、実物はそこにない、というややこしい状態です。しかもパスが長くなりすぎて、モデルの準備中に「ファイルが見つからない」で止まっていました。

なので、**インストールと起動は自分のPowerShellで**やることにしました。Claude Code には、起動したサーバーにテストを投げたり、設定を見たりする側に回ってもらいます。

```powershell
irm https://github.com/Niko1221/Strata/releases/latest/download/install.ps1 | iex
```

## ハマり2：NVIDIAドライバーが古い

次は「このPCに合うエンジンがない」と言われました。ドライバーが **566.07** で、Windows用のエンジンはこれに対応していなかったからです。

| エンジン | 必要なドライバー |
|---|---|
| CUDA 12版 | 576.02 以上 |
| CUDA 13版 | 580.65 以上 |

NVIDIAのサイトからRTX 3080 Ti Laptop用のドライバーを入れて、**621.01** に上げたら通りました。GeForce Experience に古い Nsight まで入っていて、このPCのNVIDIAまわりの年季を感じました。

## 動いた！ 39.3 tok/s

約64GBのダウンロードのあと、無事に起動しました。お題は「n番目の素数を効率よく返すPython関数を書いて」です。

| 項目 | 値 |
|---|---|
| 生成速度 | **39.3 tok/s** |
| 出力 | 3,622トークン（うち約2/3が「考える」部分）、92秒 |
| 先読み（MTP）の当たり率 | 75% |
| VRAM | 14.7GB / 16GB |
| コンテキスト | 64K |

返ってきたのは、エラトステネスのふるいを区間ごとに分けて計算する、ちゃんとした実装でした。公式の実測（RTX 5070＋RAM 64GBで約55 tok/s）よりは遅いけど、3080 Ti＋RAM 32GBで125B級がこの速さなら十分です。

## 考える時間が長すぎて、本文が空になる

最初に `max_tokens: 800` で試したら、**800トークン全部を考える部分に使い切って、本文が空**でした。このモデル、簡単なお題でも数千トークン考えます。

Strataには、接続するアプリ全部に効く「Chat settings」があるので、`max_tokens` を省略したときの上限を **4000** にしました。これで、省略しても最後まで答えが返るようになりました。

さらに速くしたいときは、自動チューニングがあります。設定を1つずつ変えて測って、誤差より大きく速くなったものだけプリセットとして保存してくれます（約20分）。

```bash
strata tune auto launch-iq1_m-64k --use coding
```

# スマホのOpenCodeから使えるようにする

ここからが本題です。家のPCで動いているモデルを、**外からスマホで**使いたい。

## 構成

```
スマホ（Tailscale + OpenCode Mobile）
   │ Tailscaleの中だけ（HTTPS）
   ▼
3080 TiのPC: tailscale serve → opencode serve (127.0.0.1:4096) → Strata (127.0.0.1:8080)
```

外に出すのはOpenCodeだけで、それもTailscaleの中からしか開けません。StrataはPCの中だけで待っています。

1. Strataには `strata connect opencode` という、OpenCode用の設定を書き出す機能がありました。これを元に `~/.config/opencode/opencode.json` を作ります（コンテキスト64K、出力上限8192）
2. PCとスマホにTailscaleを入れて同じアカウントでログイン
3. `tailscale serve --bg 4096` で、tailnetの中にだけ `https://<PC名>.<tailnet>.ts.net` を公開
4. OpenCodeをパスワード付きで起動

```powershell
cd C:\Users\<自分>\dev; $env:OPENCODE_SERVER_PASSWORD="好きなパスワード"; opencode serve
```

5. Androidの **OpenCode Mobile**（非公式アプリ）にURL・ユーザー名 `opencode`・パスワードを入れる

認証はベーシック認証ですが、`tailscale serve` のHTTPSの中を通るので、中身は見えません。そもそも自分の端末からしか届かないので、パスワードは念のための二重ロックです。

## ハマり3：`opencode` と `opencode serve` は別物

最初、URLを開いたら **502** でした。

調べたら、わたしが起動していたのは引数なしの `opencode`、つまり**PCの画面で使うターミナル版（TUI）**で、外からの接続を待つサーバーではありませんでした。Ctrl+Cで止めて `opencode serve` で起動し直したら、ちゃんと401（パスワードを聞かれる）が返るようになりました。

最後に、OpenCodeの送り方でStrataが動くかを確かめます。

```text
PASS prompt: It answered: 'pong'. (2 s)
PASS tool call: It called get_weather with {"city": "Paris"}. (3 s)
```

会話もツール呼び出しも通りました。OpenCodeは最初にシステムプロンプトとツールの説明で約7,400トークン読むので、1回目の返事だけは少し待ちます。

## スリープ対策

電源設定を見たら、放っておいてもスリープしない設定にもともとなっていました。気をつけるのは**ふたを閉じたとき**だけで、Windowsの初期設定は「スリープ」なので「何もしない」に変えます。

```powershell
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setactive SCHEME_CURRENT
```

Strataが動いている間はGPUもCPUもかなり熱くなるので、ふたを閉じるなら電源につないで風通しのいいところに置くのがよさそうです。

# 問題：Coderは日本語がダメ

スマホから使えるようになって、さっそく「日本語で答えて」と指示してみました。

コードは正しく書けます（順番を保ったまま重複を消す関数）。でも説明の日本語が、

> `seen` 記保存重複をの already seenををの

みたいに崩れて、後半は英語に戻ってしまいました。公式の「コード以外や多言語では弱い」のとおりです。

これを見て、思わずこうつぶやいていました。

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">Coderさんはほぼ英語しか話せないので英語覚えようかなという気持ちになる。逆に制約あるローカルLLMに人間が合わせにいくのもまた粋まであるのか(？)</p>&mdash; yasuna (@yasun_ai) <a href="https://twitter.com/yasun_ai/status/2116461035079303446">このポストを見る</a></blockquote>

クラウドの大きいモデルなら、こっちが何語で話しても合わせてくれます。でも手元のローカルLLMには、得意なこととできないことがはっきりあります。だったら人間のほうが少し歩み寄って英語で話しかける、というのも、自分のPCで自分のモデルを飼っている感じがしてちょっと楽しいんですよね。

とはいえ、毎回英語で頼むのはさすがに疲れそうです。そこで、**日本語で会話して計画を立てる「司令役」のモデルを別に置いて、Coderはコードを書くサブエージェントにする**構成を考えています。OpenCodeはエージェントごとに使うモデルを分けられるので、設定ファイルだけで組めます。

```
スマホ (OpenCode Mobile)
   ▼ Tailscale
3080 TiのPC: OpenCode サーバー
   ├─ メインのエージェント（日本語で会話・計画・まとめ） → 司令役のモデル
   └─ サブエージェント「coder」（コードを書く）         → Strata Coder
```

司令役を何のモデルにするかは、まだ決めていません。ここは次回です。

# おまけ：夜に0.2.9が来た

夜には Strata 0.2.9 が出ていました。速くなったのはLinux＋NVIDIA、Strix Halo、Intel Arc、DGX Sparkで、**Windows＋NVIDIAの速度は変わらず**。でも、OpenCodeで使うのに効く直しが入っていました。

- 回答の中のコードブロックに書いたツール呼び出しの例を、誤って実行しなくなった
- エージェントの会話の途中で、ツール呼び出しがただの文字として返ってくる問題が直った

# まとめ

- **3080 Ti＋RAM 32GBでも、125B級のCoderが39 tok/sで動く。** Strataのコマンド1本でダウンロードからエンジン選びまでやってくれる
- **インストールと起動は、Claudeアプリの外の普通のPowerShellで。** アプリ内だと隔離フォルダに入ってしまう
- **考えるモデルは `max_tokens` を大きめに。** 小さいと考えている途中で切れて本文が空になる
- **スマホから使うなら Tailscale＋`opencode serve`（TUIの `opencode` ではない）＋OpenCode Mobile。** `strata connect opencode --check` で接続テストまでできる
- **Coderは日本語が崩れる。** こっちが英語で合わせにいくのも粋だけど、日本語の司令役＋Coderのサブエージェント、の構成にしたい

次は、司令役のモデルを決めて、スマホから日本語で頼むとCoderが裏でコードを書く、という形まで持っていきたいです。

それでは！
