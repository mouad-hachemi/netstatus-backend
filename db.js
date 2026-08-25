import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const basedir = import.meta.dirname;
const dbFile = path.join(basedir, "app.db");

export const db = new DatabaseSync(dbFile);

const initDb = () => {
  db.exec(
    `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(32) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(64) NOT NULL,
      url VARCHAR(512) NOT NULL,
      type VARCHAR(16) DEFAULT 'HTTP',
      port INTEGER DEFAULT NULL,
      check_interval INTEGER DEFAULT 60
    );

    CREATE TABLE IF NOT EXISTS ping_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER,
      status_code INTEGER,
      latency_ms FLOAT,
      is_up BOOLEAN TRUE,
      timestamp INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alert_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(64) NOT NULL,
      chat_id VARCHAR(64) NOT NULL UNIQUE
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
  `INSERT INTO monitors (name, url, type, port, check_interval)
  VALUES (?, ?, ?, ?, ?);`,
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

const selectMonitorsLogsStms = db.prepare(
  `
  SELECT status_code, latency_ms, is_up
  FROM ping_logs
  WHERE monitor_id = ?
  ORDER BY timestamp DESC
  LIMIT 50;
  `,
);

const selectMonitorName = db.prepare(
  `
  SELECT name FROM monitors WHERE id = ?;
  `,
);

const deleteMonitorStmt = db.prepare(
  `
  DELETE FROM monitors
  WHERE id = ?;
  `,
);

const selectAlertRecipientStmt = db.prepare("SELECT * FROM alert_recipients;");

const selectSingleAlertRecipientByChatId = db.prepare(
  "SELECT name FROM alert_recipients WHERE chat_id = ?;",
);

const insertAlertRecipientStmt = db.prepare(
  `
  INSERT INTO alert_recipients (name, chat_id)
  VALUES (?, ?);
  `,
);
const deleteAlertRecipientStmt = db.prepare(
  `
  DELETE FROM alert_recipients
  WHERE id = ?;
  `,
);

const insertUserStmt = db.prepare(
  `INSERT INTO users (username, password_hash) VALUES (?, ?);`,
);

const selectUserByUsernameStmt = db.prepare(
  `SELECT * FROM users WHERE username = ?;`,
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

export const insertMonitor = ({
  name,
  url,
  type = "HTTP",
  port = null,
  freq = 60,
}) => {
  console.log(
    `New monitor: ${name} | ${url} | ${type}:${port || "N/A"} | ${freq} |`,
  );
  const result = insertMonitorStms.run(name, url, type, port, freq);
  return result.changes;
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

export const getMonitorLogs = (monitorId) => {
  const name = selectMonitorName.get(monitorId)?.name;
  const logs = selectMonitorsLogsStms.all(monitorId);
  return { name, logs };
};

export const deleteMonitor = (monitorId) => {
  const count = deleteMonitorStmt.run(monitorId)?.changes;
  // Return deleted rows count.
  return count;
};

export const getAlertRecipients = () => {
  const result = selectAlertRecipientStmt.all();
  return result;
};

export const getSingleAlertRecipient = (chatId) => {
  const result = selectSingleAlertRecipientByChatId.get(chatId);
  return result;
};

export const insertAlertRecipient = ({ name, chatId }) => {
  console.log(`New alert recipient added: ${name}:${chatId}`);
  const result = insertAlertRecipientStmt.run(name, chatId);
  return result.changes;
};

export const deleteAlertRecipient = (id) => {
  const result = deleteAlertRecipientStmt.run(id);
  return result.changes;
};

export const createUser = ({ username, hashedPassword }) => {
  const result = insertUserStmt.run(username, hashedPassword);
  return result.changes;
};

export const getUserByUsername = (username) => {
  const result = selectUserByUsernameStmt.get(username);
  return result;
};
