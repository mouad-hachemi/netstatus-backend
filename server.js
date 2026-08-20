import express from "express";
import {
  deleteMonitor,
  getMonitorLogs,
  getMonitors,
  getMonitorStatus,
  insertMonitor,
} from "./db.js";

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
    const { logs, monitor } = deleteMonitor(monitorId);
    if (monitor === 0) {
      res.status(404).json({ success: false, error: "Monitor not found." });
      return;
    }
    res.status(200).json({ success: true, logs, monitor });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});
