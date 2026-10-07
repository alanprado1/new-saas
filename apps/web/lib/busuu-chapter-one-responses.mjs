// Independently reviewed responses, kept apart from the runtime answer mappings.
export const chapterOneResponses = {
  'B2.C01.L04': [[], ['casual'], [], [false], ['kyoto', 'nara', 'destination', 'want'], [], ['especially'], [], ['example'], ['example-stem', 'especially-stem']],
  'B2.C01.L05': [[true], ['formal', 'ya', 'casual', 'toka'], [], ['to-2', 'ka-1', 'to-1', 'ka-2'], ['casual', 'location'], ['japan', 'kyoto', 'nara', 'destination', 'plan'], ['casual-2', 'casual-1']],
  'B2.C01.CP': [['saying', 'coming'], ['humble'], ['where', 'respectful'], ['humble'], ['hotel'], ['example-stem', 'especially-stem'], ['example'], ['casual-1', 'casual-2'],
    ['to-2', 'ka-2', 'to-1', 'ka-1'], ['casual', 'location'], ['japan', 'kyoto', 'nara', 'destination', 'plan'], ['interest', 'culture'], ['nature'], [true]],
};
export const chapterAction = (screen, value, index) => screen.renderer === 'pairs' ? { type: 'pair', side: index % 2 ? 'right' : 'left', id: value }
  : screen.renderer === 'truth' ? { type: 'truth', value } : { type: screen.renderer === 'choice' ? 'choice' : 'token', id: value };
