// Independent reviewed displayed responses; never enumerate the pack's accepted answers.
export const chapterSevenCreationResponses={
 'B2.C07.L01':[
  ['でき'],[],['でき'],[],[true],['で','き','て'],['o0'],['できる'],['先月、','駅の前に','できた','新しい店で','昼ご飯を','食べました。'],['できた','て'],
  ['でき'],[],['o1'],[true],[],['だったら','できます'],['で','き','ま','す'],['準備が','できたら、','出かけ','ましょう。'],
 ],
 'B2.C07.L02':[
  ['で'],[],[true],['に'],['o0'],[],['o1'],['から','を'],['そこまで','は、','電車で','行くことが','できます。'],
  ['に','は','が'],[],['には','が'],[],['o0'],[],['して'],['若者の間','では、','今、','この服が','流行しています。'],['o2'],
 ],
};
export function chapterSevenCreationAction(screen,value,index,state){
 if(screen.renderer==='truth')return {type:'truth',value};
 if(screen.renderer==='choice')return {type:'choice',id:value};
 if(screen.renderer==='typed')return {type:'typed_draft',text:value};
 const id=screen.answer.tokens.find(t=>t.text===value&&!state.slots.includes(t.id))?.id;
 if(!id)throw Error(`${screen.screenId}: missing independently reviewed response ${value}`);
 return {type:'token',id};
}
