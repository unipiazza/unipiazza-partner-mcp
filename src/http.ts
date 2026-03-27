import { startRemoteHttpServer } from "./transports/http.js";

startRemoteHttpServer().catch((error) => {
  console.error("HTTP server encountered an error:", error);
  process.exit(1);
});
