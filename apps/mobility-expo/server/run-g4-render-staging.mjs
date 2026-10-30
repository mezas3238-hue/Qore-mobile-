/**
 * Render STAGING entrypoint, preserved for existing CI and infrastructure.
 * No LIVE behavior; all provider gates are shared with Railway.
 */
import {startQoreG4CloudStaging} from './g4-cloud-staging-launcher.mjs';
await startQoreG4CloudStaging('render');
