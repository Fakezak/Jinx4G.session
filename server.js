/**
 * Jinx4G Mini Phone - Railway-ready
 */

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");

const app = express();

// Increase JSON limit for Baileys large payloads
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Config
const ownerNumber = "YOUR_NUMBER_WITH_COUNTRY_CODE"; // replace with your number
let sock;
let pairingInProgress = false;
let targetNumber = null;

// Start mini-device pairing
async function startMiniDevice(phoneNumber) {
  if (pairingInProgress) throw new Error("Pairing already in progress");

  pairingInProgress = true;
  targetNumber = phoneNumber.replace(/[^0-9]/g, "");

  const { state, saveCreds } = await useMultiFileAuthState("./sessions");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Jinx4G MiniPhone", "Chrome", "1.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log(`✅ Mini Phone linked for ${targetNumber}`);

      const sessionId = "Jinx4G-MD." + crypto.randomBytes(10).toString("hex");

      // Send message to owner only
      await sock.sendMessage(
        `${ownerNumber}@s.whatsapp.net`,
        {
          text: `📱 Mini Phone Linked!\nUser: ${targetNumber}\nSession ID: ${sessionId}\nJinx4G Connected`
        }
      );

      pairingInProgress = false;
      targetNumber = null;
    }

    if (connection === "close") {
      pairingInProgress = false;
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) console.log("🔁 Socket closed unexpectedly");
    }
  });

  if (!sock.authState.creds.registered) {
    // Only send minimal info to frontend
    const pairCode = await sock.requestPairingCode(targetNumber);
    return pairCode;
  } else {
    pairingInProgress = false;
    throw new Error("Device already registered");
  }
}

// API endpoint
app.post("/api/pair", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number required" });

  try {
    const code = await startMiniDevice(phone);
    res.json({ pairCode: code });
  } catch (err) {
    console.error(err.message); // minimal logging
    res.status(500).json({ error: err.message || "Failed to generate pair code" });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌊 Jinx4G Mini Phone server running on port ${PORT}`));
