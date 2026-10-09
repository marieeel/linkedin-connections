// playwright-manager.ts
import { chromium, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import { Contact } from './contacts';
import { pauseExecution } from '.';
import { configDotenv } from 'dotenv';
configDotenv(); // Load .env variables


// --- CONFIGURATION ---
// Base directory to store the session files (cookies, local storage, etc.)
const USER_DATA_DIR = path.join(process.cwd(), 'playwright-sessions');
const SPREADSHEET_SHEET_NAME = process.env.SPREADSHEET_SHEET_NAME;
// Function to log in and save the session state for a new account
// You must run this once for each of your five accounts.
export async function authenticateAndSaveSession(accountId: string, username: string, password: string, spreadsheet: string): Promise<Page> {
    const sessionDir = path.join(USER_DATA_DIR, accountId);
    
    // Launch a persistent context to log in
    const context = await chromium.launchPersistentContext(sessionDir, {
        headless: false, // Must be visible for initial login
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    try {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
        // Check if already logged in (by checking for the login form)
        const isLoginPage = await page.locator('#username').isVisible();
        if (isLoginPage) {
            console.log(`✍️ Authenticating account: ${username}...`);
            await page.fill('#username', username);
            await page.fill('#password', password);
            await page.click('button[type=submit]');
            await page.waitForURL('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
            console.log(`✅ Successfully logged in and saved session for ${username}.`);
        } else if (await page.locator('.memberList-container').isVisible()) {
            const names = await page.locator('.profile__identity').allTextContents();
            const handlers = await page.locator('.profile__handle').allTextContents();
            const accounts = Object.fromEntries(handlers.map((handler, i) => {
                let email = handler;
                const name = names[i].replaceAll(/\n/gi, '').trim();
                // match jobsitesentry email format
                if (/\w\*+@jobsitesentry.com/g.test(handler)) {
                    // first letter of email matches
                    const emailMatch = new RegExp(`${username.at(0)?.toLowerCase()}\\*+@jobsitesentry.com`, 'g').test(handler);
                    const nameMatch = new RegExp(`${name.split(' ')[0]}`, 'gi').test(`${spreadsheet}`);
                    console.log({
                        emailMatch, nameMatch
                    })
                    if (emailMatch && nameMatch) {
                        return [username, name];
                    }
                }
                return [email, name];
            }));
            console.log(`✅ Accounts loaded:`);
            console.table(accounts);
            const buttonSelector = `button[aria-label="Login as ${accounts[username]}"],button[aria-label="Iniciar sesión como ${accounts[username]}"]`;
            if (accounts[username]) {
                await page.locator(buttonSelector).isVisible();
                await page.click(buttonSelector);
                console.log(`✅ Successfully logged in and saved session for ${accounts[username]}.`);
            } else {
                await page.locator(`button.signin-other-account`).isVisible();
                await page.click(`button.signin-other-account`);
                await page.waitForSelector('#username');
                await page.fill('#username', username);
                await page.fill('#password', password);
                await page.click('button[type=submit]');
                console.log(`✅ Successfully logged in with another account.`);
            }
        } else {
            console.log(`Account ${username} session already active. Skipping login.`);
        }
        
    } catch (error) {
        console.error(`Authentication failed for ${username}:`, error);
    } finally {
        // await context.close();
    }
    return page;
}

export const signOut = async (accountId = 'signout') => {
    const sessionDir = path.join(USER_DATA_DIR, accountId);
    
    const context = await chromium.launchPersistentContext(sessionDir, {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    try {
        await page.goto('https://www.linkedin.com/m/logout/', { waitUntil: 'domcontentloaded' });
    } catch (error) {
        console.error(`Authentication failed for ${accountId}:`, error);
    } finally {
        // await context.close();
    }
    return page;
}


/**
 * Launches a Playwright browser context using the saved session state for a specific account.
 * @param accountId - The unique ID of the account whose session state should be loaded.
 * @returns A Playwright Page object.
 */
export async function getAccountPage(accountId: string): Promise<{ context: BrowserContext, page: Page }> {
    const sessionDir = path.join(USER_DATA_DIR, accountId);
    
    // Launch a persistent context which loads the saved cookies/storage from the sessionDir
    const context = await chromium.launchPersistentContext(sessionDir, {
        headless: true, // Run in the background for production tasks
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Use the first page in the context, or create a new one
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    return { context, page };
}


/**
 * SAFE, COMPLIANT ACTION TEMPLATE: Navigates to a post URL and extracts its title.
 * You can adapt this logic for your specific, compliant task.
 * @param contact - The contact object containing the URL and accountId.
 */

const memberId = '.artdeco-card[data-member-id]';
const componentKey = '[componentkey^="com.linkedin.sdui.profile.card"][componentkey$="Topcard"]';
const dropdownFollow = '[data-view-name="edge-creation-follow-action"] [role="menuitem"]';
const dropdownConnect = '[data-view-name="edge-creation-connect-action"] [role="menuitem"]';

const selectors = {
    unfollow: `${memberId} div[aria-label^="Unfollow"], ${componentKey} div[aria-label^="Dejar de seguir"], ${componentKey} div[aria-label^="Unfollow"]`,
    pending: `${memberId} button[aria-label^="Pending, click to withdraw invitation sent to"], ${componentKey} button[aria-label^="Pendiente. Haz clic para retirar la invitación enviada a"], ${componentKey} button[aria-label^="Pending, click to withdraw invitation sent to"]`,
    follow: `${memberId} button[aria-label^="Follow"], ${componentKey} button[aria-label^="Seguir a"], ${componentKey} button[aria-label^="Follow"]`,
    connect: `${memberId} [aria-label^="Invite"], ${componentKey} [aria-label^="Invita"], ${componentKey} [aria-label^="Invite"]`,
    more: `${memberId} button[aria-label="More actions"], ${componentKey} button[aria-label="Más"], ${componentKey} button[aria-label="More"]`,
    dropdown: (action: 'follow' | 'connect') => {
        return action === 'follow' ?
            `${memberId} [aria-label^="Follow"], ${dropdownFollow} [aria-label^="Seguir a"], ${dropdownFollow} [aria-label^="Follow"]` :
            `${memberId} [aria-label^="Invite"], ${dropdownConnect} [aria-label^="Invita"], ${dropdownConnect} [aria-label^="Invite"]`;
    },
    dropdownUnfollow: '[aria-label^="Following, click to unfollow"], [aria-label^="Siguiendo, haz clic para dejar de seguir a"]',
    sendWithoutANote: '[aria-label="Send without a note"]',
    noteInput: '[name="email"]',
    addANote: '[aria-label="Add a note"]',
    addANoteMessage: '#custom-message',
    dismissNote: '[aria-label="Dismiss"]'
};

enum ACTIONS {
    'without-note',
    'with-note',
    'follow',
    'connect',
    'more',
    'load',
    'dropdown'
}

export async function performAction(page: Page, contact: Contact, spreadsheet: string): Promise<boolean> {
    let failed = false;
    let isFollow = false;
    let isConnect = false;

    console.log(`\n--- Using ${contact.name} to process: ${contact.url} ---`);

    const screenshot = async (action: keyof typeof ACTIONS) => {
        await page.screenshot({ path: `screenshots/${spreadsheet}/${contact.name.toLocaleLowerCase().split(' ').join('-')}/${new Date().toISOString()}-${action}.png` })
    }

    const withoutANoteModal = async () => {
        await page.waitForSelector(selectors.sendWithoutANote, { state: 'visible', timeout: 10000 });
        const sendWithoutANoteButton = page.locator(selectors.sendWithoutANote);
        let isSendWithoutANoteButtonDisabled = await sendWithoutANoteButton.isDisabled();
        if (isSendWithoutANoteButtonDisabled) {
            console.log(`🎙 This contact needs custom message.`);
            screenshot('with-note');
            await page.waitForSelector(selectors.dismissNote, { state: 'visible', timeout: 10000 });
            await page.click(selectors.dismissNote);
            return false;
            await page.locator(selectors.noteInput).isVisible();
            await page.fill(selectors.noteInput, `Hi ${contact.name}!, I'm ${SPREADSHEET_SHEET_NAME} from Job Site Sentry, I would like to connect with you.`);
            await page.waitForSelector(selectors.sendWithoutANote, { state: 'visible', timeout: 10000 });
            isSendWithoutANoteButtonDisabled = await sendWithoutANoteButton.isDisabled();
            screenshot('without-note');
            if (isSendWithoutANoteButtonDisabled) {
                await page.locator(selectors.noteInput).isVisible();
                await page.click(selectors.addANote);
                screenshot('with-note');
                await page.locator(selectors.addANoteMessage).isVisible();
                await page.fill(selectors.addANoteMessage, `Hello [Name], I'm currently the [Your Role] at [Your Company]. I've been following your impressive work in [Their Niche] and believe there could be a mutual benefit in connecting to discuss potential [Collaboration/Projects/Roles]. Would you be open to a quick chat?`);
            }
        } else {
            await page.click(selectors.sendWithoutANote);
        }

        await screenshot('without-note');
        await pauseExecution(3, 5);
        return true;
    }

    const connect = async () => {
        await page.waitForSelector(selectors.connect, { state: 'visible', timeout: 10000 });
        await page.click(selectors.connect);
        await screenshot('connect');
        await pauseExecution(3, 5);

        if (await page.locator('.ip-fuse-limit-alert').isVisible()) {
            console.log(`🥸 You’ve reached the weekly invitation limit.`);
            return false;   
        }

        return await withoutANoteModal();
    }

    const follow = async () => {
        await page.waitForSelector(selectors.follow, { state: 'visible', timeout: 10000 });
        await page.click(selectors.follow);
        await screenshot('follow');
        await pauseExecution(8, 10);
    }

    const dropdown = async (action: 'follow' | 'connect') => {
        console.log(`🔍 Looking for [${action}] in Dropdown`);
        if (action === 'follow' && await page.locator(selectors.dropdownUnfollow).isVisible()) {
            console.log(`✅ [${action}] already following this contact.`);
            return true;
        }
        if (await page.locator(selectors.dropdown(action)).isVisible()) {
            await page.waitForSelector(selectors.dropdown(action), { state: 'visible', timeout: 10000 });
            await page.click(selectors.dropdown(action));
            await screenshot('dropdown');
            await pauseExecution(3, 5);
            if (action === 'connect') {
                return await withoutANoteModal();
            }
            return true;
        } else {
            console.log(`❌ [${action}] button is not in dropdown.`);
        }
        return false;
    }

    const more = async () => {
        if (await page.locator(selectors.more).isVisible()) {
            await page.waitForSelector(selectors.more, { state: 'visible', timeout: 10000 });
            await page.click(selectors.more);await screenshot('more');
            await pauseExecution(3, 5);
        }
    }

    await page.goto(contact.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pauseExecution(1, 3);
    await screenshot('load');

    if (await page.locator('.not-found__header').isVisible()) {
        console.log('[Not Found]');
        return false;
    }

    if (!failed) {
        if (await page.locator(selectors.follow).isVisible()) {
            console.log('Follow button visible.');
            await follow();
            isFollow = true;
        } else {
            console.log('Follow button not found.');
        }
        
        if (await page.locator(selectors.pending).isVisible()) {
            console.log('✅ Pending connection.');
            isConnect = true;
        } else if (await page.locator(selectors.connect).isVisible()) {
            console.log('Connect button visible.');
            isConnect = await connect();
        } else {
            console.log('Connect button not found.');
        }
    
        if (!isFollow) {
            console.log('Follow through More Dropdown.');
            await more();
            if (await page.locator(selectors.unfollow).isVisible()) {
                isFollow = true;
            } else {
                isFollow = await dropdown('follow');
            }
            await more();
        }
        if (!isConnect) {
            console.log('Connect through More Dropdown.');
            await more();
            isConnect = await dropdown('connect');
        }
    }
    const result = !failed && isFollow && isConnect;
    if (result) {
        console.log(`[Playwright] Successfully loaded contact ${contact.name} and follow + connect.`);
    } else {
        console.log({ failed, contact, isFollow, isConnect });
    }
    return result;
}
