#!/usr/bin/env python3
"""Cut the Japanese, Korean, Chinese and Thai fonts down to the characters index.html prints.

    pip install fonttools brotli
    python3 assets/fonts/subset.py <folder holding the full fonts>

Full fonts (all SIL Open Font License 1.1, see LICENSE.txt):
  ShipporiMinchoB1-Medium.ttf, ShipporiMinchoB1-ExtraBold.ttf   github.com/google/fonts  ofl/shipporiminchob1
  SongMyung-Regular.ttf                                          github.com/google/fonts  ofl/songmyung
  ChillHuoSong_F_Regular.otf, ChillHuoSong_F_ExBold.otf          github.com/Warren2060/ChillMovableType  release HuoSongv1.000
  NotoSerifThai-VF.ttf  (saved from NotoSerifThai[wdth,wght].ttf) github.com/google/fonts  ofl/notoserifthai
      a variable font: it is fixed at full width and at weight 500 and 800 before it is cut
The characters come from the I18N table in index.html: everything between /*[ja]*/, /*[ko]*/, /*[zh]*/, /*[th]*/ and the next marker.
The heavy (-800) cuts hold only what is printed heavy: the gowns' titles and the first letter of each story.
"""
import re, sys, pathlib
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

here = pathlib.Path(__file__).resolve().parent
src = pathlib.Path(sys.argv[1])
page = (here.parent.parent / 'index.html').read_text(encoding='utf-8')
EXTRA = '、。・「」（）：，！？…—·〜' + 'ๆฯ๐๑๒๓๔๕๖๗๘๙'   # punctuation (and Thai figures) worth having for the next edit
MARKS = '\u0E31\u0E34-\u0E3A\u0E47-\u0E4E'     # the Thai vowel and tone marks written on a letter: a story's first letter keeps its own
ONLY = {'zh': '陕备号ICP0123456789-'}         # outside the I18N table: the record number shown on the China address (lumiloom.cn), set whole in the Chinese face —
                                               # its capitals and its figures too, because that face's figures all stand on one line and Fell's do not
JOBS = [('ja', 'ShipporiMinchoB1-Medium.ttf', 'lumi-ja-500'), ('ja', 'ShipporiMinchoB1-ExtraBold.ttf', 'lumi-ja-800'),
        ('ko', 'SongMyung-Regular.ttf', 'lumi-ko-400'),
        ('zh', 'ChillHuoSong_F_Regular.otf', 'lumi-zh-400'), ('zh', 'ChillHuoSong_F_ExBold.otf', 'lumi-zh-800'),
        ('th', 'NotoSerifThai-VF.ttf', 'lumi-th-500'), ('th', 'NotoSerifThai-VF.ttf', 'lumi-th-800')]
for lang, file, out in JOBS:
    block = re.search(r'/\*\[' + lang + r'\]\*/(.*?)/\*\[', page, re.S).group(1)
    ours = (lambda c: 0x0E00 <= ord(c) <= 0x0E7F) if lang == 'th' else (lambda c: ord(c) > 0x2000)
    if out.endswith('-800'):                        # the heavy cut prints only the gowns' titles and the first letter of each story
        tales = block[block.index('outfits:'):block.index('aria:')]
        chars = sorted({c for t, cap in re.findall(r"\['([^']+)','([^']?[" + MARKS + r"]*)", tales) for c in t + cap if ours(c)})
    else:
        chars = sorted({c for c in block + EXTRA if ours(c)} | set(ONLY.get(lang, '')))
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']; opt.name_IDs = [1, 2, 3, 4, 6]; opt.notdef_outline = True
    font = TTFont(src / file)
    if 'fvar' in font: font = instancer.instantiateVariableFont(font, {'wght': int(out.rsplit('-', 1)[1]), 'wdth': 100})
    have = set(font.getBestCmap())
    missing = [c for c in chars if ord(c) not in have]
    sub = subset.Subsetter(opt); sub.populate(text=''.join(chars)); sub.subset(font)
    fam = 'Lumi ' + lang.upper()                    # the cut-down copies carry their own name, not the original's
    for rec in font['name'].names:
        if rec.nameID in (1, 4): rec.string = fam
        elif rec.nameID == 6: rec.string = fam.replace(' ', '') + '-' + out.rsplit('-', 1)[1]
        elif rec.nameID == 3: rec.string = fam + ' ' + out
    font.flavor = 'woff2'; font.save(here / (out + '.woff2'))
    print(f'{out}.woff2  {len(chars)} characters  {(here / (out + ".woff2")).stat().st_size / 1024:.1f} KB' + (f'  MISSING: {"".join(missing)}' if missing else ''))
