// =====================================================================
//  Spauda.Online Pro Imposition – UI controller
// =====================================================================

const $ = (id) => document.getElementById(id);

// --- SAFE STORAGE (private windows / blocked storage must not break the app)
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (_) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  },
};

// --- TRANSLATIONS ---
const I18N = {
  lt: {
    subtitle:
      "Įmeskite PDF, JPG arba PNG failus – maketas sudaromas iškart naršyklėje.",
    dropTitle: "Nutempkite failus čia",
    dropHint: "arba spustelėkite ir pasirinkite · PDF, JPG, PNG · galima keli failai",
    feat1: "Automatinis bleed ir TrimBox atpažinimas",
    feat2: "Vizitinės, Cut & Stack su numeracija, brošiūros",
    feat3: "Pasukimas 90°, kad tilptų daugiau",
    feat4: "Failai neišeina iš jūsų kompiuterio",
    srcSize: "Failo dydis",
    pages: "Puslapiai / vnt.",
    perSheet: "Ant lapo",
    sheets: "Spaudos lapų",
    usage: "Lapo išnaudojimas",
    presetPick: "Išsaugoti nustatymai…",
    save: "Išsaugoti",
    deletePreset: "Ištrinti pasirinktą",
    secJob: "Darbas ir lapas",
    profile: "Maketo tipas",
    pBcExact: "Vizitinės (90×50, be bleed)",
    pBcBleed: "Vizitinės (su bleed)",
    pAutoExact: "Smart Fit (be bleed, be tarpų)",
    pAutoBleed: "Smart Fit (su bleed ir tarpais)",
    pCutExact: "Cut & Stack (be bleed)",
    pCutBleed: "Cut & Stack (su bleed)",
    pBooklet: "Brošiūra (sankabėlės)",
    grpBooks: "Knygos ir brošiūros",
    pSignatures: "Knyga – siuvami sąsiuviniai",
    pPerfect: "Knyga – klijuotas blokas (Cut & Stack)",
    sigSheets: "Lapų sąsiuvinyje",
    sigHint: "1 lapas = 4 puslapiai. Pvz. 4 lapai = 16 psl. sąsiuvinis.",
    bookletUp: "Atvartų lape",
    upMax: "Kiek telpa",
    creep: "Creep (mm/lapui)",
    creepHint:
      "Creep – kiek kiekvienas vidinis lapas pastumiamas link nugarėlės. Paprastai ≈ popieriaus storis (pvz. 0,1 mm).",
    perfectHint:
      "Puslapiai spausdinami dvipusiai iš eilės. Supjaustykite, sudėkite krūveles iš eilės – gausite knygos bloką klijavimui.",
    sheetSize: "Spaudos lapas",
    custom: "Kitas dydis…",
    widthMm: "Plotis (mm)",
    heightMm: "Aukštis (mm)",
    orientation: "Orientacija",
    auto: "Automatiškai",
    portrait: "Stačias",
    landscape: "Gulsčias",
    rotate: "Pasukti 90°",
    rotAuto: "Jei telpa daugiau",
    rotOff: "Niekada",
    rotOn: "Visada",
    sheetMargin: "Nespausdinama paraštė (mm)",
    secPrint: "Spauda",
    gridMode: "Užpildymas",
    clone: "Kartoti",
    nest: "Iš eilės",
    gridHint:
      "Kartoti – kiekvienas puslapis užpildo visą lapą. Iš eilės – puslapiai dedami vienas po kito.",
    sides: "Pusės",
    simplex: "Vienpusė",
    duplex: "Dvipusė",
    flip: "Lapo apvertimas",
    flipLr: "Kairė ↔ dešinė (standartinis)",
    flipTb: "Viršus ↔ apačia (tumble)",
    backX: "Galo poslinkis X",
    backY: "Galo poslinkis Y",
    backHint: "Milimetrais. Kompensuoja spausdintuvo priekio/galo nesutapimą.",
    secScale: "Mastelis",
    forceScale: "Keisti dydį",
    targetW: "Plotis (mm)",
    targetH: "Aukštis (mm)",
    lock: "Išlaikyti proporcijas",
    incBleed: "Dydis su bleed",
    secMarks: "Bleed, tarpai ir žymos",
    bleed: "Bleed",
    gutter: "Tarpas tarp gaminių",
    cropMarks: "Pjovimo žymos",
    cropLen: "Žymų ilgis",
    cropGap: "Žymų atstumas",
    slug: "Informacinė eilutė",
    secVdp: "Numeracija",
    vdpEnable: "Numeruoti",
    vdpStart: "Nuo",
    vdpEnd: "Iki",
    vdpPrefix: "Priešdėlis",
    vdpPad: "Skaitmenų",
    vdpX1: "1 vieta X (mm)",
    vdpY1: "1 vieta Y (mm)",
    vdp2: "Antra vieta",
    vdpX2: "2 vieta X (mm)",
    vdpY2: "2 vieta Y (mm)",
    vdpHint: "Matuojama nuo apatinio kairiojo kampo, įskaitant bleed.",
    font: "Šriftas",
    color: "Spalva",
    fontSize: "Dydis",
    reset: "Atstatyti numatytus nustatymus",
    changeFile: "Keisti failą",
    download: "Atsisiųsti PDF",
    off: "Ne",
    on: "Taip",
    // dynamic
    analyzing: "Analizuojama…",
    starting: "Ruošiamasi…",
    startingDetail: "Taikomi nustatymai",
    rotated: "pasukta 90°",
    badFiles: "Tinka tik PDF, JPG arba PNG failai.",
    errorPrefix: "Nepavyko sudaryti maketo: ",
    presetName: "Nustatymų pavadinimas:",
    presetSaved: (n) => `Išsaugota: „${n}“`,
    presetDeleted: (n) => `Ištrinta: „${n}“`,
    resetDone: "Nustatymai atstatyti.",
    bleedFound: (b) => `Faile rastas ${b} mm bleed – naudojamas jis.`,
  },
  en: {
    subtitle: "Drop PDF, JPG or PNG files – the layout is built right in your browser.",
    dropTitle: "Drag & drop files here",
    dropHint: "or click to choose · PDF, JPG, PNG · multiple files allowed",
    feat1: "Automatic bleed and TrimBox detection",
    feat2: "Business cards, numbered cut & stack, booklets",
    feat3: "90° rotation to fit more per sheet",
    feat4: "Your files never leave your computer",
    srcSize: "Source size",
    pages: "Pages / items",
    perSheet: "Per sheet",
    sheets: "Press sheets",
    usage: "Sheet usage",
    presetPick: "Saved settings…",
    save: "Save",
    deletePreset: "Delete selected",
    secJob: "Job & sheet",
    profile: "Imposition profile",
    pBcExact: "Business card (90×50, no bleed)",
    pBcBleed: "Business card (with bleed)",
    pAutoExact: "Smart Fit (no bleed, no gutter)",
    pAutoBleed: "Smart Fit (bleed & gutter)",
    pCutExact: "Cut & Stack (no bleed)",
    pCutBleed: "Cut & Stack (with bleed)",
    pBooklet: "Saddle-stitch booklet",
    grpBooks: "Books & booklets",
    pSignatures: "Book – sewn signatures",
    pPerfect: "Book – perfect-bound block (cut & stack)",
    sigSheets: "Sheets per signature",
    sigHint: "1 sheet = 4 pages. E.g. 4 sheets = a 16-page signature.",
    bookletUp: "Spreads per sheet",
    upMax: "As many as fit",
    creep: "Creep (mm per sheet)",
    creepHint:
      "Creep – how far each inner sheet is shifted toward the spine. Usually ≈ paper thickness (e.g. 0.1 mm).",
    perfectHint:
      "Pages print two-sided in order. Cut, then put the stacks on top of each other in order to get a block ready for gluing.",
    sheetSize: "Press sheet",
    custom: "Custom size…",
    widthMm: "Width (mm)",
    heightMm: "Height (mm)",
    orientation: "Orientation",
    auto: "Auto",
    portrait: "Portrait",
    landscape: "Landscape",
    rotate: "Rotate 90°",
    rotAuto: "If more fit",
    rotOff: "Never",
    rotOn: "Always",
    sheetMargin: "Unprintable margin (mm)",
    secPrint: "Printing",
    gridMode: "Fill mode",
    clone: "Repeat",
    nest: "Sequence",
    gridHint:
      "Repeat – each page fills a whole sheet. Sequence – pages are placed one after another.",
    sides: "Sides",
    simplex: "Simplex",
    duplex: "Duplex",
    flip: "Sheet turn",
    flipLr: "Left ↔ right (standard)",
    flipTb: "Top ↔ bottom (tumble)",
    backX: "Back offset X",
    backY: "Back offset Y",
    backHint: "In millimetres. Compensates front/back misregistration on the press.",
    secScale: "Scaling",
    forceScale: "Resize",
    targetW: "Width (mm)",
    targetH: "Height (mm)",
    lock: "Keep proportions",
    incBleed: "Size includes bleed",
    secMarks: "Bleed, gutter & marks",
    bleed: "Bleed",
    gutter: "Gutter",
    cropMarks: "Crop marks",
    cropLen: "Mark length",
    cropGap: "Mark offset",
    slug: "Info slug",
    secVdp: "Numbering",
    vdpEnable: "Number items",
    vdpStart: "From",
    vdpEnd: "To",
    vdpPrefix: "Prefix",
    vdpPad: "Digits",
    vdpX1: "Spot 1 X (mm)",
    vdpY1: "Spot 1 Y (mm)",
    vdp2: "Second spot",
    vdpX2: "Spot 2 X (mm)",
    vdpY2: "Spot 2 Y (mm)",
    vdpHint: "Measured from the bottom-left corner, including bleed.",
    font: "Font",
    color: "Colour",
    fontSize: "Size",
    reset: "Reset to defaults",
    changeFile: "Change file",
    download: "Download PDF",
    off: "Off",
    on: "On",
    analyzing: "Analyzing…",
    starting: "Preparing…",
    startingDetail: "Applying settings",
    rotated: "rotated 90°",
    badFiles: "Only PDF, JPG or PNG files are supported.",
    errorPrefix: "Couldn't build the layout: ",
    presetName: "Name for these settings:",
    presetSaved: (n) => `Saved: "${n}"`,
    presetDeleted: (n) => `Deleted: "${n}"`,
    resetDone: "Settings reset.",
    bleedFound: (b) => `Found ${b} mm bleed in the file – using it.`,
  },
};

let lang = store.get("impo:lang", "lt");
if (!I18N[lang]) lang = "lt";
const t = (key, ...args) => {
  const v = I18N[lang][key] ?? I18N.lt[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
};

function applyLanguage() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-label]").forEach((el) => {
    el.label = t(el.dataset.i18nLabel);
  });
  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  updateSliderText();
}
document.querySelectorAll(".lang-switch button").forEach((b) =>
  b.addEventListener("click", () => {
    lang = b.dataset.lang;
    store.set("impo:lang", lang);
    applyLanguage();
    if (isWorkspaceOpen()) triggerRenderEngine();
  }),
);

// --- THEME ---
const themeToggle = $("theme-toggle");
if (store.get("theme", "dark") === "light") {
  document.body.classList.add("light-theme");
  themeToggle.checked = true;
}
themeToggle.addEventListener("change", (e) => {
  document.body.classList.toggle("light-theme", e.target.checked);
  store.set("theme", e.target.checked ? "light" : "dark");
});

// --- TOAST ---
const toast = $("toast");
let toastTimer = null;
function showToast(message, kind = "error") {
  $("toast-text").textContent = message;
  toast.className = `toast open ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("open"), kind === "error" ? 9000 : 3500);
}
$("toast-close").addEventListener("click", () => toast.classList.remove("open"));

// --- SETTINGS CONTROLS ---
const settingsRoot = $("settings");
// Every input/select with an id inside the sidebar is a setting (presets,
// auto-save and re-render all work off this list).
const settingControls = Array.from(
  settingsRoot.querySelectorAll("input[id], select[id]"),
).filter((el) => el.id !== "preset-select");

const DEFAULTS = {};
settingControls.forEach((el) => {
  DEFAULTS[el.id] = el.type === "checkbox" ? el.checked : el.value;
});

function readSettings() {
  const s = {};
  settingControls.forEach((el) => {
    s[el.id] = el.type === "checkbox" ? el.checked : el.value;
  });
  return s;
}

function writeSettings(s) {
  settingControls.forEach((el) => {
    if (!(el.id in s)) return;
    if (el.type === "checkbox") el.checked = !!s[el.id];
    else el.value = s[el.id];
  });
  refreshUi();
}

// On/off switches: highlight the active label and let the labels be clicked.
document.querySelectorAll(".mode-selector").forEach((sel) => {
  const input = sel.querySelector("input[type=checkbox]");
  const [offLabel, onLabel] = sel.querySelectorAll(".mode-label");
  offLabel.addEventListener("click", () => {
    if (input.checked) {
      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  onLabel.addEventListener("click", () => {
    if (!input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
});

// data-show-if / data-hide-if: "id" (checkbox on), "id=value", "id^=prefix";
// several conditions joined with "|" mean "any of".
function conditionHolds(expr) {
  return expr.split("|").some((cond) => {
    const m = cond.match(/^([\w-]+)(\^?=)?(.*)$/);
    const el = $(m[1]);
    if (!el) return false;
    if (!m[2]) return el.checked;
    return m[2] === "^=" ? el.value.startsWith(m[3]) : el.value === m[3];
  });
}

function refreshUi() {
  document.querySelectorAll(".mode-selector").forEach((sel) => {
    const input = sel.querySelector("input[type=checkbox]");
    const [offLabel, onLabel] = sel.querySelectorAll(".mode-label");
    offLabel.classList.toggle("active", !input.checked);
    onLabel.classList.toggle("active", input.checked);
  });
  document.querySelectorAll("[data-show-if]").forEach((el) => {
    el.hidden = !conditionHolds(el.dataset.showIf);
  });
  document.querySelectorAll("[data-hide-if]").forEach((el) => {
    el.hidden = conditionHolds(el.dataset.hideIf);
  });
  updateSliderText();
}

const sliderUnits = {
  "slider-bleed": ["val-bleed", "mm"],
  "slider-gutter": ["val-gutter", "mm"],
  "slider-crop-len": ["val-crop-len", "mm"],
  "slider-crop-gap": ["val-crop-gap", "mm"],
  "slider-vdp-font": ["val-vdp-font", "pt"],
};
function updateSliderText() {
  for (const [id, [out, unit]] of Object.entries(sliderUnits)) {
    $(out).textContent = `${$(id).value} ${unit}`;
  }
}

// --- PROPORTIONAL SCALE INPUTS ---
const inputScaleW = $("input-scale-w");
const inputScaleH = $("input-scale-h");
const scaleLockToggle = $("scale-lock-toggle");
let scaleRatio = parseFloat(inputScaleW.value) / parseFloat(inputScaleH.value);
scaleLockToggle.addEventListener("change", () => {
  if (scaleLockToggle.checked)
    scaleRatio = parseFloat(inputScaleW.value) / parseFloat(inputScaleH.value);
});
inputScaleW.addEventListener("input", () => {
  if (scaleLockToggle.checked && parseFloat(inputScaleW.value) > 0)
    inputScaleH.value = Math.round((parseFloat(inputScaleW.value) / scaleRatio) * 10) / 10;
  else scaleRatio = parseFloat(inputScaleW.value) / parseFloat(inputScaleH.value);
});
inputScaleH.addEventListener("input", () => {
  if (scaleLockToggle.checked && parseFloat(inputScaleH.value) > 0)
    inputScaleW.value = Math.round(parseFloat(inputScaleH.value) * scaleRatio * 10) / 10;
  else scaleRatio = parseFloat(inputScaleW.value) / parseFloat(inputScaleH.value);
});

// --- PRESETS ---
const presetSelect = $("preset-select");
function loadPresetList() {
  const presets = store.get("impo:presets", {});
  const current = presetSelect.value;
  presetSelect.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());
  Object.keys(presets)
    .sort((a, b) => a.localeCompare(b))
    .forEach((name) => {
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      presetSelect.appendChild(o);
    });
  if (current in presets) presetSelect.value = current;
}
presetSelect.addEventListener("change", () => {
  const presets = store.get("impo:presets", {});
  const p = presets[presetSelect.value];
  if (!p) return;
  writeSettings(p);
  settingsChanged();
});
$("btn-preset-save").addEventListener("click", () => {
  const name = (prompt(t("presetName"), presetSelect.value || "") || "").trim();
  if (!name) return;
  const presets = store.get("impo:presets", {});
  presets[name] = readSettings();
  store.set("impo:presets", presets);
  loadPresetList();
  presetSelect.value = name;
  showToast(t("presetSaved", name), "info");
});
$("btn-preset-delete").addEventListener("click", () => {
  const name = presetSelect.value;
  if (!name) return;
  const presets = store.get("impo:presets", {});
  delete presets[name];
  store.set("impo:presets", presets);
  presetSelect.value = "";
  loadPresetList();
  showToast(t("presetDeleted", name), "info");
});
$("btn-reset").addEventListener("click", () => {
  writeSettings(DEFAULTS);
  presetSelect.value = "";
  settingsChanged();
  showToast(t("resetDone"), "info");
});

// --- WORKSPACE STATE ---
let currentFiles = [];
let currentBlobUrl = null;
let currentFileName = "";

const previewModal = $("preview-modal");
const previewIframe = $("preview-iframe");
const progressOverlay = $("progress-overlay");
const progressTitle = $("progress-title");
const progressDetail = $("progress-detail");
const progressBar = $("progress-bar");
const isWorkspaceOpen = () => previewModal.classList.contains("open");

function closeWorkspace() {
  previewModal.classList.remove("open");
  currentFiles = [];
  setTimeout(() => (previewIframe.src = ""), 300);
}
$("btn-modal-close").addEventListener("click", closeWorkspace);

function download() {
  if (!currentBlobUrl) return;
  const a = document.createElement("a");
  a.href = currentBlobUrl;
  a.download = currentFileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
$("btn-modal-download").addEventListener("click", download);

document.addEventListener("keydown", (e) => {
  if (!isWorkspaceOpen()) return;
  if (e.key === "Escape" && !progressOverlay.classList.contains("open")) closeWorkspace();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    download();
  }
});

// --- RENDER TRIGGERING ---
let renderTimer = null;
function settingsChanged() {
  refreshUi();
  store.set("impo:last", readSettings());
  if (isWorkspaceOpen() && currentFiles.length > 0) {
    // Short debounce so typing a number or dragging a slider renders once.
    clearTimeout(renderTimer);
    renderTimer = setTimeout(triggerRenderEngine, 250);
  }
}
settingsRoot.addEventListener("change", (e) => {
  if (e.target.id === "preset-select") return;
  if (e.target.id === "imposition-profile" && !e.target.value.startsWith("cutstack"))
    $("vdp-toggle").checked = false;
  settingsChanged();
});
settingsRoot.addEventListener("input", (e) => {
  if (e.target.type === "range") updateSliderText();
});

const worker = new Worker("worker.js");
let renderSeq = 0;

async function triggerRenderEngine() {
  const seq = ++renderSeq;
  progressTitle.textContent = t("starting");
  progressDetail.textContent = t("startingDetail");
  progressBar.style.width = "0%";
  progressOverlay.classList.add("open");

  const filePayload = [];
  for (const file of currentFiles) {
    filePayload.push({ name: file.name, type: file.type, buffer: await file.arrayBuffer() });
  }
  if (seq !== renderSeq) return; // a newer render has started

  const v = (id) => $(id).value;
  const n = (id) => parseFloat($(id).value) || 0;
  const c = (id) => $(id).checked;

  const params = {
    lang,
    profileSelection: v("imposition-profile"),
    sheetSelection: v("sheet-size"),
    customSheetW: n("input-sheet-w"),
    customSheetH: n("input-sheet-h"),
    sheetMargin: n("input-sheet-margin"),
    orientSelection: v("sheet-orient"),
    rotateMode: v("rotate-mode"),
    isNestingMode: c("mode-toggle"),
    isDuplexMode: c("duplex-toggle"),
    flipEdge: v("flip-edge"),
    sigSheets: parseInt(v("input-sig-sheets")) || 1,
    bookletUp: v("booklet-up"),
    creep: n("input-creep"),
    backOffsetX: n("input-back-x"),
    backOffsetY: n("input-back-y"),
    addSlug: c("slug-toggle"),
    addCropMarks: c("crops-toggle"),
    forceScale: c("scale-toggle"),
    scaleIncludesBleed: c("scale-bleed-toggle"),
    userBleed: n("slider-bleed"),
    userGutter: n("slider-gutter"),
    userCropLen: n("slider-crop-len"),
    userCropGap: n("slider-crop-gap"),
    targetW: n("input-scale-w"),
    targetH: n("input-scale-h"),
    vdpActive: c("vdp-toggle"),
    vdpStart: parseInt(v("input-vdp-start")) || 0,
    vdpEnd: parseInt(v("input-vdp-end")) || 0,
    vdpPrefix: v("input-vdp-prefix"),
    vdpPad: parseInt(v("input-vdp-pad")) || 0,
    vdpX: n("input-vdp-x"),
    vdpY: n("input-vdp-y"),
    vdpActive2: c("vdp2-toggle"),
    vdpX2: n("input-vdp-x2"),
    vdpY2: n("input-vdp-y2"),
    vdpFontSize: parseInt(v("slider-vdp-font")) || 12,
    vdpFontFamily: v("select-vdp-font"),
    vdpFontColor: v("input-vdp-color"),
  };

  worker.postMessage(
    { files: filePayload, params },
    filePayload.map((f) => f.buffer),
  );
}

// --- WORKER RESPONSES ---
worker.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === "progress") {
    progressTitle.textContent = msg.title;
    progressDetail.textContent = msg.detail;
    progressBar.style.width = `${msg.percent}%`;
  } else if (msg.type === "boxDetection") {
    if (msg.bleedMargin > 0) {
      const slider = $("slider-bleed");
      if (parseFloat(slider.value) !== msg.bleedMargin) {
        slider.value = msg.bleedMargin;
        showToast(t("bleedFound", msg.bleedMargin), "info");
      }
      $("scale-bleed-toggle").checked = true;
      if (!$("scale-toggle").checked) {
        inputScaleW.value = msg.trimW;
        inputScaleH.value = msg.trimH;
      }
      refreshUi();
    }
  } else if (msg.type === "fileInfo") {
    $("info-original-size").textContent = `${msg.w} × ${msg.h} mm`;
    $("info-page-count").textContent = msg.pages;
    if (!$("scale-toggle").checked) {
      inputScaleW.value = msg.w;
      inputScaleH.value = msg.h;
      scaleRatio = msg.w / msg.h;
    }
  } else if (msg.type === "layout") {
    $("info-per-sheet").textContent =
      `${msg.perSheet} (${msg.cols}×${msg.rows})` + (msg.rotated ? ` · ${t("rotated")}` : "");
    $("info-sheets").textContent = `${msg.sheets} · ${msg.sheetW}×${msg.sheetH}`;
    $("info-usage").textContent = `${msg.usage}%`;
    const fill = $("usage-bar-fill");
    fill.style.width = `${Math.min(100, msg.usage)}%`;
    fill.className = msg.usage >= 75 ? "good" : msg.usage >= 50 ? "ok" : "low";
  } else if (msg.type === "success") {
    progressOverlay.classList.remove("open");
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    const blob = new Blob([msg.pdfBytes], { type: "application/pdf" });
    currentBlobUrl = URL.createObjectURL(blob);
    currentFileName = msg.fileName;
    $("preview-title").textContent = msg.fileName;
    previewIframe.src = currentBlobUrl;
    if (!isWorkspaceOpen()) previewModal.classList.add("open");
  } else if (msg.type === "error") {
    progressOverlay.classList.remove("open");
    showToast(t("errorPrefix") + msg.message, "error");
  }
};

// --- FILE INPUT: drop zone, click to browse, drop on workspace ---
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
function acceptFiles(fileList) {
  const files = Array.from(fileList).filter((f) => ACCEPTED.includes(f.type));
  if (files.length === 0) {
    showToast(t("badFiles"), "error");
    return;
  }
  currentFiles = files;
  $("info-original-size").textContent = t("analyzing");
  $("info-page-count").textContent = "--";
  triggerRenderEngine();
}

const zoneUniversal = $("zone-universal");
const fileInput = $("file-input");
["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
  document.body.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
  }),
);
["dragenter", "dragover"].forEach((ev) =>
  zoneUniversal.addEventListener(ev, () => zoneUniversal.classList.add("hover")),
);
["dragleave", "drop"].forEach((ev) =>
  zoneUniversal.addEventListener(ev, () => zoneUniversal.classList.remove("hover")),
);
zoneUniversal.addEventListener("drop", (e) => acceptFiles(e.dataTransfer.files));
// Dropping onto the open workspace swaps the file without closing it.
previewModal.addEventListener("drop", (e) => acceptFiles(e.dataTransfer.files));

zoneUniversal.addEventListener("click", () => fileInput.click());
zoneUniversal.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
$("btn-change-file").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) acceptFiles(fileInput.files);
  fileInput.value = "";
});

// --- STARTUP ---
const last = store.get("impo:last", null);
if (last) writeSettings(last);
loadPresetList();
applyLanguage();
refreshUi();
