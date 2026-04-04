---
title: "RasPi5 8GBにGemma4をOllamaで入れてPicoClawと繋ごうとした話"
date: "2026-04-04"
author: yasuna
emoji: "🫐"
category: "個人開発"
tags:
  - 個人開発
  - RaspberryPi
  - LLM
  - Ollama
  - ローカルLLM
  - AIエージェント
draft: false
description: "Raspberry Pi 5 8GBにGemma4をOllamaで動かしてPicoClawと連携するセットアップを試みた記録。e4bはRAM不足で動かず、e2bは動いたけどthinkingが遅い問題にぶつかった。"
---

こんにちは！yasunaです！

Raspberry Pi 5 8GBに完全ローカルのAIエージェントを作ろうとして、いろいろぶつかった記録です。

構成のイメージはこう：
- **Gemma4**（Googleの小さいモデル）をOllamaで動かして「脳」にする
- **PicoClaw**（Go製の超軽量エージェント）を「手足」にする
- Mac（Warp）からSSHして操作する

結果から言うと：**動いたけど遅い**、がいまの状況です。

---

# 環境

- Raspberry Pi 5 8GB
- microSD 32GB
- Mac から Warp でSSH接続
- OS：Raspberry Pi OS Lite 64bit（Bookworm）

---

# まずOllamaを入れる

インストールは公式スクリプト一発：

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

次にGemma4を pull する。最初は e4b（Effective 4B）を入れた。

```bash
ollama pull gemma4:e4b
```

ダウンロード自体は通った。

---

# e4bはRAMが足りなかった

起動してみたら即エラー：

```
Error: 500 Internal Server Error: model requires more system memory (9.9 GiB) than is available (9.2 GiB)
```

Gemma4のe4bはOllamaで約9.6GBのRAMが必要で、Pi5 8GBだとOS・Ollama本体・KV cacheで9.2GiBしか使えない状態。厳しくチェックされて弾かれた。

`free -h` で確認したときのRAMはこんな感じ：

```
               total        used        free      shared  buff/cache   available
Mem:           7.9Gi       581Mi       366Mi        37Mi       7.1Gi       7.3Gi
Swap:          2.0Gi         0B       2.0Gi
```

SDカードの残量も：

```
Filesystem      Size  Used Avail Use% Mounted on
/dev/mmcblk0p2   28G   20G  7.6G  72% /
```

e4bのダウンロードでもう20GB消費してた。残り7.6GB。

---

# e2bに切り替えた

e4bを削除してe2b（Effective 2B、約7.2GB）を入れ直し：

```bash
ollama rm gemma4:e4b
ollama pull gemma4:e2b
ollama run gemma4:e2b
```

今度は起動した。

ただし `watch -n 2 free -h` でモデルがthinking中（推論中）を見ると：

```
Mem:           7.9Gi       7.3Gi       300Mi        20Mi       399Mi       606Mi
Swap:          2.0Gi       1.4Gi       659Mi
```

Swapが1.4GiBも使われてavailableが600Mi台まで落ちてた。

---

# コンテキストを小さくしたら倍くらい速くなった

```bash
OLLAMA_NUM_CTX=2048 ollama run gemma4:e2b
```

これだけで体感2倍くらい速くなった。

デフォルトのコンテキストサイズ（128K）で起動するとKV cacheが大きくてRAMを圧迫するけど、2048に絞るとそのぶん軽くなる。

さらに1024にするともう少し速くなる：

```bash
OLLAMA_NUM_CTX=1024 ollama run gemma4:e2b
```

---

# thinkingが入ると遅い

コンテキストを絞って速くなったとはいえ、Gemma4がthinking（内部で推論する）モードに入ると待ち時間が長くなる。普段遣いにはちょっと遅い感覚。

`/set nothink` を試したが、Gemma4シリーズはDeepSeekやQwenと違ってthinkingの制御があまり効かない設計になっているらしく、変化が薄かった。

システムプロンプトで「思考は短く」と指示するのが現実的な対処：

```
あなたはRaspberry Pi 5で動く超軽量エージェントです。
思考はできるだけ短く1〜2ステップ以内にまとめて。
長く考えないで、すぐに結論と返事を出して。
返事は日本語で簡潔に。
```

---

# Modelfileで設定しようとしたら日本語が文字化けした

`/set system` がGemma4に効きにくかったので、Modelfileでカスタムモデルを作ろうとした：

```
FROM gemma4:e2b

SYSTEM """
あなたはRaspberry Pi 5で動く超軽量エージェントです。
...
"""

PARAMETER num_ctx 1024
```

しかし nano でコピペすると日本語が全部 `^a^b ^a ^a^=` みたいな記号に化けた。

原因はロケール設定。Pi OS Lite には最初から日本語ロケールが入っていない：

```bash
export LANG=ja_JP.UTF-8
# → bash: warning: setlocale: LC_ALL: cannot change locale (ja_JP.UTF-8): No such file or directory
```

`sudo dpkg-reconfigure locales` → `/etc/locale.gen` を編集 → `sudo locale-gen` の手順で `ja_JP.UTF-8` を生成して解決した。

```bash
locale
# LANG=ja_JP.UTF-8
# LC_ALL=ja_JP.UTF-8
# ... 正常に表示
```

---

# PicoClawはまだ途中

PicoClawのconfig.jsonを開こうとしたら：

```bash
~/.picoclaw/config.json
# Permission denied
```

`picoclaw onboard` 実行済みでも出る場合は、`sudo` で実行したことで所有権がrootになっているパターンが多い：

```bash
sudo chown -R pi:pi ~/.picoclaw
chmod -R 755 ~/.picoclaw
```

その後 `nano ~/.picoclaw/config.json` で開けるようになる。

設定内容はこんな感じ：

```json
{
  "agents": {
    "defaults": {
      "model_name": "gemma-local",
      "system_prompt": "思考は短く。すぐに結論を出して。"
    }
  },
  "model_list": [
    {
      "model_name": "gemma-local",
      "model": "ollama/gemma4:e2b",
      "api_base": "http://localhost:11434/v1",
      "api_key": "ollama"
    }
  ]
}
```

`picoclaw agent` で起動してGemma4:e2bと会話できるはず——の段階まで来ている。

---

# 今日わかったこと

- Pi5 8GBでGemma4は **e2b** が現実的（e4bはRAM不足で起動すら無理）
- `OLLAMA_NUM_CTX=1024` or `2048` を指定するだけで体感速度が大きく変わる
- thinkingはプロンプトで抑えられるが根本解決ではない
- Pi OS LiteにはデフォルトでUTF-8日本語ロケールが入っていないので先に設定する
- `picoclaw onboard` を `sudo` でやると所有権がrootになってconfig.jsonが触れなくなる

32GB SDカード・Pi5 8GBという制約の中で、完全ローカルAIエージェントを動かすのはギリギリ可能。でも「普段遣いで待ちなし」にするにはモデルの選択がシビア。phi3:miniやgemma2:2bのほうが速い可能性があって、次はそのあたりを試したい。

