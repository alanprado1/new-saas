// Actual six registered packs through real client/API/server and isolated PostgreSQL.
// Focus summary-owned structural registration and all six saves; reuse released event/state mechanics.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '../persistence-validation/runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
import { chapterFiveResponses, chapterFiveAction } from '../../../lib/busuu-chapter-five-responses.mjs';
const server=loadCourseModule('lib/busuu/attempt-server.ts'), evaluator=loadCourseModule('lib/busuu/attempt.ts');
const Client=loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
const packs=Object.keys(chapterFiveResponses).map(id=>server.coursePack(id).pack);
const baseline=JSON.parse(fs.readFileSync(new URL('./prior-fingerprints.json',import.meta.url)));
const db=new PGlite(),owner='10000000-0000-4000-8000-000000000001',stranger='10000000-0000-4000-8000-000000000002';
let checks=0,offline=false;
const verify=(value,label)=>{assert.ok(value,label);checks++;};
const equal=(value,expected,label)=>{assert.deepEqual(value,expected,label);checks++;};
const storageMap=new Map(),storage={get length(){return storageMap.size;},key:i=>[...storageMap.keys()][i]??null,getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
const keys={course_start_attempt:['p_id','p_user','p_record','p_version','p_hash','p_restart','p_state','p_result'],course_save_event:['p_attempt','p_user','p_request','p_sequence','p_action','p_version','p_hash','p_state','p_result','p_complete']};
const adapter={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},async rpc(name,input){
 try{const r=await db.query(`select public.${name}(${keys[name].map((_,i)=>'$'+(i+1)).join(',')}) as attempt`,keys[name].map(k=>input[k]));return {data:r.rows[0].attempt,error:null};}
 catch(e){return {data:null,error:{code:e.code,message:e.message}};}
},from(table){let columns='*';const clauses=[],args=[];const q={select(c){columns=c;return q;},eq(k,v){args.push(v);clauses.push(`${k}=$${args.length}`);return q;},async maybeSingle(){const r=await db.query(`select ${columns} from public.${table} where ${clauses.join(' and ')}`,args);return {data:r.rows[0]??null,error:null};}};return q;}};
const savedKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-test-only';
const route=loadCourseModule('app/api/course/attempts/route.ts',{'@/utils/supabase/server':{createClient:async()=>adapter},'@supabase/supabase-js':{createClient:()=>adapter}});
const post=(url,body,expectedOwner=owner)=>route.POST(new Request(`http://localhost${url}`,{method:'POST',headers:{'Content-Type':'application/json','X-Course-Owner':expectedOwner,Origin:'http://localhost'},body:JSON.stringify(body)}));
const transport=async(url,body,expectedOwner)=>{if(offline&&url.includes('?attempt='))throw new Error('Isolated offline boundary');const response=await post(url,body,expectedOwner),data=await response.json();if(!response.ok)throw new Error(data.error);return data;};
const sessionFor=p=>new Client(p,owner,storage,transport,()=>{},p.recordId);
const send=async(session,p,a)=>{session.dispatch({...a,screenId:p.screens[session.snapshot().state.index].screenId});await session.retry();};
const report=[];
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 insert into auth.users values ('${owner}'),('${stranger}');`);
 for(const name of ['20261004011140_course_attempts.sql','20261004011331_course_attempt_events_owner_index.sql'])await db.exec(fs.readFileSync(new URL(`../../../../../supabase/migrations/${name}`,import.meta.url),'utf8'));
 await db.exec('set role service_role');
 for(const p of packs) {
  let session=sessionFor(p);await session.open();verify(session.snapshot().ready,'registered API start');
  const wrongIndex=p.recordId==='B2.C05.L01'?18:p.recordId==='B2.C05.CP'?2:null;
  const reopen=async label=>{const state=structuredClone(session.snapshot().state);session.dispose();session=sessionFor(p);await session.open();equal(session.snapshot().state,state,label);};
  const answer=async(i,wrong=false)=>{
   const s=p.screens[i];if(!session.snapshot().state.audioReady)await send(session,p,{type:'audio_ready'});
   const values=wrong?(s.renderer==='truth'?[true]:['さんだん']):chapterFiveResponses[p.recordId][i];
   for(const [j,v]of values.entries())await send(session,p,chapterFiveAction(s,v,j,session.snapshot().state));
   if(s.renderer==='typed')await send(session,p,{type:'typed_check'});
  };
  for(const [i,s]of p.screens.entries()) {
   verify(session.snapshot().state.index===i,'canonical saved base path');
   if(s.screenId.includes('.A02.S01'))await reopen('internal activity resume');
   if(p.structuralContract&&i===2){
    offline=true;await send(session,p,{type:'typed_draft',text:'さん'});verify(session.snapshot().status==='error','authored CP typed draft kept offline');
    await reopen('authored CP offline draft reload');offline=false;await session.retry();equal(session.snapshot().confirmed.state.typedDraft,'さん','typed draft persisted');
   }
   if(p.structuralContract&&i===14){
    await send(session,p,{type:'audio_ready'});await send(session,p,chapterFiveAction(s,chapterFiveResponses[p.recordId][i][0],0,session.snapshot().state));
    await reopen('authored hidden ordering partial state');await send(session,p,{type:'remove_token',slot:0});
   }
   await answer(i,i===wrongIndex);
   if(s.answer)verify(session.snapshot().state.outcomes[i]?.correct===(i!==wrongIndex),'independent first outcome');
   await send(session,p,{type:'continue'});
  }
  if(p.retryPolicy){
   verify(session.snapshot().state.index===18,'final activity target only');verify(session.snapshot().state.retry.returnIndex===21,'final boundary return');
   verify(session.snapshot().state.visited.length===21,'no extra base row');verify(!session.snapshot().confirmed.completed_at,'retry must finish before completion');
   await reopen('final-boundary retry resume');const first=structuredClone(session.snapshot().state.outcomes);
   verify(!session.snapshot().state.audioReady,'retry fresh playback gate');await send(session,p,{type:'audio_ready'});
   offline=true;await send(session,p,{type:'truth',value:false});verify(session.snapshot().status==='error','retry response retained offline');
   await reopen('retry feedback offline reload');offline=false;await session.retry();equal(session.snapshot().state.outcomes,first,'retry first outcomes immutable');
   await send(session,p,{type:'continue'});
  }
  await reopen('saved result restores');const complete=session.snapshot().confirmed,graded=p.screens.filter(s=>s.answer).length;
  verify(Boolean(complete.completed_at)&&complete.result.completionEligible,'API saves completed core');
  equal(complete.result.percent,Math.round((graded-Number(wrongIndex!==null))/graded*100),'accuracy independent of completion/retry');
  equal(complete.state.visited.length,p.baseScreenCount,'saved unique base count');
  verify(!Object.hasOwn(complete.state,'structuralContract'),'authored structure introduces no event/state schema field');
  report.push({recordId:p.recordId,baseScreens:p.baseScreenCount,structure:p.structuralContract?'app_authored':'observed',accuracy:complete.result.percent,retry:complete.result.retry??null,saved:true});
  await session.restart();verify(session.snapshot().confirmed.id!==complete.id,'restart distinct attempt');verify(!session.snapshot().state.retry,'restart clears active retry');
  if(p.retryPolicy){
   for(let i=0;i<p.screens.length;i++){await answer(i,i===18);await send(session,p,{type:'continue'});}
   await answer(18,true);await send(session,p,{type:'continue'});await reopen('wrong retry result restores');
   verify(Boolean(session.snapshot().confirmed.completed_at),'wrong retry permits saved completion');
   equal(session.snapshot().confirmed.result.retry,{attempted:1,correct:0,total:1,complete:true},'one failed retry report');
   equal(session.snapshot().confirmed.result.percent,complete.result.percent,'wrong retry leaves first accuracy unchanged');
  }
  session.dispose();
 }
 // Registration cannot save invented identities/physical counts, even for a reviewed summary.
 const cp=packs.at(-1),contract=structuredClone(cp.structuralContract),source=structuredClone(cp.screens[0].sourceContract);
 try {
  cp.screens[0].sourceContract.sourceActivityId='invented';assert.throws(()=>server.coursePack(cp.recordId));checks++;
  cp.screens[0].sourceContract=source;cp.structuralContract.tasks[0].responseCount=99;assert.throws(()=>server.coursePack(cp.recordId));checks++;
 }finally{cp.structuralContract=contract;cp.screens[0].sourceContract=source;}
 for(const old of baseline.packs){
  const {pack:p,hash}=server.coursePack(old.recordId,old.contentVersion);equal(hash,old.persistenceFingerprint,'all 29 released fingerprints');
  equal(createHash('sha256').update(fs.readFileSync(new URL(`../${old.file}`,import.meta.url))).digest('hex'),old.fileHash,'all released bytes');
  if(!loadCourseModule('lib/busuu/content-readiness.ts').getPackReadiness(p).playable)continue;
  const body={requestId:crypto.randomUUID(),recordId:p.recordId,contentVersion:p.contentVersion,contentHash:hash,restart:false};
  const initial=await server.startAttempt(adapter,owner,body);equal(initial.state,evaluator.initialAttemptState(p),'old exact initial shape');
  equal(initial.result,evaluator.attemptResult(p,initial.state),'old exact result shape');
  const s=p.screens[0],a=s.answer;
  const action={screenId:s.screenId,...(!initial.state.audioReady?{type:'audio_ready'}:initial.state.phase==='presentation'?{type:'continue'}:
   a.kind==='typed'?{type:'typed_draft',text:'こ'}:a.kind==='truth'?{type:'truth',value:false}:a.kind==='choice'?{type:'choice',id:a.options[0].id}:
   a.kind==='pairs'?{type:'pair',side:'left',id:s.left[0].id}:{type:'token',id:a.tokens[0].id})};
  const saved=await server.saveAttemptEvent(adapter,owner,initial.id,{requestId:crypto.randomUUID(),sequence:1,contentVersion:p.contentVersion,contentHash:hash,action});
  const resumed=await server.startAttempt(adapter,owner,body);equal(resumed.state,saved.state,'old event save/resume');
 }
 const rows=(await db.query('select * from public.course_attempts')).rows,progress=loadCourseModule('lib/busuu/progress.ts');
 const saved=progress.savedCourseProgress([...rows,...rows]);equal(progress.chapterCompletion(loadCourseModule('lib/busuu/inventory.ts').getLevelInventory('B2').chapters[4],saved),100,'six unique chapter entries');
 equal(saved['B2.C05.CP'].accuracy,95,'authored CP accuracy separate from map completion');
 const events=(await db.query('select attempt_id,count(*)::int n from public.course_attempt_events group by attempt_id')).rows;
 verify(events.every(e=>e.n===rows.find(r=>r.id===e.attempt_id).revision),'offline replay idempotent');
 const a=rows.find(r=>r.record_id==='B2.C05.CP'&&r.completed_at);
 verify((await post(`/api/course/attempts?attempt=${a.id}`,{},stranger)).status===409,'API switched owner rejected');
 await assert.rejects(()=>server.saveAttemptEvent(adapter,stranger,a.id,{requestId:crypto.randomUUID(),sequence:a.revision+1,contentVersion:a.content_version,contentHash:a.content_hash,action:{type:'typed_check',screenId:'B2.C05.CP.A01.S03'}}));checks++;
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${stranger}',false);`);
 verify((await db.query('select count(*)::int n from public.course_attempts')).rows[0].n===0,'foreign account sees no attempts');
 verify((await db.query('select count(*)::int n from public.course_attempt_events')).rows[0].n===0,'foreign account sees no events');
}finally{if(savedKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=savedKey;await db.close();}
fs.writeFileSync(new URL('./database.json',import.meta.url),JSON.stringify({date:'2026-10-05',checks,isolated:true,packs:report,liveDatabaseWrites:false},null,2)+'\n');
console.log(`${checks} isolated PostgreSQL/API/client assertions passed: six saved packs, authored summary contract, final-boundary retries, offline/resume/restart, all 29 prior versions and account isolation.`);
