"""G181: run original G177 + G180 mutations concurrently on the SAME PG16.
G177: 900 original MOTO ride and AUTO/MOTO parcel SQL writes + 5-service
provenance. G180: 300 original G45 commerce orders, 50 contested last
units, 60 cancellations. Both execute concurrently, not one after another.
Disposable CI ONLY. No virtual provider, fake courier, remote DB or PSP.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import psycopg

REQUIRED={"CI":"true","PGHOST":"localhost","PGPORT":"5432",
 "PGDATABASE":"qore_disposable_chain","PGAPPNAME":"qore_ci_disposable_chain"}
if any(os.environ.get(k)!=v for k,v in REQUIRED.items()):
    raise SystemExit("G181 confined to disposable PG16 CI")
ROOT=Path(__file__).resolve().parent
SCRIPTS={
 "services":ROOT/"g177-five-service-pg-concurrent-load-ci.py",
 "commerce":ROOT/"g180-commerce-stock-concurrent-pg-ci.py"
}
OUTPUTS={
 "services":Path("artifacts/qore-load-lab/g177-five-service-pg16.json"),
 "commerce":Path("artifacts/qore-load-lab/g180-commerce-real-pg16.json")
}
for key,path in SCRIPTS.items():
    if not path.is_file():
        raise RuntimeError("G181 missing original workload "+key)
if any(p.exists() for p in OUTPUTS.values()):
    raise RuntimeError("G181 requires clean disposable outputs")
for p in OUTPUTS.values():
    p.parent.mkdir(parents=True,exist_ok=True)

started=time.perf_counter()
processes={}
try:
    # Separate OS processes, different independent clients, a single
    # PostgreSQL instance. No in-memory fake DB or renamed original RPCs.
    for name,path in SCRIPTS.items():
        processes[name]=subprocess.Popen(
            [sys.executable,str(path)],stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,text=True,env=os.environ.copy())
    both_running=False
    max_pg_connections=0
    max_total_pg_connections=0
    with psycopg.connect(autocommit=True,connect_timeout=4,
       options="-c statement_timeout=2000") as observer:
        assert observer.execute(
            "SELECT current_database(),current_setting('application_name')"
        ).fetchone()==("qore_disposable_chain","qore_ci_disposable_chain")
        while any(p.poll() is None for p in processes.values()):
            if time.perf_counter()-started>135:
                raise TimeoutError("G181 workloads exceeded 135s on disposable CI")
            both_running|=all(p.poll() is None for p in processes.values())
            db_count,all_count=observer.execute("""
               SELECT count(*) FILTER(
                   WHERE application_name='qore_ci_disposable_chain'),
                      count(*)
               FROM pg_stat_activity
               WHERE datname=current_database()
            """).fetchone()
            max_pg_connections=max(max_pg_connections,db_count)
            max_total_pg_connections=max(max_total_pg_connections,all_count)
            time.sleep(.04)
    output={}
    for name,p in processes.items():
        stdout,_=p.communicate(timeout=10)
        print("G181 ORIGINAL "+name+" LOG\n"+stdout,flush=True)
        if p.returncode!=0:
            raise RuntimeError("G181 "+name+" original workload failed: "+str(p.returncode))
        output[name]=json.loads(OUTPUTS[name].read_text(encoding="utf-8"))
    services=output["services"]
    commerce=output["commerce"]
    assert services["verdict"]=="PG16_FIVE_SERVICE_MIXED_INTEGRITY_PASS"
    assert services["newConcurrentRealSqlMutations"]==900
    assert commerce["verdict"]=="REAL_G45_COMMERCE_CONCURRENT_STOCK_PASS"
    assert commerce["accepted"]==300 and commerce["rejectedWithoutOverselling"]==50
    assert commerce["cancelledAndRestocked"]==60
    assert services["originalsLost"]==0 and services["duplicateOriginals"]==0
    assert commerce["duplicateOrders"]==0 and commerce["stockUnderflow"]==0
    assert both_running,"G181 workloads were not overlapping processes"
    assert max_pg_connections>=12,(
      "G181 must measure concurrent real PG sessions",max_pg_connections)
    # A third independent PG connection reconciles committed rows from both
    # overlapping OS processes, rather than trusting only their JSON output.
    # Keep original identities immutable; no state rewrites or fake offers.
    with psycopg.connect(autocommit=True,connect_timeout=4) as audit:
        audited=audit.execute("""
          SELECT
           (SELECT count(*) FROM public.mobility_stage_g100_moto_trips
             WHERE left(passenger_id::text,9)='17700000-'),
           (SELECT count(*) FROM public.mobility_stage_deliveries
             WHERE left(sender_id::text,9)='17700000-'),
           (SELECT count(*) FROM public.mobility_stage_merchant_orders
             WHERE left(request_key::text,9)='18000000-'),
           (SELECT count(*) FROM public.mobility_stage_g45_order_receipts
             WHERE left(request_key::text,9)='18000000-'),
           (SELECT count(*) FROM public.mobility_stage_g45_cancel_receipts
             WHERE left(buyer_id::text,9)='18000000-')
        """).fetchone()
    assert audited==(300,600,300,300,60),(
      "G181 cross-process committed original source rows mismatch",audited)
    result={
     "lab":"G181_FIVE_SERVICE_REAL_PG16_COTENANCY",
     "independentPostRunDatabaseAudit":{
       "motoRides":audited[0],"parcelDeliveries":audited[1],
       "merchantOrders":audited[2],"merchantReceipts":audited[3],
       "merchantCancelReceipts":audited[4]
     },
     "sameDisposablePostgres":True,
     "independentOsWorkloadProcesses":2,
     "overlappedProcessExecution":both_running,
     "maximumObservedQaPostgresConnections":max_pg_connections,
     "maximumObservedAllDatabaseConnections":max_total_pg_connections,
     "newRealBusinessWrites":1200,
     "originalMotoRideBookings":services["newMotoOriginalTrips"],
     "originalAutoParcelRequests":services["newDeliveryAutoOriginalRequests"],
     "originalMotoParcelRequests":services["newDeliveryMotoOriginalRequests"],
     "originalCommerceOrders":commerce["originalG45OrdersCreated"],
     "preexistingOriginalAutoRideBookingsAtLeast":services["autoOriginalBookingsAtLeast"],
     "commerceContestedLastUnits":commerce["simultaneousLastUnitCompetitions"],
     "commerceLegitimateDenials":commerce["rejectedWithoutOverselling"],
     "commerceCancellationsRestocked":commerce["cancelledAndRestocked"],
     "duplicateOriginals":0,"lostOriginals":0,
     "driverAssignmentsForged":0,"merchantPspPaid":False,
     "durationSeconds":round(time.perf_counter()-started,3),
     "limits":"QA synthetic identities; AUTO uses earlier G173 proof; no five-service driver/merchant end-to-end completion or LIVE.",
     "verdict":"CO_TENANT_FIVE_SERVICE_PG16_PASS"
    }
    path=Path("artifacts/qore-load-lab/g181-five-service-co-tenant-pg16.json")
    path.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps(result,sort_keys=True),flush=True)
finally:
    for p in processes.values():
        if p.poll() is None:p.kill()
    for p in processes.values():
        if p.poll() is None:
            try:p.communicate(timeout=5)
            except subprocess.TimeoutExpired:pass
