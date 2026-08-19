import express from "express";
import { getMonitors, getMonitorStatus, insertMonitor } from "./db.js";

const app = express();
const PORT = 8080;
app.use(express.json());

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
  const monitor = req.body;

  if (!monitor.name || !monitor.url) {
    res
      .status(400)
      .json({ success: false, error: "Name and URL are required." });
    return;
  }

  try {
    insertMonitor(monitor);
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});
