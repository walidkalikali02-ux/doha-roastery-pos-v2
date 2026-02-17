# Doha Roastery Management System - Deep Code Analysis & Documentation

## **System Architecture**
The Doha Roastery Management System is a modern, full-stack web application designed for coffee roasting businesses. It follows a modular architecture using **React (TypeScript)** for the frontend, **Supabase** for backend-as-a-service (database, auth, storage), and a custom **Python Thermal Receipt Module** for hardware integration.

### **Core Technologies**
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Recharts.
- **Backend**: Supabase (PostgreSQL, Auth, PostgREST).
- **Hardware Integration**: Python (ESC/POS) for thermal printers.
- **AI Integration**: Google Gemini AI for operational insights and stock prediction.

---

## **Module Breakdown**

### **1. Authentication & Security** ([AuthContext.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/contexts/AuthContext.tsx))
- **Role-Based Access Control (RBAC)**: Supports roles like `ADMIN`, `MANAGER`, `ROASTER`, `CASHIER`, and `WAREHOUSE_STAFF`.
- **Permissions**: Granular control (e.g., `can_roast`, `can_sell`, `can_view_reports`).
- **Demo Mode**: Allows testing with simulated roles without requiring a database connection.

### **2. Point of Sale (POS)** ([POSView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/POSView.tsx))
- **Checkout Flow**: Handles cart management, payment processing, and inventory updates.
- **Thermal Printing**: Custom CSS media queries (`@media print`) and a dedicated hidden `#thermal-receipt` element ensure high-quality printing on 58mm/80mm thermal paper.
- **Automatic Printing**: A 300ms delayed trigger initiates the print dialog immediately after a successful transaction.

### **3. Roasting & Production** ([RoastingView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/RoastingView.tsx))
- **Batch Management**: Tracks roasting from "Green Bean" to "Packaged Product".
- **Waste Calculation**: Automatically calculates weight loss percentage during roasting.
- **Inventory Integration**: Converts raw beans into packaged inventory items upon completion.

### **4. Inventory & Warehouse** ([InventoryView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/InventoryView.tsx), [inventoryService.ts](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/services/inventoryService.ts))
- **Multi-Location Support**: Tracks stock across different warehouses/stores.
- **Stock Adjustments**: Formalized process for tracking damage, theft, or counting errors.
- **Approval Workflow**: High-value adjustments (>1000 QAR) require manager approval.

### **5. AI Insights & Forecasting** ([AIInsights.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/AIInsights.tsx), [geminiService.ts](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/services/geminiService.ts))
- **Operational Analysis**: Uses Gemini AI to analyze recent sales, waste ratios, and stock levels.
- **Multilingual Support**: Provides professional insights in both Arabic and English.

### **6. Thermal Receipt Module (Python)** ([receipt_printer.py](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/thermal_printer/receipt_printer.py))
- **ESC/POS Support**: Native binary commands for professional printer control.
- **Configurable Layout**: Dynamic paper width adjustment and RTL/Arabic text support.
- **Deterministic Rendering**: Ensures identical output for reprints given the same transaction data.

---

## **Database Schema Highlights**
- **transactions**: POS sales records with JSONB metadata for items.
- **roasting_batches**: Detailed logs of roasting temperature, levels, and weight changes.
- **green_beans**: Raw material tracking with origin and cost details.
- **inventory_items**: Packaged products available for sale.
- **system_settings**: Global configurations for VAT, store info, and printer defaults.

---

## **Workflow: Transaction to Receipt**
1. **Selection**: Cashier adds items to cart in `POSView`.
2. **Checkout**: `handleCheckout` validates stock and records transaction in Supabase.
3. **Rendering**: React renders the `#thermal-receipt` div with monospaced styling.
4. **Trigger**: `window.print()` is called via a timeout.
5. **Hardware (Optional)**: Transaction data can be sent to the Python `receipt_printer.py` for direct hardware-level printing if connected.

---

## **Developer Guidelines**
- **State Management**: Use `useMemo` and `useCallback` for performance optimization in data-heavy views.
- **Styling**: Follow the "Stone/Amber" theme using Tailwind classes for consistency.
- **Internationalization**: Always use the `t` object from `useLanguage()` for text to support Arabic/English switching.
