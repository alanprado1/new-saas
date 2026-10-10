# Third-party licenses

## AnimCJK Japanese brush artwork — Arphic Public License

The default 2,136 Jōyō animations use the Japanese `svgsJa` artwork from [AnimCJK](https://github.com/parsimonhi/animCJK), pinned at `ec5e17cca76c87587790bcbce5ea0b4d4fb753d6`. Copyright © FM-SH 2016–2026. This artwork derives from MakeMeAHanzi and the Arphic PL KaitiM GB / Big5 fonts, copyright © 1999 Arphic Technology Co., Ltd.; Japanese forms were adapted by AnimCJK.

The character artwork and converted geometry are licensed under **Arphic Public License (SPDX: Arphic-1999)**. Preserve the unaltered notice and license files under `data/raw/animcjk/licenses`, including `APL/english/ARPHICPL.TXT` and `COPYING.txt`. The complete pinned source, per-file hashes and import provenance are in `data/raw/animcjk/`. These notices also apply to the derived JSON in `data/kanji/animcjk-brush-v1/` and derived artwork. See the [original license](https://github.com/parsimonhi/animCJK/blob/ec5e17cca76c87587790bcbce5ea0b4d4fb753d6/licenses/APL/english/ARPHICPL.TXT) for its redistribution and modification terms.

Modifications made on 2026-10-10: source SVG silhouettes and median guides are converted into the engine's 109-unit coordinate system; medians are converted to cubic guides and sampled for progressive silhouette masks; a geometric union supplies the complete reference outline. Source stroke order is retained, with any documented Japanese stroke exception recorded by the importer. Each JSON asset identifies its original file, checksum, authors, license and these changes. Modified geometry and its reproducible conversion source are distributed under the Arphic Public License; the independent renderer and application code remain MIT. Upstream CSS, PHP and JavaScript animation code are not used.

AnimCJK's non-artwork source files have separate LGPL notices, retained with the original sources. The original archive is supplied for provenance; its inclusion does not relicense upstream files under MIT. Keep visible AnimCJK/Arphic credit when integrating the brush artwork elsewhere.

## KanjiVG stroke data — CC BY-SA 3.0

Title: KanjiVG: Kanji Vector Graphics. Copyright © Ulrich Apel and KanjiVG contributors. Upstream notices are preserved in every SVG; some list additional dates/parties. Source: https://github.com/KanjiVG/kanjivg, pinned revision `70a0b7ae0c18ceb5cb358274b029cce0234a43bc`. Source files and hashes: `data/raw/manifest.json`.

License: Creative Commons Attribution-ShareAlike 3.0 Unported.

- License and terms: https://creativecommons.org/licenses/by-sa/3.0/
- Legal code: https://creativecommons.org/licenses/by-sa/3.0/legalcode
- Preserved upstream license: `data/raw/COPYING`
- Applies to: `data/raw/*.svg`, source material, the KanjiVG-derived content in `data/kanji/noto-sans-jp-regular-v1/*.json` and derived renders/screenshot fixtures.

Modifications: source guides, IDs, order and directed endpoints are retained in JSON alongside explicit Noto-specific stroke regions and reveal samples. The glyph contours come from the pinned Noto Sans JP Regular font; project annotations assign its regions to the source stroke sequence. Attribution and source revision remain available. There is no endorsement by the original authors.

When distributing this data or adaptations, retain appropriate creator credit, title, copyright, license link and existing notices; identify the modifications; license adaptations under CC BY-SA 3.0 (or a license permitted by its terms); and do not impose additional legal or technological restrictions. Keep these obligations with exported geometry and rendered assets. The MIT license on independent engine code does not relicense the stroke data. The demo footer is a suitable visible credit; preserve equivalent credit in the eventual application.

## Development dependencies

Noto Sans JP Regular is included unmodified in `data/fonts/NotoSansJP-Regular.otf`. Copyright © 2014–2021 Adobe. Source: https://github.com/notofonts/noto-cjk at revision `165c01b46ea533872e002e0785ff17e44f6d97d8`; SHA-256 and original copyright are in `data/fonts/manifest.json`. The font software is licensed under **SIL Open Font License 1.1**; preserve `data/fonts/OFL.txt` with redistributed font software. Generated glyph artwork uses those exact outlines; guide-derived masks retain the KanjiVG attribution and modification notices. The font file is needed only for rebuilding; browser animation loads precompiled SVG geometry.

There are no third-party JavaScript runtime dependencies in the browser engine. Dependencies installed only for compilation and testing:

| Package | License | Purpose | Source |
| --- | --- | --- | --- |
| polygon-clipping 0.15.7 | MIT | Font-region intersection and coverage checks at build time | https://github.com/mfogel/polygon-clipping |
| Playwright 1.56.0 | Apache-2.0 | Real browser acceptance tests | https://github.com/microsoft/playwright |
| sharp 0.34.4 | Apache-2.0 | Screenshot pixel analysis | https://github.com/lovell/sharp |
| Ajv 8.17.1 | MIT | Published JSON Schema validation tests | https://github.com/ajv-validator/ajv |
| opentype.js 1.3.4 | MIT | Extract actual Noto glyph curves at build time | https://github.com/opentypejs/opentype.js |

Their upstream license files accompany installed packages. The lockfile records transitive dependencies, which are not shipped as browser code. If redistributing those tools or their dependencies, include their respective package notices.
