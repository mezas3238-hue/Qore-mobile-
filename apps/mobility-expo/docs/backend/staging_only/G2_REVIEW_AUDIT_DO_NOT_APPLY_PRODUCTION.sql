-- G2 STAGING-ONLY: trusted server vehicle review and append-only audit.
-- Run AFTER G2_AUTO_MOTO_COMPLIANCE_* and G2_SERVER_PREFLIGHT_*.
-- NOT a commercial authorization or a ride dispatch RPC.
BEGIN;
ALTER TABLE public.mobility_vehicles
 ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision>0);

CREATE TABLE public.mobility_vehicle_review_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 new_status public.mobility_review_status NOT NULL
   CHECK (new_status IN ('approved','rejected')),
 vehicle_revision bigint NOT NULL CHECK (vehicle_revision>0),
 reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 12 AND 500),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(vehicle_id,vehicle_revision)
);
ALTER TABLE public.mobility_vehicle_review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_vehicle_review_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.mobility_vehicle_review_audit TO service_role;

-- Caller is the trusted backend alone; the gateway MUST extract _reviewer_id
-- from a verified admin JWT, never from request JSON. This function independently
-- confirms current admin role; only service_role may EXECUTE it.
CREATE FUNCTION public.mobility_review_vehicle(
 _vehicle_id uuid, _reviewer_id uuid, _approve boolean,
 _reason text, _request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 v public.mobility_vehicles%ROWTYPE;
 previous public.mobility_vehicle_review_audit%ROWTYPE;
 new_state public.mobility_review_status;
 decision_id uuid;
BEGIN
 IF _vehicle_id IS NULL OR _reviewer_id IS NULL OR _approve IS NULL
    OR _request_key IS NULL OR _reason IS NULL
    OR char_length(trim(_reason)) NOT BETWEEN 12 AND 500
 THEN RAISE EXCEPTION 'Invalid review input'; END IF;

 IF NOT EXISTS (SELECT 1 FROM public.user_roles
     WHERE user_id=_reviewer_id AND role='admin'::public.app_role)
 THEN RAISE EXCEPTION 'Verified admin role required'; END IF;

 SELECT * INTO v FROM public.mobility_vehicles WHERE id=_vehicle_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
 IF v.driver_id=_reviewer_id THEN RAISE EXCEPTION 'Self-review forbidden'; END IF;

 SELECT * INTO previous FROM public.mobility_vehicle_review_audit WHERE request_key=_request_key;
 IF FOUND THEN
   IF previous.vehicle_id<>_vehicle_id OR previous.reviewer_id<>_reviewer_id
      OR previous.new_status<>(
        CASE WHEN _approve THEN 'approved'::public.mobility_review_status
             ELSE 'rejected'::public.mobility_review_status END)
      OR previous.reason<>trim(_reason)
   THEN RAISE EXCEPTION 'Idempotency key already used for different review'; END IF;
   RETURN previous.id;
 END IF;

 new_state:=CASE WHEN _approve THEN 'approved'::public.mobility_review_status
                 ELSE 'rejected'::public.mobility_review_status END;
 IF v.review_status=new_state THEN RAISE EXCEPTION 'Already reviewed with this status'; END IF;
 IF v.review_status='suspended'::public.mobility_review_status
 THEN RAISE EXCEPTION 'Suspension requires separate compliance reinstatement'; END IF;

 IF _approve THEN
  -- Commercial moto authorization is NOT known. Always fail closed until
  -- municipal, passenger-age, and road-safety gates are independently verified.
  IF v.vehicle_kind='MOTO'::public.mobility_vehicle_kind
  THEN RAISE EXCEPTION 'Commercial MOTO approval gate not yet certified'; END IF;
  IF NOT EXISTS (
   SELECT 1 FROM public.mobility_vehicle_compliance vc
   JOIN public.mobility_driver_compliance dc ON dc.driver_id=v.driver_id
   JOIN public.user_roles r1 ON r1.user_id=vc.reviewed_by AND r1.role='admin'::public.app_role
   JOIN public.user_roles r2 ON r2.user_id=dc.license_verified_by AND r2.role='admin'::public.app_role
   WHERE vc.vehicle_id=v.id AND vc.reviewed_by<>v.driver_id
    AND dc.license_verified_by<>v.driver_id
    AND dc.driver_review_status='approved'::public.mobility_review_status
    AND dc.license_valid_through>=CURRENT_DATE
    AND vc.registration_valid_through>=CURRENT_DATE
    AND vc.insurance_valid_through>=CURRENT_DATE
    AND vc.paid_passenger_insurance_covered=true
    AND vc.inspection_valid_through>=CURRENT_DATE
    AND vc.municipal_authorization_valid_through>=CURRENT_DATE
    AND dc.license_verified_at<=now()
    AND vc.registration_verified_at<=now()
    AND vc.insurance_verified_at<=now()
    AND vc.inspection_verified_at<=now()
    AND vc.municipal_authorization_verified_at<=now()
  ) THEN RAISE EXCEPTION 'Missing independently verified and valid driver/vehicle compliance'; END IF;
 END IF;

 UPDATE public.mobility_vehicles SET review_status=new_state,updated_at=now(),revision=revision+1
 WHERE id=_vehicle_id RETURNING revision INTO v.revision;
 INSERT INTO public.mobility_vehicle_review_audit
   (request_key,vehicle_id,reviewer_id,new_status,vehicle_revision,reason)
 VALUES (_request_key,_vehicle_id,_reviewer_id,new_state,v.revision,trim(_reason))
 RETURNING id INTO decision_id;
 RETURN decision_id;
END
$body$;

REVOKE ALL ON FUNCTION public.mobility_review_vehicle(
 uuid,uuid,boolean,text,uuid
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_review_vehicle(
 uuid,uuid,boolean,text,uuid
) TO service_role;
COMMIT;
