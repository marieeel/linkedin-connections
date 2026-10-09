// signout.ts
import { signOut } from './playwright-manager';

// --- MAIN FUNCTION ---
async function runTaskManager() {
  const page = await signOut();
  console.log('\nTask management complete.');
  process.exit();
}

runTaskManager().catch(err => {
  console.error('\n--- FATAL ERROR ---');
  console.error('Ensure you have enabled the Google Sheets API and your credentials path is correct.');
  console.error(err);
});