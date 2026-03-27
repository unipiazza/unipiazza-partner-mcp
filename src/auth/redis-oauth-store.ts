import { createClient } from "redis";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  AccessTokenRecord,
  AuthorizationCodeRecord,
  OAuthStore,
  PendingAuthorizationRequest,
  RefreshTokenRecord,
} from "./oauth-store.js";

const CLIENT_TTL_SECONDS = 365 * 24 * 60 * 60;
const KEY_PREFIX = process.env.OAUTH_REDIS_PREFIX || "mcp_oauth";

function ttlSecondsFromExpiresAt(expiresAt: number) {
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

function keyFor(kind: string, id: string) {
  return `${KEY_PREFIX}:${kind}:${id}`;
}

type RedisConnection = ReturnType<typeof createClient>;

async function readJson<T>(
  client: RedisConnection,
  key: string,
): Promise<T | undefined> {
  const value = await client.get(key);
  if (!value) return undefined;

  return JSON.parse(value) as T;
}

async function writeJson(
  client: RedisConnection,
  key: string,
  value: unknown,
  ttlSeconds: number,
) {
  await client.set(key, JSON.stringify(value), {
    EX: ttlSeconds,
  });
}

export class RedisOAuthStore implements OAuthStore {
  private constructor(private readonly client: RedisConnection) {}

  static async create(redisUrl: string) {
    const client = createClient({
      url: redisUrl,
    });
    await client.connect();

    return new RedisOAuthStore(client);
  }

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return readJson<OAuthClientInformationFull>(
      this.client,
      keyFor("client", clientId),
    );
  }

  async registerClient(
    client: OAuthClientInformationFull,
  ): Promise<OAuthClientInformationFull> {
    await writeJson(
      this.client,
      keyFor("client", client.client_id),
      client,
      CLIENT_TTL_SECONDS,
    );
    return client;
  }

  async createPendingAuthorization(
    input: Omit<PendingAuthorizationRequest, "id" | "expiresAt">,
  ): Promise<PendingAuthorizationRequest> {
    const { InMemoryOAuthStore } = await import("./oauth-store.js");
    const tempStore = new InMemoryOAuthStore();
    const record = await tempStore.createPendingAuthorization(input);

    await writeJson(
      this.client,
      keyFor("pending", record.id),
      record,
      ttlSecondsFromExpiresAt(record.expiresAt),
    );
    return record;
  }

  async getPendingAuthorization(
    id: string,
  ): Promise<PendingAuthorizationRequest | undefined> {
    return readJson<PendingAuthorizationRequest>(this.client, keyFor("pending", id));
  }

  async consumePendingAuthorization(
    id: string,
  ): Promise<PendingAuthorizationRequest | undefined> {
    const key = keyFor("pending", id);
    const record = await readJson<PendingAuthorizationRequest>(this.client, key);
    if (record) {
      await this.client.del(key);
    }
    return record;
  }

  async createAuthorizationCode(
    input: Omit<AuthorizationCodeRecord, "code" | "expiresAt">,
  ): Promise<AuthorizationCodeRecord> {
    const { InMemoryOAuthStore } = await import("./oauth-store.js");
    const tempStore = new InMemoryOAuthStore();
    const record = await tempStore.createAuthorizationCode(input);

    await writeJson(
      this.client,
      keyFor("auth_code", record.code),
      record,
      ttlSecondsFromExpiresAt(record.expiresAt),
    );
    return record;
  }

  async getAuthorizationCode(
    code: string,
  ): Promise<AuthorizationCodeRecord | undefined> {
    return readJson<AuthorizationCodeRecord>(
      this.client,
      keyFor("auth_code", code),
    );
  }

  async consumeAuthorizationCode(
    code: string,
  ): Promise<AuthorizationCodeRecord | undefined> {
    const key = keyFor("auth_code", code);
    const record = await readJson<AuthorizationCodeRecord>(this.client, key);
    if (record) {
      await this.client.del(key);
    }
    return record;
  }

  async createAccessToken(
    input: Omit<AccessTokenRecord, "token" | "expiresAt">,
  ): Promise<AccessTokenRecord> {
    const { InMemoryOAuthStore } = await import("./oauth-store.js");
    const tempStore = new InMemoryOAuthStore();
    const record = await tempStore.createAccessToken(input);

    await writeJson(
      this.client,
      keyFor("access_token", record.token),
      record,
      ttlSecondsFromExpiresAt(record.expiresAt),
    );
    return record;
  }

  async getAccessToken(token: string): Promise<AccessTokenRecord | undefined> {
    return readJson<AccessTokenRecord>(this.client, keyFor("access_token", token));
  }

  async createRefreshToken(
    input: Omit<RefreshTokenRecord, "token" | "expiresAt">,
  ): Promise<RefreshTokenRecord> {
    const { InMemoryOAuthStore } = await import("./oauth-store.js");
    const tempStore = new InMemoryOAuthStore();
    const record = await tempStore.createRefreshToken(input);

    await writeJson(
      this.client,
      keyFor("refresh_token", record.token),
      record,
      ttlSecondsFromExpiresAt(record.expiresAt),
    );
    return record;
  }

  async getRefreshToken(
    token: string,
  ): Promise<RefreshTokenRecord | undefined> {
    return readJson<RefreshTokenRecord>(this.client, keyFor("refresh_token", token));
  }
}
