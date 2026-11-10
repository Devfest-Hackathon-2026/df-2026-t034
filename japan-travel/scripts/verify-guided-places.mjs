import assert from 'node:assert/strict';
import { writeFile, chmod } from 'node:fs/promises';
const [base, reportFile, ...flags] = process.argv.slice(2);
assert.ok(flags.length <= 1 && flags.every(flag=>['--chat-only','--photos-only'].includes(flag)), 'Only --chat-only or --photos-only is supported');
const chatOnly=flags.includes('--chat-only');const photosOnly=flags.includes('--photos-only');
if (!base || !reportFile) throw Error('Usage: node scripts/verify-guided-places.mjs HTTPS_ORIGIN PRIVATE_REPORT_JSON');
const origin = new URL(base);
assert.equal(origin.protocol,'https:'); assert.equal(origin.pathname,'/'); assert.ok(!origin.username && !origin.password && !origin.search && !origin.hash);
const report={checkedAt:new Date().toISOString(),origin:origin.origin,scope:chatOnly?'chat-only':photosOnly?'photos-only':'full-http',checks:[],replies:[]};
const post=async(path,body,token)=>{
 const response=await fetch(new URL(path,origin),{method:'POST',headers:{'Content-Type':'application/json','X-Travel-Day-Photos':'4',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(105000)});
 return {status:response.status,body:await response.json()};
};
try {
 const health=await fetch(origin,{signal:AbortSignal.timeout(10000)});assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');report.checks.push('health 200');
 const noSession=await post('/api/place-photos',{places:[]});assert.equal(noSession.status,401);report.checks.push('photo endpoint requires a session');
 const session=await post('/api/session',{});assert.equal(session.status,200);const token=session.body.sessionToken;assert.equal(typeof token,'string');
 if(!photosOnly){
 const first='从新疆出发，三个人去大阪、京都、东京和北海道，预算不多';
 const history=[{role:'user',content:first}];
 let reply=await post('/api/chat',{messages:history},token);assert.equal(reply.status,200);assert.equal(typeof reply.body.reply,'string');
 assert.doesNotMatch(reply.body.reply,/^Day\s*\d/m);assert.ok(reply.body.reply.length<700);assert.ok((reply.body.reply.match(/[？?]/g)??[]).length<=3,'at most three visible clarification questions');assert.match(reply.body.reply,/天|日|时间|多久|几天/);
 report.replies.push({case:'clarification',text:reply.body.reply});report.checks.push('incomplete request asks instead of inventing days');
 history.push({role:'assistant',content:reply.body.reply},{role:'user',content:'14天，每人预算1万人民币，包含来回交通、住宿和餐饮。路线顺序您按省钱省心决定，兴趣是动漫、美食和自然，不用再确认，直接给我完整行程。'});
 reply=await post('/api/chat',{messages:history},token);assert.equal(reply.status,200);
 assert.deepEqual([...reply.body.reply.matchAll(/^Day\s*(\d+)\s*[｜|]/gm)].map(match=>+match[1]),Array.from({length:14},(_,i)=>i+1));
 assert.match(reply.body.reply,/预算对比/);assert.doesNotMatch(reply.body.reply,/^\d{1,2}:\d{2}｜/m);
 report.replies.push({case:'complete fourteen days',text:reply.body.reply});report.checks.push('all 14 days in one reply, no time column');
 }
 if(!chatOnly){
 const requestedPhotos=[{name:'清水寺',city:'京都'},{name:'東京タワー',city:'東京'},{name:'高尾山薬王院',city:'八王子'}];
 const photos=await post('/api/place-photos',{places:requestedPhotos},token);
 assert.equal(photos.status,200);assert.equal(photos.body.enabled,true);
 report.photoDiagnostics={unavailable:photos.body.unavailable===true,omissions:photos.body.omissions??[]};
 // The two known available landmarks must match. Takao is an omission check:
 // exact identity/landscape filtering may legitimately leave it without a photo.
 for(const query of requestedPhotos.slice(0,2))assert.ok(photos.body.photos.some(photo=>photo.name===query.name&&photo.city===query.city),'Google real photo match still needs diagnosis; no fixture substitutes');
 for(const photo of photos.body.photos){assert.equal(photo.provider,'google-places');assert.match(photo.url,/^https:\/\/(?:[a-z0-9-]+\.)*googleusercontent\.com\//);assert.ok(photo.authors.every(author=>typeof author.displayName==='string'));assert.ok(!JSON.stringify(photo).includes('GOOGLE_PLACES_API_KEY'));}
 report.checks.push('real Google photo metadata matched (visual subject check still required)');
 report.photos=photos.body.photos.map(({name,city,placeId,authors})=>({query:{name,city},placeId,hasAttributions:authors.length>0}));
 report.photoOmissions=requestedPhotos.filter(query=>!photos.body.photos.some(photo=>photo.name===query.name&&photo.city===query.city));
 const missing=await post('/api/place-photos',{places:[{name:'存在しない競技検証スポット000000',city:'京都'}]},token);assert.equal(missing.status,200);assert.equal(missing.body.photos.length,0);
 report.checks.push('no match returns empty photos, not an itinerary failure');
 }
 // Do not save Google photo names/URLs or session tokens in the report.
 report.note='HTTP checks only. Expo Go keyboard, author links and recognizable exterior matching require physical-phone evidence.';
} catch(error){report.failure=error instanceof Error?error.message:'Live check failed';process.exitCode=1;}
await writeFile(reportFile,JSON.stringify(report,null,2),{mode:0o600});await chmod(reportFile,0o600);
console.log(JSON.stringify({checks:report.checks,failure:report.failure,reportFile}));
