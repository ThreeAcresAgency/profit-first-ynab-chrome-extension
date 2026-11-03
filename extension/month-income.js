// Income for one month = inflows categorized to Ready to Assign. Refunds and
// other inflows assigned straight to a spending category don't count. For a
// split, only the legs categorized to Ready to Assign count.
// Returns milliunits.
const READY_TO_ASSIGN_CATEGORY = /ready to assign|to be budgeted/i;

function isReadyToAssign(categoryName) {
    return READY_TO_ASSIGN_CATEGORY.test(categoryName || '');
}

function sumReadyToAssignIncome(transactions) {
    let total = 0;
    for (const tx of transactions || []) {
        const legs = (tx.subtransactions && tx.subtransactions.length > 0)
            ? tx.subtransactions
            : [tx];
        for (const leg of legs) {
            if (leg.amount > 0 && isReadyToAssign(leg.category_name)) {
                total += leg.amount;
            }
        }
    }
    return total;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sumReadyToAssignIncome };
}
