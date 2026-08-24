import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";
import blog from "https://deno.land/x/lume_theme_simple_blog@v0.15.11/mod.ts";
import markdown from "lume/plugins/markdown.ts";

const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:3000/";

function siteBaseUrl(): URL {
  return new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`);
}

/** Lume の page.src は文字列または { path, ext } */
function pageSrcPath(src: unknown): string {
  if (typeof src === "string") return src;
  if (src && typeof src === "object" && "path" in src) {
    const o = src as { path: string; ext?: string };
    return `${o.path}${o.ext ?? ""}`;
  }
  return String(src ?? "");
}

const site = lume({
  src: "./src",
  location: new URL(siteUrl),
});

/** OGP リンクカード: scripts/generate-linkcards.ts が書くキャッシュを読む（ビルド時はネット不要） */
type LinkCard = {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
};
let LINKCARDS: Record<string, LinkCard> = {};
try {
  LINKCARDS = JSON.parse(
    Deno.readTextFileSync(new URL("./linkcards.cache.json", import.meta.url)),
  );
} catch {
  // キャッシュ未生成なら空（フォールバックのホスト名カードになる）
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

function renderLinkCard(rawUrl: string): string {
  const url = decodeEntities(rawUrl).trim();
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch { /* そのまま */ }
  const c = LINKCARDS[url];
  const title = escapeHtml(c?.title || host);
  const desc = c?.description ? escapeHtml(c.description) : "";
  const site = escapeHtml(c?.siteName || host);
  const img = c?.image
    ? `<span class="link-card-thumb"><img src="${
      escapeHtml(c.image)
    }" alt="" loading="lazy" decoding="async"></span>`
    : "";
  return `<a class="link-card${c?.image ? "" : " link-card--noimg"}" href="${
    escapeHtml(url)
  }" target="_blank" rel="noopener noreferrer">` +
    img +
    `<span class="link-card-body">` +
    `<span class="link-card-title">${title}</span>` +
    (desc ? `<span class="link-card-desc">${desc}</span>` : "") +
    `<span class="link-card-host">${site}</span>` +
    `</span></a>`;
}

/** 記事 HTML 内の ```linkcard コードブロックをカードのグリッドに置換 */
site.process([".html"], (pages) => {
  const re =
    /<pre[^>]*>\s*<code[^>]*class="[^"]*language-linkcard[^"]*"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g;
  for (const page of pages) {
    if (typeof page.content !== "string") continue;
    if (!page.content.includes("language-linkcard")) continue;
    page.content = page.content.replace(re, (_m, inner: string) => {
      const cards = inner
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /https?:\/\//i.test(l))
        .map(renderLinkCard)
        .join("");
      return cards ? `<div class="link-card-grid">${cards}</div>` : "";
    });
  }
});

/** public/ 相当: src/public をサイトルートへ（例: /yasuna_gal.jpg） */
site.copy("public", "/");

/** generate-og.ts の PNG（Lume が既定で拾わないため明示コピー） */
site.copy("og");
site.copy("thumbnails");

site.use(markdown({ options: { linkify: true } }));
/**
 * feed の既定値はテーマ側で `=metas.site` / `=metas.description` を参照している。
 * og:*・twitter:* の二重出力を避けるためサイト共通メタを `site_meta` に改名したので、
 * feed の情報源もそちらへ明示的に向け直す。
 */
site.use(blog({
  feed: {
    info: {
      title: "=site_meta.site",
      description: "=site_meta.description",
    },
  },
}));

/** GitHub Pages のプロジェクトサイト（/REPO/）で /thumbnails 等の絶対パスを直す */
site.use(basePath());

/**
 * og:*・twitter:* の重複を落とす（同じキーは最初の 1 つだけ残す）。
 *
 * テーマは metas プラグインを常に use しており、無効化オプションが無い。
 * データ側で `metas: false` にしても、プラグインが登録する object マージで `{}` に
 * なるため止まらず、og:type=website / twitter:card=summary という既定値が出る。
 * これは base.vto が出す article / summary_large_image と食い違うので、
 * プラグインより後に走るこの process で後勝ちのタグを取り除く。
 * （blog() より後に登録することで実行順を担保している）
 */
site.process([".html"], (pages) => {
  const metaRe = /[^\S\n]*<meta\s+(?:property|name)="((?:og|twitter):[^"]+)"[^>]*>\n?/g;
  for (const page of pages) {
    if (typeof page.content !== "string") continue;
    const seen = new Set<string>();
    page.content = page.content.replace(metaRe, (tag, key: string) => {
      if (seen.has(key)) return "";
      seen.add(key);
      return tag;
    });
  }
});

/** 記事の OGP 画像パスと lastUpdated（updated ?? date）を設定 */
site.preprocess([".md"], (pages) => {
  for (const page of pages) {
    const src = pageSrcPath(page.src);
    const m = src.match(/(?:^|[/\\])posts[/\\]([^/\\]+)\.md$/i);
    if (!m || m[1] === "_data") continue;
    const stem = m[1];
    page.data.image = `/og/${stem}.png`;
    // updated が設定されていればそちらを、なければ date を使う（Date オブジェクトに統一）
    const rawDate = page.data.updated ?? page.data.date;
    page.data.lastUpdated = rawDate instanceof Date
      ? rawDate
      : new Date(String(rawDate));
  }
});

/** 記事の URL から og 画像の絶対 URL（レイアウトで meta 用） */
site.filter("postOgImage", (url: unknown) => {
  if (url == null) return "";
  const m = String(url).match(/\/posts\/([^/]+)\/?$/);
  if (!m) return "";
  // 先頭スラッシュ付き `/og/...` だとベースのパス（例: GitHub Pages の /repo/）が落ちる
  return new URL(`og/${m[1]}.png`, siteBaseUrl()).href;
});

/** トップのサムネ（generate-og.ts → src/thumbnails/{slug}.png）のパス */
site.filter("thumbUrl", (basename: unknown) => {
  if (basename == null) return "";
  return new URL(`thumbnails/${String(basename)}.png`, siteBaseUrl()).pathname;
});

/** SNS 共有 URL 用 */
site.filter(
  "encodeURIComponent",
  (s: unknown) => encodeURIComponent(String(s ?? "")),
);

/**
 * GitHub Pages のプロジェクトサイト（/REPO/）では、Feed 本文内の Markdown リンクが
 * Lume の `fixUrls` で `new URL("/posts/...", 記事URL)` となり、ベースパスが落ちる。
 * feed プラグインは `beforeSave` でページを追加するため、同イベント内で（追加後に）置換する。
 */
site.addEventListener("beforeSave", () => {
  const base = siteBaseUrl();
  const repoPath = base.pathname.replace(/\/$/, "") || "";
  if (!repoPath) return;
  const wrong = `${base.origin}/posts/`;
  const right = `${base.origin}${repoPath}/posts/`;
  for (const page of site.pages) {
    const out = page.outputPath;
    if (!out.endsWith("feed.xml") && !out.endsWith("feed.json")) continue;
    if (typeof page.content !== "string") continue;
    page.content = page.content.replaceAll(wrong, right);
  }
});

export default site;
