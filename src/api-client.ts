import axios, { AxiosInstance } from "axios";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const PARTNER_API_KEY = process.env.PARTNER_API_KEY;

export type McpApiClient = {
  get: (
    path: string,
    params?: Record<string, unknown>,
    shopId?: string,
  ) => Promise<unknown>;
};

function createAxiosClient(authToken?: string): AxiosInstance {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
}

export function createMcpApiClient(authToken?: string): McpApiClient {
  const resolvedAuthToken = authToken ?? PARTNER_API_KEY;

  if (!resolvedAuthToken) {
    console.error(
      "Warning: no MCP auth token configured. API calls might fail authentication.",
    );
  }

  const client = createAxiosClient(resolvedAuthToken);

  return {
    get: async (path, params, shopId) => {
      const headers: Record<string, string> = {};
      if (shopId) headers.Accept = `sid=${shopId}`;

      try {
        const response = await client.get(`/api/partner/mcp${path}`, {
          params,
          headers,
        });
        return response.data;
      } catch (error: any) {
        if (error.response) {
          throw new Error(
            `API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`,
          );
        }
        throw error;
      }
    },
  };
}

export const mcpClient = createMcpApiClient();
