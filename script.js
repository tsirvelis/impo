// --- THEME LOGIC ---
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

// --- UI ELEMENTS ---
const impositionProfileSelect = document.getElementById("imposition-profile");
const sheetSizeSelect = document.getElementById("sheet-size");
const sheetOrientSelect = document.getElementById("sheet-orient");

const modeToggle = document.getElementById("mode-toggle");
const labelClone = document.getElementById("label-clone");
const labelNest = document.getElementById("label-nest");

const duplexToggle = document.getElementById("duplex-toggle");
const labelSimplex = document.getElementById("label-simplex");
const labelDuplex = document.getElementById("label-duplex");

const slugToggle = document.getElementById("slug-toggle");
const labelSlugOff = document.getElementById("label-slug-off");
const labelSlugOn = document.getElementById("label-slug-on");

const scaleToggle = document.getElementById("scale-toggle");
const labelScaleOff = document.getElementById("label-scale-off");
const labelScaleOn = document.getElementById("label-scale-on");
const scaleInputs = document.getElementById("scale-inputs");
const inputScaleW = document.getElementById("input-scale-w");
const inputScaleH = document.getElementById("input-scale-h");

const scaleLockToggle = document.getElementById("scale-lock-toggle");
const labelLockOff = document.getElementById("label-lock-off");
const labelLockOn = document.getElementById("label-lock-on");

const scaleBleedToggle = document.getElementById("scale-bleed-toggle");
const labelSbleedOff = document.getElementById("label-sbleed-off");
const labelSbleedOn = document.getElementById("label-sbleed-on");

const sliderBleed = document.getElementById("slider-bleed");
const sliderGutter = document.getElementById("slider-gutter");
const sliderCropLen = document.getElementById("slider-crop-len");
const sliderCropGap = document.getElementById("slider-crop-gap");

const valBleed = document.getElementById("val-bleed");
const valGutter = document.getElementById("val-gutter");
const valCropLen = document.getElementById("val-crop-len");
const valCropGap = document.getElementById("val-crop-gap");

// NEW: Info Elements
const infoOriginalSize = document.getElementById("info-original-size");
const infoPageCount = document.getElementById("info-page-count");

// --- UI EVENT LISTENERS ---
modeToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelNest.classList.add("active");
    labelClone.classList.remove("active");
  } else {
    labelClone.classList.add("active");
    labelNest.classList.remove("active");
  }
});
duplexToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelDuplex.classList.add("active");
    labelSimplex.classList.remove("active");
  } else {
    labelSimplex.classList.add("active");
    labelDuplex.classList.remove("active");
  }
});
slugToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelSlugOn.classList.add("active");
    labelSlugOff.classList.remove("active");
  } else {
    labelSlugOff.classList.add("active");
    labelSlugOn.classList.remove("active");
  }
});
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

let scaleRatio = parseFloat(inputScaleW.value) / parseFloat(inputScaleH.value);
scaleLockToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelLockOn.classList.add("active");
    labelLockOff.classList.remove("active");
    scaleRatio = parseFloat(inputScaleW.value) / parseFloat(inputScaleH.value);
  } else {
    labelLockOff.classList.add("active");
    labelLockOn.classList.remove("active");
  }
});
scaleBleedToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    labelSbleedOn.classList.add("active");
    labelSbleedOff.classList.remove("active");
  } else {
    labelSbleedOff.classList.add("active");
    labelSbleedOn.classList.remove("active");
  }
});
inputScaleW.addEventListener("input", () => {
  if (scaleLockToggle.checked && parseFloat(inputScaleW.value) > 0) {
    inputScaleH.value =
      Math.round((parseFloat(inputScaleW.value) / scaleRatio) * 10) / 10;
  } else {
    scaleRatio = parseFloat(inputScaleW.value) / parseFloat(inputScaleH.value);
  }
});
inputScaleH.addEventListener("input", () => {
  if (scaleLockToggle.checked && parseFloat(inputScaleH.value) > 0) {
    inputScaleW.value =
      Math.round(parseFloat(inputScaleH.value) * scaleRatio * 10) / 10;
  } else {
    scaleRatio = parseFloat(inputScaleW.value) / parseFloat(inputScaleH.value);
  }
});

function updateSliderText() {
  valBleed.innerText = sliderBleed.value + " mm";
  valGutter.innerText = sliderGutter.value + " mm";
  valCropLen.innerText = sliderCropLen.value + " mm";
  valCropGap.innerText = sliderCropGap.value + " mm";
}
sliderBleed.addEventListener("input", updateSliderText);
sliderGutter.addEventListener("input", updateSliderText);
sliderCropLen.addEventListener("input", updateSliderText);
sliderCropGap.addEventListener("input", updateSliderText);
updateSliderText();

// --- WORKSPACE MATRIX STATE ---
let currentFiles = [];
let currentBlobUrl = null;
let currentFileName = "";

const previewModal = document.getElementById("preview-modal");
const previewIframe = document.getElementById("preview-iframe");
const btnModalClose = document.getElementById("btn-modal-close");
const btnModalDownload = document.getElementById("btn-modal-download");
const previewTitle = document.getElementById("preview-title");

const worker = new Worker("worker.js");
const progressOverlay = document.getElementById("progress-overlay");
const progressTitle = document.getElementById("progress-title");
const progressDetail = document.getElementById("progress-detail");
const progressBar = document.getElementById("progress-bar");

btnModalClose.addEventListener("click", () => {
  previewModal.classList.remove("open");
  currentFiles = [];
  infoOriginalSize.innerText = "Analyzing...";
  infoPageCount.innerText = "--";
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

// --- LIVE RELAY RE-RENDER LOGIC ---
const autoTriggerElements = [
  impositionProfileSelect,
  sheetSizeSelect,
  sheetOrientSelect,
  modeToggle,
  duplexToggle,
  slugToggle,
  scaleToggle,
  scaleBleedToggle,
  sliderBleed,
  sliderGutter,
  sliderCropLen,
  sliderCropGap,
  inputScaleW,
  inputScaleH,
];

autoTriggerElements.forEach((el) => {
  el.addEventListener("change", () => {
    if (previewModal.classList.contains("open") && currentFiles.length > 0) {
      triggerRenderEngine();
    }
  });
});

async function triggerRenderEngine() {
  progressTitle.innerText = "Re-calculating Matrix...";
  progressDetail.innerText = "Applying configuration parameter state";
  progressBar.style.width = "0%";

  infoOriginalSize.innerText = "Analyzing...";
  infoPageCount.innerText = "--";

  progressOverlay.classList.add("open");

  const filePayload = [];
  for (let file of currentFiles) {
    const buffer = await file.arrayBuffer();
    filePayload.push({ name: file.name, type: file.type, buffer: buffer });
  }

  const params = {
    profileSelection: impositionProfileSelect.value,
    sheetSelection: sheetSizeSelect.value,
    orientSelection: sheetOrientSelect.value,
    isNestingMode: modeToggle.checked,
    isDuplexMode: duplexToggle.checked,
    addSlug: slugToggle.checked,
    forceScale: scaleToggle.checked,
    scaleIncludesBleed: scaleBleedToggle.checked,
    userBleed: parseFloat(sliderBleed.value),
    userGutter: parseFloat(sliderGutter.value),
    userCropLen: parseFloat(sliderCropLen.value),
    userCropGap: parseFloat(sliderCropGap.value),
    targetW: parseFloat(inputScaleW.value),
    targetH: parseFloat(inputScaleH.value),
  };

  worker.postMessage({ files: filePayload, params });
}

// --- WORKER RESPONSE PORTAL ---
worker.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === "progress") {
    progressTitle.innerText = msg.title;
    progressDetail.innerText = msg.detail;
    progressBar.style.width = `${msg.percent}%`;
  } else if (msg.type === "fileInfo") {
    // 1. Update the UI Info Panel
    infoOriginalSize.innerText = `${msg.w} x ${msg.h} mm`;
    infoPageCount.innerText = msg.pages;

    // 2. NEW: Pre-fill the Auto-Scale inputs with the source size!
    // We only update them if the user hasn't already started typing a custom size
    if (!scaleToggle.checked) {
      inputScaleW.value = msg.w;
      inputScaleH.value = msg.h;
      // Re-calculate the lock ratio based on the true source dimensions
      scaleRatio = msg.w / msg.h;
    }
  } else if (msg.type === "success") {
    progressOverlay.classList.remove("open");

    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);

    const blob = new Blob([msg.pdfBytes], { type: "application/pdf" });
    currentBlobUrl = URL.createObjectURL(blob);
    currentFileName = msg.fileName;

    previewTitle.innerText = msg.fileName;
    previewIframe.src = currentBlobUrl;

    if (!previewModal.classList.contains("open")) {
      previewModal.classList.add("open");
    }
  } else if (msg.type === "error") {
    progressOverlay.classList.remove("open");
    alert("Matrix Processing Aborted: " + msg.message);
  }
};

// --- DRAG AND DROP PORT INITIALIZATION ---
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

const zoneUniversal = document.getElementById("zone-universal");
["dragenter", "dragover"].forEach((eventName) =>
  zoneUniversal.addEventListener(
    eventName,
    () => zoneUniversal.classList.add("hover"),
    false,
  ),
);
["dragleave", "drop"].forEach((eventName) =>
  zoneUniversal.addEventListener(
    eventName,
    () => zoneUniversal.classList.remove("hover"),
    false,
  ),
);

zoneUniversal.addEventListener(
  "drop",
  (e) => {
    const files = Array.from(e.dataTransfer.files).filter(
      (f) =>
        f.type === "application/pdf" ||
        f.type === "image/jpeg" ||
        f.type === "image/png",
    );
    if (files.length > 0) {
      currentFiles = files;
      triggerRenderEngine();
    } else {
      alert("Please drop valid PDF, JPG, or PNG architectural formats.");
    }
  },
  false,
);
