// sheets.ts
import { configDotenv } from 'dotenv';
import { google } from 'googleapis';
import * as path from 'path';
import { Contact } from './contacts';
configDotenv(); // Load .env variables

// --- CONFIGURATION ---
// You will need to replace these with your actual sheet details
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SPREADSHEET_SHEET_COLUMN_UPDATE = process.env.SPREADSHEET_SHEET_COLUMN_UPDATE;
const RANGE = `!A2:${SPREADSHEET_SHEET_COLUMN_UPDATE}`; // Assuming your data starts in row 2

// --- AUTHENTICATION & API SETUP ---
const auth = new google.auth.GoogleAuth({
  // Use the path to your credentials file (e.g., loaded from .env)
  keyFile: path.join(__dirname, 'credentials.json'), 
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Fetches data from the Google Sheet and converts it into Contact objects.
 * Assumes the sheet columns are ordered: URL, Account ID, Status (optional).
 */
export async function loadContactsFromSheet({ spreadsheet = '' }): Promise<Contact[]> {
  console.log(`🔗 Connecting to Google Sheets (${spreadsheet})`);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${spreadsheet}${RANGE}`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('❌ No data found in sheet.');
      return [];
    }

    // Convert the API response rows (arrays) into Contact objects
    const contacts: Contact[] = rows.map((row: any[]) => ({
      // Assume column 0 is URL, column 1 is Account ID, column 2 is Status
      name: ([row[1], row[0]].filter(Boolean).join(' ')) || 'Default',
      url: row[15] || '',
      // If status isn't provided or is empty, default to 'Pending'
      status: (row[16] as Contact['status']) || 'Pending' 
    }));

    console.log(`✅ Loaded ${contacts.length.toLocaleString('en-US')} contacts from the sheet.`);
    return contacts;

  } catch (err) {
    console.error('An error occurred loading the sheet:', err);
    return [];
  }
}

/**
 * Updates a specific cell in the sheet with the new status.
 * This is crucial for updating the list after processing a contact.
 * NOTE: This is less efficient than batch updating but simpler for a loop.
 */
export async function updateSheetStatus(spreadsheet: string, rowIndex: number, newStatus: Contact['status']): Promise<void> {
  const absoluteRow = rowIndex + 2; // +1 for 1-based index, +1 for header row
  const updateRange = `${spreadsheet}!${SPREADSHEET_SHEET_COLUMN_UPDATE}${absoluteRow}`; // Assuming Status is in Column C
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: updateRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[newStatus]],
    },
  });
  console.log(`💥 Sheet status updated for row ${absoluteRow}.`);
}