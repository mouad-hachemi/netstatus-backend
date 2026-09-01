import express from "express";
import cors from "cors";
import http from "node:http";
import { initWebSocket } from "./services/websocket.js";
import monitorRoutes from "./routes/monitors.js";
import authRoutes from "./routes/auth.js";

const app = express();
const PORT = 8080;

const server = http.createServer(app);

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

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    data: "Hello, Web!",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", monitorRoutes);

initWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});
