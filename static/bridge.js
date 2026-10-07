const dot = (el, kind) => {
  el.className = "dot" + (kind ? " " + kind : "");
};

async function refresh() {
  const res = await fetch("/api/status");
  const s = await res.json();
  document.getElementById("msfs-text").textContent = s.msfs ? "Connected" : "Not detected";
  dot(document.getElementById("msfs-dot"), s.msfs ? "on" : "bad");
  document.getElementById("server-text").textContent = "Running";
  document.getElementById("ipad-text").textContent = s.ipadClients ? "Connected" : "Waiting";
  dot(document.getElementById("ipad-dot"), s.ipadClients ? "on" : "wait");
  document.getElementById("aircraft-text").textContent = s.aircraft || "—";
  document.getElementById("address").textContent = s.url;
  document.getElementById("qr").src = "/qr.svg?t=" + encodeURIComponent(s.token);
  document.getElementById("open-efb").href = "/?pair=" + encodeURIComponent(s.token);
  document.getElementById("set-port").textContent = s.port;
  document.getElementById("set-ip").textContent = s.ip;
  document.getElementById("set-provider").textContent = s.provider;
  document.getElementById("set-sim").textContent = s.simconnect ? "Connected" : "Simulated provider";
  document.getElementById("logs").textContent = (s.logs || []).join("\n");
}

document.getElementById("phase-jump").addEventListener("change", (event) => {
  fetch("/api/phase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: event.target.value })
  });
});

refresh();
setInterval(refresh, 1000);
