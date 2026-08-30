import jwt from "jsonwebtoken";
import { getUserById } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "you-cant-guess-this";

export const authenticatToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "Access token missing" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || !getUserById(user.userId)) {
      return res
        .status(403)
        .json({ success: false, error: "Invalid or expired token" });
    }

    req.user = user;
    next();
  });
};
