// Offline, reviewed production authoring. Source evidence and all released packs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu'), output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-four-occurrences.json'), 'utf8')).screens;
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

const intentionRule = 'Dictionary-form verb + つもりです states an intention: 勝つつもりです. Keep the verb plain before つもり, even when the final copula is polite. This builds on earlier verb classes and intention expressions; it is not a claim of first introduction.';
const negativeRule = 'Negative plain verb + つもりです expresses an intention not to act: 負けないつもりです. 負ける is a RU/ichidan verb: remove る and add ない. This intention is not a guarantee of the eventual result.';
const pastRule = 'Verb + つもりでした describes a past intention, which may differ from the actual result. 勝つつもりでしたが、負けました means I intended to win, but lost. Future 勝つつもりです differs from past 負けました.';
const imperativeRule = 'The imperative is a strong direct command. It occurs in urgent instructions and sports cheering, but can sound rude in ordinary requests. Use てください for a polite request. Relationship and context matter; cheering does not make commands universally polite.';
const nearRule = '惜しい（おしい）reacts to a near miss or something almost achieved. Its past is 惜しかった: remove final い and add かった. 残念（ざんねん）expresses broader regret or disappointment, and need not imply a close miss.';
const regretRule = '残念 is a na-adjective/noun: 残念です → 残念でした. It expresses disappointment about a result or unavailable opportunity. It differs from the close-miss focus of 惜しい, though both can fit some real situations.';
const win = ['明日の試合に勝ちたいです。','あしたのしあいにかちたいです。','I want to win tomorrow’s match.'];
const intent = ['明日の試合に勝つつもりです。','あしたのしあいにかつつもりです。','I intend to win tomorrow’s match.'];
const negative = ['次の試合では、負けないつもりです。','つぎのしあいでは、まけないつもりです。','I intend not to lose the next match.'];
const past = ['勝つつもりでしたが、負けました。','かつつもりでしたが、まけました。','I intended to win, but lost.'];
const future = ['昨日は負けましたが、次は勝つつもりです。','きのうはまけましたが、つぎはかつつもりです。','I lost yesterday, but intend to win next time.'];
const noSport = ['週末は、サッカーをしないつもりです。','しゅうまつは、さっかーをしないつもりです。','I intend not to play football this weekend.'];
const contrast = ['昨日の試合は、惜しかったですが、今日は勝ちました。','きのうのしあいは、おしかったですが、きょうはかちました。','Yesterday’s match was a near miss, but today we won.'];
const support = ['昨日は残念でしたが、これからも応援します。','きのうはざんねんでしたが、これからもおうえんします。','Yesterday was disappointing, but I will keep supporting them.'];
const tickets = ['チケットが売り切れていて、残念でした。','ちけっとがうりきれていて、ざんねんでした。','The tickets were sold out, which was disappointing.'];
const coach = ['最後まで、全力で走れ！','さいごまで、ぜんりょくではしれ！','Run with all your strength until the end!'];
const content = {
 l01: [
  model('Listen and read the verb for winning.',...win,'勝つ（かつ）means win. It is a U/godan verb: 勝ちます and 勝って. 試合に勝つ means win a match.'),
  gap('Complete the four parts of the polite and te forms of 勝つ.', '勝〔ち〕〔ます〕。勝〔っ〕〔て〕。','かちます。かって。','Win (polite); win (te form).',['つ','い','で'],'For a U verb ending in つ, polite つ → ちます; te form つ → って. 勝ちます / 勝って. These are conjugation forms, not two independent match results.'),
  table('Study a dictionary-form intention.', 'Dictionary form + つもりです',['Verb','Intention','Meaning'],[['勝つ','勝つつもりです。','I intend to win.'],['練習する','練習するつもりです。','I intend to practise.']],intent[0],intent[1],intentionRule),
  gap('Choose the intention expression. です is supplied.', '明日の試合に勝つ〔つもり〕です。',intent[1],intent[2],['ため','ながら'],intentionRule),
  gap('Complete the dictionary action and intention expression.', '明日の試合に〔勝つ〕〔つもり〕です。',intent[1],intent[2],['勝ちます','勝って'],intentionRule),
  order('Build the four-chunk intention statement.',['明日の','試合に','勝つ','つもりです。'],intent[1],intent[2],intentionRule),
  model('Listen and read the verb for losing.','昨日の試合に負けました。','きのうのしあいにまけました。','I lost yesterday’s match.','負ける（まける）means lose. It is a RU/ichidan verb: 負けます、負けて、負けない. 試合に負ける means lose a match.'),
  choice('Which is the negative plain form of 負ける?',['負け','負けない','負けます'],1,negative[0],negative[1],negative[2],'負け alone is the stem; 負けます is polite affirmative. The negative plain form is 負けない.'),
  table('Study an intention not to lose.','Negative verb + つもりです',['Verb','Negative intention','Meaning'],[['負ける','負けないつもりです。','I intend not to lose.'],['あきらめる','あきらめないつもりです。','I intend not to give up.']],negative[0],negative[1],negativeRule),
  gap('Complete the negative action and intention expression.','次の試合では、〔負けない〕〔つもり〕です。',negative[1],negative[2],['負ける','負けます'],negativeRule),
  order('Build the five-chunk weekend question.',['週末は、','何を','する','つもり','ですか。'],'しゅうまつは、なにをするつもりですか。','What do you intend to do this weekend?',intentionRule),
  truth('The speaker intends to play football this weekend.',false,...noSport,'しないつもりです is an intention not to do it. The statement reverses that negative intention.'),
  choice('Listen. What does the speaker intend to do this weekend?',['Play football','Clean the house','Watch a football match'],1,'週末はサッカーをしないつもりです。家を掃除するつもりです。','しゅうまつはさっかーをしないつもりです。いえをそうじするつもりです。','I intend not to play football this weekend. I intend to clean the house.','The affirmative plan is 掃除するつもりです, cleaning the house. The football action is explicitly negated.'),
  model('Read an example about sports interests in Japan.','日本では、野球やサッカーを楽しむ人もいます。私は週末に野球の試合を見るつもりです。','にほんでは、やきゅうやさっかーをたのしむひともいます。わたしはしゅうまつにやきゅうのしあいをみるつもりです。','Some people in Japan enjoy baseball or football. I intend to watch a baseball match at the weekend.','Sports interests vary by person and place. This authored example makes no universal popularity ranking. 野球（やきゅう）is baseball; サッカー is football/soccer.'),
  pairs('Match the intention and simultaneous-action clauses to their meanings.',[['試合を見るつもりです。','I intend to watch the match.'],['試合を見ながら、食べます。','I eat while watching the match.']],'つもり describes intention; ます-stem + ながら describes simultaneous actions. They are different relationships between the actions.'),
  choice('Listen. What does the speaker intend to do with the team shirt?',['Throw it away','Keep it','Give it to a friend'],1,'このチームのシャツは大切なので、捨てないつもりです。','このちーむのしゃつはたいせつなので、すてないつもりです。','This team shirt is important to me, so I intend not to throw it away.','捨てないつもり means an intention not to discard it: the speaker will keep the shirt.'),
  gap('Complete the past intention and actual result.','勝つ〔つもりでした〕が、〔負けました〕。',past[1],past[2],['つもりです','勝ちました'],pastRule),
  typed('Type the intention expression after 勝つ. です is supplied.','次の試合に勝つ','です。',['つもり'],'次の試合に勝つつもりです。','つぎのしあいにかつつもりです。','I intend to win the next match.',intentionRule),
  gap('Complete the past loss and future intention.','昨日は〔負けました〕が、次は勝つ〔つもりです〕。',future[1],future[2],['勝ちました','つもりでした'],pastRule),
  order('Build the five-chunk negative sports intention.',['週末は、','サッカーを','しない','つもり','です。'],noSport[1],noSport[2],negativeRule),
 ],
 l02: [
  model('Listen and read about supporting a team.','私はこのチームを応援しています。','わたしはこのちーむをおうえんしています。','I support this team.','応援（おうえん）is support/cheering. 応援する combines the noun with する; 応援しています describes current, ongoing support.'),
  gap('Choose the noun for supporting a team.','私はこのチームを〔応援〕しています。','わたしはこのちーむをおうえんしています。','I support this team.',['運動','試合'],'応援する is cheer for/support. 運動する means exercise; 試合 is a match.'),
  gap('Complete the question about current support for an athlete.','どの選手を〔応援〕〔して〕いますか。','どのせんしゅをおうえんしていますか。','Which athlete do you support?',['運動','する'],'選手（せんしゅ）is a player/athlete. 応援しています uses 応援 + して + supplied います, expressing ongoing support.'),
  model('Listen and read the adjective for weakness.','このチームは、まだ弱いです。','このちーむは、まだよわいです。','This team is still weak.','弱い（よわい）is weak; 強い（つよい）is strong. Here they describe sporting strength, not a person’s kindness.'),
  gap('Choose the strength adjective meaning weak.','このチームは、まだ〔弱い〕です。','このちーむは、まだよわいです。','This team is still weak.',['優しい','強い'],'弱い is よわい. 優しい（やさしい）means kind/gentle, an earlier personality adjective; similar-sounding adjectives are not interchangeable.'),
  gap('Complete the strength contrast explaining the result.','〔強い〕チームが勝って、〔弱い〕チームが負けました。','つよいちーむがかって、よわいちーむがまけました。','The strong team won, and the weak team lost.',['優しい','厳しい'],'強い / 弱い refer to strength in this match. The result belongs to this example, not a rule that a weaker team can never win.'),
  choice('Listen. How has the team changed?',['It used to be strong and is now weak','It used to be weak and is now strong','Its strength has not changed'],1,'このチームは昔は弱かったですが、今は強いです。','このちーむはむかしはよわかったですが、いまはつよいです。','This team used to be weak, but is strong now.','昔は弱かった is past weakness; 今は強い is present strength. Listen to the time markers and adjective past ending.'),
  model('Listen and read a reaction to a near miss.','惜しい！もう少しでゴールでした。','おしい！もうすこしでごーるでした。','So close! It was almost a goal.',nearRule),
  choice('A shot misses the goal by a few centimetres. Choose the reaction that specifically highlights the near miss.',['やった！','惜しい！','お疲れさまでした。'],1,'惜しい！もう少しでゴールでした。','おしい！もうすこしでごーるでした。','So close! It was almost a goal.',nearRule),
  gap('Complete the past near-miss adjective in two parts.','昨日の試合は、〔惜し〕〔かった〕です。','きのうのしあいは、おしかったです。','Yesterday’s match was a near miss.',['惜しい','でした'],nearRule),
  model('Listen and read a disappointment reaction.','試合に負けて、残念です。','しあいにまけて、ざんねんです。','It is disappointing that we lost the match.',regretRule),
  gap('The match was cancelled before it began. Choose the disappointment reaction.','試合が中止になって、〔残念〕です。','しあいがちゅうしになって、ざんねんです。','It is disappointing that the match was cancelled.',['惜しい','やった'],'中止（ちゅうし）means cancellation. 残念 fits the lost opportunity; 惜しい focuses on almost achieving something, which this context does not state.'),
  table('Study the wider range of 残念.','Disappointment beyond near misses',['Context','Example','Meaning'],[['Lost match','負けて、残念です。','Losing is disappointing.'],['Unavailable ticket','チケットがなくて、残念です。','It is disappointing that there are no tickets.']], '負けて、残念です。チケットがなくて、残念です。','まけて、ざんねんです。ちけっとがなくて、ざんねんです。',regretRule),
  gap('Complete the disappointment word and past copula for sold-out tickets.','チケットが売り切れていて、〔残念〕〔でした〕。',tickets[1],tickets[2],['惜しい','です'],regretRule),
  model('Listen and read a casual celebration.','やった！応援しているチームが勝ちました。','やった！おうえんしているちーむがかちました。','Hooray! The team I support won.','やった！is a casual exclamation of joy or success in this context. It is also the past plain form of やる in other contexts; do not translate every やった as “Hooray!”.'),
  choice('Your team has just won. Choose the joyful celebration.',['残念です。','やった！','惜しい！'],1,'やった！勝ちました！','やった！かちました！','Hooray! We won!','The victory makes やった！the celebration here. 惜しい describes a near miss; 残念 describes disappointment.'),
  choice('Listen. What was the result for the speaker’s team?',['It lost','It won','It drew'],1,'私のチームは二対一で勝ちました。','わたしのちーむはにたいいちでかちました。','My team won two to one.','勝ちました is the completed winning result. 二対一（にたいいち）is two to one.'),
  order('Build the five-chunk evaluative contrast.',['昨日の試合は、','惜しかった','ですが、','今日は','勝ちました。'],contrast[1],contrast[2],nearRule),
  gap('Complete the past disappointment and continued support.','昨日は〔残念でした〕が、これからも〔応援します〕。',support[1],support[2],['残念です','応援しました'],'残念でした places the disappointment in the past. これからも応援します states continuing support from now on, despite that result.'),
 ],
 l03: [
  model('Listen and read a strong go command.','行け！','いけ！','Go!',imperativeRule),
  table('Compare an urgent command with a polite request before practising.','Command register',['Situation','Example','Meaning'],[['Direct urgent instruction / sports command','行け！','Go! (strong command)'],['Ordinary polite request','行ってください。','Please go.']], '行け！行ってください。','いけ！いってください。',imperativeRule),
  pairs('Match the request and command to their register.',[['行ってください。','Please go. (polite request)'],['行け！','Go! (strong direct command)']],imperativeRule),
  table('Study U/godan verb imperatives.','Final u sound → e sound',['Dictionary','Command','Reading'],[['行く','行け','いけ'],['走る','走れ','はしれ'],['頑張る','頑張れ','がんばれ']], '行け。走れ。頑張れ。','いけ。はしれ。がんばれ。','U/godan verbs change the final u-row kana to the e row: く→け、る→れ. 走る and 頑張る are U verbs despite ending in る. '+imperativeRule),
  gap('The coach gives a strong run command. Insert the ending after 走.','走〔れ〕！','はしれ！','Run!',['る','って'],'走る is a U/godan verb: る → れ, giving 走れ（はしれ）. 走って is the te form, not this imperative.'),
  gap('Choose the strong cheering form, rather than the te form.','頑張〔れ〕！','がんばれ！','Give it your best!',['って','る'],'頑張る → 頑張れ（がんばれ）. 頑張って is a common, gentler encouragement using the te form, but this task asks for the imperative.'),
  table('Study RU/ichidan verb imperatives.','Remove る; add ろ',['Dictionary','Command','Meaning'],[['止める','止めろ','Stop it!'],['見る','見ろ','Look!']], '時計を止めろ。よく見ろ。','とけいをとめろ。よくみろ。','RU/ichidan verbs replace final る with ろ: 止める→止めろ. Do not apply this to U verbs such as 走る. '+imperativeRule),
  gap('Give the strong command to stop the clock. Insert the ending after 止め.','時計を止め〔ろ〕！','とけいをとめろ！','Stop the clock!',['る','れ'],'止める is a transitive RU verb: 止めろ. 止まる is an intransitive U verb: 止まれ. The supplied object 時計を selects 止める here.'),
  choice('Listen. What is the command asking the player to do?',['Give it their best','Stop the clock','Come here'],0,'最後まで頑張れ！','さいごまでがんばれ！','Give it your best until the end!','頑張れ is the strong imperative of 頑張る. It urges effort rather than stopping or coming.'),
  table('Study the two irregular imperatives.','する and 来る',['Dictionary','Command','Reading'],[['する','しろ','しろ'],['来る','来い','こい']], '練習しろ。ここに来い。','れんしゅうしろ。ここにこい。','する→しろ; 来る（くる）→来い（こい）. 来 has different readings in 来ます（きます）and 来ない（こない）. These commands are strong; use polite requests where appropriate.'),
  gap('Choose the imperative of する in the coach’s command.','毎日、練習〔しろ〕！','まいにち、れんしゅうしろ！','Practise every day!',['する','して'],'練習する → 練習しろ. する is dictionary form; して is te form. せよ is another imperative used in more formal/written contexts, but is not a choice in this task.'),
  choice('How is 来い read?',['きい','くい','こい'],2,'ここに来い！','ここにこい！','Come here!','来い is こい, not きい or くい. Romanized koi describes this reading; it does not establish universal romaji answer acceptance.'),
  gap('Form the strong imperative of 飛ぶ. Insert the ending after 飛.','空を飛〔べ〕！','そらをとべ！','Fly through the sky!',['ぶ','んで'],'飛ぶ（とぶ）is a U verb: ぶ→べ, giving 飛べ（とべ）. 飛んで is its te form.'),
  choice('Choose the strong imperative of 押す（おす）, to push.',['押して','押せ','押す'],1,'このボタンを押せ！','このぼたんをおせ！','Push this button!','押す→押せ（おせ）changes す→せ. 押して is the te form; 押す is dictionary form.'),
  choice('A boxer has fallen. Choose the coach’s strong command to stand up.',['立て！','座れ！','寝ろ！'],0,'立て！まだ終わっていない！','たて！まだおわっていない！','Stand up! It is not over yet!','立つ（たつ）→立て（たて）is a U-verb imperative. 座れ means sit; 寝ろ means sleep/lie down.'),
  gap('Complete the strong cheering imperative after 頑張.','最後まで頑張〔れ〕！','さいごまでがんばれ！','Give it your best until the end!',['る','って'],'頑張れ is the imperative. 頑張って is also natural encouragement but is the te form, so it does not answer this form-specific instruction.'),
  order('Build the coach’s three-chunk command.',['最後まで、','全力で','走れ！'],coach[1],coach[2],imperativeRule),
  typed('Type the imperative of 行く in Japanese, then select Check.','', '！',['行け','いけ'],'行け！','いけ！','Go!','This occurrence accepts 行け and いけ explicitly. Romanized ike may explain the reading but is not accepted by this Japanese-script task. No automatic kana/romaji conversion applies. '+imperativeRule),
 ],
};
content.l04 = [
 kmodel('勝','Notice 月 on the left and 力 in the lower right. Compare the full right-hand shape with 脳 and the left component of 藤. This is a visual aid, not etymology or stroke-order instruction.','win; victory',[['か-つ','Kun reading in 勝つ'],['しょう','On reading in 勝利 and 優勝']], [['勝つ','かつ','win','試合に勝ちました。','しあいにかちました。','We won the match.'],['勝利','しょうり','victory','勝利を喜びました。','しょうりをよろこびました。','We celebrated the victory.'],['優勝','ゆうしょう','championship victory','大会で優勝しました。','たいかいでゆうしょうしました。','We won the tournament.']]),
 choice('Choose the kanji in かつ, to win.',['勝つ','脳つ','藤つ'],0,'試合に勝ちます。','しあいにかちます。','We will win the match.','勝 has 月 and a right-hand shape ending in 力. 脳 and 藤 are different characters; they do not spell 勝つ.'),
 kmodel('負','Notice the small top component and 貝 below it. Compare 貝 here with the lower shape of 角. This is shape comparison, not historical derivation.','lose; bear a burden',[['ま-ける','Kun reading in 負ける'],['お-う','Kun reading in 負う'],['ふ','On reading in 負担; voiced ぶ in 勝負']], [['負ける','まける','lose','試合に負けました。','しあいにまけました。','We lost the match.'],['負担','ふたん','burden','負担が大きいです。','ふたんがおおきいです。','The burden is heavy.'],['勝負','しょうぶ','contest; victory or defeat','次の勝負が楽しみです。','つぎのしょうぶがたのしみです。','I look forward to the next contest.'],['負う','おう','bear','責任を負います。','せきにんをおいます。','I will bear responsibility.']]),
 choice('Choose the kanji in まける, to lose.',['貝ける','角ける','負ける'],2,'試合に負けました。','しあいにまけました。','We lost the match.','負ける uses 負 with 貝 below its top component. Its reading is まける; ぶ belongs to a word such as 勝負（しょうぶ）, not 負ける.'),
 kmodel('点','Notice 占 above four lower dots 灬. Compare this with 店, which contains 广 around 占.','point; score; mark',[['てん','On reading in 点 and 得点']], [['点','てん','point','一点取りました。','いってんとりました。','We scored one point.'],['得点','とくてん','score; scoring','得点が増えました。','とくてんがふえました。','The score increased.'],['点数','てんすう','score; number of points','点数を確認します。','てんすうをかくにんします。','I will check the score.']]),
 gap('Choose the character for a score point, not a shop.','三〔点〕取りました。','さんてんとりました。','We scored three points.',['店','占'],'点 is a point; 店 is a shop. Both can be read てん in compounds, but the shapes and meanings differ.'),
 gap('Insert four kanji for winning, losing and the two scores.','三〔点〕取って〔勝〕ちましたが、相手は一〔点〕で〔負〕けました。','さんてんとってかちましたが、あいてはいってんでまけました。','We scored three points and won, while our opponents lost with one point.',['店','貝'],'点 is てん: 三点（さんてん）, 一点（いってん）. 勝ちました is かちました; 負けました is まけました. The on readings しょう / ふ do not replace the kun readings of these inflected verbs. Two identical 点 tokens have separate physical IDs.'),
 kmodel('位','Notice 亻 on the left and 立 on the right. Compare the left side with the 木 in 植.','rank; position',[['い','On reading in 一位, 学位 and 方位'],['くらい','Kun reading meaning rank/position']], [['一位','いちい','first place','一位になりました。','いちいになりました。','We came first.'],['学位','がくい','academic degree','大学で学位を取りました。','だいがくでがくいをとりました。','I earned a degree at university.'],['方位','ほうい','direction; compass bearing','方位を確認します。','ほういをかくにんします。','I will check the direction.']]),
 choice('Choose the spelling of first place: いちい.',['一立','一位','一住'],1,'一位になりました。','いちいになりました。','We came first.','一位 uses 位（い）with 亻 + 立. 一位 is read いちい, with no invented doubled consonant.'),
 kmodel('球','Notice 王 on the left and 求 on the right. Compare the left component with the 扌 in a hand-related character.','ball; sphere',[['きゅう','On reading in 野球, 電球 and 地球'],['たま','Kun reading for a ball/sphere']], [['野球','やきゅう','baseball','野球をします。','やきゅうをします。','I play baseball.'],['電球','でんきゅう','light bulb','電球を替えます。','でんきゅうをかえます。','I will replace the light bulb.'],['地球','ちきゅう','Earth','地球は丸いです。','ちきゅうはまるいです。','The Earth is round.']]),
 gap('Complete the baseball word with the ball character.','週末に野〔球〕をします。','しゅうまつにやきゅうをします。','I play baseball at the weekend.',['求','玉'],'野球（やきゅう）uses 球: 王 on the left plus 求 on the right. 求 alone lacks the left component; 玉 is a different character.'),
 gap('Reconstruct five characters in the sports, rank and victory compounds.','〔野〕〔球〕の大会で〔一〕〔位〕になり、優〔勝〕しました。','やきゅうのたいかいでいちいになり、ゆうしょうしました。','We came first in the baseball tournament and won the championship.',['店','立'],'野球 is やきゅう; 一位 is いちい; 優勝 is ゆうしょう. These are five character placements, not five sentence chunks.'),
 pairs('Match each win-related word to its reading and meaning.',[['勝利','しょうり · victory'],['優勝','ゆうしょう · championship victory'],['勝負','しょうぶ · contest; victory or defeat']],'勝 uses しょう in these compounds. 負 is voiced ぶ in 勝負（しょうぶ）; compare unvoiced ふ in 負担（ふたん）. Readings belong to the whole word.'),
 choice('Listen. Which achievement does the speaker describe?',['Winning the championship','Losing a match','Earning a university degree'],0,'私たちのチームは大会で優勝しました。','わたしたちのちーむはたいかいでゆうしょうしました。','Our team won the tournament.','優勝（ゆうしょう）means winning the tournament/championship, not merely being ahead during a match.'),
 gap('Use 点 in attention points and braille.','注意〔点〕を〔点〕字で書きます。','ちゅういてんをてんじでかきます。','I will write the points to note in braille.',['店','位'],'注意点（ちゅういてん）is a point to note; 点字（てんじ）is braille. Both use 点, with separate physical tokens here.'),
 gap('Complete the ahead/behind contrast in the ongoing match.','今は三対一で〔勝って〕いますが、前半は〔負けて〕いました。','いまはさんたいいちでかっていますが、ぜんはんはまけていました。','We are ahead three to one now, but were behind in the first half.',['勝つ','負ける'],'During an unfinished match, 勝っている can mean be ahead/winning and 負けている be behind/losing. These describe the state at the stated time, not a completed final result.'),
 choice('Listen. What did the speaker earn at university?',['A light bulb','An academic degree','First place in baseball'],1,'大学で学位を取りました。','だいがくでがくいをとりました。','I earned a degree at university.','学位（がくい）is an academic degree. 位 has the reading い in this word, as in 一位 and 方位.'),
 gap('Complete the direction word and the missing item in the four-direction list.','〔方位〕には、東、西、南、〔北〕などがあります。','ほういには、ひがし、にし、みなみ、きたなどがあります。','Directions include east, west, south and north.',['学位','点'],'方位（ほうい）is direction/compass bearing. 東（ひがし）, 西（にし）, 南（みなみ）, 北（きた）name the four directions in this list.'),
 choice('Which compound means light bulb?',['電球','野球','地球'],0,'電球を替えます。','でんきゅうをかえます。','I will replace the light bulb.','電球（でんきゅう）is a light bulb; 野球（やきゅう）is baseball; 地球（ちきゅう）is Earth. 球 has きゅう in all three words.'),
 gap('Complete the Earth and hemisphere compounds.','〔地球〕の北半球と南〔半球〕について勉強します。','ちきゅうのきたはんきゅうとみなみはんきゅうについてべんきょうします。','I will study the Earth’s Northern and Southern Hemispheres.',['野球','電球'],'地球（ちきゅう）is Earth; 半球（はんきゅう）is hemisphere. 北半球 is きたはんきゅう and 南半球 is みなみはんきゅう.'),
 gap('Complete the positive and negative evaluation points.','この計画の〔良い点〕と〔悪い点〕を考えます。','このけいかくのよいてんとわるいてんをかんがえます。','I will consider this plan’s good and bad points.',['良い店','悪い店'],'良い点（よいてん）and 悪い点（わるいてん）are positive and negative aspects. 点 describes an evaluation point here; 店 would describe a shop.'),
];

const gameSceneId = 'B2.C04.L05.A01.S03', footballSceneId = 'B2.C04.L05.A02.S01';
const scene = (prompt, context, labels, turns, facts) => ({renderer:'dialogue',prompt,support:{before:[],after:[]},audio:{required:true,text:null},
 dialogue:{context,speakerLabels:labels,japaneseVisible:true,translationVisible:false,speakers:['guest','staff'],turns:turns.map(([id,speaker,japanese,reading])=>({id,speaker,japanese,reading,english:null})),facts}});
const replay = (copy, sceneReuse) => ({...copy,sceneReuse});
const losing = ['今は零対一で負けています。','いまはれいたいいちでまけています。','We are currently losing zero to one.'];
const window = ['ゲームで遊んでいるうちに、プログラミングに興味を持ちました。','げーむであそんでいるうちに、ぷろぐらみんぐにきょうみをもちました。','While playing games, I became interested in programming.'];
content.l05 = [
 gap('Choose the ongoing time window, rather than a deadline.','ゲームで遊んでいる〔うちに〕、プログラミングに興味を持ちました。',window[1],window[2],['までに','つもり'],'ているうちに means while the action continues. までに marks a deadline; it does not express developing interest during this activity.'),
 pairs('Match continuation, intention and trial to their meanings.',[['ゲームで遊び続けています。','I keep playing games.'],['ゲームを作るつもりです。','I intend to make a game.'],['ゲームを作ってみます。','I will try making a game.']],'Verb stem + 続ける is continuation; dictionary form + つもり is intention; te form + みる is a trial.'),
 scene('Listen to Aki and Ren talking about games. Follow the Japanese dialogue.','friends talking about games and programming',{guest:'Aki',staff:'Ren'},[
  ['ren-1','staff','このゲーム、面白いね。子供のころから遊び続けているの？','このげーむ、おもしろいね。こどものころからあそびつづけているの？'],
  ['aki-1','guest','うん。ゲームで遊んでいるうちに、プログラミングに興味を持ったんだ。','うん。げーむであそんでいるうちに、ぷろぐらみんぐにきょうみをもったんだ。'],
  ['ren-2','staff','今もプログラミングを勉強しているの？','いまもぷろぐらみんぐをべんきょうしているの？'],
  ['aki-2','guest','うん。毎日、勉強し続けているよ。来年、自分でゲームを作るつもりだよ。','うん。まいにち、べんきょうしつづけているよ。らいねん、じぶんでげーむをつくるつもりだよ。'],
  ['ren-3','staff','私も、小さなゲームを自分で作ってみたいな。','わたしも、ちいさなげーむをじぶんでつくってみたいな。'],
  ['aki-3','guest','じゃあ、今度一緒に作ってみよう。','じゃあ、こんどいっしょにつくってみよう。'],
 ],[{id:'interest-window',turnId:'aki-1',text:'ゲームで遊んでいるうちに'},{id:'continuation',turnId:'aki-2',text:'勉強し続けている'},{id:'intention',turnId:'aki-2',text:'来年、自分でゲームを作るつもり'},{id:'trial-desire',turnId:'ren-3',text:'小さなゲームを自分で作ってみたい'}]),
 replay(choice('According to Aki’s story, when did the interest in programming develop?',['While playing games','Before ever playing a game','Only after earning a degree'],0,...window,'Aki says ゲームで遊んでいるうちに: the interest developed during playing, not before the first game or after a degree.'),gameSceneId),
 replay(gap('Complete the window and gaining-interest expression from Aki’s story.','ゲームで遊んでいる〔うちに〕、プログラミングに〔興味〕を持ちました。',window[1],window[2],['までに','試合'],'うちに describes the ongoing window; 興味を持つ（きょうみをもつ）is develop/have an interest. The polite past reformulates Aki’s 持ったんだ.'),gameSceneId),
 replay(gap('Complete Aki’s continuing study action.','毎日、プログラミングを〔勉強し〕〔続けて〕います。','まいにち、ぷろぐらみんぐをべんきょうしつづけています。','I keep studying programming every day.',['勉強する','始め'],'勉強する has the stem 勉強し. Add 続けています for ongoing continuation; supplied います stays outside the gaps.'),gameSceneId),
 replay(truth('Aki intends to make a game next year.',true,'来年、自分でゲームを作るつもりです。','らいねん、じぶんでげーむをつくるつもりです。','I intend to make a game myself next year.','Aki explicitly says 来年、自分でゲームを作るつもりだよ. The supported statement uses the polite です form of the same intention.'),gameSceneId),
 order('Build Ren’s trial desire in seven chunks using a polite ending.',['私も、','小さな','ゲームを','自分で','作って','みたい','です。'],'わたしも、ちいさなげーむをじぶんでつくってみたいです。','I would also like to try making a small game myself.','作ってみたい expresses a desire to try making. Ren’s casual な ending is reformulated as polite です; this is a desire, not completed production.'),
 scene('Listen to Kai and Mei playing a multiplayer football video game. Follow the Japanese dialogue.','friends playing a multiplayer football video game',{guest:'Kai',staff:'Mei'},[
  ['mei-1','staff','次の試合、健も来る？','つぎのしあい、けんもくる？'],
  ['kai-1','guest','うん。「すぐ来ます」って言っていたよ。健、早く来い！','うん。「すぐきます」っていっていたよ。けん、はやくこい！'],
  ['mei-2','staff','来たよ！じゃあ、始めよう。','きたよ！じゃあ、はじめよう。'],
  ['kai-2','guest','よし、走れ！そのまま、シュート！','よし、はしれ！そのまま、しゅーと！'],
  ['mei-3','staff','惜しい！もう少しでゴールだったのに。','おしい！もうすこしでごーるだったのに。'],
  ['kai-3','guest','相手に点を取られた。今は零対一で負けているね。','あいてにてんをとられた。いまはれいたいいちでまけているね。'],
  ['mei-4','staff','やった！点を取った！一対一だ！','やった！てんをとった！いちたいいちだ！'],
  ['kai-4','guest','あ、相手がまた点を取った。試合終了だ。負けちゃったね。','あ、あいてがまたてんをとった。しあいしゅうりょうだ。まけちゃったね。'],
  ['mei-5','staff','残念。でも、いい試合だったね。','ざんねん。でも、いいしあいだったね。'],
 ],[{id:'come-commands',turnId:'kai-1',text:'健、早く来い'},{id:'run-command',turnId:'kai-2',text:'走れ'},{id:'near-miss',turnId:'mei-3',text:'もう少しでゴール'},{id:'equalizer',turnId:'mei-4',text:'一対一'},{id:'regret',turnId:'mei-5',text:'残念'}]),
 replay(pairs('Match the 来る forms in the football scene to their readings.',[['来る','くる'],['来ます','きます'],['来い','こい']],'来る is くる; 来ます is きます; 来い is こい. 健 is read けん for this authored character; the name does not establish every name’s reading.'),footballSceneId),
 replay(choice('Which word did Kai use as the strong command to run?',['走れ','走る','走って'],0,'走れ！','はしれ！','Run!','Kai says 走れ during play. 走る is dictionary form; 走って is te form.'),footballSceneId),
 replay({renderer:'multi_choice',prompt:'Select the two imperative words heard in the football scene, then select Check.',
  answer:{kind:'multi_choice',requiredCount:2,grading:'exact_set',options:[{id:'o0',text:'走れ'},{id:'o1',text:'来ます'},{id:'o2',text:'来い'},{id:'o3',text:'走る'}],acceptedOptionIds:['o0','o2']},praise:'Well done!',
  support:{before:[],after:fb('走れ！来い！','はしれ！こい！','Run! Come here!','走れ and 来い are the two imperative words. 来ます is polite nonpast; 走る is dictionary form. The app grades the exact submitted set as one screen, with no partial credit.')},
  audio:{text:'走れ！来い！',reading:'はしれ！こい！',feedbackText:'走れ！来い！'}},footballSceneId),
 replay(choice('When did Mei say 惜しい in the football scene?',['When the shot almost scored','When the team equalized','After the final loss'],0,'惜しい！もう少しでゴールだったのに。','おしい！もうすこしでごーるだったのに。','So close! It was almost a goal.',nearRule),footballSceneId),
 replay(choice('What prompted Mei’s final 残念 in the football scene?',['The match ended in a loss','The team scored the equalizer','Ken said he would come'],0,'残念。でも、いい試合だったね。','ざんねん。でも、いいしあいだったね。','That is disappointing. But it was a good match.','Mei says 残念 after the opponent’s final goal and 試合終了. The earlier missed shot prompted 惜しい; their own equalizer prompted やった.'),footballSceneId),
 replay(gap('Complete Mei’s celebration and scoring reaction.','〔やった〕！〔点〕を取った！一対一だ！','やった！てんをとった！いちたいいちだ！','Hooray! We scored! It is one to one!',['残念','店'],'やった celebrates scoring; 点を取る means score a point. This equalizer makes the score one to one before the later final loss.'),footballSceneId),
 choice('Listen to this separate clip. What is the current state?',['The team is losing','The team has already won','The score is tied'],0,...losing,'負けています describes the current losing state in an unfinished match. It differs from the completed result 負けました. This separate clip has no scene replay before answering.'),
];
// Explicit equivalent adverb placement, without changing physical chunk/character counts.
content.l01[10].answer.acceptedOrders.push(['t1','t0','t2','t3','t4']);
content.l01[19].answer.acceptedOrders.push(['t1','t0','t2','t3','t4']);
content.l03[16].answer.acceptedOrders.push(['t1','t0','t2']);
content.l05[7].answer.acceptedOrders.push(['t0','t3','t1','t2','t4','t5','t6']);
content.l05[9].audio = {text:'来る。来ます。来い。',reading:'くる。きます。こい。'};
content.l03[3].support.before.push(en('Go! Run! Give it your best! U verbs change the final u-row sound to the e row.'));
content.l03[9].support.before.push(en('Practise! Come here! The irregular commands are しろ and 来い（こい）.'));
content.cp = [
 structuredClone(content.l04[20]),structuredClone(content.l03[17]),structuredClone(content.l03[16]),structuredClone(content.l05[15]),
 structuredClone(content.l01[19]),structuredClone(content.l01[17]),structuredClone(content.l01[16]),structuredClone(content.l01[11]),
 structuredClone(content.l01[18]),structuredClone(content.l01[9]),structuredClone(content.l05[0]),structuredClone(content.l04[11]),
 structuredClone(content.l02[9]),structuredClone(content.l03[10]),structuredClone(content.l03[11]),structuredClone(content.l02[15]),
 structuredClone(content.l02[16]),structuredClone(content.l02[17]),structuredClone(content.l02[18]),structuredClone(content.l02[13]),
];

const expected = {l01:20,l02:19,l03:18,l04:21,l05:16,cp:20};
fs.mkdirSync(output,{recursive:true});
for (const [key, authored] of Object.entries(content)) {
 const recordId = `B2.C04.${key.toUpperCase()}`, record = records.find(r => r.recordId === recordId);
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
   visual:['lexical_model','scene_video'].includes(source.rawRenderer) ? 'video' : source.rawRenderer === 'kanji_model' ? 'image' : 'none',
   sourceContract:{purpose:source.purpose,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,
    responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,
    transcriptBeforeAnswer:source.rawSupport.japanese_transcript_before_answer ?? (copy.renderer === 'model' ? true : null),translationBeforeAnswer:source.rawSupport.translation_visible,
    parallelReadingBeforeAnswer:copy.renderer === 'model',hintBeforeAnswer:false,recordedSupport:source.rawSupport,...occurrences[source.screenId],...(sceneReuse ? {sceneReuse} : {})},evidence:source.evidence,unresolved:[]};
 });
 const pack = {schemaVersion:'1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:screens.length,
  provenance:{origin:'app_authored',note:'Owner-authorized chapter 4 production authoring, 5 October 2026. Structural order, canonical/source identities, known response counts, recorded support, occurrence targets and dependencies retain unified S29/S32 evidence. Japanese wording, readings, translations, banks, mappings, contextual examples and static kanji teaching are reviewed authoring/adaptation from retained targets, not source quotations. Both full Japanese-only game dialogues are authored replacements; no observed turn count is claimed. Comprehension/replay references bind to the appropriate earlier scene. A02 S08 is a separate transcript-free losing-state clip. 負 uses reviewed kun まける/おう and on ふ with word-specific voiced ぶ in 勝負; source notation is not copied as a universal reading. Four-response verb conversion and five-character compound reconstruction preserve physical counts. Typed go tasks explicitly accept 行け/いけ; romanized ike is instructional reading evidence only. Two selected imperatives grade as one exact-set screen with no partial credit. Only the two documented misses receive a single retry at the end of their first internal activity. No production endpoint or speaking action is introduced.'},
  policies:{assessment:'Equal weight per graded screen; exact-set multi-selection has no partial credit. Core completion, immutable first-attempt accuracy, separate retry mastery and checkpoint pass reporting remain distinct.',incorrectResponses:'Final choices/token placement and explicit Check lock feedback; wrong pairs permit correction but retain first-attempt mistakes. Only configured wrong occurrences retry once after their activity. Completing the retry, even incorrectly, permits continuation.',audio:'Existing Japanese TTS replaces unavailable audio/video. Required playback and ordered all-turn dialogue gates apply. Transcript-free clips hide source and translation until feedback; scene replay exists only where configured.',visuals:'Original media and animations are deferred. Complete static glyph shape/readings/examples and replaceable media slots retain teaching. No invented stroke-order or etymology claims.'},
  unresolvedSourceFacts:['Source-identical literal wording, exhaustive accepted variants, randomization, acoustic alignment and original media remain unavailable; authorized authoring supplies complete production copy.','Source rewards, scoring formula, exactly-80 pass boundary and causal unlock enforcement remain unresolved. No research results seed learner progress.','Source recap drawer contents and universal retry behavior were not observed; explicit scene replay and occurrence-only boundary policies are app configurations.'],screens};
 if (key === 'l01') pack.retryPolicy = {kind:'after_activity_once',screenIds:['B2.C04.L01.A01.S02']};
 if (key === 'l03') pack.retryPolicy = {kind:'after_activity_once',screenIds:['B2.C04.L03.A01.S09']};
 if (key === 'cp') pack.passPolicy = {kind:'none'};
 fs.writeFileSync(path.join(output,`b2-c04-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');
}
console.log('Assembled all six chapter 4 entries: 114 required screens, no production endpoint.');

