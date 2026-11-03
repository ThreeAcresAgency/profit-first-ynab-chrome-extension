// Works out which month's inflows to tax: the month currently open in YNAB.
// YNAB's budget URL carries the selected month as /budget/YYYYMM; with no
// month in the URL (e.g. the default current-month view) we fall back to today.
function getSelectedMonthRange(href, now = new Date()) {
    let year = now.getFullYear();
    let month = now.getMonth() + 1; // 1-12

    const match = (href || '').match(/\/budget\/(\d{4})(\d{2})(?!\d)/);
    if (match) {
        const y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        if (m >= 1 && m <= 12) {
            year = y;
            month = m;
        }
    }

    const pad = (n) => String(n).padStart(2, '0');
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;

    return {
        sinceDate: `${year}-${pad(month)}-01`,       // inclusive
        untilDate: `${nextYear}-${pad(nextMonth)}-01` // exclusive
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getSelectedMonthRange };
}
