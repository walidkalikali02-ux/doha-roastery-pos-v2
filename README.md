<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/19f3X-RsBRC31qSu1IpqBvB9oDAxEo9DL

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Cash Management Features

The system includes comprehensive cash management functionality:

- **Cash Drawer Management**: Complete shift-based cash tracking system
- **Cash In/Out Operations**: Record petty cash movements with detailed reasons
- **End-of-Day Reconciliation**: Compare expected vs actual cash with automatic discrepancy detection
- **Discrepancy Reporting**: Automatic alerts for cash variances during shift closing
- **Cash Reports**: Generate detailed cash movement reports for accounting and auditing

### Database Setup for Cash Features

To enable cash management features, run the SQL script:
```sql
-- Execute enable_cash_features.sql in your Supabase SQL Editor
```

This creates the necessary `cash_movements` table and adds required columns to the `shifts` table.
