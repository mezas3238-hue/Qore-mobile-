import React from 'react';
import {DriverWorkspaceProvider} from './DriverWorkspaceProvider';
import {DriverMessagesProvider} from './DriverMessagesProvider';
import {DriverOfferActionsProvider} from './DriverOfferActionsProvider';
import {DriverTripProvider} from './DriverTripProvider';
import {DriverCustodyProvider} from './DriverCustodyProvider';
import type {DriverStagingRuntime} from './domain/driver-staging-runtime.mjs';

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
 return <DriverWorkspaceProvider
  authAdapter={runtime?.authAdapter??null}
  apiOrigin={runtime?.apiOrigin??null}
  approvedStagingHost={runtime?.approvedStagingHost??null}
  allowedByOwner={runtime?.allowedByOwner??false}
  readInbox={runtime?.workspaceReaders.readInbox}
  readDocuments={runtime?.workspaceReaders.readDocuments}
  readLicense={runtime?.workspaceReaders.readLicense}>
  <DriverOfferActionsProvider
   authAdapter={runtime?.authAdapter??null}
   qaAdapters={runtime?.offerActions??null}>
  <DriverTripProvider
   authAdapter={runtime?.authAdapter??null}
   qaAdapters={runtime?.tripActions??null}>
  <DriverCustodyProvider
   authAdapter={runtime?.authAdapter??null}
   qaAdapters={runtime?.custodyActions??null}>
  <DriverMessagesProvider
   authAdapter={runtime?.authAdapter??null}
   qaAdapters={runtime?.chatAdapters??null}>
   {children}
  </DriverMessagesProvider>
  </DriverCustodyProvider>
  </DriverTripProvider>
  </DriverOfferActionsProvider>
 </DriverWorkspaceProvider>;
}
