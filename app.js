// --- THEME LOGIC ---
const themeToggle = document.getElementById("theme-toggle");
// Check local storage for preference
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light-theme");
  themeToggle.checked = true;
}
themeToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    document.body.classList.add("light-theme");
    localStorage.setItem("theme", "light");
  } else {
    document.body.classList.remove("light-theme");
    localStorage.setItem("theme", "dark");
  }
});

// --- UI LOGIC & OVERRIDES ---
const modeToggle = document.getElementById("mode-toggle");
const labelClone = document.getElementById("label-clone");
const labelNest = document.getElementById("label-nest");
modeToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelNest.classList.add("active");
    labelClone.classList.remove("active");
  } else {
    labelClone.classList.add("active");
    labelNest.classList.remove("active");
  }
});

const duplexToggle = document.getElementById("duplex-toggle");
const labelSimplex = document.getElementById("label-simplex");
const labelDuplex = document.getElementById("label-duplex");
duplexToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelDuplex.classList.add("active");
    labelSimplex.classList.remove("active");
  } else {
    labelSimplex.classList.add("active");
    labelDuplex.classList.remove("active");
  }
});

const slugToggle = document.getElementById("slug-toggle");
const labelSlugOff = document.getElementById("label-slug-off");
const labelSlugOn = document.getElementById("label-slug-on");
slugToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelSlugOn.classList.add("active");
    labelSlugOff.classList.remove("active");
  } else {
    labelSlugOff.classList.add("active");
    labelSlugOn.classList.remove("active");
  }
});

const btnOverrides = document.getElementById("btn-overrides");
const panelOverrides = document.getElementById("overrides-panel");
const sliderBleed = document.getElementById("slider-bleed");
const sliderGutter = document.getElementById("slider-gutter");
const sliderCropLen = document.getElementById("slider-crop-len");
const sliderCropGap = document.getElementById("slider-crop-gap");

const valBleed = document.getElementById("val-bleed");
const valGutter = document.getElementById("val-gutter");
const valCropLen = document.getElementById("val-crop-len");
const valCropGap = document.getElementById("val-crop-gap");

const sheetSizeSelect = document.getElementById("sheet-size");
const sheetOrientSelect = document.getElementById("sheet-orient");

const textBcExact = document.getElementById("text-bc-exact");
const textBcBleed = document.getElementById("text-bc-bleed");
const textAutoBleed = document.getElementById("text-auto-bleed");
const textCutStackBleed = document.getElementById("text-cutstack-bleed");

btnOverrides.addEventListener("click", () => {
  panelOverrides.classList.toggle("open");
});

function updateDynamicText() {
  const b = parseFloat(sliderBleed.value);
  const g = parseFloat(sliderGutter.value);

  valBleed.innerText = b + " mm";
  valGutter.innerText = g + " mm";
  valCropLen.innerText = sliderCropLen.value + " mm";
  valCropGap.innerText = sliderCropGap.value + " mm";

  // Determine text based on orientation selection
  let orientText = "Auto Base";
  if (sheetOrientSelect.value === "portrait") orientText = "Portrait Base";
  if (sheetOrientSelect.value === "landscape") orientText = "Landscape Base";

  textBcExact.innerHTML = `90x50mm &rarr; ${orientText}`;

  const dynamicW = 90 + b * 2;
  const dynamicH = 50 + b * 2;
  textBcBleed.innerHTML = `${dynamicW}x${dynamicH}mm &rarr; ${orientText}`;

  textAutoBleed.innerHTML = `Dynamic Grid &bull; ${g}mm Gutter`;
  textCutStackBleed.innerHTML = `Ticket/Page Sorting &bull; ${g}mm Gutter`;
}

sheetSizeSelect.addEventListener("change", updateDynamicText);
sheetOrientSelect.addEventListener("change", updateDynamicText);
sliderBleed.addEventListener("input", updateDynamicText);
sliderGutter.addEventListener("input", updateDynamicText);
sliderCropLen.addEventListener("input", updateDynamicText);
sliderCropGap.addEventListener("input", updateDynamicText);

// Initial call
updateDynamicText();

// --- DRAG AND DROP SETUP ---
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  document.body.addEventListener(
    eventName,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    false,
  );
});

function setupDropZone(zoneId, config) {
  const dropZone = document.getElementById(zoneId);
  ["dragenter", "dragover"].forEach((eventName) =>
    dropZone.addEventListener(
      eventName,
      () => dropZone.classList.add("hover"),
      false,
    ),
  );
  ["dragleave", "drop"].forEach((eventName) =>
    dropZone.addEventListener(
      eventName,
      () => dropZone.classList.remove("hover"),
      false,
    ),
  );

  dropZone.addEventListener(
    "drop",
    (e) => {
      const files = Array.from(e.dataTransfer.files).filter(
        (f) =>
          f.type === "application/pdf" ||
          f.type === "image/jpeg" ||
          f.type === "image/png",
      );
      if (files.length > 0) {
        processAndExportPDF(files, config, dropZone);
      } else {
        alert("Please drop valid PDF, JPG, or PNG files.");
      }
    },
    false,
  );
}

// Init all 6 Zones
setupDropZone("zone-bc-exact", { type: "bc", hasBleed: false });
setupDropZone("zone-bc-bleed", { type: "bc", hasBleed: true });
setupDropZone("zone-auto-exact", { type: "auto", hasBleed: false });
setupDropZone("zone-auto-bleed", { type: "auto", hasBleed: true });
setupDropZone("zone-cut-stack-exact", { type: "cutstack", hasBleed: false });
setupDropZone("zone-cut-stack-bleed", { type: "cutstack", hasBleed: true });

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

// --- MAIN ENGINE ---
async function processAndExportPDF(filesArray, config, dropZoneElement) {
  const isNestingMode = modeToggle.checked;
  const isDuplexMode = duplexToggle.checked;
  const addSlug = slugToggle.checked;

  const sheetSelection = sheetSizeSelect.value;
  const orientSelection = sheetOrientSelect.value;

  const userBleed = parseFloat(sliderBleed.value);
  const userGutter = parseFloat(sliderGutter.value);
  const userCropLen = parseFloat(sliderCropLen.value);
  const userCropGap = parseFloat(sliderCropGap.value);

  const originalText = dropZoneElement.innerHTML;
  dropZoneElement.classList.remove("error");
  dropZoneElement.innerHTML = `<strong style="color:var(--text-main)">Processing...</strong><span style="color:var(--accent-primary)">Validating Matrix</span>`;

  try {
    const newPdf = await PDFLib.PDFDocument.create();
    const helveticaFont = await newPdf.embedFont(
      PDFLib.StandardFonts.Helvetica,
    );

    let allElements = [];
    let artWMm = 0,
      artHMm = 0;

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const arrayBuffer = await file.arrayBuffer();
      let currentWMm, currentHMm;
      let extractedItems = [];

      if (file.type === "application/pdf") {
        const originalPdf = await PDFLib.PDFDocument.load(arrayBuffer);
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
          img = await newPdf.embedJpg(arrayBuffer);
        else img = await newPdf.embedPng(arrayBuffer);

        currentWMm = Math.round((img.width / 300) * 25.4 * 10) / 10;
        currentHMm = Math.round((img.height / 300) * 25.4 * 10) / 10;
        extractedItems = [{ type: "image", obj: img }];
      }

      if (i === 0) {
        artWMm = currentWMm;
        artHMm = currentHMm;
        if (config.type === "bc") {
          const expectedW = config.hasBleed ? 90 + userBleed * 2 : 90;
          const expectedH = config.hasBleed ? 50 + userBleed * 2 : 50;
          if (
            Math.abs(artWMm - expectedW) > 1.5 ||
            Math.abs(artHMm - expectedH) > 1.5
          ) {
            throw new Error(
              `Size Error: Expected ${expectedW}x${expectedH}mm.`,
            );
          }
        }
      } else {
        if (
          Math.abs(currentWMm - artWMm) > 1.5 ||
          Math.abs(currentHMm - artHMm) > 1.5
        ) {
          throw new Error(`Batch Error! File dimension mismatch.`);
        }
      }
      allElements.push(...extractedItems);
    }

    dropZoneElement.innerHTML = `<strong style="color:var(--text-main)">Building Grid...</strong><span style="color:var(--accent-primary)">Layout Generation</span>`;

    const sheetLongMm = SHEET_DIMENSIONS[sheetSelection].long;
    const sheetShortMm = SHEET_DIMENSIONS[sheetSelection].short;

    const gutterMm = config.hasBleed ? userGutter : 0;
    const cutWMm = config.hasBleed ? artWMm - userBleed * 2 : artWMm;
    const cutHMm = config.hasBleed ? artHMm - userBleed * 2 : artHMm;

    const reserveMargin = (userCropLen + userCropGap + 2) * 2;
    const maxUsableLong = sheetLongMm - reserveMargin;
    const maxUsableShort = sheetShortMm - reserveMargin;

    let cols, rows, useLandscape;

    const colsL = Math.floor((maxUsableLong + gutterMm) / (cutWMm + gutterMm));
    const rowsL = Math.floor((maxUsableShort + gutterMm) / (cutHMm + gutterMm));
    const colsP = Math.floor((maxUsableShort + gutterMm) / (cutWMm + gutterMm));
    const rowsP = Math.floor((maxUsableLong + gutterMm) / (cutHMm + gutterMm));

    // Force Orientation Logic overrides default behavior
    if (orientSelection === "landscape") {
      useLandscape = true;
      cols = colsL;
      rows = rowsL;
    } else if (orientSelection === "portrait") {
      useLandscape = false;
      cols = colsP;
      rows = rowsP;
    } else {
      // Auto
      useLandscape = colsL * rowsL >= colsP * rowsP;
      cols = useLandscape ? colsL : colsP;
      rows = useLandscape ? rowsL : rowsP;
    }

    if (cols === 0 || rows === 0)
      throw new Error(
        `Artwork too large for ${sheetSelection} (${orientSelection})`,
      );

    const pageW = useLandscape ? mmToPt(sheetLongMm) : mmToPt(sheetShortMm);
    const pageH = useLandscape ? mmToPt(sheetShortMm) : mmToPt(sheetLongMm);
    const cutW = mmToPt(cutWMm);
    const cutH = mmToPt(cutHMm);
    const gutter = mmToPt(gutterMm);
    const drawW = mmToPt(artWMm);
    const drawH = mmToPt(artHMm);
    const offset = config.hasBleed ? mmToPt(userBleed) : 0;

    const gridTotalW = cols * cutW + (cols - 1) * gutter;
    const gridTotalH = rows * cutH + (rows - 1) * gutter;
    const startX = (pageW - gridTotalW) / 2;
    const startY = (pageH - gridTotalH) / 2;

    const cropGap = mmToPt(userCropGap);
    const cropLen = mmToPt(userCropLen);
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
      if (addSlug) {
        page.drawText(`${artWMm} x ${artHMm} mm`, {
          x: startX + 3,
          y: startY + gridTotalH + cropGap + 1,
          size: 4,
          font: helveticaFont,
          color: markColor,
        });
      }
    };

    const totalSlots = cols * rows;

    // --- 3. BUILD THE PDF MATRIX ---

    if (config.type === "cutstack") {
      if (isDuplexMode) {
        let pairs = [];
        for (let i = 0; i < allElements.length; i += 2)
          pairs.push({
            front: allElements[i],
            back: allElements[i + 1] || null,
          });
        const sheetsNeeded = Math.ceil(pairs.length / totalSlots);

        for (let s = 0; s < sheetsNeeded; s++) {
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
    } else if (isNestingMode) {
      if (isDuplexMode) {
        let pairs = [];
        for (let i = 0; i < allElements.length; i += 2)
          pairs.push({
            front: allElements[i],
            back: allElements[i + 1] || null,
          });

        let currentPairIdx = 0;
        while (currentPairIdx < pairs.length) {
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
        while (currentPageIdx < allElements.length) {
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
      for (const element of allElements) {
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

    // 4. EXPORT
    const pdfBytes = await newPdf.save();

    const baseName =
      filesArray.length > 1
        ? "GangRun_Batch"
        : filesArray[0].name.replace(/\.[^/.]+$/, "");
    let printType = config.type === "bc" ? "BC" : "AutoFit";
    if (config.type === "cutstack") printType = "CutStack";

    const suffix = config.hasBleed ? "bleed" : "exact";
    const modeLabel = isNestingMode ? "Nested" : "Cloned";
    const plexLabel = isDuplexMode ? "Duplex" : "Simplex";

    const newFileName = `${baseName}_${sheetSelection}_${printType}_${cols}x${rows}_${modeLabel}_${plexLabel}_${suffix}.pdf`;

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = newFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    dropZoneElement.innerHTML = `<strong style="color:var(--text-main)">Complete!</strong><span style="color:var(--accent-primary)">Output secured.</span>`;
    setTimeout(() => (dropZoneElement.innerHTML = originalText), 4000);
  } catch (error) {
    console.error("Matrix Error:", error);
    dropZoneElement.classList.add("error");
    let shortMsg =
      error.message.length > 40
        ? error.message.substring(0, 37) + "..."
        : error.message;
    dropZoneElement.innerHTML = `<strong>Abort!</strong><span>${shortMsg}</span>`;
    setTimeout(() => {
      dropZoneElement.innerHTML = originalText;
      dropZoneElement.classList.remove("error");
    }, 5000);
  }
}
