import { inferApplianceType, normalizeLookupText, parseLookupPayload, validateLookupResult } from './appliance-lookup.js';

export const MEELS_SOURCE_URL = 'https://www.emsd.gov.hk/energylabel/';

export const MEELS_BRAND_ALIASES = {
    daikin: ['daikin', '大金', '大金冷氣', '大金空调'],
    panasonic: ['panasonic', '樂聲', '樂聲牌', '松下', 'national'],
    samsung: ['samsung', '三星'],
    siemens: ['siemens', '西門子', '西门子'],
    lg: ['lg', '樂金', '乐金'],
    hitachi: ['hitachi', '日立'],
    midea: ['midea', '美的'],
    gree: ['gree', '格力'],
    mitsubishi: ['mitsubishi', '三菱', '三菱電機', '三菱电机'],
    toshiba: ['toshiba', '東芝', '东芝'],
    whirlpool: ['whirlpool', '惠而浦'],
    bosch: ['bosch', '博世'],
    sharp: ['sharp', '聲寶', '声宝'],
    haier: ['haier', '海爾', '海尔'],
    canson: ['canson', '金松'],
    general: ['general', '珍寶', '珍宝']
};

export function cleanTrailingPartialCjk(value) {
    return String(value ?? '')
        .replace(/[,，、]\s*[\u4e00-\u9fff]{1,6}$/u, '')
        .replace(/\s*[（(][\u4e00-\u9fff]{1,6}[)）]?$/u, '')
        .trim();
}

export function normalizeMeelsToken(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[（(]hk[)）]/gi, '')
        .replace(/[／/\\|，、]+/g, ' ')
        .replace(/[\s\-_./]+/g, '');
}

export function normalizeModelToken(value) {
    return normalizeMeelsToken(value)
        .replace(/[oο]/g, '0')
        .replace(/[il|]/g, '1');
}

export function subsequenceScore(query, target) {
    if (!query || !target || query.length < 4) return 0;
    let qi = 0;
    for (let ti = 0; ti < target.length && qi < query.length; ti += 1) {
        if (target[ti] === query[qi]) qi += 1;
    }
    if (qi !== query.length) return 0;
    return Math.round((query.length / target.length) * 72);
}

export function splitModelVariants(model) {
    const raw = String(model ?? '');
    const parts = raw.split(/[／/\\|]+/).map((part) => normalizeMeelsToken(part)).filter(Boolean);
    const full = normalizeMeelsToken(raw);
    if (full && !parts.includes(full)) parts.unshift(full);
    return [...new Set(parts)];
}

export function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[a.length][b.length];
}

export function similarityRatio(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const distance = levenshteinDistance(a, b);
    return 1 - distance / Math.max(a.length, b.length);
}

export function expandBrandQueries(brand) {
    const normalized = normalizeMeelsToken(brand);
    if (!normalized) return [];

    const queries = new Set([normalized]);
    for (const [canonical, aliases] of Object.entries(MEELS_BRAND_ALIASES)) {
        const aliasTokens = aliases.map(normalizeMeelsToken).filter(Boolean);
        const canonicalToken = normalizeMeelsToken(canonical);
        const hit = aliasTokens.some((alias) => alias === normalized || alias.includes(normalized) || normalized.includes(alias))
            || similarityRatio(normalized, canonicalToken) >= 0.78;
        if (hit) {
            queries.add(canonicalToken);
            aliasTokens.forEach((alias) => queries.add(alias));
        }
    }
    return [...queries];
}

export function looksLikeModelCode(value) {
    const text = normalizeLookupText(value);
    const token = normalizeMeelsToken(text);
    if (token.length < 3) return false;

    const hasDigit = /\d/.test(token);
    const canonicalBrands = new Set(Object.keys(MEELS_BRAND_ALIASES).map(normalizeMeelsToken));
    const brandQueries = expandBrandQueries(text);
    const matchesKnownBrand = canonicalBrands.has(token)
        || brandQueries.some((query) => canonicalBrands.has(query));

    if (!hasDigit) {
        return matchesKnownBrand ? false : token.length >= 8;
    }

    if (matchesKnownBrand && !/[/-]/.test(text)) return false;

    const hasLetter = /[a-z]/i.test(text);
    const hasSeparator = /[-/.]/.test(text);

    if (hasDigit && (hasLetter || hasSeparator)) return true;
    if (token.length >= 6 && hasDigit) return true;
    if (token.length >= 8 && /^[a-z0-9]+$/i.test(token)) return true;

    return hasDigit;
}

export function splitLookupQuery(brand, model) {
    let normalizedBrand = cleanTrailingPartialCjk(normalizeLookupText(brand));
    let normalizedModel = normalizeLookupText(model);

    if (normalizedModel.length >= 2) {
        return { brand: normalizedBrand, model: normalizedModel };
    }

    const brandTokens = normalizedBrand.split(/\s+/).filter(Boolean);
    if (brandTokens.length >= 2) {
        const lastToken = brandTokens[brandTokens.length - 1];
        if (looksLikeModelCode(lastToken) || (/[A-Za-z0-9]/.test(lastToken) && lastToken.length >= 3)) {
            return {
                brand: brandTokens.slice(0, -1).join(' '),
                model: lastToken
            };
        }
    }

    if (!normalizedModel && normalizedBrand && looksLikeModelCode(normalizedBrand)) {
        return { brand: '', model: normalizedBrand };
    }

    if (!normalizedBrand && normalizedModel.includes(' ')) {
        const modelTokens = normalizedModel.split(/\s+/).filter(Boolean);
        if (modelTokens.length >= 2) {
            const lastToken = modelTokens[modelTokens.length - 1];
            if (looksLikeModelCode(lastToken) || lastToken.length >= 3) {
                return {
                    brand: modelTokens.slice(0, -1).join(' '),
                    model: lastToken
                };
            }
        }
    }

    return { brand: normalizedBrand, model: normalizedModel };
}

function scoreModelVariant(query, variant) {
    if (!query || !variant) return 0;
    if (variant === query) return 100;
    if (variant.includes(query) || query.includes(variant)) return 78;
    if (query.length >= 4 && variant.startsWith(query)) return 70;

    const ratio = similarityRatio(query, variant);
    if (ratio >= 0.84 && query.length >= 5) return Math.round(ratio * 82);
    if (ratio >= 0.72 && query.length >= 4) return Math.round(ratio * 68);

    return subsequenceScore(query, variant);
}

export function scoreModelMatch(query, entryModel) {
    const normalizedQuery = normalizeMeelsToken(query);
    const confusableQuery = normalizeModelToken(query);
    if (!normalizedQuery || normalizedQuery.length < 2) return 0;

    const variants = splitModelVariants(entryModel);
    let best = 0;

    for (const variant of variants) {
        if (!variant) continue;
        const confusableVariant = normalizeModelToken(variant);
        best = Math.max(
            best,
            scoreModelVariant(normalizedQuery, variant),
            scoreModelVariant(confusableQuery, confusableVariant)
        );
    }

    return best;
}

export function scoreBrandMatch(brandQuery, entry) {
    const normalizedBrand = normalizeLookupText(brandQuery);
    if (!normalizedBrand) return 0;

    const queries = expandBrandQueries(normalizedBrand);
    const targets = [entry.brandEn, entry.brandZh].map(normalizeMeelsToken).filter(Boolean);
    let best = 0;

    for (const query of queries) {
        for (const target of targets) {
            if (query === target) best = Math.max(best, 50);
            else if (target.includes(query) || query.includes(target)) best = Math.max(best, 36);
            else {
                const ratio = similarityRatio(query, target);
                if (ratio >= 0.78) best = Math.max(best, Math.round(ratio * 34));
            }
        }
    }

    return best;
}

export function scoreMeelsEntry(entry, brand, model) {
    const modelScore = scoreModelMatch(model, entry.model);
    if (modelScore < 55) return 0;

    const brandScore = scoreBrandMatch(brand, entry);
    const hasBrand = Boolean(normalizeLookupText(brand));

    if (!hasBrand) {
        if (modelScore >= 95) return modelScore + 12;
        if (modelScore >= 82) return modelScore + 8;
        if (modelScore >= 68) return modelScore + 4;
        return 0;
    }

    if (brandScore < 18 && modelScore < 82) return 0;
    return modelScore + brandScore;
}

export function validateMeelsLookupInput(brand, model) {
    const split = splitLookupQuery(brand, model);
    const normalizedBrand = split.brand;
    const normalizedModel = split.model;

    if (normalizedModel.length < 2) {
        return { ok: false, message: '請輸入型號（至少 2 個字）· Enter model (min 2 chars)' };
    }

    if (!normalizedBrand && !looksLikeModelCode(normalizedModel) && normalizedModel.length < 4) {
        return { ok: false, message: '型號較短時請輸入品牌，或輸入更完整型號 · Add brand or a longer model code' };
    }

    if (`${normalizedBrand} ${normalizedModel}`.length > 120) {
        return { ok: false, message: '品牌＋型號過長 · Brand + model too long' };
    }

    return { ok: true, brand: normalizedBrand, model: normalizedModel };
}

export function describeMeelsMatch({ entry, score }, { brand, model }) {
    const modelScore = scoreModelMatch(model, entry.model);
    const brandScore = scoreBrandMatch(brand, entry);
    const hasBrand = Boolean(normalizeLookupText(brand));

    if (!hasBrand) return '僅以型號匹配 · Matched by model only';
    if (modelScore >= 95 && brandScore >= 45) return '品牌與型號完全匹配 · Exact brand & model match';
    if (modelScore >= 70 && modelScore < 95) return '型號部分匹配 · Partial model match';
    if (brandScore >= 30 && modelScore >= 80) return '容錯匹配（可能修正錯字）· Fuzzy match (possible typo fix)';
    return '近似匹配，請核對 · Approximate match — please verify';
}

export function buildMeelsLookupResult(entry, { brand, model, confidence, catalogKeys, matchNote }) {
    const applianceCategory = catalogKeys.includes(entry.category)
        ? entry.category
        : inferApplianceType(entry.category, catalogKeys);
    const estimateNote = entry.kwhEstimated
        ? '（按標稱功率×1000小時估算）· Estimated from rated power × 1000 h/yr'
        : '';

    return parseLookupPayload({
        annualKwh: entry.annualKwh,
        applianceCategory,
        confidence,
        sourceUrl: MEELS_SOURCE_URL,
        summary: `${matchNote} · MEELS 能效 ${entry.grade ?? '—'} 級${estimateNote}`,
        summaryEn: `${matchNote} · MEELS grade ${entry.grade ?? '—'}${estimateNote ? ' · estimated kWh' : ''}`,
        brand: entry.brandEn || brand,
        model: entry.model
    }, catalogKeys);
}

export function searchMeelsRegistry(entries, brand, model, catalogKeys = [], { limit = 6 } = {}) {
    const validation = validateMeelsLookupInput(brand, model);
    if (!validation.ok) {
        return { ok: false, message: validation.message };
    }

    if (!Array.isArray(entries) || !entries.length) {
        return { ok: false, message: 'MEELS 資料未載入 · MEELS data not loaded' };
    }

    const hasBrand = Boolean(validation.brand);
    const minScore = hasBrand ? 88 : 72;

    const ranked = entries
        .map((entry) => ({ entry, score: scoreMeelsEntry(entry, validation.brand, validation.model) }))
        .filter((item) => item.score >= minScore)
        .sort((a, b) => b.score - a.score);

    if (!ranked.length) {
        return {
            ok: false,
            message: '找不到 MEELS 登記型號 · Model not found in MEELS registry'
        };
    }

    const best = ranked[0];
    const closeCount = ranked.filter((item) => item.score >= best.score - 8).length;
    const bestModelScore = scoreModelMatch(validation.model, best.entry.model);
    const confidence = hasBrand
        ? (best.score >= 145 ? 'high' : best.score >= 115 ? 'medium' : 'low')
        : (bestModelScore >= 95 && closeCount === 1 ? 'high' : bestModelScore >= 82 && closeCount <= 2 ? 'medium' : 'low');

    if (!hasBrand && closeCount > 1 && bestModelScore < 95) {
        return {
            ok: false,
            message: '有多個相近型號，請輸入品牌以縮窄結果 · Multiple close matches — add brand',
            alternatives: ranked.slice(0, limit).map((item) => ({
                brand: item.entry.brandEn,
                model: item.entry.model,
                annualKwh: item.entry.annualKwh,
                score: item.score
            }))
        };
    }

    const closeAlternatives = ranked
        .slice(1, limit)
        .filter((item) => best.score - item.score <= 18);

    const matchNote = describeMeelsMatch(best, validation);
    const parsed = buildMeelsLookupResult(best.entry, {
        brand: validation.brand,
        model: validation.model,
        confidence,
        catalogKeys,
        matchNote
    });

    const resultValidation = validateLookupResult(parsed);
    return {
        ok: resultValidation.ok,
        result: parsed,
        validation: resultValidation,
        matchCount: ranked.length,
        alternatives: closeAlternatives.map((item) => ({
            brand: item.entry.brandEn,
            model: item.entry.model,
            annualKwh: item.entry.annualKwh,
            score: item.score,
            matchNote: describeMeelsMatch(item, validation)
        })),
        matchNote
    };
}

if (typeof globalThis !== 'undefined') {
    globalThis.normalizeMeelsToken = normalizeMeelsToken;
    globalThis.searchMeelsRegistry = searchMeelsRegistry;
    globalThis.validateMeelsLookupInput = validateMeelsLookupInput;
    globalThis.cleanTrailingPartialCjk = cleanTrailingPartialCjk;
    globalThis.looksLikeModelCode = looksLikeModelCode;
    globalThis.splitLookupQuery = splitLookupQuery;
    globalThis.MEELS_SOURCE_URL = MEELS_SOURCE_URL;
}