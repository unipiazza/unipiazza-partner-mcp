import { InMemoryOAuthStore, OAuthStore } from "./oauth-store.js";
import { RedisOAuthStore } from "./redis-oauth-store.js";

let storePromise: Promise<OAuthStore> | undefined;

export async function createOAuthStore(): Promise<OAuthStore> {
  const storeMode = process.env.OAUTH_STORE || "memory";
  const redisUrl = process.env.REDIS_URL;

  if (storeMode === "redis") {
    if (!redisUrl) {
      throw new Error("OAUTH_STORE=redis requires REDIS_URL");
    }
    return RedisOAuthStore.create(redisUrl);
  }

  return new InMemoryOAuthStore();
}

export async function getOAuthStore(): Promise<OAuthStore> {
  if (!storePromise) {
    storePromise = createOAuthStore();
  }

  return storePromise;
}
