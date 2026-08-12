(() => {
  "use strict";

  /* =========================================================
     CONFIG — layout fractions verified against assets/hh-frame.webp
     ========================================================= */
  const FRAME_SRC = "assets/hh-frame.webp";
  const PHOTO_FRAME_SRC = "assets/hh-photo-frame.png";
  const STAMP_SRC = "assets/hh-stamp.png";
  const CANVAS_W = 1600;
  const CANVAS_H = 764; // matches frame aspect ratio (1546:738)

  // Photo slot — left portion of the cream field, clear of the palm tree & diya
  const PHOTO_RECT = { x0: 0.14, y0: 0.20, x1: 0.36, y1: 0.80 };
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
    photoPosition: null, // editable crop focus point, {x,y} fractions of source image
    name: "",
    stack: "",
    role: "",
    rerollSeed: 0,
    rarity: RARITIES[0],
    builderClass: "",
    cardNumber: 1,
    lastBlob: null,
    sharedCard: false,
    stampPositions: [],
  };

  let frameImg = null;
  let frameReady = null;
  let photoFrameImg = null;
  let photoFrameReady = null;
  let stampImg = null;
  let stampReady = null;

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
  const inputStack = $("input-stack");
  const inputStackCustom = $("input-stack-custom");
  const inputRole = $("input-role");
  const inputRoleCustom = $("input-role-custom");
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
     DEPTH INTERACTIONS
     Each parallax element's CSS float animation (passport-float,
     coconut-float, etc.) also animates `transform`, which would
     override any JS-set translate. Solution: after entrance
     animations finish we stop those CSS keyframes and drive
     the full transform (base rotation + parallax) from JS.
     ========================================================= */
  function processStarImageTransparency() {
    const starImg = document.querySelector(".sun-disc");
    if (!starImg) return;
    const raw = new Image();
    raw.crossOrigin = "anonymous";
    raw.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = raw.naturalWidth;
        c.height = raw.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(raw, 0, 0);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (r > 215 && g > 215 && b > 215) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        starImg.src = c.toDataURL("image/png");
        starImg.style.mixBlendMode = "normal";
      } catch (e) {
        // Keep CSS mix-blend-mode: multiply as fallback
      }
    };
    raw.src = "assets/JOJO-Star.png";
  }

  function setupDepthInteractions() {
    processStarImageTransparency();
    const heroStage   = document.querySelector(".hero-stage");
    const passport    = document.querySelector(".hero-passport");
    const sunDisc     = document.querySelector(".sun-disc");
    const coconut     = document.querySelector(".scene-coconut");
    const mapEl       = document.querySelector(".scene-map");
    const orbit1      = document.querySelector(".orbit--one");
    const orbit2      = document.querySelector(".orbit--two");
    const cardStageEl = document.querySelector("#card-stage");
    if (!heroStage) return;

    // Base transforms taken from CSS (baked in so we can set transform freely)
    const BASE = {
      passport:  "rotate(7deg)  translateZ(130px)",
      sunDisc:   "translateZ(45px) rotate(11deg)",
      coconut:   "rotate(-10deg) translateZ(110px)",
      map:       "rotate(5deg)  translateZ(120px)",
      orbit1:    "rotate(-20deg) rotateX(63deg)",
      orbit2:    "rotate(28deg)  rotateX(67deg)",
    };

    let parallaxActive = false;
    let frame = 0;
    let pX = 0, pY = 0;
    let tX = 0, tY = 0;

    function activateParallax() {
      if (parallaxActive) return;
      parallaxActive = true;
      // Kill CSS keyframe float animations so JS can own the transforms
      if (passport) { passport.style.animation = "none"; passport.style.transform = BASE.passport; }
      if (sunDisc)  { sunDisc.style.animation  = "none"; sunDisc.style.transform  = BASE.sunDisc; }
      if (coconut)  { coconut.style.animation  = "none"; coconut.style.transform  = BASE.coconut; }
      if (mapEl)    { mapEl.style.animation    = "none"; mapEl.style.transform    = BASE.map; }
      if (orbit1)   { orbit1.style.animation   = "none"; orbit1.style.transform   = BASE.orbit1; }
      if (orbit2)   { orbit2.style.animation   = "none"; orbit2.style.transform   = BASE.orbit2; }
      // Kill stage-breathe so our tilt can work
      if (heroStage) heroStage.style.animation = "none";
    }

    const animate = () => {
      frame = 0;
      pX += (tX - pX) * 0.1;
      pY += (tY - pY) * 0.1;

      // 3-D tilt of the whole stage
      heroStage.style.transform =
        `perspective(900px) rotateX(${(pY * -0.45).toFixed(3)}deg) rotateY(${(pX * 0.45).toFixed(3)}deg)`;

      // Each layer shifts by a different amount (closer = more shift)
      const s = (el, base, mx, my) => {
        if (el) el.style.transform =
          `${base} translate(${(pX * mx).toFixed(2)}px, ${(pY * my).toFixed(2)}px)`;
      };
      s(passport, BASE.passport, 1.0, 1.0);
      s(sunDisc,  BASE.sunDisc,  0.7, 0.7);
      s(coconut,  BASE.coconut,  1.7, 1.7);
      s(mapEl,    BASE.map,      1.5, 1.5);
      s(orbit1,   BASE.orbit1,  -0.5, -0.5);
      s(orbit2,   BASE.orbit2,  -0.3, -0.3);

      if (cardStageEl && cardStageEl.matches(":hover")) {
        cardStageEl.style.transform =
          `perspective(900px) rotateX(${(pY * -0.35).toFixed(3)}deg) rotateY(${(pX * 0.35).toFixed(3)}deg)`;
      }

      if (Math.abs(tX - pX) > 0.01 || Math.abs(tY - pY) > 0.01) {
        frame = requestAnimationFrame(animate);
      }
    };

    const handlePointer = (clientX, clientY) => {
      activateParallax();
      tX = (clientX / window.innerWidth  - 0.5) * 2 * 28;
      tY = (clientY / window.innerHeight - 0.5) * 2 * 20;
      if (!frame) frame = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove",   (e) => handlePointer(e.clientX, e.clientY), { passive: true });
    document.addEventListener("mousemove", (e) => handlePointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "touch") handlePointer(e.clientX, e.clientY);
    }, { passive: true });

    if (cardStageEl) {
      cardStageEl.addEventListener("mouseleave", () => { cardStageEl.style.transform = ""; });
    }
  }
  setupDepthInteractions();

  /* =========================================================
     CINEMATIC ENTRANCE — staggered reveal on page load
     ========================================================= */
  function setupEntranceAnimations() {
    const entranceEls = document.querySelectorAll("[data-entrance]");
    entranceEls.forEach((el) => {
      const type = el.dataset.entrance;
      const delay = parseInt(el.dataset.delay || "0", 10);
      const cls = type === "left" ? "anim-entrance-left" : type === "right" ? "anim-entrance-right" : "anim-entrance";
      el.style.animationDelay = `${delay}ms`;
      el.classList.add(cls);

      const reveal = () => {
        el.classList.remove(cls);
        el.style.opacity = "1";
        el.style.transform = "";
      };

      el.addEventListener("animationend", reveal, { once: true });
      // Safety fallback: if animationend never fires, force visible after delay + 1.2s
      setTimeout(reveal, delay + 1200);
    });
  }
  setupEntranceAnimations();


  /* =========================================================
     CARD SPECULAR HIGHLIGHT — follows mouse over generated card
     ========================================================= */
  function setupSpecularHighlight() {
    const specular = document.getElementById("card-specular");
    const stageEl = document.getElementById("card-stage");
    if (!specular || !stageEl) return;
    stageEl.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const rect = stageEl.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      specular.style.setProperty("--spec-x", `${x}%`);
      specular.style.setProperty("--spec-y", `${y}%`);
    });
    stageEl.addEventListener("pointerleave", () => {
      specular.style.setProperty("--spec-x", "50%");
      specular.style.setProperty("--spec-y", "50%");
    });
  }
  setupSpecularHighlight();



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

  photoFrameReady = Promise.resolve();

  stampReady = new Promise((resolve) => {
    stampImg = new Image();
    stampImg.onload = resolve;
    stampImg.onerror = () => {
      console.warn(`Stamp art failed to load from "${STAMP_SRC}".`);
      resolve();
    };
    stampImg.src = STAMP_SRC;
  });

  // Font loading must never block generation. Some local-file/privacy-
  // hardened browsers leave document.fonts.ready pending indefinitely.
  const fontsReady = (document.fonts && document.fonts.load)
    ? Promise.race([
        Promise.all([
          document.fonts.load('700 64px "Fraunces"'),
          document.fonts.load('700 24px "Space Mono"'),
          document.fonts.load('400 24px "Space Mono"'),
        ]).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ])
    : Promise.resolve();

  // A generated card is a local canvas, so a normal page URL cannot identify
  // it. The share link stores the rendered card in the URL fragment. Fragments
  // are not sent to a server and still work on static hosting.
  const SHARED_CARD_PREFIX = "c=";

  async function loadSharedCardFromUrl() {
    const isCompactLink = location.hash.startsWith(`#${SHARED_CARD_PREFIX}`);
    const isLegacyLink = location.hash.startsWith("#card=");
    if (!isCompactLink && !isLegacyLink) return false;

    try {
      const encoded = location.hash.slice(isCompactLink ? SHARED_CARD_PREFIX.length + 1 : 6);
      const payload = isCompactLink
        ? JSON.parse(decodeUtf8Base64(encoded))
        : JSON.parse(decodeURIComponent(encoded));
      if (!payload || typeof payload.image !== "string" || !payload.image.startsWith("data:image/")) {
        throw new Error("Invalid card link");
      }

      const image = await loadImage(payload.image);
      state.lastBlob = await fetch(payload.image).then((response) => response.blob());
      await Promise.all([frameReady, fontsReady]);
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(image, 0, 0, CANVAS_W, CANVAS_H);
      state.sharedCard = true;
      state.cardNumber = Number(payload.cardNumber) || 1;
      state.rarity = RARITIES.find((rarity) => rarity.key === payload.rarity) || RARITIES[0];
      tagRarity.textContent = state.rarity.label;
      tagRarity.dataset.rarity = state.rarity.key;
      tagNumber.textContent = `No. ${String(state.cardNumber).padStart(6, "0")}`;
      btnReroll.hidden = true;
      btnDownload.hidden = false;
      btnShare.textContent = "𝕏 Share to X";
      showResultPanel();
      showToast("Shared Builder ID loaded");
      return true;
    } catch (err) {
      console.warn("Could not load shared card", err);
      showToast("That card link is invalid or incomplete.");
      history.replaceState(null, "", `${location.pathname}${location.search}`);
      return false;
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  /* =========================================================
     UPLOAD HANDLING
     ========================================================= */
  dropzone.addEventListener("click", (event) => {
    if (event.target === dropzonePreview) return;
    fileInput.click();
  });
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
    dropzonePreview.hidden = true;
    setStatus(null);

    try {
      let workingFile = file;

      const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
      if (isHeic) {
        if (typeof heic2any !== "function") {
          throw new Error("HEIC support is still loading — try again in a second.");
        }
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        workingFile = Array.isArray(converted) ? converted[0] : converted;
      }

      const bitmap = await loadDownscaledBitmap(workingFile, 1600);

      if (state.photoEl && state.photoEl.close) state.photoEl.close();
      state.photoEl = bitmap;
      state.faceCenter = await detectFaceCenter(bitmap);
      state.photoPosition = state.faceCenter || { x: 0.5, y: 0.42 };

      drawPreview(bitmap);
      dropzoneEmpty.hidden = true;
      dropzonePreview.hidden = false;
      dropzone.classList.add("has-photo");
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
    if ("createImageBitmap" in window) {
      try {
        const raw = await withTimeout(createImageBitmap(fileOrBlob), 8000);
        const scale = Math.min(1, maxDim / Math.max(raw.width, raw.height));
        if (scale >= 1) return raw;

        const w = Math.max(1, Math.round(raw.width * scale));
        const h = Math.max(1, Math.round(raw.height * scale));
        const resized = await withTimeout(
          createImageBitmap(raw, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" }),
          8000,
        );
        raw.close();
        return resized;
      } catch (err) {
        console.warn("Fast image decoding failed; using browser fallback.", err);
      }
    }
    return legacyDownscaleViaCanvas(fileOrBlob, maxDim);
  }

  function withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Image decode timed out")), timeoutMs)),
    ]);
  }

  // Fallback only for browsers with no createImageBitmap support at all
  // (essentially none in practice today) — kept so the app degrades rather
  // than hard-fails.
  function legacyDownscaleViaCanvas(file, maxDim) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const off = document.createElement("canvas");
        off.width = w; off.height = h;
        off.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(off);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  // Draws straight from the bitmap into the preview <canvas> — again, no
  // toDataURL involved, just a cover-fit drawImage.
  function drawPreview(bitmap) {
    const pctx = dropzonePreview.getContext("2d");
    const cw = dropzonePreview.width, ch = dropzonePreview.height;
    const focus = state.photoPosition || { x: 0.5, y: 0.42 };
    const crop = coverCropRect(bitmap.width, bitmap.height, cw, ch, focus.x, focus.y);
    pctx.clearRect(0, 0, cw, ch);
    pctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cw, ch);
  }

  let photoDrag = null;
  dropzonePreview.addEventListener("pointerdown", (event) => {
    if (!state.photoEl) return;
    event.preventDefault();
    event.stopPropagation();
    dropzonePreview.setPointerCapture(event.pointerId);
    photoDrag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dropzone.classList.add("is-photo-dragging");
  });
  dropzonePreview.addEventListener("pointermove", (event) => {
    if (!photoDrag || photoDrag.id !== event.pointerId || !state.photoEl) return;
    const rect = dropzonePreview.getBoundingClientRect();
    const dx = event.clientX - photoDrag.x;
    const dy = event.clientY - photoDrag.y;
    const focus = state.photoPosition || { x: 0.5, y: 0.42 };
    focus.x = Math.max(0.05, Math.min(0.95, focus.x - (dx / rect.width) * 0.62));
    focus.y = Math.max(0.05, Math.min(0.95, focus.y - (dy / rect.height) * 0.62));
    state.photoPosition = focus;
    photoDrag.x = event.clientX;
    photoDrag.y = event.clientY;
    drawPreview(state.photoEl);
  });
  function stopPhotoDrag(event) {
    if (!photoDrag || (event && photoDrag.id !== event.pointerId)) return;
    photoDrag = null;
    dropzone.classList.remove("is-photo-dragging");
  }
  dropzonePreview.addEventListener("pointerup", stopPhotoDrag);
  dropzonePreview.addEventListener("pointercancel", stopPhotoDrag);

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
     CUSTOM SELECT COMPONENT
     ========================================================= */
  const OPTION_ICONS = {
    "AI / ML": "🧠",
    "Frontend": "🖥️",
    "Backend / Infra": "⚙️",
    "Mobile": "📱",
    "Design": "🎨",
    "Product": "📦",
    "Web3 / Crypto": "⛓️",
    "Data": "📊",
    "Security": "🛡️",
    "DevRel / Community": "🌐",
    "Builder": "🛠️",
    "Founder": "🚀",
    "Engineer": "💻",
    "Designer": "🎨",
    "Product person": "💡",
    "Researcher": "🔬",
    "Creator": "✨",
    "Community lead": "🤝",
    "Student": "🎓",
    "Write your own…": "✍️",
    "Write your own...": "✍️"
  };

  function getOptionIcon(text) {
    return OPTION_ICONS[text] || "✦";
  }

  function initCustomSelect(selectEl) {
    if (!selectEl || selectEl.dataset.customSelectInit) return;
    selectEl.dataset.customSelectInit = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select-container";

    selectEl.classList.add("native-select-hidden");
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const labelSpan = document.createElement("span");
    labelSpan.className = "custom-select-label";

    const arrowSpan = document.createElement("span");
    arrowSpan.className = "custom-select-arrow";
    arrowSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    trigger.appendChild(labelSpan);
    trigger.appendChild(arrowSpan);
    wrapper.appendChild(trigger);

    const menu = document.createElement("div");
    menu.className = "custom-select-menu";

    const list = document.createElement("ul");
    list.className = "custom-select-options";
    list.setAttribute("role", "listbox");
    menu.appendChild(list);
    wrapper.appendChild(menu);

    function updateTriggerLabel() {
      const selectedOpt = selectEl.options[selectEl.selectedIndex];
      if (selectedOpt && selectedOpt.value) {
        const icon = getOptionIcon(selectedOpt.text);
        labelSpan.innerHTML = `<span class="trigger-icon">${icon}</span><span class="trigger-text">${selectedOpt.text}</span>`;
        trigger.classList.remove("is-placeholder");
      } else {
        const placeholderText = (selectedOpt && selectedOpt.text) ? selectedOpt.text : "Select option";
        labelSpan.innerHTML = `<span class="trigger-text trigger-placeholder">${placeholderText}</span>`;
        trigger.classList.add("is-placeholder");
      }
    }

    function renderOptions() {
      list.innerHTML = "";
      Array.from(selectEl.options).forEach((opt) => {
        const li = document.createElement("li");
        li.className = "custom-select-option";
        if (opt.disabled) {
          li.classList.add("is-header");
          li.textContent = opt.text;
        } else {
          li.setAttribute("role", "option");
          li.setAttribute("data-value", opt.value);
          if (opt.value === selectEl.value) {
            li.classList.add("is-selected");
            li.setAttribute("aria-selected", "true");
          }
          if (opt.value === "__custom__") {
            li.classList.add("is-custom-option");
          }

          const iconSpan = document.createElement("span");
          iconSpan.className = "option-icon";
          iconSpan.textContent = getOptionIcon(opt.text);

          const textSpan = document.createElement("span");
          textSpan.className = "option-text";
          textSpan.textContent = opt.text;

          const checkSpan = document.createElement("span");
          checkSpan.className = "option-check";
          checkSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

          const leftGroup = document.createElement("div");
          leftGroup.className = "option-left";
          leftGroup.appendChild(iconSpan);
          leftGroup.appendChild(textSpan);

          li.appendChild(leftGroup);
          li.appendChild(checkSpan);

          li.addEventListener("click", (e) => {
            e.stopPropagation();
            selectValue(opt.value);
            closeMenu();
          });
        }
        list.appendChild(li);
      });
      updateTriggerLabel();
    }

    function selectValue(val) {
      selectEl.value = val;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      renderOptions();
    }

    function toggleMenu() {
      if (wrapper.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    function openMenu() {
      document.querySelectorAll(".custom-select-container.is-open").forEach(c => {
        if (c !== wrapper) c.classList.remove("is-open");
      });
      wrapper.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      
      const selectedItem = list.querySelector(".is-selected");
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
      }
    }

    function closeMenu() {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      toggleMenu();
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!wrapper.classList.contains("is-open")) {
          openMenu();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const options = Array.from(list.querySelectorAll(".custom-select-option:not(.is-header)"));
          const currentIdx = options.findIndex(o => o.classList.contains("is-selected"));
          let nextIdx = 0;
          if (e.key === "ArrowDown") nextIdx = Math.min(options.length - 1, currentIdx + 1);
          if (e.key === "ArrowUp") nextIdx = Math.max(0, currentIdx - 1);
          if (options[nextIdx]) {
            const val = options[nextIdx].getAttribute("data-value");
            selectValue(val);
          }
        }
      } else if (e.key === "Escape") {
        closeMenu();
      }
    });

    selectEl.addEventListener("change", () => {
      renderOptions();
    });

    renderOptions();
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-select-container")) {
      document.querySelectorAll(".custom-select-container.is-open").forEach(c => {
        c.classList.remove("is-open");
        const tr = c.querySelector(".custom-select-trigger");
        if (tr) tr.setAttribute("aria-expanded", "false");
      });
    }
  });

  /* =========================================================
     FORM
     ========================================================= */
  function updateGenerateEnabled() {
    const ok = !!state.photoEl && inputName.value.trim().length > 0 && getProfileValue(inputStack, inputStackCustom) && getProfileValue(inputRole, inputRoleCustom);
    btnGenerate.disabled = !ok;
  }
  function getProfileValue(select, customInput) {
    if (select.value === "__custom__") return customInput.value.trim();
    return select.value.trim();
  }
  function syncCustomField(select, customInput) {
    const isCustom = select.value === "__custom__";
    select.hidden = isCustom;
    const wrapper = select.closest(".custom-select-container");
    if (wrapper) wrapper.hidden = isCustom;
    customInput.hidden = !isCustom;
    customInput.required = isCustom;

    let backBtn = customInput.parentElement.querySelector(`.custom-input-back-btn[data-for="${select.id}"]`);
    if (isCustom && !backBtn) {
      backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.className = "custom-input-back-btn";
      backBtn.dataset.for = select.id;
      backBtn.textContent = "← Choose from options list";
      backBtn.addEventListener("click", () => {
        select.value = "";
        customInput.value = "";
        syncCustomField(select, customInput);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      customInput.parentNode.insertBefore(backBtn, customInput.nextSibling);
    } else if (backBtn) {
      backBtn.hidden = !isCustom;
    }

    if (isCustom) customInput.focus();
    updateGenerateEnabled();
  }
  inputName.addEventListener("input", updateGenerateEnabled);
  inputStack.addEventListener("change", () => syncCustomField(inputStack, inputStackCustom));
  inputStackCustom.addEventListener("input", updateGenerateEnabled);
  inputRole.addEventListener("input", updateGenerateEnabled);
  inputRole.addEventListener("change", () => syncCustomField(inputRole, inputRoleCustom));
  inputRoleCustom.addEventListener("input", updateGenerateEnabled);

  // Initialize custom select components
  initCustomSelect(inputStack);
  initCustomSelect(inputRole);

  form.addEventListener("reset", () => {
    setTimeout(() => {
      inputStack.hidden = false;
      inputRole.hidden = false;
      inputStackCustom.hidden = true;
      inputRoleCustom.hidden = true;
      inputStackCustom.required = false;
      inputRoleCustom.required = false;
      document.querySelectorAll(".custom-select-container").forEach(c => {
        c.hidden = false;
      });
      document.querySelectorAll(".custom-input-back-btn").forEach(b => {
        b.hidden = true;
      });
      [inputStack, inputRole].forEach(sel => {
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (btnGenerate.disabled) return;
    btnGenerate.disabled = true;
    const originalLabel = btnGenerate.textContent;
    btnGenerate.textContent = "Generating…";
    try {
      state.name = inputName.value.trim();
      state.stack = getProfileValue(inputStack, inputStackCustom);
      state.role = getProfileValue(inputRole, inputRoleCustom);
      state.rerollSeed = 0;
      state.cardNumber = nextCardNumber();
      state.stampPositions = pickStampPositions();
      rollClassAndRarity();
      await renderCard();
      showResultPanel();
    } catch (err) {
      console.error("Builder ID generation failed", err);
      showToast("The card could not be generated. Please try the photo again.");
    } finally {
      btnGenerate.textContent = originalLabel;
      updateGenerateEnabled();
    }
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
    const seedBase = `${state.name}|${state.stack}|${state.role}|${state.rerollSeed}`;
    const h1 = hashStr(seedBase);
    const h2 = hashStr(seedBase + "|noun");

    const adjective = ADJECTIVES[h1 % ADJECTIVES.length];
    const profileLower = `${state.stack} ${state.role}`.toLowerCase();
    const pool = ROLE_POOLS.find((p) => p.keys.some((k) => profileLower.includes(k)));
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
    state.stampPositions = pickStampPositions();
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

  function pickStampPositions() {
    // Official Officer Stamp — placed directly overlapping the photo boundary
    // so the ink seal extends across the portrait onto the passport page.
    const photoOverlaps = [
      { x: 0.33, y: 0.70, size: 215 }, // Bottom-right corner of photo
      { x: 0.35, y: 0.40, size: 200 }, // Mid-right edge of photo
      { x: 0.27, y: 0.74, size: 210 }, // Bottom edge of photo
      { x: 0.34, y: 0.55, size: 205 }, // Lower-right edge of photo
    ];

    const pageStamps = [
      { x: 0.76, y: 0.18, size: 140 },
      { x: 0.70, y: 0.76, size: 135 },
      { x: 0.86, y: 0.46, size: 125 },
    ];

    const seed = hashStr(`${state.name}|${state.role}|${state.cardNumber}|${state.rerollSeed}|stamp`);

    // Primary official officer stamp over photo boundary
    const primaryIndex = seed % photoOverlaps.length;
    const primary = {
      ...photoOverlaps[primaryIndex],
      rotation: ((seed % 27) - 13), // realistic officer tilt (-13° to +13°)
      opacity: 0.75 + ((seed % 14) / 100), // rich, authentic ink density (0.75 - 0.89)
    };

    // Secondary background stamp on page
    const secondaryIndex = (seed >> 2) % pageStamps.length;
    const secondary = {
      ...pageStamps[secondaryIndex],
      rotation: (((seed * 7) % 31) - 15),
      opacity: 0.45 + ((seed % 20) / 100),
    };

    return [primary];
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
    await Promise.all([frameReady, photoFrameReady, stampReady, fontsReady]);

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

      const bias = state.photoPosition || state.faceCenter || { x: 0.5, y: 0.42 };
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



    // 4. text block
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

    drawPassportStamps();

    // update on-page tags to match
    tagRarity.textContent = state.rarity.label;
    tagRarity.dataset.rarity = state.rarity.key;
    tagNumber.textContent = cardNumStr;

    // cache a blob for instant download/share
    state.lastBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  }

  function drawPassportStamps() {
    if (!stampImg || !stampImg.complete || !stampImg.naturalWidth) return;
    const positions = state.stampPositions.length ? state.stampPositions : pickStampPositions();
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    positions.forEach(({ x, y, size, rotation, opacity }) => {
      const stampW = size;
      const stampH = stampW * (stampImg.naturalHeight / stampImg.naturalWidth);
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(x * CANVAS_W, y * CANVAS_H);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(stampImg, -stampW / 2, -stampH / 2, stampW, stampH);
      ctx.restore();
    });
    ctx.restore();
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

    // Rarity lottery spin animation
    if (!state.sharedCard) {
      runRaritySpin(state.rarity);
    }
  }

  function runRaritySpin(finalRarity) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const labels = ["COMMON", "RARE", "EPIC", "LEGENDARY"];
    const rarityKeys = ["common", "rare", "epic", "legendary"];
    let spins = 0;
    const totalSpins = 12;
    tagRarity.classList.add("is-spinning");
    tagRarity.classList.remove("is-settled");

    const interval = setInterval(() => {
      spins++;
      const idx = spins % labels.length;
      tagRarity.textContent = labels[idx];
      tagRarity.dataset.rarity = rarityKeys[idx];
      if (spins >= totalSpins) {
        clearInterval(interval);
        tagRarity.textContent = finalRarity.label;
        tagRarity.dataset.rarity = finalRarity.key;
        tagRarity.classList.remove("is-spinning");
        tagRarity.classList.add("is-settled");
        setTimeout(() => tagRarity.classList.remove("is-settled"), 400);
      }
    }, 70);
  }

  btnRestart.addEventListener("click", () => {
    if (state.photoEl && state.photoEl.close) state.photoEl.close();
    state.photoEl = null;
    state.faceCenter = null;
    state.photoPosition = null;
    form.reset();
    dropzoneEmpty.hidden = false;
    dropzonePreview.hidden = true;
    dropzone.classList.remove("has-photo", "is-photo-dragging");
    dropzonePreview.getContext("2d").clearRect(0, 0, dropzonePreview.width, dropzonePreview.height);
    updateGenerateEnabled();
    panelResult.classList.remove("panel--active");
    panelInput.classList.add("panel--active");
    if (state.sharedCard) {
      state.sharedCard = false;
      btnReroll.hidden = false;
      btnShare.textContent = "𝕏 Share to X";
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
  });

  /* =========================================================
     DOWNLOAD + SHARE
     ========================================================= */
  function captionFor(rarityKey, name, builderClass) {
    const nameTag = name ? `${name} ` : "";
    const classTag = builderClass ? `"${builderClass}" ` : "";
    const tags = "#HackerHouseGoa #FrameInGoa";
    const byRarity = {
      common:    `${nameTag}just got their Builder ID for HH Goa 2026 🌴 ${classTag}${tags}`,
      rare:      `${nameTag}pulled a RARE Builder ID at HH Goa 2026 💫 ${classTag}${tags}`,
      epic:      `${nameTag}got an EPIC Builder ID at HH Goa 2026 🔥 ${classTag}${tags}`,
      legendary: `${nameTag}just pulled LEGENDARY at HH Goa 2026 ⚡️🏆 ${classTag}${tags}`,
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

    // 1. Auto-download the card image so the user can attach it to the tweet
    const filename = `hh-goa-2026-builder-id-${state.cardNumber}.png`;
    downloadBlob(state.lastBlob, filename);

    // 2. Build the pre-filled tweet caption
    const caption = captionFor(state.rarity.key, state.name, state.builderClass);

    // 3. Open Twitter/X Web Intent with pre-filled text
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");

    showToast("Image saved — attach it to your tweet! 🌴");
  });

  async function createShareUrl() {
    try {
      // WebP is substantially smaller than the downloadable PNG and keeps the
      // self-contained link more usable when it is pasted into messaging apps.
      // The card is displayed inside a constrained stage, so a 1000px copy is
      // enough for sharing while keeping the URL from becoming enormous.
      const shareCanvas = document.createElement("canvas");
      shareCanvas.width = 1000;
      shareCanvas.height = Math.round(CANVAS_H * (shareCanvas.width / CANVAS_W));
      shareCanvas.getContext("2d").drawImage(canvas, 0, 0, shareCanvas.width, shareCanvas.height);
      const shareBlob = await new Promise((resolve) => shareCanvas.toBlob(resolve, "image/webp", 0.78));
      const image = await blobToDataUrl(shareBlob || state.lastBlob);
      const payload = encodeUtf8Base64(JSON.stringify({
        image,
        cardNumber: state.cardNumber,
        rarity: state.rarity.key,
      }));
      return `${location.href.split("#")[0]}#${SHARED_CARD_PREFIX}${payload}`;
    } catch {
      return null;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function encodeUtf8Base64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeUtf8Base64(value) {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function copyText(value) {
    try {
      if (!navigator.clipboard) return false;
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  /* Legacy image-share fallback retained for browsers without URL sharing. */
  async function shareImageFallback(caption, filename) {

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
  }

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

  // Resolve shared links after all DOM references and canvas setup exist.
  loadSharedCardFromUrl();
})();
