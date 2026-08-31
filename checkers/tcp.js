/**
 * TCP related checks.
 */

import net from "node:net";

export const checkTCPPort = (host, port, timeout = 3000) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on("connect", () => {
      const latency = Date.now() - startTime;
      socket.destroy();
      resolve({ isUp: true, latencyMs: latency });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        latencyMs: null,
        errorMessage: "Host Unreachable",
      });
    });

    socket.on("error", (error) => {
      socket.destroy();
      resolve({ errorMsg: error.message, isUp: false, latencyMs: null });
    });

    socket.connect(port, host);
  });
};