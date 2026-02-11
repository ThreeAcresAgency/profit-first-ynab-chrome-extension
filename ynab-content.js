// Initialize only once
if (!window.profitFirstInitialized) {
    window.profitFirstInitialized = true;
    console.log('Initializing Profit First extension');

    // Safe chrome.storage access - returns null if extension context is invalidated
    async function safeStorageGet(key) {
        try {
            if (!chrome?.storage?.sync) return null;
            return await chrome.storage.sync.get(key);
        } catch (e) {
            console.warn('[Profit First] Storage unavailable:', e.message);
            return null;
        }
    }

    async function safeStorageSet(obj) {
        try {
            if (!chrome?.storage?.sync) return;
            await chrome.storage.sync.set(obj);
        } catch (e) {
            console.warn('[Profit First] Storage unavailable:', e.message);
        }
    }

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

    // Add button to header
    function addProfitFirstButton() {
        const headerFlexbox = document.querySelector('.budget-header-flexbox');
        const totalsSection = document.querySelector('.budget-header-totals');

        if (!headerFlexbox || !totalsSection || document.querySelector('.budget-header-profit-first')) return;

        console.log('Found header, adding button');
        const container = document.createElement('div');
        container.className = 'budget-header-item budget-header-profit-first';

        const button = document.createElement('button');
        button.textContent = 'Assign Profit First Money \u25BC';
        button.className = 'button button-primary';
        button.style.cssText = `
            background-color: #2c396a;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background-color 0.2s;
            margin-left: 10px;
        `;

        container.appendChild(button);
        button.addEventListener('click', showProfitFirstModal);

        if (totalsSection.nextSibling) {
            headerFlexbox.insertBefore(container, totalsSection.nextSibling);
        } else {
            headerFlexbox.appendChild(container);
        }
        console.log('Button added successfully');
    }

    // Add Copy Categories button to header (respects showCopyButton setting)
    let copyButtonPending = false;
    async function addCopyCategoriesButton() {
        if (copyButtonPending) return;

        const headerFlexbox = document.querySelector('.budget-header-flexbox');
        const totalsSection = document.querySelector('.budget-header-totals');

        if (!headerFlexbox || !totalsSection) return;

        copyButtonPending = true;
        try {
            // Check settings to see if button should be shown
            const settings = await getBudgetSettings();
            if (settings && settings.showCopyButton === false) {
                // Remove existing button if it was previously rendered
                const existing = document.querySelector('.budget-header-copy-categories');
                if (existing) existing.remove();
                return;
            }

            if (document.querySelector('.budget-header-copy-categories')) return;

        const container = document.createElement('div');
        container.className = 'budget-header-item budget-header-copy-categories';

        const button = document.createElement('button');
        button.textContent = 'Copy Categories';
        button.className = 'button button-primary';
        button.style.cssText = `
            background-color: #5560a4;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background-color 0.2s;
            margin-left: 10px;
            position: relative;
            overflow: hidden;
        `;

        container.appendChild(button);
        button.addEventListener('click', async () => {
            try {
                button.disabled = true;
                let progress = button.querySelector('.pfy-progress');
                if (!progress) {
                    progress = document.createElement('div');
                    progress.className = 'pfy-progress';
                    progress.style.cssText = `
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        height: 5px;
                        width: 0%;
                        background: rgba(255,255,255,0.9);
                        transition: width 0.18s linear;
                        pointer-events: none;
                    `;
                    button.appendChild(progress);
                }
                progress.style.width = '0%';
                let pct = 0;
                const timer = setInterval(() => {
                    pct = Math.min(pct + 6, 90);
                    progress.style.width = pct + '%';
                }, 120);
                const groups = await fetchCategoriesData();
                const { tsv, count } = extractCategoriesTSVFromApi(groups);
                await copyToClipboard(tsv);
                const original = button.textContent;
                button.textContent = `Copied ${count} rows`;
                clearInterval(timer);
                progress.style.width = '100%';
                setTimeout(() => {
                    progress.style.width = '0%';
                    button.textContent = original;
                    button.disabled = false;
                }, 1500);
            } catch (err) {
                console.error('Copy failed:', err);
                const original = button.textContent;
                button.textContent = 'Copy failed';
                const progress = button.querySelector('.pfy-progress');
                if (progress) progress.style.width = '0%';
                setTimeout(() => {
                    button.textContent = original;
                    button.disabled = false;
                }, 1500);
            }
        });

        if (totalsSection.nextSibling) {
            headerFlexbox.insertBefore(container, totalsSection.nextSibling);
        } else {
            headerFlexbox.appendChild(container);
        }
        } finally {
            copyButtonPending = false;
        }
    }


    // Build TSV from API category groups
    function extractCategoriesTSVFromApi(categoryGroups) {
        const lines = [['Parent Category', 'Subcategory', 'Target']];
        const groups = (categoryGroups || []);

        const eligibleGroups = groups
            .filter(g => (g?.name || '') !== 'Internal Master Category' && !g?.hidden)
            .map(g => ({
                name: g.name || '',
                categories: (g.categories || []).filter(cat => {
                    const subName = cat?.name || '';
                    if (!subName) return false;
                    if (subName === 'Uncategorized') return false;
                    if (subName === 'Inflow: Ready to Assign') return false;
                    if (cat.hidden) return false;
                    return true;
                })
            }))
            .filter(g => g.categories.length > 0);

        eligibleGroups.forEach((group, idx) => {
            let parentPrinted = false;
            for (const cat of group.categories) {
                const subName = cat.name || '';
                const target = formatMonthlyTarget(cat) || '';
                lines.push([
                    sanitizeForTSV(parentPrinted ? '' : group.name),
                    sanitizeForTSV(subName),
                    sanitizeForTSV(target)
                ]);
                parentPrinted = true;
            }
            if (idx < eligibleGroups.length - 1) {
                lines.push(['', '', '']);
            }
        });

        const tsv = lines.map(cols => cols.join('\t')).join('\n');
        return { tsv, count: lines.length - 1 };
    }

    function sanitizeForTSV(value) {
        if (!value) return '';
        return String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
    }

    async function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!successful) throw new Error('execCommand copy failed');
    }

    // Fetch full category data via YNAB API using saved token
    async function fetchCategoriesData() {
        try {
            const result = await safeStorageGet('token');
            const token = result?.token;
            const budgetId = getBudgetId();
            if (!token || !budgetId) return {};

            const response = await fetch(`https://api.ynab.com/v1/budgets/${budgetId}/categories`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return [];

            const data = await response.json();
            const groups = data?.data?.category_groups || [];
            return groups;
        } catch (e) {
            console.warn('Failed to fetch targets:', e);
            return [];
        }
    }

    function normalizeKey(key) {
        return String(key)
            .trim()
            .toLowerCase()
            .replace(/[\s\t\n\r]+/g, ' ');
    }

    function cleanLabelForMatch(text) {
        if (!text) return '';
        let t = String(text);
        t = t.replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ');
        t = t.replace(/[^\u0020-\u007F]/g, ' ');
        t = t.replace(/[\$\u00a3\u20ac]/g, ' ');
        t = t.replace(/\b\d+\s*%\b/g, ' ');
        t = t.replace(/\b\d+(?:\.\d+)?\b/g, ' ');
        t = t.replace(/[\s\t\n\r]+/g, ' ').trim();
        return t;
    }

    function formatMonthlyTarget(category) {
        if (!category || !category.goal_type) return '';
        const type = category.goal_type;
        const cadence = category.goal_cadence || 0;
        const freq = category.goal_cadence_frequency || 1;
        const toMoney = (m) => (m / 1000).toFixed(2);

        if (type === 'MF' || type === 'NEED' || cadence === 1) {
            const amountMilli = category.goal_target || 0;
            if (!amountMilli) return '';
            return toMoney(amountMilli);
        }

        if (type === 'TBD') {
            let remainingMilli = null;
            if (typeof category.goal_overall_left === 'number') remainingMilli = category.goal_overall_left;
            if (remainingMilli === null && (typeof category.goal_overall_funded === 'number')) {
                remainingMilli = Math.max((category.goal_target || 0) - category.goal_overall_funded, 0);
            }
            if (remainingMilli === null) {
                const target = category.goal_target || 0;
                const balance = category.balance || 0;
                remainingMilli = Math.max(target - balance, 0);
            }
            const targetMonth = category.goal_target_month;
            if (!remainingMilli) return '0.00';
            const months = monthsUntil(targetMonth);
            const denom = Math.max(1, months);
            return toMoney(remainingMilli / denom);
        }

        if (cadence === 12) {
            const amountMilli = category.goal_target || 0;
            if (!amountMilli) return '';
            return toMoney((amountMilli * freq) / 12);
        }

        const amountMilli = category.goal_target || 0;
        if (!amountMilli) return '';
        return toMoney(amountMilli);
    }

    function monthsUntil(targetMonthStr) {
        if (!targetMonthStr) return 0;
        try {
            const m = String(targetMonthStr).slice(0, 7);
            const [y, mo] = m.split('-').map(n => parseInt(n, 10));
            if (!y || !mo) return 0;
            const now = new Date();
            const cy = now.getFullYear();
            const cmo = now.getMonth() + 1;
            const diff = (y - cy) * 12 + (mo - cmo);
            return diff <= 0 ? 1 : diff;
        } catch (_) {
            return 0;
        }
    }

    // Get current budget ID from URL
    function getBudgetId() {
        const href = window.location.href;
        const budgetsMatch = href.match(/budgets\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        if (budgetsMatch && budgetsMatch[1]) return budgetsMatch[1];
        const all = href.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/ig);
        return all && all.length ? all[all.length - 1] : null;
    }

    // Get settings for current budget (with migration)
    async function getBudgetSettings() {
        const budgetId = getBudgetId();
        if (!budgetId) return null;

        const settingsKey = `settings_${budgetId}`;
        const result = await safeStorageGet(settingsKey);
        if (!result) return null;
        const rawSettings = result[settingsKey];
        const settings = migrateSettings(rawSettings);

        // Persist migration if format changed
        if (rawSettings && !Array.isArray(rawSettings.allocations) && settings && Array.isArray(settings.allocations)) {
            await safeStorageSet({ [settingsKey]: settings });
        }

        return settings;
    }

    // Fetch inflow transactions for the current month
    async function fetchInflowTransactions(budgetId, token) {
        try {
            const now = new Date();
            const sinceDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const response = await fetch(
                `https://api.ynab.com/v1/budgets/${budgetId}/transactions?since_date=${sinceDate}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (!response.ok) {
                console.warn('Failed to fetch transactions:', response.status);
                return [];
            }

            const data = await response.json();
            const allTx = data.data.transactions || [];
            // Keep positive-amount (inflow), non-deleted, non-transfer transactions
            const transactions = allTx.filter(tx =>
                !tx.deleted &&
                tx.amount > 0 &&
                !tx.transfer_account_id
            );

            console.log(`[Profit First] ${allTx.length} total transactions this month, ${transactions.length} are inflows`);
            transactions.forEach(tx => {
                console.log(`[Profit First] Inflow: ${tx.payee_name} | memo: "${tx.memo}" | amount: ${tx.amount} | category: ${tx.category_name}`);
            });

            return transactions.map(tx => ({
                memo: tx.memo || '',
                amount: tx.amount, // milliunits
                payee_name: tx.payee_name || '',
                date: tx.date
            }));
        } catch (e) {
            console.warn('Failed to fetch inflow transactions:', e);
            return [];
        }
    }

    // Calculate tax deductions from inflow transactions based on tax rules
    function calculateTaxDeductions(transactions, taxRules) {
        if (!taxRules || taxRules.length === 0 || !transactions || transactions.length === 0) {
            return { totalTaxDeducted: 0, taxBreakdown: [] };
        }

        const breakdown = taxRules.map(rule => ({
            keyword: rule.keyword,
            rate: rule.rate,
            categoryId: rule.categoryId,
            amount: 0
        }));

        for (const tx of transactions) {
            const memo = (tx.memo || '').toLowerCase();
            for (let i = 0; i < taxRules.length; i++) {
                const keyword = (taxRules[i].keyword || '').toLowerCase();
                if (keyword && memo.includes(keyword)) {
                    // tx.amount is in milliunits and includes tax, extract tax portion
                    // e.g. $1130 with 13% HST: tax = 1130 * 13 / 113 = $130
                    breakdown[i].amount += (tx.amount * taxRules[i].rate) / (100 + taxRules[i].rate);
                }
            }
        }

        // Filter to only rules that actually matched, convert milliunits to dollars
        const matched = breakdown
            .filter(b => b.amount > 0)
            .map(b => ({
                ...b,
                amount: b.amount / 1000 // convert milliunits to dollars
            }));

        const totalTaxDeducted = matched.reduce((sum, b) => sum + b.amount, 0);

        return { totalTaxDeducted, taxBreakdown: matched };
    }

    async function showProfitFirstModal() {
        try {
            const settings = await getBudgetSettings();
            if (!settings || !settings.allocations || settings.allocations.length === 0) {
                alert('Please configure your Profit First settings first.');
                return;
            }

            // Get ready to assign amount
            const readyToAssign = getReadyToAssignAmount();
            if (readyToAssign === null) {
                alert('Could not find Ready to Assign amount.');
                return;
            }

            // Fetch inflow transactions and calculate tax deductions
            const tokenResult = await safeStorageGet('token');
            const token = tokenResult?.token;
            const budgetId = getBudgetId();
            let taxResult = { totalTaxDeducted: 0, taxBreakdown: [] };

            if (token && budgetId && settings.taxRules && settings.taxRules.length > 0) {
                const transactions = await fetchInflowTransactions(budgetId, token);
                taxResult = calculateTaxDeductions(transactions, settings.taxRules);
            }

            const postTaxAmount = readyToAssign - taxResult.totalTaxDeducted;

            // Calculate allocation amounts from post-tax amount
            const allocationAmounts = settings.allocations.map(alloc => ({
                name: alloc.name,
                percentage: alloc.percentage,
                categoryId: alloc.categoryId,
                amount: (postTaxAmount * alloc.percentage) / 100
            }));

            // Build modal content
            let modalHTML = `
                <h2>Profit First Calculations</h2>
                <div class="ready-to-assign">
                    Ready to Assign
                    <span class="amount">${formatCurrency(readyToAssign)}</span>
                </div>
            `;

            // Tax deductions section (only if there are matches)
            if (taxResult.taxBreakdown.length > 0) {
                modalHTML += `<div class="section-label">Tax Deductions</div>`;
                modalHTML += `<div class="calculations tax-deductions">`;
                for (const tax of taxResult.taxBreakdown) {
                    modalHTML += `
                        <div class="calc-row tax-row">
                            <span class="label">
                                ${escapeHtml(tax.keyword)} Tax
                                <span class="percentage">${tax.rate}%</span>
                            </span>
                            <span class="amount tax-amount">-${formatCurrency(tax.amount)}</span>
                        </div>
                    `;
                }
                modalHTML += `</div>`;

                modalHTML += `
                    <div class="post-tax-amount">
                        Post-Tax Amount
                        <span class="amount">${formatCurrency(postTaxAmount)}</span>
                    </div>
                `;
            }

            // Allocations section
            modalHTML += `<div class="section-label">Allocations</div>`;
            modalHTML += `<div class="calculations">`;
            for (const alloc of allocationAmounts) {
                modalHTML += `
                    <div class="calc-row">
                        <span class="label">
                            ${escapeHtml(alloc.name)}
                            <span class="percentage">${alloc.percentage}%</span>
                        </span>
                        <span class="amount">${formatCurrency(alloc.amount)}</span>
                    </div>
                `;
            }
            modalHTML += `</div>`;
            modalHTML += `<button id="assign-all" class="assign-button">Assign All</button>`;

            // Build the assignment list: tax category amounts + allocation amounts
            const assignments = [];
            for (const tax of taxResult.taxBreakdown) {
                assignments.push({ categoryId: tax.categoryId, amount: tax.amount });
            }
            for (const alloc of allocationAmounts) {
                assignments.push({ categoryId: alloc.categoryId, amount: alloc.amount });
            }

            showModal(modalHTML, assignments);
        } catch (error) {
            console.error('Error showing Profit First modal:', error);
            alert('An error occurred while showing the Profit First calculations.');
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Helper function to show modal
    function showModal(content, assignments) {
        const existingModal = document.querySelector('.profit-first-modal-wrapper');
        const existingOverlay = document.querySelector('.profit-first-overlay');
        if (existingModal) document.body.removeChild(existingModal);
        if (existingOverlay) document.body.removeChild(existingOverlay);

        const modalWrapper = document.createElement('div');
        modalWrapper.className = 'profit-first-modal-wrapper';
        modalWrapper.innerHTML = content;

        const overlay = document.createElement('div');
        overlay.className = 'profit-first-overlay';
        overlay.addEventListener('click', closeModal);

        document.body.appendChild(overlay);
        document.body.appendChild(modalWrapper);

        const assignButton = modalWrapper.querySelector('#assign-all');
        if (assignButton) {
            assignButton.addEventListener('click', async () => {
                try {
                    assignButton.disabled = true;
                    assignButton.textContent = 'Assigning...';
                    await assignAmounts(assignments);
                    closeModal();
                } catch (error) {
                    console.error('Error assigning amounts:', error);
                    alert('An error occurred while assigning amounts.');
                    assignButton.disabled = false;
                    assignButton.textContent = 'Assign All';
                }
            });
        }
    }

    // Assign amounts to YNAB categories - accepts generic [{categoryId, amount}] array
    async function assignAmounts(assignments) {
        try {
            const rows = Array.from(document.querySelectorAll('.budget-table-row'));

            for (const { categoryId, amount } of assignments) {
                try {
                    const row = rows.find(r => r.getAttribute('data-entity-id') === categoryId);

                    if (!row) {
                        console.error(`Could not find category with ID: ${categoryId}`);
                        continue;
                    }

                    const budgetedCell = row.querySelector('.budget-table-cell-budgeted');
                    if (!budgetedCell) {
                        console.error(`Could not find budgeted cell for category ID: ${categoryId}`);
                        continue;
                    }

                    budgetedCell.click();
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const input = document.activeElement;
                    if (!input || !input.matches('input')) {
                        console.error(`Could not find active input for category ID: ${categoryId}`);
                        continue;
                    }

                    const formattedAmount = amount.toFixed(2);
                    const keys = ['+', ...formattedAmount];
                    for (const key of keys) {
                        input.value += key;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }

                    input.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        bubbles: true
                    }));

                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.error(`Error assigning amount to category ${categoryId}:`, error);
                }
            }

            console.log('Finished assigning amounts');
        } catch (error) {
            console.error('Error in assignAmounts:', error);
            throw error;
        }
    }

    // Helper function to get ready to assign amount
    function getReadyToAssignAmount() {
        const readyToAssignElement = document.querySelector('.to-be-budgeted-amount .user-data.currency');
        if (!readyToAssignElement) {
            console.log('Could not find ready to assign amount');
            return null;
        }

        const amountText = readyToAssignElement.textContent.trim();
        console.log('Raw amount text:', amountText);

        const amount = parseFloat(amountText.replace(/[^0-9.-]+/g, ""));
        console.log('Parsed amount:', amount);

        if (isNaN(amount)) {
            console.log('Failed to parse amount');
            return null;
        }

        return amount;
    }

    // Helper function to close modal
    function closeModal() {
        const modal = document.querySelector('.profit-first-modal-wrapper');
        const overlay = document.querySelector('.profit-first-overlay');
        if (modal) document.body.removeChild(modal);
        if (overlay) document.body.removeChild(overlay);
    }

    // Helper function to format currency
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // Watch for header to appear
    const observer = new MutationObserver((mutations) => {
        if (!document.querySelector('.budget-header-profit-first')) {
            addProfitFirstButton();
        }
        if (!document.querySelector('.budget-header-copy-categories')) {
            addCopyCategoriesButton();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Try to add buttons immediately
    console.log('Attempting initial button injection');
    addProfitFirstButton();
    addCopyCategoriesButton();
}
