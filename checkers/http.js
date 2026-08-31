/**
 * Helper function repsonsible for checkin HTTP service.
 */

export const checkHTTPService = async (host) => {
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
