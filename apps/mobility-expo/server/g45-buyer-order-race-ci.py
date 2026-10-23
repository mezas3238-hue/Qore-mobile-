"""G45 PG16 real two-session stock and idempotency race (disposable ONLY).

No remote credentials, no payment, no real operations. qore_ci DB owner only;
G45 owner-only SQL is NEVER granted to browser or generic service_role.
"""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import os
import psycopg

assert os.environ.get("PGHOST") in ("localhost", "127.0.0.1")
assert os.environ.get("PGDATABASE") == "qore_disposable_chain"
assert os.environ.get("PGAPPNAME") == "qore_ci_disposable_chain"
assert os.environ.get("PGUSER") == "qore_ci"

def u(n):
    return "45450000-0000-4545-8545-" + str(n).zfill(12)

BRANCH=u(630)
SHOP=u(620)
ZONE=u(610)
ITEM=u(640)
USERS=[u(601),u(602),u(603),u(604),u(605)]
SESSIONS=[u(701),u(702),u(703)]
SAME_KEY=u(801)
RACE_KEYS=[u(802),u(803)]
BUYERS=USERS[:3]

def db():
    return psycopg.connect(connect_timeout=10, options="-c statement_timeout=16000")

def sql_call(cur, buyer, session, key, version):
    cur.execute("""SELECT public.mobility_stage_g45_reserve_order_qa(
      %s::uuid,%s::uuid,
      floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
      %s::uuid,%s::uuid,%s::bigint,'AUTO'::public.mobility_vehicle_kind,
      jsonb_build_array(jsonb_build_object('itemId',%s::uuid,'quantity',1))
    )""",(buyer,session,key,BRANCH,version,ITEM))
    return cur.fetchone()[0]

def setup():
    with db() as cx, cx.cursor() as c:
        c.execute("INSERT INTO auth.users(id) SELECT unnest(%s::uuid[])",
                  (USERS,))
        c.execute("INSERT INTO public.user_roles(user_id,role) SELECT unnest(%s::uuid[]),'passenger'::public.app_role",(BUYERS,))
        for buyer,session in zip(BUYERS,SESSIONS):
            c.execute("""INSERT INTO public.mobility_stage_g42_provider_session_grants
            (user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
            VALUES(%s::uuid,%s::uuid,clock_timestamp()-interval '1 hour',
            clock_timestamp()-interval '2 minutes',clock_timestamp()+interval '1 hour',
            'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')""",(buyer,session))
        c.execute("""INSERT INTO public.mobility_stage_g31_zone_coverage(
         zone_id,municipality,service_kind,coverage_status)
         VALUES(%s::uuid,'Asuncion','AUTO_DELIVERY','ACTIVE')""",(ZONE,))
        c.execute("""INSERT INTO public.mobility_stage_merchants(
         id,onboarding_key,owner_id,kind,display_tag,status,reviewed_by,reviewed_at)
         VALUES(%s::uuid,%s::uuid,%s::uuid,'SUPERMARKET','QA_RACE','approved',
         %s::uuid,clock_timestamp())""",(SHOP,u(621),USERS[3],USERS[4]))
        c.execute("""INSERT INTO public.mobility_stage_merchant_branches(
         id,merchant_id,branch_tag,pickup_tag,preparation_minutes,active,accepting_orders)
         VALUES(%s::uuid,%s::uuid,'QA_RACE_BRANCH','QA_RACE_PICKUP',10,true,true)""",(BRANCH,SHOP))
        c.execute("""INSERT INTO public.mobility_stage_g44_branch_geography(
         branch_id,zone_id,service_kind) VALUES(%s::uuid,%s::uuid,'AUTO_DELIVERY')""",(BRANCH,ZONE))
        c.execute("""INSERT INTO public.mobility_stage_catalog_items(
         id,branch_id,sku,item_tag,item_class,unit_price_pyg,unit_grams,stock_units)
         VALUES(%s::uuid,%s::uuid,'G45_RACE_SKU','RACE_ITEM','GENERAL',7500,300,2)""",(ITEM,BRANCH))

def ver():
    with db() as cx,cx.cursor() as c:
        c.execute("SELECT revision FROM public.mobility_stage_g44_catalog_versions WHERE branch_id=%s::uuid",(BRANCH,))
        return c.fetchone()[0]

def stock():
    with db() as cx,cx.cursor() as c:
        c.execute("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id=%s::uuid",(ITEM,))
        return c.fetchone()[0]

def reserve(buyer,session,key,version,barrier=None):
    with db() as cx,cx.cursor() as c:
        if barrier:
            barrier.wait(timeout=10)
        try:
            result=sql_call(c,buyer,session,key,version)
            cx.commit()
            return ("success", result)
        except psycopg.Error as err:
            cx.rollback()
            return ("error",err.sqlstate)

def test_duplicate_key(pool):
    version=ver()
    gate=Barrier(2)
    futures=[pool.submit(reserve,BUYERS[0],SESSIONS[0],SAME_KEY,version,gate)
             for _ in range(2)]
    results=[f.result(timeout=20) for f in futures]
    assert all(r[0]=="success" for r in results),results
    assert results[0][1]==results[1][1],results
    assert results[0][1]["subtotalPyg"]==7500
    assert stock()==1,stock()
    print("G45 PASS: two same-request simultaneous retries, one durable reservation",flush=True)

def test_competitors(pool):
    version=ver()
    gate=Barrier(2)
    futures=[pool.submit(reserve,BUYERS[i],SESSIONS[i],RACE_KEYS[i-1],version,gate)
             for i in (1,2)]
    results=[f.result(timeout=20) for f in futures]
    assert len([r for r in results if r[0]=="success"])==1,results
    assert len([r for r in results if r[0]=="error" and r[1]=="G4509"])==1,results
    assert stock()==0,stock()
    with db() as cx,cx.cursor() as c:
        c.execute("SELECT count(*) FROM public.mobility_stage_merchant_orders WHERE branch_id=%s::uuid",(BRANCH,))
        assert c.fetchone()[0]==2
    print("G45 PASS: two competing buyers same last unit, only one succeeds",flush=True)

def cleanup():
    with db() as cx,cx.cursor() as c:
        c.execute("""DELETE FROM public.mobility_stage_g45_cancel_receipts
          WHERE buyer_id=ANY(%s::uuid[])""",(BUYERS,))
        c.execute("""DELETE FROM public.mobility_stage_g45_order_receipts
          WHERE buyer_id=ANY(%s::uuid[])""",(BUYERS,))
        c.execute("""DELETE FROM public.mobility_stage_merchant_order_lines
          WHERE order_id IN(SELECT id FROM public.mobility_stage_merchant_orders WHERE branch_id=%s::uuid)""",(BRANCH,))
        c.execute("DELETE FROM public.mobility_stage_merchant_orders WHERE branch_id=%s::uuid",(BRANCH,))
        c.execute("DELETE FROM public.mobility_stage_catalog_items WHERE branch_id=%s::uuid",(BRANCH,))
        c.execute("DELETE FROM public.mobility_stage_g44_branch_geography WHERE branch_id=%s::uuid",(BRANCH,))
        c.execute("DELETE FROM public.mobility_stage_g44_catalog_versions WHERE branch_id=%s::uuid",(BRANCH,))
        c.execute("DELETE FROM public.mobility_stage_merchant_branches WHERE id=%s::uuid",(BRANCH,))
        c.execute("DELETE FROM public.mobility_stage_merchants WHERE id=%s::uuid",(SHOP,))
        c.execute("DELETE FROM public.mobility_stage_g31_zone_coverage WHERE zone_id=%s::uuid",(ZONE,))
        c.execute("DELETE FROM public.mobility_stage_g42_provider_session_grants WHERE user_id=ANY(%s::uuid[])",(BUYERS,))
        c.execute("DELETE FROM public.user_roles WHERE user_id=ANY(%s::uuid[])",(BUYERS,))
        c.execute("DELETE FROM auth.users WHERE id=ANY(%s::uuid[])",(USERS,))

if __name__=="__main__":
    setup()
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            test_duplicate_key(pool)
            test_competitors(pool)
    finally:
        cleanup()
