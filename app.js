/* Anotador de Generala (clásico / compacto)
   - Hasta 15 jugadores
   - Celdas: "" pendiente, "X" tachado, número anotado
   - Totales automáticos
   - Guarda en localStorage
*/

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

const MAX_PLAYERS = 15;
const STORAGE_KEY = "generala_scoreboard_v3";

const CATEGORIES = [
  { id: "c1", label: "1 (unos)" },
  { id: "c2", label: "2 (doses)" },
  { id: "c3", label: "3 (treses)" },
  { id: "c4", label: "4 (cuatros)" },
  { id: "c5", label: "5 (cincos)" },
  { id: "c6", label: "6 (seises)" },
  { id: "escalera", label: "Escalera" },
  { id: "full", label: "Full" },
  { id: "poker", label: "Póker" },
  { id: "generala", label: "Generala" },
  { id: "doble", label: "Doble Generala" },
];

let state = loadState() || makeDefaultState();

const sheetEl = document.getElementById("sheet");
const btnAddPlayer = document.getElementById("btnAddPlayer");
const btnReset = document.getElementById("btnReset");

btnAddPlayer.addEventListener("click", () => {
  if (state.players.length >= MAX_PLAYERS) {
    alert(`Máximo ${MAX_PLAYERS} jugadores.`);
    return;
  }
  const n = state.players.length + 1;
  state.players.push({ name: `Jugador ${n}`, scores: emptyScores() });
  saveAndRender();
});

btnReset.addEventListener("click", () => {
  if (!confirm("¿Resetear toda la planilla?")) return;
  state = makeDefaultState();
  saveAndRender();
});

function makeDefaultState() {
  return {
    players: [
      { name: "Jugador 1", scores: emptyScores() },
      { name: "Jugador 2", scores: emptyScores() },
    ],
  };
}

function emptyScores() {
  const scores = {};
  for (const c of CATEGORIES) scores[c.id] = "";
  return scores;
}

function sanitizeState(input) {
  const out = { players: [] };
  const players = Array.isArray(input?.players) ? input.players : [];

  for (const p of players.slice(0, MAX_PLAYERS)) {
    const name = (p?.name ?? "Jugador").toString().slice(0, 18);
    const scores = emptyScores();
    const inScores = p?.scores && typeof p.scores === "object" ? p.scores : {};

    for (const c of CATEGORIES) {
      const v = (inScores[c.id] ?? "").toString().trim();
      scores[c.id] = normalizeCellValue(v);
    }

    out.players.push({ name: name || "Jugador", scores });
  }

  return out.players.length ? out : makeDefaultState();
}

function normalizeCellValue(v) {
  if (v === "") return "";
  if (v.toUpperCase() === "X") return "X";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const nn = clampInt(Math.round(n), 0, 999);
  return String(nn);
}

function clampInt(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function computeTotal(player) {
  let total = 0;
  for (const c of CATEGORIES) {
    const v = player.scores[c.id];
    if (v === "" || v === "X") continue;
    const n = Number(v);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function styleCellInput(inp) {
  const v = inp.value.trim();
  if (v.toUpperCase() === "X") inp.classList.add("tachado");
  else inp.classList.remove("tachado");
}

function updateTotals(table) {
  const totalCells = table.querySelectorAll(".total-cell");
  totalCells.forEach((td, i) => {
    td.textContent = computeTotal(state.players[i]);
  });
}

function render() {
  const table = document.createElement("table");
  table.className = "table";

  // HEAD
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");

  const th0 = document.createElement("th");
  th0.textContent = "Jugada";
  trHead.appendChild(th0);

  state.players.forEach((player, idx) => {
    const th = document.createElement("th");

    const wrap = document.createElement("div");
    wrap.className = "player-head";

    const input = document.createElement("input");
    input.className = "player-name";
    input.value = player.name;
    input.placeholder = "Nombre";
    input.setAttribute("aria-label", `Nombre jugador ${idx + 1}`);

    input.addEventListener("focus", () => input.select());

    input.addEventListener("input", () => {
      state.players[idx].name = input.value.slice(0, 18);
      saveState(state);
    });

    const del = document.createElement("button");
    del.className = "del";
    del.title = "Eliminar jugador";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      if (!confirm(`¿Eliminar a "${player.name}"?`)) return;
      state.players.splice(idx, 1);
      if (state.players.length === 0) state = makeDefaultState();
      saveAndRender();
    });

    wrap.appendChild(input);
    wrap.appendChild(del);
    th.appendChild(wrap);
    trHead.appendChild(th);
  });

  thead.appendChild(trHead);
  table.appendChild(thead);

  // BODY
  const tbody = document.createElement("tbody");

  for (const cat of CATEGORIES) {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = cat.label;
    tr.appendChild(tdLabel);

    state.players.forEach((player, pIdx) => {
      const td = document.createElement("td");
      const inp = document.createElement("input");
      inp.className = "cell-input";
      inp.placeholder = "—";
      inp.value = player.scores[cat.id];

      styleCellInput(inp);

      inp.addEventListener("input", () => {
        const raw = inp.value.trim();

        if (raw === "") {
          state.players[pIdx].scores[cat.id] = "";
        } else if (raw.toUpperCase() === "X") {
          state.players[pIdx].scores[cat.id] = "X";
        } else {
          const cleaned = raw.replace(/[^\d]/g, "");
          inp.value = cleaned;
          state.players[pIdx].scores[cat.id] = cleaned === "" ? "" : normalizeCellValue(cleaned);
        }

        styleCellInput(inp);
        saveState(state);
        updateTotals(table);
      });

      // doble tap/click: X / vacío
      inp.addEventListener("dblclick", () => {
        const cur = state.players[pIdx].scores[cat.id];
        state.players[pIdx].scores[cat.id] = (cur === "X") ? "" : "X";
        inp.value = state.players[pIdx].scores[cat.id];
        styleCellInput(inp);
        saveState(state);
        updateTotals(table);
      });

      td.appendChild(inp);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  // TOTAL
  const trTotal = document.createElement("tr");

  const tdT = document.createElement("td");
  tdT.textContent = "TOTAL";
  tdT.className = "total";
  trTotal.appendChild(tdT);

  state.players.forEach((player) => {
    const td = document.createElement("td");
    td.className = "total total-cell";
    td.textContent = computeTotal(player);
    trTotal.appendChild(td);
  });

  tbody.appendChild(trTotal);
  table.appendChild(tbody);

  sheetEl.innerHTML = "";
  sheetEl.appendChild(table);
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveAndRender() {
  saveState(state);
  render();
}

render();