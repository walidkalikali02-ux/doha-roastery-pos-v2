# Professional Python Thermal Receipt Module

A highly configurable and robust Python module designed for generating and printing professional thermal receipts. Optimized for POS (Point of Sale) and ERP systems.

## 🚀 Features

- **Multi-Width Support**: Native support for **58mm** (32 chars/line) and **80mm** (48 chars/line).
- **ESC/POS Integration**: Built-in support for standard ESC/POS binary commands (Init, Bold, Align, Cut).
- **Professional Layout**: 
  - **Header**: Configurable with Store Name (Bold), optional Logo, Date, and Invoice Number.
  - **Items Section**: Dynamic column scaling for "Item name", "Qty", "Price", and "Total".
  - **Totals Section**: Subtotal, Tax, Discount, and Grand Total.
  - **Payment Details**: Payment method, Paid amount, and Change amount.
  - **Footer**: Customizable thank-you message and VAT/Tax number.
- **Audit & Compliance**: 
  - Supports deterministic reprinting with `*** REPRINT ***` header.
- **Connectivity**: Modular design allows integration with USB, Network, and Bluetooth printers via a generic connection interface.
- **RTL Support**: Basic support for Arabic/RTL text rendering.

## 🛠 Installation

```bash
# Core module uses standard library only.
# For hardware communication, we recommend:
pip install python-escpos
```

## 📖 Usage

### Basic Example

```python
from thermal_printer.receipt_printer import generate_receipt, print_receipt

# 1. Printer Configuration
printer_config = {
    "paper_width": "80mm",
    "rtl_support": True
}

# 2. Order Data
order_data = {
    "store_name": "DOHA ROASTERY",
    "invoice_no": "INV-2026-9901",
    "items": [
        {"name": "Espresso Blend", "quantity": 1, "price": 45.00},
        {"name": "Flat White", "quantity": 1, "price": 22.00}
    ],
    "subtotal": 67.00,
    "tax": 6.70,
    "total": 73.70,
    "payment_method": "Cash",
    "paid_amount": 100.00,
    "change": 26.30,
    "is_reprint": False
}

# 3. Generate Receipt Text
receipt_text = generate_receipt(order_data, printer_config)

# 4. Print via your printer connection
# Works with any object having .write() or .send()
print_receipt(receipt_text, my_usb_printer)
```

## 📊 Sample Data Schema (order_data)

```json
{
  "store_name": "DOHA ROASTERY",
  "invoice_no": "DR-2026-5542",
  "date": "2026-01-29 14:45:00",
  "items": [
    {
      "name": "Single Origin Ethiopia (250g)",
      "quantity": 2,
      "price": 65.00
    }
  ],
  "subtotal": 130.00,
  "tax": 13.00,
  "discount": 5.00,
  "total": 138.00,
  "payment_method": "Credit Card",
  "paid_amount": 138.00,
  "change": 0.00,
  "vat_no": "974-000-12345",
  "footer_msg": "Thank you for visiting us!",
  "is_reprint": false,
  "show_logo": true
}
```

## 🏗 Best Practices Implemented

1. **Separation of Concerns**: Receipt rendering logic is entirely separated from printer I/O.
2. **Monospaced Precision**: Uses character-count padding for pixel-perfect alignment on thermal heads.
3. **Deterministic Output**: Ensuring the same data produces identical receipts for reprints.
4. **Resilient Connectivity**: Graceful error handling for printer communication failures.
