import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCourseModule } from './busuu-test-helpers.mjs';
const a = '10000000-0000-4000-8000-000000000001', b = '10000000-0000-4000-8000-000000000002';
const request = (body, owner = a, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/course/attempts', {
  method: 'POST', headers: { 'Content-Type':'application/json', 'X-Course-Owner':owner, Origin:origin }, body:JSON.stringify(body),
});
function routes(user = a, error = null) {
  let writes = 0;
  const result = { owner: a };
  const db = { auth: { getUser: async () => ({data:{user:user ? {id:user} : null},error}) },
    from: () => { const q = {select:()=>q,eq:()=>q,not:()=>q,order:async()=>({data:[],error:null})}; return q; } };
  const overrides = { '@/utils/supabase/server': {createClient:async()=>db}, '@supabase/supabase-js': {createClient:()=>db},
    '@/lib/busuu/attempt-server': {startAttempt:async()=>{writes++;return result;}, saveAttemptEvent:async()=>{writes++;return result;} } };
  return {...loadCourseModule('app/api/course/attempts/route.ts',overrides), get writes(){return writes;}};
}
test('course API authenticates getUser and rejects unauthenticated and expected-account mismatch before writes', async () => {
  for (const r of [routes(null),routes(a,new Error('expired'))]) {
    assert.equal((await r.POST(request({}))).status,401); assert.equal((await r.GET(new Request('http://localhost:3000/api/course/attempts'))).status,401); assert.equal(r.writes,0);
  }
  const r=routes(b); const response=await r.POST(request({})); assert.equal(response.status,409); assert.equal(r.writes,0);
});
test('course API rejects foreign origin, oversized data and malformed JSON without writes', async () => {
  const r=routes();
  assert.equal((await r.POST(request({},a,'https://evil.example'))).status,403);
  assert.equal((await r.POST(request({padding:'x'.repeat(8193)}))).status,413);
  assert.equal((await r.POST(new Request('http://localhost:3000/api/course/attempts',{method:'POST',headers:{'X-Course-Owner':a},body:'{'}))).status,400);
  assert.equal(r.writes,0);
});
test('progress reads are private no-store and account scoped', async () => {
  const r=routes(); const response=await r.GET(new Request('http://localhost:3000/api/course/attempts',{headers:{'X-Course-Owner':a}}));
  assert.equal(response.status,200); assert.match(response.headers.get('Cache-Control'),/no-store/);
  assert.deepEqual(await response.json(),{owner:a,attempts:[]}); assert.equal(r.writes,0);
});

test('active-attempt read for the course map returns only record ids and visited counts, scoped to the owner', async () => {
  const filters = [];
  const db = { auth: { getUser: async () => ({ data: { user: { id: a } }, error: null }) },
    from: () => { const q = { select: () => q, eq: (c, v) => { filters.push([c, v]); return q; }, not: () => q, order: async () => ({ data: [], error: null }),
      then: resolve => resolve({ data: [{ record_id: 'B2.C01.L01', completed_at: null, state: { visited: [0, 1, 2], secret: 1 } }, { record_id: 'B2.C01.L02', completed_at: 'x', state: { visited: [0] } }], error: null }) }; return q; } };
  const r = loadCourseModule('app/api/course/attempts/route.ts', { '@/utils/supabase/server': { createClient: async () => db }, '@supabase/supabase-js': { createClient: () => db },
    '@/lib/busuu/attempt-server': { startAttempt: async () => ({}), saveAttemptEvent: async () => ({}) } });
  const response = await r.GET(new Request('http://localhost:3000/api/course/attempts?include=active', { headers: { 'X-Course-Owner': a } }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).inProgress, [{ record_id: 'B2.C01.L01', visited: 3 }]);
  assert.ok(filters.some(([c, v]) => c === 'user_id' && v === a) && filters.some(([c, v]) => c === 'active' && v === true));
});
