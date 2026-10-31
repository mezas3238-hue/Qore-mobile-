-- G265 strict noncommercial PG16/PG17 disposable tests. Never remote.
DO $p$ BEGIN
 IF NOT has_function_privilege('service_role',
   'public.mobility_stage_g265_publish_auto_fare(uuid,uuid,bigint,uuid,text,integer,integer,integer,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.mobility_stage_g265_publish_auto_fare(uuid,uuid,bigint,uuid,text,integer,integer,integer,integer,integer)','EXECUTE')
 OR has_function_privilege('anon',
   'public.mobility_stage_g265_publish_auto_fare(uuid,uuid,bigint,uuid,text,integer,integer,integer,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
   'qore_stage_internal.mobility_stage_g265_publish_auto_fare(uuid,uuid,bigint,uuid,text,integer,integer,integer,integer,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G265 private RPC privilege leak'; END IF;
END $p$;
SET ROLE service_role;
DO $test$
DECLARE
 owner uuid:='00000000-0000-4000-8000-000000000901';
 other uuid:='00000000-0000-4000-8000-000000000903';
 session2 uuid:='00000000-0000-4000-8000-000000000911';
 session1 uuid:='00000000-0000-4000-8000-000000000912';
 sessionOther uuid:='00000000-0000-4000-8000-000000000913';
 key1 uuid:='00000000-0000-4000-8000-000000000920';
 key2 uuid:='00000000-0000-4000-8000-000000000921';
 key3 uuid:='00000000-0000-4000-8000-000000000922';
 fare jsonb; replay jsonb; quoteId uuid; quote2Id uuid; routeId uuid;
 rejected boolean; iat bigint:=1761930000000;
BEGIN
 rejected:=false;
 BEGIN PERFORM public.mobility_stage_g265_publish_auto_fare(owner,session1,iat,key1,
   'ASUNCION_FIXTURE',8000,1000,200,10000,1800);
 EXCEPTION WHEN SQLSTATE 'P2652' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G265 AAL1 could publish fare'; END IF;
 rejected:=false;
 BEGIN PERFORM public.mobility_stage_g265_publish_auto_fare(other,sessionOther,iat,key1,
   'ASUNCION_FIXTURE',8000,1000,200,10000,1800);
 EXCEPTION WHEN SQLSTATE 'P2652' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G265 unapproved actor could publish'; END IF;
 rejected:=false;
 BEGIN PERFORM public.mobility_stage_g265_publish_auto_fare(owner,session2,iat+1000,key1,
   'ASUNCION_FIXTURE',8000,1000,200,10000,1800);
 EXCEPTION WHEN SQLSTATE 'P2652' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G265 spoofed session timestamp accepted'; END IF;
 rejected:=false;
 BEGIN PERFORM public.mobility_stage_g265_publish_auto_fare(owner,session2,iat,key1,
   'ASUNCION_FIXTURE',8000,1000,200,10000,4000);
 EXCEPTION WHEN SQLSTATE 'P2651' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G265 unauthorized 40% commission'; END IF;

 fare:=public.mobility_stage_g265_publish_auto_fare(owner,session2,iat,key1,
   'ASUNCION_FIXTURE',8000,1000,200,10000,1800);
 IF fare->>'ruleKey' IS NULL OR fare->>'active'<>'true' OR
   (fare->>'commissionPercent')::numeric<>18 OR
   fare->>'idempotent'<>'false'
 THEN RAISE EXCEPTION 'G265 first fare publication receipt wrong'; END IF;
 replay:=public.mobility_stage_g265_publish_auto_fare(owner,session2,iat,key1,
   'ASUNCION_FIXTURE',8000,1000,200,10000,1800);
 IF replay->>'ruleKey'<>fare->>'ruleKey' OR replay->>'idempotent'<>'true'
 THEN RAISE EXCEPTION 'G265 replay not idempotent'; END IF;
 rejected:=false;
 BEGIN PERFORM public.mobility_stage_g265_publish_auto_fare(owner,session2,iat,key1,
   'ASUNCION_FIXTURE',8000,1000,200,10000,1700);
 EXCEPTION WHEN SQLSTATE 'P2653' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G265 conflicting publication key accepted'; END IF;

 -- New G262 route+quote must consume Owner-authorized current fare.
 routeId:=public.mobility_stage_g73_route(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000930','economico',
  'PANTEON','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 quoteId:=public.mobility_stage_g73_quote(
  '00000000-0000-4000-8000-000000000101',routeId,
  '00000000-0000-4000-8000-000000000931');
 IF (public.mobility_stage_g73_quote_receipt(
  '00000000-0000-4000-8000-000000000101',quoteId)->>'amountGs')<>'15000'
 THEN RAISE EXCEPTION 'G265 original fare not used by G262'; END IF;

 replay:=public.mobility_stage_g265_publish_auto_fare(owner,session2,iat,key2,
   'ASUNCION_FIXTURE',8000,1200,200,10000,1000);
 IF replay->>'idempotent'<>'false' OR
  (replay->>'commissionPercent')::numeric<>10
 THEN RAISE EXCEPTION 'G265 modified Owner commission unavailable'; END IF;
 -- Fare snapshot for already-quoted Passenger must NEVER drift.
 IF (public.mobility_stage_g73_quote_receipt(
  '00000000-0000-4000-8000-000000000101',quoteId)->>'amountGs')<>'15000'
 THEN RAISE EXCEPTION 'G265 changed an earlier quote'; END IF;
 routeId:=public.mobility_stage_g73_route(
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000932','confort',
  'PLAZA','TERMINAL','ASUNCION_FIXTURE',5000,600,0);
 quote2Id:=public.mobility_stage_g73_quote(
  '00000000-0000-4000-8000-000000000102',routeId,
  '00000000-0000-4000-8000-000000000933');
 IF (public.mobility_stage_g73_quote_receipt(
  '00000000-0000-4000-8000-000000000102',quote2Id)->>'amountGs')<>'16000'
 THEN RAISE EXCEPTION 'G265 new Owner tariff not applied to new quote'; END IF;

 -- Separate zone publication must preserve active first-zone rule.
 fare:=public.mobility_stage_g265_publish_auto_fare(owner,session2,iat,key3,
   'CIUDAD_DEL_ESTE',7000,1100,200,9000,1200);
 IF fare->>'zoneTag'<>'CIUDAD_DEL_ESTE'
 THEN RAISE EXCEPTION 'G265 separate zone publication incorrect'; END IF;
 RAISE NOTICE 'G265 PASS: AAL2 owner, independent approval, idempotency, 18%%->10%%, immutable quote';
END $test$;
RESET ROLE;
DO $assert$ BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_fare_rules
  WHERE active AND mode='AUTO' AND zone_tag='ASUNCION_FIXTURE')<>1
 OR (SELECT count(*) FROM public.mobility_stage_fare_rules
  WHERE mode='AUTO' AND zone_tag='ASUNCION_FIXTURE')<>2
 OR (SELECT count(*) FROM public.mobility_stage_fare_rules
  WHERE active AND mode='AUTO' AND zone_tag='CIUDAD_DEL_ESTE')<>1
 OR (SELECT count(*) FROM public.mobility_stage_g262_auto_prequotes)<>2
 THEN RAISE EXCEPTION 'G265 versioning/quote integrity compromised'; END IF;
END $assert$;
