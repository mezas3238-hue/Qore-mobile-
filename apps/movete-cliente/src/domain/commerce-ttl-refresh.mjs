/**
 * R47 - Pure scheduling policy for hiding verified commerce data on expiry.
 * This controls only UI visibility, never renews a server authorization.
 */
const MAX_TIMER_DELAY=2147483647;
export function commerceExpiryRefreshDelay(expiresAt,now=Date.now()){
 if(!Number.isSafeInteger(expiresAt)||expiresAt<=0
  ||!Number.isSafeInteger(now)||now<0)return null;
 if(expiresAt<=now)return 0;
 return Math.min(MAX_TIMER_DELAY,Math.max(1,expiresAt-now+1));
}
export function isCommercePageFresh(expiresAt,now=Date.now()){
 return Number.isSafeInteger(expiresAt)&&expiresAt>now
  &&Number.isSafeInteger(now)&&now>=0;
}
