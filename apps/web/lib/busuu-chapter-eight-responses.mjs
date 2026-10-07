import {chapterEightCertaintyResponses} from './busuu-chapter-eight-certainty-responses.mjs';
import {chapterEightBodyFoodResponses} from './busuu-chapter-eight-body-food-responses.mjs';
import {chapterEightGiftFluencyResponses} from './busuu-chapter-eight-gift-fluency-responses.mjs';
import {chapterEightCheckpointResponses} from './busuu-chapter-eight-checkpoint-responses.mjs';
export const chapterEightResponses={...chapterEightCertaintyResponses,...chapterEightBodyFoodResponses,...chapterEightGiftFluencyResponses,...chapterEightCheckpointResponses};
export function chapterEightActions(screen,value,index,state){
 if(screen.renderer==='truth')return [{type:'truth',value}];
 if(screen.renderer==='choice')return [{type:'choice',id:value}];
 if(screen.renderer==='typed')return [{type:'typed_draft',text:value}];
 if(screen.renderer==='pairs'){
  const left=screen.left.find(t=>t.text===value[0]),right=screen.right.find(t=>t.text===value[1]);
  if(!left||!right)throw Error(`${screen.screenId}: missing independently specified pair ${value}`);
  return [{type:'pair',side:'left',id:left.id},{type:'pair',side:'right',id:right.id}];
 }
 const id=screen.answer.tokens.find(t=>t.text===value&&!state.slots.includes(t.id))?.id;
 if(!id)throw Error(`${screen.screenId}: missing independently reviewed response ${value}`);
 return [{type:'token',id}];
}
