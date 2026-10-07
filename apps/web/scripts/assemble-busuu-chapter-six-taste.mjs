// Offline, reviewed production authoring. Source evidence and all released packs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu'), output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-six-taste-occurrences.json'), 'utf8')).screens;
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
  return { renderer: 'ordering', prompt, ...(fixedPrefix ? { fixedPrefix } : {}), answer: { kind: 'ordered_tokens', tokens: [...tokens].reverse(), acceptedOrders },
    praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } };
};
const typed = (prompt, before, after, acceptedForms, text, reading, english, reason) => ({ renderer: 'typed', prompt,
  typed: { label: 'Your answer', before, after }, answer: { kind: 'typed', acceptedForms, normalization: 'nfkc_trim' },
  praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } });
const table = (prompt, caption, columns, rows, text, reading, reason) => ({ renderer: 'table', prompt,
  table: { caption, columns, rows: rows.map((cells, i) => ({ id: `row${i}`, cells })) },
  support: { before: [rule(reason)], after: [] }, audio: { text, reading } });

const easeRule='Remove ます from the polite verb and add やすい (easy to) or にくい (hard to). 飲みます → 飲みやすい; 使います → 使いやすい; 座ります → 座りにくい. These compounds inflect as い-adjectives.';
const adjectiveRule='Link an い-adjective by replacing final い with くて. Negative: くない; polite past: かったです. Appearance: remove final い and add そうです; this expresses an impression, not a tasted fact.';
const limitedFeedback=(screen,blocks)=>({...screen,support:{before:screen.support.before,after:blocks},audio:{text:screen.audio.text,reading:screen.audio.reading}});
const tasteTurns=[
 ['staff','いらっしゃいませ。こちらのカレーは少し辛いですが、あまり脂っこくありません。','いらっしゃいませ。こちらの かれーは すこし からいですが、あまり あぶらっこく ありません。'],
 ['guest','辛いものはあまり食べられません。辛くない料理はありますか。','からいものは あまり たべられません。からくない りょうりは ありますか。'],
 ['staff','はい。この野菜のスープは辛くありません。デザートのヨーグルトは甘くて、少し酸っぱいです。','はい。この やさいの すーぷは からく ありません。でざーとの よーぐるとは あまくて、すこし すっぱいです。'],
 ['guest','では、野菜のスープとヨーグルトをお願いします。','では、やさいの すーぷと よーぐるとを おねがいします。'],
];
const content={};
// S11 retains phases and the 11+8 partition, but no individual tasks. Every task below is app-authored.
content.l01=[
 model('Learn a taste adjective.','このケーキは甘いです。','この けーきは あまいです。','This cake is sweet.','甘い（あまい）describes sweetness.'),
 model('Learn a taste adjective.','このスープは塩辛いです。','この すーぷは しおからいです。','This soup is salty.','塩辛い（しおからい）means salty. It specifies saltiness, unlike spicy 辛い in the curry example.'),
 model('Learn a taste adjective.','このカレーは辛いです。','この かれーは からいです。','This curry is spicy.','辛い（からい）describes a hot, spicy or sharp taste, including pepper and wasabi; it does not mean high temperature.'),
 model('Learn a taste adjective.','このレモンは酸っぱいです。','この れもんは すっぱいです。','This lemon is sour.','酸っぱい（すっぱい）describes sourness.'),
 model('Learn a taste adjective.','この料理は脂っこいです。','この りょうりは あぶらっこいです。','This dish is oily.','脂っこい（あぶらっこい）describes oily, fatty or greasy food. 油 is oil and 脂 is fat; 油っこい is also used.'),
 model('Learn a taste adjective.','このコーヒーは苦いです。','この こーひーは にがいです。','This coffee is bitter.','苦い（にがい）describes bitterness, distinct from sour 酸っぱい.'),
 table('Review how to connect two taste descriptions.','Linking い-adjectives',['Adjective','Linked form','Example meaning'],[['甘い','甘くて','sweet and…'],['辛い','辛くて','spicy and…'],['酸っぱい','酸っぱくて','sour and…']], 'このソースは甘くて、少し酸っぱいです。','この そーすは あまくて、すこし すっぱいです。',adjectiveRule),
 gap('Complete the linked sweet-and-sour description.','このソースは〔甘くて〕、少し〔酸っぱい〕です。','この そーすは あまくて、すこし すっぱいです。','This sauce is sweet and a little sour.',['甘い','苦い'],adjectiveRule),
 model('Review a negative taste description.','このスープは塩辛くありません。','この すーぷは しおからく ありません。','This soup is not salty.','塩辛い → 塩辛くないです or 塩辛くありません. Both polite negative constructions describe absence of saltiness.'),
 gap('Complete the polite negative: “not spicy.”','このカレーは〔辛く〕ありません。','この かれーは からく ありません。','This curry is not spicy.',['辛い','甘い'],'Before ありません, use the く form: 辛くありません.'),
 table('Review appearance before tasting.','Appearance with そう',['Adjective','Appearance','Meaning'],[['甘い','甘そうです','looks sweet'],['辛い','辛そうです','looks spicy'],['おいしい','おいしそうです','looks delicious']], 'このケーキは甘そうです。','この けーきは あまそうです。',adjectiveRule),
 gap('Complete “The cake looks sweet; the curry looks spicy.” そうです is supplied.','このケーキは〔甘〕そうです。このカレーは〔辛〕そうです。','この けーきは あまそうです。この かれーは からそうです。','This cake looks sweet. This curry looks spicy.',['甘い','辛い'],adjectiveRule),
 gap('Complete “I cannot eat very spicy food.”','とても辛いものは〔食べられ〕ません。','とても からいものは たべられません。','I cannot eat very spicy food.',['食べ','食べる'],'食べる → potential 食べられる. ません is supplied after the polite stem 食べられ.'),
 gap('Complete the past taste description.','昨日のコーヒーは〔苦かった〕です。','きのうの こーひーは にがかったです。','Yesterday’s coffee was bitter.',['苦い','苦くて'],adjectiveRule),
 choice('Which description specifically means salty?',['甘い','塩辛い','酸っぱい'],1,'塩辛い','しおからい','salty','塩辛い specifies saltiness. 辛い alone can refer to spicy or sharp food in context.'),
 model('Read one food-context example.','梅干しは、梅を塩漬けにした食べ物です。酸っぱくて、塩辛いものもあります。','うめぼしは、うめを しおづけにした たべものです。すっぱくて、しおからいものも あります。','Umeboshi are salt-pickled ume fruits. Some are sour and salty.','Recipes vary: seasoning, saltiness and sourness differ. This cultural example does not claim all umeboshi have the same taste.'),
 gap('Complete the cumulative description of this particular umeboshi.','この梅干しは〔酸っぱくて〕、とても〔塩辛い〕です。','この うめぼしは すっぱくて、とても しおからいです。','This umeboshi is sour and very salty.',['酸っぱい','甘い'],adjectiveRule),
 {renderer:'dialogue',prompt:'Listen to a staff member and customer discussing food.',dialogue:{japaneseVisible:true,translationVisible:false,context:'Choosing food at a restaurant',speakerLabels:{guest:'客',staff:'店員'},speakers:['guest','staff'],turns:tasteTurns.map(([speaker,japanese,reading],i)=>({id:`turn-${i+1}`,speaker,japanese,reading,english:null}))},support:{before:[],after:[]}},
 choice('Listen to the same conversation. What does the customer order?',['カレーとコーヒー','野菜のスープとヨーグルト','梅干しとケーキ'],1,tasteTurns.map(t=>t[1]).join('\n'),tasteTurns.map(t=>t[2]).join('\n'),'The customer orders vegetable soup and yogurt.','The customer cannot eat very spicy food, so chooses the non-spicy soup and the sweet, slightly sour yogurt.'),
];
// Parallel option readings are retained for these two listening choices; full source scripts stay hidden.
content.l02=[
 limitedFeedback(choice('Listen. Which taste best describes this food?',['酸っぱい','甘い','苦い'],0,'この料理にはレモンの汁をたくさん使っています。酸っぱい味がします。','この りょうりには れもんの しるを たくさん つかっています。すっぱい あじが します。','This dish has a sour taste.','The lemon-juice context indicates sourness.'),[jp('酸っぱい','すっぱい'),en('sour'),rule('Lemon juice provides the sour taste in this food context. The feedback gives a taste cue, without a full source transcript.')]),
 gap('Build the compound adjective for oily food.','この料理は〔脂〕〔っこい〕です。','この りょうりは あぶらっこいです。','This dish is oily.',['塩','甘い'],'脂（あぶら）is fat; 脂っこい means oily/fatty. 油っこい is also a legitimate spelling in this food description.'),
 typed('Type “sweet” in kanji, kana or the reviewed romaji form.','このケーキは苦くありません。とても','です。',['甘い','あまい','amai'],'このケーキは苦くありません。とても甘いです。','この けーきは にがく ありません。とても あまいです。','This cake is not bitter. It is very sweet.','甘い is sweet, contrasting here with 苦い, bitter. The displayed script variants are explicit accepted forms for this occurrence only.'),
 gap('Complete the seasoning category and its sharp taste.','わさびは〔薬味〕の一つです。このわさびはとても〔辛い〕です。','わさびは やくみの ひとつです。この わさびは とても からいです。','Wasabi is a condiment. This wasabi is very pungent.',['果物','甘い'],'薬味（やくみ）is a condiment/garnish. 辛い can describe wasabi’s sharp, pungent taste as well as chili or pepper heat.'),
 order('Listen and build a passive noun modifier and taste predicate.',['油で','揚げられた','料理は','脂っこいです。'],'あぶらで あげられた りょうりは あぶらっこいです。','The food fried in oil is oily.','油で揚げられた modifies 料理 before the noun. 揚げられた is the past passive of 揚げる, to fry.'),
 gap('Complete the reason and the food category.','〔油〕が多いので、脂っこい〔料理〕はあまり食べません。','あぶらが おおいので、あぶらっこい りょうりは あまり たべません。','Because they contain a lot of oil, I do not eat oily dishes very often.',['塩','果物'],'油 is oil; 脂っこい modifies the noun 料理. ので provides the reason. This is the speaker’s preference, not a nutritional rule.'),
 limitedFeedback(choice('Listen. Choose the taste combination described.',['甘くて、酸っぱい','苦くて、塩辛い','辛くて、脂っこい'],0,'このソースは砂糖と酢を使っています。甘くて、少し酸っぱいです。','この そーすは さとうと すを つかっています。あまくて、すこし すっぱいです。','The sauce is sweet and a little sour.','Sugar and vinegar support the sweet-and-sour combination.'),[jp('甘い・酸っぱい','あまい・すっぱい'),en('sweet; sour'),rule('Both are い-adjectives. 甘くて connects the first taste to the second; this feedback gives categories and meanings without a full source transcript.')]),
];
content.l02[0].answer.options.forEach((o,i)=>o.secondary=['すっぱい','あまい','にがい'][i]);
content.l02[6].answer.options.forEach((o,i)=>o.secondary=['あまくて、すっぱい','にがくて、しおからい','からくて、あぶらっこい'][i]);
// Accept both established oil/fat spellings as physical first tokens for the reconstructed compound.
content.l02[1].answer.tokens.push({id:'t4',text:'油'});content.l02[1].answer.slots[0].acceptedTokenIds.push('t4');
content.l03=[
 model('Connect taste with ease of drinking.','このお茶は苦くないので、飲みやすいです。','この おちゃは にがくないので、のみやすいです。','This tea is not bitter, so it is easy to drink.',easeRule),
 gap('Listen and complete the ease suffix.','このお茶は飲み〔やすい〕です。','この おちゃは のみやすいです。','This tea is easy to drink.',['やすく','にくかった'],easeRule),
 model('Study the explicit ease formation rule.','飲みます → 飲みやすい。食べます → 食べやすい。','のみます、のみやすい。たべます、たべやすい。','drink → easy to drink; eat → easy to eat',easeRule),
 gap('Choose the masu stem and ease suffix.','このパンは柔らかいので、〔食べ〕〔やすい〕です。','この ぱんは やわらかいので、たべやすいです。','This bread is soft, so it is easy to eat.',['食べる','食べて','やすく'],easeRule),
 model('Contrast the difficulty suffix.','この肉は硬いので、食べにくいです。','この にくは かたいので、たべにくいです。','This meat is tough, so it is hard to eat.',easeRule),
 limitedFeedback(truth('The meat is easy to eat.',false,'この肉は硬いので、食べにくいです。','この にくは かたいので、たべにくいです。','This meat is tough, so it is hard to eat.',easeRule),[jp('食べにくい ↔ 食べやすい','たべにくい、たべやすい'),en('hard to eat ↔ easy to eat'),rule('にくい indicates difficulty; the statement reverses its meaning. The visible source remains before the answer; feedback gives the contrast only.')]),
 gap('Complete the difficulty suffix from the bitter taste context.','この薬はとても苦いので、飲み〔にくい〕です。','この くすりは とても にがいので、のみにくいです。','This medicine is very bitter, so it is hard to take.',['やすい','にくく'],easeRule+' 飲む can describe taking medicine.'),
 gap('Use the sitting stem and difficulty suffix.','この椅子は低すぎるので、〔座り〕〔にくい〕です。','この いすは ひくすぎるので、すわりにくいです。','This chair is too low, so it is hard to sit on.',['座る','座って','やすかった'],easeRule+' 座る → 座ります → 座り.'),
 limitedFeedback(choice('Listen. How does the speaker describe this app?',['Easy to use','Hard to read','Hard to drink'],0,'このアプリはボタンが大きくて、使いやすいです。','この あぷりは ぼたんが おおきくて、つかいやすいです。','This app has large buttons and is easy to use.',easeRule),[jp('使い + やすい','つかい、やすい'),en('easy to use'),rule('使う → 使います → 使い. The suffix indicates ease of use; feedback retains the stem cue without a full transcript.')]),
 limitedFeedback(choice('Listen. Which way of reaching the museum is easier in this situation?',['By car','By train','On foot'],0,'博物館は駅から遠いので、電車では行きにくいです。駐車場があるので、車では行きやすいです。','はくぶつかんは えきから とおいので、でんしゃでは いきにくいです。ちゅうしゃじょうが あるので、くるまでは いきやすいです。','The museum is far from the station and has parking, so it is easier to reach by car.','The specific access facts favor a car here.'),[jp('電車では行きにくい ／ 車では行きやすい','でんしゃでは いきにくい。くるまでは いきやすい。'),en('hard to reach by train / easy to reach by car'),rule('The contrast favors the car in this particular situation. Distance from the station and parking are contextual clues; no universal transport rule is implied.')]),
 model('Learn guidance vocabulary.','係員が駅まで案内します。','かかりいんが えきまで あんないします。','A staff member will guide you to the station.','案内（あんない）is guidance or information. 案内する means guide/show someone around; 案内所 is an information office.'),
 gap('Complete the noun before the supplied します.','係員が駅まで〔案内〕します。','かかりいんが えきまで あんないします。','A staff member will guide you to the station.',['案内し','案内する'],'案内 is a noun. Add する to make a verb: 案内します. Do not insert another し before the supplied します.'),
 gap('Build the past ease adjective.','昨日の道案内は〔分かり〕〔やすかった〕です。','きのうの みちあんないは わかりやすかったです。','Yesterday’s directions were easy to understand.',['分かる','やすい','やすくて'],easeRule+' やすい → やすかった in the past. 分かります supplies the stem 分かり.'),
 table('Study information and guidance compounds.','案内 and 情報',['Word','Reading','Meaning'],[['案内','あんない','guidance; information'],['案内所','あんないじょ','information office'],['観光案内','かんこうあんない','tourist information/guidance'],['道案内','みちあんない','directions; route guidance'],['情報','じょうほう','information']], '案内、案内所、観光案内、道案内、情報。','あんない、あんないじょ、かんこうあんない、みちあんない、じょうほう。','Learn compound-specific readings. 所 is じょ in 案内所. 観光案内 gives sightseeing information; 道案内 gives directions. 情報 refers to information more broadly.'),
 gap('Place the complete ease adjective before the noun.','これは〔分かりやすい〕観光案内です。','これは わかりやすい かんこうあんないです。','This is easy-to-understand tourist information.',['やすい','分かりやすく'],'分かりやすい is an い-adjective compound and directly modifies 観光案内. The full compound specifies what is easy.'),
 gap('Use the adverbial く form before a verb.','係員は道を〔分かりやすく〕説明します。','かかりいんは みちを わかりやすく せつめいします。','The staff member explains the route clearly.',['分かりやすい','分かりやすかった'],'分かりやすい → 分かりやすく before 説明します. It describes how the explanation is given.'),
 typed('Type the adverbial form of 分かりやすい, in kanji, kana or the reviewed romaji form.','この案内板には、情報が','書いてあります。',['分かりやすく','わかりやすく','wakariyasuku'],'この案内板には、情報が分かりやすく書いてあります。','この あんないばんには、じょうほうが わかりやすく かいてあります。','The information has been written clearly on this information board.','Replace final い with く to modify 書いてあります. てある describes the resulting state of deliberate writing. Each accepted script form is an explicit occurrence-level choice.'),
 order('Listen and build the past difficulty, reason and repetition request.',['説明が','分かりにくかった','ので、','もう一度','言って','ください。'],'せつめいが わかりにくかったので、もういちど いってください。','The explanation was hard to understand, so please say it again.','にくい → にくかった in the past. ので gives the reason; もう一度言ってください politely requests repetition.'),
];
content.l01[16].prompt='Complete the sour-and-very-salty description of this umeboshi.';
// Parallel response readings are lexical support, separate from the hidden full source.
for(const [index,texts,readings]of [
 [8,['使いやすい','読みにくい','飲みにくい'],['つかいやすい','よみにくい','のみにくい']],
 [9,['車で','電車で','歩いて'],['くるまで','でんしゃで','あるいて']],
])content.l03[index].answer.options.forEach((o,i)=>{o.text=texts[i];o.secondary=readings[i];});
content.l01[18].sceneReuse='B2.C06.L01.A02.S07';
for(const index of [6,10])content.l01[index].support.before.push(jp(content.l01[index].audio.text,content.l01[index].audio.reading));
const expected={l01:19,l02:7,l03:18};
const appCount=s=>s.answer?.kind==='ordered_slots'?s.answer.slots.length:s.answer?.kind==='ordered_tokens'?s.answer.tokens.length:s.answer?.kind==='pairs'?s.answer.pairs.length:s.answer?1:0;
fs.mkdirSync(output,{recursive:true});
for(const [key,authored]of Object.entries(content)) {
 const recordId=`B2.C06.${key.toUpperCase()}`,record=records.find(r=>r.recordId===recordId),summary=key==='l01';
 if(!record||authored.length!==expected[key])throw new Error(`Invalid authored count: ${key}`);
 const screens=authored.map((copy,i)=>{
  const source=record.screens[i],teaching=['model','kanji','table','dialogue'].includes(copy.renderer);
  const hidden=summary?i===18:source.rawSupport.japanese_transcript_before_answer===false;
  const before=[...copy.support.before];
  if(!summary&&source.rawSupport.japanese_transcript_before_answer===true&&copy.renderer!=='dialogue'&&!before.some(b=>b.kind==='japanese'))before.push(jp(copy.audio.text,copy.audio.reading));
  if(!summary&&source.rawSupport.translation_visible===true&&!before.some(b=>b.kind==='translation')) {
   const translation=copy.support.after.find(b=>b.kind==='translation');
   if(translation)before.push(translation);
   else if(copy.renderer==='table')before.push(en(copy.table.rows.map(r=>r.cells.at(-1)).join(' ')));
  }
  const {sceneReuse,...authoredCopy}=copy;
  const sourceContract=summary?{
   purpose:copy.prompt,sourceScreenId:null,sourceRenderer:null,sourceRendererId:null,sourceActivityId:null,sourceExerciseNumber:null,responseSlotCount:null,responseSlotCountState:'unknown',
   transcriptBeforeAnswer:hidden?false:teaching?true:null,translationBeforeAnswer:null,parallelReadingBeforeAnswer:copy.renderer==='model',hintBeforeAnswer:false,recordedSupport:{},
   feedbackCategories:[],targetConceptIds:record.curriculum.newConceptIds,priorConceptIds:record.curriculum.priorConceptIds,
   ...(sceneReuse?{sceneReuse}:{}),
  }:{purpose:source.purpose,sourceScreenId:source.sourceScreenId,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,
   responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,transcriptBeforeAnswer:source.rawSupport.japanese_transcript_before_answer,
   translationBeforeAnswer:source.rawSupport.translation_visible,parallelReadingBeforeAnswer:source.rawSupport.parallel_kana_available===true&&source.rawSupport.japanese_transcript_before_answer===true,hintBeforeAnswer:false,recordedSupport:source.rawSupport,...occurrences[source.screenId]};
  const screenId=summary?`${recordId}.A${i<11?'01':'02'}.S${String(i<11?i+1:i-10).padStart(2,'0')}`:source.screenId;
  return {screenId,prompt:null,answer:null,praise:null,...authoredCopy,support:{before:hidden?[]:before,after:copy.support.after},
   audio:{required:teaching||hidden||(!summary&&source.rawMedia.length>0),text:null,...copy.audio},
   visual:summary?(i<6?'video':'none'):['media_model'].includes(source.rawRenderer)?'video':'none',
   sourceContract,evidence:summary?record.evidence:source.evidence,unresolved:[]};
 });
 const pack={schemaVersion:key==='l02'?'1.1':'1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:screens.length,
  provenance:{origin:'app_authored',note:summary?'Reviewed app-authored 19-task taste lesson based on retained S11 phases, total and known 11+8 partition, inspected in S12 blueprint and assigned Unified/Master/S37 chapter-six summary. Six vocabulary models precede adjective linking, negative, appearance, past and potential reuse, a contextual cultural explanation, cumulative gap and integrated two-speaker listening. Individual tasks, physical app response counts, scripts, support timing and exact scene/replay are app choices; no task-level source rows or unavailable source identities are claimed recovered. The two canonical activity IDs, ordinals and known counts remain exact; raw activity task arrays remain empty. Source retry target/timing are unknown, so no retry policy is inferred.': 'Owner-authorized reviewed chapter-six production authoring, 5 October 2026. Canonical/source screen and activity identities, source exercise numbers, known physical responses, support timing and curriculum dependencies retain the assigned Unified/S34/S37 records. Japanese, readings, translations, explicit typed script variants, banks and answer mappings are authored/adapted from documented learning targets. L02 hidden choices and L03 supported truth/hidden choices retain limited feedback without a full source transcript where recorded. L02 optional S08 retains its tail source identity and taste-category hint, as private ungraded unsaved writing without course events. L03 A01.S10 alone repeats once at the first activity boundary; research outcomes never seed progress.'},
  policies:{assessment:'One equal-weight outcome per graded required screen. Teaching is ungraded. Core completion, first-attempt accuracy and retry mastery remain distinct. Optional private writing never blocks completion.',incorrectResponses:'Existing feedback, typed Check and final token placement lock graded responses. Only L03 A01.S10 repeats once after its first ten tasks; completion remains possible after a wrong retry.',audio:'Current Japanese TTS and full ordered guest/staff dialogue. Transcript-free scripts stay out of pre-answer support; response banks remain visible. Limited-feedback occurrences omit full corrected-sentence replay.',visuals:'Original media deferred; shared replaceable visual slots are used.'},
  unresolvedSourceFacts:['Source-identical literal wording, exhaustive accepted variants, randomization, original assets and acoustic quality remain unknown; reviewed app authoring supplies playable content.','Source scoring, thresholds, unlock requirements and general remediation rules remain unproven. Research scores never seed owner progress.',...(summary?['Individual source task ordering, identities, physical counts, support and retry target/timing remain unknown. The structuralContract is app-owned and preserves only the observed canonical 11+8 partition.']:[])],screens};
 if(summary)pack.structuralContract={version:'1.0',kind:'summary_authored',origin:'app_authored',review:{status:'reviewed',note:'Reviewed 19 authored tasks, Japanese/readings/translations, taste contrasts, adjective/potential forms, cultural context, answer ambiguity, physical app response counts and full two-speaker scene. Preserves the two known canonical activity IDs/ordinals and 11+8 counts, with no fabricated source rows.'},activities:record.activities.map((a,i)=>({...a,screenIds:screens.slice(i===0?0:11,i===0?11:19).map(s=>s.screenId)})),tasks:screens.map(s=>({screenId:s.screenId,responseCount:appCount(s)}))};
 if(key==='l03')pack.retryPolicy={kind:'after_activity_once',screenIds:['B2.C06.L03.A01.S10']};
 if(key==='l02'){
  const s=record.screens[7];
  pack.completion={contractVersion:'1.0',requiredScreenIds:screens.map(s=>s.screenId),optionalSurfaces:[{screenId:s.screenId,sourceExerciseNumber:s.sourceExerciseNumber,sourceActivityId:s.sourceActivityId,purpose:s.purpose,
   prompt:'Write privately about a food you like and describe its taste. Add a reason if you want.',hint:'Taste categories: 甘い（sweet）、塩辛い（salty）、辛い（spicy/sharp）、酸っぱい（sour）、脂っこい（oily）、苦い（bitter）. Link い-adjectives with くて; use ので for a reason. Write only what you choose to keep in this open view.',modes:['write'],provenance:{origin:'app_authored',note:'Retained S08/source exercise 8 and activity identity, separate optional private writing with an authored taste-category hint based on retained hint purpose. Ungraded, unsaved, no course attempt events or community submission; no speaking or recording action.'}}]};
 }
 fs.writeFileSync(path.join(output,`b2-c06-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');
}
console.log('Assembled L01: 19 app-authored tasks (known 11+8), L02: 7 core + separate optional writing, L03: 18 (10+8).');
