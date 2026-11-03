const test = require('node:test');
const assert = require('node:assert');
const { sumReadyToAssignIncome } = require('../extension/month-income.js');

const RTA = 'Inflow: Ready to Assign';

test('sums inflows categorized to Ready to Assign', () => {
    const txs = [
        { amount: 1130000, category_name: RTA, subtransactions: [] },
        { amount: 500000, category_name: RTA, subtransactions: [] }
    ];
    assert.strictEqual(sumReadyToAssignIncome(txs), 1630000);
});

test('ignores refunds categorized to spending categories', () => {
    const txs = [
        { amount: 1000000, category_name: RTA, subtransactions: [] },
        { amount: 45000, category_name: 'Software', subtransactions: [] }
    ];
    assert.strictEqual(sumReadyToAssignIncome(txs), 1000000);
});

test('counts only the Ready to Assign legs of a split', () => {
    const txs = [{
        amount: 1200000,
        category_name: 'Split',
        subtransactions: [
            { amount: 1130000, category_name: RTA },
            { amount: 70000, category_name: 'Office Supplies' }
        ]
    }];
    assert.strictEqual(sumReadyToAssignIncome(txs), 1130000);
});

test('accepts the old "To be Budgeted" name', () => {
    const txs = [{ amount: 250000, category_name: 'Inflow: To be Budgeted', subtransactions: [] }];
    assert.strictEqual(sumReadyToAssignIncome(txs), 250000);
});

test('no transactions means no income', () => {
    assert.strictEqual(sumReadyToAssignIncome([]), 0);
});
