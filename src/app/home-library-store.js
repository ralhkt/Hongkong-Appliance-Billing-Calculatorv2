import {
    HOME_LIBRARY_KEY,
    HOUSEHOLD_PROVIDER_KEY,
    SAVED_APPLIANCES_KEY
} from './constants.js';

function tariffs() {
    return globalThis.HK_PROGRESSIVE_TARIFFS ?? {};
}

export class HomeLibraryStore {
    constructor() {
        this.memoryState = null;
        this.cloudAvailable = false;
        this.cloudPlugin = null;
        this.cloudSyncing = false;
        this.onCloudUpdate = null;
    }

    getCloudPlugin() {
        if (!window.Capacitor?.isNativePlatform?.()) return null;
        if (!this.cloudPlugin && window.Capacitor?.isPluginAvailable?.('ICloudSync')) {
            try {
                this.cloudPlugin = window.Capacitor.registerPlugin('ICloudSync');
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

            await plugin.addListener('change', () => {
                this.handleCloudChange();
            });
            return true;
        } catch (err) {
            console.warn('iCloud sync unavailable', err);
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
            console.warn('iCloud push failed', err);
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
                /* keep in-memory fallback */
            }

            if (pushCloud) {
                await this.pushToCloud(winner);
            }
            return true;
        } finally {
            this.cloudSyncing = false;
        }
    }

    createHome(libraryName, location = '', provider = 'clp') {
        const now = new Date().toISOString();
        return {
            id: `home_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            libraryName: libraryName.trim() || '我的電器庫',
            location: location.trim(),
            provider: tariffs()[provider] ? provider : 'clp',
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
            /* fall through to migration */
        }
        return this.normalizeState(this.migrateLegacyState());
    }

    normalizeState(state) {
        const next = {
            activeHomeId: state?.activeHomeId,
            homes: Array.isArray(state?.homes) ? state.homes : []
        };
        if (!next.homes.length) {
            const home = this.createHome('我的電器庫', '');
            next.homes = [home];
            next.activeHomeId = home.id;
        }
        if (!next.homes.some((home) => home.id === next.activeHomeId)) {
            next.activeHomeId = next.homes[0].id;
        }
        next.homes = next.homes.map((home) => ({
            appliances: [],
            provider: 'clp',
            libraryName: '我的電器庫',
            location: '',
            ...home,
            appliances: Array.isArray(home.appliances) ? home.appliances : []
        }));
        return next;
    }

    migrateLegacyState() {
        let appliances = [];
        let provider = 'clp';
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

        const home = this.createHome('我的電器庫', '', provider);
        home.appliances = appliances;
        const state = { activeHomeId: home.id, homes: [home] };
        this.persist(state);
        return state;
    }

    persist(state, options = {}) {
        const normalized = this.normalizeState(state);
        normalized.lastModified = new Date().toISOString();
        this.memoryState = normalized;
        try {
            localStorage.setItem(HOME_LIBRARY_KEY, JSON.stringify(normalized));
        } catch {
            /* keep in-memory fallback */
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

    addHome(libraryName, location = '', provider = 'clp') {
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
            updatedAt: new Date().toISOString()
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
        const home = homeId
            ? this.getHomes().find((entry) => entry.id === homeId)
            : this.getActiveHome();
        return home?.appliances || [];
    }

    add(item, homeId = null) {
        const state = this.loadState();
        const targetId = homeId || state.activeHomeId;
        const home = state.homes.find((entry) => entry.id === targetId);
        if (!home) return [];
        home.appliances.unshift(item);
        home.updatedAt = new Date().toISOString();
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
            updatedAt: new Date().toISOString()
        };
        home.updatedAt = new Date().toISOString();
        this.persist(state);
        return home.appliances;
    }

    remove(id, homeId = null) {
        const state = this.loadState();
        const targetId = homeId || state.activeHomeId;
        const home = state.homes.find((entry) => entry.id === targetId);
        if (!home) return [];
        home.appliances = home.appliances.filter((item) => item.id !== id);
        home.updatedAt = new Date().toISOString();
        this.persist(state);
        return home.appliances;
    }
}
