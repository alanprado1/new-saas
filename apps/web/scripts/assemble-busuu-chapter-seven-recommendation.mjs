// Offline, reviewed production authoring. Source evidence and all released packs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu'), output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-seven-recommendation-occurrences.json'), 'utf8')).screens;
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

const recommendationRule = 'おすすめ is a noun: おすすめです means “I recommend it / it is recommended”. Use おすすめの + noun, and person に + item をおすすめします to recommend something to someone. お is the polite prefix; おすすめする is the corresponding verb expression.';
const confidenceRule = 'きっと expresses the speaker’s confident expectation: “surely / I am sure”. It conveys confidence rather than a guarantee. Before と思います use a plain clause: 好きだと思います, not 好きですと思います.';
const encouragementRule = 'ぜひ encourages someone to do something: “do / by all means”. It differs from confident きっと. Verb て-form + みてください invites the listener to try doing something; みる adds the meaning of trying.';
const favoriteRule = 'お気に入り（おきにいり）is a noun for a particular favorite or something one is especially fond of. Use お気に入りの + noun. 好き expresses liking more generally. A person can have several favorites; this contextual contrast does not require a single exclusive favorite.';
const flowRule = '流れる（ながれる）is intransitive: 水が流れます, water flows. 流す（ながす）is transitive: 水を流します, someone lets water flow or flushes. Its て-form is 流して（ながして）. 流行（りゅうこう）uses the on reading and means a trend; 流行しています describes something currently popular.';
const content = {};
content.l03 = [
 model('Notice the noun used to recommend something.','この料理はおすすめです。','この りょうりは おすすめです。','I recommend this dish.',recommendationRule),
 gap('Complete the recommendation noun.','この料理は〔おすすめ〕です。','この りょうりは おすすめです。','I recommend this dish.',['きっと','ぜひ'],recommendationRule),
 gap('Insert four kana to ask for a recommendation.','〔お〕〔す〕〔す〕〔め〕は何ですか。','おすすめは なんですか。','What do you recommend?',['ご','め'],'おすすめ is written お・す・す・め. お is the polite prefix. Each of the two す tiles is a separate physical character.'),
 model('Read the menu heading for today’s recommendations.','本日のおすすめは、焼き魚です。','ほんじつの おすすめは、やきざかなです。','Today’s recommendation is grilled fish.','本日（ほんじつ）is a formal word for today. 本日のおすすめ is used for today’s recommended dishes or specials on a menu; the exact offer depends on the restaurant.'),
 truth('The announcement recommends grilled fish today.',true,'本日のおすすめは、焼き魚です。','ほんじつの おすすめは、やきざかなです。','Today’s recommendation is grilled fish.','本日のおすすめ introduces today’s recommendation; the dish named is grilled fish.',true),
 model('Use きっと to express a confident opinion.','きっとこの料理が好きだと思います。','きっと この りょうりが すきだと おもいます。','I am sure you will like this dish.',confidenceRule),
 gap('Choose the adverb expressing a confident expectation.','〔きっと〕この料理が好きだと思います。','きっと この りょうりが すきだと おもいます。','I am sure you will like this dish.',['ぜひ','おすすめ'],confidenceRule),
 gap('Insert three kana to spell the confident adverb.','〔き〕〔っ〕〔と〕この映画が好きだと思います。','きっと この えいがが すきだと おもいます。','I am sure you will like this film.',['つ','に'],confidenceRule+' きっと contains the small っ, not a full-size つ.'),
 order('Listen and build the recommendation using noun + の.',['これは','おすすめ','の','料理','です。'],'これは おすすめの りょうりです。','This is a recommended dish.',recommendationRule+' の connects the noun おすすめ to 料理.'),
 gap('Complete the reason and the confident expectation.','この料理はおいしい〔から〕、〔きっと〕気に入ると思います。','この りょうりは おいしいから、きっと きにいると おもいます。','This dish is delicious, so I am sure you will like it.',['まで','ぜひ'],'から gives the reason. '+confidenceRule+' 気に入る（きにいる）means to like or take a liking to something.'),
 model('Encourage someone to try tasting something.','ぜひ食べてみてください。','ぜひ たべてみてください。','Do try it.',encouragementRule),
 gap('Choose the word encouraging someone to try a taste.','〔ぜひ〕食べてみてください。','ぜひ たべてみてください。','Do try it.',['きっと','お気に入り'],encouragementRule),
 gap('Insert the two particles that emphasize attending this event.','このイベント〔に〕〔は〕、ぜひ来てください。','この いべんとには、ぜひ きてください。','Do come to this event in particular.',['を','で'],'に marks the destination of 来る; は adds contrastive focus to that destination. には keeps both functions. '+encouragementRule),
 typed('Listen and type the encouragement word. Kana, kanji or romaji is accepted.','景色がきれいですから、','行ってみてください。',['ぜひ','是非','zehi'],'景色がきれいですから、ぜひ行ってみてください。','けしきが きれいですから、ぜひ いってみてください。','The scenery is beautiful, so do try visiting.',encouragementRule+' This occurrence explicitly accepts ぜひ, 是非 and zehi. 景色 is read けしき; から gives the reason.'),
 model('Use お気に入り as a noun and before another noun.','これは私のお気に入りのカフェです。','これは わたしの おきにいりの かふぇです。','This is one of my favorite cafés.',favoriteRule),
 gap('Connect お気に入り to the following noun.','これは私のお気に入り〔の〕カフェです。','これは わたしの おきにいりの かふぇです。','This is one of my favorite cafés.',['に','を'],favoriteRule),
 table('Compare a particular favorite with liking in general.','Favorite and liking',['Expression','Reading','English'],[['お気に入りのカフェ','おきにいりの かふぇ','a favorite café'],['このカフェが好きです。','この かふぇが すきです。','I like this café.'],['好きな飲み物','すきな のみもの','a drink that one likes']], 'これは私のお気に入りのカフェです。私はこのカフェが好きです。','これは わたしの おきにいりの かふぇです。わたしは この かふぇが すきです。',favoriteRule+' 好き is a な-adjective, so use 好きな before a noun.'),
 truth('The speaker identifies this café as a particular favorite.',true,'このカフェは私のお気に入りです。','この かふぇは わたしの おきにいりです。','This café is one of my favorites.',favoriteRule),
 gap('Complete the favorite expression and the person receiving the recommendation.','このカフェは私の〔お気に入り〕です。友達〔に〕おすすめします。','この かふぇは わたしの おきにいりです。ともだちに おすすめします。','This café is one of my favorites. I recommend it to my friends.',['きっと','で'],favoriteRule+' '+recommendationRule),
 order('Listen and build the confident opinion followed by an invitation to watch.',['きっと','この映画が','好きだと','思います。','ぜひ','観てみてください。'],'きっと この えいがが すきだと おもいます。ぜひ みてみてください。','I am sure you will like this film. Do try watching it.',confidenceRule+' '+encouragementRule+' 観て is read みて in this film-viewing context.'),
];
// Equivalent discourse placement of きっと keeps the six supplied chunks and both sentences.
content.l03[19].answer.acceptedOrders.push(['t1','t0','t2','t3','t4','t5']);
// The two physically distinct す tiles can occupy either matching character slot.
// Documented limited feedback never reveals/replays a complete source transcript.
for (const i of [4,17]) { content.l03[i].support.after=[rule(content.l03[i].support.after.at(-1).text)]; delete content.l03[i].audio.feedbackText; }

content.l04 = [
 kmodel('雪','Recognize the 雨-shaped upper part and the ヨ-like lower part. This static complete glyph and visual aid replaces animation; it is not an etymology or stroke-order claim.','snow',[['ゆき','Kun reading in 雪, 雪国 and 雪だるま.'],['せつ','On reading in compounds such as 積雪（せきせつ）, snow accumulation.']],[['雪','ゆき','snow','今日は雪が降っています。','きょうは ゆきが ふっています。','It is snowing today.'],['雪国','ゆきぐに','snowy region','雪国へ旅行に行きます。','ゆきぐにへ りょこうに いきます。','I am taking a trip to a snowy region.'],['雪だるま','ゆきだるま','snowman','子供たちが雪だるまを作っています。','こどもたちが ゆきだるまを つくっています。','The children are making a snowman.']]),
 choice('Which kanji means snow and has a ヨ-like lower part?',['雨','雪','晴'],1,'雪','ゆき','snow','雪（ゆき）has an 雨-shaped upper part and a ヨ-like lower part. 雨 is rain; 晴 is used for clear weather. This is a shape aid, not etymology.'),
 kmodel('景','Recognize 日 above 京. This complete static glyph and shape note replaces animation without a stroke-order claim.','view; scenery',[['けい','On reading in 景気（けいき）.'],['け','Contextual reading in 景色（けしき）; learn the complete word.']],[['景色','けしき','scenery','窓から景色が見えます。','まどから けしきが みえます。','The scenery is visible from the window.'],['景気','けいき','economic conditions','景気がよくなりました。','けいきが よくなりました。','Economic conditions have improved.']]),
 choice('Which character has 日 above 京 and appears in 景色?',['京','景','影'],1,'景色','けしき','scenery','景 has 日 above 京. 景色 is けしき; 景気 is けいき. Whole-word readings determine the sound used here.'),
 kmodel('流','Recognize the water radical 氵 on the left of 流. Static shape aid replacing animation; it makes no historical derivation or stroke-order claim.','flow; let flow',[['ながれる','Kun reading with れる: intransitive flow.'],['ながす','Kun reading with す: transitive let flow/flush.'],['りゅう','On reading in 流行（りゅうこう）.']],[['流れる','ながれる','flow','川の水が流れています。','かわの みずが ながれています。','The river water is flowing.'],['流す','ながす','let flow; flush','トイレの水を流します。','といれの みずを ながします。','I flush the toilet.'],['流行','りゅうこう','trend; popularity','この歌が流行しています。','この うたが りゅうこうしています。','This song is currently popular.']]),
 gap('Insert the kanji with the water radical to complete trend.','この歌が〔流〕行しています。','この うたが りゅうこうしています。','This song is currently popular.',['留','旅'],flowRule),
 kmodel('公','Recognize the 八-like upper strokes and the ム-like lower shape. Static visual aid replacing animation, not etymology or observed stroke order.','public; official',[['こう','On reading in 公園, 公式 and 公立.']],[['公園','こうえん','park','公園で散歩します。','こうえんで さんぽします。','I take a walk in the park.'],['公式','こうしき','official','公式サイトを見てください。','こうしき さいとを みてください。','Please look at the official website.'],['公立','こうりつ','publicly established','これは公立の学校です。','これは こうりつの がっこうです。','This is a public school.']]),
 choice('Which kanji means public or official and is used in 公式?',['私','公','八'],1,'公式','こうしき','official','公（こう）appears in 公式（こうしき）, 公立（こうりつ）and 公園（こうえん）. Its whole shape differs from 私 or 八.'),
 kmodel('園','Recognize the enclosing 囗 around 袁. A fence-like outline is a visual memory aid, not etymology. This complete static glyph replaces animation without an invented stroke order.','garden; enclosed grounds',[['えん','On reading in 公園, 動物園 and 遊園地.'],['その','Kun reading used for a garden; contextual compounds here use えん.']],[['公園','こうえん','park','新しい公園ができました。','あたらしい こうえんが できました。','A new park has been completed.'],['動物園','どうぶつえん','zoo','動物園にはライオンがいます。','どうぶつえんには らいおんが います。','There are lions at the zoo.'],['遊園地','ゆうえんち','amusement park','日曜日に遊園地へ行きます。','にちようびに ゆうえんちへ いきます。','I am going to an amusement park on Sunday.']]),
 gap('Insert the enclosed character to complete park.','この公〔園〕は広いです。','この こうえんは ひろいです。','This park is spacious.',['遠','円'],'公園 is こうえん. 園 has an enclosing 囗 around 袁; 遠 has 辶 and is used for distance, while 円 is a different character.'),
 pairs('Match each compound to its whole-word reading.',[['雪国','ゆきぐに'],['景色','けしき'],['流行','りゅうこう']],'雪国 means a snowy region, 景色 means scenery, and 流行 means a trend or popularity. Learn the whole-word readings ゆきぐに, けしき and りゅうこう.'),
 gap('Complete the travel sentence with snow.','雪国へ行ったら、〔雪〕だるまを作ってみたいです。','ゆきぐにへ いったら、ゆきだるまを つくってみたいです。','When I go to a snowy region, I would like to try making a snowman.',['雨','晴'],'雪（ゆき）appears in 雪国（ゆきぐに）and 雪だるま（ゆきだるま）. 行ったら means when/if I go; 作ってみたい expresses wanting to try making something.'),
 gap('Insert two kanji to complete scenery.','この旅館からの〔景〕〔色〕はきれいです。','この りょかんからの けしきは きれいです。','The scenery from this inn is beautiful.',['京','気'],'景色 is read けしき. 景 uses け here, while 景気 is けいき. 旅館（りょかん）means a Japanese inn.'),
 table('Learn the whole readings of scenery compounds.','Scenery compounds',['Japanese','Reading','English'],[['景色','けしき','scenery'],['冬景色','ふゆげしき','winter scenery'],['雪景色','ゆきげしき','snow-covered scenery'],['雨景色','あまげしき','scenery in the rain']], '景色、冬景色、雪景色、雨景色。','けしき、ふゆげしき、ゆきげしき、あまげしき。','景色 is けしき. In these compounds it becomes げしき: 冬景色 ふゆげしき and 雪景色 ゆきげしき. 雨景色 あまげしき is a less common descriptive expression for a view in the rain; 雨 is read あま in this compound.'),
 gap('Choose the compound for the recommended snow-covered view.','冬には、この旅館からの〔雪景色〕がおすすめです。','ふゆには、この りょかんからの ゆきげしきが おすすめです。','In winter, I recommend the snow-covered view from this inn.',['景気','雪国'],'雪景色（ゆきげしき）combines snow and scenery. 雪国 is a snowy region; 景気 concerns economic conditions. 冬には gives seasonal focus; おすすめ is the recommendation noun.'),
 gap('Insert two kanji to complete the current trend.','今、このゲームが〔流〕〔行〕しています。','いま、この げーむが りゅうこうしています。','This game is currently popular.', ['留','公'],flowRule+' 行 is こう in 流行, rather than い as in 行きます.'),
 choice('Listen. What has been completed near the station?',['公園','動物園','遊園地'],0,'駅の近くに新しい公園ができました。','えきの ちかくに あたらしい こうえんが できました。','A new park has been completed near the station.','The place named is a park: 公園（こうえん）.'),
 gap('Insert three kanji to complete zoo.','週末に〔動〕〔物〕〔園〕へ行きます。','しゅうまつに どうぶつえんへ いきます。','I am going to the zoo at the weekend.',['遊','公'],'動物（どうぶつ）means animals; 動物園（どうぶつえん）means zoo. 園 uses えん in this compound.'),
 gap('Complete the polite instruction with the transitive て-form.','トイレを使ったら、水を〔流して〕ください。','といれを つかったら、みずを ながしてください。','After using the toilet, please flush it.',['流れて','流す'],flowRule+' 使ったら sets the condition after using the toilet; 流してください is a polite request to perform the action.'),
 order('Listen and build the request to check the official website.',['詳しくは、','公式','サイトを','ご覧ください。'],'くわしくは、こうしき さいとを ごらんください。','For details, please see the official website.','公式（こうしき）directly modifies サイト in this expression. ご覧ください is a respectful request to look; 詳しくは introduces where to find details.'),
];
content.l04[10].support.before=[jp('雪国 ／ 景色 ／ 流行')];
content.l04[16].answer.options.forEach((o,i)=>o.secondary=['こうえん','どうぶつえん','ゆうえんち'][i]);
content.l04[16].support.after=[rule('The place named is a park: 公園（こうえん）.')];
delete content.l04[16].audio.feedbackText;

const expected={l03:20,l04:20}, responseTotals={l03:31,l04:23};
fs.mkdirSync(output,{recursive:true});
for(const [key,authored] of Object.entries(content)) {
 const recordId=`B2.C07.${key.toUpperCase()}`,record=records.find(r=>r.recordId===recordId);
 if(!record||authored.length!==expected[key])throw new Error(`Invalid authored count: ${key}`);
 let physicalTotal=0;
 const screens=authored.map((copy,i)=>{
  const source=record.screens[i],teaching=['model','kanji','table'].includes(copy.renderer),hidden=source.rawSupport.japanese_transcript_before_answer===false;
  const noSourceReplay=!teaching&&source.rawMedia.length===0&&source.rawMediaStructure?.source_replay_available===false;
  const before=[...copy.support.before];
  if(source.rawSupport.japanese_transcript_before_answer===true&&!before.some(b=>b.kind==='japanese'))before.push(jp(copy.audio?.text,copy.audio?.reading));
  if(source.rawSupport.translation_visible===true&&!before.some(b=>b.kind==='translation')) {
   const translation=copy.support.after.find(b=>b.kind==='translation');
   if(translation)before.push(translation);
   else if(copy.renderer==='table')before.push(en(copy.table.rows.map(r=>r.cells.at(-1)).join(' ')));
   else if(copy.renderer==='kanji')before.push(en(`${copy.kanji.meaning}. ${copy.kanji.examples.map(e=>e.translation).join(' ')}`));
  }
  const omitted=(key==='l03'&&[4,17].includes(i))||(key==='l04'&&i===16);
  const sourceContract={purpose:source.purpose,sourceScreenId:source.sourceScreenId,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,
   responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,transcriptBeforeAnswer:source.rawSupport.japanese_transcript_before_answer,translationBeforeAnswer:source.rawSupport.translation_visible,
   parallelReadingBeforeAnswer:source.rawSupport.parallel_kana_available===true&&teaching,hintBeforeAnswer:false,recordedSupport:source.rawSupport,...occurrences[source.screenId],...(omitted?{feedbackTranscript:'omitted'}:{})};
  const actual=copy.answer?.kind==='ordered_slots'?copy.answer.slots.length:copy.answer?.kind==='ordered_tokens'?copy.answer.tokens.length:copy.answer?.kind==='pairs'?copy.answer.pairs.length:copy.answer?1:0;
  if(actual!==source.rawResponseSlotCount)throw new Error(`Physical response mismatch ${source.screenId}: ${actual}`);
  physicalTotal+=actual;
  const permittedBefore=before.map(b=>source.rawSupport.parallel_kana_available===false&&b.kind==='japanese'?{kind:'japanese',text:b.text}:b);
  return {screenId:source.screenId,prompt:null,answer:null,praise:null,...copy,support:{before:hidden&&!teaching?[]:permittedBefore,after:copy.support.after},audio:{required:!noSourceReplay&&(teaching||hidden||source.rawMedia.length>0),text:null,...copy.audio,...(noSourceReplay?{beforeAnswer:false}:{})},visual:source.rawRenderer==='stroke_animation'?'image':source.rawMedia.includes('video')?'video':'none',sourceContract,evidence:source.evidence,unresolved:[]};
 });
 if(physicalTotal!==responseTotals[key])throw new Error(`Total physical response mismatch ${key}: ${physicalTotal}`);
 const pack={schemaVersion:'1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:screens.length,
  provenance:{origin:'app_authored',note:'Owner-authorized reviewed chapter 7 recommendation/kanji production authoring, 5 October 2026. Canonical/source screen/activity/exercise identities, renderer variants, physical counts, 10+10 partition, observed support/feedback timing and analytical targets/dependencies remain preserved. Japanese, readings, translations, response banks, explicit typed equivalents and contextual explanations are reviewed app authoring/adaptation, not observed source quotations. Static complete kanji shape/readings/examples replace deferred animations without an etymology or stroke-order claim. Confidence is not a guarantee; favorites need not be exclusive. L03 A01.S05 remains the observed true/false variant. Documented cue-only feedback omits complete transcripts/replay. No retry, speaking or production endpoint.'},
  policies:{assessment:'One equal-weight outcome per graded base screen. Required completion remains separate from raw accuracy.',incorrectResponses:'Existing feedback, checked typed input, final token placement and matching correction rules. No retry is documented or configured.',audio:'Existing Japanese TTS with occurrence-specific readings. Transcript-free sources/translations are withheld before answers. Limited feedback omits complete source/replay; legitimate response banks remain visible.',visuals:'Shared replaceable media slots; complete static kanji teaching replaces unavailable animations.'},
  unresolvedSourceFacts:['Exact source wording, exhaustive accepted alternatives, original media and acoustic alignment remain unavailable; reviewed app authoring supplies complete content.','Source scores and unlock enforcement are not imported or used to seed owner progress.','Static kanji shape notes are visual aids, not claims about observed animation, stroke order or historical derivation.'],screens};
 fs.writeFileSync(path.join(output,`b2-c07-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');
}
console.log('Assembled chapter 7 recommendations (20; 31 responses) and kanji (20; 23 responses), preserving both 10+10 partitions.');

