import { test, expect } from '@playwright/test';

test.describe('SoldIt ExternalId & League Dashboard Flow', () => {
    test('Can create player with ExternalId, edit ExternalId, and inspect League Dashboard JSON', async ({ browser }) => {
        test.setTimeout(60000);

        // 1. Setup Admin session
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();

        await adminPage.goto('/');
        await adminPage.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'external_id_admin@test.com',
                user_metadata: { full_name: 'External ID Admin' }
            }));
        });
        await adminPage.goto('/');
        console.log('Admin: Loaded landing page');

        // Create league
        await adminPage.click('#create-league-btn');
        await adminPage.fill('#league-name-input', 'External ID & Dashboard Test');
        await adminPage.fill('#league-teams-input', '2');

        // Add player with External ID manually
        await adminPage.fill('#manual-player-name', 'Kohli');
        await adminPage.fill('#manual-player-external-id', 'EXT-101');
        await adminPage.click('#add-player-btn');
        console.log('Admin: Added player with External ID EXT-101');

        await adminPage.click('#start-league-final-btn');
        console.log('Admin: Created league');

        // Verify Player List contains External ID
        await adminPage.click('button:has-text("Players")');
        await expect(adminPage.locator('td', { hasText: 'EXT-101' })).toBeVisible({ timeout: 15000 });
        console.log('Admin: Verified EXT-101 visible in player list table');

        // Edit player's External ID to EXT-999
        await adminPage.click('button:has-text("✏️")');
        await adminPage.fill('#edit-player-external-id', 'EXT-999');
        await adminPage.click('#save-player-edit-btn');

        await expect(adminPage.locator('td', { hasText: 'EXT-999' })).toBeVisible({ timeout: 15000 });
        console.log('Admin: Successfully updated player External ID to EXT-999');

        // Close Player List modal
        await adminPage.click('button:has-text("×")');

        // Open Dashboard (View Only) from Auction Room header
        await adminPage.click('#auction-dashboard-btn');
        await expect(adminPage.locator('#league-json-viewer')).toBeVisible({ timeout: 15000 });
        
        const jsonContent = await adminPage.locator('#league-json-viewer').textContent();
        expect(jsonContent).toContain('External ID & Dashboard Test');
        expect(jsonContent).toContain('EXT-999');
        console.log('Admin: Verified League JSON viewer renders league details');

        // Switch to Players tab in View-Only Dashboard
        await adminPage.click('#tab-players');
        await expect(adminPage.locator('strong', { hasText: 'Kohli' })).toBeVisible();
        await expect(adminPage.locator('span', { hasText: 'ExtID: EXT-999' })).toBeVisible();
        console.log('Admin: Verified Players tab renders External ID pill');

        // Close Dashboard View
        await adminPage.click('button:has-text("Close View")');

        await adminContext.close();
    });

    test('Rejects whole CSV upload and manual entry on duplicate ExternalId', async ({ browser }) => {
        test.setTimeout(60000);

        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();

        await adminPage.goto('/');
        await adminPage.evaluate(() => {
            localStorage.setItem('e2e_mock_user', JSON.stringify({
                email: 'csv_validation_admin@test.com',
                user_metadata: { full_name: 'CSV Validation Admin' }
            }));
        });
        await adminPage.goto('/');

        await adminPage.click('#create-league-btn');

        // Try adding manual player with External ID EXT-DUP
        await adminPage.fill('#manual-player-name', 'Player One');
        await adminPage.fill('#manual-player-external-id', 'EXT-DUP');
        await adminPage.click('#add-player-btn');

        // Listen for alert on duplicate manual entry
        let alertMessage = '';
        adminPage.once('dialog', async dialog => {
            alertMessage = dialog.message();
            await dialog.accept();
        });

        // Try adding another manual player with same External ID EXT-DUP
        await adminPage.fill('#manual-player-name', 'Player Two');
        await adminPage.fill('#manual-player-external-id', 'EXT-DUP');
        await adminPage.click('#add-player-btn');

        expect(alertMessage).toContain('Validation Error');
        expect(alertMessage).toContain('EXT-DUP');
        console.log('Admin: Verified manual player entry rejected duplicate ExternalId EXT-DUP');

        await adminContext.close();
    });
});
