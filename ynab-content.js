// Initialize only once
if (!window.profitFirstInitialized) {
    window.profitFirstInitialized = true;
    console.log('Initializing Profit First extension');

    // Add button to header
    function addProfitFirstButton() {
        // Look for the budget header flexbox
        const headerFlexbox = document.querySelector('.budget-header-flexbox');
        const daysSection = document.querySelector('.budget-header-days');
        if (!headerFlexbox || !daysSection || document.querySelector('.budget-header-profit-first')) return;

        console.log('Found header, adding button');
        const container = document.createElement('div');
        container.className = 'budget-header-item budget-header-profit-first';
        
        const button = document.createElement('button');
        button.textContent = 'Assign Profit First Money ▼';
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
        `;
        
        container.appendChild(button);
        button.addEventListener('click', showProfitFirstModal);
        
        // Insert before the days section
        headerFlexbox.insertBefore(container, daysSection);
        console.log('Button added successfully');
    }

    // Get current budget ID from URL
    function getBudgetId() {
        const match = window.location.href.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
        return match ? match[0] : null;
    }

    // Get settings for current budget
    async function getBudgetSettings() {
        const budgetId = getBudgetId();
        if (!budgetId) return null;

        const settingsKey = `settings_${budgetId}`;
        const { [settingsKey]: settings } = await chrome.storage.sync.get(settingsKey);
        return settings;
    }

    async function showProfitFirstModal() {
        try {
            const settings = await getBudgetSettings();
            if (!settings) {
                alert('Please configure your Profit First settings first.');
                return;
            }

            // Get ready to assign amount
            const amount = getReadyToAssignAmount();
            if (amount === null) {
                alert('Could not find Ready to Assign amount.');
                return;
            }

            // Calculate amounts
            const amounts = {
                tax: (amount * settings.percentages.tax) / 100,
                ownerPay: (amount * settings.percentages.ownerPay) / 100,
                opex: (amount * settings.percentages.opex) / 100,
                profit: (amount * settings.percentages.profit) / 100
            };

            // Create modal content
            const modalContent = `
                <h2>Profit First Calculations</h2>
                <div class="ready-to-assign">
                    Ready to Assign
                    <span class="amount">${formatCurrency(amount)}</span>
                </div>
                <div class="calculations">
                    <div class="calc-row">
                        <span class="label">
                            Tax
                            <span class="percentage">${settings.percentages.tax}%</span>
                        </span>
                        <span class="amount">${formatCurrency(amounts.tax)}</span>
                    </div>
                    <div class="calc-row">
                        <span class="label">
                            Owner's Pay
                            <span class="percentage">${settings.percentages.ownerPay}%</span>
                        </span>
                        <span class="amount">${formatCurrency(amounts.ownerPay)}</span>
                    </div>
                    <div class="calc-row">
                        <span class="label">
                            Operations
                            <span class="percentage">${settings.percentages.opex}%</span>
                        </span>
                        <span class="amount">${formatCurrency(amounts.opex)}</span>
                    </div>
                    <div class="calc-row">
                        <span class="label">
                            Profit
                            <span class="percentage">${settings.percentages.profit}%</span>
                        </span>
                        <span class="amount">${formatCurrency(amounts.profit)}</span>
                    </div>
                </div>
                <button id="assign-all" class="assign-button">Assign All</button>
            `;

            // Show modal with the calculated amounts and settings
            showModal(modalContent, amounts, settings);
        } catch (error) {
            console.error('Error showing Profit First modal:', error);
            alert('An error occurred while showing the Profit First calculations.');
        }
    }

    // Helper function to show modal
    function showModal(content, amounts, settings) {
        // Remove any existing modals
        const existingModal = document.querySelector('.profit-first-modal-wrapper');
        const existingOverlay = document.querySelector('.profit-first-overlay');
        if (existingModal) document.body.removeChild(existingModal);
        if (existingOverlay) document.body.removeChild(existingOverlay);

        // Create wrapper
        const modalWrapper = document.createElement('div');
        modalWrapper.className = 'profit-first-modal-wrapper';
        modalWrapper.innerHTML = content;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'profit-first-overlay';

        // Close modal when clicking overlay
        overlay.addEventListener('click', closeModal);

        // Add to document
        document.body.appendChild(overlay);
        document.body.appendChild(modalWrapper);

        // Add click handler for assign button
        const assignButton = modalWrapper.querySelector('#assign-all');
        if (assignButton) {
            assignButton.addEventListener('click', async () => {
                try {
                    assignButton.disabled = true;
                    assignButton.textContent = 'Assigning...';
                    await assignAmounts(amounts, settings.categories);
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

    // Helper function to assign amounts
    async function assignAmounts(amounts, categories) {
        try {
            // Get all category rows
            const rows = Array.from(document.querySelectorAll('.budget-table-row'));
            
            // Map of our categories to their amounts
            const assignments = [
                { id: categories.tax, amount: amounts.tax },
                { id: categories.ownerPay, amount: amounts.ownerPay },
                { id: categories.opex, amount: amounts.opex },
                { id: categories.profit, amount: amounts.profit }
            ];

            for (const { id, amount } of assignments) {
                try {
                    // Find the row for this category by data-entity-id
                    const row = rows.find(row => row.getAttribute('data-entity-id') === id);

                    if (!row) {
                        console.error(`Could not find category with ID: ${id}`);
                        continue;
                    }

                    // Find and click the budgeted cell to activate the input
                    const budgetedCell = row.querySelector('.budget-table-cell-budgeted');
                    if (!budgetedCell) {
                        console.error(`Could not find budgeted cell for category ID: ${id}`);
                        continue;
                    }

                    // Click the cell to activate the input
                    budgetedCell.click();
                    
                    // Wait for input to be focused
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Find the actual input field - it might be in a modal or directly in the cell
                    const input = document.activeElement;
                    if (!input || !input.matches('input')) {
                        console.error(`Could not find active input for category ID: ${id}`);
                        continue;
                    }

                    // Type the plus sign and amount
                    const formattedAmount = amount.toFixed(2);
                    
                    // Simulate typing each character
                    const keys = ['+', ...formattedAmount];
                    for (const key of keys) {
                        // Type the character
                        input.value += key;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                    
                    // Press Enter to confirm
                    input.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        bubbles: true
                    }));

                    // Wait before moving to next category
                    await new Promise(resolve => setTimeout(resolve, 300));

                } catch (error) {
                    console.error(`Error assigning amount to category ${id}:`, error);
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

        // Clean up the amount string and parse it
        const amountText = readyToAssignElement.textContent.trim();
        console.log('Raw amount text:', amountText);
        
        // Remove currency symbol, commas, and handle negative amounts
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
        if (!document.querySelector('.profit-first-button')) {
            addProfitFirstButton();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Try to add button immediately
    console.log('Attempting initial button injection');
    addProfitFirstButton();
}
