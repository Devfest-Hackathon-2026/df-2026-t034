import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeminiScheduler} from './gemini-scheduler.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('parallel segments share at most two actual SDK slots and preserve queued cancellation',async()=>{
 const schedule=createGeminiScheduler(2,2);const finish=[];let active=0,peak=0;
 const work=()=>new Promise(resolve=>{active++;peak=Math.max(peak,active);finish.push(()=>{active--;resolve('done');});});
 const a=schedule(new AbortController().signal,work);const b=schedule(new AbortController().signal,work);const cancel=new AbortController();
 const c=schedule(cancel.signal,work);const rejected=assert.rejects(c,error=>error.name==='AbortError');await tick();assert.equal(active,2);cancel.abort();await rejected;
 const d=schedule(new AbortController().signal,work);await tick();assert.equal(finish.length,2);finish.shift()();await a;await tick();assert.equal(finish.length,2);assert.equal(peak,2);finish.shift()();finish.shift()();await Promise.all([b,d]);
});
test('a cancelled in-flight SDK keeps its slot until it really settles; backlog is bounded',async()=>{
 const schedule=createGeminiScheduler(1,1);const first=new AbortController();let finish;let nextStarted=false;
 const a=schedule(first.signal,()=>new Promise(resolve=>{finish=resolve;}));await tick();first.abort();
 const b=schedule(new AbortController().signal,async()=>{nextStarted=true;return 'next';});
 await assert.rejects(schedule(new AbortController().signal,async()=>''),error=>error.status===503);await tick();assert.equal(nextStarted,false);finish('done');await a;assert.equal(await b,'next');
});
