(() => {
  const DEFAULT_SHEET_ID = "1MxROi0vIZ2Dk1doq3jJWlP28_t2R7j7q8N4h1YCs8Qc";
  const VOCAB_SHEET_ID = "17bjNhzlQH43hE3k27ZzRVLZYX3Vt1vEqQXSncy2ADI4";
  const VOCAB_GID = "1950889734";
  const VOCAB_RANGE = "A2:CZ2882";
  /** 語詞造句庫（已有解釋／句子的語詞） */
  const BANK_SHEET_ID = "12tOoECKZELXUdhrJzTQP3h0DgDmS4oM80DdIvIGLpGM";
  const BANK_GID = "257311027";

  /**
   * 冊別選單
   * - rows：A 欄單元、B+C+D 欄生字（一～五冊，同繁體字帖）
   * - columns：第 1 列為單元名，其下各列為該欄生字（TK）
   */
  const BOOKS = [
    {
      id: "book1",
      sheetId: DEFAULT_SHEET_ID,
      gid: "1085808977",
      name: "一冊",
      layout: "rows",
    },
    {
      id: "book2",
      sheetId: DEFAULT_SHEET_ID,
      gid: "1601198504",
      name: "二冊",
      layout: "rows",
    },
    {
      id: "book3",
      sheetId: DEFAULT_SHEET_ID,
      gid: "1424562399",
      name: "三冊",
      layout: "rows",
    },
    {
      id: "book4",
      sheetId: DEFAULT_SHEET_ID,
      gid: "1127835491",
      name: "四冊",
      layout: "rows",
    },
    {
      id: "book5",
      sheetId: DEFAULT_SHEET_ID,
      gid: "1033469457",
      name: "五冊",
      layout: "rows",
    },
    {
      id: "tk",
      sheetId: "18VNo2yeCM9x_IVds85WkIV2ueyKc-IAj60UNvOglGxM",
      gid: "761917648",
      name: "TK",
      layout: "rows",
    },
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
    bookLinkList: document.getElementById("book-link-list"),
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
    autoRevealBtn: document.getElementById("auto-reveal-btn"),
    revealSpeed: document.getElementById("reveal-speed"),
    nextBtn: document.getElementById("next-btn"),
    exitBtn: document.getElementById("exit-btn"),
    answerToast: document.getElementById("answer-toast"),
    answerChar: document.getElementById("answer-char"),
    doneOverlay: document.getElementById("done-overlay"),
    confettiCanvas: document.getElementById("confetti-canvas"),
    prevUnitBtn: document.getElementById("prev-unit-btn"),
    replayUnitBtn: document.getElementById("replay-unit-btn"),
    nextUnitBtn: document.getElementById("next-unit-btn"),
    doneMenuBtn: document.getElementById("done-menu-btn"),
    termPoolBtn: document.getElementById("term-pool-btn"),
    termPoolFab: document.getElementById("term-pool-fab"),
    fabStack: document.getElementById("fab-stack"),
    vocabBtn: document.getElementById("vocab-btn"),
    vocabPanel: document.getElementById("vocab-panel"),
    vocabCloseBtn: document.getElementById("vocab-close-btn"),
    vocabPanelSub: document.getElementById("vocab-panel-sub"),
    vocabStatus: document.getElementById("vocab-status"),
    vocabList: document.getElementById("vocab-list"),
  };

  /** @type {Record<string, {unit: string, chars: string[]}[]>} */
  const cache = {};

  let currentUnits = [];
  let queue = [];
  let index = 0;
  let currentChar = "";
  let autoRevealTimer = null;
  let confettiRaf = null;
  let nextBusy = false;
  /** @type {string[] | null} */
  let vocabTerms = null;
  let vocabLoading = null;
  /** @type {Set<string> | null} 已有造句資料的語詞（比對用，已去 IVS） */
  let bankPlainSet = null;
  let bankLoading = null;
  /** @type {string[]} */
  let termPool = [];
  try {
    const raw = localStorage.getItem("wordpuzzle-term-pool");
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) termPool = parsed.filter(Boolean);
  } catch (e) {}
  const correctAudio = new Audio("sounds/correct.mp3");
  correctAudio.preload = "auto";
  correctAudio.load();

  /**
   * 4x4 揭開順序：中間 4 片順時針，再外圍 12 片順時針
   *  0  1  2  3
   *  4  5  6  7
   *  8  9 10 11
   * 12 13 14 15
   */
  const AUTO_REVEAL_ORDER = [
    5, 6, 10, 9, // 中間
    0, 1, 2, 3, 7, 11, 15, 14, 13, 12, 8, 4, // 外圍
  ];

  function sheetCsvUrl(sheetId, gid) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }

  function getBookById(bookId) {
    return BOOKS.find((b) => b.id === bookId) || null;
  }

  function uniqueHanChars(raw) {
    const seen = new Set();
    const out = [];
    for (const ch of extractChars(raw)) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      out.push(ch);
    }
    return out;
  }

  /** 一～五冊：A=單元；生字讀 B+C+D（同繁體字帖） */
  function parseRowUnits(rows) {
    const start = /課次|週數|單元/.test(rows[0]?.[0] || "") ? 1 : 0;
    const units = [];
    for (let i = start; i < rows.length; i += 1) {
      const unit = (rows[i][0] || "").trim();
      const raw = [1, 2, 3]
        .map((c) => rows[i][c] || "")
        .join("")
        .replace(/\s/g, "");
      const chars = uniqueHanChars(raw);
      if (!unit || !chars.length) continue;
      units.push({ unit, chars });
    }
    return units;
  }

  /** TK：第 1 列為單元名，其下各列串成該欄生字 */
  function parseColumnUnits(rows) {
    if (!rows.length) return [];
    const headers = rows[0] || [];
    const units = [];
    for (let col = 0; col < headers.length; col += 1) {
      const unit = String(headers[col] || "").trim();
      if (!unit) continue;
      let raw = "";
      for (let r = 1; r < rows.length; r += 1) {
        raw += rows[r][col] || "";
      }
      const chars = uniqueHanChars(raw);
      if (!chars.length) continue;
      units.push({ unit, chars });
    }
    return units;
  }

  async function loadBook(bookId) {
    if (cache[bookId]) return cache[bookId];
    const book = getBookById(bookId);
    if (!book) throw new Error("找不到冊別");

    const res = await fetch(sheetCsvUrl(book.sheetId, book.gid), {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`讀取試算表失敗（HTTP ${res.status}）`);
    }

    const text = await res.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      throw new Error("試算表是空的");
    }

    const units =
      book.layout === "columns" ? parseColumnUnits(rows) : parseRowUnits(rows);

    cache[bookId] = units;
    return units;
  }

  function setStatus(msg) {
    els.status.textContent = msg || "";
  }

  function fillBookSelect() {
    els.bookSelect.innerHTML = BOOKS.map(
      (b) => `<option value="${b.id}">${b.name}</option>`
    ).join("");
    els.bookSelect.disabled = false;
    renderBookLinkButtons();
  }

  const PUBLIC_BASE_URL = "https://jojochuang.github.io/wordpuzzle/";

  function bookEntryUrl(bookId) {
    const u = new URL(PUBLIC_BASE_URL);
    u.searchParams.set("book", bookId);
    return u.toString();
  }

  function syncBookQuery(bookId) {
    if (!(window.history && window.history.replaceState)) return;
    try {
      const u = new URL(window.location.href);
      if (bookId) u.searchParams.set("book", bookId);
      else u.searchParams.delete("book");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  function getBookIdFromQuery() {
    try {
      const id = new URLSearchParams(window.location.search).get("book");
      if (id && getBookById(id)) return id;
    } catch (e) {}
    return BOOKS[0]?.id || "";
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function renderBookLinkButtons() {
    if (!els.bookLinkList) return;
    els.bookLinkList.innerHTML = "";
    BOOKS.forEach((book) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "book-link-btn";
      btn.textContent = `複製${book.name}`;
      btn.title = bookEntryUrl(book.id);
      btn.addEventListener("click", async () => {
        const url = bookEntryUrl(book.id);
        const ok = await copyText(url);
        if (ok) {
          btn.classList.add("copied");
          btn.textContent = `已複製${book.name}`;
          setStatus(`${book.name}網址已複製`);
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.textContent = `複製${book.name}`;
          }, 1600);
        } else {
          setStatus("複製失敗，請手動選取網址列");
          window.prompt("複製此網址：", url);
        }
      });
      els.bookLinkList.appendChild(btn);
    });
  }

  async function refreshCurrentBook() {
    const bookId = els.bookSelect.value;
    if (!bookId) return;

    syncBookQuery(bookId);
    setStatus("正在讀取試算表…");
    els.unitSelect.disabled = true;
    els.startBtn.disabled = true;

    try {
      delete cache[bookId];
      const units = await loadBook(bookId);
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

  function vocabGvizUrl() {
    return `https://docs.google.com/spreadsheets/d/${VOCAB_SHEET_ID}/gviz/tq?gid=${VOCAB_GID}&range=${encodeURIComponent(VOCAB_RANGE)}&tqx=out:json`;
  }

  function parseGvizJson(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("GViz 回應格式不正確");
    const obj = JSON.parse(text.slice(start, end + 1));
    const rows = obj?.table?.rows || [];
    return rows.map((row) =>
      (row?.c || []).map((c) =>
        c && (c.v ?? c.f) != null ? String(c.v ?? c.f) : ""
      )
    );
  }

  /** 與語詞搜尋工具相同：去括號、去數字；保留 IVS 以對應注音字形 */
  function tokenizeVocabCell(cellText) {
    return String(cellText || "")
      .replace(/\r/g, "\n")
      .split(/[\n,，、；;]+/g)
      .map((s) =>
        s
          .replace(/\([^)]*\)/g, "")
          .replace(/（[^）]*）/g, "")
          .replace(/[0-9０-９]+/g, "")
          .replace(/[\u200B-\u200D\uFEFF]/g, "")
          .trim()
      )
      .filter(Boolean);
  }

  async function loadVocabTerms() {
    if (vocabTerms) return vocabTerms;
    if (vocabLoading) return vocabLoading;

    vocabLoading = (async () => {
      const res = await fetch(vocabGvizUrl(), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parseGvizJson(await res.text());
      const terms = [];
      for (const row of rows) {
        for (let j = 6; j < row.length; j += 1) {
          if (!row[j]) continue;
          terms.push(...tokenizeVocabCell(row[j]));
        }
      }
      vocabTerms = Array.from(new Set(terms));
      return vocabTerms;
    })();

    try {
      return await vocabLoading;
    } finally {
      vocabLoading = null;
    }
  }

  function findVocabForChar(ch) {
    if (!ch || !vocabTerms) return [];
    // 比對時忽略 IVS，顯示時保留 IVS 讓注音字型選對讀音
    return vocabTerms.filter((term) => {
      const plain = term
        .replace(/[\uFE00-\uFE0F]/g, "")
        .replace(/[\u{E0100}-\u{E01EF}]/gu, "");
      return plain.length >= 2 && plain.includes(ch);
    });
  }

  function closeVocabPanel() {
    els.vocabPanel.hidden = true;
  }

  const TERM_POOL_KEY = "wordpuzzle-term-pool";

  function persistTermPool() {
    try {
      localStorage.setItem(TERM_POOL_KEY, JSON.stringify(termPool));
      sessionStorage.setItem(TERM_POOL_KEY, JSON.stringify(termPool));
    } catch (err) {
      console.error(err);
    }
  }

  function updateTermPoolBtn() {
    const label = `語詞庫（${termPool.length}）`;
    const empty = termPool.length === 0;
    if (els.termPoolBtn) {
      els.termPoolBtn.textContent = label;
      els.termPoolBtn.disabled = empty;
    }
    if (els.termPoolFab) {
      els.termPoolFab.textContent = label;
      els.termPoolFab.disabled = empty;
    }
  }

  function addToTermPool(term) {
    if (!term || termPool.includes(term)) return false;
    termPool.push(term);
    persistTermPool();
    updateTermPoolBtn();
    return true;
  }

  function removeFromTermPool(term) {
    const idx = termPool.indexOf(term);
    if (idx === -1) return;
    termPool.splice(idx, 1);
    persistTermPool();
    updateTermPoolBtn();
  }

  function toggleTermPool(term) {
    if (termPool.includes(term)) removeFromTermPool(term);
    else addToTermPool(term);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let termPoolWin = null;

  function openTermPoolPage() {
    if (!termPool.length) return;
    persistTermPool();

    const url = `term-pool.html?t=${Date.now()}`;
    // 同一個瀏覽器視窗開新分頁；具名視窗重用時靠 localStorage + 重新載入
    if (termPoolWin && !termPoolWin.closed) {
      try {
        termPoolWin.focus();
        termPoolWin.location.href = url;
        return;
      } catch (e) {
        termPoolWin = null;
      }
    }

    termPoolWin = window.open(url, "wordpuzzleTermPool");
    if (!termPoolWin) {
      window.alert("瀏覽器擋住新分頁，請允許此網站的彈出式視窗後再試。");
    }
  }

  function plainTermKey(term) {
    return String(term || "")
      .replace(/[\uFE00-\uFE0F]/g, "")
      .replace(/[\u{E0100}-\u{E01EF}]/gu, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();
  }

  function bankGvizUrl(tq) {
    const base = `https://docs.google.com/spreadsheets/d/${BANK_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${BANK_GID}`;
    return tq ? `${base}&tq=${encodeURIComponent(tq)}` : base;
  }

  async function loadBankPlainSet() {
    if (bankPlainSet) return bankPlainSet;
    if (bankLoading) return bankLoading;

    bankLoading = (async () => {
      // 遊戲頁只需判斷「是否已建檔」，只讀 A 欄
      const res = await fetch(bankGvizUrl("select A"), { cache: "no-store" });
      if (!res.ok) throw new Error(`bank HTTP ${res.status}`);
      const rows = parseCsv(await res.text());
      const set = new Set();
      for (const row of rows) {
        const key = plainTermKey(row[0] || "");
        if (!key || key === "語詞") continue;
        set.add(key);
      }
      bankPlainSet = set;
      return bankPlainSet;
    })();

    try {
      return await bankLoading;
    } finally {
      bankLoading = null;
    }
  }

  function termHasBankData(term) {
    return !!(bankPlainSet && bankPlainSet.has(plainTermKey(term)));
  }

  function renderVocabList(terms, ch) {
    els.vocabPanelSub.textContent = `含「${ch}」的語詞`;
    els.vocabList.innerHTML = "";
    if (!terms.length) {
      const empty = document.createElement("p");
      empty.className = "vocab-empty";
      empty.textContent = "找不到相關常用語詞";
      els.vocabList.appendChild(empty);
      els.vocabStatus.textContent = "0 筆";
      return;
    }
    const poolSet = new Set(termPool);
    let bankCount = 0;
    terms.forEach((term) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const inPool = poolSet.has(term);
      const hasBank = termHasBankData(term);
      if (hasBank) bankCount += 1;
      btn.className =
        "vocab-chip" +
        (inPool ? " in-pool" : "") +
        (hasBank ? " has-bank" : "");
      btn.textContent = term;
      btn.title = hasBank
        ? inPool
          ? `已有造句 · 從語詞庫移除「${term}」`
          : `已有造句 · 加入語詞庫「${term}」`
        : inPool
          ? `從語詞庫移除「${term}」`
          : `加入語詞庫「${term}」`;
      btn.addEventListener("click", () => {
        toggleTermPool(term);
        btn.classList.toggle("in-pool", termPool.includes(term));
        const nowInPool = termPool.includes(term);
        btn.title = hasBank
          ? nowInPool
            ? `已有造句 · 從語詞庫移除「${term}」`
            : `已有造句 · 加入語詞庫「${term}」`
          : nowInPool
            ? `從語詞庫移除「${term}」`
            : `加入語詞庫「${term}」`;
        els.vocabStatus.textContent = `共 ${terms.length} 筆 · 語詞庫 ${termPool.length} 個 · 已造句 ${bankCount} 個`;
      });
      els.vocabList.appendChild(btn);
    });
    els.vocabStatus.textContent = `共 ${terms.length} 筆 · 語詞庫 ${termPool.length} 個 · 已造句 ${bankCount} 個（點選加入）`;
  }

  async function openVocabPanel() {
    if (!currentChar) return;
    els.vocabPanel.hidden = false;
    els.vocabPanelSub.textContent = `含「${currentChar}」的語詞`;
    els.vocabStatus.textContent = "資料載入中…";
    els.vocabList.innerHTML = "";

    try {
      await Promise.all([loadVocabTerms(), loadBankPlainSet().catch(() => null)]);
      renderVocabList(findVocabForChar(currentChar), currentChar);
    } catch (err) {
      console.error(err);
      els.vocabStatus.textContent =
        "載入失敗。請確認語詞試算表為「知道連結的任何人可檢視」。";
    }
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

  function fillUnitSelect(units) {
    currentUnits = units;
    els.unitSelect.innerHTML = units.length
      ? units
          .map(
            (u, i) =>
              `<option value="${i}">${escapeHtml(u.unit)}（${escapeHtml(u.chars.join(""))} 共${u.chars.length}字）</option>`
          )
          .join("")
      : `<option value="">此冊沒有可玩的單元</option>`;
    els.unitSelect.disabled = !units.length;
    updatePreview();
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
      btn.dataset.index = String(i);
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
    stopAutoReveal();
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
    if (!els.vocabPanel.hidden) {
      openVocabPanel();
    }
  }

  async function startUnitAt(unitIndex, { requestFs = false } = {}) {
    const unit = currentUnits[unitIndex];
    if (!unit) return;

    els.unitSelect.value = String(unitIndex);
    updatePreview();

    queue = shuffle(unit.chars);
    index = 0;
    nextBusy = false;

    els.teachUnit.textContent = unit.unit;
    els.doneOverlay.hidden = true;
    stopConfetti();
    stopAutoReveal();
    els.setup.hidden = true;
    els.teach.hidden = false;
    if (els.fabStack) els.fabStack.hidden = false;
    if (els.vocabBtn) els.vocabBtn.hidden = false;
    closeVocabPanel();

    showChar(queue[index]);

    if (requestFs) {
      try {
        if (!document.fullscreenElement && els.teach.requestFullscreen) {
          await els.teach.requestFullscreen();
        }
      } catch {
        // 瀏覽器可能阻擋全螢幕；仍可正常教學
      }
    }
  }

  async function enterTeach() {
    await startUnitAt(Number(els.unitSelect.value), { requestFs: true });
  }

  function updateCelebrateActions() {
    const idx = Number(els.unitSelect.value);
    els.prevUnitBtn.disabled = idx <= 0;
    els.nextUnitBtn.disabled = idx >= currentUnits.length - 1;
    updateTermPoolBtn();
  }

  function celebrateComplete() {
    closeVocabPanel();
    updateCelebrateActions();
    els.doneOverlay.hidden = false;
    startConfetti(3200);
    nextBusy = false;
  }

  async function exitTeach() {
    stopAutoReveal();
    stopConfetti();
    els.teach.hidden = true;
    els.setup.hidden = false;
    els.doneOverlay.hidden = true;
    els.answerToast.hidden = true;
    els.vocabBtn.hidden = true;
    if (els.fabStack) els.fabStack.hidden = true;
    closeVocabPanel();
    nextBusy = false;

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  }

  function playCorrect() {
    return new Promise((resolve) => {
      let settled = false;
      let fallbackTimer = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        correctAudio.removeEventListener("ended", finish);
        correctAudio.removeEventListener("error", finish);
        resolve();
      };

      try {
        correctAudio.pause();
        correctAudio.currentTime = 0;
        correctAudio.addEventListener("ended", finish);
        correctAudio.addEventListener("error", finish);

        const armFallback = () => {
          const ms = Number.isFinite(correctAudio.duration) && correctAudio.duration > 0
            ? Math.ceil(correctAudio.duration * 1000) + 50
            : 2400;
          fallbackTimer = setTimeout(finish, ms);
        };

        if (correctAudio.readyState >= 1) armFallback();
        else correctAudio.addEventListener("loadedmetadata", armFallback, { once: true });

        const p = correctAudio.play();
        if (p && typeof p.then === "function") {
          p.catch(() => finish());
        }
      } catch {
        finish();
      }
    });
  }

  async function handleNextOrFinish() {
    if (nextBusy || els.teach.hidden) return;
    nextBusy = true;
    stopAutoReveal();

    try {
      if (index + 1 >= queue.length) {
        celebrateComplete();
      } else {
        await playCorrect();
        index += 1;
        showChar(queue[index]);
      }
    } finally {
      nextBusy = false;
    }
  }

  function stopAutoReveal() {
    if (autoRevealTimer) {
      clearTimeout(autoRevealTimer);
      autoRevealTimer = null;
    }
  }

  function removeTileByIndex(i) {
    const tile = els.tiles.querySelector(`.tile[data-index="${i}"]`);
    if (tile && !tile.classList.contains("gone")) {
      tile.classList.add("gone");
      updateHint();
    }
  }

  /** 速度 1(慢)～10(快) → 間隔毫秒；預設 4 = 1680ms */
  const REVEAL_DELAYS = [0, 3600, 2800, 2200, 1680, 1400, 1100, 900, 700, 520, 350];

  function getRevealDelay() {
    const level = Number(els.revealSpeed?.value) || 4;
    return REVEAL_DELAYS[Math.min(10, Math.max(1, level))] || 1680;
  }

  function autoRevealSequential() {
    stopAutoReveal();
    const pending = AUTO_REVEAL_ORDER.filter((i) => {
      const tile = els.tiles.querySelector(`.tile[data-index="${i}"]`);
      return tile && !tile.classList.contains("gone");
    });
    if (!pending.length) return;

    let step = 0;
    const tick = () => {
      if (step >= pending.length) {
        autoRevealTimer = null;
        return;
      }
      removeTileByIndex(pending[step]);
      step += 1;
      autoRevealTimer = setTimeout(tick, getRevealDelay());
    };
    tick();
  }

  function revealAll() {
    stopAutoReveal();
    els.tiles.querySelectorAll(".tile").forEach((tile) => {
      tile.classList.add("gone");
    });
    updateHint();
  }

  function stopConfetti() {
    if (confettiRaf) {
      cancelAnimationFrame(confettiRaf);
      confettiRaf = null;
    }
    const ctx = els.confettiCanvas?.getContext?.("2d");
    if (ctx && els.confettiCanvas) {
      ctx.clearRect(0, 0, els.confettiCanvas.width, els.confettiCanvas.height);
    }
  }

  function startConfetti(durationMs = 2800) {
    const canvas = els.confettiCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#E0218A", "#FF5F1F", "#00FFFF", "#C6A68F"];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const pieces = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -0.4,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 12,
      vx: -3 + Math.random() * 6,
      vy: 2 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const start = performance.now();
    const frame = (now) => {
      const t = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < durationMs) {
        confettiRaf = requestAnimationFrame(frame);
      } else {
        confettiRaf = null;
      }
    };
    confettiRaf = requestAnimationFrame(frame);
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
    els.autoRevealBtn.addEventListener("click", autoRevealSequential);
    els.nextBtn.addEventListener("click", handleNextOrFinish);
    els.exitBtn.addEventListener("click", exitTeach);
    els.prevUnitBtn.addEventListener("click", () => {
      const idx = Number(els.unitSelect.value);
      if (idx > 0) startUnitAt(idx - 1);
    });
    els.replayUnitBtn.addEventListener("click", () => {
      startUnitAt(Number(els.unitSelect.value));
    });
    els.nextUnitBtn.addEventListener("click", () => {
      const idx = Number(els.unitSelect.value);
      if (idx < currentUnits.length - 1) startUnitAt(idx + 1);
    });
    els.doneMenuBtn.addEventListener("click", exitTeach);
    els.termPoolBtn.addEventListener("click", openTermPoolPage);
    if (els.termPoolFab) {
      els.termPoolFab.addEventListener("click", openTermPoolPage);
    }
    els.vocabBtn.addEventListener("click", () => {
      if (els.vocabPanel.hidden) openVocabPanel();
      else closeVocabPanel();
    });
    els.vocabCloseBtn.addEventListener("click", closeVocabPanel);

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
        handleNextOrFinish();
      } else if (e.key === "a" || e.key === "A") {
        autoRevealSequential();
      } else if (e.key === "r" || e.key === "R") {
        revealAll();
      }
    });
  }

  async function init() {
    bindEvents();
    updateTermPoolBtn();
    fillBookSelect();
    const fromQuery = getBookIdFromQuery();
    if (fromQuery) els.bookSelect.value = fromQuery;
    await refreshCurrentBook();
  }

  init();
})();
