---
title: "ゲーム機を持っていないけど、Chromaticのゲーム作りはエミュレータから始められそう"
date: "2026-09-30"
author: yasuna
emoji: "🎮"
category: "メモ"
tags:
  - ゲーム
  - Codex
  - エミュレータ
draft: false
description: "ゲームボーイのカートリッジが遊べる携帯機 ModRetro Chromatic がほしくなった。でも本体は持っていない。調べてみたら、Codex でゲームを作るところまではブラウザのエミュレータで完結しそうだったので、まずそこから始めてみようと思った話。"
---

# はじめに

きっかけは、OpenAI の DevDay 2026 でした。

https://openai.com/ja-JP/index/devday-2026-recap/

まとめ記事には、dots や Codex クラウド、ChatGPT のプラグイン拡張機能など、20を超える発表がずらっと並んでいます。

そんな中、X で GOROman さんのポストが流れてきました。DevDay の参加者に**透明な ModRetro Chromatic がプレゼントされていて**、Codex で作ったスーパーマリオ風のゲームをその本体で動かしていたんです。

https://x.com/GOROman/status/2105067908565221696

透明なゲームボーイっぽい本体で、AI が作ったゲームが動いている。これを見て、正直に一言。**ほしい。**

https://modretro.com/products/chromatic-tetris-bundle

ゲームボーイ／ゲームボーイカラーのカートリッジがそのまま遊べる、いまどきの携帯機です。

ただ、わたしはゲーム機を持っていません。Chromatic もまだ買っていません。

それでも「自作ゲームって遊べるのかな？」と AI に聞きながら調べていったら、**ゲームを作って遊ぶところまでは、本体がなくてもエミュレータで始められそう**だと分かってきました。

この記事は「買う前にエミュレータでやってみようかな」という、やる前のメモです。まだ試していないので、手順は公式の Quickstart で確かめてから進めてください。

# Chromatic ってどんな機械？

AI に聞いてまとめてもらった範囲だと、こんな感じでした。

- ゲームボーイ／ゲームボーイカラーの**純正カートリッジがそのまま遊べる**
- 画面は元の解像度（160×144）のバックライト液晶
- FPGA で動いていて、遅延が小さい
- テトリスのカートリッジが同梱のセットがある

値段は本体のガラスの種類で変わるみたいです。日本から買う場合は、送料や関税もあわせて合計を見た方がよさそうでした。値段や在庫は変わるので、公式ストアで確認するのが確実です。

# 自作ゲームは遊べるの？

遊べるそうです。ただ、Chromatic は**カートリッジを挿して遊ぶ機械**なので、自作ゲームもカートリッジに入れる必要があります。

- 書き換えできるカートリッジ（フラッシュカート）に自作 ROM を入れて挿す
- ModRetro の純正カートリッジに書き込む

といった方法があるみたいです。

ちなみに、どれも**自作・正当な homebrew 前提**の話です。市販ソフトの吸い出しなどには使わないように、公式も書いているそうです。

# Codex でゲームボーイのゲームが作れる

ここで一番気になったのがこれです。

ModRetro の公式アカウントも、**ModRetro と OpenAI が Chromatic 向けのゲーム作りで協力している**と発表していました。ModRetro の携帯機と、OpenAI のコーディングエージェント Codex を結びつけるパートナーシップだそうです。

https://x.com/modretro/status/2105010501306708337

ポストの動画では、DevDay 2026 のステージでサム・アルトマンさんが透明な Chromatic を手に持って説明しています。OpenAI の DevDay で、ゲームボーイ風の携帯機が紹介されているのはなんだか不思議な光景でした。

DevDay で配られていたのは **Chromatic の DevDay Edition** で、Codex でゲームを作って、そのまま実機のカートリッジに書き込めるようになっています。

ModRetro の公式 Quickstart（Chromatic: DevDay Edition Quickstart Guide）を読んでみたら、流れはこうでした。

https://support.modretro.com/en_us/chromatic-devday-edition-quickstart-guid-By1iOlcMg

1. **Chromatic のファームウェアを更新する**（Chromatic Firmware Updater）
2. 付属の**アクティベーションコードで Developer-Mode を有効にする**（Firmware Updater で Ctrl-I、Mac は Cmd-I）。これで、作ったゲームを付属のカートリッジに書き込めるようになる
3. **Codex のデスクトップアプリ**を入れる（https://chatgpt.com/codex/）
4. Codex の Plugins タブで **「ModRetro Chromatic」プラグイン**を入れる
5. チャットで `@` を押して ModRetro Chromatic Plugin を付けて、作りたいゲームを説明する
6. **Codex の中のブラウザプレビュー（エミュレータ）**で遊んで確かめる
7. 実機に**映像を流して**操作感を確かめる
8. よければ**カートリッジに書き込む**

1・2 と 7・8 は Chromatic の本体がある人向けです。

実際はどうかというと、**3〜6 だけならゲーム機を持っていなくても進められそう**なんですよね。プラグインは「ゲームボーイカラー互換の機械とエミュレータ向け」のゲームを作ってくれるので、作って遊んで直すところまでは、パソコンの中で回せます。わたし的にはここがうれしいポイントでした。

ちなみに、実機で確かめる 7 も、**本体の中でゲームが動くわけではなく、パソコンのエミュレータで動かした画面と音を Chromatic に流す**方式だそうです。

# エミュレータで遊ぶまでの手順

詳しいことは、OpenAI の開発者向けページ「**ModRetro + Codex**」にまとまっています。

https://developers.openai.com/modretro

開いてみたら、これが**めちゃくちゃかわいい**んです！

ドット絵のゲーム機みたいな画面に、Codex で作られたゲームがカードでずらっと並んでいて、FlapGPT、Ash & Oath、Codex Land、Arc Pocket、Seedy's Sweet Garden……と、タイトル画面を見ているだけで楽しい。

しかも、ゲームを選ぶと**ピンクの Chromatic の絵の中で、そのままブラウザで遊べます**。本体の色も何色かから選べて、操作はキーボード（矢印キーで移動、X かスペースで A、Z で B、Enter でスタート、M でセレクト）。ROM のダウンロードボタンもありました。

**ゲーム機を持っていなくても、ブラウザでもう遊べる。** ここはもう「〜そう」じゃなくて、実際に確かめられました。右上の「Build your game」から、自分で作る方にも進めます。

ModRetro 側の公式 Quickstart にも、そのまま Codex に投げられる例が載っています。

プラグインを入れたら、まず準備をお願いします。

```text
Set up @ModRetro Chromatic Plugin so I can create games, build ROMs, and run automated playtests. Check what's already installed and prepare the missing dependencies.
```

ゲームは **GB Studio** のプロジェクトとして作られます。新しく作るならこんな感じ（種を3つ集めて植えると門が開く、小さな探索ゲーム）。

```text
Create and select a new GB Studio project at /absolute/existing-parent/MoonGarden. Make a small exploration game where a gardener collects three seeds and plants them to unlock a gate.
```

プラグインには **「Wrecklight」** というお手本のゲームも入っていて、それを改造して自分のゲームにすることもできます。

そして、エミュレータで遊ぶのはこれ。

```text
Build my selected game and open it in the playable browser preview. Reuse that preview as we make changes.
```

Codex が直すたびに、同じプレビューで遊び直せます。別でエミュレータを入れなくていいのは気楽！

ほかにも、シーンを足す、キャラのドット絵と歩きアニメを作る、パレットを変える、**ゲームボーイの制限（スプライトや背景の数など）に引っかかっていないか点検する**、といったお願いの例が並んでいました。制限の点検まで頼めるのは、ゲームボーイ初心者にはありがたいです。

注意書きもしっかり書かれていて、このプラグインは**自分で作ったオリジナルの ROM 専用**です。市販ゲームのエミュレーションや、プロテクトの回避には使えません。

# まとめ

- ModRetro Chromatic は、ゲームボーイのカートリッジが遊べるいまどきの携帯機
- 自作ゲームは、カートリッジに入れれば遊べる
- **みんなが Codex で作ったゲームは、ブラウザでもう遊べる**（ModRetro + Codex のページがかわいい）
- 自分で作ってエミュレータで遊ぶところまでも、本体なしで進められそう
- 本体（DevDay Edition）が必要になるのは、実機に映像を流す・カートリッジに書き込むところから

というわけで、ゲーム機を持っていないわたしでも、まずはエミュレータで1本作ってみようかなと思っています。

うまく動いたら、また記事にします。自分のゲームが動いたら、そのときこそ本体を買う理由になりそう！
