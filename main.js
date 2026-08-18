import { db, initDb, insertLog } from "./db.js";

const targetURL = "https://thisdomaindoesnotexist12345.com";

console.log("Initializing databse...");
initDb();
console.log("Initialized database successfuly.");

const checkHost = async (url) => {
  const startTime = Date.now();
  try {
    const response = await fetch(url);
    const latency = Date.now() - startTime;
    const log = {
      statusCode: response.status,
      latencyMs: latency,
      isUp: response.ok,
    };
    insertLog(log);
    console.log(
      `[UP] ${url} | STATUS ${response.status} | Latency ${latency}ms.`,
    );
  } catch (error) {
    const latency = Date.now() - startTime;
    const log = {
      latencyMs: latency,
      isUp: false,
    };
    insertLog(log);
    console.log(
      `[DOWN] ${url} | Error: ${error.message} | Latency ${latency}ms.`,
    );
  }
};

checkHost(targetURL);
