---
title: "ラズパイ5を初めて買ってSSHとRaspberry Pi Connectのトークンで詰まった話"
date: "2026-03-25"
author: yasuna
emoji: "🥧"
category: "忘却録"
tags:
  - Raspberry Pi
  - ラズパイ
  - Raspberry Pi Connect
  - 忘却録
  - セットアップ
  - 公開鍵認証
draft: false
---

こんにちは！yasunaです！

**前提として、この記事のゴールは次のとおりです。** microSD に OS を焼いてラズパイに差し、同じネットワーク上の PC から **SSH で接続できるようにすること**。ここまでできればひとまずセットアップ完了、という段取りでした。

ラズパイ5を初めて買いました！！わくわくしながらOS書き込みの手順を調べて [npaka さんの note](https://note.com/npaka/n/n254a702ca95e) を見ながらやっていたんですが、**SSHが5回以上つながらず**、さらに**Raspberry Pi Connectのトークン取得もどこにも書いてなくて詰まった**のでまとめます。忘却録です。**あとから追記**で、本当に効いたのは別ルートだった話も書きました。

---

## SSH地獄編

まずConnectの前にSSHで詰まりました。5回ぐらい焼き直しました。

### エラーの変遷

**最初（1回目）**：`Permission denied, please try again.` → パスワード問題

**次：** `kex_exchange_identification: read: Connection reset` → SSHデーモンが即切断

**その次：** `Permission denied (publickey,password).` → 認証方法ごと弾かれる

**さらに：** `Connection closed by 192.168.11.25 port 22` → 接続はできるけどすぐ切れる

どんどんエラーが変わっていって混乱しました。

### 原因

SDカードの `bootfs` に `userconf.txt` も `ssh` ファイルも存在していなかった。つまり **Imagerの設定が全く書き込まれていなかった**のが根本原因です。

原因はユーザー名に使えない文字を入れていたこと。Imagerで以下のエラーが出ていました：

```
The username must be lowercase and contain only letters numbers underscore and hyphens
```

このエラーが出たまま「保存」を押しても設定が保存されず、`userconf.txt` が生成されないままSDカードへ書き込まれていました。

## 2026-03-26 追記：パスワード認証にこだわっていた

**原因**（Imager の設定が反映されず、`userconf.txt` も `ssh` もなかったこと）は把握できたのですが、**パスワード認証ルートでどうにかしようとする限り、自分の環境ではまだ解決しきれませんでした**。そこでモヒにゃぱんちゃんから教えてもらったのが、クラスメソッド DevelopersIO の手順です。

https://dev.classmethod.jp/articles/raspberry-pi-pc-ssh/

要するに、Raspberry Pi Imager の **Remote access** で **Use public key authentication** を選び、先に `ssh-keygen` で作った公開鍵をフォームに貼る、というやり方。**これをやったら一撃でした。**

つまり自分がずっと詰まっていたのは、**SSH のパスワード認証にこだわっていたこと**だったんです。EC2 とか普通に SSH して、公開鍵も何度も触ってきたはずなのに、ラズパイのセットアップだけパスワードに固執してしまっていて、こんなにハマるとは思いませんでした。小並感。

出来上がったときのポストです（埋め込みはやめて画像にしました）。

![X @yasun_ai のポスト（スクショ）](/img/raspberrypi5-x-post.png)

同じように**パスワード認証で詰まっている人**は、**公開鍵の方を先に試す価値**はあると思います。

---

## Raspberry Pi Connect編

Raspberry Pi Connectは、公式のブラウザ経由リモートアクセスサービスです。外出先からラズパイのデスクトップやターミナルをブラウザだけで操作できます。ポートフォワーディングもファイアウォール設定も不要。

- 画面共有（Screen sharing）
- リモートシェル（Remote shell）

### 普通にGUIで使う場合（Auth Key不要）

**「とりあえずリモートで繋ぎたいだけ」ならトークンは不要です。** Raspberry Pi ID（無料）だけでOK。

1. **Raspberry Pi IDを作成**（まだない場合）
   - https://id.raspberrypi.com/sign-up にアクセスしてアカウント作成
   - 確認メールのリンクをクリックして完了

2. **ラズパイ側でRaspberry Pi Connectを有効化**
   - メニュー → 設定 → Raspberry Piの設定 → 「インターフェイス」タブ
   - 「Raspberry Pi Connect」をオン
   - 右上に表示されるアイコンをクリック → Sign In → Raspberry Pi IDでログイン
   - デバイス名を入力して登録

3. **ブラウザで接続**
   - https://connect.raspberrypi.com/devices にアクセス
   - 登録したラズパイが表示される → 接続できる

### Auth Key（認証キー）が必要なケース

以下のケースでは Auth Key が必要です。**私はここで詰まりました。**

- GUIなしで自動登録したい（ヘッドレス運用）
- Raspberry Pi Imagerで事前設定したい
- 複数台まとめて登録したい

**取得手順：**

1. https://connect.raspberrypi.com/ にサインイン
2. **Settings** → **Auth keys** → **New** をクリック
3. 説明文と有効期限を入力して作成
4. **`rpuak_` で始まる長いキーが一度だけ表示される → すぐコピー（二度と見えない）**

**使い方：**

```bash
rpi-connect signin --auth-key=ここにコピーしたキー
```

### Management API Access Token（個人には不要）

組織で複数デバイスをAPI管理したい場合のみ使います。Settings → **API access tokens** → New で生成。これも一度しか表示されないので即コピー。

---

## まとめ

| やりたいこと | 必要なもの |
|---|---|
| GUIでリモート接続したいだけ | Raspberry Pi IDのみ |
| ヘッドレスで自動登録したい | Auth Key |
| APIで複数台管理したい | Management API Token |

- Auth Keyは有効期限あり。作ったら安全な場所に保存
- トラブル時は `rpi-connect status` で確認

---

## 参考

- npaka「Raspberry Pi 5 のセットアップ」: https://note.com/npaka/n/n254a702ca95e
- クラスメソッド DevelopersIO「Raspberry Piの初期設定をしてPCからSSH接続するまでの手順」（公開鍵で Imager 設定）: https://dev.classmethod.jp/articles/raspberry-pi-pc-ssh/
- Raspberry Pi Connect 公式ドキュメント: https://www.raspberrypi.com/documentation/services/connect.html
