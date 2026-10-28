-- Real G1/G2/G3/G4/G10/G15/G16 PostgreSQL 16 disposable chain regression.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'Refusing non-disposable G16 test database'; END IF;
 IF has_function_privilege('authenticated','public.mobility_stage_poll_driver_auto_offers(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.mobility_stage_poll_driver_auto_offers(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Private AUTO offers accessible by client SQL roles'; END IF;
 IF NOT has_function_privilege('service_role','public.mobility_stage_poll_driver_auto_offers(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Trusted service lacks G16 polling'; END IF;
END $guard$;

INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000181'),
 ('00000000-0000-4000-8000-000000000182'),
 ('00000000-0000-4000-8000-000000000183');
-- G1 Auth trigger creates a passenger role by default. Synthetic role review
-- explicitly replaces it; never allow dual-role Driver onboarding.
DELETE FROM public.user_roles WHERE user_id IN (
 '00000000-0000-4000-8000-000000000181',
 '00000000-0000-4000-8000-000000000182',
 '00000000-0000-4000-8000-000000000183'
);
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000181','driver'),
 ('00000000-0000-4000-8000-000000000182','passenger');
INSERT INTO public.mobility_vehicles
 (id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
  plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status)
VALUES
 ('00000000-0000-4000-8000-000000000184',
  '00000000-0000-4000-8000-000000000181',
  'AUTO','economico','PY','ASUNCION','QORE181','DEMO','SEDAN',2024,4,'approved');
INSERT INTO public.mobility_driver_compliance
 (driver_id,license_class,license_valid_through,license_verified_at,
  license_verified_by,driver_review_status)
VALUES
 ('00000000-0000-4000-8000-000000000181','B',CURRENT_DATE+90,
  pg_catalog.clock_timestamp()-interval '1 day',
  '00000000-0000-4000-8000-000000000101','approved');
INSERT INTO public.mobility_vehicle_compliance
 (vehicle_id,registration_valid_through,registration_verified_at,
  insurance_valid_through,insurance_verified_at,paid_passenger_insurance_covered,
  inspection_valid_through,inspection_verified_at,
  municipal_authorization_valid_through,municipal_authorization_verified_at,
  reviewed_by,reviewed_at)
VALUES
 ('00000000-0000-4000-8000-000000000184',
  CURRENT_DATE+90,pg_catalog.clock_timestamp()-interval '1 day',
  CURRENT_DATE+90,pg_catalog.clock_timestamp()-interval '1 day',true,
  CURRENT_DATE+90,pg_catalog.clock_timestamp()-interval '1 day',
  CURRENT_DATE+90,pg_catalog.clock_timestamp()-interval '1 day',
  '00000000-0000-4000-8000-000000000101',
  pg_catalog.clock_timestamp()-interval '2 minutes');
INSERT INTO public.driver_locations(driver_id,available,lat,lng,updated_at)
VALUES ('00000000-0000-4000-8000-000000000181',true,-25.3,-57.57,
 pg_catalog.clock_timestamp()-interval '5 seconds');
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
VALUES ('00000000-0000-4000-8000-000000000181',
 pg_catalog.clock_timestamp()-interval '1 day');

SET ROLE service_role;
DO $assert$
DECLARE v_driver uuid:='00000000-0000-4000-8000-000000000181';
 v_passenger uuid:='00000000-0000-4000-8000-000000000182';
 v_outsider uuid:='00000000-0000-4000-8000-000000000183';
 v_vehicle uuid:='00000000-0000-4000-8000-000000000184';
 v_trip uuid; v_offer uuid; v_event uuid; n integer;
BEGIN
 IF NOT public.mobility_vehicle_preflight(v_driver,v_vehicle,'economico')
 THEN RAISE EXCEPTION 'Synthetic AUTO preflight unexpectedly rejected'; END IF;
 SELECT public.mobility_stage_auto_demo_request(v_passenger,
  '00000000-0000-4000-8000-000000000185','CENTRO','SAN_LORENZO','economico')
 INTO v_trip;
 SELECT public.mobility_stage_auto_demo_offer(v_trip,v_driver,v_vehicle,
  '00000000-0000-4000-8000-000000000186',30)
 INTO v_offer;
 SELECT count(*) INTO n FROM public.mobility_stage_poll_driver_auto_offers(v_driver) p
 WHERE p.offer_id=v_offer AND p.trip_id=v_trip;
 IF n<>1 THEN RAISE EXCEPTION 'G16 valid driver cannot discover AUTO offer'; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_poll_driver_auto_offers(v_outsider);
 IF n<>0 THEN RAISE EXCEPTION 'G16 other actor discovered AUTO offer'; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_poll_driver_auto_offers(v_passenger);
 IF n<>0 THEN RAISE EXCEPTION 'G16 passenger discovered AUTO offer'; END IF;

 UPDATE public.mobility_stage_auto_demo_push_outbox
 SET accepted_for_processing_at=pg_catalog.clock_timestamp()
 WHERE offer_id=v_offer;
 SELECT count(*) INTO n FROM public.mobility_stage_poll_driver_auto_offers(v_driver) p
 WHERE p.offer_id=v_offer;
 IF n<>1 THEN RAISE EXCEPTION 'G16 push ACK improperly hid driver offer'; END IF;

 -- Server expiry always wins, even after provider ACK.
 UPDATE public.mobility_stage_auto_demo_offers
 SET offered_at=pg_catalog.clock_timestamp()-interval '60 seconds',
     expires_at=pg_catalog.clock_timestamp()-interval '30 seconds'
 WHERE id=v_offer;
 SELECT count(*) INTO n FROM public.mobility_stage_poll_driver_auto_offers(v_driver);
 IF n<>0 THEN RAISE EXCEPTION 'G16 leaked an expired offer'; END IF;

 -- Resume an unexpired synthetic offer solely to validate terminal acceptance.
 UPDATE public.mobility_stage_auto_demo_offers
 SET offered_at=pg_catalog.clock_timestamp()-interval '1 second',
     expires_at=pg_catalog.clock_timestamp()+interval '25 seconds'
 WHERE id=v_offer;
 SELECT public.mobility_stage_auto_demo_accept_offer(v_offer,v_driver,
  '00000000-0000-4000-8000-000000000187') INTO v_event;
 IF v_event IS NULL THEN RAISE EXCEPTION 'G16 test AUTO offer could not be accepted'; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_poll_driver_auto_offers(v_driver);
 IF n<>0 THEN RAISE EXCEPTION 'G16 displayed an accepted AUTO offer'; END IF;
 IF (SELECT receipt_confirmed_at IS NOT NULL
  FROM public.mobility_stage_auto_demo_push_outbox WHERE offer_id=v_offer)
 THEN RAISE EXCEPTION 'G16 invented device receipt'; END IF;
END $assert$;
RESET ROLE;
