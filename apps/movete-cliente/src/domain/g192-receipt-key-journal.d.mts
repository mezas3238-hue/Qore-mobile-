export type G192ReceiptKind='bind'|'confirm';
export type G192ReceiptRecord=Readonly<{
 version:1;subject:string;kind:G192ReceiptKind;deliveryId:string;
 requestKey:string;recipientId:string|null;createdAt:number;
}>;
export declare function createG192ReceiptKeyJournal(args:{
 readSecure:(key:string)=>Promise<string|null>;
 writeSecure:(key:string,value:string)=>Promise<void>;
 deleteSecure:(key:string)=>Promise<void>;
 now?:()=>number;
}):Readonly<{
 read:(subject:string,kind:G192ReceiptKind)=>Promise<G192ReceiptRecord|null>;
 arm:(args:{subject:string;kind:G192ReceiptKind;deliveryId:string;
  requestKey:string;recipientId?:string|null})=>Promise<G192ReceiptRecord>;
 clearVerified:(args:{subject:string;kind:G192ReceiptKind;deliveryId:string;
  requestKey:string;verifiedServerReceipt:Readonly<Record<string,unknown>>})=>Promise<boolean>;
}>;
