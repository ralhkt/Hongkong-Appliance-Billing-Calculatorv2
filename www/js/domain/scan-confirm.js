/** Scan confirmation policy — require explicit user confirm before results. */
const AUTO_ADVANCE_AFTER_SCAN = false;

const SCAN_VALIDATION_MESSAGES = {
    missing_kwh: '請輸入或確認年耗電量 · Enter or confirm annual kWh',
    kwh_low: '年耗電量偏低，請核對標籤數字 · kWh seems low — check the label'
};

function validateScanForApply(kwh, { minKwh = 50 } = {}) {
    const value = Number(kwh);
    if (!Number.isFinite(value) || value <= 0) {
        return { ok: false, code: 'missing_kwh', message: SCAN_VALIDATION_MESSAGES.missing_kwh };
    }
    if (value < minKwh) {
        return { ok: false, code: 'kwh_low', message: SCAN_VALIDATION_MESSAGES.kwh_low, warnOnly: true };
    }
    return { ok: true, code: 'ok' };
}

if (typeof globalThis !== 'undefined') {
    globalThis.AUTO_ADVANCE_AFTER_SCAN = AUTO_ADVANCE_AFTER_SCAN;
    globalThis.validateScanForApply = validateScanForApply;
    globalThis.SCAN_VALIDATION_MESSAGES = SCAN_VALIDATION_MESSAGES;
}