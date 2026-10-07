// Offline owner-authorized production authoring. Retained structure and released packs are read-only.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../content/busuu');
const output = path.resolve(process.argv[2] ?? root);
const records = JSON.parse(fs.readFileSync(path.join(root, 'b2-structure.json'), 'utf8')).records;
const occurrences = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'busuu-chapter-one-occurrences.json'), 'utf8')).screens;
const jp = (text, secondary) => ({ kind: 'japanese', text, ...(secondary ? { secondary } : {}) });
const en = text => ({ kind: 'translation', text });
const rule = text => ({ kind: 'explanation', text });
const feedback = (text, reading, english, reason) => [jp(text, reading), en(english), rule(reason)];
const model = (prompt, text, reading, english) => ({ prompt, support: { before: [jp(text, reading), en(english)], after: [] }, audio: { text, reading } });
const gaps = (prompt, scaffold, bank, accepted, text, reading, english, reason) => ({ prompt, scaffold,
  answer: { kind: 'ordered_slots', tokens: bank.map(([id, text]) => ({ id, text })),
    slots: accepted.map((ids, i) => ({ id: `gap-${i + 1}`, acceptedTokenIds: Array.isArray(ids) ? ids : [ids] })) },
  support: { before: [], after: feedback(text, reading, english, reason) }, praise: 'Well done!', audio: { text, reading, feedbackText: text } });
const choice = (prompt, options, accepted, text, reading, english, reason) => ({ prompt,
  answer: { kind: 'choice', options: options.map(([id, text]) => ({ id, text })), acceptedOptionIds: [accepted] },
  support: { before: [], after: feedback(text, reading, english, reason) }, praise: 'Well done!', audio: { text, reading, feedbackText: text } });
const truth = (prompt, statement, accepted, text, reading, english, reason) => ({ prompt, statement,
  answer: { kind: 'truth', accepted }, praise: 'Well done!',
  support: { before: [jp(text)], after: feedback(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } });
const order = (prompt, bank, accepted, text, reading, english, reason) => ({ prompt,
  answer: { kind: 'ordered_tokens', tokens: bank.map(([id, text]) => ({ id, text })), acceptedOrders: [accepted] },
  support: { before: [], after: feedback(text, reading, english, reason) }, praise: 'Well done!', audio: { text, reading, feedbackText: text } });

const list = '京都とか奈良とかに行きたいです。', listR = 'きょうととかならとかにいきたいです。';
const discourse = '例えば、京都に行きたいです。特に、日本の伝統的な文化に興味があります。';
const discourseR = 'たとえば、きょうとにいきたいです。とくに、にほんのでんとうてきなぶんかにきょうみがあります。';
const vessels = 'おちょことか升とかで日本酒を飲みます。', vesselsR = 'おちょことかますとかでにほんしゅをのみます。';
const places = '京都とか奈良とかで日本の文化について学びたいです。', placesR = 'きょうととかならとかでにほんのぶんかについてまなびたいです。';
const plan = '日本では、京都とか奈良とかに行くつもりです。', planR = 'にほんでは、きょうととかならとかにいくつもりです。';
const name = '田中と申します。オーストラリアから参りました。', nameR = 'たなかともうします。オーストラリアからまいりました。';
const respectful = 'どちらからいらっしゃいましたか。';
const history = '京都は歴史のある町です。伝統的な文化が残っています。', historyR = 'きょうとはれきしのあるまちです。でんとうてきなぶんかがのこっています。';
const casualReason = 'とか gives examples without an exhaustive list and is conversational. や is more suitable for a neutral or formal list. A polite ending does not make とか formal.';
const discourseReason = '例えば（たとえば）introduces an example; 特に（とくに）adds emphasis. Here ば and に are supplied, so insert the stems 例え and 特.';
const kanaBank = [['ka-2', 'か'], ['to-1', 'と'], ['ka-1', 'か'], ['to-2', 'と']];
const kanaAccepted = [['to-1', 'to-2'], ['ka-1', 'ka-2'], ['to-1', 'to-2'], ['ka-1', 'ka-2']];
const listBank = [['and', 'と'], ['casual', 'とか'], ['neutral', 'や']];
const content = {
  l04: [
    model('Listen and read a conversational list of places to visit.', list, listR, 'I want to go to places such as Kyoto and Nara.'),
    gaps('Listen and complete the conversational list marker.', ['京都', '奈良とかに行きたいです。'], listBank, ['casual'], list, listR,
      'I want to go to places such as Kyoto and Nara.', casualReason),
    { prompt: 'Compare neutral and conversational lists, then listen to the examples.',
      table: { caption: 'Giving examples with や and とか', columns: ['Style', 'Japanese example', 'Reading / meaning'], rows: [
        { id: 'neutral', cells: ['Neutral; suitable for more formal contexts', '京都や奈良に行きたいです。', 'きょうとやならにいきたいです。 / I want to visit places such as Kyoto and Nara.'] },
        { id: 'casual', cells: ['Conversational', list, `${listR} / I want to visit places such as Kyoto and Nara.`] },
        { id: 'omitted', cells: ['Conversational; destination に omitted', '京都とか奈良とか行きたい。', 'きょうととかならとかいきたい。 / I want to visit places like Kyoto and Nara.'] },
      ] }, support: { before: [rule('Both や and とか introduce non-exhaustive noun lists. とか is conversational and can follow the final noun too. In casual speech, the destination に after this とか list may be omitted when the meaning is clear. This does not mean every particle can be omitted in every sentence.')], after: [] },
      audio: { text: `京都や奈良に行きたいです。${list}京都とか奈良とか行きたい。`, reading: `きょうとやならにいきたいです。${listR}きょうととかならとかいきたい。` } },
    truth('Read and listen. Is the statement true or false?', 'とか is the best choice for a very formal list.', false, list, listR,
      'I want to go to places such as Kyoto and Nara.', casualReason),
    order('Build: “I want to go to places such as Kyoto and Nara.” Use the supplied conversational chunks.',
      [['want', '行きたいです。'], ['nara', '奈良とか'], ['destination', 'に'], ['kyoto', '京都とか']], ['kyoto', 'nara', 'destination', 'want'],
      list, listR, 'I want to go to places such as Kyoto and Nara.', 'Place the examples before destination に and 行きたいです. 京都とか奈良とか is a conversational, non-exhaustive list.'),
    model('Listen and read 特に（とくに）, “especially”.', '特に、日本の伝統的な文化に興味があります。', 'とくに、にほんのでんとうてきなぶんかにきょうみがあります。', 'I am especially interested in traditional Japanese culture.'),
    gaps('Listen and complete the word that adds emphasis.', ['', '、日本の伝統的な文化に興味があります。'],
      [['example', '例えば'], ['especially', '特に'], ['next', '次に']], ['especially'],
      '特に、日本の伝統的な文化に興味があります。', 'とくに、にほんのでんとうてきなぶんかにきょうみがあります。',
      'I am especially interested in traditional Japanese culture.', '特に means especially or particularly. Traditional culture includes practices passed down through generations; for example, tea ceremony is one such practice.'),
    model('Listen and read 例えば（たとえば）, “for example”.', '例えば、京都や奈良に行きたいです。', 'たとえば、きょうとやならにいきたいです。', 'For example, I want to go to places such as Kyoto and Nara.'),
    choice('Listen. Which expression introduces an example?', [['next', '次に'], ['especially', '特に'], ['example', '例えば']], 'example',
      '例えば、京都や奈良に行きたいです。', 'たとえば、きょうとやならにいきたいです。', 'For example, I want to go to places such as Kyoto and Nara.', '例えば introduces a concrete example. 特に means especially; 次に means next.'),
    gaps('Listen and complete both adverb stems. ば and に are supplied.', ['', 'ば、京都に行きたいです。', 'に、日本の伝統的な文化に興味があります。'],
      [['especially-stem', '特'], ['next-stem', '次'], ['example-stem', '例え']], ['example-stem', 'especially-stem'], discourse, discourseR,
      'For example, I want to go to Kyoto. I am especially interested in traditional Japanese culture.', discourseReason),
  ],
  l05: [
    truth('Read and listen. Is the statement true or false?', 'The speaker wants to visit Kyoto and Nara, and may also want to visit other places.', true, list, listR,
      'I want to go to places such as Kyoto and Nara.', 'とか lists examples. The speaker has not said that these are the only places they want to visit.'),
    { prompt: 'Match each list to the register it best suits.', left: [{ id: 'formal', text: 'Neutral / more formal' }, { id: 'casual', text: 'Conversational' }],
      right: [{ id: 'toka', text: list, secondary: listR }, { id: 'ya', text: '京都や奈良に行きたいです。', secondary: 'きょうとやならにいきたいです。' }],
      answer: { kind: 'pairs', pairs: [{ id: 'formal-ya', leftId: 'formal', rightId: 'ya' }, { id: 'casual-toka', leftId: 'casual', rightId: 'toka' }] },
      praise: 'Well done!', support: { before: [], after: [rule(casualReason)] } },
    { prompt: 'Listen and learn the names and uses of sake vessels.', table: { caption: 'Vessels used for Japanese sake', columns: ['Vessel', 'Reading', 'Use'], rows: [
      { id: 'ochoko', cells: ['おちょこ', 'おちょこ', 'A small cup used to drink sake.'] },
      { id: 'masu', cells: ['升', 'ます', 'A square measuring box, often wooden; it can also be used to serve or drink sake.'] },
      { id: 'tokkuri', cells: ['徳利', 'とっくり', 'A narrow-necked container used to pour sake into a cup.'] },
    ] }, support: { before: [jp('おちょこや升で日本酒を飲みます。徳利からおちょこに日本酒を注ぎます。', 'おちょこやますでにほんしゅをのみます。とっくりからおちょこににほんしゅをそそぎます。'),
      en('People drink sake from small cups or masu boxes. They pour sake from a tokkuri into a small cup.'),
      rule('These are examples of vessels, not rules for every setting. で marks the vessel used for drinking; から marks the pouring source and に the destination.')], after: [] },
      audio: { text: 'おちょこ。升。徳利。おちょこや升で日本酒を飲みます。徳利からおちょこに日本酒を注ぎます。', reading: 'おちょこ。ます。とっくり。おちょこやますでにほんしゅをのみます。とっくりからおちょこににほんしゅをそそぎます。' } },
    gaps('Build both とか markers, one kana per gap, to list sake vessels.', ['おちょこ', '', '升', '', 'で日本酒を飲みます。'], kanaBank, kanaAccepted,
      vessels, vesselsR, 'People drink sake from vessels such as small cups and masu boxes.', 'Each marker is と + か. The two と tokens and the two か tokens have distinct identities but are interchangeable in the corresponding kana slots.'),
    gaps('Listen and complete the list marker and the particle for where the activity happens.', ['京都', '奈良とか', '日本の文化について学びたいです。'],
      [['destination', 'に'], ['neutral', 'や'], ['location', 'で'], ['casual', 'とか']], ['casual', 'location'], places, placesR,
      'I want to learn about Japanese culture in places such as Kyoto and Nara.', 'とか gives conversational examples. で marks where 学ぶ (learning) happens; に would mark a destination with a movement verb.'),
    order('Build: “In Japan, I plan to go to places such as Kyoto and Nara.”',
      [['plan', '行くつもりです。'], ['nara', '奈良とか'], ['japan', '日本では、'], ['destination', 'に'], ['kyoto', '京都とか']],
      ['japan', 'kyoto', 'nara', 'destination', 'plan'], plan, planR, 'In Japan, I plan to go to places such as Kyoto and Nara.',
      '日本では sets the context. The conversational noun list takes destination に. Dictionary-form 行く + つもりです expresses an intention.'),
    gaps('Listen and complete both markers in the conversational list. Use the casual list form in each gap.', ['京都', '奈良', 'に行きたいです。'],
      [['neutral', 'や'], ['casual-2', 'とか'], ['and', 'と'], ['casual-1', 'とか']], [['casual-1', 'casual-2'], ['casual-1', 'casual-2']],
      list, listR, 'I want to go to places such as Kyoto and Nara.', casualReason),
  ],
  cp: [
    gaps('Listen and complete the humble name and origin forms. ます and ました are supplied.', ['田中と', 'ます。オーストラリアから', 'ました。'],
      [['plain', '来'], ['coming', '参り'], ['respectful', 'いらっしゃい'], ['saying', '申し']], ['saying', 'coming'], name, nameR,
      'My name is Tanaka. I have come from Australia.', '申します humbly introduces your own name; 参りました humbly describes your own arrival. Insert 申し before ます and 参り before ました.'),
    choice('Listen and choose a humble version of “田中です。オーストラリアから来ました。”',
      [['respectful', '田中と申します。オーストラリアからいらっしゃいました。'], ['humble', name], ['casual', '田中だよ。オーストラリアから来たよ。']], 'humble', name, nameR,
      'My name is Tanaka. I have come from Australia.', 'Both 申します and 参りました describe yourself humbly. いらっしゃいました shows respect for another person; the casual alternative does not fit a formal introduction.'),
    gaps('Listen and complete the respectful question word and verb stem.', ['', 'から', 'ましたか。'],
      [['humble', '参り'], ['where', 'どちら'], ['respectful', 'いらっしゃい'], ['who', 'どなた']], ['where', 'respectful'], respectful, respectful,
      'Where have you come from?', 'どちら asks where respectfully. いらっしゃい + ましたか respectfully asks about the guest’s arrival.'),
    gaps('Listen and complete the humble coming stem. ました is supplied.', ['オーストラリアから', 'ました。'],
      [['respectful', 'いらっしゃい'], ['humble', '参り'], ['plain', '来']], ['humble'], 'オーストラリアから参りました。', 'オーストラリアからまいりました。',
      'I have come from Australia.', 'Use humble 参り for your own arrival in a formal setting, before the supplied ました.'),
    choice('Listen. Which setting best fits this conversation?', [['friends', 'Close friends chatting at home'], ['hotel', 'A hotel receptionist welcoming a guest'], ['self', 'Someone talking to themselves']], 'hotel',
      'いらっしゃいませ。どちらからいらっしゃいましたか。オーストラリアから参りました。', 'いらっしゃいませ。どちらからいらっしゃいましたか。オーストラリアからまいりました。',
      'Welcome. Where have you come from? I have come from Australia.', 'A respectful welcome and a humble reply suit a receptionist and guest.'),
    gaps('Listen and complete both discourse stems. ば and に are supplied.', ['', 'ば、京都に行きたいです。', 'に、日本の伝統的な文化に興味があります。'],
      [['especially-stem', '特'], ['next-stem', '次'], ['example-stem', '例え']], ['example-stem', 'especially-stem'], discourse, discourseR,
      'For example, I want to go to Kyoto. I am especially interested in traditional Japanese culture.', discourseReason),
    choice('Listen. Which expression introduces an example?', [['especially', '特に'], ['example', '例えば'], ['next', '次に']], 'example',
      '例えば、京都とか奈良とかに行きたいです。', 'たとえば、きょうととかならとかにいきたいです。', 'For example, I want to go to places such as Kyoto and Nara.', '例えば introduces examples; とか then lists them conversationally.'),
    gaps('Listen and complete both list markers for a conversational register.', ['京都', '奈良', 'に行きたいです。'],
      [['casual-2', 'とか'], ['neutral', 'や'], ['and', 'と'], ['casual-1', 'とか']], [['casual-1', 'casual-2'], ['casual-1', 'casual-2']],
      list, listR, 'I want to go to places such as Kyoto and Nara.', casualReason),
    gaps('List the sake vessels with two とか markers, one kana per gap. おちょこ is a small sake cup; 升（ます）is a box also used for sake.',
      ['おちょこ', '', '升', '', 'で日本酒を飲みます。'], kanaBank, kanaAccepted, vessels, vesselsR,
      'People drink sake from vessels such as small cups and masu boxes.', 'Build とか twice. で marks the vessel used. This reuses the vessel material taught in lesson 5.'),
    gaps('Listen and complete the list marker and activity-location particle.', ['京都', '奈良とか', '日本の文化について学びたいです。'],
      [['location', 'で'], ['destination', 'に'], ['casual', 'とか'], ['neutral', 'や']], ['casual', 'location'], places, placesR,
      'I want to learn about Japanese culture in places such as Kyoto and Nara.', 'Use conversational とか and activity-location で. に is the destination particle for movement, not the place where learning happens here.'),
    order('Build the five-chunk sentence: “In Japan, I plan to go to places such as Kyoto and Nara.”',
      [['destination', 'に'], ['nara', '奈良とか'], ['plan', '行くつもりです。'], ['kyoto', '京都とか'], ['japan', '日本では、']],
      ['japan', 'kyoto', 'nara', 'destination', 'plan'], plan, planR, 'In Japan, I plan to go to places such as Kyoto and Nara.',
      'Set the Japan context first, then list the destinations. に marks the destination, and 行くつもりです states the plan.'),
    gaps('Listen and complete the interest and culture words in the order you hear them.', ['日本に来たのは、', 'のある日本の', 'について学ぶためです。'],
      [['meaning', '意味'], ['culture', '文化'], ['hobby', '趣味'], ['interest', '興味'], ['civilisation', '文明']], ['interest', 'culture'],
      '日本に来たのは、興味のある日本の文化について学ぶためです。', 'にほんにきたのは、きょうみのあるにほんのぶんかについてまなぶためです。',
      'I came to Japan to learn about the Japanese culture that interests me.', '興味（きょうみ）means interest, not 趣味（しゅみ）, hobby, or 意味（いみ）, meaning. 文化（ぶんか）means culture, not 文明（ぶんめい）, civilisation. The relative clause 興味のある modifies 日本の文化; the two words cannot be reversed.'),
    choice('Listen. Which topic is the speaker interested in?', [['history', 'History'], ['nature', 'Nature'], ['culture', 'Traditional culture']], 'nature',
      '自然に興味があります。山や森がある所に行きたいです。', 'しぜんにきょうみがあります。やまやもりがあるところにいきたいです。',
      'I am interested in nature. I want to go somewhere with mountains and forests.', '自然 means nature. Mountains and forests identify the topic; history and traditional culture are different categories.'),
    truth('Read and listen. Is the statement true or false?', 'Traditional culture still remains in Kyoto.', true, history, historyR,
      'Kyoto is a city with a long history. Traditional culture remains there.', '歴史 means history and 伝統的な means traditional. 残っています says that traditional culture remains.'),
  ],
};
const rendererMap = { speaker_model: 'model', word_model: 'model', grammar_table: 'table', culture_table: 'table', text_true_false: 'truth', matching: 'pairs', audio_gap: 'gaps', character_completion: 'gaps', sentence_order: 'ordering', sentence_choice: 'choice', listening_choice: 'choice' };
const provenanceNote = 'Owner-authorized production content (4 October 2026). Canonical sequences, activity identities, recorded response counts/support flags and purpose paraphrases are retained. Target forms とか/や, 特に/例えば, 申す/参る, respectful questions and culture vocabulary are retained targets, not claims of verbatim source sentences. Complete Japanese examples/scaffolds, banks, accepted mappings, readings, translations, tables and feedback are app-authored/adapted from documented targets. Original media and unknown source-only rules remain deferred. L05 historical Speak/Write evidence stays unchanged; current owner policy excludes speaking/pronunciation and exposes optional writing only.';
fs.mkdirSync(output, { recursive: true });
for (const [key, authored] of Object.entries(content)) {
  const recordId = `B2.C01.${key.toUpperCase()}`, record = records.find(r => r.recordId === recordId);
  if (!record || authored.length !== (record.optionalProduction?.coreTeachingScreenCount ?? record.baseScreenCount)) throw new Error('Authored count differs from assigned core sequence');
  const screens = authored.map((copy, i) => {
    const source = record.screens[i], renderer = rendererMap[source.rawRenderer];
    if (!renderer) throw new Error(`Unsupported source renderer ${source.rawRenderer}`);
    const teaching = ['model', 'table'].includes(renderer);
    return { screenId: source.screenId, renderer, prompt: null, answer: null, praise: null, support: { before: [], after: [] }, ...copy,
      audio: { required: teaching || source.rawMedia.length > 0, text: null, ...copy.audio }, visual: source.rawRenderer === 'speaker_model' ? 'video' : 'none',
      sourceContract: { purpose: source.purpose, sourceRenderer: source.rawRenderer, sourceRendererId: source.sourceRendererId,
        sourceActivityId: source.sourceActivityId, responseSlotCount: source.rawResponseSlotCount, responseSlotCountState: source.responseSlotCountState,
        transcriptBeforeAnswer: source.rawSupport.japanese_transcript_before_answer ?? (renderer === 'model' ? true : null),
        translationBeforeAnswer: source.rawSupport.translation_visible, parallelReadingBeforeAnswer: key === 'l04' && i === 0,
        hintBeforeAnswer: false, recordedSupport: source.rawSupport, ...occurrences[source.screenId] },
      evidence: source.evidence, unresolved: [] };
  });
  const pack = { schemaVersion: key === 'l05' ? '1.1' : '1.0', contentVersion: '1.0.0', recordId, status: 'reviewed', baseScreenCount: screens.length,
    provenance: { origin: 'app_authored', note: provenanceNote + ' All ungraded model translations are visible support. Unrecorded translation visibility and required table/model TTS are explicit app choices; original source flags stay unchanged.' },
    policies: { assessment: 'Equal weight per graded core screen. Teaching is ungraded. Finishing all core screens records completion independently of accuracy and pass reporting. Optional writing never affects progress.',
      incorrectResponses: 'App policy: final choice/token placement locks and opens correction. Wrong pairs permit retry while retaining a screen mistake. No end-of-checkpoint retry is added.',
      audio: 'Existing Japanese TTS with authored scripts/readings and source playback gates. Transcript-free listening shows script/translation only after answering.',
      visuals: 'Neutral replaceable slots; original video/images deferred.' },
    unresolvedSourceFacts: ['Exact source wording, exhaustive accepted variants, hidden option order and acoustic quality remain unknown.',
      'Source unlock enforcement, retry/penalty policies and randomization are unproven.',
      ...(key === 'cp' ? ['Source launch said over 80%, but exactly-80 boundary/failure/remediation were not tested. App choice: no pass threshold; optional threshold reporting is configurable independently of core completion.'] : []),
      ...(key === 'l05' ? ['Source post-production/reward behavior was never observed. The app preserves S08 separately as optional local writing, without community submission or draft persistence.'] : [])], screens };
  if (key === 'cp') pack.passPolicy = { kind: 'none' };
  if (key === 'l05') {
    const source = record.screens[7];
    pack.completion = { contractVersion: '1.0', requiredScreenIds: screens.map(s => s.screenId), optionalSurfaces: [{
      screenId: source.screenId, sourceExerciseNumber: source.sourceExerciseNumber, sourceActivityId: source.sourceActivityId, purpose: source.purpose,
      prompt: 'Write about places you would like to visit in Japan and why they interest you.',
      hint: 'Use noun + とか + noun + とか for conversational examples, に for a destination, and 行きたいです or 行くつもりです for a desire or plan. You can add 例えば or 特に and a reason with に興味があります.',
      modes: ['write'], provenance: { origin: 'app_authored', note: 'Adapted personal Japan-visit intention and construction hint. Source optional endpoint identity preserved; speaking excluded by current owner requirement. Local ungraded free writing only.' } }] };
  }
  fs.writeFileSync(path.join(output, `b2-c01-${key}.v1.json`), JSON.stringify(pack, null, 2) + '\n');
}
console.log('Assembled reviewed L04 (10), L05 (7 core + optional writing S08), and CP (14).');
