// Offline, reviewed production authoring. Source evidence and all released packs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu'), output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-three-occurrences.json'), 'utf8')).screens;
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

const continuationRule = 'Use the ます stem + つづける: 通います → 通いつづける. The combined verb inflects: つづけます / つづけている. This means continuing the action, not starting or finishing it.';
const windowRule = 'In this temporal construction, the subordinate predicate describes the state/window at that time and uses the nonpast form, even with a past main clause: 日本にいるうちに、旅行しました. Progressive ている and potential forms can also describe the window.';
const negativeRule = 'Negative plain verb + うちに means before that event happens: 忘れないうちに = before forgetting. する → しない; 来る → 来ない（こない）. The negative form belongs to the window clause.';
const trialRule = 'Verb て-form + みる means try doing something to discover the result. The polite form is みます. The auxiliary is written in kana: 食べてみます. It differs from lexical 見る, to see/watch.';
const desireRule = 'Use a verb’s て-form + みたいです to say you want to try the action. This app checks the indicated suffix only; supplied て forms and endings stay outside the answer. Kana み is the auxiliary, not lexical 見.';
const habit = ['高校のころから、ピアノを習いつづけています。','こうこうのころから、ぴあのをならいつづけています。','I have kept taking piano lessons since my high-school years.'];
const period = ['高校のころから、ピアノを習い始めて、今も習いつづけています。','こうこうのころから、ぴあのをならいはじめて、いまもならいつづけています。','I started taking piano lessons in my high-school years and still continue now.'];
const relationship = ['高校のころから、彼と付き合いつづけています。','こうこうのころから、かれとつきあいつづけています。','I have continued dating him since my high-school years.'];
const study = ['日本語を勉強しているうちに、日本に住みたくなりました。','にほんごをべんきょうしているうちに、にほんにすみたくなりました。','While studying Japanese, I came to want to live in Japan.'];
const doze = ['映画を見ているうちに、寝てしまいました。','えいがをみているうちに、ねてしまいました。','While watching a film, I accidentally fell asleep.'];
const temporal = ['休んでいるうちに、雨がやみました。','やすんでいるうちに、あめがやみました。','While I was resting, the rain stopped.'];
const travelWindow = ['歩けるうちに、いろいろな所に行きたいです。','あるけるうちに、いろいろなところにいきたいです。','While I am still able to walk, I want to go to many different places.'];
const sold = ['チケットが売り切れないうちに、予約します。','ちけっとがうりきれないうちに、よやくします。','I will book before the tickets sell out.'];
const offering = ['冷たいうちにどうぞ。','つめたいうちにどうぞ。','Please enjoy it while it is cold.'];
const effort = ['努力をつづけることが大切です。','どりょくをつづけることがたいせつです。','It is important to keep making an effort.'];
const exam = ['来年、日本語の試験を受けようと思っています。','らいねん、にほんごのしけんをうけようとおもっています。','I intend to take a Japanese exam next year.'];
const trial = ['このお茶を飲んでみます。','このおちゃをのんでみます。','I will try drinking this tea.'];
const typedTrial = ['着物を着たことがないので、着てみます。','きものをきたことがないので、きてみます。','I have never worn a kimono, so I will try wearing one.'];
const desire = ['京都の町を歩いてみたいです。','きょうとのまちをあるいてみたいです。','I would like to try walking around Kyoto.'];
const conditional = ['京都に行ったら、浴衣を着て、お寺を見てみたいです。','きょうとにいったら、ゆかたをきて、おてらをみてみたいです。','If I go to Kyoto, I would like to put on a yukata and try visiting temples.'];
const combined = ['努力をつづけてみます。','どりょくをつづけてみます。','I will try continuing to make an effort.'];
const sceneTurns = [
  { id:'staff-1', speaker:'staff', japanese:'いらっしゃいませ。今日は暑いですね。', reading:'いらっしゃいませ。きょうはあついですね。' },
  { id:'guest-1', speaker:'guest', japanese:'そうですね。抹茶味のかき氷を一つお願いします。', reading:'そうですね。まっちゃあじのかきごおりをひとつおねがいします。' },
  { id:'staff-2', speaker:'staff', japanese:'はい、抹茶味ですね。冷たいうちにどうぞ。', reading:'はい、まっちゃあじですね。つめたいうちにどうぞ。' },
  { id:'guest-2', speaker:'guest', japanese:'ありがとうございます。いちご味もありますか。', reading:'ありがとうございます。いちごあじもありますか。' },
  { id:'staff-3', speaker:'staff', japanese:'はい、あります。売り切れないうちに、ぜひお試しください。', reading:'はい、あります。うりきれないうちに、ぜひおためしください。' },
];
const content = {
 l01: [
  model('Listen and read about a continuing habit.', ...habit, continuationRule),
  gap('Complete the continuation verb with four kana. います is supplied.', 'ピアノを習い〔つ〕〔づ〕〔け〕〔て〕います。','ぴあのをならいつづけています。','I continue taking piano lessons.', ['ず','る'], continuationRule),
  gap('Listen and insert the verb stem and continuation predicate.', '私は毎週、教室に〔通い〕〔つづけています〕。','わたしはまいしゅう、きょうしつにかよいつづけています。','I continue attending the class every week.', ['通う','始めています'], continuationRule),
  truth('The mother told the speaker to keep studying.',true,'母に「勉強しつづけなさい」と言われました。','ははに「べんきょうしつづけなさい」といわれました。','My mother told me, “Keep studying.”','し is the stem of します; つづけなさい is the instruction to continue. It is reported as the mother’s command.'),
  table('Compare a particular occasion with an approximate period.', 'とき and ころ', ['Expression','Example','Meaning'], [['とき','高校生のとき、京都に行きました。','When I was a high-school student, I went to Kyoto.'],['ころ','高校のころから、ピアノを習っています。','I have taken piano lessons since my high-school years.']], '高校生のとき、京都に行きました。高校のころから、ピアノを習っています。','こうこうせいのとき、きょうとにいきました。こうこうのころから、ぴあのをならっています。','とき can identify an occasion or time/state. ころ often presents an approximate time or period. Nouns link with の: 高校のころ. Both can describe school years; this is a nuance, not an absolute ban on either form.'),
  gap('Complete the five-kana approximate-time anchor.', '高校〔の〕〔こ〕〔ろ〕〔か〕〔ら〕、ピアノを習っています。','こうこうのころから、ぴあのをならっています。','I have taken piano lessons since my high-school years.', ['と','に'], '高校のころから means since around the high-school period. から marks the starting point.'),
  gap('Complete the life period and continuation te-form.', '高校の〔ころ〕から、ピアノを習い始めて、今も習い〔つづけて〕います。', period[1],period[2],['ときに','つづける'],continuationRule),
  order('Build the continuing relationship sentence.', ['高校のころから、','彼と','付き合い','つづけています。'],relationship[1],relationship[2],'付き合います → 付き合い + つづけています. 彼と identifies the partner; のころから marks the approximate starting period.'),
 ],
 l02: [
  model('Listen and read about a desire that developed over time.',...study,windowRule),
  gap('Complete the connector with three kana.', '日本語を勉強している〔う〕〔ち〕〔に〕、日本に住みたくなりました。',study[1],study[2],['と','で'],windowRule),
  table('Study the window clause and the main-clause tense.', 'Verb + うちに', ['Window clause','Main clause','Meaning'],[['日本にいるうちに','京都に行きました。','While in Japan, I went to Kyoto.'],['勉強しているうちに','住みたくなりました。','While studying, I came to want to live there.']], '日本にいるうちに、京都に行きました。勉強しているうちに、住みたくなりました。','にほんにいるうちに、きょうとにいきました。べんきょうしているうちに、すみたくなりました。',windowRule),
  gap('Listen. Choose the nonpast form for the earlier time window.', '日本に〔いる〕うちに、京都に行きました。','にほんにいるうちに、きょうとにいきました。','While I was in Japan, I went to Kyoto.', ['いた','いて'],windowRule),
  order('Build a question about what someone wants to do while in Japan.', ['日本に','いる','うちに、','何を','したいですか。'],'にほんにいるうちに、なにをしたいですか。','What would you like to do while you are in Japan?',windowRule),
  gap('Listen and choose the ongoing attendance phrase.', '学校に〔通っている〕うちに、友達が増えました。','がっこうにかよっているうちに、ともだちがふえました。','While attending school, I made more friends.', ['通った','通っていた'], '通っている describes the ongoing attendance window; the main clause 増えました is past.'),
  gap('Complete the ongoing action and accidental event.', '映画を〔見ている〕うちに、〔寝てしまいました〕。',doze[1],doze[2],['見る','寝始めます'], '見ている is the background action. 寝てしまいました describes unintentionally falling asleep.'),
  choice('Listen. When did the rain stop?', ['Before the speaker rested','While the speaker was resting','After the speaker left home'],1,...temporal,'休んでいるうちに gives the ongoing rest as the time window in which the rain stopped.'),
  gap('Complete the potential state and connector.', '〔歩ける〕〔うちに〕、いろいろな所に行きたいです。',travelWindow[1],travelWindow[2],['歩く','まで'], '歩ける means can walk. 歩けるうちに describes the time while that ability remains.'),
 ],
 l03: [
  gap('Listen and reconstruct the five-kana negative time window.', '忘れ〔な〕〔い〕〔う〕〔ち〕〔に〕、メモしておきます。','わすれないうちに、めもしておきます。','I will make a note before I forget.', ['た','ら'],negativeRule),
  choice('Listen. What does the speaker plan to do?', ['Go home before it starts raining','Stay outside until the rain stops','Go out after it starts raining'],0,'雨が降らないうちに、家に帰ります。','あめがふらないうちに、いえにかえります。','I will go home before it starts raining.',negativeRule),
  gap('Complete the irregular negative verb and connector.', '何も〔しない〕〔うちに〕、一日が終わってしまいました。','なにもしないうちに、いちにちがおわってしまいました。','The day ended before I did anything.', ['するない','まで'], 'する has the irregular negative しない. 一日が終わってしまいました conveys that the day ended regrettably.'),
  model('Listen and read the word for selling out.', '人気のかき氷は、すぐに売り切れます。','にんきのかきごおりは、すぐにうりきれます。','The popular shaved ice sells out quickly.', '売り切れる means sell out/be sold out. 売り切れ is also a noun used on a sold-out notice.'),
  choice('Which verb means “sell out”?',['売り始める','売り切れる','売り終わる'],1,'かき氷が売り切れました。','かきごおりがうりきれました。','The shaved ice has sold out.','売り始める means start selling; 売り終わる focuses on finishing the act of selling; 売り切れる means the stock is sold out. A shop notice may say 売り切れ.'),
  gap('Reconstruct the six-character negative sold-out verb.', 'チケットが〔売〕〔り〕〔切〕〔れ〕〔な〕〔い〕うちに、予約します。',sold[1],sold[2],['終','る'], '売り切れる → 売り切れない. The whole six-character mixed-script negative form belongs before うちに.'),
  table('Compare adjective endings before うちに.', 'Adjective state windows', ['Class','Example','Meaning'], [['i-adjective','温かいうちに、食べてください。','Please eat it while it is warm.'],['na-adjective','元気なうちに、旅行したいです。','I want to travel while I am in good health.']], '温かいうちに、食べてください。元気なうちに、旅行したいです。','あたたかいうちに、たべてください。げんきなうちに、りょこうしたいです。','Keep an i-adjective’s い before うちに: 温かいうちに. A na-adjective uses な: 元気なうちに. These describe a state while it lasts.'),
  gap('Choose the nonpast i-adjective for the food’s current window.', '料理が〔温かい〕うちに、食べてください。','りょうりがあたたかいうちに、たべてください。','Please eat the food while it is warm.', ['温かかった','温かく'], 'The warm state is 温かい before うちに. The past main-clause rule also keeps the window form nonpast in these examples.'),
  gap('Complete the na-adjective ending and time connector.', '元気〔な〕〔うちに〕、旅行したいです。','げんきなうちに、りょこうしたいです。','I would like to travel while I am in good health.', ['の','で','まで'], '元気 is a na-adjective, so 元気なうちに describes its continuing state.'),
  model('Listen and read about summer shaved ice.', '暑い日には、かき氷を食べたくなります。抹茶味やいちご味があります。喫茶店や夏祭りの屋台で見かけることがあります。','あついひには、かきごおりをたべたくなります。まっちゃあじやいちごあじがあります。きっさてんやなつまつりのやたいでみかけることがあります。','On hot days, I feel like eating shaved ice. There are matcha and strawberry flavors. You may see it at cafés or summer-festival stalls.','かき氷 is shaved ice. 抹茶味 is matcha flavor; いちご味 is strawberry flavor. Flavors and availability vary by venue. 暑い describes the weather.'),
  gap('Distinguish hot weather from a hot object.', '今日は〔暑い〕ので、〔熱い〕お茶ではなく、かき氷を食べたいです。','きょうはあついので、あついおちゃではなく、かきごおりをたべたいです。','It is hot today, so I would like shaved ice instead of hot tea.', ['寒い','冷たい'], '暑い is hot weather; 熱い is a hot object or drink. Both are read あつい.'),
  { renderer:'dialogue',prompt:'Listen to the customer and shop assistant. Follow the Japanese dialogue.', support:{before:[],after:[]},audio:{required:true,text:null},
    dialogue:{context:'dessert shop',speakerLabels:{guest:'Customer',staff:'Shop assistant'},japaneseVisible:true,translationVisible:false,speakers:['guest','staff'],turns:sceneTurns.map(t => ({...t,english:null})),facts:[{id:'selected-flavor',turnId:'guest-1',text:'抹茶味'}]} },
  { ...choice('Which flavor did the customer order in the dialogue?', ['いちご味','抹茶味','レモン味'],1,'抹茶味のかき氷を一つお願いします。','まっちゃあじのかきごおりをひとつおねがいします。','One matcha-flavored shaved ice, please.','The customer orders 抹茶味. The later question about いちご味 asks about availability, not the selected order.'),sceneReuse:'B2.C03.L03.A02.S03' },
  order('Build the shop assistant’s offering.', ['冷たい','うちに','どうぞ。'],offering[1],offering[2],'冷たいうちに describes the cold state. どうぞ offers the food politely; it does not itself mean a request to make the food cold.'),
  gap('Complete the dessert’s negative availability window.', 'かき氷が〔売り切れない〕うちに、注文しましょう。','かきごおりがうりきれないうちに、ちゅうもんしましょう。','Let’s order the shaved ice before it sells out.', ['売り切れる','売り始める'], '売り切れないうちに means before the dessert sells out. This correction belongs to dessert availability, not tickets.'),
 ],
 l04: [
  model('Listen and read about effort.',...effort,'努力（どりょく）is a noun. 努力する means make an effort. つづけること nominalizes continuing.'),
  gap('Reconstruct the four-kana word for effort.', '〔ど〕〔り〕〔ょ〕〔く〕することが大切です。','どりょくすることがたいせつです。','It is important to make an effort.', ['よ','き'], '努力 is どりょく. Small ょ follows り. The noun combines with する.'),
  model('Listen and read an intention to take an exam.',...exam,'試験を受ける is take an exam. 受けようと思っています is a supplied volitional intention; the collocation is the new target.'),
  gap('Choose the natural exam-taking verb in this intention.', '来年、日本語の試験を〔受け〕ようと思っています。',exam[1],exam[2], ['取り','受かり'], '試験を受ける means take an exam. 受ける is an ichidan verb: 受けよう. 取る is a literal transfer from English “take”, not this collocation; 受かる means pass and takes に with 試験.'),
  gap('Reconstruct the three-kana exam noun.', '日本語の〔し〕〔け〕〔ん〕を受けたいです。','にほんごのしけんをうけたいです。','I want to take a Japanese exam.', ['き','ね'], '試験 is しけん. テスト can also mean test; use the taught word here.'),
  gap('Complete the exam and effort nouns.', '日本語の〔試験〕に合格したいので、毎日〔努力〕しています。','にほんごのしけんにごうかくしたいので、まいにちどりょくしています。','I want to pass the Japanese exam, so I make an effort every day.', ['試合','体験'], '試験に合格する means pass an exam. 努力しています describes ongoing effort.'),
  table('Study trying an action to find out its result.', 'て-form + みる', ['Base verb','Trial example','Meaning'], [['飲む','このお茶を飲んでみます。','I will try drinking this tea.'],['着る','浴衣を着てみます。','I will try wearing a yukata.']], 'このお茶を飲んでみます。浴衣を着てみます。','このおちゃをのんでみます。ゆかたをきてみます。',trialRule),
  truth('The speaker plans to try drinking the tea.', true,...trial,trialRule),
  gap('Reconstruct the four-kana te-form ending and polite trial suffix. 飲ん is supplied.', 'このお茶を飲ん〔で〕〔み〕〔ま〕〔す〕。','このおちゃをのんでみます。','I will try drinking this tea.', ['い','る'],trialRule),
  gap('Complete the te-form and polite trial auxiliary.', 'このお茶を〔飲んで〕〔みます〕。',trial[1],trial[2], ['飲み','飲む','います'],trialRule),
  pairs('Match each sentence to its grammatical function.', [['今、浴衣を着ています。','Ongoing state: wearing a yukata now'],['明日、浴衣を着てみます。','Future trial: trying a yukata tomorrow']], 'ている describes the ongoing state here; てみる describes a trial action. The 今 and 明日 contexts fix the time.'),
  choice('この料理は初めてです。味を知りたいです。どうしますか。',['少し食べてみます。','食べたことがありません。','食べないでください。'],0,'味を知りたいので、少し食べてみます。','あじをしりたいので、すこしたべてみます。','I want to know its flavor, so I will try eating a little.', 'A small trial answers the desire to find out the flavor. Stating no experience or asking someone not to eat does not propose that trial.'),
  typed('Type the polite trial suffix after 着て, then select Check.', '着物を着たことがないので、着て','。',['みます'],...typedTrial,trialRule),
  model('Listen and read about a lightweight robe.', '浴衣は、軽い着物の一種です。旅館や夏祭りなどで着ることがあります。夏祭りで浴衣を着てみます。','ゆかたは、かるいきもののいっしゅです。りょかんやなつまつりなどできることがあります。なつまつりでゆかたをきてみます。','A yukata is a type of lightweight kimono. People may wear one at inns or summer festivals. I will try wearing one at a summer festival.','Yukata use varies by place and occasion. 着てみます describes trying to wear one in this example.'),
  choice('浴衣を着てみたいですか。Choose an affirmative desire to try.', ['はい、着てみたいです。','はい、着ています。','いいえ、着てみたくないです。'],0,'はい、着てみたいです。','はい、きてみたいです。','Yes, I would like to try wearing one.','みたいです expresses desire; みたくないです is its negative. 着ています describes current wearing, not the requested desire.'),
  gap('Listen and complete both actions in the conditional travel plan.', '京都に行ったら、浴衣を〔着て〕、お寺を〔見て〕みたいです。',conditional[1],conditional[2], ['着る','見ます'], '着て is the te-form of wear; 見て is lexical see/visit. The final auxiliary みたい is kana and expresses the desired trial.'),
  pairs('Match each reason to the trial action that addresses it.', [['このお茶の味を知りたいので、','少し飲んでみます。'],['この服のサイズが分からないので、','着てみます。'],['この町の様子を知りたいので、','歩いてみます。']], 'Taste → try drinking; unknown clothing size → try wearing; the town’s character → try walking. Each trial directly addresses its stated reason.'),
  order('Build the trial of continuing effort.', ['努力を','つづけて','み','ます。'],combined[1],combined[2],'努力をつづける → 努力をつづけてみます. The trial concerns continuing the effort; みます is the auxiliary.'),
 ],
 l05: [
  gap('Complete a past trial after a past desire.', '踊ってみたかったので、夏祭りで〔踊って〕〔みました〕。','おどってみたかったので、なつまつりでおどってみました。','I wanted to try dancing, so I tried dancing at a summer festival.', ['踊り','みます'], '踊って is the te-form; みました is the polite past trial. みたかった expresses the preceding past desire.'),
  choice('Choose “I would like to try taking photos.”',['写真を撮ってください。','写真を撮ってみたいです。','写真を撮ることができます。'],1,'写真を撮ってみたいです。','しゃしんをとってみたいです。','I would like to try taking photos.', '撮ってみたいです is desire to try; 撮ってください is a request; 撮ることができます expresses ability.'),
  truth('The speaker wants to try dancing, rather than just watch it.',true,'踊りを見るだけではなく、自分も踊ってみたいです。','おどりをみるだけではなく、じぶんもおどってみたいです。','I would like to try dancing myself, rather than only watch the dance.','見る is lexical watch; 踊ってみたい is wanting to try dancing. 自分も explicitly includes the speaker as a dancer.'),
  gap('Complete the irregular te-form and trial desire in the history context.', '日本の歴史に興味があるので、博物館に〔行って〕〔みたい〕です。','にほんのれきしにきょうみがあるので、はくぶつかんにいってみたいです。','I am interested in Japanese history, so I would like to try going to a museum.', ['行いて','行き','います'], '行く has the exceptional te-form 行って, not 行いて. みたい is the trial-desire suffix before the supplied です.'),
  typed('Type the trial-desire suffix after 歩いて. です is supplied.', '京都の町を歩いて','です。',['みたい'],...desire,desireRule),
  order('Build the desire to try walking around the town.', ['京都の','町を','歩いて','みたい','です。'],desire[1],desire[2],'を marks the area traversed in 町を歩く. に would indicate a destination rather than the space walked through.'),
  gap('Complete the lodging verb and trial-desire suffix.', '日本の旅館に〔泊まって〕〔みたい〕です。','にほんのりょかんにとまってみたいです。','I would like to try staying at a Japanese inn.', ['泊まり','います'], '泊まる → 泊まって. 旅館に identifies the lodging place; みたい expresses the desire to try, while います would express an ongoing state.'),
 ],
 l06: [
  kmodel('続','Notice 糸 on the left and 売 on the right. Compare the full shape with 読, which has 言 on the left.','continue; continuation',[['つづ-ける','Transitive: continue an action'],['つづ-く','Intransitive: something continues']],[['続ける','つづける','continue an action','勉強を続けます。','べんきょうをつづけます。','I will continue studying.'],['続く','つづく','continue (intransitive)','雨が続いています。','あめがつづいています。','The rain continues.'],['手続き','てつづき','procedure','入学の手続きをします。','にゅうがくのてつづきをします。','I will complete the enrollment procedure.']]),
  choice('Choose the spelling of つづけます.',['読けます','続けます','績けます'],1,'勉強を続けます。','べんきょうをつづけます。','I will continue studying.','続 has 糸 + 売. 読 has 言; 績 has a different right side. The shapes are visual comparisons, not etymological claims.'),
  kmodel('通','Notice the enclosing movement component 辶 and 甬 above it. Compare the whole outline with 近.','commute; pass through; communicate',[['かよ-う','Regular attendance: 学校に通う'],['とお-る','Pass through: 道を通る'],['つう','In compounds: 通学, 通院']],[['通う','かよう','commute/attend','学校に通っています。','がっこうにかよっています。','I attend school.'],['通る','とおる','pass through','この道を通ります。','このみちをとおります。','I will pass along this road.'],['通学','つうがく','going to school','通学に一時間かかります。','つうがくにいちじかんかかります。','It takes an hour to get to school.']]),
  choice('Choose the spelling of かよっています.',['近っています','通っています','道っています'],1,'学校に通っています。','がっこうにかよっています。','I attend school.','通う is regular attendance or commuting. 通 has 辶, but the inner shape distinguishes it from other movement-component characters.'),
  gap('Insert the two kanji in the continuing-attendance sentence.', '教室に〔通〕い〔続〕けています。','きょうしつにかよいつづけています。','I continue attending the class.', ['読','近'], '通い is the stem of 通う; 続けています expresses continuing the action.'),
  kmodel('努','Notice 奴 above 力. Compare the lower 力 with 心 in 怒.','effort; strive',[['ど','In 努力'],['つと-める','In 努める: strive/make an effort']],[['努力','どりょく','effort','毎日、努力しています。','まいにち、どりょくしています。','I make an effort every day.'],['努める','つとめる','strive','健康に気をつけるように努めています。','けんこうにきをつけるようにつとめています。','I strive to look after my health.']]),
  gap('Choose the kanji at the start of どりょく.', '毎日、〔努〕力しています。','まいにち、どりょくしています。','I make an effort every day.', ['怒','奴'], '努力 uses 努 with 力 below 奴. 怒 has 心 below it; 奴 alone lacks the lower component.'),
  kmodel('試','Notice 言 on the left and 式 on the right. Compare it with 識, whose right side is different.','try; test',[['し','In 試験, 試合 and 入試'],['ため-す','In 試す: test/try']],[['試合','しあい','match/game','明日、試合があります。','あした、しあいがあります。','There is a match tomorrow.'],['試験','しけん','exam','試験を受けます。','しけんをうけます。','I will take an exam.'],['試す','ためす','test/try','新しい方法を試します。','あたらしいほうほうをためします。','I will try a new method.']]),
  choice('Choose the word for a match: しあい.',['識合','試合','式合'],1,'明日、試合があります。','あした、しあいがあります。','There is a match tomorrow.','試合 uses 試. 式 alone is missing 言; 識 has a different right-hand shape.'),
  kmodel('験','Notice 馬 on the left and the compact right-hand shape. Compare the whole character with 検, which has 木 on the left.','test; verification; experience',[['けん','In 試験, 経験, 体験 and 実験']],[['試験','しけん','exam','試験を受けます。','しけんをうけます。','I will take an exam.'],['経験','けいけん','experience','仕事の経験があります。','しごとのけいけんがあります。','I have work experience.'],['実験','じっけん','experiment','科学の実験をします。','かがくのじっけんをします。','I will conduct a science experiment.']]),
  choice('Choose the spelling of しけん.',['試険','試検','試験'],2,'日本語の試験を受けます。','にほんごのしけんをうけます。','I will take a Japanese exam.','験 uses 馬; 検 uses 木; 険 uses 阝. The right-side similarity does not make them interchangeable.'),
  gap('Reconstruct the exam and effort words with four kanji.', '〔試〕〔験〕に合格したいので、毎日〔努〕〔力〕しています。','しけんにごうかくしたいので、まいにちどりょくしています。','I want to pass the exam, so I make an effort every day.', ['検','怒'], '試験 is しけん; 努力 is どりょく. 力 is the earlier character read りょく in this compound.'),
  pairs('Complete each clause with its transitive or intransitive continuation.', [['私は勉強を','続けています。'],['雨が','続いています。']], '続ける takes an object marked を; 続く describes the subject marked が continuing.'),
  gap('Fill the word-specific kana reading stems of 通. う and る are supplied.', '学校に〔かよ〕うとき、この道を〔とお〕る。','がっこうにかようとき、このみちをとおる。','When I go to school, I pass along this road.', ['つう','とう'], '通う is かよう; 通る is とおる. Insert かよ / とお before the supplied okurigana, not the full words.'),
  pairs('Match each compound to its Japanese definition.', [['通学','学校に通うこと。'],['通院','病院に通うこと。']], '通学（つうがく）is going to school; 通院（つういん）is visiting a hospital regularly. Both definitions use nominalizing こと.'),
  model('Listen and read a street-name example.', '京都には四条通という通りがあります。四条通を歩いてみたいです。','きょうとにはしじょうどおりというとおりがあります。しじょうどおりをあるいてみたいです。','Kyoto has a street called Shijō-dōri. I would like to try walking along it.','通り alone is とおり. In this street name, 四条通 is しじょうどおり, with voiced ど. Proper-name readings are word-specific; this example is not a rule for every street name.'),
  gap('Complete the movement verb and street noun.', 'この道を〔通〕って、四条〔通〕に出ます。','このみちをとおって、しじょうどおりにでます。','I will pass along this road and come out onto Shijō-dōri.', ['近','続'], '道を通る uses を for the route passed through; 四条通に出る uses に for where one comes out. Both physical 通 tokens have distinct IDs and interchangeable accepted mappings.'),
  choice('Listen. What does the speaker want to do?',['Take an exam','Try a pottery experience','Play a match'],1,'京都で陶芸を体験してみたいです。','きょうとでとうげいをたいけんしてみたいです。','I would like to try a pottery experience in Kyoto.','体験 is firsthand experience, 試験 is an exam, and 試合 is a match. 陶芸 is pottery.'),
  model('Listen and read the abbreviation for entrance examinations.', '入学試験は、入試とも言います。来年、大学の入試を受けます。','にゅうがくしけんは、にゅうしともいいます。らいねん、だいがくのにゅうしをうけます。','Entrance examinations are also called nyūshi. I will take university entrance exams next year.','入試（にゅうし）abbreviates 入学試験. Schedules and admission methods vary by institution; this example does not give a universal school calendar.'),
  gap('Choose the abbreviation in this university application context.', '来年、大学の〔入試〕を受けます。','らいねん、だいがくのにゅうしをうけます。','I will take university entrance exams next year.', ['試合','通学'], '入試 is the entrance-exam abbreviation, not a match or commuting to school.'),
  gap('Insert three kanji, including two physical copies of 試.', '〔試〕験で、新しい方法を〔試〕す〔力〕が問われます。','しけんで、あたらしいほうほうをためすちからがとわれます。','The exam tests the ability to try a new method.', ['式','カ'], '試 is し in 試験 and ため in 試す. 力 is ちから alone, but りょく in 努力. Katakana カ looks similar but is not the kanji 力.'),
 ],
};
// Both partner-first and period-first relationship descriptions preserve the same meaning.
content.l01[7].answer.acceptedOrders.push(['t1','t0','t2','t3']);
// Cumulative assessment deliberately reuses the exact reviewed teaching/practice sentences.
content.cp = [
 structuredClone(content.l01[6]),
 order('Build the six-chunk continuing relationship sentence.', ['高校の','ころから、','彼と','付き合い','つづけて','います。'],relationship[1],relationship[2],'のころから marks the starting period. 付き合い is the stem, followed by つづけています.'),
 structuredClone(content.l03[13]),
 { renderer:'choice',prompt:'In the earlier dessert-shop dialogue, which flavor did the customer order?',
   answer:{kind:'choice',options:[{id:'o0',text:'いちご味'},{id:'o1',text:'抹茶味'},{id:'o2',text:'レモン味'}],acceptedOptionIds:['o1']},praise:'Well done!',
   support:{before:[],after:[rule('The customer ordered 抹茶味, matcha flavor. Their later question about いちご味 was about availability.')]},audio:{required:false,text:null},
   sceneContext:{recordId:'B2.C03.L03',contentVersion:'1.0.0',screenId:'B2.C03.L03.A02.S03',factId:'selected-flavor',expectedText:'抹茶味',answerOptionId:'o1',access:'review_before_launch'} },
 structuredClone(content.l04[7]),structuredClone(content.l04[9]),structuredClone(content.l03[8]),structuredClone(content.l03[5]),
 structuredClone(content.l05[3]),structuredClone(content.l05[4]),structuredClone(content.l05[5]),structuredClone(content.l06[19]),
 structuredClone(content.l04[12]),structuredClone(content.l04[17]),structuredClone(content.l04[14]),structuredClone(content.l04[15]),
 structuredClone(content.l02[6]),structuredClone(content.l02[7]),structuredClone(content.l02[8]),structuredClone(content.l06[10]),
];
content.cp[1].answer.acceptedOrders.push(['t2','t0','t1','t3','t4','t5']);

const expected = {l01:8,l02:9,l03:15,l04:18,l05:7,l06:21,cp:20};
fs.mkdirSync(output,{recursive:true});
for (const [key, authored] of Object.entries(content)) {
 const recordId = `B2.C03.${key.toUpperCase()}`, record = records.find(r => r.recordId === recordId);
 if (!record || authored.length !== expected[key]) throw new Error(`Invalid authored count: ${key}`);
 const screens = authored.map((copy,i) => {
  const source = record.screens[i], teaching = ['model','kanji','table','dialogue'].includes(copy.renderer), hidden = source.rawSupport.japanese_transcript_before_answer === false;
  const before = [...copy.support.before];
  if (source.rawSupport.japanese_transcript_before_answer === true && copy.renderer !== 'dialogue' && !before.some(b => b.kind === 'japanese')) before.push(jp(copy.audio.text,copy.audio.reading));
  if (source.rawSupport.translation_visible === true && copy.renderer !== 'dialogue' && !before.some(b => b.kind === 'translation')) {
   const translation = copy.support.after.find(b => b.kind === 'translation');
   if (translation) before.push(translation);
   else if (copy.renderer === 'table') before.push(en(copy.table.rows.map(r => r.cells.at(-1)).join(' ')));
   else if (copy.renderer === 'kanji') before.push(en(`${copy.kanji.meaning}. ${copy.kanji.examples.map(e => e.translation).join(' ')}`));
  }
  const {sceneReuse,...authoredCopy} = copy;
  return {screenId:source.screenId,prompt:null,answer:null,praise:null,...authoredCopy,
   support:{before:hidden ? [] : before,after:copy.support.after},
   audio:{required:teaching || hidden || source.rawMedia.length > 0,text:null,...copy.audio},
   visual:['speaker_model','scene_model'].includes(source.rawRenderer) ? 'video' : source.rawRenderer === 'kanji_model' ? 'image' : 'none',
   sourceContract:{purpose:source.purpose,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,
    responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,
    transcriptBeforeAnswer:source.rawSupport.japanese_transcript_before_answer ?? (copy.renderer === 'model' ? true : null),translationBeforeAnswer:source.rawSupport.translation_visible,
    parallelReadingBeforeAnswer:copy.renderer === 'model',hintBeforeAnswer:false,recordedSupport:source.rawSupport,...occurrences[source.screenId],...(sceneReuse ? {sceneReuse} : {})},evidence:source.evidence,unresolved:[]};
 });
 const pack = {schemaVersion:key === 'l05' ? '1.1' : '1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:screens.length,
  provenance:{origin:'app_authored',note:'Owner-authorized chapter 3 production authoring, 4 October 2026. Canonical IDs, source activity partitions, exercise-number gaps, known response counts, support timing, targets and purpose paraphrases retain local S18/unified evidence. Japanese sentences, readings, translations, banks, mappings, grammar notes, static kanji shape teaching and contextual examples are reviewed authored/adapted content, not source quotations. The five-turn dessert-shop scene has visible Japanese, complete readings/TTS and no English transcript. Its selected-flavor fact is bound to guest-1 and reused by the exact-version delayed checkpoint question. CP context is reviewed separately before launch and has no question transcript or player. L02 one end retry is an explicit app policy for its failed listening occurrence only; base counts and first-attempt accuracy remain separate from retry mastery. L05 optional completion metadata projects its retained tail community endpoint; the original eight rows and raw null metadata remain unchanged. Four-response polite trial suffix reconstruction uses authored でみます after supplied 飲ん, retaining its count without inserting punctuation as a response.'},
  policies:{assessment:'Equal weight per graded required screen. Teaching is ungraded; core completion, raw first-attempt accuracy and checkpoint pass reporting remain separate. Optional private writing never blocks completion.',incorrectResponses:'Final responses and typed Check lock feedback. Wrong pairs permit another match while retaining the screen mistake. The configured L02 listening miss receives one retry after its nine base screens; retry mastery does not replace first-attempt accuracy.',audio:'Existing Japanese TTS supplies complete scripts/readings. Required playback gates and all-turn ordered dialogue playback remain; unsupported listening hides Japanese/English until feedback.',visuals:'Replaceable neutral media slots defer original photos/video/kanji animations. Static glyph shapes, readings, meanings and examples provide complete teaching without invented stroke order.'},
  unresolvedSourceFacts:['Source-identical literal wording, exhaustive accepted variants, randomization and acoustic quality remain unknown; reviewed authoring supplies ordinary literal gaps.','Source rewards, universal retry policies, score threshold boundary and causal unlock enforcement remain unproven; research outcomes never seed app progress.','Recorded recap/replay controls do not establish unobserved recap contents; app correction/audio remains available through shared support.'],screens};
 if (key === 'l02') pack.retryPolicy = {kind:'end_once',screenIds:['B2.C03.L02.A01.S08']};
 if (key === 'cp') pack.passPolicy = {kind:'none'};
 if (key === 'l05') {
  const s=record.screens[7];
  pack.completion={contractVersion:'1.0',requiredScreenIds:screens.map(s=>s.screenId),optionalSurfaces:[{screenId:s.screenId,sourceExerciseNumber:s.sourceExerciseNumber,sourceActivityId:s.sourceActivityId,purpose:s.purpose,
   prompt:'Write about activities you would like to try, with a reason or travel context.',hint:'Use verb て-form + みたいです. For example: 日本の旅館に泊まってみたいです. Add ので for a reason or 行ったら for a travel condition. Write only what you want to share privately in this open view.',modes:['write'],provenance:{origin:'app_authored',note:'Original S08/exercise 9 identity retained as separate private, ungraded writing. No community submission or speaking action. Optional draft is not saved.'}}]};
 }
 fs.writeFileSync(path.join(output,`b2-c03-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');
}
console.log('Assembled all chapter 3 entries: 98 required screens + separate optional writing L05 S08 (99 retained surfaces).');
