---
title: "Kimi Code CLIのハーネスがいまいちだったのでopencodeに乗り換えてみた"
date: "2026-07-19"
author: yasuna
emoji: "🐧"
category: "作ってみた"
tags:
  - 作ってみた
  - Kimi
  - Claude Code
  - opencode
  - 個人開発
draft: false
description: "Kimi Code CLI単体だとハーネスが弱くて絶対ルールを守りきれなかったので、モデルはKimiのまま外側の制御をしっかりしたCLIに乗せ替えようとした話。まずClaude CodeのAPIキー環境変数(ANTHROPIC_API_KEY)経由で試したらログイン済みのClaude.aiアカウントに環境変数ごと握りつぶされ、最終的にマルチプロバイダー対応のopencodeに乗り換えて数分で動いた記録。"
---

<p class="note-ribbon">この記事はAIエージェントと執筆しています</p>

こんにちは！yasunaです！

端的に言うと、**「Kimi Code CLI単体だとハーネスが弱くてルールを守りきれなかったので、モデルはKimiのまま外側の制御だけしっかりしたCLIに乗せ替えようとしたら、Claude Codeにはログイン済みアカウントに環境変数ごと握りつぶされて詰んだ」** という話です。最終的にはopencodeに乗り換えて数分で解決したので、同じことをしようとしている人向けの記録です。

# はじめに：ハーネスが弱いなら、外側を変えればいい

[前回の記事](/posts/kimi-k3-hajimete-kansou/)で、Kimi K3を**Kimi Code CLI単体**（`kimi`コマンド）から使って、漫画の仕上げ作業を丸ごと任せてみました。感想は「発散は得意だけど絶対ルールを守りきれない」でした。「コマは白紙で描く」という一度も破られたことのないルールをK3があっさり破ってしまった、というやつです。

これ、モデルの地力というより**ハーネス（エージェントの外側の制御機構）が弱いせいなんじゃないか**と思うようになりました。Kimi Code CLI自体はまだ新しいツールで、Claude Codeのように許可設定・ルール遵守・タスク管理を細かく固めてくれる仕組みがそこまで作り込まれていない印象だったからです。実際、記事中でも「ClaudeCodeとか設定しなくても最低限このくらい守れるだろうというハーネス以前のものもK3には何も無い」と書いたとおりです。

だったら**モデルはKimiのままで、外側のハーネスだけしっかり制御できるCLIに乗り換えればいいのでは**、と思い立ちました。真っ先に浮かんだのが、普段使っているClaude Code。Anthropic製ですが、`ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY`という環境変数でエンドポイントを差し替えられる仕組みがあるらしいと知っていたので、これでいけるだろうと考えたのがことの始まりです。

bashrcにこんな関数を書きました。

```bash
claude-kimi() {
  ANTHROPIC_BASE_URL="https://api.kimi.com/coding/" \
  ANTHROPIC_API_KEY="$MOONSHOT_API_KEY" \
  ANTHROPIC_MODEL="kimi-for-coding" \
  claude "$@"
}
```

実際はここに至るまでbase URLの綴りやモデル名（`k3` / `kimi-for-coding` / `kimi-for-coding-highspeed`）を何パターンも試すことになるんですが、まずは結論から。

# 実際はどうかというと：ログイン済みアカウントに環境変数が負ける

`claude-kimi`を起動すると、モデル名として`kimi-for-coding`が表示はされるんです。でも何を聞いても

```
There's an issue with the selected model (kimi-for-coding).
It may not exist or you may not have access to it. Run /model to pick a different model.
```

と返ってくる。curlで直接APIキーを叩いて認証エラーの内容を確認したり、モデル名を`k3`に変えたり、あらゆる組み合わせを試しても同じでした。

原因は環境変数ではなく、**このマシンで`claude`コマンドが既にわたしのClaude.aiアカウントでログイン済みだったこと**でした。Claude Codeは、ログイン済みのアカウントがあるとそちらの認証を優先し、`ANTHROPIC_API_KEY`のような環境変数は無視するように作られているようです。

そこでKimi公式の「Other Coding Agents」ドキュメントを読むと、案の定こう書いてありました。

https://www.kimi.com/code/docs/third-party-tools/other-coding-agents.html

> Anthropicのデフォルトのログインフローをスキップするための事前スクリプトを実行する

`~/.claude.json`に`penguinModeOrgEnabled: true`と`hasCompletedOnboarding: true`を書き込む、というnodeスクリプトが用意されています。言われた通り実行してもみましたが、それでも「ログイン済み」の壁は崩れませんでした。

じゃあログアウトすればいいのでは、と`/logout`してみると、今度は別のAnthropic Consoleアカウント（従量課金用、以前作って放置していたやつ）にログインしてしまい、「Credit balance too low（残高不足）」という全く別のエラーに変わりました。環境変数のAPIキーが使われる隙が、どこにもなかったわけです。

ちなみにこの作業、今回はバックグラウンドジョブとして走らせていたので、`/logout`しても「このセッションは他のセッションと認証情報を共有しているので効果がない」と言われる場面もありました。この辺りは通常のターミナルで検証すればまた違ったかもしれませんが、そこまでしてClaude CodeにKimiを喋らせる意味があるのか？と冷静になったのが正直なところです。

# そこで：opencodeに乗り換えたら数分で終わった

Claude Codeは元々Anthropic純正のツールで、他社LLMプロバイダーへの接続は「できなくはないが公式には想定されていない」という位置づけなんだと思います。だったら最初からマルチプロバイダー対応で作られているツールを使えばいい、ということで[opencode](https://opencode.ai/)に乗り換えました。

```bash
npm install -g opencode-ai
```

これだけでインストール完了。opencodeにはMoonshot AIが最初から組み込みプロバイダーとして登録されているので、本来は`/connect`で対話的にAPIキーを入れるだけのはずです。ただ、今回使っていたのは`platform.moonshot.ai`発行のキーではなく**Kimiのサブスクページで発行したキー**（`api.kimi.com/coding/`用）だったので、組み込み設定のままでは"undefined/chat/completions"というURLエラーになりました。

そこで`~/.config/opencode/opencode.json`にカスタムプロバイダーとして明示的に定義し直しました。

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "moonshot": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Kimi Code",
      "options": {
        "baseURL": "https://api.kimi.com/coding/v1",
        "apiKey": "{env:MOONSHOT_API_KEY}"
      },
      "models": {
        "kimi-for-coding": {
          "name": "Kimi K2.7 Coding",
          "limit": {
            "context": 262144,
            "output": 8192
          }
        }
      }
    }
  },
  "model": "moonshot/kimi-for-coding"
}
```

これで`opencode run "あなたは誰ですか？一言で答えて"`を叩くと、

```
OpenCodeです。
```

とちゃんとKimi経由で返ってきました。Claude Codeで何時間も格闘していたのが嘘みたいにあっさりでした。

せっかくなので**K2.7 Codingだけでなく、[前回試したK3](/posts/kimi-k3-hajimete-kansou/)ともopencode経由で話したい**と思い、`models`にK3とHighspeed版も追加しました。

```json
"models": {
  "kimi-for-coding": {
    "name": "Kimi K2.7 Coding",
    "limit": { "context": 262144, "output": 8192 }
  },
  "kimi-for-coding-highspeed": {
    "name": "Kimi K2.7 Coding Highspeed",
    "limit": { "context": 262144, "output": 8192 }
  },
  "k3": {
    "name": "Kimi K3",
    "limit": { "context": 1048576, "output": 8192 }
  }
}
```

`model`を`moonshot/k3`にして`opencode run`を叩くと、こちらも普通に応答してくれました。モデルIDさえ`models`に足せば、あとはopencode側の切り替え（TUI内の表示やコマンドパレット）で選べます。

![opencodeのTUI画面。プロンプト入力欄の下に「Build · Kimi K3 Kimi Code」と表示されており、K3モデルが選択されている](/img/opencode-kimi-k3-screen.png)

opencodeのTUI下部にちゃんと**「Kimi K3 Kimi Code」**と出ています。ここまで来れば、あとは普通にコーディングエージェントとして使うだけです。

念のためKimi側の使用履歴も確認したところ、`opencode/1.18.3 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.14`というUser-Agentで「Model Inference」がちゃんと記録されていました。opencode経由のリクエストが**Kimi側にきちんと届いている**という裏付けです。

今回使ったAPIキーは`platform.moonshot.ai`の従量課金用ではなく、**Kimiのサブスクページ（Code特典付きの会員プラン）**発行のもので、エンドポイントも公式`kimi`コマンド自体が使っているのと同じ`https://api.kimi.com/coding/v1`でした。つまりopencode経由の利用も、追加課金ではなく**サブスク特典の枠内でカウントされている**はずです。一方で、公式CLIに1日あたりの利用回数のようなクォータ管理があるとすれば、opencode経由の消費もそこと合算されている可能性が高いので、使いすぎると公式`kimi`コマンド側の残り回数を圧迫することになりそうです。このあたりの実際の消費ペースは、Kimiのサブスクページの使用状況画面で確認するのが確実です。

# まとめ

- Claude CodeはClaude.aiアカウントにログイン済みだと、`ANTHROPIC_API_KEY`/`ANTHROPIC_BASE_URL`環境変数より**ログインセッションを優先する**。公式のオンボーディング回避スクリプトを踏んでも解決しなかった
- ログアウトすると今度は別のAnthropicアカウント（Console課金）に吸われることもあるので、そもそも「Anthropic純正CLIに他社LLMを差し込む」のは公式サポート外の力技だと割り切ったほうがいい
- opencodeのようなマルチプロバイダー前提のツールなら、`@ai-sdk/openai-compatible`経由でbaseURLとAPIキーを明示するだけで数分で終わる
- 使っているAPIキーがどの発行元（platform.moonshot.ai か Kimiサブスクページか）のものかによってbaseURLが変わるので、そこは要注意
- `models`にモデルIDを足すだけで、K2.7 CodingもK3もHighspeed版も同じプロバイダー設定の中で切り替えられる
- Kimiサブスクページ発行のキーを使う場合、opencode経由の利用も公式CLIと同じサブスク特典の枠内でカウントされる（＝クォータが合算されている）可能性が高い

「ツールを無理に使い続ける」より「向いているツールに乗り換える」方が早い、という当たり前だけど忘れがちな教訓でした。あと片付けとして`claude-kimi`関数と`~/.claude.json`のフラグはちゃんと元に戻してあります。普段のClaude Codeはこれまで通り、KimiはopencodeでOKという住み分けに落ち着きました。

もともとの動機だった「**モデルの発想力はいいのにルールを守りきれない**」問題も、opencode側の許可設定やエージェント制御でどこまで締められるかはまだ検証中です。ハーネスを変えて満足して終わらせず、ここはちゃんと確かめてから続報を書こうと思います。

ここまで読んでありがとうございました。
