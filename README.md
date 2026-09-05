# ⚡ NetStatus — Backend Engine

The core backend monitoring service and telemetry engine for **NetStatus**. Built with Node.js, Express, WebSockets, and SQLite, it conducts real-time HTTP, TCP, and ICMP checks, handles user authentication, tracks response history, and dispatches instant Telegram outage notifications.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)

---

## ✨ Features

- **Multi-Protocol Monitoring:** Active support for HTTP/HTTPS URL checks, TCP port testing, and ICMP ping routines.
- **WebSocket Telemetry:** Pushes real-time latency measurements and uptime events directly to connected clients over authenticated WebSockets.
- **Telegram Alerts:** Instant outage alerts sent directly to registered Telegram chat IDs.
- **Hardened Security:** Built-in rate limiting on authentication routes, input validation, and JWT token authorization.
- **Graceful Shutdown:** Cleans up active check timers, flushes WebSockets, and safely closes SQLite database connections on `SIGINT`/`SIGTERM`.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js (>= 20.0.0)
- **Framework:** Express.js
- **Database:** SQLite (`sqlite3`)
- **Real-Time Data:** `ws` (WebSockets)
- **Security & Config:** `dotenv`, `express-rate-limit`, `jsonwebtoken`

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js >= 20.0.0
- npm or pnpm
- `iputils` package (required on Linux for ICMP ping operations)

### 2. Installation

```bash
git clone https://github.com/mouad-hachemi/netstatus-backend.git
cd netstatus-backend
npm install
```
### 3. Environment Configuration

Create a `.env` file in the root directory:

```text
PORT=8080
JWT_SECRET=your_super_secret_jwt_key
TELEGRAM_ID = your_telegram_id
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
INITIAL_ADMIN_USER = optional
INITIAL_ADMIN_PASS = optional
```

### 4. Running Seed Script and the Backend

```bash
# Seed the initial admin user.
node seedAdmin.js

# Run the backend without hot restart.
node app.js

# Or run with host restart (detect changes).
nodemon app.js
```

## 🔗 Related Repositories
- Frontend Dashboard: [netstatus-frontend](https://github.com/mouad-hachemi/netstatus-frontend)

## 📄 License
Distributed under the MIT License.