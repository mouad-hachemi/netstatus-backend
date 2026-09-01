/**
 * Authentications routes.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getUserByUsername, createUser, updateUserPassword } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";

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
      {
        userId: user.id,
        username: user.username,
        firstLogin: Boolean(user.first_login),
      },
      JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.status(200).json({
      success: true,
      token,
      firstLogin: Boolean(user.first_login),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/change-password", authenticateToken, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 8 characters long.",
    });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const changes = updateUserPassword(req.user.userId, hashedPassword);
  const token = jwt.sign(
    {
      userId: req.user.userId,
      username: req.user.username,
      firstLogin: false,
    },
    JWT_SECRET,
    { expiresIn: "24h" },
  );
  res
    .status(200)
    .json({ success: true, message: "Password updated successfuly.", token });
});

export default router;
