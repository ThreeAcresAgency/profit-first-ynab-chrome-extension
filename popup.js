// Get current budget ID from URL
function getBudgetId() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const match = tabs[0].url.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
            resolve(match ? match[0] : null);
        });
    });
}

// Get settings key for current budget
async function getSettingsKey() {
    const budgetId = await getBudgetId();
    return budgetId ? `settings_${budgetId}` : null;
}

document.addEventListener('DOMContentLoaded', async () => {
    const connectSection = document.getElementById('connect-section');
    const settingsSection = document.getElementById('settings-section');
    const statusDiv = document.getElementById('status');
    const apiTokenInput = document.getElementById('api-token');
    const connectButton = document.getElementById('connect-button');
    const saveButton = document.getElementById('save-settings');

    // Load saved token
    const { token } = await chrome.storage.sync.get('token');
    if (token) {
        apiTokenInput.value = token;
        await loadCategories();
    }

    // Connect button click handler
    connectButton.addEventListener('click', async () => {
        const token = apiTokenInput.value.trim();
        if (!token) {
            showStatus('Please enter an API token', 'error', false);
            return;
        }

        try {
            // Test the token
            const response = await fetch('https://api.ynab.com/v1/budgets', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Invalid token');
            }

            // Save token if valid
            await chrome.storage.sync.set({ token });
            showStatus('Connected successfully!');
            await loadCategories();
        } catch (error) {
            showStatus('Failed to connect. Please check your token.', 'error', false);
        }
    });

    // Load categories into dropdowns
    async function loadCategories() {
        const { token } = await chrome.storage.sync.get('token');
        if (!token) return;

        const budgetId = await getBudgetId();
        if (!budgetId) {
            showStatus('Please open YNAB in another tab first', 'error', false);
            return;
        }

        try {
            const response = await fetch(`https://api.ynab.com/v1/budgets/${budgetId}/categories`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch categories');
            }

            const data = await response.json();
            const categories = data.data.category_groups
                .flatMap(group => group.categories)
                .map(category => ({
                    id: category.id,
                    name: category.name
                }));

            // Populate dropdowns
            const dropdowns = [
                'tax-category',
                'owner-pay-category',
                'opex-category',
                'profit-category'
            ];

            dropdowns.forEach(id => {
                const select = document.getElementById(id);
                select.innerHTML = '<option value="">Select a category...</option>';
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    select.appendChild(option);
                });
            });

            // Load saved settings for this budget
            const settingsKey = await getSettingsKey();
            const { [settingsKey]: settings } = await chrome.storage.sync.get(settingsKey);
            
            if (settings) {
                document.getElementById('tax').value = settings.percentages.tax;
                document.getElementById('owner-pay').value = settings.percentages.ownerPay;
                document.getElementById('opex').value = settings.percentages.opex;
                document.getElementById('profit').value = settings.percentages.profit;

                document.getElementById('tax-category').value = settings.categories.tax;
                document.getElementById('owner-pay-category').value = settings.categories.ownerPay;
                document.getElementById('opex-category').value = settings.categories.opex;
                document.getElementById('profit-category').value = settings.categories.profit;
            }

            connectSection.classList.add('hidden');
            settingsSection.classList.remove('hidden');
        } catch (error) {
            showStatus('Failed to load categories. Please try again.', 'error', false);
        }
    }

    // Show status message with optional auto-hide
    function showStatus(message, type = 'success', autoHide = true) {
        statusDiv.textContent = message;
        statusDiv.className = type;
        
        if (autoHide) {
            setTimeout(() => {
                statusDiv.classList.add('fade-out');
                setTimeout(() => {
                    statusDiv.textContent = '';
                    statusDiv.className = '';
                }, 500);
            }, 2000);
        }
    }

    // Save settings button click handler
    saveButton.addEventListener('click', async () => {
        // Show loading state
        saveButton.classList.add('saving');
        saveButton.disabled = true;

        const settings = {
            percentages: {
                ownerPay: parseFloat(document.getElementById('owner-pay').value),
                tax: parseFloat(document.getElementById('tax').value),
                opex: parseFloat(document.getElementById('opex').value),
                profit: parseFloat(document.getElementById('profit').value)
            },
            categories: {
                ownerPay: document.getElementById('owner-pay-category').value,
                tax: document.getElementById('tax-category').value,
                opex: document.getElementById('opex-category').value,
                profit: document.getElementById('profit-category').value
            }
        };

        // Validate percentages
        const total = Object.values(settings.percentages).reduce((sum, val) => sum + val, 0);
        if (total !== 100) {
            showStatus('Percentages must add up to 100%', 'error', false);
            saveButton.classList.remove('saving');
            saveButton.disabled = false;
            return;
        }

        // Validate categories
        if (Object.values(settings.categories).some(val => !val)) {
            showStatus('Please select all categories', 'error', false);
            saveButton.classList.remove('saving');
            saveButton.disabled = false;
            return;
        }

        try {
            const settingsKey = await getSettingsKey();
            if (!settingsKey) {
                showStatus('Please open YNAB in another tab first', 'error', false);
                saveButton.classList.remove('saving');
                saveButton.disabled = false;
                return;
            }

            await chrome.storage.sync.set({ [settingsKey]: settings });
            showStatus('Settings saved successfully!');
            
            // Keep the success message visible for a moment before closing
            setTimeout(() => {
                window.close();
            }, 1500);
        } catch (error) {
            showStatus('Failed to save settings. Please try again.', 'error', false);
            saveButton.classList.remove('saving');
            saveButton.disabled = false;
        }
    });
});
