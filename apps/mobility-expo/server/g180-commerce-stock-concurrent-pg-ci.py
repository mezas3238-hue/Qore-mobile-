"""G180: original G45/G6 G42-fenced commerce reservations under actual PG16 load.
300 independent branches/stock units; 350 buyer attempts (50 races for final unit).
G45 guards stock/version, G42 locks provider session; G6 prices on the server.
60 originals are cancelled with exact 60 restocks; replay never writes twice.
No merchant staff approval, PSP, courier fulfillment or LIVE is fabricated.
Disposable GitHub CI database only. No remote DB access or deployment.
"""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
import json
import os
import time

import psycopg

REQUIRED = dict(CI="true",PGHOST="localhost",PGPORT="5432",
                PGUSER="qore_ci",PGDATABASE="qore_disposable_chain",
                PGAPPNAME="qore_ci_disposable_chain")
if any(os.getenv(k)!=v for k,v in REQUIRED.items()):
    raise SystemExit("G180 requires isolated, disposable CI PostgreSQL")
BRANCH_COUNT=300
BUYER_COUNT=350
RACE_BRANCHES=50
CANCEL_COUNT=60
WORKERS=32
PRICE=9900
def u(n):
    return f"18000000-0000-4180-8180-{n:012d}"
def word(n):
    return ''.join(chr(65+(n//(26**k))%26) for k in (2,1,0))
OWNER,REVIEWER,SHOP,ZONE_AUTO,ZONE_MOTO=[u(i) for i in (1,2,3,4,5)]
def db(*,autocommit=False):
    return psycopg.connect(autocommit=autocommit,connect_timeout=5,
      options="-c statement_timeout=12000 -c lock_timeout=3500")
def buyer(i):return u(1000+i)
def session(i):return u(2000+i)
def request_key(i):return u(3000+i)
def cancel_key(i):return u(4000+i)
def branch(i):return u(6000+i)
def item(i):return u(10000+i)
def vehicle(i):return "AUTO" if i%2==0 else "MOTO"
def origin_branch_for_buyer(i):return i if i<300 else 250+i-300
def q(conn,sql,params=()):
    return conn.execute(sql,params).fetchone()[0]
def percentile(vals,p):
    vals=sorted(vals)
    return round(vals[int((len(vals)-1)*p)],2)
def guard(conn):
    assert conn.execute("SELECT current_database(),current_setting('application_name')").fetchone()==(
        "qore_disposable_chain","qore_ci_disposable_chain")
    for signature in (
      "public.mobility_stage_g45_reserve_order_qa(uuid,uuid,bigint,uuid,uuid,bigint,public.mobility_vehicle_kind,jsonb)",
      "public.mobility_stage_g45_cancel_order_qa(uuid,uuid,bigint,uuid,uuid)"
    ):
        assert q(conn,"SELECT to_regprocedure(%s) IS NOT NULL",(signature,))
        assert not q(conn,"SELECT has_function_privilege('service_role',%s,'EXECUTE')",(signature,)),signature

def setup():
    with db() as c:
        guard(c)
        # Real Auth rows, app roles, G42 provider grants, and a server-reviewed
        # synthetic G6 merchant. Never spoof participant legal credentials.
        c.cursor().executemany("INSERT INTO auth.users(id) VALUES(%s)",
          [(u(i),) for i in (1,2)]+[(buyer(i),) for i in range(BUYER_COUNT)])
        c.cursor().executemany("""
          INSERT INTO public.user_roles(user_id,role)
          VALUES (%s,'passenger'::public.app_role) ON CONFLICT DO NOTHING
        """,[(buyer(i),) for i in range(BUYER_COUNT)])
        c.cursor().executemany("""
          INSERT INTO public.mobility_stage_g42_provider_session_grants(
            user_id,session_id,provider_confirmed_at,token_allowed_from,
            valid_until,evidence_kind)
          VALUES(%s,%s,clock_timestamp()-interval '1 hour',
            clock_timestamp()-interval '2 minutes',
            clock_timestamp()+interval '1 hour',
            'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')
        """,[(buyer(i),session(i)) for i in range(BUYER_COUNT)])
        c.cursor().executemany("""
          INSERT INTO public.mobility_stage_g31_zone_coverage(
            zone_id,municipality,service_kind,coverage_status)
          VALUES(%s,'Asuncion',%s,'ACTIVE')
        """,[(ZONE_AUTO,"AUTO_DELIVERY"),(ZONE_MOTO,"MOTO_DELIVERY")])
        c.execute("""
          INSERT INTO public.mobility_stage_merchants(
           id,onboarding_key,owner_id,kind,display_tag,
           status,reviewed_by,reviewed_at)
          VALUES(%s,%s,%s,'SUPERMARKET','QA_COMMERCE_LOAD',
           'approved',%s,clock_timestamp())
        """,(SHOP,u(7),OWNER,REVIEWER))
        c.cursor().executemany("""
          INSERT INTO public.mobility_stage_merchant_branches(
           id,merchant_id,branch_tag,pickup_tag,
           preparation_minutes,active,accepting_orders)
          VALUES(%s,%s,%s,'QA_PICKUP',10,true,true)
        """,[(branch(i),SHOP,"LOAD_"+word(i)) for i in range(BRANCH_COUNT)])
        c.cursor().executemany("""
          INSERT INTO public.mobility_stage_g44_branch_geography(
            branch_id,zone_id,service_kind)
          VALUES(%s,%s,%s)
        """,[(branch(i),ZONE_AUTO if i%2==0 else ZONE_MOTO,
               "AUTO_DELIVERY" if i%2==0 else "MOTO_DELIVERY")
               for i in range(BRANCH_COUNT)])
        c.cursor().executemany("""
          INSERT INTO public.mobility_stage_catalog_items(
           id,branch_id,sku,item_tag,item_class,
           unit_price_pyg,unit_grams,stock_units)
          VALUES(%s,%s,%s,%s,'GENERAL',%s,300,1)
        """,[(item(i),branch(i),"SKU_"+str(i),
               "ITEM_"+str(i),PRICE) for i in range(BRANCH_COUNT)])
        assert q(c,"SELECT count(*) FROM public.mobility_stage_g44_catalog_versions WHERE branch_id=ANY(%s::uuid[])",
          ([branch(i) for i in range(BRANCH_COUNT)],))==BRANCH_COUNT

def version_snapshot():
    with db(autocommit=True) as c:
        return dict(c.execute("""
          SELECT branch_id::text,revision
          FROM public.mobility_stage_g44_catalog_versions
          WHERE branch_id=ANY(%s::uuid[])
        """,([branch(i) for i in range(BRANCH_COUNT)],)).fetchall())

def reserve(i,versions,barriers=None):
    # One physical connection per competing request. All SQL commits are real.
    br=origin_branch_for_buyer(i)
    t=time.perf_counter()
    with db() as c:
        if barriers is not None:
            barriers[br].wait(timeout=12)
        try:
            receipt=q(c,"""
              SELECT public.mobility_stage_g45_reserve_order_qa(
               %s,%s,
               floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
               %s,%s,%s,%s::public.mobility_vehicle_kind,
               jsonb_build_array(jsonb_build_object(
                'itemId',%s::uuid,'quantity',1)))
            """,(buyer(i),session(i),request_key(i),branch(br),
                  versions[branch(br)],vehicle(br),item(br)))
            assert receipt["requestKey"]==request_key(i)
            assert receipt["branchId"]==branch(br)
            assert receipt["subtotalPyg"]==PRICE
            assert receipt["receiptStatus"]=="QA_RESERVED_NO_PAYMENT"
            assert receipt["productionEnabled"] is False
            c.commit()
            return {"buyer":i,"branch":br,"outcome":"accepted",
                    "id":receipt["orderId"],"receipt":receipt,
                    "ms":(time.perf_counter()-t)*1000}
        except psycopg.Error as ex:
            c.rollback()
            # G45 version/availability race is a legitimate denial.
            # Any timeout, session bypass or database failure must fail CI.
            if ex.sqlstate not in ("G4509","G4503"):
                raise
            return {"buyer":i,"branch":br,"outcome":"denied",
                    "sqlstate":ex.sqlstate,
                    "ms":(time.perf_counter()-t)*1000}

def replay(i,entry,versions):
    br=entry["branch"]
    with db() as c:
        prior=q(c,"""
          SELECT public.mobility_stage_g45_reserve_order_qa(
           %s,%s,floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
           %s,%s,%s,%s::public.mobility_vehicle_kind,
           jsonb_build_array(jsonb_build_object('itemId',%s::uuid,'quantity',1)))
        """,(buyer(i),session(i),request_key(i),branch(br),
             versions[branch(br)],vehicle(br),item(br)))
        assert prior==entry["receipt"],"Lost ACK replay changed immutable receipt"
        assert prior["orderId"]==entry["id"]
    return i

def cancel(entry):
    i=entry["buyer"]
    with db() as c:
        first=q(c,"""
          SELECT public.mobility_stage_g45_cancel_order_qa(
           %s,%s,floor(extract(epoch FROM clock_timestamp())*1000)::bigint,%s,%s)
        """,(buyer(i),session(i),entry["id"],cancel_key(i)))
        second=q(c,"""
          SELECT public.mobility_stage_g45_cancel_order_qa(
           %s,%s,floor(extract(epoch FROM clock_timestamp())*1000)::bigint,%s,%s)
        """,(buyer(i),session(i),entry["id"],cancel_key(i)))
        assert first==second,"Cancellation retry changed receipt/event"
        assert first["orderId"]==entry["id"]
        assert first["refundStatus"]=="NO_PSP_NO_FINANCIAL_REFUND"
        assert first["receiptStatus"]=="QA_CANCELLED_STOCK_RESTORED"
    return first["orderId"]

def main():
    setup()
    versions=version_snapshot()
    started=time.perf_counter()
    # 250 independent branch orders first, followed by 50 true two-session
    # synchronized races on the last available item. The paired submissions
    # avoid ThreadPool deadlocks and prevent a sequential 'race' from passing.
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        solo=list(ex.map(lambda i:reserve(i,versions),range(250)))
        barriers={i:Barrier(2) for i in range(250,300)}
        pairs=[i for br in range(250,300) for i in (br,300+br-250)]
        raced=list(ex.map(lambda i:reserve(i,versions,barriers),pairs))
    results=solo+raced
    reserve_secs=round(time.perf_counter()-started,3)
    accepted=[x for x in results if x["outcome"]=="accepted"]
    denied=[x for x in results if x["outcome"]=="denied"]
    assert len(accepted)==BRANCH_COUNT,(len(accepted),Counter(x["sqlstate"] for x in denied))
    assert len(denied)==RACE_BRANCHES,len(denied)
    groups=Counter(x["branch"] for x in accepted)
    assert len(groups)==BRANCH_COUNT and all(n==1 for n in groups.values())
    assert len(set(x["id"] for x in accepted))==BRANCH_COUNT
    assert all(x["branch"]>=250 for x in denied),denied[:2]
    # Send real replay claims using the same G45 original user/session/key.
    # Each was previously committed, so catalog version/stock must not
    # cause duplicate inventory or new payment.
    replays=accepted[::5]
    with ThreadPoolExecutor(max_workers=16) as ex:
        assert len(list(ex.map(lambda x: replay(x["buyer"],x,versions),replays)))==len(replays)
    selected=accepted[::5]
    assert len(selected)==CANCEL_COUNT,len(selected)
    with ThreadPoolExecutor(max_workers=16) as ex:
        cancellations=list(ex.map(cancel,selected))
    assert len(set(cancellations))==CANCEL_COUNT
    canceled_ids=set(cancellations)
    with db() as c:
        guard(c)
        rows=c.execute("""
          SELECT o.id::text,r.request_key::text,r.buyer_id::text,
            o.status,o.requested_vehicle_kind::text,
            r.subtotal_pyg,r.order_id::text,
            (SELECT count(*) FROM public.mobility_stage_merchant_order_lines l
             WHERE l.order_id=o.id) AS lines
          FROM public.mobility_stage_g45_order_receipts r
          JOIN public.mobility_stage_merchant_orders o ON o.id=r.order_id
          WHERE o.branch_id=ANY(%s::uuid[])
        """,([branch(i) for i in range(BRANCH_COUNT)],)).fetchall()
        assert len(rows)==BRANCH_COUNT,len(rows)
        source={x[0]:x for x in rows}
        for x in accepted:
            row=source[x["id"]]
            assert row[1]==request_key(x["buyer"])
            assert row[2]==buyer(x["buyer"])
            assert row[3]==("cancelled" if x["id"] in canceled_ids else "requested")
            assert row[4]==vehicle(x["branch"])
            assert row[5]==PRICE and row[6]==x["id"] and row[7]==1
        stocks=dict(c.execute("""
           SELECT branch_id::text,stock_units
           FROM public.mobility_stage_catalog_items
           WHERE branch_id=ANY(%s::uuid[])
        """,([branch(i) for i in range(BRANCH_COUNT)],)).fetchall())
        assert len(stocks)==BRANCH_COUNT
        for x in accepted:
            expected=1 if x["id"] in canceled_ids else 0
            assert stocks[branch(x["branch"])]==expected
        cancel_receipts=q(c,"""
           SELECT count(*) FROM public.mobility_stage_g45_cancel_receipts
           WHERE order_id=ANY(%s::uuid[])
        """,(list(canceled_ids),))
        cancel_events=q(c,"""
          SELECT count(*) FROM public.mobility_stage_merchant_order_events e
          JOIN public.mobility_stage_g45_cancel_receipts r
           ON r.event_id=e.id
          WHERE r.order_id=ANY(%s::uuid[]) AND e.action='cancel'
        """,(list(canceled_ids),))
        assert cancel_receipts==CANCEL_COUNT and cancel_events==CANCEL_COUNT
        # One G6 persisted order per request_key, including 50 failed buyers.
        assert q(c,"""
           SELECT count(*) FROM public.mobility_stage_merchant_orders
           WHERE request_key=ANY(%s::uuid[])
        """,([request_key(i) for i in range(BUYER_COUNT)],))==BRANCH_COUNT
        for i in range(BRANCH_COUNT):
            assert groups[i]==1
        totals=Counter(x["outcome"] for x in results)
        modes=Counter(vehicle(x["branch"]) for x in accepted)
        assert modes=={"AUTO":150,"MOTO":150}
        report={
         "lab":"G180_REAL_COMMERCE_POSTGRES_STOCK_CONCURRENCY",
         "originalG45OrdersCreated":BRANCH_COUNT,
         "independentBuyers":BUYER_COUNT,
         "independentBranches":BRANCH_COUNT,
         "concurrentPostgresClients":WORKERS,
         "simultaneousLastUnitCompetitions":RACE_BRANCHES,
         "simultaneousRaceBarrier":"PAIRED_PG_SESSIONS",
         "accepted":totals["accepted"],
         "rejectedWithoutOverselling":totals["denied"],
         "vehicles":dict(modes),
         "cancelledAndRestocked":CANCEL_COUNT,
         "idempotentOrderReplays":len(replays),
         "idempotentCancelReplays":CANCEL_COUNT,
         "stockUnderflow":0,
         "wrongOwnerOrKeys":0,
         "duplicateOrders":0,
         "failedRequestsWithPhantomOrder":0,
         "totalOrderPhaseSeconds":reserve_secs,
         "orderAttemptRatePerSecond":round(BUYER_COUNT/reserve_secs,2),
         "orderAttemptP50Ms":percentile([x["ms"] for x in results],.5),
         "orderAttemptP95Ms":percentile([x["ms"] for x in results],.95),
         "orderAttemptP99Ms":percentile([x["ms"] for x in results],.99),
         "denialSqlstates":dict(Counter(x["sqlstate"] for x in denied)),
         "merchantSessionAuthority":"G42_SQL_LOCK_ACTIVE",
         "inventoryAuthority":"G45_G6_VERSION_AND_ROW_LOCK",
         "financialProvider":"NOT_CONNECTED",
         "merchantFulfillment":"NOT_EXERCISED_IN_THIS_LOAD",
         "courierAssignment":"NOT_EXERCISED_IN_THIS_LOAD",
         "commercialTripsEnabled":False,
         "verdict":"REAL_G45_COMMERCE_CONCURRENT_STOCK_PASS"
        }
        out=Path("artifacts/qore-load-lab/g180-commerce-real-pg16.json")
        out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
        print(json.dumps(report,sort_keys=True),flush=True)

if __name__=="__main__":
    main()
