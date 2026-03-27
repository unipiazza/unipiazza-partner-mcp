# Redis OAuth Persistence

This project can persist remote OAuth state in Redis without changing local `stdio` behavior.

## App Configuration

Set these variables for the remote MCP server:

```dotenv
OAUTH_STORE=redis
REDIS_URL=redis://127.0.0.1:6379/0
OAUTH_REDIS_PREFIX=mcp_oauth
```

Recommended key usage:

- `mcp_oauth:client:*`
- `mcp_oauth:pending:*`
- `mcp_oauth:auth_code:*`
- `mcp_oauth:access_token:*`
- `mcp_oauth:refresh_token:*`

Current TTLs in the app:

- pending authorization: 10 minutes
- authorization code: 2 minutes
- access token: 1 hour
- refresh token: 30 days
- registered OAuth clients: 365 days

## Minimal Redis Persistence

If your Redis instance is currently used only as cache, you can still use it for OAuth state as long as persistence is enabled at server level.

Minimum practical setup in `redis.conf`:

```conf
appendonly yes
appendfsync everysec

save 900 1
save 300 10
save 60 10000
```

What this means:

- `appendonly yes`: enables AOF persistence
- `appendfsync everysec`: good balance between durability and performance
- `save ...`: keeps periodic RDB snapshots as an extra recovery layer

## Mixed Usage With Cache

Using the same Redis for cache and OAuth persistence is acceptable for this project.

Recommended guardrails:

- keep a dedicated key prefix such as `mcp_oauth`
- prefer a dedicated Redis DB index if convenient
- do not log tokens in plaintext
- make sure Redis is not publicly exposed
- if Redis is in Docker, mount a persistent volume

Example Docker volume:

```yaml
volumes:
  - /var/lib/redis:/data
```

And in Redis config:

```conf
dir /data
```

## Simple VPS Checklist

1. Enable AOF persistence.
2. Ensure Redis writes to a persistent disk path.
3. Restart Redis once to confirm it comes back cleanly.
4. Set `OAUTH_STORE=redis` and `REDIS_URL` in the MCP server env.
5. Restart the MCP server.
6. Authenticate once through the remote OAuth flow.
7. Restart only the MCP server and verify tokens still work.
8. Restart Redis during a maintenance window and verify persisted sessions survive.

## Notes

- Local `stdio` mode does not depend on Redis.
- `npm run setup` remains unchanged and is still only for local `stdio` usage.
- If Redis is wiped, remote users may need to authenticate again, which is acceptable for a first internal rollout.
