// ==================== GOOGLE SHEETS SYNC VIA API v4 ====================
class GoogleSheetsSyncV4 {
    constructor(api, auth) {
        this.api = api;
        this.auth = auth;
        this.isOnline = navigator.onLine;
        this.syncInterval = null;
        this.pendingSync = [];
    }
    
    async init() {
        console.log('🚀 Initializing Google Sheets API v4 sync...');
        
        // Inisialisasi auth
        await this.auth.init();
        
        // Cek login status
        if (!this.auth.isSignedIn) {
            this.showLoginButton();
        } else {
            await this.startSync();
        }
        
        // Event listeners
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }
    
    showLoginButton() {
        const loginDiv = document.createElement('div');
        loginDiv.id = 'googleSheetsLogin';
        loginDiv.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:1000;';
        loginDiv.innerHTML = `
            <button onclick="googleSheetsAuth.signIn()" style="
                background: #4285f4; color: white; border: none; 
                padding: 12px 24px; border-radius: 24px; cursor: pointer;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            ">
                🔐 Login ke Google Sheets
            </button>
        `;
        document.body.appendChild(loginDiv);
        
        // Simpan callback setelah login
        this.auth.callback = async (success) => {
            if (success) {
                document.getElementById('googleSheetsLogin')?.remove();
                await this.startSync();
                this.showNotification('✅ Terhubung ke Google Sheets', 'success');
            }
        };
    }
    
    async startSync() {
        console.log('🔄 Starting sync with Google Sheets...');
        
        // Load data dari Google Sheets
        await this.loadFromCloud();
        
        // Start auto-sync setiap 30 detik
        this.startAutoSync();
        
        // Update UI status
        this.updateUIStatus();
    }
    
    async loadFromCloud() {
        console.log('📥 Loading data from Google Sheets...');
        
        const cloudData = await this.api.readAllSheets();
        
        // Update appState dengan data dari cloud
        for (const [key, records] of Object.entries(cloudData)) {
            if (records.length > 0 && window.appState) {
                const stateKey = this.getStateKey(key);
                if (window.appState[stateKey]) {
                    // Merge data (hindari duplikat berdasarkan ID)
                    const existingIds = new Set(window.appState[stateKey].map(r => r.id));
                    const newRecords = records.filter(r => r.id && !existingIds.has(r.id));
                    
                    if (newRecords.length > 0) {
                        window.appState[stateKey] = [...window.appState[stateKey], ...newRecords];
                        console.log(`📥 Loaded ${newRecords.length} new records to ${key}`);
                    }
                }
            }
        }
        
        // Refresh tampilan
        if (typeof refreshAll === 'function') {
            await refreshAll();
        }
    }
    
    async pushToCloud(sheetType, records, isUpdate = false) {
        if (!this.auth.isSignedIn) {
            console.warn('Not signed in, pushing to pending queue');
            this.pendingSync.push({ sheetType, records, isUpdate });
            return false;
        }
        
        const sheetName = GOOGLE_SHEETS_CONFIG.sheets[sheetType];
        if (!sheetName) return false;
        
        const success = await this.api.appendToSheet(sheetName, records);
        
        if (success) {
            console.log(`📤 Pushed ${records.length} records to ${sheetName}`);
        } else {
            this.pendingSync.push({ sheetType, records, isUpdate });
        }
        
        return success;
    }
    
    async syncPending() {
        if (this.pendingSync.length === 0) return;
        
        console.log(`🔄 Syncing ${this.pendingSync.length} pending items...`);
        
        for (const item of this.pendingSync) {
            await this.pushToCloud(item.sheetType, item.records, item.isUpdate);
        }
        
        this.pendingSync = [];
    }
    
    startAutoSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        
        this.syncInterval = setInterval(() => {
            if (this.auth.isSignedIn && navigator.onLine) {
                this.syncPending();
                this.loadFromCloud();
            }
        }, 30000);
    }
    
    async handleOnline() {
        this.isOnline = true;
        this.updateUIStatus();
        
        if (this.auth.isSignedIn) {
            await this.syncPending();
            await this.loadFromCloud();
        }
        
        this.showNotification('Koneksi kembali! Data disinkronkan.', 'success');
    }
    
    handleOffline() {
        this.isOnline = false;
        this.updateUIStatus();
        this.showNotification('Mode offline - Data disimpan lokal', 'warning');
    }
    
    updateUIStatus() {
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        
        if (this.auth.isSignedIn && this.isOnline) {
            if (dot) dot.className = 'status-dot online';
            if (text) text.innerHTML = 'ONLINE ☁️ (Google Sheets API)';
        } else if (this.auth.isSignedIn && !this.isOnline) {
            if (dot) dot.className = 'status-dot offline';
            if (text) text.innerHTML = 'OFFLINE (Terhubung API)';
        } else {
            if (dot) dot.className = 'status-dot offline';
            if (text) text.innerHTML = 'NOT LOGIN ⚠️';
        }
    }
    
    getStateKey(sheetKey) {
        const map = {
            'output': 'outputData',
            'breakdown': 'breakdownData',
            'completed': 'completed',
            'pause': 'pauseData',
            'setting': 'settingData',
            'cleaning': 'cleaningData',
            'overshift': 'overshiftHistory',
            'eventLog': 'eventLog'
        };
        return map[sheetKey] || sheetKey;
    }
    
    showNotification(message, type) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
    
    // Wrapper untuk fungsi CRUD existing
    async saveOutput(outputRecord) {
        return this.pushToCloud('output', [outputRecord]);
    }
    
    async saveBreakdown(breakdownRecord) {
        return this.pushToCloud('breakdown', [breakdownRecord]);
    }
    
    async saveCompleted(completedRecord) {
        return this.pushToCloud('completed', [completedRecord]);
    }
    
    async savePause(pauseRecord) {
        return this.pushToCloud('pause', [pauseRecord]);
    }
    
    async saveSetting(settingRecord) {
        return this.pushToCloud('setting', [settingRecord]);
    }
    
    async saveCleaning(cleaningRecord) {
        return this.pushToCloud('cleaning', [cleaningRecord]);
    }
    
    async saveOvershift(overshiftRecord) {
        return this.pushToCloud('overshift', [overshiftRecord]);
    }
}