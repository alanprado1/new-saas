// Offline, reviewed production authoring. Source evidence and all released packs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu'), output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-five-occurrences.json'), 'utf8')).screens;
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

const prefixRule = 'Learn each established form: お名前・お電話・お食事・お好き・お上手, but ご住所・ご両親・ご家族・ご注文・ご親切. お often accompanies native words and ご often Sino-Japanese words, with lexical exceptions. This is not a rule to add a prefix to every noun or adjective.';
const familyRule = 'Raise the other person’s family: ご両親・ご家族. In an outward-facing reply about your own family, use 両親・家族 without elevating them. 家族 refers to family members; 家庭 refers to the home or household.';
const existenceRule = 'ございます is the very polite service equivalent of あります: a reservation, facility or question exists. It is 丁寧語, politeness toward the listener, rather than subject-honorific morphology. Keep the location particle に for existence.';
const copulaRule = 'でございます is the very polite service equivalent of です, identifying a room, time or floor. Compare 三階でございます (it is the third floor) with 三階にございます (it is located on the third floor). The で belongs to the copula here.';
const respectfulRule = 'Use 召し上がる for the other person’s eating/drinking, ご覧になる for seeing and お休みになる for sleeping/resting. These are respectful forms; do not use them to elevate your own action in service to a guest.';
const requestRule = 'The request forms differ: 召し上がってください uses the te form; ご覧ください and お休みください use their established request patterns. Do not attach ください to a dictionary form or apply one mechanical suffix to every respectful verb.';
const content = {};
content.l01 = [
 model('Learn the word for a Japanese inn.','旅館に泊まります。','りょかんに とまります。','I will stay at a Japanese inn.','旅館（りょかん）is a Japanese inn; 泊まる means to stay overnight.'),
 gap('Complete “I will stay at an inn tonight.”','今夜は〔旅館〕に泊まります。','こんやは りょかんに とまります。','I will stay at an inn tonight.',['食事','階段'],'旅 appears in 旅行 (travel) and 旅館 (inn). 旅館 is read りょかん.'),
 model('Read about one possible inn experience.','この旅館には、和室とお風呂があります。','この りょかんには、わしつと おふろが あります。','This inn has Japanese-style rooms and a bath.','Some inns offer tatami rooms, baths, yukata or meals. Facilities and customs vary; check the particular inn’s guidance. This authored example describes this inn only.'),
 truth('The speaker will stay overnight at an inn.',true,'今夜は旅館に泊まります。','こんやは りょかんに とまります。','I will stay at an inn tonight.','泊まります identifies overnight accommodation, not a meal-only visit.',true),
 model('Learn the word for a meal.','食事をします。','しょくじを します。','I will have a meal.','食事（しょくじ）means a meal or eating a meal. 朝食（ちょうしょく）is breakfast; 夕食（ゆうしょく）is the evening meal.'),
 choice('Listen. Which meal is included in this plan?',['Breakfast','Lunch','Dinner'],0,'このプランには朝食が含まれています。','この ぷらんには ちょうしょくが ふくまれています。','Breakfast is included in this plan.','朝食 is breakfast, 昼食（ちゅうしょく）lunch, and 夕食 dinner. Meal inclusion depends on the plan.'),
 gap('Complete the inn’s room-service statement.','この〔旅館〕では、お部屋で〔食事〕ができます。','この りょかんでは、おへやで しょくじが できます。','At this inn, you can have a meal in your room.',['階','女性'],'館 occurs in building words such as 旅館 and 図書館. で marks the place of the action.'),
 model('Learn the floor counter.','部屋は二階です。','へやは にかいです。','The room is on the second floor.','階 counts floors: 二階（にかい）. Japanese 一階 is the ground-level first floor.'),
 choice('Listen. On which floor is the room?',['Third floor','Eighth floor','First floor'],1,'お部屋は八階です。','おへやは はっかいです。','Your room is on the eighth floor.','八階 may be read はっかい or はちかい. This audio uses はっかい; floor numbers are not ordinary isolated numeral readings.'),
 table('Study floor readings.','Floor-counter sound changes',['Floor','Reading','English'],[['一階','いっかい','first floor'],['二階','にかい','second floor'],['三階','さんがい','third floor'],['四階','よんかい','fourth floor'],['五階','ごかい','fifth floor'],['六階','ろっかい','sixth floor'],['七階','ななかい','seventh floor'],['八階','はっかい／はちかい','eighth floor'],['九階','きゅうかい','ninth floor'],['十階','じゅっかい／じっかい','tenth floor']], '一階、二階、三階、四階、五階、六階、七階、八階、九階、十階。','いっかい、にかい、さんがい、よんかい、ごかい、ろっかい、ななかい、はっかい、きゅうかい、じゅっかい。','Learn the conventional counter readings. 三階 commonly uses さんがい; 八階 and 十階 have the alternatives shown. These floors start with ground-level 一階.'),
 gap('Complete the reading of 三階 and the meal word.','〔さんがい〕（三階）で〔食事〕をします。','さんがいで しょくじを します。','I will have a meal on the third floor.',['さんかい','階段'],'三階 is commonly さんがい, with voiced がい. 食事 is しょくじ.'),
 model('Learn the stairs word.','階段を使います。','かいだんを つかいます。','I will use the stairs.','階段（かいだん）means stairs.'),
 gap('Complete the way to reach the bath.','〔階段〕でお風呂に行きます。','かいだんで おふろに いきます。','I will go to the bath by the stairs.',['食事','旅館'],'階 is かい in 階段（かいだん）. で marks the means used.'),
 model('Learn a formal word for women.','女性用のお風呂です。','じょせいようの おふろです。','This is the bath for women.','女性（じょせい）means women or a woman; 用 marks intended use.'),
 gap('Complete the word for women.','こちらは〔女性〕用のお風呂です。','こちらは じょせいようの おふろです。','This is the bath for women.',['男性','食事'],'女 is じょ in 女性, but おんな when used as the word 女.'),
 model('Learn a formal word for men.','男性用のお風呂です。','だんせいようの おふろです。','This is the bath for men.','男性（だんせい）means men or a man.'),
 choice('Listen. Where is the men’s bath?',['Beside the stairs','Inside the dining room','In the garden'],0,'男性用のお風呂は階段の隣です。','だんせいようの おふろは かいだんの となりです。','The men’s bath is beside the stairs.','男 is だん in 男性, but おとこ as the word 男. 隣 means next to.'),
 table('Compare everyday and service vocabulary.','People and meals in hospitality',['Everyday expression','Service/formal expression','English'],[['女の人','女性','woman / women'],['男の人','男性','man / men'],['ごはん','お食事','meal']], '女の人、女性。男の人、男性。ごはん、お食事。','おんなのひと、じょせい。おとこのひと、だんせい。ごはん、おしょくじ。','Female/male signs and formal service descriptions often use 女性/男性. ごはん is an everyday meal word; お食事 is polite service vocabulary. Choose by context rather than replacing every everyday expression.'),
 truth('The yukata is intended for men.',false,'この浴衣は女性用です。','この ゆかたは じょせいようです。','This yukata is intended for women.','女性用 indicates the intended recipient in this example; it does not assert a universal yukata rule.',true),
 pairs('Match each word with its category.',[['旅館','Accommodation building'],['食事','Meal'],['女性','People']],'旅館 is an inn, 食事 is a meal and 女性 refers to women. These categories describe the displayed words.'),
 gap('Complete the directions to the men’s bath.','〔男性〕用のお風呂は〔三階〕です。〔階段〕で行ってください。','だんせいようの おふろは さんがいです。かいだんで いってください。','The men’s bath is on the third floor. Please take the stairs.',['食事','女性','一階'],'男性用 identifies the facility, 三階 is さんがい, and 階段で uses で for means.'),
];
content.l02 = [
 kmodel('館','The left is the food radical 飠; the right resembles 官. This is a static shape aid replacing animation, not an etymology or stroke-order claim.','building; hall',[['かん','On reading; 旅館 has the contracted word reading りょかん.']],[['旅館','りょかん','Japanese inn','旅館に泊まります。','りょかんに とまります。','I will stay at an inn.'],['図書館','としょかん','library','図書館で本を読みます。','としょかんで ほんを よみます。','I read books at the library.']]),
 choice('Which character has the food radical on the left and 官 on the right?',['館','段','室'],0,'館','かん','building; hall','館 has 飠 on the left and 官 on the right. The shape aid is not an explanation of the character’s historical origin.'),
 kmodel('段','Notice the compact left-hand strokes and 殳 on the right. Static shape note; original animation is deferred.','step; grade',[['だん','On reading in 階段 and 三段.']],[['階段','かいだん','stairs','階段を使います。','かいだんを つかいます。','I use the stairs.'],['三段','さんだん','third dan rank','姉は柔道三段です。','あねは じゅうどう さんだんです。','My older sister holds third dan in judo.']]),
 gap('Complete the kanji for stairs.','階〔段〕を使ってください。','かいだんを つかってください。','Please use the stairs.',['館','庭'],'段 is だん in 階段. Its right-hand component is 殳.'),
 model('Read an example of a martial-arts grade.','姉は柔道三段です。','あねは じゅうどう さんだんです。','My older sister holds third dan in judo.','段 can identify a dan rank. Rank systems and belt policies vary by organization; this example states a rank without inferring a universal belt color or skill standard.'),
 truth('The speaker’s older sister holds third dan in judo.',true,'姉は柔道三段です。','あねは じゅうどう さんだんです。','My older sister holds third dan in judo.','The explicit statement says 三段; no inference about belt color is needed.'),
 kmodel('庭','Recognize 广 above/around 廷. Use this as a static visual aid, not a historical derivation.','garden; courtyard',[['にわ','Kun reading in 庭.'],['てい','On reading in 家庭 and 校庭.']],[['庭','にわ','garden','庭に花があります。','にわに はなが あります。','There are flowers in the garden.'],['家庭','かてい','home; household','家庭での生活は大切です。','かていでの せいかつは たいせつです。','Life at home is important.']]),
 choice('Which kanji means garden?',['段','庭','性'],1,'庭','にわ','garden','庭 is にわ as a standalone word and てい in 家庭.'),
 gap('Complete the kana readings of 旅館 and 庭.','この〔りょかん〕（旅館）には、広い〔にわ〕（庭）があります。','この りょかんには、ひろい にわが あります。','This inn has a spacious garden.',['りょうかん','てい'],'旅館 is りょかん and the standalone 庭 is にわ.'),
 kmodel('室','Notice 宀 (roof) above 至. A static shape aid replaces the deferred animation.','room',[['しつ','On reading in 教室, 浴室 and 寝室.']],[['教室','きょうしつ','classroom','教室で勉強します。','きょうしつで べんきょうします。','I study in the classroom.'],['寝室','しんしつ','bedroom','寝室は二階です。','しんしつは にかいです。','The bedroom is on the second floor.']]),
 choice('Which character has 宀 above 至 and means room?',['庭','館','室'],2,'室','しつ','room','室 is found in 教室 (classroom), 浴室 (bathroom/bathing room) and 寝室 (bedroom).'),
 kmodel('性','Compare 忄 (heart) on the left with 生 on the right. The complete 性 differs from standalone 生. Static shape note, not etymology.','nature; sex; gender',[['せい','On reading in 女性, 男性 and 性格.']],[['女性','じょせい','woman; women','女性用の浴室はこちらです。','じょせいようの よくしつは こちらです。','The women’s bathing room is here.'],['性格','せいかく','personality','兄は明るい性格です。','あには あかるい せいかくです。','My older brother has a cheerful personality.']]),
 gap('Complete “personality” with 性, not 生.','兄は明るい〔性〕格です。','あには あかるい せいかくです。','My older brother has a cheerful personality.',['生','室'],'性格 uses 性. Both 性 and 生 can have the reading せい, but shared readings do not make the characters interchangeable.'),
 gap('Complete the two bathing-room signs.','〔男性〕用浴室 ／ 〔女性〕用浴室','だんせいよう よくしつ。じょせいよう よくしつ。','Men’s bathing room / Women’s bathing room',['家庭','教室'],'浴室（よくしつ）is a bathing room; 男性用 and 女性用 identify the intended users in these signs.'),
 table('Distinguish family members from the household.','家族 and 家庭',['Word','Reading','Meaning'],[['家族','かぞく','family members'],['家庭','かてい','home; household']], '家族、家庭。','かぞく、かてい。',familyRule),
 gap('Build 家庭 and 家族 from four characters.','私の〔家〕〔庭〕は、〔家〕〔族〕が仲良しです。','わたしの かていは、かぞくが なかよしです。','In my household, the family members get along well.',['室','性'],familyRule),
 gap('Complete household and personality.','私の〔家庭〕では、明るい〔性格〕の兄がよく話します。','わたしの かていでは、あかるい せいかくの あにが よく はなします。','In my household, my cheerful older brother often talks.',['家族','浴室'],'家庭 describes the home setting; 性格（せいかく）describes personality, reusing the earlier 明るい trait.'),
 gap('Complete the teacher’s classroom/schoolyard directions.','〔教室〕では静かにしなさい。〔校庭〕では元気に遊びなさい。','きょうしつでは しずかに しなさい。こうていでは げんきに あそびなさい。','Be quiet in the classroom. Play energetically in the schoolyard.',['浴室','家庭'],'教室（きょうしつ）is classroom and 校庭（こうてい）schoolyard. なさい is an instructive form appropriate to this teacher-to-pupil context.'),
 pairs('Match the compounds with their readings.',[['旅館','りょかん'],['階段','かいだん'],['寝室','しんしつ']],'寝 is しん in 寝室, but ね in 寝る（ねる）. Use word-specific readings.'),
 gap('Complete the inn, garden and women compounds with three characters.','旅〔館〕の〔庭〕で、女〔性〕が写真を撮っています。','りょかんの にわで、じょせいが しゃしんを とっています。','A woman is taking a photograph in the inn’s garden.',['段','室'],'旅館（りょかん）、庭（にわ）、女性（じょせい）use the displayed characters in different compound positions.'),
];
content.l03 = [
 choice('Which question respectfully asks a guest’s name?',['お名前は何とおっしゃいますか。','私の名前は田中です。','名前を書いた。'],0,'お名前は何とおっしゃいますか。','おなまえは なんと おっしゃいますか。','May I ask your name?','おっしゃる respectfully refers to the other person’s saying; this recalls the earlier respectful question form.'),
 table('Study selected forms with お.','Established お forms',['Base','Polite/respectful form','English'],[['名前','お名前','name'],['電話','お電話','telephone'],['食事','お食事','meal'],['好き','お好き','liked; favorite'],['上手','お上手','skillful']], 'お名前、お電話、お食事、お好き、お上手。','おなまえ、おでんわ、おしょくじ、おすき、おじょうず。',prefixRule),
 gap('Complete the polite form labels.','〔お名前〕と〔お電話〕番号をご記入ください。','おなまえと おでんわばんごうを ごきにゅうください。','Please fill in your name and telephone number.',['ご名前','ご電話'],'お名前 and お電話 are established polite labels; ご記入ください is a respectful request to fill in the form.'),
 gap('Complete the polite meal and respectful “here.”','〔お食事〕は〔こちら〕でお願いします。','おしょくじは こちらで おねがいします。','Please have your meal here.',['ご食事','ここ'],'お食事 is polite meal vocabulary; こちら is the respectful counterpart of ここ in this service direction.'),
 typed('Write the polite form of 好き, using kanji or kana.','どんなお茶が','ですか。',['お好き','おすき'],'どんなお茶がお好きですか。','どんな おちゃが おすきですか。','What kind of tea do you like?',prefixRule),
 order('Listen and build the respectful compliment.',['お客様は、','日本語が','とても','お上手','ですね。'],'おきゃくさまは、にほんごが とても おじょうずですね。','Your Japanese is very good.','お上手 praises the other person’s skill. The customer is the person being complimented; no own-skill honorific is implied.'),
 model('Study a service request for name and address.','お名前とご住所をお願いします。','おなまえと ごじゅうしょを おねがいします。','May I have your name and address, please?',prefixRule),
 gap('Insert the two established prefixes.','〔お〕名前と〔ご〕住所をお願いします。','おなまえと ごじゅうしょを おねがいします。','May I have your name and address, please?',['ご','お'],'The two physical prefix tokens are distinct; repeated identical text remains interchangeable only in the reviewed matching slots.'),
 table('Study selected forms with ご.','Established ご forms',['Base','Respectful form','English'],[['住所','ご住所','address'],['両親','ご両親','the other person’s parents'],['家族','ご家族','the other person’s family'],['注文','ご注文','order'],['親切','ご親切','kindness']], 'ご住所、ご両親、ご家族、ご注文、ご親切。','ごじゅうしょ、ごりょうしん、ごかぞく、ごちゅうもん、ごしんせつ。',prefixRule+' '+familyRule),
 truth('This service request uses both お and ご.',true,'お名前とご住所をお願いします。','おなまえと ごじゅうしょを おねがいします。','May I have your name and address, please?',prefixRule),
 gap('Ask about the other person’s parents and health.','〔ご両親〕は〔お元気〕ですか。','ごりょうしんは おげんきですか。','Are your parents well?',['両親','ご元気'],familyRule+' お元気 is the established health expression.'),
 choice('A guest asks about your family. Which reply avoids raising your own parents?',['はい、ご両親は元気です。','はい、両親は元気です。','はい、ご両親がお元気です。'],1,'はい、両親は元気です。','はい、りょうしんは げんきです。','Yes, my parents are well.',familyRule),
 gap('Ask where the other person’s family is.','〔ご家族〕はどちらに〔いらっしゃいます〕か。','ごかぞくは どちらに いらっしゃいますか。','Where is your family?',['家族','います'],familyRule+' どちら and いらっしゃいます respectfully refer to the other family’s location.'),
 gap('Complete the gratitude expression.','〔ご親切〕にありがとうございます。','ごしんせつに ありがとうございます。','Thank you for your kindness.',['お親切','ご好き'],'ご親切 is an established respectful adjective expression directed toward the other person’s kindness.'),
 gap('Complete the request made for other guests’ comfort.','ほかの〔お客様〕もいらっしゃいますので、〔お静か〕にお願いします。','ほかの おきゃくさまも いらっしゃいますので、おしずかに おねがいします。','Other guests are here too, so please be quiet.',['ご客様','ご静か'],'お客様 respectfully refers to guests. お静かにお願いします politely asks for quiet; ので gives the reason.'),
 choice('Which phrase asks a customer’s order?',['ご注文はお決まりですか。','私のご注文はお決まりです。','ご住所はどちらですか。'],0,'ご注文はお決まりですか。','ごちゅうもんは おきまりですか。','Have you decided on your order?','ご注文 refers to the customer’s order. This service question uses a polite established expression.'),
 model('Learn a respectful way to refer to a child.','お子様のお食事もございます。','おこさまの おしょくじも ございます。','We also have meals for children.','お子様（おこさま）is respectful service address for a child. A children’s meal may be called お子様ランチ. Availability varies; this example offers it at this venue.'),
 gap('Build the respectful word for a child.','〔お〕子〔様〕のお食事はこちらです。','おこさまの おしょくじは こちらです。','The child’s meal is here.',['ご','さん'],'お + 子 + 様 makes お子様; 様 is read さま.'),
 choice('Listen. Which two drinks does the guest request?',['Tea and water','Coffee and tea','Water and coffee'],0,'お茶とお水をお願いします。','おちゃと おみずを おねがいします。','Tea and water, please.','お茶 and お水 are established polite beverage words. お is not an algorithm for every borrowed beverage name.'),
 order('Build a polite request for water.',['すみません、','お水を','一杯','お願い','します。'],'すみません、おみずを いっぱい おねがいします。','Excuse me, a glass of water, please.','一杯（いっぱい）counts a glass/cup serving. お水を一杯お願いします is a polite object request.'),
 pairs('Match each group with its established prefix.',[['名前・好き','お'],['住所・親切','ご']],prefixRule),
];
// Equivalent discourse orders reviewed for these specific chunk sets, never globally accepted.
content.l03[5].answer.acceptedOrders.push(['t0','t2','t1','t3','t4']);
content.l03[19].answer.acceptedOrders.push(['t0','t2','t1','t3','t4']);
// Both established readings of 三階 are legitimate in this unconstrained reading task.
content.l01[10].answer.slots[0].acceptedTokenIds.push(content.l01[10].answer.tokens.find(t=>t.text==='さんかい').id);
const hotelTurns = [
 ['staff','いらっしゃいませ。ご予約はございますか。','いらっしゃいませ。ごよやくは ございますか。'],
 ['guest','はい、田中です。','はい、たなかです。'],
 ['staff','田中様ですね。お名前とご住所をこちらにお願いします。','たなかさまですね。おなまえと ごじゅうしょを こちらに おねがいします。'],
 ['guest','はい。部屋は何階ですか。','はい。へやは なんがいですか。'],
 ['staff','お客様のお部屋は三階でございます。朝食は七時から九時まででございます。食堂は一階にございます。','おきゃくさまの おへやは さんがいでございます。ちょうしょくは しちじから くじまででございます。しょくどうは いっかいに ございます。'],
 ['guest','チェックアウトは何時ですか。','ちぇっくあうとは なんじですか。'],
 ['staff','チェックアウトは十時でございます。ほかにご質問はございますか。','ちぇっくあうとは じゅうじでございます。ほかに ごしつもんは ございますか。'],
 ['guest','いいえ、ありません。ありがとうございます。','いいえ、ありません。ありがとうございます。'],
];
content.l04 = [
 model('Learn the word for a guest/customer.','客','きゃく','guest; customer','客（きゃく）refers to a guest or customer. Service address commonly uses お客様.'),
 gap('Turn 客 into respectful guest address.','〔お〕客〔様〕、こちらへどうぞ。','おきゃくさま、こちらへ どうぞ。','This way, please.',['ご','さん'],'お客様 uses both お and 様; address a guest respectfully rather than using あなた.'),
 gap('Build four service prefixes/suffixes.','〔お〕客〔様〕、〔お〕名前と〔ご〕住所をお願いします。','おきゃくさま、おなまえと ごじゅうしょを おねがいします。','May I have your name and address, please?',['ご','お'],prefixRule+' 様 adds respectful address.'),
 table('Compare ordinary and very polite existence.','あります → ございます',['Polite','Service form','Meaning'],[['予約があります。','予約がございます。','There is a reservation.'],['質問はありますか。','ご質問はございますか。','Do you have any questions?']], '予約がございます。ご質問はございますか。','よやくが ございます。ごしつもんは ございますか。',existenceRule),
 choice('Which very polite service question asks whether there is a reservation?',['ご予約はでございますか。','ご予約はございますか。','ご予約は見ますか。'],1,'ご予約はございますか。','ごよやくは ございますか。','Do you have a reservation?',existenceRule),
 choice('Listen. Who is most likely speaking to whom?',['A receptionist to a guest','A child to a close friend','A guest describing their own meal casually'],0,'ご予約はございますか。','ごよやくは ございますか。','Do you have a reservation?','This very polite reservation question fits a staff-to-customer context. Register suggests that relationship; it does not uniquely prove the speaker’s job.'),
 gap('Complete the reservation prefix and existence form.','〔ご〕予約は〔ございます〕か。','ごよやくは ございますか。','Do you have a reservation?',['お','でございます'],existenceRule+' ご予約 is the established prefix form.'),
 model('Compare です with でございます.','お部屋は三階でございます。','おへやは さんがいでございます。','Your room is on the third floor.',copulaRule),
 gap('Complete the very polite identification of the floor.','お部屋は三階〔でございます〕。','おへやは さんがいでございます。','Your room is on the third floor.',['ございます','にございます'],copulaRule+' The supplied text has no location particle に; the task asks for the copula.'),
 order('Listen and build the service sentence about the shop’s floor.',['売店は、','二階','で','ございます。'],'ばいてんは、にかいでございます。','The shop is on the second floor.',copulaRule),
 {renderer:'dialogue',prompt:'Listen to the receptionist and guest. Follow the Japanese dialogue.',dialogue:{japaneseVisible:true,translationVisible:false,context:'Hotel arrival and breakfast information',speakerLabels:{guest:'宿泊客',staff:'フロント係'},speakers:['guest','staff'],
   turns:hotelTurns.map(([speaker,japanese,reading],i)=>({id:`turn-${i+1}`,speaker,japanese,reading,english:null})),
   glosses:[{japanese:'チェックアウト',reading:'ちぇっくあうと',english:'checkout'}]},support:{before:[],after:[]}},
 truth('The receptionist uses respectful guest address and very polite service language.',true,'お客様のお部屋は三階でございます。','おきゃくさまの おへやは さんがいでございます。','Your room is on the third floor.','お客様 is respectful address; でございます is very polite 丁寧語. They serve different grammatical functions.'),
 gap('Complete guest address and the room’s copula from the scene.','〔お客様〕のお部屋は三階〔でございます〕。','おきゃくさまの おへやは さんがいでございます。','Your room is on the third floor.',['あなた','ございます'],copulaRule+' お客様 matches the receptionist’s respectful address.'),
 gap('Complete breakfast hours and dining-room location.','朝食は七時から九時まで〔でございます〕。食堂は一階に〔ございます〕。','ちょうしょくは しちじから くじまででございます。しょくどうは いっかいに ございます。','Breakfast is from seven to nine. The dining room is located on the first floor.',['です','あります'],copulaRule+' '+existenceRule),
 order('Build the receptionist’s question about further questions.',['ほかに、','ご質問は','ございます','か。'],'ほかに、ごしつもんは ございますか。','Do you have any other questions?',existenceRule),
 choice('From the scene, which service reply answers the checkout-time question?',['十時でございます。','九時でございます。','七時でございます。'],0,'チェックアウトは十時でございます。','ちぇっくあうとは じゅうじでございます。','Checkout is at ten.',copulaRule+' Breakfast ends at nine; checkout is at ten. Do not confuse the scene’s two schedules.'),
];
for (let i=11;i<16;i++) content.l04[i].sceneReuse='B2.C05.L04.A02.S01';
content.l04[14].answer.acceptedOrders.push(['t1','t0','t2','t3']);
content.l05 = [
 model('Learn respectful eating and drinking.','召し上がる','めしあがる','to eat/drink (respectful)',respectfulRule+' The polite form is 召し上がります.'),
 gap('Use the respectful polite verb for a guest’s drinking.','お客様はお茶を〔召し上がります〕。','おきゃくさまは おちゃを めしあがります。','The guest drinks tea.',['飲みます','召し上がる'],respectfulRule+' This task requests the respectful polite form; plain 召し上がる does not meet that form instruction.'),
 model('Study a professional service offer.','お茶を召し上がりますか。','おちゃを めしあがりますか。','Would you like some tea?',respectfulRule+' Such respectful language suits staff addressing guests. With friends, ordinary 飲む/飲みます may be appropriate.'),
 choice('Which sentence respectfully asks about a guest’s eating?',['ご飯を食べる？','ご飯を食べますか。','お食事を召し上がりますか。'],2,'お食事を召し上がりますか。','おしょくじを めしあがりますか。','Would you like a meal?','食べる is casual/plain, 食べます is polite and 召し上がります respectfully raises the other person’s action.'),
 order('Listen and build the respectful drink offer.',['お茶を','召し上がり','ます','か。'],'おちゃを めしあがりますか。','Would you like some tea?',respectfulRule),
 model('Learn respectful seeing.','ご覧になる','ごらんになる','to see/look (respectful)',respectfulRule+' The polite form is ご覧になります.'),
 gap('Complete the respectful invitation to look at the artwork.','こちらの絵を〔ご覧になります〕か。','こちらの えを ごらんになりますか。','Would you like to look at this picture?',['召し上がります','お休みになります'],'ご覧になる refers to seeing, not eating or sleeping.'),
 model('Learn respectful sleeping/resting.','お休みになる','おやすみになる','to sleep/rest (respectful)',respectfulRule+' The polite form is お休みになります.'),
 choice('A guest says “もう寝ます。” Which staff reply politely wishes them a restful night?',['ごゆっくりお休みください。','ごゆっくり召し上がってください。','私はお休みになります。'],0,'ごゆっくりお休みください。','ごゆっくり おやすみください。','Please have a good rest.','お休みください suits a guest going to bed. The third option wrongly raises the staff member’s own resting action.'),
 pairs('Match ordinary verbs with respectful counterparts.',[['食べる・飲む','召し上がる'],['見る','ご覧になる'],['寝る・休む','お休みになる']],respectfulRule),
 table('Compare respectful request formation.','Three established requests',['Respectful dictionary form','Request','English'],[['召し上がる','召し上がってください','Please eat/drink.'],['ご覧になる','ご覧ください','Please look.'],['お休みになる','お休みください','Please rest.']], '召し上がってください。ご覧ください。お休みください。','めしあがってください。ごらんください。おやすみください。',requestRule),
 gap('Complete the te form; ください is already supplied.','お茶を、ごゆっくり〔召し上がって〕ください。','おちゃを、ごゆっくり めしあがってください。','Please take your time and enjoy your tea.',['召し上がる','召し上がり'],requestRule+' ごゆっくり politely encourages the guest to take their time.'),
 gap('Complete the request appropriate to the offered food.','こちらのお菓子を〔召し上がって〕ください。','こちらの おかしを めしあがってください。','Please enjoy these sweets.',['ご覧','お休み'],requestRule+' The context asks the guest to eat the offered sweets.'),
 choice('Which established respectful request means “Please look”?',['ご覧になるください。','ご覧ください。','ご覧になってるください。'],1,'ご覧ください。','ごらんください。','Please look.',requestRule),
 gap('Complete the dinner-menu noun and look request.','夕食の〔お品書き〕を〔ご覧〕ください。','ゆうしょくの おしながきを ごらんください。','Please look at the dinner menu.',['お食事','召し上がって'],'お品書き（おしながき）is a menu/list of dishes. ご覧ください asks the guest to look at it.'),
 choice('Listen. What is the guest asked to do?',['Look at the map','Eat dinner','Go to sleep'],0,'こちらの地図をご覧ください。','こちらの ちずを ごらんください。','Please look at this map.',requestRule+' 地図 is a map; the requested action is looking.'),
 gap('Complete the request to read the locker instructions.','ロッカーの使い方を〔ご覧〕ください。','ろっかーの つかいかたを ごらんください。','Please read the instructions for using the locker.',['召し上がって','お休み'],'ご覧ください asks the guest to look/read the displayed instructions. It is not an eating or resting request.'),
 gap('Insert the prefixes for taking your time and resting.','〔ご〕ゆっくり〔お〕休みください。','ごゆっくり おやすみください。','Please have a good rest.',['お','ご'],'ごゆっくり and お休み are the established forms; the two prefixes differ.'),
 order('Build the respectful invitation to rest.',['どうぞ、','ごゆっくり','お休み','ください。'],'どうぞ、ごゆっくり おやすみください。','Please make yourself comfortable and have a good rest.',requestRule),
];
content.l05[18].answer.acceptedOrders.push(['t1','t0','t2','t3']);
// App-authored cumulative assessment: this ordering and one-activity partition are not source observations.
content.cp = [
 structuredClone(content.l01[5]),structuredClone(content.l01[8]),
 typed('Write the kana reading of 三階.','','',['さんがい','さんかい'],'三階','さんがい','third floor','さんがい is common; さんかい is also a used reading. This task explicitly accepts both kana forms.'),
 structuredClone(content.l01[20]),
 choice('Which kanji completes the word for a bedroom: 寝＿?',['庭','性','室'],2,'寝室','しんしつ','bedroom','室 means room. 寝室 is read しんしつ.'),
 choice('Which word refers to family members rather than the home/household?',['家族','家庭','校庭'],0,'家族','かぞく','family members',familyRule),
 structuredClone(content.l02[19]),structuredClone(content.l03[11]),structuredClone(content.l03[7]),structuredClone(content.l03[4]),structuredClone(content.l03[19]),
 structuredClone(content.l04[6]),structuredClone(content.l04[13]),
 choice('Read the hotel information. What time is checkout?',['十時でございます。','九時でございます。','七時でございます。'],0,'チェックアウトは十時でございます。','ちぇっくあうとは じゅうじでございます。','Checkout is at ten.','The supported information gives ten as checkout time; breakfast ends at nine.'),
 structuredClone(content.l04[9]),structuredClone(content.l05[1]),structuredClone(content.l05[6]),structuredClone(content.l05[13]),structuredClone(content.l05[15]),structuredClone(content.l05[18]),
];
content.cp[13].support.before=[jp('朝食は七時から九時まででございます。チェックアウトは十時でございます。','ちょうしょくは しちじから くじまででございます。ちぇっくあうとは じゅうじでございます。')];
for(const s of content.cp)delete s.sceneReuse;

const expected={l01:21,l02:20,l03:21,l04:16,l05:19,cp:20};
const appCount=s=>s.answer?.kind==='ordered_slots'?s.answer.slots.length:s.answer?.kind==='ordered_tokens'?s.answer.tokens.length:s.answer?.kind==='pairs'?s.answer.pairs.length:s.answer?1:0;
fs.mkdirSync(output,{recursive:true});
for(const [key,authored]of Object.entries(content)) {
 const recordId=`B2.C05.${key.toUpperCase()}`,record=records.find(r=>r.recordId===recordId),summary=key==='cp';
 if(!record||authored.length!==expected[key])throw new Error(`Invalid authored count: ${key}`);
 const screens=authored.map((copy,i)=>{
  const source=record.screens[i],teaching=['model','kanji','table','dialogue'].includes(copy.renderer);
  const hidden=summary ? (copy.support.before.length===0&&['choice','ordering'].includes(copy.renderer)&&[0,1,14,18].includes(i)) : source.rawSupport.japanese_transcript_before_answer===false;
  const before=[...copy.support.before];
  if(!summary&&source.rawSupport.japanese_transcript_before_answer===true&&copy.renderer!=='dialogue'&&!before.some(b=>b.kind==='japanese'))before.push(jp(copy.audio.text,copy.audio.reading));
  if(!summary&&source.rawSupport.translation_visible===true&&copy.renderer!=='dialogue'&&!before.some(b=>b.kind==='translation')) {
   const translation=copy.support.after.find(b=>b.kind==='translation');
   if(translation)before.push(translation);
   else if(copy.renderer==='table')before.push(en(copy.table.rows.map(r=>r.cells.at(-1)).join(' ')));
   else if(copy.renderer==='kanji')before.push(en(`${copy.kanji.meaning}. ${copy.kanji.examples.map(e=>e.translation).join(' ')}`));
  }
  const {sceneReuse,...authoredCopy}=copy;
  const sourceContract=summary?{
   purpose:copy.prompt,sourceScreenId:null,sourceRenderer:null,sourceRendererId:null,sourceActivityId:null,sourceExerciseNumber:null,responseSlotCount:null,responseSlotCountState:'unknown',
   transcriptBeforeAnswer:hidden?false:before.some(b=>b.kind==='japanese')?true:null,translationBeforeAnswer:null,hintBeforeAnswer:false,recordedSupport:{},
   feedbackCategories:[],targetConceptIds:[],priorConceptIds:record.curriculum.priorConceptIds,
  }:{purpose:source.purpose,sourceScreenId:source.sourceScreenId,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,
   responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,transcriptBeforeAnswer:source.rawSupport.japanese_transcript_before_answer??(copy.renderer==='model'?true:null),
   translationBeforeAnswer:source.rawSupport.translation_visible,parallelReadingBeforeAnswer:copy.renderer==='model',hintBeforeAnswer:false,recordedSupport:source.rawSupport,...occurrences[source.screenId],...(sceneReuse?{sceneReuse}:{})};
  return {screenId:summary?`${recordId}.A01.S${String(i+1).padStart(2,'0')}`:source.screenId,prompt:null,answer:null,praise:null,...authoredCopy,
   support:{before:hidden?[]:before,after:copy.support.after},audio:{required:summary?hidden:teaching||hidden||source.rawMedia.length>0,text:null,...copy.audio},
   visual:summary?'none':['lexical_model','scene_video'].includes(source.rawRenderer)?'video':source.rawRenderer==='kanji_model'?'image':'none',sourceContract,evidence:summary?record.evidence:source.evidence,unresolved:[]};
 });
 const pack={schemaVersion:'1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:screens.length,
  provenance:{origin:'app_authored',note:summary?'Reviewed app-authored 20-task assessment and one internal activity, based on the retained S10/Unified summary and chapter targets. The blueprint retains the total and mixed hospitality, honorific/pragmatic, typed, ordering, listening and kanji modalities only. No individual source sequence, identity, count or support timing is recovered. All task copy, answer banks, physical response counts, ordering, partition and support policies are explicit app authoring; source fields remain null. Research 100% is not an answer key or owner progress.':'Owner-authorized reviewed chapter 5 production authoring, 5 October 2026. The 97 retained rows preserve canonical and known source screen/activity/exercise identities, physical response counts, support timing, target indexing and dependencies. Literal Japanese, readings, translations, banks, answer equivalence, cultural examples and static kanji teaching are reviewed authoring/adaptation from documented targets, not source quotations. The Japanese-only hotel scene is an authored coherent replacement; eight turns and its exact facts are app choices. Only the documented checkout lexical gloss is represented, using an authored English term rather than a translation layer. All five scene replay links bind the full dialogue. Transcript-free ordering retains response banks. L01 A02.S08 alone repeats once at the final activity boundary outside base counts. No optional production or speaking surface.'},
  policies:{assessment:'One equal-weight outcome per graded base screen. Core completion, first-attempt accuracy and any separate retry outcomes remain distinct. No checkpoint threshold or source unlock rule is inferred.',incorrectResponses:'Existing feedback/Check/token final placement and pair correction rules. The only configured retry is L01 A02.S08 once after the final activity; completion follows the retry even if wrong.',audio:'Existing Japanese TTS and ordered guest/staff scene playback. Hidden scripts and translations appear only in feedback; selectable ordering tokens remain visible. Scene replay is bound only where configured.',visuals:'Original visuals/animation remain deferred; shared replaceable placeholders and complete static kanji shape/readings/context are used.'},
  unresolvedSourceFacts:['Exact source wording, exhaustive accepted alternatives, randomization, media assets and acoustic alignment remain unavailable. Reviewed app copy supplies the learning content.','Source score formula, threshold, retry generality and causal unlock rules remain unknown. Research scores never seed account progress.',...(summary?['Individual source tasks, order, activities, source identities, response counts and support timing remain unknown. structuralContract is explicitly app-owned.']:[])],screens};
 if(key==='l01')pack.retryPolicy={kind:'after_activity_once',screenIds:['B2.C05.L01.A02.S08']};
 if(summary){pack.passPolicy={kind:'none'};pack.structuralContract={version:'1.0',kind:'summary_authored',origin:'app_authored',review:{status:'reviewed',note:'All 20 tasks reviewed for hospitality/kanji/register coverage, physical responses, Japanese/readings, supported and transcript-free listening, typed variants and equivalent chunk orders. One 20-task activity is an app choice.'},activities:[{activityId:`${recordId}.A01`,ordinal:1,sourceActivityIds:[],baseScreenCount:20,screenIds:screens.map(s=>s.screenId)}],tasks:screens.map(s=>({screenId:s.screenId,responseCount:appCount(s)}))};}
 fs.writeFileSync(path.join(output,`b2-c05-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');
}
console.log('Assembled five documented lessons (97 screens) and an explicitly app-authored 20-task checkpoint.');

