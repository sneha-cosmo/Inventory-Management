# Inventory Management System - Bulk Import

## Bulk Import Feature
The Bulk Import feature allows Admins and Inventory Managers to import inventory items in bulk from CSV and Excel spreadsheets directly in the browser.

### How to Use It
1. Navigate to **Item Master** (Inventory page).
2. Click the **Import** button located next to **Add New Item**. (Note: Billing Clerks and Staff Viewers have this button disabled with a clearance tooltip).
3. Follow the 4-step wizard:
   - **Step 1 - Upload**: Upload your file (`.csv`, `.xlsx`, or `.xls`) via drag-and-drop or file picker. You can also click **Download CSV Template** to download a ready-to-use template with example rows.
   - **Step 2 - Map Columns**: Headers are automatically matched using aliases (e.g. `Item Code` to `SKU`, `Qty` to `Current Stock`). Adjust any mapping using dropdowns. All required fields (*SKU, Item Name, Category, Unit*) must be mapped.
   - **Step 3 - Review & Validate**: View comprehensive validation stats (Valid / Warning / Error counts).
     - Select a duplicate policy: **Skip duplicates** (default), **Update existing items**, or **Reject whole file**.
     - Enable or disable auto-creation of missing categories and warehouses.
     - Select import mode: **Import valid rows only** (default) or **All or nothing**.
     - Fix cells inline or download an **Errors Only CSV**.
   - **Step 4 - Import & Done**: Watch the responsive progress bar as items are processed in non-blocking asynchronous chunks. View final summary counts and see new items reflected immediately in your inventory master with calculated stock-health status.

### Template Columns
| Column Name | Required | Type | Description |
| ----------- | -------- | ---- | ----------- |
| `SKU` | Yes | String | Unique stock keeping unit code |
| `Item Name` | Yes | String | Descriptive product/item name |
| `Barcode` | No | String | 13-digit EAN code (auto-generated if empty) |
| `Description` | No | String | Extended item notes or description |
| `Category` | Yes | String | Item category (e.g., Fabrics, Threads, Accessories) |
| `Unit` | Yes | String | Unit of measure (e.g., kg, pcs, rolls, mtr, cones) |
| `Unit Cost` | No | Number | Purchase cost per unit (>= 0) |
| `Selling Price` | No | Number | Selling price per unit (>= 0) |
| `Current Stock` | No | Number | Initial quantity on hand (>= 0) |
| `Minimum Threshold` | No | Number | Reorder threshold level (>= 0) |
| `Safety Stock` | No | Number | Safety buffer stock (>= 0) |
| `Daily Usage` | No | Number | Daily consumption rate (>= 0) |
| `Lead Time (days)` | No | Number | Supplier delivery lead time in days (>= 0) |
| `Warehouse` | No | String | Destination warehouse name or ID |

### System Limits & Security Rules
- **File Types**: `.csv`, `.xlsx`, `.xls`
- **Max File Size**: 5 MB
- **Max Rows**: 5,000 rows per file
- **Formula Injection Defense**: Cells starting with `=`, `+`, `-`, `@` in text fields are rejected to prevent spreadsheet formula injection. Whitespace is automatically trimmed and strings capped at 1,000 characters.
- **Audit Logging**: Exactly one consolidated audit entry is recorded per import batch with file name, created/updated/skipped/failed counts, duplicate policy, and total opening stock loaded.
