/** Web or unsupported platform: no simulated native map or route. */
import type {PassengerPlace} from './native/client-location';
type Props={pickup:PassengerPlace|null;destination:PassengerPlace|null;enabled:boolean};
export function PassengerRoutePreview(_props:Props){return null;}
