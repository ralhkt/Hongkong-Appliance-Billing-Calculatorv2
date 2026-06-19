const APPLIANCE_OCR_ORDER = [
    'washer_dryer', 'room_ac_reverse', 'room_ac_split', 'room_ac_window', 'room_ac',
    'refrigerator', 'freezer', 'wine_cooler', 'washing', 'dryer', 'dehumidifier', 'tv',
    'monitor', 'water_heater', 'instant_water_heater', 'induction', 'microwave',
    'rice_cooker', 'electric_kettle', 'oven', 'dishwasher', 'led_lamp', 'cfl', 'fan',
    'air_purifier', 'desktop_pc', 'laptop', 'router_nas', 'printer', 'exhaust_fan',
    'hair_dryer', 'iron', 'ev_charger'
];

class EnergyLabelParser {
    static catalog = {};
    static ocrOrder = [];

    static configure({ catalog, ocrOrder = APPLIANCE_OCR_ORDER }) {
        this.catalog = catalog;
        this.ocrOrder = ocrOrder;
    }

static normalize(text) {
    return text
        .replace(/\r/g, '\n')
        .replace(/[，、]/g, ',')
        .replace(/[：]/g, ':')
        .replace(/[（(]\s*/g, '(')
        .replace(/\s*[）)]/g, ')')
        .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[．]/g, '.')
        .replace(/(\d)[Oo](?=\d|kwh|千瓦|$)/gi, '$10')
        .replace(/(\d)[Ss](?=\d|kwh|千瓦|$)/g, '$15')
        .replace(/(\d)[Bb](?=\d)/g, '$18')
        .replace(/[lI|](?=\d)/g, '1')
        .replace(/(?<=\d)[lI|]/g, '1')
        .replace(/(\d)\s+(\d{1,2})(?=\s*k?wh|\s*千瓦|$)/gi, '$1$2')
        .replace(/[，]/g, '');
}

static parseNumbersFromText(text) {
    const cleaned = this.normalize(text)
        .replace(/,/g, '')
        .replace(/(\d{1,3})[.·](\d{3})\b/g, '$1$2');
    const results = [];
    const seen = new Set();
    const patterns = [
        /(\d{2,4})\s*k?\s*wh/gi,
        /\b(\d{2,4}(?:\.\d+)?)\b/g
    ];
    patterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(cleaned)) !== null) {
            const value = parseFloat(match[1]);
            if (!Number.isFinite(value) || seen.has(value)) continue;
            seen.add(value);
            results.push({ value, context: cleaned.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20) });
        }
    });
    return results;
}

static lineBoxMetrics(line) {
    const box = line?.boundingBox || {};
    const top = Number(box.top) || 0;
    const bottom = Number(box.bottom) || 0;
    const left = Number(box.left) || 0;
    const right = Number(box.right) || 0;
    return {
        cy: (top + bottom) / 2,
        cx: (left + right) / 2,
        height: Math.abs(top - bottom) || 1,
        width: Math.abs(right - left) || 1
    };
}

static extractLines(text, blocks) {
    const lines = [];
    blocks?.forEach((block) => {
        block.lines?.forEach((line) => {
            const lineText = line.elements?.map((el) => el.text).join('').trim();
            if (lineText) lines.push(lineText);
        });
    });
    if (lines.length) return lines;
    return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

static scoreKwh(value, context) {
    if (!Number.isFinite(value) || value <= 0 || value >= 50000) return -1;
    let score = 0;
    const hasKwhMarker = /kwh|千瓦時|kilowatt/i.test(context);
    const hasAnnualMarker = /年耗電量|annual\s*energy|每年耗電|耗電量/i.test(context);
    const isGradeContext = /(?:能源效益|efficiency|效益級|[1-5]\s*級|grade\s*[1-5])/i.test(context);

    if (value <= 5 && isGradeContext && !hasKwhMarker && !hasAnnualMarker) return -1;
    if (hasAnnualMarker) score += 45;
    if (hasKwhMarker) score += 35;
    if (/耗電|energy|consumption/i.test(context)) score += 18;
    if (/年|annual|year/i.test(context)) score += 12;
    if (value >= 80 && value <= 3000) score += 25;
    if (value >= 150 && value <= 900) score += 15;
    if (Number.isInteger(value) && value >= 100 && value <= 999) score += 12;
    if (value < 50) score -= 35;
    if (value <= 10) score -= 45;
    if (/級|grade|效益/i.test(context) && value <= 5) score -= 40;
    if (/小時|hours?|hrs?/i.test(context) && !hasKwhMarker) score -= 18;
    if (value === 1200 || value === 8760) score -= 6;
    return score;
}

static pickBestKwh(candidates) {
    if (!candidates.length) return null;
    const viable = candidates.filter((c) => c.score > 0);
    if (!viable.length) return null;
    viable.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.value >= 50 && b.value < 50) return -1;
        if (b.value >= 50 && a.value < 50) return 1;
        return b.value - a.value;
    });
    return viable[0].value;
}

static extractKwhFromBlocks(blocks) {
    const candidates = [];
    const lines = [];
    blocks?.forEach((block) => {
        block.lines?.forEach((line) => {
            const text = line.text?.trim();
            if (!text) return;
            lines.push({ text, ...this.lineBoxMetrics(line) });
        });
    });
    if (!lines.length) return candidates;

    const anchors = lines.filter((line) => /年耗電量|annual\s*energy\s*consumption|耗電量/i.test(line.text));
    const avgHeight = lines.reduce((sum, line) => sum + line.height, 0) / lines.length;

    anchors.forEach((anchor) => {
        lines.forEach((line) => {
            const dy = Math.abs(line.cy - anchor.cy);
            const dx = Math.abs(line.cx - anchor.cx);
            if (dy > Math.max(120, avgHeight * 5)) return;
            if (dx > Math.max(260, anchor.width * 3)) return;
            const context = `${anchor.text} ${line.text} 年耗電量 Annual Energy Consumption kWh`;
            this.parseNumbersFromText(line.text).forEach(({ value }) => {
                let score = this.scoreKwh(value, context);
                score += Math.max(0, 24 - dy / 8);
                if (line.height >= avgHeight * 1.1) score += 12;
                if (score > 0) candidates.push({ value, score });
            });
        });
    });

    lines.forEach((line) => {
        const compact = line.text.replace(/\s/g, '');
        if (/^\d{2,4}$/.test(compact)) {
            const value = parseInt(compact, 10);
            let score = this.scoreKwh(value, `${line.text} kWh 年耗電量`);
            score += Math.min(18, line.height / Math.max(avgHeight, 1) * 8);
            if (score > 0) candidates.push({ value, score });
        }
        if (/^\d{2,4}\s*k?wh$/i.test(compact) || /^\d{2,4}千瓦時$/.test(compact)) {
            const value = parseInt(compact, 10);
            const score = this.scoreKwh(value, `${line.text} kWh`);
            if (score > 0) candidates.push({ value, score: score + 20 });
        }
    });

    return candidates;
}

static collectKwhCandidates(text, lines) {
    const candidates = [];
    const add = (value, context) => {
        const score = this.scoreKwh(value, context);
        if (score > 0) candidates.push({ value, score });
    };

    const patterns = [
        /年耗電量[^0-9]{0,32}(\d{2,4}(?:\.\d+)?)\s*k?\s*wh/i,
        /annual\s*energy\s*consumption[^0-9]{0,32}(\d{2,4}(?:\.\d+)?)/i,
        /每年耗電[^0-9]{0,24}(\d{2,4}(?:\.\d+)?)/i,
        /耗電量[^0-9]{0,24}(\d{2,4}(?:\.\d+)?)\s*k?\s*wh/i,
        /(\d{2,4}(?:\.\d+)?)\s*kwh/i,
        /(\d{2,4}(?:\.\d+)?)\s*千瓦時/i
    ];

    for (const pattern of patterns) {
        const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
        let match;
        while ((match = globalPattern.exec(text)) !== null) {
            add(parseFloat(match[1]), match[0]);
        }
    }

    lines.forEach((line, index) => {
        const context = `${lines[index - 1] || ''} ${line} ${lines[index + 1] || ''}`;
        if (/耗電|energy|kwh|千瓦|consumption/i.test(context)) {
            this.parseNumbersFromText(line).forEach(({ value }) => add(value, context));
        }
        if (/kwh|千瓦時/i.test(line)) {
            this.parseNumbersFromText(line).forEach(({ value }) => add(value, `${line} kWh`));
        }
    });

    return candidates;
}

static parse(text, blocks = null) {
    const normalized = this.normalize(text);
    const lines = this.extractLines(normalized, blocks);
    const result = {
        kWh: null,
        defaultHours: null,
        productType: null,
        suggestedUsageHours: null,
        grade: null,
        confidence: 'low',
        engine: 'unknown',
        rawText: text
    };

    for (const typeId of this.ocrOrder) {
        const spec = this.catalog[typeId];
        if (!spec?.ocrRegex?.test(normalized)) continue;
        result.productType = typeId;
        result.defaultHours = spec.labelRatedHours;
        result.suggestedUsageHours = spec.suggestedUsageHours;
        break;
    }

    const gradeMatch = normalized.match(/(?:能源效益|efficiency)\s*(?:級別|級|grade)?\s*[:：]?\s*([1-5])\s*(?:級|grade)?/i)
        || normalized.match(/\b([1-5])\s*(?:級|grade)/i);
    if (gradeMatch) result.grade = parseInt(gradeMatch[1], 10);

    const kwhCandidates = [
        ...this.collectKwhCandidates(normalized, lines),
        ...this.extractKwhFromBlocks(blocks)
    ];
    result.kWh = this.pickBestKwh(kwhCandidates);

    const hourPatterns = [
        /(\d{3,4})\s*(?:小時|hours?|hrs?)/i,
        /額定[^0-9]{0,20}(\d{3,4})/i,
        /rated[^0-9]{0,20}(\d{3,4})/i
    ];
    for (const pattern of hourPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            const value = parseInt(match[1], 10);
            if (value >= 100 && value <= 8760) {
                result.defaultHours = value;
                break;
            }
        }
    }
    if (!result.defaultHours) {
        const fallbackType = result.productType && this.catalog[result.productType]
            ? result.productType
            : 'custom';
        result.defaultHours = this.catalog[fallbackType].labelRatedHours;
    }

    if (result.kWh) {
        const topScore = kwhCandidates
            .sort((a, b) => b.score - a.score)[0]?.score || 0;
        if (topScore >= 30) result.confidence = 'high';
        else if (topScore >= 18) result.confidence = 'medium';
        else result.confidence = 'low';
    }

    return result;
}
}

if (typeof globalThis !== 'undefined') {
    globalThis.APPLIANCE_OCR_ORDER = APPLIANCE_OCR_ORDER;
    globalThis.EnergyLabelParser = EnergyLabelParser;
}
