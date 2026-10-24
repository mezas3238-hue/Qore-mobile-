import {checkOfferCandidate, type OfferCandidate, type MobilityService, type VehicleKind} from './vehicle-eligibility.ts';

/**
 * G2 PREPRODUCTION proposal. Pure code does NOT authorize, write, lock or
 * create a commercial ride. Only an audited server txn can assign a vehicle.
 * Every field must be read from server-controlled tables, NEVER trusted
 * straight from a passenger/driver mobile request.
 */
export interface AssignmentProposalInput {
 rideId:string;
 passengerId:string;
 rideStatus:'searching'|'accepted'|'arriving'|'in_progress'|'completed'|'cancelled';
 existingDriverId:string|null;
 requestedService:MobilityService;
 rideVersion:number;
 actorId:string;
 driverId:string;
 vehicleId:string;
 vehicleOwnerId:string;
 vehicleRevision:number;
 candidate:OfferCandidate;
}

export interface VehicleAssignmentSnapshot {
 rideId:string;
 passengerId:string;
 driverId:string;
 vehicleId:string;
 vehicleKind:VehicleKind;
 service:MobilityService;
 expectedRideVersion:number;
 expectedVehicleRevision:number;
 proposedAtMs:number;
 expiresAtMs:number;
}

export type AssignmentProposalResult =
 | {ok:true;proposal:Readonly<VehicleAssignmentSnapshot>}
 | {ok:false;code:'INVALID_CONTEXT'|'VEHICLE_OWNERSHIP'|'RIDE_NOT_SEARCHING'|'SERVICE_MISMATCH'|'COMPLIANCE_DENIED'};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function prepareVehicleAssignment(input:AssignmentProposalInput,nowMs:number):AssignmentProposalResult {
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||
    ![input.rideId,input.passengerId,input.actorId,input.driverId,input.vehicleId,input.vehicleOwnerId]
    .every(id=>UUID.test(id))||
    !Number.isSafeInteger(input.rideVersion)||input.rideVersion<0||
    !Number.isSafeInteger(input.vehicleRevision)||input.vehicleRevision<1||
    input.passengerId===input.actorId)
  return {ok:false,code:'INVALID_CONTEXT'};
 if(input.actorId!==input.driverId||input.driverId!==input.vehicleOwnerId)
  return {ok:false,code:'VEHICLE_OWNERSHIP'};
 if(input.rideStatus!=='searching'||input.existingDriverId!==null)
  return {ok:false,code:'RIDE_NOT_SEARCHING'};
 if(input.requestedService!==input.candidate.service)
  return {ok:false,code:'SERVICE_MISMATCH'};
 if(!checkOfferCandidate(input.candidate,nowMs).eligible)
  return {ok:false,code:'COMPLIANCE_DENIED'};
 return {ok:true,proposal:Object.freeze({
  rideId:input.rideId,
  passengerId:input.passengerId,
  driverId:input.driverId,
  vehicleId:input.vehicleId,
  vehicleKind:input.candidate.vehicleKind,
  service:input.requestedService,
  expectedRideVersion:input.rideVersion,
  expectedVehicleRevision:input.vehicleRevision,
  proposedAtMs:nowMs,
  expiresAtMs:nowMs+5_000,
 })};
}
