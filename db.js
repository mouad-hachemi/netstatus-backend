import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const basedir = import.meta.dirname;
const dbFile = path.join(basedir, "app.db");

export const db = new DatabaseSync(dbFile);

const initDb = () => {
  db.exec(
    `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(64) NOT NULL,
      url VARCHAR(512) NOT NULL,
      check_interval INTEGER DEFAULT 60
    );

    CREATE TABLE IF NOT EXISTS ping_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER,
      status_code INTEGER,
      latency_ms FLOAT NOT NULL,
      is_up BOOLEAN TRUE,
      timestamp INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (monitor_id) REFERENCES monitors(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_ping_logs_monitor_time 
    ON ping_logs(monitor_id, timestamp DESC);
    `,
  );
};

initDb();

const insertLogStmt = db.prepare(
  "INSERT INTO ping_logs (monitor_id, status_code, latency_ms, is_up) VALUES (?, ?, ?, ?);",
);

const insertMonitorStms = db.prepare(
  `INSERT INTO monitors (name, url, check_interval)
  VALUES (?, ?, ?);`,
);

const selectMonitorsStmt = db.prepare("SELECT * FROM monitors;");
const selectLastRecordStmt = db.prepare(
  `SELECT timestamp FROM ping_logs
  WHERE monitor_id = ?
  ORDER BY timestamp DESC
  LIMIT 1;
  `,
);
const selectMonitorStatusStmt = db.prepare(
  `SELECT AVG(latency_ms) OVER() AS avg_latency, is_up
  FROM ping_logs
  WHERE monitor_id = ?
  ORDER BY timestamp DESC
  LIMIT 1;
  `,
);

export const insertLog = ({
  monitorId = null,
  statusCode = null,
  latencyMs,
  isUp,
}) => {
  const result = insertLogStmt.run(
    monitorId,
    statusCode,
    latencyMs,
    isUp ? 1 : 0,
  );
};

export const insertMonitor = ({ name, url, freq = 60 }) => {
  console.log(`New monitor: ${name} | ${url} | ${freq}`);
  const result = insertMonitorStms.run(name, url, freq);
};

export const getMonitors = () => {
  const monitors = selectMonitorsStmt.all();
  return monitors;
};

export const getMonitorLastRecord = (monitor) => {
  const result = selectLastRecordStmt.get(monitor.id);
  return result || {};
};

export const getMonitorStatus = (monitor) => {
  const result = selectMonitorStatusStmt.get(monitor.id);
  return result || {};
};
