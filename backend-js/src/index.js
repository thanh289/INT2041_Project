import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { initDb } from "./db.js";

const config = loadConfig();
await initDb(config);
const app = createApp(config);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend-js] listening on http://localhost:${config.port}`);
});
