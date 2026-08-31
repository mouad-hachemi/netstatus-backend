/**
 * Authentications routes.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getUserByUsername, createUser } from "../db.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "you-cant-guess-this";

router.post("/register", async (req, res) => {
  const { username, password, chat_id: chatId } = req.body;
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
    createUser({ username, hashedPassword, chatId });
    res.status(201).json({ success: true, message: "User created" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/login", async (req, res) => {
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

export default router;
