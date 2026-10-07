// Offline, reviewed production authoring. Source evidence and all released packs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu'), output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-two-occurrences.json'), 'utf8')).screens;
const jp = (text, secondary) => ({ kind: 'japanese', text, ...(secondary ? { secondary } : {}) });
const en = text => ({ kind: 'translation', text }), rule = text => ({ kind: 'explanation', text });
const fb = (text, reading, english, reason) => [jp(text, reading), en(english), rule(reason)];
const model = (prompt, text, reading, english, reason) => ({ renderer: 'model', prompt, support: { before: [jp(text, reading), en(english), ...(reason ? [rule(reason)] : [])], after: [] }, audio: { text, reading } });
const gap = (prompt, marked, reading, english, distractors, reason) => {
  const scaffold = [], targets = []; let last = 0;
  for (const m of marked.matchAll(/〔([^〕]+)〕/g)) { scaffold.push(marked.slice(last, m.index)); targets.push(m[1]); last = m.index + m[0].length; }
  scaffold.push(marked.slice(last)); const text = marked.replace(/〔([^〕]+)〕/g, '$1');
  const tokens = [...targets, ...distractors].map((text, i) => ({ id: `t${i}`, text }));
  // Stable authored shuffle; equivalent repeated text gets distinct IDs and explicit accepted mappings.
  const bank = [...tokens.filter((_, i) => i % 2), ...tokens.filter((_, i) => !(i % 2)).reverse()];
  return { renderer: 'gaps', prompt, scaffold, answer: { kind: 'ordered_slots', tokens: bank,
    slots: targets.map((target, i) => ({ id: `gap-${i + 1}`, acceptedTokenIds: tokens.filter(t => t.text === target).map(t => t.id) })) },
    praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } };
};
const choice = (prompt, options, accepted, text, reading, english, reason) => ({ renderer: 'choice', prompt,
  answer: { kind: 'choice', options: options.map((text, i) => ({ id: `o${i}`, text })), acceptedOptionIds: [`o${accepted}`] },
  praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } });
const truth = (statement, accepted, text, reading, english, reason, hidden = false) => ({ renderer: 'truth', truthMode: hidden ? 'audio_only' : 'supported',
  prompt: hidden ? 'Listen. Is the statement true or false?' : 'Read and listen. Is the statement true or false?', statement, answer: { kind: 'truth', accepted },
  praise: 'Well done!', support: { before: hidden ? [] : [jp(text, reading)], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } });
const order = (prompt, chunks, reading, english, reason, fixedPrefix) => {
  const tokens = chunks.map((text, i) => ({ id: `t${i}`, text })); const text = (fixedPrefix ?? '') + chunks.join('');
  const acceptedOrders = [tokens.map(t => t.id)];
  // Reviewed discourse placement: both 妹はじつは and じつは妹は preserve the target contrast.
  if (fixedPrefix && chunks[2] === '妹は' && chunks[3] === 'じつは') acceptedOrders.push(['t0','t1','t3','t2','t4','t5']);
  return { renderer: 'ordering', prompt, ...(fixedPrefix ? { fixedPrefix } : {}), answer: { kind: 'ordered_tokens', tokens: [...tokens].reverse(), acceptedOrders },
    praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } };
};
const typed = (prompt, before, after, acceptedForms, text, reading, english, reason) => ({ renderer: 'typed', prompt,
  typed: { label: 'Your answer', before, after }, answer: { kind: 'typed', acceptedForms, normalization: 'nfkc_trim' },
  praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } });
const pairs = (prompt, rows, reason) => ({ renderer: 'pairs', prompt,
  left: rows.map(([text], i) => ({ id: `l${i}`, text })), right: rows.map(([, text], i) => ({ id: `r${i}`, text })).reverse(),
  answer: { kind: 'pairs', pairs: rows.map((_, i) => ({ id: `p${i}`, leftId: `l${i}`, rightId: `r${i}` })) },
  praise: 'Well done!', support: { before: [], after: [rule(reason)] } });
const table = (prompt, caption, columns, rows, text, reading, reason) => ({ renderer: 'table', prompt,
  table: { caption, columns, rows: rows.map((cells, i) => ({ id: `row${i}`, cells })) },
  support: { before: [rule(reason)], after: [] }, audio: { text, reading } });
const kmodel = (character, shapeNote, meaning, readings, examples) => ({ renderer: 'kanji', prompt: `Study ${character}: shape, readings and words in context.`,
  kanji: { character, shapeNote, meaning, readings: readings.map(([text, note]) => ({ text, note })),
    examples: examples.map(([word, reading, meaning, sentence, sentenceReading, translation]) => ({ word, reading, meaning, sentence, sentenceReading, translation })) },
  support: { before: [], after: [] }, audio: { text: examples.map(e => e[3]).join(''), reading: examples.map(e => e[4]).join('') } });
const optimistic = ['私は楽観的です。いつも前向きに考えます。', 'わたしはらっかんてきです。いつもまえむきにかんがえます。', 'I am optimistic. I always think positively.'];
const diligent = ['姉はまじめです。毎日、一生懸命勉強しています。', 'あねはまじめです。まいにち、いっしょうけんめいべんきょうしています。', 'My older sister is diligent. She studies hard every day.'];
const contrast = ['父はがんこですが、じつは優しいです。', 'ちちはがんこですが、じつはやさしいです。', 'My father is stubborn, but actually kind.'];
const opinion = ['弟は私ががんこだと思っていますが、じつはそうではありません。', 'おとうとはわたしががんこだとおもっていますが、じつはそうではありません。', 'My younger brother thinks I am stubborn, but actually I am not.'];
const cold = ['私は寒がりなので、冬は苦手です。', 'わたしはさむがりなので、ふゆはにがてです。', 'I am sensitive to cold, so winter is difficult for me.'];
const shy = ['妹は明るいですが、じつは恥ずかしがりです。', 'いもうとはあかるいですが、じつははずかしがりです。', 'My younger sister is cheerful, but actually shy.'];
const relaxed = ['兄はのんびりしています。あまり急ぎません。', 'あにはのんびりしています。あまりいそぎません。', 'My older brother is laid-back. He does not hurry much.'];
const personality = ['お姉さんはどんな性格ですか。', 'おねえさんはどんなせいかくですか。', 'What is your older sister’s personality like?'];
const good = ['姉は性格がよくて、優しいです。', 'あねはせいかくがよくて、やさしいです。', 'My older sister is good-natured and kind.'];
const strict = ['私は自分に厳しいですが、他の人には甘いです。', 'わたしはじぶんにきびしいですが、ほかのひとにはあまいです。', 'I am strict with myself, but lenient with other people.'];
const idiom = ['空気を読むのが得意です。相手の気持ちを考えて話します。', 'くうきをよむのがとくいです。あいてのきもちをかんがえてはなします。', 'I am good at reading the room. I consider the other person’s feelings when I speak.'];
const weak = ['空気を読むのが苦手です。', 'くうきをよむのがにがてです。', 'I am not good at reading the room.'];
const causal = ['空気が読めないので、場に合わないことを言ってしまいます。', 'くうきがよめないので、ばにあわないことをいってしまいます。', 'Because I cannot read the room, I end up saying things that do not fit the situation.'];
const twoPeople = ['田中さんはまじめで、山田さんはのんびりしています。', 'たなかさんはまじめで、やまださんはのんびりしています。', 'Tanaka is diligent, and Yamada is laid-back.'];
const fear = ['弟は怖がりなので、怖い映画を見たくありません。', 'おとうとはこわがりなので、こわいえいがをみたくありません。', 'My younger brother is easily frightened, so he does not want to watch scary films.'];
const traitRule = 'These selected traits use an adjective stem + がり as a noun: 寒がり, 暑がり, 怖がり, 寂しがり（屋）, 恥ずかしがり. This is not a rule for every adjective. Use です with the resulting noun.';
const predicateRule = 'のんびり is adverbial: use のんびりする / のんびりしている. まじめ is a na-adjective: use まじめです or link with まじめで. Do not use のんびりです in this practice.';
const lenientRule = '人に厳しい / 人に甘い describes being strict / lenient with someone. 甘い is figurative here, not the taste of food. は marks the contrasted people.';
const roomRule = '空気を読む is figurative: notice the atmosphere and social cues. 読めない means cannot read; 読まない means does not read. 苦手 means not good at an activity; it is different from 得意, good at it. Social expectations depend on people and setting.';
const content = {
  l01: [
    model('Listen and read a positive outlook.', ...optimistic, '楽観的 is a na-adjective; 前向き means positive or forward-looking.'),
    gap('Listen and complete the contrasting trait.', '私は楽観的ですが、兄は〔悲観的〕です。', 'わたしはらっかんてきですが、あにはひかんてきです。', 'I am optimistic, but my older brother is pessimistic.', ['楽観的', 'まじめ'], '悲観的 means pessimistic. が joins the contrasting descriptions.'),
    model('Listen and read about diligence.', ...diligent, 'まじめ can mean serious, earnest or diligent. The studying context gives diligent here.'),
    gap('Listen carefully and choose the word for diligent.', '姉は〔まじめ〕です。', 'あねはまじめです。', 'My older sister is diligent.', ['みじめ', 'まじみ'], 'まじめ means diligent/serious; みじめ means miserable. まじみ is a sound-confusion distractor, not the target word.'),
    model('Listen and read a description that goes against an expectation.', ...contrast, 'がんこ means stubborn; 優しい means kind. じつは means actually and introduces something contrary to an expectation.'),
    choice('Which phrase correctly describes “a stubborn person”?', ['がんこ人', 'がんこい人', 'がんこな人'], 2, '父はがんこな人です。', 'ちちはがんこなひとです。', 'My father is a stubborn person.', 'A na-adjective takes な before a noun: がんこな人. It does not take い.'),
    gap('Complete “stubborn” in kana. Select one whole-word chunk.', '父は〔がんこ〕です。', 'ちちはがんこです。', 'My father is stubborn.', ['がこ', 'こんが'], 'The kana order is が・ん・こ. The retained occurrence has one response slot, so this whole word is one selectable chunk.'),
    gap('Complete the word that means “actually”.', '父はがんこですが、〔じつは〕優しいです。', contrast[1], contrast[2], ['例えば', '特に'], 'じつは introduces an unexpected fact. 例えば introduces an example; 特に means especially.'),
    truth('The speaker agrees that they are stubborn.', false, ...opinion, 'The brother thinks the speaker is stubborn, but the speaker says そうではありません, “that is not so”.', true),
    gap('Listen and complete the reported opinion and contrasting discourse word.', '弟は私が〔がんこ〕だと思っていますが、〔じつは〕そうではありません。', opinion[1], opinion[2], ['優しい', '例えば'], 'A na-adjective before と思っています takes だ here: がんこだ. じつは introduces the correction.'),
  ],
  l02: [
    kmodel('参', 'Look at 厶 at the top and the three slanting lines 彡 below. Use the static glyph to compare the whole shape.', 'participate; humbly go or come', [['まい-る', '参る: humble verb for your own going/coming'], ['さん', 'In compounds such as 参加']], [
      ['参る', 'まいる', 'to go/come humbly', '大阪から参りました。', 'おおさかからまいりました。', 'I have come from Osaka.'],
      ['参加', 'さんか', 'participation', '会議に参加します。', 'かいぎにさんかします。', 'I will participate in the meeting.']]),
    choice('Choose the spelling of まいりました in a humble introduction.', ['参りました', '残りました', '今りました'], 0, '大阪から参りました。', 'おおさかからまいりました。', 'I have come from Osaka.', '参る humbly describes your own going/coming; 参りました is the polite past form.'),
    kmodel('実', 'Notice the roof 宀, the horizontal strokes underneath and the spreading lower strokes. Compare it with 字 and 宝.', 'reality; truth; fruit', [['じつ', 'In 実は and compounds'], ['み', 'Fruit: 実']], [
      ['実は', 'じつは', 'actually', '実は、妹は恥ずかしがりです。', 'じつは、いもうとははずかしがりです。', 'Actually, my younger sister is shy.'],
      ['実', 'み', 'fruit', '木に実がなっています。', 'きにみがなっています。', 'There is fruit growing on the tree.']]),
    choice('Choose the kanji spelling of じつは.', ['宝は', '実は', '字は'], 1, '実は、父は優しいです。', 'じつは、ちちはやさしいです。', 'Actually, my father is kind.', '実 is read じつ in 実は. The roof alone is not enough to identify the character.'),
    kmodel('然', 'Notice the four bottom dots 灬. Above them are a moon-like shape and 犬. This is a visual mnemonic, not a stroke-order animation.', 'so; state of being; a compound element', [['ぜん', 'In 自然 and 全然'], ['ねん', 'In 天然']], [
      ['自然', 'しぜん', 'nature', '自然に興味があります。', 'しぜんにきょうみがあります。', 'I am interested in nature.'],
      ['天然水', 'てんねんすい', 'natural water', '天然水を飲みます。', 'てんねんすいをのみます。', 'I drink natural water.']]),
    choice('Choose the word for nature: しぜん.', ['自然', '自燃', '自熱'], 0, '自然に興味があります。', 'しぜんにきょうみがあります。', 'I am interested in nature.', '自然 uses 然. 燃 and 熱 are different characters despite shared visual features.'),
    gap('Reconstruct the sentence with four kanji.', '〔実〕は、〔自〕〔然〕が好きで、日本に〔参〕りました。', 'じつは、しぜんがすきで、にほんにまいりました。', 'Actually, I like nature and have come to Japan.', ['字', '燃'], '実は, 自然 and 参りました combine the first three new characters with familiar 自.'),
    kmodel('特', 'Compare the left cow component 牜 with 扌. The right side is 寺.', 'special; particular', [['とく', 'In 特に, 特売 and 特産品'], ['とっ', 'Sound contraction before きゅう in 特急']], [
      ['特に', 'とくに', 'especially', '特に、日本の文化に興味があります。', 'とくに、にほんのぶんかにきょうみがあります。', 'I am especially interested in Japanese culture.'],
      ['特急', 'とっきゅう', 'limited express', '特急で大阪に行きます。', 'とっきゅうでおおさかにいきます。', 'I will go to Osaka by limited express.']]),
    choice('Choose the character with 牜 + 寺: とく.', ['持', '時', '特'], 2, '特に、日本の文化に興味があります。', 'とくに、にほんのぶんかにきょうみがあります。', 'I am especially interested in Japanese culture.', '特 has 牜 on the left. 持 has 扌; 時 has 日.'),
    kmodel('例', 'Notice person 亻 on the left and 列 on the right. Compare the right side with 到 in 倒.', 'example', [['たと-え', 'In 例えば'], ['れい', 'In 例 and 例外']], [
      ['例えば', 'たとえば', 'for example', '例えば、京都に行きたいです。', 'たとえば、きょうとにいきたいです。', 'For example, I want to go to Kyoto.'],
      ['例外', 'れいがい', 'exception', 'これは例外です。', 'これはれいがいです。', 'This is an exception.']]),
    choice('Choose the correct spelling of たとえば.', ['倒えば', '列えば', '例えば'], 2, '例えば、京都に行きたいです。', 'たとえば、きょうとにいきたいです。', 'For example, I want to go to Kyoto.', '例えば uses 例, with 亻 + 列. 倒 and 列 cannot replace it.'),
    pairs('Match each compound to its reading and meaning.', [['参加', 'さんか · participation'], ['例外', 'れいがい · exception']], '参加 uses さん; 例外 uses れい. These compound readings differ from 参る and 例えば.'),
    table('Listen and study kanji used in given names.', 'Names and associations', ['Example name', 'Reading in this example', 'Association'], [
      ['実', 'みのる', 'Fruit / reality; a given-name reading'], ['優', 'ゆう', 'Kindness / excellence; one possible given-name reading'], ['優しい', 'やさしい', 'Kind; ordinary adjective, not a name reading']],
      '実さんと優さんです。優さんは優しい人です。', 'みのるさんとゆうさんです。ゆうさんはやさしいひとです。', 'Kanji can suggest meanings in names, but readings and naming intentions vary. These are readings for these examples only. 優 appears here before its later full character lesson; 優しい means kind.'),
    gap('Insert the three kanji in the names and adjective. Here 実 is Minoru and 優 is Yū.', '〔実〕さんと〔優〕さんです。優さんは〔優〕しい人です。', 'みのるさんとゆうさんです。ゆうさんはやさしいひとです。', 'These are Minoru and Yū. Yū is a kind person.', [], 'The two 優 tokens are interchangeable physical copies. 実 and 優 have the supplied name readings in this example; 優しい is やさしい.'),
    order('Build the humble introduction: “I am Minoru. I have come from Osaka.”', ['実と', '申します。', '大阪から', '参りました。'], 'みのるともうします。おおさかからまいりました。', 'I am Minoru. I have come from Osaka.', 'The speaker’s name is 実（みのる）here. と申します introduces your own name; 参りました describes your own arrival humbly.'),
    gap('Insert four kanji to complete the example and emphasis words.', '〔例〕えば、〔自〕然を見たいです。〔特〕に、木の〔実〕に興味があります。', 'たとえば、しぜんをみたいです。とくに、きのみにきょうみがあります。', 'For example, I want to see nature. I am especially interested in fruit on trees.', ['然', '持'], 'Examples use 例えば; emphasis uses 特に. 自然 is nature; 木の実 is fruit on trees.'),
    choice('Choose the spelling of てんねんすい, natural water.', ['天然水', '天燃水', '天熱水'], 0, '天然水を飲みます。', 'てんねんすいをのみます。', 'I drink natural water.', '然 is read ねん in 天然. 天然水 is natural water.'),
    pairs('Match three 特 compounds to their readings and meanings.', [['特売', 'とくばい · special sale'], ['特産品', 'とくさんひん · local specialty product'], ['特急', 'とっきゅう · limited express']], '特 is とく in 特売 and 特産品, but contracts to とっ before きゅう in 特急. Train stopping patterns and fares depend on the operator and service; this word does not mean “never stops”.'),
    gap('Listen and complete the two kanji. とか lists examples.', '〔例〕えば、京都とか奈良とかに行きたいです。〔特〕に、日本の文化に興味があります。', 'たとえば、きょうととかならとかにいきたいです。とくに、にほんのぶんかにきょうみがあります。', 'For example, I want to visit places such as Kyoto and Nara. I am especially interested in Japanese culture.', ['実', '然'], 'Insert 例 before えば and 特 before に. とか is the conversational list marker from chapter 1.'),
    choice('Listen. Which topic interests the speaker?', ['文化', '自然', '歴史'], 1, '自然に興味があります。山や森がある所に行きたいです。', 'しぜんにきょうみがあります。やまやもりがあるところにいきたいです。', 'I am interested in nature. I want to go somewhere with mountains and forests.', 'Mountains and forests identify 自然, nature. The options use kanji; the source and translation appear only after answering.'),
    gap('Listen and complete the transport word and humble verb.', '〔特急〕で大阪から〔参りました〕。', 'とっきゅうでおおさかからまいりました。', 'I have come from Osaka by limited express.', ['特売', 'いらっしゃいました'], 'で marks the means of travel. 特急 is とっきゅう; 参りました is humble self-reference. いらっしゃいました respectfully describes someone else.'),
  ],
  l03: [
    model('Listen and read about sensitivity to cold.', ...cold, traitRule),
    gap('Select the adjective stem. がり is supplied.', '私は〔寒〕がりです。', 'わたしはさむがりです。', 'I am sensitive to cold.', ['寒い', '寒く'], 'Remove the final い from 寒い before がり. Insert 寒, not 寒い or 寒く.'),
    table('Compare these five adjective stems and trait nouns.', 'Selected adjective → がり trait nouns', ['Adjective', 'Trait noun', 'Reading / meaning'], [
      ['寒い', '寒がり', 'さむがり · sensitive to cold'], ['暑い', '暑がり', 'あつがり · sensitive to heat'], ['怖い', '怖がり', 'こわがり · easily frightened'], ['寂しい', '寂しがり（屋）', 'さびしがり（や） · prone to loneliness'], ['恥ずかしい', '恥ずかしがり', 'はずかしがり · shy']],
      '寒がり。暑がり。怖がり。寂しがり屋。恥ずかしがり。', 'さむがり。あつがり。こわがり。さびしがりや。はずかしがり。', traitRule),
    gap('Complete the trait for someone sensitive to heat.', '兄は〔暑がり〕なので、夏は苦手です。', 'あにはあつがりなので、なつはにがてです。', 'My older brother is sensitive to heat, so summer is difficult for him.', ['寒がり', '怖がり'], '暑がり is sensitive to heat; 寒がり is sensitive to cold.'),
    choice('Listen. Which description fits the speaker?', ['Sensitive to heat', 'Easily frightened', 'Sensitive to cold'], 2, '寒がりなんです。冬は暖かい服をたくさん着ます。', 'さむがりなんです。ふゆはあたたかいふくをたくさんきます。', 'I am sensitive to cold. I wear lots of warm clothes in winter.', 'Warm clothing in winter supports 寒がり. なんです adds an explanatory tone after this noun.'),
    choice('Choose the trait for someone who feels shy when speaking in front of people.', ['暑がり', '恥ずかしがり', '寒がり'], 1, '妹は恥ずかしがりです。', 'いもうとははずかしがりです。', 'My younger sister is shy.', '恥ずかしい → 恥ずかしがり: the final い is removed before がり.'),
    pairs('Match each trait to a situation the person would likely avoid.', [['怖がり', 'Watching a scary film alone'], ['恥ずかしがり', 'Giving a speech in front of many people']], 'These are plausible consequences in these examples, not claims about every person with the trait. 怖がり relates to fear; 恥ずかしがり relates to shyness.'),
    truth('This cat tends to feel lonely.', true, 'うちの猫は寂しがり屋です。一人になると、よく鳴きます。', 'うちのねこはさびしがりやです。ひとりになると、よくなきます。', 'Our cat gets lonely easily. It often meows when it is alone.', '寂しがり屋 describes a tendency to loneliness. 屋 can be added to this trait noun.'),
    gap('Read the behavior and choose the missing trait.', '弟は〔怖がり〕なので、怖い映画を見たくありません。', fear[1], fear[2], ['暑がり', '寂しがり屋'], 'Avoiding scary films in this context indicates 怖がり, easily frightened.'),
    gap('Listen and complete the discourse word and trait.', '妹は明るいですが、〔じつは〕〔恥ずかしがり〕です。', shy[1], shy[2], ['特に', '暑がり'], 'じつは introduces an unexpected fact. 明るい and 恥ずかしがり can both describe this person.'),
  ],
  l04: [
    model('Listen and read a laid-back description.', ...relaxed, predicateRule),
    gap('Complete the adverb and its verb ending.', '兄は〔のんびり〕〔しています〕。', 'あにはのんびりしています。', 'My older brother is laid-back.', ['です', 'まじめ'], predicateRule),
    order('Build the description: “My older brother is laid-back.”', ['兄は', 'のんびり', 'しています。'], 'あにはのんびりしています。', 'My older brother is laid-back.', predicateRule),
    model('Listen and read a question about personality.', ...personality, 'どんな + noun asks what something is like. 性格 means personality or character.'),
    gap('Listen carefully and complete the personality noun.', 'お姉さんはどんな〔性格〕ですか。', personality[1], personality[2], ['生活', '正確'], '性格（せいかく）means personality. 生活（せいかつ）means daily life; 正確（せいかく）means accurate, not personality.'),
    order('Build the question: “What is your older sister’s personality like?”', ['お姉さん', 'は', 'どんな', '性格', 'ですか。'], personality[1], personality[2], 'Use は after the person, then どんな性格ですか.'),
    table('Study topic/subject descriptions and compatibility.', 'Describing personality and compatibility', ['Pattern', 'Example', 'Reading / meaning'], [
      ['Person は + 性格 が', good[0], `${good[1]} / ${good[2]}`], ['性格 が悪い', 'あの人は性格が悪いです。', 'あのひとはせいかくがわるいです。 / That person is unpleasant.'], ['Person と + 相性 が', '姉とは相性がいいです。', 'あねとはあいしょうがいいです。 / I get along well with my older sister.']],
      `${good[0]}あの人は性格が悪いです。姉とは相性がいいです。`, `${good[1]}あのひとはせいかくがわるいです。あねとはあいしょうがいいです。`, 'は marks the person/topic; が marks the characteristic being described. 相性がいい means people are compatible, not that they have identical personalities. いい links as よくて.'),
    truth('The speaker gets along well with their older sister.', true, '姉とは性格が違いますが、相性がいいです。', 'あねとはせいかくがちがいますが、あいしょうがいいです。', 'My older sister and I have different personalities, but we get along well.', '相性がいい describes compatibility despite different personalities.'),
    gap('Complete the noun and irregular linking stem. て is supplied.', '姉は〔性格〕が〔よく〕て、優しいです。', good[1], good[2], ['相性', 'いい'], 'いい becomes よい for conjugation, so its linking form is よくて. Insert よく before the supplied て.'),
    choice('Listen. Which description fits the speaker’s brother?', ['Diligent and shy', 'Laid-back and kind', 'Strict and pessimistic'], 1, '兄はのんびりしていて、優しいです。', 'あにはのんびりしていて、やさしいです。', 'My older brother is laid-back and kind.', 'のんびりしていて links the adverb + verb description to the i-adjective 優しい.'),
  ],
  l05: [
    model('Listen and read about strictness and leniency.', ...strict, lenientRule),
    choice('Choose the correct phrase for “a strict person”.', ['厳しい人', '厳しな人', '厳しいな人'], 0, '父は厳しい人です。', 'ちちはきびしいひとです。', 'My father is a strict person.', 'An i-adjective modifies a noun directly: 厳しい人. Do not add な.'),
    gap('Listen and complete self-reference and leniency.', '私は〔自分〕に厳しいですが、他の人には〔甘い〕です。', strict[1], strict[2], ['自分たち', '厳しい'], lenientRule),
    gap('Reconstruct the four particles; identical physical tokens may swap.', '私は自分〔に〕〔は〕甘いですが、他の人〔に〕〔は〕厳しいです。', 'わたしはじぶんにはあまいですが、ほかのひとにはきびしいです。', 'I am lenient with myself, but strict with other people.', ['を', 'が'], lenientRule),
    choice('Listen. Which combination describes the speaker?', ['Lenient with self, strict with others, shy', 'Strict with self, lenient with others, diligent', 'Laid-back, pessimistic, easily frightened'], 1, '私は自分に厳しいですが、他の人には甘いです。まじめな性格です。', 'わたしはじぶんにきびしいですが、ほかのひとにはあまいです。まじめなせいかくです。', 'I am strict with myself, but lenient with others. I have a diligent personality.', 'Listen for who receives strictness and leniency. まじめ adds a third trait; reversing 自分 and 他の人 changes the meaning.'),
    model('Listen and read the idiom “read the room”.', ...idiom, roomRule),
    truth('The speaker is unable to notice social cues.', false, ...idiom, '得意 says the speaker is good at this activity, the opposite of being unable. 空気を読む is figurative.'),
    table('Compare the idiom, ability and difficulty in context.', 'Reading the room: context and forms', ['Expression', 'Reading', 'Meaning'], [
      ['空気を読む', 'くうきをよむ', 'Notice the atmosphere and social cues'], ['空気が読めない', 'くうきがよめない', 'Cannot read the room'], ['空気を読むのが得意', 'くうきをよむのがとくい', 'Good at reading the room'], ['空気を読むのが苦手', 'くうきをよむのがにがて', 'Not good at reading the room']],
      '空気を読む。空気が読めない。空気を読むのが得意です。空気を読むのが苦手です。', 'くうきをよむ。くうきがよめない。くうきをよむのがとくいです。くうきをよむのがにがてです。', roomRule + ' In a quiet meeting, noticing that others want to finish can be a cue to keep a comment brief. Expectations differ; this is no universal cultural rule.'),
    gap('Complete the negative potential in the reason.', '空気が〔読めない〕ので、場に合わないことを言ってしまいます。', causal[1], causal[2], ['読む', '読まない'], roomRule),
    choice('空気を読むのが得意な人は、会議でみんなが疲れているとき、どうするでしょうか。', ['話を短くする。', '大声で歌い始める。', '同じ話を何度もする。'], 0, 'みんなが疲れているので、話を短くします。', 'みんながつかれているので、はなしをみじかくします。', 'Everyone is tired, so the person keeps the talk brief.', 'In this meeting context, keeping the talk brief responds to the others’ fatigue. This is a contextual inference, not a rule about all cultures or personalities.'),
  ],
  l06: [
    gap('Listen and complete both personality descriptions.', '姉は〔まじめ〕で、弟は〔優しい〕です。', 'あねはまじめで、おとうとはやさしいです。', 'My older sister is diligent, and my younger brother is kind.', ['のんびり', '甘い'], 'まじめ links with で; 優しい is an i-adjective and takes です here.'),
    truth('The speaker is sensitive to heat.', false, ...cold, '寒がり is sensitive to cold, not heat. 冬 is winter.', true),
    choice('弟は怖い映画を見たくありません。どんな性格でしょうか。', ['暑がり', '怖がり', '恥ずかしがり'], 1, ...fear, 'The scary-film context indicates 怖がり, easily frightened.'),
    gap('Listen and keep the two people’s descriptions in order.', '田中さんは〔まじめ〕で、山田さんは〔のんびり〕しています。', twoPeople[1], twoPeople[2], ['優しい', 'がんこ'], predicateRule),
    choice('Listen. What does the speaker say they find difficult?', ['Reading printed text', 'Noticing the atmosphere and social cues', 'Breathing in cold weather'], 1, ...weak, roomRule),
    gap('Complete the idiom noun and negative potential.', '〔空気〕が〔読めない〕ので、場に合わないことを言ってしまいます。', causal[1], causal[2], ['性格', '読む', '読まない'], roomRule),
    typed('Type the adjective meaning “kind”. Use kana or kanji, then select Check.', '妹は', 'です。', ['やさしい', '優しい'], '妹は優しいです。', 'いもうとはやさしいです。', 'My younger sister is kind.', 'Accepted app forms are やさしい and 優しい. The full adjective is required before the supplied です. Outer whitespace and Unicode width are normalized; romaji is not accepted.'),
    order('Use the supplied start and build: “My older brother is laid-back, but my younger sister is actually diligent.”', ['のんびり', 'していますが、', '妹は', 'じつは', 'まじめ', 'です。'], 'あには、のんびりしていますが、いもうとはじつはまじめです。', 'My older brother is laid-back, but my younger sister is actually diligent.', predicateRule, '兄は、'),
  ],
  l07: [
    kmodel('優', 'Notice 亻 on the left and the dense 憂 shape on the right. Compare the whole right side carefully.', 'kind; excellent', [['やさ-しい', 'In 優しい'], ['ゆう', 'In 優先 and 俳優']], [
      ['優しい', 'やさしい', 'kind', '妹は優しいです。', 'いもうとはやさしいです。', 'My younger sister is kind.'],
      ['優先席', 'ゆうせんせき', 'priority seat', '電車に優先席があります。', 'でんしゃにゆうせんせきがあります。', 'There are priority seats on the train.']]),
    choice('Choose the spelling of やさしい.', ['優しい', '憂しい', '愛しい'], 0, '妹は優しいです。', 'いもうとはやさしいです。', 'My younger sister is kind.', '優しい uses 優, with 亻 on the left. 憂 and 愛 are different characters.'),
    kmodel('怖', 'Notice the heart component 忄 on the left and 布 on the right. Compare 布 with 希.', 'fear; scary', [['こわ-い', 'In 怖い; the stem こわ also appears before がり']], [
      ['怖い', 'こわい', 'scary', 'この映画は怖いです。', 'このえいがはこわいです。', 'This film is scary.'],
      ['怖がり', 'こわがり', 'easily frightened', fear[0], fear[1], fear[2]]]),
    choice('Choose the correct spelling of こわい.', ['布い', '怖い', '希い'], 1, 'この映画は怖いです。', 'このえいがはこわいです。', 'This film is scary.', '怖 has 忄 + 布. 布 alone and 希 are different characters.'),
    gap('Listen and complete the two people’s adjectives.', '田中さんは〔優しい〕ですが、山田さんは〔怖い〕です。', 'たなかさんはやさしいですが、やまださんはこわいです。', 'Tanaka is kind, but Yamada is frightening.', ['寒い', '暑い'], '優しい is kind. 怖い describes someone as frightening here; 怖がり would mean that the person is easily frightened.'),
    kmodel('寒', 'Notice the roof 宀, the clustered strokes in the middle and the two dots at the bottom. Compare the complete shape with 塞.', 'cold', [['さむ-い', 'Weather or feeling cold; also the stem in 寒がり']], [
      ['寒い', 'さむい', 'cold', '今日は寒いです。', 'きょうはさむいです。', 'It is cold today.'], ['寒がり', 'さむがり', 'sensitive to cold', ...cold]]),
    choice('Choose the character in さむい.', ['塞', '実', '寒'], 2, '今日は寒いです。', 'きょうはさむいです。', 'It is cold today.', '寒 has two dots at the bottom; 塞 has 土 there. 実 has a different middle and lower shape.'),
    kmodel('暑', 'Notice 日 above 者. Compare 暑 with 署, which has a net-like top instead of 日.', 'hot weather', [['あつ-い', 'Hot weather; also the stem in 暑がり']], [
      ['暑い', 'あつい', 'hot (weather)', '今日は暑いです。', 'きょうはあついです。', 'It is hot today.'], ['暑がり', 'あつがり', 'sensitive to heat', '兄は暑がりです。', 'あにはあつがりです。', 'My older brother is sensitive to heat.']]),
    choice('Choose the character for hot weather.', ['署', '暑', '熱'], 1, '今日は暑いです。', 'きょうはあついです。', 'It is hot today.', '暑 uses 日 above 者. 熱 describes a hot object or substance, not the weather in this example.'),
    pairs('Match the same-reading adjectives to their meanings.', [['暑い（あつい）', 'Hot weather'], ['熱い（あつい）', 'A hot object or drink']], 'Both are あつい, but 暑い is for hot weather; 熱い is for hot objects/substances. Compare 暑い日 with 熱いお茶.'),
    pairs('Match each がり trait to its kana reading.', [['寒がり', 'さむがり'], ['暑がり', 'あつがり'], ['怖がり', 'こわがり']], 'The adjective reading stem precedes がり: さむ, あつ and こわ. The final adjective い is absent.'),
    kmodel('悪', 'Notice 亜 above 心. Use the bottom 心 to distinguish this character from visually similar shapes.', 'bad; evil', [['わる-い', 'In 悪い; わる in 悪口（わるくち）'], ['あく', 'In 悪意（あくい）']], [
      ['悪い', 'わるい', 'bad', '天気が悪いです。', 'てんきがわるいです。', 'The weather is bad.'], ['悪口', 'わるくち', 'bad-mouthing', '人の悪口を言わないでください。', 'ひとのわるくちをいわないでください。', 'Please do not speak ill of people.'], ['悪意', 'あくい', 'malice', '悪意はありません。', 'あくいはありません。', 'There is no malicious intent.']]),
    choice('Choose the spelling of わるい.', ['亜い', '悪い', '思い'], 1, '天気が悪いです。', 'てんきがわるいです。', 'The weather is bad.', '悪い uses 悪 with 心 at the bottom. 亜 alone lacks 心; 思 is a different character.'),
    gap('Listen and insert four old/new kanji.', '吉〔田〕さんは全〔然〕〔悪〕くありません。〔実〕は優しいです。', 'よしださんはぜんぜんわるくありません。じつはやさしいです。', 'Yoshida is not at all unpleasant. Actually, they are kind.', ['暑', '優'], '吉田 is read よしだ in this example. 全然 + negative means not at all. 悪くありません is the polite negative of 悪い; 実は adds the actual description.'),
    table('Listen and compare colloquial best/worst evaluations.', '最高 and 最悪 in conversation', ['Expression', 'Reading', 'Meaning in context'], [
      ['最高', 'さいこう', 'The best; great'], ['最悪', 'さいあく', 'The worst; awful'], ['今日は最悪だった。', 'きょうはさいあくだった。', 'Today was awful.']],
      '最高です。最悪です。今日は最悪だった。', 'さいこうです。さいあくです。きょうはさいあくだった。', '最悪 is a strong evaluation. In casual speech it can mean awful, rather than an objective comparison with every other possibility. 最高 contrasts with it.'),
    gap('Complete the best/worst contrast.', '昨日は〔最悪〕でしたが、今日は〔最高〕です。', 'きのうはさいあくでしたが、きょうはさいこうです。', 'Yesterday was awful, but today is great.', ['悪口', '優先'], '最悪（さいあく）and 最高（さいこう）are contrasting evaluations.'),
    gap('Listen and complete the occupation and description.', 'あの人は〔俳優〕で、〔優しい〕人です。', 'あのひとははいゆうで、やさしいひとです。', 'That person is an actor and a kind person.', ['声優', '怖い'], '俳優（はいゆう）is an actor; 声優（せいゆう）is a voice actor. 優 appears in 俳優 and 優しい with different readings.'),
    choice('Choose the reading of 優先席.', ['やさせんせき', 'ゆうせんせき', 'ゆうさきせき'], 1, '電車に優先席があります。', 'でんしゃにゆうせんせきがあります。', 'There are priority seats on the train.', '優先席 is ゆうせんせき. 優先 means priority; 席 means seat.'),
    gap('Insert five kanji in the social scene.', '〔寒〕そうにしていた私に、〔優〕しい〔俳〕〔優〕が席を譲ってくれました。〔実〕は、私の友達です。', 'さむそうにしていたわたしに、やさしいはいゆうがせきをゆずってくれました。じつは、わたしのともだちです。', 'A kind actor gave up their seat to me when I looked cold. Actually, the actor is my friend.', ['暑', '悪'], '寒そう means looks cold; 優しい means kind; 俳優 means actor. くれました presents the seat-giving as a favor to the speaker. 実は adds an unexpected fact.'),
    gap('Fill both kana reading stems. かった and くない are supplied.', '昨日は〔さむ〕かったですが、今日は〔あつ〕くないです。', 'きのうはさむかったですが、きょうはあつくないです。', 'It was cold yesterday, but it is not hot today.', ['さむい', 'あつい'], '寒い → 寒かった（さむかった）; 暑い → 暑くない（あつくない）. Insert the stems without repeating い.'),
    typed('Type the hiragana reading stem of 怖 in 怖い. い is supplied.', 'この映画は', 'いです。', ['こわ'], 'この映画は怖いです。', 'このえいがはこわいです。', 'This film is scary.', '怖 is こわ before the supplied い. This reading task accepts こわ only, not 怖, こわい or romaji.'),
  ],
  cp: [
    typed('Type the hiragana reading of 怖 before the supplied がり, then select Check.', '弟は', 'がりです。', ['こわ'], '弟は怖がりです。', 'おとうとはこわがりです。', 'My younger brother is easily frightened.', 'The reading stem is こわ. がり is already supplied; do not include it or the adjective ending い.'),
    order('Build the five-chunk humble introduction: “I am Minoru. I have come from the Osaka branch.”', ['実と', '申します。', '大阪支店', 'から', '参りました。'], 'みのるともうします。おおさかしてんからまいりました。', 'I am Minoru. I have come from the Osaka branch.', '実 is the example name Minoru here, as in lesson 2. と申します and 参りました are humble self forms. 支店 means branch.'),
    gap('Listen and complete “actually” and the shy trait.', '妹は明るいですが、〔じつは〕〔恥ずかしがり〕です。', shy[1], shy[2], ['例えば', '暑がり'], 'じつは introduces the unexpected shyness. 恥ずかしがり is a noun and takes です.'),
    choice('弟は怖い映画を見たくありません。どんな性格でしょうか。', ['寂しがり屋', '怖がり', '暑がり'], 1, ...fear, 'The fear of scary films indicates 怖がり.'),
    gap('Complete the personality noun and good linking stem. て is supplied.', '姉は〔性格〕が〔よく〕て、優しいです。', good[1], good[2], ['相性', 'いい'], 'いい links as よくて. The second gap is よく because て is supplied.'),
    order('Build the five-chunk personality question.', ['お姉さん', 'は', 'どんな', '性格', 'ですか。'], personality[1], personality[2], 'The person is the topic with は; どんな modifies 性格.'),
    choice('Listen. Which traits describe the speaker?', ['Strict with self, lenient with others, diligent', 'Lenient with self, strict with others, diligent', 'Strict with self, lenient with others, shy'], 0, '私は自分に厳しいですが、他の人には甘いです。まじめな性格です。', 'わたしはじぶんにきびしいですが、ほかのひとにはあまいです。まじめなせいかくです。', 'I am strict with myself, but lenient with others. I have a diligent personality.', lenientRule),
    gap('Listen carefully and select the diligence word.', '姉は〔まじめ〕です。毎日勉強しています。', 'あねはまじめです。まいにちべんきょうしています。', 'My older sister is diligent. She studies every day.', ['みじめ', 'まじみ'], 'まじめ means serious/diligent. みじめ means miserable; まじみ is a sound-order distractor.'),
    gap('Complete the reported opinion and “actually”.', '弟は私が〔がんこ〕だと思っていますが、〔じつは〕そうではありません。', opinion[1], opinion[2], ['優しい', '特に'], 'がんこだ is the na-adjective predicate before と思っています. じつは introduces the contrary fact.'),
    truth('The speaker says that their brother’s opinion is correct.', false, ...opinion, 'そうではありません denies the brother’s opinion. The sentence contrasts a reported thought with the actual situation.', true),
    typed('Type the adjective meaning “lenient” here. Use kana or kanji and select Check.', '私は他の人には', 'です。', ['あまい', '甘い'], '私は他の人には甘いです。', 'わたしはほかのひとにはあまいです。', 'I am lenient with other people.', 'This app accepts あまい and 甘い, with NFKC width normalization and outer trim only. 甘い is figurative leniency here. Romaji shown in source feedback did not prove acceptance and is not enabled.'),
    gap('Complete the idiom noun and negative potential.', '〔空気〕が〔読めない〕ので、場に合わないことを言ってしまいます。', causal[1], causal[2], ['性格', '読む', '読まない'], roomRule),
    order('Use the supplied start and arrange all six chunks to contrast the predicates.', ['のんびり', 'していますが、', '妹は', 'じつは', 'まじめ', 'です。'], 'あには、のんびりしていますが、いもうとはじつはまじめです。', 'My older brother is laid-back, but my younger sister is actually diligent.', predicateRule, '兄は、'),
    gap('Listen and keep the two people’s traits in order.', '田中さんは〔まじめ〕で、山田さんは〔のんびり〕しています。', twoPeople[1], twoPeople[2], ['がんこ', '優しい'], predicateRule),
    choice('Choose the character read とく that means “special”.', ['持', '時', '待', '特'], 3, '特に、自然に興味があります。', 'とくに、しぜんにきょうみがあります。', 'I am especially interested in nature.', '特 has the cow component 牜 on the left. 持 has 扌, 時 has 日, and 待 has 彳.'),
    choice('Choose the correct character in わるい.', ['悪い', '亜い', '思い'], 0, '天気が悪いです。', 'てんきがわるいです。', 'The weather is bad.', '悪 contains 心 below 亜; the other shapes cannot spell わるい.'),
    truth('The speaker is good at reading the room.', false, ...weak, '苦手 means not good at the activity, the opposite of 得意. 空気を読む is figurative social awareness.'),
    choice('空気を読むのが得意な人は、会議でみんなが疲れているとき、どうするでしょうか。', ['同じ話を何度もする。', '話を短くする。', '大声で歌い始める。'], 1, 'みんなが疲れているので、話を短くします。', 'みんながつかれているので、はなしをみじかくします。', 'Everyone is tired, so the person keeps the talk brief.', 'The likely behavior follows the fatigue cue in this specific meeting context.'),
    gap('Insert four particles in the contrasting leniency description.', '私は自分〔に〕〔は〕甘いですが、他の人〔に〕〔は〕厳しいです。', 'わたしはじぶんにはあまいですが、ほかのひとにはきびしいです。', 'I am lenient with myself, but strict with other people.', ['を', 'が'], lenientRule),
    gap('Choose the negative potential in this party context.', '彼は空気が〔読めない〕ので、静かなパーティーで大声で話してしまいます。', 'かれはくうきがよめないので、しずかなぱーてぃーでおおごえではなしてしまいます。', 'He cannot read the room, so he ends up speaking loudly at a quiet party.', ['読む', '読まない'], '読めない is cannot read; 読む is the dictionary form, read; 読まない is does not read. This app authors one gap; the source response count remains unknown.'),
  ],
};
const expected = { l01: 10, l02: 21, l03: 10, l04: 10, l05: 10, l06: 8, l07: 21, cp: 20 };
fs.mkdirSync(output, { recursive: true });
for (const [key, authored] of Object.entries(content)) {
  const recordId = `B2.C02.${key.toUpperCase()}`, record = records.find(r => r.recordId === recordId);
  if (!record || authored.length !== expected[key]) throw new Error(`Invalid authored count: ${key}`);
  const screens = authored.map((copy, i) => {
    const source = record.screens[i], teaching = ['model', 'kanji', 'table'].includes(copy.renderer), hidden = source.rawSupport.japanese_transcript_before_answer === false;
    const before = [...copy.support.before];
    // Recorded visible support stays visible; authored full corrections never leak into unsupported listening.
    if (source.rawSupport.japanese_transcript_before_answer === true && !before.some(b => b.kind === 'japanese')) before.push(jp(copy.audio.text, copy.audio.reading));
    if (source.rawSupport.translation_visible === true && !before.some(b => b.kind === 'translation')) {
      const translation = copy.support.after.find(b => b.kind === 'translation'); if (translation) before.push(translation);
    }
    return { screenId: source.screenId, prompt: null, answer: null, praise: null, ...copy,
      support: { before: hidden ? [] : before, after: copy.support.after },
      audio: { required: teaching || hidden || source.rawMedia.length > 0, text: null, ...copy.audio },
      visual: source.rawRenderer === 'speaker_model' ? 'video' : source.rawRenderer === 'kanji_model' ? 'image' : 'none',
      sourceContract: { purpose: source.purpose, sourceRenderer: source.rawRenderer, sourceRendererId: source.sourceRendererId, sourceActivityId: source.sourceActivityId,
        sourceExerciseNumber: source.sourceExerciseNumber,
        responseSlotCount: source.rawResponseSlotCount, responseSlotCountState: source.responseSlotCountState,
        transcriptBeforeAnswer: source.rawSupport.japanese_transcript_before_answer ?? (copy.renderer === 'model' ? true : null),
        translationBeforeAnswer: source.rawSupport.translation_visible, parallelReadingBeforeAnswer: copy.renderer === 'model', hintBeforeAnswer: false,
        recordedSupport: source.rawSupport, ...occurrences[source.screenId] }, evidence: source.evidence, unresolved: [] };
  });
  const pack = { schemaVersion: key === 'l06' ? '1.1' : '1.0', contentVersion: '1.0.0', recordId, status: 'reviewed', baseScreenCount: screens.length,
    provenance: { origin: 'app_authored', note: 'Owner-authorized chapter 2 production authoring, 4 October 2026. Canonical IDs, activity partitions, known response counts, recorded support, targets and purpose paraphrases are retained from local S18/S25/unified records. Japanese sentences, readings, translations, banks, accepted forms, mappings, tables, mnemonics and corrections are authored/adapted learning content, not observed source quotations. Models have visible English; kanji models provide static glyph/shape/components plus readings, meaning and contextual examples as an animation replacement. Fixed start 兄は、 is an explicit app-supplied prefix: evidence specifies an anchor but does not retain literal text or prove whether it was supplied. CP retains six selectable chunks after the prefix. Typed normalization is NFKC + outer trim only, with per-occurrence reviewed alternatives; feedback variants are not universal acceptance evidence. L06 optional completion metadata is a reviewed runtime projection from its retained tail community endpoint; the raw nine rows and null metadata stay unchanged.' },
    policies: { assessment: 'Equal weight per graded required screen; teaching is ungraded. Core completion, raw accuracy and checkpoint pass reporting are separate. Optional writing never blocks completion.',
      incorrectResponses: 'App policy: final response or explicit typed Check locks and opens correction. Wrong pairs allow retry but retain a screen mistake.',
      audio: 'Reuse existing Japanese TTS with complete scripts/readings and source playback gates. Unsupported listening hides transcript/translation until feedback.',
      visuals: 'Replaceable neutral slots; original imagery/video/kanji animation deferred. Static kanji shape teaching is complete; no invented stroke order.' },
    unresolvedSourceFacts: ['Exact source wording, exhaustive accepted variants, acoustic quality and source randomization remain unknown; authored production content fills ordinary literal gaps.',
      'Start-anchor literal text and original supplied-versus-instruction distinction are not retained; the app explicitly supplies an authored fixed prefix.',
      'Source rewards, unlock enforcement and score-boundary/remediation behavior are unproven; research outcomes never seed app progress.'], screens };
  if (key === 'cp') pack.passPolicy = { kind: 'none' };
  if (key === 'l06') {
    const s = record.screens[8];
    pack.completion = { contractVersion: '1.0', requiredScreenIds: screens.map(s => s.screenId), optionalSurfaces: [{ screenId: s.screenId,
      sourceExerciseNumber: s.sourceExerciseNumber, sourceActivityId: s.sourceActivityId, purpose: s.purpose,
      prompt: 'Write a short description of your personality, with an example or reason.',
      hint: 'You can use まじめ、優しい、がんこ、楽観的、寒がり、暑がり、怖がり、恥ずかしがり、自分に厳しい、他の人に甘い. Use のんびりしています for a laid-back description. Add じつは for an unexpected fact or ので for a reason.',
      modes: ['write'], provenance: { origin: 'app_authored', note: 'Source S09/exercise 10 identity retained; optional private ungraded writing only. No community submission or speaking action; draft stays in the open view and is not saved.' } }] };
  }
  fs.writeFileSync(path.join(output, `b2-c02-${key}.v1.json`), JSON.stringify(pack, null, 2) + '\n');
}
console.log('Assembled all chapter 2 entries: 110 required screens + separate optional writing L06 S09.');
