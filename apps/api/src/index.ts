import { buildServer } from "./server.js";

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "0.0.0.0";

const app = buildServer();
app
  .listen({ port, host })
  .then(() => console.log(`[nivar-api] listening on http://${host}:${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
