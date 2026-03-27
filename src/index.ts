// Shield console.log so that dependencies don't break JSON-RPC stdio
console.log = console.error;

import { startStdioServer } from "./transports/stdio.js";

startStdioServer().catch((error) => {
  console.error("Server encountered an error:", error);
  process.exit(1);
});
