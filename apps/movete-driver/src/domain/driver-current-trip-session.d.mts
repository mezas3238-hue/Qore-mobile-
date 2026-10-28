import type {DriverWorkspaceSession} from './driver-workspace.mjs';
import type {DriverCurrentTrip} from './driver-current-trip-http.mjs';
export declare function verifyPrivateDriverCurrentTrip(options:{
 session:DriverWorkspaceSession;
 getSession:()=>Promise<DriverWorkspaceSession|null>;
 readCurrent:(input:{accessToken:string})=>Promise<DriverCurrentTrip|null>;
}):Promise<DriverCurrentTrip|null>;
