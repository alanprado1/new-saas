// Hand-authored learner-facing text edits for the B2 pack-text polish (owner-approved 8 October 2026).
// Consumed by pack-text-transform.mjs. Nothing here touches answer keys, accepted forms, tokens, option sets/IDs/order,
// partitions, counts, retry policies, sourceContract/provenance/evidence or support timing/visibility.
//
// screenEdits: [screenId, path, edit]
//   edit = string                    -> set the field to this text (a `.secondary` reading may be created where absent)
//   edit = { sub: [[from, to], ...] } -> replace a substring; `from` must occur exactly once in the current text
// globalSubs: [from, to] substring replacements applied to every learner English field (each must match somewhere).

export const globalSubs = [
    // Typed-answer explanations that described the checker instead of the Japanese.
  ['This occurrence accepts 行け and いけ explicitly. Romanized ike may explain the reading but is not accepted by this Japanese-script task. No automatic kana/romaji conversion applies. ',
    'You can write this in kanji (行け) or hiragana (いけ). Romaji is not accepted. '],
  ['This app checks the indicated suffix only; supplied て forms and endings stay outside the answer. Kana み is the auxiliary, not lexical 見.',
    'You only type the suffix shown; the て form and the ending are already supplied. The み here is an auxiliary written in kana, not the verb 見る.'],
  ['Romanized koi describes this reading; it does not establish universal romaji answer acceptance.', 'In romaji it is koi.'],
  // Token/tile wording in explanations.
  ['The two physical prefix tokens are distinct; repeated identical text remains interchangeable only in the reviewed matching slots.',
    'The prefixes お and ご each appear twice. The two お tiles are identical, as are the two ご tiles, so either copy can go in its matching gap.'],
  [' This is a fragment cue, without a full listening transcript.', ''],
  ['this task practices its displayed spelling', 'use the spelling shown'],
  ['Both に and へ are grammatical destination particles in this occurrence.', 'Both に and へ are grammatical destination particles here.'],
  ['but is not a choice in this task.', 'but is not one of the choices here.'],
  ['This task requests the respectful polite form; plain 召し上がる does not meet that form instruction.', 'Here the respectful polite form is needed, not the plain 召し上がる.'],
];

const E = []; // [screenId, path, edit]
const s = (id, path, edit) => E.push([id, path, edit]);

// ---------------------------------------------------------------- B2.C01
// L01: the "secondary" line held an alternate kanji spelling, not a kana reading. It now holds the hiragana reading;
// the alternate kanji spellings are kept as plain support in the explanation where the lesson teaches the contrast.
s('B2.C01.L01.A01.S01', 'support.before[0].secondary', 'わたくしはやまぐちともうします。');
s('B2.C01.L01.A01.S02', 'support.before[0].secondary', 'わたくしはたなかともうします。よろしくおねがいいたします。');
s('B2.C01.L01.A01.S03', 'left[0].secondary', 'おれはほんだ。よろしく。');
s('B2.C01.L01.A01.S03', 'left[1].secondary', 'わたしはほんだです。よろしくおねがいします。');
s('B2.C01.L01.A01.S03', 'left[2].secondary', 'わたくしはほんだともうします。よろしくおねがいいたします。');
s('B2.C01.L01.A01.S03', 'support.after[0].text', { sub: [['we use it in professional settings.', 'we use it in professional settings. Casual おれ can also be written 俺, and いたします can be written 致します.']] });
s('B2.C01.L01.A01.S04', 'support.after[0].secondary', 'はじめまして、むらたしんいちともうします。きょうとからまいりました。');
s('B2.C01.L01.A01.S05', 'answer.options[0].secondary', 'バルセロナからきた。');
s('B2.C01.L01.A01.S05', 'answer.options[1].secondary', 'バルセロナからまいりました。');
s('B2.C01.L01.A01.S05', 'answer.options[2].secondary', 'バルセロナからきてください。');
s('B2.C01.L01.A01.S05', 'support.after[0].secondary', 'バルセロナからまいりました。');
s('B2.C01.L01.A01.S05', 'support.after[2].text', { sub: [['to talk in a humble way.', 'to talk in a humble way. まいりました can also be written 参りました.']] });
s('B2.C01.L01.A01.S06', 'support.after[0].secondary', 'はじめまして。スミスともうします。アメリカのシカゴからまいりました。');

s('B2.C01.L03.A01.S04', 'prompt', 'Read and listen. Is the statement true or false?');
s('B2.C01.L05.A01.S04', 'support.after[2].text', 'Each marker is と + か. The two と tiles are identical, so either can go in either と gap; the same is true of the two か tiles.');

// ---------------------------------------------------------------- B2.C02
s('B2.C02.CP.A01.S04', 'prompt', 'Choose the best answer to “弟は怖い映画を見たくありません。どんな性格でしょうか。”');
s('B2.C02.L06.A01.S03', 'prompt', 'Choose the best answer to “弟は怖い映画を見たくありません。どんな性格でしょうか。”');
s('B2.C02.CP.A01.S18', 'prompt', 'Choose the best answer to “空気を読むのが得意な人は、会議でみんなが疲れているとき、どうするでしょうか。”');
s('B2.C02.L05.A01.S10', 'prompt', 'Choose the best answer to “空気を読むのが得意な人は、会議でみんなが疲れているとき、どうするでしょうか。”');
s('B2.C02.CP.A01.S11', 'support.after[2].text', 'You can write this in kanji or hiragana: 甘い or あまい. 甘い is figurative leniency here. Romaji is not accepted.');
s('B2.C02.CP.A01.S20', 'support.after[2].text', '読めない is cannot read; 読む is the dictionary form, read; 読まない is does not read.');
s('B2.C02.CP.A01.S08', 'support.after[2].text', 'まじめ means serious/diligent. みじめ means miserable; まじみ only scrambles the sounds of まじめ and is not the target word.');
s('B2.C02.L01.A01.S04', 'support.after[2].text', 'まじめ means diligent/serious; みじめ means miserable. まじみ only scrambles the sounds of まじめ and is not the target word.');
s('B2.C02.L01.A01.S07', 'support.after[2].text', 'The kana order is が・ん・こ. The whole word fits the single gap, so select it as one chunk.');
s('B2.C02.L02.A02.S02', 'support.after[2].text', 'The two 優 tiles are identical, so either can go in either gap. In the names here, 実 is Minoru and 優 is Yū; 優しい is やさしい.');
s('B2.C02.L02.A02.S08', 'support.after[2].text', 'Mountains and forests identify 自然, nature. The options use kanji; the sentence and its translation appear after you answer.');
s('B2.C02.L02.A02.S08', 'prompt', 'Listen. Which topic is the speaker interested in?');
s('B2.C02.L05.A01.S04', 'prompt', 'Insert the four particles; identical tiles can swap places.');
s('B2.C02.L06.A01.S07', 'support.after[2].text', 'You can write this in kanji or hiragana: やさしい or 優しい. Type the whole adjective; です is already supplied. Romaji is not accepted.');
s('B2.C02.L07.A02.S08', 'support.after[2].text', '怖 is こわ before the い that is already supplied. Type こわ only, not 怖, こわい or romaji.');
s('B2.C02.L02.A01.S05', 'kanji.shapeNote', 'Notice the four bottom dots 灬. Above them are a moon-like shape and 犬.');

// ---------------------------------------------------------------- B2.C03
s('B2.C03.CP.A01.S15', 'prompt', 'Someone asks “浴衣を着てみたいですか。” Choose the affirmative reply that expresses a desire to try.');
s('B2.C03.L04.A02.S05', 'prompt', 'Someone asks “浴衣を着てみたいですか。” Choose the affirmative reply that expresses a desire to try.');
s('B2.C03.L04.A02.S02', 'prompt', 'Choose the best answer to “この料理は初めてです。味を知りたいです。どうしますか。”');
s('B2.C03.L06.A02.S05', 'support.after[2].text', { sub: [['Both physical 通 tokens have distinct IDs and interchangeable accepted mappings.', '通 appears twice, so either copy can go in either gap.']] });
s('B2.C03.L06.A02.S09', 'prompt', 'Insert three kanji, including two copies of 試.');

// ---------------------------------------------------------------- B2.C04
s('B2.C04.CP.A01.S02', 'prompt', 'Type the imperative of 行く in Japanese.');
s('B2.C04.L03.A02.S06', 'prompt', 'Type the imperative of 行く in Japanese.');
s('B2.C04.L01.A02.S04', 'support.before[2].text', 'Sports interests vary by person and place. 野球（やきゅう）is baseball; サッカー is football/soccer.');
s('B2.C04.L04.A01.S07', 'support.after[2].text', { sub: [['Two identical 点 tokens have separate physical IDs.', '点 appears twice, so either copy can go in either gap.']] });
s('B2.C04.L04.A02.S03', 'support.after[2].text', { sub: [['Both use 点, with separate physical tokens here.', 'Both use 点.']] });
s('B2.C04.L05.A02.S02', 'support.after[0].text', { sub: [['for this authored character; the name does not establish every name’s reading.', 'in this name; the same character can be read differently in other names.']] });
s('B2.C04.L05.A02.S04', 'support.after[2].text', '走れ and 来い are the two imperative words. 来ます is polite nonpast; 走る is dictionary form. Both words must be correct.');
s('B2.C04.L05.A02.S04', 'prompt', 'Select the two imperative words heard in the football scene.');

// ---------------------------------------------------------------- B2.C05
s('B2.C05.CP.A01.S03', 'support.after[2].text', { sub: [['This task explicitly accepts both kana forms.', 'You can type either kana form.']] });
s('B2.C05.L01.A01.S03', 'support.before[2].text', 'Some inns offer tatami rooms, baths, yukata or meals. Facilities and customs vary; check the particular inn’s guidance.');
s('B2.C05.L02.A01.S01', 'kanji.shapeNote', 'The left is the food radical 飠; the right resembles 官.');
s('B2.C05.L02.A01.S03', 'kanji.shapeNote', 'Notice the compact left-hand strokes and 殳 on the right.');
s('B2.C05.L02.A01.S10', 'kanji.shapeNote', 'Notice 宀 (roof) above 至.');
s('B2.C05.CP.A01.S10', 'prompt', 'Type the polite form of 好き, using kanji or kana.');
s('B2.C05.L03.A01.S05', 'prompt', 'Type the polite form of 好き, using kanji or kana.');
s('B2.C05.CP.A01.S03', 'prompt', 'Type the kana reading of 三階.');

// table translation blocks that were bare word lists built from the table cells
s('B2.C05.L01.A01.S10', 'support.before[1].text', 'These are the readings for the first to the tenth floor of a building.');
s('B2.C05.L01.A02.S07', 'support.before[1].text', 'These pairs show everyday and service words for woman, man and meal.');
s('B2.C05.L02.A02.S01', 'support.before[1].text', 'One word means family members; the other means a home or household.');
s('B2.C05.L03.A01.S02', 'support.before[1].text', 'These words take the prefix お: name, telephone, meal, liked and skilful.');
s('B2.C05.L03.A01.S09', 'support.before[1].text', 'These words take the prefix ご: address, the other person’s parents, the other person’s family, order and kindness.');

// ---------------------------------------------------------------- B2.C06
s('B2.C06.CP.A01.S03', 'support.after[2].text', 'Duration + も emphasises that the waiting time was long. You can type も or romaji (mo).');
s('B2.C06.CP.A01.S03', 'prompt', 'Listen and type the particle emphasising the long duration.');
s('B2.C06.CP.A01.S16', 'prompt', 'Listen and type the adjective meaning “sweet”.');
s('B2.C06.CP.A01.S16', 'support.after[2].text', 'You can type 甘い, あまい or romaji (amai). です is already supplied, so leave it out.');
s('B2.C06.CP.A01.S19', 'prompt', 'Listen and type the adverbial form of “easy to understand”.');
s('B2.C06.CP.A01.S19', 'support.after[2].text', 'Change やすい to adverbial やすく before 書いてあります. You can type やすく in kana or romaji (yasuku).');
s('B2.C06.L02.A01.S01', 'support.after[2].text', { sub: [[' The feedback gives a taste cue, without a full source transcript.', '']] });
s('B2.C06.L02.A01.S03', 'prompt', 'Type “sweet” in kanji, kana or romaji.');
s('B2.C06.L02.A01.S03', 'support.after[2].text', '甘い is sweet, contrasting here with 苦い, bitter. You can type 甘い, あまい or romaji (amai).');
s('B2.C06.L02.A01.S07', 'support.after[2].text', { sub: [['; this feedback gives categories and meanings without a full source transcript.', '.']] });
s('B2.C06.L03.A01.S06', 'support.after[2].text', { sub: [[' The visible source remains before the answer; feedback gives the contrast only.', '']] });
s('B2.C06.L03.A01.S09', 'support.after[2].text', { sub: [['; feedback retains the stem cue without a full transcript.', '.']] });
s('B2.C06.L03.A02.S07', 'prompt', 'Type the adverbial form of 分かりやすい in kanji, kana or romaji.');
s('B2.C06.L03.A02.S07', 'support.after[2].text', 'Replace final い with く to modify 書いてあります. てある describes the resulting state of deliberate writing. You can type 分かりやすく, わかりやすく or romaji (wakariyasuku).');
s('B2.C06.L04.A02.S07', 'support.after[2].text', { sub: [['This occurrence explicitly accepts も and its displayed romanization mo; no general romanization conversion is applied.', 'You can type も or romaji (mo).']] });
s('B2.C06.L04.A02.S05', 'prompt', 'Build the sentence about a surprisingly large drink quantity.');
s('B2.C06.L04.A02.S09', 'prompt', 'Build the sentence emphasising frequent changes of trains.');
s('B2.C06.L05.A01.S01', 'kanji.shapeNote', 'Recognise 宀 above 各.');
s('B2.C06.L05.A01.S03', 'kanji.shapeNote', 'Recognise 見 on the right of the complete glyph 観.');
s('B2.C06.L05.A01.S07', 'kanji.shapeNote', 'Notice the three small upper strokes and the lower 儿-like shape.');
s('B2.C06.L05.A02.S01', 'kanji.shapeNote', 'Recognise 辶 around 袁.');
s('B2.C06.L05.A02.S05', 'kanji.shapeNote', 'Recognise 木 on the left and 不 on the right.');
s('B2.C06.L06.A02.S04', 'support.after[2].text', { sub: [['Similar repeated bank characters remain distinct physical tokens.', 'The tiles お and ご each appear twice, so either copy can go in its matching gap.']] });
s('B2.C06.L06.A02.S07', 'prompt', 'Listen and build the announcement of the exit side.');
s('B2.C06.L05.A01.S10', 'prompt', 'Insert three kanji to complete passengers and sightseeing.');
s('B2.C06.L05.A02.S03', 'prompt', 'Complete distance, town and light with three characters.');
s('B2.C06.L05.A02.S09', 'prompt', 'Complete the spectator and toast compounds with three characters.');

// bare-word-list table translations: proper English support
s('B2.C06.L03.A02.S04', 'support.before[2].text', 'Guidance, information office, tourist information, directions, information.');
s('B2.C06.L04.A01.S02', 'support.before[2].text', 'An empty plate counts as one flat object; the food counts as one plateful, two platefuls and three platefuls.');
s('B2.C06.L04.A02.S01', 'support.before[2].text', 'One cupful, two cupfuls, three cupfuls, six cupfuls, eight cupfuls, ten cupfuls. One bottle, three bottles.');
s('B2.C06.L05.A01.S05', 'support.before[2].text', 'I look at the scenery from the window. I watch a film at the theatre.');

// ---------------------------------------------------------------- B2.C07
s('B2.C07.CP.A01.S02', 'support.after[2].text', 'The topic and dish cues identify a daily recommendation.');
s('B2.C07.CP.A01.S09', 'support.after[2].text', 'The scenery and travel trend cues refer to Kyoto.');
s('B2.C07.CP.A01.S13', 'prompt', 'Listen and type the trial request in kanji, kana or romaji; ください is supplied.');
s('B2.C07.CP.A01.S13', 'support.after[2].text', '行く → 行って + みてください invites trying the action. You can type 行ってみて, いってみて or romaji (ittemite).');
s('B2.C07.CP.A01.S15', 'prompt', 'Listen and type the nominalising particle in kana or romaji.');
s('B2.C07.CP.A01.S15', 'support.after[2].text', 'の nominalises 友達ができる, so the clause can become the topic before は. You can type の or romaji (no).');
s('B2.C07.L01.A01.S08', 'prompt', 'Listen and type the dictionary form before の. Use kana or romaji.');
s('B2.C07.L01.A01.S08', 'support.after[2].text', { sub: [['This occurrence accepts できる or dekiru; the fixed の is outside the answer.', 'You can type できる or romaji (dekiru); の is already supplied.']] });
s('B2.C07.L02.A01.S08', 'prompt', 'Listen and complete the particle for the viewing point and the object marker.');
s('B2.C07.L02.A02.S01', 'prompt', 'Listen and insert the particles: two follow the season and one marks what falls.');
s('B2.C07.L02.A02.S01', 'support.after[2].text', { sub: [[' The two characters に and は are separate physical responses.', '']] });
s('B2.C07.L03.A01.S03', 'support.after[2].text', { sub: [['Each of the two す tiles is a separate physical character.', 'The two す tiles are identical, so either can go in either gap.']] });
s('B2.C07.L03.A02.S04', 'prompt', 'Listen and type the encouragement word in kana, kanji or romaji.');
s('B2.C07.L03.A02.S04', 'support.after[2].text', { sub: [['This occurrence explicitly accepts ぜひ, 是非 and zehi.', 'You can type ぜひ, 是非 or romaji (zehi).']] });
s('B2.C07.L04.A01.S01', 'kanji.shapeNote', 'Recognise the 雨-shaped upper part and the ヨ-like lower part.');
s('B2.C07.L04.A01.S03', 'kanji.shapeNote', 'Recognise 日 above 京.');
s('B2.C07.L04.A01.S05', 'kanji.shapeNote', 'Recognise the water radical 氵 on the left of 流.');
s('B2.C07.L04.A01.S07', 'kanji.shapeNote', 'Recognise the 八-like upper strokes and the ム-like lower shape.');
s('B2.C07.L04.A01.S09', 'kanji.shapeNote', 'Recognise the enclosing 囗 around 袁. Think of the fence-like outline as a memory tip.');
s('B2.C07.L03.A02.S07', 'support.before[2].text', 'This is my favourite café. I like this café.');
s('B2.C07.L04.A02.S04', 'support.before[2].text', 'Scenery, winter scenery, snow-covered scenery, scenery in the rain.');

// ---------------------------------------------------------------- B2.C08
s('B2.C08.CP.A01.S07', 'prompt', 'Listen and type the plain desire form. Use kana, kanji or romaji.');
s('B2.C08.CP.A01.S09', 'prompt', 'Listen and type the birth noun in kana or romaji.');
s('B2.C08.CP.A01.S09', 'support.after[2].text', '生まれ（うまれ）is a noun in 辰年生まれ. The supplied の links the noun to はず. You can type うまれ or romaji (umare).');
s('B2.C08.L01.A01.S08', 'prompt', 'Listen and type the birth-noun ending with its linking particle, in kana or romaji.');
s('B2.C08.L01.A01.S08', 'support.after[2].text', '生まれ is a noun, so 生まれの connects to はず. You can type うまれの or romaji (umareno).');
s('B2.C08.L04.A02.S06', 'support.after[2].text', '人差し指 is the index finger, read ひとさしゆび. し指 is already supplied, so insert the two kanji before it.');
s('B2.C08.L05.A01.S05', 'support.after[0].text', { sub: [[' This feedback gives the question’s purpose without a full listening transcript.', '']] });
s('B2.C08.L05.A02.S08', 'support.after[2].text', { sub: [['The two physical ん tokens are distinct and may exchange equivalent slots.', 'The two ん tiles are identical, so either can go in either ん gap.']] });
s('B2.C08.L06.A01.S07', 'prompt', 'Listen and type the plain desire form in kanji, kana or romaji.');
s('B2.C08.L06.A01.S07', 'support.after[2].text', { sub: [['The three explicit script variants are accepted for this occurrence; かな is supplied.', 'You can type 食べたい, たべたい or romaji (tabetai); かな is already supplied.']] });

// ---------------------------------------------------------------- B2.C09
s('B2.C09.L02.A02.S07', 'support.after[2].text', { sub: [['can also occur in the reviewed alternative orders.', 'can also come in other natural orders.']] });
s('B2.C09.CP.A01.S15', 'prompt', 'Select exactly three correct て-forms for 確かめる, 断る and 返す.');

// ---------------------------------------------------------------- B2.C10
s('B2.C10.CP.A01.S19', 'support.after[2].text', { sub: [['Each repeated tile is a separate physical option.', 'The repeated tiles are identical, so either copy can go in its matching gap.']] });
s('B2.C10.L08.A02.S07', 'prompt', 'The staff ask “ポイントカードをお持ちですか。” Choose the customer’s natural reply.');
s('B2.C10.L05.A01.S01', 'prompt', 'Study 遊: shape, readings and words in context.');
s('B2.C10.L05.A01.S03', 'prompt', 'Study 疲: shape, readings and words in context.');
s('B2.C10.L05.A01.S06', 'prompt', 'Study 吸: shape, readings and words in context.');
s('B2.C10.L05.A01.S08', 'prompt', 'Study 別: shape, readings and words in context.');
s('B2.C10.L05.A02.S01', 'prompt', 'Study 直: shape, readings and words in context.');

// ---------------------------------------------------------------- instruction-template normalisation of leading verbs on gap screens
// Reconstruct / Place / Supply / Fill / Build / Use-with-pieces on a `gaps` screen all ask for the same action.
// Whole word or sentence -> "Complete"; named pieces -> "Insert".
s('B2.C01.L05.A01.S04', 'prompt', 'Insert both とか markers, one kana per gap, to list sake vessels.');
s('B2.C02.L02.A01.S07', 'prompt', 'Complete the sentence with four kanji.');
s('B2.C02.L07.A02.S07', 'prompt', 'Insert both kana reading stems. かった and くない are supplied.');
s('B2.C03.CP.A01.S08', 'prompt', 'Complete the six-character negative sold-out verb.');
s('B2.C03.L03.A01.S01', 'prompt', 'Listen and complete the five-kana negative time window.');
s('B2.C03.L03.A01.S06', 'prompt', 'Complete the six-character negative sold-out verb.');
s('B2.C03.L04.A01.S02', 'prompt', 'Complete the four-kana word for effort.');
s('B2.C03.L04.A01.S05', 'prompt', 'Complete the three-kana exam noun.');
s('B2.C03.L04.A01.S09', 'prompt', 'Complete the four-kana te-form ending and polite trial suffix. 飲ん is supplied.');
s('B2.C03.L06.A01.S12', 'prompt', 'Complete the exam and effort words with four kanji.');
s('B2.C03.L06.A02.S02', 'prompt', 'Insert the word-specific kana reading stems of 通. う and る are supplied.');
s('B2.C04.CP.A01.S12', 'prompt', 'Insert five characters in the sports, rank and victory compounds.');
s('B2.C04.L04.A01.S12', 'prompt', 'Insert five characters in the sports, rank and victory compounds.');
s('B2.C05.L02.A02.S02', 'prompt', 'Complete 家庭 and 家族 with four characters.');
s('B2.C05.L03.A02.S05', 'prompt', 'Complete the respectful word for a child.');
s('B2.C05.L04.A01.S03', 'prompt', 'Insert four service prefixes/suffixes.');
s('B2.C06.CP.A01.S05', 'prompt', 'Listen and complete passenger and sightseeing with three characters.');
s('B2.C06.CP.A01.S07', 'prompt', 'Insert the stem for the respectful transfer request.');
s('B2.C06.CP.A01.S10', 'prompt', 'Insert the adjective stems before the supplied そう.');
s('B2.C06.CP.A01.S11', 'prompt', 'Listen and complete spectator and toast with three characters.');
s('B2.C06.L02.A01.S02', 'prompt', 'Complete the compound adjective for oily food.');
s('B2.C06.L03.A02.S03', 'prompt', 'Complete the past ease adjective.');
s('B2.C06.L03.A02.S05', 'prompt', 'Insert the complete ease adjective before the noun.');
s('B2.C07.CP.A01.S03', 'prompt', 'Listen and insert the three-character wondering ending.');
s('B2.C07.L05.A02.S06', 'prompt', 'Listen and insert the three-character wondering ending.');
s('B2.C08.L01.A01.S06', 'prompt', 'Listen and insert the three characters that connect a noun to the expectation.');
s('B2.C08.L01.A02.S06', 'prompt', 'Listen and insert the three characters to complete the knowing-state verb.');
s('B2.C08.L01.A02.S08', 'prompt', 'Listen and complete the negative plain verb with three characters.');
s('B2.C08.L02.A01.S06', 'prompt', 'Listen and insert the three characters after the な-adjective.');
s('B2.C08.L02.A02.S05', 'prompt', 'Listen and complete the three-character potential verb.');
s('B2.C08.L03.A01.S09', 'prompt', 'Listen and insert the four characters for a refill in this familiar request.');
s('B2.C08.L03.A02.S05', 'prompt', 'Listen and insert the four katakana characters for this thirst state.');
s('B2.C08.L04.A02.S06', 'prompt', 'Listen and insert the two kanji in the index-finger request.');
s('B2.C08.L05.A01.S06', 'prompt', 'Listen and complete the mouth word and two-character wondering ending.');
s('B2.C08.L05.A02.S03', 'prompt', 'Listen and complete the noun link and the word for scent.');
s('B2.C08.L05.A02.S08', 'prompt', 'Listen and insert the four kana in the adjective for freshness.');
s('B2.C08.L06.A01.S03', 'prompt', 'Listen and insert the な-adjective connection before のかな.');
s('B2.C08.L06.A01.S04', 'prompt', 'Listen and complete the plain ongoing-state ending with three characters.');
s('B2.C08.L07.A01.S10', 'prompt', 'Listen and complete the tentative gift choice with four characters.');
s('B2.C09.L01.A01.S07', 'prompt', 'Listen and insert the three characters in the party-size question.');
s('B2.C09.L06.A01.S08', 'prompt', 'Insert the particle for a specific selected restaurant.');
s('B2.C10.CP.A01.S20', 'prompt', 'Listen and insert the two characters in the causative of 飲む.');
s('B2.C10.L02.A02.S02', 'prompt', 'Insert the three particles in their roles.');
s('B2.C10.L07.A01.S01', 'prompt', 'Complete the causative form of 待つ with three characters.');
s('B2.C10.L08.A02.S09', 'prompt', 'Insert the three kanji in the farewell.');
s('B2.C10.L02.A01.S10', 'prompt', 'Listen and build the sentence about who made whom laugh.');

// ordering screens: one verb ("Build") for the same action
s('B2.C02.CP.A01.S13', 'prompt', 'Use the supplied start and build the sentence from all six chunks to contrast the predicates.');

// Kanji shape notes and kanji after-answer notes: keep the description, drop meta-disclaimers (etymology / stroke order / historical).
s('B2.C02.L02.A01.S01', 'kanji.shapeNote', 'Look at 厶 at the top and the three slanting lines 彡 below. Compare the whole shape.');
s('B2.C04.L04.A01.S01', 'kanji.shapeNote', 'Notice 月 on the left and 力 in the lower right. Compare the full right-hand shape with 脳 and the left component of 藤.');
s('B2.C04.L04.A01.S03', 'kanji.shapeNote', 'Notice the small top component and 貝 below it. Compare 貝 here with the lower shape of 角.');
s('B2.C05.L02.A01.S07', 'kanji.shapeNote', 'Recognise 广 above/around 廷.');
s('B2.C05.L02.A01.S12', 'kanji.shapeNote', 'Compare 忄 (heart) on the left with 生 on the right. The complete 性 differs from standalone 生.');
s('B2.C08.L04.A01.S05', 'kanji.shapeNote', 'Notice the two short marks at the top and the eye-like enclosed shape below.');
s('B2.C07.L04.A01.S02', 'support.after[2].text', { sub: [[' This is a shape aid, not etymology.', '']] });
s('B2.C10.L05.A02.S02', 'support.after[2].text', { sub: [[' These are visual comparisons, not an explanation of etymology.', '']] });
s('B2.C03.L06.A01.S02', 'support.after[2].text', { sub: [[' The shapes are visual comparisons, not etymological claims.', '']] });
s('B2.C07.CP.A01.S07', 'support.after[2].text', { sub: [[' Recognising 公 and 園 is a memory aid, not a historical account of the characters.', '']] });
s('B2.C05.L02.A01.S06', 'support.after[2].text', 'The sentence says 三段 directly; no assumption about belt colour is needed.');
s('B2.C06.L03.A01.S03', 'prompt', 'Study the rule for forming “easy to” adjectives.');

// Leftover "this example / this task" caveat wording in explanations
s('B2.C03.L06.A02.S04', 'support.before[2].text', { sub: [['word-specific; this example is not a rule for every street name.', 'word-specific, so other street names may differ.']] });
s('B2.C03.L06.A02.S07', 'support.before[2].text', { sub: [['vary by institution; this example does not give a universal school calendar.', 'vary by institution.']] });
s('B2.C04.L02.A01.S06', 'support.after[2].text', { sub: [['The result belongs to this example, not a rule that a weaker team can never win.', 'The result applies to this match only; a weaker team can still win.']] });
s('B2.C04.L03.A01.S06', 'support.after[2].text', { sub: [['but this task asks for the imperative.', 'but here you need the imperative.']] });
s('B2.C05.L01.A02.S08', 'support.after[2].text', { sub: [[' in this example; it does not assert a universal yukata rule.', '; yukata customs vary.']] });
s('B2.C05.L02.A01.S05', 'support.before[2].text', { sub: [['; this example states a rank without inferring a universal belt color or skill standard.', '.']] });
s('B2.C05.L03.A02.S04', 'support.before[2].text', { sub: [['Availability varies; this example offers it at this venue.', 'Availability varies by venue.']] });
s('B2.C10.L06.A02.S04', 'support.before[2].text', { sub: [['; this example does not establish what a particular dish contains.', '; what a dish contains varies by restaurant.']] });

// Reading line whose question mark was written as a full stop; the surface ends 「どう？」. Katakana (スカーフ) is restored by the same rule.
s('B2.C08.L07.A01.S04', 'support.after[0].secondary', 'このスカーフはどう？いろいろなふくにあうし、かるいし、おすすめだよ。');

export const screenEdits = E;
