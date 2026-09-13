import axios from 'axios';
import { SHEET_RANGES, SHEET_NAMES } from '@constants/sheetColumns';
import { SheetRow, ApiResponse, SheetsResponse } from '@types/index';

interface GoogleSheetsConfig {
  spreadsheetId: string;
  apiKey: string;
  accessToken?: string;
}

class GoogleSheetsService {
  private config: GoogleSheetsConfig | null = null;
  private baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

  setConfig(config: GoogleSheetsConfig) {
    this.config = config;
  }

  private getAuthHeader() {
    if (!this.config) throw new Error('Google Sheets API not configured');
    if (this.config.accessToken) {
      return { Authorization: `Bearer ${this.config.accessToken}` };
    }
    return {};
  }

  private getApiUrl(sheetRange: string) {
    if (!this.config) throw new Error('Google Sheets API not configured');
    const params = new URLSearchParams({
      key: this.config.apiKey,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return `${this.baseUrl}/${this.config.spreadsheetId}/values/${sheetRange}?${params}`;
  }

  async fetchRecords(sheetName: string, range?: string): Promise<SheetRow[]> {
    try {
      const finalRange = range || `${sheetName}!A2:Z`;
      const url = this.getApiUrl(finalRange);

      const response = await axios.get<SheetsResponse>(url, {
        headers: this.getAuthHeader(),
      });

      if (!response.data.values) return [];

      // Convert array rows to objects using header row
      const headerRange = `${sheetName}!A1:Z1`;
      const headerUrl = this.getApiUrl(headerRange);
      const headerResponse = await axios.get<SheetsResponse>(headerUrl, {
        headers: this.getAuthHeader(),
      });

      const headers = headerResponse.data.values?.[0] || [];
      return response.data.values.map(row =>
        Object.fromEntries(headers.map((header: string, i: number) => [header, row[i] || '']))
      );
    } catch (error) {
      console.error('Error fetching records from Sheets:', error);
      throw error;
    }
  }

  async appendRecord(sheetName: string, values: (string | number)[]): Promise<ApiResponse<void>> {
    try {
      if (!this.config) throw new Error('Google Sheets API not configured');

      const url = `${this.baseUrl}/${this.config.spreadsheetId}/values/${sheetName}!A:Z:append?key=${this.config.apiKey}`;

      await axios.post(
        url,
        {
          values: [values],
          majorDimension: 'ROWS',
          insertDataOption: 'INSERT_ROWS',
        },
        { headers: this.getAuthHeader() }
      );

      return { success: true };
    } catch (error) {
      console.error('Error appending record to Sheets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateRecord(
    sheetName: string,
    range: string,
    values: (string | number)[]
  ): Promise<ApiResponse<void>> {
    try {
      if (!this.config) throw new Error('Google Sheets API not configured');

      const url = `${this.baseUrl}/${this.config.spreadsheetId}/values/${sheetName}!${range}?key=${this.config.apiKey}`;

      await axios.put(
        url,
        {
          values: [values],
          majorDimension: 'ROWS',
        },
        { headers: this.getAuthHeader() }
      );

      return { success: true };
    } catch (error) {
      console.error('Error updating record in Sheets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async clearSheet(sheetName: string): Promise<ApiResponse<void>> {
    try {
      if (!this.config) throw new Error('Google Sheets API not configured');

      const url = `${this.baseUrl}/${this.config.spreadsheetId}/values/${sheetName}!A:Z:clear?key=${this.config.apiKey}`;

      await axios.post(url, {}, { headers: this.getAuthHeader() });

      return { success: true };
    } catch (error) {
      console.error('Error clearing sheet:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getSheetMetadata(): Promise<ApiResponse<{ sheetNames: string[] }>> {
    try {
      if (!this.config) throw new Error('Google Sheets API not configured');

      const url = `${this.baseUrl}/${this.config.spreadsheetId}?key=${this.config.apiKey}`;

      const response = await axios.get(url, {
        headers: this.getAuthHeader(),
      });

      const sheetNames = response.data.sheets.map((sheet: any) => sheet.properties.title);

      return {
        success: true,
        data: { sheetNames },
      };
    } catch (error) {
      console.error('Error getting sheet metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default new GoogleSheetsService();
