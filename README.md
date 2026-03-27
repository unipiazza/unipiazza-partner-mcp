# Unipiazza MCP Server

Read-only Model Context Protocol (MCP) server for accessing Unipiazza loyalty platform data from AI clients over stdio or remote HTTP.

This project exposes shop, customer, campaign, loyalty, and analytics data through a structured MCP tool surface backed by the Unipiazza Partner API.

## Overview

- Read-only MCP server built with TypeScript
- Uses a user-level `PARTNER_API_KEY`
- Supports multi-shop access through `shop_id`
- Talks to the backend Partner API under `/api/partner/mcp/*`
- Designed to be embedded in AI workflows and MCP-compatible clients
- Supports both local `stdio` and self-hosted remote HTTP transports

## Features

- Discover accessible shops with `list_shops`
- Inspect shop details and reward products
- Browse customers, search users, and inspect user history
- Read aggregate analytics and date-filtered KPIs
- Inspect marketing campaigns and automatic promotions
- Read booster, wallet, gift card, and subscription data

## Architecture

Request flow:

`MCP client -> stdio|HTTP -> transport -> MCP core -> tool handler -> src/api-client.ts -> /api/partner/mcp/*`

Multi-shop behavior:

- Authentication uses a user-level `PARTNER_API_KEY`
- The selected shop is forwarded through the `Accept: sid=<shop_id>` header
- Call `list_shops` first, then pass `shop_id` to the other tools

## Requirements

- A Unipiazza Partner account with access to one or more shops
- Access to a Unipiazza backend exposing the Partner MCP API

## Getting Started

### 1. MCP client integration

The main use case for this repository is connecting Unipiazza data to an MCP-compatible AI client so the model can query structured business data through tools instead of relying on pasted reports or ad-hoc exports.

Typical scenarios include:

- a local desktop MCP client that launches the server over `stdio`
- a hosted or browser-based MCP client that connects to a remote HTTP endpoint
- an internal AI environment that supports MCP tool calls

Suggested first steps in a new MCP session:

1. Call `list_shops` to discover which shops the current authentication context can access.
2. Choose a `shop_id` from the result.
3. Call the domain tools needed for users, campaigns, loyalty, and analytics.

Examples of questions an MCP client could answer with this server:

- "Which shops can this account access?"
- "Show me customers with birthdays this month for this shop."
- "Summarize the main KPIs for this location."
- "List recent campaigns and compare them with autopromo metrics."
- "Explain the active rewards, boosters, and subscription setup for this shop."

This section is intentionally an early draft. The exact configuration syntax varies across MCP clients, and broader client-by-client setup examples still need validation.

### 2. Local stdio mode

Use local `stdio` mode when your MCP client can launch a command on the same machine where this repository is installed.

Requirements for this mode:

- Node.js 20+ recommended
- A valid `PARTNER_API_KEY` (or generate it, see below)

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Set:

```dotenv
PARTNER_API_KEY=unp_your_key_here
API_BASE_URL=https://api.unipiazza.it
```

Build the project:

```bash
npm run build
```

Start the MCP server over stdio:

```bash
npm start
```

If you need to generate or store a key through the backend auth flow:

```bash
npm run setup
```

### 3. Remote HTTP mode

Use remote HTTP mode when your MCP client runs outside your machine, when you want a centrally hosted MCP endpoint, or when local command execution is not practical.

Requirements for this mode:

- Node.js 20+ recommended
- A deployable environment for the HTTP server
- Access to the Unipiazza Partner MCP API from the host environment

Build the project and start the remote transport:

```bash
npm run build
npm run start:http
```

The remote server exposes:

- `POST /mcp`
- `GET /health`
- `GET /authorize`
- `POST /token`
- `POST /register`
- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-protected-resource/mcp`

Remote mode supports OAuth for hosted MCP clients. The server exposes a standard OAuth authorization server surface for ChatGPT, Claude, and other MCP clients, while internally reusing the existing Unipiazza MCP authorization flow (`auth/init` -> frontend `/mcp-auth` -> `auth/poll`).

Important:

- Local `stdio` mode still supports manual `PARTNER_API_KEY` in `.env`
- `npm run setup` still works for local `stdio` mode exactly as before
- Remote OAuth issues bearer access tokens for `/mcp`
- Legacy direct bearer usage with an existing `unp_...` MCP API key is still accepted for compatibility
- Remote OAuth storage can run in memory or on Redis

For deployed remote usage you should set:

```dotenv
PUBLIC_BASE_URL=https://your-mcp.example.com
HOST=127.0.0.1
PORT=3001
ALLOWED_HOSTS=your-mcp.example.com,localhost,127.0.0.1
```

`PUBLIC_BASE_URL` must be the externally reachable base URL used by OAuth clients. In production it should be HTTPS.

`ALLOWED_HOSTS` controls the host header validation enforced by the MCP Express transport. Set it to the public hostname used by clients and reverse proxies such as Nginx or Cloudflare. Keeping `HOST=127.0.0.1` is still recommended when the Node process sits behind a reverse proxy on the same machine.

To persist remote OAuth sessions across MCP server restarts, enable Redis:

```dotenv
OAUTH_STORE=redis
REDIS_URL=redis://your-redis-host:6379/0
OAUTH_REDIS_PREFIX=mcp_oauth
```

If `OAUTH_STORE` is left as `memory`, remote OAuth tokens are stored only in-process and users may need to re-authenticate after a server restart.

Operational notes for Redis are documented in [docs/redis-oauth.md](docs/redis-oauth.md).

## Choosing A Mode

- Use MCP client integration when you want an AI client to call the tools directly.
- Use local `stdio` mode when the MCP client can launch a local command on your machine.
- Use remote HTTP mode when the MCP client runs outside your machine or when you want a centrally hosted endpoint.

In practice, local `stdio` mode and remote HTTP mode expose the same MCP tools. The main difference is the transport and authentication flow.

## Available Tools

### System

- `list_shops`: Lists all shops accessible with the current authentication context. This is the recommended starting point for every MCP session because most other tools require a `shop_id`, and this tool tells the client which shop identifiers are valid.
- `get_server_status`: Checks whether the Unipiazza backend is reachable for a specific shop context. It is useful for smoke tests, environment validation, and quick troubleshooting when a client needs to confirm that the selected shop can be queried successfully.

### Shop

- `get_shop_details`: Returns the main shop profile and feature configuration for a specific shop. Depending on the backend response, this can include identity, location, app settings, and enabled modules such as subscriptions, boosters, wallets, gift cards, and other active features.
- `get_shop_products`: Returns the reward and product catalog configured for the shop. This is useful when an AI client needs to inspect the current rewards setup, including reward names, points cost, publication state, and optional usage counters within a selected period.

### Users

- `list_users`: Returns a paginated customer list for the selected shop, with optional sorting and filtering. It is the main entry point for browsing the customer base and works well for broad operational questions such as identifying active users, VIP users, recent signups, or inactive segments.
- `search_users`: Searches customers by name, email, or phone. This is the best tool when the user already has a person in mind and wants to quickly locate a matching customer record before drilling into details or history.
- `get_user_details`: Returns the full profile for a specific customer by `user_id`. This is useful for inspecting loyalty balance, registration metadata, profile fields, and other customer-level attributes after a customer has been identified.
- `get_user_history`: Returns the paginated activity history for a specific customer. It helps reconstruct visits, transactions, redemptions, and other timeline-based activity that explains how a customer has interacted with the shop over time.
- `get_users_birthdays`: Returns customers with birthdays, optionally scoped to a specific month. This is especially useful for targeted outreach and birthday campaign planning because it keeps the response focused and easier for an AI client to summarize.
- `get_users_stats`: Returns aggregate customer statistics for the selected shop. This is the fastest way to understand the size and overall health of the customer base without retrieving full customer lists.

### Stats

- `get_stats`: Returns the main overall KPIs for the selected shop. Use it for high-level reporting such as visits, coins issued, active users, and broad trend indicators.
- `get_stats_partial`: Returns KPI data filtered by a date range. This is useful for period-based analysis such as month-over-month reporting, campaign windows, seasonal reviews, or custom date-bound summaries.
- `get_stats_users`: Returns analytics focused on the customer base, such as growth and returning-vs-new dynamics. It is helpful when the AI client needs to discuss customer evolution rather than only raw operational totals.
- `get_stats_timetable`: Returns visit distribution by timetable or hour range. This is useful for identifying peak times, slower periods, and other operational patterns that can influence staffing or campaign timing.

### Campaigns

- `list_marketing_campaigns`: Returns a paginated list of marketing campaigns sent by the shop. It is useful for reviewing campaign history, understanding which channels were used, and comparing delivery or engagement performance across campaigns.
- `get_autopromos`: Returns the automatic promotions configured for the shop. This helps an AI client understand the current automation setup, which lifecycle or behavioral triggers exist, and which promotions are active.
- `get_autopromo_metrics`: Returns performance metrics for automatic promotions, optionally filtered by date range. This is the main analytics tool for evaluating whether automated campaigns are generating engagement, visits, and downstream value.

### Boosters

- `get_boosters`: Returns the booster rules configured for the shop. These rules define temporary or recurring reward multipliers or additions, and the tool is useful when reviewing incentive mechanics such as double-points days or time-slot-based bonuses.

### Loyalty

- `get_wallets`: Returns wallet and gift card data for the selected shop. This is helpful for understanding which stored-value or pass-like loyalty instruments are active and how they are currently being used.
- `get_subscription_products`: Returns the subscription products available in the shop, including product-level information and subscriber-related metrics where available. It is useful for reviewing recurring loyalty offers or prepaid subscription bundles.

## Development

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage:

```bash
npm run test:coverage
```

Build output is generated in `build/`. Edit `src/`, then rebuild before running the server.

## Repository Notes

- `.env` is local-only and must never be committed
- `build/` is generated output
- `node_modules/` and local AI/editor settings are intentionally ignored

## Security

- This repository is intended to stay read-only at the MCP layer
- Do not commit real API keys, session data, or private infrastructure details
- Rotate any key immediately if it is ever committed or exposed

## License

This project is licensed under Apache-2.0. See [LICENSE](LICENSE).
