import "dotenv/config";
import "./db.js"; // Open database connection.
import "./server.js"; // Start HTTP & WebSocket server.
import "./engine.js"; // Start background polling timer.
import { activeTimers } from "./engine.js";
import { wss } from "./services/websocket.js";
import { server } from "./server.js";
import { db } from "./db.js";

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  activeTimers.forEach((timer) => clearInterval(timer));
  console.log("Stopped all active monitoring check intervals.");

  if (wss) {
    wss.clients.forEach((client) => {
      client.close(1001, "Server shutting down");
    });
    wss.close(() => console.log("WebSocket server closed."));
  }

  server.close(() => {
    console.log("HTTP Server closed.");

    setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 5000);

    if (db) {
      try {
        db.close();
        console.log("Database connection closed.");
        process.exit(0);
      } catch (error) {
        console.log("Error closing the database:", error);
        process.exit(0);
      }
    } else {
      process.exit(0);
    }
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
