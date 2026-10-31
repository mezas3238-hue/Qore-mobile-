-- Disposable PostgreSQL only: expired route, expired quote and inactive rule must refuse.
UPDATE public.mobility_stage_fare_rules SET active=false;
SET ROLE service_role;
DO $no_fare$
DECLARE
  who uuid:='00000000-0000-4000-8000-000000000102';
  rk uuid:='00000000-0000-4000-8000-000000000301';
  qk uuid:='00000000-0000-4000-8000-000000000302';
  rid uuid; rejected boolean:=false;
BEGIN
 rid:=public.mobility_stage_g73_route(who,rk,'economico',
  'PARQUE','TERMINAL','ASUNCION_FIXTURE',3000,500,0);
 BEGIN PERFORM public.mobility_stage_g73_quote(who,rid,qk);
 EXCEPTION WHEN SQLSTATE 'P2622' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G262 inactive fare rule was accepted'; END IF;
END $no_fare$;
RESET ROLE;

-- A proven driver role cannot mint passenger routes.
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000103');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000103','driver');
SET ROLE service_role;
DO $driver$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g73_route(
   '00000000-0000-4000-8000-000000000103',
   '00000000-0000-4000-8000-000000000303',
   'economico','PARQUE','TERMINAL','ASUNCION_FIXTURE',3000,500,0);
 EXCEPTION WHEN SQLSTATE 'P2621' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G262 non-passenger minted a route'; END IF;
END $driver$;
RESET ROLE;

-- A valid fare quote is created, then source route expires before booking.
UPDATE public.mobility_stage_fare_rules SET active=true;
SET ROLE service_role;
DO $prepare$
DECLARE
 who uuid:='00000000-0000-4000-8000-000000000102';
 rid uuid; qid uuid;
BEGIN
 rid:=public.mobility_stage_g73_route(who,
  '00000000-0000-4000-8000-000000000304',
  'economico','BAHIA','TERMINAL','ASUNCION_FIXTURE',3000,400,0);
 qid:=public.mobility_stage_g73_quote(who,rid,
  '00000000-0000-4000-8000-000000000305');
 IF qid IS NULL THEN RAISE EXCEPTION 'G262 setup quote absent'; END IF;
END $prepare$;
RESET ROLE;
UPDATE public.mobility_stage_g262_auto_prequotes
 SET quoted_at=pg_catalog.clock_timestamp()-interval '2 hours',
     expires_at=pg_catalog.clock_timestamp()-interval '1 hour'
 WHERE request_key='00000000-0000-4000-8000-000000000305';
SET ROLE service_role;
DO $expired_quote$
DECLARE
 who uuid:='00000000-0000-4000-8000-000000000102';
 qid uuid; rejected boolean:=false;
BEGIN
 -- Only this disposable test looks up the known quote ID via its owner-scoped receipt.
 SELECT (public.mobility_stage_g73_quote_receipt(who,q.id)->>'quoteId')::uuid INTO qid
 FROM (SELECT public.mobility_stage_g73_quote_receipt(who,
  (SELECT id FROM public.mobility_stage_g262_auto_prequotes
  WHERE request_key='00000000-0000-4000-8000-000000000305')) AS receipt) c,
 LATERAL (SELECT (c.receipt->>'quoteId')::uuid AS id) q;
 BEGIN
  PERFORM public.mobility_stage_g73_book(who,qid,
   '00000000-0000-4000-8000-000000000306');
 EXCEPTION WHEN SQLSTATE 'P2623' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G262 expired quote booked'; END IF;
END $expired_quote$;
RESET ROLE;
UPDATE public.mobility_stage_g73_auto_routes
 SET verified_at=pg_catalog.clock_timestamp()-interval '2 hours',
     expires_at=pg_catalog.clock_timestamp()-interval '1 hour'
 WHERE request_key='00000000-0000-4000-8000-000000000301';
SET ROLE service_role;
DO $expired_route$
DECLARE
 who uuid:='00000000-0000-4000-8000-000000000102';
 rid uuid; rejected boolean:=false;
BEGIN
 rid:=public.mobility_stage_g73_route(who,
  '00000000-0000-4000-8000-000000000301',
  'economico','PARQUE','TERMINAL','ASUNCION_FIXTURE',3000,500,0);
 BEGIN PERFORM public.mobility_stage_g73_quote(who,rid,
  '00000000-0000-4000-8000-000000000307');
 EXCEPTION WHEN SQLSTATE 'P2622' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G262 expired route quoted'; END IF;
END $expired_route$;
RESET ROLE;
