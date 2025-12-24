/**
 * Jinx4G Session ID Server
 * Uses real WhatsApp MD pairing (mini device)
 */

const express = require("express");
const crypto = require("crypto");
const path = require("path");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let sock;
let pairingInProgress = false;
let targetNumber = null;

/**
 * Start WhatsApp socket (only once)
 */
async function startSocket(phoneNumber) {
  if (pairingInProgress) {
    throw new Error("Pairing already in progress");
  }

  pairingInProgress = true;
  targetNumber = phoneNumber.replace(/[^0-9]/g, "");

  const { state, saveCreds } = await useMultiFileAuthState("./sessions");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Jinx4G", "Chrome", "1.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      // ✅ Device successfully linked
      const sessionId =
        "Jinx4G-MD." + crypto.randomBytes(10).toString("hex");

      try {
        await sock.sendMessage(
          `${targetNumber}@s.whatsapp.net`,
          {
            text:
              `✅ *Jinx4G Session Linked*\n\n` +
              `🔑 *Session ID:*\n${sessionId}\n\n` +
              `⚠️ Do NOT share this ID\n` +
              `Use it to deploy your bot`
          }
        );
      } catch (e) {
        console.error("Failed to send session ID:", e);
      }

      pairingInProgress = false;
      targetNumber = null;
    }

    if (connection === "close") {
      pairingInProgress = false;

      const reason =
        lastDisconnect?.error?.output?.statusCode;

      if (reason !== DisconnectReason.loggedOut) {
        console.log("🔁 Socket closed, waiting for next pairing");
      }
    }
  });

  // 🔐 Request pairing code from WhatsApp
  if (!sock.authState.creds.registered) {
    const pairCode = await sock.requestPairingCode(targetNumber);
    return pairCode;
  } else {
    pairingInProgress = false;
    throw new Error("Already registered");
  }
}

/**
 * API: Get Pair Code
 */
app.post("/pair", async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "Phone number required" });
  }

  try {
    const code = await startSocket(phone);
    res.json({ pairCode: code });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      error: "Failed to generate pairing code. Please wait and try again."
    });
  }
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌊 Jinx4G Session Server running on port ${PORT}`);
});
