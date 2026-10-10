// Target data for the B2 kanji screens synced to the readings, meaning and example words observed on busuu.com's kanji lessons
// (b2-polish/busuu-kanji-b2.json, "observed busuu.com kanji lessons 2026-10-08"). One entry per record; each record gets one new content version
// (fromFile -> toFile) built by pack-followups-build.mjs from its current latest file. Only the `kanji` object (meaning, readings, examples) of the
// listed screens changes.
//
// Origins recorded per item:
//   example.wordOrigin   'observed_busuu'  word, reading and meaning come from Busuu (reading/meaning normalised: no hyphens or spaces in example
//                                          readings, English typos and spelling fixed, trailing spaces dropped; `busuuWord` is the word as Busuu printed it
//                                          when that differs, e.g. a trailing ！).
//   example.sentenceOrigin 'app_existing'  the word was already taught on that screen: its sentence, sentenceReading and translation are copied unchanged
//                                          from the starting pack (not repeated here).
//                          'app_authored'  new word: sentence, sentenceReading and translation are app-authored (reviewed), listed below.
//   reading.noteOrigin   'app_existing' (note kept from the starting pack) or 'app_authored' (notes are not displayed).
// Busuu entries that were just the glyph itself (館, 段, 客) are a display quirk and are not readings. Screen order, shapeNote and everything else are untouched.
export const KANJI_BUSUU_SOURCE = 'observed busuu.com kanji lessons 2026-10-08';
export const KANJI_BUSUU_SYNC = {
 "B2.C02.L02": {
  "fromFile": "b2-c02-l02.v3.json",
  "toFile": "b2-c02-l02.v4.json",
  "fromVersion": "1.2.0",
  "toVersion": "1.3.0",
  "screens": [
   {
    "screenId": "B2.C02.L02.A01.S01",
    "character": "参",
    "meaning": "to go; to come (humble language) / a visit / participation",
    "readings": [
     {
      "text": "まい-る",
      "note": "参る: humble verb for your own going/coming",
      "noteOrigin": "app_existing"
     },
     {
      "text": "さん",
      "note": "In compounds such as 参加",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "参る",
      "reading": "まいる",
      "meaning": "to go; to come (humble language)",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "お墓参り",
      "reading": "おはかまいり",
      "meaning": "a visit to the family grave",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "参加",
      "reading": "さんか",
      "meaning": "participation",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C02.L02.A01.S03",
    "character": "実",
    "meaning": "reality, truth, fruit, to bear fruit",
    "readings": [
     {
      "text": "じつ",
      "note": "In 実は and compounds",
      "noteOrigin": "app_existing"
     },
     {
      "text": "み",
      "note": "Fruit: 実",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "実は",
      "reading": "じつは",
      "meaning": "actually",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "事実",
      "reading": "じじつ",
      "meaning": "fact",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "事実を確かめてから話しましょう。",
      "sentenceReading": "じじつをたしかめてからはなしましょう。",
      "translation": "Let’s check the facts before we talk."
     },
     {
      "word": "木の実",
      "reading": "きのみ",
      "meaning": "fruit or nut of a tree",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "リスが木の実を食べています。",
      "sentenceReading": "リスがきのみをたべています。",
      "translation": "A squirrel is eating nuts from the tree."
     },
     {
      "word": "実花",
      "reading": "みか",
      "meaning": "Mika (female name)",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "実花さんは私の親友です。",
      "sentenceReading": "みかさんはわたしのしんゆうです。",
      "translation": "Mika is my best friend."
     }
    ]
   },
   {
    "screenId": "B2.C02.L02.A01.S05",
    "character": "然",
    "meaning": "as such",
    "readings": [
     {
      "text": "ぜん",
      "note": "In 自然 and 全然",
      "noteOrigin": "app_existing"
     },
     {
      "text": "ねん",
      "note": "In 天然",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "自然",
      "reading": "しぜん",
      "meaning": "nature",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "全然",
      "reading": "ぜんぜん",
      "meaning": "completely",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "そのニュースは全然知りませんでした。",
      "sentenceReading": "そのニュースはぜんぜんしりませんでした。",
      "translation": "I didn’t know about that news at all."
     },
     {
      "word": "天然水",
      "reading": "てんねんすい",
      "meaning": "spring water",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C02.L02.A01.S08",
    "character": "特",
    "meaning": "special",
    "readings": [
     {
      "text": "とく",
      "note": "In 特に, 特売 and 特産品",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "特に",
      "reading": "とくに",
      "meaning": "especially",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "特売",
      "reading": "とくばい",
      "meaning": "special sale",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "今日はスーパーで野菜の特売があります。",
      "sentenceReading": "きょうはスーパーでやさいのとくばいがあります。",
      "translation": "There is a special sale on vegetables at the supermarket today."
     },
     {
      "word": "特産",
      "reading": "とくさん",
      "meaning": "speciality",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "この町の特産はりんごです。",
      "sentenceReading": "このまちのとくさんはりんごです。",
      "translation": "This town’s speciality is apples."
     },
     {
      "word": "特急",
      "reading": "とっきゅう",
      "meaning": "limited express",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "特別",
      "reading": "とくべつ",
      "meaning": "special",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "今日は特別な日です。",
      "sentenceReading": "きょうはとくべつなひです。",
      "translation": "Today is a special day."
     }
    ]
   },
   {
    "screenId": "B2.C02.L02.A01.S10",
    "character": "例",
    "meaning": "example",
    "readings": [
     {
      "text": "たと-え",
      "note": "In 例えば",
      "noteOrigin": "app_existing"
     },
     {
      "text": "れい",
      "note": "In 例 and 例外",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "例えば",
      "reading": "たとえば",
      "meaning": "for example",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "例える",
      "reading": "たとえる",
      "meaning": "to compare",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "この話は身近なものに例えると分かりやすいです。",
      "sentenceReading": "このはなしはみぢかなものにたとえるとわかりやすいです。",
      "translation": "This story is easier to understand if you compare it to something familiar."
     },
     {
      "word": "例文",
      "reading": "れいぶん",
      "meaning": "example sentence",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "辞書の例文を読んで、使い方を覚えます。",
      "sentenceReading": "じしょのれいぶんをよんで、つかいかたをおぼえます。",
      "translation": "I read the example sentences in the dictionary and learn how to use the word."
     },
     {
      "word": "例外",
      "reading": "れいがい",
      "meaning": "exception",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 },
 "B2.C02.L07": {
  "fromFile": "b2-c02-l07.v2.json",
  "toFile": "b2-c02-l07.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C02.L07.A01.S01",
    "character": "優",
    "meaning": "gentle, kind, superiority",
    "readings": [
     {
      "text": "やさ-しい",
      "note": "In 優しい",
      "noteOrigin": "app_existing"
     },
     {
      "text": "ゆう",
      "note": "In 優先 and 俳優",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "優しい",
      "reading": "やさしい",
      "meaning": "kind",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "優先席",
      "reading": "ゆうせんせき",
      "meaning": "priority seat",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "俳優",
      "reading": "はいゆう",
      "meaning": "actor",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "好きな俳優の映画を見に行きます。",
      "sentenceReading": "すきなはいゆうのえいがをみにいきます。",
      "translation": "I’m going to see a film starring my favourite actor."
     },
     {
      "word": "女優",
      "reading": "じょゆう",
      "meaning": "actress",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "あの女優は歌もとても上手です。",
      "sentenceReading": "あのじょゆうはうたもとてもじょうずです。",
      "translation": "That actress is also very good at singing."
     }
    ]
   },
   {
    "screenId": "B2.C02.L07.A01.S03",
    "character": "怖",
    "meaning": "scary",
    "readings": [
     {
      "text": "こわ-い",
      "note": "In 怖い; the stem こわ also appears before がり",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "怖い",
      "reading": "こわい",
      "meaning": "scary",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "怖がり",
      "reading": "こわがり",
      "meaning": "a person who gets frightened easily",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C02.L07.A01.S06",
    "character": "寒",
    "meaning": "cold (climate)",
    "readings": [
     {
      "text": "さむ-い",
      "note": "Weather or feeling cold; also the stem in 寒がり",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "寒い",
      "reading": "さむい",
      "meaning": "cold",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "寒がり",
      "reading": "さむがり",
      "meaning": "a person who gets cold easily",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C02.L07.A01.S08",
    "character": "暑",
    "meaning": "hot (climate)",
    "readings": [
     {
      "text": "あつ-い",
      "note": "Hot weather; also the stem in 暑がり",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "暑い",
      "reading": "あつい",
      "meaning": "hot",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "暑がり",
      "reading": "あつがり",
      "meaning": "a person who gets hot easily",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C02.L07.A01.S12",
    "character": "悪",
    "meaning": "bad",
    "readings": [
     {
      "text": "わる-い",
      "note": "In 悪い; also わる in 悪口を言う (わるくち, sometimes said わるぐち).",
      "noteOrigin": "app_authored"
     },
     {
      "text": "あく",
      "note": "In 悪意（あくい）",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "悪い",
      "reading": "わるい",
      "meaning": "bad",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "悪口を言う",
      "reading": "わるくちをいう",
      "meaning": "to talk behind one’s back",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "人の悪口を言うのはよくありません。",
      "sentenceReading": "ひとのわるくちをいうのはよくありません。",
      "translation": "It isn’t good to talk behind people’s backs."
     },
     {
      "word": "最悪",
      "reading": "さいあく",
      "meaning": "the worst",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "今日は最悪の一日でした。",
      "sentenceReading": "きょうはさいあくのいちにちでした。",
      "translation": "Today was the worst day."
     }
    ]
   }
  ]
 },
 "B2.C03.L06": {
  "fromFile": "b2-c03-l06.v2.json",
  "toFile": "b2-c03-l06.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C03.L06.A01.S01",
    "character": "続",
    "meaning": "to continue",
    "readings": [
     {
      "text": "つづ-ける",
      "note": "Transitive: continue an action",
      "noteOrigin": "app_existing"
     },
     {
      "text": "つづ-く",
      "note": "Intransitive: something continues",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "続ける",
      "reading": "つづける",
      "meaning": "to continue",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "続く",
      "reading": "つづく",
      "meaning": "(something) continues",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "続き",
      "reading": "つづき",
      "meaning": "continuation",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "この話の続きは明日聞かせてください。",
      "sentenceReading": "このはなしのつづきはあしたきかせてください。",
      "translation": "Please tell me the rest of this story tomorrow."
     },
     {
      "word": "手続き",
      "reading": "てつづき",
      "meaning": "procedure",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C03.L06.A01.S03",
    "character": "通",
    "meaning": "to commute; to pass; street",
    "readings": [
     {
      "text": "かよ-う",
      "note": "Regular attendance: 学校に通う",
      "noteOrigin": "app_existing"
     },
     {
      "text": "とお-る",
      "note": "Pass through: 道を通る",
      "noteOrigin": "app_existing"
     },
     {
      "text": "つう",
      "note": "In compounds: 通学, 通院",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "通う",
      "reading": "かよう",
      "meaning": "to commute",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "通る",
      "reading": "とおる",
      "meaning": "to pass",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "通り",
      "reading": "とおり",
      "meaning": "street",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "この通りにはおいしい店がたくさんあります。",
      "sentenceReading": "このとおりにはおいしいみせがたくさんあります。",
      "translation": "There are lots of good restaurants on this street."
     },
     {
      "word": "通学",
      "reading": "つうがく",
      "meaning": "commuting to school",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "通院",
      "reading": "つういん",
      "meaning": "a regular hospital appointment",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "母は月に一度、通院しています。",
      "sentenceReading": "はははつきにいちど、つういんしています。",
      "translation": "My mother goes to the hospital for a regular appointment once a month."
     }
    ]
   },
   {
    "screenId": "B2.C03.L06.A01.S06",
    "character": "努",
    "meaning": "endeavour",
    "readings": [
     {
      "text": "ど",
      "note": "In 努力",
      "noteOrigin": "app_existing"
     },
     {
      "text": "つと-める",
      "note": "In 努める: strive/make an effort",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "努力",
      "reading": "どりょく",
      "meaning": "effort",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "努める",
      "reading": "つとめる",
      "meaning": "to endeavour",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C03.L06.A01.S08",
    "character": "試",
    "meaning": "try",
    "readings": [
     {
      "text": "し",
      "note": "In 試験, 試合 and 入試",
      "noteOrigin": "app_existing"
     },
     {
      "text": "ため-す",
      "note": "In 試す: test/try",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "試合",
      "reading": "しあい",
      "meaning": "match; race",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "試験",
      "reading": "しけん",
      "meaning": "exam",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "入試",
      "reading": "にゅうし",
      "meaning": "entrance exam",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "来月、大学の入試があります。",
      "sentenceReading": "らいげつ、だいがくのにゅうしがあります。",
      "translation": "I have a university entrance exam next month."
     },
     {
      "word": "試す",
      "reading": "ためす",
      "meaning": "to try; to test",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C03.L06.A01.S10",
    "character": "験",
    "meaning": "test; verification",
    "readings": [
     {
      "text": "けん",
      "note": "In 試験, 経験, 体験 and 実験",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "試験",
      "reading": "しけん",
      "meaning": "exam",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "体験",
      "reading": "たいけん",
      "meaning": "experience; trial",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "初めての海外生活はいい体験でした。",
      "sentenceReading": "はじめてのかいがいせいかつはいいたいけんでした。",
      "translation": "Living overseas for the first time was a good experience."
     },
     {
      "word": "実験",
      "reading": "じっけん",
      "meaning": "experiment",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 },
 "B2.C04.L04": {
  "fromFile": "b2-c04-l04.v2.json",
  "toFile": "b2-c04-l04.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C04.L04.A01.S01",
    "character": "勝",
    "meaning": "to win",
    "readings": [
     {
      "text": "か-つ",
      "note": "Kun reading in 勝つ",
      "noteOrigin": "app_existing"
     },
     {
      "text": "しょう",
      "note": "On reading in 勝利 and 優勝",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "勝つ",
      "reading": "かつ",
      "meaning": "to win",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "優勝",
      "reading": "ゆうしょう",
      "meaning": "victory",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "優勝者",
      "reading": "ゆうしょうしゃ",
      "meaning": "winner",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "優勝者にはトロフィーが贈られます。",
      "sentenceReading": "ゆうしょうしゃにはトロフィーがおくられます。",
      "translation": "The winner will be given a trophy."
     },
     {
      "word": "全勝",
      "reading": "ぜんしょう",
      "meaning": "winning every game",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "このチームは全勝で優勝しました。",
      "sentenceReading": "このチームはぜんしょうでゆうしょうしました。",
      "translation": "This team won the title without losing a game."
     }
    ]
   },
   {
    "screenId": "B2.C04.L04.A01.S03",
    "character": "負",
    "meaning": "to lose",
    "readings": [
     {
      "text": "ま-ける",
      "note": "Kun reading in 負ける",
      "noteOrigin": "app_existing"
     },
     {
      "text": "ぶ",
      "note": "Voiced form of ふ in 勝負 (しょうぶ).",
      "noteOrigin": "app_authored"
     }
    ],
    "examples": [
     {
      "word": "負ける",
      "reading": "まける",
      "meaning": "to lose",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "勝負",
      "reading": "しょうぶ",
      "meaning": "match; game",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C04.L04.A01.S05",
    "character": "点",
    "meaning": "point / score / dot",
    "readings": [
     {
      "text": "てん",
      "note": "On reading in 点 and 得点",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "点数",
      "reading": "てんすう",
      "meaning": "point; score",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "失点",
      "reading": "しってん",
      "meaning": "conceded points",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "後半に失点が続いて、負けてしまいました。",
      "sentenceReading": "こうはんにしってんがつづいて、まけてしまいました。",
      "translation": "We kept conceding points in the second half and ended up losing."
     },
     {
      "word": "注意点",
      "reading": "ちゅういてん",
      "meaning": "important points to note",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "書類を出す前に注意点を確認してください。",
      "sentenceReading": "しょるいをだすまえにちゅういてんをかくにんしてください。",
      "translation": "Please check the points to note before you submit the documents."
     },
     {
      "word": "終点",
      "reading": "しゅうてん",
      "meaning": "last stop",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "この電車の終点は新宿です。",
      "sentenceReading": "このでんしゃのしゅうてんはしんじゅくです。",
      "translation": "The last stop for this train is Shinjuku."
     },
     {
      "word": "点字",
      "reading": "てんじ",
      "meaning": "braille",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "駅の案内板には点字もあります。",
      "sentenceReading": "えきのあんないばんにはてんじもあります。",
      "translation": "The station information boards also have braille."
     }
    ]
   },
   {
    "screenId": "B2.C04.L04.A01.S08",
    "character": "位",
    "meaning": "rank / position",
    "readings": [
     {
      "text": "い",
      "note": "On reading in 一位, 学位 and 方位",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "一位",
      "reading": "いちい",
      "meaning": "first place",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "上位",
      "reading": "じょうい",
      "meaning": "higher rank",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "彼女は成績が学年で上位です。",
      "sentenceReading": "かのじょはせいせきががくねんでじょういです。",
      "translation": "Her grades are near the top of her year."
     },
     {
      "word": "下位",
      "reading": "かい",
      "meaning": "lower rank",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "うちのチームは今、下位にいます。",
      "sentenceReading": "うちのチームはいま、かいにいます。",
      "translation": "Our team is currently near the bottom of the ladder."
     },
     {
      "word": "優位",
      "reading": "ゆうい",
      "meaning": "having an advantage",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "この試合は私たちのチームが優位です。",
      "sentenceReading": "このしあいはわたしたちのチームがゆういです。",
      "translation": "Our team has the advantage in this match."
     },
     {
      "word": "学位",
      "reading": "がくい",
      "meaning": "degree",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "方位",
      "reading": "ほうい",
      "meaning": "direction",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C04.L04.A01.S10",
    "character": "球",
    "meaning": "ball",
    "readings": [
     {
      "text": "きゅう",
      "note": "On reading in 野球, 電球 and 地球",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "野球",
      "reading": "やきゅう",
      "meaning": "baseball",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "地球",
      "reading": "ちきゅう",
      "meaning": "Earth",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "北半球",
      "reading": "きたはんきゅう",
      "meaning": "northern hemisphere",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "日本は北半球にあります。",
      "sentenceReading": "にほんはきたはんきゅうにあります。",
      "translation": "Japan is in the northern hemisphere."
     },
     {
      "word": "電球",
      "reading": "でんきゅう",
      "meaning": "light bulb",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 },
 "B2.C05.L02": {
  "fromFile": "b2-c05-l02.v2.json",
  "toFile": "b2-c05-l02.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C05.L02.A01.S01",
    "character": "館",
    "meaning": "building",
    "readings": [
     {
      "text": "かん",
      "note": "On reading; 旅館 has the contracted word reading りょかん.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "旅館",
      "reading": "りょかん",
      "meaning": "Japanese inn",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "映画館",
      "reading": "えいがかん",
      "meaning": "cinema",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "週末に友達と映画館へ行きました。",
      "sentenceReading": "しゅうまつにともだちとえいがかんへいきました。",
      "translation": "I went to the cinema with a friend on the weekend."
     },
     {
      "word": "図書館",
      "reading": "としょかん",
      "meaning": "library",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C05.L02.A01.S03",
    "character": "段",
    "meaning": "steps",
    "readings": [
     {
      "text": "だん",
      "note": "On reading in 階段 and 三段.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "階段",
      "reading": "かいだん",
      "meaning": "stairs",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C05.L02.A01.S07",
    "character": "庭",
    "meaning": "garden",
    "readings": [
     {
      "text": "にわ",
      "note": "Kun reading in 庭.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "てい",
      "note": "On reading in 家庭 and 校庭.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "庭仕事",
      "reading": "にわしごと",
      "meaning": "garden work",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "日曜日は庭仕事をしてゆっくり過ごします。",
      "sentenceReading": "にちようびはにわしごとをしてゆっくりすごします。",
      "translation": "On Sundays I do some gardening and relax."
     },
     {
      "word": "校庭",
      "reading": "こうてい",
      "meaning": "schoolyard",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "休み時間に校庭でサッカーをします。",
      "sentenceReading": "やすみじかんにこうていでサッカーをします。",
      "translation": "We play soccer in the schoolyard during break."
     },
     {
      "word": "家庭",
      "reading": "かてい",
      "meaning": "family; household",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C05.L02.A01.S10",
    "character": "室",
    "meaning": "room",
    "readings": [
     {
      "text": "しつ",
      "note": "On reading in 教室, 浴室 and 寝室.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "寝室",
      "reading": "しんしつ",
      "meaning": "bedroom",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "浴室",
      "reading": "よくしつ",
      "meaning": "bathroom",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "浴室の掃除は週に一回します。",
      "sentenceReading": "よくしつのそうじはしゅうにいっかいします。",
      "translation": "I clean the bathroom once a week."
     },
     {
      "word": "教室",
      "reading": "きょうしつ",
      "meaning": "classroom",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C05.L02.A01.S12",
    "character": "性",
    "meaning": "gender / nature",
    "readings": [
     {
      "text": "せい",
      "note": "On reading in 女性, 男性 and 性格.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "男性",
      "reading": "だんせい",
      "meaning": "man; men",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "あの男性は私の先生です。",
      "sentenceReading": "あのだんせいはわたしのせんせいです。",
      "translation": "That man is my teacher."
     },
     {
      "word": "女性",
      "reading": "じょせい",
      "meaning": "woman; women",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "性格",
      "reading": "せいかく",
      "meaning": "personality",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 },
 "B2.C06.L05": {
  "fromFile": "b2-c06-l05.v2.json",
  "toFile": "b2-c06-l05.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C06.L05.A01.S01",
    "character": "客",
    "meaning": "customer; guest",
    "readings": [
     {
      "text": "きゃく",
      "note": "On reading in 客室, 客席 and 乗客.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "客室",
      "reading": "きゃくしつ",
      "meaning": "guest room",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "客席",
      "reading": "きゃくせき",
      "meaning": "seats (for an audience)",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "乗客",
      "reading": "じょうきゃく",
      "meaning": "passenger",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C06.L05.A01.S03",
    "character": "観",
    "meaning": "to watch",
    "readings": [
     {
      "text": "み-る",
      "note": "Kun reading in 観る, intentional viewing.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "かん",
      "note": "On reading in 観客 and 観光.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "観る",
      "reading": "みる",
      "meaning": "to watch",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "観客",
      "reading": "かんきゃく",
      "meaning": "spectator; audience",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C06.L05.A01.S07",
    "character": "光",
    "meaning": "light",
    "readings": [
     {
      "text": "ひかり",
      "note": "Kun reading of the noun 光.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "こう",
      "note": "On reading in 観光.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "朝の光",
      "reading": "あさのひかり",
      "meaning": "morning light",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "朝の光がカーテンから入ってきます。",
      "sentenceReading": "あさのひかりがカーテンからはいってきます。",
      "translation": "The morning light comes in through the curtains."
     },
     {
      "word": "観光",
      "reading": "かんこう",
      "meaning": "sightseeing",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "観光客",
      "reading": "かんこうきゃく",
      "meaning": "tourist",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C06.L05.A02.S01",
    "character": "遠",
    "meaning": "far",
    "readings": [
     {
      "text": "とお-い",
      "note": "Kun reading of 遠い; keep い as okurigana.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "えん",
      "note": "On reading in 遠足.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "遠い",
      "reading": "とおい",
      "meaning": "far away",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "遠足",
      "reading": "えんそく",
      "meaning": "excursion",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C06.L05.A02.S05",
    "character": "杯",
    "meaning": "counter for full cups, glasses, bowls",
    "readings": [
     {
      "text": "はい",
      "note": "Base on reading as a counter; its sound changes depend on the number.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "ばい",
      "note": "Voiced counter reading in 三杯 (さんばい).",
      "noteOrigin": "app_authored"
     },
     {
      "text": "ぱい",
      "note": "Counter reading in 一杯 (いっぱい) and 乾杯 (かんぱい).",
      "noteOrigin": "app_authored"
     }
    ],
    "examples": [
     {
      "word": "一杯",
      "reading": "いっぱい",
      "meaning": "a full cup; glass; bowl",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "乾杯する",
      "reading": "かんぱいする",
      "meaning": "to toast",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "ジュースで乾杯するのも楽しいです。",
      "sentenceReading": "ジュースでかんぱいするのもたのしいです。",
      "translation": "Toasting with juice is fun too."
     },
     {
      "word": "乾杯",
      "busuuWord": "乾杯！",
      "reading": "かんぱい",
      "meaning": "Cheers!",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 },
 "B2.C07.L04": {
  "fromFile": "b2-c07-l04.v2.json",
  "toFile": "b2-c07-l04.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C07.L04.A01.S01",
    "character": "雪",
    "meaning": "snow",
    "readings": [
     {
      "text": "ゆき",
      "note": "Kun reading in 雪, 雪国 and 雪だるま.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "雪",
      "reading": "ゆき",
      "meaning": "snow",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "雪国",
      "reading": "ゆきぐに",
      "meaning": "snowy region",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "雪だるま",
      "reading": "ゆきだるま",
      "meaning": "snowman",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C07.L04.A01.S03",
    "character": "景",
    "meaning": "scenery; view",
    "readings": [
     {
      "text": "けい",
      "note": "On reading in 景気（けいき）.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "景色",
      "reading": "けしき",
      "meaning": "landscape; scenery",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "景気",
      "reading": "けいき",
      "meaning": "market; business climate",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C07.L04.A01.S05",
    "character": "流",
    "meaning": "fashion; trend / to flow",
    "readings": [
     {
      "text": "りゅう",
      "note": "On reading in 流行（りゅうこう）.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "なが-れる",
      "note": "Kun reading with れる: intransitive flow.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "なが-す",
      "note": "Kun reading with す: transitive let flow/flush.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "流行",
      "reading": "りゅうこう",
      "meaning": "fashion; trend",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "流れる",
      "reading": "ながれる",
      "meaning": "to flow",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "流す",
      "reading": "ながす",
      "meaning": "to flush",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C07.L04.A01.S07",
    "character": "公",
    "meaning": "public; official",
    "readings": [
     {
      "text": "こう",
      "note": "On reading in 公園, 公式 and 公立.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "公園",
      "reading": "こうえん",
      "meaning": "park",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "公式",
      "reading": "こうしき",
      "meaning": "official; formula",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "公立",
      "reading": "こうりつ",
      "meaning": "public",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C07.L04.A01.S09",
    "character": "園",
    "meaning": "park; garden",
    "readings": [
     {
      "text": "えん",
      "note": "On reading in 公園, 動物園 and 遊園地.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "公園",
      "reading": "こうえん",
      "meaning": "park",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "動物園",
      "reading": "どうぶつえん",
      "meaning": "zoo",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "遊園地",
      "reading": "ゆうえんち",
      "meaning": "amusement park",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 },
 "B2.C08.L04": {
  "fromFile": "b2-c08-l04.v2.json",
  "toFile": "b2-c08-l04.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C08.L04.A01.S01",
    "character": "腹",
    "meaning": "stomach; abdomen; belly",
    "readings": [
     {
      "text": "はら",
      "note": "Native reading in 腹",
      "noteOrigin": "app_existing"
     },
     {
      "text": "ふく",
      "note": "Reading in compounds such as 腹痛",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "腹",
      "reading": "はら",
      "meaning": "abdomen; stomach",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "腹が痛くて、今日は学校を休みました。",
      "sentenceReading": "はらがいたくて、きょうはがっこうをやすみました。",
      "translation": "My stomach hurt, so I stayed home from school today."
     },
     {
      "word": "空腹",
      "reading": "くうふく",
      "meaning": "hunger",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "空腹で、もう動けません。",
      "sentenceReading": "くうふくで、もううごけません。",
      "translation": "I’m so hungry that I can’t move any more."
     },
     {
      "word": "お腹",
      "reading": "おなか",
      "meaning": "belly",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C08.L04.A01.S03",
    "character": "顔",
    "meaning": "face; expression",
    "readings": [
     {
      "text": "かお",
      "note": "Native reading in 顔",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "顔",
      "reading": "かお",
      "meaning": "face",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "顔色",
      "reading": "かおいろ",
      "meaning": "complexion",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "笑顔",
      "reading": "えがお",
      "meaning": "smiling face",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C08.L04.A01.S05",
    "character": "首",
    "meaning": "neck; head",
    "readings": [
     {
      "text": "くび",
      "note": "Native reading in 首",
      "noteOrigin": "app_existing"
     },
     {
      "text": "しゅ",
      "note": "Compound reading in 首都 and 首相",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "首",
      "reading": "くび",
      "meaning": "neck",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "首相",
      "reading": "しゅしょう",
      "meaning": "prime minister",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "首都",
      "reading": "しゅと",
      "meaning": "capital city",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C08.L04.A01.S07",
    "character": "指",
    "meaning": "finger; to indicate",
    "readings": [
     {
      "text": "ゆび",
      "note": "Native noun reading in 指",
      "noteOrigin": "app_existing"
     },
     {
      "text": "さ-す",
      "note": "Whole verb 指す: point",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "指",
      "reading": "ゆび",
      "meaning": "finger",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "指す",
      "reading": "さす",
      "meaning": "to indicate; to point",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C08.L04.A01.S09",
    "character": "歯",
    "meaning": "tooth",
    "readings": [
     {
      "text": "は",
      "note": "Native reading in 歯",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "歯",
      "reading": "は",
      "meaning": "teeth",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "歯医者",
      "reading": "はいしゃ",
      "meaning": "dentist",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "明日、歯医者の予約があります。",
      "sentenceReading": "あした、はいしゃのよやくがあります。",
      "translation": "I have a dentist appointment tomorrow."
     },
     {
      "word": "虫歯",
      "reading": "むしば",
      "meaning": "cavity; tooth decay",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 },
 "B2.C09.L03": {
  "fromFile": "b2-c09-l03.v2.json",
  "toFile": "b2-c09-l03.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C09.L03.A01.S01",
    "character": "約",
    "meaning": "approximately; promise",
    "readings": [
     {
      "text": "やく",
      "note": "Compound reading; 約 before a quantity is やく",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "約",
      "reading": "やく",
      "meaning": "approximately",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "約束",
      "reading": "やくそく",
      "meaning": "promise",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "予約",
      "reading": "よやく",
      "meaning": "reservation",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C09.L03.A01.S03",
    "character": "決",
    "meaning": "to decide",
    "readings": [
     {
      "text": "き-まる",
      "note": "Stem reading in 決まる（きまる）and 決める（きめる）",
      "noteOrigin": "app_existing"
     },
     {
      "text": "き-める",
      "note": "Stem reading in 決まる（きまる）and 決める（きめる）",
      "noteOrigin": "app_existing"
     },
     {
      "text": "けつ",
      "note": "Compound reading; consonants change in 決心 and 決定",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "決まる",
      "reading": "きまる",
      "meaning": "to be decided",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "決める",
      "reading": "きめる",
      "meaning": "to decide",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "決意する",
      "reading": "けついする",
      "meaning": "to determine",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "新年に、毎日走ろうと決意する人は多いです。",
      "sentenceReading": "しんねんに、まいにちはしろうとけついするひとはおおいです。",
      "translation": "Many people resolve to run every day in the new year."
     }
    ]
   },
   {
    "screenId": "B2.C09.L03.A01.S05",
    "character": "断",
    "meaning": "to decline / to cut off",
    "readings": [
     {
      "text": "ことわ-る",
      "note": "Stem reading in 断る（ことわる）",
      "noteOrigin": "app_existing"
     },
     {
      "text": "だん",
      "note": "Compound reading in 切断 and 中断",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "断る",
      "reading": "ことわる",
      "meaning": "to decline",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "切断する",
      "reading": "せつだんする",
      "meaning": "to cut off",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "ワイヤーを切断するときは、手袋をしてください。",
      "sentenceReading": "ワイヤーをせつだんするときは、てぶくろをしてください。",
      "translation": "Please wear gloves when you cut the wire."
     },
     {
      "word": "中断する",
      "reading": "ちゅうだんする",
      "meaning": "to interrupt",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "雨のため、試合を中断することになりました。",
      "sentenceReading": "あめのため、しあいをちゅうだんすることになりました。",
      "translation": "Because of the rain, the match had to be suspended."
     }
    ]
   },
   {
    "screenId": "B2.C09.L03.A01.S07",
    "character": "返",
    "meaning": "to return (something)",
    "readings": [
     {
      "text": "かえ-す",
      "note": "Stem reading in 返す（かえす）",
      "noteOrigin": "app_existing"
     },
     {
      "text": "へん",
      "note": "Compound reading in 返事 and 返答",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "返す",
      "reading": "かえす",
      "meaning": "to return",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "返事",
      "reading": "へんじ",
      "meaning": "reply",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "返答",
      "reading": "へんとう",
      "meaning": "answer",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C09.L03.A01.S09",
    "character": "確",
    "meaning": "to confirm",
    "readings": [
     {
      "text": "たし-かめる",
      "note": "Stem reading in 確かめる（たしかめる）",
      "noteOrigin": "app_existing"
     },
     {
      "text": "かく",
      "note": "Compound reading in 正確 and 明確",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "確かめる",
      "reading": "たしかめる",
      "meaning": "to confirm",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "正確",
      "reading": "せいかく",
      "meaning": "accurate",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "明確",
      "reading": "めいかく",
      "meaning": "clear",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 },
 "B2.C09.L08": {
  "fromFile": "b2-c09-l08.v2.json",
  "toFile": "b2-c09-l08.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C09.L08.A01.S01",
    "character": "堂",
    "meaning": "hall",
    "readings": [
     {
      "text": "どう",
      "note": "Compound reading in 食堂 and 講堂",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "食堂",
      "reading": "しょくどう",
      "meaning": "dining room; canteen; restaurant",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "音楽堂",
      "reading": "おんがくどう",
      "meaning": "concert hall",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "週末に音楽堂でコンサートがあります。",
      "sentenceReading": "しゅうまつにおんがくどうでコンサートがあります。",
      "translation": "There is a concert at the concert hall on the weekend."
     }
    ]
   },
   {
    "screenId": "B2.C09.L08.A01.S05",
    "character": "忙",
    "meaning": "busy",
    "readings": [
     {
      "text": "いそが-しい",
      "note": "Stem reading in 忙しい（いそがしい）",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "忙しい",
      "reading": "いそがしい",
      "meaning": "busy",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C09.L08.A01.S07",
    "character": "静",
    "meaning": "quiet",
    "readings": [
     {
      "text": "しず-か",
      "note": "Stem in 静か（しずか）",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "静か",
      "reading": "しずか",
      "meaning": "quiet",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C09.L08.A01.S09",
    "character": "広",
    "meaning": "wide; spacious",
    "readings": [
     {
      "text": "ひろ-い",
      "note": "Stem in 広い; reading in 広場 and 広島",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "広い",
      "reading": "ひろい",
      "meaning": "wide; spacious",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "広場",
      "reading": "ひろば",
      "meaning": "square",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "広島",
      "reading": "ひろしま",
      "meaning": "Hiroshima",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C09.L08.A02.S01",
    "character": "風",
    "meaning": "wind; style",
    "readings": [
     {
      "text": "かぜ",
      "note": "Native reading for wind; also 北風（きたかぜ）",
      "noteOrigin": "app_existing"
     },
     {
      "text": "ふう",
      "note": "Compound reading for wind and style words",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "北風",
      "reading": "きたかぜ",
      "meaning": "north wind",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "強風",
      "reading": "きょうふう",
      "meaning": "strong wind",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "台風",
      "reading": "たいふう",
      "meaning": "typhoon",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "和風",
      "reading": "わふう",
      "meaning": "Japanese style",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 },
 "B2.C10.L05": {
  "fromFile": "b2-c10-l05.v2.json",
  "toFile": "b2-c10-l05.v3.json",
  "fromVersion": "1.1.0",
  "toVersion": "1.2.0",
  "screens": [
   {
    "screenId": "B2.C10.L05.A01.S01",
    "character": "遊",
    "meaning": "to play",
    "readings": [
     {
      "text": "あそ-ぶ",
      "note": "The character reading in 遊ぶ（あそぶ）; ぶ is supplied okurigana.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "ゆう",
      "note": "Compound reading in 遊園地（ゆうえんち）.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "遊ぶ",
      "reading": "あそぶ",
      "meaning": "to play",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "遊園地",
      "reading": "ゆうえんち",
      "meaning": "theme park",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C10.L05.A01.S03",
    "character": "疲",
    "meaning": "to be tired",
    "readings": [
     {
      "text": "つか-れる",
      "note": "The character reading in 疲れる（つかれる）; れる is supplied.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "疲れる",
      "reading": "つかれる",
      "meaning": "to be tired",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C10.L05.A01.S06",
    "character": "吸",
    "meaning": "to breathe in",
    "readings": [
     {
      "text": "す-う",
      "note": "The character reading in 吸う（すう）; う is supplied.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "きゅう",
      "note": "Compound reading in 呼吸（こきゅう）.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "吸う",
      "reading": "すう",
      "meaning": "to breathe in",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "呼吸",
      "reading": "こきゅう",
      "meaning": "breathing",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C10.L05.A01.S08",
    "character": "別",
    "meaning": "to separate; different",
    "readings": [
     {
      "text": "わか-れる",
      "note": "The character reading in 別れる（わかれる）; れる is supplied.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "べつ",
      "note": "Compound reading in 別人（べつじん）and 特別（とくべつ）.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "別れる",
      "reading": "わかれる",
      "meaning": "to break up",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "別",
      "reading": "べつ",
      "meaning": "another",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_authored",
      "sentence": "別の方法を考えましょう。",
      "sentenceReading": "べつのほうほうをかんがえましょう。",
      "translation": "Let’s think of another way."
     },
     {
      "word": "別人",
      "reading": "べつじん",
      "meaning": "a different person",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   },
   {
    "screenId": "B2.C10.L05.A02.S01",
    "character": "直",
    "meaning": "to fix; honesty",
    "readings": [
     {
      "text": "なお-す",
      "note": "The character reading in 直す（なおす）and 直る（なおる）; the endings are supplied.",
      "noteOrigin": "app_existing"
     },
     {
      "text": "じき",
      "note": "Compound reading in 正直（しょうじき）.",
      "noteOrigin": "app_existing"
     }
    ],
    "examples": [
     {
      "word": "直す",
      "reading": "なおす",
      "meaning": "to fix",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "直る",
      "reading": "なおる",
      "meaning": "to be fixed",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     },
     {
      "word": "正直",
      "reading": "しょうじき",
      "meaning": "honest",
      "wordOrigin": "observed_busuu",
      "sentenceOrigin": "app_existing"
     }
    ]
   }
  ]
 }
};
