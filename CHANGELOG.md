# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1] - 2026-07-03

### Fixed
- Tax rules now detect keywords (e.g. `HST`) that appear on a **split
  transaction's** memo. Previously only the parent transaction's memo was
  checked, so tax on a split leg was never set aside.

### Changed
- Split transactions are matched per leg: each subtransaction's own memo is
  checked and that leg's amount is used as the tax base. Normal (non-split)
  transactions are unchanged.
- The `[keyword]` "already-processed" marker is appended to the parent memo
  when the keyword only appeared on a split leg, because YNAB's API cannot
  update subtransactions. The parent memo remains the source of truth for
  whether a transaction has already been processed.

### Docs
- Documented split-transaction support and added an "Updating the Extension"
  section to the README.

## [1.0] - Initial release

### Added
- "Assign Profit First Money" button injected into the YNAB budget page.
- Configurable Profit First allocations (percentages mapped to YNAB
  categories) with a 100% validation check.
- Tax rules: extract sales tax (HST/GST/VAT) from current-month inflow
  transactions by memo keyword before the Profit First split, and set the
  tax aside in a chosen category.
- Automatic `[keyword]` memo marking to avoid taxing the same transaction
  twice.
