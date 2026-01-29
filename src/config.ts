import Conf from "conf";
import * as os from "os";
import * as path from "path";

interface WalletStore {
  seed?: string;
  rpcUrl?: string;
  wsUrl?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".berrypay");

export const config = new Conf<WalletStore>({
  projectName: "berrypay",
  cwd: CONFIG_DIR,
});

/**
 * Get seed from environment variable or config file
 * Priority: BERRYPAY_SEED env var > config file
 */
export function getSeed(): string | null {
  // Environment variable takes priority (for AI agents)
  const envSeed = process.env.BERRYPAY_SEED;
  if (envSeed) {
    return envSeed;
  }

  // Fall back to config file
  return config.get("seed") ?? null;
}

export function saveSeed(seed: string): void {
  config.set("seed", seed);
}

export function hasSeed(): boolean {
  return !!getSeed();
}

export function clearSeed(): void {
  config.delete("seed");
}

export function getRpcUrl(): string {
  return process.env.BERRYPAY_RPC_URL ?? config.get("rpcUrl") ?? "https://uk1.public.xnopay.com/proxy";
}

export function setRpcUrl(url: string): void {
  config.set("rpcUrl", url);
}

export function getWsUrl(): string {
  return process.env.BERRYPAY_WS_URL ?? config.get("wsUrl") ?? "wss://uk1.public.xnopay.com/ws";
}

export function setWsUrl(url: string): void {
  config.set("wsUrl", url);
}

export function getConfigPath(): string {
  return CONFIG_DIR;
}
