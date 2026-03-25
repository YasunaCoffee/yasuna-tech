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
draft: false
---

こんにちは！yasunaです！

ラズパイ5を初めて買いました！！わくわくしながらOS書き込みの手順を調べて [npaka さんの note](https://note.com/npaka/n/n254a702ca95e) を見ながらやっていたんですが、**SSHが5回以上つながらず**、さらに**Raspberry Pi Connectのトークン取得もどこにも書いてなくて詰まった**のでまとめます。忘却録です。

## SSH地獄編

まずConnectの前にSSHで詰まりました。5回ぐらい焼き直しました。

### エラーの変遷

**最初（1回目の接続）**：ホストキー登録のあと `Permission denied, please try again.` → パスワード問題

**次：** `kex_exchange_identification: read: Connection reset` → SSHデーモンが接続を即切断

**その次：** `Permission denied (publickey,password).` → 認証方法ごと弾かれる

**さらに：** `Connection closed by 192.168.11.25 port 22` → 接続はできるけどすぐ切れる

どんどんエラーが変わっていって混乱しました。

### 原因

SDカードの `bootfs` に `userconf.txt` も `ssh` ファイルも存在していなかった。つまり **Imagerの設定が全く書き込まれていなかった**のが根本原因です。

やらかしポイント：**ユーザー名に使えない文字を入れていた**

Imagerで `The username must be lowercase and contain only letters numbers underscore and hyphens` というバリデーションエラーが出ていました。このエラーが出たまま「保存」を押しても設定が保存されず、`userconf.txt` が生成されないままSDカードに書き込まれていました。

### 焼き直しの正しい手順

Imagerで焼くとき、設定ボタンを先に押してエラーが出ないことを確認してから書き込みます：

1. OSを選ぶ
2. SDカードを選ぶ
3. ⚙️ **設定ボタンを先に押す**
   - ✅ ホスト名: `raspi5`
   - ✅ ユーザー名: `pi`（小文字英数字のみ、これ重要）
   - ✅ パスワード: 英数字のみのシンプルなもの
   - ✅ SSH有効化: パスワード認証
4. 「保存」→「書き込み」

起動まで2〜3分待ってから接続。

### 焼き直さずに手動で直す方法

一度焼いてしまったSDカードをMacに挿して、`bootfs` に2つのファイルを手動で作れば焼き直し不要です。

**① SSHを有効化**

```bash
touch /Volumes/bootfs/ssh
```

**② ユーザーとパスワードを設定**

`userconf.txt` にパスワードハッシュを書き込みます。ハッシュの生成は `openssl` を使います（Python 3.13では `crypt` モジュールが削除されているので注意）。

```bash
openssl passwd -6 あなたのパスワード
```

`$6$` で始まる長い文字列が出てきたらそれを使います：

```bash
echo 'pi:$6$ここにハッシュを貼る' > /Volumes/bootfs/userconf.txt
```

確認：

```bash
cat /Volumes/bootfs/userconf.txt
# pi:$6$... と表示されればOK
```

SDカードをラズパイに戻したら、**必ず電源を一度抜いて入れ直してください**。ファイルを追加しただけでは反映されません。再起動して初めて `userconf.txt` が読み込まれます。

---

## Raspberry Pi Connectってなに

公式のブラウザ経由リモートアクセスサービスです。外出先からラズパイのデスクトップやターミナルをブラウザだけで操作できます。ポートフォワーディングもファイアウォール設定も不要なのが便利なところ。

- 画面共有（Screen sharing）
- リモートシェル（Remote shell）

の2機能が使えます。

---

## パターン1：普通にGUIで使う（Auth Key不要・一番かんたん）

**「とりあえずリモートで繋ぎたいだけ」ならトークンは不要です。** Raspberry Pi ID（無料）だけでOK。

### 手順

1. **Raspberry Pi IDを作成**（まだない場合）
   - https://id.raspberrypi.com/sign-up にアクセス
   - メールアドレスとパスワードを入力してアカウント作成
   - 届いた確認メールのリンクをクリックして完了

2. **ラズパイ側でRaspberry Pi Connectを有効化**
   - Raspberry Pi OS（Bookworm以降推奨）でメニュー → 設定 → Raspberry Piの設定 → 「インターフェイス」タブ
   - 「Raspberry Pi Connect」のスイッチをオンにする
   - 右上のメニューアイコン（円形のアイコン）が表示されるのでクリック → Sign In
   - ブラウザが開くので、Raspberry Pi IDでログイン
   - デバイス名（例: `MyPi5`）を入力して登録

3. **完了！**
   - ブラウザで https://connect.raspberrypi.com/devices にアクセス
   - 登録したラズパイが表示される → 接続できる

これだけでOKです。トークンとか一切出てこない。

---

## パターン2：Auth Key（認証キー）を取得する場合

以下のケースで必要になります。

- GUIなしで自動登録したい（ヘッドレス運用）
- Raspberry Pi Imagerで事前設定したい
- 複数台まとめて登録したい
- 組織管理（Connect for Organisations）を使いたい

**私はこのパターンが必要だったのに、手順が見当たらなくて詰まりました。** ここです。

### Auth Keyの取得手順

1. https://connect.raspberrypi.com/ にアクセスしてRaspberry Pi IDでサインイン
2. **Settings（設定）タブ**を開く（右上あたり）
3. **Auth keys セクション**で **New（新規作成）** をクリック
4. 説明文（Description）と有効期限（Expiry time in days）を入力
5. 作成すると **`rpuak_` で始まる長いキー**が**一度だけ表示される** → **すぐコピー！（二度と見えません）**

### 使い方

ラズパイのターミナルで：

```bash
rpi-connect signin --auth-key=ここにコピーしたキー
```

または、ファイルに保存して自動化することもできます。

---

## パターン3：Management API Access Token（高度な自動化用）

組織で複数デバイスをAPI管理したい場合などに使います。個人ユーザーは普通は不要です。

- SettingsページのAPI access tokensセクションで **New** をクリック
- 説明を入力 → トークンが**一度だけ表示される**（コピー必須）

これを使って管理API経由でAuth Keyを自動生成したりできます。

---

## まとめ・注意点

- **「普通にGUIで使いたいだけ」ならAuth Key不要**
- **「ヘッドレスで自動登録したい」ならAuth Keyを作る**
- Auth Keyは有効期限あり・使い捨てなので、作ったら安全な場所に保存
- トラブル時はラズパイ側で `rpi-connect status` コマンドで確認できる

公式ドキュメントが一番詳しいです：
https://www.raspberrypi.com/documentation/services/connect.html

---

## 参考

- npaka「Raspberry Pi 5 のセットアップ」: https://note.com/npaka/n/n254a702ca95e
- Raspberry Pi Connect 公式ドキュメント: https://www.raspberrypi.com/documentation/services/connect.html
