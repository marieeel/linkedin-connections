// index.ts
import { configDotenv } from 'dotenv';
import { loadContactsFromSheet, updateSheetStatus } from './sheets';
import { Contact } from './contacts';
import random from 'random';
import { setTimeout } from 'timers/promises';
import { authenticateAndSaveSession, performAction, signOut } from './playwright-manager';
import { Page } from 'playwright';
configDotenv(); // Load .env variables

// --- CONFIGURATION ---
const USER_EMAIL = process.env.USER_EMAIL || ''; // Your login email
const USER_PASSWORD = process.env.USER_PASSWORD || ''; // Your login password
const SPREADSHEET_ROWS_TO_PROCESS = process.env.SPREADSHEET_ROWS_TO_PROCESS ? parseInt(`${process.env.SPREADSHEET_ROWS_TO_PROCESS}`, 10) : 10;
const USERS = process.env.USERS || [];
const SPREADSHEET_SHEET_NAME = process.env.SPREADSHEET_SHEET_NAME || '';
const SPREADSHEET_SHEET_NAMES = process.env.SPREADSHEET_SHEET_NAMES || [];
const USER_EMAILS = process.env.USER_EMAILS || [];
const USER_PASSWORDS = process.env.USER_PASSWORDS || [];

// --- TIME DELAY ---
export async function pauseExecution(minSeconds = 10, maxSeconds = 30): Promise<void> {
  const waitTime = random.int(minSeconds, maxSeconds);
  console.log(`\n💤 Pausing for ${waitTime} seconds...`);
  await setTimeout(waitTime * 1000); // Use timers/promises for cleaner await
}

// --- PLACEHOLDER (Conceptual Action) ---
async function performActionWrapper(page: Page, contact: Contact, spreadsheet: string): Promise<boolean> {
  console.log(`\n--- Simulating action for: (${contact.name}) ---`);
  const success = await performAction(page, contact, spreadsheet);
  console.log(`Action simulated as ${success ? 'SUCCESSFUL' : 'FAILED'}.`);
  return success;
}

// --- MAIN FUNCTION ---
async function runTaskManager({
  email,
  password,
  rows,
  spreadsheet,
  signout = false,
  wait = false
} : {
  email: string,
  password: string,
  rows: number,
  spreadsheet: string,
  signout: boolean,
  wait?: boolean
}) {
  const contacts = (await loadContactsFromSheet({ spreadsheet }));

  if (signout) {
    await signOut();
  }
  
  const page = await authenticateAndSaveSession('', email, password, spreadsheet);

  if (wait) {
    return false;
  }

  if (contacts.length === 0) {
    return;
  }

  // Filter contacts that are 'Pending'
  const pendingTasks = contacts
    .map((contact, index) => ({ contact, originalIndex: index })) // Keep original sheet row index
    .filter(task => {
      return !['Done', 'Failed'].includes(task.contact.status) &&
        task.contact.url !== ''
    })
    .slice(0, parseInt(`${rows}`, 10));

  console.log(`\n*** Found ${pendingTasks.length} pending tasks to process. ***`);

  for (let i = 0; i < pendingTasks.length; i++) {
    const { contact, originalIndex } = pendingTasks[i];
    
    let newStatus: Contact['status'];

    // 1. Perform the conceptual action
    const actionSuccessful = await performActionWrapper(page, contact, spreadsheet);
    
    if (actionSuccessful) {
      newStatus = 'Done';
    } else {
      newStatus = 'Failed';
    }
    
    // 2. Update the status in the Google Sheet (using the original row index)
    // originalIndex corresponds to the 0-based index of the data, which we pass 
    // to the update function to find the correct row.
    await updateSheetStatus(spreadsheet, originalIndex, newStatus);

    // 3. Take a long, randomized pause only if it's not the last item
    if (i < pendingTasks.length - 1) {
        await pauseExecution();
    }
  }

  console.log('\nTask management complete.');
  process.exit();
}

let args: {
  user: string,
  signout: boolean,
  rows: number,
  spreadsheet: string,
  email: string,
  password: string,
  wait?: boolean
} = {
  user: '',
  signout: false,
  wait: false,
  rows: SPREADSHEET_ROWS_TO_PROCESS,
  spreadsheet: SPREADSHEET_SHEET_NAME,
  email: USER_EMAIL,
  password: USER_PASSWORD
};

if (process.argv.length > 2) {
  const values = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [name, value] = arg.split('=');
    return [name, value ?? true];
  }));
  if ('--rows' in values) {
    args.rows = parseInt(`${values['--rows']}`, 10);
  }
  if ('--signout' in values) {
    args.signout = true;
  }
  if ('--wait' in values) {
    args.wait = true;
  }
  if ('--user' in values) {
    args.user = `${values['--user']}`;
    const index = `${USERS}`.split('|').indexOf(args.user);
    if (index > -1) {
      args.spreadsheet = `${SPREADSHEET_SHEET_NAMES}`.split('|')[index];
      args.email = `${USER_EMAILS}`.split('|')[index];
      args.password = `${USER_PASSWORDS}`.split('|')[index];
    }
  }
}

runTaskManager({
  rows: args.rows,
  signout: args.signout,
  spreadsheet: args.spreadsheet,
  email: args.email,
  password: args.password,
  wait: args.wait
}).catch(err => {
  console.error('\n--- FATAL ERROR ---');
  console.error('Ensure you have enabled the Google Sheets API and your credentials path is correct.');
  console.error(err);
});