// --- ALL YOUR PREVIOUS UI TOGGLE LOGIC STAYS EXACTLY THE SAME ---
const themeToggle = document.getElementById("theme-toggle");
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

const actionToggle = document.getElementById("action-toggle");
const labelPreview = document.getElementById("label-preview");
const labelDownload = document.getElementById("label-download");
actionToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelDownload.classList.add("active");
    labelPreview.classList.remove("active");
  } else {
    labelPreview.classList.add("active");
    labelDownload.classList.remove("active");
  }
});

const scaleToggle = document.getElementById("scale-toggle");
const labelScaleOff = document.getElementById("label-scale-off");
const labelScaleOn = document.getElementById("label-scale-on");
const scaleInputs = document.getElementById("scale-inputs");
scaleToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelScaleOn.classList.add("active");
    labelScaleOff.classList.remove("active");
    scaleInputs.style.display = "grid";
  } else {
    labelScaleOff.classList.add("active");
    labelScaleOn.classList.remove("active");
    scaleInputs.style.display = "none";
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
  let orientText = "Auto Base";
  if (sheetOrientSelect.value === "portrait") orientText = "Portrait Base";
  if (sheetOrientSelect.value === "landscape") orientText = "Landscape Base";
  textBcExact.innerHTML = `90x50mm &rarr; ${orientText}`;
  textBcBleed.innerHTML = `${90 + b * 2}x${50 + b * 2}mm &rarr; ${orientText}`;
  textAutoBleed.innerHTML = `Dynamic Grid &bull; ${g}mm Gutter`;
  textCutStackBleed.innerHTML = `Ticket/Page Sorting &bull; ${g}mm Gutter`;
}

sheetSizeSelect.addEventListener("change", updateDynamicText);
sheetOrientSelect.addEventListener("change", updateDynamicText);
sliderBleed.addEventListener("input", updateDynamicText);
sliderGutter.addEventListener("input", updateDynamicText);
sliderCropLen.addEventListener("input", updateDynamicText);
sliderCropGap.addEventListener("input", updateDynamicText);
updateDynamicText();

// --- PREVIEW MODAL LOGIC ---
const previewModal = document.getElementById("preview-modal");
const previewIframe = document.getElementById("preview-iframe");
const btnModalClose = document.getElementById("btn-modal-close");
const btnModalDownload = document.getElementById("btn-modal-download");
const previewTitle = document.getElementById("preview-title");
let currentBlobUrl = null;
let currentFileName = "";

btnModalClose.addEventListener("click", () => {
  previewModal.classList.remove("open");
  setTimeout(() => (previewIframe.src = ""), 300);
});
btnModalDownload.addEventListener("click", () => {
  if (currentBlobUrl) {
    const a = document.createElement("a");
    a.href = currentBlobUrl;
    a.download = currentFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});

// --- NEW: WEB WORKER LOGIC ---
const worker = new Worker("worker.js");
const progressOverlay = document.getElementById("progress-overlay");
const progressTitle = document.getElementById("progress-title");
const progressDetail = document.getElementById("progress-detail");
const progressBar = document.getElementById("progress-bar");
let currentDropZone = null;
let originalZoneText = "";

worker.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === "progress") {
    progressTitle.innerText = msg.title;
    progressDetail.innerText = msg.detail;
    progressBar.style.width = `${msg.percent}%`;
  } else if (msg.type === "success") {
    progressOverlay.classList.remove("open"); // Hide loading screen

    const blob = new Blob([msg.pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    if (actionToggle.checked) {
      // DOWNLOAD
      const a = document.createElement("a");
      a.href = url;
      a.download = msg.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      // PREVIEW
      currentBlobUrl = url;
      currentFileName = msg.fileName;
      previewTitle.innerText = msg.fileName;
      previewIframe.src = url;
      previewModal.classList.add("open");
    }

    if (currentDropZone) {
      currentDropZone.innerHTML = `<strong style="color:var(--text-main)">Complete!</strong><span style="color:var(--accent-primary)">Output ready.</span>`;
      setTimeout(() => (currentDropZone.innerHTML = originalZoneText), 4000);
    }
  } else if (msg.type === "error") {
    progressOverlay.classList.remove("open");
    if (currentDropZone) {
      currentDropZone.classList.add("error");
      let shortMsg =
        msg.message.length > 40
          ? msg.message.substring(0, 37) + "..."
          : msg.message;
      currentDropZone.innerHTML = `<strong>Abort!</strong><span>${shortMsg}</span>`;
      setTimeout(() => {
        currentDropZone.innerHTML = originalZoneText;
        currentDropZone.classList.remove("error");
      }, 5000);
    }
    alert("Matrix Error: " + msg.message);
  }
};

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
    async (e) => {
      const files = Array.from(e.dataTransfer.files).filter(
        (f) =>
          f.type === "application/pdf" ||
          f.type === "image/jpeg" ||
          f.type === "image/png",
      );
      if (files.length > 0) {
        currentDropZone = dropZone;
        originalZoneText = dropZone.innerHTML;

        // Open Loading Screen
        progressTitle.innerText = "Initializing Engine...";
        progressDetail.innerText = "Reading file data";
        progressBar.style.width = "0%";
        progressOverlay.classList.add("open");

        // Convert files to raw buffers for the Web Worker
        const filePayload = [];
        const buffersToTransfer = [];

        for (let file of files) {
          const buffer = await file.arrayBuffer();
          filePayload.push({
            name: file.name,
            type: file.type,
            buffer: buffer,
          });
          buffersToTransfer.push(buffer); // We transfer ownership for extreme performance
        }

        // Collect all UI state parameters
        const params = {
          isNestingMode: modeToggle.checked,
          isDuplexMode: duplexToggle.checked,
          addSlug: slugToggle.checked,
          forceScale: scaleToggle.checked,
          sheetSelection: sheetSizeSelect.value,
          orientSelection: sheetOrientSelect.value,
          userBleed: parseFloat(sliderBleed.value),
          userGutter: parseFloat(sliderGutter.value),
          userCropLen: parseFloat(sliderCropLen.value),
          userCropGap: parseFloat(sliderCropGap.value),
          targetW: parseFloat(document.getElementById("input-scale-w").value),
          targetH: parseFloat(document.getElementById("input-scale-h").value),
        };

        // Send to background thread!
        worker.postMessage(
          { files: filePayload, config, params },
          buffersToTransfer,
        );
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
setupDropZone("zone-cut-stack-exact", { type: "cutstack", hasBleed: false });
setupDropZone("zone-cut-stack-bleed", { type: "cutstack", hasBleed: true });
setupDropZone("zone-booklet", { type: "booklet", hasBleed: true });
