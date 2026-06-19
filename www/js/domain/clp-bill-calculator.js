function tariffCalc() {
    return globalThis.ProgressiveTariffCalculator;
}

function defaultTariff() {
    return globalThis.HK_PROGRESSIVE_TARIFFS?.clp;
}

function fuelRatesTable() {
    return globalThis.CLP_FUEL_RATES_HKD ?? {};
}

function resolveFuelRate(yearMonth, fallback) {
    if (typeof globalThis.getClpFuelRate === 'function') {
        return globalThis.getClpFuelRate(yearMonth, fallback);
    }
    return fuelRatesTable()[yearMonth] ?? fallback;
}

function parseDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${value}`);
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function yearMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function daysInclusive(start, end) {
    return Math.round((end - start) / 86400000) + 1;
}

function roundMoney(value) {
    return Math.round(value * 100) / 100;
}

function roundRate(value) {
    return Math.round(value * 10000) / 10000;
}

function listCalendarMonthsInPeriod(startDate, endDate) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (end < start) {
        throw new Error('endDate must be on or after startDate');
    }

    const segments = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= lastMonth) {
        const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const periodStart = start > monthStart ? start : monthStart;
        const periodEnd = end < monthEnd ? end : monthEnd;
        const days = daysInclusive(periodStart, periodEnd);
        segments.push({
            yearMonth: yearMonthKey(cursor),
            days,
            periodStart,
            periodEnd
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return segments;
}

function splitKwhAcrossPeriod(startDate, endDate, totalKwh, monthlyKwh = {}) {
    const segments = listCalendarMonthsInPeriod(startDate, endDate);
    const explicit = segments.map((segment) => {
        const override = monthlyKwh[segment.yearMonth];
        return Number.isFinite(override) ? Math.max(0, override) : null;
    });

    if (explicit.every((value) => value !== null)) {
        const sum = explicit.reduce((total, value) => total + value, 0);
        if (Math.abs(sum - totalKwh) > 0.01) {
            throw new Error(`Monthly kWh (${sum}) must equal total kWh (${totalKwh})`);
        }
        return segments.map((segment, index) => ({
            ...segment,
            kwh: explicit[index]
        }));
    }

    const totalDays = segments.reduce((sum, segment) => sum + segment.days, 0);
    let allocated = 0;
    return segments.map((segment, index) => {
        if (index === segments.length - 1) {
            return { ...segment, kwh: Math.max(0, totalKwh - allocated) };
        }
        const kwh = Math.round((totalKwh * segment.days) / totalDays);
        allocated += kwh;
        return { ...segment, kwh };
    });
}

function inferMonthlyKwhFromBillTargets({
    startDate,
    endDate,
    totalKwh,
    targetBasic,
    targetFuel,
    tariff = null,
    fuelRates = null
}) {
    const calculator = tariffCalc();
    const resolvedTariff = tariff || defaultTariff();
    const resolvedFuelRates = fuelRates || fuelRatesTable();
    const segments = listCalendarMonthsInPeriod(startDate, endDate);
    const monthFuelRates = segments.map((segment) => (
        resolvedFuelRates[segment.yearMonth]
        ?? resolveFuelRate(segment.yearMonth, resolvedTariff.fuelCharge)
    ));

    if (segments.length === 1) {
        return [{
            ...segments[0],
            kwh: totalKwh,
            fuelRate: monthFuelRates[0],
            basic: calculator.basicMonthlyBill(totalKwh, resolvedTariff),
            fuel: totalKwh * monthFuelRates[0]
        }];
    }

    let bestKwh = splitKwhAcrossPeriod(startDate, endDate, totalKwh).map((month) => month.kwh);
    let bestScore = Infinity;

    const evaluate = (kwhValues) => {
        let basic = 0;
        let fuel = 0;
        kwhValues.forEach((kwh, index) => {
            basic += calculator.basicMonthlyBill(kwh, resolvedTariff);
            fuel += kwh * monthFuelRates[index];
        });
        const score = Math.abs(basic - targetBasic) + Math.abs(fuel - targetFuel);
        if (score < bestScore) {
            bestScore = score;
            bestKwh = kwhValues.slice();
        }
        return { basic, fuel, score };
    };

    evaluate(bestKwh);

    if (segments.length === 2) {
        for (let first = 0; first <= totalKwh; first += 1) {
            evaluate([first, totalKwh - first]);
        }
    } else if (segments.length === 3) {
        for (let first = 0; first <= totalKwh; first += 1) {
            for (let second = 0; second <= totalKwh - first; second += 1) {
                evaluate([first, second, totalKwh - first - second]);
            }
        }
    } else {
        for (let attempt = 0; attempt < 4000; attempt += 1) {
            const weights = segments.map(() => Math.random() + 0.05);
            const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
            const kwhValues = [];
            let allocated = 0;
            weights.forEach((weight, index) => {
                if (index === weights.length - 1) {
                    kwhValues.push(totalKwh - allocated);
                    return;
                }
                const kwh = Math.round((totalKwh * weight) / weightSum);
                kwhValues.push(kwh);
                allocated += kwh;
            });
            evaluate(kwhValues);
        }
    }

    return segments.map((segment, index) => {
        const kwh = bestKwh[index];
        const fuelRate = monthFuelRates[index];
        const basic = calculator.basicMonthlyBill(kwh, resolvedTariff);
        const fuel = kwh * fuelRate;
        return {
            ...segment,
            kwh,
            fuelRate,
            basic,
            fuel,
            subtotal: basic + fuel
        };
    });
}

function formatMoneyHkd(amount) {
    if (!Number.isFinite(amount)) return 'HK$0.00';
    const rounded = roundMoney(amount);
    const prefix = rounded < 0 ? '-HK$' : 'HK$';
    return `${prefix}${Math.abs(rounded).toFixed(2)}`;
}

function formatClpBillLinesHtml(bill, options = {}) {
    if (!bill) return '';

    const {
        title = '帳單費用明細 · Bill line items',
        showInferredMonths = true
    } = options;

    const lines = [
        ['基本電費 Basic charge', bill.basic],
        ['燃料調整費 Fuel adjustment', bill.fuel],
        ['上期撥來 Brought forward', bill.broughtForward],
        ['零數撥入下次 Rounding carry', bill.roundingCarry]
    ];

    if (bill.other) {
        lines.push(['其他 Other', bill.other]);
    }

    const list = lines.map(([label, amount]) => (
        `<li><span class="tariff-tier-range">${label}</span>`
        + `<span class="tariff-tier-rate">${formatMoneyHkd(amount)}</span></li>`
    )).join('');

    const totalLine = `<li><span class="tariff-tier-range">本期總數 Total</span>`
        + `<span class="tariff-tier-rate">${formatMoneyHkd(bill.total)}</span>`
        + `<span class="tariff-tier-detail">${bill.totalKwh} 度電 · `
        + `實效 HK$${(bill.total / bill.totalKwh).toFixed(3)}/kWh</span></li>`;

    let monthNote = '';
    if (showInferredMonths && bill.months?.length) {
        const monthLines = bill.months
            .filter((month) => month.kwh > 0)
            .map((month) => `${month.yearMonth} ${month.kwh} 度`)
            .join(' · ');
        monthNote = `<p class="tariff-note-foot">依帳單金額反推分月用量（供參考）：${monthLines}。`
            + '<span class="tariff-note-en">Monthly kWh inferred from bill amounts for reference only.</span></p>';
    }

    return `<div class="tariff-calc-breakdown">`
        + `<p class="tariff-calc-title">${title}</p>`
        + `<ul class="tariff-tier-list">${list}${totalLine}</ul>${monthNote}`
        + `</div>`;
}

class ClpBillCalculator {
    static sumBillLines({
        basicCharge,
        fuelCharge,
        broughtForward = 0,
        roundingCarry = 0,
        otherCharges = 0
    }) {
        return roundMoney(
            basicCharge + fuelCharge + broughtForward + roundingCarry + otherCharges
        );
    }

    static calculateFromBillLines({
        totalKwh,
        basicCharge,
        fuelCharge,
        broughtForward = 0,
        roundingCarry = 0,
        otherCharges = 0,
        startDate = null,
        endDate = null,
        tariff = null,
        fuelRates = null
    }) {
        if (!Number.isFinite(totalKwh) || totalKwh <= 0) {
            throw new Error('totalKwh must be a positive number');
        }

        const required = { basicCharge, fuelCharge };
        Object.entries(required).forEach(([key, value]) => {
            if (!Number.isFinite(value)) {
                throw new Error(`${key} is required`);
            }
        });

        const total = this.sumBillLines({
            basicCharge,
            fuelCharge,
            broughtForward,
            roundingCarry,
            otherCharges
        });

        let months = null;
        let calcBasic = null;
        let calcFuel = null;
        if (startDate && endDate) {
            months = inferMonthlyKwhFromBillTargets({
                startDate,
                endDate,
                totalKwh,
                targetBasic: basicCharge,
                targetFuel: fuelCharge,
                tariff,
                fuelRates
            });
            calcBasic = roundMoney(months.reduce((sum, month) => sum + month.basic, 0));
            calcFuel = roundMoney(months.reduce((sum, month) => sum + month.fuel, 0));
        }

        return {
            source: 'bill-lines',
            totalKwh,
            startDate,
            endDate,
            basic: roundMoney(basicCharge),
            fuel: roundMoney(fuelCharge),
            broughtForward: roundMoney(broughtForward),
            roundingCarry: roundMoney(roundingCarry),
            other: roundMoney(otherCharges),
            total,
            impliedFuelRate: roundRate(fuelCharge / totalKwh),
            impliedAllInRate: roundRate(total / totalKwh),
            calculatedBasic: calcBasic,
            calculatedFuel: calcFuel,
            months
        };
    }

    static estimateFromReferenceBill({ referenceBill, totalKwh }) {
        if (!referenceBill?.totalKwh || !Number.isFinite(totalKwh) || totalKwh <= 0) {
            return null;
        }
        const scale = totalKwh / referenceBill.totalKwh;
        const basic = roundMoney(referenceBill.basic * scale);
        const fuel = roundMoney(referenceBill.fuel * scale);
        const broughtForward = roundMoney((referenceBill.broughtForward || 0) * scale);
        const roundingCarry = roundMoney((referenceBill.roundingCarry || 0) * scale);
        const other = roundMoney((referenceBill.other || 0) * scale);
        return {
            source: 'reference-scale',
            totalKwh,
            basic,
            fuel,
            broughtForward,
            roundingCarry,
            other,
            total: this.sumBillLines({
                basicCharge: basic,
                fuelCharge: fuel,
                broughtForward,
                roundingCarry,
                otherCharges: other
            }),
            referenceTotalKwh: referenceBill.totalKwh,
            scale
        };
    }

    static calculatePeriodBill({
        startDate,
        endDate,
        totalKwh,
        monthlyKwh = {},
        billLines = null,
        tariff = null,
        fuelRates = null,
        otherCharges = 0
    }) {
        if (!Number.isFinite(totalKwh) || totalKwh <= 0) {
            throw new Error('totalKwh must be a positive number');
        }

        if (billLines) {
            return this.calculateFromBillLines({
                totalKwh,
                startDate,
                endDate,
                tariff,
                fuelRates,
                otherCharges,
                broughtForward: billLines.broughtForward ?? 0,
                roundingCarry: billLines.roundingCarry ?? 0,
                basicCharge: billLines.basicCharge,
                fuelCharge: billLines.fuelCharge
            });
        }

        const calculator = tariffCalc();
        const resolvedTariff = tariff || defaultTariff();
        const resolvedFuelRates = fuelRates || fuelRatesTable();
        const months = splitKwhAcrossPeriod(startDate, endDate, totalKwh, monthlyKwh);
        let basicCharge = 0;
        let fuelCharge = 0;

        const monthBreakdown = months.map((month) => {
            const fuelRate = resolvedFuelRates[month.yearMonth]
                ?? resolveFuelRate(month.yearMonth, resolvedTariff.fuelCharge);
            const basic = calculator.basicMonthlyBill(month.kwh, resolvedTariff);
            const fuel = month.kwh * fuelRate;
            basicCharge += basic;
            fuelCharge += fuel;
            return {
                ...month,
                fuelRate,
                basic,
                fuel,
                subtotal: basic + fuel
            };
        });

        return {
            source: 'estimated',
            basic: roundMoney(basicCharge),
            fuel: roundMoney(fuelCharge),
            broughtForward: 0,
            roundingCarry: 0,
            other: roundMoney(otherCharges),
            total: roundMoney(basicCharge + fuelCharge + otherCharges),
            totalKwh,
            startDate,
            endDate,
            months: monthBreakdown
        };
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.ClpBillCalculator = ClpBillCalculator;
    globalThis.listCalendarMonthsInPeriod = listCalendarMonthsInPeriod;
    globalThis.splitKwhAcrossPeriod = splitKwhAcrossPeriod;
    globalThis.inferMonthlyKwhFromBillTargets = inferMonthlyKwhFromBillTargets;
    globalThis.formatClpBillLinesHtml = formatClpBillLinesHtml;
}