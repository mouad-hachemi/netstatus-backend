import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const basedir = import.meta.dirname;
const dbFile = path.join(basedir, "app.db");

export const db = new DatabaseSync(dbFile);

const insertStmt = db.prepare(
  "INSERT INTO ping_logs (monitor_id, status_code, latency_ms, is_up) VALUES (?, ?, ?, ?);",
);

export const initDb = () => {
  db.exec(
    `CREATE TABLE IF NOT EXISTS monitors (
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
    `,
  );
};

export const insertLog = ({
  monitorId = null,
  statusCode = null,
  latencyMs,
  isUp,
}) => {
  const result = insertStmt.run(monitorId, statusCode, latencyMs, isUp ? 1 : 0);
};