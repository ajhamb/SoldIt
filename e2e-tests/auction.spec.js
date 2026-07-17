import { test, expect } from '@playwright/test';

test.describe('SoldIt E2E Auction Flow', () => {
    test('Admin creates a league, invites Captain, and they run an auction', async ({ browser }) => {
        test.setTimeout(90000);

        // 1. Admin setup
        const adminContext = await browser.newContext({
            recordVideo: {
                dir: 'test-results/videos/'
            }
        });
        const adminPage = await adminContext.newPage();

        adminPage.on('console', msg => {
            console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
        });
        adminPage.on('pageerror', err => {
            console.error(`BROWSER EXCEPTION: ${err.message}\n${err.stack}`);
        });

        // Navigate first to set origin, then inject mock Admin user and reload
        await adminPage.goto('/');
        await adminPage.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'admin@test.com',
                user_metadata: { full_name: 'Test Admin' }
            }));
        });
        await adminPage.goto('/');
        console.log('Admin: Landing page loaded with mock session');

        const html = await adminPage.content();
        console.log("PAGE HTML CONTENT:", html);
        await adminPage.screenshot({ path: 'client/dist/debug-screenshot.png' }); // Save inside client/dist so we can view it!

        // Create League
        await adminPage.click('#create-league-btn');
        await adminPage.fill('#league-name-input', 'Test League');

        // Set Team Count to 1 for the test
        await adminPage.fill('#league-teams-input', '1');
        console.log('Admin: Team Count set to 1');

        // Add 2 Players manually
        await adminPage.fill('#manual-player-name', 'Player One');
        await adminPage.click('#add-player-btn');
        await adminPage.fill('#manual-player-name', 'Player Two');
        await adminPage.click('#add-player-btn');
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
        console.log(`Admin: Captured League Code: ${leagueCode}`);

        await adminPage.click('#onboarding-close-btn');
        console.log('Admin: Modal closed');

        // Invite Captain
        await adminPage.fill('input[placeholder="captain@example.com"]', 'captain@test.com');
        await adminPage.click('button:has-text("Invite")');
        await expect(adminPage.locator('div').filter({ hasText: 'captain@test.com' }).first()).toBeVisible({ timeout: 10000 });
        console.log('Admin: Sent invitation to captain@test.com');

        // 2. Captain setup
        const captainContext = await browser.newContext({
            recordVideo: {
                dir: 'test-results/videos/'
            }
        });
        const captainPage = await captainContext.newPage();

        // Navigate first to set origin, then inject mock Captain user and reload
        await captainPage.goto('/');
        await captainPage.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'captain@test.com',
                user_metadata: { full_name: 'Test Captain' }
            }));
        });
        await captainPage.goto('/');
        console.log('Captain: Landing page loaded with mock session');

        // Verify invited league card shows up
        const leagueCard = captainPage.locator('.league-card', { hasText: leagueCode });
        await expect(leagueCard).toBeVisible({ timeout: 20000 });

        // Join League
        await leagueCard.locator('button:has-text("Join Draft")').click();
        await captainPage.fill('#captain-team-name-input', 'Test Team');
        await captainPage.click('#confirm-join-btn');
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
