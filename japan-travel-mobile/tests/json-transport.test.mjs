import test from 'node:test';
import assert from 'node:assert/strict';
import {jsonTransport} from '../src/lib/json-transport.ts';
function install(t, complete) {
 const previous=Object.getOwnPropertyDescriptor(globalThis,'XMLHttpRequest');const calls=[];
 class FakeXHR {
  headers={};status=200;responseText='';aborts=0;
  constructor(){calls.push(this);}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(key,value){this.headers[key]=value;}
  getResponseHeader(key){return key==='content-type'?'application/json':null;}
  send(body){this.sent=body;queueMicrotask(()=>complete(this));}
  abort(){this.aborts++;this.onabort?.();}
 }
 Object.defineProperty(globalThis,'XMLHttpRequest',{configurable:true,writable:true,value:FakeXHR});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'XMLHttpRequest',previous);else delete globalThis.XMLHttpRequest;});return calls;
}
test('native JSON uses text instead of Blob and preserves Unicode, status and session headers without retries',async t=>{
 const calls=install(t,x=>{x.responseText=JSON.stringify({reply:'高尾山薬王院\n预算：5000日元'});x.onload();});
 const response=await jsonTransport('https://travel.test/api/chat',{method:'POST',headers:{Authorization:'Bearer test-session'},body:'{}'});
 assert.equal(calls.length,1);assert.equal(calls[0].responseType,'text');assert.equal(calls[0].headers.authorization,'Bearer test-session');assert.equal(response.status,200);assert.match((await response.json()).reply,/高尾山薬王院/);
});
test('native errors and deadlines do not send another billed POST',async t=>{
 let event;const calls=install(t,x=>x[event]());
 for(const [next,name] of [['onerror','TypeError'],['ontimeout','TimeoutError']]){
  event=next;const before=calls.length;await assert.rejects(jsonTransport('https://travel.test/api/chat',{method:'POST',body:'{}'}),e=>e.name===name);assert.equal(calls.length,before+1);
 }
});
test('caller abort cancels the native request and late completion cannot resolve it',async t=>{
 const calls=install(t,()=>{});const controller=new AbortController();const request=jsonTransport('https://travel.test/api/chat',{method:'POST',body:'{}',signal:controller.signal});
 controller.abort();await assert.rejects(request,e=>e.name==='AbortError');assert.equal(calls[0].aborts,1);assert.equal(calls[0].onload,null);
});
test('non-200 JSON errors remain available to existing API error handling',async t=>{
 install(t,x=>{x.status=429;x.responseText=JSON.stringify({error:{code:'DAILY_LIMIT_REACHED'}});x.onload();});
 const response=await jsonTransport('https://travel.test/api/chat',{method:'POST',body:'{}'});assert.equal(response.ok,false);assert.equal(response.status,429);assert.equal((await response.json()).error.code,'DAILY_LIMIT_REACHED');
});
