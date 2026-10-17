import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../../docs/backend/staging_only/G2_AUTO_MOTO_COMPLIANCE_DO_NOT_APPLY_PRODUCTION.sql',import.meta.url),'utf8');
const statements=sql.replace(/^--.*$/gm,'');
test('G2 SQL staging: additive, no modifica legacy ni reabre RPC',()=>{
 assert.match(sql,/STAGING-ONLY/);
 for(const table of ['mobility_vehicles','mobility_driver_compliance','mobility_vehicle_compliance'])
  assert.match(statements,new RegExp('CREATE TABLE public\\.'+table+'\\s*\\(','i'));
 assert.doesNotMatch(statements,/ALTER\s+TABLE\s+public\.(?:rides|vehicles)\b|CREATE\s+OR\s+REPLACE\s+FUNCTION|GRANT\s+EXECUTE/i);
 assert.doesNotMatch(statements,/DROP\s+TABLE|DELETE\s+FROM|TRUNCATE/i);
});
test('G2 SQL distingue AUTO y MOTO y no inventa una moto de clase auto',()=>{
 assert.match(statements,/mobility_vehicle_kind AS ENUM \('AUTO','MOTO'\)/);
 assert.match(statements,/mobility_service_kind AS ENUM \('economico','confort','xl','moto_pasajero'\)/);
 assert.match(statements,/vehicle_kind='MOTO' AND service_kind='moto_pasajero' AND passenger_capacity=1/);
 assert.match(statements,/service_kind='xl' AND passenger_capacity>=6/);
 assert.match(statements,/UNIQUE\(country_code,plate_normalized\)/);
});
test('G2 SQL protege RLS y no permite auto-aprobación desde cliente',()=>{
 for(const table of ['mobility_vehicles','mobility_driver_compliance','mobility_vehicle_compliance']){
  assert.match(statements,new RegExp('ALTER TABLE public\\.'+table+' ENABLE ROW LEVEL SECURITY','i'));
  assert.match(statements,new RegExp('REVOKE ALL ON public\\.'+table+' FROM PUBLIC,anon,authenticated','i'));
  assert.match(statements,new RegExp('GRANT ALL ON public\\.'+table+' TO service_role','i'));
 }
 assert.match(statements,/GRANT SELECT ON public\.mobility_vehicles TO authenticated/);
 assert.doesNotMatch(statements,/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)\s+ON\s+public\.mobility_(?:vehicles|driver_compliance|vehicle_compliance)\s+TO authenticated/i);
 assert.match(statements,/driver_id=auth\.uid\(\) OR public\.has_role\(auth\.uid\(\),'admin'/);
});
test('G2 SQL pide vigencias, seguro remunerado, casco y revisores',()=>{
 for(const field of ['license_valid_through','insurance_valid_through','inspection_valid_through','municipal_authorization_valid_through'])
  assert.ok(statements.includes(field+' date NOT NULL'),field);
 assert.match(statements,/paid_passenger_insurance_covered boolean NOT NULL DEFAULT false/);
 assert.match(statements,/moto_helmets_verified integer NOT NULL DEFAULT 0/);
 assert.match(statements,/moto_reflective_vests_verified integer NOT NULL DEFAULT 0/);
 assert.match(statements,/moto_routes_authorized boolean NOT NULL DEFAULT false/);
 assert.match(statements,/review_status public\.mobility_review_status NOT NULL DEFAULT 'pending'/);
 assert.match(statements,/driver_review_status public\.mobility_review_status NOT NULL DEFAULT 'pending'/);
 for(const field of ['license_verified_by uuid NOT NULL','reviewed_by uuid NOT NULL'])assert.ok(statements.includes(field));
});
