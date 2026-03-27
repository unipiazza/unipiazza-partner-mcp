import { createMcpApiClient } from "../api-client.js";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

export type BackendAuthInitResponse = {
  session_id: string;
  auth_url: string;
  expires_in?: number;
};

type BackendAuthPollPending = {
  status: "pending";
};

type BackendAuthPollComplete = {
  status: "complete";
  api_key: string;
};

export type BackendAuthPollResponse =
  | BackendAuthPollPending
  | BackendAuthPollComplete;

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Backend auth error ${response.status}: ${JSON.stringify(data)}`);
  }

  return data as T;
}

export async function initBackendAuthSession(
  returnTo?: string,
): Promise<BackendAuthInitResponse> {
  const response = await fetch(`${API_BASE_URL}/api/partner/mcp/auth/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      returnTo
        ? {
            return_to: returnTo,
          }
        : {},
    ),
  });

  return parseJsonResponse<BackendAuthInitResponse>(response);
}

export async function pollBackendAuthSession(
  sessionId: string,
): Promise<BackendAuthPollResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/partner/mcp/auth/poll/${encodeURIComponent(sessionId)}`,
  );

  return parseJsonResponse<BackendAuthPollResponse>(response);
}

export async function resolveAuthorizedShopIds(apiKey: string): Promise<string[]> {
  const client = createMcpApiClient(apiKey);
  const data = await client.get("/shops");

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const record = item as Record<string, unknown>;

      return typeof record._id === "string"
        ? record._id
        : typeof record.id === "string"
          ? record.id
          : undefined;
    })
    .filter((shopId): shopId is string => Boolean(shopId));
}
