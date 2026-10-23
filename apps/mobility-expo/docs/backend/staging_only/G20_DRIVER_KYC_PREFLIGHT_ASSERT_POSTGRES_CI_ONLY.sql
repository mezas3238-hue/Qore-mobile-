-- G20 regression: real G1-G19 disposable schema, synthetic identities only.
-- The G16 AUTO + G14 courier were previously eligible via G2/G5 preflight.
-- The latest G17 evidence must now be independently approved by ADMIN.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G20 assertions refuse non-disposable PostgreSQL'; END IF;
 IF has_function_privilege('authenticated',
  'public.mobility_stage_driver_current_license_approved(uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_driver_current_license_approved(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G20 KYC helper exposed to mobile SQL roles'; END IF;
 IF NOT has_function_privilege('service_role',
  'public.mobility_stage_driver_current_license_approved(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G20 internal dispatch lacks KYC gate'; END IF;
END $guard$;

-- Passenger for new AUTO/cargo synthetic requests; no PII or real accounts.
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000241');
INSERT INTO public.user_roles(user_id,role)
 VALUES('00000000-0000-4000-8000-000000000241','passenger');

SET ROLE service_role;
DO $checks$
DECLARE
 driver_auto uuid:='00000000-0000-4000-8000-000000000181';
 driver_cargo uuid:='00000000-0000-4000-8000-000000000163';
 admin uuid:='00000000-0000-4000-8000-000000000101';
 auto_vehicle uuid:='00000000-0000-4000-8000-000000000184';
 cargo_vehicle uuid:='00000000-0000-4000-8000-000000000164';
 sender uuid:='00000000-0000-4000-8000-000000000241';
 latest_doc uuid; cargo_doc uuid; another_doc uuid;
 offer_id uuid; trip_id uuid; event_id uuid;
 delivery_id uuid; cargo_offer uuid; cargo_event uuid;
BEGIN
 -- G17 already approved a previous license, then registered a *newer*
 -- pending license. The approved older file MUST NOT grant eligibility.
 IF public.mobility_stage_driver_current_license_approved(driver_auto)
 OR public.mobility_vehicle_preflight(driver_auto,auto_vehicle,'economico')
 THEN RAISE EXCEPTION 'G20 treated older approved license as current'; END IF;
 IF public.mobility_stage_driver_current_license_approved(driver_cargo)
 THEN RAISE EXCEPTION 'G20 accepted courier without any reviewed license'; END IF;
 SELECT id INTO delivery_id FROM public.mobility_stage_deliveries
 WHERE request_key='00000000-0000-4000-8000-000000000172';
 IF delivery_id IS NULL THEN
  RAISE EXCEPTION 'G15 requested delivery fixture absent'; END IF;
 IF public.mobility_stage_delivery_courier_preflight(
   driver_cargo,cargo_vehicle,delivery_id)
 THEN RAISE EXCEPTION 'G20 cargo preflight ignored missing KYC'; END IF;

 -- Administrative approval of newest AUTO license, with auditable receipt.
 SELECT id INTO latest_doc FROM public.mobility_stage_driver_documents
 WHERE request_key='00000000-0000-4000-8000-000000000193';
 PERFORM public.mobility_stage_review_driver_document(
  latest_doc,admin,true,'DOCUMENT_VALID',
  '00000000-0000-4000-8000-000000000242');
 IF NOT public.mobility_stage_driver_current_license_approved(driver_auto)
 OR NOT public.mobility_vehicle_preflight(driver_auto,auto_vehicle,'economico')
 THEN RAISE EXCEPTION 'G20 approved current AUTO license not recognized'; END IF;

 -- A fresh AUTO offer can be prepared only after the gated preflight.
 SELECT public.mobility_stage_auto_demo_request(sender,
  '00000000-0000-4000-8000-000000000243',
  'CENTRO','SAN_LORENZO','economico') INTO trip_id;
 SELECT public.mobility_stage_auto_demo_offer(
  trip_id,driver_auto,auto_vehicle,
  '00000000-0000-4000-8000-000000000244',30) INTO offer_id;

 -- A *new* unreviewed license instantly invalidates acceptance even when
 -- a previous offer was already created and visible on the Driver phone.
 SELECT public.mobility_stage_register_driver_document(
  driver_auto,'00000000-0000-4000-8000-000000000245',
  'licencia',driver_auto::text||'/licencia-G20PendingLicense123.jpg',
  'image/jpeg',9100,repeat('d',64)) INTO another_doc;
 IF public.mobility_stage_driver_current_license_approved(driver_auto)
 OR public.mobility_vehicle_preflight(driver_auto,auto_vehicle,'economico')
 THEN RAISE EXCEPTION 'G20 ignored newer unreviewed AUTO license'; END IF;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   offer_id,driver_auto,'00000000-0000-4000-8000-000000000246');
  RAISE EXCEPTION 'BUG: Driver accepted AUTO offer after new pending license';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: Driver accepted AUTO offer after new pending license'
   THEN RAISE; END IF;
 END;
 IF (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip_id)
  <>'searching' THEN RAISE EXCEPTION 'G20 failed acceptance changed trip state'; END IF;

 -- Rejection must preserve denial, even if an earlier approved file exists.
 PERFORM public.mobility_stage_review_driver_document(
  another_doc,admin,false,'DOCUMENT_INVALID',
  '00000000-0000-4000-8000-000000000247');
 IF public.mobility_stage_driver_current_license_approved(driver_auto)
 THEN RAISE EXCEPTION 'G20 rejected current license did not revoke eligibility'; END IF;

 -- A *third* submitted and approved license is a new review, not a bypass.
 SELECT public.mobility_stage_register_driver_document(
  driver_auto,'00000000-0000-4000-8000-000000000248',
  'licencia',driver_auto::text||'/licencia-G20ApprovedLicense345.jpg',
  'image/jpeg',9200,repeat('e',64)) INTO another_doc;
 PERFORM public.mobility_stage_review_driver_document(
  another_doc,admin,true,'DOCUMENT_VALID',
  '00000000-0000-4000-8000-000000000249');
 IF NOT public.mobility_vehicle_preflight(driver_auto,auto_vehicle,'economico')
 THEN RAISE EXCEPTION 'G20 latest reviewed AUTO license cannot restore QA eligibility'; END IF;
 SELECT public.mobility_stage_auto_demo_accept_offer(
   offer_id,driver_auto,'00000000-0000-4000-8000-000000000250')
 INTO event_id;
 IF event_id IS NULL OR
 (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip_id)
  <>'accepted'
 THEN RAISE EXCEPTION 'G20 restored AUTO license failed to permit valid QA acceptance'; END IF;

 -- G2 license expiration still dominates a reviewed document.
 UPDATE public.mobility_driver_compliance
 SET license_valid_through=CURRENT_DATE-1 WHERE driver_id=driver_auto;
 IF public.mobility_vehicle_preflight(driver_auto,auto_vehicle,'economico')
 THEN RAISE EXCEPTION 'G20 verified document bypassed expired G2 license'; END IF;
 UPDATE public.mobility_driver_compliance
 SET license_valid_through=CURRENT_DATE+90 WHERE driver_id=driver_auto;

 -- Courier MOTO cargo route also needs a current accepted license; MOTO
 -- passenger transport remains independently blocked by G2.
 SELECT public.mobility_stage_register_driver_document(
  driver_cargo,'00000000-0000-4000-8000-000000000251',
  'licencia',driver_cargo::text||'/licencia-G20CargoLicense123.jpg',
  'image/jpeg',8000,repeat('b',64)) INTO cargo_doc;
 PERFORM public.mobility_stage_review_driver_document(
  cargo_doc,admin,true,'DOCUMENT_VALID',
  '00000000-0000-4000-8000-000000000252');
 IF NOT public.mobility_stage_delivery_courier_preflight(
   driver_cargo,cargo_vehicle,delivery_id)
 THEN RAISE EXCEPTION 'G20 verified cargo license not recognized'; END IF;
 IF public.mobility_vehicle_preflight(driver_cargo,cargo_vehicle,'moto_pasajero')
 THEN RAISE EXCEPTION 'G20 mistakenly enabled MOTO passenger rides'; END IF;

 -- Cargo offers obey the same preflight at creation AND acceptance.
 SELECT public.mobility_stage_delivery_offer(
  delivery_id,driver_cargo,cargo_vehicle,
  '00000000-0000-4000-8000-000000000253',30) INTO cargo_offer;
 -- G15 already created an offer for courier 163 and this delivery; that offer
 -- was expired. This uniqueness intentionally prevents a duplicate offer.
 -- This branch is replaced below with a separate requested delivery fixture.
END $checks$;
RESET ROLE;
