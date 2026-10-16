-- SNAPSHOT HISTORICO SOLO PARA REVISION; NO EJECUTAR EN NINGUNA BASE.
-- Fuente: Lovable proyecto 2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed, archivo drizzle/migrations/0000_migration.sql,
-- commit Lovable 318af27f8bc455df6f781828dc8f4cba8ee6ab70, verificado 2026-10-16.
-- No es un esquema verificado contra pg_catalog actual. NO ES MIGRACION PARA APLICAR.
-- En DB real podrían existir diferencias/drift; contiene funciones de viajes SIN gate comercial.

CREATE TYPE public.app_role AS ENUM ('admin','driver','passenger');
CREATE TYPE public.ride_status AS ENUM ('searching','accepted','arriving','in_progress','completed','cancelled');
CREATE TYPE public.vehicle_category AS ENUM ('economico','confort','xl');
CREATE TYPE public.application_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.ticket_status AS ENUM ('open','in_review','resolved');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'passenger') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.fare_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'PY',
  city text NOT NULL DEFAULT 'Asunción',
  currency text NOT NULL DEFAULT 'PYG',
  category public.vehicle_category NOT NULL,
  base_fare numeric NOT NULL CHECK (base_fare >= 0),
  per_km numeric NOT NULL CHECK (per_km >= 0),
  per_min numeric NOT NULL CHECK (per_min >= 0),
  min_fare numeric NOT NULL CHECK (min_fare >= 0),
  commission_pct numeric NOT NULL DEFAULT 15 CHECK (commission_pct BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, city, category)
);
GRANT SELECT ON public.fare_configs TO anon, authenticated;
GRANT UPDATE ON public.fare_configs TO authenticated;
GRANT ALL ON public.fare_configs TO service_role;
ALTER TABLE public.fare_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fares public read" ON public.fare_configs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fares admin update" ON public.fare_configs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.fare_configs (category, base_fare, per_km, per_min, min_fare, commission_pct) VALUES
 ('economico', 5000, 2800, 300, 12000, 15),
 ('confort',   7000, 3600, 400, 16000, 15),
 ('xl',        9000, 4500, 500, 20000, 15);

CREATE TABLE public.driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  license_number text NOT NULL,
  license_doc_path text,
  status public.application_status NOT NULL DEFAULT 'pending',
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT ON public.driver_applications TO authenticated;
GRANT ALL ON public.driver_applications TO service_role;
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app own or admin read" ON public.driver_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL UNIQUE,
  plate text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  color text NOT NULL,
  year int,
  category public.vehicle_category NOT NULL DEFAULT 'economico',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle own or admin read" ON public.vehicles FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.driver_locations (
  driver_id uuid PRIMARY KEY,
  available boolean NOT NULL DEFAULT false,
  lat double precision,
  lng double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc own or admin read" ON public.driver_locations FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL,
  driver_id uuid,
  category public.vehicle_category NOT NULL,
  origin_label text NOT NULL,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  dest_label text NOT NULL,
  dest_lat double precision NOT NULL,
  dest_lng double precision NOT NULL,
  distance_km numeric NOT NULL,
  duration_min numeric NOT NULL,
  fare_estimate numeric NOT NULL,
  commission_pct numeric NOT NULL,
  currency text NOT NULL DEFAULT 'PYG',
  payment_method text NOT NULL DEFAULT 'efectivo',
  status public.ride_status NOT NULL DEFAULT 'searching',
  cancel_reason text,
  cancelled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
CREATE INDEX rides_status_idx ON public.rides(status);
CREATE INDEX rides_passenger_idx ON public.rides(passenger_id);
CREATE INDEX rides_driver_idx ON public.rides(driver_id);
CREATE UNIQUE INDEX one_active_ride_per_driver ON public.rides(driver_id)
  WHERE status IN ('accepted','arriving','in_progress');
CREATE UNIQUE INDEX one_active_ride_per_passenger ON public.rides(passenger_id)
  WHERE status IN ('searching','accepted','arriving','in_progress');
GRANT SELECT ON public.rides TO authenticated;
GRANT ALL ON public.rides TO service_role;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ride participants read" ON public.rides FOR SELECT TO authenticated
  USING (passenger_id = auth.uid() OR driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ride_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  actor_id uuid,
  from_status public.ride_status,
  to_status public.ride_status NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ride_events TO authenticated;
GRANT ALL ON public.ride_events TO service_role;
ALTER TABLE public.ride_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events participants read" ON public.ride_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id
    AND (r.passenger_id = auth.uid() OR r.driver_id = auth.uid()))
    OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL,
  ratee_id uuid NOT NULL,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, rater_id)
);
GRANT SELECT ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings read" ON public.ratings FOR SELECT TO authenticated
  USING (rater_id = auth.uid() OR ratee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 120),
  message text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 2000),
  status public.ticket_status NOT NULL DEFAULT 'open',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets own read" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tickets own insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'open' AND admin_response IS NULL);
CREATE POLICY "tickets admin update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT 6371 * 2 * asin(sqrt(power(sin(radians(lat2-lat1)/2),2) + cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lng2-lng1)/2),2)))
$$;

CREATE OR REPLACE FUNCTION public.is_approved_driver(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'driver') AND EXISTS (
    SELECT 1 FROM public.driver_applications WHERE user_id = _uid AND status = 'approved')
$$;

CREATE OR REPLACE FUNCTION public.request_ride(
  _category public.vehicle_category,
  _origin_label text, _origin_lat double precision, _origin_lng double precision,
  _dest_label text, _dest_lat double precision, _dest_lng double precision)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  fc public.fare_configs;
  km numeric; mins numeric; fare numeric; rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Necesitás iniciar sesión'; END IF;
  IF _origin_lat NOT BETWEEN -90 AND 90 OR _dest_lat NOT BETWEEN -90 AND 90
     OR _origin_lng NOT BETWEEN -180 AND 180 OR _dest_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Coordenadas inválidas'; END IF;
  IF char_length(coalesce(_origin_label,'')) < 2 OR char_length(coalesce(_dest_label,'')) < 2 THEN
    RAISE EXCEPTION 'Origen y destino requeridos'; END IF;
  IF EXISTS (SELECT 1 FROM rides WHERE passenger_id = uid AND status IN ('searching','accepted','arriving','in_progress')) THEN
    RAISE EXCEPTION 'Ya tenés un viaje activo'; END IF;
  SELECT * INTO fc FROM fare_configs WHERE category = _category AND country_code='PY' LIMIT 1;
  IF fc.id IS NULL THEN RAISE EXCEPTION 'Tarifa no configurada'; END IF;
  km := round((haversine_km(_origin_lat,_origin_lng,_dest_lat,_dest_lng) * 1.3)::numeric, 2);
  IF km < 0.3 THEN RAISE EXCEPTION 'Origen y destino demasiado cerca'; END IF;
  IF km > 80 THEN RAISE EXCEPTION 'Distancia fuera del área de servicio'; END IF;
  mins := ceil(km / 22.0 * 60 + 3);
  fare := greatest(fc.min_fare, fc.base_fare + fc.per_km*km + fc.per_min*mins);
  fare := round(fare / 500) * 500;
  INSERT INTO rides (passenger_id, category, origin_label, origin_lat, origin_lng, dest_label, dest_lat, dest_lng,
    distance_km, duration_min, fare_estimate, commission_pct, currency)
  VALUES (uid, _category, left(_origin_label,200), _origin_lat, _origin_lng, left(_dest_label,200), _dest_lat, _dest_lng,
    km, mins, fare, fc.commission_pct, fc.currency)
  RETURNING id INTO rid;
  INSERT INTO ride_events (ride_id, actor_id, from_status, to_status) VALUES (rid, uid, NULL, 'searching');
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF NOT is_approved_driver(uid) THEN RAISE EXCEPTION 'Conductor no aprobado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM driver_locations WHERE driver_id = uid AND available) THEN
    RAISE EXCEPTION 'Activá tu estado disponible'; END IF;
  IF EXISTS (SELECT 1 FROM rides WHERE driver_id = uid AND status IN ('accepted','arriving','in_progress')) THEN
    RAISE EXCEPTION 'Ya tenés un viaje asignado'; END IF;
  UPDATE rides SET driver_id = uid, status = 'accepted', accepted_at = now()
   WHERE id = _ride_id AND status = 'searching' AND driver_id IS NULL AND passenger_id <> uid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'El viaje ya no está disponible'; END IF;
  INSERT INTO ride_events (ride_id, actor_id, from_status, to_status) VALUES (_ride_id, uid, 'searching', 'accepted');
END $$;

CREATE OR REPLACE FUNCTION public.advance_ride(_ride_id uuid, _to public.ride_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r rides;
BEGIN
  SELECT * INTO r FROM rides WHERE id = _ride_id FOR UPDATE;
  IF r.id IS NULL OR r.driver_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT ((r.status='accepted' AND _to='arriving') OR (r.status='arriving' AND _to='in_progress')
       OR (r.status='in_progress' AND _to='completed')) THEN
    RAISE EXCEPTION 'Transición inválida: % → %', r.status, _to; END IF;
  UPDATE rides SET status = _to,
    started_at = CASE WHEN _to='in_progress' THEN now() ELSE started_at END,
    completed_at = CASE WHEN _to='completed' THEN now() ELSE completed_at END
  WHERE id = _ride_id;
  INSERT INTO ride_events (ride_id, actor_id, from_status, to_status) VALUES (_ride_id, uid, r.status, _to);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_ride(_ride_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r rides;
BEGIN
  SELECT * INTO r FROM rides WHERE id = _ride_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Viaje no encontrado'; END IF;
  IF uid = r.passenger_id THEN
    IF r.status NOT IN ('searching','accepted','arriving') THEN RAISE EXCEPTION 'No se puede cancelar en este estado'; END IF;
  ELSIF uid = r.driver_id THEN
    IF r.status NOT IN ('accepted','arriving') THEN RAISE EXCEPTION 'No se puede cancelar en este estado'; END IF;
  ELSIF has_role(uid,'admin') THEN
    IF r.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Viaje ya cerrado'; END IF;
  ELSE RAISE EXCEPTION 'No autorizado'; END IF;
  UPDATE rides SET status='cancelled', cancelled_at=now(), cancelled_by=uid, cancel_reason=left(_reason,300) WHERE id=_ride_id;
  INSERT INTO ride_events (ride_id, actor_id, from_status, to_status, note) VALUES (_ride_id, uid, r.status, 'cancelled', left(_reason,300));
END $$;

CREATE OR REPLACE FUNCTION public.set_driver_availability(_available boolean, _lat double precision, _lng double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT is_approved_driver(uid) THEN RAISE EXCEPTION 'Tu cuenta de conductor aún no fue aprobada'; END IF;
  IF _available AND (_lat IS NULL OR _lng IS NULL) THEN RAISE EXCEPTION 'Se requiere ubicación para estar disponible'; END IF;
  INSERT INTO driver_locations (driver_id, available, lat, lng, updated_at)
  VALUES (uid, _available, CASE WHEN _available THEN _lat END, CASE WHEN _available THEN _lng END, now())
  ON CONFLICT (driver_id) DO UPDATE SET available = EXCLUDED.available, lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.get_nearby_requests()
RETURNS TABLE (id uuid, category public.vehicle_category, origin_label text, dest_label text,
  distance_km numeric, duration_min numeric, fare_estimate numeric, commission_pct numeric,
  pickup_km double precision, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); loc driver_locations;
BEGIN
  IF NOT is_approved_driver(uid) THEN RETURN; END IF;
  SELECT * INTO loc FROM driver_locations WHERE driver_id = uid AND available;
  IF loc.driver_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT r.id, r.category, r.origin_label, r.dest_label, r.distance_km, r.duration_min,
    r.fare_estimate, r.commission_pct, haversine_km(loc.lat, loc.lng, r.origin_lat, r.origin_lng), r.created_at
  FROM rides r WHERE r.status='searching' AND r.passenger_id <> uid
    AND r.created_at > now() - interval '30 minutes'
    AND haversine_km(loc.lat, loc.lng, r.origin_lat, r.origin_lng) < 15
  ORDER BY 9 ASC LIMIT 20;
END $$;

CREATE OR REPLACE FUNCTION public.get_ride_counterpart(_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r rides; active boolean; res jsonb;
BEGIN
  SELECT * INTO r FROM rides WHERE id = _ride_id;
  IF r.id IS NULL OR r.driver_id IS NULL THEN RETURN NULL; END IF;
  active := r.status IN ('accepted','arriving','in_progress');
  IF uid = r.passenger_id THEN
    SELECT jsonb_build_object(
      'name', split_part(p.full_name,' ',1),
      'phone', CASE WHEN active THEN da.phone END,
      'plate', v.plate, 'brand', v.brand, 'model', v.model, 'color', v.color,
      'rating', (SELECT round(avg(stars)::numeric,1) FROM ratings WHERE ratee_id = r.driver_id),
      'lat', CASE WHEN active THEN dl.lat END, 'lng', CASE WHEN active THEN dl.lng END)
    INTO res FROM profiles p
    LEFT JOIN vehicles v ON v.driver_id = r.driver_id
    LEFT JOIN driver_applications da ON da.user_id = r.driver_id
    LEFT JOIN driver_locations dl ON dl.driver_id = r.driver_id
    WHERE p.id = r.driver_id;
  ELSIF uid = r.driver_id THEN
    SELECT jsonb_build_object('name', split_part(p.full_name,' ',1),
      'phone', CASE WHEN active THEN p.phone END,
      'origin_lat', CASE WHEN active THEN r.origin_lat END,
      'origin_lng', CASE WHEN active THEN r.origin_lng END)
    INTO res FROM profiles p WHERE p.id = r.passenger_id;
  ELSE RETURN NULL; END IF;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.submit_driver_application(
  _full_name text, _phone text, _license text, _license_doc_path text,
  _plate text, _brand text, _model text, _color text, _year int, _category public.vehicle_category)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Necesitás iniciar sesión'; END IF;
  IF char_length(trim(_full_name)) < 3 OR char_length(trim(_phone)) < 6 OR char_length(trim(_license)) < 4
     OR char_length(trim(_plate)) < 4 OR char_length(trim(_brand)) < 2 OR char_length(trim(_model)) < 1
     OR char_length(trim(_color)) < 3 THEN RAISE EXCEPTION 'Datos incompletos'; END IF;
  IF _year IS NOT NULL AND (_year < 1995 OR _year > extract(year from now())::int + 1) THEN RAISE EXCEPTION 'Año inválido'; END IF;
  IF _license_doc_path IS NOT NULL AND split_part(_license_doc_path,'/',1) <> uid::text THEN RAISE EXCEPTION 'Documento inválido'; END IF;
  IF EXISTS (SELECT 1 FROM driver_applications WHERE user_id = uid AND status='approved') THEN
    RAISE EXCEPTION 'Tu solicitud ya fue aprobada'; END IF;
  INSERT INTO driver_applications (user_id, full_name, phone, license_number, license_doc_path, status)
  VALUES (uid, left(trim(_full_name),120), left(trim(_phone),30), left(trim(_license),40), _license_doc_path, 'pending')
  ON CONFLICT (user_id) DO UPDATE SET full_name=EXCLUDED.full_name, phone=EXCLUDED.phone, license_number=EXCLUDED.license_number,
    license_doc_path=COALESCE(EXCLUDED.license_doc_path, driver_applications.license_doc_path), status='pending', review_notes=NULL, reviewed_at=NULL;
  INSERT INTO vehicles (driver_id, plate, brand, model, color, year, category)
  VALUES (uid, upper(left(trim(_plate),12)), left(trim(_brand),40), left(trim(_model),40), left(trim(_color),30), _year, _category)
  ON CONFLICT (driver_id) DO UPDATE SET plate=EXCLUDED.plate, brand=EXCLUDED.brand, model=EXCLUDED.model, color=EXCLUDED.color, year=EXCLUDED.year, category=EXCLUDED.category;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_driver(_app_id uuid, _approve boolean, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); a driver_applications;
BEGIN
  IF NOT has_role(uid,'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT * INTO a FROM driver_applications WHERE id = _app_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  UPDATE driver_applications SET status = CASE WHEN _approve THEN 'approved'::application_status ELSE 'rejected'::application_status END,
    review_notes = left(_notes,500), reviewed_at = now() WHERE id = _app_id;
  IF _approve THEN
    INSERT INTO user_roles (user_id, role) VALUES (a.user_id, 'driver') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM user_roles WHERE user_id = a.user_id AND role = 'driver';
    UPDATE driver_locations SET available=false, lat=NULL, lng=NULL WHERE driver_id = a.user_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rate_ride(_ride_id uuid, _stars int, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r rides; target uuid;
BEGIN
  SELECT * INTO r FROM rides WHERE id = _ride_id;
  IF r.id IS NULL OR r.status <> 'completed' THEN RAISE EXCEPTION 'Solo viajes terminados'; END IF;
  IF uid = r.passenger_id THEN target := r.driver_id; ELSIF uid = r.driver_id THEN target := r.passenger_id;
  ELSE RAISE EXCEPTION 'No autorizado'; END IF;
  IF _stars NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Valoración inválida'; END IF;
  INSERT INTO ratings (ride_id, rater_id, ratee_id, stars, comment) VALUES (_ride_id, uid, target, _stars, left(_comment,500));
END $$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  RETURN jsonb_build_object(
    'passengers', (SELECT count(*) FROM user_roles WHERE role='passenger'),
    'drivers_approved', (SELECT count(*) FROM driver_applications WHERE status='approved'),
    'drivers_pending', (SELECT count(*) FROM driver_applications WHERE status='pending'),
    'drivers_available', (SELECT count(*) FROM driver_locations WHERE available),
    'rides_by_status', (SELECT coalesce(jsonb_object_agg(status, c),'{}'::jsonb) FROM (SELECT status, count(*) c FROM rides GROUP BY status) s),
    'gross_completed', (SELECT coalesce(sum(fare_estimate),0) FROM rides WHERE status='completed'),
    'commission_completed', (SELECT coalesce(sum(fare_estimate*commission_pct/100),0) FROM rides WHERE status='completed'),
    'tickets_open', (SELECT count(*) FROM support_tickets WHERE status <> 'resolved'));
END $$;

REVOKE EXECUTE ON FUNCTION public.request_ride, public.accept_ride, public.advance_ride, public.cancel_ride,
  public.set_driver_availability, public.get_nearby_requests, public.get_ride_counterpart,
  public.submit_driver_application, public.admin_review_driver, public.rate_ride, public.admin_stats FROM anon, public;
GRANT EXECUTE ON FUNCTION public.request_ride, public.accept_ride, public.advance_ride, public.cancel_ride,
  public.set_driver_availability, public.get_nearby_requests, public.get_ride_counterpart,
  public.submit_driver_application, public.admin_review_driver, public.rate_ride, public.admin_stats TO authenticated;

CREATE POLICY "driver docs own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='driver-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "driver docs own or admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='driver-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));

ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;