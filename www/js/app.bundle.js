(() => {
  // src/app/constants.js
  var CLP_PUBLIC_API = "https://api.clp.com.hk/evcharger/list";
  var CLP_TARIFF_FALLBACK = "./data/clp-tariff.json";
  var HKE_TARIFF_FALLBACK = "./data/hke-tariff.json";
  var TENANT_REFERENCE_RATE = 1.6;
  var CLP_TARIFF_ENDPOINTS = [
    "https://api.clp.com.hk/tariff/residential",
    "https://api.clp.com.hk/tariff/current",
    "https://api.clp.com.hk/residential/tariff",
    "https://api.clp.com.hk/ts1/ms/website/billCalculator/getResidentialTariff"
  ];
  var SAVED_APPLIANCES_KEY = "hk_saved_appliances_v1";
  var HOME_LIBRARY_KEY = "hk_home_library_v1";
  var HOUSEHOLD_PROVIDER_KEY = "hk_household_provider_v1";
  var CLP_BILL_REFERENCE_KEY = "hk_clp_bill_reference_v1";
  var LOOKUP_WORKER_URL_KEY = "hk_lookup_worker_url_v1";
  var LOOKUP_WORKER_URL_DEFAULT = "https://hk-appliance-lookup.ralhkt.workers.dev";

  // src/app/clp-tariff-service.js
  var CLPTariffService = class {
    constructor() {
      this.tariff = null;
      this.apiConnected = false;
      this.apiCheckedAt = null;
    }
    async verifyClpPublicApi() {
      const response = await fetch(CLP_PUBLIC_API, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`CLP API HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload.code !== 200 || !payload.data) {
        throw new Error("CLP API returned unexpected payload");
      }
      this.apiConnected = true;
      this.apiCheckedAt = /* @__PURE__ */ new Date();
      return payload;
    }
    async tryLiveTariffEndpoints() {
      for (const url of CLP_TARIFF_ENDPOINTS) {
        try {
          const response = await fetch(url, {
            headers: { Accept: "application/json" },
            cache: "no-store"
          });
          if (!response.ok) continue;
          const payload = await response.json();
          const parsed = this.parseTariffPayload(payload);
          if (parsed) {
            parsed.source = "CLP Public API";
            parsed.sourceUrl = url;
            return parsed;
          }
        } catch (_) {
        }
      }
      return null;
    }
    parseTariffPayload(payload) {
      const data = payload?.data ?? payload;
      if (!data || typeof data !== "object") return null;
      const net = Number(
        data.netTariff ?? data.net_tariff ?? data.averageNetTariff ?? data.residential?.netTariff ?? data.residential?.net_tariff
      );
      const basic = Number(data.basicTariff ?? data.basic_tariff ?? data.residential?.basicTariff);
      const fuel = Number(data.fuelCharge ?? data.fuel_charge ?? data.residential?.fuelCharge);
      if (!Number.isFinite(net) || net <= 0) return null;
      const toHkd = (value) => value > 10 ? value / 100 : value;
      return {
        provider: "CLP Power Hong Kong Limited",
        effectiveDate: data.effectiveDate ?? data.effective_date ?? null,
        residential: {
          netTariff: toHkd(net),
          basicTariff: Number.isFinite(basic) ? toHkd(basic) : null,
          fuelCharge: Number.isFinite(fuel) ? toHkd(fuel) : null
        },
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    async fetchFallbackTariff() {
      const response = await fetch(CLP_TARIFF_FALLBACK, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Tariff fallback HTTP ${response.status}`);
      }
      return response.json();
    }
    async fetchLatestTariff() {
      await this.verifyClpPublicApi();
      const liveTariff = await this.tryLiveTariffEndpoints();
      if (liveTariff) {
        this.tariff = liveTariff;
        return liveTariff;
      }
      const fallback = await this.fetchFallbackTariff();
      this.tariff = {
        ...fallback,
        source: `${fallback.source} (official tariff data)`,
        apiVerified: true,
        apiEndpoint: CLP_PUBLIC_API,
        apiCheckedAt: this.apiCheckedAt?.toISOString() ?? null
      };
      return this.tariff;
    }
  };

  // src/app/home-library-store.js
  function tariffs() {
    return globalThis.HK_PROGRESSIVE_TARIFFS ?? {};
  }
  var HomeLibraryStore = class {
    constructor() {
      this.memoryState = null;
      this.cloudAvailable = false;
      this.cloudPlugin = null;
      this.cloudSyncing = false;
      this.onCloudUpdate = null;
    }
    getCloudPlugin() {
      if (!window.Capacitor?.isNativePlatform?.()) return null;
      if (!this.cloudPlugin && window.Capacitor?.isPluginAvailable?.("ICloudSync")) {
        try {
          this.cloudPlugin = window.Capacitor.registerPlugin("ICloudSync");
        } catch {
          this.cloudPlugin = null;
        }
      }
      return this.cloudPlugin;
    }
    async initCloudSync(onUpdated) {
      this.onCloudUpdate = onUpdated;
      const plugin = this.getCloudPlugin();
      if (!plugin) return false;
      try {
        const { available } = await plugin.isAvailable();
        this.cloudAvailable = Boolean(available);
        if (!this.cloudAvailable) return false;
        await plugin.synchronize?.();
        await this.mergeFromCloud();
        await plugin.addListener("change", () => {
          this.handleCloudChange();
        });
        return true;
      } catch (err) {
        console.warn("iCloud sync unavailable", err);
        this.cloudAvailable = false;
        return false;
      }
    }
    async handleCloudChange() {
      if (this.cloudSyncing) return;
      const changed = await this.mergeFromCloud();
      if (changed && this.onCloudUpdate) {
        this.onCloudUpdate();
      }
    }
    async pushToCloud(state) {
      const plugin = this.getCloudPlugin();
      if (!this.cloudAvailable || !plugin) return;
      try {
        await plugin.setString({
          key: HOME_LIBRARY_KEY,
          value: JSON.stringify(state)
        });
      } catch (err) {
        console.warn("iCloud push failed", err);
      }
    }
    async pullCloudState() {
      const plugin = this.getCloudPlugin();
      if (!this.cloudAvailable || !plugin) return null;
      try {
        await plugin.synchronize?.();
        const result = await plugin.getString({ key: HOME_LIBRARY_KEY });
        if (!result?.value) return null;
        return this.normalizeState(JSON.parse(result.value));
      } catch {
        return null;
      }
    }
    getLastModified(state) {
      if (!state?.lastModified) return 0;
      const parsed = Date.parse(state.lastModified);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    readLocalState() {
      try {
        const raw = localStorage.getItem(HOME_LIBRARY_KEY);
        if (!raw) return null;
        return this.normalizeState(JSON.parse(raw));
      } catch {
        return null;
      }
    }
    async mergeFromCloud() {
      if (!this.cloudAvailable) return false;
      this.cloudSyncing = true;
      try {
        const cloudState = await this.pullCloudState();
        const localState = this.readLocalState();
        if (!cloudState && !localState) return false;
        let winner = null;
        let pushCloud = false;
        if (!cloudState) {
          winner = localState;
          pushCloud = true;
        } else if (!localState) {
          winner = cloudState;
        } else {
          const cloudTime = this.getLastModified(cloudState);
          const localTime = this.getLastModified(localState);
          if (cloudTime > localTime) {
            winner = cloudState;
          } else if (localTime > cloudTime) {
            winner = localState;
            pushCloud = true;
          } else {
            winner = localState;
          }
        }
        const memoryTime = this.memoryState ? this.getLastModified(this.memoryState) : 0;
        const winnerTime = this.getLastModified(winner);
        if (this.memoryState && winnerTime <= memoryTime) {
          return false;
        }
        this.memoryState = winner;
        try {
          localStorage.setItem(HOME_LIBRARY_KEY, JSON.stringify(winner));
        } catch {
        }
        if (pushCloud) {
          await this.pushToCloud(winner);
        }
        return true;
      } finally {
        this.cloudSyncing = false;
      }
    }
    createHome(libraryName, location = "", provider = "clp") {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      return {
        id: `home_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        libraryName: libraryName.trim() || "\u6211\u7684\u96FB\u5668\u5EAB",
        location: location.trim(),
        provider: tariffs()[provider] ? provider : "clp",
        appliances: [],
        createdAt: now,
        updatedAt: now
      };
    }
    loadState() {
      if (this.memoryState?.homes?.length) {
        return this.normalizeState(this.memoryState);
      }
      try {
        const raw = localStorage.getItem(HOME_LIBRARY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.homes?.length) {
            return this.normalizeState(parsed);
          }
        }
      } catch {
      }
      return this.normalizeState(this.migrateLegacyState());
    }
    normalizeState(state) {
      const next = {
        activeHomeId: state?.activeHomeId,
        homes: Array.isArray(state?.homes) ? state.homes : []
      };
      if (!next.homes.length) {
        const home = this.createHome("\u6211\u7684\u96FB\u5668\u5EAB", "");
        next.homes = [home];
        next.activeHomeId = home.id;
      }
      if (!next.homes.some((home) => home.id === next.activeHomeId)) {
        next.activeHomeId = next.homes[0].id;
      }
      next.homes = next.homes.map((home) => ({
        appliances: [],
        provider: "clp",
        libraryName: "\u6211\u7684\u96FB\u5668\u5EAB",
        location: "",
        ...home,
        appliances: Array.isArray(home.appliances) ? home.appliances : []
      }));
      return next;
    }
    migrateLegacyState() {
      let appliances = [];
      let provider = "clp";
      try {
        const legacy = localStorage.getItem(SAVED_APPLIANCES_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          appliances = Array.isArray(parsed) ? parsed : [];
        }
        const legacyProvider = localStorage.getItem(HOUSEHOLD_PROVIDER_KEY);
        if (legacyProvider && tariffs()[legacyProvider]) {
          provider = legacyProvider;
        }
      } catch {
        appliances = [];
      }
      const home = this.createHome("\u6211\u7684\u96FB\u5668\u5EAB", "", provider);
      home.appliances = appliances;
      const state = { activeHomeId: home.id, homes: [home] };
      this.persist(state);
      return state;
    }
    persist(state, options = {}) {
      const normalized = this.normalizeState(state);
      normalized.lastModified = (/* @__PURE__ */ new Date()).toISOString();
      this.memoryState = normalized;
      try {
        localStorage.setItem(HOME_LIBRARY_KEY, JSON.stringify(normalized));
      } catch {
      }
      if (!options.skipCloud && this.cloudAvailable) {
        this.pushToCloud(normalized);
      }
      return normalized;
    }
    getHomes() {
      return this.loadState().homes;
    }
    getActiveHomeId() {
      return this.loadState().activeHomeId;
    }
    getActiveHome() {
      const state = this.loadState();
      return state.homes.find((home) => home.id === state.activeHomeId) || state.homes[0];
    }
    setActiveHome(id) {
      const state = this.loadState();
      if (!state.homes.some((home) => home.id === id)) return state;
      state.activeHomeId = id;
      this.persist(state);
      return state;
    }
    addHome(libraryName, location = "", provider = "clp") {
      const state = this.loadState();
      const home = this.createHome(libraryName, location, provider);
      state.homes.unshift(home);
      state.activeHomeId = home.id;
      this.persist(state);
      return home;
    }
    updateHome(id, patch) {
      const state = this.loadState();
      const index = state.homes.findIndex((home) => home.id === id);
      if (index === -1) return null;
      state.homes[index] = {
        ...state.homes[index],
        ...patch,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.persist(state);
      return state.homes[index];
    }
    removeHome(id) {
      const state = this.loadState();
      if (state.homes.length <= 1) return false;
      state.homes = state.homes.filter((home) => home.id !== id);
      if (state.activeHomeId === id) {
        state.activeHomeId = state.homes[0].id;
      }
      this.persist(state);
      return true;
    }
    loadAppliances(homeId = null) {
      const home = homeId ? this.getHomes().find((entry) => entry.id === homeId) : this.getActiveHome();
      return home?.appliances || [];
    }
    add(item, homeId = null) {
      const state = this.loadState();
      const targetId = homeId || state.activeHomeId;
      const home = state.homes.find((entry) => entry.id === targetId);
      if (!home) return [];
      home.appliances.unshift(item);
      home.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.persist(state);
      return home.appliances;
    }
    update(id, patch, homeId = null) {
      const state = this.loadState();
      const targetId = homeId || state.activeHomeId;
      const home = state.homes.find((entry) => entry.id === targetId);
      if (!home) return [];
      const index = home.appliances.findIndex((item) => item.id === id);
      if (index === -1) return home.appliances;
      home.appliances[index] = {
        ...home.appliances[index],
        ...patch,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      home.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.persist(state);
      return home.appliances;
    }
    remove(id, homeId = null) {
      const state = this.loadState();
      const targetId = homeId || state.activeHomeId;
      const home = state.homes.find((entry) => entry.id === targetId);
      if (!home) return [];
      home.appliances = home.appliances.filter((item) => item.id !== id);
      home.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.persist(state);
      return home.appliances;
    }
  };

  // src/app/label-ocr-service.js
  function parser() {
    return globalThis.EnergyLabelParser;
  }
  var LabelOCRService = class {
    constructor() {
      this.engWorker = null;
      this.engWorkerPromise = null;
      this.chiWorker = null;
      this.mlKitPlugin = null;
      this.lastProgressAt = 0;
    }
    getMLKitPlugin() {
      if (!window.Capacitor?.isNativePlatform?.()) return null;
      if (!this.mlKitPlugin) {
        this.mlKitPlugin = window.Capacitor.registerPlugin("CapacitorPluginMlKitTextRecognition");
      }
      return this.mlKitPlugin;
    }
    warmup() {
      if (this.getMLKitPlugin()) return;
      if (!this.engWorkerPromise) {
        this.engWorkerPromise = this.ensureEngWorker().catch(() => null);
      }
    }
    reportProgress(onProgress, pct, label) {
      if (!onProgress) return;
      const now = Date.now();
      if (pct < 100 && now - this.lastProgressAt < 180) return;
      this.lastProgressAt = now;
      onProgress(pct, label);
    }
    async loadTesseract() {
      if (window.Tesseract) return;
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Failed to load OCR engine"));
        document.head.appendChild(script);
      });
    }
    async ensureEngWorker() {
      if (this.engWorker) return this.engWorker;
      await this.loadTesseract();
      const worker = await Tesseract.createWorker("eng", 1, { logger: () => {
      } });
      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        tessedit_char_whitelist: "0123456789.kWhKWkwhAnnualEnergyConsumption\u5E74\u8017\u96FB\u91CF\u5343\u74E6\u6642/-"
      });
      this.engWorker = worker;
      return worker;
    }
    async ensureChiWorker() {
      if (this.chiWorker) return this.chiWorker;
      await this.loadTesseract();
      const worker = await Tesseract.createWorker("chi_tra", 1, { logger: () => {
      } });
      await worker.setParameters({ tessedit_pageseg_mode: "6" });
      this.chiWorker = worker;
      return worker;
    }
    fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Unable to read image"));
        reader.readAsDataURL(file);
      });
    }
    enhanceCanvas(ctx, width, height) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const boosted = Math.min(255, Math.max(0, (gray - 128) * 1.45 + 128));
        const binary = boosted > 145 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = binary;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    enhanceCanvasForMlKit(ctx, width, height) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const boosted = Math.min(255, Math.max(0, (gray - 110) * 1.25 + 118));
        data[i] = data[i + 1] = data[i + 2] = boosted;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    async preprocessImage(file, options = {}) {
      const forMlKit = Boolean(options.forMlKit);
      const dataUrl = await this.fileToDataUrl(file);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = forMlKit ? 1800 : 1200;
          const scale = Math.min(1, maxWidth / img.width);
          const width = Math.round(img.width * scale);
          const height = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, width, height);
          if (forMlKit) {
            this.enhanceCanvasForMlKit(ctx, width, height);
          } else {
            this.enhanceCanvas(ctx, width, height);
          }
          const quality = forMlKit ? 0.92 : 0.82;
          resolve({
            full: canvas.toDataURL("image/jpeg", quality),
            base64: canvas.toDataURL("image/jpeg", quality).split(",")[1]
          });
        };
        img.onerror = () => reject(new Error("Invalid image"));
        img.src = dataUrl;
      });
    }
    async recognizeNative(base64, onProgress) {
      const plugin = this.getMLKitPlugin();
      if (!plugin) return null;
      this.reportProgress(onProgress, 35, "\u4F7F\u7528\u539F\u751F OCR\u2026 Native OCR");
      const result = await plugin.detectText({ base64Image: base64 });
      this.reportProgress(onProgress, 90, "\u5206\u6790\u6A19\u7C64\u6587\u5B57\u2026 Parsing label");
      return {
        text: result.text || "",
        blocks: result.blocks || [],
        engine: "mlkit"
      };
    }
    async recognizeTesseract(imageDataUrl, onProgress, useChinese = false) {
      const worker = useChinese ? await this.ensureChiWorker() : await this.ensureEngWorker();
      const label = useChinese ? "\u4E2D\u6587 OCR\u2026 Chinese OCR" : "\u6578\u5B57 OCR\u2026 Number OCR";
      const { data: { text } } = await worker.recognize(imageDataUrl, {}, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            const pct = Math.round((message.progress || 0) * (useChinese ? 55 : 45));
            this.reportProgress(onProgress, 20 + pct, label);
          }
        }
      });
      return text;
    }
    mergeText(parts) {
      return parts.filter(Boolean).join("\n");
    }
    rankParsedResult(parsed, blocks = null) {
      if (!parsed?.kWh) return -1;
      const normalized = parser().normalize(parsed.rawText || "");
      const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
      const candidates = [
        ...parser().collectKwhCandidates(normalized, lines),
        ...parser().extractKwhFromBlocks(blocks)
      ];
      return candidates.filter((item) => item.value === parsed.kWh).sort((a, b) => b.score - a.score)[0]?.score || 0;
    }
    async recognize(file, onProgress) {
      this.lastProgressAt = 0;
      this.reportProgress(onProgress, 5, "\u8655\u7406\u5716\u7247\u2026 Processing image");
      const mlProcessed = await this.preprocessImage(file, { forMlKit: true });
      const tessProcessed = await this.preprocessImage(file, { forMlKit: false });
      let bestResult = null;
      let bestScore = -1;
      const consider = (payload) => {
        const parsed = parser().parse(payload.text, payload.blocks || null);
        const score = this.rankParsedResult(parsed, payload.blocks || null);
        if (score > bestScore || score === bestScore && (parsed.kWh || 0) > (bestResult?.parsed?.kWh || 0)) {
          bestScore = score;
          bestResult = { ...payload, parsed };
        }
      };
      const native = await this.recognizeNative(mlProcessed.base64, onProgress);
      if (native?.text) {
        consider({
          text: native.text,
          blocks: native.blocks,
          imageDataUrl: mlProcessed.full,
          engine: "mlkit"
        });
      }
      if (bestScore < 40 || (bestResult?.parsed?.kWh || 0) < 50) {
        this.reportProgress(onProgress, 55, "\u8F14\u52A9 OCR\u2026 Supplemental OCR");
        const engText = await this.recognizeTesseract(tessProcessed.full, onProgress, false);
        consider({
          text: this.mergeText([native?.text, engText]),
          blocks: native?.blocks || null,
          imageDataUrl: tessProcessed.full,
          engine: native?.text ? "mlkit+tesseract-eng" : "tesseract-eng"
        });
        if (bestScore < 40 || (bestResult?.parsed?.kWh || 0) < 50) {
          const chiText = await this.recognizeTesseract(tessProcessed.full, onProgress, true);
          consider({
            text: this.mergeText([native?.text, engText, chiText]),
            blocks: native?.blocks || null,
            imageDataUrl: tessProcessed.full,
            engine: native?.text ? "mlkit+tesseract-mixed" : "tesseract-mixed"
          });
        }
      }
      if (bestResult) {
        return {
          text: bestResult.text,
          blocks: bestResult.blocks || null,
          imageDataUrl: bestResult.imageDataUrl,
          engine: bestResult.engine
        };
      }
      return {
        text: "",
        blocks: null,
        imageDataUrl: mlProcessed.full,
        engine: "none"
      };
    }
  };

  // src/app/index.js
  Object.assign(globalThis, {
    CLP_PUBLIC_API,
    CLP_TARIFF_FALLBACK,
    HKE_TARIFF_FALLBACK,
    TENANT_REFERENCE_RATE,
    CLP_TARIFF_ENDPOINTS,
    SAVED_APPLIANCES_KEY,
    HOME_LIBRARY_KEY,
    HOUSEHOLD_PROVIDER_KEY,
    CLP_BILL_REFERENCE_KEY,
    LOOKUP_WORKER_URL_KEY,
    LOOKUP_WORKER_URL_DEFAULT,
    CLPTariffService,
    HomeLibraryStore,
    LabelOCRService
  });
})();
