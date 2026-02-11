# Profit First for YNAB Chrome Extension

A Chrome extension that applies the [Profit First](https://profitfirstbook.com/) methodology to your YNAB budget. It adds an "Assign Profit First Money" button directly into the YNAB interface that automatically splits your "Ready to Assign" amount into your configured allocation categories.

![Assign Profit First Money Button](docs/screenshot.png)

## Demo

<video src="https://github.com/ThreeAcresAgency/profit-first-ynab-chrome-extension/raw/main/docs/demo.mp4" controls width="100%"></video>

## Download & Installation

### 1. Download the Extension

[**Download ZIP**](https://github.com/ThreeAcresAgency/profit-first-ynab-chrome-extension/archive/refs/heads/main.zip)

After downloading, extract the ZIP file to a folder on your computer.

### 2. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `extension/` folder inside the extracted folder
5. The extension icon should now appear in your Chrome toolbar

### 3. Get Your YNAB API Token

1. Log in to YNAB and go to [Account Settings](https://app.ynab.com/settings)
2. Scroll down to the **Developer Settings** section
3. Click **New Token**
4. Enter your YNAB password to confirm
5. Copy the token that appears — you will only see it once, so save it somewhere safe

### 4. Connect the Extension

1. Open your budget in YNAB (`app.ynab.com`)
2. Click the Profit First extension icon in Chrome's toolbar
3. Paste your API token and click **Connect**
4. Configure your allocation percentages and map each one to a YNAB category
5. Your percentages must add up to exactly **100%**
6. Click **Save Settings**

## How It Works

### Allocations

When you click the **Assign Profit First Money** button on the YNAB budget page, the extension:

1. Reads your **Ready to Assign** amount
2. Subtracts any tax deductions (see below)
3. Splits the remaining amount according to your configured percentages
4. Assigns each amount to its mapped YNAB category

The default Profit First allocations are:

| Category    | Percentage |
|-------------|-----------|
| Tax         | 15%       |
| Owner's Pay | 50%       |
| Operations  | 30%       |
| Profit      | 5%        |

You can fully customize these — add, remove, or rename categories and adjust percentages to fit your needs.

### Tax Rules

Tax rules let you automatically calculate and set aside sales tax (e.g., HST, GST, VAT) from your income before the Profit First split happens.

**How tax rules work:**

- You configure each tax rule with a **keyword**, a **tax rate**, and a **YNAB category**
- The extension looks at all **inflow transactions in the current month** and checks each transaction's memo for your keyword
- When a match is found, it calculates the tax portion from the tax-inclusive amount. For example, if you received $1,130 and your HST rate is 13%, the tax portion is $1,130 x 13 / 113 = **$130**
- The total tax across all matching transactions is deducted from your Ready to Assign amount before the Profit First percentages are applied
- The tax amount is assigned to the YNAB category you specified in the rule

**Example:** You're a freelancer in Ontario and charge 13% HST. You add a tax rule with keyword `HST`, rate `13`, mapped to your "HST Owing" category. When you click "Assign Profit First Money", the extension scans this month's inflows, extracts the HST from any transaction with "HST" in the memo, sets that aside into your HST category, and then splits the remaining amount using your Profit First percentages.

## Credits

Created by [Three Acres](https://threeacres.ca)
