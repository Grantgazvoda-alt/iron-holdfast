(() => {
  const NativeWebSocket = window.WebSocket;
  let activeSocket = null;
  let snapshot = null;
  let mounted = false;

  const safeText = (value) => String(value ?? "");
  const sendAction = (action) => {
    if (!activeSocket || activeSocket.readyState !== NativeWebSocket.OPEN) {
      setStatus("Reconnecting to the war room…");
      return;
    }
    activeSocket.send(JSON.stringify({ type: "action", action }));
  };

  function setStatus(text) {
    const el = document.getElementById("campaignHudStatus");
    if (el) el.textContent = text;
  }

  function observeSocket(ws, url) {
    if (!String(url || "").includes("/ws/")) return;
    activeSocket = ws;
    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string" || event.data === "__pong") return;
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type !== "state") return;
        snapshot = msg;
        render();
      } catch {
        // The main client owns protocol errors; this layer stays presentation-only.
      }
    });
    ws.addEventListener("open", () => setStatus("Campaign link live"));
    ws.addEventListener("close", () => setStatus("Campaign link reconnecting…"));
  }

  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(Target, args) {
      const ws = Reflect.construct(Target, args);
      observeSocket(ws, args[0]);
      return ws;
    },
  });

  function mount() {
    if (mounted || !document.body) return;
    mounted = true;
    const style = document.createElement("style");
    style.textContent = `
      #campaignHud{position:fixed;z-index:40;right:max(10px,env(safe-area-inset-right));top:calc(62px + env(safe-area-inset-top));width:min(320px,calc(100vw - 20px));font:12px/1.3 system-ui,-apple-system,sans-serif;color:#f5ead1;background:rgba(26,18,12,.93);border:1px solid rgba(217,164,65,.72);border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.45);backdrop-filter:blur(7px);overflow:hidden;pointer-events:auto}
      #campaignHud[hidden]{display:none}
      #campaignHudHead{display:flex;align-items:center;gap:8px;padding:8px 10px;background:linear-gradient(#4a3524,#2b2017);border-bottom:1px solid rgba(217,164,65,.45)}
      #campaignHudHead strong{color:#e4b654;letter-spacing:1.5px;font-size:11px}
      #campaignHudHead button{margin-left:auto;background:#17100b;color:#ead9b7;border:1px solid #70552f;border-radius:8px;min-height:34px;padding:5px 9px;font-weight:700}
      #campaignHudBody{padding:9px 10px;display:grid;gap:8px}
      .campaignStats{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
      .campaignStat{background:#130e0a;border:1px solid #4d3924;border-radius:8px;padding:6px;text-align:center;min-width:0}
      .campaignStat b{display:block;color:#f0c969;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .campaignStat span{font-size:9px;color:#bca98a;text-transform:uppercase;letter-spacing:.7px}
      #campaignHudActions,#campaignBattleActions{display:flex;gap:6px;flex-wrap:wrap}
      #campaignHud button.action,#campaignBattleActions button{appearance:none;border:1px solid #816231;background:linear-gradient(#5d4225,#3a2919);color:#fff2d3;border-radius:9px;min-height:40px;padding:7px 10px;font-weight:800;flex:1 1 auto}
      #campaignHud button.danger{border-color:#9b493d;background:linear-gradient(#77372f,#48201d)}
      #campaignHud button.primary{border-color:#c79a3d;background:linear-gradient(#8a682a,#594118)}
      #campaignHudStatus{color:#bfae92;font-size:10px;min-height:13px}
      #campaignBattleCard{position:fixed;z-index:50;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 24px));background:rgba(22,14,10,.98);color:#f8ecd2;border:2px solid #b88b35;border-radius:16px;padding:16px;box-shadow:0 22px 70px rgba(0,0,0,.72);font:14px/1.35 system-ui,-apple-system,sans-serif;pointer-events:auto}
      #campaignBattleCard[hidden]{display:none}
      #campaignBattleCard h2{margin:0 0 4px;color:#e1b452;font-family:Georgia,serif;letter-spacing:1px}
      #campaignBattleCard .versus{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin:12px 0}
      #campaignBattleCard .army{background:#120d09;border:1px solid #4b3825;border-radius:10px;padding:10px;text-align:center}
      #campaignBattleCard .army b{display:block;font-size:22px;color:#f0c969}
      #campaignBattleCard .vs{color:#a9936e;font-weight:900}
      #campaignBattleLog{max-height:78px;overflow:auto;color:#c7b79d;font-size:11px;margin:8px 0}
      @media(max-width:720px){#campaignHud{top:auto;bottom:calc(88px + env(safe-area-inset-bottom));left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));width:auto}#campaignHudBody{padding:7px}.campaignStats{grid-template-columns:repeat(4,1fr)}#campaignBattleCard{top:46%;padding:14px}#campaignHud button.action,#campaignBattleActions button{min-height:44px}}
    `;
    document.head.appendChild(style);

    const hud = document.createElement("aside");
    hud.id = "campaignHud";
    hud.hidden = true;
    hud.setAttribute("aria-label", "Kingdom campaign controls");
    hud.innerHTML = `
      <div id="campaignHudHead"><strong>KINGDOM COMMAND</strong><button type="button" id="campaignWorldBtn">World · W</button></div>
      <div id="campaignHudBody">
        <div class="campaignStats">
          <div class="campaignStat"><b id="campaignArmy">—</b><span>Army</span></div>
          <div class="campaignStat"><b id="campaignSupply">—</b><span>Supply</span></div>
          <div class="campaignStat"><b id="campaignGold">—</b><span>Gold</span></div>
          <div class="campaignStat"><b id="campaignControl">—</b><span>Control</span></div>
        </div>
        <div id="campaignHudActions"></div>
        <div id="campaignHudStatus">Campaign link starting…</div>
      </div>`;
    document.body.appendChild(hud);

    const battle = document.createElement("section");
    battle.id = "campaignBattleCard";
    battle.hidden = true;
    battle.setAttribute("role", "dialog");
    battle.setAttribute("aria-label", "Field battle orders");
    battle.innerHTML = `
      <h2 id="campaignBattleTitle">FIELD BATTLE</h2>
      <div id="campaignBattleTerrain"></div>
      <div class="versus">
        <div class="army">YOUR ARMY<b id="campaignBattlePlayer">—</b><span id="campaignBattlePlayerMorale"></span></div>
        <div class="vs">VS</div>
        <div class="army"><span id="campaignBattleEnemyName">RIVAL</span><b id="campaignBattleEnemy">—</b><span id="campaignBattleEnemyMorale"></span></div>
      </div>
      <div id="campaignBattleLog"></div>
      <div id="campaignBattleActions">
        <button type="button" data-order="hold">Hold</button>
        <button type="button" data-order="advance" class="primary">Advance</button>
        <button type="button" data-order="charge" class="danger">Charge</button>
        <button type="button" data-order="withdraw">Withdraw</button>
      </div>`;
    document.body.appendChild(battle);

    document.getElementById("campaignWorldBtn")?.addEventListener("click", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", code: "KeyW", bubbles: true }));
    });
    battle.querySelectorAll("[data-order]").forEach((button) => {
      button.addEventListener("click", () => {
        sendAction({ type: "campaign_battle_order", order: button.getAttribute("data-order") });
      });
    });
  }

  function render() {
    mount();
    const hud = document.getElementById("campaignHud");
    const battleCard = document.getElementById("campaignBattleCard");
    const view = snapshot?.view;
    const world = view?.world;
    if (!hud || !battleCard) return;
    if (!world?.army) {
      hud.hidden = true;
      battleCard.hidden = true;
      return;
    }
    hud.hidden = false;
    const friendly = (world.towns || []).filter((town) => town.faction === 0).length;
    const total = (world.towns || []).length;
    document.getElementById("campaignArmy").textContent = safeText(world.army.troops);
    document.getElementById("campaignSupply").textContent = safeText(world.army.supply);
    document.getElementById("campaignGold").textContent = safeText(view?.res?.gold ?? 0);
    document.getElementById("campaignControl").textContent = `${friendly}/${total}`;

    const actions = document.getElementById("campaignHudActions");
    if (actions) {
      actions.replaceChildren();
      const town = (world.towns || []).find(
        (entry) => entry.x === world.army.x && entry.y === world.army.y,
      );
      if (town?.faction === 0 && Number(world.army.supply || 0) < 200) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "action primary";
        button.textContent = "Buy supplies";
        button.addEventListener("click", () => sendAction({ type: "world_resupply" }));
        actions.appendChild(button);
      }
      if (town && town.faction !== 0 && Number(world.army.troops || 0) > 0) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "action danger";
        button.textContent = `Assault ${safeText(town.name)}`;
        button.addEventListener("click", () => sendAction({ type: "world_assault_town" }));
        actions.appendChild(button);
      }
      if (!actions.children.length) {
        const note = document.createElement("span");
        note.textContent = world.army.moving ? "Army marching…" : `Day ${safeText(world.day ?? 0)} · choose a destination on the world map`;
        note.style.color = "#c6b18e";
        actions.appendChild(note);
      }
    }

    const battle = snapshot?.campaignBattle;
    battleCard.hidden = !battle;
    if (battle) {
      document.getElementById("campaignBattleTitle").textContent = battle.status === "resolved" ? `BATTLE · ${safeText(battle.result).toUpperCase()}` : "FIELD BATTLE";
      document.getElementById("campaignBattleTerrain").textContent = `Round ${safeText(battle.round)} · ${safeText(battle.terrainName)}`;
      document.getElementById("campaignBattlePlayer").textContent = safeText(battle.player?.troops);
      document.getElementById("campaignBattlePlayerMorale").textContent = `Morale ${safeText(Math.round(battle.player?.morale ?? 0))}`;
      document.getElementById("campaignBattleEnemyName").textContent = safeText(battle.lordName || "Rival");
      document.getElementById("campaignBattleEnemy").textContent = safeText(battle.enemy?.troops);
      document.getElementById("campaignBattleEnemyMorale").textContent = `Morale ${safeText(Math.round(battle.enemy?.morale ?? 0))}`;
      document.getElementById("campaignBattleLog").textContent = (battle.log || []).slice(-3).join(" · ");
      const orderBox = document.getElementById("campaignBattleActions");
      if (orderBox) orderBox.hidden = battle.status !== "active";
    }

    if (snapshot?.status === "over") {
      setStatus(`Campaign ended: ${safeText(snapshot?.result?.result || snapshot?.result || "complete")}`);
    } else {
      setStatus(`Day ${safeText(world.day ?? 0)} · ${friendly} of ${total} settlements held`);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
