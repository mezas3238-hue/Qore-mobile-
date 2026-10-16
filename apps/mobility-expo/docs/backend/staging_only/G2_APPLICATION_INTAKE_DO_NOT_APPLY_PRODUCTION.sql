-- G2 STAGING-ONLY: audited-ish intake queue for vehicle application drafts.
-- Called only through a secure server with JWT-verified actor identity.
-- NOT an approval path; cannot create rides or dispatch vehicles.
BEGIN;
CREATE TABLE public.mobility_vehicle_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_kind public.mobility_vehicle_kind NOT NULL,
 service_kind public.mobility_service_kind NOT NULL,
 country_code text NOT NULL DEFAULT 'PY' CHECK (country_code='PY'),
 municipality_code text NOT NULL CHECK (municipality_code ~ '^[A-Z0-9_-]{2,60}$'),
 plate_normalized text NOT NULL CHECK (plate_normalized ~ '^[A-Z0-9-]{4,12}$'),
 brand text NOT NULL CHECK (char_length(trim(brand)) BETWEEN 2 AND 80),
 model text NOT NULL CHECK (char_length(trim(model)) BETWEEN 1 AND 80),
 manufacture_year integer NOT NULL CHECK (manufacture_year BETWEEN 1995 AND 2100),
 passenger_capacity integer NOT NULL CHECK (passenger_capacity BETWEEN 1 AND 8),
 status public.mobility_review_status NOT NULL DEFAULT 'pending'
  CHECK (status='pending'::public.mobility_review_status),
 evidence_unverified boolean NOT NULL DEFAULT true CHECK (evidence_unverified=true),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((vehicle_kind='AUTO' AND service_kind IN ('economico','confort','xl')
  AND passenger_capacity >= CASE WHEN service_kind='xl' THEN 6 ELSE 3 END)
  OR (vehicle_kind='MOTO' AND service_kind='moto_pasajero'
     AND passenger_capacity=1))
);
CREATE INDEX mobility_vehicle_applications_owner_idx
 ON public.mobility_vehicle_applications(driver_id,submitted_at DESC);
ALTER TABLE public.mobility_vehicle_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_vehicle_applications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mobility_vehicle_applications TO authenticated;
GRANT SELECT,INSERT ON public.mobility_vehicle_applications TO service_role;
CREATE POLICY mobility_applications_own_or_admin_read
 ON public.mobility_vehicle_applications FOR SELECT TO authenticated
 USING (driver_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));

-- Do not accept license/document validation booleans from API payload.
-- service_role only; the gateway must verify _driver_id from the caller JWT,
-- rate-limit intake, enforce evidence presence and idempotency.
CREATE FUNCTION public.mobility_submit_vehicle_draft(
 _driver_id uuid,_request_key uuid,
 _kind public.mobility_vehicle_kind,_service public.mobility_service_kind,
 _municipality text,_plate text,_brand text,_model text,
 _year integer,_capacity integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE existing public.mobility_vehicle_applications%ROWTYPE;
 result_id uuid;
BEGIN
 IF _driver_id IS NULL OR _request_key IS NULL OR _kind IS NULL OR _service IS NULL
    OR _municipality IS NULL OR _plate IS NULL OR _brand IS NULL
    OR _model IS NULL OR _year IS NULL OR _capacity IS NULL
 THEN RAISE EXCEPTION 'Incomplete vehicle application'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.user_roles
   WHERE user_id=_driver_id AND role IN ('passenger'::public.app_role,'driver'::public.app_role))
 THEN RAISE EXCEPTION 'Unregistered application identity'; END IF;
 IF (_kind='MOTO' AND _service<>'moto_pasajero')
    OR (_kind='AUTO' AND _service='moto_pasajero')
 THEN RAISE EXCEPTION 'Vehicle kind and service mismatch'; END IF;

 INSERT INTO public.mobility_vehicle_applications
  (driver_id,request_key,vehicle_kind,service_kind,municipality_code,
   plate_normalized,brand,model,manufacture_year,passenger_capacity)
 VALUES
  (_driver_id,_request_key,_kind,_service,trim(_municipality),
   upper(trim(_plate)),trim(_brand),trim(_model),_year,_capacity)
 ON CONFLICT (request_key) DO NOTHING
 RETURNING id INTO result_id;

 IF result_id IS NOT NULL THEN RETURN result_id; END IF;
 SELECT * INTO existing FROM public.mobility_vehicle_applications WHERE request_key=_request_key;
 IF NOT FOUND OR existing.driver_id<>_driver_id OR existing.vehicle_kind<>_kind
  OR existing.service_kind<>_service OR existing.municipality_code<>trim(_municipality)
  OR existing.plate_normalized<>upper(trim(_plate))
  OR existing.brand<>trim(_brand) OR existing.model<>trim(_model)
  OR existing.manufacture_year<>_year OR existing.passenger_capacity<>_capacity
 THEN RAISE EXCEPTION 'Idempotency key reused for a different vehicle application'; END IF;
 RETURN existing.id;
END
$body$;
REVOKE ALL ON FUNCTION public.mobility_submit_vehicle_draft(
 uuid,uuid,public.mobility_vehicle_kind,public.mobility_service_kind,
 text,text,text,text,integer,integer
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_submit_vehicle_draft(
 uuid,uuid,public.mobility_vehicle_kind,public.mobility_service_kind,
 text,text,text,text,integer,integer
) TO service_role;
COMMIT;
