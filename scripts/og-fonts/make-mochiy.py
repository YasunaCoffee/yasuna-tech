"""サムネ・OGP 用に、Mochiy Pop P One(日本語)の開きかっこの位置を直した字体を作る。

なぜ要るか:
  Mochiy Pop P One の開きかっこ「『〈《【〔は、字の形が字の幅の外(右)に置かれていて、
  左余白(hmtx の lsb)で位置を合わせる作りになっている。ブラウザなど普通の描画は lsb に合わせるので正しく見えるが、
  サムネを描く satori(中の opentype.js)は形の座標をそのまま描くので、開きかっこが約 0.58 字ぶん右にずれ、
  次の字に重なって隠れる(「AI…」の「 が A の下に入る)。
  satori は1行をまとめて1つの字体で描くので、開きかっこだけ別の字体にする方法は効かない。字体そのものを直す。

やること:
  開きかっこ 6 字だけ、形を lsb の位置へ動かす(ほかの字は1つも変えない。ほかの記事のサムネが変わらないように)。

使い方(fontTools が要る: pip install fonttools):
  python3 scripts/og-fonts/make-mochiy.py <fontsource の mochiy-pop-p-one-japanese-400-normal.woff>
  → scripts/og-fonts/mochiy-pop-p-one-japanese-400-og.woff

元の字体は Mochiy Pop P One(@fontsource/mochiy-pop-p-one@5.3.0、SIL Open Font License 1.1、
https://github.com/fontdasu/Mochiypop)。手を入れた版も OFL で配る(scripts/og-fonts/OFL.txt)。
"""
import os
import sys

from fontTools.ttLib import TTFont

BRACKETS = "「『〈《【〔"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mochiy-pop-p-one-japanese-400-og.woff")

font = TTFont(sys.argv[1])
cmap = font.getBestCmap()
glyf, hmtx = font["glyf"], font["hmtx"]
for ch in BRACKETS:
    name = cmap[ord(ch)]
    g = glyf[name]
    dx = hmtx[name][1] - g.xMin
    if dx:
        coords, _, _ = g.getCoordinates(glyf)
        coords.translate((dx, 0))
        g.coordinates = coords
        g.recalcBounds(glyf)
    print(f"{ch}: {dx:+d}")

font.flavor = "woff"
font.save(OUT)
print(OUT)
