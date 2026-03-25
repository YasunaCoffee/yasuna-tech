/**
 * OGP（1200×630）とトップ用サムネイル（960×540）を生成。
 * サムネ: タイトル（最大5行・折り返し）・カテゴリ（最大2行）・先頭1文字（絵文字は使わない）・著者・アイコン・★ブログ名
 * 外枠: OGP とサムネ共通の単色（フラット・#E9A6AF）
 *
 * 実行: deno task og
 *
 * フォント: 既定は jsDelivr → unpkg。両方失敗する場合は scripts/fonts/ に .woff を置くとローカル優先。
 */
import satori from "npm:satori@0.10.14";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import { parse as parseYaml } from "npm:yaml@2.6.1";
import { fromFileUrl, join, relative } from "jsr:@std/path@1.0.8";

const ROOT = fromFileUrl(new URL("../", import.meta.url));

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const POSTS_DIR = join(ROOT, "src", "posts");
const OG_DIR = join(ROOT, "src", "og");
const THUMB_DIR = join(ROOT, "src", "thumbnails");
/** Lume 用は src/public。ルート public もフォールバック。PNG は従来どおり */
const ICON_CANDIDATES: [string, string][] = [
  [join(ROOT, "src", "public", "yasuna_gal.jpg"), "image/jpeg"],
  [join(ROOT, "public", "yasuna_gal.jpg"), "image/jpeg"],
  [join(ROOT, "src", "img", "icon.png"), "image/png"],
];

const SITE_NAME = "yasunaのてっくぶろぐ";
const SITE_URL = Deno.env.get("SITE_URL") ??
  "https://yasunacoffee.github.io/yasuna-tech/";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const THUMB_WIDTH = 960;
const THUMB_HEIGHT = 540;

/** OGP（1200×630）とサムネ共通の外枠色（フラット・単色） */
const OGP_FRAME_COLOR = "#E9A6AF";
const OG_FRAME_WIDTH_PX = 20;

const NOTO_SANS_JP_VERSION = "5.2.8";
const FONT_WOFF_FILES = [
  "noto-sans-jp-japanese-400-normal.woff",
  "noto-sans-jp-japanese-700-normal.woff",
] as const;

/** CI 等で unpkg が 5xx になることがあるため、複数ミラー＋任意のローカル配置にフォールバック */
function fontSourceUrls(filename: string): string[] {
  const base = `@fontsource/noto-sans-jp@${NOTO_SANS_JP_VERSION}/files/${filename}`;
  return [
    `https://cdn.jsdelivr.net/npm/${base}`,
    `https://unpkg.com/${base}`,
  ];
}

async function loadFontWoff(filename: string): Promise<ArrayBuffer> {
  const localPath = join(ROOT, "scripts", "fonts", filename);
  try {
    if ((await Deno.stat(localPath)).isFile) {
      return await Deno.readFile(localPath);
    }
  } catch {
    // ローカルなし → リモートへ
  }
  const errors: string[] = [];
  for (const url of fontSourceUrls(filename)) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.arrayBuffer();
      errors.push(`${res.status} ${url}`);
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(
    `Font fetch failed for ${filename}. Tried: ${errors.join("; ")}`,
  );
}

async function loadFonts(): Promise<ArrayBuffer[]> {
  const out: ArrayBuffer[] = [];
  for (const file of FONT_WOFF_FILES) {
    out.push(await loadFontWoff(file));
  }
  return out;
}

async function loadResvgWasm(): Promise<void> {
  const wasmUrl =
    "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
  const res = await fetch(wasmUrl);
  if (!res.ok) throw new Error(`resvg wasm fetch failed: ${res.status}`);
  await initWasm(res);
}

function parseFrontmatter(path: string): Record<string, unknown> {
  const text = Deno.readTextFileSync(path);
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  return parseYaml(m[1]) as Record<string, unknown>;
}

function stem(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? "";
  return base.replace(/\.md$/i, "");
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

/** サムネに大きく表示する特別タグ（タグ名 → バッジ背景色） */
const FEATURE_TAGS: Record<string, string> = {
  "論文読んでみた": "#E9A6AF",
};

/** サムネ固定幅向け：指定行数まで均等に分割（最後の行がはみ出す場合は …） */
function wrapTextLines(
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  const maxTotal = maxCharsPerLine * maxLines;
  const body = t.length > maxTotal ? t.slice(0, maxTotal - 1) + "…" : t;
  const lines: string[] = [];
  for (let i = 0; i < body.length && lines.length < maxLines; i += maxCharsPerLine) {
    lines.push(body.slice(i, i + maxCharsPerLine));
  }
  return lines.length > 0 ? lines : [""];
}

function categoryLabel(data: Record<string, unknown>): string {
  if (typeof data.category === "string" && data.category.trim()) {
    return data.category.trim();
  }
  const tags = data.tags;
  if (Array.isArray(tags) && tags.length > 0) return String(tags[0]);
  return "ノート";
}

function authorName(data: Record<string, unknown>): string {
  if (typeof data.author === "string" && data.author.trim()) {
    return data.author.trim();
  }
  return "yasuna";
}

/** Satori + Noto Sans JP では絵文字が豆腐・欠損になるため、装飾文字に使う */
function pickInitial(category: string, title: string): string {
  const c = category.trim();
  if (c.length > 0) return c[0]!;
  const t = title.trim();
  if (t.length > 0) return t[0]!;
  return "・";
}

function fontDefs(
  fontData: ArrayBuffer,
  fontBoldData: ArrayBuffer,
): Array<{ name: string; data: ArrayBuffer; weight: number; style: string }> {
  return [
    { name: "Noto Sans JP", data: fontData, weight: 400, style: "normal" },
    { name: "Noto Sans JP", data: fontBoldData, weight: 700, style: "normal" },
  ];
}

function toPng(svg: string): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
  });
  const rendered = resvg.render();
  try {
    return rendered.asPng();
  } finally {
    rendered.free();
    resvg.free();
  }
}

function ogTree(
  title: string,
  category: string,
  iconDataUrl: string | undefined,
): Record<string, unknown> {
  const initial = pickInitial(category, title);
  const inner: Record<string, unknown> = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "56px 64px",
        backgroundColor: "#f8f9fc",
        fontFamily: "Noto Sans JP",
        borderRadius: 4,
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 24,
              flex: 1,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 72,
                    fontWeight: 700,
                    color: "#1a1c1e",
                    backgroundColor: "#e6e8ec",
                    width: 140,
                    height: 140,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  },
                  children: initial,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 58,
                    fontWeight: 700,
                    color: "#1d1b20",
                    lineHeight: 1.35,
                    letterSpacing: "-0.02em",
                  },
                  children: truncate(title, 64),
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 16,
              borderTop: "1px solid #dbe4ef",
              paddingTop: 24,
            },
            children: [
              ...(iconDataUrl
                ? [{
                  type: "img",
                  props: {
                    src: iconDataUrl,
                    width: 68,
                    height: 68,
                    style: {
                      borderRadius: 4,
                      border: "1px solid #c3c6cf",
                    },
                  },
                }]
                : []),
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: 32,
                          fontWeight: 700,
                          color: "#1a1c1e",
                        },
                        children: SITE_NAME,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 22, color: "#5b6b7a" },
                        children: new URL(SITE_URL).hostname,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        padding: `${OG_FRAME_WIDTH_PX}px`,
        backgroundColor: OGP_FRAME_COLOR,
        boxSizing: "border-box",
      },
      children: [inner],
    },
  };
}

function thumbTree(
  title: string,
  category: string,
  author: string,
  iconDataUrl: string | undefined,
  featureTag?: string,
): Record<string, unknown> {
  const frameWidth = 12;
  const outerR = 8;
  const innerR = Math.max(0, outerR - frameWidth);

  /** 絵文字は Noto で欠損するため、OG と同様にカテゴリ／タイトルの先頭1文字 */
  const categoryInitial = pickInitial(category, title);

  /** 1行あたり文字数（960×540・余白込みで折り返し優先） */
  const titleCharsPerLine = 26;
  const titleMaxLines = 5;
  const titleLines = wrapTextLines(title, titleCharsPerLine, titleMaxLines);
  const titleFontSize = titleLines.length >= 5
    ? 24
    : titleLines.length >= 4
    ? 26
    : titleLines.length >= 3
    ? 28
    : 30;

  const categoryLines = wrapTextLines(category, 20, 2);

  const inner: Record<string, unknown> = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "20px 24px",
        backgroundColor: "#f8f9fc",
        borderRadius: innerR,
        fontFamily: "Noto Sans JP",
        boxSizing: "border-box",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: 10,
              flexShrink: 0,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#1a1c1e",
                    backgroundColor: "#e6e8ec",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  },
                  children: categoryInitial,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    flex: 1,
                    minWidth: 0,
                  },
                  children: categoryLines.map((line) => ({
                    type: "div",
                    props: {
                      style: {
                        fontSize: 17,
                        fontWeight: 700,
                        color: "#1a1c1e",
                        backgroundColor: "#e6e8ec",
                        padding: "6px 12px",
                        borderRadius: 4,
                        lineHeight: 1.35,
                        wordBreak: "break-all",
                      },
                      children: line,
                    },
                  })),
                },
              },
            ],
          },
        },
        ...(featureTag
          ? [{
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "row",
                flexShrink: 0,
                paddingTop: 8,
              },
              children: [{
                type: "div",
                props: {
                  style: {
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#ffffff",
                    backgroundColor: FEATURE_TAGS[featureTag] ?? OGP_FRAME_COLOR,
                    padding: "6px 20px",
                    borderRadius: 20,
                    lineHeight: 1.35,
                  },
                  children: featureTag,
                },
              }],
            },
          }]
          : []),
        {
          type: "div",
          props: {
            style: {
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingTop: 10,
              paddingBottom: 10,
              minHeight: 0,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    width: "100%",
                  },
                  children: titleLines.map((line) => ({
                    type: "div",
                    props: {
                      style: {
                        fontSize: titleFontSize,
                        fontWeight: 700,
                        color: "#1d1b20",
                        lineHeight: 1.32,
                        letterSpacing: "-0.02em",
                        wordBreak: "break-all",
                      },
                      children: line,
                    },
                  })),
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderTop: "1px solid #cac4d0",
              paddingTop: 12,
              flexShrink: 0,
            },
            children: [
              ...(iconDataUrl
                ? [{
                  type: "img",
                  props: {
                    src: iconDataUrl,
                    width: 52,
                    height: 52,
                    style: {
                      borderRadius: 12,
                      border: "1px solid #cac4d0",
                      flexShrink: 0,
                    },
                  },
                }]
                : []),
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    flex: 1,
                    minWidth: 0,
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: 22,
                          fontWeight: 700,
                          color: "#1d1b20",
                          lineHeight: 1.25,
                          wordBreak: "break-all",
                        },
                        children: author,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#4a3d44",
                          lineHeight: 1.25,
                          wordBreak: "break-all",
                        },
                        children: `★ ${SITE_NAME}`,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        padding: `${frameWidth}px`,
        backgroundColor: OGP_FRAME_COLOR,
        borderRadius: outerR,
        boxSizing: "border-box",
      },
      children: [inner],
    },
  };
}

async function main(): Promise<void> {
  await Deno.mkdir(OG_DIR, { recursive: true });
  await Deno.mkdir(THUMB_DIR, { recursive: true });
  await loadResvgWasm();

  let iconDataUrl: string | undefined;
  for (const [iconPath, mime] of ICON_CANDIDATES) {
    try {
      const iconBytes = await Deno.readFile(iconPath);
      iconDataUrl = `data:${mime};base64,${toBase64(iconBytes)}`;
      break;
    } catch {
      // 次の候補
    }
  }

  const [fontData, fontBoldData] = await loadFonts();
  const fonts = fontDefs(fontData, fontBoldData);

  for await (const e of Deno.readDir(POSTS_DIR)) {
    if (!e.isFile || !e.name.endsWith(".md") || e.name === "_data.yml") continue;
    const path = join(POSTS_DIR, e.name);
    const data = parseFrontmatter(path);
    if (data.draft === true) {
      console.log(`skip draft: ${e.name}`);
      continue;
    }

    const title = String(data.title ?? stem(path));
    const slug = stem(path);
    const category = categoryLabel(data);
    const author = authorName(data);
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const featureTag = tags.find((t) => FEATURE_TAGS[t]);

    const ogSvg = await satori(ogTree(title, category, iconDataUrl) as never, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts,
    });
    const ogPng = await toPng(ogSvg);
    const ogPath = join(OG_DIR, `${slug}.png`);
    await Deno.writeFile(ogPath, ogPng);
    console.log(`og: ${relative(ROOT, ogPath)}`);

    const thumbSvg = await satori(
      thumbTree(title, category, author, iconDataUrl, featureTag) as never,
      {
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        fonts,
      },
    );
    const thumbPng = await toPng(thumbSvg);
    const thumbPath = join(THUMB_DIR, `${slug}.png`);
    await Deno.writeFile(thumbPath, thumbPng);
    console.log(`thumb: ${relative(ROOT, thumbPath)}`);
  }
}

main().catch((e) => {
  console.error(e);
  Deno.exit(1);
});
