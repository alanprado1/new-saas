// Offline, reviewed production authoring. Source evidence and all released packs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu'), output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-seven-wondering-occurrences.json'), 'utf8')).screens;
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

const limited = (screen, blocks) => ({ ...screen, support: { before: screen.support.before, after: blocks }, audio: { text: screen.audio.text, reading: screen.audio.reading } });
const kanaRule = 'かな expresses casual wondering. Use a plain verb or い-adjective directly before it. A present affirmative noun or な-adjective takes かな without だ: 雨かな、静かかな. Use context to distinguish wondering aloud from a question addressed to someone.';
const noRule = 'For explanatory wondering, a plain verb or い-adjective takes のかな: 行くのかな、高いのかな. Present affirmative nouns and な-adjectives take なのかな: 雨なのかな、静かなのかな. A negative ends in ないのかな. These forms can suggest seeking an explanation; they do not always have exactly the same nuance as かな.';
const requestRule = 'In a familiar situation, a question about whether someone can do something can be understood as an indirect request or invitation. The relationship, situation and delivery matter; かな alone does not establish a request or politeness toward every listener.';
const adviceRule = 'Past plain verb + 方がいいかな wonders whether an action would be advisable. Verb たら + いいのかな wonders what action would be good. These are casual wondering forms; 方 is read ほう here.';
const ticket = () => limited(choice('Listen. Which question matches the speaker’s wondering?', ['チケットが買えるかな。','何時に始まるかな。','どこで会うかな。'],0,
 'このコンサートに行きたいな。まだチケットが買えるかな。','この こんさーとに いきたいな。まだ ちけっとが かえるかな。','I would like to go to this concert. I wonder whether tickets are still available to buy.', '買える is the potential of 買う.'),[jp('買える','かえる'),en('can buy'),rule('Potential 買える with かな asks about the possibility of buying. This is a fragment cue, without a full listening transcript.')]);
const adviceOrder = () => order('Listen and build the destination-focused wondering about advice.', ['京都に','は、','いつ','行った方が','いいかな。'],'きょうとには、いつ いったほうが いいかな。','I wonder when it would be best to go to Kyoto.',adviceRule+' に + は focuses on Kyoto as the destination under discussion.');
const adjectiveChars = () => gap('Listen and reconstruct the three-character wondering ending.', 'このだるまは高い〔の〕〔か〕〔な〕。','この だるまは たかいのかな。','I wonder whether this daruma is expensive.',['な','か'],noRule+' だるま names the wishing doll in this context.');
const content = {};
content.l05 = [
 gap('Listen and complete the casual wondering about tomorrow’s weather.', '明日は雨が降る〔かな〕。','あしたは あめが ふるかな。','I wonder whether it will rain tomorrow.',['ますか','ました'],kanaRule+' 降る is plain; the polite question would be 降りますか.'),
 table('Study the plain-form connections.', 'Casual wondering with かな',['Base','Wondering','Meaning'],[['降る','雨が降るかな。','I wonder whether it will rain.'],['高い','高いかな。','I wonder whether it is expensive.'],['静か','静かかな。','I wonder whether it is quiet.'],['雨','雨かな。','I wonder whether it is rain.']], '雨が降るかな。高いかな。静かかな。雨かな。','あめが ふるかな。たかいかな。しずかかな。あめかな。',kanaRule),
 limited(truth('The speaker is wondering whether this park is quiet.',true,'この公園は静かかな。','この こうえんは しずかかな。','I wonder whether this park is quiet.',kanaRule),[rule('A present affirmative な-adjective connects directly to かな, without だ.')]),
 gap('Listen and complete the い-adjective wondering.', 'この料理はおいしい〔かな〕。','この りょうりは おいしいかな。','I wonder whether this dish is delicious.',['だかな','ですか'],kanaRule+' Keep the final い of おいしい.'),
 gap('Listen and add the two characters after the question noun.', 'これは何〔か〕〔な〕。','これは なにかな。','I wonder what this is.',['だ','の'],'何 is a question word functioning as a noun here. Add かな without だ; 何 is read なに in this sentence.'),
 table('Compare wondering and a familiar indirect request.', 'Context gives かな its function',['Context','Example','Meaning in context'],[['Speaking to oneself','明日は晴れるかな。','I wonder whether it will be sunny tomorrow.'],['Parent asks a familiar child for help','この箱、運べるかな。','Could you carry this box?'],['Inviting a close friend','明日、一緒に来られるかな。','Could you come along tomorrow?']], '明日は晴れるかな。この箱、運べるかな。明日、一緒に来られるかな。','あしたは はれるかな。この はこ、はこべるかな。あした、いっしょに こられるかな。',requestRule),
 limited(truth('In this situation, the parent is indirectly asking their child to help.',true,'お母さんは子どもに言います。この箱、運べるかな。手伝ってほしいんだけど。','おかあさんは こどもに いいます。この はこ、はこべるかな。てつだって ほしいんだけど。','A mother asks her child whether they can carry the box because she would like help.',requestRule,true),[rule('The parent–child relationship and desire for help make this an indirect request in this situation.')]),
 gap('Listen and complete the topic marker and time question noun.', 'コンサート〔は〕〔いつ〕かな。','こんさーとは いつかな。','I wonder when the concert is.',['が','だ'],'は marks the concert as the topic. いつ asks about time and connects to かな without だ.'),
 order('Listen and build the familiar potential invitation.', ['明日、','私と','一緒に','来られる','かな。'],'あした、わたしと いっしょに こられるかな。','Could you come along with me tomorrow?',requestRule+' 来る has the potential form 来られる（こられる）.'),
 limited(choice('Listen. Which sentence wonders about advice in a casual way?', ['早く寝た方がいいかな。','何時に寝ますか。','もう寝ました。'],0,'明日は早いから、早く寝た方がいいかな。','あしたは はやいから、はやく ねたほうが いいかな。','Tomorrow starts early, so I wonder whether I should go to bed early.',adviceRule),[jp('た方がいいかな ／ ますか','たほうが いいかな、ますか'),en('wondering about advice / a polite question'),rule('The advice form ends in casual かな; ますか is a polite question fragment.')]),
 table('Study explanatory wondering.', 'のかな and なのかな',['Type','Example','Meaning'],[['Verb','雨が降るのかな。','I wonder whether it will rain.'],['い-adjective','高いのかな。','I wonder whether it is expensive.'],['な-adjective','静かなのかな。','I wonder whether it is quiet.'],['Noun','雨なのかな。','I wonder whether it is rain.'],['Negative','来ないのかな。','I wonder whether they will not come.']], '雨が降るのかな。高いのかな。静かなのかな。雨なのかな。来ないのかな。','あめが ふるのかな。たかいのかな。しずかなのかな。あめなのかな。こないのかな。',noRule),
 limited(truth('Both expressions convey wondering about whether the park is quiet.',true,'この公園は静かかな。この公園は静かなのかな。','この こうえんは しずかかな。この こうえんは しずかなのかな。','Both expressions wonder about the quietness of this park.',noRule),[rule('A present affirmative な-adjective needs な before のかな. Both forms convey wondering here; the explanatory form can add an explanatory nuance.')]),
 gap('Listen and complete the plain negative before のかな.', '今日は友達が〔来ない〕のかな。','きょうは ともだちが こないのかな。','I wonder whether my friend will not come today.',['来ません','来ないだ'],noRule+' 来る → 来ない（こない）in the plain negative.'),
 model('Read about a common way of using a daruma doll.', 'だるまに願いを込めて、片方の目を描くことがあります。願いが叶ったら、もう片方の目を描きます。','だるまに ねがいを こめて、かたほうの めを かくことが あります。ねがいが かなったら、もう かたほうの めを かきます。','One common custom is to draw one eye on a daruma while making a wish, then draw the other when the wish comes true.','達磨（だるま）is also written だるま. 願う（ねがう）means to wish; 願い is a wish. Customs vary. This teaching gives a common wishing practice without assigning a historical origin.'),
 gap('Listen and complete the wish verb and conditional advice.', 'だるまに何を〔願ったら〕〔いい〕のかな。','だるまに なにを ねがったら いいのかな。','I wonder what I should wish for with this daruma.',['願います','よく'],adviceRule+' 願う → 願ったら; use plain conditional wording before いいのかな.'),
 adjectiveChars(),
 ticket(),
 adviceOrder(),
];
content.l05[8].answer.acceptedOrders.push(['t1','t0','t2','t3','t4']);
for(const [i,readings]of [[9,['はやく ねたほうが いいかな。','なんじに ねますか。','もう ねました。']],[16,['ちけっとが かえるかな。','なんじに はじまるかな。','どこで あうかな。']]])content.l05[i].answer.options.forEach((o,j)=>o.secondary=readings[j]);

content.cp = [
 gap('Listen and complete the reason and confidence expression.', '人気がある〔から〕、〔きっと〕おいしいと思います。','にんきが あるから、きっと おいしいと おもいます。','It is popular, so I think it is surely delicious.',['まで','ぜひ'],'から gives a reason. きっと expresses the speaker’s confidence, rather than an objective guarantee.'),
 limited(truth('The announcement is about today’s recommended dish.',true,'本日のおすすめは、野菜カレーです。ぜひ食べてみてください。','ほんじつの おすすめは、やさいかれーです。ぜひ たべてみてください。','Today’s recommendation is vegetable curry. Please do try it.','本日のおすすめ introduces today’s recommendation.',true),[jp('本日のおすすめ・料理','ほんじつの おすすめ、りょうり'),en('today’s recommendation; dish'),rule('The topic and dish cues identify a daily recommendation, without a full transcript.')]),
 adjectiveChars(),
 adviceOrder(),
 ticket(),
 limited(truth('In this situation, the parent is indirectly asking their daughter to help.',true,'お父さんは娘に言います。この荷物、運べるかな。ちょっと手伝ってほしいんだけど。','おとうさんは むすめに いいます。この にもつ、はこべるかな。ちょっと てつだって ほしいんだけど。','A father would like his daughter to help carry the luggage.',requestRule,true),[jp('娘','むすめ'),en('daughter'),rule('The family relationship and stated desire for help establish the request in this situation.')]),
 choice('Listen. Choose the compound meaning a public park.', ['公園','動物園','遊園地'],0,'駅の近くに新しい公園ができました。','えきの ちかくに あたらしい こうえんが できました。','A new public park has been created near the station.','公園（こうえん）means a public park. 公 appears in 公立 and 公式 too. Recognising 公 and 園 is a memory aid, not a historical account of the characters.'),
 order('Listen and build the group-focused current trend.', ['若い人の間で','は、','この服が','流行して','います。'],'わかい ひとの あいだでは、この ふくが りゅうこうしています。','Among young people, these clothes are currently popular.','で + は focuses on the group. 流行する → 流行しています describes an ongoing trend.'),
 limited(choice('Listen to the two speakers. Where are they planning to go?', ['京都','図書館','映画館'],0,'A：今、京都への旅行が流行しているね。B：うん、京都にはきれいな景色があるから、週末に行ってみよう。','えー、いま、きょうとへの りょこうが りゅうこうしているね。びー、うん、きょうとには きれいな けしきが あるから、しゅうまつに いってみよう。','The two speakers plan to try visiting Kyoto at the weekend for its scenery.','The second speaker’s plan refers to Kyoto.'),[jp('景色・流行','けしき、りゅうこう'),en('scenery; trend'),rule('The scenery and travel trend cues refer to Kyoto. Feedback gives cues rather than the full exchange.')]),
 gap('Listen and complete the flushing request.', 'トイレを使ったら、水を〔流して〕ください。','といれを つかったら、みずを ながしてください。','After using the toilet, please flush it.',['洗って','流れて'],'流す（ながす）is transitive: 水を流す. Use its て-form 流して before ください; 洗う means wash, and 流れる is intransitive.'),
 order('Listen and build the opinion followed by encouragement.', ['きっと','おいしい','と思います。','ぜひ','食べてみて','ください。'],'きっと おいしいと おもいます。ぜひ たべてみてください。','I think it is surely delicious. Please do try it.','Use plain おいしい before と思います. きっと expresses confidence; ぜひ encourages trying.'),
 gap('Listen and complete the favourite and recommendation-to-a-person markers.', 'これは私の〔お気に入り〕の店です。あなた〔に〕おすすめします。','これは わたしの おきにいりの みせです。あなたに おすすめします。','This is one of my favourite shops. I recommend it to you.',['好き','で'],'お気に入り + の modifies 店. に marks the person receiving a recommendation.'),
 typed('Listen. Type the trial request in kanji, kana or the reviewed romaji form; ください is supplied.', '京都にはきれいな景色があります。ぜひ','ください。',['行ってみて','いってみて','ittemite'],'京都にはきれいな景色があります。ぜひ行ってみてください。','きょうとには きれいな けしきが あります。ぜひ いってみてください。','Kyoto has beautiful scenery. Please do try visiting.','行く → 行って + みてください invites trying the action. These three script forms are explicit accepted variants for this occurrence.'),
 limited(truth('The speaker identifies this as a particular favourite café.',true,'ここは私のお気に入りのカフェです。','ここは わたしの おきにいりの かふぇです。','This is a favourite café of mine.','お気に入り marks this café as a particular favourite.'),[rule('お気に入り identifies a particular favourite here. 好き can express liking more generally; this does not mean a person can have only one favourite.')]),
 typed('Listen. Type the nominalizing particle in kana or the reviewed romaji form.', '友達ができる','は、うれしいです。',['の','no'],'友達ができるのは、うれしいです。','ともだちが できるのは、うれしいです。','It is nice to make friends.','の nominalizes 友達ができる, so the clause can become the topic before は. Kana の and explicit romaji no are accepted.'),
 order('Listen and build the past creation modifier and comparison.', ['駅の近くに','できた','新しい店は、','前の店より','ずっと','大きいです。'],'えきの ちかくに できた あたらしい みせは、まえの みせより ずっと おおきいです。','The new shop that opened near the station is much bigger than the previous shop.','Plain past できた modifies 新しい店. Here できる describes creation/opening; より introduces the comparison.'),
 gap('Listen and complete the grown-produce invitation.', '庭で〔できた〕野菜を、食べて〔みません〕か。','にわで できた やさいを、たべてみませんか。','Would you like to try the vegetables grown in the garden?',['できます','みました'],'できた modifies 野菜 as produce grown in the garden. 食べてみませんか is a polite invitation to try eating it; か is supplied.'),
 order('Listen and build the endpoint-focused route sentence.', ['駅まで','は、','バスで','行くことが','できます。'],'えきまでは、ばすで いくことが できます。','As far as the station, you can go by bus.','まで + は focuses on the endpoint. 行くことができます expresses the possibility of going by bus.'),
 gap('Listen and complete the noun conditional and readiness verb.', '昼〔だったら〕、料理はもう〔できて〕います。','ひるだったら、りょうりは もう できています。','If it is noon, the meal is already ready.',['ならない','終わって'],'昼 is a noun: だった + ら forms だったら. 料理ができている expresses readiness in this context, rather than a meal having ended.'),
 order('Listen and build the readiness condition and departure.', ['準備が','できたら、','すぐに','出発しましょう。'],'じゅんびが できたら、すぐに しゅっぱつしましょう。','When the preparations are ready, let’s leave immediately.','準備ができる expresses readiness. できたら supplies the condition for 出発しましょう.'),
];
for(const [i,readings]of [[4,['ちけっとが かえるかな。','なんじに はじまるかな。','どこで あうかな。']],[6,['こうえん','どうぶつえん','ゆうえんち']],[8,['きょうと','としょかん','えいがかん']]])content.cp[i].answer.options.forEach((o,j)=>o.secondary=readings[j]);
content.cp[15].answer.acceptedOrders.push(['t0','t1','t2','t4','t3','t5']);
content.cp[17].answer.acceptedOrders.push(['t2','t0','t1','t3','t4']);

const count = s => s.answer?.kind==='ordered_slots'?s.answer.slots.length:s.answer?.kind==='ordered_tokens'?s.answer.tokens.length:s.answer?.kind==='pairs'?s.answer.pairs.length:s.answer?1:0;
fs.mkdirSync(output,{recursive:true});
for(const [key,authored]of Object.entries(content)) {
 const recordId=`B2.C07.${key.toUpperCase()}`,record=records.find(r=>r.recordId===recordId);
 if(authored.length!==record.baseScreenCount)throw new Error(`Wrong task count: ${recordId}`);
 const screens=authored.map((copy,i)=>{
  const source=record.screens[i],teaching=['model','table','kanji','dialogue'].includes(copy.renderer),hidden=source.rawSupport.japanese_transcript_before_answer===false;
  const noSourceReplay=!teaching&&source.rawMedia.length===0&&source.rawMediaStructure?.source_replay_available===false;
  const before=copy.support.before.map(b=>source.rawSupport.parallel_kana_available===false&&b.kind==='japanese'?{kind:'japanese',text:b.text}:b);
  if(source.rawSupport.japanese_transcript_before_answer===true&&!before.some(b=>b.kind==='japanese'))before.push(jp(copy.audio.text,source.rawSupport.parallel_kana_available===true?copy.audio.reading:undefined));
  if(source.rawSupport.translation_visible===true&&!before.some(b=>b.kind==='translation'))before.push(en(copy.support.after.find(b=>b.kind==='translation')?.text??copy.table.rows.map(r=>r.cells.at(-1)).join(' ')));
  if(count(copy)!==source.rawResponseSlotCount)throw new Error(`Wrong physical responses: ${source.screenId}`);
  return {screenId:source.screenId,prompt:null,answer:null,praise:null,...copy,support:{before:hidden?[]:before,after:copy.support.after},
   audio:{required:!noSourceReplay&&(teaching||source.rawMedia.length>0),text:null,...copy.audio,...(noSourceReplay?{beforeAnswer:false}:{})},visual:source.rawMedia.includes('video')?'video':'none',
   sourceContract:{purpose:source.purpose,sourceScreenId:source.sourceScreenId,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,
    responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,transcriptBeforeAnswer:source.rawSupport.japanese_transcript_before_answer,translationBeforeAnswer:source.rawSupport.translation_visible,
    parallelReadingBeforeAnswer:source.rawSupport.parallel_kana_available===true&&source.rawSupport.japanese_transcript_before_answer===true,hintBeforeAnswer:false,recordedSupport:source.rawSupport,...occurrences[source.screenId]},evidence:source.evidence,unresolved:[]};
 });
 const pack={schemaVersion:'1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:screens.length,
  provenance:{origin:'app_authored',note:'Owner-authorized reviewed chapter-seven production authoring/adaptation, 5 October 2026. All 38 assigned individual rows preserve source/canonical identities, exercise numbers, 10+8 and 20 partitions, physical response counts, curriculum indexing and occurrence support timing from the assigned Unified and Master records. Literal sentences, readings, translations, banks, distractors and accepted forms are authored replacements based on those targets, not recovered source quotations. Present noun/na-adjective connections, explanatory wondering, contextual family requests, advice and Daruma custom copy are reviewed. A01.S03 retains actual observed true_false. Checkpoint typed S13 accepts the documented kana/kanji/romaji categories and S15 kana/romaji. Limited/cue-only feedback omits full transcripts and corrected replay. Only L05 A02.S07 repeats once after all 18 base tasks with the same bank/order. Checkpoint explicitly retains current app passPolicy none; no threshold or exactly-80-percent boundary is inferred from research. No optional writing, speaking, recording or source unlock claim is added.'},
  policies:{assessment:'One equal-weight outcome per graded base screen. Required completion, immutable first-attempt accuracy and optional retry outcomes remain separate. Checkpoint explicitly retains the current app passPolicy none; source wording over 80% does not establish an exact boundary or change app policy.',incorrectResponses:'Existing checked feedback and token mechanics. Only L05 A02.S07 has after_activity_once remediation; either retry outcome permits completion. CP has no retry.',audio:'Current Japanese TTS. Hidden full scripts remain outside pre-answer support; limited-feedback occurrences omit corrected-source replay. Visible response options retain legitimate readings. Explicit no-source-replay records would disable pre-answer audio.',visuals:'Original media is deferred; existing replaceable visual slots are used.'},
  unresolvedSourceFacts:['Literal source wording, exhaustive accepted variants, original assets and acoustic alignment remain unobserved; these are reviewed app-authored replacements.','Research scores never seed user progress. The source exactly-80-percent boundary and causal unlock enforcement remain unknown; checkpoint retains explicit current app passPolicy none.'],screens};
 if(key==='l05')pack.retryPolicy={kind:'after_activity_once',screenIds:['B2.C07.L05.A02.S07']};
 if(key==='cp')pack.passPolicy={kind:'none'};
 fs.writeFileSync(path.join(output,`b2-c07-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');
}
console.log('Assembled L05: 18 required (10+8), 27 physical responses; CP: 20 required, 51 physical responses.');

