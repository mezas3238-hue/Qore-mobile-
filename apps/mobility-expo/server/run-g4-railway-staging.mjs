/**
 * Railway STAGING ONLY. Requires an actual Railway environment named staging.
 * This file does not connect GitHub, create services or trigger deployments.
 */
import {startQoreG4CloudStaging} from './g4-cloud-staging-launcher.mjs';
await startQoreG4CloudStaging('railway');
