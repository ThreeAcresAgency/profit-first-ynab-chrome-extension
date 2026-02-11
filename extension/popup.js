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

// Default Profit First allocations for first-time users
const DEFAULT_ALLOCATIONS = [
    { id: 'alloc_1', name: 'Tax', percentage: 15, categoryId: '' },
    { id: 'alloc_2', name: "Owner's Pay", percentage: 50, categoryId: '' },
    { id: 'alloc_3', name: 'Operations', percentage: 30, categoryId: '' },
    { id: 'alloc_4', name: 'Profit', percentage: 5, categoryId: '' }
];

// Migrate old settings format to new format
function migrateSettings(settings) {
    if (!settings) return null;

    // Already in new format
    if (Array.isArray(settings.allocations)) return settings;

    // Old format: { percentages: { tax, ownerPay, opex, profit }, categories: { tax, ownerPay, opex, profit } }
    if (settings.percentages && settings.categories) {
        return {
            showCopyButton: settings.showCopyButton !== undefined ? settings.showCopyButton : true,
            taxRules: settings.taxRules || [],
            allocations: [
                { id: 'alloc_1', name: 'Tax', percentage: settings.percentages.tax || 0, categoryId: settings.categories.tax || '' },
                { id: 'alloc_2', name: "Owner's Pay", percentage: settings.percentages.ownerPay || 0, categoryId: settings.categories.ownerPay || '' },
                { id: 'alloc_3', name: 'Operations', percentage: settings.percentages.opex || 0, categoryId: settings.categories.opex || '' },
                { id: 'alloc_4', name: 'Profit', percentage: settings.percentages.profit || 0, categoryId: settings.categories.profit || '' }
            ]
        };
    }

    return settings;
}

let allocIdCounter = 0;
function nextAllocId() {
    return 'alloc_' + (++allocIdCounter);
}

// Categories fetched from YNAB API, stored globally for row rendering
let ynabCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
    const connectSection = document.getElementById('connect-section');
    const settingsSection = document.getElementById('settings-section');
    const statusDiv = document.getElementById('status');
    const apiTokenInput = document.getElementById('api-token');
    const connectButton = document.getElementById('connect-button');
    const saveButton = document.getElementById('save-settings');
    const disconnectButton = document.getElementById('disconnect-button');

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });

    // Disconnect handler
    disconnectButton.addEventListener('click', async () => {
        await chrome.storage.sync.remove('token');
        apiTokenInput.value = '';
        settingsSection.classList.add('hidden');
        connectSection.classList.remove('hidden');
        // Reset to Profit First tab for next connection
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="profit-first"]').classList.add('active');
        document.getElementById('tab-profit-first').classList.add('active');
    });

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
            const response = await fetch('https://api.ynab.com/v1/budgets', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Invalid token');
            }

            await chrome.storage.sync.set({ token });
            showStatus('Connected successfully!');
            await loadCategories();
        } catch (error) {
            showStatus('Failed to connect. Please check your token.', 'error', false);
        }
    });

    // Load categories into dropdowns and populate settings
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
            ynabCategories = data.data.category_groups
                .flatMap(group => group.categories)
                .map(category => ({
                    id: category.id,
                    name: category.name
                }));

            // Load saved settings for this budget
            const settingsKey = await getSettingsKey();
            const { [settingsKey]: rawSettings } = await chrome.storage.sync.get(settingsKey);

            let settings = migrateSettings(rawSettings);

            // If migrated (format changed), persist the new format
            if (rawSettings && !Array.isArray(rawSettings.allocations) && settings && Array.isArray(settings.allocations)) {
                await chrome.storage.sync.set({ [settingsKey]: settings });
            }

            // Populate the UI
            populateSettingsUI(settings);

            connectSection.classList.add('hidden');
            settingsSection.classList.remove('hidden');
        } catch (error) {
            showStatus('Failed to load categories. Please try again.', 'error', false);
        }
    }

    function populateSettingsUI(settings) {
        const allocContainer = document.getElementById('allocations-container');
        const taxContainer = document.getElementById('tax-rules-container');
        allocContainer.innerHTML = '';
        taxContainer.innerHTML = '';

        // Show copy button toggle
        const showCopyCheckbox = document.getElementById('show-copy-button');
        showCopyCheckbox.checked = settings ? settings.showCopyButton !== false : true;

        // Populate allocations
        const allocations = (settings && settings.allocations) ? settings.allocations : DEFAULT_ALLOCATIONS;
        allocations.forEach(alloc => {
            addAllocationRow(alloc.name, alloc.percentage, alloc.categoryId);
        });

        // Populate tax rules
        const taxRules = (settings && settings.taxRules) ? settings.taxRules : [];
        taxRules.forEach(rule => {
            addTaxRuleRow(rule.keyword, rule.rate, rule.categoryId);
        });

        updateAllocTotal();
    }

    // Build a category <select> element
    function buildCategorySelect(selectedId) {
        const select = document.createElement('select');
        select.innerHTML = '<option value="">Select category...</option>';
        ynabCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            if (cat.id === selectedId) opt.selected = true;
            select.appendChild(opt);
        });
        return select;
    }

    // Add an allocation row
    function addAllocationRow(name, percentage, categoryId) {
        const container = document.getElementById('allocations-container');
        const row = document.createElement('div');
        row.className = 'alloc-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Name';
        nameInput.value = name || '';

        const pctInput = document.createElement('input');
        pctInput.type = 'number';
        pctInput.min = '0';
        pctInput.max = '100';
        pctInput.placeholder = '%';
        pctInput.value = percentage != null ? percentage : '';
        pctInput.addEventListener('input', updateAllocTotal);

        const select = buildCategorySelect(categoryId || '');

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'X';
        removeBtn.addEventListener('click', () => {
            row.remove();
            updateAllocTotal();
        });

        row.appendChild(nameInput);
        row.appendChild(pctInput);
        row.appendChild(select);
        row.appendChild(removeBtn);
        container.appendChild(row);
    }

    // Add a tax rule row
    function addTaxRuleRow(keyword, rate, categoryId) {
        const container = document.getElementById('tax-rules-container');
        const row = document.createElement('div');
        row.className = 'tax-rule-row';

        const keywordInput = document.createElement('input');
        keywordInput.type = 'text';
        keywordInput.placeholder = 'Keyword';
        keywordInput.value = keyword || '';

        const rateInput = document.createElement('input');
        rateInput.type = 'number';
        rateInput.min = '0';
        rateInput.max = '100';
        rateInput.placeholder = '%';
        rateInput.value = rate != null ? rate : '';

        const select = buildCategorySelect(categoryId || '');

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'X';
        removeBtn.addEventListener('click', () => {
            row.remove();
        });

        row.appendChild(keywordInput);
        row.appendChild(rateInput);
        row.appendChild(select);
        row.appendChild(removeBtn);
        container.appendChild(row);
    }

    function updateAllocTotal() {
        const rows = document.querySelectorAll('#allocations-container .alloc-row');
        let total = 0;
        rows.forEach(row => {
            const pct = parseFloat(row.querySelector('input[type="number"]').value) || 0;
            total += pct;
        });
        const totalDiv = document.getElementById('alloc-total');
        totalDiv.textContent = `Total: ${total}%`;
        totalDiv.className = total === 100 ? 'valid' : 'invalid';
    }

    // Add allocation button
    document.getElementById('add-allocation').addEventListener('click', () => {
        addAllocationRow('', '', '');
        updateAllocTotal();
    });

    // Add tax rule button
    document.getElementById('add-tax-rule').addEventListener('click', () => {
        addTaxRuleRow('', '', '');
    });

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
        // Gather allocations
        const allocRows = document.querySelectorAll('#allocations-container .alloc-row');
        const allocations = [];
        let allocTotal = 0;
        let allAllocValid = true;
        let idCounter = 0;

        allocRows.forEach(row => {
            const name = row.querySelector('input[type="text"]').value.trim();
            const pct = parseFloat(row.querySelector('input[type="number"]').value) || 0;
            const categoryId = row.querySelector('select').value;
            allocTotal += pct;
            if (!name || !categoryId) allAllocValid = false;
            allocations.push({
                id: 'alloc_' + (++idCounter),
                name,
                percentage: pct,
                categoryId
            });
        });

        if (allocations.length === 0) {
            showStatus('Please add at least one allocation category.', 'error', false);
            return;
        }

        if (allocTotal !== 100) {
            showStatus(`Your percentages total ${allocTotal}%. They must add up to exactly 100%.`, 'error', false);
            return;
        }

        if (!allAllocValid) {
            showStatus('Please fill in all allocation names and categories.', 'error', false);
            return;
        }

        // Gather tax rules
        const taxRuleRows = document.querySelectorAll('#tax-rules-container .tax-rule-row');
        const taxRules = [];
        let allTaxValid = true;

        taxRuleRows.forEach(row => {
            const keyword = row.querySelector('input[type="text"]').value.trim();
            const rate = parseFloat(row.querySelector('input[type="number"]').value) || 0;
            const categoryId = row.querySelector('select').value;
            if (!keyword || !categoryId || rate <= 0) allTaxValid = false;
            taxRules.push({ keyword, rate, categoryId });
        });

        if (taxRuleRows.length > 0 && !allTaxValid) {
            showStatus('Please fill in all tax rule fields (keyword, rate > 0, and category).', 'error', false);
            return;
        }

        const showCopyButton = document.getElementById('show-copy-button').checked;

        const settings = {
            showCopyButton,
            taxRules,
            allocations
        };

        try {
            const settingsKey = await getSettingsKey();
            if (!settingsKey) {
                showStatus('Please open YNAB in another tab first', 'error', false);
                return;
            }

            await chrome.storage.sync.set({ [settingsKey]: settings });
            showStatus('Settings saved successfully!');

            setTimeout(() => {
                window.close();
            }, 1500);
        } catch (error) {
            showStatus('Failed to save settings. Please try again.', 'error', false);
        }
    });
});
