import express from "express";
import {
  deleteAlertRecipient,
  deleteMonitor,
  getAlertRecipients,
  getMonitorLogs,
  getMonitors,
  getMonitorStatus,
  getSingleAlertRecipient,
  insertAlertRecipient,
  insertMonitor,
} from "./db.js";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const PORT = 8080;
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

export const broadcast = (data, isBinary = false) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });
};

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    data: "Hello, Web!",
  });
});

app.get("/api/v1/monitors", (req, res) => {
  // List all targets with their current status and average response.
  const hosts = getMonitors();
  const summary = {};
  for (const host of hosts) {
    const status = getMonitorStatus(host);
    summary[host.name] = status;
  }
  res.status(200).json(summary);
});

app.post("/api/v1/monitors", (req, res) => {
  // Retrieve host info.
  const { name, url, type = "HTTP", port, freq = 60 } = req.body;

  if (!name || !url) {
    res
      .status(400)
      .json({ success: false, error: "Name and URL are required." });
    return;
  }

  try {
    insertMonitor({ name, url, type, port, freq });
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.get("/api/v1/monitors/:id/logs", (req, res) => {
  const monitorId = req.params.id;
  try {
    const { name, logs } = getMonitorLogs(monitorId);
    if (!name) {
      res.status(404).json({ success: false, error: "Monitor not found." });
      return;
    }
    res.status(200).json({ success: true, name, logs });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.delete("/api/v1/monitors/:id", (req, res) => {
  const monitorId = req.params.id;
  try {
    const count = deleteMonitor(monitorId);
    if (count === 0) {
      res.status(404).json({ success: false, error: "Monitor not found." });
      return;
    }
    res.status(200).json({ success: true, count });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false });
  }
});

app.get("/api/v1/recipients", (req, res) => {
  try {
    const recipients = getAlertRecipients();
    res.status(200).json({ success: true, recipients });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false });
  }
});

app.post("/api/v1/recipients", (req, res) => {
  try {
    const { name, chat_id: chatId } = req.body;
    // Check if recipient already exists.
    const recipient = getSingleAlertRecipient(chatId);
    if (recipient) {
      res
        .status(422)
        .json({ success: false, error: "Recipient already exists." });
      return;
    }
    insertAlertRecipient({ name, chatId });
    res.status(201).json({ success: true });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false });
  }
});

app.delete("/api/v1/recipients/:id", (req, res) => {
  try {
    const id = req.params.id;
    const count = deleteAlertRecipient(id);
    if (count === 0) {
      res.status(404).json({ success: false, error: "Recipient not found." });
      return;
    }
    res.status(200).json({ success: true, count });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false });
  }
});

wss.on("connection", (ws) => {
  console.log("New client connected.");
  ws.send("Welcome to the room!");

  ws.on("message", (message) => {
    console.log(`Received: ${message}`);
    ws.send(`Server received: ${message}`);
  });

  ws.on("close", () => {
    console.log("Client disconnected.");
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});
