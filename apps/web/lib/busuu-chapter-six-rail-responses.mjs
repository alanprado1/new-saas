// Independently specified reviewed displayed responses; never generated from accepted mappings.
export const chapterSixRailResponses={
 'B2.C06.L06':[
  ['にくい'],[],['o1'],['行った','やすい'],['参ります'],[],['女性','でございます'],['l0','r0','l1','r1','l2','r2'],
  [],[true],['終点','参ります'],['お','様','ご'],['o0'],['乗り換え'],['お出口は','右側','で','ございます。'],
 ],
 'B2.C06.CP':[
  ['一日に','五回も','この店に','食べに','来ました。'],['昨日は','コーヒーを','五杯も','飲んで','しまいました。'],['も'],['杯','本'],['客','観','光'],['女性','でございます'],['乗り換え'],
  ['o0'],['o1'],['甘','すっぱ'],['観','客','杯'],[true],['にくい'],['日本で','作られた','このお菓子は、','甘いです。'],['脂っこい','すっぱい'],['甘い'],['o2'],['甘く','辛く'],['やすく'],['説明が','分かりにくかった','ので、','もう一度','説明して','ください。'],
 ],
};
export function chapterSixRailAction(screen,value,index,state){
 if(screen.renderer==='truth')return{type:'truth',value};
 if(screen.renderer==='choice')return{type:'choice',id:value};
 if(screen.renderer==='typed')return{type:'typed_draft',text:value};
 if(screen.renderer==='pairs')return{type:'pair',side:index%2?'right':'left',id:value};
 const id=screen.answer.tokens.find(t=>t.text===value&&!state.slots.includes(t.id))?.id;
 if(!id)throw new Error(`${screen.screenId}: missing reviewed response ${value}`);
 return{type:'token',id};
}
