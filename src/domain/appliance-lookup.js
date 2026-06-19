export const APPLIANCE_LOOKUP_CONFIDENCE = ['high', 'medium', 'low'];

export const APPLIANCE_CATEGORY_MAP = {
    refrigerator: [/refrigerat|fridge|雪櫃|冰箱/i],
    freezer: [/freezer|冷凍櫃/i],
    wine_cooler: [/wine\s*cool|酒櫃/i],
    room_ac_split: [/split\s*(type\s*)?ac|分體冷氣/i],
    room_ac_window: [/window\s*ac|窗口冷氣|窗機/i],
    room_ac_reverse: [/reverse\s*cycle|冷暖|heat\s*pump/i],
    room_ac: [/air\s*con|aircondit|冷氣|空調|空調機/i],
    fan: [/electric\s*fan|電風扇/i],
    air_purifier: [/air\s*purif|空氣淨化|空氣清新/i],
    dehumidifier: [/dehumid|抽濕|除濕/i],
    washing: [/washing\s*machine|洗衣機/i],
    washer_dryer: [/washer\s*dryer|洗衣乾衣/i],
    dryer: [/clothes\s*dryer|乾衣機/i],
    tv: [/television|\btv\b|電視/i],
    monitor: [/monitor|顯示器|螢幕/i],
    desktop_pc: [/desktop|\bpc\b|電腦主機/i],
    laptop: [/laptop|notebook|筆電|筆記本/i],
    microwave: [/microwave|微波爐/i],
    rice_cooker: [/rice\s*cook|電飯煲/i],
    electric_kettle: [/kettle|電熱水壺/i],
    dishwasher: [/dishwasher|洗碗機/i],
    water_heater: [/water\s*heater|熱水爐|儲水式/i],
    led_lamp: [/\bled\b|LED燈/i],
    ev_charger: [/ev\s*charg|充電樁/i]
};

export function normalizeLookupText(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function validateLookupInput(brand, model) {
    const b = normalizeLookupText(brand);
    const m = normalizeLookupText(model);
    if (b.length < 2) return { ok: false, message: '請輸入品牌（至少 2 個字）· Enter brand (min 2 chars)' };
    if (m.length < 2) return { ok: false, message: '請輸入型號（至少 2 個字）· Enter model (min 2 chars)' };
    if (`${b} ${m}`.length > 120) return { ok: false, message: '品牌＋型號過長 · Brand + model too long' };
    return { ok: true, brand: b, model: m };
}

export function buildGrokLookupPrompt(brand, model) {
    const validation = validateLookupInput(brand, model);
    if (!validation.ok) return '';

    const { brand: b, model: m } = validation;
    return [
        '請上網搜尋以下香港家用電器的年耗電量（kWh/年，MEELS 能源標籤優先）。',
        '優先來源：emsd.gov.hk、廠商香港官網、可信零售商規格頁。',
        '',
        `品牌 Brand: ${b}`,
        `型號 Model: ${m}`,
        '',
        '請只回覆一個 JSON 物件（不要 markdown、不要其他說明），格式如下：',
        '{',
        '  "annualKwh": <number 或 null>,',
        '  "applianceCategory": "<例如 refrigerator / room_ac / washing>",',
        '  "ratedHours": <number 或 null>,',
        '  "confidence": "high" | "medium" | "low",',
        '  "sourceUrl": "<最可靠來源網址或 null>",',
        '  "summary": "<一句中文說明>",',
        '  "summaryEn": "<one-line English summary>"',
        '}',
        '',
        'Search the web for annual electricity (kWh/year) for this Hong Kong appliance.',
        'Reply with JSON only, same schema as above.'
    ].join('\n');
}

export function inferApplianceType(categoryText, catalogKeys = []) {
    const text = normalizeLookupText(categoryText);
    if (!text) return 'custom';

    const allowed = new Set(catalogKeys);
    for (const [typeId, patterns] of Object.entries(APPLIANCE_CATEGORY_MAP)) {
        if (allowed.size && !allowed.has(typeId)) continue;
        if (patterns.some((pattern) => pattern.test(text))) return typeId;
    }

    const lowered = text.toLowerCase().replace(/\s+/g, '_');
    if (allowed.size && allowed.has(lowered)) return lowered;
    return 'custom';
}

export function extractKwhFromFreeText(text) {
    const normalized = String(text ?? '');
    const patterns = [
        /年耗電量[：:\s]*(\d{2,5}(?:\.\d+)?)\s*k?wh/i,
        /annual(?:\s+energy)?[：:\s]*(\d{2,5}(?:\.\d+)?)\s*k?wh/i,
        /(\d{2,5}(?:\.\d+)?)\s*kwh\s*\/\s*(?:年|year|yr)/i,
        /(\d{2,5}(?:\.\d+)?)\s*kwh/i
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match) {
            const annualKwh = Number(match[1]);
            if (Number.isFinite(annualKwh) && annualKwh >= 10) {
                return {
                    annualKwh,
                    applianceCategory: '',
                    confidence: 'low',
                    sourceUrl: null,
                    summary: '從文字抽取 kWh · Extracted from pasted text',
                    summaryEn: 'Extracted from pasted text'
                };
            }
        }
    }

    throw new Error('找不到 JSON 或 kWh 數值 · No JSON or kWh found in paste');
}

export function extractJsonFromModelText(text) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) throw new Error('Empty paste');

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;

    try {
        return JSON.parse(candidate);
    } catch {
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return JSON.parse(candidate.slice(start, end + 1));
        }
    }

    return extractKwhFromFreeText(trimmed);
}

export function parseLookupPayload(raw, catalogKeys = []) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('Empty lookup response');
    }

    const annualKwh = Number(raw.annualKwh ?? raw.annual_kwh ?? raw.kwh ?? raw.kWh);
    const ratedHours = Number(raw.ratedHours ?? raw.rated_hours ?? raw.labelRatedHours);
    const confidence = String(raw.confidence ?? 'low').toLowerCase();
    const normalizedConfidence = APPLIANCE_LOOKUP_CONFIDENCE.includes(confidence) ? confidence : 'low';

    return {
        annualKwh: Number.isFinite(annualKwh) && annualKwh > 0 ? annualKwh : null,
        applianceType: inferApplianceType(raw.applianceCategory ?? raw.applianceType ?? raw.category ?? '', catalogKeys),
        ratedHours: Number.isFinite(ratedHours) && ratedHours > 0 ? Math.round(ratedHours) : null,
        confidence: normalizedConfidence,
        sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : (raw.source_url ?? null),
        summary: normalizeLookupText(raw.summary) || '',
        summaryEn: normalizeLookupText(raw.summaryEn ?? raw.summary_en) || '',
        brand: normalizeLookupText(raw.brand),
        model: normalizeLookupText(raw.model)
    };
}

export function validateLookupResult(result, { minKwh = 10, maxKwh = 50000 } = {}) {
    if (!result?.annualKwh) {
        return { ok: false, message: '未能找到可靠的年耗電量 · Could not find annual kWh' };
    }
    if (result.annualKwh < minKwh || result.annualKwh > maxKwh) {
        return { ok: false, message: `年耗電量 ${result.annualKwh} kWh 似乎不合理 · kWh out of expected range` };
    }
    if (result.confidence === 'low') {
        return {
            ok: true,
            warn: true,
            message: '信心偏低，請核對 Grok 來源後再套用 · Low confidence — verify before applying'
        };
    }
    return { ok: true, warn: result.confidence === 'medium', message: '' };
}

export function formatLookupResultLabel(result) {
    if (!result?.annualKwh) return '—';
    const conf = result.confidence === 'high' ? '高' : result.confidence === 'medium' ? '中' : '低';
    return `${result.annualKwh} kWh/年 · 信心 ${conf}`;
}

export function extractTextFromXaiResponse(response) {
    if (!response || typeof response !== 'object') {
        throw new Error('Empty xAI response');
    }

    if (typeof response.output_text === 'string' && response.output_text.trim()) {
        return response.output_text.trim();
    }

    const chunks = [];
    for (const item of response.output ?? []) {
        if (item?.type === 'message' && Array.isArray(item.content)) {
            for (const part of item.content) {
                if (part?.type === 'output_text' && part.text) chunks.push(part.text);
                else if (typeof part?.text === 'string') chunks.push(part.text);
            }
        }
        if (typeof item?.text === 'string') chunks.push(item.text);
    }

    const text = chunks.join('\n').trim();
    if (!text) throw new Error('No text in xAI response');
    return text;
}

export function isLookupBillingError(message) {
    return /credit|license|licence|billing|prepaid|insufficient|quota|payment/i.test(String(message ?? ''));
}

export function formatLookupApiError(message) {
    const text = String(message ?? '').trim();
    if (isLookupBillingError(text)) {
        return 'xAI API 沒有餘額（Grok 聊天訂閱 ≠ API 點數）。請到 console.x.ai/billing 充值，或使用下方 Grok 備用 · No API credits (Grok chat ≠ API). Top up at console.x.ai/billing or use Grok fallback below';
    }
    return text || '查詢失敗 Lookup failed';
}

export function processLookupModelText(text, brand, model, catalogKeys = []) {
    const raw = extractJsonFromModelText(text);
    const parsed = parseLookupPayload(raw, catalogKeys);
    if (!parsed.brand) parsed.brand = normalizeLookupText(brand);
    if (!parsed.model) parsed.model = normalizeLookupText(model);
    const validation = validateLookupResult(parsed);
    return { parsed, validation };
}

if (typeof globalThis !== 'undefined') {
    globalThis.normalizeLookupText = normalizeLookupText;
    globalThis.buildGrokLookupPrompt = buildGrokLookupPrompt;
    globalThis.validateLookupInput = validateLookupInput;
    globalThis.parseLookupPayload = parseLookupPayload;
    globalThis.extractJsonFromModelText = extractJsonFromModelText;
    globalThis.validateLookupResult = validateLookupResult;
    globalThis.formatLookupResultLabel = formatLookupResultLabel;
    globalThis.inferApplianceType = inferApplianceType;
    globalThis.extractTextFromXaiResponse = extractTextFromXaiResponse;
    globalThis.processLookupModelText = processLookupModelText;
    globalThis.isLookupBillingError = isLookupBillingError;
    globalThis.formatLookupApiError = formatLookupApiError;
}