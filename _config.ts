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

/** public/ 相当: src/public をサイトルートへ（例: /yasuna_gal.jpg） */
site.copy("public", "/");

/** generate-og.ts の PNG（Lume が既定で拾わないため明示コピー） */
site.copy("og");
site.copy("thumbnails");

site.use(markdown({ options: { linkify: true } }));
site.use(blog());

/** GitHub Pages のプロジェクトサイト（/REPO/）で /thumbnails 等の絶対パスを直す */
site.use(basePath());

/** 記事の OGP 画像パス（generate-og.ts が出力する /og/{slug}.png） */
site.process([".md"], (pages) => {
  for (const page of pages) {
    const src = pageSrcPath(page.src);
    const m = src.match(/(?:^|[/\\])posts[/\\]([^/\\]+)\.md$/i);
    if (!m || m[1] === "_data") continue;
    const stem = m[1];
    page.data.image = `/og/${stem}.png`;
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
site.filter("encodeURIComponent", (s: unknown) =>
  encodeURIComponent(String(s ?? ""))
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
