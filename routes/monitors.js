/**
 * Monitors routes.
 */

import { Router } from "express";
import {
  deleteMonitor,
  getAlertRecipients,
  getMonitorLogs,
  getMonitors,
  getMonitorStatus,
  insertMonitor,
} from "../db.js";
import { authenticateToken, enforcePasswordReset } from "../middleware/auth.js";

const router = Router();
router.use(authenticateToken, enforcePasswordReset);

router.get("/monitors", (req, res) => {
  // List all targets with their current status and average response.
  const hosts = getMonitors();
  const summary = {};
  for (const host of hosts) {
    const status = getMonitorStatus(host);
    summary[host.name] = status;
  }
  res.status(200).json(summary);
});

router.post("/monitors", (req, res) => {
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

router.delete("/monitors/:id", (req, res) => {
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

router.get("/monitors/:id/logs", (req, res) => {
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

router.get("/recipients", (req, res) => {
  try {
    const recipients = getAlertRecipients();
    res.status(200).json({ success: true, recipients });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false });
  }
});

export default router;
