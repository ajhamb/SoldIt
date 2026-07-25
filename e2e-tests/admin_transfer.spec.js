import { test, expect } from '@playwright/test';

test.describe('SoldIt Transfer Admin Ownership Flow', () => {
    test('Admin can transfer ownership of a league to another email', async ({ browser }) => {
        test.setTimeout(60000);

        // 1. Initial Admin setup
        const admin1Context = await browser.newContext();
        const admin1Page = await admin1Context.newPage();

        await admin1Page.goto('/');
        await admin1Page.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'original_admin@test.com',
                user_metadata: { full_name: 'Original Admin' }
            }));
        });
        await admin1Page.goto('/');
        console.log('Admin 1: Landing page loaded');

        // Create a new league
        await admin1Page.click('#create-league-btn');
        await admin1Page.fill('#league-name-input', 'Admin Transfer Test');
        await admin1Page.fill('#league-teams-input', '2');
        
        // Add a Player
        await admin1Page.fill('#manual-player-name', 'Player One');
        await admin1Page.click('#add-player-btn');
        
        await admin1Page.click('#start-league-final-btn');
        console.log('Admin 1: League Created');

        // Capture League Code from header
        const headerText = await admin1Page.locator('h2:has-text("LEAGUE:")').textContent({ timeout: 20000 });
        const leagueCode = headerText?.replace('LEAGUE:', '').trim() || '';
        console.log(`Admin 1: Captured League Code: ${leagueCode}`);

        // Accept native dialog for confirm prompt when transferring ownership
        admin1Page.on('dialog', async dialog => {
            console.log(`Admin 1: Dialog popped up -> "${dialog.message()}"`);
            await dialog.accept();
        });

        // Fill transfer admin input and click Transfer
        await admin1Page.fill('#transfer-admin-email-input', 'new_owner@test.com');
        await admin1Page.click('#transfer-admin-btn');
        console.log('Admin 1: Initiated ownership transfer to new_owner@test.com');

        // Verify activity log reflects the transfer
        await expect(admin1Page.getByText('Admin ownership transferred').first()).toBeVisible({ timeout: 15000 });
        console.log('Admin 1: Activity log reflects ownership transfer');

        // 2. New Admin setup
        const admin2Context = await browser.newContext();
        const admin2Page = await admin2Context.newPage();

        await admin2Page.goto('/');
        await admin2Page.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'new_owner@test.com',
                user_metadata: { full_name: 'New Owner' }
            }));
        });
        await admin2Page.goto('/');
        console.log('Admin 2: Landing page loaded');

        // Verify the transferred league appears under "Leagues You Manage" for new_owner@test.com
        const managedSection = admin2Page.locator('.card', { hasText: 'Leagues You Manage' });
        await expect(managedSection).toContainText('Admin Transfer Test', { timeout: 15000 });
        console.log('Admin 2: Verified transferred league appears in Leagues You Manage');

        // Cleanup
        await admin1Context.close();
        await admin2Context.close();
    });
});
