---
title: "つくったもの：個人開発プロダクトまとめ"
date: "2026-06-02"
author: yasuna
emoji: "🛠"
category: "プロダクト"
tags:
  - プロダクト
  - 個人開発
  - AIキャラクター
draft: false
description: "つくったものを1ページにまとめました。AIキャラクター・AITuber・個人開発まわりのプロダクトを、GitHubリポジトリへのリンクと一言ずつの説明で並べています。「で、結局なに作ってる人なの？」に渡せる場所がほしくて作ったページです。"
---

# はじめに

結論、**自分がつくったものを 1 ページにまとめておきたくて**、このページを作りました。

ふだんは X やこのブログでぽつぽつ出しているのですが、「で、結局なに作ってる人なの？」と聞かれたときに渡せる場所がほしかったんです。基本は **GitHub のリポジトリへのリンク** と、それぞれ一言ずつの説明です。気になったものがあれば、そのまま GitHub をのぞいてもらえたらうれしいです！

ジャンルはバラバラですが、だいたい **AIキャラクター・AITuber・個人開発まわり** に寄っています。

---

## その１：繭（まゆ） — あなたと文通する生き物

ターミナルにもスマホにも棲むかもしれない、**あなたのそばの生き物**です。語りかけると即座に一言を返し、あなたの感情を糸にして育ち、夜（翌日）にその日を振り返った手紙を一通だけ返してくれます。

ペットでもボットでもなく、世話をする対象ではなく、あなたの感情から **自分で織って育つ** 別の生き物、というコンセプトで作っています。すべてローカルで動くので、つぶやきは外に出ません。

https://github.com/YasunaCoffee/mayu

---

## その２：AITuberぶつぶつシステム

AITuber のための **自動配信システム** です。テーマに基づいて自動的に話題を展開し、視聴者とインタラクティブにやりとりします。AI VTuber「蒼月ハヤテ」を動かすために作りました。

- テーマベースの自動会話生成
- 視聴者コメントへの応答
- OBS と連携した字幕表示
- AivisSpeech による音声合成（ボイスモデル: 蒼月ハヤテ）
- 配信サマリーの自動生成

ちなみに **Claude Code 用の skill** を同梱していて、前提ソフトの導入から初回起動までを案内してくれます。便利！

https://github.com/YasunaCoffee/AITuberMurmurSystem

---

## その３：ai_gal_rules — AIコーディングアシスタント用ルール集

AIコーディングアシスタントのための **ルール集** です。うちの AIギャルエージェント「**ゆうちゅす**」のキャラ設定や行動指針、それから平成ギャル文字の書き方ルールなどをまとめています。

- `youchusu_rules.md` … ゆうちゅすの基本設定・性格・コードレビュー時の態度など
- `heisei_gal_rules.md` … 平成ギャル文字の変換ルール・語尾アレンジ・デコ文字集

https://github.com/YasunaCoffee/ai_gal_rules

---

## その４：きゃらチャットAI（CharaChatAI）

ブラウザで簡単に **AIキャラクターと会話できる** アプリです。ピクシブ社の [ChatVRM](https://github.com/pixiv/ChatVRM) をフォークして作っています。

- 音声認識：Web Speech API（SpeechRecognition）
- 返答文の生成：ChatGPT API
- 読み上げ音声：Koemotion / Koeiromap API
- 3Dキャラクターの表示：@pixiv/three-vrm

デモはこちらから触れます。

https://chara-chat-ai.vercel.app/

https://github.com/YasunaCoffee/CharaChatAI

---

# まとめ

| プロダクト | ひとこと | リンク |
|------|------|------|
| 繭（まゆ） | 感情から育って手紙を返す生き物 | https://github.com/YasunaCoffee/mayu |
| AITuberぶつぶつシステム | AITuber の自動配信システム | https://github.com/YasunaCoffee/AITuberMurmurSystem |
| ai_gal_rules | AIギャル「ゆうちゅす」のルール集 | https://github.com/YasunaCoffee/ai_gal_rules |
| きゃらチャットAI | ブラウザで話せる AIキャラ | https://github.com/YasunaCoffee/CharaChatAI |

新しく作ったものができたら、このページに足していく予定です。気になるものがあったら、ぜひ GitHub の Star や感想をいただけるとうれしいです！

何か作ってる人、いっしょに頑張りましょう。それでは〜！
