import { jp, en, rule, model, gap, choice, truth, order, table, writePack } from './busuu-chapter-nine-authoring.mjs';

// Reviewed app authoring. S50 resolves support that remained null in the raw rows.
const g = (...args) => { const s = gap(...args); s.support.before = [jp(s.scaffold.join('＿＿'))]; return s; };
const m = (...args) => { const s = model(...args); s.sourceContract = { transcriptBeforeAnswer: true, translationBeforeAnswer: true, parallelReadingBeforeAnswer: true }; return s; };
const limited = (s, cue) => { s.support.after = [rule(cue)]; delete s.audio.feedbackText; return s; };
const hidden = s => { s.sourceContract = { ...s.sourceContract, transcriptBeforeAnswer: false }; s.support.before = []; return s; };

const l01 = [
 g('Listen. Complete the respectful form of 来る used by staff.', 'お客様が〔いらっしゃい〕ました。', 'おきゃくさまが いらっしゃいました。', 'The customer has arrived.', ['来','参り'], 'いらっしゃる respectfully describes the customer coming. 参る humbly describes the speaker’s own coming or going.'),
 m('Listen and read the staff greeting.', 'いらっしゃいませ。', 'いらっしゃいませ。', 'Welcome!', 'Staff greet arriving customers with いらっしゃいませ. It is a conventional service greeting based on respectful いらっしゃる; ませ is a polite imperative ending.'),
 choice('A customer is entering the shop. Choose the staff greeting.', ['さようなら。','いらっしゃいませ。','おやすみなさい。'], 1, 'いらっしゃいませ。', 'いらっしゃいませ。', 'Welcome!', 'いらっしゃいませ welcomes an arriving customer. さようなら is a farewell; おやすみなさい wishes someone good night.'),
 truth('The customer says this to welcome the staff into the shop.', false, 'いらっしゃいませ。', 'いらっしゃいませ。', 'Welcome!', 'This is the staff’s greeting to a customer. いらっしゃる respects the customer; the conventional ませ ending makes the greeting courteous.'),
 order('Listen and arrange the staff’s welcome and request to look around.', ['いらっしゃい。','どうぞ、','ごゆっくり','ご覧','ください。'], 'いらっしゃい。どうぞ、ごゆっくり ごらん ください。', 'Welcome. Please take your time looking around.', 'いらっしゃい is a shortened welcome. ご覧ください uses ご覧, the respectful form associated with 見る, for the customer’s looking.'),
 m('Listen and read how staff ask the party size.', '何名様ですか。', 'なんめいさまですか。', 'How many people are in your party?', '名様 is a respectful people counter used by staff for guests. 何名様 is read なんめいさま.'),
 g('Listen and place the three characters in the party-size question.', '〔何〕〔名〕〔様〕ですか。', 'なんめいさまですか。', 'How many people are in your party?', [], '名 can be read な in 名前（なまえ）, but the formal people counter is めい. 何名様 is なんめいさま.'),
 table('Compare the staff’s respectful counter with the customer’s ordinary counter.', 'Counting guests', ['Number','Staff: respectful form','Customer: ordinary form','Meaning'], [
  ['1','一名様（いちめいさま）','一人（ひとり）','one person'], ['2','二名様（にめいさま）','二人（ふたり）','two people'], ['3','三名様（さんめいさま）','三人（さんにん）','three people'],
 ], '一名様、二名様、三名様。一人、二人、三人。', 'いちめいさま、にめいさま、さんめいさま。ひとり、ふたり、さんにん。', 'Staff respectfully count guests with 名様. Customers count their own party with 人; 一人 and 二人 have the special readings ひとり and ふたり.'),
 g('Listen. The staff are seating a party of two. Complete the respectful counter.', '二〔名様〕ですね。こちらへどうぞ。', 'にめいさまですね。こちらへ どうぞ。', 'Two guests, then. This way, please.', ['人','枚'], 'The staff use 二名様（にめいさま）to respect the guests. 人 is the ordinary counter; 枚 counts flat objects.'),
 m('Listen and read the staff’s humble acknowledgement.', 'かしこまりました。', 'かしこまりました。', 'Certainly. / Understood.', 'かしこまりました is a formal service acknowledgement. The staff humbly acknowledge the customer’s request.'),
 g('Listen. Complete the server’s acknowledgement of an order.', 'コーヒーを一つですね。〔かしこまりました〕。', 'こーひーを ひとつですね。かしこまりました。', 'One coffee, then. Certainly.', ['貸し出しました'], 'かしこまりました acknowledges the request. 貸し出しました（かしだしました）means lent something out; it is a different verb and does not acknowledge an order.'),
 { renderer: 'dialogue', prompt: 'Read and listen to a reservation exchange.', dialogue: {
   japaneseVisible: true, translationVisible: true, context: 'A restaurant guest checks in for a reservation.', speakers: ['guest','staff'], speakerLabels: { guest: 'Customer', staff: 'Staff' }, turns: [
    { id: 'guest-1', speaker: 'guest', japanese: '七時に予約した田中です。', reading: 'しちじに よやくした たなかです。', english: 'I’m Tanaka. I have a reservation for seven.' },
    { id: 'staff-1', speaker: 'staff', japanese: 'かしこまりました。お連れ様はもういらっしゃいますか。', reading: 'かしこまりました。おつれさまは もう いらっしゃいますか。', english: 'Understood. Is the rest of your party here already?' },
   ] }, support: { before: [rule('かしこまりました acknowledges a request or information in service settings. いらっしゃいます respectfully describes the companion’s presence here.')], after: [] }, audio: { text: '七時に予約した田中です。かしこまりました。お連れ様はもういらっしゃいますか。', reading: 'しちじに よやくした たなかです。かしこまりました。おつれさまは もう いらっしゃいますか。' }, sourceContract: { transcriptBeforeAnswer: true, translationBeforeAnswer: true } },
 hidden(choice('Listen. Who is speaking?', ['店員','客','家族'], 0, 'かしこまりました。すぐにお持ちします。', 'かしこまりました。すぐに おもちします。', 'Certainly. I’ll bring it right away.', 'The acknowledgement and offer to bring the item fit a staff member responding to a customer. 店員（てんいん）means a staff member.')),
 limited(hidden(choice('Listen. What information is the staff asking for?', ['予約の時間','予約した人の名前','人数'], 2, 'いらっしゃいませ。何名様ですか。', 'いらっしゃいませ。なんめいさまですか。', 'Welcome. How many people are in your party?', 'The staff are asking the size of the party.')), '人数（にんずう）means the number of people. The question concerns party size, rather than a reservation time or name.'),
 limited(g('Listen. Complete the customer’s ordinary two-person counter.', '客：二〔人〕です。', 'きゃく：ふたりです。', 'Customer: There are two of us.', ['名様'], 'Customers use the ordinary counter for their own party.'), '二人（ふたり）means two people. The customer uses 人 for their own party; 名様 is the respectful counter used by staff.'),
 choice('A customer orders a coffee. Choose the server’s formal acknowledgement.', ['かしこまりました。','分かったよ。','いただきます。'], 0, 'かしこまりました。', 'かしこまりました。', 'Certainly.', 'かしこまりました suits a server acknowledging an order. 分かったよ is casual; いただきます is said by someone about to eat.'),
 limited(truth('The speaker is working in a restaurant.', false, 'いらっしゃいませ。ご試着でしたら、試着室をご利用ください。', 'いらっしゃいませ。ごしちゃくでしたら、しちゃくしつを ごりようください。', 'Welcome. If you would like to try it on, please use the fitting room.', 'The fitting-room clue points to a clothes shop.', true), '試着室（しちゃくしつ）means fitting room. This cue points to a clothes shop rather than a restaurant.'),
];
l01[7].support.before.unshift(jp('一名様・二名様・三名様／一人・二人・三人'), en('One, two and three people: respectful staff forms and ordinary customer forms.'));
// S50 records Japanese/English models here, without a parallel full-source kana layer.
for (const s of l01) {
 s.support.before = s.support.before.map(b => b.kind === 'japanese' ? { kind: b.kind, text: b.text } : b);
 if (s.sourceContract?.parallelReadingBeforeAnswer) s.sourceContract.parallelReadingBeforeAnswer = false;
}
l01[16].sourceContract = { retryTrace: { sourceActivityId: 'a77bd09a-93f4-49ad-8b81-b39bdc0293d3', sourceExerciseNumber: 9, count: 1, evidence: 'O', note: 'Activity-local base 8, lesson base 17; fitting-room clue repeated.' } };
l01[4].answer.acceptedOrders.push(['t0','t2','t1','t3','t4']);

const l02 = [
 m('Listen and read 決まる: a decision is settled.', '会議の時間が決まりました。', 'かいぎの じかんが きまりました。', 'The meeting time has been decided.', '決まる（きまる）describes the settled result. The thing decided takes が. In active 決める, a person decides something with を.'),
 g('Listen. Complete the verb that describes a settled meeting time.', '会議の時間が〔決まり〕ました。', 'かいぎの じかんが きまりました。', 'The meeting time has been decided.', ['困り','決め'], '時間が決まる describes the time becoming settled. 困る means be troubled; active 決める takes the item being decided with を.'),
 m('Listen and read 確かめる: check or confirm.', '出発の時間を確かめます。', 'しゅっぱつの じかんを たしかめます。', 'I’ll check the departure time.', '確かめる（たしかめる）is a ru/ichidan verb. Its て-form is 確かめて: remove る and add て.'),
 g('Listen. Complete the request to check the time.', '出発の時間を〔確かめて〕ください。', 'しゅっぱつの じかんを たしかめて ください。', 'Please check the departure time.', ['確かめって','確かめた'], '確かめる is a ru/ichidan verb: 確かめて. Do not add the small っ used in some u/godan verb forms; 確かめた is past.'),
 limited(choice('Listen. What should be checked?', ['時間','予定','場所'], 0, '明日の電車の時間を確かめてください。', 'あしたの でんしゃの じかんを たしかめて ください。', 'Please check tomorrow’s train time.', 'The requested object is the train time.'), '時間（じかん）is the time. This is the object of 確かめる here.'),
 m('Listen and read 断る: decline an offer or request.', '今日は参加できないので、誘いを断りました。', 'きょうは さんかできないので、さそいを ことわりました。', 'I couldn’t take part today, so I declined the invitation.', '断る（ことわる）is a u/godan verb despite ending in る. Its て-form is 断って. できない expresses inability; ので gives the reason.'),
 limited(hidden(choice('Listen. What did the speaker do?', ['Accepted the invitation','Declined the invitation','Checked the meeting place'], 1, '忙しかったので、友達の誘いを断りました。', 'いそがしかったので、ともだちの さそいを ことわりました。', 'I was busy, so I declined my friend’s invitation.', 'The speaker declined the invitation.')), '断る（ことわる）means decline or refuse. It identifies the action taken.'),
 { renderer: 'multi_choice', prompt: 'Select exactly three correct て-forms for 決まる, 確かめる and 断る.', answer: { kind: 'multi_choice', requiredCount: 3, grading: 'exact_set', options: [
   { id: 'o0', text: '決まって' }, { id: 'o1', text: '決まて' }, { id: 'o2', text: '確かめて' }, { id: 'o3', text: '確かめって' }, { id: 'o4', text: '断って' }, { id: 'o5', text: '断て' },
  ], acceptedOptionIds: ['o0','o2','o4'] }, praise: 'Well done!', support: { before: [], after: [rule('決まる and 断る are u/godan verbs: る becomes って. 確かめる is ru/ichidan: remove る and add て. Select 決まって・確かめて・断って as one exact set.')] }, audio: { text: null } },
 g('Listen. Complete the object particle and the checking verb.', '予定〔を〕〔確かめて〕から、誘いを断りました。', 'よていを たしかめてから、さそいを ことわりました。', 'I checked my schedule and then declined the invitation.', ['が','確かめた'], '確かめる takes an object with を. Its て-form combines with から to mean after doing something: 確かめてから.'),
 m('Listen and read 預かる: take temporary custody.', 'ホテルで荷物を預かります。', 'ほてるで にもつを あずかります。', 'We’ll look after your luggage at the hotel.', '預かる（あずかる）means receive and look after something temporarily, rather than give it away. It can also describe looking after someone entrusted to your care.'),
 g('Listen. Complete the staff’s offer of temporary luggage storage.', 'お帰りになるまで、荷物を〔預かり〕ます。', 'おかえりに なるまで、にもつを あずかります。', 'We’ll look after your luggage until you return.', ['あげ','送り'], '預かる describes taking temporary custody of the customer’s luggage. あげる gives something to someone; 送る sends it somewhere.'),
 m('Listen and read 返す: return an object.', '借りた本を友達に返します。', 'かりた ほんを ともだちに かえします。', 'I’ll return the book I borrowed to my friend.', '返す（かえす）returns an object: 本を返す. 帰る（かえる）means go or return home/a place and is intransitive: 家に帰る.'),
 choice('Listen. Choose the action that returns a borrowed book.', ['本を買います。','家に帰ります。','本を返します。'], 2, '借りた本を返します。', 'かりた ほんを かえします。', 'I’ll return the book I borrowed.', '返す returns an object, marked with を. 買う means buy. 帰る describes returning to a place, marked with に.'),
 g('Complete the two u/godan て-forms: 預かる and 返す.', '預かる → 〔預かって〕。返す → 〔返して〕。', 'あずかる、あずかって。かえす、かえして。', 'Take custody: 預かる → 預かって. Return an object: 返す → 返して.', ['預かて','返って'], 'U/godan る becomes って: 預かって. U/godan す becomes して: 返して. 返って is not the て-form of 返す.'),
 limited(truth('The speaker asks someone to go home.', false, 'この本を返してください。', 'この ほんを かえして ください。', 'Please return this book.', '返す concerns an object; 帰る concerns going home.'), '返す（かえす）returns an object. 帰る（かえる）means return to a place or go home.'),
 order('Listen and build the request to store luggage during sightseeing.', ['観光している間、','ホテルで','荷物を','預かって','もらえますか。'], 'かんこうしている あいだ、ほてるで にもつを あずかって もらえますか。', 'Could you look after my luggage at the hotel while I’m sightseeing?', '預かってもらえますか asks for the favour of temporary custody. The time phrase, location and object can also occur in the reviewed alternative orders.'),
 g('Complete the past ongoing modifier and the object-return verb.', '昨日まで〔借りていた〕本を、今日〔返し〕ます。', 'きのうまで かりていた ほんを、きょう かえします。', 'I’ll return today the book I had been borrowing until yesterday.', ['借りていました','帰り'], '借りていた is the plain past ongoing form modifying 本. Do not use polite 借りていました directly before a noun. Returning the book uses 返す, with stem 返し before ます.'),
 order('Listen and build advice about checking availability before deciding whether to decline.', ['誘いを','断った方がいいかどうか、','まず','予定を','確かめてください。'], 'さそいを ことわった ほうが いいかどうか、まず よていを たしかめて ください。', 'To see whether you should decline the invitation, first check your schedule.', 'Past 断った connects to 方がいい for advice; かどうか introduces whether that is advisable. 確かめる takes 予定を. まず may also start the sentence or precede the checking verb.'),
 g('Complete the past verb and the whether expression.', '本を〔返した〕〔かどうか〕、確かめてください。', 'ほんを かえしたかどうか、たしかめて ください。', 'Please check whether the book has been returned.', ['返して','かもしれない'], 'Past plain 返した comes before かどうか to ask whether the return happened. 返して is a て-form; かもしれない means might, rather than whether.'),
];
l02[4].sourceContract = { retryTrace: { sourceActivityId: '2e78d83a-f1a9-4cb9-8252-25a873394984', sourceExerciseNumber: 10, count: 1, evidence: 'O', note: 'Base exercise 5; retry follows all nine A01 rows and returns to A02.S01.' } };
// Explicitly retained response readings are separate from full-source support.
l02[12].answer.options[0].secondary = 'ほんを かいます。';
l02[12].answer.options[1].secondary = 'いえに かえります。';
l02[12].answer.options[2].secondary = 'ほんを かえします。';
l02[14].support.before = l02[14].support.before.map(b => ({ kind: b.kind, text: b.text }));
l02[15].answer.acceptedOrders.push(['t0','t2','t1','t3','t4'],['t2','t0','t1','t3','t4']);
l02[17].answer.acceptedOrders.push(['t2','t0','t1','t3','t4'], ['t0','t1','t3','t2','t4']);

writePack('l01', l01, { retryPolicy: { kind: 'after_activity_once', screenIds: ['B2.C09.L01.A02.S08'] }, note: '17 required tasks / 18 physical responses, partition 9+8. S50 resolves A02.S05 to hidden source and cue-only feedback despite null structured flags; A02.S06 uses partial customer scaffold and lexical feedback. Only final retail-setting truth retries, with source counter 9 separate from base 8. Ordinary customer counters, humble staff acknowledgement and respectful guest actions remain distinct.' });
writePack('l02', l02, { retryPolicy: { kind: 'after_activity_once', screenIds: ['B2.C09.L02.A01.S05'] }, note: '19 required tasks / 28 physical responses, partition 9+10. S50 permits bilingual lexical examples and explicit response readings at A02.S04. A01.S05/S07 and A02.S06 have only lexical/cue feedback; A01.S08 is one exact-set grade for three of six forms. The A01.S05 source retry counter 10 follows A01 and resumes A02; text-only tasks have no pre-answer playback. Reviewed custody-request and advice discourse equivalents are accepted.' });
console.log('Assembled L01: 17 tasks / 18 responses; L02: 19 tasks / 28 responses.');
