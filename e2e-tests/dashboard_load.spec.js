import { test, expect } from '@playwright/test';

test.describe('SoldIt Dashboard Leagues Load Flow', () => {
    test('Leagues load successfully on dashboard for Admins and Captains', async ({ browser }) => {
        test.setTimeout(60000);

        // 1. Admin setup
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();

        await adminPage.goto('/');
        await adminPage.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'admin_dashboard@test.com',
                user_metadata: { full_name: 'Dashboard Admin' }
            }));
        });
        await adminPage.goto('/');
        console.log('Admin: Landing page loaded');

        // Create a new league
        await adminPage.click('#create-league-btn');
        await adminPage.fill('#league-name-input', 'Dashboard League Test');
        await adminPage.fill('#league-teams-input', '2');
        
        // Add a Player
        await adminPage.fill('#manual-player-name', 'Player Alpha');
        await adminPage.click('#add-player-btn');
        
        await adminPage.click('#start-league-final-btn');
        console.log('Admin: League Created');

        // Capture League Code from header
        const headerText = await adminPage.locator('h2:has-text("LEAGUE:")').textContent({ timeout: 20000 });
        const leagueCode = headerText?.replace('LEAGUE:', '').trim() || '';
        console.log(`Admin: Captured League Code: ${leagueCode}`);

        // Invite Captain
        await adminPage.fill('input[placeholder="captain@example.com"]', 'captain_dashboard@test.com');
        await adminPage.click('button:has-text("Invite")');
        console.log('Admin: Sent invitation to captain_dashboard@test.com');

        // 2. Captain setup
        const captainContext = await browser.newContext();
        const captainPage = await captainContext.newPage();

        await captainPage.goto('/');
        await captainPage.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'captain_dashboard@test.com',
                user_metadata: { full_name: 'Dashboard Captain' }
            }));
        });
        await captainPage.goto('/');
        console.log('Captain: Landing page loaded');

        // Verify the league invitation shows up on Captain's welcome dashboard
        const leagueCard = captainPage.locator('.league-card', { hasText: leagueCode });
        await expect(leagueCard).toBeVisible({ timeout: 20000 });
        console.log('Captain: Verified invitation list loads the league card');

        // Captain joins the league
        await leagueCard.locator('.enter-league-btn').click();
        await expect(captainPage.locator('#captain-team-name-input')).toBeVisible({ timeout: 10000 });
        await captainPage.fill('#captain-team-name-input', 'Captain Dashboard Team');
        await captainPage.click('#confirm-join-btn');
        console.log('Captain: Successfully joined draft lobby');

        // Go back to Welcome dashboard for Captain and verify it loads as participated league
        await captainPage.click('button:has-text("Exit League")');
        await expect(captainPage.locator('.card:has-text("Leagues You Participate In")')).toContainText('Dashboard League Test', { timeout: 15000 });
        console.log('Captain: Verified participated leagues list loads after exit');

        // Go back to Welcome dashboard for Admin and verify it loads as managed league
        await adminPage.click('button:has-text("Exit League")');
        await expect(adminPage.locator('.card:has-text("Leagues You Manage")')).toContainText('Dashboard League Test', { timeout: 15000 });
        console.log('Admin: Verified managed leagues list loads after exit');

        // Cleanup
        await adminContext.close();
        await captainContext.close();
    });
});
