// ==================== GOOGLE SHEETS API - AUTHENTICATION ====================
class GoogleSheetsAuth {
    constructor(config) {
        this.config = config;
        this.tokenClient = null;
        this.accessToken = null;
        this.isSignedIn = false;
        this.callback = null;
    }
    
    // Inisialisasi Google API Client
    async init() {
        return new Promise((resolve, reject) => {
            // Load Google API Client Library
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                gapi.load('client', async () => {
                    try {
                        await gapi.client.init({
                            apiKey: this.config.apiKey,
                            discoveryDocs: this.config.discoveryDocs,
                        });
                        
                        // Inisialisasi token client untuk OAuth
                        this.tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: this.config.clientId,
                            scope: this.config.scope,
                            callback: (tokenResponse) => {
                                if (tokenResponse.error) {
                                    console.error('OAuth error:', tokenResponse);
                                    reject(tokenResponse);
                                    return;
                                }
                                this.accessToken = tokenResponse.access_token;
                                this.isSignedIn = true;
                                gapi.client.setToken(tokenResponse);
                                console.log('✅ Google Sheets API authenticated');
                                if (this.callback) this.callback(true);
                                resolve(true);
                            },
                        });
                        
                        // Cek apakah sudah login
                        const token = localStorage.getItem('gapi_token');
                        if (token) {
                            gapi.client.setToken(JSON.parse(token));
                            this.isSignedIn = true;
                            console.log('✅ Restored existing session');
                            resolve(true);
                        } else {
                            console.log('⏳ Need to sign in');
                            resolve(false);
                        }
                        
                    } catch (error) {
                        console.error('Failed to init Google API:', error);
                        reject(error);
                    }
                });
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    // Login / Request Access Token
    signIn() {
        return new Promise((resolve, reject) => {
            if (!this.tokenClient) {
                reject(new Error('Token client not initialized'));
                return;
            }
            
            this.callback = resolve;
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }
    
    // Logout
    signOut() {
        if (gapi.client.getToken()) {
            google.accounts.oauth2.revoke(gapi.client.getToken().access_token);
            gapi.client.setToken(null);
            localStorage.removeItem('gapi_token');
            this.isSignedIn = false;
            this.accessToken = null;
            console.log('✅ Signed out');
        }
    }
    
    // Simpan token ke localStorage
    saveToken() {
        const token = gapi.client.getToken();
        if (token) {
            localStorage.setItem('gapi_token', JSON.stringify(token));
        }
    }
    
    // Refresh token jika expired
    async refreshToken() {
        if (!this.tokenClient) return false;
        
        return new Promise((resolve) => {
            this.tokenClient.requestAccessToken({ prompt: '' });
            resolve(true);
        });
    }
}