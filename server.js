import express from "express";
import cors from "cors";
import {
  deleteAlertRecipient,
  deleteMonitor,
  getAlertRecipients,
  getMonitorLogs,
  getMonitors,
  getMonitorStatus,
  getSingleAlertRecipient,
  getUserByUsername,
  createUser,
  insertAlertRecipient,
  insertMonitor,
} from "./db.js";
import { authenticatToken } from "./middleware/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import http from "node:http";
import url from "node:url";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const PORT = 8080;
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      } else {
        callback(new Error("Blocked by CORS policy."));
      }
    },
  }),
);

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

app.get("/api/v1/monitors", authenticatToken, (req, res) => {
  // List all targets with their current status and average response.
  const hosts = getMonitors();
  const summary = {};
  for (const host of hosts) {
    const status = getMonitorStatus(host);
    summary[host.name] = status;
  }
  res.status(200).json(summary);
});

app.post("/api/v1/monitors", authenticatToken, (req, res) => {
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

app.get("/api/v1/monitors/:id/logs", authenticatToken, (req, res) => {
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

app.delete("/api/v1/monitors/:id", authenticatToken, (req, res) => {
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

app.get("/api/v1/recipients", authenticatToken, (req, res) => {
  try {
    const recipients = getAlertRecipients();
    res.status(200).json({ success: true, recipients });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false });
  }
});

app.post("/api/v1/recipients", authenticatToken, (req, res) => {
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

app.delete("/api/v1/recipients/:id", authenticatToken, (req, res) => {
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

const JWT_SECRET = process.env.JWT_SECRET || "you-cant-guess-this";

app.post("/api/v1/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Username and password required" });
  }

  try {
    const existing = getUserByUsername(username);
    if (existing) {
      return res
        .status(422)
        .json({ success: false, error: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    createUser({ username, hashedPassword });
    res.status(201).json({ success: true, message: "User created" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// HELPER route (to be deleted).
app.post("/api/v1/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = getUserByUsername(username);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials." });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials." });
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.status(200).json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

wss.on("connection", (ws, req) => {
  const pathname = url.parse(req.url, true);
  const token = pathname.query?.token;

  if (!token) {
    console.log("WebSocket connection rejected: No token provided.");
    ws.close(4001, "Authentication token required.");
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      console.log("WebSocket connection rejected: Invalid or expired token.");
      ws.close(4003, "Invalid or expired token.");
      return;
    }

    ws.user = decodedUser;
    console.log(`Authenticated client connected: ${decodedUser.username}`);

    ws.send(
      JSON.stringify({ type: "SYSTEM", message: "Authenticated successfully" }),
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

server.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});
