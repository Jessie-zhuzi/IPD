import { createApp } from "./app";
import { env } from "./config";

const app = createApp();
app.listen(env.PORT, env.HOST, () => {
  console.log(`[api] listening on http://${env.HOST}:${env.PORT}`);
});
