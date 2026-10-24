// SDK Map key is injected at build time from a restricted EAS environment variable.
// No API keys or backend service-role secrets belong in Git.
const { expo } = require('./app.json');
const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
module.exports = () => ({
  ...expo,
  android: { ...expo.android, ...(androidMapsKey ? { config: { googleMaps: { apiKey: androidMapsKey } } } : {}) },
  extra: { mapsEnabled: Boolean(androidMapsKey) },
});
