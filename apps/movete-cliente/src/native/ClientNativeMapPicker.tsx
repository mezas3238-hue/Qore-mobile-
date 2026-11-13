/** Web-only fallback. A native map must not be simulated by a Web build. */
import type {PassengerPlace} from './client-location';
export type ClientMapPickerProps={
 visible:boolean;kind:'pickup'|'destination';initial:PassengerPlace|null;
 origin:PassengerPlace|null;onClose:()=>void;
 onConfirm:(place:PassengerPlace)=>void;
 onSearch:(query:string)=>Promise<{ok:true;places:readonly PassengerPlace[]}|{ok:false;code:string}>;
};
export function ClientNativeMapPicker(_props:ClientMapPickerProps){return null;}
