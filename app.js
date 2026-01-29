 /* Anotador de Generala (simple)
   - Sin resaltado rojo / sin turno visual
   - Doble tap/click: X <-> vacío
   - Mantener apretado: pone X
   - Editable siempre
   - Reset confiable (sin prompt)
   - Undo
*/

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

const MAX_PLAYERS = 15;
const STORAGE_KEY = "generala_scoreboard_v6";

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

/* Undo */
const undoStack = [];
const UNDO_LIMIT = 30;

const sheetEl = document.getElementById("sheet");
const btnAddPlayer = document.getElementById("btnAddPlayer");
const btnReset = document.getElementById("btnReset");
const btnUndo = document.getElementById("btnUndo");
const toastEl = document.getElementById("toast");

if (!sheetEl || !btnAddPlayer || !btnReset || !btnUndo) {
  // Si falta algún elemento, no seguimos (evita que quede “pantalla vacía” sin saber por qué)
  console.error("Faltan elementos en el DOM. Revisá index.html.");
} else {
  wireUI();
  render();
}

function wireUI() {
  btnAddPlayer.addEventListener("click", () => {
    if (state.players.length >= MAX_PLAYERS) {
      alert(`Máximo ${MAX_PLAYERS} jugadores.`);
      return;
    }
    pushUndoSnapshot();
    const n = state.players.length + 1;
    state.players.push({ name: `Jugador ${n}`, scores: emptyScores() });
    saveAndRender();
  });

  btnUndo.addEventListener("click", () => {
    if (!undoStack.length) {
      showToast("No hay nada para deshacer.");
      return;
    }
    state = sanitizeState(undoStack.pop());
    saveAndRender(false);
    showToast("Deshecho.");
  });

  // RESET sin prompt (funciona en PWA móvil)
  btnReset.addEventListener("click", () => {
    const resetScores = confirm(
      "¿Resetear SOLO los puntajes?\n(Se mantienen los jugadores y nombres)\n\nOK = Sí\nCancelar = Otras opciones"
    );

    if (resetScores) {
      pushUndoSnapshot();
      state.players.forEach(p => (p.scores = emptyScores()));
      saveAndRender();
      showToast("Puntajes reseteados.");
      return;
    }

    const resetAll = confirm(
      "¿Resetear TODO?\n(Vuelve a 2 jugadores y borra todo)\n\nOK = Sí\nCancelar = No hacer nada"
    );

    if (!resetAll) return;

    pushUndoSnapshot();
    state = makeDefaultState();
    saveAndRender();
    showToast("Planilla reiniciada.");
  });
}

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

function addLongPress(el, ms, onLongPress) {
  let timer = null;
  let moved = false;

  const start = () => {
    moved = false;
    timer = setTimeout(() => {
      timer = null;
      if (!moved) onLongPress();
    }, ms);
  };

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const move = () => { moved = true; };

  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchcancel", cancel);
  el.addEventListener("touchmove", move, { passive: true });

  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
  el.addEventListener("mousemove", move);
}

function updateTotals(table) {
  const totalCells = table.querySelectorAll(".total-cell");
  totalCells.forEach((td, i) => {
    td.textContent = computeTotal(state.players[i]);
  });
}

function pushUndoSnapshot() {
  const snap = JSON.parse(JSON.stringify(state));
  undoStack.push(snap);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 1200);
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

      pushUndoSnapshot();
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

      const commit = (rawValue) => {
        const before = state.players[pIdx].scores[cat.id];
        const raw = (rawValue ?? "").trim();

        if (raw === "") {
          state.players[pIdx].scores[cat.id] = "";
        } else if (raw.toUpperCase() === "X") {
          state.players[pIdx].scores[cat.id] = "X";
        } else {
          const cleaned = raw.replace(/[^\d]/g, "");
          state.players[pIdx].scores[cat.id] = cleaned === "" ? "" : normalizeCellValue(cleaned);
        }

        const after = state.players[pIdx].scores[cat.id];
        inp.value = after;
        styleCellInput(inp);

        if (before !== after) pushUndoSnapshot();
        saveState(state);
        updateTotals(table);
      };

      inp.addEventListener("input", () => {
        const v = inp.value.trim();
        if (v.toUpperCase() === "X") {
          inp.value = "X";
          styleCellInput(inp);
          return;
        }
        const cleaned = v.replace(/[^\d]/g, "");
        if (inp.value !== cleaned) inp.value = cleaned;
        styleCellInput(inp);
      });

      inp.addEventListener("blur", () => commit(inp.value));

      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); inp.blur(); }
        if (e.key === "Escape") {
          inp.value = state.players[pIdx].scores[cat.id];
          styleCellInput(inp);
          inp.blur();
        }
      });

      // Doble click: X <-> vacío (si había número, pone X)
      inp.addEventListener("dblclick", (e) => {
        e.preventDefault();
        const cur = state.players[pIdx].scores[cat.id];
        pushUndoSnapshot();
        state.players[pIdx].scores[cat.id] = (cur === "X") ? "" : "X";
        inp.value = state.players[pIdx].scores[cat.id];
        styleCellInput(inp);
        saveState(state);
        updateTotals(table);
      });

      // Long press: pone X (no alterna)
      addLongPress(inp, 600, () => {
        const cur = state.players[pIdx].scores[cat.id];
        if (cur === "X") return;
        pushUndoSnapshot();
        state.players[pIdx].scores[cat.id] = "X";
        inp.value = "X";
        styleCellInput(inp);
        saveState(state);
        updateTotals(table);
        showToast("X");
      });

      td.appendChild(inp);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  // FILA TOTAL
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

function saveAndRender(save = true) {
  if (save) saveState(state);
  render();
}
