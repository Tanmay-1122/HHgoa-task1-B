"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import {
  CANVAS_W, CANVAS_H, PHOTO_RECT, TEXT_X0, TEXT_X1, TEXT_Y0, TEXT_Y1, QR_RECT,
  COLORS, rollClassAndRarity, computeRoleCategory, rarityFillColor, rarityTextColor,
  captionFor, type RarityKey,
} from "@/lib/cardLogic";
import { rememberCard, forgetCard } from "@/lib/myCards";

const FRAME_SRC = "/assets/hh-frame.webp";

type Stage = "input" | "result";

export default function Generator() {
  const [stage, setStage] = useState<Stage>("input");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRerolling, setIsRerolling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const [cardId, setCardId] = useState<number | null>(null);
  const [publicUrl, setPublicUrl] = useState<string>("");
  const [rarity, setRarity] = useState<{ key: RarityKey; label: string }>({ key: "common", label: "COMMON" });
  const [builderClass, setBuilderClass] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const cardStageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const frameLoadedRef = useRef(false);
  const frameReadyRef = useRef<Promise<void> | null>(null);
  const frameWarnedRef = useRef(false);

  const photoRef = useRef<ImageBitmap | HTMLCanvasElement | null>(null);
  const faceCenterRef = useRef<{ x: number; y: number } | null>(null);
  const rerollSeedRef = useRef(0);
  const deleteTokenRef = useRef<string | null>(null);
  const lastBlobRef = useRef<Blob | null>(null);
  const qrImgRef = useRef<HTMLImageElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3800);
  }, []);

  // preload frame art once
  useEffect(() => {
    frameReadyRef.current = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { frameLoadedRef.current = true; resolve(); };
      img.onerror = () => {
        frameLoadedRef.current = false;
        console.error(`Frame art failed to load from "${FRAME_SRC}".`);
        resolve();
      };
      img.src = FRAME_SRC;
      frameImgRef.current = img;
    });
  }, []);

  /* ---------------- upload handling ---------------- */

  async function handleFile(file: File) {
    setHasPhoto(false);
    setStatus("Reading photo…");
    try {
      let workingFile: File | Blob = file;
      const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
      if (isHeic) {
        setStatus("Converting HEIC…");
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        workingFile = Array.isArray(converted) ? converted[0] : converted;
      }

      setStatus("Preparing…");
      const bitmap = await loadDownscaledBitmap(workingFile, 1600);

      const prev = photoRef.current;
      if (prev && "close" in prev) (prev as ImageBitmap).close();
      photoRef.current = bitmap;
      faceCenterRef.current = await detectFaceCenter(bitmap);

      drawPreview(bitmap);
      setHasPhoto(true);
      setStatus(null);
    } catch (err: any) {
      console.error(err);
      setStatus(null);
      showToast(err?.message || "Couldn't read that photo — try another file.");
    }
  }

  async function loadDownscaledBitmap(fileOrBlob: Blob, maxDim: number): Promise<ImageBitmap | HTMLCanvasElement> {
    if (!("createImageBitmap" in window)) return legacyDownscaleViaCanvas(fileOrBlob, maxDim);
    const raw = await createImageBitmap(fileOrBlob);
    const scale = Math.min(1, maxDim / Math.max(raw.width, raw.height));
    if (scale >= 1) return raw;
    const w = Math.max(1, Math.round(raw.width * scale));
    const h = Math.max(1, Math.round(raw.height * scale));
    const resized = await createImageBitmap(raw, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    raw.close();
    return resized;
  }

  function legacyDownscaleViaCanvas(file: Blob, maxDim: number): Promise<HTMLCanvasElement> {
    return new Promise<HTMLCanvasElement>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.round(img.naturalWidth * scale);
          const h = Math.round(img.naturalHeight * scale);
          const off = document.createElement("canvas");
          off.width = w; off.height = h;
          off.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(off);
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function drawPreview(bitmap: ImageBitmap | HTMLCanvasElement) {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const pctx = canvas.getContext("2d")!;
    const cw = canvas.width, ch = canvas.height;
    const crop = coverCropRect(bitmap.width, bitmap.height, cw, ch, 0.5, 0.42);
    pctx.clearRect(0, 0, cw, ch);
    pctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cw, ch);
  }

  async function detectFaceCenter(bitmap: ImageBitmap | HTMLCanvasElement) {
    try {
      // FaceDetector isn't in the standard DOM lib types and is rarely
      // available in practice — feature-detected here, safely skipped
      // elsewhere via the try/catch and the null fallback below.
      if (!("FaceDetector" in window)) return null;
      // @ts-ignore - FaceDetector has no official TS lib typing
      const fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await fd.detect(bitmap);
      if (!faces || !faces.length) return null;
      const box = faces[0].boundingBox;
      return { x: (box.x + box.width / 2) / bitmap.width, y: (box.y + box.height / 2) / bitmap.height };
    } catch {
      return null;
    }
  }

  /* ---------------- generate / reroll ---------------- */

  async function generateQrDataUrl(id: number): Promise<string> {
    const url = `${window.location.origin}/c/${id}`;
    return QRCode.toDataURL(url, { margin: 1, width: 300, errorCorrectionLevel: "M" });
  }

  async function renderFullCard(qrDataUrl: string, nameVal: string, roleVal: string, builderClassVal: string, rarityVal: { key: RarityKey; label: string }, cardNumber: number) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    await Promise.all([frameReadyRef.current, fontsReady()]);

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const frameImg = frameImgRef.current;
    if (frameImg && frameImg.complete && frameImg.naturalWidth) {
      ctx.drawImage(frameImg, 0, 0, CANVAS_W, CANVAS_H);
    } else if (!frameLoadedRef.current && !frameWarnedRef.current) {
      frameWarnedRef.current = true;
      showToast("Frame art didn't load — check /public/assets/hh-frame.webp is present.");
    }

    // photo
    const photo = photoRef.current;
    if (photo) {
      const px0 = PHOTO_RECT.x0 * CANVAS_W, py0 = PHOTO_RECT.y0 * CANVAS_H;
      const px1 = PHOTO_RECT.x1 * CANVAS_W, py1 = PHOTO_RECT.y1 * CANVAS_H;
      const pw = px1 - px0, ph = py1 - py0;
      const bias = faceCenterRef.current || { x: 0.5, y: 0.42 };
      const crop = coverCropRect(photo.width, photo.height, pw, ph, bias.x, bias.y);

      ctx.save();
      roundRectPath(ctx, px0, py0, pw, ph, 10);
      ctx.clip();
      ctx.drawImage(photo, crop.sx, crop.sy, crop.sw, crop.sh, px0, py0, pw, ph);
      ctx.restore();

      ctx.lineWidth = 5;
      ctx.strokeStyle = "#FFFFFF";
      roundRectPath(ctx, px0, py0, pw, ph, 10);
      ctx.stroke();
    }

    // text block
    const tx0 = TEXT_X0 * CANVAS_W;
    const tx1 = TEXT_X1 * CANVAS_W;
    const maxTextWidth = tx1 - tx0;
    let cursorY = TEXT_Y0 * CANVAS_H;
    ctx.textBaseline = "top";

    ctx.font = '400 22px "Space Mono"';
    ctx.fillStyle = COLORS.greenBrand;
    ctx.fillText("HH GOA 2026 · BUILDER ID", tx0, cursorY);
    cursorY += 0.045 * CANVAS_H;

    const nameFont = fitText(ctx, nameVal, '700 70px "Fraunces"', maxTextWidth, 34);
    ctx.font = nameFont;
    ctx.fillStyle = COLORS.greenDark;
    ctx.fillText(nameVal, tx0, cursorY);
    cursorY += 0.095 * CANVAS_H;

    const classFont = fitText(ctx, builderClassVal, '700 24px "Space Mono"', maxTextWidth, 15);
    ctx.font = classFont;
    ctx.fillStyle = COLORS.pink;
    ctx.fillText(builderClassVal, tx0, cursorY);
    cursorY += 0.052 * CANVAS_H;

    ctx.font = '400 22px "Space Mono"';
    const roleText = roleVal.toUpperCase();
    const roleMetrics = ctx.measureText(roleText);
    const chipW = roleMetrics.width + 40;
    const chipH = 44;
    ctx.strokeStyle = COLORS.greenBrand;
    ctx.lineWidth = 3;
    roundRectPath(ctx, tx0, cursorY, chipW, chipH, chipH / 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.greenBrand;
    ctx.fillText(roleText, tx0 + 20, cursorY + 12);
    cursorY += chipH + 0.03 * CANVAS_H;

    // footer block: rarity pill + card number (left), QR (right)
    const footerTop = cursorY;

    ctx.font = '700 22px "Space Mono"';
    const rarityLabel = rarityVal.label;
    const rw = ctx.measureText(rarityLabel).width + 34;
    ctx.fillStyle = rarityFillColor(rarityVal.key);
    roundRectPath(ctx, tx0, footerTop, rw, 40, 20);
    ctx.fill();
    if (rarityVal.key === "common") {
      ctx.strokeStyle = COLORS.greenBrand;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.fillStyle = rarityTextColor(rarityVal.key);
    ctx.fillText(rarityLabel, tx0 + 17, footerTop + 9);

    ctx.font = '400 20px "Space Mono"';
    ctx.fillStyle = COLORS.greenBrand;
    const cardNumStr = `No. ${String(cardNumber).padStart(6, "0")}`;
    ctx.fillText(cardNumStr, tx0, footerTop + 52);

    // QR
    const qrX0 = QR_RECT.x0 * CANVAS_W, qrY0 = QR_RECT.y0 * CANVAS_H;
    const qrX1 = QR_RECT.x1 * CANVAS_W, qrY1 = QR_RECT.y1 * CANVAS_H;
    const qrSize = Math.min(qrX1 - qrX0, qrY1 - qrY0);

    ctx.font = '400 18px "Space Mono"';
    ctx.fillStyle = COLORS.greenBrand;
    ctx.fillText("SCAN TO VIEW", qrX1 - qrSize, footerTop);

    const qrImg = await loadImageEl(qrDataUrl);
    qrImgRef.current = qrImg;
    ctx.drawImage(qrImg, qrX1 - qrSize, qrY0, qrSize, qrSize);

    lastBlobRef.current = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!hasPhoto || !name.trim() || !role.trim() || isGenerating) return;
    setIsGenerating(true);
    setStatus("Reserving your card…");

    try {
      const nameVal = name.trim();
      const roleVal = role.trim();
      rerollSeedRef.current = 0;
      const { builderClass: bc, rarity: r } = rollClassAndRarity(nameVal, roleVal, 0);

      const reserveRes = await fetch("/api/cards/reserve", { method: "POST" });
      if (!reserveRes.ok) {
        const body = await reserveRes.json().catch(() => ({}));
        throw new Error(body?.error || "Couldn't reserve a card — try again.");
      }
      const { id, deleteToken } = await reserveRes.json();

      setStatus("Rendering your card…");
      const qrDataUrl = await generateQrDataUrl(id);
      await renderFullCard(qrDataUrl, nameVal, roleVal, bc, r, id);

      setStatus("Saving…");
      await finalizeUpload(id, nameVal, roleVal, bc, r);

      deleteTokenRef.current = deleteToken;
      rememberCard(id, deleteToken);

      setCardId(id);
      setPublicUrl(`${window.location.origin}/c/${id}`);
      setBuilderClass(bc);
      setRarity(r);
      setDeleted(false);
      setStatus(null);
      setStage("result");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        cardStageRef.current?.classList.add("is-visible");
      }));
    } catch (err: any) {
      console.error(err);
      setStatus(null);
      showToast(err?.message || "Something went wrong generating your card.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function finalizeUpload(id: number, nameVal: string, roleVal: string, bc: string, r: { key: RarityKey }) {
    if (!lastBlobRef.current) throw new Error("Card image wasn't ready to upload.");
    const form = new FormData();
    form.append("image", lastBlobRef.current, `card-${id}.png`);
    form.append("name", nameVal);
    form.append("role", roleVal);
    form.append("roleCategory", computeRoleCategory(roleVal));
    form.append("builderClass", bc);
    form.append("rarityKey", r.key);

    const res = await fetch(`/api/cards/${id}/finalize`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Couldn't save the card.");
    }
  }

  async function handleReroll() {
    if (!cardId || isRerolling) return;
    setIsRerolling(true);
    try {
      rerollSeedRef.current += 1;
      const nameVal = name.trim();
      const roleVal = role.trim();
      const { builderClass: bc, rarity: r } = rollClassAndRarity(nameVal, roleVal, rerollSeedRef.current);
      const qrDataUrl = qrImgRef.current?.src || (await generateQrDataUrl(cardId));
      await renderFullCard(qrDataUrl, nameVal, roleVal, bc, r, cardId);
      await finalizeUpload(cardId, nameVal, roleVal, bc, r);
      setBuilderClass(bc);
      setRarity(r);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "Couldn't reroll right now.");
    } finally {
      setIsRerolling(false);
    }
  }

  /* ---------------- download / share / delete ---------------- */

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function tryCopyImageToClipboard(blob: Blob): Promise<boolean> {
    try {
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") return false;
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return true;
    } catch {
      return false;
    }
  }

  function handleDownload() {
    if (!lastBlobRef.current || !cardId) return;
    downloadBlob(lastBlobRef.current, `hh-goa-2026-builder-id-${cardId}.png`);
  }

  async function handleShare() {
    if (!lastBlobRef.current || !cardId) return;
    const caption = captionFor(rarity.key);
    const filename = `hh-goa-2026-builder-id-${cardId}.png`;
    const file = new File([lastBlobRef.current], filename, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${caption}\n${publicUrl}` });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    downloadBlob(lastBlobRef.current, filename);
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${caption}\n${publicUrl}`)}`;
    window.open(intentUrl, "_blank", "noopener");
    const copied = await tryCopyImageToClipboard(lastBlobRef.current);
    showToast(copied
      ? "Image downloaded & copied — paste it into the tweet with Ctrl+V (Cmd+V on Mac)."
      : "Image downloaded — attach it to your tweet.");
  }

  async function handleDelete() {
    if (!cardId || !deleteTokenRef.current || isDeleting) return;
    if (!window.confirm("Delete this card permanently? This can't be undone.")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteToken: deleteTokenRef.current }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Couldn't delete the card.");
      }
      forgetCard(cardId);
      setDeleted(true);
      showToast("Card deleted.");
    } catch (err: any) {
      showToast(err?.message || "Couldn't delete the card.");
    } finally {
      setIsDeleting(false);
    }
  }

  /* ---------------- restart ---------------- */

  function handleRestart() {
    const prev = photoRef.current;
    if (prev && "close" in prev) (prev as ImageBitmap).close();
    photoRef.current = null;
    faceCenterRef.current = null;
    setHasPhoto(false);
    setName(""); setRole("");
    const pctx = previewCanvasRef.current?.getContext("2d");
    if (pctx && previewCanvasRef.current) {
      pctx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
    }
    setStage("input");
    cardStageRef.current?.classList.remove("is-visible");
    setDeleted(false);
  }

  /* ---------------- drag/drop wiring ---------------- */

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dropzoneRef.current?.classList.remove("is-dragover");
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const canGenerate = hasPhoto && name.trim().length > 0 && role.trim().length > 0 && !isGenerating;

  return (
    <>
      <section className={`panel ${stage === "input" ? "panel--active" : ""}`}>
        <div
          ref={dropzoneRef}
          className="dropzone"
          tabIndex={0}
          role="button"
          aria-label="Upload your photo"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); dropzoneRef.current?.classList.add("is-dragover"); }}
          onDragEnter={(e) => { e.preventDefault(); dropzoneRef.current?.classList.add("is-dragover"); }}
          onDragLeave={(e) => { e.preventDefault(); dropzoneRef.current?.classList.remove("is-dragover"); }}
          onDrop={onDrop}
        >
          {!hasPhoto && (
            <div className="dropzone-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 16V4M12 4L7 9M12 4L17 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p><strong>Tap to upload</strong> or drag a photo here</p>
              <p className="dropzone-hint">JPG, PNG, or HEIC from your iPhone</p>
            </div>
          )}
          <canvas
            ref={previewCanvasRef}
            className="dropzone-preview"
            width={800}
            height={440}
            hidden={!hasPhoto}
          />
          {status && <p className="dropzone-status">{status}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        <form className="details-form" onSubmit={handleGenerate}>
          <label className="field">
            <span className="field-label">Name</span>
            <input type="text" maxLength={24} placeholder="Aditi Verma" autoComplete="name"
              value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">Stack / role</span>
            <input type="text" maxLength={28} placeholder="Full-stack dev, AI, design…"
              value={role} onChange={(e) => setRole(e.target.value)} required />
          </label>
          <button type="submit" className="btn btn--primary btn--full" disabled={!canGenerate}>
            {isGenerating ? (status || "Generating…") : "Generate My Builder ID"}
          </button>
        </form>
      </section>

      <section className={`panel ${stage === "result" ? "panel--active" : ""}`}>
        <div ref={cardStageRef} className="card-stage">
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
        </div>

        <div className="result-tags">
          <span className="rarity-pill" data-rarity={rarity.key}>{rarity.label}</span>
          {cardId != null && <span className="card-number">No. {String(cardId).padStart(6, "0")}</span>}
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#F2C22E" }}>
              View public page ↗
            </a>
          )}
        </div>

        <div className="action-bar">
          <button className="btn btn--ghost" type="button" onClick={handleReroll} disabled={isRerolling}>
            {isRerolling ? "Rerolling…" : "🎲 Reroll class"}
          </button>
          <button className="btn btn--secondary" type="button" onClick={handleDownload}>Download</button>
          <button className="btn btn--primary" type="button" onClick={handleShare}>Share to X</button>
        </div>

        {!deleted ? (
          <button className="btn btn--danger" type="button" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete my card"}
          </button>
        ) : (
          <p style={{ fontSize: 13, color: "rgba(250,244,232,0.6)" }}>Card deleted.</p>
        )}

        <button className="btn btn--link" type="button" onClick={handleRestart}>
          Start over with a new photo
        </button>
      </section>

      {toast && <p className="toast">{toast}</p>}
    </>
  );
}

/* ---------------- module-level helpers ---------------- */

function coverCropRect(srcW: number, srcH: number, targetW: number, targetH: number, biasX?: number, biasY?: number) {
  const srcRatio = srcW / srcH;
  const targetRatio = targetW / targetH;
  let cw: number, ch: number;
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

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number, minSize: number): string {
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

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fontsReady(): Promise<any> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return Promise.all([
    document.fonts.load('700 64px "Fraunces"'),
    document.fonts.load('700 24px "Space Mono"'),
    document.fonts.load('400 24px "Space Mono"'),
  ]).catch(() => {}).then(() => document.fonts.ready);
}


