import assert from 'node:assert/strict';
import test from 'node:test';
import {googlePhotoQueries,loadGooglePhoto,parseGooglePhoto} from '../src/lib/google-place-photos.ts';
const query={name:'円山公園',city:'札幌'};
const photo={...query,provider:'google-places',placeId:'place123',url:'https://lh3.googleusercontent.com/photo',width:2400,height:1600,authors:[{displayName:'Photo Author',uri:'https://maps.google.com/maps/contrib/123'}],mapsUri:'https://maps.google.com/?cid=123',termsUrl:'https://example.test/terms',privacyUrl:'https://example.test/privacy'};
test('daily photo queries retain the correct city, max four slots and skip missing city context',()=>{
 const blocks=[{heading:'Day 1｜札幌を散策',body:''},...Array.from({length:5},(_,i)=>({heading:'景点'+i,body:'介绍',attraction:'景点'+i})),{heading:'Day 2｜京都古寺',body:''},{heading:'円山公園',body:'介绍',attraction:'円山公園'}];
 const queries=googlePhotoQueries('',blocks);assert.equal(queries.size,5);assert.equal(queries.get(1).city,'札幌');assert.equal(queries.get(7).city,'京都');
 assert.equal(googlePhotoQueries('',[{attraction:'円山公園',body:'公园'}]).size,0);
 const byRange=googlePhotoQueries('行程规划\n第1–2天：札幌\n第3天：京都',[{heading:'Day 2｜慢游',body:''},{attraction:'円山公園',body:'公园'}]);assert.equal(byRange.get(1).city,'札幌');
});
test('client only accepts the requested landmark, secure Google image host and complete credits',()=>{
 assert.equal(parseGooglePhoto(photo,query).source,photo.mapsUri);
 for(const unsafe of [{...photo,city:'京都'},{...photo,url:'https://evil.test/a'},{...photo,authors:[{uri:'javascript:bad'}]},{...photo,width:200}])assert.equal(parseGooglePhoto(unsafe,query),null);
});
test('Mount Takao context qualifies Yakuoin instead of searching an ambiguous Tokyo temple name',()=>{
 const blocks=[{heading:'Day 2｜高尾山自然远足与涩谷',body:''},{attraction:'薬王院',body:'高尾山腰的古刹'}];
 assert.deepEqual(googlePhotoQueries('',blocks).get(1),{name:'高尾山薬王院',city:'八王子'});
 assert.equal(googlePhotoQueries('东京', [{attraction:'薬王院',body:'古刹'}]).size,0);
});
test('on-demand request sends session auth and never credentials or a photo resource, and preserves no-photo success',async()=>{
 let calls=0;
 const result=await loadGooglePhoto(query,{endpoint:'https://travel.test/api/place-photos',authorization:async()=>'session-test-only',fetcher:async(url,init)=>{
  calls++;assert.equal(init.headers.Authorization,'Bearer session-test-only');assert.deepEqual(JSON.parse(init.body),{places:[query]});assert.doesNotMatch(init.body,/key|token|photoUri/);return Response.json({enabled:true,photos:[photo]});
 }});assert.equal(calls,1);assert.equal(result.photo.provider,'google-places');
 const missing=await loadGooglePhoto(query,{endpoint:'https://travel.test/api/place-photos',fetcher:async()=>Response.json({enabled:true,photos:[]})});assert.deepEqual(missing,{enabled:true,photo:null});
});
test('feature off/old server uses legacy photos; failures stop lookups but leave itinerary text independent',async()=>{
 assert.deepEqual(await loadGooglePhoto(query,{endpoint:'https://travel.test/api/place-photos',fetcher:async()=>new Response('',{status:404})}),{enabled:false,photo:null});
 assert.deepEqual(await loadGooglePhoto(query,{endpoint:'https://travel.test/api/place-photos',fetcher:async()=>Response.json({enabled:false,photos:[]})}),{enabled:false,photo:null});
 for(const fetcher of [async()=>{throw Error('network failed');},async()=>new Response('',{status:429}),async()=>Response.json({enabled:true,photos:[],unavailable:true})]){
  const result=await loadGooglePhoto(query,{endpoint:'https://travel.test/api/place-photos',fetcher});assert.equal(result.enabled,true);assert.equal(result.photo,null);assert.equal(result.stop,true);
 }
});
test('a persistent photo quota is distinguished from a missing image without requesting a fresh session',async()=>{
 let calls=0;const result=await loadGooglePhoto(query,{endpoint:'https://travel.test/api/place-photos',fetcher:async()=>{calls++;return Response.json({enabled:true,photos:[],unavailable:true,omissions:[{...query,reason:'PHOTO_LIMIT_REACHED'}]});}});
 assert.equal(calls,1);assert.equal(result.limitReached,true);assert.equal(result.stop,true);assert.equal(result.photo,null);
});
