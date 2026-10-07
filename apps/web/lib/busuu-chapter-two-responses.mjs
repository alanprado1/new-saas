// Independent reviewed expected responses, in canonical activity/screen order.
// These are not derived from runtime answer keys. Repeated words use separate physical tokens.
export const chapterTwoResponses = {
  'B2.C02.L01': [[], ['悲観的'], [], ['まじめ'], [], ['o2'], ['がんこ'], ['じつは'], [false], ['がんこ', 'じつは']],
  'B2.C02.L02': [[], ['o0'], [], ['o1'], [], ['o0'], ['実','自','然','参'], [], ['o2'], [], ['o2'], ['l0','r0','l1','r1'],
    [], ['実','優','優'], ['実と','申します。','大阪から','参りました。'], ['例','自','特','実'], ['o0'], ['l0','r0','l1','r1','l2','r2'], ['例','特'], ['o1'], ['特急','参りました']],
  'B2.C02.L03': [[], ['寒'], [], ['暑がり'], ['o2'], ['o1'], ['l0','r0','l1','r1'], [true], ['怖がり'], ['じつは','恥ずかしがり']],
  'B2.C02.L04': [[], ['のんびり','しています'], ['兄は','のんびり','しています。'], [], ['性格'], ['お姉さん','は','どんな','性格','ですか。'], [], [true], ['性格','よく'], ['o1']],
  'B2.C02.L05': [[], ['o0'], ['自分','甘い'], ['に','は','に','は'], ['o1'], [], [false], [], ['読めない'], ['o0']],
  'B2.C02.L06': [['まじめ','優しい'], [false], ['o1'], ['まじめ','のんびり'], ['o1'], ['空気','読めない'], ['やさしい'], ['のんびり','していますが、','妹は','じつは','まじめ','です。']],
  'B2.C02.L07': [[], ['o0'], [], ['o1'], ['優しい','怖い'], [], ['o2'], [], ['o1'], ['l0','r0','l1','r1'], ['l0','r0','l1','r1','l2','r2'], [], ['o1'],
    ['田','然','悪','実'], [], ['最悪','最高'], ['俳優','優しい'], ['o1'], ['寒','優','俳','優','実'], ['さむ','あつ'], ['こわ']],
  'B2.C02.CP': [['こわ'], ['実と','申します。','大阪支店','から','参りました。'], ['じつは','恥ずかしがり'], ['o1'], ['性格','よく'], ['お姉さん','は','どんな','性格','ですか。'], ['o0'], ['まじめ'], ['がんこ','じつは'], [false], ['あまい'], ['空気','読めない'], ['のんびり','していますが、','妹は','じつは','まじめ','です。'], ['まじめ','のんびり'], ['o3'], ['o0'], [false], ['o1'], ['に','は','に','は'], ['読めない']],
};
export function chapterTwoAction(screen, value, index, state) {
  if (screen.renderer === 'truth') return { type: 'truth', value };
  if (screen.renderer === 'choice') return { type: 'choice', id: value };
  if (screen.renderer === 'typed') return { type: 'typed_draft', text: value };
  if (screen.renderer === 'pairs') return { type: 'pair', side: index % 2 ? 'right' : 'left', id: value };
  const id = screen.answer.tokens.find(t => t.text === value && !state.slots.includes(t.id))?.id;
  if (!id) throw new Error(`${screen.screenId}: expected response word missing: ${value}`);
  return { type: 'token', id };
}
