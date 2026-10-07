// Offline, reviewed production authoring. Source evidence and all released packs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu'), output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-six-rail-occurrences.json'), 'utf8')).screens;
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

const scene = (prompt, context, speakerLabels, turns) => ({ renderer:'dialogue', prompt,
 dialogue:{ speakers:['guest','staff'], context, speakerLabels, japaneseVisible:true, translationVisible:false,
 turns:turns.map(([speaker,japanese,reading],i)=>({id:`turn-${i+1}`,speaker,japanese,reading,english:null})) }, support:{before:[],after:[]} });
const humbleRule='参ります is the humble/formal service form of 行きます／来ます, used in announcements toward passengers. It does not elevate the passenger’s own movement.';
const requestRule='お + verb masu stem + ください forms a respectful request: 乗り換えます → お乗り換えください. Ordinary 乗り換えてください is grammatical, but the requested respectful stem pattern uses 乗り換え. ご覧ください is the established respectful look request.';
const copulaRule='でございます is the very polite service equivalent of です. It identifies a carriage or exit side; location/existence uses にございます instead.';
const content={};
content.l06=[
 gap('Complete the difficulty description: the attraction is far from the station.','観光地は駅から遠いので、歩いて行き〔にくい〕です。','かんこうちは えきから とおいので、あるいて いきにくいです。','The attraction is far from the station, so it is difficult to reach on foot.',['やすい','たい'],'行きます supplies the stem 行き; にくい expresses difficulty, consistent with the stated distance.'),
 scene('Read and listen to advice at the tourist information desk.','観光案内所で、観光客が駅から観光地への行き方を尋ねています。',{guest:'観光客',staff:'案内係'},[
  ['guest','すみません。この観光地は駅から遠いですか。','すみません。この かんこうちは えきから とおいですか。'],
  ['staff','はい、遠いので、歩いて行きにくいです。電車で行った方がいいですよ。','はい、とおいので、あるいて いきにくいです。でんしゃで いったほうが いいですよ。'],
  ['guest','電車の情報はどこにありますか。','でんしゃの じょうほうは どこに ありますか。'],
  ['staff','こちらの案内をご覧ください。駅から乗り換えなしで行けるので、行きやすいですよ。','こちらの あんないを ごらんください。えきから のりかえなしで いけるので、いきやすいですよ。'],
  ['guest','ありがとうございます。電車で行ってみます。','ありがとうございます。でんしゃで いってみます。'],
 ]),
 choice('Which request in the information-desk scene respectfully asks the tourist to look?',['こちらの案内を食べてください。','こちらの案内をご覧ください。','こちらの案内をお休みください。'],1,'こちらの案内をご覧ください。','こちらの あんないを ごらんください。','Please look at this information.',requestRule),
 gap('Use the advice form and the ease suffix from the desk scene.','電車で〔行った〕方がいいです。乗り換えなしで行けるので、行き〔やすい〕です。','でんしゃで いったほうが いいです。のりかえなしで いけるので、いきやすいです。','You should go by train. It is easy to get there because you can go without changing trains.',['行く','にくい'],'Verb past form + 方がいい gives advice. The masu stem 行き + やすい means easy to go.'),
 gap('Listen and complete the formal arrival verb.','まもなく電車が〔参ります〕。','まもなく でんしゃが まいります。','The train will arrive shortly.',['いらっしゃいます','行きやすいです'],humbleRule),
 model('Read this example carriage sign.','女性専用車両','じょせいせんようしゃりょう','Women-only carriage','女性 means women; 専用 means designated for exclusive use; 車両 means a railway car/carriage here. This is an example sign. Applicable times, eligible passengers and details depend on the operator and service; check the displayed local guidance.'),
 gap('Listen and complete the formal designation and copula.','こちらは〔女性〕専用車両〔でございます〕。','こちらは じょせいせんようしゃりょうでございます。','This is a women-only carriage.',['男性','ございます'],copulaRule+' 女性専用 is the designation in this particular statement.'),
 pairs('Match the rail terms to their readings and meanings.',[['終点','しゅうてん — terminal station'],['乗り換え','のりかえ — transfer'],['車両','しゃりょう — carriage']], '終点 is the last stop, 乗り換え is changing trains and 車両 is a railway carriage in this context.'),
 scene('Read and listen to the complete rail announcement.','終点の桜駅に到着する直前の車内放送です。',{guest:'車内放送',staff:'乗換案内'},[
  ['guest','ご乗車ありがとうございます。まもなく終点、桜駅に参ります。','ごじょうしゃ ありがとうございます。まもなく しゅうてん、さくらえきに まいります。'],
  ['staff','海線をご利用のお客様は、こちらでお乗り換えください。','うみせんを ごりようの おきゃくさまは、こちらで おのりかえください。'],
  ['guest','お出口は右側でございます。','おでぐちは みぎがわでございます。'],
  ['staff','お降りの際は、足元にご注意ください。','おおりの さいは、あしもとに ごちゅういください。'],
 ]),
 truth('ご in ご乗車 adds polite respect to the passenger-facing noun.',true,'ご乗車ありがとうございます。','ごじょうしゃ ありがとうございます。','Thank you for travelling with us.','ご is the established prefix in ご乗車 and ご注意. Prefix selection is lexical; it does not license adding ご to every noun.'),
 gap('Complete the terminal-station term and humble movement verb.','まもなく〔終点〕、桜駅に〔参ります〕。','まもなく しゅうてん、さくらえきに まいります。','We will shortly arrive at Sakura Station, the terminal station.',['始発','ございます'],humbleRule+' 終点 is the last stop; 始発 refers to an initial departure/service.'),
 gap('Insert the guest-address prefix/suffix and caution prefix.','〔お〕客〔様〕は、足元に〔ご〕注意ください。','おきゃくさまは、あしもとに ごちゅういください。','Passengers, please watch your step.',['ご','お'],'お客様 uses お + 客 + 様. ご注意 uses the established ご prefix. Similar repeated bank characters remain distinct physical tokens.'),
 choice('Listen to the announcement excerpt. What is its purpose?',['To explain where to change to the Umi Line','To advertise food on the train','To announce a change of fare'],0,'海線をご利用のお客様は、こちらでお乗り換えください。','うみせんを ごりようの おきゃくさまは、こちらで おのりかえください。','Passengers using the Umi Line should change here.',requestRule),
 gap('Choose the masu stem in the respectful transfer request; お and ください are supplied.','こちらでお〔乗り換え〕ください。','こちらで おのりかえください。','Please change trains here.',['乗り換えて','乗り換える'],requestRule),
 order('Listen again if needed and build the announcement of the exit side.',['お出口は','右側','で','ございます。'],'おでぐちは みぎがわでございます。','The exit is on the right.',copulaRule),
];
for(const i of [2,3])content.l06[i].sceneReuse='B2.C06.L06.A01.S02';
for(const i of [9,10,11,12,14])content.l06[i].sceneReuse='B2.C06.L06.A02.S01';
// Summary-only feedback is deliberately separate from each complete listening script.
content.l06[9].support.after=[rule('ご乗車 and ご注意 use ご as the established polite prefix in this announcement.')];
delete content.l06[9].audio.feedbackText;
content.l06[12].support.after=[jp('お乗り換え','おのりかえ'),en('changing trains (respectful request stem)'),rule('The excerpt asks Umi Line passengers to transfer here. 乗り換え is the masu stem used with お…ください.')];
delete content.l06[12].audio.feedbackText;

content.cp=[
 order('Build the sentence emphasizing an unexpectedly high frequency.',['一日に','五回も','この店に','食べに','来ました。'],'いちにちに ごかいも この みせに たべに きました。','I came to this shop to eat as many as five times in one day.','も follows the frequency counter to emphasize that the speaker regards five visits as many.'),
 order('Build the sentence emphasizing a large number of cups.',['昨日は','コーヒーを','五杯も','飲んで','しまいました。'],'きのうは こーひーを ごはいも のんでしまいました。','Yesterday I ended up drinking as many as five cups of coffee.','五杯も emphasizes the unexpectedly large quantity. 飲んでしまいました presents the completed action, with regret possible in this context.'),
 typed('Listen. Write the particle emphasizing the long duration.','駅で二時間','待ちました。',['も','mo'],'駅で二時間も待ちました。','えきで にじかんも まちました。','I waited at the station for as long as two hours.','Duration + も emphasizes that the waiting time was long. The kana and explicit romaji variant are accepted only for this occurrence.'),
 gap('Complete the counters: three cups of tea and two bottles of water.','お茶を三〔杯〕も飲んで、水を二〔本〕も飲みました。','おちゃを さんばいも のんで、みずを にほんも のみました。','I drank as many as three cups of tea and two bottles of water.',['枚','皿'],'杯 counts cups or glassfuls (三杯 さんばい); 本 counts these bottles (二本 にほん). The stated containers determine the counters.'),
 gap('Listen and reconstruct passenger and sightseeing with three characters.','乗〔客〕は〔観〕〔光〕に行きます。','じょうきゃくは かんこうに いきます。','The passengers are going sightseeing.',['遠','杯'],'乗客（じょうきゃく）means passengers and 観光（かんこう）means sightseeing.'),
 gap('Listen and complete the carriage designation and very polite copula.','こちらは〔女性〕専用車両〔でございます〕。','こちらは じょせいせんようしゃりょうでございます。','This is a women-only carriage.',['男性','ございます'],copulaRule),
 gap('Supply the stem for the respectful transfer request.','次の駅でお〔乗り換え〕ください。','つぎの えきで おのりかえください。','Please change trains at the next station.',['乗り換えて','乗り換える'],requestRule),
 choice('Listen. Which pair describes the sauce?',['甘い・辛い','すっぱい・甘い','しょっぱい・脂っこい'],0,'このソースは甘くて、少し辛いです。','この そーすは あまくて、すこし からいです。','This sauce is sweet and a little spicy.','甘い is sweet and 辛い is spicy in this food context.'),
 choice('Listen. How did the fruit actually taste?',['Sour','Sweet','Salty'],1,'すっぱそうな果物でしたが、食べてみると甘かったです。','すっぱそうな くだものでしたが、たべてみると あまかったです。','The fruit looked sour, but it tasted sweet when I tried it.','そう describes an appearance; the actual result is expressed by 甘かった.'),
 gap('Supply the adjective stems before the supplied そう.','この果物は〔甘〕そうですが、あの果物は〔すっぱ〕そうです。','この くだものは あまそうですが、あの くだものは すっぱそうです。','This fruit looks sweet, but that fruit looks sour.',['甘い','すっぱい'],'Drop final い before appearance そう: 甘い → 甘そう and すっぱい → すっぱそう. そう is already supplied.'),
 gap('Listen and reconstruct spectator and toast with three characters.','〔観〕〔客〕と乾〔杯〕しました。','かんきゃくと かんぱいしました。','I made a toast with the spectators.',['光','遠'],'観客（かんきゃく）means spectators; 乾杯（かんぱい）means a toast / to make a toast.'),
 truth('も emphasizes that the speaker considers two hours a long wait.',true,'駅で二時間も待ちました。','えきで にじかんも まちました。','I waited at the station for as long as two hours.','The duration 二時間 is followed by emphatic も.'),
 gap('Complete “hard to understand” because the explanation is complicated.','説明が複雑なので、分かり〔にくい〕です。','せつめいが ふくざつなので、わかりにくいです。','The explanation is complicated, so it is difficult to understand.',['やすい','たい'],'The masu stem 分かり + にくい expresses difficulty. やすい would express ease, inconsistent with this description.'),
 order('Listen and build the food description with a passive noun modifier.',['日本で','作られた','このお菓子は、','甘いです。'],'にほんで つくられた この おかしは、あまいです。','These sweets, made in Japan, are sweet.','日本で作られた modifies このお菓子. 作られた is passive past, describing where the sweets were made.'),
 gap('Complete the stated taste categories: oily food and sour juice.','この料理は〔脂っこい〕から苦手ですが、〔すっぱい〕ジュースは好きです。','この りょうりは あぶらっこいから にがてですが、すっぱい じゅーすは すきです。','I do not like this dish because it is oily, but I like sour juice.',['辛い','しょっぱい'],'脂っこい means oily/greasy; すっぱい means sour. から gives the reason for the dislike of the dish.'),
 typed('Listen. Supply the adjective meaning sweet.','このジュースはすっぱくなくて、','です。',['甘い','あまい','amai'],'このジュースはすっぱくなくて、甘いです。','この じゅーすは すっぱくなくて、あまいです。','This juice is not sour; it is sweet.','甘い／あまい and the explicit romaji form amai are accepted. Keep です outside the answer.'),
 choice('Listen. Which two tastes does the speaker describe?',['Sour and salty','Sweet and oily','Sweet and spicy'],2,'この料理は甘いですが、後から辛くなります。','この りょうりは あまいですが、あとから からくなります。','This dish is sweet, but it becomes spicy afterward.','The described tastes are 甘い and 辛い.'),
 gap('Link the two positive taste adjectives; final て is already supplied in each gap.','この料理は〔甘く〕て、〔辛く〕て、おいしいです。','この りょうりは あまくて、からくて、おいしいです。','This dish is sweet, spicy and delicious.',['甘い','辛い'],'Use adjective くて to link descriptions: 甘い → 甘くて and 辛い → 辛くて. Each て is supplied; insert only the く stem.'),
 typed('Listen. Complete the adverbial form of “easy to understand”.','情報が分かり','書いてあります。',['やすく','yasuku'],'情報が分かりやすく書いてあります。','じょうほうが わかりやすく かいてあります。','The information is written in an easy-to-understand way.','Change やすい to adverbial やすく before 書いてあります. The kana and explicit romaji variant are accepted.'),
 order('Listen and build the explanation and request to repeat.',['説明が','分かりにくかった','ので、','もう一度','説明して','ください。'],'せつめいが わかりにくかったので、もういちど せつめいしてください。','The explanation was difficult to understand, so please explain it once more.','にくい takes past かった: にくかった. ので gives the reason for the polite repeat request.'),
];
content.cp[0].answer.acceptedOrders.push(['t2','t0','t1','t3','t4'],['t0','t2','t1','t3','t4'],['t0','t2','t3','t1','t4']);
content.cp[1].answer.acceptedOrders.push(['t1','t0','t2','t3','t4'],['t0','t2','t1','t3','t4']);
// Linking these two properties in either order preserves the same description.
for(const slot of content.cp[17].answer.slots)slot.acceptedTokenIds=['t0','t1'];
// These observations establish only adjective/meaning cues after answering, not a full transcript.
for(const [i,target,reading,meaning,reason]of [
 [7,'甘い・辛い','あまい・からい','sweet and spicy','The sauce is described as sweet and a little spicy.'],
 [8,'甘かった','あまかった','was sweet','Sour was an appearance/possibility; the actual taste was sweet.'],
 [16,'甘い・辛い','あまい・からい','sweet and spicy','The dish starts sweet and becomes spicy afterward.'],
]){content.cp[i].support.after=[jp(target,reading),en(meaning),rule(reason)];delete content.cp[i].audio.feedbackText;}
content.cp[11].support.after=[rule('二時間も emphasizes the long duration of the wait.')];
delete content.cp[11].audio.feedbackText;
for(const [index,texts,readings]of [
 [7,['甘い・辛い','すっぱい・甘い','しょっぱい・脂っこい'],['あまい・からい','すっぱい・あまい','しょっぱい・あぶらっこい']],
 [8,['すっぱかった','甘かった','しょっぱかった'],['すっぱかった','あまかった','しょっぱかった']],
 [16,['すっぱい・しょっぱい','甘い・脂っこい','甘い・辛い'],['すっぱい・しょっぱい','あまい・あぶらっこい','あまい・からい']],
])content.cp[index].answer.options.forEach((o,i)=>{o.text=texts[i];o.secondary=readings[i];});
content.cp[12].support.after=[jp('にくい','にくい'),en('difficult to do'),rule('分かり + にくい means difficult to understand, consistent with the complicated explanation.')];
delete content.cp[12].audio.feedbackText;

fs.mkdirSync(output,{recursive:true});
for(const [key,authored]of Object.entries(content)){
 const recordId=`B2.C06.${key.toUpperCase()}`,record=records.find(r=>r.recordId===recordId);
 if(authored.length!==record.baseScreenCount)throw new Error(`Invalid count: ${recordId}`);
 const screens=authored.map((copy,i)=>{
  const source=record.screens[i],teaching=['model','dialogue','table','kanji'].includes(copy.renderer),hidden=source.rawSupport.japanese_transcript_before_answer===false;
  const optionalSceneSupport=source.rawSupport.transcript_access==='Optional opened recap, not initially inline.';
  const noSourceReplay=!teaching&&source.rawMedia.length===0&&source.rawMediaStructure?.source_replay_available===false;
  if(noSourceReplay)copy.prompt=copy.prompt.replace(/^Listen and /,'').replace(/^Listen\. /,'');
  const before=[...copy.support.before];
  if(source.rawSupport.japanese_transcript_before_answer===true&&copy.renderer!=='dialogue'&&!optionalSceneSupport&&!before.some(b=>b.kind==='japanese'))before.push(jp(copy.audio?.text??copy.left.map(x=>x.text).join('、'),copy.audio?.reading));
  if(source.rawSupport.translation_visible===true&&!before.some(b=>b.kind==='translation'))before.push(en(copy.support.after.find(b=>b.kind==='translation')?.text??copy.right.map(x=>x.text).join('; ')));
  const{sceneReuse,...authoredCopy}=copy;
  return{screenId:source.screenId,prompt:null,answer:null,praise:null,...authoredCopy,support:{before:hidden?[]:before,after:copy.support.after},
   audio:{required:!noSourceReplay&&(teaching||source.rawMedia.length>0),text:null,...copy.audio,...(noSourceReplay?{beforeAnswer:false}:{})},visual:source.rawRenderer==='scene_video'?'video':'none',
   sourceContract:{purpose:source.purpose,sourceScreenId:source.sourceScreenId,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,
    responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,transcriptBeforeAnswer:source.rawSupport.japanese_transcript_before_answer,translationBeforeAnswer:source.rawSupport.translation_visible,
    parallelReadingBeforeAnswer:copy.renderer==='model',hintBeforeAnswer:false,recordedSupport:source.rawSupport,...occurrences[source.screenId],...(sceneReuse?{sceneReuse}:{}),...(optionalSceneSupport?{transcriptAccess:'scene_recap'}:{})},evidence:source.evidence,unresolved:[]};
 });
 const pack={schemaVersion:'1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:screens.length,
  provenance:{origin:'app_authored',note:'Owner-authorized reviewed chapter 6 production authoring/adaptation, 5 October 2026. All 35 assigned observed source rows, physical response counts, exercise/activity identities and occurrence support timing are retained. Japanese text, readings, translations, response banks and reviewed equivalence are authored replacements based on documented targets, not observed quotations. Tourist-information dialogue and complete rail announcement are coherent original scenes; rail announcement voices are app casting using compatible internal guest/staff IDs with configurable announcement labels. No English scene translation was observed; every turn therefore has explicit null English. Seven documented replay links bind exact complete scenes, including unsupported choice and ordering. Checkpoint S07 retains the observed token_gap renderer despite the handoff typed paraphrase. Limited feedback remains target-only where a full transcript was not observed.'},
  policies:{assessment:'One equal-weight outcome per graded base screen. Core completion and first-attempt accuracy remain distinct; no checkpoint threshold is inferred.',incorrectResponses:'Existing feedback/Check/token and pair mechanics. No lesson or checkpoint retry is documented or configured.',audio:'Current Japanese TTS with all-turn full-scene replay. No original audio or acoustic fidelity is claimed. Hidden full scripts stay absent from pre-answer support; limited feedback remains limited.',visuals:'Original media is deferred; current shared replaceable visual slots are used. No recording, speaking or pronunciation action.'},
  unresolvedSourceFacts:['Literal source wording, exhaustive accepted forms, speaker identities and acoustic/media alignment remain unobserved; the replacement scenes and answer banks are reviewed app authoring.','Source scoring, exactly-80-percent threshold boundaries and causal unlock/retry rules remain unknown. Research results never seed owner progress.'],screens};
 if(key==='cp')pack.passPolicy={kind:'none'};
 fs.writeFileSync(path.join(output,`b2-c06-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');
}
console.log('Assembled reviewed L06 (15; 8+7) and observed-row checkpoint (20).');

