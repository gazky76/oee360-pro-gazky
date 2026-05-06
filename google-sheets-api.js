// ==================== GOOGLE SHEETS API v4 - CORE CLASS ====================
class GoogleSheetsAPI {
    constructor(config, auth) {
        this.config = config;
        this.auth = auth;
        this.spreadsheetId = config.spreadsheetId;
    }
    
    // ============ READ DATA ============
    async readSheet(sheetName, range = 'A:Z') {
        if (!this.auth.isSignedIn) {
            console.warn('Not signed in, cannot read sheet');
            return [];
        }
        
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!${range}`,
            });
            
            const rows = response.result.values || [];
            if (rows.length === 0) return [];
            
            // Baris pertama sebagai header
            const headers = rows[0];
            const records = [];
            
            for (let i = 1; i < rows.length; i++) {
                const record = {};
                for (let j = 0; j < headers.length; j++) {
                    record[headers[j]] = rows[i][j] || '';
                }
                records.push(record);
            }
            
            console.log(`📖 Read ${records.length} records from ${sheetName}`);
            return records;
            
        } catch (error) {
            console.error(`Error reading sheet ${sheetName}:`, error);
            return [];
        }
    }
    
    // Baca semua sheet sekaligus
    async readAllSheets() {
        const allData = {};
        
        for (const [key, sheetName] of Object.entries(this.config.sheets)) {
            allData[key] = await this.readSheet(sheetName);
        }
        
        return allData;
    }
    
    // ============ WRITE DATA (APPEND) ============
    async appendToSheet(sheetName, records, headers = null) {
        if (!this.auth.isSignedIn) {
            console.warn('Not signed in, cannot write to sheet');
            return false;
        }
        
        if (!records || records.length === 0) return true;
        
        try {
            // Prepare data rows
            const rows = [];
            
            // If headers provided and sheet might be empty, add headers first
            if (headers && await this.isSheetEmpty(sheetName)) {
                rows.push(headers);
            }
            
            // Add data rows
            for (const record of records) {
                const row = this.recordToRow(record);
                rows.push(row);
            }
            
            // Append to sheet
            const response = await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: rows }
            });
            
            console.log(`✅ Appended ${records.length} records to ${sheetName}`);
            return true;
            
        } catch (error) {
            console.error(`Error appending to ${sheetName}:`, error);
            return false;
        }
    }
    
    // ============ UPDATE DATA ============
    async updateRow(sheetName, rowNumber, record) {
        if (!this.auth.isSignedIn) return false;
        
        try {
            const range = `${sheetName}!A${rowNumber}:Z${rowNumber}`;
            const row = this.recordToRow(record);
            
            const response = await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [row] }
            });
            
            console.log(`✅ Updated row ${rowNumber} in ${sheetName}`);
            return true;
            
        } catch (error) {
            console.error(`Error updating row in ${sheetName}:`, error);
            return false;
        }
    }
    
    // ============ DELETE DATA ============
    async deleteRow(sheetName, rowNumber) {
        if (!this.auth.isSignedIn) return false;
        
        try {
            const requests = [{
                deleteDimension: {
                    range: {
                        sheetId: await this.getSheetId(sheetName),
                        dimension: 'ROWS',
                        startIndex: rowNumber - 1,
                        endIndex: rowNumber
                    }
                }
            }];
            
            const response = await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: { requests: requests }
            });
            
            console.log(`✅ Deleted row ${rowNumber} from ${sheetName}`);
            return true;
            
        } catch (error) {
            console.error(`Error deleting row from ${sheetName}:`, error);
            return false;
        }
    }
    
    // ============ BATCH UPDATE (Multiple ops) ============
    async batchUpdate(operations) {
        if (!this.auth.isSignedIn) return false;
        
        try {
            const requests = [];
            
            for (const op of operations) {
                if (op.type === 'append') {
                    // Append handled separately
                    await this.appendToSheet(op.sheet, op.records);
                } else if (op.type === 'update') {
                    requests.push({
                        updateCells: {
                            range: {
                                sheetId: await this.getSheetId(op.sheet),
                                startRowIndex: op.rowNumber - 1,
                                endRowIndex: op.rowNumber,
                                startColumnIndex: 0,
                                endColumnIndex: op.row.length
                            },
                            rows: [{ values: op.row.map(val => ({ userEnteredValue: { stringValue: val } })) }],
                            fields: 'userEnteredValue'
                        }
                    });
                } else if (op.type === 'delete') {
                    requests.push({
                        deleteDimension: {
                            range: {
                                sheetId: await this.getSheetId(op.sheet),
                                dimension: 'ROWS',
                                startIndex: op.rowNumber - 1,
                                endIndex: op.rowNumber
                            }
                        }
                    });
                }
            }
            
            if (requests.length > 0) {
                await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    resource: { requests: requests }
                });
            }
            
            return true;
            
        } catch (error) {
            console.error('Batch update error:', error);
            return false;
        }
    }
    
    // ============ SEARCH DATA ============
    async findRow(sheetName, column, value) {
        const data = await this.readSheet(sheetName);
        const columnIndex = this.getColumnIndex(data, column);
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowValues = Object.values(row);
            if (rowValues[columnIndex] === value) {
                return i + 2; // +2 karena index mulai 0 dan ada header di baris 1
            }
        }
        return -1;
    }
    
    // ============ UTILITY FUNCTIONS ============
    async isSheetEmpty(sheetName) {
        const data = await this.readSheet(sheetName);
        return data.length === 0;
    }
    
    async getSheetId(sheetName) {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
        });
        
        const sheet = response.result.sheets.find(s => s.properties.title === sheetName);
        return sheet ? sheet.properties.sheetId : null;
    }
    
    recordToRow(record) {
        // Sesuaikan urutan kolom dengan header di sheet
        return [
            record.id || '',
            record.timestamp || '',
            record.line || '',
            record.batchNo || '',
            record.operatorName || record.operator || '',
            record.shift || '',
            record.totalOutput || record.totalCumulative || '',
            record.actual || record.hourlyOutput || '',
            record.reject || record.hourlyReject || '',
            record.notes || '',
            JSON.stringify(record) // Backup full data
        ];
    }
    
    getColumnIndex(data, columnName) {
        if (data.length === 0) return 0;
        const headers = Object.keys(data[0]);
        return headers.indexOf(columnName);
    }
}