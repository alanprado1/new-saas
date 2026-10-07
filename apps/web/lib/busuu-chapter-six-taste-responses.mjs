// Independently specified reviewed responses; never derive these from accepted runtime mappings.
export const chapterSixTasteResponses={
 'B2.C06.L01':[[],[],[],[],[],[],[],['甘くて','酸っぱい'],[],['辛く'],[],['甘','辛'],['食べられ'],['苦かった'],['o1'],[],['酸っぱくて','塩辛い'],[],['o1']],
 'B2.C06.L02':[['o0'],['脂','っこい'],['甘い'],['薬味','辛い'],['油で','揚げられた','料理は','脂っこいです。'],['油','料理'],['o0']],
 'B2.C06.L03':[[],['やすい'],[],['食べ','やすい'],[],[false],['にくい'],['座り','にくい'],['o0'],['o0'],[],['案内'],['分かり','やすかった'],[],['分かりやすい'],['分かりやすく'],['分かりやすく'],['説明が','分かりにくかった','ので、','もう一度','言って','ください。']],
};
export function chapterSixTasteAction(screen,value,index,state){
 if(screen.renderer==='truth')return {type:'truth',value};
 if(screen.renderer==='choice')return {type:'choice',id:value};
 if(screen.renderer==='typed')return {type:'typed_draft',text:value};
 if(screen.renderer==='pairs')return {type:'pair',side:index%2?'right':'left',id:value};
 const id=screen.answer.tokens.find(t=>t.text===value&&!state.slots.includes(t.id))?.id;
 if(!id)throw new Error(`${screen.screenId}: missing reviewed response ${value}`);
 return {type:'token',id};
}
