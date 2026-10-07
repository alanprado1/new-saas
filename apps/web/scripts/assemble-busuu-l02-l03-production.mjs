// Owner-authorized production copy. Retained v1 observations remain immutable inputs.
// Run from any directory; no external evidence, network, TTS or database writes required.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu');
const output = path.resolve(process.argv[2] ?? root);
const japanese = (text, secondary) => ({ kind: 'japanese', text, ...(secondary ? { secondary } : {}) });
const translation = text => ({ kind: 'translation', text });
const explanation = text => ({ kind: 'explanation', text });
const model = (prompt, text, reading, english) => ({ prompt,
  support: { before: [japanese(text, reading), translation(english)], after: [] }, audio: { text, reading } });
const feedback = (text, reading, english, rule) => [japanese(text, reading), translation(english), explanation(rule)];
const gaps = (prompt, scaffold, bank, accepted, text, reading, english, rule, extra = {}) => ({ prompt, scaffold,
  answer: { kind: 'ordered_slots', tokens: bank.map(([id, text]) => ({ id, text })),
    slots: accepted.map((id, i) => ({ id: `gap-${i + 1}`, acceptedTokenIds: [id] })) },
  support: { before: [], after: feedback(text, reading, english, rule) }, praise: 'Well done!',
  audio: { text, reading, feedbackText: text }, ...extra });
const choice = (prompt, options, accepted, text, reading, english, rule) => ({ prompt,
  answer: { kind: 'choice', options: options.map(([id, text]) => ({ id, text })), acceptedOptionIds: [accepted] },
  support: { before: [], after: feedback(text, reading, english, rule) }, praise: 'Well done!',
  audio: { text, reading, feedbackText: text } });

const question = 'どちらからいらっしゃいましたか。';
const questionReading = 'どちらからいらっしゃいましたか。';
const interest = '日本の文化に興味があります。';
const interestReading = 'にほんのぶんかにきょうみがあります。';
const history = '京都は歴史のある町です。';
const historyReading = 'きょうとはれきしのあるまちです。';
const tradition = '京都は歴史のある町です。伝統的な文化が残っています。';
const traditionReading = 'きょうとはれきしのあるまちです。でんとうてきなぶんかがのこっています。';
const nature = '自然が豊かな所に行きたいです。';
const request = '日本の文化に興味があります。おすすめの博物館を教えてください。';
const requestReading = 'にほんのぶんかにきょうみがあります。おすすめのはくぶつかんをおしえてください。';

const content = {
  l02: [
    model('Listen to a respectful way to ask where someone has come from.', question, undefined, 'Where have you come from?'),
    gaps('Listen and complete the respectful question about where the guest has come from.', ['', 'からいらっしゃいましたか。'],
      [['when', 'いつ'], ['where', 'どちら'], ['who', 'どなた']], ['where'], question, questionReading, 'Where have you come from?',
      'どちら is a respectful way to ask where. から marks the starting place; いらっしゃいました is the respectful past form of 来る here.'),
    { prompt: 'Listen and compare whose action each form describes.',
      table: { caption: 'Coming: humble for yourself, respectful for the person you address',
        columns: ['Whose action?', 'Register', 'Japanese example', 'Reading / meaning'], rows: [
          { id: 'self', cells: ['My own', 'Humble', '私はオーストラリアから参りました。', 'わたしはオーストラリアからまいりました。 / I have come from Australia.'] },
          { id: 'other', cells: ['The guest’s', 'Respectful', question, 'どちらからいらっしゃいましたか。 / Where have you come from?'] },
        ] }, support: { before: [explanation('Use 参る humbly for your own coming or going. Use いらっしゃる respectfully for the other person’s coming, going or presence; here the question asks about their origin.')], after: [] },
      audio: { text: `私はオーストラリアから参りました。${question}`, reading: `わたしはオーストラリアからまいりました。${questionReading}` } },
    { prompt: 'Match each person to the appropriate verb form for “came” in a formal introduction.',
      left: [{ id: 'self', text: 'My own action' }, { id: 'other', text: 'The guest’s action' }],
      right: [{ id: 'respectful', text: 'いらっしゃいました' }, { id: 'humble', text: '参りました', secondary: 'まいりました' }],
      answer: { kind: 'pairs', pairs: [{ id: 'self-humble', leftId: 'self', rightId: 'humble' }, { id: 'other-respectful', leftId: 'other', rightId: 'respectful' }] },
      praise: 'Well done!', support: { before: [], after: [explanation('参りました is humble language for your own action. いらっしゃいました respectfully describes the guest’s action. Both end in the polite past ました.')] } },
    gaps('Listen and complete the respectful verb stem. The ending ましたか is already supplied.', ['どちらから', 'ましたか。'],
      [['humble-stem', '参り'], ['respectful-stem', 'いらっしゃい'], ['plain-stem', '来']], ['respectful-stem'], question, questionReading, 'Where have you come from?',
      'The respectful stem is いらっしゃい: いらっしゃい + ました + か. 参り is humble and refers to your own action, so it does not fit this question to a guest.',
      { hint: { text: 'You are asking about the guest’s action. Choose the respectful form of 来る, rather than the humble form for yourself.' } }),
    choice('Choose the respectful version of “どこから来ましたか。” when addressing a guest.',
      [['humble-question', 'どちらから参りましたか。'], ['plain-question', 'どこから来たの。'], ['respectful-question', question]], 'respectful-question',
      question, questionReading, 'Where have you come from?', 'どちら and いらっしゃいました show respect for the guest. 参りました is humble self-reference; 来たの is casual.'),
    gaps('Listen and complete both the respectful question word and the verb stem.', ['', 'から', 'ましたか。'],
      [['humble-stem', '参り'], ['where', 'どちら'], ['respectful-stem', 'いらっしゃい'], ['who', 'どなた']], ['where', 'respectful-stem'],
      question, questionReading, 'Where have you come from?', 'どちら asks where respectfully. いらっしゃい combines with the supplied ましたか to ask about the other person’s coming.'),
    choice('Listen. In which situation would this exchange be most appropriate?',
      [['friends', 'Close friends chatting casually at home'], ['hotel', 'A hotel receptionist welcoming a guest'], ['self-talk', 'Someone talking to themselves']], 'hotel',
      'ようこそ。どちらからいらっしゃいましたか。オーストラリアから参りました。',
      'ようこそ。どちらからいらっしゃいましたか。オーストラリアからまいりました。',
      'Welcome. Where have you come from? I have come from Australia.',
      'The respectful question and humble reply suit a formal welcome, such as a hotel reception. Close friends would usually use more casual language.'),
    gaps('Listen to the guest’s reply and complete the humble verb stem. ました is supplied.', ['私はオーストラリアから', 'ました。'],
      [['plain-stem', '来'], ['respectful-stem', 'いらっしゃい'], ['humble-stem', '参り']], ['humble-stem'],
      '私はオーストラリアから参りました。', 'わたしはオーストラリアからまいりました。', 'I have come from Australia.',
      'In a formal introduction, 参りました humbly describes your own coming. Use いらっしゃいました to show respect for another person’s action.'),
  ],
  l03: [
    model('Listen to how someone describes an interest in Japanese culture.', interest, undefined, 'I am interested in Japanese culture.'),
    gaps('Listen and choose the word you hear.', ['日本の文化に', 'があります。'],
      [['hobby', '趣味'], ['interest', '興味'], ['meaning', '意味']], ['interest'], interest, interestReading, 'I am interested in Japanese culture.',
      '興味 is read きょうみ; 趣味 is しゅみ (hobby), and 意味 is いみ (meaning). The pattern topic + に興味があります means “I am interested in [topic]”.'),
    model('Listen and read the example with 歴史（れきし）, “history”.', history, historyReading, 'Kyoto is a city with a long history.'),
    { prompt: 'Listen and read. Is the English statement true or false?', statement: 'Kyoto has no traditional culture left.',
      answer: { kind: 'truth', accepted: false }, praise: 'Well done!', support: { before: [japanese(tradition)],
        after: feedback(tradition, traditionReading, 'Kyoto is a city with a long history. Traditional culture remains there.',
          'False: 残っています means “remains”. The text says traditional culture still exists there, rather than saying it has disappeared.') },
      audio: { text: tradition, reading: traditionReading, feedbackText: tradition } },
    gaps('Listen and complete the two words about history and tradition.', ['京都は', 'のある町です。', '的な文化が残っています。'],
      [['nature', '自然'], ['tradition', '伝統'], ['history', '歴史'], ['interest', '興味']], ['history', 'tradition'],
      tradition, traditionReading, 'Kyoto is a city with a long history. Traditional culture remains there.',
      '歴史（れきし）means history. 伝統（でんとう）combines with 的な to make 伝統的な, “traditional”, describing 文化（ぶんか）.'),
    model('Listen and read how someone describes a place they want to visit.', nature, undefined, 'I want to go somewhere rich in nature.'),
    gaps('Listen and complete the word in this new context.', ['日本の伝統的な', 'についてもっと知りたいです。'],
      [['history', '歴史'], ['culture', '文化'], ['nature', '自然']], ['culture'],
      '日本の伝統的な文化についてもっと知りたいです。', 'にほんのでんとうてきなぶんかについてもっとしりたいです。',
      'I want to learn more about traditional Japanese culture.', '文化（ぶんか）means culture. について means “about”, and 知りたい expresses wanting to know or learn.'),
    choice('Listen. Which topic is the speaker interested in?',
      [['history', 'History'], ['nature', 'Nature'], ['culture', 'Traditional culture']], 'nature',
      '自然に興味があります。山や森がある所に行きたいです。', 'しぜんにきょうみがあります。やまやもりがあるところにいきたいです。',
      'I am interested in nature. I want to go somewhere with mountains and forests.',
      '自然（しぜん）means nature. Mountains and forests explain the speaker’s interest; 山や森がある modifies 所, the place they want to visit.'),
    { prompt: 'Listen to the guest and receptionist. Follow the English dialogue.',
      dialogue: { japaneseVisible: false, speakers: ['guest', 'staff'], turns: [
        { id: 'staff-1', speaker: 'staff', japanese: 'いらっしゃいませ。どちらからいらっしゃいましたか。', english: 'Welcome. Where have you come from?' },
        { id: 'guest-1', speaker: 'guest', japanese: 'オーストラリアから参りました。', english: 'I have come from Australia.' },
        { id: 'staff-2', speaker: 'staff', japanese: '日本ではどんな所に行きたいですか。', english: 'What kind of places would you like to visit in Japan?' },
        { id: 'guest-2', speaker: 'guest', japanese: request, english: 'I am interested in Japanese culture. Please tell me about a museum you recommend.' },
        { id: 'staff-3', speaker: 'staff', japanese: 'この近くに、日本の歴史や伝統的な文化を紹介する博物館があります。', english: 'Nearby, there is a museum that introduces Japanese history and traditional culture.' },
        { id: 'guest-3', speaker: 'guest', japanese: 'ありがとうございます。自然が豊かな所にも行きたいです。', english: 'Thank you. I would also like to go somewhere rich in nature.' },
        { id: 'staff-4', speaker: 'staff', japanese: 'それでしたら、山や森がある公園もおすすめです。', english: 'In that case, I also recommend a park with mountains and forests.' },
        { id: 'guest-4', speaker: 'guest', japanese: 'ぜひ行ってみたいです。', english: 'I would love to visit.' },
      ] }, support: { before: [], after: [] }, audio: { text: null } },
    gaps('Listen again to the guest’s request from the hotel scene and complete both gaps.', ['日本の文化に', 'があります。おすすめの博物館を教えて', '。'],
      [['hobby', '趣味'], ['request', 'ください'], ['interest', '興味'], ['past', 'ました']], ['interest', 'request'],
      request, requestReading, 'I am interested in Japanese culture. Please tell me about a museum you recommend.',
      'に興味があります expresses the guest’s interest. 教えてください is a polite request for information: the て-form of 教える plus ください. The receptionist uses respectful language for the guest; the guest uses 参りました humbly for their own arrival.'),
  ],
};

fs.mkdirSync(output, { recursive: true });
for (const [lesson, authored] of Object.entries(content)) {
  const pack = JSON.parse(fs.readFileSync(path.join(root, `b2-c01-${lesson}.v1.json`), 'utf8'));
  if (authored.length !== pack.baseScreenCount) throw new Error('Authoring must preserve the recorded sequence.');
  pack.contentVersion = '1.1.0'; pack.status = 'reviewed';
  pack.provenance = { origin: 'app_authored', note: 'Owner-authorized production authoring under Japanese-App-Implementation-Policy.md (4 October 2026). Canonical sequence, source contracts, support timing, target forms and evidence references are retained from v1. All complete prompts, Japanese examples/scaffolds/dialogue, banks, answer mappings, English translations, readings, hints and feedback are app-authored from those targets; purpose descriptions are documented paraphrases. Retained forms include どちら, いらっしゃる, humble 参る, に興味がある and culture/history/nature vocabulary. No complete source-exact lesson sentences were available; authored copy is not claimed as a source observation or a test fixture. Fixed banks/order, distractors and accepted mappings are app choices. Original media and unknown source-only behavior remain separate, nonblocking facts.' };
  pack.policies.assessment = 'Shared server evaluation with equal weight per graded screen; models, tables and dialogue are ungraded. All required screens must finish for saved completion. Source grading weights/pass rules remain unknown.';
  pack.policies.audio = 'Existing Japanese TTS options with authored scripts/readings. Dialogue uses ordered guest/staff turns with English support, no visible Japanese transcript, and the existing full-sequence Continue gate. Original source media remains deferred.';
  pack.provenance.note += ' Where model English visibility is unrecorded (L03 nature model), showing the authored translation alongside Japanese is an app presentation choice; recorded support flags remain unchanged.';
  pack.screens = pack.screens.map((s, i) => ({ ...s, ...authored[i],
    audio: { ...s.audio, ...authored[i].audio }, unresolved: [] }));
  fs.writeFileSync(path.join(output, `b2-c01-${lesson}.v2.json`), JSON.stringify(pack, null, 2) + '\n');
}
console.log('Assembled reviewed L02/L03 v1.1.0 production packs (9/10 screens).');
