# ANEXO A — Inventario histórico de todos los commits alcanzables desde el HEAD Arquitecto A

**Corte:** 2026-10-23 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · **Rama:** `feature/mobility-monorepo-isolated-20261016`.
**HEAD AUDITADO (antes de publicar anexos/handoff):** `201a687abf68df13b4947296f230b53b2f361fd6`.
**Total verificado:** 714 commits alcanzables por la historia GitHub en ese SHA, orden cronológico inverso.

> Alcance: historial completo *alcanzable* desde la rama A, **no equivale a ${commits.length} cambios atribuibles al Arquitecto A actual**. Incluye commits fundacionales, evoluciones anteriores y ancestros del branch. La rama B actual no forma parte de esta relación salvo commits que ya fueran ancestros. Se recopila para auditoría y continuidad, no como prueba de éxito de CI. Los commits de publicación de este anexo y del nuevo handoff son posteriores y no están incluidos: validar sus SHA aparte.

## Cómo usar el anexo

- Identificar una regresión por SHA y título; abrir `https://github.com/mezas3238-hue/Qore-mobile-/commit/<SHA>`.
- Priorizar el handoff Maestro G0–G48 y la matriz de archivos; este índice conserva trazabilidad, no sustituye lectura del diff.
- NO asumir que un commit previo o una prueba previa garantizan el CI del nuevo HEAD; consultar cuatro workflows del SHA exacto.

## Registro completo SHA, fecha UTC y resumen de commit

| Nº | SHA completo | Fecha UTC | Mensaje (primera línea) |
|---:|---|---|---|
| 1 | `201a687abf68df13b4947296f230b53b2f361fd6` | 2026-10-23 21:21:16 | G48: document scoped NOLOGIN gateway, one-use read proofs, real two-session QA races and Auth blockers |
| 2 | `81bb64049584552f0ca7b2cc93f1ffa84b309928` | 2026-10-23 21:20:36 | G48: protect unwired Driver/Buyer APIs and SQL NOLOGIN least-privilege promises with regression tests |
| 3 | `165b3cc2ff6e43bff6cd2f3c395039b5d2204a74` | 2026-10-23 21:20:08 | G48: publish three unwired narrow Driver/Buyer read contracts and disabled one-use proof integration flags |
| 4 | `a1a0de70467ad49ed78e6bceba7bb8e4be95e192` | 2026-10-23 21:19:24 | G48: fix strict five-group UUID validator for verified provider and scoped DB tickets |
| 5 | `1bf78c6cfbc973642fba4db09b95ad39164125ee` | 2026-10-23 21:18:34 | G48: run real two-connection delegated proof race in disposable PostgreSQL CI |
| 6 | `c82d050506b94d52e9f2a2b4075ed873bd9be2a4` | 2026-10-23 21:18:23 | G48: add real PG16 two-session ticket single-winner race and revocation-after-mint assertions |
| 7 | `a97f255cb382f02f6c8b11a085d0632276b63f90` | 2026-10-23 21:17:42 | G48: adversarial Node QA tests for delegated Driver/Buyer read tickets, provider session and no PII or LIVE |
| 8 | `fe0dfc3636328f7632685f7c71dfa2c5996e9136` | 2026-10-23 21:17:00 | G48: isolated Node boundary translates verified session to server-owned one-use least-privilege DB tickets |
| 9 | `874a6ff4e97b2547726cc5b39904a4f3c0b4fa4a` | 2026-10-23 21:16:00 | G48: wire scoped DB delegation install/assert to disposable PostgreSQL CI |
| 10 | `0ebce667aab382604cf7a758520d0022055db131` | 2026-10-23 21:15:50 | G48: define revocation QA helper with DB owner before NOLOGIN role handoff |
| 11 | `5ac540900660669cda79f10071ea91e2773dd695` | 2026-10-23 21:15:33 | G48: PG16 QA asserts no-login gateway grants, scoped tickets, immutable audit and server-priced buyer catalog |
| 12 | `e7f917fd5b0ae5950f0ec0a91cc91aba24fa5908` | 2026-10-23 21:14:15 | G48: add non-login least-privilege SQL delegation for session-bound one-use Driver/KYC and Buyer catalog reads |
| 13 | `4a4bdb51fa7e1f32ae6b0328acc92952a5c23805` | 2026-10-23 19:45:19 | G47: document synthetic private KYC evidence leases, immutable audit and real Storage blockers |
| 14 | `da00408b488cde84c2da997f8a970208e8119563` | 2026-10-23 19:44:10 | G47: assert Driver evidence OpenAPI is read-only metadata, never exposes signed URLs or LIVE |
| 15 | `b9db63c3a4daa9c6fe5a6b0bdc2db56e8c242d0d` | 2026-10-23 19:43:37 | G47: add mandatory default Error responses to synthetic evidence API contracts |
| 16 | `2e42cba6b1d9a0f1af40bd4b251985a1c282c596` | 2026-10-23 19:42:38 | G47: make revocation replay test deterministic, avoid SQL optimizer reordering volatile calls |
| 17 | `1d8e77932553223aa1799b19b406eb426b43382f` | 2026-10-23 19:41:59 | G47: use valid isolated STAGING ref and distinguish disabled URL flag from actual URL |
| 18 | `3fc7d465e2523c6744aba0a8877b46d35e156837` | 2026-10-23 19:41:20 | G47: document QA-only private Driver evidence access leases; no Storage URL or HTTP runtime |
| 19 | `2f03e0ca794db52b958781001050160383d0fcce` | 2026-10-23 19:40:51 | G47: use unique synthetic Storage object key distinct from G17 historical fixture |
| 20 | `d1cee8efb80976ff567f191d4ca243476d0a68ed` | 2026-10-23 19:40:16 | G47: adversarial Node tests private document metadata boundary, AAL2, revocation and zero URLs |
| 21 | `b5296e91272e80afc60222fdce27b458767902df` | 2026-10-23 19:39:22 | G47: seed independent synthetic G17 license fixture without depending on older QA rollbacks |
| 22 | `88846ec9bf2df6d709053c6d77b4b2c113afc04a` | 2026-10-23 19:38:36 | G47: guarded Node QA boundary for private session-bound Driver evidence metadata leases |
| 23 | `8faa20f3dd7debfe4bcda527666c1a35a28cc7f4` | 2026-10-23 19:37:46 | G47: include private Driver evidence access and audit in full PostgreSQL chain CI |
| 24 | `1db0770a834af485415bc380952bf9afb622f127` | 2026-10-23 19:37:32 | G47: assert owner-only private evidence attestations, session-bound leases, denial and immutable audit |
| 25 | `074883c5cb203c7287993f876b14d685879ef1bb` | 2026-10-23 19:35:02 | G47: secure private KYC metadata attestations, 60-second session-bound access leases and immutable audit |
| 26 | `c7d5bd098dae7615a71acde3295dc3b67528494f` | 2026-10-23 18:44:47 | G46: document legacy merchant grant audit, fail-closed migration and verified HTTPS staging cutover blockers |
| 27 | `8b2558c9e276eddf85cb5a43f5766425d3002183` | 2026-10-23 18:43:47 | G46: regression guard OpenAPI merchant flags and disposable-only G6/G9 closure |
| 28 | `20075544a8e2ead982b92535d7c81367cdf175dd` | 2026-10-23 18:43:29 | G46: normalize G45 schema compatibility check without regex escaping ambiguity |
| 29 | `9dc64f49ff43ed554b2b3d05117a34d7bbb2494d` | 2026-10-23 18:43:16 | G46: preserve G45 contract QA across additive OpenAPI version increments |
| 30 | `ac411f14f1a4009d9e54341917fa89598a72ddbc` | 2026-10-23 18:43:06 | G46: advertise commerce privilege closure as CI-only and merchant runtime explicitly blocked |
| 31 | `f99238b62bd5dd97de030a67e0ec836a77d5c575` | 2026-10-23 18:42:14 | G46: test STAGING preflight independence, evidence freshness, missing Owner approval and perpetual no-deploy |
| 32 | `886396c0f40c68b35698623ef73d1f0acf4a399d` | 2026-10-23 18:41:46 | G46: add fail-closed independent Staging cutover checklist that can never deploy or enable commerce |
| 33 | `09b4cb21bea81fa95dca4452db654f02222b2eb0` | 2026-10-23 18:40:36 | G46: include historical G9 commerce schema in disposable privilege closure |
| 34 | `338df957106cdeb5db93237c654f7e40e4590a61` | 2026-10-23 18:39:24 | G46: CI audit and fail-close legacy merchant service-role privileges after G45 race |
| 35 | `72b48e964ffe8697ca8e95aa555ad7c216a8c76c` | 2026-10-23 18:39:12 | G46: assert 168 revoked table grants, 33 RPC grants and direct service_role exploit denial |
| 36 | `47b75c3bf3ec5d32f449425671d8efd46589696c` | 2026-10-23 18:38:30 | G46: revoke historical G6/G9 commerce DML and identity-spoofable RPC from service_role |
| 37 | `e6ed9fc72f951d77060ff9fd526756d4d9b22837` | 2026-10-23 18:33:52 | G45: document atomic synthetic order reservations, replay/race tests, governance and blockers |
| 38 | `7fd5be97430bbef7c2a3d35310c7620ab9fad530` | 2026-10-23 18:32:54 | G45: guard OpenAPI against checkout claims and client-side price tampering |
| 39 | `45ae5f1768fdb195ac9bbc99b3ea97a1580d25a8` | 2026-10-23 18:32:40 | G45: publish strict synthetic order and cancellation OpenAPI contracts, runtime unwired |
| 40 | `38090336513bda5c0e1dcfa33429c9fd0d9f3be9` | 2026-10-23 18:31:12 | G45: handle auth.users automatic passenger role seeding in race fixtures |
| 41 | `2b874c8f021a45a873fd3e460fe919e5735e1a60` | 2026-10-23 18:30:42 | G45: Node adversarial tests price spoofing, trusted identity, replay conflicts and synthetic refunds |
| 42 | `bef9798f9c035d8d553b370f166ab21972b6b3e3` | 2026-10-23 18:30:04 | G45: fix PostgreSQL special EXTRACT syntax in disposable assertions |
| 43 | `d094295723b8b42a132beb6a814dce1f8a5e9061` | 2026-10-23 18:29:37 | G45: isolated Node buyer reservation and cancellation contracts, Auth and sealed server-priced receipts |
| 44 | `ddb6b709404b00235af68a0e686b755a405eaf9a` | 2026-10-23 18:28:55 | G45: correct merchant and branch tags to G6 uppercase-only schema |
| 45 | `2baf44078c0a8a442e0668ef9103f36999d6a491` | 2026-10-23 18:28:52 | G45: correct merchant and branch tags to G6 uppercase-only schema |
| 46 | `471da76019d6d9ca8a66427a4d168a4773805b7c` | 2026-10-23 18:28:11 | G45: run two-connection transactional reservation race in disposable PG CI |
| 47 | `b40aac21d6632f2e223bad9570cfbd0d1c114a99` | 2026-10-23 18:28:01 | G45: two PostgreSQL sessions race idempotent same-key and one-unit stock competitors |
| 48 | `dfd98b285c2353e71b2d5106803532739dac78ef` | 2026-10-23 18:27:04 | G45: wire synthetic order reservation and cancellation assertions to PG16 CI |
| 49 | `26d9eea585fb431cc7fdcd92d37fef16e580378f` | 2026-10-23 18:26:51 | G45: PG16 tests durable receipts, 25k Gs server price, double-booking rejection, cancellation restock |
| 50 | `b0cf7f5aad596ec7ba5b1578f3fc25984274c895` | 2026-10-23 18:25:54 | G45: owner-only synthetic buyer order reservation, G42 session + G44 catalog revision locks, replay and cancel receipts |
| 51 | `a34f052627c71b1976dac98e5a9e8ea3b338f377` | 2026-10-23 18:21:06 | G44 QA hygiene: make G39 signature tamper adversarial test deterministic |
| 52 | `cf532e169e58d5f59ab68624efc1ee53e8d59be0` | 2026-10-23 18:19:06 | G44: certify G42 verified JWT iat propagation in legacy Auth contract test |
| 53 | `8a78260a003d9c2386b1e2f06352b24687b05469` | 2026-10-23 18:18:38 | G44: document Buyer catalog contract, version fences, QA and blockers |
| 54 | `3aa69c3e35b480d3247836482097ffcceab487fe` | 2026-10-23 18:18:01 | G44: add valid empty-page tests for Buyer and branch discovery |
| 55 | `90ae458d0c68d914e924e13064ac808326c5675e` | 2026-10-23 18:17:51 | G44: correctly return empty authorized catalog pages without weakening validation |
| 56 | `f6dac2d0ca0a44269b1aec30ee0a2139ca8eedc2` | 2026-10-23 18:17:16 | G44: fix UUID format validator 8-4-4-4-12 for Buyer and cursor |
| 57 | `74a270be6e42678685d54049ba2813209265e9cf` | 2026-10-23 18:15:26 | G44: improve CI assertion diagnostics for cursor and verified session |
| 58 | `c0363c3000bdf885ab2fa68d60460d1565198a46` | 2026-10-23 18:12:14 | G44: preserve provider-verified token iat for in-SQL G42 session fence |
| 59 | `9e4f5bd9825437c21df1912c37dc25894f0b3033` | 2026-10-23 18:11:26 | G44: add disposable PostgreSQL buyer catalog + pagination assertions to CI |
| 60 | `59d3b8ce99f06bda9610cf7a44333a3659d2443a` | 2026-10-23 18:11:14 | G44: normalize OpenAPI version assertion |
| 61 | `91013d36b43c20eefc034fa3f2932821cde188d5` | 2026-10-23 18:10:59 | G44: assert two unwired Buyer OpenAPI GETs and strict DTOs |
| 62 | `f2475d47dd438a8ddedb8ccfcf0d44e1a04ea46b` | 2026-10-23 18:10:33 | G44: publish Buyer branch and catalog OpenAPI contracts (runtime unwired) |
| 63 | `e0f5e8c840f8b34eab4298db0ce6569de9dc6274` | 2026-10-23 18:09:43 | G44: PostgreSQL buyer/catalog 205-row paging, version and privilege assertions |
| 64 | `b2c9aee00136df16beb28ac57cf8397cf8771fec` | 2026-10-23 18:09:02 | G44: adversarial HMAC cursor checks and 13,000-item paginated QA traversal |
| 65 | `d543dc4dd56508137420759fd04dab3cabb05215` | 2026-10-23 18:08:15 | G44: signed buyer pagination and server-side authority boundary (QA off) |
| 66 | `d4edbe9a8ce63226fe9f9f9dbdce51802ceb4946` | 2026-10-23 18:07:05 | G44: correct branch version trigger field dispatch |
| 67 | `0ce4bd6e438ef205c94f0c51a4a48f733cb4ca8c` | 2026-10-23 18:06:31 | G44: add private QA buyer branch and versioned catalog keyset reads |
| 68 | `d39b5ca2d9f8df1dfc8a55bfca50bbdc562f6a49` | 2026-10-23 17:36:22 | G43: document transactional revocation proof, provider limitations and G44 transition |
| 69 | `4058a98d43b4f16f209d75a0134c81724af7ecd3` | 2026-10-23 17:35:26 | G43: test source outages, replay, MFA provenance and DB CAS denial |
| 70 | `0d5059d9feefbcce45fe9506729f321eb3e8419d` | 2026-10-23 17:34:51 | G43: add fail-closed private provider session reconciliation contract (QA only) |
| 71 | `511f708df9e1f950a9a0b8efff07aed9f136eddf` | 2026-10-23 17:31:52 | G43: run transactional session revoke races in disposable PostgreSQL CI |
| 72 | `a3327795a8b1f669aa28bf8d7e23dafb0ffa960a` | 2026-10-23 17:31:33 | G43: verify session revoke-versus-write races in two PG connections |
| 73 | `f1e2a73cf223bf600ef39d2f3a7db17d2fc938a5` | 2026-10-23 17:30:42 | G43: add SQL adversarial session fence assertions |
| 74 | `d26bd116e679fff7f92789c575eeb60560435a80` | 2026-10-23 17:30:04 | G43: add QA-only transaction-held session fence probe |
| 75 | `29e22365c5b7a4e8538abe89578ecfe17bc98481` | 2026-10-23 17:19:36 | docs(mobility): publish Architect A master handoff G0–G42 and executable continuity |
| 76 | `165997ec4a3f353c608d503c9006dc472701a58a` | 2026-10-23 15:50:59 | test(mobility): distinguish valid foreign signed JWT from provider-rejected actor |
| 77 | `3b04690dc9a83b2146ac6e0501ae02f859fd5bc5` | 2026-10-23 15:48:42 | test(mobility): G42 independent provider/JWT/MFA and session revocation adversarial suite |
| 78 | `619948e1944947fe63b3022996062253caf2df4f` | 2026-10-23 15:46:17 | feat(mobility): G42 pinned JWT verification and private PostgreSQL session revocation QA |
| 79 | `f7e277122764a7fdbcfcc766d9ca5e3061009915` | 2026-10-23 15:23:18 | fix(mobility): G41 canonical UUID validation and exclusive Admin fixture |
| 80 | `793a650497b8d0c7bb70637c4cbd62986b2cc047` | 2026-10-23 15:21:04 | feat(mobility): G41 signed filtered Admin incident triage and OpenAPI QA contract |
| 81 | `435135983c2df44d956412a65058069ae0bdf17b` | 2026-10-23 15:17:59 | test(mobility): assert G41 row object size with supported jsonb_object_keys |
| 82 | `20e5ccf42af1b3018855f3d8be69e931e3e718ef` | 2026-10-23 15:17:33 | feat(mobility): G41 PostgreSQL server-side global priority incident triage filters |
| 83 | `9c69ba5753b4d179fb49e4fdd491324e5e8718e1` | 2026-10-23 15:10:11 | fix(mobility): G40 disambiguate immutable incident ID from table column |
| 84 | `bf5f2b3faaeb3e12cbef013ff18260ed74982ba4` | 2026-10-23 15:08:53 | fix(mobility): correct OpenAPI version-test regex escaping |
| 85 | `d8f6fe2af16297e4b12ee2a72a43d879abbe1b60` | 2026-10-23 15:08:34 | fix(mobility): G40 UUID, SQL reserved identifier and versioned OpenAPI error contracts |
| 86 | `841279c5f46fbc3bfc891f05bc3610953643c496` | 2026-10-23 15:05:52 | feat(mobility): G40 typed private incident receipts and owner status QA |
| 87 | `3f0927ed4230574f26699dcd11c08c209c1fa19b` | 2026-10-23 14:59:41 | feat(mobility): G39 Ed25519 private offer attestation verification QA fail-closed |
| 88 | `cdeb943416725950bd18123d2676574bc33c26e3` | 2026-10-23 14:45:03 | test(mobility): seed isolated G38 synthetic noneligible AUTO zone within rollback |
| 89 | `35e3de6e8cfe8ffb49066594d0587c3bdba53c74` | 2026-10-23 14:43:45 | test(mobility): force synthetic coverage ACTIVE while keeping G38 policy denied |
| 90 | `dc7d28cbaf012541ee6dd8159214c7d98e9a24d3` | 2026-10-23 14:42:23 | test(mobility): G38.2 reject forged proof and synthetic GPS despite private offer |
| 91 | `ed2538a6240ffdc7b8870e8e6979317a54c75cff` | 2026-10-23 14:38:45 | fix(mobility): compare G38 AUTO and DELIVERY enum states safely as text |
| 92 | `90b8799dcec776d26f87b02a4427e8232a561850` | 2026-10-23 14:37:26 | test(mobility): respect private AUTO 30s and cargo 45s offer TTL |
| 93 | `564f0a788136b5603aa404aaef29d3677f5795e0` | 2026-10-23 14:37:21 | test(mobility): commit disposable dispute fixture for following G38 acceptance check |
| 94 | `9af01136f11c315938b0cd242560ef8607432c37` | 2026-10-23 14:35:24 | feat(mobility): G38 dispute lifecycle and transactional fail-closed offer fence |
| 95 | `75e3bee1e8d8f3635dede6438149d1c6b2f8529c` | 2026-10-23 14:14:49 | fix(mobility): preserve privileged offer row locks after G37 DML revoke |
| 96 | `d6686f5a6972c973c10836fe49c032fe852dabe8` | 2026-10-23 14:13:14 | feat(mobility): G37 fence trip/delivery DML and preserve private-offer RPC |
| 97 | `346f9dfcbd2fc3a57cb7951c473120bc8571d88d` | 2026-10-23 13:52:56 | docs(handoff): master G0-G36 A/B continuity, proven CI, gaps, risks and uninterrupted G37 roadmap |
| 98 | `5e8fc6ef601f0778a603d7a3b30172aaf51f70bc` | 2026-10-23 13:15:32 | test(g36.4): allow same UUID across independent AUTO and DELIVERY namespaces while preserving unique Driver |
| 99 | `01f2d6273be3aed81d368ece34f31d5790625425` | 2026-10-23 13:15:13 | fix(g36.4): reserve unique Driver globally without falsely colliding UUIDs across independent assignment kinds |
| 100 | `d25ffa586b1914f68ac761047b5757bef0b8a513` | 2026-10-23 13:13:19 | fix(g36.3): use fresh idempotency keys in reverse race regardless of initial winner |
| 101 | `d7d7697ae083049ac9937c8ecf1cf0a2f152500a` | 2026-10-23 13:12:45 | test(g36.3): rerun two-session cross-service race in opposite order, forcing delivery winner |
| 102 | `6f91fe23ed760aab529e7da4d120032ba735da29` | 2026-10-23 13:10:23 | fix(g36): race authorized private offer acceptance G4/G10, not revoked direct G3/G5 shortcuts |
| 103 | `149e1587fa6935bd25fcb3d0dd7d722beca529f4` | 2026-10-23 13:08:51 | docs(g36): explain cross-service driver uniqueness, actual SQL concurrency checks and live blockers |
| 104 | `f6007177aaabf5cc64e804741ff6885d252dd6ba` | 2026-10-23 13:07:26 | fix(g36): inspect private slots only as disposable DB owner after service-role request fixture |
| 105 | `c516100217d854e183f41e06219ee59ead0b9203` | 2026-10-23 13:05:51 | fix(g36): run privileged slot assertions as disposable DB owner without granting service_role slot SELECT |
| 106 | `26396dcab39acb2ac3179ee1af8928b9d68d8f79` | 2026-10-23 13:04:47 | ci(g36.2): run two-session transactional collision between passenger and delivery offers |
| 107 | `2acbd4b4f8720e5ebc5738326294680b67f1da4e` | 2026-10-23 13:03:34 | test(g36): two independent PG connections race AUTO and courier acceptance for one Driver |
| 108 | `47b32b874dae84124a587d6d5a34f9c1a2e109e6` | 2026-10-23 13:01:46 | ci(g36): verify atomic one-Driver cross-service reservation invariant in disposable PostgreSQL |
| 109 | `ffb1eb9382fca6b51c650c8c9a93dfdf20fb4883` | 2026-10-23 13:01:20 | test(g36): real G20 driver cross-service slot contention, release and idempotency in disposable PG |
| 110 | `0e6f8dce868096e16c1bf839e27f0c2502e8b51d` | 2026-10-23 12:59:16 | feat(g36): unique per-Driver cross-service active assignment slots with private transaction triggers |
| 111 | `6ec96fc8e4b91dc0e667a68aad6e0fae684ac13e` | 2026-10-23 12:24:25 | docs(g35): distinguish documentary evidence from dispatch and preserved owner/browser gates |
| 112 | `1232e9c1223feec6e497d2bf78c89e4504111217` | 2026-10-23 12:22:50 | test(g35.1): adversarial Admin JWT MFA documentary readiness, no forged availability or PII |
| 113 | `05590c583fd0953430039a8a14531a3b7ca77c32` | 2026-10-23 12:21:57 | feat(g35.1): private JWT MFA scoped documentary readiness adapter refusing false dispatch/PII |
| 114 | `686d800a9a6f5924c28d3a8f31783214f2261892` | 2026-10-23 12:20:11 | ci(g35): certify private G20/G5 documentary readiness on disposable PostgreSQL |
| 115 | `231e2d06c0451ec91d7c495aee85e0244577a934` | 2026-10-23 12:19:48 | test(g35): exercise real cargo KYC approval, insurance expiry, busy trip, consent revocation and no zone promotion |
| 116 | `327c520286f871df8ca469b235bb26a5ee72e8c4` | 2026-10-23 12:17:45 | feat(g35): private QA documentary readiness for Driver by service, independent of idle/location count |
| 117 | `495f56ad48f413f534ccfe26c67da1ac49eabbd8` | 2026-10-23 12:11:31 | docs(g34): consent revision rollback/race assurance and true integration blockers |
| 118 | `0f4da18efef26e625b0abeac790d0cf61587ce57` | 2026-10-23 12:10:18 | ci(g34): verify consent revision audit and G32 stale-session invalidation in PostgreSQL disposable chain |
| 119 | `a2a59d9c2dbe6bebdb75b3f7a61c7b814a3ed068` | 2026-10-23 12:09:58 | test(g34): consent revision invalidates prior GPS packets after revoke and re-opt-in; audit append-only |
| 120 | `cc7272cfc2abc38f1e9454adf3e54a2e8d8614dd` | 2026-10-23 12:08:50 | feat(g34): version location consent with private audit and fence G32 on current consent revision |
| 121 | `e844e4f0f9d82a75170988d3855737525fdd299c` | 2026-10-23 12:06:46 | docs(g33): bound latest-driver quarantined diagnostics, busy assignment checks and non-publication gates |
| 122 | `8a64deed05419b8a90acf9d661b24cf17633e880` | 2026-10-23 12:05:24 | test(g33.1): AAL2 JWT RBAC scope and fail-closed quarantined-zone diagnostic DTO |
| 123 | `cab29df8cc8c028a783fe6471db2f3976d944796` | 2026-10-23 12:04:35 | feat(g33.1): server-only AAL2 Admin diagnostics for quarantined driver location aggregates |
| 124 | `4c2915cc3d26040b647c05644cbc544127564a2e` | 2026-10-23 12:02:48 | ci(g33): verify quarantined latest-driver aggregation without promoting synthetic availability |
| 125 | `630ca971451deac114f6ce09d756376c3e6477c1` | 2026-10-23 12:02:21 | test(g33): disposable SQL verifies latest zone, busy trips/deliveries, revoked consent and zero availability publishing |
| 126 | `fa41eb1a5da67bf65a4964aad8b4549e6e474ab6` | 2026-10-23 12:00:43 | feat(g33): scoped QA-only diagnostic counts from latest Driver quarantine, consent and active assignment checks |
| 127 | `5614b3acf4c557c5739f48c74b17e72cf0518b1b` | 2026-10-23 11:53:27 | fix(g32.1): validate full five-group UUID for private quarantine RPC |
| 128 | `854936f6dec90e8662f6f533a9e580b5a81311a7` | 2026-10-23 11:52:49 | docs(g32): explain strict Driver GPS QA quarantine, consent race, spoofing limits and no availability promotion |
| 129 | `c5b6c83a1bf7551698bdd9f950ecbb6415021a4a` | 2026-10-23 11:51:21 | ci(g32.2): run two-connection location replay and consent-revoke race in disposable PG |
| 130 | `8c6efe4f96cf722fd6648dccca1ef03413b1666d` | 2026-10-23 11:51:06 | test(g32.2): race two PG Driver events and consent revocation across independent sessions |
| 131 | `c869c6f57381b80a527eae466d8b5a495f4b57da` | 2026-10-23 11:49:56 | fix(g32): serialize consent checks under row lock to fence revocation race |
| 132 | `96f39fb3465a7e9b19d91c0be76f889e57a93c05` | 2026-10-23 11:48:45 | feat(g32.1): strict server-only SQL quarantine adapter with negative tests |
| 133 | `db72c2d3da9f9974e699a5ef79086c7e693700d4` | 2026-10-23 11:48:42 | feat(g32.1): strict server-only SQL quarantine adapter with negative tests |
| 134 | `2e37d41f1cece9e171a9147dc2c7b4658e23c5d0` | 2026-10-23 11:47:49 | ci(g32): run private Driver telemetry quarantine and anti-replay tests in disposable PostgreSQL |
| 135 | `b2ba829a478f05d06da9c17f32ad0f98f8d62c54` | 2026-10-23 11:47:27 | test(g32): adversarial JWT consent GPS geofence spoof, expiry, duplicates and quarantine fail-closed |
| 136 | `d6c208a47d87a91f3b3dd2892c5007c941a8b925` | 2026-10-23 11:45:25 | test(g32): verify atomic Driver sequence fence, replay, consent revocation and no zone count mutation |
| 137 | `09f361cb5df1ca381e424eab9836ee3528f9e073` | 2026-10-23 11:44:26 | feat(g32): private Driver signal quarantine with atomic per-driver sequence fencing and active consent DB check |
| 138 | `e0f4c06f7102dc51fcb8b0e1fee1ae0af5d2a182` | 2026-10-23 11:43:20 | feat(g32): strict Driver GPS QA intake with independently verified consent geofence integrity and quarantine |
| 139 | `675a4c82b704be13c0026c0457738d3038be9a8f` | 2026-10-23 11:29:48 | docs(g31): specify Paraguay zone coverage versus unknown/stale observed telemetry and remaining legal gates |
| 140 | `e73f37d7ddb5db88a16b31014ef57b30624e5c8b` | 2026-10-23 11:28:22 | ci(g31.2): run all 601 keyset pages for 30030 disposable zone-service records |
| 141 | `aa149136245228ba3c0bb97b698fffd553dd385f` | 2026-10-23 11:28:09 | test(g31.2): stress 30030 synthetic zone-service rows through 601 real keyset pages |
| 142 | `ff38f4e5f8bb5a77673b6b0128d1a7891b0a560c` | 2026-10-23 11:26:32 | test(g31): prove 70-second sample is stale and cannot be reported as driver availability |
| 143 | `cb0127421b8f0b964397d26159630840dec470c1` | 2026-10-23 11:26:08 | fix(g31): align observed availability with B 60s freshness and expression-keyset index |
| 144 | `c700215484d4fd28a0db3d2a0863c403c2ee876a` | 2026-10-23 11:25:07 | test(g31): exercise private zones HTTP with unknown telemetry, policy denial and blocked Owner finance |
| 145 | `19aa108fdbddc24e04ed89acab5db35a8c1d9302` | 2026-10-23 11:24:28 | feat(g31): expose source-scoped zone QA read without enabling unverified Owner finance |
| 146 | `c7a715de29f65f905583bc772c06463769e18e72` | 2026-10-23 11:23:53 | test(g31): prove scoped zone read RPC, exact 33-char cursor, no uncertified finance |
| 147 | `fee07154de149e9618edab47ab367729f6324b40` | 2026-10-23 11:23:27 | feat(g31): enable scope-bound zone coverage read adapter with 33-character service-aware keysets |
| 148 | `c51d199f41c9329cb1d29b88ef60f012604a56c2` | 2026-10-23 11:23:04 | ci(g31): certify separate coverage and observed driver telemetry in isolated PG chain |
| 149 | `10eae102fba91e453275c1fc73f123fb34544643` | 2026-10-23 11:22:43 | test(g31): verify 121 zone-service rows, fresh versus stale/unknown counts and RBAC in disposable PG |
| 150 | `6275ee53cb0471198792650b15ba1d36feb2be34` | 2026-10-23 11:21:25 | feat(g31): private zone catalog and observed counts with unobserved sentinel, scoped Admin keyset QA |
| 151 | `76497dd68fdd17b22049a6e577dc89ad9e5cba57` | 2026-10-23 11:11:17 | docs(a05.4): distinguish genuine KYC compliance and partial audit sources from still-blocked Admin scopes |
| 152 | `36adf3d732f505b54ab4bc35b5ac619ee6c30e79` | 2026-10-23 11:10:37 | test(g29.1): prove expired approved-license evidence is not valid until compliance dates pass |
| 153 | `7b92ddfa27c688de1cb77313abc61584e5f22235` | 2026-10-23 11:10:03 | fix(g29.1): never project approved evidence as valid without current G2 compliance dates |
| 154 | `7f773803f6af4cab6f11167415efa047ec213910` | 2026-10-23 11:07:53 | test(g30): locally exercise source-backed Admin audit while preserving Owner zones deny |
| 155 | `61e928315e3729cab7857f57bbe6e13ede5d6b9f` | 2026-10-23 11:07:33 | feat(g30): compose source-backed audit read in isolated private Admin QA |
| 156 | `0499b91f592e2728f6b4d8d5a3438d8ae67dcc5e` | 2026-10-23 11:07:19 | test(g30): verify only scoped Admin audit uses genuine G30 RPC and exact keysets |
| 157 | `ba7737cd24f7996ac3b2fd9d9cbe0d3fcc41c989` | 2026-10-23 11:07:00 | feat(g30): activate read-only source-backed audit subset RPC, keep zones and finance closed |
| 158 | `64ff56926dc2c20964cab5f43333782df2356b96` | 2026-10-23 11:06:42 | ci(g30): certify genuine G2/G8 Admin audit source union and keyset in disposable PostgreSQL |
| 159 | `2a639240be9d8178b64ad8b2bbc7c7e08485e051` | 2026-10-23 11:06:18 | test(g30): audit 123 true source events across keyset pages, deny native Admin and fake cursors |
| 160 | `74d8fa24525aaac12a408e3c6b8a281cde91b8ad` | 2026-10-23 11:05:11 | feat(g30): private source-backed Admin audit projection for incident, suspension and vehicle review events |
| 161 | `f8d3847ec4e266d7dc47258f9d89cecbd5a3ba76` | 2026-10-23 11:03:06 | fix(g29): assert duplicate-free KYC keysets within service-role PL/pgSQL without temp-table grants |
| 162 | `7d38099c3f95d0c9a61877c98dc23eb032d4d9fd` | 2026-10-23 11:02:15 | test(g29): real loopback KYC QA request with trusted role and minimal no-PII DTO |
| 163 | `ecdd918ff714ecae307d00772431fb6cd6a98e20` | 2026-10-23 11:01:50 | feat(g29): expose independently certified AUTO KYC QA route in explicit local composition |
| 164 | `dfc3b4109c67ece48329c2061b362ff43e013cb3` | 2026-10-23 11:01:32 | test(g29): assert correct private KYC RPC, cursor length, and denial of uncertified scopes |
| 165 | `ca95fca7ed54c11b46fd73bc469d178a6004846b` | 2026-10-23 11:01:14 | feat(g29): route authorized KYC reads through genuine G29 SQL, keep zones audit finance denied |
| 166 | `bd747fd6dab8773d4cb84b564e0e1a63af45095f` | 2026-10-23 11:00:48 | ci(g29): test source-backed KYC review queue with G2 revision and G17 documents on disposable PostgreSQL |
| 167 | `8f33d1fd7b1ee0ac891da512c0dabffb0a9c119d` | 2026-10-23 11:00:29 | test(g29): verify 121 real KYC AUTO records, no fabricated MOTO delivery, strict private RBAC |
| 168 | `091e89e3176a466c4bb9c69882eddf7fee661aff` | 2026-10-23 10:59:36 | feat(g29): source-backed private Admin AUTO KYC queue without MOTO passenger misclassification |
| 169 | `b0a22f3d414f34030690b5ed19be98e23c9d52e7` | 2026-10-23 10:50:20 | feat(g28.1): compose JWT MFA role and genuine SQL incident reads in isolated loopback QA |
| 170 | `2bc3a4b7aa0317b7bca7a503a9394958516d156f` | 2026-10-23 10:50:17 | feat(g28.1): compose JWT MFA role and genuine SQL incident reads in isolated loopback QA |
| 171 | `ab9295f93629f4012ba1423bfed12b39ddc1be8c` | 2026-10-23 10:48:41 | docs(g28): record disposable SQL incident paging, authorizations, and outstanding gates |
| 172 | `6d2efc0e064028d9d784b68188834c24cc410a1e` | 2026-10-23 10:47:10 | test(g28): prove JWT MFA RBAC scope SQL adapter through localhost Admin HTTP path |
| 173 | `cf4b3fddafc17eaacc0c49cee77513f64f04d54f` | 2026-10-23 10:46:04 | feat(g28): add private SQL incident read adapter with fail-closed other Admin Owner scopes |
| 174 | `8925bdc6a77d04cb8882a823ba0b3bee1acd9388` | 2026-10-23 10:46:02 | feat(g28): add private SQL incident read adapter with fail-closed other Admin Owner scopes |
| 175 | `1f34f27bb42d67d7983cee3305aef7dc5dd3649e` | 2026-10-23 10:45:22 | ci(g28): test G7 G8 real disposable schema plus G28 authorized incident keyset |
| 176 | `9961c01bc546b1e0c744cd7fefec1888a2f28d9a` | 2026-10-23 10:45:02 | test(g28): verify 121 real PostgreSQL incident rows paged, role isolation, fake cursor denial |
| 177 | `2fda8debdb054d0552f15bccc9c856b39a13e376` | 2026-10-23 10:44:00 | feat(g28): private real PostgreSQL incident keyset query for scoped Admin QA |
| 178 | `3366482c59729aafdabd18241c7611cae8bc0966` | 2026-10-23 10:25:56 | docs(g27): record independent Admin Owner SQL authority, MFA gates and A/B handoff |
| 179 | `849b3255ddc8b132ad21cf2a55a869e7c41dcbba` | 2026-10-23 10:25:15 | test(g27): fail-closed backend role authority and permission lookups |
| 180 | `ca57c0f436df259039183449778783ddf9531c17` | 2026-10-23 10:25:12 | feat(g27): server-only backend adapter for isolated Admin Owner roles and scoped reads |
| 181 | `4a7ab4a3ce08f30e544dce69b703e326689faff8` | 2026-10-23 10:24:32 | ci(g27): exercise private Admin Owner role table and scope isolation on disposable PostgreSQL |
| 182 | `2b41c998163cee6d0463053f3b53a5dd2d2c41e0` | 2026-10-23 10:24:19 | feat(g27): isolated disposable SQL backoffice role registry, least privilege and separation assertions |
| 183 | `69fe316b36ad91692ffdd8eeb386fd2a769db245` | 2026-10-23 10:24:16 | feat(g27): isolated disposable SQL backoffice role registry, least privilege and separation assertions |
| 184 | `d848299b126dfbd6cccdddad4f1d9ad168e84e62` | 2026-10-23 10:21:27 | fix(a05): preserve G11 catalog version and default errors required by existing CI |
| 185 | `78044bfe46b5c3ff94818b1ee441a141b581f70c` | 2026-10-23 10:20:52 | test(a05.2): align malformed cursor HTTP expectation with gateway 400 |
| 186 | `808fc65cef0fbba6da6045535ee7991e76d36353` | 2026-10-23 10:20:41 | test(a05.2): verify real localhost HTTP Admin pagination CORS rejection and strict no-store |
| 187 | `10af970043f6877cde5761e27723a13a3089c98e` | 2026-10-23 10:20:38 | feat(a05.2): add local-only safe HTTP read transport for Admin Owner QA |
| 188 | `edb998d957c597933a5a0f9da6ad727e6922d854` | 2026-10-23 10:19:22 | docs(a05): document scoped Admin Owner QA read contracts and remaining integration gates |
| 189 | `e1753de8cb5eb3a1039a45edc429dfea34678d1c` | 2026-10-23 10:19:19 | test(a05): verify Admin Owner OpenAPI safety exact DTO scopes and unlimited cursor pages |
| 190 | `9515098aa5772e3ec22d334f05b33f854a59c350` | 2026-10-23 10:17:59 | docs(a05): define five strictly typed unmounted Admin Owner read-only OpenAPI QA contracts |
| 191 | `d8fddcba37267f2fe7286a39de4bc50b79f3c2c1` | 2026-10-23 10:17:22 | test(a05): give rotated session a valid MFA proof before checking signed cursor binding |
| 192 | `57ba4ea54490f2c4aa4add18afe3044b3e84a6ce` | 2026-10-23 10:16:01 | test(a05): adversarial Admin Owner pagination RBAC MFA HMAC and strict DTO fixtures |
| 193 | `d3335e48eeaeab5e5c6a6ad83827db17e34e1830` | 2026-10-23 10:14:14 | feat(a05): add fail-closed scoped Admin Owner read gateway with signed keyset cursors |
| 194 | `f10f06befe711efff295a14d11e7a049ed8508d3` | 2026-10-23 10:08:58 | feat(a04.1): backoffice QA session gate with exclusive roles and provider-bound MFA |
| 195 | `0e97384d7a6cf09ec731cfb79d9673ce0bf9446c` | 2026-10-23 10:04:23 | feat(a03): enforce independent history HMAC keyring with safe v1 rotation |
| 196 | `059063a03dda95be054a28109c414e8a2946b229` | 2026-10-23 10:00:55 | test(g26.5): reproduce PostgreSQL MVCC late-commit gaps and document refresh consistency |
| 197 | `04f68222194b6b87d507323d4a4b9652c393c243` | 2026-10-23 09:54:12 | docs(handoff): publish complete A/B G0-G26.4 master transfer, verified CI, issues and no-pause roadmap |
| 198 | `95986b58db110e4fbfd7d364c83ab61935f83c00` | 2026-10-23 09:34:39 | docs(mobility): record verified G26.4 origin immutability, 15 denied attacks and remaining MVCC caveat |
| 199 | `aaa97650bae5a94605f6933f6c5e257b1bd25ad5` | 2026-10-23 09:32:51 | ci(postgres): assert immutable historic owner, time, IDs and 3 valid lifecycle writes in disposable G26.4 |
| 200 | `eeb5e8eb931bb231c2e2aaee0b479e583a10a882` | 2026-10-23 09:32:35 | test(postgres): prove 15 historic-origin attacks rejected while valid lifecycle writes survive |
| 201 | `e4a9d34df9cd29ad11ed6c774d3725a74f2d36b1` | 2026-10-23 09:31:39 | feat(postgres): G26.4 guard immutable history owner, timestamp and request identity in disposable QA |
| 202 | `8246aea4daadd477cde8f1c81a31f47c3c4dba9b` | 2026-10-23 09:26:54 | docs(mobility): certify 31200-row disposable PostgreSQL plus full HTTP history QA and caveats |
| 203 | `650b0794b21ac0e65d721da34f3983d59272b554` | 2026-10-23 09:25:13 | ci(postgres): require 31,200 historic records across 624 pages in disposable chain |
| 204 | `aafed26daf1e88847b97aa4f035d023baec6ca1c` | 2026-10-23 09:24:58 | test(postgres): G26.3 31,200-row unbounded real PostgreSQL keyset stress |
| 205 | `a8624d713f2a7df428319d1a45c156545e74958c` | 2026-10-23 09:23:45 | test(mobility): count all 24 HTTP keyset pages and foreign scoped query correctly |
| 206 | `771aaac3b8178e927eefef48b36fd05a06b98d40` | 2026-10-23 09:22:17 | test(mobility): G26 end-to-end loopback 1200 history records, 24 signed pages and privacy |
| 207 | `6c067e2f0dfefcfe304522b39290f0f631d719c6` | 2026-10-23 08:35:56 | docs(mobility): record G26.2 real ephemeral indexes, RLS and 1200-row QA evidence |
| 208 | `560361e64e1ae0bafd573c2245b5762d8feb7cef` | 2026-10-23 08:34:11 | test(postgres): verify every G26 covering keyset index is eligible in real query plans |
| 209 | `3ce864efa42a5c653a1f087d80e228569e69c597` | 2026-10-23 08:31:45 | ci(postgres): run real G3/G5/G6 G26 history index, 1200-page loop and RLS in ephemeral chain |
| 210 | `35db6fa24f525a5d9cb4aaea17e68540be890b4e` | 2026-10-23 08:31:13 | test(postgres): 1200 synthetic historical records, 24 keyset pages, indexes and real RLS |
| 211 | `50211879039687e3bff67f4d74f3132fe9ca37cd` | 2026-10-23 08:30:16 | feat(postgres): owner-scoped DESC keyset covering indexes for unlimited G26 history |
| 212 | `a39912d42cd852c5d54dfb540c146ba324c3cebe` | 2026-10-23 08:03:36 | docs(mobility): replace obsolete 50-total history limit with unlimited signed page continuation |
| 213 | `df733d82f6871acd98ee82451dbcc5a6e98537ee` | 2026-10-23 08:02:14 | test(mobility): align tie-break expectation with descending UUID history order |
| 214 | `15f69f79400990e46985d1ff8fdf9303a15266b9` | 2026-10-23 08:01:39 | fix(mobility): restore full 8-4-4-4-12 UUID guard for JWT and signed history cursor |
| 215 | `33504cbd60b5077c3f9cefda306b1aa611458e82` | 2026-10-23 08:00:19 | test(api): ensure nextCursor enables unlimited historic retrieval |
| 216 | `abccc985c7088f52e2adec4cfce921d13e6c1fa0` | 2026-10-23 08:00:06 | docs(api): remove 50-record history ceiling and define signed unlimited keyset pagination |
| 217 | `535746c95cb0501fdfd0a1f3a0bd8f9948524b27` | 2026-10-23 07:59:22 | test(mobility): keep private G26 loopback test compatible with signed pages |
| 218 | `ee3f4adef4a58dd49b3cf168bb2a16d0fec50c73` | 2026-10-23 07:59:01 | test(mobility): retrieve all 1200 history rows over 24 keyset pages, no missing data |
| 219 | `f7e45aa7297735489c28beb59fe0e8dbb3f48832` | 2026-10-23 07:58:07 | test(mobility): signed history continuation, tamper, owner isolation and expiry |
| 220 | `621b26c8e902917a406b12ca9c74fd4727892bf3` | 2026-10-23 07:57:17 | fix(mobility): compact signed keyset token within 200-character Client cursor contract |
| 221 | `781268ce982945e165a58c549039e52029edcdc6` | 2026-10-23 07:56:37 | feat(mobility): sign pagination cursor with private STAGING server key material |
| 222 | `4ae887fab46903c9875d06876edfeb5b0485253b` | 2026-10-23 07:56:22 | feat(mobility): signed subject-bound history continuation with no total record ceiling |
| 223 | `24a24c1b6134bfaf7153ce37ae8313d275954d53` | 2026-10-23 07:55:18 | feat(mobility): replace total-history cap with stable keyset continuation across all services |
| 224 | `474a95d7c342ff943b056e97f9428b47f82cbc0e` | 2026-10-23 03:48:46 | fix(mobility): correct strict 8-4-4-4-12 UUID guard in G26 history |
| 225 | `11333b893ab7997e19ff0de76e05c7d2e06a9f18` | 2026-10-23 03:48:00 | docs(mobility): G24–G26 QA contracts, limitations and Architect B coordination |
| 226 | `55a0591f4fe110b9fade6953b0cc1284b6e596cd` | 2026-10-23 03:46:43 | test(mobility): G26 real loopback HTTP owner-only history and no-store headers |
| 227 | `78e3a6f959d4120e4946fd76b812e15856f4b24f` | 2026-10-23 03:46:02 | test(mobility): enforce OpenAPI Client quote cancel history contracts |
| 228 | `4a788856701d9dd925300f169ecedf579fdab6aa` | 2026-10-23 03:45:37 | docs(api): publish G26 first-page private Cliente history contract |
| 229 | `d5eb7dc71f951bf99e9c09df8851e5544a75ea2b` | 2026-10-23 03:45:09 | feat(mobility): route JWT-bound rider history over loopback-only HTTP |
| 230 | `4e9dab55201f063c69211835494a7485ed874718` | 2026-10-23 03:44:49 | feat(mobility): wire G26 owner-only history to trusted STAGING server |
| 231 | `7f5c760521c82d355c1e4a082c2a74ddcee4a7e3` | 2026-10-23 03:44:24 | test(mobility): G26 scoped DB history mapper, ordering and fail-closed gaps |
| 232 | `3b5f7c5debd043968356ceddffb91106aac39db0` | 2026-10-23 03:43:56 | test(mobility): G26 JWT/RLS boundary and history DTO privacy |
| 233 | `81d337120392b86dfeadda1dbb5651bd85d4fa58` | 2026-10-23 03:43:28 | feat(mobility): provide fail-closed G26 owner-only history DTO |
| 234 | `540dfdce224f69ac3572697d24e2cbd996aeba18` | 2026-10-23 03:42:58 | feat(mobility): add server-only owner-scoped read repository for QA history |
| 235 | `ad6614409f9eb636dbca3c2172f7d43462b7abab` | 2026-10-23 03:39:20 | fix(mobility): use injected trusted clock for G24 quote TTL in runtime |
| 236 | `7a40a25ea6294f632c986f1c8e71f83b26c1eb34` | 2026-10-23 03:38:19 | test(mobility): loopback passenger-only cancellation and HTTP privacy |
| 237 | `930814995a559c6b745d2601939823149568ed2c` | 2026-10-23 03:37:49 | docs(api): add isolated passenger cancel idempotency and error contract |
| 238 | `5c5c38ab0ac2838852f07d0906f5789e53968626` | 2026-10-23 03:37:16 | test(mobility): cancellation auth, idempotency key and cross-owner denial |
| 239 | `3316284b39174fffe0004bd5c808272cac564d5f` | 2026-10-23 03:36:54 | feat(mobility): route private passenger cancel via existing atomic G3 transition |
| 240 | `95b94291ac25b31ca399e12bc731fa44abf80faf` | 2026-10-23 03:36:41 | feat(mobility): JWT-bound idempotent passenger ride cancellation alias |
| 241 | `90e4769131a8dda55e69742eeafb52f2277eabf6` | 2026-10-23 03:35:37 | test(mobility): align synthetic quote expiry to injected CI clock |
| 242 | `8cf6bb3d07920acc8a97d265d8f847171fe5875f` | 2026-10-23 03:34:04 | docs(api): publish typed fare quote G24 for separate Cliente app |
| 243 | `b4a103ed0f31e2272b1f27f8cf7f5cce1a41a195` | 2026-10-23 03:33:31 | test(mobility): verify G24 Client quote DTO and malformed receipt denial |
| 244 | `a7912a9f7f2e7c091a9d1776cc82409984e47c8c` | 2026-10-23 03:33:04 | feat(mobility): produce server-verified quote DTO for Cliente without MOTO rides |
| 245 | `913ce0d65db8e92a8165a64926456bf4f4957f75` | 2026-10-23 03:09:31 | docs(api): version JWT-bound rider status v1 DTO for separate Client app |
| 246 | `2a87d6216d42fb41e722eb3482509934f68a36d0` | 2026-10-23 03:08:41 | test(mobility): adversarial Client status DTO privacy and expiry contract |
| 247 | `d55a7d395c30e76c1b02b806dfd6dea4a06f4b63` | 2026-10-23 03:08:22 | feat(mobility): expose JWT-bound Client status v1 DTO from G4 authoritative snapshot |
| 248 | `4f38a77eb894cd04763ae10f98709c3e42584929` | 2026-10-23 03:05:07 | ci(mobility): certify isolated Admin web build on Architect B PR |
| 249 | `9653adbabbba0569522dc7de1efd0379efb3df7e` | 2026-10-23 02:59:47 | Handoff maestro integral G22: continuidad Backend + Driver, Architect B boundaries, CI, all gates G0-G22 and outstanding work |
| 250 | `3b25d8a7350f19440675dfeedd3c3282702903c2` | 2026-10-23 02:59:44 | Handoff: cross-reference contemporaneous A continuity acts without changing code or ownership |
| 251 | `17ddf2bf8e6e838dfe84c6593be7284bef910f33` | 2026-10-23 02:58:30 | Docs: restore Markdown inline code, fences and paste-ready prompt in integral G0-G22 handoff |
| 252 | `613b9da603a898d1493fe3ccf1a65e11e8af68fd` | 2026-10-23 02:58:06 | Handoff maestro integral G0-G22: completed architecture, CI evidence, blockers, dual architects and next steps |
| 253 | `f5a9926675ead0f38440fb3eb443197f15fa5198` | 2026-10-23 02:56:43 | Handoff maestro A G0-G22: auditoria integral, estado A/B, CI, bloqueos y ruta exacta de continuidad |
| 254 | `ed21bb895a2d2c94b823d1b0a36d7ba67b967656` | 2026-10-23 02:56:36 | Handoff maestro A: inventory G0-G22, CI, parallel architect B, risks, blockers and actionable roadmap |
| 255 | `29885d1c2b3c4b8c831bb27e160df6d1f3d25a12` | 2026-10-23 02:08:50 | Driver G22: integration-test SDK session bridge with G21 authenticated offers and KYC lifecycle |
| 256 | `c9e3b264127f439b631952494e2fb239d4c6b392` | 2026-10-23 02:07:04 | Architect A: G21/G22 Driver session UI, Auth SDK bridge, privacy tests and honest activation blockers |
| 257 | `d73145dfe92a0135fc223252dcff46fb713b89ce` | 2026-10-23 02:04:56 | Driver G22: type SDK-only verification bridge and auth-change subscriptions |
| 258 | `720ae362cc095d6c7a455f913866c5446c8f3f86` | 2026-10-23 02:04:29 | Driver G22: test SDK token verification, server role, no credentials, account swaps and auth signals |
| 259 | `4b403d9518fdeeaa159a92c8a596e8b09cb1b9d1` | 2026-10-23 02:03:39 | Driver G22: prepare independent verified Auth SDK bridge with server-side role check, no bundled credentials |
| 260 | `9003908adc8f6c555368d14b9f2d8bad91f1142e` | 2026-10-23 02:01:16 | Driver G21: connect private AUTO/delivery QA inbox with expiry timer and secure session fallback |
| 261 | `6ea704b4c714a1b4a6c85a6f42fdaa5b35f04232` | 2026-10-23 02:00:39 | Driver G21: connect private KYC review statuses to document screen without enabling uploads |
| 262 | `414a2f088c54fba450db19fa63a7a90035efb0d6` | 2026-10-23 02:00:10 | Driver G21: show honest authenticated workspace and KYC state on standalone Driver home |
| 263 | `a916ffb5cde730d88ffe064bcde32467bbab1467` | 2026-10-23 01:59:32 | Driver G21: mount shared JWT-scoped workspace provider in independent Expo Driver layout |
| 264 | `0c53c02d47fbdbfdf32d855a0331bc46c822f747` | 2026-10-23 01:59:15 | Driver G21: add one Auth-scoped React workspace provider shared by Driver-only screens |
| 265 | `dd8705b3621caa6fb90e7290ea39a813cb72a59e` | 2026-10-23 01:58:48 | Driver G21: type ephemeral Auth adapter and safe read-only workspace snapshots |
| 266 | `7d9e803f1278ca84b63a351a3ffbb7058b9cbaa0` | 2026-10-23 01:58:06 | Driver G21: test atomically scoped session, logout races, stale offers, Auth failures and private snapshots |
| 267 | `8169382133da15a9552aab6b7aacba6b16b0ff6f` | 2026-10-23 01:57:09 | Driver G21: orchestrate JWT-scoped offers, KYC and documents with atomic session invalidation |
| 268 | `93e07cfe604ef84737d717453fbc2fcb214e96a3` | 2026-10-23 01:44:35 | Docs G20: current approved license fencing for AUTO/courier offers, private readiness and remaining gates |
| 269 | `c1d6fe6371bef6aec335ff97321324f35586ff38` | 2026-10-23 01:43:23 | G20: fix canonical 8-4-4-4-12 Driver UUID checks revealed by Node CI |
| 270 | `fda88978a1e4ebbb94b9051c20343723d5d2452c` | 2026-10-23 01:43:20 | G20: fix canonical 8-4-4-4-12 Driver UUID checks revealed by Node CI |
| 271 | `606bc445b888145dfed3b5b62684be65ce5b2a34` | 2026-10-23 01:42:38 | Driver G20: verify role-safe localhost license readiness and privacy |
| 272 | `8853e695c8274a962650dab9321bc9a47fa49415` | 2026-10-23 01:42:35 | Driver G20: type KYC readiness for independent Driver app |
| 273 | `f6ce8106c7287ceedc44de336094398520b5798b` | 2026-10-23 01:42:32 | Driver G20: add read-only scoped license review client |
| 274 | `31d0b13cb1e4aef1130b70e63af7537d388927f6` | 2026-10-23 01:41:38 | G20: require Driver current-license readiness route in OpenAPI coverage |
| 275 | `c6897568b8dc87b719eb3fd0462a6085a511b71a` | 2026-10-23 01:41:28 | G20: document JWT-only current license readiness endpoint in staging OpenAPI |
| 276 | `8a3fe1f680f490a7922304a228e1301dedc98f10` | 2026-10-23 01:41:11 | G20: test localhost private license-readiness routing and CORS |
| 277 | `b9992a4ef3aeff93fd8e577c70e79f0c26d7ddd9` | 2026-10-23 01:41:08 | G20: test JWT license status and strictly typed service RPC |
| 278 | `0bb9fd8ca60d5decc3cd183e15a88053d27896df` | 2026-10-23 01:40:21 | G20: bind JWT-verified Driver license-readiness RPC into isolated runtime |
| 279 | `a4b745c8448a2ba3b8550c30f6923036f7eb37fe` | 2026-10-23 01:40:06 | G20: expose sanitized read-only KYC check on private localhost Driver route |
| 280 | `6dbb7a8effc7ab9650d9418bfaed64f0254dee27` | 2026-10-23 01:39:40 | G20: JWT driver-only current license review endpoint |
| 281 | `4a9461472784fbc0efa1247d3ddf374095814035` | 2026-10-23 01:39:36 | G20: read-only current reviewed license service RPC |
| 282 | `1b5a17cad612440b0dfb4428ec202ebdb5e8682e` | 2026-10-23 01:38:22 | G20: respect existing one-active-driver transaction invariant by cancelling prior synthetic ride |
| 283 | `a72aac4601f846b732487069d7eae8b3b537e7f9` | 2026-10-23 01:36:51 | G20 CI: honor G1 default passenger role trigger and assert exactly one role |
| 284 | `c555288e2f47b5c2f22265587c29177eca2493af` | 2026-10-23 01:35:44 | CI G20: enforce current reviewed license in real AUTO and courier PostgreSQL acceptance |
| 285 | `9c11e94bd803871a744f1dc93cf3dba1473d0ad1` | 2026-10-23 01:35:26 | G20: test cargo pending-license rejection and accepted-only-after-review with separate delivery |
| 286 | `a133dbf64b842b8c16e6d00eb37e98616dce2bb6` | 2026-10-23 01:34:53 | G20: assert latest-license revocation, AUTO acceptance fencing, cargo eligibility and expired G2 license |
| 287 | `b2551204bd97ba572cf5a1f03746528d78c2d1c4` | 2026-10-23 01:33:27 | G20: gate AUTO rides and courier dispatch by most recent verified license review |
| 288 | `df567959a777a75e155dd98d0f504961a57b48da` | 2026-10-23 01:18:45 | Docs G19: record trusted Storage version/scan contract, fail-closed runtime and pending dependencies |
| 289 | `77705fbfaf5685132d0f42c96452c43fcb2e0043` | 2026-10-23 01:16:19 | G19: integrate scanned immutable Storage observation with G17 pending-only JWT gateway |
| 290 | `2032241d4b5601708c18f5db060380255f372f6f` | 2026-10-23 01:15:25 | G17 CI: reject unsupported document kinds and assert immutable owner/hash/path columns |
| 291 | `74e19e72d0c136e238b021de6671a1b75275aa70` | 2026-10-23 01:15:07 | G17 gateway: refuse document categories without a reviewed private storage upload policy |
| 292 | `62aeb41e35784df267a4694693c76f41b65c6987` | 2026-10-23 01:14:49 | G17 hardening: only currently authorized license category; restrict evidence row updates to review columns |
| 293 | `dc4a911028b647522bd572ff0edf7bc640d9a5e5` | 2026-10-23 01:14:06 | G19: wire trusted private evidence observer behind injected scanner; remove unchecked observation override |
| 294 | `92bf8048caa54fb087aa32b3156db3c21e5ffaee` | 2026-10-23 01:13:02 | G19: test synthetic private bucket ownership, version fencing, actual bytes and external scanner veto |
| 295 | `c31afd38f29e155c6b8fcdb7fee5d536b80e737a` | 2026-10-23 01:12:09 | G19: add trusted version-pinned private Storage observation and fail-closed scanner adapter |
| 296 | `cf9bb75f6f1401ab4ba9ba635418a67e9f4d2f23` | 2026-10-23 01:00:27 | Architect A: document G17/G18 private Driver identity, storage safeguards, CI and honest remaining gates |
| 297 | `feb7a6baca12af78b6baf426abab820c88830820` | 2026-10-23 00:59:13 | Driver: type safe explicit-consent enrollment contract for independent mobile app |
| 298 | `68bd639c0debdaf16926352756d6a5b8a7e75783` | 2026-10-23 00:59:01 | Driver: test consent-first QA onboarding, token security, blocked account and idempotent retries |
| 299 | `04e7787993bd65b9bf0e2d79ed3ee7447a2efdae` | 2026-10-23 00:58:32 | Driver: explicit JWT-bound Driver-only enrollment client with no automatic or LIVE activation |
| 300 | `bef68c76c1962b99b315da6ac3cb306d1a55cc68` | 2026-10-23 00:57:43 | G18: end-to-end loopback HTTP Driver consent, Auth, privacy and fail-closed role conversion tests |
| 301 | `91ea7cc19200469e4a41257396861b709aa5d900` | 2026-10-23 00:57:05 | G18: require exclusive Driver enrollment route in OpenAPI regression tests |
| 302 | `a2a5e73b35f8e21e33ef38fff9a62e8159a9e6b9` | 2026-10-23 00:56:55 | G18: publish JWT-bound exclusive Driver registration contract in staging OpenAPI |
| 303 | `8f16cd81c3c2d746f33b9b9e16d780722366ff78` | 2026-10-23 00:56:38 | G18: connect JWT-verified exclusive Driver enrollment to isolated runtime |
| 304 | `ca5a117706418c601a6af097a5276140b4cee42a` | 2026-10-23 00:56:23 | G18: route exclusive Driver enrollment through localhost HTTP with fail-closed default |
| 305 | `ade8fe8b7681a2844643302359475be6ccfe2238` | 2026-10-23 00:55:52 | G18: test consented Driver onboarding, JWT role enforcement, no auto-approval and RPC idempotency |
| 306 | `9653732b944887669e235aeb48a4575f020f3382` | 2026-10-23 00:55:08 | G18: seed clean passenger role after G16 stranger fixture deliberately stripped its default role |
| 307 | `387118747625862c205ec5e2a304eaa82ffcf5db` | 2026-10-23 00:54:22 | G18: service-only role conversion repository with stable enrollment key |
| 308 | `764829a1677fdfddee936b953f23d23479273a73` | 2026-10-23 00:54:06 | G18: add JWT confirmed and role-scoped Driver onboarding gateway without LIVE eligibility |
| 309 | `95e718a30d3e74df4b82d9c631465748195596b8` | 2026-10-23 00:53:07 | CI: test G18 auditable single-role Driver onboarding on disposable PostgreSQL |
| 310 | `576533f800a04b57b3619482f3413657b6058ce1` | 2026-10-23 00:52:51 | G18: verify consent, atomic role conversion, idempotency, immutable audit and no fake eligibility |
| 311 | `038f049bab523813f51f6b6a52e8017834385839` | 2026-10-23 00:52:05 | G18: controlled exclusive Driver enrollment with immutable audit and passenger-history safety |
| 312 | `0db12c31d1897848426487a5aeae99111e131863` | 2026-10-23 00:49:29 | Driver: provide typed private KYC status read-only interface for mobile integration |
| 313 | `9888a2bf77f8598147b908a62c1e196725cfee9f` | 2026-10-23 00:49:16 | Driver: test private document status isolation, revocation, offline and PII rejection |
| 314 | `b5d30d80a69ccd7a71e4fe8a19be2199734fa314` | 2026-10-23 00:48:47 | Driver: add local-only JWT private document-status client with no PII/object paths |
| 315 | `f9230e6518de883bdc2517ac2fd15df4c8ef9978` | 2026-10-23 00:47:33 | G17: test real localhost Driver KYC and admin review routes, Auth, privacy and CORS blocking |
| 316 | `05497af4048954844462f0acb668616b83c861e4` | 2026-10-23 00:46:38 | G17: enforce Driver/private-doc and admin-review route coverage in OpenAPI tests |
| 317 | `3458401c3127b288e0be9ffdc9a654b9c138e302` | 2026-10-23 00:46:25 | G17: publish private Driver documents and admin review OpenAPI contracts |
| 318 | `c0b8c97d5986158acef544fa6e190ceb041424d9` | 2026-10-23 00:45:22 | G17: connect private documents and exclusive admin review to local staging runtime (upload fail-closed) |
| 319 | `bdc8cf5b35b9e21eccd608f74247691d742c0741` | 2026-10-23 00:44:44 | G17: isolate private Driver document read/observe and admin review routes on loopback |
| 320 | `88e0a263ac056c34b425fcd7ac254c73a39bc343` | 2026-10-23 00:43:33 | G17: regression tests for JWT, private storage attestation, Driver-only status and admin audit |
| 321 | `4f753a007618ec3abc14ee44ecf6a836e2d60fc2` | 2026-10-23 00:42:29 | G17: JWT-gated private Driver document status/observation and admin review gateway |
| 322 | `10ae25157f2bfcd7a0e58ce37277fbca3dfad644` | 2026-10-23 00:41:32 | G17: service-only KYC metadata repository with sanitized status, observed file and review RPCs |
| 323 | `760286ab6ff2aabae25f2dcc57ade25769896056` | 2026-10-23 00:40:06 | CI: execute G17 private Driver document audit on full disposable G1-G17 database |
| 324 | `938c2816757082dd99571cdfdd90ae9c3ebbbad6` | 2026-10-23 00:39:51 | G17: integration tests for private evidence, exactly-one Driver role, immutable review and idempotency |
| 325 | `524cc92db929361bbee05f268409014dbf3ce49f` | 2026-10-23 00:38:59 | G17: use unambiguous literal-dot regex for private object keys |
| 326 | `506968ebfb8b9d1975b638bffce2c2fe1b95f3be` | 2026-10-23 00:38:28 | G17: create service-only private Driver evidence manifest and immutable administrator review audit |
| 327 | `67ef168e77e2de5747cd3506e812f5ab70406ad8` | 2026-10-23 00:32:50 | Docs A: record G16 unified private Driver inbox, role isolation, QA evidence and next integration gates |
| 328 | `4f65a2df196fe47666b1d09f9c5cb5780c1c8411` | 2026-10-23 00:31:19 | G15/G16: require exactly one persisted Driver role for private offer polling |
| 329 | `e6f112475e6657d7ad77aebff6affc6963bd7749` | 2026-10-23 00:31:16 | G15/G16: require exactly one persisted Driver role for private offer polling |
| 330 | `1d460769c5fca0e322c0f576cd0607dd622ec20e` | 2026-10-23 00:30:56 | QA: ensure competing second courier is Driver-only before running race |
| 331 | `6a9cf1bb8ab51664bdd96b8a7d3029004e3b2f87` | 2026-10-23 00:30:45 | QA: ensure synthetic courier and reviewer have exclusive Driver/Admin roles |
| 332 | `d07916b22a41b1ff1cb51642a2acb62ccbc8a34d` | 2026-10-23 00:29:22 | Driver: type safe AUTO and delivery accept-decline contract with stable requestKey |
| 333 | `754b06eb066a2d7c2843c9bb1de7ba74e283aae1` | 2026-10-23 00:29:10 | Driver: test isolated AUTO/delivery decisions, retry idempotency and denied/uncertain outcomes |
| 334 | `e32f9fa28c9f9f00c6a563b2235b82826c1b4d54` | 2026-10-23 00:28:31 | Driver: add QA-only JWT private AUTO/delivery accept-decline adapter with stable idempotency keys |
| 335 | `a676a37afe925b26d9d3bacadc2303e54f045c23` | 2026-10-23 00:25:50 | Driver: type protected Auth session refresh and account switch contract |
| 336 | `948c379f9e5972c907247421ed9735e3900474a6` | 2026-10-23 00:25:29 | Driver: test account switch, token expiry and no cross-user inbox cache |
| 337 | `776027df003382ae3f30a84b068d6b40011db019` | 2026-10-23 00:25:01 | Driver: isolate JWT-scoped offer refresh and invalidate stale cross-account snapshots |
| 338 | `c4e338b9006e535a1405ab5fb4053f362f878fdf` | 2026-10-23 00:23:21 | G16: make synthetic Auth fixture replace G1 default passenger role before Driver preflight |
| 339 | `33d462dae53c45a566f0fa1b2a02d65897814eb4` | 2026-10-23 00:22:39 | Driver: publish typed read-only G16 private inbox contract for Expo integration |
| 340 | `ebd5ee01e8a8fe6c178bb593979478b05ab12d48` | 2026-10-23 00:22:10 | Driver: test fail-closed read-only AUTO/delivery inbox, offline and privacy |
| 341 | `da8f2792a1ea77954fef0ce78b2cc6f22db6c201` | 2026-10-23 00:21:41 | Driver: add safe read-only private AUTO/delivery offer inbox adapter for local QA |
| 342 | `8209ac9019192bc27190c8f581d131ad4abd2bbc` | 2026-10-23 00:20:55 | G16: verify localhost HTTP driver inbox JWT, privacy, fail-closed routing and no GPS/push claims |
| 343 | `dc9bff2b9dda8782b14c5012a89e71ffb9840c56` | 2026-10-23 00:20:26 | G16: require unified Driver inbox route in OpenAPI and runtime contract tests |
| 344 | `70637dd0d86cca520610256e880d8304901004a5` | 2026-10-23 00:20:10 | G16: publish unified Driver inbox GET contract in staging OpenAPI |
| 345 | `5e66aca6b647d5691531d397f533fc58e542cfba` | 2026-10-23 00:19:51 | G16: wire unified AUTO/courier inbox into verified staging runtime |
| 346 | `4181dd20a9c4f7e67f0f68c91ffe836aacf508d0` | 2026-10-23 00:19:36 | G16: route private Driver inbox through locked-down loopback HTTP transport |
| 347 | `8ff8158a657c31495401bade8b873072333b0048` | 2026-10-23 00:19:12 | G16: test unified private Driver inbox Auth, roles, expiry, privacy and downtime |
| 348 | `f186ee8fea62f8075a58157d162763ce71eb82a9` | 2026-10-23 00:18:28 | G16: JWT-gated Driver unified inbox for AUTO and courier offers |
| 349 | `360d97a7c13db2c5c2dc6392f83bce065592f845` | 2026-10-23 00:18:03 | G16: service-only unified AUTO and delivery private Driver inbox repository |
| 350 | `052c91ca2ed4c10c4a54a39d8d557c50e28f8c4f` | 2026-10-23 00:17:29 | CI: run G16 private AUTO discovery on full PostgreSQL 16 migration chain |
| 351 | `231c5b6af36a1746996d276714a302ae15b78bae` | 2026-10-23 00:17:15 | G16: verify private AUTO inbox, RLS, push-independent discovery and expiry on real disposable PostgreSQL |
| 352 | `99364497c44094ad48e11ad2086075fa34b9bcd4` | 2026-10-23 00:16:17 | G16: add private AUTO driver offer polling fallback to disconnected push |
| 353 | `cd92bfae9bda0e3d29213d0d1684f01cf3744ef9` | 2026-10-23 00:04:22 | CI: block Architect B PR changes outside independent Client/Admin ownership paths |
| 354 | `3d0f3ac94c1864bd2d18972d4cc1bb15cc4ed735` | 2026-10-23 00:03:46 | Governance: split Movete Fácil delivery across non-overlapping architects A/B with exhaustive handoff |
| 355 | `6fac68e82a991fa93ae22fea3692011111bd45ee` | 2026-10-22 23:53:08 | Architecture: create independent Movete Facil Driver and Cliente Expo apps with CI isolation |
| 356 | `0df2b63ed759d7c80285e7151c8d5303958b4580` | 2026-10-22 23:30:01 | Expo G15: exercise private polling client auth, local-origin pinning, privacy and offline fallback |
| 357 | `41c95afe6accacf55c3871840867038416b16a56` | 2026-10-22 23:29:29 | Expo G15: disable caches and ambient browser credentials for private courier polling |
| 358 | `947d69bc125d8ff4929d1e1d76b7d3143a0c2f1e` | 2026-10-22 23:29:07 | Expo G15: add strictly localhost one-shot courier inbox client with bearer and safe snapshot validation |
| 359 | `897610c6391748687012727617d1711a0b198a31` | 2026-10-22 23:27:24 | Docs: record G13-G15 verified architecture, CI evidence, risks and continuation |
| 360 | `3617f179779bfb7180836a9a08bfc75158e42b4a` | 2026-10-22 23:26:31 | Guard G15 courier polling SQL against non-disposable databases |
| 361 | `dedcb2c38bd74f3fc10a113c21984f7df7420209` | 2026-10-22 23:26:28 | Guard G13 fenced push SQL against non-disposable databases |
| 362 | `e01e905033902ad312e149f7d675dc34264ec039` | 2026-10-22 23:24:59 | G15: fix courier gateway UUID validator to accept canonical 8-4-4-4-12 IDs |
| 363 | `5d18291e563a760362ebb31692e70d21741c1331` | 2026-10-22 23:23:17 | G15: test actual localhost HTTP private courier polling, JWT and fail-closed transport |
| 364 | `15e5dda8d494b2520ee1a34f33417164aa87e35a` | 2026-10-22 23:22:55 | G15: require courier private poll route in staging OpenAPI contract regression |
| 365 | `cacad45bf684788cddbf592fe543a1124a12f072` | 2026-10-22 23:22:39 | G15: document JWT courier poll fallback response contract in OpenAPI |
| 366 | `7354be3e047d850237b974ea9fca14c8d1ea2196` | 2026-10-22 23:22:16 | G15: wire JWT-scoped private courier fallback polling into isolated staging runtime |
| 367 | `107e3f098175e5021b05bf924ab647992b5a5c22` | 2026-10-22 23:22:00 | G15: route authenticated courier private-poll GET through loopback with fail-closed optional adapter |
| 368 | `b74a18ac498c469b6361650eb5b8134efbf73c8c` | 2026-10-22 23:20:06 | CI: verify G15 push-independent JWT courier offer polling on PostgreSQL schema |
| 369 | `2ec8fde6b37d599545991ad502e95856e5d40518` | 2026-10-22 23:19:53 | G15: verify actor-scoped poll remains available after uncertain push and hides expired offers |
| 370 | `45b03a41f4db7be59d71833cc23879edf3953a22` | 2026-10-22 23:19:23 | G15: test private courier polling auth, rate limits, fallback and PII minimization |
| 371 | `7c689a741109e7ea0ab5f68c5a584856bdd3e494` | 2026-10-22 23:18:42 | G15: implement JWT-bound courier offer polling when device push never arrives |
| 372 | `60fc349863dcfa882ea09d7d0d842ab1e2c54adb` | 2026-10-22 23:18:19 | G15: add strict RPC adapter for authenticated courier offer polling fallback |
| 373 | `223e4dfa0bedc87e26ef0e6c9a54d5471525328b` | 2026-10-22 23:18:01 | G15: add service-only courier-scoped polling of private unexpired offers as push fallback |
| 374 | `bedd4fbd8466c5fd9f0e1afe54554af06d0f5345` | 2026-10-22 23:15:46 | CI: run real two-courier assignment race after G13 fenced push checks |
| 375 | `be4c910572812a7de0156e2d40e08b4669ef2de5` | 2026-10-22 23:15:28 | G14: simulate competing courier offer acceptances against real transactional PostgreSQL |
| 376 | `bb7c7006e09664b2d3977d72eec155bcc92afb6f` | 2026-10-22 23:13:22 | CI: execute two-connection G13 stale-lease fencing regression on real schema |
| 377 | `5e84f257cf2ab9b4eb45b416c91022038ee74f67` | 2026-10-22 23:13:07 | G13: verify true two-session PostgreSQL lease takeover and stale-worker fencing |
| 378 | `37889b7fa543a736f8e02cafd7b2a3df55a70702` | 2026-10-22 23:11:31 | G13: guard lease nonce, fail-closed state and real PostgreSQL CI wiring in Node contracts |
| 379 | `c7f4826dbf7ff497e8737703685495f690f725c5` | 2026-10-22 23:11:12 | CI: execute fenced G13 migration and real-schema safety scenarios after G12 E2E |
| 380 | `e00d5f88a6b91218ce717a2a56e3816a786fa373` | 2026-10-22 23:10:57 | G13: disambiguate PLpgSQL offer variable in fenced PostgreSQL assertions |
| 381 | `77dfe374b13bd605b6ed9bf1e014288cf665fe30` | 2026-10-22 23:10:34 | G13: verify stale claim fencing, legacy upgrade, preparation and ambiguous-send retention in real PostgreSQL |
| 382 | `364b33261ffd8b17b3f8b03de9659d5650dd9d4d` | 2026-10-22 23:09:05 | G13: test fenced worker, stale-worker rejection, timeout uncertainty and double-send prevention |
| 383 | `c9138bbcca8fbe0e9b8cd572a65ee6f839a206b5` | 2026-10-22 23:08:32 | G13: test fenced RPC validation, typed responses and fail-closed cleanup |
| 384 | `233ffd91126bd8187562b7f4fad47513ff88aa01` | 2026-10-22 23:08:02 | G13: require atomic fenced begin before any injected push provider send |
| 385 | `ca5c41a69d7ec7c7fedbaa65f40e277938e31cdf` | 2026-10-22 23:07:39 | G13: add strict STAGING RPC adapter for claim nonce, begin fence, ACK and expired cleanup |
| 386 | `c53a2783756e6632310fbc3bb12f5f8f48bd10e5` | 2026-10-22 23:07:10 | G13: introduce fenced two-phase delivery push claims with fail-closed ambiguous sends |
| 387 | `d4aff9e21c35f2bee6a6d393e03301213791b466` | 2026-10-22 23:02:13 | CI: disambiguate full-chain PLpgSQL outbox receipt lookup |
| 388 | `b748891407185f3e95d64ab998084f6e2d317125` | 2026-10-22 23:01:35 | CI: run end-to-end cargo offer push and delivery transitions on real PostgreSQL schema |
| 389 | `227aabfc2e937484589402925e60cd8d2ce84811` | 2026-10-22 23:01:22 | CI: ensure MOTO passenger stays gated despite complete fake paperwork; disambiguate offer receipt check |
| 390 | `d9f35975935d66d72978355ce15d7d16b80d62ed` | 2026-10-22 23:00:47 | CI: exercise real-schema synthetic MOTO cargo request, private G10 offer, G12 push and G5 custody E2E |
| 391 | `d4a51c364d3efbdb39a894282859d43fbd323215` | 2026-10-22 22:58:40 | CI: test full real G1-G12 PostgreSQL migration chain alongside fixture concurrency |
| 392 | `d9a4f9377b79d82dda76e9f0085e4e150b0e2ba1` | 2026-10-22 22:58:08 | CI: assert G1-G12 real migration RLS, table grants, and service-role execution |
| 393 | `565498d2545050be69d12a73e699f4d325ac920e` | 2026-10-22 22:57:42 | CI: guard full-chain scaffold with disposable DB and dedicated CI application tag |
| 394 | `06046f2b47991b3f51a15ea05e684236870f8389` | 2026-10-22 22:57:13 | CI: create local-only Auth scaffold for genuine G1-G12 PostgreSQL migration chain |
| 395 | `8c69c5ebbed0a180eceaa8f3232e5ddb9d47c0d8` | 2026-10-22 22:54:47 | G12: guard bounded expiry cleanup and privileges with Node contract tests |
| 396 | `c5234097d0532fdf15a9c472dd9bb742c443e18d` | 2026-10-22 22:54:31 | G12: verify expired cleanup SKIP LOCKED against a competing database transaction |
| 397 | `898bc023567bba0833844a14a565e5f6b6d0da37` | 2026-10-22 22:53:57 | G12: batch expired-claim cleanup with SKIP LOCKED to avoid worker contention |
| 398 | `ea90f15ec402b5afac80502ba4beaf2fc7871fb1` | 2026-10-22 22:52:25 | CI G12: execute SQL expiry, idempotency and service-role assertions |
| 399 | `1249986787448308bc92449126b9975e11f0825b` | 2026-10-22 22:52:05 | G12: test expired claim cleanup, active ownership, ACK and role isolation in disposable Postgres |
| 400 | `f4e5e29121087422d313cff5109336b0f9b5d200` | 2026-10-22 22:50:10 | G12: add service-only cleanup for expired unacked push claims |
| 401 | `97a56b223d089e273804985324c23750fdb94c16` | 2026-10-22 22:48:09 | G12: test stable provider deduplication key across retry attempts |
| 402 | `b8e2815aae464db7f503386a2e07a60897412869` | 2026-10-22 22:48:03 | G12: supply stable per-offer push idempotency key to provider adapter |
| 403 | `01c3d60979df78991d988af6a772592e993692cf` | 2026-10-22 22:46:03 | docs(handoff): master continuity G12 verified green CI and executable next-architect roadmap |
| 404 | `73be6dfd37661d75cd80eec96f3e6949e5419758` | 2026-10-22 22:43:47 | fix(ci): remove literal backslash-n joining pip and Python commands |
| 405 | `03871fe419b716dbf6f30d35b596189cadfbb7ef` | 2026-10-22 22:43:00 | fix(ci): split psycopg install and concurrency command into separate YAML lines |
| 406 | `2b083f45c2c3191434e3166d073c6ceb3335f971` | 2026-10-22 22:42:27 | fix(ci): repair PostgreSQL smoke SQL quoting exposed by first real workflow run |
| 407 | `ca90ec37068098fa205d8f985bb0a6d4fc8a052e` | 2026-10-22 22:35:37 | ci(g12): run disposable PostgreSQL integration on pull requests, no manual dispatch needed |
| 408 | `e7bc94ca9201d8e0d07f350f79b1828bea2a8b1a` | 2026-10-22 22:35:31 | ci(g12): install psycopg for real disposable PostgreSQL concurrency test |
| 409 | `dd93664d9329b60ca3973f8a5cd82b56bc51e73d` | 2026-10-22 22:35:26 | fix(g12): deterministic real two-connection concurrency with psycopg and timeout |
| 410 | `1972cba8504f11ddcbf3c0ebbb9600700c1731b2` | 2026-10-22 22:34:09 | ci(g12): add real simultaneous PostgreSQL worker claim and ACK checks |
| 411 | `ff1b780a3248567c247996bdc888e84568464864` | 2026-10-22 22:34:01 | test(g12): real two-session PostgreSQL SKIP LOCKED concurrency harness |
| 412 | `a667fa682a48332347d7a4cf1b087cc1f3f9dfbf` | 2026-10-22 22:31:26 | ci(g12): execute real delivery outbox SQL in disposable PostgreSQL 16 |
| 413 | `5ef2d9ecb6125bbbeebd7793d17b42e6c142d24e` | 2026-10-22 22:31:20 | test(g12): executable PostgreSQL claim, wrong-worker ACK and duplicate prevention |
| 414 | `01e3d2ae996146bcc92b893cea8ea5fec659d5a4` | 2026-10-22 22:31:13 | test(g12): disposable PostgreSQL fixture for real private delivery claim and ACK |
| 415 | `1659dd3e9404e885e8ec7574cbf93cf0a53ede5f` | 2026-10-22 22:29:58 | test(g12): end-to-end synthetic two-worker claim and single provider ACK |
| 416 | `6cda6ba788ad43836e9a000892ac54514644474c` | 2026-10-22 22:28:34 | test(g12): SQL delivery outbox atomicity, ticket ownership and restricted grants |
| 417 | `7ff8a3c967e1d5225fac0ac6dd44cad94a1df310` | 2026-10-22 22:28:26 | feat(g12): atomic SKIP LOCKED delivery push claim and provider ticket ACK in disposable PostgreSQL |
| 418 | `4d262a11c7beca22a62adb2a54f501caa05d1697` | 2026-10-22 22:26:45 | test(g12): RPC outbox adapter claim, ACK, errors and forged records |
| 419 | `3a2c550d38dfc66d6cbd5b50f77dc7d72509d530` | 2026-10-22 22:26:35 | feat(g12): typed fail-closed RPC adapter for private delivery outbox |
| 420 | `88a839a58751541296a62e9f7f14ddae554cbdab` | 2026-10-22 22:25:36 | test(g12): deterministic virtual clock instead of 1.1s wall-time sleep |
| 421 | `9dbc275a4c2aa994a3171fa1a889b6df3b9844c1` | 2026-10-22 22:25:29 | refactor(g12): inject clock to deterministically test expiring delivery offers |
| 422 | `35db6fb7ddeba0667c19083ff249e4729ed5335c` | 2026-10-22 22:24:41 | docs(g12): clarify provider ACK is not device receipt |
| 423 | `a5c6759167edbfb7e0129ba2468545725b5e40ed` | 2026-10-22 22:17:01 | test(g12): prevent expired private delivery push after delayed claim |
| 424 | `b4d946e9e07f408995ff5b971daa6c46fba465ab` | 2026-10-22 22:16:55 | fix(g12): recheck private offer expiry immediately before provider send |
| 425 | `f163af6ae7e4b43f9093a984f05efb8214ba3951` | 2026-10-22 22:10:04 | test(g12): private delivery push provider ticket and failure isolation |
| 426 | `f44aa3608ea22c1e6cdfbad0181c2477ad8601f0` | 2026-10-22 22:09:54 | feat(g12): fail-closed private delivery push worker with separate provider ACK |
| 427 | `208246b7ad48e21e5b5debe45afc34a4ee6352d2` | 2026-10-22 22:08:08 | test(mobility-g12): validate OpenAPI references, path identity and sealed requests |
| 428 | `01fac25eca186e831d6df488dbfc12c92a55928d` | 2026-10-22 20:26:10 | feat(mobility): publish staging API contract |
| 429 | `097807c3110b9914b12a2a6894aef1bad2c647cb` | 2026-10-22 20:20:37 | feat(mobility): add private delivery dispatch |
| 430 | `d9ba2a1adc357feea13b7f2375feb549d6929a4f` | 2026-10-22 20:11:46 | feat(mobility): expose merchant management APIs |
| 431 | `ea1d5f2a1a25ef3eebf24e1bbb6dfd5d8cd665b1` | 2026-10-22 20:08:58 | feat(mobility): persist merchant management |
| 432 | `4a441f16b93b59c6a65349e14e5289c497fb9bbd` | 2026-10-22 20:06:00 | feat(mobility): expose authenticated safety operations |
| 433 | `23d11cd2fef267fbb02e15e12e60cb3193f29ee9` | 2026-10-22 20:02:16 | feat(mobility): persist safety operations controls |
| 434 | `abb5958e10b1b2e34cc16070a7f837430ba37c82` | 2026-10-22 19:57:56 | feat(mobility): expose authenticated simulated finance |
| 435 | `03d57173f6bc1d22efb1f14d3637612355057154` | 2026-10-22 19:34:23 | feat(mobility): persist fares and simulated ledger |
| 436 | `4873d56a27a0131403a1e97ed3601cad818c32a6` | 2026-10-22 19:30:48 | feat(mobility): expose authenticated merchant orders |
| 437 | `fb9633b87d42f826a3acdfae302b6065a9ec0117` | 2026-10-22 19:26:55 | feat(mobility): add merchant order persistence |
| 438 | `06602ddba0ff18e6fb700180906902ceed9bf943` | 2026-10-22 19:21:28 | feat(mobility): persist delivery custody in staging |
| 439 | `86449ec9fa7dd09b630232ab4bfdba8c264151f3` | 2026-10-22 19:07:46 | feat(mobility): persist authenticated trip commands |
| 440 | `1299c5191d1dfa265787e474b1b9b5836d140afc` | 2026-10-22 18:59:36 | feat(mobility): add authenticated G4 persistence adapter |
| 441 | `006b99f386e59577748027f758ccbe5bbc9e03d9` | 2026-10-22 18:49:44 | docs(mobility): master Work handoff for Movete Fácil backend-first and full commerce delivery |
| 442 | `69dcf58b5b77be0b1a86f84c65ef0ad1f15c890f` | 2026-10-22 18:41:40 | test(staging-dispatch): deny snapshot access to non-participant actor |
| 443 | `c099f4a81c5a84c3d516a207dfa53e5f0b42917c` | 2026-10-22 18:41:33 | fix(staging-dispatch): require trip participant identity for snapshot calls |
| 444 | `0b1e5f072c3d06c91d9b794c844832a8c69288f0` | 2026-10-22 18:41:12 | test(staging-dispatch): reject malformed persistence inputs without SQL calls |
| 445 | `7ebe64d4df460b59d704a9f76d7189ee7d5b631d` | 2026-10-22 18:41:05 | fix(staging-dispatch): reject non-object persistence requests before backend |
| 446 | `d5d5a5382b0a074d67c39c3e47af9cd34e5d5335` | 2026-10-22 18:40:36 | test(staging-fares): handle null, array and missing fare requests safely |
| 447 | `27e99dc1638d2e57b07c7235fb1f9046f72f7bee` | 2026-10-22 18:40:29 | fix(staging-fares): fail closed for absent or malformed quote requests |
| 448 | `a3652ce3182172bd290187a6c324e3488967324b` | 2026-10-22 18:39:59 | test(staging-ledger): reject extra or substituted synthetic ledger accounts |
| 449 | `27ad37f60d80ccce0ee0b95d435e195541f142ac` | 2026-10-22 18:39:52 | fix(staging-ledger): require exact three-account settlement posting shape |
| 450 | `5e751c57cd99548d230f4871f0f6cbaceb83c054` | 2026-10-22 18:39:04 | test(staging-ledger): reject forged fare breakdown and invalid rule version |
| 451 | `2923deaa372441db7cf34bb5b9cae0c9e8d27d3f` | 2026-10-22 18:38:55 | fix(staging-ledger): require fully verified fare quote before synthetic settlement |
| 452 | `ef0913d619c56a7a5d86378e6926bbdb679a31fe` | 2026-10-22 18:38:20 | test(staging-fares): reject invalid or missing pricing rule versions |
| 453 | `c803ffa2110897471199ef3a27764fe6afbffc61` | 2026-10-22 18:38:15 | fix(staging-fares): require valid pricing rule version during quote verification |
| 454 | `50057f12c73adbb63dc941ba5300b65b64f68220` | 2026-10-22 18:36:20 | test(staging-fares): reject tampered quote breakdown and commission |
| 455 | `5c2cf1ba1c9fc4cc119c739f9f61ec9a67de9407` | 2026-10-22 18:35:12 | fix(staging-fares): recompute synthetic quote components during verification |
| 456 | `a9f43fd328344da6a39290858ae143e6d4a1671c` | 2026-10-22 18:34:17 | ci(mobility): provision disposable PostgreSQL 16 smoke workflow without remote access |
| 457 | `2375a88550cdb630ced6a6db6cb56844b24cf166` | 2026-10-22 18:33:07 | test(staging): assert G4 SQL lock order, ownership and privileges |
| 458 | `f4f9c055dfe08d3e7cc4952192cdae7e7b65ce38` | 2026-10-22 18:32:34 | fix(staging-sql): explicitly reject conflicting acceptance decision keys |
| 459 | `74e732ba699e13bc12bd3248b4c37a4a2dd5a723` | 2026-10-22 18:28:41 | fix(staging): validate local QA gates before dynamically loading Supabase SDK |
| 460 | `3b9b31850c74f7b720b5fd3bb206e7889ab86d64` | 2026-10-22 18:28:04 | ci(mobility): support Expo workspace without package-lock in staging test job |
| 461 | `7c61f67813000c7fc2df9de52b722a665a7994eb` | 2026-10-22 18:27:36 | ci(mobility): install locked workspace dependencies before staging Node tests |
| 462 | `ed1b0fda4d8fd07dfc536353dd40d2f2b78dc623` | 2026-10-22 18:26:57 | ci(mobility): run Node staging server contract tests on branch and PR |
| 463 | `035c56659d48ee455b6cf2849617a9a6ea791d76` | 2026-10-22 18:26:42 | test(staging): deny passenger spoofing and invalid transition events |
| 464 | `42a3e6423597d57cc1512024891cc872504109af` | 2026-10-22 18:26:35 | fix(staging): validate passenger ownership and transition events at persistence boundary |
| 465 | `27381836ade6291fa9d689ad55a733b235a4fc56` | 2026-10-22 18:26:07 | test(staging): enforce assigned driver identity at authenticated acceptance boundary |
| 466 | `8d9a44f643e6e90e3a92d19fe94c5870ada0e03e` | 2026-10-22 18:25:58 | fix(staging): reject accept requests with mismatched actor and driver |
| 467 | `d24744dd19ed7c4c2370320adeda7821046f2fc5` | 2026-10-22 18:12:22 | test(staging): fail closed for malformed private offers |
| 468 | `d6eea470ff80412bc6f0e33c745caed4142edba9` | 2026-10-22 18:12:13 | fix(staging): validate private offer identifiers and TTL before repository call |
| 469 | `e2d6af996dd3bdc5fcc68f7164d989bf75fbfb56` | 2026-10-22 18:09:27 | test(staging): server-authenticated dispatch rejects client actor spoofing |
| 470 | `97f943aef4d5c048e02b2ff250f4335600df79f0` | 2026-10-22 18:08:58 | feat(staging): add server-derived actor identity boundary for dispatch |
| 471 | `d302a52942bd40fe9a2eca605f3ea1199a023f12` | 2026-10-22 18:08:21 | test(staging): prevent cross-service offers for passenger rides |
| 472 | `df24fce3ed48195c13b23fe3c3b1e2f89f79e5de` | 2026-10-22 18:08:08 | fix(staging): bind driver offers to requested ride service |
| 473 | `703e5a283c8a8bf79b3f85a4ba14c75bd67b0a30` | 2026-10-22 18:03:49 | test(staging): expired driver documents invalidate pending offers |
| 474 | `4acac97b81978e8262b1217cd42e32f1f24b7071` | 2026-10-22 18:03:42 | fix(staging): expire dispatch offers when driver documents expire |
| 475 | `6c5b9005d6d565ebe5f6f25483df2c8fbff6bb1c` | 2026-10-22 18:00:28 | test(staging): reject tampered fare components in synthetic settlement |
| 476 | `95762b88ded1c94d7b9d0009e097a3103d05ed0c` | 2026-10-22 18:00:21 | fix(staging): validate fare components and commission before synthetic ledger posting |
| 477 | `a15923c688e6118ce53d93caddc1629bc195966f` | 2026-10-22 17:30:29 | docs(mobility): comprehensive master handoff on infrastructure and fare research |
| 478 | `4c8e514c3cdede24859bb5474a28c73fb233ac91` | 2026-10-22 17:19:27 | test(mobility): synthetic double-entry settlement reconciles PYG |
| 479 | `c41a785a57b514bad5f9bfb41c89ba746ff9204d` | 2026-10-22 17:19:16 | feat(mobility): add balanced synthetic PYG commission ledger |
| 480 | `77dc239bed8ed8cc248485787ecabe6912cc6dae` | 2026-10-22 17:18:15 | test(mobility): synthetic end-to-end scenario with two competing drivers |
| 481 | `412316fba051c3eaa42879a63dedae0bdb7c9894` | 2026-10-22 17:18:01 | feat(mobility): compose synthetic dispatch, eligibility and zone gates |
| 482 | `84535250da03fa51e8a864e0396be6023d503ab5` | 2026-10-22 17:04:51 | test(mobility): enforce audit sequence and exclude sensitive fields |
| 483 | `aa1573a4e5fab66a3186896452c96600f106b371` | 2026-10-22 17:04:42 | feat(mobility): deterministic synthetic audit records with no personal data |
| 484 | `218edd3ccafd63e7cfd3f052779a8ff84ed3ce11` | 2026-10-22 17:02:33 | test(mobility): verify driver eligibility rejects expired and unapproved records |
| 485 | `f04f5a6c022069af354de074c92afba8d54b1b24` | 2026-10-22 17:02:23 | feat(mobility): enforce synthetic driver and vehicle eligibility gates |
| 486 | `bf221c9742e7ed64e7189715bd53ff54662a390b` | 2026-10-22 16:56:30 | test(mobility): geofence staging and moto legal gate |
| 487 | `dfc58f3ca4479018821ac84bf1115af50a3e78f0` | 2026-10-22 16:56:20 | feat(mobility): add fail-closed national zone activation policy |
| 488 | `d4ec2c4d94f42cf94a136253edf53b598fb00a19` | 2026-10-22 16:46:59 | test(mobility): persistence boundary fails closed on missing auth and backend errors |
| 489 | `a180dad1879114aae42de3d32bd22d4a3e17e49c` | 2026-10-22 16:46:47 | feat(mobility): define fail-closed persistence adapter for staged dispatch |
| 490 | `e36fce86f34fb60db05d49d10a0c0e22692249eb` | 2026-10-22 16:41:44 | test(mobility): prevent double acceptance and unauthorized trip transitions |
| 491 | `3ab42f3201e296ae9e5223a8c4ebc1ddca9fc2f4` | 2026-10-22 16:41:33 | feat(mobility): atomic synthetic offer acceptance and trip lifecycle |
| 492 | `cef105477c48738b7345f926378590911e4e4483` | 2026-10-22 16:36:21 | test(mobility): synthetic parcel capacity and delivery transitions |
| 493 | `db9fc91bcc2a6966c2cd5600a0f50ca2c01a9cea` | 2026-10-22 16:36:14 | feat(mobility): add isolated synthetic delivery lifecycle |
| 494 | `feb8a38035e1f92f3d79f38435ac1055ef346b01` | 2026-10-22 16:21:25 | feat(mobility): add versioned synthetic PYG fare engine and regression tests |
| 495 | `d9756b1f27236bf6bc21b63752b210b7bc03d3e9` | 2026-10-22 16:21:22 | feat(mobility): add versioned synthetic PYG fare engine and regression tests |
| 496 | `1dc7eee6b12e1f00e5d5f1d30e9cf2e8b081e7ae` | 2026-10-22 16:14:14 | test(mobility): cover GPS consent freshness and synthetic routing guardrails |
| 497 | `ab515719f1d2557d2d23b7d6cb08647f71285603` | 2026-10-22 16:14:03 | feat(mobility): add isolated GPS staging validation and navigation contract |
| 498 | `2c5277c94498b3fed182e426224dbbbfd105f170` | 2026-10-19 09:21:29 | test(mobility): fail closed on malformed route batch before later calls |
| 499 | `3175c646c4609e959debfa53b053bee1be325e19` | 2026-10-19 09:21:26 | test(mobility): fail closed on malformed route batch before later calls |
| 500 | `f4dbf223a98fdb162b4973ee74b5d11e22042536` | 2026-10-18 21:59:07 | security(mobility): enforce route identity membership within each 20-driver batch |
| 501 | `8151a3218737abc65be58ea5463a977c5b1804ed` | 2026-10-18 21:59:05 | security(mobility): enforce route identity membership within each 20-driver batch |
| 502 | `e926cb8492a3f494187a2bb9f38d1d50f7ef8017` | 2026-10-18 21:49:17 | security(mobility): reject foreign driver identities in route matrix |
| 503 | `51e892299c19b7463bd825513bdca8d60715525d` | 2026-10-18 21:49:14 | security(mobility): reject foreign driver identities in route matrix |
| 504 | `f0175a0f646298176bfc7ffbdecf65455dcd8841` | 2026-10-18 20:20:56 | docs(mobility): document fail-closed RLS response bounds |
| 505 | `5d25bcf9f64379791b844f05333d3e745a890e30` | 2026-10-18 20:20:48 | docs(mobility): clarify exhaustive role verification in staging JWT audit |
| 506 | `2eec45dc318eb7641124de0114a8353f30f6b6e7` | 2026-10-18 18:50:22 | docs(mobility): record remote G3 G4 blockers and safe deploy gates |
| 507 | `99bcac1d65d44723d60bb20d723754536d427826` | 2026-10-18 18:48:21 | security(mobility): reject dual-role and admin driver sessions in G4 |
| 508 | `a5b1abd361f0c2ccc1bc5083abe317cd912939bd` | 2026-10-18 18:48:19 | security(mobility): reject dual-role and admin driver sessions in G4 |
| 509 | `b3746b4c80508e928e6f0faac2a29b2cb6c37575` | 2026-10-18 18:41:59 | fix(mobility): batch G4 road routing into 20-driver matrices |
| 510 | `558397776ce76cd26b9af5bb94c2fcc1f7ec05c1` | 2026-10-18 18:41:57 | fix(mobility): batch G4 road routing into 20-driver matrices |
| 511 | `25ef2b50a17fec5f041f06904a39922938c4a10a` | 2026-10-18 18:39:09 | fix(mobility): enforce G4 maximum five private offers |
| 512 | `c87302dded5b17f9899d3902ab9fd07d85bc5b34` | 2026-10-18 18:39:06 | fix(mobility): enforce G4 maximum five private offers |
| 513 | `f2a495cff3d1c3c29b73c2b9db8e43b80738acf8` | 2026-10-18 18:34:02 | docs(mobility): record Android V3 PASS evidence for both staging drivers |
| 514 | `440b470fd09974ee6efc6df69e9c378463c76dc3` | 2026-10-18 17:36:25 | docs(mobility): link 2026-10-18 comprehensive 100-percent master handoff from historical continuity |
| 515 | `d988bc82b9dda9b3fde053f4bff9989a15f14fb4` | 2026-10-18 17:35:21 | docs(mobility): comprehensive 2026-10-18 master handoff from Auth QA to 100% operational QORE Mobile, phased release gates |
| 516 | `975fd439e9f85c8e1960fae80dbd45c3b2d89472` | 2026-10-18 17:21:43 | docs(mobility): record account-bound Android V3 passenger Auth and RLS PASS, drivers still pending |
| 517 | `94b7db36fdac39d696617319974b833ebaacbbbc` | 2026-10-18 17:16:22 | docs(mobility): audit V2 QA stale PASS and document V3 account-bound proof fix |
| 518 | `234050e3b6c441be9c1c826be55821efb5ae23e3` | 2026-10-18 16:41:46 | docs(mobility): record Lovable QA diagnostic build failure and offline mobile Auth/RLS smoke alternative |
| 519 | `8c6f873851edba46fe2781357d72be66643ee7a2` | 2026-10-18 03:59:51 | docs(mobility): handoff verified 1 rider + 2 driver Auth roles without public exposure |
| 520 | `751f7e1ec148496e3a20ffcaed34d944697b3720` | 2026-10-18 03:59:43 | docs(mobility): record certified staging QA roles and safe pinned three-JWT smoke |
| 521 | `110e10fc12d1606363d0a8f4a84c5b285b4cf8fc` | 2026-10-18 03:58:40 | test(mobility): approved Gmail-only three-actor QA requires pinned ref and exact Auth UUIDs |
| 522 | `5caf25313b281cec8a01aebf9c693c6383632831` | 2026-10-18 03:58:00 | security(mobility): permit confirmed approved Gmail QA accounts only on pinned staging with matching Auth UUIDs |
| 523 | `edc4810f7e610d34e4daae004fd2b21f78f745a9` | 2026-10-18 02:58:39 | docs(mobility): master handoff Auth signup verified closed and three-actor JWT/RLS E2E next gate |
| 524 | `850dc7bb9c304ddeead6b02f4ef22856b5d595e0` | 2026-10-18 02:57:44 | docs(mobility): certify native signup disabled and define safe three-account QA provisioning plus JWT RLS smoke |
| 525 | `5e4b2b88f21eeae5659bbfa963d100bbe794fdae` | 2026-10-18 02:56:06 | ci(mobility): add secure three-actor real-JWT E2E readiness contract, no remote users |
| 526 | `69c743d014485c558d24c2e96138c117fd03f6fe` | 2026-10-18 02:55:46 | test(mobility): mock three real JWT fixture identities, owner-role isolation and fail-closed signup gate |
| 527 | `f490219260fecca34d6185d890efbcf1b84eaa83` | 2026-10-18 02:54:52 | test(mobility): prepare authenticated three-account RLS smoke for one passenger/two drivers after signup gate |
| 528 | `b62410dba2f561c85dae760376def7e685c0efa6` | 2026-10-18 02:27:05 | docs(mobility): independently verify Lovable staging Auth signup open and manual-only safe closure gate |
| 529 | `39375ed74546e3aa88fd60edb57ab42bce390dc5` | 2026-10-18 00:18:13 | docs(mobility): handoff G4 private push one-shot SQL claim, 2-worker race, eligibility recheck and delivery tradeoffs |
| 530 | `04528d849dcf37a0302a1eed87057b2ff9983c91` | 2026-10-18 00:17:13 | docs(mobility): worker requires fresh compliance preflight before any driver offer push |
| 531 | `ec252b2564cc4924f6cc4fe6cd11f28379a906ad` | 2026-10-18 00:16:53 | test(mobility): no notification after driver revoked or unavailable under second server preflight |
| 532 | `0c6d0fc5dbe268f550db1b474e7ce714479e69b6` | 2026-10-18 00:16:25 | security(mobility): require fresh server-side driver eligibility recheck before private push |
| 533 | `49310c81ea64b4be9b48aa18326ada061c7c60a6` | 2026-10-18 00:15:28 | docs(mobility): G4 push outbox exclusive SQL claim, ticket audit and at-most-once delivery limitations |
| 534 | `b1877606cc852cc5f314d7319fd47255c746ca11` | 2026-10-18 00:13:27 | test(mobility): private push worker opt-in, eligibility recheck, stale/foreign offer rejection and ticket ACK semantics |
| 535 | `769dc95fbb3b4fc95465fda5d5437b049bb3716d` | 2026-10-18 00:12:25 | feat(mobility): server-only private offer push worker with at-most-one claim, opt-in, recheck and ticket ACK |
| 536 | `510d22f55efaafc3c9ed34ca8167e6920cd79f48` | 2026-10-18 00:11:48 | test(mobility): verify Expo ticket recorded without claiming notification delivery |
| 537 | `e15e02734aa1ee2c450976b2a2e48799dfe69d24` | 2026-10-18 00:11:32 | feat(mobility): preserve opaque Expo Push provider ticket for server-only outbox audit, never imply delivery |
| 538 | `ede198ee441256d4dec76a70bd74a1ee32d63a16` | 2026-10-18 00:10:35 | ci(mobility): test at-most-once private notification outbox and two SQL-worker claim race |
| 539 | `1fc50304a96be12135d08e433a894ad777b37cef` | 2026-10-18 00:10:17 | test(mobility): two Postgres workers race private driver offer, exactly one push claim |
| 540 | `f54a6996c80afdfeefab8321a2624a6150c3ed39` | 2026-10-18 00:09:30 | test(mobility): CI-only private push claim skips expired offers, one-shot ack and blocks cross-worker replay |
| 541 | `15c63dc7d0e10fa52bbefa00b5f508acfa16328e` | 2026-10-18 00:08:28 | feat(mobility): CI-only SKIP LOCKED private push claim and ticket acknowledgment |
| 542 | `090b44e3b74b74dd25a42c95a06d1ee03a256b1b` | 2026-10-17 22:10:04 | docs(mobility): handoff fail-closed G4 Supabase boot, QA local runner and pinned rider JWT origin |
| 543 | `be974d176f21201cbe65381708727b0c69ce7133` | 2026-10-17 22:09:25 | docs(mobility): G4 safe Supabase runtime boot, schema gates, loopback runner, JWT API pin and exact blockers |
| 544 | `f8bac0bf56aa2b343203d6642bce37757d8b3ad2` | 2026-10-17 22:08:10 | test(mobility): reject malicious alternate HTTPS host without leaking passenger JWT |
| 545 | `de5590777e56410e709e749c6863b714060d31c1` | 2026-10-17 22:07:50 | security(mobility): require pinned approved HTTPS backend origin before sending rider JWT |
| 546 | `55c50cac8f99d5a546c791819b2bc2b1d9e1ac77` | 2026-10-17 22:06:50 | test(mobility): G4 local CLI refuses public start without QA flag, closed Auth environment and no-LIVE |
| 547 | `49439b264d0455d78c0006eebef01267b68a40c0` | 2026-10-17 22:06:31 | ci(mobility): syntax check local G4 Supabase staging-only runtime runner |
| 548 | `40028a6cd2dde9555df19715b6adef961296f6e2` | 2026-10-17 22:05:33 | feat(mobility): explicit G4 loopback runner blocked by staging Auth policy, required G3/G4 DB and no-LIVE flag |
| 549 | `5b39222c0c79c5e5d26a8ce0353e34d4f5eedb76` | 2026-10-17 22:04:28 | test(mobility): fail closed if Supabase Auth signup open or G4 schema missing, with JWT-bound HTTP mocked DB adapters |
| 550 | `de48ba0e29eb6ef4409eb5cacdb3e234fa77bc33` | 2026-10-17 22:02:14 | feat(mobility): fail-closed G4 staging boot Auth signup+schema gates and server-only Supabase offer/rider adapters |
| 551 | `35875e4e09d90d7690962e8db58918d398c56537` | 2026-10-17 20:04:43 | test(mobility): reject server.listen to all interfaces or non-loopback, even bypassing helper |
| 552 | `081334540d2f5278a2be6019c8d3e5cbc39406c5` | 2026-10-17 20:04:29 | security(mobility): make raw QORE QA HTTP server reject public bind even if loopback helper bypassed |
| 553 | `0e5440936ca96674a0e423e96cb9b4287d1492a3` | 2026-10-17 20:02:56 | docs(mobility): handoff G4 three-actor loopback HTTP, safe Expo polling and 180 tests |
| 554 | `94432dedfee787c6882a4657305e7f999995e648` | 2026-10-17 20:01:29 | docs(mobility): real loopback HTTP 3-actor QA and fail-closed Expo radar polling bridge runbook |
| 555 | `be62485e14271afa18c11d406cdc6973a45d17cb` | 2026-10-17 20:00:28 | test(mobility): enforce AUTO-only G4 view despite a forged MOTO driver profile |
| 556 | `1d1febf7fd4c1a58fcdd65a0fb97b7e107f22117` | 2026-10-17 20:00:21 | test(mobility): enforce AUTO-only G4 view despite a forged MOTO driver profile |
| 557 | `75e4259b314a4f22ab6912a6b8921de425f5caf4` | 2026-10-17 20:00:05 | security(mobility): prevent G4 AUTO rider feed from displaying commercial MOTO assignment |
| 558 | `aac64e4cc5e16992cd2e927d44b2bdd69bcb899e` | 2026-10-17 19:59:50 | security(mobility): suppress unlicensed MOTO arrival profile in G4 AUTO-only passenger snapshots |
| 559 | `b6ec9fc852c4c5abea0d26a73ec7b15c424645aa` | 2026-10-17 19:58:50 | fix(mobility): portable AbortController for Hermes Android/iOS radar polling without fabricated ETA |
| 560 | `6a1a9664ee52766739edadaee6da8808b14212f2` | 2026-10-17 19:58:25 | test(mobility): Expo polling bridge Auth, HTTPS restriction, stale ETA, replay and security failures |
| 561 | `dfa4c52f620cf9849e8df5d18af8a3496d94a556` | 2026-10-17 19:57:34 | feat(mobility): JWT-only passenger polling bridge with fail-closed offline ETA and private stage origin |
| 562 | `6efe8de8c3a6e09da4bb0196d50bcd1a77e00b32` | 2026-10-17 19:55:29 | test(mobility): real loopback HTTP with passenger/two drivers, synthetic offers, race, stale GPS and boundary security |
| 563 | `f885e99d6f2fb64066bdc14402864df8402c8ae2` | 2026-10-17 19:54:11 | feat(mobility): local-only G4 HTTP transport for authenticated passenger and driver test gateways |
| 564 | `bfd0f8de4d6e2487d81a6ed2da83b5968f8e128d` | 2026-10-17 19:35:57 | docs(mobility): handoff QORE Radar rider-auth status bridge and integrated synthetic 3-actor contract |
| 565 | `be98c30affc6c9943026cd92779002eba3537a4a` | 2026-10-17 19:34:53 | docs(mobility): G4 passenger confirmed status bridge, private rider/driver integration and production blockers |
| 566 | `db8b785e792402b4bc161f0bc6b9ee54b3e929a2` | 2026-10-17 19:33:28 | test(mobility): integrate synthetic passenger, two drivers, private push, atomic decision and GPS/traffic status |
| 567 | `906a697ca516ff309fb3afeb27d5fca073169f11` | 2026-10-17 19:32:12 | test(mobility): verified rider-only driver details, traffic ETA, stale GPS, cancel and spoofing protections |
| 568 | `ed586920c54765e8c53118247ddffd519a8af716` | 2026-10-17 19:31:18 | feat(mobility): authenticated passenger status API returning only confirmed driver and verified arrival ETA |
| 569 | `379f506649030495e764a4a5e59e0ca3a5a7589e` | 2026-10-17 18:45:07 | docs(mobility): handoff G4 private expiring offers, atomic one-driver winner and Auth API gates |
| 570 | `38e7c1755e57b61050d7f581141654bcdb06ce47` | 2026-10-17 18:44:03 | docs(mobility): contract G4 offer-to-accept lifecycle, fixed direct-accept bypass, client identity and real integration gates |
| 571 | `4145ebc122ef60a9c6f1a4e266aa0a6bcb31cbeb` | 2026-10-17 18:42:40 | test(mobility): ensure private preview rejects offer expiration beyond 30-second bound |
| 572 | `476e0ea6a22dab94999d537c628a9354f7e4e1fe` | 2026-10-17 18:42:11 | test(mobility): JWT-bound private offers reject role spoof, expiration, replay and premature acceptance claims |
| 573 | `f9d2631e38b146ffd67e722dc8ae5466c7a820f0` | 2026-10-17 18:41:14 | feat(mobility): JWT-authenticated driver offer API with private lookup, SQL-only accept/decline and fail-closed guard |
| 574 | `820ee34461e7e6c3ebf1005a8a33c6495d421c13` | 2026-10-17 18:38:51 | test(mobility): assert genuine permission denial for private G4 offers and outbox under authenticated JWT role |
| 575 | `a245aa546180fc359a07d482b0f4c4d1e2457fc7` | 2026-10-17 18:37:58 | ci(mobility): add isolated G4 driver-offer expiry/decline checks and two-driver SQL race |
| 576 | `87b09b09b9cf553a313cac6deb73431b29ecfe28` | 2026-10-17 18:37:40 | test(mobility): race private expiring offers to two drivers, ensure one winner and audit event |
| 577 | `af98e7d52f2f46b702534075075f14fa9c6926f8` | 2026-10-17 18:36:49 | test(mobility): G4 CI-only offer creation, privacy, expiry, decline, replay and unique acceptance |
| 578 | `e569615d17d9147f1c0a4f6487b1bfb2b3bf9b4a` | 2026-10-17 18:35:02 | feat(mobility): G4 CI-only private expiring per-driver offers, atomic winner and push outbox |
| 579 | `1e1b7f5fe23bede8ba65690aafcccfb852ac066b` | 2026-10-17 18:18:08 | docs(mobility): handoff G4 QORE Radar traffic ETA, private push and differentiated trust architecture |
| 580 | `6c1baac7e13f3d7de34eaee011fb5bdebafaeefe` | 2026-10-17 18:17:02 | docs(mobility): specify QORE Radar smart search, push notifications, honest ETA, private realtime and unique differentiators |
| 581 | `c4f2fb067eb1098a1be99ae63ac1665b638a68dd` | 2026-10-17 18:13:49 | test(mobility): authoritative passenger acceptance, trusted ETA only, stale GPS, push ordering and no fake tracking |
| 582 | `5079d6f45e36322de910c7df704e37bde03bc687` | 2026-10-17 18:13:14 | feat(mobility): client QORE Radar reducer for authoritative acceptance, ordered events and stale-ETA suppression |
| 583 | `9fc15a74ba55ab4b8eafe2e12b0cc27838514e54` | 2026-10-17 18:12:21 | test(mobility): secure private driver push, expiration, recipient match and no fake delivery claims |
| 584 | `8e6cba7aa2b29e96711abe0887666586a6f29c8d` | 2026-10-17 18:11:53 | feat(mobility): private, expiring Expo push transport adapter for driver offers; never implies accepted trip |
| 585 | `044f4337c44c63221f3a63c9fd2e94e79f29e1d7` | 2026-10-17 18:11:11 | test(mobility): Google Routes traffic distance/ETA adapter, response validation, fallback and privacy |
| 586 | `fa5ed07af90ff63734affab79786e017553379eb` | 2026-10-17 18:10:40 | feat(mobility): secure server-only Google traffic-aware road ETA matrix adapter, explicit fallback rejection |
| 587 | `b8cc1add136dad4f7d167b33f912e047c7f0f577` | 2026-10-17 18:08:31 | test(mobility): rank nearby driver using bounded idle-time bonus edge case |
| 588 | `2da378fa89153a02c53d0963ba9f2a3c021f35db` | 2026-10-17 18:08:10 | test(mobility): QORE Radar driver filtering, route-based ETA, expiring push, privacy and GPS expiry |
| 589 | `47d030be7ddd5ecc5edb7ee6d96bcd585e94fb38` | 2026-10-17 18:07:08 | feat(mobility): server-only QORE Radar verified driver discovery, traffic routing, private push and real-ETA contract |
| 590 | `497abe4ddba0e405c3df5bf4cc6151480bbdf649` | 2026-10-17 14:04:49 | docs(mobility): master handoff guided AUTO experience and G3 synthetic concurrent SQL dispatch proofs |
| 591 | `bc65143aa56e877592338e6ad8175f300efe6db3` | 2026-10-17 14:04:03 | docs(mobility): attest G3 auto-only SQL and two-real-connection fake dispatch concurrency under CI |
| 592 | `1479d65d76398b5f87714c998b78ca7a53ee30b3` | 2026-10-17 14:03:00 | test(mobility): race two DISTINCT eligible drivers for same fictitious AUTO dispatch |
| 593 | `b56fffcc4f7142b3b0f9a9272019cd763974c836` | 2026-10-17 14:02:37 | test(mobility): build two fully eligible synthetic AUTO drivers for actual multi-driver SQL assignment race |
| 594 | `9f90414b9c7d830e582e93115618c5ad1553bacf` | 2026-10-17 14:00:41 | ci(mobility): run two-client concurrent demo AUTO acceptance race after SQL RLS contracts |
| 595 | `038cf62a2cd87867d1140f265923a30458dcc43d` | 2026-10-17 14:00:19 | test(mobility): race two SQL connections and prove only one AUTO demo assignment |
| 596 | `d26540c6e11cdd8f1f82d6371e2eed7902e1b2ae` | 2026-10-17 13:58:18 | ci(mobility): run G3 simulated AUTO trip transaction contract in disposable Postgres 16 |
| 597 | `e9ea760416b6f9e45f10ae567f9a900d20428928` | 2026-10-17 13:57:56 | test(mobility): Postgres G3 AUTO demo state transitions, double-assignment rejection and actor RLS |
| 598 | `51a6fd0de1ddf31d83ad0f64bc7581e2de194025` | 2026-10-17 13:56:28 | feat(mobility): design server-only AUTO demo trip SQL state machine and audited atomic assignment for CI |
| 599 | `98211d1a6f89e37aad728b16365cde317a7d45c8` | 2026-10-17 13:53:33 | docs(mobility): G3 real AUTO trip vertical-slice acceptance gates and current offline guided demo |
| 600 | `062376d08540ef282f9ebeff2ce061cc0b25dc6d` | 2026-10-17 13:51:48 | fix(mobility): Node strip-types resolves guided ride domain import with explicit .ts |
| 601 | `8c68d2c282251fcc821274502e935b6ce7aa7679` | 2026-10-17 13:51:06 | feat(mobility): link driver view to same-device six-step ride test |
| 602 | `73d744d8ad36b3fb3bd17eeec6d582daba5dd3b0` | 2026-10-17 13:50:54 | feat(mobility): let passenger switch to guided same-device trip QA journey |
| 603 | `ef56ea476ba14c8f9af6d6a02f253278fe077b8c` | 2026-10-17 13:50:37 | feat(mobility): expose guided complete trip walkthrough from home screen |
| 604 | `57ba84b2595d14846b2648f69242dda6d988e00c` | 2026-10-17 13:50:18 | feat(mobility): Expo same-device six-step guided rider-driver journey and zero-payment receipt |
| 605 | `9bd07bf76c005acfa0581ae1b2f3c168235694fd` | 2026-10-17 13:49:42 | test(mobility): complete passenger-to-driver offline ride E2E, cancellation and no payment gates |
| 606 | `4973c61b8bf2af05322ae034a9ca02925541fdb2` | 2026-10-17 13:48:58 | feat(mobility): reusable offline six-step passenger-driver journey contract for guided Expo walkthrough |
| 607 | `08c982d5e41a269359442218b2d6f7391483032a` | 2026-10-17 12:26:49 | docs(mobility): handoff G2 dual authorization, bounded rate limits and unchanged remote RLS |
| 608 | `496baf04d1008f38a7b59cba9671c5af609f148d` | 2026-10-17 12:25:59 | docs(mobility): record dual admin authorization and bounded staging gateway rate limits |
| 609 | `4c056708f8644704728362268fd7b4e1b2a955e8` | 2026-10-17 12:24:45 | test(mobility): strict boolean authorization and rate limiter deny accidental truthy bypass |
| 610 | `9f94b46d2bef49a49b8b19a5bb32be7be69b7b86` | 2026-10-17 12:23:53 | security(mobility): fail closed on non-boolean rate-limit decisions |
| 611 | `8ee9a61f3c72668c1c2d2802125e78977494c0f7` | 2026-10-17 12:23:16 | test(mobility): admin double-check, safe 429, limiter saturation and fail-closed policies |
| 612 | `2d70cc4caae3c5e10b1a9feb2f56b24fc1ea070d` | 2026-10-17 12:22:39 | security(mobility): double-check admin role via server SQL and bound local request rates |
| 613 | `f7f1b7d2ab83cef6e136f004f09756cab8acb532` | 2026-10-17 12:22:20 | security(mobility): require server admin-role check and bounded per-actor rate limit before privileged RPC |
| 614 | `ea82f4960d4b211a9af4ffd92a700269742c70da` | 2026-10-17 10:45:26 | docs(mobility): certify 107 offline tests, remote staging unchanged and Lovable credits blocking Auth check |
| 615 | `a1d90ef7628e5d8523345a096c8d07512d97d640` | 2026-10-17 10:43:51 | docs(mobility): handoff two-fixture Storage REST proof, mandatory Auth signup gate and no-live boundary |
| 616 | `1031d1d61ee4102dfe50f2e7002afb0260bd9f68` | 2026-10-17 10:43:00 | test(mobility): guard real Auth and Storage JWT E2E against open signup configuration |
| 617 | `17353bcf34f5cad45c85fc04fba5df6ce0104a9b` | 2026-10-17 10:42:37 | fix(mobility): enforce real Auth invite-only policy before test account login |
| 618 | `22d2d6e9f6b660c1c3ad0cae08b58d5efd4f45a2` | 2026-10-17 10:42:21 | fix(mobility): block real Storage REST login until server signup API is invite-only |
| 619 | `7240cf006ad758acc5d2c922eb9f1891e6c03ab4` | 2026-10-17 10:41:35 | docs(mobility): exact fail-closed procedure for two-user Storage REST E2E with synthetic evidence and no writes |
| 620 | `769584e41eb97f192ca9ab101250582889bc773f` | 2026-10-17 10:39:58 | ci(mobility): enforce offline cross-account Storage REST proof and no-write synthetic fixture gate |
| 621 | `6ab2b268a7044a965e31ae8758aeb6fe51d3185f` | 2026-10-17 10:39:42 | fix(mobility): require unmistakable SYNTHETIC fixture filename in Storage E2E gate |
| 622 | `74c16f7840cc1ed9bdf29c42aa36603f3f88660b` | 2026-10-17 10:39:18 | test(mobility): prove Storage REST smoke checks owner success, cross-read leaks and false-green 404 |
| 623 | `c83b2d4f0b2e0043e41ee6cfd16dc4b29629c19a` | 2026-10-17 10:38:44 | fix(mobility): correct UUID grammar in remote Storage isolation fixture guard |
| 624 | `ee4b2a0cb7b88220197f36a084ec48d9284b2ae0` | 2026-10-17 10:38:20 | feat(mobility): prepare fail-closed two-account Supabase Storage REST isolation smoke without writes |
| 625 | `cc9899bfbf013e9fccacfa638745c92862f64d50` | 2026-10-17 05:14:03 | docs(mobility): handoff new no-live pricing laboratory and Auth signup policy gate |
| 626 | `1f9864cbe9b33b546a4eaddd214dc8eb921a31e3` | 2026-10-17 05:13:31 | docs(mobility): Auth signup policy gate and no-live fare lab operator runbook |
| 627 | `1602ce7259a057214c511f9fd74f110ebd9f27e2` | 2026-10-17 05:12:48 | ci(mobility): verify new no-live fare tests and fail-closed Auth signup preflight |
| 628 | `f9077fa086274d27c1627772790eec9d37c1753c` | 2026-10-17 05:12:34 | test(mobility): staging signup-policy fail-closed remote probe without users or keys in logs |
| 629 | `4e6dc62d017e223b891fc33864e6a2bf7aa5e011` | 2026-10-17 05:12:16 | feat(mobility): readonly Supabase staging signup-policy gate blocks invite-only certification when open |
| 630 | `807d0ea7b4c90307e913983e09ab23ca335bdc64` | 2026-10-17 05:11:58 | test(mobility): pricing lab PYG rounding, driver gross, invalid routes and MOTO no-live |
| 631 | `3768089abbec9372c65b073b86c1b591a32b7b9b` | 2026-10-17 05:11:38 | feat(mobility): server-policy-independent integer PYG tariff simulator with no-live invariant |
| 632 | `4c34a25cd120afdee9ffcb86a2a005b67b326664` | 2026-10-17 05:01:32 | docs(mobility): handoff remote G2 pending inventory, fixed service grants and blocked Auth gate |
| 633 | `cbac03b08cc4b2521f3458311ceaaceb75ce01e5` | 2026-10-17 05:00:56 | docs(mobility): record actual staging pending inventory deployment and repaired default grants |
| 634 | `86ac8d00e600acf56748b014011f40a2b326f009` | 2026-10-17 05:00:08 | test(mobility): staged inventory endpoint anti-spoof, fail-closed admin and no-commercial response |
| 635 | `4acbce38180b9548eb76826b70a7aafc59e7df36` | 2026-10-17 04:59:48 | feat(mobility): wire pending inventory RPC only to localhost server adapter |
| 636 | `08fb47dde239cb907ed1fe72248686eb17f8244e` | 2026-10-17 04:59:37 | feat(mobility): JWT-bound staging-only pending inventory endpoint, admin SQL role gate |
| 637 | `17a7fdb3c5dfff7e6f81d1d56be0123d313a1de8` | 2026-10-17 04:58:19 | fix(mobility): versioned staging ACL backfill for immutable vehicle applications |
| 638 | `a87966e5e7d52f9a89b079f946ffefc90977cf9c` | 2026-10-17 04:58:05 | fix(mobility): revoke Supabase service_role default UPDATE/DELETE on immutable draft intake |
| 639 | `c4ac5082ff25be745655f1c0bf10127e676c57ba` | 2026-10-17 04:56:25 | fix(mobility): transaction advisory lock preserves SELECT-only intake grants |
| 640 | `3f33676b92d0747ad1d93333b3083b45644ea27e` | 2026-10-17 04:55:33 | test(mobility): G2 pending vehicle inventory integration and negative role/duplicate/moto gates |
| 641 | `b9dba92ce32a0f998b5221e2087adad71094a252` | 2026-10-17 04:55:01 | feat(mobility): staging-only admin audited pending vehicle materialization with idempotency |
| 642 | `7b4fb929bb555e42e7e1042d62b183eafd3fe2fd` | 2026-10-17 04:44:56 | docs(mobility): handoff Lovable Auth staging console and uncovered public signup config gate |
| 643 | `7240f737c2300cd2bd27ea9bfd49448fb9f99af3` | 2026-10-17 04:44:37 | docs(mobility): record Lovable staging Auth console, RLS read-only UI and signup API security gate |
| 644 | `52f62b29b8ec6fc7b536c4c82ed1d762f0f291da` | 2026-10-17 03:09:33 | docs(mobility): handoff remote staging ACL audit, private evidence bucket and motorcycle Expo precheck |
| 645 | `2e50b2e2d661901d7b8b597da4181be9f8042cd2` | 2026-10-17 03:08:52 | ci(mobility): syntax-check staging Auth and local server without credentials |
| 646 | `e1b6d54a9f4acc5e83f97ee9902839d1261d9154` | 2026-10-17 03:08:34 | test(mobility): prepare real staging JWT role isolation and anti-impersonation smoke |
| 647 | `a9ecf89cb735f20aae006d923fbb43f9e2354515` | 2026-10-17 03:07:22 | test(mobility): exercise private document RLS across synthetic drivers in ephemeral PostgreSQL |
| 648 | `83748e6b15fc5596aeb6535ae0902dc0b30ba2d5` | 2026-10-17 03:06:46 | test(mobility): bootstrap disposable Supabase Storage contract for real RLS SQL assertions |
| 649 | `7ba4ffdcc200bc55e47377ad82092cd8bbfb16c9` | 2026-10-17 03:05:42 | docs(mobility): attest applied private staging evidence bucket with real Postgres policies |
| 650 | `8deaff6c4e5445df0c2470a77d51faced672a2d1` | 2026-10-17 03:04:52 | test(mobility): enforce staging storage owner-only RLS, private MIME and no-delete policy |
| 651 | `c5fc5aaa937f51cdc587157bb178ebf61a5e717f` | 2026-10-17 03:03:50 | feat(mobility): create locked private staging license bucket with owner-only RLS and 5MiB MIME limits |
| 652 | `842367e696ec860ce25c32e3da1c9f7c73c6c1bb` | 2026-10-17 03:02:31 | feat(mobility): expose moto research checklist from driver registration without enrollment |
| 653 | `eda69b6e45345c8f4a265ae9a3546eafee72d1f4` | 2026-10-17 03:02:19 | feat(mobility): add Moto requirements precheck screen in Expo without storing personal data |
| 654 | `ac14e079e97112c96d5d9897bb4cd6af3cda8dc7` | 2026-10-17 03:02:00 | test(mobility): motorcycle document checklist remains noncommercial in every state |
| 655 | `18149a2c5ad8f78ceb15efc70989e931f2a4a48a` | 2026-10-17 03:01:46 | feat(mobility): add no-PII motorcycle onboarding precheck, always NO LIVE |
| 656 | `fa72011a7436b28c00f5ee14070ec18b85f63b66` | 2026-10-16 23:35:45 | docs(mobility): correct front-matter to reflect real applied G1/G2 and lockdown |
| 657 | `024e1218d34ef189c0354fc8d6bffe5538c035f4` | 2026-10-16 23:35:42 | docs(mobility): correct front-matter to reflect real applied G1/G2 and lockdown |
| 658 | `05c3aea303a42861ba02741b3cd308df0586770b` | 2026-10-16 23:35:39 | docs(mobility): correct front-matter to reflect real applied G1/G2 and lockdown |
| 659 | `41ee81c62b62bfe42aabc94d8cadf53ae3e1691c` | 2026-10-16 23:34:45 | docs(mobility): handoff live bucket MIME hardening applied, G1 G2 staging separated |
| 660 | `0ae426f44a4da080c985e1e326913bf4e1cda12f` | 2026-10-16 23:34:15 | docs(mobility): clarify P0 RPC lockdown applied and isolated staging G2 installed |
| 661 | `2e8e3ddd7956a966c062be25bd1694cf27918ae7` | 2026-10-16 23:34:12 | docs(mobility): mark driver-docs JPEG/PNG 5MiB live migration applied and verified |
| 662 | `9e5dc133b3564c92c65e5e5f556f6e5b27c02d7b` | 2026-10-16 23:32:53 | docs(mobility): handoff G1/G2 Supabase staging migrations applied and postconditions verified |
| 663 | `25386bcb7ae2325e94f3ca83d5a4a9945633e99b` | 2026-10-16 23:32:35 | docs(mobility): attest remote staging G1 + atomic G2 install with nine tables and deny-by-default grants |
| 664 | `64bddc655fdc2f97100e798c52c9c76f7c1fa296` | 2026-10-16 23:29:26 | docs(mobility): handoff G1 isolated Supabase enabled and clean, gateway tested, SQL quota pending |
| 665 | `4cba77a5a0d4bf8f6a5ba2bd252d575eb07a75df` | 2026-10-16 23:28:35 | docs(mobility): confirm staging Supabase enabled, empty schema, G1 SQL rate-limited not applied |
| 666 | `dc773b5ded191acbd995dccee6c28f3ef392248a` | 2026-10-16 23:25:45 | docs(mobility): isolated Supabase staging DDL order, JWT gateway and fail-closed rollout criteria |
| 667 | `630c882217f31a0e633f678669d4651c2f6b6cd2` | 2026-10-16 23:24:38 | test(mobility): run staging identity baseline in Postgres, verify signup defaults and RLS |
| 668 | `86894a03c249b9373396103963e60ac4209efd69` | 2026-10-16 23:24:11 | feat(mobility): fresh staging-only Supabase identity baseline with private profiles and default passenger |
| 669 | `b59f87978be504e82ae3642183491b6e79405525` | 2026-10-16 23:23:06 | ci(mobility): exercise staged server JWT identity guard and no-self-approval gateway |
| 670 | `d88c04032b36b3b4f14305a66868a1b654445652` | 2026-10-16 23:22:56 | feat(mobility): local-only Supabase Auth-verified gateway, service key never in Expo |
| 671 | `af2013bef77bdec054db76022a4f72f4092a3022` | 2026-10-16 23:22:23 | test(mobility): reject JWT spoofing, self-approval, unsafe fields and non-staging routes |
| 672 | `35e482821c576f13300f625db5f93631014d80aa` | 2026-10-16 23:21:49 | feat(mobility): fail-closed server-side staging gateway binds JWT identity to vehicle intake and review |
| 673 | `14b679a0cf970f33b1f97fdb82c239d785280a66` | 2026-10-16 23:09:23 | docs(mobility): handoff validated staging-only intake, reviewer audit and DB blockers |
| 674 | `9b4788c02beacd45fc8d0fb80c29448da08ebe21` | 2026-10-16 23:08:57 | docs(mobility): record staged vehicle intake and PostgreSQL idempotency/visibility gates |
| 675 | `4b6499afb807654a64ef7acc630cf3b5496103dd` | 2026-10-16 23:08:03 | test(mobility): verify pending-only vehicle applications and JWT isolation in PostgreSQL |
| 676 | `6de6a158f1adcb2b3ac704a8974e7440dcf373d8` | 2026-10-16 23:07:36 | feat(mobility): staging-only idempotent vehicle draft intake, no client write or self-approval |
| 677 | `3218996b63608cb81cd5ca127adebac3c3d601b1` | 2026-10-16 23:06:15 | docs(mobility): handoff new staging shell, PostgreSQL G2 review and live gates |
| 678 | `db4e8a40a867d53cfc748a79a352525dbf9f0b0d` | 2026-10-16 23:05:48 | docs(mobility): record new isolated Lovable staging, blocked DB quota and passing Postgres gate |
| 679 | `49eeb7d036891ef787bd0f2caaa2fe948e0c9ba4` | 2026-10-16 23:04:20 | test(mobility): validate audited idempotent review on disposable PostgreSQL |
| 680 | `71facb9dd74727ae6bcee6b422d0e95e0a83df5b` | 2026-10-16 23:03:46 | feat(mobility): staged admin-only audited review with idempotency, no MOTO approval |
| 681 | `39c52e3e7e9e0629955c9d5d3da5e1f0d67b098e` | 2026-10-16 23:02:08 | ci(mobility): run isolated PostgreSQL RLS integration gate for G2 staged SQL |
| 682 | `cad72775e467c83c8584c8f9e93eeeff4b9ddd5b` | 2026-10-16 23:01:43 | test(mobility): exercise G2 schema and RPC on ephemeral PostgreSQL with adversarial RLS |
| 683 | `a0eab2bd75d6de85aa22e3fc589dfc76b6f0df20` | 2026-10-16 23:00:52 | feat(mobility): staging-only SECURITY INVOKER preflight with audited evidence and GPS consent |
| 684 | `5e2c80499a4841538b022eae9a44311c2c6d8e25` | 2026-10-16 22:52:59 | docs(mobility): handoff G2 staged car/moto schema, legal age/vests and blocked Lovable MIME quota |
| 685 | `5509d9ccfbccee13ed5b0e002fd8bdce99e80ac1` | 2026-10-16 22:52:28 | test(mobility): document vest-reviewed field in G2 schema gate |
| 686 | `0553c8a29ea40e0b918ab4bf9d3baebacde1106f` | 2026-10-16 22:52:22 | feat(mobility): add reviewed reflective-vest counts to staged moto evidence |
| 687 | `4107e617a433dac5a659e26d733616ff819fb88e` | 2026-10-16 22:52:14 | test(mobility): enforce two reflective vests before moto application draft |
| 688 | `9439a33bedd906b76d7b0baf219cb02af5544f5c` | 2026-10-16 22:52:06 | safety(mobility): require reflective-vest draft evidence for MOTO applicants |
| 689 | `c9968e106c346aecdee4506f774f48626d20a046` | 2026-10-16 22:51:55 | test(mobility): cover Paraguay motorcycle vest and minor age prohibitions |
| 690 | `135a151f1fc42875f78cf0ec54ab428d3beb3c1d` | 2026-10-16 22:51:53 | test(mobility): cover Paraguay motorcycle vest and minor age prohibitions |
| 691 | `bb3561feb651943ce4dc833d930138b3b62273ef` | 2026-10-16 22:51:41 | safety(mobility): require two reflective vests and 12+ passenger eligibility on moto |
| 692 | `712f6a592b5930ca63794b2fc6d1443637d1208d` | 2026-10-16 22:51:32 | docs(mobility): cite Paraguay Law 5016 helmet, reflective vest, age and motorcycle permit gates |
| 693 | `8939cb339d3aa71612148294a19ca67f8876d872` | 2026-10-16 22:49:45 | test(mobility): distinguish impersonation from passenger self-assignment denial |
| 694 | `802ec0b7a7c87455fd4e7a67b3924a0911e9e120` | 2026-10-16 22:49:26 | test(mobility): AUTO/MOTO applicant draft, capacity, documents, and deny-by-default |
| 695 | `62f5cd1c265b6f69639ac25ad7e855484a3680b2` | 2026-10-16 22:49:11 | feat(mobility): prepare AUTO/MOTO application drafts without client-side approval |
| 696 | `aece45cf20fd6a869708c2b21da19db636eb7ae0` | 2026-10-16 22:48:08 | test(mobility): guard ownership, service mix-ups, expiry, GPS and versions |
| 697 | `cd45c9a11a4ca6fdc09c577a4070eb89427b31e0` | 2026-10-16 22:47:49 | feat(mobility): fail-closed vehicle-specific assignment proposal for G2 |
| 698 | `1d821622e16cd03cc4b287bed536b603d6b07ca9` | 2026-10-16 22:47:29 | test(mobility): G2 staging schema rejects cross-mode and self-approval grants |
| 699 | `9531456e7ca73cd5ee37eb2669812c511fb39955` | 2026-10-16 22:47:16 | docs(mobility): define staged AUTO/MOTO legal and server-side approval contract |
| 700 | `5fdb816c3ee76cff14d372cf1406c4b39870d20a` | 2026-10-16 22:46:42 | feat(mobility): stage-only AUTO/MOTO compliance tables with RLS and no public writes |
| 701 | `d9183580f9f864fc6a5dbd9c7361f069488b84b4` | 2026-10-16 22:38:51 | docs(mobility): record 46 passing tests, applied RPC freeze and deferred MIME migration |
| 702 | `66dd2923954887edf25f85db09462b70d07e9996` | 2026-10-16 22:37:19 | test(mobility): match exact 5MiB rejection message |
| 703 | `7e490b17668b492777802b568c1f68e5f2441bd9` | 2026-10-16 22:36:09 | security(mobility): align license uploads to private 5MiB bucket and JPG/PNG constraints |
| 704 | `2e4752f82f02ba04fb7b0533459a556d3f7484b9` | 2026-10-16 22:34:17 | docs(mobility): record applied RPC lockdown and 8/8 verified grants on Lovable DB |
| 705 | `88d11a5998b137b0eba1fb413ee24a64653670c7` | 2026-10-16 22:33:32 | security(mobility): reject secret Supabase keys in Expo public client config |
| 706 | `cb6cf33d439b8a3565efd30b0edb247d079d00ec` | 2026-10-16 22:30:52 | fix(mobility): terminate PL/pgSQL guard block before execution |
| 707 | `05ccb2c7ac5e331fcdd946f0700296f443c6aad5` | 2026-10-16 22:30:28 | test(mobility): support zero-argument RPC signatures in security assertions |
| 708 | `340188b79270bfa6d4929c53f487c769f8dce2f3` | 2026-10-16 22:29:27 | security(mobility): version SQL RPC freeze and restrict helper role enumeration |
| 709 | `73ca5ae36e8c40d81eccb3fdbcd3e7d9de7c1349` | 2026-10-16 05:04:06 | docs(mobility): update G0-G2 continuity and verified CI with SQL audit findings |
| 710 | `29869c761b29999649f7743c225853cd70dfc45b` | 2026-10-16 05:02:55 | docs(mobility): preserve Lovable SQL baseline and record P0 auth/dispatch audit |
| 711 | `34833296981616ed102f9af9e94914cf4068fedc` | 2026-10-16 05:00:23 | fix(mobility): validate license image format and MIME before private upload |
| 712 | `017e5c4f4db3b156e911c7a25b0b0fb09de47b3b` | 2026-10-16 04:57:59 | test(mobility): auto/moto eligibility guards and read-only staging RLS smoke harness |
| 713 | `ecea25e58edc4fb4a8df17e1066616068d079883` | 2026-10-16 04:54:52 | feat(mobility): isolate Expo under apps/mobility-expo with independent CI and G0 safeguards |
| 714 | `ef059e1132b10ce3adf1f3f6bc1f84e8ce529ad6` | 2026-08-06 03:19:20 | Initial commit |
