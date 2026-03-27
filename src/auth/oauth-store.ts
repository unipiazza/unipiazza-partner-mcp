import { randomUUID } from "node:crypto";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;
const AUTH_CODE_TTL_MS = 2 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

export type PendingAuthorizationRequest = {
  id: string;
  clientId: string;
  redirectUri: string;
  state?: string;
  scopes: string[];
  resource?: string;
  codeChallenge: string;
  backendSessionId: string;
  authUrl: string;
  expiresAt: number;
};

export type AuthorizationCodeRecord = {
  code: string;
  clientId: string;
  redirectUri: string;
  state?: string;
  scopes: string[];
  resource?: string;
  codeChallenge: string;
  apiKey: string;
  authorizedShopIds: string[];
  expiresAt: number;
};

export type AccessTokenRecord = {
  token: string;
  clientId: string;
  scopes: string[];
  resource?: string;
  apiKey: string;
  authorizedShopIds: string[];
  expiresAt: number;
};

export type RefreshTokenRecord = {
  token: string;
  clientId: string;
  scopes: string[];
  resource?: string;
  apiKey: string;
  authorizedShopIds: string[];
  expiresAt: number;
};

export interface OAuthStore {
  getClient(clientId: string): Promise<OAuthClientInformationFull | undefined>;
  registerClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull>;
  createPendingAuthorization(
    input: Omit<PendingAuthorizationRequest, "id" | "expiresAt">,
  ): Promise<PendingAuthorizationRequest>;
  getPendingAuthorization(id: string): Promise<PendingAuthorizationRequest | undefined>;
  consumePendingAuthorization(
    id: string,
  ): Promise<PendingAuthorizationRequest | undefined>;
  createAuthorizationCode(
    input: Omit<AuthorizationCodeRecord, "code" | "expiresAt">,
  ): Promise<AuthorizationCodeRecord>;
  getAuthorizationCode(code: string): Promise<AuthorizationCodeRecord | undefined>;
  consumeAuthorizationCode(
    code: string,
  ): Promise<AuthorizationCodeRecord | undefined>;
  createAccessToken(
    input: Omit<AccessTokenRecord, "token" | "expiresAt">,
  ): Promise<AccessTokenRecord>;
  getAccessToken(token: string): Promise<AccessTokenRecord | undefined>;
  createRefreshToken(
    input: Omit<RefreshTokenRecord, "token" | "expiresAt">,
  ): Promise<RefreshTokenRecord>;
  getRefreshToken(token: string): Promise<RefreshTokenRecord | undefined>;
}

function createExpiringMap<T extends { expiresAt: number }>() {
  const store = new Map<string, T>();

  return {
    get(key: string) {
      const value = store.get(key);
      if (!value) return undefined;

      if (value.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }

      return value;
    },
    set(key: string, value: T) {
      store.set(key, value);
    },
    delete(key: string) {
      store.delete(key);
    },
  };
}

export class InMemoryOAuthStore implements OAuthStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  private pendingAuthorizations = createExpiringMap<PendingAuthorizationRequest>();

  private authorizationCodes = createExpiringMap<AuthorizationCodeRecord>();

  private accessTokens = createExpiringMap<AccessTokenRecord>();

  private refreshTokens = createExpiringMap<RefreshTokenRecord>();

  async getClient(clientId: string) {
    return this.clients.get(clientId);
  }

  async registerClient(client: OAuthClientInformationFull) {
    this.clients.set(client.client_id, client);
    return client;
  }

  async createPendingAuthorization(
    input: Omit<PendingAuthorizationRequest, "id" | "expiresAt">,
  ) {
    const record: PendingAuthorizationRequest = {
      ...input,
      id: randomUUID(),
      expiresAt: Date.now() + AUTH_REQUEST_TTL_MS,
    };

    this.pendingAuthorizations.set(record.id, record);
    return record;
  }

  async getPendingAuthorization(id: string) {
    return this.pendingAuthorizations.get(id);
  }

  async consumePendingAuthorization(id: string) {
    const record = this.pendingAuthorizations.get(id);
    if (record) {
      this.pendingAuthorizations.delete(id);
    }
    return record;
  }

  async createAuthorizationCode(
    input: Omit<AuthorizationCodeRecord, "code" | "expiresAt">,
  ) {
    const record: AuthorizationCodeRecord = {
      ...input,
      code: randomUUID(),
      expiresAt: Date.now() + AUTH_CODE_TTL_MS,
    };

    this.authorizationCodes.set(record.code, record);
    return record;
  }

  async consumeAuthorizationCode(code: string) {
    const record = this.authorizationCodes.get(code);
    if (record) {
      this.authorizationCodes.delete(code);
    }
    return record;
  }

  async createAccessToken(
    input: Omit<AccessTokenRecord, "token" | "expiresAt">,
  ) {
    const record: AccessTokenRecord = {
      ...input,
      token: randomUUID(),
      expiresAt: Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    };

    this.accessTokens.set(record.token, record);
    return record;
  }

  async getAccessToken(token: string) {
    return this.accessTokens.get(token);
  }

  async getAuthorizationCode(code: string) {
    return this.authorizationCodes.get(code);
  }

  async createRefreshToken(
    input: Omit<RefreshTokenRecord, "token" | "expiresAt">,
  ) {
    const record: RefreshTokenRecord = {
      ...input,
      token: randomUUID(),
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
    };

    this.refreshTokens.set(record.token, record);
    return record;
  }

  async getRefreshToken(token: string) {
    return this.refreshTokens.get(token);
  }
}
