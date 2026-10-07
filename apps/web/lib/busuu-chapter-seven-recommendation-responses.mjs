// Independently reviewed displayed responses. Do not enumerate accepted answer mappings.
export const chapterSevenRecommendationResponses = {
 'B2.C07.L03': [
  [], ['おすすめ'], ['お','す','す','め'], [], [true], [], ['きっと'], ['き','っ','と'],
  ['これは','おすすめ','の','料理','です。'], ['から','きっと'],
  [], ['ぜひ'], ['に','は'], ['ぜひ'], [], ['の'], [], [true], ['お気に入り','に'],
  ['きっと','この映画が','好きだと','思います。','ぜひ','観てみてください。'],
 ],
 'B2.C07.L04': [
  [], ['o1'], [], ['o1'], [], ['流'], [], ['o1'], [], ['園'],
  ['l0','r0','l1','r1','l2','r2'], ['雪'], ['景','色'], [], ['雪景色'], ['流','行'], ['o0'],
  ['動','物','園'], ['流して'], ['詳しくは、','公式','サイトを','ご覧ください。'],
 ],
};
export function chapterSevenRecommendationAction(screen,value,index,state) {
 if(screen.renderer==='truth')return {type:'truth',value};
 if(screen.renderer==='choice')return {type:'choice',id:value};
 if(screen.renderer==='typed')return {type:'typed_draft',text:value};
 if(screen.renderer==='pairs')return {type:'pair',side:index%2?'right':'left',id:value};
 const id=screen.answer.tokens.find(t=>t.text===value&&!state.slots.includes(t.id))?.id;
 if(!id)throw new Error(`${screen.screenId}: missing reviewed response ${value}`);
 return {type:'token',id};
}
