// Independently specified canonical responses, by reviewed displayed words/positions.
// Never enumerate runtime accepted mappings to generate a passing path.
export const chapterFourResponses = {
 'B2.C04.L01': [[],['ち','ます','っ','て'],[],['つもり'],['勝つ','つもり'],['明日の','試合に','勝つ','つもりです。'],[],['o1'],[],['負けない','つもり'],
  ['週末は、','何を','する','つもり','ですか。'],[false],['o1'],[],['l0','r0','l1','r1'],['o1'],['つもりでした','負けました'],['つもり'],['負けました','つもりです'],['週末は、','サッカーを','しない','つもり','です。']],
 'B2.C04.L02': [[],['応援'],['応援','して'],[],['弱い'],['強い','弱い'],['o1'],[],['o1'],['惜し','かった'],[],['残念'],[],['残念','でした'],[],['o1'],['o1'],['昨日の試合は、','惜しかった','ですが、','今日は','勝ちました。'],['残念でした','応援します']],
 'B2.C04.L03': [[],[],['l0','r0','l1','r1'],[],['れ'],['れ'],[],['ろ'],['o0'],[],['しろ'],['o2'],['べ'],['o1'],['o0'],['れ'],['最後まで、','全力で','走れ！'],['行け']],
 'B2.C04.L04': [[],['o0'],[],['o2'],[],['点'],['点','勝','点','負'],[],['o1'],[],['球'],['野','球','一','位','勝'],['l0','r0','l1','r1','l2','r2'],['o0'],['点','点'],['勝って','負けて'],['o1'],['方位','北'],['o0'],['地球','半球'],['良い点','悪い点']],
 'B2.C04.L05': [['うちに'],['l0','r0','l1','r1','l2','r2'],[],['o0'],['うちに','興味'],['勉強し','続けて'],[true],['私も、','小さな','ゲームを','自分で','作って','みたい','です。'],[],['l0','r0','l1','r1','l2','r2'],['o0'],['o0','o2'],['o0'],['o0'],['やった','点'],['o0']],
 'B2.C04.CP': [['良い点','悪い点'],['いけ'],['最後まで、','全力で','走れ！'],['o0'],['週末は、','サッカーを','しない','つもり','です。'],['つもり'],['つもりでした','負けました'],[false],['負けました','つもりです'],['負けない','つもり'],['うちに'],['野','球','一','位','勝'],['惜し','かった'],['しろ'],['o2'],['o1'],['o1'],['昨日の試合は、','惜しかった','ですが、','今日は','勝ちました。'],['残念でした','応援します'],['残念','でした']],
};
export function chapterFourAction(screen, value, index, state) {
 if (screen.renderer === 'truth') return {type:'truth',value};
 if (screen.renderer === 'choice') return {type:'choice',id:value};
 if (screen.renderer === 'multi_choice') return {type:'toggle_option',id:value};
 if (screen.renderer === 'typed') return {type:'typed_draft',text:value};
 if (screen.renderer === 'pairs') return {type:'pair',side:index % 2 ? 'right' : 'left',id:value};
 const id=screen.answer.tokens.find(t=>t.text===value && !state.slots.includes(t.id))?.id;
 if (!id) throw new Error(`${screen.screenId}: missing reviewed response ${value}`);
 return {type:'token',id};
}
