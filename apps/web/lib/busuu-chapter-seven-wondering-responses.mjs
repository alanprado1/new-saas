// Independently authored reviewed response paths; never derived from runtime answer mappings.
export const chapterSevenWonderingResponses = {
 'B2.C07.L05': [
  ['かな'],[],[true],['かな'],['か','な'],[],[true],['は','いつ'],
  ['明日、','私と','一緒に','来られる','かな。'],['o0'],[],[true],['来ない'],[],
  ['願ったら','いい'],['の','か','な'],['o0'],['京都に','は、','いつ','行った方が','いいかな。'],
 ],
 'B2.C07.CP': [
  ['から','きっと'],[true],['の','か','な'],['京都に','は、','いつ','行った方が','いいかな。'],
  ['o0'],[true],['o0'],['若い人の間で','は、','この服が','流行して','います。'],['o0'],['流して'],
  ['きっと','おいしい','と思います。','ぜひ','食べてみて','ください。'],['お気に入り','に'],['行ってみて'],[true],['の'],
  ['駅の近くに','できた','新しい店は、','前の店より','ずっと','大きいです。'],['できた','みません'],
  ['駅まで','は、','バスで','行くことが','できます。'],['だったら','できて'],['準備が','できたら、','すぐに','出発しましょう。'],
 ],
};
export function chapterSevenAction(screen, value, index, state) {
 if(screen.renderer==='truth')return {type:'truth',value};
 if(screen.renderer==='choice')return {type:'choice',id:value};
 if(screen.renderer==='typed')return {type:'typed_draft',text:value};
 if(screen.renderer==='pairs')return {type:'pair',side:index%2?'right':'left',id:value};
 if(screen.renderer==='multi_choice')return {type:'toggle_option',id:value};
 const id=screen.answer.tokens.find(t=>t.text===value&&!state.slots.includes(t.id))?.id;
 if(!id)throw new Error(`${screen.screenId}: missing reviewed response ${value}`);
 return {type:'token',id};
}
