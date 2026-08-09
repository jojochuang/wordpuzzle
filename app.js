(() => {
  const SHEET_ID = "1MxROi0vIZ2Dk1doq3jJWlP28_t2R7j7q8N4h1YCs8Qc";

  /** 試算表分頁：A 欄單元、B 欄生字 */
  const BOOKS = [
    { gid: "1085808977", name: "一冊" },
    { gid: "1601198504", name: "二冊" },
    { gid: "1424562399", name: "三冊" },
    { gid: "1127835491", name: "四冊" },
  ];

  const TILE_COLORS = [
    "#C0C0C0", // Silver
    "#FF0000", // Red
    "#C6A68F", // 淺咖啡
    "#00FF00", // Lime
    "#008000", // Green
    "#0000FF", // Blue
    "#000080", // Navy
    "#FFFF00", // Yellow
    "#808000", // Olive
    "#00FFFF", // Aqua
    "#FF5F1F", // 橘
    "#E0218A", // 粉紅
    "#800080", // Purple
    "#000000", // Black
    "#808080", // Gray
    "#FFFFFF", // White
  ];

  const GRID = 4;
  const TAB_RATIO = 0.22; // 凸起相對單片邊長

  const els = {
    setup: document.getElementById("setup"),
    teach: document.getElementById("teach"),
    bookSelect: document.getElementById("book-select"),
    unitSelect: document.getElementById("unit-select"),
    preview: document.getElementById("preview"),
    startBtn: document.getElementById("start-btn"),
    reloadBtn: document.getElementById("reload-btn"),
    status: document.getElementById("status"),
    teachUnit: document.getElementById("teach-unit"),
    teachProgress: document.getElementById("teach-progress"),
    board: document.getElementById("board"),
    charLayer: document.getElementById("char-layer"),
    tiles: document.getElementById("tiles"),
    hint: document.getElementById("hint"),
    revealBtn: document.getElementById("reveal-btn"),
    showAnswerBtn: document.getElementById("show-answer-btn"),
    nextBtn: document.getElementById("next-btn"),
    exitBtn: document.getElementById("exit-btn"),
    answerToast: document.getElementById("answer-toast"),
    answerChar: document.getElementById("answer-char"),
    doneOverlay: document.getElementById("done-overlay"),
    doneExitBtn: document.getElementById("done-exit-btn"),
  };

  /** @type {Record<string, {unit: string, chars: string[]}[]>} */
  const cache = {};

  let currentUnits = [];
  let queue = [];
  let index = 0;
  let currentChar = "";

  function sheetCsvUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch === "\r") {
        // ignore CR
      } else {
        cell += ch;
      }
    }

    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }

    return rows;
  }

  /** 從格子文字取出可猜的漢字（去掉變體選擇符等） */
  function extractChars(raw) {
    if (!raw) return [];
    const cleaned = String(raw)
      .normalize("NFC")
      .replace(/[\uFE00-\uFE0F]/g, "")
      .replace(/[\u{E0100}-\u{E01EF}]/gu, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "");

    return [...cleaned].filter((ch) => /\p{Script=Han}/u.test(ch));
  }

  function shuffle(arr) {
    const list = [...arr];
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  async function loadBook(gid) {
    if (cache[gid]) return cache[gid];

    const res = await fetch(sheetCsvUrl(gid), { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`讀取試算表失敗（HTTP ${res.status}）`);
    }

    const text = await res.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      throw new Error("試算表是空的");
    }

    // 略過表頭：第一列 A 通常是「課次／週數」
    const start = /課次|週數|單元/.test(rows[0][0] || "") ? 1 : 0;
    const units = [];

    for (let i = start; i < rows.length; i += 1) {
      const unit = (rows[i][0] || "").trim();
      const chars = extractChars(rows[i][1] || "");
      if (!unit || !chars.length) continue;
      units.push({ unit, chars });
    }

    cache[gid] = units;
    return units;
  }

  function setStatus(msg) {
    els.status.textContent = msg || "";
  }

  function fillBookSelect() {
    els.bookSelect.innerHTML = BOOKS.map(
      (b) => `<option value="${b.gid}">${b.name}</option>`
    ).join("");
    els.bookSelect.disabled = false;
  }

  function fillUnitSelect(units) {
    currentUnits = units;
    els.unitSelect.innerHTML = units.length
      ? units
          .map(
            (u, i) =>
              `<option value="${i}">${escapeHtml(u.unit)}（${u.chars.length} 字）</option>`
          )
          .join("")
      : `<option value="">此冊沒有可玩的單元</option>`;
    els.unitSelect.disabled = !units.length;
    updatePreview();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updatePreview() {
    const idx = Number(els.unitSelect.value);
    const unit = currentUnits[idx];
    if (!unit) {
      els.preview.textContent = "請選擇單元";
      els.startBtn.disabled = true;
      return;
    }
    els.preview.textContent = `本單元生字（共 ${unit.chars.length} 字）：${unit.chars.join("、")}`;
    els.startBtn.disabled = unit.chars.length === 0;
  }

  async function refreshCurrentBook() {
    const gid = els.bookSelect.value;
    if (!gid) return;

    setStatus("正在讀取試算表…");
    els.unitSelect.disabled = true;
    els.startBtn.disabled = true;

    try {
      delete cache[gid];
      const units = await loadBook(gid);
      fillUnitSelect(units);
      setStatus(units.length ? "" : "此冊找不到生字資料");
    } catch (err) {
      console.error(err);
      fillUnitSelect([]);
      setStatus(
        "無法讀取試算表。請確認已設為「知道連結的任何人可檢視」，並檢查網路。"
      );
    }
  }

  function makeJigsawEdges() {
    const hEdges = [];
    const vEdges = [];
    for (let r = 0; r < GRID - 1; r += 1) {
      hEdges[r] = [];
      for (let c = 0; c < GRID; c += 1) {
        hEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
      }
    }
    for (let r = 0; r < GRID; r += 1) {
      vEdges[r] = [];
      for (let c = 0; c < GRID - 1; c += 1) {
        vEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
      }
    }
    return { hEdges, vEdges };
  }

  function pieceEdgeSigns(row, col, edges) {
    return {
      top: row === 0 ? 0 : -edges.hEdges[row - 1][col],
      right: col === GRID - 1 ? 0 : edges.vEdges[row][col],
      bottom: row === GRID - 1 ? 0 : edges.hEdges[row][col],
      left: col === 0 ? 0 : -edges.vEdges[row][col - 1],
    };
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  /** 順時針畫出拼圖輪廓；knop +1=向外凸、 -1=向內凹 */
  function buildJigsawPath(size, signs, tabRatio = TAB_RATIO) {
    const tab = size * tabRatio;
    const parts = [];
    let x = 0;
    let y = 0;
    parts.push(`M ${round(x)} ${round(y)}`);

    function drawSide(knop, angleDeg) {
      const rad = (angleDeg * Math.PI) / 180;
      const ax = Math.cos(rad);
      const ay = Math.sin(rad);
      // 順時針外輪廓：行進方向左側 = 向外
      const ox = Math.sin(rad);
      const oy = -Math.cos(rad);

      if (knop === 0) {
        x += size * ax;
        y += size * ay;
        parts.push(`L ${round(x)} ${round(y)}`);
        return;
      }

      const startX = x;
      const startY = y;
      const p = (u, out) => {
        const px = startX + size * u * ax + tab * knop * out * ox;
        const py = startY + size * u * ay + tab * knop * out * oy;
        return `${round(px)} ${round(py)}`;
      };

      parts.push(`L ${p(0.34, 0)}`);
      parts.push(`C ${p(0.37, 0)} ${p(0.4, 0.85)} ${p(0.43, 1)}`);
      parts.push(`C ${p(0.47, 1.18)} ${p(0.53, 1.18)} ${p(0.57, 1)}`);
      parts.push(`C ${p(0.6, 0.85)} ${p(0.63, 0)} ${p(0.66, 0)}`);
      x = startX + size * ax;
      y = startY + size * ay;
      parts.push(`L ${round(x)} ${round(y)}`);
    }

    drawSide(signs.top, 0);
    drawSide(signs.right, 90);
    drawSide(signs.bottom, 180);
    drawSide(signs.left, 270);
    parts.push("Z");
    return parts.join(" ");
  }

  function buildTiles() {
    els.tiles.innerHTML = "";
    const colors = shuffle(TILE_COLORS);
    const edges = makeJigsawEdges();
    const size = 100;
    const pad = size * TAB_RATIO;
    const view = size + pad * 2;

    for (let i = 0; i < GRID * GRID; i += 1) {
      const row = Math.floor(i / GRID);
      const col = i % GRID;
      const signs = pieceEdgeSigns(row, col, edges);
      const d = buildJigsawPath(size, signs);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.style.setProperty("--r", String(row));
      btn.style.setProperty("--c", String(col));
      btn.style.zIndex = String(row * GRID + col + 1);
      btn.setAttribute("aria-label", `拼圖第 ${i + 1} 片`);

      const stroke =
        colors[i] === "#FFFFFF" || colors[i] === "#FFFF00" || colors[i] === "#00FF00"
          ? "rgba(0,0,0,0.28)"
          : "rgba(0,0,0,0.2)";

      btn.innerHTML = `
        <svg viewBox="${-pad} ${-pad} ${view} ${view}" aria-hidden="true">
          <path d="${d}" fill="${colors[i]}" stroke="${stroke}" stroke-width="1.2" vector-effect="non-scaling-stroke" />
        </svg>
      `;

      btn.addEventListener("click", () => {
        if (btn.classList.contains("gone")) return;
        btn.classList.add("gone");
        updateHint();
      });

      els.tiles.appendChild(btn);
    }
  }

  function updateHint() {
    const left = els.tiles.querySelectorAll(".tile:not(.gone)").length;
    if (left === 0) {
      els.hint.textContent = "全部揭開了！猜猜看這是什麼字？";
    } else if (left === 16) {
      els.hint.textContent = "點選彩色拼圖，露出底下的字";
    } else {
      els.hint.textContent = `還剩 ${left} 片遮住 · 猜得出來了嗎？`;
    }
  }

  function showChar(char) {
    currentChar = char;
    const base = els.charLayer.querySelector(".char-base");
    const radical = els.charLayer.querySelector(".char-radical");
    if (base) base.textContent = char;
    if (radical) radical.textContent = char;
    els.answerToast.hidden = true;
    els.board.style.animation = "none";
    // restart board animation
    void els.board.offsetWidth;
    els.board.style.animation = "";
    buildTiles();
    updateHint();
    els.teachProgress.textContent = `${index + 1} / ${queue.length}`;
    els.nextBtn.textContent = index + 1 >= queue.length ? "完成" : "下一字";
  }

  async function enterTeach() {
    const unit = currentUnits[Number(els.unitSelect.value)];
    if (!unit) return;

    queue = shuffle(unit.chars);
    index = 0;

    els.teachUnit.textContent = unit.unit;
    els.doneOverlay.hidden = true;
    els.setup.hidden = true;
    els.teach.hidden = false;

    showChar(queue[index]);

    try {
      if (!document.fullscreenElement && els.teach.requestFullscreen) {
        await els.teach.requestFullscreen();
      }
    } catch {
      // 瀏覽器可能阻擋全螢幕；仍可正常教學
    }
  }

  async function exitTeach() {
    els.teach.hidden = true;
    els.setup.hidden = false;
    els.doneOverlay.hidden = true;
    els.answerToast.hidden = true;

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  }

  function nextChar() {
    if (index + 1 >= queue.length) {
      els.doneOverlay.hidden = false;
      return;
    }
    index += 1;
    showChar(queue[index]);
  }

  function revealAll() {
    els.tiles.querySelectorAll(".tile").forEach((tile) => {
      tile.classList.add("gone");
    });
    updateHint();
  }

  function showAnswer() {
    els.answerChar.textContent = currentChar;
    els.answerToast.hidden = false;
  }

  function bindEvents() {
    els.bookSelect.addEventListener("change", refreshCurrentBook);
    els.unitSelect.addEventListener("change", updatePreview);
    els.startBtn.addEventListener("click", enterTeach);
    els.reloadBtn.addEventListener("click", async () => {
      Object.keys(cache).forEach((k) => delete cache[k]);
      await refreshCurrentBook();
    });
    els.revealBtn.addEventListener("click", revealAll);
    els.showAnswerBtn.addEventListener("click", showAnswer);
    els.nextBtn.addEventListener("click", nextChar);
    els.exitBtn.addEventListener("click", exitTeach);
    els.doneExitBtn.addEventListener("click", exitTeach);

    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && !els.teach.hidden) {
        // 使用者按 Esc 離開全螢幕時，仍留在教學畫面
      }
    });

    document.addEventListener("keydown", (e) => {
      if (els.teach.hidden) return;
      if (e.key === " " || e.key === "Enter") {
        // 空白鍵揭開一片隨機未開的拼圖，方便老師遙控
        if (e.target.closest("button, select, input, textarea")) return;
        e.preventDefault();
        const remaining = [...els.tiles.querySelectorAll(".tile:not(.gone)")];
        if (remaining.length) {
          const pick = remaining[Math.floor(Math.random() * remaining.length)];
          pick.click();
        }
      } else if (e.key === "n" || e.key === "N" || e.key === "ArrowRight") {
        nextChar();
      } else if (e.key === "a" || e.key === "A") {
        showAnswer();
      } else if (e.key === "r" || e.key === "R") {
        revealAll();
      }
    });
  }

  async function init() {
    bindEvents();
    fillBookSelect();
    await refreshCurrentBook();
  }

  init();
})();
