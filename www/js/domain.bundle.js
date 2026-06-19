(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/domain/progressive-tariff.js
  var HK_PROGRESSIVE_TARIFFS = {
    clp: {
      id: "clp",
      label: "\u4E2D\u96FB CLP",
      fuelCharge: 0.394,
      averageNet: 1.406,
      blocks: [
        { upTo: 400, basic: 0.91, label: "\u9996 400 \u5EA6" },
        { upTo: 800, basic: 1.114, label: "401\u2013800 \u5EA6" },
        { upTo: Infinity, basic: 1.308, label: "\u8D85\u904E 800 \u5EA6" }
      ]
    },
    hke: {
      id: "hke",
      label: "\u6E2F\u71C8 HKE",
      fuelCharge: 0.354,
      averageNet: 1.633,
      blocks: [
        { upTo: 150, basic: 0.863, label: "\u9996 150 \u5EA6" },
        { upTo: 300, basic: 1.002, label: "151\u2013300 \u5EA6" },
        { upTo: 500, basic: 1.141, label: "301\u2013500 \u5EA6" },
        { upTo: 700, basic: 1.377, label: "501\u2013700 \u5EA6" },
        { upTo: 1e3, basic: 1.516, label: "701\u20131,000 \u5EA6" },
        { upTo: 1500, basic: 1.655, label: "1,001\u20131,500 \u5EA6" },
        { upTo: Infinity, basic: 1.794, label: "\u8D85\u904E 1,500 \u5EA6" }
      ]
    }
  };
  var ProgressiveTariffCalculator = class {
    static basicMonthlyBill(kwh, tariff) {
      if (!Number.isFinite(kwh) || kwh <= 0) return 0;
      let remaining = kwh;
      let cost = 0;
      let prevCap = 0;
      for (const block of tariff.blocks) {
        const cap = block.upTo === Infinity ? Infinity : block.upTo;
        const blockSize = cap === Infinity ? remaining : cap - prevCap;
        const inBlock = Math.min(remaining, blockSize);
        if (inBlock <= 0) break;
        cost += inBlock * block.basic;
        remaining -= inBlock;
        prevCap = cap === Infinity ? prevCap + inBlock : cap;
        if (remaining <= 0) break;
      }
      return cost;
    }
    static fuelMonthlyBill(kwh, fuelRate) {
      if (!Number.isFinite(kwh) || kwh <= 0 || !Number.isFinite(fuelRate)) return 0;
      return kwh * fuelRate;
    }
    static monthlyBill(kwh, tariff, fuelRate = tariff.fuelCharge) {
      return this.basicMonthlyBill(kwh, tariff) + this.fuelMonthlyBill(kwh, fuelRate);
    }
    static annualBill(annualKwh, tariff, fuelRate = tariff.fuelCharge) {
      const monthlyKwh = annualKwh / 12;
      return this.monthlyBill(monthlyKwh, tariff, fuelRate) * 12;
    }
    static effectiveRate(annualKwh, tariff, fuelRate = tariff.fuelCharge) {
      if (!annualKwh) return 0;
      return this.annualBill(annualKwh, tariff, fuelRate) / annualKwh;
    }
    static getMonthlyTierBreakdown(kwh, tariff) {
      if (!Number.isFinite(kwh) || kwh <= 0) return [];
      let remaining = kwh;
      let prevCap = 0;
      const tiers = [];
      for (const block of tariff.blocks) {
        const cap = block.upTo === Infinity ? Infinity : block.upTo;
        const blockSize = cap === Infinity ? remaining : cap - prevCap;
        const inBlock = Math.min(remaining, blockSize);
        if (inBlock <= 0) break;
        tiers.push({
          label: block.label,
          rangeLabel: this.formatBlockRangeLabel(block),
          kwh: inBlock,
          basicRate: block.basic,
          basicSubtotal: inBlock * block.basic
        });
        remaining -= inBlock;
        prevCap = cap === Infinity ? prevCap + inBlock : cap;
        if (remaining <= 0) break;
      }
      return tiers;
    }
    static buildMonthlyBillBreakdown(monthlyKwh, tariff, fuelRate = tariff.fuelCharge) {
      const tiers = this.getMonthlyTierBreakdown(monthlyKwh, tariff);
      const basicMonthly = tiers.reduce((sum, tier) => sum + tier.basicSubtotal, 0);
      const fuelMonthly = this.fuelMonthlyBill(monthlyKwh, fuelRate);
      return {
        monthlyKwh,
        tiers,
        basicMonthly,
        fuelMonthly,
        fuelRate,
        monthlyTotal: basicMonthly + fuelMonthly
      };
    }
    static formatMoneyHkd(amount) {
      if (!Number.isFinite(amount)) return "HK$0.00";
      return `HK$${amount.toFixed(2)}`;
    }
    static formatMonthlyBillBreakdownHtml(breakdown, options = {}) {
      if (!breakdown || breakdown.monthlyKwh <= 0) return "";
      const {
        title = "\u6BCF\u6708\u8A08\u7B97\u660E\u7D30 \xB7 Monthly bill breakdown",
        footnote = "",
        showAnnualScale = false
      } = options;
      const tierLines = breakdown.tiers.map((tier) => `<li><span class="tariff-tier-range">${tier.rangeLabel}</span><span class="tariff-tier-rate">${this.formatMoneyHkd(tier.basicSubtotal)}</span><span class="tariff-tier-detail">${tier.kwh.toFixed(0)} \u5EA6 \xD7 \u57FA\u672C HK$${tier.basicRate.toFixed(3)}</span></li>`).join("");
      const fuelDetail = breakdown.fuelRateNote ? `${breakdown.monthlyKwh.toFixed(0)} \u5EA6 \xD7 HK$${breakdown.fuelRate.toFixed(3)} \xB7 ${breakdown.fuelRateNote}` : `${breakdown.monthlyKwh.toFixed(0)} \u5EA6 \xD7 HK$${breakdown.fuelRate.toFixed(3)}`;
      const lines = [
        tierLines,
        `<li><span class="tariff-tier-range">\u71C3\u6599\u8ABF\u6574\u8CBB Fuel</span><span class="tariff-tier-rate">${this.formatMoneyHkd(breakdown.fuelMonthly)}</span><span class="tariff-tier-detail">${fuelDetail}</span></li>`,
        `<li><span class="tariff-tier-range">\u6BCF\u6708\u5C0F\u8A08 Monthly subtotal</span><span class="tariff-tier-rate">${this.formatMoneyHkd(breakdown.monthlyTotal)}</span><span class="tariff-tier-detail">\u57FA\u672C ${this.formatMoneyHkd(breakdown.basicMonthly)} + \u71C3\u6599 ${this.formatMoneyHkd(breakdown.fuelMonthly)}</span></li>`
      ].join("");
      const annualLine = showAnnualScale ? `<p class="tariff-note-foot">${this.formatMoneyHkd(breakdown.monthlyTotal)}/\u6708 \xD7 12 \u500B\u6708 = \u5E74\u8CBB <strong>${this.formatMoneyHkd(breakdown.monthlyTotal * 12)}</strong></p>` : "";
      return `<div class="tariff-calc-breakdown"><p class="tariff-calc-title">${title}</p><ul class="tariff-tier-list">${lines}</ul>${annualLine}${footnote}</div>`;
    }
    static formatResultsCalculationHtml({
      annualKwh,
      flatRate,
      flatAnnual,
      breakdown,
      providerLabel
    }) {
      if (!breakdown || breakdown.monthlyKwh <= 0) return "";
      const flatIntro = `<p class="tariff-note-intro"><strong>\u672C\u6B21\u4F30\u7B97</strong>\uFF1A\u5E74\u8017\u96FB <strong>${annualKwh.toFixed(0)} kWh</strong> \xD7 \u6DE8\u96FB\u50F9 HK$${flatRate.toFixed(3)} = <strong>${this.formatMoneyHkd(flatAnnual)}</strong><span class="tariff-note-en">This result uses the selected net tariff (basic + fuel reference rate).</span></p>`;
      const progressive = this.formatMonthlyBillBreakdownHtml(breakdown, {
        title: `${providerLabel} \u7D2F\u9032\u5236\u53C3\u8003\uFF08\u6708\u5747 ${breakdown.monthlyKwh.toFixed(0)} \u5EA6\uFF09\xB7 Progressive reference`,
        footnote: `<p class="tariff-note-foot">\u55AE\u4EF6\u96FB\u5668\u4F30\u7B97\u7528\u6DE8\u96FB\u50F9\uFF1B\u7D2F\u9032\u5236\u50C5\u4F9B\u5C0D\u7167\u5BE6\u969B\u5E33\u55AE\u7D50\u69CB\u3002<span class="tariff-note-en">Single-appliance estimate uses flat net rate; progressive breakdown shows how a real bill is structured.</span></p>`
      });
      return `${flatIntro}${progressive}`;
    }
    static getHouseholdTotals(items, providerId, fuelRate = null) {
      const tariff = HK_PROGRESSIVE_TARIFFS[providerId] || HK_PROGRESSIVE_TARIFFS.clp;
      const resolvedFuelRate = Number.isFinite(fuelRate) ? fuelRate : tariff.fuelCharge;
      const annualKwh = items.reduce((sum, item) => sum + (item.annualKwh || 0), 0);
      const flatAnnualCost = items.reduce((sum, item) => sum + (item.annualCost || 0), 0);
      const monthlyKwh = annualKwh / 12;
      const monthlyBreakdown = this.buildMonthlyBillBreakdown(monthlyKwh, tariff, resolvedFuelRate);
      const progressiveAnnualCost = monthlyBreakdown.monthlyTotal * 12;
      return {
        count: items.length,
        annualKwh,
        monthlyKwh,
        annualCost: progressiveAnnualCost,
        monthlyCost: progressiveAnnualCost / 12,
        flatAnnualCost,
        effectiveRate: annualKwh ? progressiveAnnualCost / annualKwh : 0,
        fuelRate: resolvedFuelRate,
        monthlyBreakdown,
        tariff
      };
    }
    static formatBlockRangeLabel(block) {
      if (block.label.startsWith("\u9996") || block.label.startsWith("\u8D85\u904E")) {
        return `\u6BCF\u6708${block.label}`;
      }
      return `\u6BCF\u6708 ${block.label}`;
    }
    static formatProgressiveTariffSummary(tariff) {
      const rates = tariff.blocks.map((block) => block.basic + tariff.fuelCharge);
      const min = Math.min(...rates);
      const max = Math.max(...rates);
      return `${tariff.label} \xB7 ${tariff.blocks.length} \u500B\u6536\u8CBB\u5206\u6BB5 \xB7 \u6BCF\u5EA6 HK$${min.toFixed(3)}\u2013${max.toFixed(3)}`;
    }
    static formatProgressiveTariffHtml(tariff, monthlyKwh = 0, itemCount = 0, fuelRate = tariff.fuelCharge) {
      const intro = `<p class="tariff-note-intro"><strong>${tariff.label} \u7D2F\u9032\u5236\u96FB\u50F9</strong>\uFF1A\u6309<strong>\u6BCF\u6708</strong>\u7E3D\u7528\u96FB\u91CF\u5206\u6BB5\u8A08\u7B97<strong>\u57FA\u672C\u96FB\u8CBB</strong>\uFF1B<strong>\u71C3\u6599\u8ABF\u6574\u8CBB</strong>\u5247\u6309\u8A72\u6708\u6BCF\u5EA6\u96FB\u53E6\u884C\u6536\u53D6\uFF08\u6BCF\u6708\u8CBB\u7387\u53EF\u4E0D\u540C\uFF09\u3002\u5404\u6708\u300C\u57FA\u672C\u96FB\u8CBB + \u71C3\u6599\u8ABF\u6574\u8CBB\u300D\u76F8\u52A0\u5F97\u51FA\u5E33\u55AE\u7E3D\u984D\u3002<span class="tariff-note-en">Progressive basic charge is calculated per calendar month; fuel adjustment is a separate per-kWh charge that may change monthly.</span></p>`;
      const tiers = tariff.blocks.map((block) => {
        const net = block.basic + tariff.fuelCharge;
        const range = this.formatBlockRangeLabel(block);
        return `<li><span class="tariff-tier-range">${range}</span><span class="tariff-tier-rate">\u57FA\u672C\u6BCF\u5EA6 HK$${block.basic.toFixed(3)}</span><span class="tariff-tier-detail">\u53C3\u8003\u6DE8\u96FB\u50F9\uFF08\u542B\u71C3\u6599\u8CBB HK$${tariff.fuelCharge.toFixed(3)}\uFF09\u2248 HK$${net.toFixed(3)}/kWh</span></li>`;
      }).join("");
      const foot = itemCount > 0 && monthlyKwh > 0 ? `<p class="tariff-note-foot">\u4F9D\u4F60\u96FB\u5668\u5EAB\u4F30\u7B97\uFF0C\u5168\u5C4B\u6708\u5747\u7D04 <strong>${monthlyKwh.toFixed(0)} \u5EA6</strong>\uFF0C\u4E0B\u65B9\u5217\u51FA\u9010\u6708\u8A08\u7B97\u904E\u7A0B\uFF08\u6BD4\u9010\u4EF6\u7528\u5E73\u5747\u96FB\u50F9\u76F8\u52A0\u66F4\u8CBC\u8FD1\u5BE6\u969B\u5E33\u55AE\uFF09\u3002</p>` : `<p class="tariff-note-foot">\u5132\u5B58\u96FB\u5668\u5F8C\uFF0C\u5C07\u6309\u5168\u5C4B\u4F30\u7B97\u6708\u7528\u91CF\u5957\u7528\u4EE5\u4E0B\u5206\u6BB5\u8A08\u7B97\u5E74\u8CBB\u3002</p>`;
      let calculation = "";
      if (itemCount > 0 && monthlyKwh > 0) {
        const breakdown = this.buildMonthlyBillBreakdown(monthlyKwh, tariff, fuelRate);
        if (tariff.id === "clp") {
          breakdown.fuelRateNote = "2026 \u5E74\u6708\u5747\u71C3\u6599\u8CBB\u4F30\u7B97";
        }
        calculation = this.formatMonthlyBillBreakdownHtml(breakdown, {
          title: `\u4F60\u7684\u5168\u5C4B\u4F30\u7B97\u8A08\u7B97\uFF08\u6708\u5747 ${monthlyKwh.toFixed(0)} \u5EA6\uFF09\xB7 Your household estimate`,
          showAnnualScale: true,
          footnote: tariff.id === "clp" ? '<p class="tariff-note-foot">\u5BE6\u969B\u5E33\u55AE\u71C3\u6599\u8CBB\u9010\u6708\u8ABF\u6574\uFF08\u5982 4\u6708 39.8\xA2\u30016\u6708 42.6\xA2\uFF09\uFF1B\u5169\u6708\u5408\u4F75\u5E33\u55AE\u4EA6\u6309\u5404\u6708\u7528\u91CF\u5206\u5225\u7D2F\u9032\u3002<span class="tariff-note-en">Actual bills use monthly fuel rates; bimonthly bills apply progressive tiers per calendar month.</span></p>' : ""
        });
      }
      return `${intro}<ul class="tariff-tier-list">${tiers}</ul>${foot}${calculation}`;
    }
  };
  if (typeof globalThis !== "undefined") {
    globalThis.HK_PROGRESSIVE_TARIFFS = HK_PROGRESSIVE_TARIFFS;
    globalThis.ProgressiveTariffCalculator = ProgressiveTariffCalculator;
  }

  // src/domain/clp-fuel-rates.js
  var CLP_FUEL_RATES_HKD = {
    "2026-01": 0.394,
    "2026-02": 0.394,
    "2026-03": 0.392,
    "2026-04": 0.398,
    "2026-05": 0.404,
    "2026-06": 0.426
  };
  function getClpFuelRate(yearMonth, fallback = 0.394) {
    return CLP_FUEL_RATES_HKD[yearMonth] ?? fallback;
  }
  function getLatestClpFuelRateMonth() {
    const keys = Object.keys(CLP_FUEL_RATES_HKD).sort();
    return keys[keys.length - 1] ?? null;
  }
  function formatClpFuelRatesAsOfLabel(locale = "zh-HK") {
    const monthKey = getLatestClpFuelRateMonth();
    if (!monthKey) return "";
    const [year, month] = monthKey.split("-").map((part) => parseInt(part, 10));
    if (locale === "en") {
      const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${names[month - 1]} ${year}`;
    }
    return `${year}\u5E74${month}\u6708`;
  }
  function monthsSinceFuelRateUpdate(referenceDate = /* @__PURE__ */ new Date()) {
    const latest = getLatestClpFuelRateMonth();
    if (!latest) return Infinity;
    const [year, month] = latest.split("-").map((part) => parseInt(part, 10));
    const refYear = referenceDate.getFullYear();
    const refMonth = referenceDate.getMonth() + 1;
    return (refYear - year) * 12 + (refMonth - month);
  }
  if (typeof globalThis !== "undefined") {
    globalThis.CLP_FUEL_RATES_HKD = CLP_FUEL_RATES_HKD;
    globalThis.getClpFuelRate = getClpFuelRate;
    globalThis.getLatestClpFuelRateMonth = getLatestClpFuelRateMonth;
    globalThis.formatClpFuelRatesAsOfLabel = formatClpFuelRatesAsOfLabel;
    globalThis.monthsSinceFuelRateUpdate = monthsSinceFuelRateUpdate;
  }

  // src/domain/clp-bill-calculator.js
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
    if (typeof globalThis.getClpFuelRate === "function") {
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
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  function daysInclusive(start, end) {
    return Math.round((end - start) / 864e5) + 1;
  }
  function roundMoney(value) {
    return Math.round(value * 100) / 100;
  }
  function roundRate(value) {
    return Math.round(value * 1e4) / 1e4;
  }
  function listCalendarMonthsInPeriod(startDate, endDate) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (end < start) {
      throw new Error("endDate must be on or after startDate");
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
      const kwh = Math.round(totalKwh * segment.days / totalDays);
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
    const monthFuelRates = segments.map((segment) => resolvedFuelRates[segment.yearMonth] ?? resolveFuelRate(segment.yearMonth, resolvedTariff.fuelCharge));
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
      for (let attempt = 0; attempt < 4e3; attempt += 1) {
        const weights = segments.map(() => Math.random() + 0.05);
        const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
        const kwhValues = [];
        let allocated = 0;
        weights.forEach((weight, index) => {
          if (index === weights.length - 1) {
            kwhValues.push(totalKwh - allocated);
            return;
          }
          const kwh = Math.round(totalKwh * weight / weightSum);
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
    if (!Number.isFinite(amount)) return "HK$0.00";
    const rounded = roundMoney(amount);
    const prefix = rounded < 0 ? "-HK$" : "HK$";
    return `${prefix}${Math.abs(rounded).toFixed(2)}`;
  }
  function formatClpBillLinesHtml(bill, options = {}) {
    if (!bill) return "";
    const {
      title = "\u5E33\u55AE\u8CBB\u7528\u660E\u7D30 \xB7 Bill line items",
      showInferredMonths = true
    } = options;
    const lines = [
      ["\u57FA\u672C\u96FB\u8CBB Basic charge", bill.basic],
      ["\u71C3\u6599\u8ABF\u6574\u8CBB Fuel adjustment", bill.fuel],
      ["\u4E0A\u671F\u64A5\u4F86 Brought forward", bill.broughtForward],
      ["\u96F6\u6578\u64A5\u5165\u4E0B\u6B21 Rounding carry", bill.roundingCarry]
    ];
    if (bill.other) {
      lines.push(["\u5176\u4ED6 Other", bill.other]);
    }
    const list = lines.map(([label, amount]) => `<li><span class="tariff-tier-range">${label}</span><span class="tariff-tier-rate">${formatMoneyHkd(amount)}</span></li>`).join("");
    const totalLine = `<li><span class="tariff-tier-range">\u672C\u671F\u7E3D\u6578 Total</span><span class="tariff-tier-rate">${formatMoneyHkd(bill.total)}</span><span class="tariff-tier-detail">${bill.totalKwh} \u5EA6\u96FB \xB7 \u5BE6\u6548 HK$${(bill.total / bill.totalKwh).toFixed(3)}/kWh</span></li>`;
    let monthNote = "";
    if (showInferredMonths && bill.months?.length) {
      const monthLines = bill.months.filter((month) => month.kwh > 0).map((month) => `${month.yearMonth} ${month.kwh} \u5EA6`).join(" \xB7 ");
      monthNote = `<p class="tariff-note-foot">\u4F9D\u5E33\u55AE\u91D1\u984D\u53CD\u63A8\u5206\u6708\u7528\u91CF\uFF08\u4F9B\u53C3\u8003\uFF09\uFF1A${monthLines}\u3002<span class="tariff-note-en">Monthly kWh inferred from bill amounts for reference only.</span></p>`;
    }
    return `<div class="tariff-calc-breakdown"><p class="tariff-calc-title">${title}</p><ul class="tariff-tier-list">${list}${totalLine}</ul>${monthNote}</div>`;
  }
  var ClpBillCalculator = class {
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
        throw new Error("totalKwh must be a positive number");
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
        source: "bill-lines",
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
        source: "reference-scale",
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
        throw new Error("totalKwh must be a positive number");
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
        const fuelRate = resolvedFuelRates[month.yearMonth] ?? resolveFuelRate(month.yearMonth, resolvedTariff.fuelCharge);
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
        source: "estimated",
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
  };
  if (typeof globalThis !== "undefined") {
    globalThis.ClpBillCalculator = ClpBillCalculator;
    globalThis.listCalendarMonthsInPeriod = listCalendarMonthsInPeriod;
    globalThis.splitKwhAcrossPeriod = splitKwhAcrossPeriod;
    globalThis.inferMonthlyKwhFromBillTargets = inferMonthlyKwhFromBillTargets;
    globalThis.formatClpBillLinesHtml = formatClpBillLinesHtml;
  }

  // src/domain/appliance-search.js
  var APPLIANCE_SEARCH_ALIASES = {
    refrigerator: ["fridge", "refrigerator", "\u51B0\u7BB1", "\u96EA\u67DC", "\u96EA\u6AC3"],
    freezer: ["freezer", "\u51B7\u51CD\u6AC3", "\u51B7\u51BB\u67DC", "\u51B0\u67DC"],
    wine_cooler: ["wine", "wine cooler", "\u9152\u67DC", "\u9152\u6AC3", "\u7EA2\u9152\u67DC"],
    room_ac_split: ["split ac", "split air", "\u5206\u9AD4\u51B7\u6C23", "\u5206\u4F53\u51B7\u6C14", "\u5206\u9AD4", "split"],
    room_ac_window: ["window ac", "window air", "\u7A97\u53E3\u51B7\u6C23", "\u7A97\u53E3\u51B7\u6C14", "\u7A97\u6A5F", "\u7A97\u673A", "window"],
    room_ac_reverse: ["reverse ac", "heat pump", "reverse cycle", "\u51B7\u6696\u51B7\u6C23", "\u51B7\u6696\u7A7A\u8C03", "\u9006\u8F49", "\u70ED\u6CF5", "\u71B1\u6CF5"],
    room_ac: ["ac", "aircon", "air con", "air conditioner", "a/c", "\u51B7\u6C23", "\u51B7\u6C14", "\u51B7\u6C23\u6A5F", "\u7A7A\u8C03", "\u7A7A\u8ABF", "air conditioning"],
    fan: ["fan", "electric fan", "\u96FB\u98A8\u6247", "\u7535\u98CE\u6247", "\u98CE\u6247"],
    air_purifier: ["purifier", "air purifier", "\u7A7A\u6C23\u6DE8\u5316", "\u7A7A\u6C14\u51C0\u5316", "\u51C0\u5316\u673A", "\u7A7A\u6C23\u6E05\u65B0\u6A5F"],
    dehumidifier: ["dehumidifier", "\u62BD\u6FD5\u6A5F", "\u62BD\u6E7F\u673A", "\u9664\u6E7F\u673A", "\u9664\u6FD5"],
    washing: ["washer", "washing machine", "\u6D17\u8863\u6A5F", "\u6D17\u8863\u673A", "\u6D17\u8863"],
    washer_dryer: ["washer dryer", "combo", "\u6D17\u8863\u4E7E\u8863", "\u6D17\u8863\u5E72\u8863", "\u6D17\u70D8"],
    dryer: ["dryer", "clothes dryer", "\u4E7E\u8863\u6A5F", "\u5E72\u8863\u673A", "\u70D8\u8863", "\u70D8\u5E72\u673A"],
    tv: ["tv", "television", "\u96FB\u8996", "\u7535\u89C6"],
    monitor: ["monitor", "display", "screen", "\u986F\u793A\u5668", "\u663E\u793A\u5668", "\u5C4F\u5E55", "\u87A2\u5E55"],
    desktop_pc: ["desktop", "pc", "computer", "\u96FB\u8166", "\u7535\u8111", "\u4E3B\u673A", "\u4E3B\u6A5F"],
    laptop: ["laptop", "notebook", "\u7B46\u96FB", "\u7B14\u7535", "\u7B46\u8A18\u672C", "\u7B14\u8BB0\u672C"],
    router_nas: ["router", "nas", "wifi", "\u8DEF\u7531\u5668", "\u8DEF\u7531", "\u7DB2\u7D61\u5132\u5B58", "\u7F51\u7EDC\u5B58\u50A8"],
    printer: ["printer", "print", "\u6253\u5370\u6A5F", "\u5370\u8868\u6A5F", "\u5217\u5370"],
    induction: ["induction", "induction cooker", "\u96FB\u78C1\u7210", "\u7535\u78C1\u7089"],
    microwave: ["microwave", "\u5FAE\u6CE2\u7210", "\u5FAE\u6CE2\u7089"],
    rice_cooker: ["rice cooker", "rice", "\u96FB\u98EF\u7172", "\u7535\u996D\u7172", "\u996D\u7172"],
    electric_kettle: ["kettle", "electric kettle", "\u96FB\u71B1\u6C34\u58FA", "\u7535\u70ED\u6C34\u58F6", "\u6C34\u58FA", "\u6C34\u58F6"],
    oven: ["oven", "electric oven", "\u96FB\u7117\u7210", "\u7535\u70E4\u7BB1", "\u70E4\u7BB1", "\u7117\u7210"],
    dishwasher: ["dishwasher", "\u6D17\u7897\u6A5F", "\u6D17\u7897\u673A"],
    water_heater: ["water heater", "storage heater", "geyser", "\u5132\u6C34\u5F0F", "\u50A8\u6C34\u5F0F", "\u71B1\u6C34\u7210", "\u70ED\u6C34\u7089"],
    instant_water_heater: ["instant heater", "instant water", "\u5373\u71B1\u5F0F", "\u5373\u70ED\u5F0F", "\u5373\u71B1\u7210", "\u5373\u70ED\u7089"],
    led_lamp: ["led", "led lamp", "led light", "\u71C8", "\u706F", "\u7167\u660E", "\u706F\u6CE1"],
    cfl: ["cfl", "fluorescent", "compact fluorescent", "\u6173\u96FB\u81BD", "\u7701\u7535\u80C6", "\u8282\u80FD\u706F", "\u87A2\u5149\u71C8"],
    exhaust_fan: ["exhaust fan", "vent fan", "extractor", "\u62BD\u6C23\u6247", "\u62BD\u6C14\u6247", "\u6D74\u5BA4\u5BF6", "\u6D74\u5BA4\u5B9D"],
    hair_dryer: ["hair dryer", "blow dryer", "\u98A8\u7B52", "\u98CE\u7B52", "\u5439\u98A8\u6A5F", "\u5439\u98CE\u673A"],
    iron: ["iron", "clothes iron", "\u71A8\u6597", "\u70EB\u6597", "\u71A8\u886B"],
    ev_charger: ["ev", "ev charger", "electric vehicle", "\u5145\u96FB\u6A01", "\u5145\u7535\u6869", "\u96FB\u52D5\u8ECA", "\u7535\u52A8\u8F66", "charger"],
    custom: ["custom", "other", "manual", "\u5176\u4ED6", "\u624B\u52D5", "\u624B\u52A8", "misc"]
  };
  var GROUP_ALIASES = {
    cold: ["cooling", "cold", "\u51B7\u85CF", "\u51B7\u51CD", "\u51B7\u51BB"],
    ac: ["ac", "air", "\u7A7A\u8ABF", "\u7A7A\u8C03", "\u51B7\u6C23", "\u51B7\u6C14"],
    laundry: ["laundry", "\u6D17\u8863", "\u4E7E\u8863", "\u5E72\u8863"],
    av: ["av", "audio", "video", "\u5F71\u97F3", "\u986F\u793A", "\u663E\u793A"],
    it: ["it", "tech", "computer", "\u8CC7\u8A0A", "\u8D44\u8BAF", "\u79D1\u6280"],
    kitchen: ["kitchen", "\u5EDA\u623F", "\u53A8\u623F"],
    heat_light: ["heat", "light", "hot water", "\u71B1\u6C34", "\u70ED\u6C34", "\u7167\u660E"],
    other: ["other", "misc", "\u5176\u4ED6"]
  };
  var ApplianceSearchService = class {
    constructor(catalog, groups, aliases = APPLIANCE_SEARCH_ALIASES) {
      this.catalog = catalog;
      this.groups = groups;
      this.aliases = aliases;
      this._index = this._buildIndex();
    }
    normalizeQuery(query) {
      return String(query ?? "").trim().toLowerCase().replace(/[／/\\|,，、]+/g, " ").replace(/\s+/g, " ");
    }
    _splitLabel(label) {
      return String(label).split(/[\s/·]+/).map((part) => part.trim()).filter(Boolean);
    }
    _buildIndex() {
      const groupByType = /* @__PURE__ */ new Map();
      const groupTitleById = /* @__PURE__ */ new Map();
      this.groups.forEach((group) => {
        groupTitleById.set(group.id, group.title);
        group.types.forEach((typeId) => groupByType.set(typeId, group));
      });
      const index = /* @__PURE__ */ new Map();
      Object.entries(this.catalog).forEach(([typeId, spec]) => {
        const group = groupByType.get(typeId);
        const tokens = /* @__PURE__ */ new Set();
        const add = (value) => {
          const normalized = this.normalizeQuery(value);
          if (normalized) tokens.add(normalized);
        };
        add(typeId.replace(/_/g, " "));
        this._splitLabel(spec.label).forEach(add);
        if (group) {
          this._splitLabel(group.title).forEach(add);
          (GROUP_ALIASES[group.id] || []).forEach(add);
        }
        (this.aliases[typeId] || []).forEach(add);
        index.set(typeId, {
          typeId,
          label: spec.label,
          groupId: group?.id ?? "other",
          groupTitle: group?.title ?? "\u5176\u4ED6 Other",
          tokens: [...tokens]
        });
      });
      return index;
    }
    scoreMatch(entry, query) {
      if (!query) return 1;
      const { tokens, typeId, label } = entry;
      const normalizedLabel = this.normalizeQuery(label);
      let best = 0;
      const consider = (candidate, weights) => {
        if (!candidate) return;
        if (candidate === query) best = Math.max(best, weights.exact);
        else if (candidate.startsWith(query)) best = Math.max(best, weights.prefix);
        else if (query.length >= 2 && candidate.includes(query)) best = Math.max(best, weights.contains);
      };
      consider(typeId, { exact: 95, prefix: 70, contains: 45 });
      consider(typeId.replace(/_/g, " "), { exact: 90, prefix: 65, contains: 40 });
      consider(normalizedLabel, { exact: 88, prefix: 62, contains: 38 });
      tokens.forEach((token) => {
        consider(token, { exact: 100, prefix: 75, contains: 42 });
      });
      const queryParts = query.split(" ").filter(Boolean);
      if (queryParts.length > 1) {
        const haystack = tokens.join(" ");
        if (queryParts.every((part) => haystack.includes(part))) {
          best = Math.max(best, 55);
        }
      }
      return best;
    }
    /** @returns {{ typeId: string, score: number, entry: object }[]} */
    search(query) {
      const normalized = this.normalizeQuery(query);
      if (!normalized) return [];
      const results = [];
      this._index.forEach((entry) => {
        const score = this.scoreMatch(entry, normalized);
        if (score > 0) results.push({ typeId: entry.typeId, score, entry });
      });
      return results.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label, "zh-HK"));
    }
    /** Filter group structure for picker UI; empty query returns all groups unchanged. */
    filterGroups(query) {
      const normalized = this.normalizeQuery(query);
      if (!normalized) {
        return this.groups.map((group) => ({
          ...group,
          types: [...group.types]
        }));
      }
      const matches = this.search(normalized);
      const rankedTypes = matches.map((m) => m.typeId);
      const matchSet = new Set(rankedTypes);
      const grouped = this.groups.map((group) => ({
        ...group,
        types: group.types.filter((typeId) => matchSet.has(typeId))
      })).filter((group) => group.types.length > 0);
      if (grouped.length === 0) return [];
      const order = new Map(rankedTypes.map((typeId, index) => [typeId, index]));
      grouped.forEach((group) => {
        group.types.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
      });
      return grouped;
    }
    hasMatches(query) {
      return this.filterGroups(query).length > 0;
    }
  };
  if (typeof globalThis !== "undefined") {
    globalThis.ApplianceSearchService = ApplianceSearchService;
    globalThis.APPLIANCE_SEARCH_ALIASES = APPLIANCE_SEARCH_ALIASES;
  }

  // src/domain/scan-confirm.js
  var AUTO_ADVANCE_AFTER_SCAN = false;
  var SCAN_VALIDATION_MESSAGES = {
    missing_kwh: "\u8ACB\u8F38\u5165\u6216\u78BA\u8A8D\u5E74\u8017\u96FB\u91CF \xB7 Enter or confirm annual kWh",
    kwh_low: "\u5E74\u8017\u96FB\u91CF\u504F\u4F4E\uFF0C\u8ACB\u6838\u5C0D\u6A19\u7C64\u6578\u5B57 \xB7 kWh seems low \u2014 check the label"
  };
  function validateScanForApply(kwh, { minKwh = 50 } = {}) {
    const value = Number(kwh);
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, code: "missing_kwh", message: SCAN_VALIDATION_MESSAGES.missing_kwh };
    }
    if (value < minKwh) {
      return { ok: false, code: "kwh_low", message: SCAN_VALIDATION_MESSAGES.kwh_low, warnOnly: true };
    }
    return { ok: true, code: "ok" };
  }
  if (typeof globalThis !== "undefined") {
    globalThis.AUTO_ADVANCE_AFTER_SCAN = AUTO_ADVANCE_AFTER_SCAN;
    globalThis.validateScanForApply = validateScanForApply;
    globalThis.SCAN_VALIDATION_MESSAGES = SCAN_VALIDATION_MESSAGES;
  }

  // src/domain/onboarding.js
  var ONBOARDING_STORAGE_KEY = "hk_onboarding_v1_done";
  var ONBOARDING_SLIDES = [
    {
      title: "\u6383\u63CF\u6216\u624B\u52D5\u8F38\u5165",
      titleEn: "Scan or enter manually",
      body: "\u62CD\u651D MEELS \u80FD\u6E90\u6A19\u7C64\u81EA\u52D5\u586B\u5BEB kWh\uFF0C\u6216\u8DF3\u904E\u6383\u63CF\u76F4\u63A5\u8F38\u5165\u53C3\u6578\u3002",
      bodyEn: "Photograph the MEELS label to auto-fill kWh, or skip and enter details yourself."
    },
    {
      title: "\u67E5\u770B\u96FB\u8CBB\u4F30\u7B97",
      titleEn: "See your estimate",
      body: "\u9078\u64C7\u96FB\u5668\u985E\u578B\u8207\u96FB\u529B\u516C\u53F8\uFF0C\u5373\u6642\u4F30\u7B97\u5E74\u8CBB\u8207\u6708\u8CBB\u3002",
      bodyEn: "Pick appliance type and provider to estimate annual and monthly cost."
    },
    {
      title: "\u7BA1\u7406\u5168\u5C4B\u96FB\u5668",
      titleEn: "Manage all appliances",
      body: "\u5132\u5B58\u96FB\u5668\u81F3\u300C\u6211\u7684\u96FB\u5668\u300D\uFF0C\u7528\u7D2F\u9032\u5236\u96FB\u50F9\u4F30\u7B97\u5168\u5C4B\u5E74\u8CBB\u3002",
      bodyEn: "Save appliances to My Home and estimate whole-house bills with block tariffs."
    }
  ];
  function shouldShowOnboarding(storage, { key = ONBOARDING_STORAGE_KEY } = {}) {
    try {
      return storage?.getItem(key) !== "1";
    } catch {
      return false;
    }
  }
  function markOnboardingComplete(storage, { key = ONBOARDING_STORAGE_KEY } = {}) {
    try {
      storage?.setItem(key, "1");
      return true;
    } catch {
      return false;
    }
  }
  if (typeof globalThis !== "undefined") {
    globalThis.ONBOARDING_SLIDES = ONBOARDING_SLIDES;
    globalThis.shouldShowOnboarding = shouldShowOnboarding;
    globalThis.markOnboardingComplete = markOnboardingComplete;
  }

  // src/domain/energy-label-parser.js
  var APPLIANCE_OCR_ORDER = [
    "washer_dryer",
    "room_ac_reverse",
    "room_ac_split",
    "room_ac_window",
    "room_ac",
    "refrigerator",
    "freezer",
    "wine_cooler",
    "washing",
    "dryer",
    "dehumidifier",
    "tv",
    "monitor",
    "water_heater",
    "instant_water_heater",
    "induction",
    "microwave",
    "rice_cooker",
    "electric_kettle",
    "oven",
    "dishwasher",
    "led_lamp",
    "cfl",
    "fan",
    "air_purifier",
    "desktop_pc",
    "laptop",
    "router_nas",
    "printer",
    "exhaust_fan",
    "hair_dryer",
    "iron",
    "ev_charger"
  ];
  var EnergyLabelParser = class {
    static configure({ catalog, ocrOrder = APPLIANCE_OCR_ORDER }) {
      this.catalog = catalog;
      this.ocrOrder = ocrOrder;
    }
    static normalize(text) {
      return text.replace(/\r/g, "\n").replace(/[，、]/g, ",").replace(/[：]/g, ":").replace(/[（(]\s*/g, "(").replace(/\s*[）)]/g, ")").replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248)).replace(/[．]/g, ".").replace(/(\d)[Oo](?=\d|kwh|千瓦|$)/gi, "$10").replace(/(\d)[Ss](?=\d|kwh|千瓦|$)/g, "$15").replace(/(\d)[Bb](?=\d)/g, "$18").replace(/[lI|](?=\d)/g, "1").replace(/(?<=\d)[lI|]/g, "1").replace(/(\d)\s+(\d{1,2})(?=\s*k?wh|\s*千瓦|$)/gi, "$1$2").replace(/[，]/g, "");
    }
    static parseNumbersFromText(text) {
      const cleaned = this.normalize(text).replace(/,/g, "").replace(/(\d{1,3})[.·](\d{3})\b/g, "$1$2");
      const results = [];
      const seen = /* @__PURE__ */ new Set();
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
          const lineText = line.elements?.map((el) => el.text).join("").trim();
          if (lineText) lines.push(lineText);
        });
      });
      if (lines.length) return lines;
      return text.split("\n").map((line) => line.trim()).filter(Boolean);
    }
    static scoreKwh(value, context) {
      if (!Number.isFinite(value) || value <= 0 || value >= 5e4) return -1;
      let score = 0;
      const hasKwhMarker = /kwh|千瓦時|kilowatt/i.test(context);
      const hasAnnualMarker = /年耗電量|annual\s*energy|每年耗電|耗電量/i.test(context);
      const isGradeContext = /(?:能源效益|efficiency|效益級|[1-5]\s*級|grade\s*[1-5])/i.test(context);
      if (value <= 5 && isGradeContext && !hasKwhMarker && !hasAnnualMarker) return -1;
      if (hasAnnualMarker) score += 45;
      if (hasKwhMarker) score += 35;
      if (/耗電|energy|consumption/i.test(context)) score += 18;
      if (/年|annual|year/i.test(context)) score += 12;
      if (value >= 80 && value <= 3e3) score += 25;
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
          const context = `${anchor.text} ${line.text} \u5E74\u8017\u96FB\u91CF Annual Energy Consumption kWh`;
          this.parseNumbersFromText(line.text).forEach(({ value }) => {
            let score = this.scoreKwh(value, context);
            score += Math.max(0, 24 - dy / 8);
            if (line.height >= avgHeight * 1.1) score += 12;
            if (score > 0) candidates.push({ value, score });
          });
        });
      });
      lines.forEach((line) => {
        const compact = line.text.replace(/\s/g, "");
        if (/^\d{2,4}$/.test(compact)) {
          const value = parseInt(compact, 10);
          let score = this.scoreKwh(value, `${line.text} kWh \u5E74\u8017\u96FB\u91CF`);
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
        const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
        let match;
        while ((match = globalPattern.exec(text)) !== null) {
          add(parseFloat(match[1]), match[0]);
        }
      }
      lines.forEach((line, index) => {
        const context = `${lines[index - 1] || ""} ${line} ${lines[index + 1] || ""}`;
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
        confidence: "low",
        engine: "unknown",
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
      const gradeMatch = normalized.match(/(?:能源效益|efficiency)\s*(?:級別|級|grade)?\s*[:：]?\s*([1-5])\s*(?:級|grade)?/i) || normalized.match(/\b([1-5])\s*(?:級|grade)/i);
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
        const fallbackType = result.productType && this.catalog[result.productType] ? result.productType : "custom";
        result.defaultHours = this.catalog[fallbackType].labelRatedHours;
      }
      if (result.kWh) {
        const topScore = kwhCandidates.sort((a, b) => b.score - a.score)[0]?.score || 0;
        if (topScore >= 30) result.confidence = "high";
        else if (topScore >= 18) result.confidence = "medium";
        else result.confidence = "low";
      }
      return result;
    }
  };
  __publicField(EnergyLabelParser, "catalog", {});
  __publicField(EnergyLabelParser, "ocrOrder", []);
  if (typeof globalThis !== "undefined") {
    globalThis.APPLIANCE_OCR_ORDER = APPLIANCE_OCR_ORDER;
    globalThis.EnergyLabelParser = EnergyLabelParser;
  }

  // src/domain/appliance-lookup.js
  var APPLIANCE_LOOKUP_CONFIDENCE = ["high", "medium", "low"];
  var APPLIANCE_CATEGORY_MAP = {
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
  function normalizeLookupText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }
  function validateLookupInput(brand, model) {
    const b = normalizeLookupText(brand);
    const m = normalizeLookupText(model);
    if (b.length < 2) return { ok: false, message: "\u8ACB\u8F38\u5165\u54C1\u724C\uFF08\u81F3\u5C11 2 \u500B\u5B57\uFF09\xB7 Enter brand (min 2 chars)" };
    if (m.length < 2) return { ok: false, message: "\u8ACB\u8F38\u5165\u578B\u865F\uFF08\u81F3\u5C11 2 \u500B\u5B57\uFF09\xB7 Enter model (min 2 chars)" };
    if (`${b} ${m}`.length > 120) return { ok: false, message: "\u54C1\u724C\uFF0B\u578B\u865F\u904E\u9577 \xB7 Brand + model too long" };
    return { ok: true, brand: b, model: m };
  }
  function buildGrokLookupPrompt(brand, model) {
    const validation = validateLookupInput(brand, model);
    if (!validation.ok) return "";
    const { brand: b, model: m } = validation;
    return [
      "\u8ACB\u4E0A\u7DB2\u641C\u5C0B\u4EE5\u4E0B\u9999\u6E2F\u5BB6\u7528\u96FB\u5668\u7684\u5E74\u8017\u96FB\u91CF\uFF08kWh/\u5E74\uFF0CMEELS \u80FD\u6E90\u6A19\u7C64\u512A\u5148\uFF09\u3002",
      "\u512A\u5148\u4F86\u6E90\uFF1Aemsd.gov.hk\u3001\u5EE0\u5546\u9999\u6E2F\u5B98\u7DB2\u3001\u53EF\u4FE1\u96F6\u552E\u5546\u898F\u683C\u9801\u3002",
      "",
      `\u54C1\u724C Brand: ${b}`,
      `\u578B\u865F Model: ${m}`,
      "",
      "\u8ACB\u53EA\u56DE\u8986\u4E00\u500B JSON \u7269\u4EF6\uFF08\u4E0D\u8981 markdown\u3001\u4E0D\u8981\u5176\u4ED6\u8AAA\u660E\uFF09\uFF0C\u683C\u5F0F\u5982\u4E0B\uFF1A",
      "{",
      '  "annualKwh": <number \u6216 null>,',
      '  "applianceCategory": "<\u4F8B\u5982 refrigerator / room_ac / washing>",',
      '  "ratedHours": <number \u6216 null>,',
      '  "confidence": "high" | "medium" | "low",',
      '  "sourceUrl": "<\u6700\u53EF\u9760\u4F86\u6E90\u7DB2\u5740\u6216 null>",',
      '  "summary": "<\u4E00\u53E5\u4E2D\u6587\u8AAA\u660E>",',
      '  "summaryEn": "<one-line English summary>"',
      "}",
      "",
      "Search the web for annual electricity (kWh/year) for this Hong Kong appliance.",
      "Reply with JSON only, same schema as above."
    ].join("\n");
  }
  function inferApplianceType(categoryText, catalogKeys = []) {
    const text = normalizeLookupText(categoryText);
    if (!text) return "custom";
    const allowed = new Set(catalogKeys);
    for (const [typeId, patterns] of Object.entries(APPLIANCE_CATEGORY_MAP)) {
      if (allowed.size && !allowed.has(typeId)) continue;
      if (patterns.some((pattern) => pattern.test(text))) return typeId;
    }
    const lowered = text.toLowerCase().replace(/\s+/g, "_");
    if (allowed.size && allowed.has(lowered)) return lowered;
    return "custom";
  }
  function extractKwhFromFreeText(text) {
    const normalized = String(text ?? "");
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
            applianceCategory: "",
            confidence: "low",
            sourceUrl: null,
            summary: "\u5F9E\u6587\u5B57\u62BD\u53D6 kWh \xB7 Extracted from pasted text",
            summaryEn: "Extracted from pasted text"
          };
        }
      }
    }
    throw new Error("\u627E\u4E0D\u5230 JSON \u6216 kWh \u6578\u503C \xB7 No JSON or kWh found in paste");
  }
  function extractJsonFromModelText(text) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) throw new Error("Empty paste");
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      if (start >= 0 && end > start) {
        return JSON.parse(candidate.slice(start, end + 1));
      }
    }
    return extractKwhFromFreeText(trimmed);
  }
  function parseLookupPayload(raw, catalogKeys = []) {
    if (!raw || typeof raw !== "object") {
      throw new Error("Empty lookup response");
    }
    const annualKwh = Number(raw.annualKwh ?? raw.annual_kwh ?? raw.kwh ?? raw.kWh);
    const ratedHours = Number(raw.ratedHours ?? raw.rated_hours ?? raw.labelRatedHours);
    const confidence = String(raw.confidence ?? "low").toLowerCase();
    const normalizedConfidence = APPLIANCE_LOOKUP_CONFIDENCE.includes(confidence) ? confidence : "low";
    return {
      annualKwh: Number.isFinite(annualKwh) && annualKwh > 0 ? annualKwh : null,
      applianceType: inferApplianceType(raw.applianceCategory ?? raw.applianceType ?? raw.category ?? "", catalogKeys),
      ratedHours: Number.isFinite(ratedHours) && ratedHours > 0 ? Math.round(ratedHours) : null,
      confidence: normalizedConfidence,
      sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : raw.source_url ?? null,
      summary: normalizeLookupText(raw.summary) || "",
      summaryEn: normalizeLookupText(raw.summaryEn ?? raw.summary_en) || "",
      brand: normalizeLookupText(raw.brand),
      model: normalizeLookupText(raw.model)
    };
  }
  function validateLookupResult(result, { minKwh = 10, maxKwh = 5e4 } = {}) {
    if (!result?.annualKwh) {
      return { ok: false, message: "\u672A\u80FD\u627E\u5230\u53EF\u9760\u7684\u5E74\u8017\u96FB\u91CF \xB7 Could not find annual kWh" };
    }
    if (result.annualKwh < minKwh || result.annualKwh > maxKwh) {
      return { ok: false, message: `\u5E74\u8017\u96FB\u91CF ${result.annualKwh} kWh \u4F3C\u4E4E\u4E0D\u5408\u7406 \xB7 kWh out of expected range` };
    }
    if (result.confidence === "low") {
      return {
        ok: true,
        warn: true,
        message: "\u4FE1\u5FC3\u504F\u4F4E\uFF0C\u8ACB\u6838\u5C0D Grok \u4F86\u6E90\u5F8C\u518D\u5957\u7528 \xB7 Low confidence \u2014 verify before applying"
      };
    }
    return { ok: true, warn: result.confidence === "medium", message: "" };
  }
  function formatLookupResultLabel(result) {
    if (!result?.annualKwh) return "\u2014";
    const conf = result.confidence === "high" ? "\u9AD8" : result.confidence === "medium" ? "\u4E2D" : "\u4F4E";
    return `${result.annualKwh} kWh/\u5E74 \xB7 \u4FE1\u5FC3 ${conf}`;
  }
  function extractTextFromXaiResponse(response) {
    if (!response || typeof response !== "object") {
      throw new Error("Empty xAI response");
    }
    if (typeof response.output_text === "string" && response.output_text.trim()) {
      return response.output_text.trim();
    }
    const chunks = [];
    for (const item of response.output ?? []) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part?.type === "output_text" && part.text) chunks.push(part.text);
          else if (typeof part?.text === "string") chunks.push(part.text);
        }
      }
      if (typeof item?.text === "string") chunks.push(item.text);
    }
    const text = chunks.join("\n").trim();
    if (!text) throw new Error("No text in xAI response");
    return text;
  }
  function isLookupBillingError(message) {
    return /credit|license|licence|billing|prepaid|insufficient|quota|payment/i.test(String(message ?? ""));
  }
  function formatLookupApiError(message) {
    const text = String(message ?? "").trim();
    if (isLookupBillingError(text)) {
      return "xAI API \u6C92\u6709\u9918\u984D\uFF08Grok \u804A\u5929\u8A02\u95B1 \u2260 API \u9EDE\u6578\uFF09\u3002\u8ACB\u5230 console.x.ai/billing \u5145\u503C\uFF0C\u6216\u4F7F\u7528\u4E0B\u65B9 Grok \u5099\u7528 \xB7 No API credits (Grok chat \u2260 API). Top up at console.x.ai/billing or use Grok fallback below";
    }
    return text || "\u67E5\u8A62\u5931\u6557 Lookup failed";
  }
  function processLookupModelText(text, brand, model, catalogKeys = []) {
    const raw = extractJsonFromModelText(text);
    const parsed = parseLookupPayload(raw, catalogKeys);
    if (!parsed.brand) parsed.brand = normalizeLookupText(brand);
    if (!parsed.model) parsed.model = normalizeLookupText(model);
    const validation = validateLookupResult(parsed);
    return { parsed, validation };
  }
  if (typeof globalThis !== "undefined") {
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

  // src/domain/meels-registry.js
  var MEELS_SOURCE_URL = "https://www.emsd.gov.hk/energylabel/";
  var MEELS_BRAND_ALIASES = {
    daikin: ["daikin", "\u5927\u91D1", "\u5927\u91D1\u51B7\u6C23", "\u5927\u91D1\u7A7A\u8C03"],
    panasonic: ["panasonic", "\u6A02\u8072", "\u6A02\u8072\u724C", "\u677E\u4E0B", "national"],
    samsung: ["samsung", "\u4E09\u661F"],
    siemens: ["siemens", "\u897F\u9580\u5B50", "\u897F\u95E8\u5B50"],
    lg: ["lg", "\u6A02\u91D1", "\u4E50\u91D1"],
    hitachi: ["hitachi", "\u65E5\u7ACB"],
    midea: ["midea", "\u7F8E\u7684"],
    gree: ["gree", "\u683C\u529B"],
    mitsubishi: ["mitsubishi", "\u4E09\u83F1", "\u4E09\u83F1\u96FB\u6A5F", "\u4E09\u83F1\u7535\u673A"],
    toshiba: ["toshiba", "\u6771\u829D", "\u4E1C\u829D"],
    whirlpool: ["whirlpool", "\u60E0\u800C\u6D66"],
    bosch: ["bosch", "\u535A\u4E16"],
    sharp: ["sharp", "\u8072\u5BF6", "\u58F0\u5B9D"],
    haier: ["haier", "\u6D77\u723E", "\u6D77\u5C14"],
    canson: ["canson", "\u91D1\u677E"],
    general: ["general", "\u73CD\u5BF6", "\u73CD\u5B9D"]
  };
  function cleanTrailingPartialCjk(value) {
    return String(value ?? "").replace(/[,，、]\s*[\u4e00-\u9fff]{1,4}$/u, "").trim();
  }
  function normalizeMeelsToken(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[（(]hk[)）]/gi, "").replace(/[／/\\|，、]+/g, " ").replace(/[\s\-_./]+/g, "");
  }
  function normalizeModelToken(value) {
    return normalizeMeelsToken(value).replace(/[oο]/g, "0").replace(/[il|]/g, "1");
  }
  function subsequenceScore(query, target) {
    if (!query || !target || query.length < 4) return 0;
    let qi = 0;
    for (let ti = 0; ti < target.length && qi < query.length; ti += 1) {
      if (target[ti] === query[qi]) qi += 1;
    }
    if (qi !== query.length) return 0;
    return Math.round(query.length / target.length * 72);
  }
  function splitModelVariants(model) {
    const raw = String(model ?? "");
    const parts = raw.split(/[／/\\|]+/).map((part) => normalizeMeelsToken(part)).filter(Boolean);
    const full = normalizeMeelsToken(raw);
    if (full && !parts.includes(full)) parts.unshift(full);
    return [...new Set(parts)];
  }
  function levenshteinDistance(a, b) {
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
  function similarityRatio(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const distance = levenshteinDistance(a, b);
    return 1 - distance / Math.max(a.length, b.length);
  }
  function expandBrandQueries(brand) {
    const normalized = normalizeMeelsToken(brand);
    if (!normalized) return [];
    const queries = /* @__PURE__ */ new Set([normalized]);
    for (const [canonical, aliases] of Object.entries(MEELS_BRAND_ALIASES)) {
      const aliasTokens = aliases.map(normalizeMeelsToken).filter(Boolean);
      const canonicalToken = normalizeMeelsToken(canonical);
      const hit = aliasTokens.some((alias) => alias === normalized || alias.includes(normalized) || normalized.includes(alias)) || similarityRatio(normalized, canonicalToken) >= 0.78;
      if (hit) {
        queries.add(canonicalToken);
        aliasTokens.forEach((alias) => queries.add(alias));
      }
    }
    return [...queries];
  }
  function splitLookupQuery(brand, model) {
    let normalizedBrand = cleanTrailingPartialCjk(normalizeLookupText(brand));
    let normalizedModel = normalizeLookupText(model);
    if (normalizedModel.length >= 2) {
      return { brand: normalizedBrand, model: normalizedModel };
    }
    const brandTokens = normalizedBrand.split(/\s+/).filter(Boolean);
    if (brandTokens.length >= 2) {
      const lastToken = brandTokens[brandTokens.length - 1];
      if (/[A-Za-z0-9]/.test(lastToken) && lastToken.length >= 3) {
        return {
          brand: brandTokens.slice(0, -1).join(" "),
          model: lastToken
        };
      }
    }
    if (!normalizedBrand && normalizedModel.includes(" ")) {
      const modelTokens = normalizedModel.split(/\s+/).filter(Boolean);
      if (modelTokens.length >= 2) {
        return {
          brand: modelTokens.slice(0, -1).join(" "),
          model: modelTokens[modelTokens.length - 1]
        };
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
  function scoreModelMatch(query, entryModel) {
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
  function scoreBrandMatch(brandQuery, entry) {
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
  function scoreMeelsEntry(entry, brand, model) {
    const modelScore = scoreModelMatch(model, entry.model);
    if (modelScore < 62) return 0;
    const brandScore = scoreBrandMatch(brand, entry);
    const hasBrand = Boolean(normalizeLookupText(brand));
    if (!hasBrand) {
      return modelScore >= 88 ? modelScore + 8 : modelScore >= 75 ? modelScore : 0;
    }
    if (brandScore < 18 && modelScore < 82) return 0;
    return modelScore + brandScore;
  }
  function validateMeelsLookupInput(brand, model) {
    const split = splitLookupQuery(brand, model);
    const normalizedBrand = split.brand;
    const normalizedModel = split.model;
    if (normalizedModel.length < 2) {
      return { ok: false, message: "\u8ACB\u8F38\u5165\u578B\u865F\uFF08\u81F3\u5C11 2 \u500B\u5B57\uFF09\xB7 Enter model (min 2 chars)" };
    }
    if (normalizedBrand.length < 2 && normalizedModel.length < 5) {
      return { ok: false, message: "\u578B\u865F\u8F03\u77ED\u6642\u8ACB\u540C\u6642\u8F38\u5165\u54C1\u724C \xB7 Enter brand when model is short" };
    }
    if (`${normalizedBrand} ${normalizedModel}`.length > 120) {
      return { ok: false, message: "\u54C1\u724C\uFF0B\u578B\u865F\u904E\u9577 \xB7 Brand + model too long" };
    }
    return { ok: true, brand: normalizedBrand, model: normalizedModel };
  }
  function describeMeelsMatch({ entry, score }, { brand, model }) {
    const modelScore = scoreModelMatch(model, entry.model);
    const brandScore = scoreBrandMatch(brand, entry);
    const hasBrand = Boolean(normalizeLookupText(brand));
    if (!hasBrand) return "\u50C5\u4EE5\u578B\u865F\u5339\u914D \xB7 Matched by model only";
    if (modelScore >= 95 && brandScore >= 45) return "\u54C1\u724C\u8207\u578B\u865F\u5B8C\u5168\u5339\u914D \xB7 Exact brand & model match";
    if (modelScore >= 70 && modelScore < 95) return "\u578B\u865F\u90E8\u5206\u5339\u914D \xB7 Partial model match";
    if (brandScore >= 30 && modelScore >= 80) return "\u5BB9\u932F\u5339\u914D\uFF08\u53EF\u80FD\u4FEE\u6B63\u932F\u5B57\uFF09\xB7 Fuzzy match (possible typo fix)";
    return "\u8FD1\u4F3C\u5339\u914D\uFF0C\u8ACB\u6838\u5C0D \xB7 Approximate match \u2014 please verify";
  }
  function buildMeelsLookupResult(entry, { brand, model, confidence, catalogKeys, matchNote }) {
    const applianceCategory = catalogKeys.includes(entry.category) ? entry.category : inferApplianceType(entry.category, catalogKeys);
    return parseLookupPayload({
      annualKwh: entry.annualKwh,
      applianceCategory,
      confidence,
      sourceUrl: MEELS_SOURCE_URL,
      summary: `${matchNote} \xB7 MEELS \u80FD\u6548 ${entry.grade ?? "\u2014"} \u7D1A`,
      summaryEn: `${matchNote} \xB7 MEELS grade ${entry.grade ?? "\u2014"}`,
      brand: entry.brandEn || brand,
      model: entry.model
    }, catalogKeys);
  }
  function searchMeelsRegistry(entries, brand, model, catalogKeys = [], { limit = 6 } = {}) {
    const validation = validateMeelsLookupInput(brand, model);
    if (!validation.ok) {
      return { ok: false, message: validation.message };
    }
    if (!Array.isArray(entries) || !entries.length) {
      return { ok: false, message: "MEELS \u8CC7\u6599\u672A\u8F09\u5165 \xB7 MEELS data not loaded" };
    }
    const ranked = entries.map((entry) => ({ entry, score: scoreMeelsEntry(entry, validation.brand, validation.model) })).filter((item) => item.score >= 88).sort((a, b) => b.score - a.score);
    if (!ranked.length) {
      return {
        ok: false,
        message: "\u627E\u4E0D\u5230 MEELS \u767B\u8A18\u578B\u865F \xB7 Model not found in MEELS registry"
      };
    }
    const best = ranked[0];
    const hasBrand = Boolean(validation.brand);
    const confidence = best.score >= 145 ? "high" : best.score >= 115 ? "medium" : "low";
    if (!hasBrand && ranked.filter((item) => item.score >= best.score - 8).length > 1) {
      return {
        ok: false,
        message: "\u6709\u591A\u500B\u76F8\u8FD1\u578B\u865F\uFF0C\u8ACB\u8F38\u5165\u54C1\u724C\u4EE5\u7E2E\u7A84\u7D50\u679C \xB7 Multiple close matches \u2014 add brand",
        alternatives: ranked.slice(0, limit).map((item) => ({
          brand: item.entry.brandEn,
          model: item.entry.model,
          annualKwh: item.entry.annualKwh,
          score: item.score
        }))
      };
    }
    const closeAlternatives = ranked.slice(1, limit).filter((item) => best.score - item.score <= 18);
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
  if (typeof globalThis !== "undefined") {
    globalThis.normalizeMeelsToken = normalizeMeelsToken;
    globalThis.searchMeelsRegistry = searchMeelsRegistry;
    globalThis.validateMeelsLookupInput = validateMeelsLookupInput;
    globalThis.cleanTrailingPartialCjk = cleanTrailingPartialCjk;
    globalThis.splitLookupQuery = splitLookupQuery;
    globalThis.MEELS_SOURCE_URL = MEELS_SOURCE_URL;
  }
})();
