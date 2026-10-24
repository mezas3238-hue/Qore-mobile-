export type SecureCancellationKeyResult=
 |Readonly<{ok:true;requestKey:string}>
 |Readonly<{ok:false;code:'SECURE_RANDOM_UNAVAILABLE'}>;
/** CSPRNG provisto por expo-crypto. La ausencia del SO bloquea la acción. */
export declare function createSecureCancellationKey(
 randomUUID?:(()=>unknown)|null
):SecureCancellationKeyResult;
