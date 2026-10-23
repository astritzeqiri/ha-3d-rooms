/** Isolated HA smoke check. Never targets an address from user credentials. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import WebSocket from '../rooms-app/node_modules/ws/wrapper.mjs';
const base='http://127.0.0.1:18123';
const file='/tmp/three-d-rooms-ha-session.json';
let session;
try {session=JSON.parse(await readFile(file,'utf8'));} catch {
  const password=randomBytes(20).toString('hex');
  const res=await fetch(base+'/api/onboarding/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Rooms Test',username:'rooms-test',password,language:'en',client_id:base+'/'})});
  const user=await res.json();
  assert.ok(res.ok,JSON.stringify(user));
  const token=await (await fetch(base+'/auth/token',{method:'POST',body:new URLSearchParams({grant_type:'authorization_code',code:user.auth_code,client_id:base+'/'})})).json();
  assert.ok(token.access_token,'test login token');
  session={...token,username:'rooms-test',password};
  await writeFile(file,JSON.stringify(session),{mode:0o600});
}
const request=async(path,options={})=>{
 const res=await fetch(base+path,{...options,headers:{Authorization:`Bearer ${session.access_token}`,...options.headers}});
 let result; try {result=await res.json();} catch {result={};}
 assert.ok(res.ok,`${path}: ${res.status} ${JSON.stringify(result)}`);return result;
};
for(const step of ['core_config','analytics','integration']) {
 await fetch(base+'/api/onboarding/'+step,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({client_id:base+'/',redirect_uri:base+'/'})});
}
let entries=await request('/api/config/config_entries/entry');
if(!entries.some(e=>e.domain==='three_d_rooms')) {
 let flow=await request('/api/config/config_entries/flow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handler:'three_d_rooms',show_advanced_options:false})});
 assert.equal(flow.type,'form',JSON.stringify(flow));
 flow=await request('/api/config/config_entries/flow/'+flow.flow_id,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal(flow.type,'create_entry',JSON.stringify(flow));
}
const ws=new WebSocket('ws://127.0.0.1:18123/api/websocket');
let sequence=0;
const waiting=new Map();
await new Promise((resolve,reject)=>{
 ws.on('message',raw=>{
  const msg=JSON.parse(raw);
  if(msg.type==='auth_required') ws.send(JSON.stringify({type:'auth',access_token:session.access_token}));
  else if(msg.type==='auth_ok') resolve();
  else if(msg.type==='auth_invalid') reject(new Error('auth failed'));
  else if(msg.type==='result') {const pending=waiting.get(msg.id);waiting.delete(msg.id);msg.success?pending?.resolve(msg.result):pending?.reject(new Error(JSON.stringify(msg.error)));}
 }); ws.on('error',reject);
});
const call=msg=>new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,...msg}));});
try {
 const models=await call({type:'three_d_rooms/request',operation:'models'});
 console.log('Native integration loaded; current models:',models.map(m=>m.id));
 const panels=await call({type:'get_panels'});
 assert.ok(panels.three_d_rooms,'sidebar panel registered');
 const noAuth=await fetch(base+'/api/three_d_rooms/models/kitchen/scene.glb');
 assert.equal(noAuth.status,401,'private assets require authentication');
 const asset=await fetch(base+'/three_d_rooms_static/three-d-rooms-card.js');
 assert.equal(asset.status,200,'bundled card served');
 const source=await asset.text();
 assert.ok(source.includes('three-d-rooms-panel'));
 if(!models.some(m=>m.id==='kitchen')) {
   const upload=await request('/api/three_d_rooms/models',{method:'POST',body:await readFile(new URL('../model-exports/kitchen.zip',import.meta.url))});
   assert.equal(upload.id,'kitchen');
 }
 const catalog=await call({type:'three_d_rooms/request',operation:'models'});
 const kitchen=catalog.find(m=>m.id==='kitchen');
 assert.ok(kitchen.controls.length);
 const scene=await fetch(base+'/api/three_d_rooms/models/kitchen/scene.glb',{headers:{Authorization:`Bearer ${session.access_token}`}});
 assert.equal(scene.status,200);
 assert.ok((await scene.arrayBuffer()).byteLength>1000);
 const status=await call({type:'three_d_rooms/request',operation:'status'});
 const rgb=status.entities.find(e=>e.entity_id.startsWith('light.') && e.attributes.supported_color_modes?.includes('hs'));
 assert.ok(rgb,'built-in demo RGB light exists');
 const id=kitchen.controls[0].id;
 await call({type:'three_d_rooms/request',operation:'bindings',data:{model:'kitchen',controlId:id,entityId:rgb.entity_id}});
 const command=settings=>call({type:'three_d_rooms/request',operation:'command',data:{model:'kitchen',controlId:id,...settings}});
 await command({action:'on',brightness:120,rgb_color:[255,60,30]});
 let changed=(await call({type:'three_d_rooms/request',operation:'status'})).entities.find(e=>e.entity_id===rgb.entity_id);
 assert.equal(changed.state,'on');
 assert.equal(changed.attributes.brightness,120);
 await command({action:'off'});
 changed=(await call({type:'three_d_rooms/request',operation:'status'})).entities.find(e=>e.entity_id===rgb.entity_id);
 assert.equal(changed.state,'off');
 await assert.rejects(command({action:'on',rgb_color:[999,0,0]}),/RGB/);
 const white=status.entities.find(e=>e.entity_id.startsWith('light.') && e.attributes.supported_color_modes?.includes('color_temp'));
 assert.ok(white,'built-in demo white-temperature light exists');
 await call({type:'three_d_rooms/request',operation:'bindings',data:{model:'kitchen',controlId:id,entityId:white.entity_id}});
 const kelvin=white.attributes.min_color_temp_kelvin;
 await command({action:'on',color_temp_kelvin:kelvin});
 changed=(await call({type:'three_d_rooms/request',operation:'status'})).entities.find(e=>e.entity_id===white.entity_id);
 assert.equal(changed.attributes.color_temp_kelvin,kelvin);
 await assert.rejects(command({action:'on',color_temp_kelvin:100}),/Kelvin/);
 const exported=await fetch(base+'/api/three_d_rooms/models/kitchen/export.zip',{headers:{Authorization:`Bearer ${session.access_token}`}});
 assert.equal(exported.status,200);
 await writeFile('/tmp/three-d-rooms-migration-test.zip',Buffer.from(await exported.arrayBuffer()));
 const dashboards=await call({type:'lovelace/dashboards/list'});
 if (!dashboards.some(d=>d.url_path==='rooms-check')) await call({type:'lovelace/dashboards/create',url_path:'rooms-check',title:'3D Rooms Check',show_in_sidebar:true,require_admin:true});
 await call({type:'lovelace/config/save',url_path:'rooms-check',config:{views:[{title:'Kitchen',path:'kitchen',type:'masonry',cards:[{type:'custom:three-d-rooms-card',model:'kitchen',height:600,view:'front',tilt:28,heading:0}]}]}});
 console.log('PASS: setup, sidebar, bundled module, private upload/scene/export, RGB/brightness/off/temperature service updates and invalid settings rejected.');
} finally {ws.close();}
