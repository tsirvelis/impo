importScripts("https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js");

function mmToPt(mm) {
  return (mm * 72) / 25.4;
}
function ptToMm(pt) {
  return (pt * 25.4) / 72;
}

// Converts the colour picker value to CMYK. Neutral greys/black map to pure K
// so small text prints from a single plate (no 4-colour misregistration).
function hexToCmyk(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1 || (r === g && g === b)) return PDFLib.cmyk(0, 0, 0, k);
  return PDFLib.cmyk(
    (1 - r - k) / (1 - k),
    (1 - g - k) / (1 - k),
    (1 - b - k) / (1 - k),
    k,
  );
}

// Registration colour: crop marks appear on every separation.
const REGISTRATION = PDFLib.cmyk(1, 1, 1, 1);
const PURE_K = PDFLib.cmyk(0, 0, 0, 1);

// Reads pixel density from JPEG (JFIF APP0 / EXIF) or PNG (pHYs) headers.
// Returns { x, y } in dots per inch, or null if the file doesn't say.
function readImageDpi(buffer, mime) {
  const d = new DataView(buffer);
  try {
    if (mime === "image/png") {
      let off = 8;
      while (off + 8 <= d.byteLength) {
        const len = d.getUint32(off);
        const type = String.fromCharCode(
          d.getUint8(off + 4),
          d.getUint8(off + 5),
          d.getUint8(off + 6),
          d.getUint8(off + 7),
        );
        if (type === "pHYs" && d.getUint8(off + 16) === 1) {
          return {
            x: d.getUint32(off + 8) * 0.0254,
            y: d.getUint32(off + 12) * 0.0254,
          };
        }
        if (type === "IDAT" || type === "IEND") break;
        off += 12 + len;
      }
      return null;
    }

    // JPEG: walk the markers before the image data.
    let off = 2;
    let jfif = null;
    while (off + 4 <= d.byteLength && d.getUint8(off) === 0xff) {
      const marker = d.getUint8(off + 1);
      const len = d.getUint16(off + 2);
      const seg = off + 4;
      if (marker === 0xe1 && d.getUint32(seg) === 0x45786966) {
        const exif = readExifDpi(d, seg + 6);
        if (exif) return exif;
      } else if (marker === 0xe0 && d.getUint32(seg) === 0x4a464946) {
        const units = d.getUint8(seg + 7);
        const x = d.getUint16(seg + 8);
        const y = d.getUint16(seg + 10);
        if (x > 1 && y > 1) {
          if (units === 1) jfif = { x, y };
          else if (units === 2) jfif = { x: x * 2.54, y: y * 2.54 };
        }
      }
      if (marker === 0xda) break;
      off += 2 + len;
    }
    return jfif;
  } catch (_) {
    return null;
  }
}

function readExifDpi(d, tiff) {
  const le = d.getUint16(tiff) === 0x4949;
  const u16 = (o) => d.getUint16(o, le);
  const u32 = (o) => d.getUint32(o, le);
  const ifd = tiff + u32(tiff + 4);
  const count = u16(ifd);
  let x = null,
    y = null,
    unit = 2;
  for (let i = 0; i < count; i++) {
    const ent = ifd + 2 + i * 12;
    const tag = u16(ent);
    if (tag === 0x011a || tag === 0x011b) {
      const at = tiff + u32(ent + 8);
      const den = u32(at + 4);
      const val = den ? u32(at) / den : 0;
      if (tag === 0x011a) x = val;
      else y = val;
    } else if (tag === 0x0128) {
      unit = u16(ent + 8);
    }
  }
  if (!(x > 1 && y > 1)) return null;
  if (unit === 3) return { x: x * 2.54, y: y * 2.54 };
  if (unit === 2) return { x, y };
  return null;
}

const SHEET_DIMENSIONS = {
  SRA3: { long: 450, short: 320 },
  SRA4: { long: 320, short: 225 },
  A3: { long: 420, short: 297 },
  A4: { long: 297, short: 210 },
};

const MESSAGES = {
  lt: {
    reading: "Skaitomi failai...",
    readingDetail: (n) => `Failų: ${n}`,
    extracting: "Ruošiami puslapiai...",
    extractingDetail: (n) => `Paruošta puslapių: ${n}`,
    rendering: "Kuriamas maketas...",
    sheet: (a, b) => `Lapas ${a} iš ${b}`,
    saving: "Generuojamas PDF...",
    savingDetail: "Beveik baigta",
    bcSize: (w, h, ew, eh) =>
      `Netinkamas dydis: failas ${w}×${h} mm, tikėtasi ${ew}×${eh} mm.`,
    mismatch: (name, w, h, ew, eh) =>
      `Failo „${name}“ dydis ${w}×${h} mm nesutampa su pirmuoju (${ew}×${eh} mm).`,
    bookletFit: (s) => `Atvartas netelpa į ${s} lapą.`,
    noFit: (w, h, s) => `${w}×${h} mm gaminys netelpa į ${s} lapą su nurodytomis paraštėmis.`,
    badSheet: "Neteisingas lapo dydis.",
    front: "Priekis",
    back: "Galas",
    sig: (a, b) => `Sąsiuvinis ${a}/${b}`,
  },
  en: {
    reading: "Reading files...",
    readingDetail: (n) => `Files: ${n}`,
    extracting: "Preparing pages...",
    extractingDetail: (n) => `Pages ready: ${n}`,
    rendering: "Building layout...",
    sheet: (a, b) => `Sheet ${a} of ${b}`,
    saving: "Generating PDF...",
    savingDetail: "Almost done",
    bcSize: (w, h, ew, eh) =>
      `Wrong size: file is ${w}×${h} mm, expected ${ew}×${eh} mm.`,
    mismatch: (name, w, h, ew, eh) =>
      `"${name}" is ${w}×${h} mm, which doesn't match the first file (${ew}×${eh} mm).`,
    bookletFit: (s) => `The spread doesn't fit on ${s}.`,
    noFit: (w, h, s) => `A ${w}×${h} mm item doesn't fit on ${s} with these margins.`,
    badSheet: "Invalid sheet size.",
    front: "Front",
    back: "Back",
    sig: (a, b) => `Signature ${a}/${b}`,
  },
};

const round1 = (v) => Math.round(v * 10) / 10;

// Standard PDF fonts only cover WinAnsi; strip accents (ą→a, č→c, ...) and
// replace anything else so a file name can't abort the whole render.
function winAnsiSafe(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^ -~ -ÿ]/g, "?");
}

// Maps a point (u, v) in artwork space to sheet space for a given rotation,
// where (ox, oy) is the bottom-left corner of the rotated cell.
function rotatePoint(rot, ox, oy, cellW, cellH, u, v) {
  switch (rot) {
    case 90:
      return { x: ox + cellW - v, y: oy + u };
    case 180:
      return { x: ox + cellW - u, y: oy + cellH - v };
    case 270:
      return { x: ox + v, y: oy + cellH - u };
    default:
      return { x: ox + u, y: oy + v };
  }
}

self.onmessage = async (e) => {
  const { files, params } = e.data;
  const M = MESSAGES[params.lang] || MESSAGES.lt;
  const progress = (title, detail, percent) =>
    self.postMessage({ type: "progress", title, detail, percent });

  try {
    const newPdf = await PDFLib.PDFDocument.create();

    let targetFontEnum = PDFLib.StandardFonts.HelveticaBold;
    if (params.vdpFontFamily === "Helvetica")
      targetFontEnum = PDFLib.StandardFonts.Helvetica;
    if (params.vdpFontFamily === "TimesRomanBold")
      targetFontEnum = PDFLib.StandardFonts.TimesRomanBold;
    if (params.vdpFontFamily === "CourierBold")
      targetFontEnum = PDFLib.StandardFonts.CourierBold;
    const vdpFont = await newPdf.embedFont(targetFontEnum);
    const vdpColor = hexToCmyk(params.vdpFontColor || "#000000");
    const slugFont = await newPdf.embedFont(PDFLib.StandardFonts.Helvetica);

    let allElements = [];
    let artWMm = 0,
      artHMm = 0;
    let originalWMm = 0,
      originalHMm = 0;
    let type = "auto";
    let hasBleed = true;
    // Bleed used for layout: the slider value, or the bleed found in the PDF boxes.
    let bleedMm = params.userBleed;

    if (params.profileSelection.startsWith("bc")) type = "bc";
    if (params.profileSelection.startsWith("cutstack")) type = "cutstack";
    if (params.profileSelection.startsWith("perfect")) type = "perfect";
    if (params.profileSelection === "booklet") type = "booklet";
    if (params.profileSelection === "signatures") type = "signatures";
    // Saddle-stitch booklets and sewn signatures are both built from
    // folded 4-page spreads; a perfect-bound block is always two-sided.
    const isBooklet = type === "booklet" || type === "signatures";
    const duplexMode = params.isDuplexMode || type === "perfect";
    if (params.profileSelection.endsWith("exact")) hasBleed = false;

    progress(M.reading, M.readingDetail(files.length), 5);

    // --- PHASE 1: EXTRACTION & VDP MULTIPLICATION ---
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let currentWMm, currentHMm;
      let extractedItems = [];

      if (file.type === "application/pdf") {
        const originalPdf = await PDFLib.PDFDocument.load(file.buffer);
        const srcPages = originalPdf.getPages();
        // pdf-lib falls back TrimBox/BleedBox -> CropBox -> MediaBox.
        const trimBox = srcPages[0].getTrimBox();
        const bleedBox = srcPages[0].getBleedBox();

        const trimWMm = round1(ptToMm(trimBox.width));
        const trimHMm = round1(ptToMm(trimBox.height));

        // Smallest bleed on any of the four sides, rounded DOWN to 0.5 mm so
        // the crop window never reaches past the artwork's real bleed.
        const sideBleedPt = Math.min(
          trimBox.x - bleedBox.x,
          trimBox.y - bleedBox.y,
          bleedBox.x + bleedBox.width - (trimBox.x + trimBox.width),
          bleedBox.y + bleedBox.height - (trimBox.y + trimBox.height),
        );
        const detectedBleedMargin = Math.max(
          0,
          Math.floor((ptToMm(sideBleedPt) + 0.05) * 2) / 2,
        );

        if (i === 0) {
          self.postMessage({
            type: "boxDetection",
            trimW: trimWMm,
            trimH: trimHMm,
            bleedMargin: detectedBleedMargin,
          });
          if (hasBleed && detectedBleedMargin > 0) bleedMm = detectedBleedMargin;
        }

        // "exact" profiles cut on the trim line, so drop any bleed; otherwise
        // keep exactly trim + detected bleed. Anything outside (printer marks,
        // slug, oversized MediaBox) is clipped away instead of being scaled in.
        const keepMm = hasBleed ? detectedBleedMargin : 0;
        const keepPt = mmToPt(keepMm);
        currentWMm = trimWMm + keepMm * 2;
        currentHMm = trimHMm + keepMm * 2;
        const boxes = srcPages.map((p) => {
          const t = p.getTrimBox();
          return {
            left: t.x - keepPt,
            bottom: t.y - keepPt,
            right: t.x + t.width + keepPt,
            top: t.y + t.height + keepPt,
          };
        });
        const embeddedPages = await newPdf.embedPages(srcPages, boxes);
        extractedItems = embeddedPages.map((p) => ({ type: "page", obj: p }));
      } else {
        const dpi = readImageDpi(file.buffer, file.type) || { x: 300, y: 300 };
        let img;
        if (file.type === "image/jpeg")
          img = await newPdf.embedJpg(file.buffer);
        else img = await newPdf.embedPng(file.buffer);
        currentWMm = round1((img.width / dpi.x) * 25.4);
        currentHMm = round1((img.height / dpi.y) * 25.4);
        extractedItems = [{ type: "image", obj: img }];
      }

      if (i === 0) {
        originalWMm = currentWMm;
        originalHMm = currentHMm;
        if (params.forceScale) {
          if (type === "bc") {
            artWMm = hasBleed ? 90 + bleedMm * 2 : 90;
            artHMm = hasBleed ? 50 + bleedMm * 2 : 50;
          } else {
            const addedBleed =
              !params.scaleIncludesBleed && hasBleed ? bleedMm * 2 : 0;
            artWMm = params.targetW + addedBleed;
            artHMm = params.targetH + addedBleed;
          }
        } else {
          artWMm = currentWMm;
          artHMm = currentHMm;
          if (type === "bc") {
            const expectedW = hasBleed ? 90 + bleedMm * 2 : 90;
            const expectedH = hasBleed ? 50 + bleedMm * 2 : 50;
            if (
              Math.abs(artWMm - expectedW) > 1.5 ||
              Math.abs(artHMm - expectedH) > 1.5
            ) {
              throw new Error(
                M.bcSize(round1(artWMm), round1(artHMm), expectedW, expectedH),
              );
            }
          }
        }
      } else if (
        !params.forceScale &&
        !params.vdpActive &&
        (Math.abs(currentWMm - artWMm) > 1.5 ||
          Math.abs(currentHMm - artHMm) > 1.5)
      ) {
        throw new Error(
          M.mismatch(file.name, currentWMm, currentHMm, artWMm, artHMm),
        );
      }

      if (params.vdpActive && type === "cutstack" && i === 0) {
        const frontItem = extractedItems[0];
        const backItem = extractedItems.length > 1 ? extractedItems[1] : null;
        for (let n = params.vdpStart; n <= params.vdpEnd; n++) {
          const numStr = String(n).padStart(params.vdpPad, "0");
          allElements.push({
            type: frontItem.type,
            obj: frontItem.obj,
            vdpText: winAnsiSafe(params.vdpPrefix + numStr),
          });
          if (duplexMode) {
            if (backItem)
              allElements.push({ type: backItem.type, obj: backItem.obj });
            else allElements.push(null);
          }
        }
        break;
      } else {
        allElements.push(...extractedItems);
      }
      progress(
        M.extracting,
        M.extractingDetail(allElements.length),
        5 + Math.round((i / files.length) * 15),
      );
    }

    self.postMessage({
      type: "fileInfo",
      w: originalWMm,
      h: originalHMm,
      pages: allElements.length,
    });

    // --- PHASE 2: CALCULATE TARGET GEOMETRY ---
    let sheetLongMm, sheetShortMm, sheetLabel;
    if (params.sheetSelection === "custom") {
      const a = params.customSheetW,
        b = params.customSheetH;
      if (!(a > 0 && b > 0)) throw new Error(M.badSheet);
      sheetLongMm = Math.max(a, b);
      sheetShortMm = Math.min(a, b);
      sheetLabel = `${a}x${b}`;
    } else {
      sheetLongMm = SHEET_DIMENSIONS[params.sheetSelection].long;
      sheetShortMm = SHEET_DIMENSIONS[params.sheetSelection].short;
      sheetLabel = params.sheetSelection;
    }

    let gutterMm = hasBleed ? params.userGutter : 0;
    const cutWMm = hasBleed ? artWMm - bleedMm * 2 : artWMm;
    const cutHMm = hasBleed ? artHMm - bleedMm * 2 : artHMm;
    const outerBleed = hasBleed ? bleedMm : 0;

    // Space kept free around the grid: the press's unprintable margin plus
    // room for crop marks / slug (or at least the bleed).
    let markReserve = outerBleed;
    if (params.addCropMarks)
      markReserve = Math.max(params.userCropLen + params.userCropGap + 2, outerBleed);
    else if (params.addSlug) markReserve = Math.max(4, outerBleed);
    const edgeMm = (params.sheetMargin || 0) + markReserve;
    const maxUsableLong = sheetLongMm - edgeMm * 2;
    const maxUsableShort = sheetShortMm - edgeMm * 2;

    let cols, rows, useLandscape;
    let rotated = false;

    if (isBooklet) {
      // Grid of open spreads (two pages side by side, folded at the spine).
      const spreadW = cutWMm * 2;
      const fitSpread = (land) => {
        const W = land ? maxUsableLong : maxUsableShort;
        const H = land ? maxUsableShort : maxUsableLong;
        const c = Math.max(0, Math.floor((W + gutterMm) / (spreadW + gutterMm)));
        const r = Math.max(0, Math.floor((H + gutterMm) / (cutHMm + gutterMm)));
        return { land, cols: c, rows: r, n: c * r };
      };
      let lands = [true, false];
      if (params.orientSelection === "landscape") lands = [true];
      else if (params.orientSelection === "portrait") lands = [false];
      let best = null;
      for (const land of lands) {
        const f = fitSpread(land);
        if (f.n === 0) continue;
        if (params.bookletUp !== "max") {
          best = { land, cols: 1, rows: 1, n: 1 };
          break;
        }
        if (!best || f.n > best.n) best = f;
      }
      if (!best) throw new Error(M.bookletFit(sheetLabel));
      useLandscape = best.land;
      cols = best.cols;
      rows = best.rows;
    } else {
      const fit = (land, rot) => {
        const W = land ? maxUsableLong : maxUsableShort;
        const H = land ? maxUsableShort : maxUsableLong;
        const cw = rot ? cutHMm : cutWMm;
        const ch = rot ? cutWMm : cutHMm;
        const c = Math.max(0, Math.floor((W + gutterMm) / (cw + gutterMm)));
        const r = Math.max(0, Math.floor((H + gutterMm) / (ch + gutterMm)));
        return { land, rot, cols: c, rows: r, n: c * r };
      };

      let lands;
      if (params.orientSelection === "landscape") lands = [true];
      else if (params.orientSelection === "portrait") lands = [false];
      else if (type === "bc") lands = [params.sheetSelection === "SRA4"];
      else lands = [true, false];

      let rots = [false];
      if (params.rotateMode === "on") rots = [true];
      else if (params.rotateMode === "auto") rots = [false, true];

      let best = null;
      for (const rot of rots)
        for (const land of lands) {
          const f = fit(land, rot);
          if (!best || f.n > best.n) best = f;
        }
      if (!best || best.n === 0)
        throw new Error(M.noFit(round1(cutWMm), round1(cutHMm), sheetLabel));
      useLandscape = best.land;
      rotated = best.rot;
      cols = best.cols;
      rows = best.rows;
    }

    const pageW = useLandscape ? mmToPt(sheetLongMm) : mmToPt(sheetShortMm);
    const pageH = useLandscape ? mmToPt(sheetShortMm) : mmToPt(sheetLongMm);
    // Cell sizes as laid out on the sheet (swapped when rotated).
    // Width of one page of a booklet spread.
    const pageCutW = mmToPt(cutWMm);
    const cutW = isBooklet ? pageCutW * 2 : mmToPt(rotated ? cutHMm : cutWMm);
    const cutH = mmToPt(rotated ? cutWMm : cutHMm);
    const gutter = mmToPt(gutterMm);
    const drawW = mmToPt(artWMm);
    const drawH = mmToPt(artHMm);
    const offset = mmToPt(outerBleed);

    const gridTotalW = cols * cutW + (cols - 1) * gutter;
    const gridTotalH = rows * cutH + (rows - 1) * gutter;
    const baseX = (pageW - gridTotalW) / 2;
    const baseY = (pageH - gridTotalH) / 2;
    const backDX = mmToPt(params.backOffsetX || 0);
    const backDY = mmToPt(params.backOffsetY || 0);
    const tumble = params.flipEdge === "tumble";

    const cropGap = mmToPt(params.userCropGap);
    const cropLen = mmToPt(params.userCropLen);
    const markThickness = 0.5;

    // Draws one item with its bottom-left cell corner (incl. bleed) at (x, y).
    const stampElement = (page, element, x, y, rot) => {
      if (!element) return;
      const cellW = rot % 180 ? drawH : drawW;
      const cellH = rot % 180 ? drawW : drawH;
      const o = rotatePoint(rot, x, y, cellW, cellH, 0, 0);
      const opts = {
        x: o.x,
        y: o.y,
        width: drawW,
        height: drawH,
        rotate: PDFLib.degrees(rot),
      };
      if (element.type === "page") page.drawPage(element.obj, opts);
      else if (element.type === "image") page.drawImage(element.obj, opts);

      if (element.vdpText) {
        const spots = [[params.vdpX, params.vdpY]];
        if (params.vdpActive2) spots.push([params.vdpX2, params.vdpY2]);
        for (const [vx, vy] of spots) {
          const p = rotatePoint(rot, x, y, cellW, cellH, mmToPt(vx), mmToPt(vy));
          page.drawText(element.vdpText, {
            x: p.x,
            y: p.y,
            size: params.vdpFontSize,
            font: vdpFont,
            color: vdpColor,
            rotate: PDFLib.degrees(rot),
          });
        }
      }
    };

    const line = (page, x1, y1, x2, y2) =>
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: markThickness,
        color: REGISTRATION,
      });

    const drawCropMarksAndSlug = (page, isBack, sheetNo, sheetTotal, extra = "") => {
      const startX = baseX + (isBack ? backDX : 0);
      const startY = baseY + (isBack ? backDY : 0);
      const xs = [],
        ys = [];
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (cutW + gutter);
        xs.push(x, x + cutW);
      }
      for (let r = 0; r < rows; r++) {
        const y = startY + r * (cutH + gutter);
        ys.push(y, y + cutH);
      }
      const uniq = (a) =>
        a.filter((v, i) => a.findIndex((w) => Math.abs(w - v) < 0.01) === i);

      if (params.addCropMarks) {
        const top = startY + gridTotalH;
        const right = startX + gridTotalW;
        for (const x of uniq(xs)) {
          line(page, x, startY - cropGap, x, startY - cropGap - cropLen);
          line(page, x, top + cropGap, x, top + cropGap + cropLen);
        }
        for (const y of uniq(ys)) {
          line(page, startX - cropGap, y, startX - cropGap - cropLen, y);
          line(page, right + cropGap, y, right + cropGap + cropLen, y);
        }
        if (isBooklet) {
          // Dashed fold marks on each spine.
          for (let c = 0; c < cols; c++) {
            const x = startX + c * (cutW + gutter) + pageCutW;
            for (const [y1, y2] of [
              [startY - cropGap, startY - cropGap - cropLen],
              [top + cropGap, top + cropGap + cropLen],
            ])
              page.drawLine({
                start: { x, y: y1 },
                end: { x, y: y2 },
                thickness: markThickness,
                color: REGISTRATION,
                dashArray: [2, 2],
              });
          }
        }
      }
      if (params.addSlug) {
        const side = duplexMode || isBooklet ? ` · ${isBack ? M.back : M.front}` : "";
        const text =
          `${baseName} · ${round1(cutWMm)}×${round1(cutHMm)} mm · ${cols}×${rows}` +
          ` · ${sheetNo}/${sheetTotal}${extra ? " · " + extra : ""}${side}`;
        page.drawText(winAnsiSafe(text), {
          x: startX,
          // Above the crop marks so the text never runs through them.
          y:
            startY +
            gridTotalH +
            (params.addCropMarks ? cropGap + cropLen : mmToPt(1)) +
            1,
          size: 4,
          font: slugFont,
          color: PURE_K,
        });
      }
    };

    const baseName =
      files.length > 1 ? "GangRun_Batch" : files[0].name.replace(/\.[^/.]+$/, "");

    // --- PHASE 3: PLACE ITEMS ON SHEETS ---
    const reportProgress = (current, total) =>
      progress(
        M.rendering,
        M.sheet(current, total),
        20 + Math.round((current / total) * 70),
      );

    let physicalSheets = 0;

    if (isBooklet) {
      while (allElements.length % 4 !== 0) allElements.push(null);
      // Saddle stitch = one signature holding every page; sewn books are
      // split into signatures of N folded sheets (4 pages per sheet).
      const sigPages =
        type === "signatures"
          ? Math.max(1, Math.floor(params.sigSheets) || 1) * 4
          : allElements.length;
      const signatures = [];
      for (let i = 0; i < allElements.length; i += sigPages)
        signatures.push(allElements.slice(i, i + sigPages));
      const totalSheets = allElements.length / 4;
      physicalSheets = totalSheets;

      // Clip so a page's bleed never spills over its neighbour at the spine.
      const clipped = (page, x, y, w, h, draw) => {
        page.pushOperators(
          PDFLib.pushGraphicsState(),
          PDFLib.rectangle(x, y, w, h),
          PDFLib.clip(),
          PDFLib.endPath(),
        );
        draw();
        page.pushOperators(PDFLib.popGraphicsState());
      };
      // (cx, cy) = bottom-left trim corner of the spread; `shift` moves both
      // pages toward the spine to compensate creep of inner sheets.
      const placeSpread = (page, left, right, cx, cy, shift) => {
        const h = cutH + offset * 2;
        clipped(page, cx - offset, cy - offset, pageCutW + offset, h, () =>
          stampElement(page, left, cx - offset + shift, cy - offset, 0),
        );
        clipped(page, cx + pageCutW, cy - offset, pageCutW + offset, h, () =>
          stampElement(page, right, cx + pageCutW - offset - shift, cy - offset, 0),
        );
      };

      let sheetNo = 0;
      signatures.forEach((sig, g) => {
        const n = sig.length;
        for (let s = 0; s < n / 4; s++) {
          sheetNo++;
          reportProgress(sheetNo, totalSheets);
          const shift = mmToPt((params.creep || 0) * s);
          const frontSheet = newPdf.addPage([pageW, pageH]);
          const backSheet = newPdf.addPage([pageW, pageH]);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const cx = baseX + c * (cutW + gutter);
              const cy = baseY + r * (cutH + gutter);
              placeSpread(frontSheet, sig[n - 1 - s * 2], sig[s * 2], cx, cy, shift);
              placeSpread(
                backSheet,
                sig[s * 2 + 1],
                sig[n - 2 - s * 2],
                cx + backDX,
                cy + backDY,
                shift,
              );
            }
          }
          const label = signatures.length > 1 ? M.sig(g + 1, signatures.length) : "";
          drawCropMarksAndSlug(frontSheet, false, sheetNo, totalSheets, label);
          drawCropMarksAndSlug(backSheet, true, sheetNo, totalSheets, label);
        }
      });
    } else {
      const duplex = duplexMode;
      const units = [];
      if (duplex) {
        for (let i = 0; i < allElements.length; i += 2)
          units.push({ front: allElements[i], back: allElements[i + 1] || null });
      } else {
        for (const el of allElements) units.push({ front: el, back: null });
      }

      const slots = cols * rows;
      let sheets, pick;
      if (type === "cutstack" || type === "perfect") {
        // Column-major through the stack: each slot position holds a
        // consecutive run so the cut stacks come out in order.
        sheets = Math.ceil(units.length / slots);
        pick = (s, slot) => slot * sheets + s;
      } else if (params.isNestingMode) {
        sheets = Math.ceil(units.length / slots);
        pick = (s, slot) => s * slots + slot;
      } else {
        sheets = units.length;
        pick = (s) => s;
      }
      physicalSheets = sheets;

      const frontRot = rotated ? 90 : 0;
      // Turning the sheet over left↔right mirrors the rotation; tumbling
      // (top↔bottom) adds a half turn on top of that.
      const backRot = ((tumble ? 540 : 360) - frontRot) % 360;

      for (let s = 0; s < sheets; s++) {
        reportProgress(s + 1, sheets);
        const front = newPdf.addPage([pageW, pageH]);
        const back = duplex ? newPdf.addPage([pageW, pageH]) : null;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = pick(s, r * cols + c);
            if (idx >= units.length) continue;
            const u = units[idx];
            stampElement(
              front,
              u.front,
              baseX + c * (cutW + gutter) - offset,
              baseY + r * (cutH + gutter) - offset,
              frontRot,
            );
            if (back && u.back) {
              const bc = tumble ? c : cols - 1 - c;
              const br = tumble ? rows - 1 - r : r;
              stampElement(
                back,
                u.back,
                baseX + backDX + bc * (cutW + gutter) - offset,
                baseY + backDY + br * (cutH + gutter) - offset,
                backRot,
              );
            }
          }
        }
        drawCropMarksAndSlug(front, false, s + 1, sheets);
        if (back) drawCropMarksAndSlug(back, true, s + 1, sheets);
      }
    }

    // Area of the finished items vs. the whole sheet.
    const perSheet = cols * rows;
    const usedArea = perSheet * (isBooklet ? 2 : 1) * cutWMm * cutHMm;
    self.postMessage({
      type: "layout",
      cols,
      rows,
      perSheet,
      sheets: physicalSheets,
      sheetW: useLandscape ? sheetLongMm : sheetShortMm,
      sheetH: useLandscape ? sheetShortMm : sheetLongMm,
      rotated,
      usage: Math.round((usedArea / (sheetLongMm * sheetShortMm)) * 100),
      bleed: outerBleed,
    });

    // --- PHASE 4: ENCODE EXPORT STREAM ---
    progress(M.saving, M.savingDetail, 95);
    const pdfBytes = await newPdf.save();

    const suffixLabel = hasBleed ? "bleed" : "exact";
    const modeLabel = params.isNestingMode ? "Nested" : "Cloned";
    const plexLabel = duplexMode ? "Duplex" : "Simplex";
    const rotLabel = rotated ? "_Rot90" : "";

    let newFileName = `${baseName}_${sheetLabel}_${type.toUpperCase()}_${cols}x${rows}${rotLabel}_${modeLabel}_${plexLabel}_${suffixLabel}.pdf`;
    if (type === "booklet")
      newFileName = `${baseName}_${sheetLabel}_Booklet_${perSheet}up_${suffixLabel}.pdf`;
    if (type === "signatures")
      newFileName = `${baseName}_${sheetLabel}_Signatures_${params.sigSheets}sh_${perSheet}up_${suffixLabel}.pdf`;
    if (type === "perfect")
      newFileName = `${baseName}_${sheetLabel}_PerfectBound_${cols}x${rows}${rotLabel}_CutStack_${suffixLabel}.pdf`;

    self.postMessage({ type: "success", pdfBytes, fileName: newFileName }, [
      pdfBytes.buffer,
    ]);
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
