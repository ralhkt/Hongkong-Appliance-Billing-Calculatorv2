import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCES = [
    {
        url: 'https://www.emsd.gov.hk/energylabel/files/meels_ref.csv',
        category: 'refrigerator',
        kwh: 'Annual Energy Consumption (kWh)'
    },
    {
        url: 'https://www.emsd.gov.hk/energylabel/files/meels_rac.csv',
        category: 'room_ac',
        kwh: 'Annual Energy Consumption Cooling (kWh)'
    },
    {
        url: 'https://www.emsd.gov.hk/energylabel/files/meels_wm.csv',
        category: 'washing',
        kwh: 'Annual Energy Consumption (kWh)'
    },
    {
        url: 'https://www.emsd.gov.hk/energylabel/files/meels_tv.csv',
        category: 'tv',
        kwh: 'Annual Energy Consumption (kWh)'
    },
    {
        url: 'https://www.emsd.gov.hk/energylabel/files/meels_dh.csv',
        category: 'dehumidifier',
        kwh: 'Annual Energy Consumption (kWh)'
    },
    {
        url: 'https://www.emsd.gov.hk/energylabel/files/meels_led.csv',
        category: 'led_lamp',
        kwh: 'Annual Energy Consumption (kWh)'
    },
    {
        url: 'https://www.emsd.gov.hk/energylabel/files/meels_cfl.csv',
        category: 'cfl',
        kwh: 'Annual Energy Consumption (kWh)'
    },
    {
        url: 'https://www.emsd.gov.hk/energylabel/files/meels_stewh.csv',
        category: 'water_heater',
        kwh: 'Annual Energy Consumption (kWh)'
    },
    {
        url: 'https://www.emsd.gov.hk/energylabel/files/meels_ic.csv',
        category: 'induction',
        kwh: 'Annual Energy Consumption (kWh)'
    }
];

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                field += '"';
                i += 1;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                field += ch;
            }
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (ch !== '\r') {
            field += ch;
        }
    }

    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

function rowsToObjects(rows) {
    const [header, ...body] = rows;
    return body
        .filter((line) => line.some((cell) => String(cell).trim()))
        .map((line) => Object.fromEntries(header.map((key, idx) => [key, line[idx] ?? ''])));
}

async function loadSource(source) {
    const response = await fetch(source.url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${source.url}: ${response.status}`);
    }
    const text = await response.text();
    const records = rowsToObjects(parseCsv(text));
    const entries = [];

    for (const record of records) {
        const model = String(record.Model ?? '').trim();
        const brandEn = String(record['Brand English'] ?? '').trim();
        const brandZh = String(record['Brand Traditional Chinese'] ?? '').trim();
        const annualKwh = Number(record[source.kwh]);
        if (!model || !brandEn || !Number.isFinite(annualKwh) || annualKwh <= 0) continue;

        entries.push({
            brandEn,
            brandZh,
            model,
            annualKwh,
            category: source.category,
            grade: Number(record['Energy Efficiency Grade (1 to 5)'] ?? record['Energy Efficiency Grade Cooling (1 to 5)']) || null,
            ref: String(record['Reference Number'] ?? '').trim() || null
        });
    }

    return entries;
}

const entries = [];
for (const source of SOURCES) {
    const batch = await loadSource(source);
    entries.push(...batch);
    console.log(`${source.url.split('/').pop()}: ${batch.length} models`);
}

const payload = {
    updatedAt: new Date().toISOString().slice(0, 10),
    source: 'https://www.emsd.gov.hk/energylabel/',
    count: entries.length,
    entries
};

mkdirSync(resolve(root, 'data'), { recursive: true });
mkdirSync(resolve(root, 'www/data'), { recursive: true });
const json = JSON.stringify(payload);
writeFileSync(resolve(root, 'data/meels-index.json'), json);
writeFileSync(resolve(root, 'www/data/meels-index.json'), json);
console.log(`meels-index.json: ${entries.length} entries (${(json.length / 1024).toFixed(0)} KB)`);