import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePlanningDecision } from './planning-decision.ts';
import { createChatHandler } from './chat.ts';
import { renderDaySegment } from './itinerary-format.ts';
const config = {apiKey:'test-only',model:'test-model',isDevelopment:true};
const request = (messages) => new Request('http://localhost:3000/api/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Travel-Day-Photos':'4'},body:JSON.stringify({messages})});
const decision = (value) => ({decision:value,inputTokens:10,outputTokens:5,totalTokens:15});
test('planning assessment schema rejects invalid actions, extra questions, oversized days and invented defaults', () => {
  for(const value of [null,{action:'other'}, {action:'plan',days:0,questions:[],assumptions:[]},{action:'plan',days:32,questions:[],assumptions:[]},
    {action:'clarify',days:0,questions:['1','2','3','4'],assumptions:[]},{action:'clarify',days:3,questions:['几天？'],assumptions:[]}]) assert.throws(()=>parsePlanningDecision(JSON.stringify(value)));
});
test('incomplete multi-city request only asks up to three questions, never calls itinerary generation or validation',async()=>{
 let generated=0; const logs=[];
 const handler=createChatHandler({getConfiguration:()=>config,log:x=>logs.push(x),generate:async()=>{generated++;return{text:'must not generate'};},assess:async input=>{
   assert.match(input.contents[0].parts[0].text,/新疆/);
   return decision({action:'clarify',days:0,questions:['您大概有几天？我可以按少换酒店、交通尽量省钱的方式帮您排。'],assumptions:[]});
 }});
 const response=await handler(request([{role:'user',content:'从新疆出发，三个人去大阪、京都、东京和北海道，预算不多'}]));
 assert.equal(response.status,200);assert.doesNotMatch((await response.json()).reply,/Day|预算对比/);assert.equal(generated,0);assert.equal(logs[0].totalTokens,15);
});
function segment(input) {
 const {range,expectedDays}=input.planFormat;
 return renderDaySegment(JSON.stringify({opening:'按已确定条件安排，默认参考假设会在这里说明。',overview:[{first:1,last:expectedDays,area:'东京'}],summary:'保留休息时间。',
   days:Array.from({length:range.last-range.first+1},(_,i)=>({number:range.first+i,title:'东京漫步',sights:[{name:'浅草寺',description:'参观寺院外观。'}],activities:['吃早餐','去浅草寺','在浅草寺附近吃午饭','沿街散步','返回酒店休息']})),
   budget:{currency:'CNY',travelers:3,scope:'全程估算',items:['交通','住宿','餐饮'].map(label=>({label,economy:100,comfort:200,luxury:300}))}
 }),range.first===1);
}
test('brief follow-up uses full history and returns every day in one reply with budget last',async()=>{
 const calls=[];const messages=[{role:'user',content:'三个人东京动漫美食，人均一万元，帮我安排'},{role:'assistant',content:'您想玩几天？'},{role:'user',content:'14天'}];
 const handler=createChatHandler({getConfiguration:()=>config,assess:async input=>{assert.equal(input.contents.length,3);return decision({action:'plan',days:14,questions:[],assumptions:[]});},generate:async input=>{calls.push(input);return{text:segment(input)};}});
 const response=await handler(request(messages));assert.equal(response.status,200);const reply=(await response.json()).reply;
 assert.deepEqual([...reply.matchAll(/^Day (\d+)/gm)].map(x=>+x[1]),Array.from({length:14},(_,i)=>i+1));
 assert.match(reply,/预算对比[\s\S]+餐饮｜100｜200｜300$/);assert.doesNotMatch(reply,/回复.*继续|\d\d:\d\d｜/);assert.equal(calls.length,3);
});
test('delegated assumptions reach the opening request; sufficient requests are not confirmed again',async()=>{
 const handler=createChatHandler({getConfiguration:()=>config,assess:async()=>decision({action:'plan',days:2,questions:[],assumptions:['您授权代定，先按两天慢游。']}),generate:async input=>{
  assert.match(JSON.stringify(input.contents),/授权代定/);assert.equal(input.planFormat.expectedDays,2);return{text:segment(input)};
 }});
 assert.equal((await handler(request([{role:'user',content:'东京怎么逛，您帮我决定天数'}]))).status,200);
});
test('single-topic answers bypass full-plan repair and assessment failure never silently creates a plan',async()=>{
 let generated=0;
 const handler=createChatHandler({getConfiguration:()=>config,assess:async()=>decision({action:'answer',days:0,questions:[],assumptions:[]}),generate:async input=>{generated++;assert.equal(input.planFormat,undefined);return{text:'住宿建议保持在同一区域。'};}});
 assert.equal((await handler(request([{role:'user',content:'只问住宿住哪区'}]))).status,200);assert.equal(generated,1);
 const failed=createChatHandler({getConfiguration:()=>config,assess:async()=>{throw new Error('private details');},generate:async()=>{generated++;return{text:'no'};}});
 const response=await failed(request([{role:'user',content:'安排日本旅行'}]));assert.equal(response.status,502);assert.equal(generated,1);assert.doesNotMatch(JSON.stringify(await response.json()),/private/);
});
test('assessment timeout records its stage and elapsed time without generating or exposing provider diagnostics',async()=>{
 let clock=0,generated=0;const logs=[];
 const handler=createChatHandler({getConfiguration:()=>config,now:()=>clock,log:entry=>logs.push(entry),
  assess:async()=>{clock=13000;throw Object.assign(new Error('private upstream diagnostic'),{status:504});},
  generate:async()=>{generated++;return{text:'must not generate'};}});
 const response=await handler(request([{role:'user',content:'安排日本旅行'}]));
 assert.equal(response.status,504);assert.equal(generated,0);assert.equal(logs[0].phase,'assessment');assert.equal(logs[0].assessmentDurationMs,13000);
 assert.doesNotMatch(JSON.stringify(await response.json()),/private|upstream/);
});

test('a short day-count follow-up still repairs an incomplete provider response instead of accepting it', async()=>{
 let calls=0;
 const handler=createChatHandler({getConfiguration:()=>config,assess:async()=>decision({action:'plan',days:3,questions:[],assumptions:[]}),generate:async input=>{calls++;return {text:calls===1?'只写了开场':segment(input)};}});
 const response=await handler(request([{role:'user',content:'两人去东京规划，人均五万日元'},{role:'assistant',content:'您有几天？'},{role:'user',content:'三天'}]));
 assert.equal(response.status,200);assert.equal(calls,2);assert.match((await response.json()).reply,/Day 3/);
});

test('clarification guard does not combine several questions into one visible question item',()=>{
 const value=parsePlanningDecision(JSON.stringify({action:'clarify',days:0,questions:['您有几天？什么月份？','人均预算大概多少？'],assumptions:[]}));
 assert.deepEqual(value.questions,['您有几天？','人均预算大概多少？']);
});
test('later day segments can finish out of order but the reply stays Day 1 through Day 14',async()=>{
 const later=[];let started=0;
 const handler=createChatHandler({getConfiguration:()=>config,assess:async()=>decision({action:'plan',days:14,questions:[],assumptions:[]}),generate:async input=>{
  if(input.planFormat.range.first===1)return{text:segment(input)};
  started++;return new Promise(resolve=>{later.push({input,resolve});if(started===2){later[1].resolve({text:segment(later[1].input)});later[0].resolve({text:segment(later[0].input)});}});
 }});
 const response=await handler(request([{role:'user',content:'东京14天完整行程，您决定细节'}]));assert.equal(response.status,200);
 assert.deepEqual([...(await response.json()).reply.matchAll(/^Day (\d+)/gm)].map(match=>+match[1]),Array.from({length:14},(_,index)=>index+1));
});

test('explicit sight whitelist survives a short follow-up and a violating plan is repaired once', async () => {
 let calls=0; const logs=[];
 const handler=createChatHandler({getConfiguration:()=>config,log:x=>logs.push(x),assess:async()=>decision({action:'plan',days:1,questions:[],assumptions:[]}),generate:async input=>{
  calls++; assert.deepEqual(input.visitConstraints,[{kind:'only',day:0,names:['浅草寺']}]);
  const reply=segment(input);
  if(calls===1) return {text:reply.replaceAll('浅草寺','上野公園')};
  assert.match(input.planFormat.repair,/景点限制未满足/); return {text:reply};
 }});
 const response=await handler(request([{role:'user',content:'东京一日游，只去浅草寺，1人，预算五千日元'},{role:'assistant',content:'还有其他要求吗？'},{role:'user',content:'其他您安排，直接给完整行程'}]));
 assert.equal(response.status,200);assert.equal(calls,2);assert.doesNotMatch((await response.json()).reply,/上野公園/);
 assert.match(logs[0].itineraryFirstIssue,/景点限制未满足/);assert.doesNotMatch(JSON.stringify(logs),/浅草寺|上野/);
});
test('a repeated constraint violation is rejected with a specific error and no third provider attempt', async () => {
 let calls=0;
 const handler=createChatHandler({getConfiguration:()=>config,assess:async()=>decision({action:'plan',days:1,questions:[],assumptions:[]}),generate:async input=>{calls++;return{text:segment(input).replaceAll('浅草寺','上野公園')};}});
 const response=await handler(request([{role:'user',content:'东京一日游，只去浅草寺，1人，预算五千日元，直接给完整行程'}]));
 assert.equal(response.status,502);assert.equal(calls,2);assert.equal((await response.json()).error.code,'ITINERARY_CONSTRAINT_VIOLATION');
});
