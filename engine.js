import { insertLog, getMonitors, getMonitorLastRecord } from "./db.js";
import { broadcast } from "./services/websocket.js";
import { checkTCPPort } from "./checkers/tcp.js";
import { checkICMPPing } from "./checkers/icmp.js";
import { checkHTTPService } from "./checkers/http.js";
import { outageAlertCheck } from "./services/alert.js";

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

export const hostsBeingChecked = new Map();

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
