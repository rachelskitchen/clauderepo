try {
  // Loads .env in local/dev/test environments; in production real env vars are injected directly.
  process.loadEnvFile();
} catch {
  // no .env file present — fall back to whatever is already in process.env
}
