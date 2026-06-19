function parser() {
    return globalThis.EnergyLabelParser;
}

export class LabelOCRService {
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
            this.mlKitPlugin = window.Capacitor.registerPlugin('CapacitorPluginMlKitTextRecognition');
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
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load OCR engine'));
            document.head.appendChild(script);
        });
    }

    async ensureEngWorker() {
        if (this.engWorker) return this.engWorker;
        await this.loadTesseract();
        const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
        await worker.setParameters({
            tessedit_pageseg_mode: '6',
            tessedit_char_whitelist: '0123456789.kWhKWkwhAnnualEnergyConsumption年耗電量千瓦時/-'
        });
        this.engWorker = worker;
        return worker;
    }

    async ensureChiWorker() {
        if (this.chiWorker) return this.chiWorker;
        await this.loadTesseract();
        const worker = await Tesseract.createWorker('chi_tra', 1, { logger: () => {} });
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        this.chiWorker = worker;
        return worker;
    }

    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Unable to read image'));
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
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, width, height);
                if (forMlKit) {
                    this.enhanceCanvasForMlKit(ctx, width, height);
                } else {
                    this.enhanceCanvas(ctx, width, height);
                }
                const quality = forMlKit ? 0.92 : 0.82;
                resolve({
                    full: canvas.toDataURL('image/jpeg', quality),
                    base64: canvas.toDataURL('image/jpeg', quality).split(',')[1]
                });
            };
            img.onerror = () => reject(new Error('Invalid image'));
            img.src = dataUrl;
        });
    }

    async recognizeNative(base64, onProgress) {
        const plugin = this.getMLKitPlugin();
        if (!plugin) return null;
        this.reportProgress(onProgress, 35, '使用原生 OCR… Native OCR');
        const result = await plugin.detectText({ base64Image: base64 });
        this.reportProgress(onProgress, 90, '分析標籤文字… Parsing label');
        return {
            text: result.text || '',
            blocks: result.blocks || [],
            engine: 'mlkit'
        };
    }

    async recognizeTesseract(imageDataUrl, onProgress, useChinese = false) {
        const worker = useChinese ? await this.ensureChiWorker() : await this.ensureEngWorker();
        const label = useChinese ? '中文 OCR… Chinese OCR' : '數字 OCR… Number OCR';
        const { data: { text } } = await worker.recognize(imageDataUrl, {}, {
            logger: (message) => {
                if (message.status === 'recognizing text') {
                    const pct = Math.round((message.progress || 0) * (useChinese ? 55 : 45));
                    this.reportProgress(onProgress, 20 + pct, label);
                }
            }
        });
        return text;
    }

    mergeText(parts) {
        return parts.filter(Boolean).join('\n');
    }

    rankParsedResult(parsed, blocks = null) {
        if (!parsed?.kWh) return -1;
        const normalized = parser().normalize(parsed.rawText || '');
        const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
        const candidates = [
            ...parser().collectKwhCandidates(normalized, lines),
            ...parser().extractKwhFromBlocks(blocks)
        ];
        return candidates
            .filter((item) => item.value === parsed.kWh)
            .sort((a, b) => b.score - a.score)[0]?.score || 0;
    }

    async recognize(file, onProgress) {
        this.lastProgressAt = 0;
        this.reportProgress(onProgress, 5, '處理圖片… Processing image');
        const mlProcessed = await this.preprocessImage(file, { forMlKit: true });
        const tessProcessed = await this.preprocessImage(file, { forMlKit: false });

        let bestResult = null;
        let bestScore = -1;

        const consider = (payload) => {
            const parsed = parser().parse(payload.text, payload.blocks || null);
            const score = this.rankParsedResult(parsed, payload.blocks || null);
            if (score > bestScore || (score === bestScore && (parsed.kWh || 0) > (bestResult?.parsed?.kWh || 0))) {
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
                engine: 'mlkit'
            });
        }

        if (bestScore < 40 || (bestResult?.parsed?.kWh || 0) < 50) {
            this.reportProgress(onProgress, 55, '輔助 OCR… Supplemental OCR');
            const engText = await this.recognizeTesseract(tessProcessed.full, onProgress, false);
            consider({
                text: this.mergeText([native?.text, engText]),
                blocks: native?.blocks || null,
                imageDataUrl: tessProcessed.full,
                engine: native?.text ? 'mlkit+tesseract-eng' : 'tesseract-eng'
            });

            if (bestScore < 40 || (bestResult?.parsed?.kWh || 0) < 50) {
                const chiText = await this.recognizeTesseract(tessProcessed.full, onProgress, true);
                consider({
                    text: this.mergeText([native?.text, engText, chiText]),
                    blocks: native?.blocks || null,
                    imageDataUrl: tessProcessed.full,
                    engine: native?.text ? 'mlkit+tesseract-mixed' : 'tesseract-mixed'
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
            text: '',
            blocks: null,
            imageDataUrl: mlProcessed.full,
            engine: 'none'
        };
    }
}
