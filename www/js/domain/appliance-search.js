/**
 * Bilingual appliance search — domain layer (testable, no DOM).
 * Aliases support English, Chinese, and common abbreviations (e.g. AC → 冷氣機).
 */
const APPLIANCE_SEARCH_ALIASES = {
    refrigerator: ['fridge', 'refrigerator', '冰箱', '雪柜', '雪櫃'],
    freezer: ['freezer', '冷凍櫃', '冷冻柜', '冰柜'],
    wine_cooler: ['wine', 'wine cooler', '酒柜', '酒櫃', '红酒柜'],
    room_ac_split: ['split ac', 'split air', '分體冷氣', '分体冷气', '分體', 'split'],
    room_ac_window: ['window ac', 'window air', '窗口冷氣', '窗口冷气', '窗機', '窗机', 'window'],
    room_ac_reverse: ['reverse ac', 'heat pump', 'reverse cycle', '冷暖冷氣', '冷暖空调', '逆轉', '热泵', '熱泵'],
    room_ac: ['ac', 'aircon', 'air con', 'air conditioner', 'a/c', '冷氣', '冷气', '冷氣機', '空调', '空調', 'air conditioning'],
    fan: ['fan', 'electric fan', '電風扇', '电风扇', '风扇'],
    air_purifier: ['purifier', 'air purifier', '空氣淨化', '空气净化', '净化机', '空氣清新機'],
    dehumidifier: ['dehumidifier', '抽濕機', '抽湿机', '除湿机', '除濕'],
    washing: ['washer', 'washing machine', '洗衣機', '洗衣机', '洗衣'],
    washer_dryer: ['washer dryer', 'combo', '洗衣乾衣', '洗衣干衣', '洗烘'],
    dryer: ['dryer', 'clothes dryer', '乾衣機', '干衣机', '烘衣', '烘干机'],
    tv: ['tv', 'television', '電視', '电视'],
    monitor: ['monitor', 'display', 'screen', '顯示器', '显示器', '屏幕', '螢幕'],
    desktop_pc: ['desktop', 'pc', 'computer', '電腦', '电脑', '主机', '主機'],
    laptop: ['laptop', 'notebook', '筆電', '笔电', '筆記本', '笔记本'],
    router_nas: ['router', 'nas', 'wifi', '路由器', '路由', '網絡儲存', '网络存储'],
    printer: ['printer', 'print', '打印機', '印表機', '列印'],
    induction: ['induction', 'induction cooker', '電磁爐', '电磁炉'],
    microwave: ['microwave', '微波爐', '微波炉'],
    rice_cooker: ['rice cooker', 'rice', '電飯煲', '电饭煲', '饭煲'],
    electric_kettle: ['kettle', 'electric kettle', '電熱水壺', '电热水壶', '水壺', '水壶'],
    oven: ['oven', 'electric oven', '電焗爐', '电烤箱', '烤箱', '焗爐'],
    dishwasher: ['dishwasher', '洗碗機', '洗碗机'],
    water_heater: ['water heater', 'storage heater', 'geyser', '儲水式', '储水式', '熱水爐', '热水炉'],
    instant_water_heater: ['instant heater', 'instant water', '即熱式', '即热式', '即熱爐', '即热炉'],
    led_lamp: ['led', 'led lamp', 'led light', '燈', '灯', '照明', '灯泡'],
    cfl: ['cfl', 'fluorescent', 'compact fluorescent', '慳電膽', '省电胆', '节能灯', '螢光燈'],
    exhaust_fan: ['exhaust fan', 'vent fan', 'extractor', '抽氣扇', '抽气扇', '浴室寶', '浴室宝'],
    hair_dryer: ['hair dryer', 'blow dryer', '風筒', '风筒', '吹風機', '吹风机'],
    iron: ['iron', 'clothes iron', '熨斗', '烫斗', '熨衫'],
    ev_charger: ['ev', 'ev charger', 'electric vehicle', '充電樁', '充电桩', '電動車', '电动车', 'charger'],
    custom: ['custom', 'other', 'manual', '其他', '手動', '手动', 'misc']
};

const GROUP_ALIASES = {
    cold: ['cooling', 'cold', '冷藏', '冷凍', '冷冻'],
    ac: ['ac', 'air', '空調', '空调', '冷氣', '冷气'],
    laundry: ['laundry', '洗衣', '乾衣', '干衣'],
    av: ['av', 'audio', 'video', '影音', '顯示', '显示'],
    it: ['it', 'tech', 'computer', '資訊', '资讯', '科技'],
    kitchen: ['kitchen', '廚房', '厨房'],
    heat_light: ['heat', 'light', 'hot water', '熱水', '热水', '照明'],
    other: ['other', 'misc', '其他']
};

class ApplianceSearchService {
    constructor(catalog, groups, aliases = APPLIANCE_SEARCH_ALIASES) {
        this.catalog = catalog;
        this.groups = groups;
        this.aliases = aliases;
        this._index = this._buildIndex();
    }

    normalizeQuery(query) {
        return String(query ?? '')
            .trim()
            .toLowerCase()
            .replace(/[／/\\|,，、]+/g, ' ')
            .replace(/\s+/g, ' ');
    }

    _splitLabel(label) {
        return String(label)
            .split(/[\s/·]+/)
            .map((part) => part.trim())
            .filter(Boolean);
    }

    _buildIndex() {
        const groupByType = new Map();
        const groupTitleById = new Map();
        this.groups.forEach((group) => {
            groupTitleById.set(group.id, group.title);
            group.types.forEach((typeId) => groupByType.set(typeId, group));
        });

        const index = new Map();
        Object.entries(this.catalog).forEach(([typeId, spec]) => {
            const group = groupByType.get(typeId);
            const tokens = new Set();
            const add = (value) => {
                const normalized = this.normalizeQuery(value);
                if (normalized) tokens.add(normalized);
            };

            add(typeId.replace(/_/g, ' '));
            this._splitLabel(spec.label).forEach(add);
            if (group) {
                this._splitLabel(group.title).forEach(add);
                (GROUP_ALIASES[group.id] || []).forEach(add);
            }
            (this.aliases[typeId] || []).forEach(add);

            index.set(typeId, {
                typeId,
                label: spec.label,
                groupId: group?.id ?? 'other',
                groupTitle: group?.title ?? '其他 Other',
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
        consider(typeId.replace(/_/g, ' '), { exact: 90, prefix: 65, contains: 40 });
        consider(normalizedLabel, { exact: 88, prefix: 62, contains: 38 });

        tokens.forEach((token) => {
            consider(token, { exact: 100, prefix: 75, contains: 42 });
        });

        const queryParts = query.split(' ').filter(Boolean);
        if (queryParts.length > 1) {
            const haystack = tokens.join(' ');
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

        return results.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label, 'zh-HK'));
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

        const grouped = this.groups
            .map((group) => ({
                ...group,
                types: group.types.filter((typeId) => matchSet.has(typeId))
            }))
            .filter((group) => group.types.length > 0);

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
}

if (typeof globalThis !== 'undefined') {
    globalThis.ApplianceSearchService = ApplianceSearchService;
    globalThis.APPLIANCE_SEARCH_ALIASES = APPLIANCE_SEARCH_ALIASES;
}