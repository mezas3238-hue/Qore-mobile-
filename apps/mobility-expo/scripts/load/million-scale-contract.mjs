// QORE million-scale load DEMAND MODEL. Pure math, NOT a performance benchmark.
import assert from 'node:assert/strict';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
const profiles=[
 {id:'TWO_MILLION_REGISTRATIONS',registered:2000000,clientsOnline:100000,driversOnline:40000,activeTrips:20000,bookingsPerMinute:12000},
 {id:'FIVE_MILLION_REGISTRATIONS',registered:5000000,clientsOnline:400000,driversOnline:100000,activeTrips:100000,bookingsPerMinute:30000},
 {id:'ONE_MILLION_SIMULTANEOUS',registered:10000000,clientsOnline:800000,driversOnline:200000,activeTrips:200000,bookingsPerMinute:60000}
];
const fixed=n=>Math.round(n*100)/100;
const scenarios=profiles.map(p=>{
 assert(p.registered>=p.clientsOnline && p.activeTrips<=p.clientsOnline);
 const connected=p.clientsOnline+p.driversOnline;
 const gps=p.driversOnline/5,offers=p.driversOnline/5,status=p.clientsOnline/30,trip=p.activeTrips/10,bookings=p.bookingsPerMinute/60;
 return {id:p.id,registeredCustomers:p.registered,connectedActors:connected,activeTrips:p.activeTrips,
 assumedGpsPerSecond:fixed(gps),assumedDriverOfferPollsPerSecond:fixed(offers),
 assumedCustomerStatusPollsPerSecond:fixed(status),assumedTripEventsPerSecond:fixed(trip),
 assumedNewBookingsPerSecond:fixed(bookings),hypotheticalNaiveHttpRps:fixed(gps+offers+status+trip+bookings),
 currentIngressIdentityGuard:4096,connectedActorsToSingleInstanceGuardRatio:fixed(connected/4096),
 evidence:'ARITHMETIC_ONLY_NO_LOAD_TEST'};
});
assert.equal(scenarios[0].registeredCustomers,2000000);
assert.equal(scenarios[2].connectedActors,1000000);
assert(scenarios[2].hypotheticalNaiveHttpRps>80000);
const report={
 project:'QORE Mobile / Movete Facil',type:'MILLION_SCALE_PLANNING_CONTRACT',
 measuredThroughput:null,measuredConcurrency:null,productionCertified:false,
 networkRequests:0,realDatabaseWrites:0,stagingOnly:true,
 assumptions:'Every driver GPS and offer poll each 5s, customers status each 30s, active trips event each 10s; future event streaming should reduce HTTP load',
 scenarios,
 mandatoryEngineeringGates:[
 '2M_PLUS_REAL_SYNTHETIC_POSTGRESQL_ROWS_QUERY_PLANS',
 'FIVE_SERVICE_SAME_REQUEST_END_TO_END_ON_DISPOSABLE_PG',
 'STATELESS_API_MULTIPLE_REPLICAS_WITH_SHARED_RATE_LIMIT',
 'TRANSACTIONAL_DISPATCH_OUTBOX_MULTI_WORKER_FAIRNESS',
 'IDEMPOTENT_PAYMENT_ASSIGNMENT_AND_DELIVERY_TRANSITIONS',
 'REALTIME_FANOUT_GPS_THROTTLING_AND_BACKPRESSURE',
 'POSTGRES_POOLING_INDEXES_PARTITIONING_AND_REPLICA_PLAN',
 '100K_500K_1M_CONNECTED_STRESS_AND_FAILURE_RECOVERY',
 'PROVIDER_QUOTAS_COST_LIMITS_ON_AUTH_MAPS_PUSH_PAYMENTS',
 'OPERATOR_SLOS_ALERTING_DR_RECOVERY_GO_NO_GO'
 ]};
const out='artifacts/qore-load-lab/million-scale-contract.json';
await mkdir('artifacts/qore-load-lab',{recursive:true});
await writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:out,scenarios,certified:report.productionCertified}));
if(process.env.GITHUB_STEP_SUMMARY){
 const lines=['## QORE million-scale DEMAND MODEL (not load evidence)','',
 '| Scenario | Registered | Connected | Hypothetical HTTP RPS |',
 '|---|---:|---:|---:|',
 ...scenarios.map(x=>'| '+x.id+' | '+x.registeredCustomers+' | '+x.connectedActors+' | '+x.hypotheticalNaiveHttpRps+' |'),
 '','No actual million-user workload was executed. Production remains NO_GO.'];
 await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
