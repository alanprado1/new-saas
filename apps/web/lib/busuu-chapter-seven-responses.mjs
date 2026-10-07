// Independent reviewed response fixtures; no runtime answer-key enumeration.
import {chapterSevenCreationResponses} from './busuu-chapter-seven-creation-responses.mjs';
import {chapterSevenRecommendationResponses} from './busuu-chapter-seven-recommendation-responses.mjs';
import {chapterSevenWonderingResponses} from './busuu-chapter-seven-wondering-responses.mjs';
export const chapterSevenResponses={...chapterSevenCreationResponses,...chapterSevenRecommendationResponses,...chapterSevenWonderingResponses};
export function chapterSevenAction(screen,value,index,state){
 if(screen.renderer==='truth')return{type:'truth',value};
 if(screen.renderer==='choice')return{type:'choice',id:value};
 if(screen.renderer==='typed')return{type:'typed_draft',text:value};
 if(screen.renderer==='pairs')return{type:'pair',side:index%2?'right':'left',id:value};
 const id=screen.answer.tokens.find(t=>t.text===value&&!state.slots.includes(t.id))?.id;
 if(!id)throw new Error(`${screen.screenId}: missing independently reviewed response ${value}`);
 return{type:'token',id};
}
