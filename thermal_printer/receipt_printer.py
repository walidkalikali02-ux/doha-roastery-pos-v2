import datetime
import json
import re
from typing import Dict, Any, List, Optional, Union

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_RTL_LIBS = True
except ImportError:
    HAS_RTL_LIBS = False

class ThermalReceiptModule:
    """
    A professional, configurable Python module to generate and print thermal receipts.
    Optimized for POS/ERP systems with support for ESC/POS, USB, Network, and Bluetooth.
    """

    WIDTH_CONFIG = {
        "58mm": 32,
        "80mm": 48
    }

    # ESC/POS Constants
    ESC = b'\x1b'
    GS = b'\x1d'
    ALIGN_LEFT = b'\x1ba\x00'
    ALIGN_CENTER = b'\x1ba\x01'
    ALIGN_RIGHT = b'\x1ba\x02'
    BOLD_ON = b'\x1bE\x01'
    BOLD_OFF = b'\x1bE\x00'
    INIT = b'\x1b@'
    CUT = b'\x1dV\x41\x03'

    def __init__(self, paper_width: str = "80mm", rtl_support: bool = True):
        self.paper_width = paper_width
        self.width = self.WIDTH_CONFIG.get(paper_width, 48)
        self.rtl_support = rtl_support

    def _is_arabic(self, text: str) -> bool:
        """Simple check for Arabic characters."""
        return bool(re.search(r'[\u0600-\u06FF]', text))

    def _reshape_rtl(self, text: str) -> str:
        """Proper RTL reshaping and Bidi support for monospaced output."""
        if self.rtl_support and self._is_arabic(text):
            if HAS_RTL_LIBS:
                reshaped_text = arabic_reshaper.reshape(text)
                bidi_text = get_display(reshaped_text)
                return bidi_text
            else:
                # Fallback to simple reversal if libs are missing
                return text[::-1]
        return text

    def _format_line(self, left: str, right: str) -> str:
        """Justifies text: left-aligned text and right-aligned prices/values."""
        # Note: When mixing RTL and LTR in a justified line, extra care is needed
        # for character width and alignment.
        left_str = self._reshape_rtl(str(left))
        right_str = str(right)
        spaces = self.width - len(left_str) - len(right_str)
        return left_str + (" " * max(0, spaces)) + right_str

    def _center_text(self, text: str) -> str:
        return str(text).center(self.width)

    def generate_receipt(self, order_data: Dict[str, Any], printer_config: Dict[str, Any]) -> str:
        """
        Generates a professional, printer-ready text receipt based on configurable layout.
        """
        self.width = self.WIDTH_CONFIG.get(printer_config.get("paper_width", "80mm"), 48)
        is_reprint = order_data.get("is_reprint", False)
        
        lines = []

        # --- Header Section ---
        if is_reprint:
            lines.append(self._center_text("*** REPRINT ***"))
            lines.append("-" * self.width)

        # Store Name (Bold/Center)
        lines.append(self._center_text(order_data.get("store_name", "STORE NAME")))
        
        # Logo Placeholder (Optional)
        if order_data.get("show_logo"):
            lines.append(self._center_text("[ LOGO ]"))
            
        # Date & Time (Left)
        lines.append(f"Date: {order_data.get('date', datetime.datetime.now().strftime('%Y-%m-%d %H:%M'))}")
        
        # Invoice Number (Left)
        lines.append(f"Invoice: {order_data.get('invoice_no', 'N/A')}")
        lines.append("-" * self.width)

        # --- Items Section ---
        # Columns: Item name, Qty, Price, Total
        if self.width == 48: # 80mm
            header_item = f"{'Item name':<20} {'Qty':>4} {'Price':>10} {'Total':>10}"
        else: # 58mm
            header_item = f"{'Item name':<12} {'Qty':>4} {'Total':>14}"
            
        lines.append(header_item)
        lines.append("-" * self.width)

        for item in order_data.get("items", []):
            name = item.get("name", "Item")
            qty = item.get("quantity", 1)
            price = item.get("price", 0.0)
            total = qty * price
            
            if self.width == 48: # 80mm
                line = f"{name[:20]:<20} {qty:>4} {price:>10.2f} {total:>10.2f}"
            else: # 58mm
                line = f"{name[:12]:<12} {qty:>4} {total:>14.2f}"
            
            lines.append(line)
            
            # Wrap name if too long
            if len(name) > (20 if self.width == 48 else 12):
                lines.append(f"  {name}")

        lines.append("-" * self.width)

        # --- Totals Section ---
        lines.append(self._format_line("Subtotal", f"{order_data.get('subtotal', 0.0):.2f}"))
        lines.append(self._format_line("Tax", f"{order_data.get('tax', 0.0):.2f}"))
        
        discount = order_data.get("discount", 0.0)
        if discount > 0:
            lines.append(self._format_line("Discount", f"-{discount:.2f}"))
        
        lines.append("-" * self.width)
        lines.append(self._format_line("GRAND TOTAL", f"{order_data.get('total', 0.0):.2f}"))
        lines.append("=" * self.width)

        # --- Payment Details ---
        lines.append(self._format_line("Payment Method", order_data.get("payment_method", "Cash")))
        lines.append(self._format_line("Paid Amount", f"{order_data.get('paid_amount', 0.0):.2f}"))
        lines.append(self._format_line("Change Amount", f"{order_data.get('change', 0.0):.2f}"))
        lines.append("-" * self.width)

        # --- Footer Section ---
        lines.append(self._center_text(order_data.get("footer_msg", "Thank you message")))
        
        if order_data.get("vat_no"):
            lines.append(self._center_text(f"VAT/Tax: {order_data['vat_no']}"))
            
        return "\n".join(lines)

    def get_esc_pos_commands(self, order_data: Dict[str, Any], printer_config: Dict[str, Any]) -> bytes:
        """
        Generates raw binary ESC/POS commands for the printer.
        """
        is_reprint = order_data.get("is_reprint", False)
        commands = [self.INIT]

        # Header: Center & Bold Store Name
        commands.append(self.ALIGN_CENTER)
        if is_reprint:
            commands.append(self.BOLD_ON)
            commands.append(b"*** REPRINT ***\n")
            commands.append(self.BOLD_OFF)
            commands.append(b"--------------------------------\n")

        commands.append(self.BOLD_ON)
        commands.append(order_data.get("store_name", "STORE NAME").encode('ascii', 'ignore') + b"\n")
        commands.append(self.BOLD_OFF)
        
        # Remaining parts use the text-based layout generator
        # Note: In a real hardware scenario, we would send alignment commands 
        # before each block instead of just pre-formatting text.
        commands.append(self.ALIGN_LEFT)
        receipt_text = self.generate_receipt(order_data, printer_config)
        
        # Skip parts already handled in binary (Store name/Reprint)
        # For simplicity, we'll just encode the whole thing but real logic would be more granular.
        commands.append(receipt_text.encode('ascii', 'ignore'))
        
        # Cut
        commands.append(b"\n\n\n")
        commands.append(self.CUT)
        
        return b"".join(commands)

def generate_receipt(order_data: Dict[str, Any], printer_config: Dict[str, Any]) -> str:
    """
    Primary API to generate a receipt string.
    """
    module = ThermalReceiptModule(
        paper_width=printer_config.get("paper_width", "80mm"),
        rtl_support=printer_config.get("rtl_support", True)
    )
    return module.generate_receipt(order_data, printer_config)

def print_receipt(receipt_text: str, printer_connection: Any) -> None:
    """
    Handles printer I/O and connectivity errors.
    Expects printer_connection to be an object with a .write() or .send() method.
    """
    try:
        data = receipt_text.encode('utf-8')
        if hasattr(printer_connection, 'write'):
            printer_connection.write(data)
        elif hasattr(printer_connection, 'send'):
            printer_connection.send(data)
        else:
            # For testing/CLI output
            print("--- PRINTING TO TERMINAL ---")
            print(receipt_text)
    except Exception as e:
        print(f"Printer Connection Error: {e}")

# Example Usage and Data Schema
if __name__ == "__main__":
    # Sample Order Data
    sample_order = {
        "store_name": "DOHA ROASTERY",
        "invoice_no": "INV-2026-9901",
        "date": "2026-01-29 16:45",
        "items": [
            {"name": "Kenya AA Coffee Beans (500g)", "quantity": 1, "price": 85.00},
            {"name": "Cortado", "quantity": 2, "price": 18.00},
            {"name": "Blueberry Muffin", "quantity": 1, "price": 15.00}
        ],
        "subtotal": 136.00,
        "tax": 13.60,
        "discount": 10.00,
        "total": 139.60,
        "payment_method": "Card",
        "paid_amount": 139.60,
        "change": 0.00,
        "footer_msg": "Thank you for your business!",
        "vat_no": "VAT-974-888777",
        "is_reprint": False,
        "show_logo": True
    }

    # Printer Configurations
    config_80 = {"paper_width": "80mm"}
    config_58 = {"paper_width": "58mm"}

    print("\n--- 80mm Layout ---")
    print(generate_receipt(sample_order, config_80))

    print("\n--- 58mm Layout (Reprint) ---")
    sample_order["is_reprint"] = True
    print(generate_receipt(sample_order, config_58))
