import { insertLog, getMonitors, getMonitorLastRecord } from "./db.js";
import { broadcast } from "./server.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import net from "node:net";

const checkTCPPort = (host, port, timeout = 3000) => {
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

const execAsync = promisify(exec);
const checkICMPPing = async (host, retries = 4) => {
  const isWin = process.platform === "win32";

  const startTime = Date.now();
  let lastError = null;

  const command = isWin
    ? `ping -n 1 -w 2000 ${host.url}`
    : `ping -c 1 -W 2 ${host.url}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await execAsync(command);
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

const checkHTTPService = async (host) => {
  // Default HTTP test.
  const startTime = Date.now();
  let log = null;
  try {
    let targetURL = host.url;
    if (!/^https?:\/\//i.test(targetURL)) {
      targetURL = `http://${targetURL}`;
    }
    const response = await fetch(targetURL);
    const latency = Date.now() - startTime;
    log = {
      monitorId: host.id,
      statusCode: response.status,
      latencyMs: latency,
      isUp: response.ok,
    };
  } catch (error) {
    const latency = null;
    log = {
      monitorId: host.id,
      latencyMs: latency,
      errorMsg: error.message,
    };
  }
  return log;
};

const checkHost = async (host) => {
  let logResult = {
    monitorId: host.id,
    statusCode: null,
    latencyMs: null,
    isUp: false,
  };

  if (host.type === "TCP") {
    // Perform TCP port check.
    const targetPort = host.port || 80;
    const response = await checkTCPPort(host.url, targetPort);
    logResult = { ...logResult, ...response };
    console.log(
      `Check results for host: ${host.name}`,
      `[${logResult.isUp ? "UP" : "DOWN"} - TCP] ${host.url}:${targetPort} | ${logResult.errorMsg ? `Error: ${logResult.errorMsg} | ` : ""} ${host.url} | Latency ${logResult.latencyMs}ms.`,
    );
  } else if (host.type == "ICMP") {
    // Perform ICMP ping test.
    const response = await checkICMPPing(host);
    logResult = { ...logResult, ...response };
    console.log(
      `Check results for host: ${host.name}`,
      `[${logResult.isUp ? "UP" : "DOWN"} - ICMP] | ${logResult.errorMsg ? `Error: ${logResult.errorMsg} | ` : ""} ${host.url} | Latency ${logResult.latencyMs}ms.`,
    );
  } else {
    // Default HTTP test.
    const response = await checkHTTPService(host);
    logResult = { ...logResult, ...response };
    console.log(
      `Check results for host: ${host.name}`,
      `[${logResult.isUp ? "UP" : "DOWN"}] | ${logResult.errorMsg ? `Error: ${logResult.errorMsg} | ` : ""} ${host.url} | Latency ${logResult.latencyMs}ms.`,
    );
  }
  insertLog(logResult);
  hostsBeingChecked.delete(host.id);
  broadcast(JSON.stringify(logResult));
};

const hostsBeingChecked = new Map();

const intervalId = setInterval(() => {
  const targetHosts = getMonitors();
  for (const host of targetHosts) {
    // get last record of current host.
    const record = getMonitorLastRecord(host);
    // check if the interval between current time and last record is greater then check_intervale.
    const timestamp = record.timestamp;
    if (
      (!timestamp ||
        Date.now() - timestamp * 1000 > host.check_interval * 1000) &&
      !hostsBeingChecked.has(host.id)
    ) {
      // run check
      hostsBeingChecked.set(host.id, host.name);
      checkHost(host);
    }
  }
}, 1000);
