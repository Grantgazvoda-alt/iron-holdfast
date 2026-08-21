(() => {
  const ABILITIES = [
    ["recruit", "Recruit", "Lighter pressure and weaker enemy troops"],
    ["soldier", "Soldier", "Baseline Iron Holdfast challenge"],
    ["veteran", "Veteran", "Stronger troops and faster pressure"],
    ["warlord", "Warlord", "Maximum pressure, heavier waves and tougher enemies"],
  ];

  let gameSocket = null;
  const NativeWebSocket = window.WebSocket;
  window.WebSocket = function (...args) {
    const ws = new NativeWebSocket(...args);
    const url = String(args[0] || "");
    if (url.includes("/ws/")) gameSocket = ws;
    return ws;
  };
  window.WebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(window.WebSocket, NativeWebSocket);

  function sendConfig(count, ability) {
    if (!gameSocket || gameSocket.readyState !== NativeWebSocket.OPEN) {
      alert("The siege server is reconnecting. Try New Siege again in a moment.");
      return false;
    }
    gameSocket.send(JSON.stringify({ type: "action", action: { type: "resetGame", count, ability } }));
    return true;
  }

  function modal() {
    const wrap = document.createElement("div");
    wrap.id = "newSiegeModal";
    wrap.style.cssText = "position:fixed;inset:0;z-index:80;background:rgba(8,5,2,.88);display:flex;align-items:center;justify-content:center;padding:20px";
    wrap.innerHTML = `
      <div style="width:min(520px,100%);background:linear-gradient(#2b2014,#17100a);border:2px solid #d9a441;border-radius:14px;padding:24px;color:#eadbb8;box-shadow:0 24px 80px #000">
        <div style="font-size:11px;letter-spacing:3px;color:#a99466;margin-bottom:6px">NEW SIEGE</div>
        <h2 style="margin:0 0 8px;color:#d9a441">Choose your enemy command</h2>
        <p style="margin:0 0 18px;color:#d7c7a3">Set how many enemy commanders lead the siege and how capable their armies are.</p>
        <label style="display:block;margin-bottom:6px">Enemy commanders</label>
        <div id="npcCountRow" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px">
          ${[1,2,3,4].map(n => `<button data-count="${n}" style="padding:10px;border-radius:8px;border:1px solid #745b32;background:#21170f;color:#eadbb8;font:14px Georgia;cursor:pointer">${n}</button>`).join("")}
        </div>
        <label for="npcAbility" style="display:block;margin-bottom:6px">Commander ability</label>
        <select id="npcAbility" style="width:100%;padding:10px;border-radius:8px;border:1px solid #745b32;background:#21170f;color:#eadbb8;font:14px Georgia;margin-bottom:7px">
          ${ABILITIES.map(([v,n]) => `<option value="${v}" ${v === "soldier" ? "selected" : ""}>${n}</option>`).join("")}
        </select>
        <div id="npcDesc" style="font-size:12px;color:#a99466;min-height:34px;margin-bottom:16px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="cancelSiege" style="padding:9px 14px;border-radius:8px;border:1px solid #745b32;background:transparent;color:#eadbb8;font:14px Georgia;cursor:pointer">Cancel</button>
          <button id="startSiege" style="padding:9px 16px;border-radius:8px;border:1px solid #d9a441;background:#d9a441;color:#21170f;font:bold 14px Georgia;cursor:pointer">Start Siege</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    let count = Number(localStorage.getItem("hf:npc:count")) || 1;
    let ability = localStorage.getItem("hf:npc:ability") || "soldier";
    const abilityEl = wrap.querySelector("#npcAbility");
    abilityEl.value = ABILITIES.some(([v]) => v === ability) ? ability : "soldier";

    function refresh() {
      wrap.querySelectorAll("[data-count]").forEach((b) => {
        const on = Number(b.dataset.count) === count;
        b.style.borderColor = on ? "#d9a441" : "#745b32";
        b.style.background = on ? "#5b3e18" : "#21170f";
      });
      ability = abilityEl.value;
      const row = ABILITIES.find(([v]) => v === ability);
      wrap.querySelector("#npcDesc").textContent = row ? row[2] : "";
    }
    wrap.querySelectorAll("[data-count]").forEach((b) => b.addEventListener("click", () => { count = Number(b.dataset.count); refresh(); }));
    abilityEl.addEventListener("change", refresh);
    wrap.querySelector("#cancelSiege").addEventListener("click", () => wrap.remove());
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
    wrap.querySelector("#startSiege").addEventListener("click", () => {
      ability = abilityEl.value;
      if (!sendConfig(count, ability)) return;
      localStorage.setItem("hf:npc:count", String(count));
      localStorage.setItem("hf:npc:ability", ability);
      wrap.remove();
    });
    refresh();
  }

  addEventListener("DOMContentLoaded", () => {
    const reset = document.getElementById("btnReset");
    if (!reset) return;
    reset.textContent = "⟳ New Siege";
    reset.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      modal();
    }, true);
  });
})();
