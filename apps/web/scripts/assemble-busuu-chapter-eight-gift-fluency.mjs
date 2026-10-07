// Reviewed offline authoring from the assigned Chapter 8 occurrences; no source copy claims.
import { gap, choice, truth, order, typed, writePack } from './busuu-chapter-eight-authoring.mjs';

const wondering = 'かな expresses casual wondering. Plain verbs and い-adjectives connect directly to のかな; present affirmative nouns and な-adjectives use なのかな. This is wondering, not a formal question to a listener.';
const desire = '食べたい expresses wanting to eat. The plain desire form connects to かな; 食べよう is the volitional form used when considering what to do.';
const volitional = '食べる → 食べよう. Volitional + かな expresses a tentative personal choice, distinct from 食べたいかな, which wonders about a desire.';

const fluency = [
 gap('Listen and complete the casual wondering ending.', 'もうお腹が空いた〔かな〕。', 'もう おなかが すいたかな。', 'I wonder whether I am hungry already.', ['かも', 'かの'], wondering + ' 空いた is the plain past form used in the hunger expression.'),
 truth('The speaker is asking what today’s recommended dish is.', true, '何を食べようかな。今日のおすすめは何ですか。', 'なにを たべようかな。きょうの おすすめは なんですか。', 'I wonder what I should eat. What is today’s recommendation?', '何 asks what the recommendation is; おすすめ is used as a noun here. The first sentence considers a meal choice.'),
 gap('Listen and supply the な-adjective connection before のかな.', 'この魚は新鮮〔な〕のかな。', 'この さかなは しんせんなのかな。', 'I wonder whether this fish is fresh.', ['で', 'の'], wondering + ' 新鮮 is a な-adjective: 新鮮なのかな.'),
 gap('Listen and reconstruct the plain ongoing-state ending with three characters.', 'この服は若い人の間で流行して〔い〕〔る〕〔の〕かな。', 'この ふくは わかい ひとの あいだで りゅうこうしているのかな。', 'I wonder whether these clothes are currently popular among young people.', ['ま', 'す'], wondering + ' 流行している describes an ongoing trend. Use plain いる before のかな.'),
 choice('Listen. What is the speaker wondering about?', ['What is being cooked for dinner', 'What time dinner starts', 'How to follow a recipe'], 0, 'いい匂いがするね。今夜は何を作っているのかな。', 'いい においが するね。こんやは なにを つくっているのかな。', 'There is a nice smell. I wonder what is being cooked tonight.', 'The speaker notices a pleasant cooking smell and wonders what is being prepared for dinner. The question is about the dish, rather than its timing or a recipe.'),
 gap('Listen and complete the description of the fish and the wondering ending.', 'この店では〔新鮮な〕魚が食べられる〔かな〕。', 'この みせでは しんせんな さかなが たべられるかな。', 'I wonder whether I can eat fresh fish at this restaurant.', ['新鮮に', 'かも'], '新鮮な modifies the noun 魚. 食べられる is the potential form; かな wonders whether fresh fish can be eaten here. かも would instead suggest a possibility.'),
 typed('Listen. Type the plain desire form in kanji, kana or the reviewed romaji form.', '今日は何を', 'かな。', ['食べたい', 'たべたい', 'tabetai'], '今日は何を食べたいかな。', 'きょうは なにを たべたいかな。', 'I wonder what I want to eat today.', desire + ' The three explicit script variants are accepted for this occurrence; かな is supplied.'),
 order('Listen and build the tentative dinner choice.', ['今日は', 'どの店で', '夕飯を', '食べよう', 'かな。'], 'きょうは どの みせで ゆうはんを たべようかな。', 'I wonder which restaurant I should have dinner at today.', volitional),
];
// Equally grammatical placement of the object and location phrases.
fluency[7].answer.acceptedOrders.push(['t0', 't2', 't1', 't3', 't4'], ['t1', 't0', 't2', 't3', 't4'], ['t2', 't0', 't1', 't3', 't4'], ['t2', 't1', 't0', 't3', 't4'], ['t1', 't2', 't0', 't3', 't4']);

const sceneTurns = [
 ['guest', '母の日に何をあげようかな。まだ決めていないんだ。', 'ははの ひに なにを あげようかな。まだ きめていないんだ。', 'I wonder what I should give for Mother’s Day. I have not decided yet.'],
 ['staff', 'このスカーフはどう？いろいろな服に合うし、軽いし、おすすめだよ。', 'この すかーふは どう。いろいろな ふくに あうし、かるいし、おすすめだよ。', 'How about this scarf? It goes with various clothes, and it is light. I recommend it.'],
 ['guest', '母は前にこんなスカーフを買ったはずだ。駅の近くにできた新しい店に行ってみない？', 'ははは まえに こんな すかーふを かったはずだ。えきの ちかくに できた あたらしい みせに いってみない。', 'My mother should have bought a scarf like this before. Shall we try going to the new shop that opened near the station?'],
 ['staff', 'いいね。あそこでワインを見てみよう。', 'いいね。あそこで わいんを みてみよう。', 'Good idea. Let’s have a look at wine there.'],
 ['guest', 'このワインはどんな匂いがするのかな。', 'この わいんは どんな においが するのかな。', 'I wonder what this wine smells like.'],
 ['staff', '匂いは強くないし、花みたいな匂いがするし、おすすめだよ。', 'においは つよくないし、はなみたいな においが するし、おすすめだよ。', 'Its scent is not strong, and it smells like flowers. I recommend it.'],
 ['guest', 'それなら、飲みやすそうだね。母にこのワインをあげようかな。', 'それなら、のみやすそうだね。ははに この わいんを あげようかな。', 'In that case, it seems easy to drink. I think I might give this wine to my mother.'],
];
const reasons = 'し lists reasons or advantages. The scarf matches various clothes and is light. The wine is recommended for its mild scent and floral resemblance.';
const gift = [
 gap('Listen and complete the recommendation verb.', '母の日のプレゼントに、このスカーフを〔おすすめ〕するよ。', 'ははの ひの ぷれぜんとに、この すかーふを おすすめするよ。', 'I recommend this scarf as a Mother’s Day gift.', ['お気に入り', '流行'], 'おすすめ is a recommendation noun; おすすめする means to recommend. お気に入り refers to a favourite, and 流行 to a trend.'),
 { renderer: 'dialogue', prompt: 'Listen to two friends choosing a Mother’s Day gift. Follow the English dialogue.', dialogue: { context: 'Two friends look at a scarf, then visit a newly opened shop to choose wine.', speakerLabels: { guest: 'Friend choosing a gift', staff: 'Friend giving advice' }, speakers: ['guest', 'staff'], japaneseVisible: false, translationVisible: true, turns: sceneTurns.map(([speaker, japanese, reading, english], i) => ({ id: `turn-${i + 1}`, speaker, japanese, reading, english })) }, support: { before: [], after: [] } },
 truth('The friend has already decided what to give for Mother’s Day.', false, sceneTurns[0][1], sceneTurns[0][2], sceneTurns[0][3], 'The friend is still considering the gift. あげようかな signals a tentative choice, and まだ決めていない establishes that the decision has not been made.'),
 choice('Listen. Which two advantages does the friend give for the scarf?', ['It goes with various clothes and is light', 'It is warm and inexpensive', 'It smells floral and is easy to drink'], 0, sceneTurns[1][1], sceneTurns[1][2], sceneTurns[1][3], reasons),
 gap('Listen and insert three characters to express an expectation about a past purchase.', '母は前にこんなスカーフを買った〔は〕〔ず〕〔だ〕。', 'ははは まえに こんな すかーふを かったはずだ。', 'My mother should have bought a scarf like this before.', ['な', 'の'], 'The plain past verb 買った connects directly to はず. The speaker expects that the purchase happened; this is a reason-based expectation, rather than a verified guarantee.'),
 truth('The friend suggests trying a visit to the newly opened shop.', true, '駅の近くにできた新しい店に行ってみない？', 'えきの ちかくに できた あたらしい みせに いってみない。', 'Shall we try going to the new shop that opened near the station?', '行ってみる means to try going. Casual 行ってみない？ invites the other friend to try the visit.'),
 choice('Listen. What is said about the shop near the station?', ['It has just been created or opened', 'It is the friend’s favourite old shop', 'It is famous for clothes that are trending'], 0, '駅の近くにできた新しい店に行ってみない？', 'えきの ちかくに できた あたらしい みせに いってみない。', 'Shall we try going to the new shop that opened near the station?', 'できた modifies 新しい店 and describes its creation/opening. It does not express somebody’s ability here.'),
 gap('Listen and complete the wine’s two scent qualities.', '匂いは〔強くない〕し、〔花みたいな〕匂いがするし、おすすめだよ。', sceneTurns[5][2], sceneTurns[5][3], ['強い', '花みたいに'], '強くない is the negative of 強い. 花みたいな modifies 匂い, describing a floral resemblance. The two し clauses support the recommendation.'),
 order('Listen and reconstruct the recommendation with its two reasons.', ['匂いは', '強くないし、', '花みたいな', '匂いがするし、', 'おすすめだよ。'], sceneTurns[5][2], sceneTurns[5][3], reasons + ' Keep both reasons before the recommendation.'),
 gap('Listen and reconstruct the tentative gift choice with four characters.', '母にこのワインをあげ〔よ〕〔う〕〔か〕〔な〕。飲みやすそうだね。', 'ははに この わいんを あげようかな。のみやすそうだね。', 'I think I might give this wine to my mother. It seems easy to drink.', ['た', 'い'], 'あげる → あげよう; volitional + かな makes a tentative choice. 飲みます supplies 飲み; 飲みやすい means easy to drink, and dropping the final い before appearance そう gives 飲みやすそう.'),
];
gift[8].answer.acceptedOrders.push(['t2', 't3', 't0', 't1', 't4']);
// Full-scene replay is configured only where the retained row explicitly records replay.
for (const i of [2, 3, 5, 6, 7, 8, 9]) gift[i].sourceContract = { sceneReuse: 'B2.C08.L07.A01.S02' };

writePack('l06', fluency, { optional: { prompt: 'Write a sentence wondering about something you would like to know about Japanese culture.', hint: 'Use かな or のかな. With a present affirmative noun or な-adjective, use なのかな. Your writing is optional and private.' }, note: 'L06 keeps eight required tasks, 15 physical responses and a separate optional writing endpoint A01.S09 with source exercise 10. Desire and volitional forms are distinguished. No retry or speaking action is added.' });
writePack('l07', gift, { note: 'L07 keeps ten required tasks and 19 physical responses. Complete peer gift-shopping dialogue has documented pre-answer English, hidden Japanese, full Japanese/readings for ordered TTS, and seven occurrence-specific same-lesson replay bindings. No inferred recap, cross-lesson context or retry is added.' });
console.log('Assembled Chapter 8 L06: 8 required + optional source #10 / 15 responses; L07: 10 required / 19 responses.');
