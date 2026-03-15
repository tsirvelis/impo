// --- UI LOGIC & OVERRIDES ---
const modeToggle = document.getElementById("mode-toggle");
const labelClone = document.getElementById("label-clone");
const labelNest = document.getElementById("label-nest");
modeToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelNest.classList.add("active");
    labelClone.classList.remove("active");
    document.body.style.setProperty(
      "--neon-blue-glow",
      "rgba(176, 38, 255, 0.2)",
    );
  } else {
    labelClone.classList.add("active");
    labelNest.classList.remove("active");
    document.body.style.setProperty(
      "--neon-blue-glow",
      "rgba(0, 240, 255, 0.2)",
    );
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

// Sliders & Text Updates
const btnOverrides = document.getElementById("btn-overrides");
const panelOverrides = document.getElementById("overrides-panel");
const sliderBleed = document.getElementById("slider-bleed");
const sliderGutter = document.getElementById("slider-gutter");
const valBleed = document.getElementById("val-bleed");
const valGutter = document.getElementById("val-gutter");

const sizeToggle = document.getElementById("size-toggle");
const labelSRA3 = document.getElementById("label-sra3");
const labelSRA4 = document.getElementById("label-sra4");
const textBcExact = document.getElementById("text-bc-exact");
const textBcBleed = document.getElementById("text-bc-bleed");
const textAutoBleed = document.getElementById("text-auto-bleed");

btnOverrides.addEventListener("click", () => {
  panelOverrides.classList.toggle("open");
});

function updateDynamicText() {
  const b = parseFloat(sliderBleed.value);
  const g = parseFloat(sliderGutter.value);
  const orient = sizeToggle.checked ? "Landscape Base" : "Portrait Base";

  valBleed.innerText = b + " mm";
  valGutter.innerText = g + " mm";

  textBcExact.innerHTML = `90x50mm &rarr; ${orient}`;

  const dynamicW = 90 + b * 2;
  const dynamicH = 50 + b * 2;
  textBcBleed.innerHTML = `${dynamicW}x${dynamicH}mm &rarr; ${orient}`;

  textAutoBleed.innerHTML = `Dynamic Grid &bull; ${g}mm Gutter`;
}

sizeToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelSRA4.classList.add("active");
    labelSRA3.classList.remove("active");
  } else {
    labelSRA3.classList.add("active");
    labelSRA4.classList.remove("active");
  }
  updateDynamicText();
});

sliderBleed.addEventListener("input", updateDynamicText);
sliderGutter.addEventListener("input", updateDynamicText);

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
      // NEW: Allow PDFs, JPGs, and PNGs!
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

setupDropZone("zone-bc-exact", { type: "bc", hasBleed: false });
setupDropZone("zone-bc-bleed", { type: "bc", hasBleed: true });
setupDropZone("zone-auto-exact", { type: "auto", hasBleed: false });
setupDropZone("zone-auto-bleed", { type: "auto", hasBleed: true });

function mmToPt(mm) {
  return (mm * 72) / 25.4;
}
function ptToMm(pt) {
  return (pt * 25.4) / 72;
}

// Helper to stamp either a PDF Page or an Image
const stampElement = (targetPage, element, xPos, yPos, w, h) => {
  if (element.type === "page") {
    targetPage.drawPage(element.obj, { x: xPos, y: yPos, width: w, height: h });
  } else if (element.type === "image") {
    targetPage.drawImage(element.obj, {
      x: xPos,
      y: yPos,
      width: w,
      height: h,
    });
  }
};

// --- MAIN ENGINE ---
async function processAndExportPDF(filesArray, config, dropZoneElement) {
  const isNestingMode = modeToggle.checked;
  const isSRA4 = sizeToggle.checked;
  const addSlug = slugToggle.checked;
  const isDuplexMode = duplexToggle.checked;
  const paperName = isSRA4 ? "SRA4" : "SRA3";

  const userBleed = parseFloat(sliderBleed.value);
  const userGutter = parseFloat(sliderGutter.value);

  const originalText = dropZoneElement.innerHTML;
  dropZoneElement.classList.remove("error");
  dropZoneElement.innerHTML = `<strong>Batching ${filesArray.length} Files...</strong><span>Validating Matrix</span>`;

  try {
    const newPdf = await PDFLib.PDFDocument.create();
    const helveticaFont = await newPdf.embedFont(
      PDFLib.StandardFonts.Helvetica,
    );

    // Unified array to hold both PDF Pages and Images
    let allElements = [];
    let artWMm = 0;
    let artHMm = 0;

    // 1. BATCH VALIDATION & EXTRACTION
    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const arrayBuffer = await file.arrayBuffer();

      let currentWMm, currentHMm;
      let extractedItems = [];

      // Check if it's a PDF or an Image
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
        // It's an Image! Embed it and calculate size based on 300 DPI
        let img;
        if (file.type === "image/jpeg")
          img = await newPdf.embedJpg(arrayBuffer);
        else img = await newPdf.embedPng(arrayBuffer);

        currentWMm = Math.round((img.width / 300) * 25.4 * 10) / 10;
        currentHMm = Math.round((img.height / 300) * 25.4 * 10) / 10;

        extractedItems = [{ type: "image", obj: img }];
      }

      // Validation
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
              `Size Error: Got ${Math.round(artWMm)}x${Math.round(artHMm)}mm.`,
            );
          }
        }
      } else {
        if (
          Math.abs(currentWMm - artWMm) > 1.5 ||
          Math.abs(currentHMm - artHMm) > 1.5
        ) {
          throw new Error(`Batch Error! Size mismatch.`);
        }
      }

      allElements.push(...extractedItems);
    }

    dropZoneElement.innerHTML = `<strong>Rendering...</strong><span>Processing ${allElements.length} items</span>`;

    // 2. DYNAMIC MATH WITH OVERRIDES
    const sheetLongMm = isSRA4 ? 320 : 450;
    const sheetShortMm = isSRA4 ? 225 : 320;

    const gutterMm = config.hasBleed ? userGutter : 0;
    const cutWMm = config.hasBleed ? artWMm - userBleed * 2 : artWMm;
    const cutHMm = config.hasBleed ? artHMm - userBleed * 2 : artHMm;

    const maxUsableLong = sheetLongMm - 14;
    const maxUsableShort = sheetShortMm - 14;

    let cols, rows, useLandscape;

    if (config.type === "bc") {
      useLandscape = isSRA4;
      if (useLandscape) {
        cols = Math.floor((maxUsableLong + gutterMm) / (cutWMm + gutterMm));
        rows = Math.floor((maxUsableShort + gutterMm) / (cutHMm + gutterMm));
      } else {
        cols = Math.floor((maxUsableShort + gutterMm) / (cutWMm + gutterMm));
        rows = Math.floor((maxUsableLong + gutterMm) / (cutHMm + gutterMm));
      }
      if (cols === 0 || rows === 0)
        throw new Error(`Won't fit on ${paperName}`);
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

      if (colsL * rowsL === 0 && colsP * rowsP === 0)
        throw new Error(`Won't fit ${paperName}`);

      useLandscape = colsL * rowsL >= colsP * rowsP;
      cols = useLandscape ? colsL : colsP;
      rows = useLandscape ? rowsL : rowsP;
    }

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

    const cropGap = mmToPt(2);
    const cropLen = mmToPt(5);
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

    // 3. BUILD THE PDF MATRIX
    if (isNestingMode) {
      if (isDuplexMode) {
        let pairs = [];
        for (let i = 0; i < allElements.length; i += 2) {
          pairs.push({
            front: allElements[i],
            back: allElements[i + 1] || null,
          });
        }

        let currentPairIdx = 0;
        const totalPairs = pairs.length;

        while (currentPairIdx < totalPairs) {
          const frontSheet = newPdf.addPage([pageW, pageH]);
          const backSheet = newPdf.addPage([pageW, pageH]);

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (currentPairIdx < totalPairs) {
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
        const totalPages = allElements.length;

        while (currentPageIdx < totalPages) {
          const page = newPdf.addPage([pageW, pageH]);

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (currentPageIdx < totalPages) {
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
    const printType = config.type === "bc" ? "BC" : "AutoFit";
    const suffix = config.hasBleed ? "bleed" : "exact";
    const modeLabel = isNestingMode ? "Nested" : "Cloned";
    const plexLabel = isDuplexMode ? "Duplex" : "Simplex";

    const newFileName = `${baseName}_${paperName}_${printType}_${cols}x${rows}_${modeLabel}_${plexLabel}_${suffix}.pdf`;

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = newFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    dropZoneElement.innerHTML = `<strong>Complete!</strong><span>Output secured.</span>`;
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
