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

self.onmessage = async (e) => {
  const { files, params } = e.data;

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

    const stampElement = (targetPage, element, xPos, yPos, w, h) => {
      if (!element) return;
      if (element.type === "page")
        targetPage.drawPage(element.obj, {
          x: xPos,
          y: yPos,
          width: w,
          height: h,
        });
      else if (element.type === "image")
        targetPage.drawImage(element.obj, {
          x: xPos,
          y: yPos,
          width: w,
          height: h,
        });

      // if (element.vdpText) {
      //   const textX = xPos + mmToPt(params.vdpX);
      //   const textY = yPos + mmToPt(params.vdpY);
      //   targetPage.drawText(element.vdpText, {
      //     x: textX,
      //     y: textY,
      //     size: params.vdpFontSize,
      //     font: vdpFont,
      //     color: vdpColor,
      //   });
      // }
      if (element.vdpText) {
        // Draw the first ticket number
        const textX = xPos + mmToPt(params.vdpX);
        const textY = yPos + mmToPt(params.vdpY);
        targetPage.drawText(element.vdpText, {
          x: textX,
          y: textY,
          size: params.vdpFontSize,
          font: vdpFont,
          color: vdpColor,
        });

        // Draw the second ticket number if enabled
        if (params.vdpActive2) {
          const textX2 = xPos + mmToPt(params.vdpX2);
          const textY2 = yPos + mmToPt(params.vdpY2);
          targetPage.drawText(element.vdpText, {
            x: textX2,
            y: textY2,
            size: params.vdpFontSize,
            font: vdpFont,
            color: vdpColor,
          });
        }
      }
    };

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
    if (params.profileSelection === "booklet") type = "booklet";
    if (params.profileSelection.endsWith("exact")) hasBleed = false;

    self.postMessage({
      type: "progress",
      title: "Extracting Data...",
      detail: `Reading ${files.length} payloads`,
      percent: 5,
    });

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

        const trimWMm = Math.round(ptToMm(trimBox.width) * 10) / 10;
        const trimHMm = Math.round(ptToMm(trimBox.height) * 10) / 10;

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
        currentWMm = Math.round((img.width / dpi.x) * 25.4 * 10) / 10;
        currentHMm = Math.round((img.height / dpi.y) * 25.4 * 10) / 10;
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
                `Size Error: Got ${Math.round(artWMm)}x${Math.round(artHMm)}mm instead of ${expectedW}x${expectedH}mm.`,
              );
            }
          }
        }
      } else {
        if (
          !params.forceScale &&
          !params.vdpActive &&
          (Math.abs(currentWMm - artWMm) > 1.5 ||
            Math.abs(currentHMm - artHMm) > 1.5)
        ) {
          throw new Error(
            `Batch Error! Multi-file sequence dimension mismatch.`,
          );
        }
      }

      if (params.vdpActive && type === "cutstack" && i === 0) {
        const frontItem = extractedItems[0];
        const backItem = extractedItems.length > 1 ? extractedItems[1] : null;
        for (let n = params.vdpStart; n <= params.vdpEnd; n++) {
          let numStr = String(n).padStart(params.vdpPad, "0");
          let injectedText = params.vdpPrefix + numStr;
          allElements.push({
            type: frontItem.type,
            obj: frontItem.obj,
            vdpText: injectedText,
          });
          if (params.isDuplexMode) {
            if (backItem)
              allElements.push({ type: backItem.type, obj: backItem.obj });
            else allElements.push(null);
          }
        }
        break;
      } else {
        allElements.push(...extractedItems);
      }
      self.postMessage({
        type: "progress",
        title: "Extracting Pages...",
        detail: `Processed ${allElements.length} pages`,
        percent: 5 + Math.round((i / files.length) * 15),
      });
    }

    self.postMessage({
      type: "fileInfo",
      w: originalWMm,
      h: originalHMm,
      pages: allElements.length,
    });

    // --- PHASE 2: CALCULATE TARGET GEOMETRY ---
    const sheetLongMm = SHEET_DIMENSIONS[params.sheetSelection].long;
    const sheetShortMm = SHEET_DIMENSIONS[params.sheetSelection].short;
    let gutterMm = hasBleed ? params.userGutter : 0;
    const cutWMm = hasBleed ? artWMm - bleedMm * 2 : artWMm;
    const cutHMm = hasBleed ? artHMm - bleedMm * 2 : artHMm;

    const reserveMargin = (params.userCropLen + params.userCropGap + 2) * 2;
    const maxUsableLong = sheetLongMm - reserveMargin;
    const maxUsableShort = sheetShortMm - reserveMargin;
    let cols, rows, useLandscape;

    if (type === "booklet") {
      useLandscape = true;
      cols = 2;
      rows = 1;
      gutterMm = 0;
      if (cutWMm * 2 > maxUsableLong || cutHMm > maxUsableShort)
        throw new Error(
          `Spread boundary fits outside ${params.sheetSelection}`,
        );
    } else {
      const colsL = Math.floor(
        (maxUsableLong + gutterMm) / (cutWMm + gutterMm),
      );
      const rowsL = Math.floor(
        (maxUsableShort + gutterMm) / (cutHMm + gutterMm),
      );
      const colsP = Math.floor(
        (maxUsableShort + gutterMm) / (cutWMm + gutterMm),
      );
      const rowsP = Math.floor(
        (maxUsableLong + gutterMm) / (cutHMm + gutterMm),
      );
      if (params.orientSelection === "landscape") {
        useLandscape = true;
        cols = colsL;
        rows = rowsL;
      } else if (params.orientSelection === "portrait") {
        useLandscape = false;
        cols = colsP;
        rows = rowsP;
      } else {
        if (type === "bc" && params.sheetSelection === "SRA4")
          useLandscape = true;
        else if (type === "bc") useLandscape = false;
        else useLandscape = colsL * rowsL >= colsP * rowsP;
        cols = useLandscape ? colsL : colsP;
        rows = useLandscape ? rowsL : rowsP;
      }
      if (cols === 0 || rows === 0)
        throw new Error(
          `Imposition Matrix calculations fall outside sheet dimensions.`,
        );
    }

    const pageW = useLandscape ? mmToPt(sheetLongMm) : mmToPt(sheetShortMm);
    const pageH = useLandscape ? mmToPt(sheetShortMm) : mmToPt(sheetLongMm);
    const cutW = mmToPt(cutWMm);
    const cutH = mmToPt(cutHMm);
    const gutter = mmToPt(gutterMm);
    const drawW = mmToPt(artWMm);
    const drawH = mmToPt(artHMm);
    const offset = hasBleed ? mmToPt(bleedMm) : 0;

    const gridTotalW = cols * cutW + (cols - 1) * gutter;
    const gridTotalH = rows * cutH + (rows - 1) * gutter;
    const startX = (pageW - gridTotalW) / 2;
    const startY = (pageH - gridTotalH) / 2;

    const cropGap = mmToPt(params.userCropGap);
    const cropLen = mmToPt(params.userCropLen);
    const markColor = REGISTRATION;
    const markThickness = 0.5;

    // UPGRADED STAMP LAYOUT HANDLER
    const drawCropMarksAndSlug = (page) => {
      if (params.addCropMarks) {
        // <-- CONTEXT RE-CHECK INJECTED HERE
        if (hasBleed) {
          for (let c = 0; c < cols; c++) {
            const xLeft = startX + c * (cutW + gutter);
            const xRight = xLeft + cutW;
            page.drawLine({
              start: { x: xLeft, y: startY - cropGap },
              end: { x: xLeft, y: startY - cropGap - cropLen },
              thickness: markThickness,
              color: markColor,
            });
            page.drawLine({
              start: { x: xRight, y: startY - cropGap },
              end: { x: xRight, y: startY - cropGap - cropLen },
              thickness: markThickness,
              color: markColor,
            });
            page.drawLine({
              start: { x: xLeft, y: startY + gridTotalH + cropGap },
              end: { x: xLeft, y: startY + gridTotalH + cropGap + cropLen },
              thickness: markThickness,
              color: markColor,
            });
            page.drawLine({
              start: { x: xRight, y: startY + gridTotalH + cropGap },
              end: { x: xRight, y: startY + gridTotalH + cropGap + cropLen },
              thickness: markThickness,
              color: markColor,
            });
          }
          for (let r = 0; r < rows; r++) {
            const yBottom = startY + r * (cutH + gutter);
            const yTop = yBottom + cutH;
            page.drawLine({
              start: { x: startX - cropGap, y: yBottom },
              end: { x: startX - cropGap - cropLen, y: yBottom },
              thickness: markThickness,
              color: markColor,
            });
            page.drawLine({
              start: { x: startX - cropGap, y: yTop },
              end: { x: startX - cropGap - cropLen, y: yTop },
              thickness: markThickness,
              color: markColor,
            });
            page.drawLine({
              start: { x: startX + gridTotalW + cropGap, y: yBottom },
              end: { x: startX + gridTotalW + cropGap + cropLen, y: yBottom },
              thickness: markThickness,
              color: markColor,
            });
            page.drawLine({
              start: { x: startX + gridTotalW + cropGap, y: yTop },
              end: { x: startX + gridTotalW + cropGap + cropLen, y: yTop },
              thickness: markThickness,
              color: markColor,
            });
          }
        } else {
          for (let c = 0; c <= cols; c++) {
            const x = startX + c * cutW;
            page.drawLine({
              start: { x: x, y: startY - cropGap },
              end: { x: x, y: startY - cropGap - cropLen },
              thickness: markThickness,
              color: markColor,
            });
            page.drawLine({
              start: { x: x, y: startY + gridTotalH + cropGap },
              end: { x: x, y: startY + gridTotalH + cropGap + cropLen },
              thickness: markThickness,
              color: markColor,
            });
          }
          for (let r = 0; r <= rows; r++) {
            const y = startY + r * cutH;
            page.drawLine({
              start: { x: startX - cropGap, y: y },
              end: { x: startX - cropGap - cropLen, y: y },
              thickness: markThickness,
              color: markColor,
            });
            page.drawLine({
              start: { x: startX + gridTotalW + cropGap, y: y },
              end: { x: startX + gridTotalW + cropGap + cropLen, y: y },
              thickness: markThickness,
              color: markColor,
            });
          }
        }
      }
      if (params.addSlug) {
        page.drawText(`${artWMm} x ${artHMm} mm`, {
          x: startX + 3,
          y: startY + gridTotalH + cropGap + 1,
          size: 4,
          font: slugFont,
          color: PURE_K,
        });
      }
    };

    // --- PHASE 3: GRID IMPOSITION MATRICES ---
    const totalSlots = cols * rows;
    const reportProgress = (current, total, prefix) => {
      self.postMessage({
        type: "progress",
        title: "Rendering Grid Matrix...",
        detail: `${prefix} ${current} of ${total}`,
        percent: 20 + Math.round((current / total) * 70),
      });
    };

    if (type === "booklet") {
      while (allElements.length % 4 !== 0) allElements.push(null);
      const totalPages = allElements.length;
      const sheets = totalPages / 4;
      for (let s = 0; s < sheets; s++) {
        reportProgress(s + 1, sheets, "Spreads");
        const frontSheet = newPdf.addPage([pageW, pageH]);
        const backSheet = newPdf.addPage([pageW, pageH]);
        const fLeft = allElements[totalPages - 1 - s * 2];
        const fRight = allElements[s * 2];
        const bLeft = allElements[s * 2 + 1];
        const bRight = allElements[totalPages - 2 - s * 2];
        if (fLeft)
          stampElement(
            frontSheet,
            fLeft,
            startX - offset,
            startY - offset,
            drawW,
            drawH,
          );
        if (fRight)
          stampElement(
            frontSheet,
            fRight,
            startX + cutW - offset,
            startY - offset,
            drawW,
            drawH,
          );
        if (bLeft)
          stampElement(
            backSheet,
            bLeft,
            startX - offset,
            startY - offset,
            drawW,
            drawH,
          );
        if (bRight)
          stampElement(
            backSheet,
            bRight,
            startX + cutW - offset,
            startY - offset,
            drawW,
            drawH,
          );
        drawCropMarksAndSlug(frontSheet);
        drawCropMarksAndSlug(backSheet);
      }
    } else if (type === "cutstack") {
      if (params.isDuplexMode) {
        let pairs = [];
        for (let i = 0; i < allElements.length; i += 2)
          pairs.push({
            front: allElements[i],
            back: allElements[i + 1] || null,
          });
        const sheetsNeeded = Math.ceil(pairs.length / totalSlots);
        for (let s = 0; s < sheetsNeeded; s++) {
          reportProgress(s + 1, sheetsNeeded, "Sheets");
          const frontSheet = newPdf.addPage([pageW, pageH]);
          const backSheet = newPdf.addPage([pageW, pageH]);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              let slotIdx = r * cols + c;
              let pairIdx = slotIdx * sheetsNeeded + s;
              if (pairIdx < pairs.length) {
                const pair = pairs[pairIdx];
                stampElement(
                  frontSheet,
                  pair.front,
                  startX + c * (cutW + gutter) - offset,
                  startY + r * (cutH + gutter) - offset,
                  drawW,
                  drawH,
                );
                if (pair.back) {
                  const mirroredC = cols - 1 - c;
                  stampElement(
                    backSheet,
                    pair.back,
                    startX + mirroredC * (cutW + gutter) - offset,
                    startY + r * (cutH + gutter) - offset,
                    drawW,
                    drawH,
                  );
                }
              }
            }
          }
          drawCropMarksAndSlug(frontSheet);
          drawCropMarksAndSlug(backSheet);
        }
      } else {
        const sheetsNeeded = Math.ceil(allElements.length / totalSlots);
        for (let s = 0; s < sheetsNeeded; s++) {
          reportProgress(s + 1, sheetsNeeded, "Sheets");
          const page = newPdf.addPage([pageW, pageH]);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              let slotIdx = r * cols + c;
              let elementIdx = slotIdx * sheetsNeeded + s;
              if (elementIdx < allElements.length) {
                stampElement(
                  page,
                  allElements[elementIdx],
                  startX + c * (cutW + gutter) - offset,
                  startY + r * (cutH + gutter) - offset,
                  drawW,
                  drawH,
                );
              }
            }
          }
          drawCropMarksAndSlug(page);
        }
      }
    } else if (params.isNestingMode) {
      if (params.isDuplexMode) {
        let pairs = [];
        for (let i = 0; i < allElements.length; i += 2)
          pairs.push({
            front: allElements[i],
            back: allElements[i + 1] || null,
          });
        let currentPairIdx = 0;
        let sheetCount = 0;
        const totalEstimatedSheets = Math.ceil(pairs.length / totalSlots);
        while (currentPairIdx < pairs.length) {
          sheetCount++;
          reportProgress(sheetCount, totalEstimatedSheets, "Sheets");
          const frontSheet = newPdf.addPage([pageW, pageH]);
          const backSheet = newPdf.addPage([pageW, pageH]);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (currentPairIdx < pairs.length) {
                const pair = pairs[currentPairIdx];
                stampElement(
                  frontSheet,
                  pair.front,
                  startX + c * (cutW + gutter) - offset,
                  startY + r * (cutH + gutter) - offset,
                  drawW,
                  drawH,
                );
                if (pair.back) {
                  const mirroredC = cols - 1 - c;
                  stampElement(
                    backSheet,
                    pair.back,
                    startX + mirroredC * (cutW + gutter) - offset,
                    startY + r * (cutH + gutter) - offset,
                    drawW,
                    drawH,
                  );
                }
                currentPairIdx++;
              }
            }
          }
          drawCropMarksAndSlug(frontSheet);
          drawCropMarksAndSlug(backSheet);
        }
      } else {
        let currentPageIdx = 0;
        let sheetCount = 0;
        const totalEstimatedSheets = Math.ceil(allElements.length / totalSlots);
        while (currentPageIdx < allElements.length) {
          sheetCount++;
          reportProgress(sheetCount, totalEstimatedSheets, "Sheets");
          const page = newPdf.addPage([pageW, pageH]);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (currentPageIdx < allElements.length) {
                stampElement(
                  page,
                  allElements[currentPageIdx],
                  startX + c * (cutW + gutter) - offset,
                  startY + r * (cutH + gutter) - offset,
                  drawW,
                  drawH,
                );
                currentPageIdx++;
              }
            }
          }
          drawCropMarksAndSlug(page);
        }
      }
    } else {
      let sheetCount = 0;
      for (const element of allElements) {
        sheetCount++;
        reportProgress(sheetCount, allElements.length, "Cloned Sheets");
        const page = newPdf.addPage([pageW, pageH]);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            stampElement(
              page,
              element,
              startX + c * (cutW + gutter) - offset,
              startY + r * (cutH + gutter) - offset,
              drawW,
              drawH,
            );
          }
        }
        drawCropMarksAndSlug(page);
      }
    }

    // --- PHASE 4: ENCODE EXPORT STREAM ---
    self.postMessage({
      type: "progress",
      title: "Compiling Byte Stream...",
      detail: "Optimizing object coordinate tables",
      percent: 95,
    });
    const pdfBytes = await newPdf.save();

    const baseName =
      files.length > 1
        ? "GangRun_Batch"
        : files[0].name.replace(/\.[^/.]+$/, "");
    let exportPrintName = type.toUpperCase();
    const suffixLabel = hasBleed ? "bleed" : "exact";
    const modeLabel = params.isNestingMode ? "Nested" : "Cloned";
    const plexLabel = params.isDuplexMode ? "Duplex" : "Simplex";

    let newFileName = `${baseName}_${params.sheetSelection}_${exportPrintName}_${cols}x${rows}_${modeLabel}_${plexLabel}_${suffixLabel}.pdf`;
    if (type === "booklet")
      newFileName = `${baseName}_${params.sheetSelection}_Booklet_Spreads_${suffixLabel}.pdf`;

    self.postMessage({ type: "success", pdfBytes, fileName: newFileName });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
