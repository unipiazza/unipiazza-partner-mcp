#!/usr/bin/env node
// Unipiazza MCP — one-time setup script
// Usage: node --env-file=.env build/setup.js
//
// Flow:
//   1. Calls /api/partner/mcp/auth/init to get a session_id and auth_url
//   2. Opens the auth_url in the browser (user logs in and clicks "Autorizza")
//   3. Polls /api/partner/mcp/auth/poll/:session_id every 2s
//   4. When the key is ready, writes PARTNER_API_KEY to .env

import axios from "axios";
import { exec } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const ENV_PATH = resolve(process.cwd(), ".env");
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150; // 5 minutes

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "darwin") exec(`open "${url}"`);
  else if (platform === "win32") exec(`start "" "${url}"`);
  else exec(`xdg-open "${url}"`);
}

function writeKeyToEnv(apiKey: string): void {
  const line = `PARTNER_API_KEY=${apiKey}`;

  if (!existsSync(ENV_PATH)) {
    writeFileSync(ENV_PATH, line + "\n", "utf8");
    return;
  }

  const existing = readFileSync(ENV_PATH, "utf8");
  if (existing.includes("PARTNER_API_KEY=")) {
    const updated = existing.replace(/^PARTNER_API_KEY=.*/m, line);
    writeFileSync(ENV_PATH, updated, "utf8");
  } else {
    writeFileSync(ENV_PATH, existing.trimEnd() + "\n" + line + "\n", "utf8");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function poll(sessionId: string): Promise<string> {
  const url = `${API_BASE_URL}/api/partner/mcp/auth/poll/${sessionId}`;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    process.stdout.write(".");

    try {
      const res = await axios.get(url);
      if (res.data?.status === "complete") {
        process.stdout.write("\n");
        return res.data.api_key;
      }
    } catch {
      // network hiccup, keep trying
    }
  }

  throw new Error("Timeout: authorization not completed within 5 minutes.");
}

async function main(): Promise<void> {
  console.log("Unipiazza MCP Setup\n");

  if (process.env.PARTNER_API_KEY) {
    console.log("PARTNER_API_KEY is already set in the environment.");
    console.log("Delete it from .env and re-run this script to generate a new key.");
    process.exit(0);
  }

  // 1. Init session
  let sessionId: string;
  let authUrl: string;
  try {
    const res = await axios.post(`${API_BASE_URL}/api/partner/mcp/auth/init`);
    sessionId = res.data.session_id;
    authUrl = res.data.auth_url;
  } catch (err: any) {
    console.error("Failed to reach the Unipiazza API:", err.message);
    process.exit(1);
  }

  // 2. Open browser
  console.log(`Opening authorization page in your browser...`);
  console.log(`\n  ${authUrl}\n`);
  console.log("If the browser does not open automatically, copy the URL above and open it manually.");
  console.log("Log in with your Unipiazza account and click 'Autorizza'.\n");
  openBrowser(authUrl);

  // 3. Poll
  console.log("Waiting for authorization", { nonewline: true });
  process.stdout.write("Waiting for authorization ");

  let apiKey: string;
  try {
    apiKey = await poll(sessionId);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }

  // 4. Save to .env
  writeKeyToEnv(apiKey);
  console.log(`\nDone! PARTNER_API_KEY has been saved to ${ENV_PATH}`);
  console.log("\nYou can now start the MCP server with: npm start");
}

main();
