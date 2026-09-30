# このリポジトリで AI エージェントがやること

[Lume](https://lume.land/) + [Simple Blog テーマ](https://lume.land/theme/simple-blog/) の静的ブログ。
記事は **yasuna 文体**で書く。

## どこに何があるか

| 用途 | パス |
|------|------|
| 文体・トーン（記事を書く前に必ず読む） | `prompts/yasuna-style-prompt.md` |
| フロントマターと記事の雛形 | `templates/post.md` |
| Claude の振る舞い調整 | `CLAUDE.md` |
| 記事執筆の手順 | `.claude/skills/yasuna-tech-post/SKILL.md` |
| ビルド・プレビュー・OGP・リンクカード | `.claude/skills/yasuna-tech-build/SKILL.md` |
| 2026 実績ページの更新手順 | `.cursor/skills/jisseki-2026-update/SKILL.md` |

公開記事は `src/posts/*.md`、下書きは `drafts/*.md`（**ビルド対象外**）。
ユーザー指示がない限り、公開用は `src/posts/` のみ触る。

新規記事の手順は `yasuna-tech-post` スキル。骨子だけ書くと、
テーマ・狙い・公開予定日を確認 → 文体プロンプトを読む → `templates/post.md` から起こす →
`drafts/` か `src/posts/` に `kebab-case.md` で置く。

## 落とし穴

このリポジトリ固有で、ファイルを見ただけでは分からないもの。

- **ビルドは順序依存。** `deno task build` / `dev` は先に `og`（サムネ・OGP 生成）を走らせてから
  Lume を動かす。記事を追加・編集したら `deno task dev` を使うとサムネが更新される。
- **サムネはコミットする。** 記事を足したら `deno task og` を流して、`src/thumbnails/` と `src/og/` の画像も
  同じ変更に入れる。スヤスヤ(suyasuya.me)が `src/thumbnails/` をそのまま取り込むので、古いまま・無いままだとそちらに出ない。
- **トップページは本文も抜粋も出さない。** 自動生成サムネ `/thumbnails/{slug}.png` のグリッドのみ。
  記事の第一印象はサムネで決まる。
- **`category` を省略すると、先頭の `tags` がサムネ上のカテゴリ表示になる。**
- **`emoji` はサムネ・OGP にも使われる**（`scripts/generate-og.ts`）。見出し横だけではない。
- **タイトルに Noto Sans JP で表示できない文字を使わない**（`――` など）。区切りは `：`。
- **これは Zenn ではない。** Zenn 専用の `:::message` はそのままでは効かないことがある。
  呼び出しが必要なら通常の引用・見出しで代用する。
- **リンクカードはキャッシュ経由。** 言語指定を `linkcard` にしたフェンスに URL を足したら
  `deno task linkcards` を実行し、`linkcards.cache.json` を**コミットする**。
  ビルド時はこのキャッシュを読むので**ビルド自体はネット不要**（CI で安全）。
  未取得の URL はホスト名だけの簡易カードにフォールバックする。
  GitHub Actions のデプロイでも毎回 `deno task linkcards` を流すので、手元で取れなかった URL もデプロイ時に埋まる。
  X のポスト（`x.com/…/status/…`）を linkcard に入れると、カードではなくポストの埋め込みになる。
- **実績ページは手動同期。** 記事を 2026 年の実績に載せるなら、同じ変更のなかで
  `src/posts/jisseki-2026.md` も更新する。「載せない」と言われた記事は対象外。

## やらないこと

- `_site/` を手で編集しない（ビルド成果物）。
- ユーザーの実体験と矛盾する事実を捏造しない。不明な点は質問する。
- 文体プロンプトにない **別ペルソナ** に勝手に切り替えない。
