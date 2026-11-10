import assert from 'node:assert/strict';
import test from 'node:test';
import {createPlacePhotosHandler,findGooglePlacePhoto,matchingPlace,selectLandscapePhoto} from './place-photos.ts';
const query={name:'清水寺',city:'京都'};
const photo={name:'places/place123/photos/photo123',widthPx:2400,heightPx:1600,authorAttributions:[{displayName:'Photo Author',uri:'https://maps.google.com/maps/contrib/123'}]};
const place={id:'place123',displayName:{text:'清水寺'},postalAddress:{regionCode:'JP',administrativeArea:'京都府',locality:'京都市'},photos:[photo],googleMapsUri:'https://maps.google.com/?cid=123'};
const opts={apiKey:'test-key-not-public',signal:new AbortController().signal,termsUrl:'https://example.test/terms',privacyUrl:'https://example.test/privacy'};
test('abbreviated Yakuoin is omitted before spending quota; the full Takao name requires Hachioji',async()=>{
 const result=await findGooglePlacePhoto({name:'薬王院',city:'東京'},{...opts,reserve:async()=>{throw Error('must not reserve');}});
 assert.equal(result,null);
 const takao={...place,displayName:{text:'髙尾山薬王院'},postalAddress:{regionCode:'JP',administrativeArea:'東京都',locality:'八王子市'}};
 assert.equal(matchingPlace(takao,{name:'高尾山薬王院',city:'八王子'}),true);
 assert.equal(matchingPlace({...takao,postalAddress:{regionCode:'JP',administrativeArea:'東京都',locality:'新宿区'}},{name:'高尾山薬王院',city:'八王子'}),false);
});
test('exact landmark and city matching rejects a wrong city, a neighbor, ambiguity and poor image dimensions',async()=>{
 assert.equal(matchingPlace(place,query),true);assert.equal(matchingPlace({...place,postalAddress:{regionCode:'JP',administrativeArea:'京都府',locality:'宇治市'}},query),false);assert.equal(matchingPlace({...place,postalAddress:{regionCode:'JP',administrativeArea:'東京都'}},query),false);assert.equal(matchingPlace({...place,postalAddress:{regionCode:'JP',locality:'札幌市'}},query),false);
 assert.equal(matchingPlace({...place,displayName:{text:'清水寺駅'}},query),false);
 assert.equal(selectLandscapePhoto([{...photo,widthPx:800}]),undefined);assert.equal(selectLandscapePhoto([{...photo,widthPx:1600,heightPx:2400}]),undefined);
 let calls=0;assert.equal(await findGooglePlacePhoto(query,{...opts,reserve:async()=>{},fetcher:async()=>{calls++;return Response.json({places:[place,place]});}}),null);assert.equal(calls,1);
});
test('municipality plus ward or a Japanese address line is accepted without treating the prefecture as the city',()=>{
 for(const postalAddress of [
  {regionCode:'JP',administrativeArea:'京都府',locality:'京都市東山区'},
  {regionCode:'JP',administrativeArea:'京都府',addressLines:['京都府京都市東山区清水1丁目294']},
 ])assert.equal(matchingPlace({...place,postalAddress},query),true);
 assert.equal(matchingPlace({...place,postalAddress:{regionCode:'JP',administrativeArea:'京都府',locality:'宇治市',addressLines:['宇治市宇治蓮華']}},query),false);
 assert.equal(matchingPlace({...place,displayName:{text:'髙尾山 薬王院 有喜寺'},postalAddress:{regionCode:'JP',addressLines:['東京都八王子市高尾町2177']}},{name:'高尾山薬王院',city:'八王子'}),true);
});
test('photo lookup uses server-only headers, charges both upstream calls and returns every attribution without resource names or credentials',async()=>{
 let calls=0,reservations=0;
 const result=await findGooglePlacePhoto(query,{...opts,reserve:async()=>{reservations++;},fetcher:async(url,init)=>{
  calls++;assert.equal(init.headers['X-Goog-Api-Key'],opts.apiKey);assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');
  if(calls===1){assert.match(url,/places:searchText$/);assert.match(JSON.parse(init.body).textQuery,/清水寺 京都 日本/);assert.doesNotMatch(init.headers['X-Goog-FieldMask'],/reviews|rating/);return Response.json({places:[place]});}
  assert.match(url,/skipHttpRedirect=true/);return Response.json({photoUri:'https://lh3.googleusercontent.com/photo'});
 }});
 assert.equal(calls,2);assert.equal(reservations,2);assert.equal(result.authors[0].displayName,'Photo Author');assert.equal(result.mapsUri,place.googleMapsUri);
 assert.doesNotMatch(JSON.stringify(result),/test-key|photos\/photo123/);
});
test('missing pictures, unauthorized credit links, provider errors, unsafe image URLs and quotas never return an unsafe photo',async()=>{
 for(const changed of [{...place,photos:[]},{...place,photos:[{...photo,authorAttributions:[{displayName:'x',uri:'javascript:alert(1)'}]}]}]) {
  let calls=0;assert.equal(await findGooglePlacePhoto(query,{...opts,reserve:async()=>{},fetcher:async()=>{calls++;return Response.json({places:[changed]});}}),null);assert.equal(calls,1);
 }
 let calls=0;assert.equal(await findGooglePlacePhoto(query,{...opts,reserve:async()=>{},fetcher:async()=>++calls===1?Response.json({places:[place]}):Response.json({photoUri:'https://evil.test/photo'})}),null);
});
const config={enabled:true,apiKey:'test-key',termsUrl:opts.termsUrl,privacyUrl:opts.privacyUrl,isDevelopment:true};
const request=(body,extra={})=>new Request('http://localhost:3000/api/place-photos',{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
test('handler validates batch limits and extra input, requires shared sessions, supports the off switch and isolates lookup failure',async()=>{
 let called=0;const handler=createPlacePhotosHandler({configuration:()=>config,fetcher:async()=>{called++;throw new Error('private provider message');}});
 for(const body of [{places:Array(5).fill(query)},{places:[{...query,key:'override'}]},{places:[{name:'清水寺'}]},{places:[query],url:'https://evil.test'}]) assert.equal((await handler(request(body))).status,400);
 assert.equal(called,0);const response=await handler(request({places:[query]}));assert.deepEqual(await response.json(),{enabled:true,photos:[],omissions:[{...query,reason:'PHOTO_PROVIDER_UNAVAILABLE'}],unavailable:true});assert.equal(called,1);
 const off=createPlacePhotosHandler({configuration:()=>({...config,enabled:false}),fetcher:async()=>{throw Error('must not call');}});assert.deepEqual(await(await off(request({places:[]}))).json(),{enabled:false,photos:[]});
 const shared=createPlacePhotosHandler({configuration:()=>({...config,accessMode:'shared',publicOrigin:'https://travel.test'})});
 const unauthorized=await shared(new Request('https://travel.test/api/place-photos',{method:'POST',body:'{}'}));assert.equal(unauthorized.status,401);
});
