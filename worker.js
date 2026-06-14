// Import PDF-lib into the background worker
importScripts("https://unpkg.com/pdf-lib/dist/pdf-lib.min.js");

function mmToPt(mm) {
  return (mm * 72) / 25.4;
}
function ptToMm(pt) {
  return (pt * 25.4) / 72;
}

const stampElement = (targetPage, element, xPos, yPos, w, h) => {
  if (element.type === "page")
    targetPage.drawPage(element.obj, { x: xPos, y: yPos, width: w, height: h });
  else if (element.type === "image")
    targetPage.drawImage(element.obj, {
      x: xPos,
      y: yPos,
      width: w,
      height: h,
    });
};

const SHEET_DIMENSIONS = {
  SRA3: { long: 450, short: 320 },
  SRA4: { long: 320, short: 225 },
  A3: { long: 420, short: 297 },
  A4: { long: 297, short: 210 },
};

self.onmessage = async (e) => {
  const { files, config, params } = e.data;

  try {
    const newPdf = await PDFLib.PDFDocument.create();
    const helveticaFont = await newPdf.embedFont(
      PDFLib.StandardFonts.Helvetica,
    );

    let allElements = [];
    let artWMm = 0,
      artHMm = 0;

    // --- PHASE 1: VALIDATION & EXTRACTION ---
    self.postMessage({
      type: "progress",
      title: "Extracting Data...",
      detail: `Reading ${files.length} files`,
      percent: 5,
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let currentWMm, currentHMm;
      let extractedItems = [];

      if (file.type === "application/pdf") {
        const originalPdf = await PDFLib.PDFDocument.load(file.buffer);
        const firstPage = originalPdf.getPages()[0];
        const { width, height } = firstPage.getSize();
        currentWMm = Math.round(ptToMm(width) * 10) / 10;
        currentHMm = Math.round(ptToMm(height) * 10) / 10;

        const pageIndices = originalPdf.getPageIndices();
        const embeddedPages = await newPdf.embedPdf(originalPdf, pageIndices);
        extractedItems = embeddedPages.map((p) => ({ type: "page", obj: p }));
      } else {
        let img;
        if (file.type === "image/jpeg")
          img = await newPdf.embedJpg(file.buffer);
        else img = await newPdf.embedPng(file.buffer);

        currentWMm = Math.round((img.width / 300) * 25.4 * 10) / 10;
        currentHMm = Math.round((img.height / 300) * 25.4 * 10) / 10;
        extractedItems = [{ type: "image", obj: img }];
      }

      if (i === 0) {
        if (params.forceScale) {
          if (config.type === "bc") {
            artWMm = config.hasBleed ? 90 + params.userBleed * 2 : 90;
            artHMm = config.hasBleed ? 50 + params.userBleed * 2 : 50;
          } else {
            artWMm = params.targetW;
            artHMm = params.targetH;
          }
        } else {
          artWMm = currentWMm;
          artHMm = currentHMm;
          if (config.type === "bc") {
            const expectedW = config.hasBleed ? 90 + params.userBleed * 2 : 90;
            const expectedH = config.hasBleed ? 50 + params.userBleed * 2 : 50;
            if (
              Math.abs(artWMm - expectedW) > 1.5 ||
              Math.abs(artHMm - expectedH) > 1.5
            ) {
              throw new Error(
                `Size Error: Expected ${expectedW}x${expectedH}mm. Turn on 'Force Scale' to override.`,
              );
            }
          }
        }
      } else {
        if (
          !params.forceScale &&
          (Math.abs(currentWMm - artWMm) > 1.5 ||
            Math.abs(currentHMm - artHMm) > 1.5)
        ) {
          throw new Error(
            `Batch Error! File dimension mismatch. Turn on 'Force Scale'.`,
          );
        }
      }
      allElements.push(...extractedItems);

      // Update progress slightly during extraction
      const prog = 5 + Math.round((i / files.length) * 15);
      self.postMessage({
        type: "progress",
        title: "Extracting Pages...",
        detail: `Processed ${allElements.length} pages`,
        percent: prog,
      });
    }

    // --- PHASE 2: MATH & GRID LAYOUT ---
    const sheetLongMm = SHEET_DIMENSIONS[params.sheetSelection].long;
    const sheetShortMm = SHEET_DIMENSIONS[params.sheetSelection].short;

    let gutterMm = config.hasBleed ? params.userGutter : 0;
    const cutWMm = config.hasBleed ? artWMm - params.userBleed * 2 : artWMm;
    const cutHMm = config.hasBleed ? artHMm - params.userBleed * 2 : artHMm;

    const reserveMargin = (params.userCropLen + params.userCropGap + 2) * 2;
    const maxUsableLong = sheetLongMm - reserveMargin;
    const maxUsableShort = sheetShortMm - reserveMargin;

    let cols, rows, useLandscape;

    if (config.type === "booklet") {
      useLandscape = true;
      cols = 2;
      rows = 1;
      gutterMm = 0;
      if (cutWMm * 2 > maxUsableLong || cutHMm > maxUsableShort)
        throw new Error(`Spread too large for ${params.sheetSelection}`);
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
        useLandscape = colsL * rowsL >= colsP * rowsP;
        cols = useLandscape ? colsL : colsP;
        rows = useLandscape ? rowsL : rowsP;
      }
      if (cols === 0 || rows === 0)
        throw new Error(`Artwork too large for ${params.sheetSelection}`);
    }

    const pageW = useLandscape ? mmToPt(sheetLongMm) : mmToPt(sheetShortMm);
    const pageH = useLandscape ? mmToPt(sheetShortMm) : mmToPt(sheetLongMm);
    const cutW = mmToPt(cutWMm);
    const cutH = mmToPt(cutHMm);
    const gutter = mmToPt(gutterMm);
    const drawW = mmToPt(artWMm);
    const drawH = mmToPt(artHMm);
    const offset = config.hasBleed ? mmToPt(params.userBleed) : 0;

    const gridTotalW = cols * cutW + (cols - 1) * gutter;
    const gridTotalH = rows * cutH + (rows - 1) * gutter;
    const startX = (pageW - gridTotalW) / 2;
    const startY = (pageH - gridTotalH) / 2;

    const cropGap = mmToPt(params.userCropGap);
    const cropLen = mmToPt(params.userCropLen);
    const markColor = PDFLib.rgb(0, 0, 0);
    const markThickness = 0.5;

    const drawCropMarksAndSlug = (page) => {
      if (config.hasBleed) {
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
      if (params.addSlug) {
        page.drawText(`${artWMm} x ${artHMm} mm`, {
          x: startX + 3,
          y: startY + gridTotalH + cropGap + 1,
          size: 4,
          font: helveticaFont,
          color: markColor,
        });
      }
    };

    // --- PHASE 3: SHEET GENERATION ---
    const totalSlots = cols * rows;

    // Helper to send progress updates to the main thread during heavy loops
    const reportProgress = (current, total, prefix) => {
      const baseProg = 20; // Starts at 20%
      const remainingProg = 70; // Takes up 70% of the bar (saving takes the last 10%)
      const currentProg =
        baseProg + Math.round((current / total) * remainingProg);
      self.postMessage({
        type: "progress",
        title: "Rendering Matrix...",
        detail: `${prefix} ${current} of ${total}`,
        percent: currentProg,
      });
    };

    if (config.type === "booklet") {
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
    } else if (config.type === "cutstack") {
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
      // CLONE MODE
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

    // --- PHASE 4: EXPORT ---
    self.postMessage({
      type: "progress",
      title: "Finalizing PDF...",
      detail: "Compressing and securing output",
      percent: 95,
    });

    const pdfBytes = await newPdf.save();

    const baseName =
      files.length > 1
        ? "GangRun_Batch"
        : files[0].name.replace(/\.[^/.]+$/, "");
    let printType = config.type === "bc" ? "BC" : "AutoFit";
    if (config.type === "cutstack") printType = "CutStack";
    if (config.type === "booklet") printType = "Booklet";

    const suffix = config.hasBleed ? "bleed" : "exact";
    const modeLabel = params.isNestingMode ? "Nested" : "Cloned";
    const plexLabel = params.isDuplexMode ? "Duplex" : "Simplex";

    let newFileName = `${baseName}_${params.sheetSelection}_${printType}_${cols}x${rows}_${modeLabel}_${plexLabel}_${suffix}.pdf`;
    if (config.type === "booklet") {
      newFileName = `${baseName}_${params.sheetSelection}_Booklet_Spreads_${suffix}.pdf`;
    }

    // Pass the finalized PDF buffer back to the Main UI Thread
    self.postMessage({ type: "success", pdfBytes, fileName: newFileName });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
