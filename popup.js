document.addEventListener('DOMContentLoaded', async () => {
    const connectSection = document.getElementById('connect-section');
    const settingsSection = document.getElementById('settings-section');
    const apiTokenInput = document.getElementById('api-token');
    const connectButton = document.getElementById('connect-button');
    const saveButton = document.getElementById('save-settings');
    const statusDiv = document.getElementById('status');

    // Try to auto-connect if we have a token
    const { token } = await chrome.storage.sync.get('token');
    if (token) {
        await connectToYNAB(token, true);
    }

    // Handle connect button click
    connectButton.addEventListener('click', async () => {
        const token = apiTokenInput.value.trim();
        if (!token) {
            statusDiv.textContent = 'Please enter an API token';
            return;
        }
        await connectToYNAB(token);
    });

    // Handle save settings
    saveButton.addEventListener('click', async () => {
        const settings = {
            percentages: {
                ownerPay: parseFloat(document.getElementById('owner-pay').value) || 50,
                tax: parseFloat(document.getElementById('tax').value) || 15,
                opex: parseFloat(document.getElementById('opex').value) || 30,
                profit: parseFloat(document.getElementById('profit').value) || 5
            },
            categories: {
                ownerPay: document.getElementById('owner-pay-category').value,
                tax: document.getElementById('tax-category').value,
                opex: document.getElementById('opex-category').value,
                profit: document.getElementById('profit-category').value
            }
        };

        await chrome.storage.sync.set({ settings });
        statusDiv.textContent = 'Settings saved!';
        setTimeout(() => window.close(), 1000);
    });

    async function connectToYNAB(token, isAutoConnect = false) {
        try {
            if (!isAutoConnect) {
                statusDiv.textContent = 'Connecting...';
            }

            // Test the token
            const response = await fetch('https://api.ynab.com/v1/budgets', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Invalid API token');
            }

            // Save token if this is first connect
            if (!isAutoConnect) {
                await chrome.storage.sync.set({ token });
            }

            // Load categories
            await loadCategories(token);

            // Show settings section
            connectSection.classList.add('hidden');
            settingsSection.classList.remove('hidden');

            if (!isAutoConnect) {
                statusDiv.textContent = 'Connected!';
            }
        } catch (error) {
            console.error('Connection error:', error);
            statusDiv.textContent = error.message;
            connectSection.classList.remove('hidden');
            settingsSection.classList.add('hidden');
        }
    }

    async function loadCategories(token) {
        try {
            // Get current budget ID from URL
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const url = tabs[0].url;
            const budgetId = url.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i)[0];

            // Get categories
            const response = await fetch(`https://api.ynab.com/v1/budgets/${budgetId}/categories`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            const categories = [];

            // Flatten categories into simple array
            data.data.category_groups.forEach(group => {
                group.categories.forEach(cat => {
                    categories.push({
                        id: cat.id,
                        name: `${group.name}: ${cat.name}`
                    });
                });
            });

            // Populate dropdowns
            ['owner-pay', 'tax', 'opex', 'profit'].forEach(type => {
                const select = document.getElementById(`${type}-category`);
                select.innerHTML = '<option value="">Select category...</option>' +
                    categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
            });

            // Load saved settings if any
            const { settings } = await chrome.storage.sync.get('settings');
            if (settings) {
                document.getElementById('owner-pay').value = settings.percentages.ownerPay;
                document.getElementById('tax').value = settings.percentages.tax;
                document.getElementById('opex').value = settings.percentages.opex;
                document.getElementById('profit').value = settings.percentages.profit;

                document.getElementById('owner-pay-category').value = settings.categories.ownerPay;
                document.getElementById('tax-category').value = settings.categories.tax;
                document.getElementById('opex-category').value = settings.categories.opex;
                document.getElementById('profit-category').value = settings.categories.profit;
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            throw new Error('Failed to load categories');
        }
    }
});
