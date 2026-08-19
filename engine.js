import { insertLog, getMonitors, getMonitorLastRecord } from "./db.js";

const checkHost = async (host) => {
  const startTime = Date.now();
  try {
    const response = await fetch(host.url);
    const latency = Date.now() - startTime;
    const log = {
      monitorId: host.id,
      statusCode: response.status,
      latencyMs: latency,
      isUp: response.ok,
    };
    insertLog(log);
    console.log(
      `[UP] ${host.url} | STATUS ${response.status} | Latency ${latency}ms.`,
    );
  } catch (error) {
    const latency = Date.now() - startTime;
    const log = {
      monitorId: host.id,
      latencyMs: latency,
      isUp: false,
    };
    insertLog(log);
    console.log(
      `[DOWN] ${host.url} | Error: ${error.message} | Latency ${latency}ms.`,
    );
  }
};

const intervalId = setInterval(() => {
  const targetHosts = getMonitors();
  for (const host of targetHosts) {
    // get last record of current host.
    const record = getMonitorLastRecord(host);
    // check if the interval between current time and last record is greater then check_intervale.
    const timestamp = record.timestamp;
    if (
      !timestamp ||
      Date.now() - timestamp * 1000 > host.check_interval * 1000
    ) {
      // run check
      console.log(`Checking host: ${host.name}`);
      checkHost(host);
    }
  }
}, 1000);
