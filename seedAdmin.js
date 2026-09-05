import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, getUserByUsername, createUser } from "./db.js";

// Configurable admin credentials (overridden by .env if provided)
const ADMIN_USERNAME = process.env.INITIAL_ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASS || "admin1234";
const TELEGRAM_ID = process.env.TELEGRAM_ID;

if (!TELEGRAM_ID) {
  console.log("Please be sure to enter a TELEGRAM ID to the .env file.");
  process.exit(1);
}

async function seedAdmin() {
  console.log("🌱 Starting admin seed process...");

  try {
    // 1. Ensure ADMIN doesn't exists yet.
    const row = getUserByUsername(ADMIN_USERNAME);
    if (row) {
      console.log(
        `ℹ️  Admin user "${ADMIN_USERNAME}" already exists. Skipping seed.`,
      );
      db.close();
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    createUser({
      username: ADMIN_USERNAME,
      hashedPassword,
      chatId: TELEGRAM_ID,
    });
    console.log(`✅ Admin account "${ADMIN_USERNAME}" created successfully!`);
    console.log(`🔑 Default Password: ${ADMIN_PASSWORD}`);
    console.log(
      `⚠️  Note: 'first_login' is set to 1. User will be prompted to change password on first login.`,
    );
  } catch (error) {
    console.log("Error occured:", error);
  } finally {
    db.close();
  }
}

seedAdmin();
