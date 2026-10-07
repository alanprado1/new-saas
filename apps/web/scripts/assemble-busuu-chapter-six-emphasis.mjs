// Offline, reviewed production authoring. Source evidence and all released packs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu'), output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-six-emphasis-occurrences.json'), 'utf8')).screens;
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

const moRule = 'Quantity, duration or frequency + も emphasizes an amount that the speaker considers surprisingly large: as many/much as. The expectation comes from context. An object may retain を before a floating quantity; a destination retains に or へ. This use differs from the additive meaning “also”.';
const counterRule = '枚（まい）counts flat objects such as empty plates; 皿 counts platefuls/servings of food. Learn 一皿（ひとさら）, 二皿（ふたさら）, 三皿（さんさら）. 杯 counts cupfuls/glassfuls/bowlfuls; 本 counts long cylindrical objects including bottles.';
const cupRule = 'Learn the whole counter word: 一杯 いっぱい, 二杯 にはい, 三杯 さんばい, 四杯 よんはい, 五杯 ごはい, 六杯 ろっぱい, 七杯 ななはい, 八杯 はっぱい／はちはい, 九杯 きゅうはい, 十杯 じゅっぱい／じっぱい. Bottles use 本: 一本 いっぽん, 二本 にほん, 三本 さんぼん, 六本 ろっぽん, 八本 はっぽん／はちほん, 十本 じゅっぽん／じっぽん.';
const seeingRule = '見る is the broad everyday spelling for seeing/looking/watching. 観る highlights intentional viewing or appreciation, especially a film, play or sport. 見る also remains valid for those activities; this contrast is a usage tendency, not a rule that ordinary 見る is wrong. 観 is かん in 観客 and 観光.';
const content = {};
content.l04 = [
 gap('Complete the counter for three empty plates.','空のお皿が三〔枚〕あります。','からの おさらが さんまい あります。','There are three empty plates.',['皿','杯'],counterRule),
 table('Compare empty plates with servings of food.','Plates and servings',['Use','Japanese','Reading','English'],[['Empty plate','一枚','いちまい','one flat object'],['Food serving','一皿','ひとさら','one plateful'],['Food servings','二皿','ふたさら','two platefuls'],['Food servings','三皿','さんさら','three platefuls']], '空のお皿は一枚。料理は一皿、二皿、三皿。','からの おさらは いちまい。りょうりは ひとさら、ふたさら、さんさら。',counterRule),
 choice('Listen. Which expression states the price of one serving?',['一皿二百円です。','一枚二百円です。','一台二百円です。'],0,'この寿司は一皿二百円です。','この すしは ひとさら にひゃくえんです。','This sushi costs two hundred yen per plateful.',counterRule),
 {renderer:'table',prompt:'Read about pricing at this example conveyor-belt sushi restaurant.',table:{caption:'Restaurant practice in this example',columns:['Practice','Explanation'],rows:[{id:'row0',cells:['Price by plate','At this restaurant, each plateful has a displayed price.']},{id:'row1',cells:['Check the menu','Plate colors and prices vary between restaurants. Check this venue’s menu.']}]},support:{before:[en('In this example, the bill depends on the platefuls eaten. Some venues use plate colors or ordering screens; restaurant practices vary.')],after:[]},audio:{text:'この回転寿司の店では、食べたお皿の数で料金が決まります。値段はメニューで確認してください。',reading:'この かいてんずしの みせでは、たべた おさらの かずで りょうきんが きまります。ねだんは めにゅーで かくにんしてください。'}},
 truth('The staff member says there are four empty plates.',false,'空のお皿は三枚でございます。','からの おさらは さんまいでございます。','There are three empty plates.','The quantity is three, rather than four. 枚 counts empty flat plates; でございます is the very polite copula.',true),
 model('Notice how も emphasizes a surprisingly large quantity.','寿司を十皿も食べました。','すしを じゅっさらも たべました。','I ate as many as ten plates of sushi.',moRule+' Here the speaker regards ten platefuls as a lot.'),
 gap('Complete the particle emphasizing an unexpectedly large amount.','寿司を十皿〔も〕食べました。','すしを じゅっさらも たべました。','I ate as many as ten plates of sushi.',['に','で'],moRule),
 model('Use the same emphasis with duration.','温泉に三時間もいました。','おんせんに さんじかんも いました。','I stayed at the hot spring for as long as three hours.',moRule+' 三時間 counts duration; 温泉に marks the place where the speaker stayed.'),
 truth('Here も emphasizes that the time spent was longer than expected.',true,'温泉に三時間もいました。','おんせんに さんじかんも いました。','I stayed at the hot spring for as long as three hours.',moRule),
 gap('Complete the destination particle and surprising frequency.','去年、京都〔に〕三回〔も〕行きました。','きょねん、きょうとに さんかいも いきました。','Last year I went to Kyoto as many as three times.',['で','を'],moRule+' Both に and へ are grammatical destination particles in this occurrence.'),
 table('Study cupfuls and bottle-count sound changes.','杯 and 本',['Counter word','Reading','English'],[['一杯','いっぱい','one cupful'],['二杯','にはい','two cupfuls'],['三杯','さんばい','three cupfuls'],['六杯','ろっぱい','six cupfuls'],['八杯','はっぱい／はちはい','eight cupfuls'],['十杯','じゅっぱい／じっぱい','ten cupfuls'],['一本','いっぽん','one bottle'],['三本','さんぼん','three bottles']], '一杯、二杯、三杯、六杯、八杯、十杯。一本、三本。','いっぱい、にはい、さんばい、ろっぱい、はっぱい、じゅっぱい。いっぽん、さんぼん。',cupRule),
 choice('Listen. Which counter completes a request for one bowlful of rice?',['ご飯を一枚ください。','ご飯を一杯ください。','ご飯を一本ください。'],1,'ご飯を一杯ください。','ごはんを いっぱい ください。','One bowlful of rice, please.',counterRule+' ご飯 is served in a bowl here; 杯 counts its contents.'),
 gap('Complete the object particle and emphasis.','お茶〔を〕六杯〔も〕飲みました。','おちゃを ろっぱいも のみました。','I drank as many as six cups of tea.',['に','で'],moRule+' を marks お茶; 六杯も is the emphatic floating quantity.'),
 choice('Listen. What container is being counted?',['Cups or glasses','Bottles','Empty flat plates'],1,'ビールを三本注文しました。','びーるを さんぼん ちゅうもんしました。','I ordered three bottles of beer.','本 is used for bottles, whereas 杯 counts cupfuls or glassfuls. 三本 is read さんぼん.'),
 order('Listen and build the sentence about a surprisingly large drink quantity.',['昨日、','お茶を','六杯','も','飲みました。'],'きのう、おちゃを ろっぱいも のみました。','Yesterday I drank as many as six cups of tea.',moRule),
 gap('Complete the frequency counter for changing trains.','駅で二〔回〕も乗り換えました。','えきで にかいも のりかえました。','I changed trains as many as twice at stations.',['本','杯'],'回 counts occurrences or times; 二回も emphasizes more changes than expected. 本 counts long objects and 杯 counts containerfuls.'),
 typed('Listen and type the particle emphasizing the long duration.','旅館に五日','泊まりました。',['も','mo'],'旅館に五日も泊まりました。','りょかんに いつかも とまりました。','I stayed at the inn for as long as five days.',moRule+' 五日（いつか）is a duration of five days here. This occurrence explicitly accepts も and its displayed romanization mo; no general romanization conversion is applied.'),
 gap('Complete the cup and bottle counters. Notice the regret in the completed sentence.','お茶を三〔杯〕も、ジュースを二〔本〕も飲んでしまいました。','おちゃを さんばいも、じゅーすを にほんも のんでしまいました。','I ended up drinking as many as three cups of tea and two bottles of juice.',['枚','皿'],cupRule+' も emphasizes both amounts. てしまいました expresses completion and, in this context, the speaker’s regret about drinking too much.'),
 order('Listen and build the sentence emphasizing frequent changes of trains.',['東京へ','行くとき、','三回','も','乗り換えました。'],'とうきょうへ いくとき、さんかいも のりかえました。','When going to Tokyo, I changed trains as many as three times.',moRule+' 東京へ行くとき is the time clause; 三回も counts the changes.'),
];
// Explicitly accept the other destination particle in this bank; do not globally fold particles.
content.l04[9].answer.tokens.push({id:'t4',text:'へ'});
content.l04[9].answer.slots[0].acceptedTokenIds.push('t4');
// Both grammatical positions of yesterday keep the physical five-chunk bank and も adjacent to quantity.
content.l04[14].answer.acceptedOrders.push(['t1','t0','t2','t3','t4']);
// Documented cue-only feedback: these occurrences deliberately do not reveal full source transcripts.
for(const i of [4,8,13]) { content.l04[i].support.after=[rule(content.l04[i].support.after.at(-1).text)]; delete content.l04[i].audio.feedbackText; }

content.l05 = [
 kmodel('客','Recognize 宀 above 各. This complete static glyph and shape aid replaces animation; it is not an etymology or stroke-order claim.','guest; customer',[['きゃく','On reading in 客室, 客席 and 乗客.']],[['客室','きゃくしつ','guest room','客室は二階です。','きゃくしつは にかいです。','The guest room is on the second floor.'],['乗客','じょうきゃく','passenger','乗客が電車に乗ります。','じょうきゃくが でんしゃに のります。','Passengers board the train.'],['客席','きゃくせき','audience seating','客席はこちらです。','きゃくせきは こちらです。','The audience seating is here.']]),
 gap('Choose the complete guest kanji with 宀 above 各.','〔客〕室は二階です。','きゃくしつは にかいです。','The guest room is on the second floor.',['各','室'],'客 has the roof-shaped 宀 above 各. Removing 宀 leaves a different character, 各.'),
 kmodel('観','Recognize 見 on the right of the complete glyph 観. Static shape aid replacing animation, without inventing stroke order.','view; observe',[['みる','Kun reading in 観る, intentional viewing.'],['かん','On reading in 観客 and 観光.']],[['観る','みる','watch intentionally','映画を観ます。','えいがを みます。','I watch a film.'],['観客','かんきゃく','spectator; audience','観客が試合を観ています。','かんきゃくが しあいを みています。','The spectators are watching the match.']]),
 choice('Which complete character has 見 on the right and is used in 観客?',['観','親','覚'],0,'観','かん','view; observe','観客（かんきゃく）uses 観. 観る is read みる; the compound uses かん.'),
 table('Compare general seeing with intentional viewing.','見る and 観る',['Spelling','Reading','Usage'],[['見る','みる','general seeing, looking or watching'],['観る','みる','intentional viewing or appreciation']], '窓から景色を見ます。劇場で映画を観ます。','まどから けしきを みます。げきじょうで えいがを みます。',seeingRule),
 pairs('Match the displayed spellings with their highlighted usage.',[['見る','General seeing or looking'],['観る','Intentional viewing or appreciation']],seeingRule),
 kmodel('光','Notice the three small upper strokes and the lower 儿-like shape. Static visual aid replacing animation, not etymology.','light',[['ひかり','Kun reading of the noun 光.'],['こう','On reading in 観光.']],[['光','ひかり','light','窓から光が入ります。','まどから ひかりが はいります。','Light comes in through the window.'],['観光','かんこう','sightseeing','京都で観光をします。','きょうとで かんこうを します。','I go sightseeing in Kyoto.'],['観光客','かんこうきゃく','tourist','観光客が多いです。','かんこうきゃくが おおいです。','There are many tourists.']]),
 choice('Which kanji means light?',['先','光','兄'],1,'光','ひかり','light','The noun 光 is ひかり, while 観光（かんこう）uses the on reading こう.'),
 pairs('Match each compound with its whole-word reading.',[['乗客','じょうきゃく'],['観光','かんこう'],['観光客','かんこうきゃく']],'乗客 combines riding and guest; 観光 is sightseeing; 観光客 is a tourist. Read each compound as a whole word.'),
 gap('Insert three physical kanji to complete passengers and sightseeing.','乗〔客〕は京都で〔観〕〔光〕をします。','じょうきゃくは きょうとで かんこうを します。','The passengers go sightseeing in Kyoto.',['見','遠'],'乗客（じょうきゃく）means passengers; 観光（かんこう）means sightseeing.'),
 kmodel('遠','Recognize 辶 around 袁. This static shape note replaces the source animation and makes no stroke-order claim.','far; distant',[['とおい','Kun reading of 遠い; keep い as okurigana.'],['えん','On reading in 遠足.']],[['遠い','とおい','far','駅は遠いです。','えきは とおいです。','The station is far away.'],['遠足','えんそく','excursion; school outing','明日は遠足に行きます。','あしたは えんそくに いきます。','Tomorrow we go on an excursion.']]),
 choice('Which character means far and contains 辶?',['近','遠','光'],1,'遠い','とおい','far','遠い is とおい. 近い（ちかい）means near; sharing 辶 does not make the characters interchangeable.'),
 gap('Complete distance, town and light with three physical characters.','〔遠〕い〔町〕の〔光〕が見えます。','とおい まちの ひかりが みえます。','I can see the lights of a distant town.',['近','客'],'遠い is とおい, 町 is まち and 光 is ひかり in this sentence. 見えます means that something is visible.'),
 gap('Complete the excursion and tourist-attraction words.','〔遠〕足で、〔観光〕地に行きます。','えんそくで、かんこうちに いきます。','We go to a tourist attraction on an excursion.',['近','見行'],'遠足 is えんそく; 観光地 is かんこうち. 行 is read い in 行きます here, not こう.'),
 kmodel('杯','Recognize 木 on the left and 不 on the right. Static shape aid replacing animation, not a historical derivation.','cup; counter for cupfuls',[['はい','Base on reading as a counter; its sound changes depend on the number.'],['ばい・ぱい','Contextual counter variants: 三杯 さんばい and 一杯 いっぱい.']],[['一杯','いっぱい','one cupful','お茶を一杯ください。','おちゃを いっぱい ください。','One cup of tea, please.'],['三杯','さんばい','three cupfuls','水を三杯飲みました。','みずを さんばい のみました。','I drank three glasses of water.'],['乾杯','かんぱい','toast; cheers','みんなで乾杯しましょう。','みんなで かんぱいしましょう。','Let’s all make a toast.']]),
 choice('Which character has 木 on the left and 不 on the right?',['材','杯','林'],1,'杯','はい','cup; counter for cupfuls',cupRule+' 三杯 is さんばい. Learn the reading of the complete number-and-counter word.'),
 order('Listen and build the request for two cups of tea.',['お茶を','二杯','お願い','します。'],'おちゃを にはい おねがいします。','Two cups of tea, please.',counterRule+' 二杯 is にはい.'),
 gap('Complete the kanji in the toasting expression.','みんなで乾〔杯〕しましょう。','みんなで かんぱいしましょう。','Let’s all make a toast.',['拝','本'],'乾杯（かんぱい）is a noun that combines with する. 乾杯しましょう invites everyone to make a toast.'),
 gap('Build spectator and toast compounds with three physical characters.','〔観〕〔客〕は試合のあとで乾〔杯〕しました。','かんきゃくは しあいの あとで かんぱいしました。','The spectators made a toast after the match.',['光','本'],'観客（かんきゃく）is a spectator/audience member. 乾杯（かんぱい）is a toast.'),
 gap('Complete the negative form of 遠い and the word for tourists.','駅から〔遠くない〕と行きやすいですが、遠いと行きにくいので、〔観光客〕は近い観光地を選びます。','えきから とおくないと いきやすいですが、とおいと いきにくいので、かんこうきゃくは ちかい かんこうちを えらびます。','Places that are not far from the station are easy to reach, but distant places are hard to reach, so tourists choose nearby attractions.',['近い','客室'],'The requested negative form of 遠い is 遠くない; 近い is a different adjective, near. と states a condition. 行きやすい／行きにくい contrast easy/hard to reach; ので gives a reason. 観光客（かんこうきゃく）means tourists, whereas 客室 is a guest room.'),
];
content.l05[16].answer.acceptedOrders.push(['t1','t0','t2','t3']);
// Matching surfaces show task terms, not an answer-completed source sentence.
content.l05[5].support.before=[jp('見る ／ 観る'),en('General seeing/looking and intentional viewing/appreciation')];
content.l05[8].support.before=[jp('乗客 ／ 観光 ／ 観光客')];

const expected={l04:19,l05:20};
fs.mkdirSync(output,{recursive:true});
for(const [key,authored] of Object.entries(content)) {
 const recordId=`B2.C06.${key.toUpperCase()}`,record=records.find(r=>r.recordId===recordId);
 if(!record||authored.length!==expected[key])throw new Error(`Invalid authored count: ${key}`);
 const screens=authored.map((copy,i)=>{
  const source=record.screens[i],teaching=['model','kanji','table'].includes(copy.renderer),hidden=source.rawSupport.japanese_transcript_before_answer===false;
  const noSourceReplay=!teaching&&source.rawMedia.length===0&&source.rawMediaStructure?.source_replay_available===false;
  if(noSourceReplay)copy.prompt=copy.prompt.replace(/^Listen and /,'').replace(/^Listen\. /,'');
  if(key==='l04'&&(i===2||i===11))copy.answer.options.forEach((o,j)=>o.secondary=(i===2?['ひとさら にひゃくえんです。','いちまい にひゃくえんです。','いちだい にひゃくえんです。']:['ごはんを いちまい ください。','ごはんを いっぱい ください。','ごはんを いっぽん ください。'])[j]);
  const before=[...copy.support.before];
  if(source.rawSupport.japanese_transcript_before_answer===true&&!before.some(b=>b.kind==='japanese'))before.push(jp(copy.audio.text,copy.audio.reading));
  if(source.rawSupport.translation_visible===true&&!before.some(b=>b.kind==='translation')) {
   const translation=copy.support.after.find(b=>b.kind==='translation');
   if(translation)before.push(translation);
   else if(copy.renderer==='table')before.push(en(copy.table.rows.map(r=>r.cells.at(-1)).join(' ')));
   else if(copy.renderer==='kanji')before.push(en(`${copy.kanji.meaning}. ${copy.kanji.examples.map(e=>e.translation).join(' ')}`));
  }
  const sourceContract={purpose:source.purpose,sourceScreenId:source.sourceScreenId,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,
   responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,transcriptBeforeAnswer:source.rawSupport.japanese_transcript_before_answer,translationBeforeAnswer:source.rawSupport.translation_visible,
   parallelReadingBeforeAnswer:source.rawSupport.parallel_kana_available===true&&teaching,hintBeforeAnswer:false,recordedSupport:source.rawSupport,...occurrences[source.screenId],...(key==='l04'&&i===4?{feedbackTranscript:'omitted'}:{})};
  const actual=copy.answer?.kind==='ordered_slots'?copy.answer.slots.length:copy.answer?.kind==='ordered_tokens'?copy.answer.tokens.length:copy.answer?.kind==='pairs'?copy.answer.pairs.length:copy.answer?1:0;
  if(actual!==source.rawResponseSlotCount)throw new Error(`Physical response mismatch ${source.screenId}: ${actual}`);
  return {screenId:source.screenId,prompt:null,answer:null,praise:null,...copy,support:{before:hidden&&!teaching?[]:before,after:copy.support.after},audio:{required:!noSourceReplay&&(teaching||hidden||source.rawMedia.length>0),text:null,...copy.audio,...(noSourceReplay?{beforeAnswer:false}:{})},visual:source.rawMedia.includes('video')?'video':source.rawRenderer==='stroke_animation'?'image':'none',sourceContract,evidence:source.evidence,unresolved:[]};
 });
 const pack={schemaVersion:'1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:screens.length,
  provenance:{origin:'app_authored',note:'Owner-authorized reviewed chapter 6 production authoring, 5 October 2026. Canonical and known source screen/activity/exercise identities, physical response counts, partition, observed support timing and analytical target indexing are preserved. Japanese, readings, translations, response banks, alternatives and contextual explanations are reviewed app authoring/adaptation, not literal source quotations. Original media/animation remains deferred; complete static kanji uses word-specific readings. Conflicting retained 三杯 and excursion cues are corrected to さんばい and 遠足 えんそく in app copy. Cultural policies are limited to the example venue. L04 A01.S05 alone repeats once after its first ten base tasks. Documented limited feedback omits full transcripts. No speaking or production endpoint.'},
  policies:{assessment:'One equal-weight outcome per graded base screen. Required completion and first accuracy remain separate from retry outcomes.',incorrectResponses:'Existing feedback/Check/token final placement and pair correction rules. L04 A01.S05 alone repeats once after activity 1; wrong retry still permits completion.',audio:'Existing Japanese TTS. Transcript-free scripts and translations are withheld before answers. Documented cue-only feedback omits full source transcripts; response banks remain visible.',visuals:'Shared replaceable media slots and complete static kanji shape/readings/context replace unavailable original media.'},
  unresolvedSourceFacts:['Exact source wording, exhaustive accepted alternatives, media assets and acoustic alignment remain unavailable; reviewed app authoring supplies complete content.','Source scores and unlock rules are not imported or used to seed owner progress.','Observed cup/excursion notation discrepancies stay in immutable raw evidence; reviewed app readings use さんばい and えんそく.'],screens};
 if(key==='l04')pack.retryPolicy={kind:'after_activity_once',screenIds:['B2.C06.L04.A01.S05']};
 fs.writeFileSync(path.join(output,`b2-c06-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');
}
console.log('Assembled chapter 6 emphasis (19) and kanji (20), preserving 10+9 and 10+10.');

