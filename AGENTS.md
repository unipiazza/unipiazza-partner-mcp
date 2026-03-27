# Repository Guidelines

## Project Structure & Module Organization
Source lives in `src/`; compiled output goes to `build/`. The runtime entrypoint is `src/index.ts`, while `src/server.ts` contains the MCP server construction and request handler logic so it can be tested without starting stdio. Shared HTTP access is in `src/api-client.ts`, and domain tools are grouped under `src/tools/` (`shop.ts`, `users.ts`, `campaigns.ts`, `stats.ts`, `boosters.ts`, `loyalty.ts`, `system.ts`). `src/tools/index.ts` aggregates tool definitions and handlers. Tests live under `test/`. Runtime configuration is loaded from `.env`. Treat `build/` as generated output: edit `src/`, then rebuild.

## Build, Test, and Development Commands
- `npm run build`: compile TypeScript from `src/` into `build/` with `tsc`.
- `npm start`: run the compiled MCP server with `node --env-file=.env build/index.js`.
- `npm run setup`: run the setup flow that generates or stores `PARTNER_API_KEY` in `.env`.
- `npm test`: run the automated test suite with Vitest.
- `npm run test:watch`: run tests in watch mode during development.
- `npm run test:coverage`: run tests with V8 coverage reporting.

Build before starting the server because execution happens from `build/`, not directly from TypeScript sources. For normal validation after code changes, run `npm test` and `npm run build`.

## Environment
`.env` should contain:

```dotenv
PARTNER_API_KEY=unp_...
API_BASE_URL=http://localhost:5000
```

`PARTNER_API_KEY` is required for authenticated requests. `API_BASE_URL` is optional and defaults to `http://localhost:5000`.

## Architecture
This is a read-only MCP server that exposes Unipiazza loyalty platform data to AI clients over the MCP stdio transport.

### Request Flow
`MCP client -> stdio -> src/index.ts -> src/server.ts -> allHandlers[toolName](args) -> mcpClient.get(...) -> /api/partner/mcp/*`

### Tool Module Pattern
Each domain module under `src/tools/` exports:
- `*Tools: Tool[]` with MCP tool definitions and JSON schema
- `*Handlers: Record<string, (args) => Promise<string>>` with one async handler per tool

`src/tools/index.ts` merges all modules into `allTools` and `allHandlers`.

### Multi-Shop Authentication
This server uses a user-level `PARTNER_API_KEY`, not a shop-bound key. The selected shop is passed through:
- `shop_id` in MCP tool arguments
- the `Accept: sid=<shop_id>` header forwarded by `mcpClient.get()`

Preserve this behavior when adding or refactoring handlers. Use `list_shops` first to discover available shop IDs.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode assumptions. Match the existing style in `src/` and preserve current formatting when editing files. Use `camelCase` for variables and functions, `UPPER_SNAKE_CASE` for env constants, and keep one tool domain per file under `src/tools/`. Export `tools` and `handlers` from each domain module, and keep handlers returning `Promise<string>` with JSON-serialized payloads.

## Testing Guidelines
Automated tests are configured with Vitest under `test/`. Current coverage focuses on:
- `src/api-client.ts` request construction and API error wrapping
- handler behavior in representative tool modules
- registry integrity between `allTools` and `allHandlers`
- MCP dispatcher behavior in `src/server.ts`

When adding new tools or changing request-building logic, add or update focused tests in `test/`. Prefer testing:
- generated path and query string
- forwarding of `shop_id`
- required argument checks
- error propagation or wrapping

`npm run build` is still required as a final verification because the published server runs from `build/`, not directly from TypeScript sources.

## Adding A New Tool
1. Add the tool definition to the appropriate `src/tools/<domain>.ts` file, or create a new domain file.
2. Add the matching handler in the same file.
3. Export the module from `src/tools/index.ts` if it is a new domain file.
4. Add or update tests covering the new handler behavior.
5. Run `npm test` and `npm run build`.

## Commit & Pull Request Guidelines
Git history is not available in this workspace snapshot, so follow a simple imperative style such as `Add loyalty tool pagination` or `Fix shop header forwarding`. Keep commits focused on one change. Pull requests should include a short summary, impacted tool modules, required env changes, and the exact verification command(s) run. Include sample request/response snippets when changing tool schemas or API behavior.

## Security & Configuration Tips
Never commit real API keys. Keep `.env` local only. This server is read-only and forwards `shop_id` through the `Accept: sid=<shop_id>` header, so preserve that behavior when adding new handlers.
