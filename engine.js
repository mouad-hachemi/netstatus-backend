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
      const { stdout } = await execAsync(command);
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

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const sendTelegramAlert = async (message) => {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (error) {
    console.log(`Failed to send Telegram alert: ${error.message}`);
  }
};

const previousStatuses = new Map();
const outageAlertCheck = (isUp, host) => {
  const hostLastStatus = previousStatuses.get(host.id);
  if (hostLastStatus !== undefined && hostLastStatus !== isUp) {
    // Host status changed, fire a notification.
    if (!isUp) {
      sendTelegramAlert(
        `🚨 *OUTAGE ALERT*\nHost *${host.name}* (${host.url}) is **DOWN**!`,
      );
    } else {
      sendTelegramAlert(
        `✅ *RECOVERY NOTICE*\nHost *${host.name}* (${host.url}) is back **ONLINE**!`,
      );
    }
  }
  previousStatuses.set(host.id, isUp);
};

const checkHost = async (host) => {
  let logResult = {
    monitorId: host.id,
    statusCode: null,
    latencyMs: null,
    isUp: false,
  };

  try {
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
    broadcast(JSON.stringify(logResult));
    outageAlertCheck(logResult.isUp, host);
  } catch (error) {
    console.log(`Error checking host: ${host.name}`, error.message);
  } finally {
    hostsBeingChecked.delete(host.id);
  }
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
