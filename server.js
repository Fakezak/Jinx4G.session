const express = require("express");
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const crypto = require("crypto");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let sock;
let currentPhone = null;

async function startBot(phone) {
  currentPhone = phone;

  const { state, saveCreds } = await useMultiFileAuthState("./sessions");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  // When pairing is complete
  sock.ev.on("connection.update", async (update) => {
    if (update.connection === "open") {
      const sessionId =
        "Jinx4G-MD." + crypto.randomBytes(10).toString("hex");

      await sock.sendMessage(
        `${currentPhone}@s.whatsapp.net`,
        {
          text:
            `✅ *Jinx4G Session Linked*\n\n` +
            `🔑 Session ID:\n${sessionId}\n\n` +
            `⚠️ Keep this private`
        }
      );

      console.log("SESSION ID:", sessionId);
    }
  });

  // Generate pairing code
  if (!sock.authState.creds.registered) {
    const code = await sock.requestPairingCode(phone);
    return code;
  }
}

// API: Get Pair Code
app.post("/pair", async (req, res) => {
  const phone = req.body.phone;
  if (!phone) return res.status(400).json({ error: "Phone required" });

  try {
    const pairCode = await startBot(phone);
    res.json({ pairCode });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate pair code" });
  }
});

app.listen(3000, () =>
  console.log("🌐 Jinx4G Session Site Running")
);
