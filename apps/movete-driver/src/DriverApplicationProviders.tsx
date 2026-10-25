import React,{createContext,useContext,useMemo} from 'react';
import {DriverWorkspaceProvider} from './DriverWorkspaceProvider';
import {DriverMessagesProvider} from './DriverMessagesProvider';
import {DriverOfferActionsProvider} from './DriverOfferActionsProvider';
import {DriverTripProvider} from './DriverTripProvider';
import {DriverKycExpiryProvider} from './DriverKycExpiryProvider';
import {DriverDocumentUploadProvider} from './DriverDocumentUploadProvider';
import {DriverCustodyProvider} from './DriverCustodyProvider';
import type {DriverStagingRuntime} from './domain/driver-staging-runtime.mjs';
import {getNativeDriverAuth} from './NativeDriverAuth';
import type {NativeDriverAuth} from './domain/native-driver-auth.mjs';
const NativeAuthContext=createContext<NativeDriverAuth|null>(null);
export const useNativeDriverAuth=()=>useContext(NativeAuthContext);

/**
 * G62C: single Driver-only application composition. No default STAGING
 * credentials or endpoint. Mobile app remains offline unless an independently
 * authorized integrator explicitly supplies a verified STAGING runtime.
 */
export function DriverApplicationProviders({
 children,runtime=null
}:{
 children:React.ReactNode;
 runtime?:DriverStagingRuntime|null;
}){
 if(runtime!==null&&(runtime.allowedByOwner!==true||
   runtime.productionEnabled!==false||runtime.qaOnly!==true))
  throw Error('G62 Driver provider refuses unapproved/production runtime');
 const nativeAuth=useMemo(()=>getNativeDriverAuth(),[]);
 // Native login alone grants no Driver dispatch or KYC authority.
 const identity=runtime?.authAdapter??nativeAuth;
 return <NativeAuthContext.Provider value={nativeAuth}><DriverWorkspaceProvider
  authAdapter={identity}
  apiOrigin={runtime?.apiOrigin??null}
  approvedStagingHost={runtime?.approvedStagingHost??null}
  allowedByOwner={runtime?.allowedByOwner??false}
  readInbox={runtime?.workspaceReaders.readInbox}
  readDocuments={runtime?.workspaceReaders.readDocuments}
  readLicense={runtime?.workspaceReaders.readLicense}>
  <DriverKycExpiryProvider
   authAdapter={identity}
   adapter={runtime?.kycValidityAdapter??null}>
 <DriverDocumentUploadProvider
   authAdapter={identity}
   qaAdapters={runtime?.documentUploads??null}>
 <DriverOfferActionsProvider
   authAdapter={identity}
   qaAdapters={runtime?.offerActions??null}>
  <DriverTripProvider
   authAdapter={identity}
   qaAdapters={runtime?.tripActions??null}>
  <DriverCustodyProvider
   authAdapter={identity}
   qaAdapters={runtime?.custodyActions??null}>
  <DriverMessagesProvider
   authAdapter={identity}
   qaAdapters={runtime?.chatAdapters??null}>
   {children}
  </DriverMessagesProvider>
  </DriverCustodyProvider>
  </DriverTripProvider>
  </DriverOfferActionsProvider>
 </DriverDocumentUploadProvider>
 </DriverKycExpiryProvider>
 </DriverWorkspaceProvider></NativeAuthContext.Provider>;
}
