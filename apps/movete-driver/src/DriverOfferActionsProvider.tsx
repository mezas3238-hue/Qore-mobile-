import React,{createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {createDriverOfferActionsController}
 from './domain/driver-offer-actions.mjs';
import type {DriverOfferActionsController,DriverOfferActionsAdapters,
 DriverOfferActionsSnapshot,DriverOfferDecisionStatus,OfferAction}
 from './domain/driver-offer-actions.mjs';
import type {DriverAuthSessionAdapter} from './domain/driver-workspace.mjs';
import {useDriverWorkspace} from './DriverWorkspaceProvider';
import {useDriverKycExpiry} from './DriverKycExpiryProvider';
import type {DriverPrivateDeliveryDetail} from './domain/driver-private-delivery-detail.mjs';
import {verifyFreshDeliveryAccept}
 from './domain/driver-delivery-accept-preflight.mjs';

type State=Omit<DriverOfferActionsSnapshot,'phase'>&{
 phase:DriverOfferActionsSnapshot['phase']|'not-configured';
};
type ContextValue={
 state:State;enabled:boolean;
 detail:{phase:'idle'|'loading'|'ready'|'unavailable';
  item:DriverPrivateDeliveryDetail|null};
 inspectDelivery:(offerId:string,deliveryId:string)=>Promise<void>;
 decide:(offerId:string,action:OfferAction)=>Promise<DriverOfferDecisionStatus|null>;
 reconcilePending:(offerId:string)=>Promise<void>;
};
const OFF:State=Object.freeze({phase:'not-configured',
 offers:Object.freeze([]),decisions:Object.freeze([]),
 busy:false,qaOnly:true,productionEnabled:false});
const Context=createContext<ContextValue|null>(null);
export function DriverOfferActionsProvider({
 children,authAdapter=null,qaAdapters=null
}:{
 children:React.ReactNode;
 authAdapter?:DriverAuthSessionAdapter|null;
 qaAdapters?:DriverOfferActionsAdapters|null;
}){
 const {state:workspace}=useDriverWorkspace();
 const kyc=useDriverKycExpiry();
 const preflightLock=useRef(false);
 const previewEpoch=useRef(0),previewBusy=useRef(false);
 const latestWorkspace=useRef(workspace);latestWorkspace.current=workspace;
 const [detail,setDetail]=useState<ContextValue['detail']>({
  phase:'idle',item:null
 });
 const kycReady=kyc.phase==='connected'&&kyc.snapshot?.state==='READY_QA'
  &&kyc.snapshot.accountBlocked===false;
 const controller:DriverOfferActionsController|null=useMemo(
  ()=>qaAdapters?createDriverOfferActionsController(qaAdapters):null,
  [qaAdapters]);
 const [state,setState]=useState<State>(()=>controller?.current()??OFF);
 useEffect(()=>{
  if(!controller||!authAdapter){setState(OFF);return;}
  let active=true,epoch=0;
  setState(controller.current());
  const unsubscribe=controller.subscribe(value=>{
   if(active)setState(value);
  });
  const synchronize=async()=>{
   const nonce=++epoch;previewEpoch.current++;
   previewBusy.current=false;setDetail({phase:'idle',item:null});
   controller.clear(); // immediately remove stale offer/action state
   try{
    const verified=await authAdapter.getSession();
    if(!active||epoch!==nonce)return;
    controller.setSession(verified);
   }catch{if(active&&epoch===nonce)controller.clear();}
  };
  let stop:undefined|(()=>void);
  try{stop=authAdapter.subscribe?.(()=>{void synchronize();});}
  catch{controller.clear();}
  void synchronize();
  return ()=>{active=false;epoch++;previewEpoch.current++;
   stop?.();unsubscribe();controller.clear();};
 },[controller,authAdapter]);
 useEffect(()=>{
  if(!controller||!authAdapter||state.phase!=='ready')return;
  if(workspace.phase==='connected'){
   controller.setOffers(workspace.offers,
    {currentLicenseApproved:workspace.currentLicenseApproved&&kycReady});
  }else{
   // A stale inbox must not remain actionable during offline, refresh or logout.
   controller.setOffers([],{currentLicenseApproved:false});
  }
 },[controller,authAdapter,workspace,state.phase,kycReady]);
 useEffect(()=>{
  if(detail.item&&!(workspace.phase==='connected'
   &&workspace.offers.some(o=>o.kind==='DELIVERY'
    &&o.offerId===detail.item?.offerId
    &&o.serviceId===detail.item?.deliveryId
    &&o.expiresAtMs>Date.now()+3000))){
   previewEpoch.current++;setDetail({phase:'idle',item:null});
  }
 },[workspace,detail.item]);
 const context=useMemo<ContextValue>(()=>({
  state,enabled:!!controller&&!!authAdapter,
  detail,
  inspectDelivery:async(offerId,deliveryId)=>{
   if(previewBusy.current||!qaAdapters?.readDeliveryDetail||!authAdapter
    ||workspace.phase!=='connected')return;
   const current=workspace.offers.find(o=>o.kind==='DELIVERY'
    &&o.offerId===offerId&&o.serviceId===deliveryId
    &&o.expiresAtMs>Date.now()+3000);
   if(!current)return;
   const generation=++previewEpoch.current;previewBusy.current=true;
   setDetail({phase:'loading',item:null});
   try{
    const before=await authAdapter.getSession();
    if(!before||before.role!=='driver'||generation!==previewEpoch.current)
     throw Error('session');
    const dto=await qaAdapters.readDeliveryDetail({
     accessToken:before.accessToken,offerId
    });
    const after=await authAdapter.getSession();
    const observed=latestWorkspace.current;
    if(generation!==previewEpoch.current)return;
    if(!after||after.role!=='driver'
     ||after.userId!==before.userId||after.accessToken!==before.accessToken
     ||observed.phase!=='connected'
     ||!observed.offers.some(o=>o.kind==='DELIVERY'&&o.offerId===offerId
       &&o.serviceId===deliveryId&&o.expiresAtMs===current.expiresAtMs)
     ||dto.offerId!==offerId||dto.deliveryId!==deliveryId
     ||dto.expiresAtMs!==current.expiresAtMs
     ||dto.expiresAtMs<=Date.now()+3000
     ||dto.qaOnly!==true||dto.productionEnabled!==false)
     throw Error('unverified');
    setDetail({phase:'ready',item:dto});
   }catch{
    if(generation===previewEpoch.current)
     setDetail({phase:'unavailable',item:null});
   }finally{
    if(generation===previewEpoch.current)previewBusy.current=false;
   }
  },
  reconcilePending:async offerId=>{
   if(workspace.phase!=='connected')return;
   await controller?.reconcilePending(offerId);
  },
  decide:async(offerId,action)=>{
   if(preflightLock.current||workspace.phase!=='connected'
    ||!workspace.currentLicenseApproved||!kycReady)return null;
   preflightLock.current=true; // closes rapid double-tap during KYC GET
   try{
    if(action==='accept'&&!await kyc.verifyForOffer())return null;
    const candidate=latestWorkspace.current.offers.find(x=>x.offerId===offerId);
    if(action==='accept'&&candidate?.kind==='DELIVERY'){
     const proof=await verifyFreshDeliveryAccept({
      offer:candidate,preview:detail.item,
      getSession:()=>authAdapter?.getSession(),
      readDetail:qaAdapters?.readDeliveryDetail,
      getWorkspace:()=>latestWorkspace.current
     });
     if(!proof.ok)return null;
    }
    // If a delivery disappeared mid-preflight, do not accidentally post
    // by relying on an earlier component render's offer snapshot.
    if(action==='accept'&&!candidate)return null;
    const snapshot=await controller?.decide({offerId,action});
    return snapshot?.decisions.find(d=>d.offerId===offerId&&d.action===action)??null;
   }finally{preflightLock.current=false;}
  }
 }),[state,controller,authAdapter,workspace,kycReady,kyc,detail,qaAdapters]);
 return <Context.Provider value={context}>{children}</Context.Provider>;
}
export function useDriverOfferActions(){
 const value=useContext(Context);
 if(value===null)throw Error('Driver offer actions provider missing');
 return value;
}
