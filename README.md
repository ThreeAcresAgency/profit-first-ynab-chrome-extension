# Profit First for YNAB Chrome Extension

A Chrome extension that helps calculate Profit First percentages using your YNAB budget data.

## Testing Instructions

1. Get your YNAB API Token:
   - Go to https://app.ynab.com/settings
   - Scroll down to "Developer Settings"
   - Click "New Token" and copy it

2. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select this directory

3. Test the extension:
   - Click the extension icon in Chrome
   - Paste your YNAB API token
   - Click "Connect"
   - Try modifying percentages in Settings
   - Verify calculations update correctly

## Features
- Connects to YNAB API to get real revenue data
- Customizable Profit First percentages
- Persistent settings storage
- Real-time calculation updates
