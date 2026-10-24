import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {createG58BLocalAuthChainQa} from './g58b-local-auth-chain-qa.mjs';
const at=Date.parse('2026-10-24T12:00:00Z');
const seconds=Math.floor(at/1000);
const issuer='https://isolated-qore.supabase.co/auth/v1';
const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const keyId='qa-g58b-primary';
const publicKeys=new Map([[keyId,{alg:'ES256',jwk:keys.publicKey.export({format:'jwk'})}]]);
const ID=n=>'58582000-0000-4858-8858-'+String(n).padStart(12,'0');
const driver=ID(1),passenger=ID(2),sDriver=ID(101),sPassenger=ID(102);
const service=ID(201),thread=ID(301),toDriver=ID(401),toPassenger=ID(402);
const markerDriver=ID(501),markerPassenger=ID(502);
const users=new Map([[driver,{id:driver,email_confirmed_at:'2026-10-20T00:00:00Z',is_anonymous:false}],
 [passenger,{id:passenger,email_confirmed_at:'2026-10-20T00:00:00Z',is_anonymous:false}]]);
const sessions=new Map([[driver,sDriver],[passenger,sPassenger]]);
const roleMap=new Map([[driver,'driver'],[passenger,'passenger']]);
const jwt=(actor,patch={})=>{
 const h=Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT',kid:keyId})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({
  iss:issuer,aud:'authenticated',role:'authenticated',sub:actor,
  session_id:sessions.get(actor),iat:seconds-30,exp:seconds+600,
  is_anonymous:false,app_metadata:{roles:['admin','driver']},...patch
 })).toString('base64url');
 const s=sign('sha256',Buffer.from(h+'.'+payload),
  {key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return h+'.'+payload+'.'+s;
};
const tokenDriver=jwt(driver),tokenPassenger=jwt(passenger);
function fixture(options={}){
 const calls=[],tickets=new Map(),validGrants=new Map([[driver,true],[passenger,true]]);
 const cfg={
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  issuer,audience:'authenticated',publicKeys,now:()=>at,
  cursorSecret:Buffer.alloc(32,0x58),
  readProviderUser:async actor=>users.get(actor)??null,
  readProviderSession:async({userId,sessionId})=>
   sessions.get(userId)===sessionId?{
    userId,sessionId,active:true,expiresAtMs:at+900000,
    assuranceLevel:'aal1',verifiedAtMs:at-1000
   }:null,
  readPrivateSessionGrant:async({userId,sessionId})=>
   validGrants.get(userId)===true&&sessions.get(userId)===sessionId,
  readExclusiveRole:async actor=>roleMap.get(actor)??null,
  allowRequest:()=>true,
  issueSyntheticTicket:async proof=>{
   calls.push(['mint',proof]);
   if(!users.has(proof.actorId)||
    validGrants.get(proof.actorId)!==true||
    proof.sessionId!==sessions.get(proof.actorId)||
    proof.tokenIatMs!==(seconds-30)*1000)
    throw Error('synthetic fixture denied');
   const ticket=randomUUID();
   tickets.set(ticket,{...proof,used:false});
   return {ticket,operation:proof.operation,expiresAtMs:at+10000,
    productionEnabled:false,qaOnly:true};
  },
  openConnection:async()=>{
   let role=null,ticketPending=null;
   return {
    async query(sql,args){
     calls.push(['db',sql,args]);
     if(sql==='BEGIN'||sql==='ROLLBACK'){
      if(sql==='ROLLBACK')ticketPending=null;
      return {rows:[]};
     }
     if(sql==='COMMIT'){
      if(ticketPending)tickets.get(ticketPending).used=true;
      return {rows:[]};
     }
     if(sql.startsWith('SET LOCAL ROLE ')){
      role=sql.slice('SET LOCAL ROLE '.length);return {rows:[]};
     }
     if(sql.includes('AS effective_role'))
      return {rows:[{effective_role:role,database:'qore_disposable_chain',
       application_name:'qore_ci_disposable_chain'}]};
     const match=/^SELECT public\.([a-z0-9_]+)\(/.exec(sql);
     if(!match)throw Error('unlisted SQL');
     const rec=tickets.get(args[0]);
     if(!rec||rec.used){const e=Error('used ticket');e.code='G5715';throw e;}
     const mappings={
      mobility_stage_g56_driver_inbox_qa:['DRIVER_INBOX','driver'],
      mobility_stage_g57b_driver_history_markers_qa:['DRIVER_HISTORY','driver'],
      mobility_stage_g57b_driver_mark_visible_qa:['DRIVER_MARK_VISIBLE','driver'],
      mobility_stage_g49_open_qa:['CHAT_OPEN','passenger'],
      mobility_stage_g57_history_markers_qa:['CHAT_HISTORY','passenger'],
      mobility_stage_g57_mark_visible_ordered_qa:['CHAT_READ','passenger']
     };
     const expected=mappings[match[1]];
     const allowedRole=expected?.[1]==='driver'?
      'mobility_g56_driver_gateway_ci':'mobility_g49_chat_gateway_ci';
     if(!expected||rec.operation!==expected[0]||role!==allowedRole||
      roleMap.get(rec.actorId)!==expected[1]){
      const e=Error('wrong scope');e.code='G5713';throw e;
     }
     if(validGrants.get(rec.actorId)!==true){
      const e=Error('revoked');e.code='G5711';throw e;
     }
     ticketPending=args[0];
     let data;
     const info={conversationId:thread,serviceKind:'RIDE',serviceId:service};
     const common={...info,revision:3,generatedAt:at,expiresAt:at+40000,
      assignmentVerified:true,state:'ACTIVE',canSend:true,
      hasMore:false,nextPosition:null,productionEnabled:false,qaOnly:true};
     if(rec.operation==='DRIVER_INBOX'){
      data={ownerId:driver,revision:1,generatedAt:at,expiresAt:at+40000,
       items:[],hasMore:false,nextPosition:null,productionEnabled:false,qaOnly:true};
     }else if(rec.operation==='CHAT_OPEN'){
      data={...info,serverStored:true,qaOnly:true};
     }else if(rec.operation==='DRIVER_HISTORY'){
      data={page:{...common,ownerId:driver,counterpartRole:'passenger',
       messages:[{messageId:toDriver,senderRole:'passenger',
        body:'Hola conductor',createdAt:at-2000,revision:2}]},
       readMarkers:[{messageId:toDriver,marker:markerDriver,
        expiresAtMs:at+20000}],qaOnly:true,productionEnabled:false};
     }else if(rec.operation==='CHAT_HISTORY'){
      data={page:{...common,ownerId:passenger,counterpartRole:'driver',
       messages:[{messageId:toPassenger,senderRole:'driver',
        body:'Voy llegando',createdAt:at-2000,revision:2}]},
       readMarkers:[{messageId:toPassenger,marker:markerPassenger,
        expiresAtMs:at+20000}],qaOnly:true,productionEnabled:false};
     }else{
      const expectedMarker=rec.operation==='DRIVER_MARK_VISIBLE'?
       markerDriver:markerPassenger;
      if(args[1]!==expectedMarker){
       const e=Error('foreign marker');e.code='G5708';throw e;
      }
      data={conversationId:thread,
       messageId:rec.operation==='DRIVER_MARK_VISIBLE'?toDriver:toPassenger,
       readConfirmed:true,qaOnly:true};
     }
     return {rows:[{data}]};
    },
    async release(){calls.push(['release']);}
   };
  },
  ...options
 };
 return {app:createG58BLocalAuthChainQa(cfg),calls,validGrants,tickets,cfg};
}
async function http(port,path,token,{method='GET',body}={}){
 const answer=await fetch('http://127.0.0.1:'+port+path,{
  method,headers:{authorization:'Bearer '+token,
   ...(body===undefined?{}:{'content-type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 return {status:answer.status,headers:answer.headers,body:await answer.json()};
}
test('G58B signed JWT -> independent provider/G42/role -> minted QA ticket -> delegated SQL -> loopback',async()=>{
 const x=fixture();const {port,address}=await x.app.listen();
 try{
  assert.equal(address,'127.0.0.1');
  const inbox=await http(port,'/v1/staging/driver/chat/conversations',tokenDriver);
  assert.equal(inbox.status,200,JSON.stringify(inbox.body));
  assert.equal(inbox.body.ownerId,driver);
  assert.deepEqual(inbox.body.items,[]);
  const dh=await http(port,'/v1/staging/driver/chat/services/RIDE/'+service+
   '/conversations/'+thread+'/history-with-ordered-markers',tokenDriver);
  assert.equal(dh.status,200,JSON.stringify(dh.body));
  assert.equal(dh.body.page.messages[0].messageId,toDriver);
  assert.equal(dh.body.readMarkers[0].marker,markerDriver);
  const ph=await http(port,'/v1/staging/chat/services/RIDE/'+service+
   '/history-with-ordered-markers',tokenPassenger);
  assert.equal(ph.status,200,JSON.stringify(ph.body));
  assert.equal(ph.body.page.messages[0].messageId,toPassenger);
  assert.equal(ph.body.readMarkers[0].marker,markerPassenger);
  const dAck=await http(port,
   '/v1/staging/driver/chat/conversations/'+thread+'/mark-visible-ordered',
   tokenDriver,{method:'POST',body:{messageId:toDriver,marker:markerDriver}});
  assert.equal(dAck.status,200,JSON.stringify(dAck.body));
  assert.equal(dAck.body.readConfirmed,true);
  const pAck=await http(port,
   '/v1/staging/chat/conversations/'+thread+'/mark-visible-ordered',
   tokenPassenger,{method:'POST',body:{messageId:toPassenger,marker:markerPassenger}});
  assert.equal(pAck.status,200,JSON.stringify(pAck.body));
  assert.equal(pAck.body.readConfirmed,true);
  assert.equal(x.calls.filter(v=>v[0]==='mint').length,6,'Passenger history includes delegated G49 open');
  assert.equal(x.calls.filter(v=>v[0]==='db'&&v[1]==='COMMIT').length,6);
  assert.ok(!JSON.stringify(dAck.body).includes('throughSeq'));
  assert.ok(!JSON.stringify(ph.body).includes('nextPosition'));
 }finally{await x.app.close();}
});
test('G58B malformed signature, wrong issuer/audience or forged JWT role cannot cross adapters',async()=>{
 const x=fixture();const {port}=await x.app.listen();
 try{
  const base='/v1/staging/driver/chat/conversations';
  const unauthorized=[tokenDriver.slice(0,-4)+'ABCD',
   jwt(driver,{aud:'service_role'}),jwt(driver,{iss:'https://other.supabase.co/auth/v1'}),
   jwt(driver,{exp:seconds-2}),jwt(driver,{session_id:ID(999)})];
  for(const token of unauthorized){
   const r=await http(port,base,token);
   assert.equal(r.status,401,JSON.stringify(r));
  }
  const wrongRole=await http(port,base,tokenPassenger);
  assert.equal(wrongRole.status,403);
  const wrongEndpoint=await http(port,
   '/v1/staging/chat/services/RIDE/'+service+'/history-with-ordered-markers',tokenDriver);
  assert.equal(wrongEndpoint.status,403);
  assert.equal(x.calls.some(v=>v[0]==='mint'&&v[1].actorId===passenger),false);
 }finally{await x.app.close();}
});
test('G58B revoked grant and provider outage block every SQL action before mint',async()=>{
 const x=fixture();const {port}=await x.app.listen();
 try{
  x.validGrants.set(driver,false);
  let r=await http(port,'/v1/staging/driver/chat/conversations',tokenDriver);
  assert.equal(r.status,401);
  assert.equal(x.calls.filter(a=>a[0]==='mint').length,0);
  x.validGrants.set(driver,true);
  r=await http(port,'/v1/staging/driver/chat/conversations',tokenDriver);
  assert.equal(r.status,200);
  x.validGrants.set(passenger,false);
  r=await http(port,'/v1/staging/chat/services/RIDE/'+service+
   '/history-with-ordered-markers',tokenPassenger);
  assert.equal(r.status,401);
 }finally{await x.app.close();}
});
test('G58B missing/mixed role, production settings and missing SQL sources fail closed',async()=>{
 for(const wrong of [{environment:'production'},{liveEnabled:true},
  {localQaOnly:false},{openConnection:null},{issueSyntheticTicket:null},
  {readProviderSession:null},{readPrivateSessionGrant:null},
  {cursorSecret:Buffer.alloc(8)}, {publicKeys:new Map()}]){
  assert.throws(()=>fixture(wrong));
 }
 const x=fixture({readExclusiveRole:async()=>['driver','passenger']});
 const {port}=await x.app.listen();
 try{
  const r=await http(port,'/v1/staging/driver/chat/conversations',tokenDriver);
  assert.notEqual(r.status,200);
  assert.equal(x.calls.filter(a=>a[0]==='mint').length,0);
 }finally{await x.app.close();}
});
test('G58B refused marker and SQL authorization conflicts never yield optimistic read ACK',async()=>{
 const x=fixture();const {port}=await x.app.listen();
 try{
  const response=await http(port,
   '/v1/staging/driver/chat/conversations/'+thread+'/mark-visible-ordered',
   tokenDriver,{method:'POST',body:{messageId:toDriver,marker:ID(998)}});
  assert.notEqual(response.status,200);
  assert.equal(response.body.readConfirmed,undefined);
  assert.ok(!JSON.stringify(response).includes('password'));
 }finally{await x.app.close();}
});

test('G58C integrated localhost budget returns 429 after 30 valid requests from one authenticated Driver',async()=>{
 const x=fixture();const {port}=await x.app.listen();
 try{
  const endpoint='/v1/staging/driver/chat/conversations';
  for(let index=0;index<30;index++){
   const r=await http(port,endpoint,tokenDriver);
   assert.equal(r.status,200,'valid request '+index+': '+JSON.stringify(r.body));
  }
  const blocked=await http(port,endpoint,tokenDriver);
  assert.equal(blocked.status,429);
  assert.equal(blocked.body.code,'DRIVER_INBOX_RATE_LIMIT');
  assert.equal(x.calls.filter(v=>v[0]==='mint').length,30);
  // Another verified person is not counted in the first Driver's budget.
  const separate=await http(port,
   '/v1/staging/chat/services/RIDE/'+service+'/history-with-ordered-markers',
   tokenPassenger);
  assert.equal(separate.status,200);
 }finally{await x.app.close();}
});
