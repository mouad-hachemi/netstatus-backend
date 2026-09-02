/**
 * Websocket manager.
 */

import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import url from "node:url";
import { getUserById } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "you-cant-guess-this";
let wss;

export const initWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const pathname = url.parse(req.url, true);
    const token = pathname.query?.token;

    if (!token) {
      console.log("WebSocket connection rejected: No token provided.");
      ws.close(4001, "Authentication token required.");
      return;
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
      if (err || !getUserById(decodedUser.userId)) {
        console.log("WebSocket connection rejected: Invalid or expired token.");
        ws.close(4003, "Invalid or expired token.");
        return;
      }

      ws.user = decodedUser;
      ws.user.token = token;
      console.log(`Authenticated client connected: ${decodedUser.username}`);

      ws.send(
        JSON.stringify({
          type: "SYSTEM",
          message: "Authenticated successfully",
        }),
      );
    });

    ws.on("message", (message) => {
      console.log(`Received from: ${ws.user?.username}: ${message}`);
      ws.send(`${ws.user?.username} message received.`);
    });

    ws.on("close", () => {
      console.log(`Session terminating for: ${ws.user?.username}`);
    });
  });
};

export const broadcast = (data, isBinary = false) => {
  if (!wss) return;

  wss.clients.forEach((client) => {
    const userExists = getUserById(client.user?.userId);
    const token = client.user?.token;

    if (!userExists || !token) {
      client.close(4003, "Invalid or expired token.");
      return;
    }

    try {
      jwt.verify(token, JWT_SECRET);
    } catch (error) {
      client.close(4003, "Invalid or expired token.");
      return;
    }

    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });
};
