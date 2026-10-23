export type ClientSnapshot={
 authenticated:boolean;
 account:{subject:string;role:'passenger'}|null;
 mutation:{phase:string;operation:string|null;requestKey:string|null;error:string|null};
 tracking:{
  tripId:string|null;revision:number;state:string;
  assignedDriver:{name:string;plate:string}|null;
  position:{latitude:number;longitude:number}|null;etaMinutes:number|null;
  locationObservedAt:number|null;subscriptionActive:boolean;syncing:boolean;
  lastFetchedAt:number|null;lastError:string|null;liveEnabled:false;
 };
 quote:{quoteId:string;subjectId:string;amountGs:number;fareMode:string;
  subjectKind:string;expiresAt:number;fareVersion:string;formattedAmount:string}|null;
 history:{ownerId:string;nextCursor:string|null;
  items:readonly {serviceId:string;kind:string;status:string;createdAt:number;revision:number}[]}|null;
};
export type ClientResult={ok:boolean;code?:string;status?:number;requestKey?:string};
export type ClientExperience={
 subscribe(listener:()=>void):()=>void;
 refreshSession():Promise<ClientResult>;
 signOut():Promise<ClientResult>;
 clear():void;
 prepareRide(body:unknown):ClientResult;
 prepareDelivery(body:unknown):ClientResult;
 prepareFare(body:unknown):ClientResult;
 prepareSimulatedPayment(body:unknown):ClientResult;
 submit():Promise<ClientResult>;
 retry():Promise<ClientResult>;
 startTracking(tripId:string):ClientResult;
 syncTracking():Promise<ClientResult>;
 connectionLost():void;
 acceptQuote(dto:unknown):boolean;
 acceptHistory(dto:unknown,options?:{append?:boolean}):boolean;
 snapshot():ClientSnapshot;
};
export declare function createClientExperience(options?:{
 authProvider?:{readSession:()=>unknown|Promise<unknown>;signOut?:()=>unknown|Promise<unknown>}|null;
 gateway?:{send:(operation:string,data?:unknown)=>unknown|Promise<unknown>}|null;
 now?:()=>number;
}):ClientExperience;
