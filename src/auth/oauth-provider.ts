import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import {
  InvalidGrantError,
  InvalidRequestError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  initBackendAuthSession,
  pollBackendAuthSession,
  resolveAuthorizedShopIds,
} from "./backend-auth.js";
import {
  AccessTokenRecord,
  OAuthStore,
  RefreshTokenRecord,
} from "./oauth-store.js";

export class UnipiazzaOAuthProvider implements OAuthServerProvider {
  constructor(
    private readonly store: OAuthStore,
    private readonly publicBaseUrl: URL,
  ) {}

  get clientsStore() {
    return {
      getClient: (clientId: string) => this.store.getClient(clientId),
      registerClient: (client: OAuthClientInformationFull) =>
        this.store.registerClient(client),
    };
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: any,
  ): Promise<void> {
    const returnToUrl = new URL(
      `/oauth/authorize/complete/pending`,
      this.publicBaseUrl,
    );
    const upstreamAuth = await initBackendAuthSession(returnToUrl.href);
    const pending = await this.store.createPendingAuthorization({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      state: params.state,
      scopes: params.scopes ?? ["mcp"],
      resource: params.resource?.href,
      codeChallenge: params.codeChallenge,
      backendSessionId: upstreamAuth.session_id,
      authUrl: upstreamAuth.auth_url,
    });

    const authUrl = new URL(upstreamAuth.auth_url);
    authUrl.searchParams.set(
      "return_to",
      new URL(`/oauth/authorize/complete/${pending.id}`, this.publicBaseUrl).href,
    );

    res.redirect(authUrl.toString());
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const record = await this.store.getAuthorizationCode(authorizationCode);

    if (!record || record.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid authorization code");
    }
    return record.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ) {
    const record = await this.store.consumeAuthorizationCode(authorizationCode);

    if (!record || record.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid authorization code");
    }

    if (redirectUri && redirectUri !== record.redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match");
    }

    if (resource?.href && resource.href !== record.resource) {
      throw new InvalidRequestError("resource does not match");
    }

    const accessToken = await this.store.createAccessToken({
      clientId: record.clientId,
      scopes: record.scopes,
      resource: record.resource,
      apiKey: record.apiKey,
      authorizedShopIds: record.authorizedShopIds,
    });
    const refreshToken = await this.store.createRefreshToken({
      clientId: record.clientId,
      scopes: record.scopes,
      resource: record.resource,
      apiKey: record.apiKey,
      authorizedShopIds: record.authorizedShopIds,
    });

    return {
      access_token: accessToken.token,
      token_type: "Bearer",
      expires_in: Math.max(
        1,
        Math.floor((accessToken.expiresAt - Date.now()) / 1000),
      ),
      scope: record.scopes.join(" "),
      refresh_token: refreshToken.token,
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ) {
    const record = await this.store.getRefreshToken(refreshToken);

    if (!record || record.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid refresh token");
    }

    if (resource?.href && resource.href !== record.resource) {
      throw new InvalidRequestError("resource does not match");
    }

    const nextScopes = scopes && scopes.length > 0 ? scopes : record.scopes;

    const accessToken = await this.store.createAccessToken({
      clientId: record.clientId,
      scopes: nextScopes,
      resource: record.resource,
      apiKey: record.apiKey,
      authorizedShopIds: record.authorizedShopIds,
    });

    return {
      access_token: accessToken.token,
      token_type: "Bearer",
      expires_in: Math.max(
        1,
        Math.floor((accessToken.expiresAt - Date.now()) / 1000),
      ),
      scope: nextScopes.join(" "),
      refresh_token: refreshToken,
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (token.startsWith("unp_")) {
      const authorizedShopIds = await resolveAuthorizedShopIds(token);
      return {
        token,
        clientId: "legacy-mcp-api-key",
        scopes: ["mcp"],
        expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        extra: {
          apiKey: token,
          authorizedShopIds,
          authMode: "legacy-api-key",
        },
      };
    }

    const accessToken = await this.store.getAccessToken(token);
    if (!accessToken) {
      throw new InvalidTokenError("Invalid access token");
    }

    return this.toAuthInfo(accessToken);
  }

  async completePendingAuthorization(requestId: string) {
    const pending = await this.store.getPendingAuthorization(requestId);
    if (!pending) {
      return { status: "error" as const, message: "Authorization session expired." };
    }

    const poll = await pollBackendAuthSession(pending.backendSessionId);
    if (poll.status === "pending") {
      return {
        status: "pending" as const,
        authUrl: pending.authUrl,
      };
    }

    const authorizedShopIds = await resolveAuthorizedShopIds(poll.api_key);
    const authCode = await this.store.createAuthorizationCode({
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      state: pending.state,
      scopes: pending.scopes,
      resource: pending.resource,
      codeChallenge: pending.codeChallenge,
      apiKey: poll.api_key,
      authorizedShopIds,
    });
    await this.store.consumePendingAuthorization(requestId);

    const redirectUrl = new URL(pending.redirectUri);
    redirectUrl.searchParams.set("code", authCode.code);
    if (pending.state) {
      redirectUrl.searchParams.set("state", pending.state);
    }

    return {
      status: "complete" as const,
      redirectUrl: redirectUrl.href,
    };
  }

  private toAuthInfo(record: AccessTokenRecord | RefreshTokenRecord): AuthInfo {
    return {
      token: record.token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: Math.floor(record.expiresAt / 1000),
      resource: record.resource ? new URL(record.resource) : undefined,
      extra: {
        apiKey: record.apiKey,
        authorizedShopIds: record.authorizedShopIds,
        authMode: "oauth-access-token",
      },
    };
  }
}
