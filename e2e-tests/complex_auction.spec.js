import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const CSV_PATH = path.join(__dirname, 'players_40.csv');

test.describe('SoldIt Complex E2E Auction Flow', () => {
    test.beforeAll(() => {
        // Generate 40 players CSV
        const header = 'Name, Category\n';
        const lines = Array.from({ length: 40 }, (_, i) => `Player ${i + 1}, ${['Batter', 'Bowler', 'All-Rounder', 'WK'][i % 4]}`).join('\n');
        fs.writeFileSync(CSV_PATH, header + lines);
    });

    test.afterAll(() => {
        if (fs.existsSync(CSV_PATH)) {
            fs.unlinkSync(CSV_PATH);
        }
    });

    test('Admin creates league with 40 players, 4 Captains join, perform 4 rounds with outbids, and validates insufficient purse alerts', async ({ browser }) => {
        test.setTimeout(120000);

        // 1. ADMIN SETUP
        const adminContext = await browser.newContext({
            recordVideo: {
                dir: 'test-results/videos/'
            }
        });
        const adminPage = await adminContext.newPage();

        await adminPage.goto('/');
        console.log('Admin: Landing page loaded');

        // Create League
        await adminPage.click('#create-league-btn');
        await adminPage.fill('#admin-name-input', 'League Admin');

        // Configure settings
        await adminPage.fill('label:has-text("Teams Count") + input', '4');
        await adminPage.fill('label:has-text("Squad Size") + input', '5'); // Max 5 spots
        await adminPage.fill('label:has-text("Budget") + input', '1000');
        await adminPage.fill('label:has-text("Base Price") + input', '50');

        // Upload players CSV
        await adminPage.setInputFiles('input[type="file"]', CSV_PATH);
        console.log('Admin: Configured settings and uploaded 40 players CSV');

        // Submit League Creation
        await adminPage.click('#start-league-final-btn');

        // Wait for dynamic credentials modal
        const onboardingHeading = adminPage.locator('h2', { hasText: 'LEAGUE CREATED!' });
        await expect(onboardingHeading).toBeVisible({ timeout: 25000 });

        const leagueCode = await adminPage.locator('#modal-league-code').textContent().then(t => t?.trim() || '');
        const captainPin = await adminPage.locator('#modal-captain-pin').textContent().then(t => t?.trim() || '');
        console.log(`Admin: League Code = ${leagueCode}, Captain PIN = ${captainPin}`);

        await adminPage.click('#onboarding-close-btn');

        // 2. CAPTAINS JOIN
        const captainNames = ['Captain One', 'Captain Two', 'Captain Three', 'Captain Four'];
        const captainPages = [];
        const captainContexts = [];

        for (let i = 0; i < 4; i++) {
            const ctx = await browser.newContext({
                recordVideo: {
                    dir: 'test-results/videos/'
                }
            });
            const page = await ctx.newPage();
            await page.goto('/');

            await page.click('#join-league-btn');
            await page.fill('#join-league-code-input', leagueCode);
            await page.fill('#join-name-input', captainNames[i]);
            await page.click('#role-captain-btn');
            await page.fill('#captain-pin-input', captainPin);
            await page.click('#enter-room-btn');

            captainPages.push(page);
            captainContexts.push(ctx);
            console.log(`Captain: ${captainNames[i]} joined the league`);
        }

        // Wait for all players to enter lobby waiting area
        await expect(adminPage.locator('text=WAITING AREA')).toBeVisible({ timeout: 15000 });
        for (const page of captainPages) {
            await expect(page.locator('text=WAITING AREA')).toBeVisible({ timeout: 15000 });
        }

        // 3. ADMIN STARTS AUCTION
        const startBtn = adminPage.locator('#start-auction-btn');
        await expect(startBtn).toBeEnabled({ timeout: 10000 });
        await startBtn.click();
        console.log('Admin: Started the auction');

        // 4. ROUND 1 - MULTIPLE OUTBIDS (AT LEAST 3 OUTBIDS)
        // Verify Round 1 is live
        const turnLocator = adminPage.locator('.neon-border').locator('text=/^TURN:/');
        await expect(turnLocator).toBeVisible({ timeout: 15000 });

        // Function to extract active turn name
        const getActiveTurn = async (page) => {
            const turnText = await page.locator('.neon-border').locator('text=/^TURN:/').textContent();
            return turnText?.replace('TURN: ', '')?.trim() || '';
        };

        let currentTurn = await getActiveTurn(adminPage);
        console.log(`Round 1 active turn: ${currentTurn}`);

        // Find index of the captain who has the turn
        let activeIdx = captainNames.indexOf(currentTurn);
        let firstPage = captainPages[activeIdx];

        // Bid 1: Initial Bid (e.g. 50)
        await firstPage.fill('#bid-amount-input', '50');
        await firstPage.click('#place-bid-btn');
        console.log(`Round 1: Initial bid 50 Th placed by ${currentTurn}`);

        // Wait for turn to rotate
        await adminPage.waitForTimeout(1000);
        currentTurn = await getActiveTurn(adminPage);
        activeIdx = captainNames.indexOf(currentTurn);
        let secondPage = captainPages[activeIdx];

        // Bid 2: Outbid 1 (e.g. 55)
        await secondPage.fill('#bid-amount-input', '55');
        await secondPage.click('#place-bid-btn');
        console.log(`Round 1: Outbid 1 (55 Th) placed by ${currentTurn}`);

        // Wait for turn to rotate
        await adminPage.waitForTimeout(1000);
        currentTurn = await getActiveTurn(adminPage);
        activeIdx = captainNames.indexOf(currentTurn);
        let thirdPage = captainPages[activeIdx];

        // Bid 3: Outbid 2 (e.g. 60)
        await thirdPage.fill('#bid-amount-input', '60');
        await thirdPage.click('#place-bid-btn');
        console.log(`Round 1: Outbid 2 (60 Th) placed by ${currentTurn}`);

        // Wait for turn to rotate
        await adminPage.waitForTimeout(1000);
        currentTurn = await getActiveTurn(adminPage);
        activeIdx = captainNames.indexOf(currentTurn);
        let fourthPage = captainPages[activeIdx];

        // Bid 4: Outbid 3 (e.g. 65)
        await fourthPage.fill('#bid-amount-input', '65');
        await fourthPage.click('#place-bid-btn');
        console.log(`Round 1: Outbid 3 (65 Th) placed by ${currentTurn}`);

        // Sold by Admin
        await adminPage.click('#admin-sold-btn');
        await adminPage.waitForTimeout(2000); // Wait for transition
        console.log('Round 1: Player sold by Admin');

        // 5. ROUND 2 - PURSE/BUDGET LIMIT EXCEEDED WARNING (AT LEAST 1 INSUFFICIENT PURSE CASE)
        // Wait for next player to appear
        currentTurn = await getActiveTurn(adminPage);
        activeIdx = captainNames.indexOf(currentTurn);
        let activePage = captainPages[activeIdx];

        // Setup dialog handler for Captain to verify warning alert
        let dialogMessage = '';
        activePage.once('dialog', async dialog => {
            dialogMessage = dialog.message();
            console.log(`Round 2: Received browser alert: "${dialogMessage}"`);
            await dialog.dismiss();
        });

        // Try to place an invalid bid above their budget of 1000
        await activePage.fill('#bid-amount-input', '1100');
        await activePage.click('#place-bid-btn');
        
        // Assert dialog triggered correctly
        expect(dialogMessage).toMatch(/Cannot Bid|Insufficient Budget/);
        console.log('Round 2: Verified insufficient budget alert triggered successfully');

        // Now place a valid bid
        await activePage.fill('#bid-amount-input', '100');
        await activePage.click('#place-bid-btn');

        // Sold
        await adminPage.click('#admin-sold-btn');
        await adminPage.waitForTimeout(2000);

        // 6. ROUND 3 - UNSOLD/SKIP PLAYER FLOW (UI FUNCTIONALITY CHECK)
        // Let's check Rules Modal UI functionality on Captain's page
        await captainPages[0].click('button:has-text("Rules")');
        await expect(captainPages[0].locator('text=Auction Rules')).toBeVisible();
        await captainPages[0].click('button:has-text("Got it")');
        console.log('UI Verification: Rules Modal opened and closed successfully');

        // Let's check Players List View UI functionality
        await captainPages[0].click('button:has-text("Players")');
        await expect(captainPages[0].locator('text=Player List')).toBeVisible();
        await captainPages[0].click('button:has-text("×")');
        console.log('UI Verification: Players List View opened and closed successfully');

        // Check turn and place a bid
        currentTurn = await getActiveTurn(adminPage);
        activeIdx = captainNames.indexOf(currentTurn);
        await captainPages[activeIdx].fill('#bid-amount-input', '50');
        await captainPages[activeIdx].click('#place-bid-btn');

        // Admin skips this player
        await adminPage.click('#admin-skip-btn');
        await adminPage.waitForTimeout(2000);
        console.log('Round 3: Player marked UNSOLD/SKIPPED by Admin');

        // 7. ROUND 4 - FINAL ROUND
        currentTurn = await getActiveTurn(adminPage);
        activeIdx = captainNames.indexOf(currentTurn);
        await captainPages[activeIdx].fill('#bid-amount-input', '50');
        await captainPages[activeIdx].click('#place-bid-btn');

        // Sold
        await adminPage.click('#admin-sold-btn');
        await adminPage.waitForTimeout(2000);
        console.log('Round 4: Final player sold by Admin');

        // Clean up contexts
        await adminContext.close();
        for (const ctx of captainContexts) {
            await ctx.close();
        }
        console.log('All: Contexts closed successfully');
    });
});
