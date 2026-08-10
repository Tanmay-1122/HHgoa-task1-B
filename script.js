(() => {
  "use strict";

  /* =========================================================
     CONFIG — layout fractions verified against assets/hh-frame.webp
     ========================================================= */
  const FRAME_SRC = "assets/hh-frame.webp";
  const CANVAS_W = 1600;
  const CANVAS_H = 764; // matches frame aspect ratio (1546:738)

  // Photo slot — left portion of the cream field, clear of the palm tree & diya
  const PHOTO_RECT = { x0: 0.115, y0: 0.17, x1: 0.37, y1: 0.80 };
  // Text block — right portion of the cream field, clear of the jhumar chain & scooter
  const TEXT_X0 = 0.40, TEXT_X1 = 0.86;
  const TEXT_Y0 = 0.32, TEXT_Y1 = 0.76;

  const COLORS = {
    greenDark: "#0A2E1C",
    greenBrand: "#0B5D34",
    gold: "#F2C22E",
    pink: "#CC3769",
    cream: "#FAF4E8",
  };

  const RARITIES = [
    { key: "common", label: "COMMON", weight: 60 },
    { key: "rare", label: "RARE", weight: 30 },
    { key: "epic", label: "EPIC", weight: 9 },
    { key: "legendary", label: "LEGENDARY", weight: 1 },
  ];

  const ADJECTIVES = [
    "Midnight", "Overclocked", "Feral", "Barefoot", "Recursive", "Async",
    "Caffeinated", "Sunburnt", "Unstoppable", "Serverless", "Analog",
    "Nocturnal", "Chaotic-Good", "Beachside", "Terminal-Bound",
    "Zero-Latency", "Salt-Crusted", "Off-Grid", "Hyperfocused", "Tideworn",
  ];

  const ROLE_POOLS = [
    { keys: ["ai", "ml", "gpt", "llm", "model"], nouns: ["Prompt Whisperer", "Model Tamer", "Gradient Surfer", "Neural Nomad", "Embedding Alchemist", "Token Wrangler"] },
    { keys: ["backend", "infra", "server", "devops", "cloud"], nouns: ["Uptime Guardian", "Queue Wrangler", "Latency Slayer", "Ship-It Engineer", "Cache Whisperer", "Pipeline Captain"] },
    { keys: ["frontend", "design", "ui", "ux"], nouns: ["Pixel Sculptor", "Interface Poet", "Component Whisperer", "Vibes Architect", "Layout Alchemist"] },
    { keys: ["product", "founder", "pm", "growth"], nouns: ["Roadmap Rebel", "Zero-to-One Operator", "Stakeholder Whisperer", "Growth Gremlin", "Demo Day Menace"] },
    { keys: ["crypto", "web3", "chain", "solidity", "token"], nouns: ["Onchain Operator", "Block Wrangler", "Gas Fee Gremlin", "Ledger Nomad", "Consensus Chaser"] },
    { keys: ["data", "analytics"], nouns: ["Signal Hunter", "Dashboard Druid", "Metric Mercenary"] },
  ];
  const DEFAULT_NOUNS = ["Full-Stack Nomad", "Ship Captain", "Code Alchemist", "Builder-in-Chief", "Sandbox Renegade", "Beach Ops Lead"];

  /* =========================================================
     STATE
     ========================================================= */
  const state = {
    photoEl: null,      // downscaled HTMLImageElement, ready to draw
    faceCenter: null,   // {x,y} fraction of photo, or null
    name: "",
    role: "",
    rerollSeed: 0,
    rarity: RARITIES[0],
    builderClass: "",
    cardNumber: 1,
    lastBlob: null,
  };

  let frameImg = null;
  let frameReady = null;

  /* =========================================================
     DOM
     ========================================================= */
  const $ = (id) => document.getElementById(id);
  const dropzone = $("dropzone");
  const dropzoneEmpty = $("dropzone-empty");
  const dropzonePreview = $("dropzone-preview");
  const dropzoneStatus = $("dropzone-status");
  const fileInput = $("file-input");
  const form = $("details-form");
  const inputName = $("input-name");
  const inputRole = $("input-role");
  const btnGenerate = $("btn-generate");
  const panelInput = $("panel-input");
  const panelResult = $("panel-result");
  const cardStage = $("card-stage");
  const canvas = $("card-canvas");
  const ctx = canvas.getContext("2d");
  const tagRarity = $("tag-rarity");
  const tagNumber = $("tag-number");
  const btnReroll = $("btn-reroll");
  const btnDownload = $("btn-download");
  const btnShare = $("btn-share");
  const btnRestart = $("btn-restart");
  const toastEl = $("toast");

  /* =========================================================
     INIT — preload frame + fonts so generation has zero fetch delay
     ========================================================= */
  let frameLoaded = false;
  frameReady = new Promise((resolve) => {
    frameImg = new Image();
    frameImg.onload = () => { frameLoaded = true; resolve(); };
    frameImg.onerror = () => {
      frameLoaded = false;
      console.error(`Frame art failed to load from "${FRAME_SRC}". Check that assets/hh-frame.webp exists next to index.html.`);
      resolve(); // fail open — draw will just skip the frame
    };
    frameImg.src = FRAME_SRC;
  });

  const fontsReady = (document.fonts && document.fonts.ready)
    ? Promise.all([
        document.fonts.load('700 64px "Fraunces"'),
        document.fonts.load('700 24px "Space Mono"'),
        document.fonts.load('400 24px "Space Mono"'),
      ]).catch(() => {}).then(() => document.fonts.ready)
    : Promise.resolve();

  /* =========================================================
     UPLOAD HANDLING
     ========================================================= */
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  ["dragover", "dragenter"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("is-dragover"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("is-dragover"); })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) handleFile(file);
  });

  function setStatus(msg) {
    if (!msg) { dropzoneStatus.hidden = true; return; }
    dropzoneStatus.textContent = msg;
    dropzoneStatus.hidden = false;
  }

  async function handleFile(file) {
    dropzoneEmpty.hidden = true;
    dropzonePreview.hidden = true;
    setStatus("Reading photo…");

    try {
      let workingFile = file;

      const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
      if (isHeic) {
        setStatus("Converting HEIC…");
        if (typeof heic2any !== "function") {
          throw new Error("HEIC support is still loading — try again in a second.");
        }
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        workingFile = Array.isArray(converted) ? converted[0] : converted;
      }

      setStatus("Preparing…");
      const bitmap = await loadDownscaledBitmap(workingFile, 1600);

      if (state.photoEl && state.photoEl.close) state.photoEl.close();
      state.photoEl = bitmap;
      state.faceCenter = await detectFaceCenter(bitmap);

      drawPreview(bitmap);
      dropzonePreview.hidden = false;
      setStatus(null);
      updateGenerateEnabled();
    } catch (err) {
      console.error(err);
      setStatus(null);
      dropzoneEmpty.hidden = false;
      showToast(err.message || "Couldn't read that photo — try another file.");
    }
  }

  // Decode + downscale via createImageBitmap end to end — no canvas.toDataURL
  // round trip anywhere in this path. Some privacy-hardened browsers (Brave's
  // fingerprinting protection, in particular) intercept/alter canvas pixel
  // readback (toDataURL/getImageData/toBlob) unless the user explicitly
  // grants permission, which silently corrupted photos in an earlier version
  // of this pipeline. createImageBitmap never exposes pixel data back to JS,
  // so it isn't subject to that guard.
  async function loadDownscaledBitmap(fileOrBlob, maxDim) {
    if (!("createImageBitmap" in window)) {
      return legacyDownscaleViaCanvas(fileOrBlob, maxDim);
    }
    const raw = await createImageBitmap(fileOrBlob);
    const scale = Math.min(1, maxDim / Math.max(raw.width, raw.height));
    if (scale >= 1) return raw;

    const w = Math.max(1, Math.round(raw.width * scale));
    const h = Math.max(1, Math.round(raw.height * scale));
    const resized = await createImageBitmap(raw, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    raw.close();
    return resized;
  }

  // Fallback only for browsers with no createImageBitmap support at all
  // (essentially none in practice today) — kept so the app degrades rather
  // than hard-fails.
  function legacyDownscaleViaCanvas(file, maxDim) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.round(img.naturalWidth * scale);
          const h = Math.round(img.naturalHeight * scale);
          const off = document.createElement("canvas");
          off.width = w; off.height = h;
          off.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(off);
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Draws straight from the bitmap into the preview <canvas> — again, no
  // toDataURL involved, just a cover-fit drawImage.
  function drawPreview(bitmap) {
    const pctx = dropzonePreview.getContext("2d");
    const cw = dropzonePreview.width, ch = dropzonePreview.height;
    const crop = coverCropRect(bitmap.width, bitmap.height, cw, ch, 0.5, 0.42);
    pctx.clearRect(0, 0, cw, ch);
    pctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cw, ch);
  }

  // Auto-fit only — no manual crop step. Bias the crop toward a detected
  // face when the browser supports it; otherwise a plain center-crop.
  async function detectFaceCenter(bitmap) {
    try {
      if (!("FaceDetector" in window)) return null;
      const fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await fd.detect(bitmap);
      if (!faces || !faces.length) return null;
      const box = faces[0].boundingBox;
      return {
        x: (box.x + box.width / 2) / bitmap.width,
        y: (box.y + box.height / 2) / bitmap.height,
      };
    } catch {
      return null;
    }
  }

  /* =========================================================
     FORM
     ========================================================= */
  function updateGenerateEnabled() {
    const ok = !!state.photoEl && inputName.value.trim().length > 0 && inputRole.value.trim().length > 0;
    btnGenerate.disabled = !ok;
  }
  inputName.addEventListener("input", updateGenerateEnabled);
  inputRole.addEventListener("input", updateGenerateEnabled);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (btnGenerate.disabled) return;
    state.name = inputName.value.trim();
    state.role = inputRole.value.trim();
    state.rerollSeed = 0;
    state.cardNumber = nextCardNumber();
    rollClassAndRarity();
    await renderCard();
    showResultPanel();
  });

  /* =========================================================
     GENERATION LOGIC
     ========================================================= */
  function hashStr(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function rollClassAndRarity() {
    const seedBase = `${state.name}|${state.role}|${state.rerollSeed}`;
    const h1 = hashStr(seedBase);
    const h2 = hashStr(seedBase + "|noun");

    const adjective = ADJECTIVES[h1 % ADJECTIVES.length];
    const roleLower = state.role.toLowerCase();
    const pool = ROLE_POOLS.find((p) => p.keys.some((k) => roleLower.includes(k)));
    const nouns = pool ? pool.nouns : DEFAULT_NOUNS;
    const noun = nouns[h2 % nouns.length];
    state.builderClass = `The ${adjective} ${noun}`;

    // Rarity: independent weighted roll, re-rolled with the reroll button too
    const seedRoll = hashStr(seedBase + "|rarity|" + Math.random());
    let roll = seedRoll % 100;
    let acc = 0;
    state.rarity = RARITIES[0];
    for (const r of RARITIES) {
      acc += r.weight;
      if (roll < acc) { state.rarity = r; break; }
    }
  }

  function nextCardNumber() {
    const key = "hhgoa_card_count";
    const n = (parseInt(localStorage.getItem(key) || "0", 10) || 0) + 1;
    localStorage.setItem(key, String(n));
    return n;
  }

  btnReroll.addEventListener("click", async () => {
    state.rerollSeed += 1;
    rollClassAndRarity();
    await renderCard();
  });

  /* =========================================================
     CANVAS RENDER
     ========================================================= */
  function coverCropRect(srcW, srcH, targetW, targetH, biasX, biasY) {
    const srcRatio = srcW / srcH;
    const targetRatio = targetW / targetH;
    let cw, ch;
    if (srcRatio > targetRatio) { ch = srcH; cw = ch * targetRatio; }
    else { cw = srcW; ch = cw / targetRatio; }

    const bx = biasX == null ? 0.5 : biasX;
    const by = biasY == null ? 0.5 : biasY;

    let cx = srcW * bx - cw / 2;
    let cy = srcH * by - ch / 2;
    cx = Math.max(0, Math.min(srcW - cw, cx));
    cy = Math.max(0, Math.min(srcH - ch, cy));
    return { sx: cx, sy: cy, sw: cw, sh: ch };
  }

  function fitText(ctx, text, font, maxWidth, minSize) {
    // font is a template like '700 64px "Fraunces"' — shrink the size until it fits
    const m = font.match(/(\d+)px/);
    let size = m ? parseInt(m[1], 10) : 40;
    let f = font;
    ctx.font = f;
    while (ctx.measureText(text).width > maxWidth && size > minSize) {
      size -= 2;
      f = font.replace(/\d+px/, size + "px");
      ctx.font = f;
    }
    return f;
  }

  async function renderCard() {
    await Promise.all([frameReady, fontsReady]);

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 1. frame (background + border art)
    if (frameImg && frameImg.complete && frameImg.naturalWidth) {
      ctx.drawImage(frameImg, 0, 0, CANVAS_W, CANVAS_H);
    } else if (!frameLoaded) {
      warnFrameMissingOnce();
    }

    // 2. photo, auto-fit into the photo slot (drawn OVER the frame's cream
    //    fill, then the frame's border art reads on top visually because the
    //    photo never extends outside the slot bounds)
    if (state.photoEl) {
      const px0 = PHOTO_RECT.x0 * CANVAS_W, py0 = PHOTO_RECT.y0 * CANVAS_H;
      const px1 = PHOTO_RECT.x1 * CANVAS_W, py1 = PHOTO_RECT.y1 * CANVAS_H;
      const pw = px1 - px0, ph = py1 - py0;

      const bias = state.faceCenter || { x: 0.5, y: 0.42 };
      const crop = coverCropRect(state.photoEl.width, state.photoEl.height, pw, ph, bias.x, bias.y);

      ctx.save();
      roundRectPath(ctx, px0, py0, pw, ph, 10);
      ctx.clip();
      ctx.drawImage(state.photoEl, crop.sx, crop.sy, crop.sw, crop.sh, px0, py0, pw, ph);
      ctx.restore();

      ctx.lineWidth = 5;
      ctx.strokeStyle = "#FFFFFF";
      roundRectPath(ctx, px0, py0, pw, ph, 10);
      ctx.stroke();
    }

    // 3. text block
    const tx0 = TEXT_X0 * CANVAS_W;
    const tx1 = TEXT_X1 * CANVAS_W;
    const maxTextWidth = tx1 - tx0;
    let cursorY = TEXT_Y0 * CANVAS_H;

    ctx.textBaseline = "top";

    // eyebrow
    ctx.font = '400 22px "Space Mono"';
    ctx.fillStyle = COLORS.greenBrand;
    ctx.fillText("HH GOA 2026 · BUILDER ID", tx0, cursorY);
    cursorY += 0.0542 * CANVAS_H;

    // name
    const nameFont = fitText(ctx, state.name, '700 70px "Fraunces"', maxTextWidth, 34);
    ctx.font = nameFont;
    ctx.fillStyle = COLORS.greenDark;
    ctx.fillText(state.name, tx0, cursorY);
    cursorY += 0.1084 * CANVAS_H;

    // builder class
    const classFont = fitText(ctx, state.builderClass, '700 24px "Space Mono"', maxTextWidth, 15);
    ctx.font = classFont;
    ctx.fillStyle = COLORS.pink;
    ctx.fillText(state.builderClass, tx0, cursorY);
    cursorY += 0.0569 * CANVAS_H;

    // role chip
    ctx.font = '400 22px "Space Mono"';
    const roleText = state.role.toUpperCase();
    const roleMetrics = ctx.measureText(roleText);
    const chipW = roleMetrics.width + 40;
    const chipH = 48;
    ctx.strokeStyle = COLORS.greenBrand;
    ctx.lineWidth = 3;
    roundRectPath(ctx, tx0, cursorY, chipW, chipH, chipH / 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.greenBrand;
    ctx.fillText(roleText, tx0 + 20, cursorY + 13);

    // footer: rarity + card number
    const footY = TEXT_Y1 * CANVAS_H - 0.0623 * CANVAS_H;
    ctx.font = '700 22px "Space Mono"';
    const rarityLabel = state.rarity.label;
    const rw = ctx.measureText(rarityLabel).width + 34;
    ctx.fillStyle = rarityFillColor(state.rarity.key);
    roundRectPath(ctx, tx0, footY, rw, 42, 21);
    ctx.fill();
    if (state.rarity.key === "common") {
      ctx.strokeStyle = COLORS.greenBrand;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.fillStyle = rarityTextColor(state.rarity.key);
    ctx.fillText(rarityLabel, tx0 + 17, footY + 10);

    ctx.font = '400 20px "Space Mono"';
    ctx.fillStyle = COLORS.greenBrand;
    const cardNumStr = `No. ${String(state.cardNumber).padStart(6, "0")}`;
    const cnW = ctx.measureText(cardNumStr).width;
    ctx.fillText(cardNumStr, tx1 - cnW, footY + 11);

    // update on-page tags to match
    tagRarity.textContent = state.rarity.label;
    tagRarity.dataset.rarity = state.rarity.key;
    tagNumber.textContent = cardNumStr;

    // cache a blob for instant download/share
    state.lastBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  }

  let frameWarningShown = false;
  function warnFrameMissingOnce() {
    if (frameWarningShown) return;
    frameWarningShown = true;
    showToast("Frame art didn't load — check assets/hh-frame.webp is present.");
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function rarityFillColor(key) {
    if (key === "epic") return COLORS.gold;
    if (key === "legendary") return COLORS.pink;
    if (key === "common") return "transparent";
    return COLORS.pink; // rare
  }
  function rarityTextColor(key) {
    if (key === "epic") return COLORS.greenDark;
    if (key === "common") return COLORS.greenBrand;
    return "#FFFFFF";
  }

  /* =========================================================
     PANEL SWITCHING + REVEAL
     ========================================================= */
  function showResultPanel() {
    panelInput.classList.remove("panel--active");
    panelResult.classList.add("panel--active");
    cardStage.classList.remove("is-visible");
    requestAnimationFrame(() => requestAnimationFrame(() => cardStage.classList.add("is-visible")));
  }

  btnRestart.addEventListener("click", () => {
    if (state.photoEl && state.photoEl.close) state.photoEl.close();
    state.photoEl = null;
    state.faceCenter = null;
    form.reset();
    dropzoneEmpty.hidden = false;
    dropzonePreview.hidden = true;
    dropzonePreview.getContext("2d").clearRect(0, 0, dropzonePreview.width, dropzonePreview.height);
    updateGenerateEnabled();
    panelResult.classList.remove("panel--active");
    panelInput.classList.add("panel--active");
  });

  /* =========================================================
     DOWNLOAD + SHARE
     ========================================================= */
  function captionFor(rarityKey) {
    const base = "Just generated my Builder ID for HH Goa 2026 🌴";
    const byRarity = {
      common: `${base} #FrameInGoa`,
      rare: `${base} — pulled a RARE card 💫 #FrameInGoa`,
      epic: `${base} — EPIC pull 🔥 #FrameInGoa`,
      legendary: `${base} — LEGENDARY pull ⚡️🏆 #FrameInGoa`,
    };
    return byRarity[rarityKey] || byRarity.common;
  }

  btnDownload.addEventListener("click", async () => {
    if (!state.lastBlob) return;
    downloadBlob(state.lastBlob, `hh-goa-2026-builder-id-${state.cardNumber}.png`);
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  btnShare.addEventListener("click", async () => {
    if (!state.lastBlob) return;
    const caption = captionFor(state.rarity.key);
    const filename = `hh-goa-2026-builder-id-${state.cardNumber}.png`;

    const file = new File([state.lastBlob], filename, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: caption });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // user cancelled — do nothing
        // fall through to the desktop fallback below
      }
    }

    downloadBlob(state.lastBlob, filename);
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`;
    window.open(intentUrl, "_blank", "noopener");

    const copied = await tryCopyImageToClipboard(state.lastBlob);
    showToast(copied
      ? "Image downloaded & copied — paste it into the tweet with Ctrl+V (Cmd+V on Mac)."
      : "Image downloaded — attach it to your tweet.");
  });

  async function tryCopyImageToClipboard(blob) {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) return false;
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return true;
    } catch {
      return false; // no permission, insecure context, or unsupported — fall back silently
    }
  }

  /* =========================================================
     TOAST
     ========================================================= */
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3800);
  }
})();
