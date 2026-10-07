// Independently reviewed responses, in canonical screen order; no runtime answer keys are enumerated.
// Choice IDs correspond to reviewed displayed positions. Banks are located by authored text only.
export const chapterThreeResponses = {
 'B2.C03.L01': [[],['つ','づ','け','て'],['通い','つづけています'],[true],[],['の','こ','ろ','か','ら'],['ころ','つづけて'],['高校のころから、','彼と','付き合い','つづけています。']],
 'B2.C03.L02': [[],['う','ち','に'],[],['いる'],['日本に','いる','うちに、','何を','したいですか。'],['通っている'],['見ている','寝てしまいました'],['o1'],['歩ける','うちに']],
 'B2.C03.L03': [['な','い','う','ち','に'],['o0'],['しない','うちに'],[],['o1'],['売','り','切','れ','な','い'],[],['温かい'],['な','うちに'],[],['暑い','熱い'],[],['o1'],['冷たい','うちに','どうぞ。'],['売り切れない']],
 'B2.C03.L04': [[],['ど','り','ょ','く'],[],['受け'],['し','け','ん'],['試験','努力'],[],[true],['で','み','ま','す'],['飲んで','みます'],
  ['l0','r0','l1','r1'],['o0'],['みます'],[],['o0'],['着て','見て'],['l0','r0','l1','r1','l2','r2'],['努力を','つづけて','み','ます。']],
 'B2.C03.L05': [['踊って','みました'],['o1'],[true],['行って','みたい'],['みたい'],['京都の','町を','歩いて','みたい','です。'],['泊まって','みたい']],
 'B2.C03.L06': [[],['o1'],[],['o1'],['通','続'],[],['努'],[],['o1'],[],['o2'],['試','験','努','力'],
  ['l0','r0','l1','r1'],['かよ','とお'],['l0','r0','l1','r1'],[],['通','通'],['o1'],[],['入試'],['試','試','力']],
 'B2.C03.CP': [['ころ','つづけて'],['高校の','ころから、','彼と','付き合い','つづけて','います。'],['冷たい','うちに','どうぞ。'],['o1'],[true],['飲んで','みます'],['な','うちに'],['売','り','切','れ','な','い'],
  ['行って','みたい'],['みたい'],['京都の','町を','歩いて','みたい','です。'],['入試'],['みます'],['努力を','つづけて','み','ます。'],['o0'],['着て','見て'],['見ている','寝てしまいました'],['o1'],['歩ける','うちに'],['o2']],
};
export function chapterThreeAction(screen,value,index,state) {
 if (screen.renderer === 'truth') return {type:'truth',value};
 if (screen.renderer === 'choice') return {type:'choice',id:value};
 if (screen.renderer === 'typed') return {type:'typed_draft',text:value};
 if (screen.renderer === 'pairs') return {type:'pair',side:index % 2 ? 'right' : 'left',id:value};
 const id=screen.answer.tokens.find(t=>t.text === value && !state.slots.includes(t.id))?.id;
 if (!id) throw new Error(`${screen.screenId}: reviewed response word missing: ${value}`);
 return {type:'token',id};
}
