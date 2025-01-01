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
        button.textContent = 'Profit First';
        button.className = 'button button-primary';
        button.style.cssText = `
            background-color: #23B2CE;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        `;
        
        container.appendChild(button);
        button.addEventListener('click', () => {
            console.log('Profit First button clicked');
            showCalculations();
        });
        
        // Insert before the days section
        headerFlexbox.insertBefore(container, daysSection);
        console.log('Button added successfully');
    }

    // Get current budget ID from URL
    function getBudgetId() {
        const match = window.location.href.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
        return match ? match[0] : null;
    }

    // Create and show modal with calculations
    async function showCalculations() {
        console.log('Showing calculations');
        
        // Get ready to assign amount from the DOM
        const readyToAssignElement = document.querySelector('.to-be-budgeted-amount .user-data.currency');
        if (!readyToAssignElement) {
            console.log('Could not find ready to assign amount');
            alert('Could not find Ready to Assign amount. Please make sure you are on the budget page.');
            return;
        }

        // Clean up the amount string and parse it
        const amountText = readyToAssignElement.textContent.trim();
        console.log('Raw amount text:', amountText);
        
        // Remove currency symbol, commas, and handle negative amounts
        const amount = parseFloat(amountText.replace(/[^0-9.-]+/g, ""));
        console.log('Parsed amount:', amount);

        if (isNaN(amount)) {
            console.log('Failed to parse amount');
            alert('Could not read the Ready to Assign amount. Please refresh the page and try again.');
            return;
        }
        
        // Get settings
        const { settings } = await chrome.storage.sync.get('settings');
        if (!settings) {
            alert('Please configure Profit First settings first');
            return;
        }

        console.log('Retrieved settings:', settings);

        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 9999;
            min-width: 300px;
        `;

        // Calculate amounts
        const calculations = {
            ownerPay: (amount * settings.percentages.ownerPay / 100).toFixed(2),
            tax: (amount * settings.percentages.tax / 100).toFixed(2),
            opex: (amount * settings.percentages.opex / 100).toFixed(2),
            profit: (amount * settings.percentages.profit / 100).toFixed(2)
        };

        console.log('Calculated amounts:', calculations);

        // Show calculations
        modal.innerHTML = `
            <h2 style="margin-top: 0;">Profit First Calculations</h2>
            <div style="margin-bottom: 20px;">
                <strong>Ready to Assign:</strong> $${amount.toFixed(2)}<br><br>
                <strong>Owner's Pay:</strong> $${calculations.ownerPay}<br>
                <strong>Tax:</strong> $${calculations.tax}<br>
                <strong>Operating Expenses:</strong> $${calculations.opex}<br>
                <strong>Profit:</strong> $${calculations.profit}
            </div>
            <button id="assign-all" style="width: 100%; padding: 10px; background: #23B2CE; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Assign All
            </button>
        `;

        // Add overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 9998;
        `;

        // Close on overlay click
        overlay.addEventListener('click', () => {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        });

        // Handle assign all button
        modal.querySelector('#assign-all').addEventListener('click', async () => {
            console.log('Assigning amounts');
            await assignAmounts(calculations, settings.categories);
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        });

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    // Assign amounts to categories
    async function assignAmounts(amounts, categories) {
        console.log('Starting to assign amounts:', amounts, categories);
        
        for (const [type, amount] of Object.entries(amounts)) {
            const categoryId = categories[type];
            if (!categoryId) {
                console.log(`No category ID for ${type}, skipping`);
                continue;
            }

            console.log(`Assigning ${amount} to category ${categoryId}`);
            const row = document.querySelector(`[data-entity-id="${categoryId}"]`);
            if (!row) {
                console.log(`Could not find row for category ${categoryId}`);
                continue;
            }

            const input = row.querySelector('.budget-table-cell-budgeted input');
            if (!input) {
                console.log(`Could not find input for category ${categoryId}`);
                continue;
            }

            try {
                // Focus and click the input
                input.focus();
                input.click();
                
                // Set value and trigger events
                input.value = amount;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));

                console.log(`Successfully assigned ${amount} to ${type}`);
                // Wait a bit before moving to next input
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error assigning amount to ${type}:`, error);
            }
        }
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
