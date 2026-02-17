# Doha Roastery Management System - Comprehensive Documentation

## **1. Introduction**
Doha Roastery Management System is a comprehensive ERP and POS solution tailored for coffee roasteries. It manages the entire lifecycle of coffee production—from green bean procurement and roasting to packaging, inventory distribution, and final retail sale.

---

## **2. Core Modules & Features**

### **2.1 Dashboard & Analytics** ([DashboardView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/DashboardView.tsx))
- **Real-time Stats**: Track Today's Sales, Roasting Batches, Available Stock (kg), and Waste Ratio.
- **Visual Trends**: Weekly sales analysis (Bar Chart) and Roasting Activity (Line Chart).
- **Critical Alerts**: Automatic notifications for low green bean stock.
- **Recent Activity**: Quick view of the latest roasting batches and their status.

### **2.2 Roasting Management** ([RoastingView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/RoastingView.tsx))
- **Batch Tracking**: Record input (green) vs. output (roasted) weights.
- **Auto-Waste Calculation**: Real-time calculation of loss percentage during roasting.
- **Workflow Stages**: `In Progress` → `Cooling` → `Ready for Packaging` → `Completed`.
- **Operator Attribution**: Track which roaster handled each batch.
- **Traceability**: Connects every roasted batch back to the specific green bean source.

### **2.3 Production & Packaging** ([RoastingView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/RoastingView.tsx))
- **Packaging Units**: Convert roasted batches into retail units (e.g., 250g, 500g, 1kg bags).
- **Inventory Integration**: Automatically adds packaged units to the "Packaged Coffee" inventory.
- **Label Printing**: Generate and print professional labels with SKU, weight, and roast date.

### **2.4 Inventory & Distribution** ([InventoryView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/InventoryView.tsx))
- **Multi-Location Management**: Track stock across the Central Warehouse, Roastery, and Retail Branches (e.g., Katara).
- **Stock Transfers**: Formal process for moving inventory between locations.
- **Adjustments & Audits**: Record damage, theft, or counting errors with a manager approval workflow for high-value items.
- **Green Bean Inventory**: Specialized tracking for raw materials including origin, quality grade, and cost per kg.

### **2.5 Point of Sale (POS)** ([POSView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/POSView.tsx))
- **Retail Interface**: Fast, touch-friendly interface for cashiers.
- **Multi-Category Support**: Sell Packaged Coffee, Beverages, and Accessories.
- **Payment Methods**: Supports Cash and Card payments.
- **Thermal Printing**: Professional receipt generation optimized for 58mm/80mm thermal printers.
- **Automatic Checkout**: Instant inventory deduction and transaction recording upon payment.
- **Cash Management**: Complete cash drawer management system with:
  - **Shift Management**: Start/close shifts with initial cash tracking
  - **Cash In/Out Operations**: Record petty cash movements with reasons
  - **End-of-Day Reconciliation**: Compare expected vs actual cash with discrepancy reporting
  - **Discrepancy Alerts**: Automatic notifications for cash variances
  - **Cash Reports**: Generate detailed cash movement reports for auditing

### **2.6 AI Insights (Powered by Gemini)** ([AIInsights.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/AIInsights.tsx))
- **Smart Business Analyst**: Analyzes sales and waste data to provide operational advice in Arabic/English.
- **Stock Prediction**: Forecasts upcoming inventory needs based on historical sales patterns.
- **Optimization Opportunities**: Identifies areas to reduce waste and improve margins.

### **2.7 Reports & Analytics** ([ReportsView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/ReportsView.tsx))
- **Sales Distribution**: Visual charts showing product performance across categories.
- **Profitability Analysis**: Track margins and identify top-performing products.
- **Cash Management Reports**: Comprehensive cash flow analysis including:
  - **Daily Cash Summary**: Opening balance, sales, cash movements, and closing totals
  - **Reconciliation Status**: Track expected vs actual cash with discrepancy alerts
  - **Movement History**: Detailed log of all cash in/out operations with reasons
  - **Export Capabilities**: Generate PDF reports for accounting and auditing

### **2.8 System Configuration** ([ConfigurationView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/ConfigurationView.tsx))
- **Product Catalog**: Manage the global list of products, descriptions, and base prices.
- **Package Templates**: Define bag sizes, weights, and material costs.
- **Store Settings**: Configure store name, address, contact info, and VAT rates.
- **Database Tools**: Built-in schema integrity checks and SQL update scripts.

---

## **3. User Roles & Permissions** ([AuthContext.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/contexts/AuthContext.tsx))

| Role | Permissions |
| :--- | :--- |
| **Admin** | Full access to all modules, including system settings and user management. |
| **Manager** | Manage inventory, roasting, sales, and view reports. Approve stock adjustments. |
| **Roaster** | Focus on roasting batches and inventory adjustments for raw materials. |
| **Cashier** | Access to POS, transaction history, and basic sales reports. |
| **Warehouse** | Manage stock levels, transfers, and raw material intake. |

---

## **4. Technical Workflow: The "Bean-to-Cup" Journey**

1. **Intake**: Green beans are added to inventory in `InventoryView`.
2. **Roasting**: A roaster starts a batch in `RoastingView`, selecting the green bean variety.
3. **Packaging**: Upon completion, the roasted weight is recorded, and the batch is divided into retail bags using `Package Templates`.
4. **Distribution**: Packaged bags are transferred from the Roastery to the Retail Branch.
5. **Sale**: A customer purchases a bag via `POSView`. The system deducts the item from branch stock and records the sale.
6. **Cash Management**: Cashiers manage the cash drawer through shift operations, record petty cash movements, and perform end-of-day reconciliation with discrepancy reporting.
7. **Analysis**: `AI Insights` reviews the transaction and roasting waste to suggest improvements for the next cycle.

---

## **5. Hardware Integration**

### **Thermal Printing (Python Module)**
The system includes a specialized Python module ([receipt_printer.py](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/thermal_printer/receipt_printer.py)) that handles:
- **ESC/POS Commands**: Low-level communication with thermal printers.
- **Bilingual Receipts**: Support for RTL Arabic text and LTR English text.
- **Configurable Widths**: Seamlessly switches between 58mm and 80mm paper.

---

## **6. Internationalization**
The system is fully bilingual (**Arabic & English**) with a layout that automatically flips (RTL/LTR) based on the selected language. All labels and messages are managed in [translations.ts](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/translations.ts).
