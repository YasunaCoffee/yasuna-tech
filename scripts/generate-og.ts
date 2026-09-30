/**
 * OGP（1200×630）とトップ用サムネイル（960×540）を生成。
 * 見た目はスヤスヤ(suyasuya.me)の heisei テーマに合わせる:水色の水玉・青い枠の白い箱・アクアの見出し帯・
 * ピンクのリボン。字は Mochiy Pop P One(見出し・タイトル)と DotGothic16(アドレス)、足りない字は Noto Sans JP
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
const SITE_DESCRIPTION = "AIエージェントと書く技術ブログ";
/** サムネに出す住所。記事はスヤスヤ(suyasuya.me/tech/)にも載っているので、そちらを顔にする */
const SITE_HOME = "suyasuya.me/tech";
const SITE_URL = Deno.env.get("SITE_URL") ??
  "https://yasunacoffee.github.io/yasuna-tech/";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const THUMB_WIDTH = 960;
const THUMB_HEIGHT = 540;

/** heisei テーマの色(futon の themes/heisei/site.css と同じ) */
const H = {
  sky: "#CDEBFA", frame: "#3F97D6", frameDk: "#2A6FA8", paper: "#FFFFFF", ink: "#3A3A4A", sub: "#7A7A8C",
  pink: "#FF7FA8", pinkDk: "#C23A66", lemon: "#FFE66B",
};

/** 使うフォント(fontsource の woff)。同じ name を並べると、足りない字は次のものから拾われる */
const FONT_FILES = [
  { name: "Mochiy Pop P One", pkg: "mochiy-pop-p-one", version: "5.3.0", file: "mochiy-pop-p-one-japanese-400-normal.woff", weight: 400 },
  { name: "Mochiy Pop P One", pkg: "mochiy-pop-p-one", version: "5.3.0", file: "mochiy-pop-p-one-latin-400-normal.woff", weight: 400 },
  { name: "DotGothic16", pkg: "dotgothic16", version: "5.3.0", file: "dotgothic16-japanese-400-normal.woff", weight: 400 },
  { name: "DotGothic16", pkg: "dotgothic16", version: "5.3.0", file: "dotgothic16-latin-400-normal.woff", weight: 400 },
  { name: "Noto Sans JP", pkg: "noto-sans-jp", version: "5.2.8", file: "noto-sans-jp-japanese-400-normal.woff", weight: 400 },
  { name: "Noto Sans JP", pkg: "noto-sans-jp", version: "5.2.8", file: "noto-sans-jp-japanese-700-normal.woff", weight: 700 },
] as const;

/** CI 等で unpkg が 5xx になることがあるため、複数ミラー＋任意のローカル配置にフォールバック */
function fontSourceUrls(f: typeof FONT_FILES[number]): string[] {
  const base = `@fontsource/${f.pkg}@${f.version}/files/${f.file}`;
  return [
    `https://cdn.jsdelivr.net/npm/${base}`,
    `https://unpkg.com/${base}`,
  ];
}

async function loadFontWoff(f: typeof FONT_FILES[number]): Promise<ArrayBuffer> {
  const localPath = join(ROOT, "scripts", "fonts", f.file);
  try {
    if ((await Deno.stat(localPath)).isFile) {
      return (await Deno.readFile(localPath)).buffer as ArrayBuffer;
    }
  } catch {
    // ローカルなし → リモートへ
  }
  const errors: string[] = [];
  for (const url of fontSourceUrls(f)) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.arrayBuffer();
      errors.push(`${res.status} ${url}`);
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`Font fetch failed for ${f.file}. Tried: ${errors.join("; ")}`);
}

type FontDef = { name: string; data: ArrayBuffer; weight: number; style: string };
async function loadFonts(): Promise<FontDef[]> {
  const out: FontDef[] = [];
  for (const f of FONT_FILES) {
    out.push({ name: f.name, data: await loadFontWoff(f), weight: f.weight, style: "normal" });
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

/** サムネに大きく表示する特別タグ（タグ名 → バッジ背景色） */
const FEATURE_TAGS: Record<string, string> = {
  "論文読んでみた": "#E9A6AF",
};

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

/** 背景の白い水玉(heisei テーマの body と同じ、互い違いの格子)。satori の radial-gradient は重ねると出ないので丸を並べる */
function dots(u: number): Record<string, unknown> {
  const step = Math.round(44 * u), r = Math.round(8 * u);
  const w = Math.ceil(OG_WIDTH / step) + 1, h = Math.ceil(OG_HEIGHT / step) + 1;
  const children: Record<string, unknown>[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (const off of [0, step / 2]) {
        children.push({
          type: "div",
          props: {
            style: {
              position: "absolute", left: x * step + off - r, top: y * step + off - r,
              width: r * 2, height: r * 2, borderRadius: r, backgroundColor: "#FFFFFF",
            },
          },
        });
      }
    }
  }
  return { type: "div", props: { style: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "flex" }, children } };
}

/** heisei テーマの「箱」を1枚描く。u は倍率(OGP=1、サムネ=0.8) */
function heiseiCard(opt: {
  u: number;
  band: string;
  ribbon?: string;
  body: Record<string, unknown>;
  iconDataUrl?: string;
}): Record<string, unknown> {
  const { u, band, body, iconDataUrl } = opt;
  const ribbon = opt.ribbon && opt.ribbon !== band ? opt.ribbon : undefined;
  const px = (n: number) => Math.round(n * u);
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        padding: px(34),
        backgroundColor: H.sky,
        fontFamily: "Mochiy Pop P One, Noto Sans JP",
        boxSizing: "border-box",
        position: "relative",
      },
      children: [dots(u), {
        type: "div",
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundColor: H.paper,
            border: `${px(5)}px solid ${H.frame}`,
            borderRadius: px(22),
            boxShadow: `0 ${px(6)}px 0 ${H.frameDk}`,
            overflow: "hidden",
          },
          children: [
            // アクアの見出し帯(黄色い玉＋カテゴリ、右にピンクのリボン)
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: px(14),
                  padding: `${px(12)}px ${px(22)}px`,
                  backgroundImage: "linear-gradient(180deg, #8ED3FF 0%, #4AA8E8 55%, #3995D6 100%)",
                  color: "#FFFFFF",
                  fontSize: px(30),
                  textShadow: `0 ${px(2)}px 0 ${H.frameDk}`,
                },
                children: [
                  {
                    type: "div",
                    props: {
                      style: {
                        width: px(28),
                        height: px(28),
                        borderRadius: px(14),
                        backgroundImage: `radial-gradient(circle at 35% 35%, #FFFFFF, ${H.lemon} 45%, #F2B400)`,
                        border: `${px(2)}px solid #D39A00`,
                        flexShrink: 0,
                      },
                    },
                  },
                  { type: "div", props: { style: { display: "flex", flex: 1 }, children: band } },
                  ...(ribbon
                    ? [{
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontSize: px(24),
                          padding: `${px(6)}px ${px(18)}px`,
                          borderRadius: px(20),
                          backgroundImage: "linear-gradient(180deg, #FFB5CB 0%, #FF7FA8 55%, #F2628F 100%)",
                          textShadow: `0 ${px(2)}px 0 ${H.pinkDk}`,
                          border: `${px(2)}px solid #FFFFFF`,
                        },
                        children: ribbon,
                      },
                    }]
                    : []),
                ],
              },
            },
            // 上段:アイコン＋ブログ名＋アドレス(ドット文字)。帯のすぐ下に置く
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: px(16),
                  margin: `0 ${px(28)}px 0 0`,
                  padding: `${px(10)}px ${px(16)}px ${px(12)}px ${px(18)}px`,
                  borderBottom: `${px(3)}px dashed #A9D6F5`,
                },
                children: [
                  ...(iconDataUrl
                    ? [{
                      type: "img",
                      props: {
                        src: iconDataUrl,
                        width: px(104),
                        height: px(104),
                        style: { borderRadius: px(52), border: `${px(4)}px solid ${H.pink}`, flexShrink: 0 },
                      },
                    }]
                    : []),
                  {
                    type: "div",
                    props: {
                      style: { display: "flex", flexDirection: "column", gap: px(4) },
                      children: [
                        { type: "div", props: { style: { fontSize: px(32), color: H.frameDk }, children: SITE_NAME } },
                        { type: "div", props: { style: { fontSize: px(20), color: H.ink }, children: SITE_DESCRIPTION } },
                        {
                          type: "div",
                          props: {
                            style: { fontSize: px(22), color: H.sub, fontFamily: "DotGothic16, Noto Sans JP" },
                            children: SITE_HOME,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
            // 中身
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  flex: 1,
                  alignItems: "center",
                  padding: `${px(18)}px ${px(44)}px`,
                  minHeight: 0,
                },
                children: [body],
              },
            },
          ],
        },
      }],
    },
  };
}

function titleBlock(title: string, u: number): Record<string, unknown> {
  // 折り返しは satori に任せる(英単語は途中で切らない)。長さで字の大きさを変える
  const t = title.replace(/\s+/g, " ").trim();
  const size = t.length > 44 ? 44 : t.length > 30 ? 50 : 58;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        fontSize: Math.round(size * u),
        color: H.ink,
        lineHeight: 1.35,
        wordBreak: "keep-all",
        overflowWrap: "break-word",
      },
      children: t.length > 72 ? t.slice(0, 71) + "…" : t,
    },
  };
}

function ogTree(
  title: string,
  category: string,
  iconDataUrl: string | undefined,
  featureTag?: string,
): Record<string, unknown> {
  return heiseiCard({ u: 1, band: category, ribbon: featureTag, body: titleBlock(title, 1), iconDataUrl });
}

function thumbTree(
  title: string,
  category: string,
  _author: string,
  iconDataUrl: string | undefined,
  featureTag?: string,
): Record<string, unknown> {
  return heiseiCard({ u: 0.8, band: category, ribbon: featureTag, body: titleBlock(title, 0.8), iconDataUrl });
}


function topOgTree(iconDataUrl: string | undefined): Record<string, unknown> {
  return heiseiCard({
    u: 1,
    band: "ようこそ!",
    body: {
      type: "div",
      props: {
        style: { display: "flex", flexDirection: "column", gap: 18 },
        children: [
          { type: "div", props: { style: { fontSize: 72, color: H.frameDk }, children: SITE_NAME } },
        ],
      },
    },
    iconDataUrl,
  });
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

  const fonts = await loadFonts();

  // トップページ用 OGP 画像を生成
  const topSvg = await satori(topOgTree(iconDataUrl) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });
  const topPng = toPng(topSvg);
  const topPath = join(OG_DIR, "index.png");
  await Deno.writeFile(topPath, topPng);
  console.log(`og: ${relative(ROOT, topPath)}`);

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

    const ogSvg = await satori(ogTree(title, category, iconDataUrl, featureTag) as never, {
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
