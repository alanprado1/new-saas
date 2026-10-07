import {chapterNineServiceVocabularyResponses} from './busuu-chapter-nine-service-vocabulary-responses.mjs';
import {chapterNineKanjiResponses} from './busuu-chapter-nine-kanji-responses.mjs';
import {chapterNineHumbleDecisionsResponses} from './busuu-chapter-nine-humble-decisions-responses.mjs';
import {chapterNineCheckpointResponses} from './busuu-chapter-nine-checkpoint-responses.mjs';
export const chapterNineResponses={...chapterNineServiceVocabularyResponses,...chapterNineKanjiResponses,...chapterNineHumbleDecisionsResponses,...chapterNineCheckpointResponses};
export function chapterNineActions(screen,value,index,state){
 if(screen.renderer==='truth')return [{type:'truth',value}];
 if(screen.renderer==='choice')return [{type:'choice',id:value}];
 if(screen.renderer==='multi_choice')return [{type:'toggle_option',id:value}];
 if(screen.renderer==='typed')return [{type:'typed_draft',text:value}];
 if(screen.renderer==='pairs'){
  const left=screen.left.find(t=>t.text===value[0]),right=screen.right.find(t=>t.text===value[1]);
  if(!left||!right)throw Error(`${screen.screenId}: missing independently specified pair ${value}`);
  return [{type:'pair',side:'left',id:left.id},{type:'pair',side:'right',id:right.id}];
 }
 const id=screen.answer.tokens.find(t=>t.text===value&&!state.slots.includes(t.id))?.id;
 if(!id)throw Error(`${screen.screenId}: missing independently reviewed token ${value}`);
 return [{type:'token',id}];
}
