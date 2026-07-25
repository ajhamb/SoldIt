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

        // Capture League Code from header
        const headerText = await adminPage.locator('h2:has-text("LEAGUE:")').textContent({ timeout: 20000 });
        const leagueCode = headerText?.replace('LEAGUE:', '').trim() || '';
        console.log(`Admin: Captured League Code: ${leagueCode}`);

        // Invite Captain
        await adminPage.fill('input[placeholder="captain@example.com"]', 'captain@test.com');
        await adminPage.click('button:has-text("Invite")');
        await expect(adminPage.locator('span', { hasText: 'captain@test.com' }).first()).toBeVisible({ timeout: 15000 });
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

        // Verify player is automatically sold since there's only 1 team in the league
        await expect(adminPage.locator('text=SOLD to Test Team')).toBeVisible({ timeout: 20000 });
        console.log('Admin: Sale verified (automatic sold)');

        // Cleanup
        await adminContext.close();
        await captainContext.close();
    });

    test('Admin invites co-Admin, adjusts team count, and reassigns sold player manually reducing price', async ({ browser }) => {
        test.setTimeout(90000);

        // 1. Admin setup
        const adminContext = await browser.newContext({
            recordVideo: { dir: 'test-results/videos/' }
        });
        const adminPage = await adminContext.newPage();

        // Navigate first to set origin, then inject mock Admin user and reload
        await adminPage.goto('/');
        await adminPage.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'admin@test.com',
                user_metadata: { full_name: 'Test Admin' }
            }));
        });
        await adminPage.goto('/');
        console.log('Admin: Loaded mock session');

        // Create League
        await adminPage.click('#create-league-btn');
        await adminPage.fill('#league-name-input', 'Advanced Features League');

        // Set Team Count to 2 for initial creation
        await adminPage.fill('#league-teams-input', '2');
        console.log('Admin: Set initial team count to 2');

        // Add 2 Players manually
        await adminPage.fill('#manual-player-name', 'Player Alpha');
        await adminPage.click('#add-player-btn');
        await adminPage.fill('#manual-player-name', 'Player Beta');
        await adminPage.click('#add-player-btn');
        console.log('Admin: Added Player Alpha and Player Beta');

        // Start League
        await adminPage.click('#start-league-final-btn');
        console.log('Admin: Created league');

        // Capture League Code from header
        const headerText = await adminPage.locator('h2:has-text("LEAGUE:")').textContent({ timeout: 20000 });
        const leagueCode = headerText?.replace('LEAGUE:', '').trim() || '';
        console.log(`Admin: Captured League Code: ${leagueCode}`);

        // Scenario 2: Admin adjusts team count pre-auction
        await adminPage.fill('input[type="number"]', '1');
        await adminPage.click('button:has-text("Update")');
        console.log('Admin: Adjusted team count to 1');
        await expect(adminPage.locator('text=Teams Joined: 0 / 1')).toBeVisible({ timeout: 10000 });

        // Scenario 1: Admin invites co-Admin
        await adminPage.fill('input[placeholder="captain@example.com"]', 'coadmin@test.com');
        await adminPage.selectOption('select', 'ADMIN');
        await adminPage.click('button:has-text("Invite")');
        await expect(adminPage.locator('span', { hasText: 'coadmin@test.com (ADMIN)' }).first()).toBeVisible({ timeout: 15000 });
        console.log('Admin: Sent co-Admin invitation to coadmin@test.com');

        // Invite Captain for later
        await adminPage.fill('input[placeholder="captain@example.com"]', 'captain@test.com');
        await adminPage.selectOption('select', 'CAPTAIN');
        await adminPage.click('button:has-text("Invite")');
        await expect(adminPage.locator('span', { hasText: 'captain@test.com (CAPTAIN)' }).first()).toBeVisible({ timeout: 15000 });
        console.log('Admin: Sent captain invitation to captain@test.com');

        // 2. Co-Admin setup & join validation
        const coAdminContext = await browser.newContext({
            recordVideo: { dir: 'test-results/videos/' }
        });
        const coAdminPage = await coAdminContext.newPage();
        await coAdminPage.goto('/');
        await coAdminPage.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'coadmin@test.com',
                user_metadata: { full_name: 'Co Admin' }
            }));
        });
        await coAdminPage.goto('/');
        console.log('Co-Admin: Loaded mock session');

        // Verify co-admin sees the league in "Leagues You Manage" and joins as Admin
        const manageLeagueCard = coAdminPage.locator('.league-card', { hasText: leagueCode });
        await expect(manageLeagueCard).toBeVisible({ timeout: 20000 });
        await manageLeagueCard.locator('button:has-text("Enter")').click();
        console.log('Co-Admin: Clicked Enter');

        // Verify co-admin sees "WAITING AREA" and the "Start Auction" button is visible
        await expect(coAdminPage.locator('text=WAITING AREA')).toBeVisible({ timeout: 20000 });
        await expect(coAdminPage.locator('#start-auction-btn')).toBeVisible({ timeout: 10000 });
        console.log('Co-Admin: Successfully joined as Admin and verified UI controls');

        // 3. Captain joins
        const captainContext = await browser.newContext({
            recordVideo: { dir: 'test-results/videos/' }
        });
        const captainPage = await captainContext.newPage();
        await captainPage.goto('/');
        await captainPage.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'captain@test.com',
                user_metadata: { full_name: 'Test Captain' }
            }));
        });
        await captainPage.goto('/');
        console.log('Captain: Loaded mock session');

        const captainLeagueCard = captainPage.locator('.league-card', { hasText: leagueCode });
        await expect(captainLeagueCard).toBeVisible({ timeout: 20000 });
        await captainLeagueCard.locator('button:has-text("Join Draft")').click();
        await captainPage.fill('#captain-team-name-input', 'Mega Team');
        await captainPage.click('#confirm-join-btn');
        console.log('Captain: Joined lobby as Mega Team');

        // Wait for lobby to show team count complete
        await expect(adminPage.locator('text=Teams Joined: 1 / 1')).toBeVisible({ timeout: 10000 });

        // Co-Admin starts auction
        const startAuctionBtn = coAdminPage.locator('#start-auction-btn');
        await expect(startAuctionBtn).toBeEnabled({ timeout: 10000 });
        await startAuctionBtn.click();
        console.log('Co-Admin: Started auction');

        // Captain places a bid of 100
        await expect(captainPage.locator('text=YOUR TURN TO BID!')).toBeVisible({ timeout: 20000 });
        await captainPage.fill('#bid-amount-input', '100');
        await captainPage.click('#place-bid-btn');
        console.log('Captain: Bid 100 placed');

        // Verify player is automatically sold since there's only 1 team in the league
        const soldTextLocator = adminPage.locator('text=SOLD to Mega Team');
        await expect(soldTextLocator).toBeVisible({ timeout: 20000 });
        const soldText = await soldTextLocator.textContent();
        console.log('Admin: Sale verified (automatic sold):', soldText);

        // Scenario 3: Admin reassigns player manually (reducing price and adjusting budget)
        // Click "Players" button to open Player List modal
        await adminPage.click('button:has-text("Players")');
        console.log('Admin: Opened Player List View');

        // Locate Player Alpha and click edit
        const playerRow = adminPage.locator('tr', { hasText: 'Player Alpha' });
        await expect(playerRow).toBeVisible({ timeout: 10000 });
        await playerRow.locator('button', { hasText: '✏️' }).click();
        console.log('Admin: Opened Edit modal for Player Alpha');

        // Change price to 50
        await adminPage.fill('label:has-text("Price:") + input', '50');
        await adminPage.click('button:has-text("Confirm")');
        console.log('Admin: Reduced price to 50 and clicked Confirm');

        // Verify updated price in table
        await expect(playerRow.locator('td', { hasText: '50' }).first()).toBeVisible({ timeout: 10000 });

        // Close Players modal
        await adminPage.click('button:has-text("×")');
        console.log('Admin: Closed Player List View');

        // Verify Mega Team budget updated
        const standingsPanel = adminPage.locator('.responsive-sidebar');
        await expect(standingsPanel).toContainText('Mega Team', { timeout: 15000 });
        const expectedBudget = soldText.includes('Player Alpha') ? '950 Th' : '850 Th';
        await expect(standingsPanel).toContainText(expectedBudget, { timeout: 15000 });
        console.log(`Admin: Verified team budget successfully adjusted to ${expectedBudget}`);

        // Scenario 4: Captain renames their team
        const captainStandingRow = captainPage.locator('.responsive-sidebar div', { hasText: 'Mega Team' }).first();
        await captainStandingRow.locator('button[title="Rename Team"]').click();
        await captainPage.fill('.responsive-sidebar input[type="text"]', 'Super Mega Team');
        await captainPage.click('.responsive-sidebar button[title="Save Name"]');
        console.log('Captain: Renamed team to Super Mega Team');

        await expect(captainPage.locator('.responsive-sidebar')).toContainText('Super Mega Team', { timeout: 10000 });
        await expect(adminPage.locator('.responsive-sidebar')).toContainText('Super Mega Team', { timeout: 10000 });

        // Scenario 5: Admin renames a team
        const adminStandingRow = adminPage.locator('.responsive-sidebar div', { hasText: 'Super Mega Team' }).first();
        await adminStandingRow.locator('button[title="Rename Team"]').click();
        await adminPage.fill('.responsive-sidebar input[type="text"]', 'Ultra Team');
        await adminPage.click('.responsive-sidebar button[title="Save Name"]');
        console.log('Admin: Renamed team to Ultra Team');

        await expect(adminPage.locator('.responsive-sidebar')).toContainText('Ultra Team', { timeout: 10000 });

        // Scenario 6: Captain leaves auction
        await captainPage.close();
        console.log('Captain: Closed page (leaves auction)');

        // Verify highlight and activity log on Admin panel
        await expect(adminPage.locator('.responsive-sidebar')).toContainText('LEFT', { timeout: 15000 });
        console.log('Admin: Verified LEFT status highlight in Standings');

        await expect(adminPage.locator('text="Captain Ultra Team has left the auction"').first()).toBeVisible({ timeout: 15000 });
        console.log('Admin: Verified left captain message in live activity log');

        // Cleanup
        await adminContext.close();
        await coAdminContext.close();
        await captainContext.close();
    });
});
