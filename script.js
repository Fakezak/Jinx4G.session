async function getPair() {
  const phone = document.getElementById("phone").value;
  const codeBox = document.getElementById("codeBox");

  if (!phone) {
    alert("Enter your WhatsApp number");
    return;
  }

  codeBox.innerHTML = "⏳ Generating pair code... please wait";

  try {
    const res = await fetch("/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();

    if (data.pairCode) {
      codeBox.innerHTML = `
        <div class="code">${data.pairCode}</div>
        <p>Enter this in WhatsApp</p>
      `;
    } else {
      codeBox.innerHTML = "❌ Failed to generate code. Try again.";
    }
  } catch (err) {
    codeBox.innerHTML = "❌ Server error. Check console.";
    console.error(err);
  }
}
