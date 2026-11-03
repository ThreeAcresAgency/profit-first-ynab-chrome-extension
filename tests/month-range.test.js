// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const { getSelectedMonthRange } = require('../extension/month-range.js');

const NOW = new Date(2026, 10, 3); // 3 Nov 2026
const BUDGET = 'https://app.ynab.com/0d6f7a2c-1111-4222-8333-944455556666/budget';

test('uses the month selected in the YNAB URL', () => {
    assert.deepStrictEqual(getSelectedMonthRange(`${BUDGET}/202610`, NOW), {
        sinceDate: '2026-10-01',
        untilDate: '2026-11-01'
    });
});

test('December rolls over to January of the next year', () => {
    assert.deepStrictEqual(getSelectedMonthRange(`${BUDGET}/202512`, NOW), {
        sinceDate: '2025-12-01',
        untilDate: '2026-01-01'
    });
});

test('falls back to the current month when the URL has no month', () => {
    assert.deepStrictEqual(getSelectedMonthRange(BUDGET, NOW), {
        sinceDate: '2026-11-01',
        untilDate: '2026-12-01'
    });
});

test('ignores an invalid month in the URL', () => {
    assert.deepStrictEqual(getSelectedMonthRange(`${BUDGET}/202613`, NOW), {
        sinceDate: '2026-11-01',
        untilDate: '2026-12-01'
    });
});
