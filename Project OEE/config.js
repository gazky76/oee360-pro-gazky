// ==================== GOOGLE SHEETS API CONFIGURATION ====================
const GOOGLE_SHEETS_CONFIG = {
    // ========== GANTI DENGAN DATA DARI GOOGLE CLOUD CONSOLE ==========
    apiKey: 'AIzaSyDFe7eZAegS0KpcRb0IX5zz2lWVOAtR62w',
    clientId: '36436836567-0np8qmhijfq45a69g11bbc5enjktnfvj.apps.googleusercontent.com', 
    spreadsheetId: '1eMbucVf_HVyKPofPSLgPUxD3GZ5rOP-4W0gxldIVEA8', 
    
    // ========== KONFIGURASI LAINNYA ==========
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    
    // Nama sheet yang digunakan
    sheets: {
        output: 'Output',
        breakdown: 'Breakdown',
        completed: 'Completed',
        pause: 'Pause',
        setting: 'Setting',
        cleaning: 'Cleaning',
        overshift: 'Overshift',
        eventLog: 'Event_Log'
    }
};