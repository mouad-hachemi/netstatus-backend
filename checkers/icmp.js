/**
 * ICMP ping related checks.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Using execFile instead exec to prevent shell command injection.
const execFileAsync = promisify(execFile);
export const checkICMPPing = async (host, retries = 4) => {
  const isWin = process.platform === "win32";

  const startTime = Date.now();
  let lastError = null;

  const args = isWin
    ? ["-n", "1", "-w", "2000", host.url]
    : ["-c", "1", "-W", "2", host.url];
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { stdout } = await execFileAsync("ping", args);
      if (
        stdout.includes("Destination host unreachable") ||
        stdout.includes("Request timed out") ||
        stdout.includes("100% loss")
      ) {
        throw new Error("Host Unreachable");
      }
      const latency = Date.now() - startTime;
      return {
        isUp: true,
        latencyMs: latency,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });
      }
    }
  }

  // All attempts failed.
  const latency = null;
  return {
    errorMsg: lastError?.message || "Host Unreachable",
    latencyMs: latency,
  };
};
