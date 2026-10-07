// Reviewed offline copy for the assigned observed C10 L05/L09/CP occurrences.
import { jp, en, rule, gap, choice, truth, order, typed, table, pairs, multi, kmodel, writePack } from './busuu-chapter-ten-authoring.mjs';

const teachingTable = (prompt, caption, columns, rows, text, reading, english, reason) => {
  const s = table(prompt, caption, columns, rows, text, reading, reason);
  s.support.before.unshift(jp(text, reading), en(english)); return s;
};
const repair = '直す（なおす）describes someone repairing or putting something right: 時計を直す. 直る（なおる）describes the resulting change or state: 時計が直る. ネクタイを直す means to straighten a tie; 化粧を直す means to touch up makeup.';
const redo = 'Attach 直す（なおす）to the ます stem to do something again or redo it: 書きます → 書き直す, 読みます → 読み直す, 考えます → 考え直す. 書き始める starts writing; 書き終わる finishes writing. 書き直させる makes or lets someone rewrite, depending on context.';
const words = '疲れる is つかれる, with つか as the reading of 疲 and れる supplied. 別れる is わかれる; 別人 is べつじん, with 人 read じん in this compound. Learn readings in the complete word.';

const l05 = [
  kmodel('遊', 'Notice 辶 around the lower left of the inner shape, with 子 at the lower right. Compare the complete shape with other characters containing 辶.', 'play; amusement',
    [['あそ', 'The character reading in 遊ぶ（あそぶ）; ぶ is supplied okurigana.'], ['ユウ', 'Compound reading in 遊園地（ゆうえんち）.']],
    [['遊ぶ', 'あそぶ', 'to play', '公園で遊びます。', 'こうえんで あそびます。', 'I play in the park.'],
      ['遊園地', 'ゆうえんち', 'amusement park', '日曜日に遊園地へ行きます。', 'にちようびに ゆうえんちへ いきます。', 'I will go to the amusement park on Sunday.']]),
  gap('Choose the character in あそぶ (to play).', '公園で〔遊〕びます。', 'こうえんで あそびます。', 'I play in the park.', ['遠'],
    '遊ぶ is あそぶ. 遊 and 遠 both contain 辶, but their inner shapes differ. The 子 shape near the lower right helps recognise 遊; this is a visual memory cue.'),
  kmodel('疲', 'Notice the illness-related outer component 疒 and 皮 inside. Compare the inner shape with 病 and 痛.', 'tiredness; become tired',
    [['つか', 'The character reading in 疲れる（つかれる）; れる is supplied.']],
    [['疲れる', 'つかれる', 'to become tired', '長く歩いたので、疲れました。', 'ながく あるいたので、つかれました。', 'I got tired because I walked for a long time.']]),
  choice('Listen. Choose the character in つかれる (to become tired).', ['病', '疲', '痛'], 1, '今日は疲れました。', 'きょうは つかれました。', 'I got tired today.',
    '疲れる uses 疲, which contains 皮 inside 疒. 病 is associated with illness and 痛 with pain; sharing an outer component does not make their meanings or readings interchangeable.'),
  gap('Listen. Insert the two characters in the request for permission.', 'まだ〔疲〕れていないので、もう少し〔遊〕ばせてください。',
    'まだ つかれていないので、もうすこし あそばせてください。', 'I am not tired yet, so please let me play a little longer.', [],
    '疲れる is つかれる; 遊ぶ is あそぶ. 遊ぶ → 遊ばせる, and 遊ばせてください asks permission to play. The endings れて and ばせて are supplied.'),
  kmodel('吸', 'Notice 口 on the left and 及 on the right. Compare 口 with the different left-hand components in other characters.', 'inhale; suck in; absorb',
    [['す', 'The character reading in 吸う（すう）; う is supplied.'], ['キュウ', 'Compound reading in 呼吸（こきゅう）.']],
    [['吸う', 'すう', 'to inhale; to smoke', '深く息を吸います。', 'ふかく いきを すいます。', 'I take a deep breath.'],
      ['呼吸', 'こきゅう', 'breathing', 'ゆっくり呼吸してください。', 'ゆっくり こきゅうしてください。', 'Please breathe slowly.']]),
  gap('Choose the character with 口 in すう (to inhale).', '息を〔吸〕います。', 'いきを すいます。', 'I breathe in.', ['扱'],
    '吸 contains the mouth component 口 and is read す in 吸う. 扱 has 扌 instead and is a different character. Recognising the left component helps distinguish them.'),
  kmodel('別', 'Notice the right-hand sword component 刂 and the shapes on the left. Compare the whole character with other kanji containing 刂.', 'separate; different',
    [['わか', 'The character reading in 別れる（わかれる）; れる is supplied.'], ['ベツ', 'Compound reading in 別人（べつじん）and 特別（とくべつ）.']],
    [['別れる', 'わかれる', 'to part; to break up', '駅で友達と別れました。', 'えきで ともだちと わかれました。', 'I parted from my friend at the station.'],
      ['別人', 'べつじん', 'a different person', '写真の人は別人です。', 'しゃしんの ひとは べつじんです。', 'The person in the photograph is someone else.'],
      ['特別', 'とくべつ', 'special', '今日は特別な日です。', 'きょうは とくべつな ひです。', 'Today is a special day.']]),
  choice('Listen. Choose the character in わかれる (to part).', ['利', '別', '例'], 1, '駅で友達と別れました。', 'えきで ともだちと わかれました。', 'I parted from my friend at the station.',
    '別れる is わかれる. 別 contains 刂 on the right. 利 and 例 also contain 刂 but have different left-hand shapes; compare the complete character.'),
  gap('Listen. Insert the two characters in the breakup and change of habit.', '恋人と〔別〕れてから、たばこを〔吸〕うのをやめました。',
    'こいびとと わかれてから、たばこを すうのを やめました。', 'After breaking up with my partner, I stopped smoking.', [],
    '別れる is わかれる, and 吸う is すう. てから establishes the sequence; 吸うの nominalizes smoking and のをやめる expresses stopping that activity.'),
  kmodel('直', 'Notice 十 at the top and the enclosed eye-like shape beneath it, with the lower outline. Compare 直 with similar dense shapes before choosing it.', 'repair; straighten; direct; honest in compounds',
    [['なお', 'The character reading in 直す（なおす）and 直る（なおる）; the endings are supplied.'], ['ジキ', 'Compound reading in 正直（しょうじき）.'], ['チョク', 'Compound reading, for example 直線（ちょくせん）.']],
    [['直す', 'なおす', 'to repair; to put right', '時計を直します。', 'とけいを なおします。', 'I will repair the clock.'],
      ['直る', 'なおる', 'to be fixed; to return to a proper state', '時計が直りました。', 'とけいが なおりました。', 'The clock is fixed now.'],
      ['正直', 'しょうじき', 'honest', '正直に話してください。', 'しょうじきに はなしてください。', 'Please speak honestly.']]),
  choice('Listen. Choose the character in なおす (to put right).', ['真', '植', '直'], 2, 'ネクタイを直します。', 'ねくたいを なおします。', 'I straighten my tie.',
    '直す is なおす. 直 has 十 above its central enclosed shape. 植 includes 木 on the left; 真 has a different lower shape. These are visual comparisons, not an explanation of etymology.'),
  teachingTable('Study three uses of 直す.', 'Repairing and putting things right', ['Japanese', 'Reading', 'English'],
    [['時計を直す', 'とけいをなおす', 'repair a clock'], ['ネクタイを直す', 'ネクタイをなおす', 'straighten a tie'], ['化粧を直す', 'けしょうをなおす', 'touch up makeup']],
    '時計を直します。ネクタイを直します。化粧を直します。', 'とけいを なおします。ねくたいを なおします。けしょうを なおします。',
    'Repair a clock. Straighten a tie. Touch up makeup.', repair),
  gap('Listen. Insert the three characters before the interview.', '面接の前に、ネクタイを〔直〕して、深く〔息〕を〔吸〕いました。',
    'めんせつの まえに、ねくたいを なおして、ふかく いきを すいました。', 'Before the interview, I straightened my tie and took a deep breath.', [],
    '直す is なおす; 息 is いき; 吸う is すう. ネクタイを直す puts the tie straight, while 息を吸う means to breathe in.'),
  teachingTable('Study how to redo an action.', 'ます stem + 直す', ['ます form', 'Redo verb', 'Reading', 'English'],
    [['書きます', '書き直す', 'かきなおす', 'rewrite'], ['読みます', '読み直す', 'よみなおす', 'reread'], ['考えます', '考え直す', 'かんがえなおす', 'reconsider']],
    '作文を書き直します。本を読み直します。計画を考え直します。', 'さくぶんを かきなおします。ほんを よみなおします。けいかくを かんがえなおします。',
    'Rewrite an essay. Reread a book. Reconsider a plan.', redo),
  gap('Listen. Insert three characters to distinguish beginning, finishing and redoing.', '作文を書き〔始〕めて、書き〔終〕わってから、間違いがあったので書き〔直〕しました。',
    'さくぶんを かきはじめて、かきおわってから、まちがいが あったので かきなおしました。', 'I began writing an essay. After finishing it, I rewrote it because there were mistakes.', [], redo),
  truth('The teacher made the student start writing, rather than rewrite.', false, '先生は生徒に作文を書き直させました。',
    'せんせいは せいとに さくぶんを かきなおさせました。', 'The teacher made the student rewrite the essay.', redo + ' 生徒に identifies who does the rewriting; 作文を is the object.'),
  typed('Listen. Type the reading of 遊 in 遊園地, in hiragana or romaji. えんち is supplied.', '', 'えんち（遊園地）', ['ゆう', 'yuu', 'yū'],
    '遊園地へ行きます。', 'ゆうえんちへ いきます。', 'I will go to the amusement park.',
    '遊園地 is ゆうえんち. Here 遊 is ゆう; type ゆう or yuu before the supplied えんち. 遊ぶ instead uses the native reading あそぶ.'),
  pairs('Match the three whole words to their readings.', [['遊園地', 'ゆうえんち'], ['呼吸', 'こきゅう'], ['正直', 'しょうじき']],
    '遊園地、呼吸、正直。', 'ゆうえんち、こきゅう、しょうじき。', 'Amusement park, breathing, honest.',
    '遊 has ユウ in 遊園地; 吸 has キュウ in 呼吸; 直 has ジキ in 正直. The native words 遊ぶ, 吸う and 直す use different readings.'),
  gap('Listen. Choose the kana readings. れた is supplied after the first blank.', '彼は〔つか〕れたようで、まるで〔べつじん〕のようです。',
    'かれは つかれたようで、まるで べつじんのようです。', 'He seems tired and looks like a completely different person.', ['ひ', 'べつにん'], words),
];

const arrivalTurns = [
  ['staff', 'いらっしゃいませ。何名様でいらっしゃいますか。', 'いらっしゃいませ。なんめいさまで いらっしゃいますか。'],
  ['staff', '二名様ですね。かしこまりました。こちらへどうぞ。お荷物をお預かりいたします。', 'にめいさまですね。かしこまりました。こちらへ どうぞ。おにもつを おあずかりいたします。'],
  ['staff', 'ご注文がお決まりになりましたら、お知らせください。', 'ごちゅうもんが おきまりに なりましたら、おしらせください。'],
  ['staff', '野菜カレーを二つですね。かしこまりました。ご注文は以上でよろしいでしょうか。', 'やさいかれーを ふたつですね。かしこまりました。ごちゅうもんは いじょうで よろしいでしょうか。'],
  ['staff', '少々お待ちください。', 'しょうしょう おまちください。'],
  ['staff', 'お待たせいたしました。申し訳ございません。野菜カレーでございます。', 'おまたせいたしました。もうしわけございません。やさいかれーで ございます。'],
];
const departureTurns = [
  ['guest', 'すみません。お会計をお願いします。', 'すみません。おかいけいを おねがいします。'],
  ['staff', 'かしこまりました。お会計は二千四百円でございます。ポイントカードはお持ちでしょうか。', 'かしこまりました。おかいけいは にせんよんひゃくえんで ございます。ぽいんとかーどは おもちでしょうか。'],
  ['guest', 'はい、持っています。こちらです。三千円でお願いします。', 'はい、もっています。こちらです。さんぜんえんで おねがいします。'],
  ['staff', '三千円お預かりいたします。六百円のお返しでございます。お荷物もお返しいたします。', 'さんぜんえん おあずかりいたします。ろっぴゃくえんの おかえしで ございます。おにもつも おかえしいたします。'],
  ['guest', 'ありがとうございます。ごちそうさまでした。', 'ありがとうございます。ごちそうさまでした。'],
  ['staff', 'ありがとうございました。またのお越しをお待ちしております。', 'ありがとうございました。またの おこしを おまちしております。'],
];
const scene = (prompt, context, turns, japaneseVisible) => ({ renderer: 'dialogue', prompt,
  dialogue: { context, speakerLabels: { guest: 'Customer', staff: 'Restaurant staff' }, speakers: [...new Set(turns.map(t => t[0]))],
    ...(new Set(turns.map(t => t[0])).size === 1 ? { kind: 'single_speaker' } : {}),
    japaneseVisible, translationVisible: false, turns: turns.map(([speaker, japanese, reading], i) => ({ id: `turn-${i + 1}`, speaker, japanese, reading, english: null })) },
  support: { before: [], after: [] }, audio: { text: turns.map(t => t[1]).join('\n'), reading: turns.map(t => t[2]).join('\n'), required: true, beforeAnswer: true }, visual: 'video' });
const courtesy = 'Staff use humble forms for their own actions and respectful forms for the customer’s actions. かしこまりました politely acknowledges a request; it is not a request made by the customer.';

const l09 = [
  gap('Choose the particle in the friends’ restaurant choice.', '今日はこのレストラン〔に〕しよう。', 'きょうは この れすとらんに しよう。', 'Let’s choose this restaurant today.', ['を'],
    'Noun + にする expresses choosing something. にしよう is the casual volitional suggestion “let’s choose”.'),
  scene('Listen to the restaurant staff’s arrival and ordering scene. Follow the Japanese captions.', 'Two customers arrive, indicate their party size, leave their bags with staff and order two vegetable curries. The staff member speaks while the customers respond through their actions.', arrivalTurns, true),
  choice('Listen to the staff member. Which reply answers the question about party size?', ['お腹が空いています。', '窓の近くの席をお願いします。', '二名です。'], 2,
    arrivalTurns[0][1], arrivalTurns[0][2], 'Welcome. How many people are in your party?', '二名です means there are two people. 名（めい）is a formal people counter. Hunger and a seating preference do not answer the number question.'),
  gap('Listen. Complete the staff member’s acknowledgement.', '〔かしこまりました〕。こちらへどうぞ。', 'かしこまりました。こちらへ どうぞ。', 'Certainly. This way, please.', ['お願いします'], courtesy),
  gap('Listen. Complete the staff member’s offer to look after the bags.', '〔お荷物〕を〔お預かりいたします〕。', 'おにもつを おあずかりいたします。', 'I will look after your bags.', ['お断り', 'お返しいたします'],
    'お荷物 respectfully refers to the customer’s bags. 預かります supplies 預かり; お預かりいたします humbly describes the staff member taking them into safekeeping. お返し describes returning them at a later stage.'),
  gap('Listen. Insert three characters in the staff member’s readiness request.', 'ご注文がお〔決〕まりになりましたら、お〔知〕ら〔せ〕ください。',
    arrivalTurns[2][2], 'Please let us know when you have decided on your order.', [],
    'お決まりになる respectfully describes the customer’s decision. なりましたら is the polite conditional. 知らせる means to inform; お知らせください politely asks the customer to let staff know.'),
  gap('Complete the causative of 待つ. The ending る is supplied.', '待つ → 待〔たせ〕る', 'まつ、またせる。', 'To wait → to make someone wait.', ['ち'],
    '待つ is an u-verb: change つ to た and add せる. 待たせる is the causative; 待ち is the ます stem used in お待ちください.'),
  order('Listen. Build the staff member’s apology for making the customers wait.', ['お待たせ', 'いたしました。', '申し訳ございません。'],
    'おまたせいたしました。もうしわけございません。', 'I kept you waiting. I am very sorry.',
    '待たせる is causative. お待たせいたしました uses humble いたす for the staff member’s action; 申し訳ございません apologizes for the wait.'),
  choice('Listen. At what stage of the visit does the staff member ask this?', ['When confirming that the order is complete', 'When taking payment after the meal', 'When asking how many people need seats'], 0,
    'ご注文は以上でよろしいでしょうか。', 'ごちゅうもんは いじょうで よろしいでしょうか。', 'Is that all for your order?',
    'よろしい is the formal counterpart of いい. The question checks acceptability when confirming the order.'),
  scene('Listen to the payment and departure scene.', 'The customers finish their meal, pay, receive their change and bags, and leave.', departureTurns, false),
  choice('Listen. Which customer request asks for the bill?', ['お会計をお願いします。', 'お回転をお願いします。', 'お開店をお願いします。'], 0,
    departureTurns[0][1], departureTurns[0][2], 'Excuse me. The bill, please.',
    '会計（かいけい）is the bill or payment calculation. 回転（かいてん）means rotation; 開店（かいてん）means opening a shop. Only 会計 fits a request to pay after the meal.'),
  gap('Complete the staff member’s farewell. Choose the noun and the humble waiting form.', 'またの〔お越し〕を〔お待ちしております〕。', 'またの おこしを おまちしております。', 'We look forward to your next visit.', ['お越しになる', 'お待たせいたします'],
    'お越し is the noun derived from respectful お越しになる. お待ちしております humbly describes the staff waiting for the customer’s future visit; お待たせ would mean making the customer wait.'),
  choice('Listen to the staff farewell. Which response thanks them for the meal?', ['お疲れさまでした。', 'ごちそうさまでした。', 'いらっしゃいませ。'], 1,
    departureTurns[5][1], departureTurns[5][2], 'Thank you very much. We look forward to your next visit.',
    'A customer says ごちそうさまでした after a meal. お疲れさまでした acknowledges someone’s work or effort; いらっしゃいませ is the staff greeting to an arriving customer.'),
];
// The audio-only occurrence retains a formal-adjective cue, not the full source transcript or corrected replay.
l09[8].support.after = [rule('よろしい is the formal counterpart of いい. The question checks acceptability when confirming the order.')];
l09[7].answer.acceptedOrders.push(['t2','t0','t1']);
l09[8].sourceContract = { feedbackTranscript: 'omitted' };
delete l09[8].audio.feedbackText;

const cp = [
  gap('Complete the request to hear more and receive details.', 'その話をもう少し〔聞かせ〕てください。詳しいことを〔教え〕てください。',
    'その はなしを もうすこし きかせてください。くわしい ことを おしえてください。', 'Please let me hear a little more of that story. Please tell me the details.', ['聞き', '知り'],
    '聞く → 聞かせる; 聞かせてください asks the listener to let you hear. 教える means to tell or teach; 教えてください requests information.'),
  typed('Listen. Type the causee particle in hiragana.', '先生は生徒', '作文を書かせました。', ['に'], '先生は生徒に作文を書かせました。',
    'せんせいは せいとに さくぶんを かかせました。', 'The teacher made the student write an essay.',
    '生徒に marks the person doing the writing; 作文を is the object. The causee uses に when the transitive action already has an を object.'),
  order('Build the statement that the mother does not make her child do unreasonable things.', ['母は、', '子供に', '無理なことを', 'させません。'],
    'ははは、こどもに むりな ことを させません。', 'The mother does not make her child do unreasonable things.',
    'する → させる; the negative polite form is させません. 子供に is the causee, while 無理なことを is the thing they would be made to do.'),
  gap('Listen. Complete the staff member’s respectful decision and humble coming forms.', 'ご注文がお〔決まりになり〕ましたら、お知らせください。すぐに〔参り〕ます。',
    'ごちゅうもんが おきまりに なりましたら、おしらせください。すぐに まいります。', 'Please let me know when you have decided on your order. I will come right away.', ['決まりし', 'いらっしゃい'],
    'お決まりになる respectfully describes the customer’s decision. 参る is humble and describes the staff member coming; いらっしゃる would respectfully describe someone else coming.'),
  gap('Listen. Insert the two kanji in the change-of-habit sentence.', '恋人と〔別〕れてから、たばこを〔吸〕うのをやめました。',
    'こいびとと わかれてから、たばこを すうのを やめました。', 'After breaking up with my partner, I stopped smoking.', [],
    '別れる is わかれる; 吸う is すう. てから orders the events; 吸うのをやめる means to stop the activity of smoking.'),
  gap('Listen. Insert three characters in the service closing.', 'お釣りをお〔返〕しします。またお〔越〕しください。お〔待〕ちしております。',
    'おつりを おかえしします。また おこしください。おまちしております。', 'I will return your change. Please visit again. We look forward to seeing you.', [],
    'お返しします humbly describes returning something; お越しください respectfully invites the customer to come again. お待ちしております humbly describes the staff waiting.'),
  order('Listen. Build the sentence about making others laugh.', ['彼は、', 'みんなを', '笑わせました。'], 'かれは、みんなを わらわせました。', 'He made everyone laugh.',
    '笑う → 笑わせる. The causee みんなを is the group that laughs; 彼は is the person who causes the laughter. Causation here does not imply forcing unwilling people.'),
  choice('In またお越しください, select the noun derived from respectful お越しになる.', ['お越し', 'ください'], 0, 'またお越しください。',
    'また おこしください。', 'Please visit again.', 'お越し is the noun from お越しになる. ください supplies the request; it is not the noun for the visit.'),
  gap('Choose the causative ending of 読む. Complete the teacher’s action.', '先生は生徒に本を読〔ませ〕ました。', 'せんせいは せいとに ほんを よませました。',
    'The teacher made the student read a book.', ['み'], '読む → 読ませる: change む to ま and add せる. 読みました would mean that the subject read, without a causative.'),
  choice('Listen to the staff member’s farewell. Choose the appropriate customer reply after eating.', ['いらっしゃいませ。', 'ごちそうさまでした。', '行ってきます。'], 1,
    'ありがとうございました。またのお越しをお待ちしております。', 'ありがとうございました。またの おこしを おまちしております。', 'Thank you very much. We look forward to your next visit.',
    'ごちそうさまでした thanks someone for the meal. いらっしゃいませ is a staff welcome; 行ってきます is a departure phrase usually used with people expecting your return.'),
  multi('A teacher has students practise in class. Select exactly two causative expressions for the learning activities.', ['新しい言葉を覚えさせる', '日本語の練習をさせる', '昼寝をする', 'お菓子を食べる'], [0, 1],
    '先生は生徒に新しい言葉を覚えさせ、日本語の練習をさせます。', 'せんせいは せいとに あたらしい ことばを おぼえさせ、にほんごの れんしゅうを させます。',
    'The teacher has students learn new words and practise Japanese.', 'The ru-verb 覚える becomes 覚えさせる; irregular する becomes させる. These two choices are causative learning activities. The other choices describe unrelated actions without a causative.'),
  gap('Listen. Complete the respectful request to inform the staff.', 'アレルギーがございましたら、お〔知らせ〕ください。', 'あれるぎーが ございましたら、おしらせください。',
    'Please let us know if you have any allergies.', ['知り'], '知らせる means to inform. Its ます stem is 知らせ, used in お知らせください. 知り is the stem of 知る, meaning to know, and cannot replace it here.'),
  order('Listen. Build the humble permission request to borrow a pen.', ['こちらの', 'ペンを', 'お借り', 'しても', 'よろしい', 'でしょうか。'],
    'こちらの ぺんを おかりしても よろしいでしょうか。', 'May I borrow this pen?',
    'お借りする humbly describes borrowing. Its て form connects to もよろしいでしょうか, a formal request for permission. こちらの modifies ペン.'),
  typed('Listen. Type the reading of 遊 in 遊園地, in hiragana or romaji. えんち is supplied.', '', 'えんち（遊園地）', ['ゆう', 'yuu', 'yū'],
    '遊園地へ行きます。', 'ゆうえんちへ いきます。', 'I will go to the amusement park.',
    '遊園地 is ゆうえんち; enter ゆう or yuu for 遊, before the supplied えんち. 遊ぶ uses the native reading あそぶ.'),
  gap('Listen. Choose the readings of 疲 and 別人. れた is supplied after the first blank.', '彼は〔つか〕れたようで、まるで〔べつじん〕のようです。',
    'かれは つかれたようで、まるで べつじんのようです。', 'He seems tired and looks like a completely different person.', ['ひ', 'べつにん'], words),
  truth('The teacher made the student start writing the essay.', false, '先生は生徒に作文を書き直させました。',
    'せんせいは せいとに さくぶんを かきなおさせました。', 'The teacher made the student rewrite the essay.', redo),
  truth('The speaker offers to help rather than asking someone else for help.', true, '私に手伝わせてください。', 'わたしに てつだわせてください。', 'Please let me help.',
    '手伝わせてください uses causative てください to ask permission for the speaker to help. 私に identifies the speaker as the person who will do the helping.'),
  gap('Listen. Complete the statement that the parents allowed continued study.', '私は両親〔に〕、日本語の勉強を〔続けさせ〕てもらいました。',
    'わたしは りょうしんに、にほんごの べんきょうを つづけさせて もらいました。', 'My parents allowed me to continue studying Japanese.', ['が', '続け'],
    '続ける → 続けさせる. 続けさせてもらう presents permission as a favour received; 両親に identifies the people granting that permission.'),
  gap('Listen. Distinguish the request to wait from the apology for having kept someone waiting.', '少々お〔待ち〕ください。お〔待たせ〕いたしました。',
    'しょうしょう おまちください。おまたせいたしました。', 'Please wait a moment. Thank you for waiting.', ['待たせ', '待ち'],
    '待ち is the ます stem in respectful お待ちください. 待たせ is the causative stem in お待たせいたしました, humbly acknowledging that the staff kept the customer waiting. Each repeated tile is a separate physical option.'),
  gap('Listen. Supply the two characters in the causative of 飲む.', '父は嫌がる子供に薬を飲〔ま〕〔せ〕ました。',
    'ちちは いやがる こどもに くすりを のませました。', 'The father made his reluctant child take the medicine.', ['み', 'し'],
    '飲む → 飲ませる: change む to ま and add せる. 嫌がる makes the forcing interpretation clear in this context; causatives can express permission in other contexts.'),
];
// Explicit grammatical phrase placements; preserve the exact physical tokens.
cp[2].answer.acceptedOrders.push(['t0', 't2', 't1', 't3'], ['t1', 't0', 't2', 't3'], ['t2', 't0', 't1', 't3'], ['t1', 't2', 't0', 't3'], ['t2', 't1', 't0', 't3']);
cp[6].answer.acceptedOrders.push(['t1', 't0', 't2']);
for (const s of l05.filter(s => s.renderer === 'kanji')) s.support.before.push(rule('This complete static model replaces source animation. Shape comparisons are memory aids, not stroke-order instructions or etymology.'));

writePack('l05', l05, { note: 'L05 retains all 20 observed rows, the 10+10 partition and 22 physical responses. Five complete static kanji models replace unavailable/unverified animations, including the blank/loading 吸 model, without stroke-order or etymology claims. Whole-word readings, native character stems, repair/state and redo compounds are distinguished. Only the explicitly allowed reading input accepts kana/romaji; no retry is documented.' });
writePack('l09', l09, { note: 'L09 retains all 13 observed rows and 17 physical responses. Complete authored restaurant arrival/order and payment/departure scenes preserve Japanese captions only on the evidenced first scene and omit English on both. S02 retains the structured one-speaker count with complete staff turns and contextual silent customer actions; S10 has an explicitly authored two-role exchange where speaker count is unknown. Second-scene caption availability is unknown and not inherited. Explicit scene-control prose supports current ordered TTS despite empty retained media arrays. No scene replay binding, recap or retry is inferred. S09 feedback keeps only the documented formal-adjective cue and omits the full source and corrected replay.' });
writePack('cp', cp, { note: 'CP retains all 20 individually observed rows and 40 physical responses; it is not summary-authored. Exact two-segment selection uses the existing choice renderer with the source renderer identity retained. Two of four selections use exact-set grading. CP S02 accepts only the observed hiragana に; displayed ni does not establish acceptance. Explicitly permitted 遊 reading accepts ゆう/yuu before supplied えんち. Equivalent phrase orders and distinct repeated physical tiles are reviewed. No retry or score boundary/unlock is inferred.' });
console.log('Assembled C10 L05 20/22, L09 13/17 and CP 20/40 retained screens/physical responses.');
