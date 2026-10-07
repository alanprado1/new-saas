// Independent displayed-response review; never derive this fixture from accepted mappings.
export const chapterSixEmphasisResponses = {
 'B2.C06.L04':[
  ['枚'],[],['o0'],[],[false],[],['も'],[],[true],['に','も'],
  [],['o1'],['を','も'],['o1'],['昨日、','お茶を','六杯','も','飲みました。'],['回'],['も'],['杯','本'],['東京へ','行くとき、','三回','も','乗り換えました。'],
 ],
 'B2.C06.L05':[
  [],['客'],[],['o0'],[],['l0','r0','l1','r1'],[],['o1'],['l0','r0','l1','r1','l2','r2'],['客','観','光'],
  [],['o1'],['遠','町','光'],['遠','観光'],[],['o1'],['お茶を','二杯','お願い','します。'],['杯'],['観','客','杯'],['遠くない','観光客'],
 ],
};
export function chapterSixEmphasisAction(screen,value,index,state) {
 if(screen.renderer==='truth')return {type:'truth',value};
 if(screen.renderer==='choice')return {type:'choice',id:value};
 if(screen.renderer==='typed')return {type:'typed_draft',text:value};
 if(screen.renderer==='pairs')return {type:'pair',side:index%2?'right':'left',id:value};
 const id=screen.answer.tokens.find(t=>t.text===value&&!state.slots.includes(t.id))?.id;
 if(!id)throw new Error(`${screen.screenId}: missing reviewed response ${value}`);
 return {type:'token',id};
}
