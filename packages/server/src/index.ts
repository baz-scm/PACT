import path from 'path';
import { createApp } from './app';
import { SqliteStorage } from './storage/sqlite';
import { loadConfig } from './config';

const config = loadConfig();

const dbPath = path.join(config.dataDir, 'pact.db');
const storage = new SqliteStorage(dbPath);
const app = createApp(storage, config.plansTtlHours);

const sweep = () => {
  const n = storage.expirePlans();
  if (n > 0) console.log(`[sweep] deleted ${n} expired plan(s)`);
};
setInterval(sweep, config.sweepIntervalMs);

app.listen(config.port, () => {
  console.log(`pact server listening on :${config.port}`);
});
