# VaultKeep – Digital Warranty & Service Book

VaultKeep is a web application designed to digitize, monitor, and manage electronic product warranty cards, purchase invoices, and maintenance/repair histories.

Built based on the **Software Requirements Specification (SRS v1.0)** from Zeal College of Engineering and Research.

---

## 🌟 Key Features

### 1. Cyber-Vault Aesthetics & Micro-Animations
- **Glassmorphism Theme**: Translucent dark/light glass panels with backdrop blur, glowing accent borders, and dynamic ambient background orbs.
- **Dark & Light Mode Toggle**: Seamless theme switching with localStorage memory.
- **Circular SVG Warranty Rings**: Live visual indicator showing percent and days remaining until warranty expiry (Green = Active, Yellow = Expiring Soon < 30 days, Red = Expired).
- **Smooth Animated Counters**: Dashboard metrics animate on load.

### 2. User Module
- **Dashboard Metrics**: Instant total count of registered products, active warranties, items expiring within 30 days, expired items, and repair expenditure.
- **Chart.js Analytics**: Interactive breakdown of assets by product category and warranty health distribution.
- **Product Vault**: Filter by Category or Status (Active/Warning/Expired), search by name, brand, or serial number. Toggle between Grid and Table views.
- **Drag & Drop Invoice Upload**: Validates file size (limit 5MB per SRS spec) and accepts PDF, PNG, or JPG formats.
- **Document Viewer**: Full-screen canvas preview for bills and receipts.
- **Digital QR Passport**: Generates downloadable QR codes per asset and includes a camera QR scanner simulator.
- **Service History Log**: Track maintenance records, repair providers, service dates, and repair costs per product.
- **Email Reminder Simulator**: Simulates automated PHPMailer alerts at 30-day, 15-day, and 3-day thresholds.
- **PDF Report Generator**: Export summary inventory reports using jsPDF.

### 3. Admin Module
- **System Dashboard**: View overall user accounts, storage metrics, and global health.
- **Category Taxonomy Management**: Dynamically add and remove categories.
- **User Management**: View user accounts and toggle active/suspended status.
- **System Settings**: View and configure notification threshold parameters.

---

## 💻 Tech Stack
- **Frontend**: HTML5, CSS3 (Glassmorphism & Flexbox/Grid), JavaScript (ES6+)
- **Libraries**:
  - [Chart.js](https://www.chartjs.org/) for data visualization
  - [SweetAlert2](https://sweetalert2.github.io/) for toast alerts and modals
  - [QRCode.js](https://davidshimjs.github.io/qrcodejs/) for client-side QR generation
  - [jsPDF](https://github.com/parallax/jsPDF) for PDF document generation
  - FontAwesome 6 for icons

---

## 🚀 How to Run

1. Simply double-click `index.html` or open it in any modern web browser (Chrome, Edge, Firefox, Safari).
2. Alternatively, serve using any local HTTP server or XAMPP (Apache).
