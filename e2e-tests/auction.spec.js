import { test, expect } from '@playwright/test';

test.describe('SoldIt E2E Auction Flow', () => {
    test('Admin creates a league, Captain joins, and they run an auction', async ({ browser }) => {
        test.setTimeout(90000);

        // 1. Admin setup
        const adminContext = await browser.newContext({
            recordVideo: {
                dir: 'test-results/videos/'
            }
        });
        const adminPage = await adminContext.newPage();

        adminPage.on('console', msg => {
            if (msg.type() === 'error') console.log(`BROWSER ERROR: ${msg.text()}`);
        });

        await adminPage.goto('/');
        console.log('Admin: Landing page loaded');

        // Create League
        await adminPage.click('#create-league-btn');
        await adminPage.fill('#admin-name-input', 'Test Admin');

        // Set Team Count to 1 for the test
        await adminPage.fill('label:has-text("Teams Count") + input', '1');
        console.log('Admin: Team Count set to 1');

        // Add 2 Players manually
        await adminPage.fill('input[placeholder="Player Name"]', 'Player One');
        await adminPage.click('button:has-text("ADD")');
        await adminPage.fill('input[placeholder="Player Name"]', 'Player Two');
        await adminPage.click('button:has-text("ADD")');
        console.log('Admin: Players added');

        // Start League
        await adminPage.click('#start-league-final-btn');
        console.log('Admin: Start League clicked');

        // Wait for the SUCCESS MODAL
        const onboardingHeading = adminPage.locator('h2', { hasText: 'LEAGUE CREATED!' });
        await expect(onboardingHeading).toBeVisible({ timeout: 20000 });
        console.log('Admin: Onboarding modal visible');

        // Capture details
        const leagueCode = await adminPage.locator('#modal-league-code').textContent().then(t => t?.trim() || '');
        const captainPin = await adminPage.locator('#modal-captain-pin').textContent().then(t => t?.trim() || '');

        console.log(`Admin: Captured League Code: ${leagueCode}, Captain PIN: ${captainPin}`);

        await adminPage.click('#onboarding-close-btn');
        console.log('Admin: Modal closed');

        // 2. Captain setup
        const captainContext = await browser.newContext({
            recordVideo: {
                dir: 'test-results/videos/'
            }
        });
        const captainPage = await captainContext.newPage();

        await captainPage.goto('/');
        console.log('Captain: Landing page loaded');

        // Join League
        await captainPage.click('#join-league-btn');
        await captainPage.fill('#join-league-code-input', leagueCode);
        await captainPage.fill('#join-name-input', 'Test Team');
        await captainPage.click('#role-captain-btn');
        await captainPage.fill('#captain-pin-input', captainPin);
        await captainPage.click('#enter-room-btn');
        console.log('Captain: Join details submitted');

        // Wait for both to be in the room
        await expect(adminPage.locator('text=WAITING AREA')).toBeVisible({ timeout: 20000 });
        await expect(captainPage.locator('text=WAITING AREA')).toBeVisible({ timeout: 20000 });
        console.log('Both: In waiting area');

        // Admin starts auction
        const startAuctionBtn = adminPage.locator('#start-auction-btn');
        await expect(startAuctionBtn).toBeEnabled({ timeout: 10000 });
        await startAuctionBtn.click();
        console.log('Admin: Start Auction clicked');

        // Verify auction is live
        await expect(adminPage.locator('text=TURN:').first()).toBeVisible({ timeout: 20000 });
        await expect(captainPage.locator('text=YOUR TURN TO BID!')).toBeVisible({ timeout: 20000 });
        console.log('Both: Auction live');

        // Captain places a bid
        await captainPage.fill('#bid-amount-input', '100');
        await captainPage.click('#place-bid-btn');
        console.log('Captain: Bid placed');

        // Admin verifies bid and marks as SOLD
        await expect(adminPage.locator('text=HELD BY Test Team')).toBeVisible({ timeout: 20000 });
        // Use exact match for the bid amount to avoid strict mode violations
        await expect(adminPage.getByText('100', { exact: true })).toBeVisible({ timeout: 20000 });
        await adminPage.click('#admin-sold-btn');
        console.log('Admin: Player sold');

        // Verify player is sold
        await expect(adminPage.locator('text=SOLD to Test Team')).toBeVisible({ timeout: 20000 });
        console.log('Admin: Sale verified');

        // Cleanup
        await adminContext.close();
        await captainContext.close();
    });
});
