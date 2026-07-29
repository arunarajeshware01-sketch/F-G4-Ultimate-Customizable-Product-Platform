/* ==========================================================================
   VaultKeep - Digital Warranty & Service Book (₹ INR)
   Application Logic, Authentication Controller, Real AJAX & Fallback Controller
   ========================================================================== */

// --- Default Initial State & Seed Data (Indian Rupees ₹ INR) ---
const DEFAULT_CATEGORIES = ["Laptops & Computers", "Mobile Devices", "Home Appliances", "Smart Wearables", "Audio & Entertainment"];

const SEED_PRODUCTS = [
    {
        id: 101,
        name: "MacBook Pro 16\" M3 Max",
        brand: "Apple",
        category: "Laptops & Computers",
        serialNumber: "C02G8492Q6LR",
        purchaseDate: "2025-11-15",
        warrantyPeriodMonths: 24, // Expiry: 2027-11-15 (Active)
        priceInr: 249900.00,
        billName: "Apple_MBP16_Invoice.pdf",
        billSize: "2.4 MB",
        notes: "Includes AppleCare+ coverage with 2 years validity.",
        createdAt: "2025-11-15"
    },
    {
        id: 102,
        name: "Galaxy S24 Ultra 512GB",
        brand: "Samsung",
        category: "Mobile Devices",
        serialNumber: "R5CR309K98Z",
        purchaseDate: "2025-08-01",
        warrantyPeriodMonths: 12, // Expiry: 2026-08-01 (~9 days away - Expiring Soon)
        priceInr: 139999.00,
        billName: "Samsung_S24_Bill.jpg",
        billSize: "1.8 MB",
        notes: "Purchased with screen replacement guarantee.",
        createdAt: "2025-08-01"
    },
    {
        id: 103,
        name: "LG OLED 65\" C3 4K Smart TV",
        brand: "LG Electronics",
        category: "Home Appliances",
        serialNumber: "304RMKB92104",
        purchaseDate: "2024-03-10",
        warrantyPeriodMonths: 24, // Expiry: 2026-03-10 (Expired)
        priceInr: 164990.00,
        billName: "LG_OLED_Invoice.pdf",
        billSize: "3.1 MB",
        notes: "Panel 2-year official manufacturer warranty.",
        createdAt: "2024-03-10"
    },
    {
        id: 104,
        name: "Sony WH-1000XM5 ANC Headphones",
        brand: "Sony",
        category: "Audio & Entertainment",
        serialNumber: "S01-9821450-H",
        purchaseDate: "2025-12-20",
        warrantyPeriodMonths: 12, // Expiry: 2026-12-20 (Active)
        priceInr: 29990.00,
        billName: "Sony_Headphones_Receipt.png",
        billSize: "950 KB",
        notes: "Official Sony India warranty card registered.",
        createdAt: "2025-12-20"
    },
    {
        id: 105,
        name: "Dyson V15 Detect Vacuum Cleaner",
        brand: "Dyson",
        category: "Home Appliances",
        serialNumber: "DY-9281-V15",
        purchaseDate: "2025-07-28",
        warrantyPeriodMonths: 12, // Expiry: 2026-07-28 (~5 days away - Expiring Soon)
        priceInr: 65900.00,
        billName: "Dyson_Invoice.pdf",
        billSize: "1.2 MB",
        notes: "Battery covered for 12 months.",
        createdAt: "2025-07-28"
    }
];

const SEED_SERVICE_RECORDS = [
    {
        id: 201,
        productId: 102,
        date: "2026-02-14",
        provider: "Samsung Authorized Care Center",
        costInr: 3500.00,
        description: "USB-C charging port cleaning & original cable check."
    },
    {
        id: 202,
        productId: 103,
        date: "2025-05-20",
        provider: "LG Service India Center",
        costInr: 8500.00,
        description: "Power supply board replacement under extended warranty."
    }
];

const SEED_USERS = [
    { id: 1, name: "Alex Morgan", email: "alex.m@vaultkeep.io", status: "Active", productsCount: 5, joinedDate: "2025-01-10" },
    { id: 2, name: "Rahul Sharma", email: "rahul.s@techindia.in", status: "Active", productsCount: 3, joinedDate: "2025-03-22" },
    { id: 3, name: "Priya Patel", email: "priya@mumbai.co.in", status: "Suspended", productsCount: 0, joinedDate: "2025-06-15" }
];

// --- VaultKeep Global Application Controller ---
class VaultKeepApp {
    constructor() {
        // No default/fake identity — a visitor is only "signed in" once auth.php confirms
        // a real session, or handleLoginSubmit/handleRegisterSubmit succeeds.
        this.currentUser = JSON.parse(localStorage.getItem('vk_current_user')) || null;

        this.products = this.currentUser ? (JSON.parse(localStorage.getItem('vk_products')) || SEED_PRODUCTS) : [];
        this.serviceRecords = this.currentUser ? (JSON.parse(localStorage.getItem('vk_service_records')) || SEED_SERVICE_RECORDS) : [];
        this.categories = JSON.parse(localStorage.getItem('vk_categories')) || DEFAULT_CATEGORIES;
        // Maps category name -> real DB category_id, populated by loadCategories().
        // Needed so "Add Product" sends the actual backend ID instead of guessing
        // from array position (which breaks the moment categories are added/removed).
        this.categoryIdMap = JSON.parse(localStorage.getItem('vk_category_id_map')) || {};
        // Placeholder until loadAdminUsers() pulls the real, live list from the server.
        this.users = JSON.parse(localStorage.getItem('vk_users')) || SEED_USERS;
        
        this.currentViewMode = 'user'; // 'user' or 'admin'
        this.currentVaultLayout = 'grid'; // 'grid' or 'table'
        this.activeCategoryFilter = 'all';
        this.activeStatusFilter = 'all';
        this.searchQuery = '';
        
        this.charts = {};
        this._counterTimers = {}; // tracks one active setInterval per metric element, so overlapping renders can't race each other
        this.notificationsSeen = false; // whether the user has opened the notifications drawer for the current alert set
        this._lastAlertCount = null; // used to detect newly-arrived alerts so the bell can light up again
        this.init();
    }

    async init() {
        this.bindEvents();
        this.initTheme();
        this.updateUserWidget();
        
        // Attempt backend API sync if hosted on XAMPP/PHP server
        await this.syncWithBackendAPI();
        await this.loadCategories();
        this.updateUserWidget();
        this.renderAll();

        // Still no authenticated session after syncing — require the user to sign in
        if (!this.currentUser) {
            this.openAuthModal();
        }
    }

    // --- Backend PHP AJAX API Integration ---
    async syncWithBackendAPI() {
        try {
            // Check active session API
            // cache: 'no-store' guarantees we always get the real, current server state on
            // every page load instead of a browser-cached response from an earlier visit.
            const sessionRes = await fetch('backend/api/auth.php?action=session', { cache: 'no-store' });
            if (sessionRes.ok) {
                const sessionData = await sessionRes.json();
                if (sessionData.status === 'success') {
                    this.currentUser = sessionData.data;
                    this.updateUserWidget();
                }
            }

            // Fetch products API
            const prodRes = await fetch('backend/api/products.php', { cache: 'no-store' });
            if (prodRes.ok) {
                const prodData = await prodRes.json();
                if (prodData.status === 'success' && Array.isArray(prodData.data)) {
                    this.products = prodData.data.map(p => ({
                        id: p.product_id,
                        name: p.product_name,
                        brand: p.brand,
                        category: p.category_name || "General",
                        serialNumber: p.serial_number,
                        purchaseDate: p.purchase_date,
                        warrantyPeriodMonths: parseInt(p.warranty_period_months),
                        priceInr: parseFloat(p.price_inr || 0),
                        billName: p.bill_path ? p.bill_path.split('/').pop() : 'Invoice.pdf',
                        notes: p.notes
                    }));
                }
            }
        } catch (e) {
            console.log("Running in offline client mode. Backend API sync ready upon XAMPP deployment.");
        }
    }

    // Pulls the live category taxonomy (name + real category_id) from the backend.
    // Any logged-in user can call this (see admin.php) since the product form needs
    // it, not just the admin panel.
    async loadCategories() {
        try {
            const res = await fetch('backend/api/admin.php?action=categories', { cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.status === 'success' && Array.isArray(data.data)) {
                this.categories = data.data.map(c => c.category_name);
                this.categoryIdMap = Object.fromEntries(data.data.map(c => [c.category_name, c.category_id]));
                localStorage.setItem('vk_categories', JSON.stringify(this.categories));
                localStorage.setItem('vk_category_id_map', JSON.stringify(this.categoryIdMap));
            }
        } catch (e) {
            // Backend unreachable — keep whatever was cached locally
        }
    }

    // --- State Persistence ---
    saveState() {
        localStorage.setItem('vk_products', JSON.stringify(this.products));
        localStorage.setItem('vk_service_records', JSON.stringify(this.serviceRecords));
        localStorage.setItem('vk_categories', JSON.stringify(this.categories));
        localStorage.setItem('vk_users', JSON.stringify(this.users));
        localStorage.setItem('vk_current_user', JSON.stringify(this.currentUser));
    }

    // Escapes user-supplied text before it's inserted via innerHTML, to prevent stored XSS
    // from fields like product name, brand, serial number, or category.
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // --- Date & Warranty Calculation Helpers ---
    calculateExpiryDetails(purchaseDateStr, periodMonths) {
        const purchase = new Date(purchaseDateStr);
        const expiry = new Date(purchase);
        expiry.setMonth(expiry.getMonth() + parseInt(periodMonths));

        const today = new Date();
        const totalDurationDays = Math.ceil((expiry - purchase) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        
        let status = 'active';
        let statusText = 'Active Warranty';
        let badgeClass = 'badge-active';

        if (daysRemaining <= 0) {
            status = 'expired';
            statusText = 'Expired';
            badgeClass = 'badge-expired';
        } else if (daysRemaining <= 30) {
            status = 'warning';
            statusText = `Expires in ${daysRemaining}d`;
            badgeClass = 'badge-warning';
        } else {
            statusText = `${daysRemaining} Days Left`;
        }

        const percentRemaining = Math.max(0, Math.min(100, Math.round((daysRemaining / totalDurationDays) * 100)));

        return {
            expiryDateStr: expiry.toISOString().split('T')[0],
            daysRemaining,
            totalDurationDays,
            percentRemaining,
            status,
            statusText,
            badgeClass
        };
    }

    // --- Theme Controller ---
    initTheme() {
        const savedTheme = localStorage.getItem('vk_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('vk_theme', newTheme);
        this.updateThemeIcon(newTheme);
        this.renderCharts();
    }

    updateThemeIcon(theme) {
        const icon = document.getElementById('theme-toggle-icon');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    updateUserWidget() {
        const avatar = document.getElementById('user-avatar');
        const name = document.getElementById('user-display-name');
        const email = document.getElementById('user-display-email');
        const adminBtn = document.getElementById('btn-mode-admin');
        const logoutBtn = document.getElementById('btn-logout');

        if (this.currentUser) {
            const initials = this.currentUser.full_name ? this.currentUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';
            if (avatar) avatar.textContent = initials;
            if (name) name.textContent = this.currentUser.full_name;
            if (email) email.textContent = this.currentUser.email;
            if (adminBtn) adminBtn.classList.toggle('hidden', this.currentUser.role !== 'admin');
            if (logoutBtn) logoutBtn.classList.remove('hidden');
        } else {
            if (avatar) avatar.textContent = '?';
            if (name) name.textContent = 'Not signed in';
            if (email) email.textContent = '';
            if (adminBtn) adminBtn.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }
    }

    // --- Event Listeners Binding ---
    bindEvents() {
        // Mode Switcher
        document.getElementById('btn-mode-user')?.addEventListener('click', () => this.switchMode('user'));
        document.getElementById('btn-mode-admin')?.addEventListener('click', () => this.switchMode('admin'));

        // Theme Toggle
        document.getElementById('btn-theme-toggle')?.addEventListener('click', () => this.toggleTheme());

        // Notifications Drawer
        document.getElementById('btn-notifications')?.addEventListener('click', () => {
            this.toggleDrawer('notifications-drawer', true);
            this.markNotificationsSeen();
        });
        document.getElementById('btn-close-notifications')?.addEventListener('click', () => this.toggleDrawer('notifications-drawer', false));

        // Authentication Modal Events
        document.getElementById('user-avatar')?.addEventListener('click', () => this.openAuthModal());
        document.getElementById('btn-logout')?.addEventListener('click', () => this.handleLogout());
        document.getElementById('btn-close-auth-modal')?.addEventListener('click', () => this.closeModal('auth-modal'));
        document.getElementById('btn-auth-tab-login')?.addEventListener('click', () => this.switchAuthTab('login'));
        document.getElementById('btn-auth-tab-register')?.addEventListener('click', () => this.switchAuthTab('register'));
        document.getElementById('form-login')?.addEventListener('submit', (e) => this.handleLoginSubmit(e));
        document.getElementById('form-register')?.addEventListener('submit', (e) => this.handleRegisterSubmit(e));

        // Live password-strength checklist + confirm-password match indicator
        document.getElementById('reg-password')?.addEventListener('input', (e) => {
            this.updatePasswordRulesUI(e.target.value);
            this.updatePasswordMatchUI();
        });
        document.getElementById('reg-password-confirm')?.addEventListener('input', () => this.updatePasswordMatchUI());

        // Add Product Modal
        document.getElementById('btn-add-product')?.addEventListener('click', () => this.openAddProductModal());
        document.getElementById('btn-close-add-modal')?.addEventListener('click', () => this.closeModal('add-product-modal'));
        document.getElementById('form-add-product')?.addEventListener('submit', (e) => this.handleAddProductSubmit(e));

        // Search & Filters
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderProductsVault();
        });

        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            this.activeCategoryFilter = e.target.value;
            this.renderProductsVault();
        });

        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            this.activeStatusFilter = e.target.value;
            this.renderProductsVault();
        });

        // View Layout Switcher
        document.getElementById('btn-view-grid')?.addEventListener('click', () => this.setLayout('grid'));
        document.getElementById('btn-view-table')?.addEventListener('click', () => this.setLayout('table'));

        // Service & QR Modals
        document.getElementById('btn-close-service-modal')?.addEventListener('click', () => this.closeModal('service-modal'));
        document.getElementById('form-add-service')?.addEventListener('submit', (e) => this.handleAddServiceRecord(e));

        document.getElementById('btn-close-qr-modal')?.addEventListener('click', () => this.closeModal('qr-modal'));
        document.getElementById('btn-download-qr')?.addEventListener('click', () => this.downloadQRCode());

        document.getElementById('btn-scan-qr')?.addEventListener('click', () => this.openQRScannerModal());
        document.getElementById('btn-close-scanner-modal')?.addEventListener('click', () => this.closeModal('qr-scanner-modal'));

        document.getElementById('btn-close-doc-modal')?.addEventListener('click', () => this.closeModal('document-modal'));
        document.getElementById('btn-export-pdf')?.addEventListener('click', () => this.exportVaultPDF());

        this.setupDropzone();
        document.getElementById('btn-add-category')?.addEventListener('click', () => this.handleAddCategory());
    }

    // --- Password Strength & Confirmation ---
    // Same rules the backend enforces (see auth.php handleRegister): at least 8 chars,
    // one uppercase, one lowercase, one digit, and one special character.
    checkPasswordRules(password) {
        return {
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            digit: /[0-9]/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)
        };
    }

    isPasswordStrong(password) {
        const rules = this.checkPasswordRules(password);
        return Object.values(rules).every(Boolean);
    }

    updatePasswordRulesUI(password) {
        const rules = this.checkPasswordRules(password);
        Object.entries(rules).forEach(([rule, met]) => {
            const li = document.querySelector(`#reg-password-rules li[data-rule="${rule}"]`);
            if (li) li.classList.toggle('rule-met', met);
        });
    }

    updatePasswordMatchUI() {
        const pwd = document.getElementById('reg-password')?.value || '';
        const confirm = document.getElementById('reg-password-confirm')?.value || '';
        const msgEl = document.getElementById('reg-password-match-msg');
        if (!msgEl) return;

        if (!confirm) {
            msgEl.textContent = '';
            msgEl.className = 'password-match-msg';
        } else if (pwd === confirm) {
            msgEl.textContent = '✓ Passwords match';
            msgEl.className = 'password-match-msg match';
        } else {
            msgEl.textContent = 'Passwords do not match';
            msgEl.className = 'password-match-msg mismatch';
        }
    }

    // --- Auth Actions ---
    openAuthModal() {
        this.openModal('auth-modal');
    }

    switchAuthTab(tab) {
        const loginTab = document.getElementById('btn-auth-tab-login');
        const regTab = document.getElementById('btn-auth-tab-register');
        const loginForm = document.getElementById('form-login');
        const regForm = document.getElementById('form-register');

        if (tab === 'login') {
            loginTab.classList.add('active');
            regTab.classList.remove('active');
            loginForm.classList.remove('hidden');
            regForm.classList.add('hidden');
        } else {
            regTab.classList.add('active');
            loginTab.classList.remove('active');
            regForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
            regForm.reset();
            this.updatePasswordRulesUI('');
            this.updatePasswordMatchUI();
        }
    }

    async handleLoginSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('backend/api/auth.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (response.ok && data.status === 'success') {
                this.currentUser = data.data;
                // Persist ONLY the session here. Calling the full saveState() at this point
                // would also write this.products (still [] from before login) to
                // localStorage, and that stale empty array is what a later page refresh
                // would load first, before syncWithBackendAPI() has a chance to overwrite
                // it — producing wrong/zeroed metrics right after a reload.
                localStorage.setItem('vk_current_user', JSON.stringify(this.currentUser));
                this.updateUserWidget();
                this.closeModal('auth-modal');
                Swal.fire('Welcome Back!', `Logged in as ${this.currentUser.full_name}`, 'success');
                await this.syncWithBackendAPI();
                this.saveState(); // now this.products holds the real backend data, safe to cache
                this.renderAll();
                return;
            }

            // Backend responded, but login was rejected (bad credentials, suspended, etc.)
            Swal.fire('Login Failed', data.message || 'Invalid email or password.', 'error');
        } catch (err) {
            // Backend unreachable — do NOT sign the user in
            Swal.fire('Connection Error', 'Could not reach the server. Please try again.', 'error');
        }
    }

    async handleRegisterSubmit(e) {
        e.preventDefault();
        const full_name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const passwordConfirm = document.getElementById('reg-password-confirm').value;

        if (password !== passwordConfirm) {
            Swal.fire('Passwords Do Not Match', 'Please re-enter the same password in both fields.', 'warning');
            return;
        }

        if (!this.isPasswordStrong(password)) {
            Swal.fire('Weak Password', 'Your password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.', 'warning');
            return;
        }

        try {
            const response = await fetch('backend/api/auth.php?action=register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name, email, password })
            });

            const data = await response.json();
            if (response.ok && data.status === 'success') {
                this.currentUser = data.data;
                localStorage.setItem('vk_current_user', JSON.stringify(this.currentUser));
                this.updateUserWidget();
                this.closeModal('auth-modal');
                Swal.fire('Account Created!', 'Welcome to your digital warranty book.', 'success');
                await this.syncWithBackendAPI();
                this.saveState();
                this.renderAll();
                return;
            }

            // Backend responded, but registration was rejected (email exists, weak password, etc.)
            Swal.fire('Registration Failed', data.message || 'Could not create your account.', 'error');
        } catch (err) {
            // Backend unreachable — do NOT create a fake local account
            Swal.fire('Connection Error', 'Could not reach the server. Please try again.', 'error');
        }
    }

    async handleLogout() {
        try {
            await fetch('backend/api/auth.php?action=logout');
        } catch (e) {}

        // Clear the client-side session so the app doesn't keep showing the previous user's data
        this.currentUser = null;
        this.products = [];
        this.serviceRecords = [];
        localStorage.removeItem('vk_current_user');
        localStorage.removeItem('vk_products');
        localStorage.removeItem('vk_service_records');

        this.updateUserWidget();
        this.renderAll();
        this.switchMode('user');

        Swal.fire({
            title: 'Logged Out',
            text: 'You have been signed out of VaultKeep.',
            icon: 'info',
            timer: 1500,
            showConfirmButton: false
        });

        this.openAuthModal();
    }

    switchMode(mode) {
        if (mode === 'admin' && this.currentUser?.role !== 'admin') {
            Swal.fire('Access Denied', 'Admin privileges are required to view this section.', 'error');
            return;
        }
        this.currentViewMode = mode;
        document.getElementById('btn-mode-user').classList.toggle('active', mode === 'user');
        document.getElementById('btn-mode-admin').classList.toggle('active', mode === 'admin');
        document.getElementById('user-module-view').classList.toggle('hidden', mode !== 'user');
        document.getElementById('admin-module-view').classList.toggle('hidden', mode !== 'admin');

        if (mode === 'admin') this.loadAdminUsers();
    }

    // Pulls the live registered-user list (and per-user asset counts) from the
    // backend instead of relying on the local demo/cache copy of this.users.
    async loadAdminUsers() {
        this.renderAdminModule(); // paint immediately with whatever we have, then refresh

        try {
            const res = await fetch('backend/api/admin.php?action=users', { cache: 'no-store' });
            const result = await res.json();

            if (res.ok && result.status === 'success') {
                this.users = result.data.map(u => ({
                    id: u.user_id,
                    name: u.full_name,
                    email: u.email,
                    status: u.status,
                    productsCount: u.products_count
                }));
                localStorage.setItem('vk_users', JSON.stringify(this.users));
                this.renderAdminModule();
            }
        } catch (err) {
            console.error('Failed to load registered users:', err);
        }
    }

    setLayout(layout) {
        this.currentVaultLayout = layout;
        document.getElementById('btn-view-grid').classList.toggle('active', layout === 'grid');
        document.getElementById('btn-view-table').classList.toggle('active', layout === 'table');
        document.getElementById('vault-grid-view').classList.toggle('hidden', layout !== 'grid');
        document.getElementById('vault-table-view').classList.toggle('hidden', layout !== 'table');
    }

    // --- Render Engine ---
    renderAll() {
        this.renderCategoriesDropdown();
        this.renderMetricsSummary();
        this.renderCharts();
        this.renderProductsVault();
        this.renderRemindersDrawer();
    }

    renderCategoriesDropdown() {
        const catSelect = document.getElementById('category-filter');
        const formCatSelect = document.getElementById('product-category');

        if (catSelect) {
            catSelect.innerHTML = `<option value="all">All Categories</option>` +
                this.categories.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
        }

        if (formCatSelect) {
            // Use the real backend category_id when we have one (from loadCategories());
            // fall back to array position only if we're offline and never synced.
            formCatSelect.innerHTML = this.categories.map((c, idx) => {
                const catId = this.categoryIdMap[c] ?? (idx + 1);
                return `<option value="${catId}">${this.escapeHtml(c)}</option>`;
            }).join('');
        }
    }

    renderMetricsSummary() {
        let total = this.products.length;
        let active = 0, warning = 0, expired = 0;

        this.products.forEach(p => {
            const details = this.calculateExpiryDetails(p.purchaseDate, p.warrantyPeriodMonths);
            if (details.status === 'active') active++;
            else if (details.status === 'warning') warning++;
            else if (details.status === 'expired') expired++;
        });

        const totalRepairSpend = this.serviceRecords.reduce((sum, s) => sum + parseFloat(s.costInr || 0), 0);

        this.animateCounter('metric-total', total);
        this.animateCounter('metric-active', active);
        this.animateCounter('metric-warning', warning);
        this.animateCounter('metric-expired', expired);
        
        const repairEl = document.getElementById('metric-repair');
        if (repairEl) repairEl.textContent = `₹${totalRepairSpend.toLocaleString('en-IN')}`;
    }

    animateCounter(elementId, targetValue) {
        const el = document.getElementById(elementId);
        if (!el) return;

        // If a previous render already started a counter animation on this same element
        // (e.g. renderMetricsSummary firing again before the last one finished), kill it
        // first. Otherwise two intervals fight over the same textContent and the box can
        // freeze on whichever timer happened to fire last (often showing "1").
        if (this._counterTimers[elementId]) {
            clearInterval(this._counterTimers[elementId]);
        }

        let current = 0;
        const duration = 600;
        const stepTime = 30;
        const increment = Math.max(1, Math.ceil(targetValue / (duration / stepTime)));

        this._counterTimers[elementId] = setInterval(() => {
            current += increment;
            if (current >= targetValue) {
                el.textContent = targetValue;
                clearInterval(this._counterTimers[elementId]);
                delete this._counterTimers[elementId];
            } else {
                el.textContent = current;
            }
        }, stepTime);
    }

    renderCharts() {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const textColor = isDark ? '#94a3b8' : '#475569';

        const ctxStatus = document.getElementById('chart-status-canvas')?.getContext('2d');
        if (ctxStatus) {
            if (this.charts.statusChart) this.charts.statusChart.destroy();

            let activeCount = 0, warningCount = 0, expiredCount = 0;
            this.products.forEach(p => {
                const det = this.calculateExpiryDetails(p.purchaseDate, p.warrantyPeriodMonths);
                if (det.status === 'active') activeCount++;
                else if (det.status === 'warning') warningCount++;
                else expiredCount++;
            });

            this.charts.statusChart = new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: ['Active', 'Expiring Soon', 'Expired'],
                    datasets: [{
                        data: [activeCount, warningCount, expiredCount],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { bottom: 4 } },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: textColor,
                                boxWidth: 10,
                                boxHeight: 10,
                                padding: 10,
                                font: { size: 11 }
                            }
                        }
                    },
                    cutout: '70%'
                }
            });
        }

        const ctxCategory = document.getElementById('chart-category-canvas')?.getContext('2d');
        if (ctxCategory) {
            if (this.charts.categoryChart) this.charts.categoryChart.destroy();

            const counts = this.categories.map(cat => this.products.filter(p => p.category === cat).length);

            this.charts.categoryChart = new Chart(ctxCategory, {
                type: 'bar',
                data: {
                    labels: this.categories.map(c => c.length > 12 ? c.substring(0, 10) + '...' : c),
                    datasets: [{
                        label: 'Registered Assets',
                        data: counts,
                        backgroundColor: '#00f2fe',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { color: textColor }, grid: { display: false } },
                        y: { ticks: { color: textColor, precision: 0 } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    getFilteredProducts() {
        return this.products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(this.searchQuery) ||
                                  p.brand.toLowerCase().includes(this.searchQuery) ||
                                  p.serialNumber.toLowerCase().includes(this.searchQuery);
            const matchesCategory = this.activeCategoryFilter === 'all' || p.category === this.activeCategoryFilter;
            const det = this.calculateExpiryDetails(p.purchaseDate, p.warrantyPeriodMonths);
            const matchesStatus = this.activeStatusFilter === 'all' || det.status === this.activeStatusFilter;
            return matchesSearch && matchesCategory && matchesStatus;
        });
    }

    renderProductsVault() {
        const filtered = this.getFilteredProducts();

        const gridContainer = document.getElementById('vault-grid-view');
        if (gridContainer) {
            if (filtered.length === 0) {
                gridContainer.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;" class="glass-panel">
                        <i class="fas fa-box-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                        <h3>No Warranty Cards Found</h3>
                        <p style="color: var(--text-secondary);">Click "Add New Product" to register an asset in your vault.</p>
                    </div>
                `;
            } else {
                gridContainer.innerHTML = filtered.map(p => this.createProductCardHTML(p)).join('');
            }
        }

        const tableBody = document.getElementById('vault-table-body');
        if (tableBody) {
            tableBody.innerHTML = filtered.map(p => this.createProductTableRowHTML(p)).join('');
        }
    }

    createProductCardHTML(product) {
        const det = this.calculateExpiryDetails(product.purchaseDate, product.warrantyPeriodMonths);
        const radius = 22.5;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (det.percentRemaining / 100) * circumference;
        
        let strokeColor = 'var(--status-active)';
        if (det.status === 'warning') strokeColor = 'var(--status-warning)';
        else if (det.status === 'expired') strokeColor = 'var(--status-expired)';

        const formattedPrice = product.priceInr ? `₹${parseFloat(product.priceInr).toLocaleString('en-IN')}` : '₹0';

        return `
            <div class="glass-panel product-card glass-panel-interactive">
                <div class="product-card-glow" style="background: ${strokeColor};"></div>
                <div class="product-header">
                    <span class="product-category-tag"><i class="fas fa-tag"></i> ${this.escapeHtml(product.category)}</span>
                    <span class="badge-status ${det.badgeClass}">
                        <i class="fas ${det.status === 'expired' ? 'fa-times-circle' : 'fa-check-circle'}"></i> ${det.statusText}
                    </span>
                </div>

                <div class="product-title-area">
                    <h3 class="product-name">${this.escapeHtml(product.name)}</h3>
                    <div class="product-meta">${this.escapeHtml(product.brand)} • SN: ${this.escapeHtml(product.serialNumber)} • <strong class="text-cyan">${formattedPrice}</strong></div>
                </div>

                <div class="countdown-widget">
                    <div class="progress-ring-wrapper">
                        <svg class="progress-ring">
                            <circle class="progress-ring-circle-bg" r="${radius}" cx="27" cy="27"></circle>
                            <circle class="progress-ring-circle" r="${radius}" cx="27" cy="27" 
                                    style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${strokeDashoffset}; stroke: ${strokeColor};">
                            </circle>
                        </svg>
                        <span class="progress-ring-text">${det.status === 'expired' ? '0%' : det.percentRemaining + '%'}</span>
                    </div>
                    <div class="countdown-info">
                        <span class="countdown-label">Warranty Expiry</span>
                        <span class="countdown-status-text">${det.expiryDateStr}</span>
                    </div>
                </div>

                <div class="card-actions">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">
                        <i class="fas fa-file-invoice"></i> ${product.billName}
                    </span>
                    <div class="card-action-btns">
                        <button class="btn-icon" title="View Document" onclick="app.viewDocument('${product.id}')"><i class="fas fa-file-pdf"></i></button>
                        <button class="btn-icon" title="QR Code" onclick="app.openQRCodeModal('${product.id}')"><i class="fas fa-qrcode"></i></button>
                        <button class="btn-icon" title="Service History" onclick="app.openServiceHistoryModal('${product.id}')"><i class="fas fa-wrench"></i></button>
                        <button class="btn-icon" title="Delete Product" onclick="app.deleteProduct('${product.id}')" style="color: var(--status-expired);"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    }

    createProductTableRowHTML(product) {
        const det = this.calculateExpiryDetails(product.purchaseDate, product.warrantyPeriodMonths);
        const formattedPrice = product.priceInr ? `₹${parseFloat(product.priceInr).toLocaleString('en-IN')}` : '₹0';

        return `
            <tr>
                <td><strong>${this.escapeHtml(product.name)}</strong><br><span style="font-size: 0.8rem; color: var(--text-muted);">${this.escapeHtml(product.brand)}</span></td>
                <td>${this.escapeHtml(product.category)}</td>
                <td><code>${this.escapeHtml(product.serialNumber)}</code></td>
                <td>${product.purchaseDate}</td>
                <td>${det.expiryDateStr}</td>
                <td><strong class="text-cyan">${formattedPrice}</strong></td>
                <td><span class="badge-status ${det.badgeClass}">${det.statusText}</span></td>
                <td>
                    <div style="display: flex; gap: 0.3rem;">
                        <button class="btn-icon" onclick="app.viewDocument('${product.id}')"><i class="fas fa-file-pdf"></i></button>
                        <button class="btn-icon" onclick="app.openQRCodeModal('${product.id}')"><i class="fas fa-qrcode"></i></button>
                        <button class="btn-icon" onclick="app.openServiceHistoryModal('${product.id}')"><i class="fas fa-wrench"></i></button>
                        <button class="btn-icon" onclick="app.deleteProduct('${product.id}')" style="color: var(--status-expired);"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }

    openAddProductModal() {
        document.getElementById('form-add-product').reset();
        document.getElementById('dropzone-file-name').textContent = '';
        this.openModal('add-product-modal');
    }

    async handleAddProductSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('product-name').value.trim();
        const brand = document.getElementById('product-brand').value.trim();
        const categoryId = document.getElementById('product-category').value;
        const categoryText = document.getElementById('product-category').options[document.getElementById('product-category').selectedIndex]?.text || "General";
        const serialNumber = document.getElementById('product-serial').value.trim();
        const priceInr = parseFloat(document.getElementById('product-price').value || 0);
        const purchaseDate = document.getElementById('product-date').value;
        const warrantyPeriodMonths = parseInt(document.getElementById('product-warranty-months').value);
        const notes = document.getElementById('product-notes').value.trim();

        if (!name || !brand || !purchaseDate || !warrantyPeriodMonths) {
            Swal.fire('Required Fields', 'Please fill in mandatory fields.', 'warning');
            return;
        }

        // Send AJAX to backend PHP endpoint if available
        try {
            const formData = new FormData();
            formData.append('product_name', name);
            formData.append('brand', brand);
            formData.append('category_id', categoryId);
            formData.append('serial_number', serialNumber);
            formData.append('price_inr', priceInr);
            formData.append('purchase_date', purchaseDate);
            formData.append('warranty_period_months', warrantyPeriodMonths);
            formData.append('notes', notes);

            const fileInput = document.getElementById('product-file-input');
            if (fileInput.files.length) {
                formData.append('bill_file', fileInput.files[0]);
            }

            const res = await fetch('backend/api/products.php', { method: 'POST', body: formData });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.status === 'success') {
                await this.syncWithBackendAPI();
                this.closeModal('add-product-modal');
                Swal.fire('Product Secured!', `${name} stored in MySQL database.`, 'success');
                return;
            }

            // Backend is reachable but rejected the request (e.g. not logged in, validation failed)
            Swal.fire('Could Not Save', data?.message || 'The server rejected this product.', 'error');
            return;
        } catch (err) {
            // Backend unreachable — fall back to local-only storage so the demo still works offline
            Swal.fire('Saved Locally', 'Could not reach the server, so this was saved on this device only.', 'warning');
        }

        const newProduct = {
            id: Date.now(),
            name,
            brand,
            category: categoryText,
            serialNumber: serialNumber || 'N/A',
            purchaseDate,
            warrantyPeriodMonths,
            priceInr,
            billName: this.uploadedFileName || 'VaultKeep_Bill.pdf',
            notes,
            createdAt: new Date().toISOString().split('T')[0]
        };

        this.products.unshift(newProduct);
        this.saveState();
        this.renderAll();
        this.closeModal('add-product-modal');

        Swal.fire('Product Secured!', `${name} added to your digital vault.`, 'success');
    }

    async deleteProduct(id) {
        const prod = this.products.find(p => p.id == id);
        if (!prod) return;

        Swal.fire({
            title: 'Remove Asset?',
            text: `Remove ${prod.name} from digital vault?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444'
        }).then(async (result) => {
            if (result.isConfirmed) {
                let backendOk = true;
                try {
                    const res = await fetch(`backend/api/products.php?product_id=${id}`, { method: 'DELETE' });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || data?.status !== 'success') {
                        backendOk = false;
                    }
                } catch (e) {
                    // Backend unreachable — proceed with local-only removal (offline/demo mode)
                }

                if (!backendOk) {
                    Swal.fire('Could Not Delete', 'The server rejected this request. The item was not removed.', 'error');
                    return;
                }

                this.products = this.products.filter(p => p.id != id);
                this.saveState();
                this.renderAll();
                Swal.fire('Deleted', 'Asset record removed.', 'success');
            }
        });
    }

    viewDocument(productId) {
        const prod = this.products.find(p => p.id == productId);
        if (!prod) return;

        document.getElementById('doc-title').textContent = `${prod.name} - Receipt`;
        document.getElementById('doc-meta-info').textContent = `File: ${prod.billName}`;

        const canvas = document.getElementById('doc-preview-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 540;
        canvas.height = 360;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 20px "Plus Jakarta Sans"';
        ctx.fillText("PURCHASE INVOICE & WARRANTY RECEIPT", 30, 45);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(30, 60);
        ctx.lineTo(510, 60);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '13px "Plus Jakarta Sans"';
        ctx.fillText(`Merchant: ${prod.brand} Official India Store`, 30, 90);
        ctx.fillText(`Product Name: ${prod.name}`, 30, 115);
        ctx.fillText(`Serial Number: ${prod.serialNumber}`, 30, 140);
        ctx.fillText(`Price: ₹${parseFloat(prod.priceInr || 0).toLocaleString('en-IN')}`, 30, 165);
        ctx.fillText(`Purchase Date: ${prod.purchaseDate}`, 30, 190);
        ctx.fillText(`Warranty Period: ${prod.warrantyPeriodMonths} Months`, 30, 215);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 22px "Plus Jakarta Sans"';
        ctx.fillText("✓ VAULTKEEP VERIFIED (₹ INR)", 220, 290);

        this.openModal('document-modal');
    }

    openQRCodeModal(productId) {
        const prod = this.products.find(p => p.id == productId);
        if (!prod) return;

        document.getElementById('qr-product-name').textContent = prod.name;
        document.getElementById('qr-serial-number').textContent = `SN: ${prod.serialNumber} • ₹${parseFloat(prod.priceInr || 0).toLocaleString('en-IN')}`;

        const qrContainer = document.getElementById('qrcode-container');
        qrContainer.innerHTML = '';

        // NOTE: the "₹" symbol is a multi-byte character that the legacy qrcodejs
        // (davidshimjs/qrcodejs v1.0.0) library cannot encode — it throws an exception
        // instead of drawing a code. Because that call happened before openModal(),
        // the thrown error stopped this whole function early and the QR modal never
        // opened at all. Using "INR" (plain ASCII) instead fixes the encoding, and the
        // try/catch below makes sure a library failure can never again block the modal.
        const qrPayload = JSON.stringify({
            app: "VaultKeep",
            id: prod.id,
            name: prod.name,
            currency: "INR",
            sn: prod.serialNumber
        });

        try {
            if (window.QRCode) {
                new QRCode(qrContainer, { text: qrPayload, width: 180, height: 180 });
            } else {
                qrContainer.innerHTML = `<i class="fas fa-qrcode" style="font-size: 8rem; color: #000;"></i>`;
            }
        } catch (err) {
            console.error('QR generation failed:', err);
            qrContainer.innerHTML = `<i class="fas fa-qrcode" style="font-size: 8rem; color: #000;"></i>`;
        }

        this.currentQRProduct = prod;
        this.openModal('qr-modal');
    }

    downloadQRCode() {
        Swal.fire('QR Passport Saved', 'PNG code generated successfully.', 'success');
    }

    openQRScannerModal() {
        this.openModal('qr-scanner-modal');
    }

    simulateScanSuccess() {
        const randomProd = this.products[Math.floor(Math.random() * this.products.length)];
        this.closeModal('qr-scanner-modal');
        Swal.fire('Scan Verified', `Identified Asset: ${randomProd.name}`, 'success');
    }

    async openServiceHistoryModal(productId) {
        const prod = this.products.find(p => p.id == productId);
        if (!prod) return;

        this.activeServiceProductId = productId;
        document.getElementById('service-product-title').textContent = `${prod.name} - Service History`;

        let records = this.serviceRecords.filter(s => s.productId == productId);

        // Try to pull the authoritative history from the backend for this product
        try {
            const res = await fetch(`backend/api/services.php?product_id=${productId}`);
            const data = await res.json().catch(() => null);
            if (res.ok && data?.status === 'success' && Array.isArray(data.data)) {
                records = data.data.map(r => ({
                    id: r.service_id,
                    productId: r.product_id,
                    date: r.service_date,
                    provider: r.provider_name,
                    costInr: parseFloat(r.cost_inr || 0),
                    description: r.description
                }));
            }
        } catch (e) {
            // Backend unreachable — fall back to whatever's cached locally
        }

        const container = document.getElementById('service-timeline-container');

        if (records.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted);">No repair logs yet.</p>`;
        } else {
            container.innerHTML = records.map(r => `
                <div style="padding: 1rem; border-left: 3px solid var(--accent-cyan); background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); margin-bottom: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; font-weight: 700;">
                        <span>${this.escapeHtml(r.provider)}</span>
                        <span class="text-cyan">₹${parseFloat(r.costInr).toLocaleString('en-IN')}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Date: ${this.escapeHtml(r.date)}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.3rem;">${this.escapeHtml(r.description)}</div>
                </div>
            `).join('');
        }

        this.openModal('service-modal');
    }

    async handleAddServiceRecord(e) {
        e.preventDefault();
        const provider = document.getElementById('service-provider').value.trim();
        const costInr = parseFloat(document.getElementById('service-cost').value);
        const date = document.getElementById('service-date').value;
        const description = document.getElementById('service-notes').value.trim();

        if (!provider || isNaN(costInr) || !date) return;

        // Try to persist to the backend first
        try {
            const formData = new FormData();
            formData.append('product_id', this.activeServiceProductId);
            formData.append('provider_name', provider);
            formData.append('cost', costInr);
            formData.append('service_date', date);
            formData.append('description', description);

            const res = await fetch('backend/api/services.php', { method: 'POST', body: formData });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.status === 'success') {
                // The server only returns a service_id + message, not the full record, so the
                // in-memory array never got the new cost added — that's why "Service Spend"
                // and "Total maintenance logged" stayed unchanged after a successful save.
                this.serviceRecords.push({
                    id: data.data?.service_id ?? Date.now(),
                    productId: this.activeServiceProductId,
                    date,
                    provider,
                    costInr,
                    description
                });
                this.renderMetricsSummary();
                await this.openServiceHistoryModal(this.activeServiceProductId);
                Swal.fire('Service Record Logged', `Logged cost ₹${costInr.toLocaleString('en-IN')}`, 'success');
                return;
            }
            Swal.fire('Could Not Save', data?.message || 'The server rejected this service record.', 'error');
            return;
        } catch (err) {
            // Backend unreachable — fall back to local-only storage
        }

        const record = {
            id: Date.now(),
            productId: this.activeServiceProductId,
            date,
            provider,
            costInr,
            description
        };

        this.serviceRecords.push(record);
        this.saveState();
        this.renderMetricsSummary();
        this.openServiceHistoryModal(this.activeServiceProductId);
        Swal.fire('Saved Locally', `Could not reach the server, so this was saved on this device only.`, 'warning');
    }

    renderRemindersDrawer() {
        const container = document.getElementById('reminders-list-container');
        if (!container) return;

        const upcomingAlerts = [];
        this.products.forEach(p => {
            const det = this.calculateExpiryDetails(p.purchaseDate, p.warrantyPeriodMonths);
            if (det.daysRemaining > 0 && det.daysRemaining <= 30) {
                upcomingAlerts.push({ product: p, details: det });
            }
        });

        // If the set of alerts has grown/changed since we last checked, treat that as
        // "new" and light the bell back up even if the user had previously seen the drawer.
        if (this._lastAlertCount !== null && upcomingAlerts.length > this._lastAlertCount) {
            this.notificationsSeen = false;
        }
        this._lastAlertCount = upcomingAlerts.length;
        this.updateNotificationBadge(upcomingAlerts.length);

        if (upcomingAlerts.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No urgent expiry alerts.</div>`;
        } else {
            container.innerHTML = upcomingAlerts.map(a => `
                <div class="reminder-card">
                    <div class="reminder-card-header">
                        <span class="text-amber"><i class="fas fa-bell"></i> ${a.details.daysRemaining} Days Remaining</span>
                        <span class="text-muted">${a.details.expiryDateStr}</span>
                    </div>
                    <div class="reminder-card-title">${this.escapeHtml(a.product.name)}</div>
                    <button class="btn btn-sm btn-secondary" style="margin-top: 0.5rem;" onclick="app.triggerEmailSimulator('${this.escapeHtml(a.product.name).replace(/'/g, "\\'")}')">
                        <i class="fas fa-paper-plane"></i> Test PHPMailer Alert
                    </button>
                </div>
            `).join('');
        }
    }

    updateNotificationBadge(alertCount) {
        const dot = document.querySelector('#btn-notifications .badge-dot');
        if (!dot) return;
        const shouldShow = alertCount > 0 && !this.notificationsSeen;
        dot.style.display = shouldShow ? '' : 'none';
    }

    markNotificationsSeen() {
        this.notificationsSeen = true;
        this.updateNotificationBadge(this._lastAlertCount || 0);
    }

    triggerEmailSimulator(productName) {
        Swal.fire('Alert Dispatched', `Simulated email notification sent regarding ${productName}`, 'info');
    }

    exportVaultPDF() {
        if (window.jspdf) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFontSize(18);
            doc.text("VaultKeep - Warranty Inventory Report (INR ₹)", 14, 20);

            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} | Total Assets: ${this.products.length}`, 14, 28);

            let y = 40;
            this.products.forEach((p, i) => {
                const det = this.calculateExpiryDetails(p.purchaseDate, p.warrantyPeriodMonths);
                const priceStr = p.priceInr ? `₹${parseFloat(p.priceInr).toLocaleString('en-IN')}` : '₹0';
                doc.text(`${i + 1}. ${p.name} (${p.brand}) - Price: ${priceStr}`, 14, y);
                doc.text(`   SN: ${p.serialNumber} | Expires: ${det.expiryDateStr} [${det.statusText}]`, 14, y + 6);
                y += 18;

                if (y > 270) { doc.addPage(); y = 20; }
            });

            doc.save("VaultKeep_INR_Summary.pdf");
            Swal.fire('Report Downloaded', 'PDF summary created.', 'success');
        }
    }

    renderAdminModule() {
        const catList = document.getElementById('admin-categories-list');
        if (catList) {
            catList.innerHTML = this.categories.map(c => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
                    <span><i class="fas fa-folder text-cyan"></i> ${this.escapeHtml(c)}</span>
                    <button class="btn-icon" style="width: 28px; height: 28px;" onclick="app.removeCategory('${this.escapeHtml(c)}')"><i class="fas fa-times"></i></button>
                </div>
            `).join('');
        }

        const userBody = document.getElementById('admin-users-body');
        if (userBody) {
            userBody.innerHTML = this.users.map(u => `
                <tr>
                    <td><strong>${this.escapeHtml(u.name)}</strong></td>
                    <td>${this.escapeHtml(u.email)}</td>
                    <td><span class="badge-status ${u.status === 'Active' ? 'badge-active' : 'badge-expired'}">${u.status}</span></td>
                    <td>${u.productsCount} Assets</td>
                    <td><button class="btn btn-sm btn-secondary" onclick="app.toggleUserStatus(${u.id})">${u.status === 'Active' ? 'Suspend' : 'Activate'}</button></td>
                </tr>
            `).join('');
        }
    }

    async handleAddCategory() {
        const input = document.getElementById('new-category-name');
        const catName = input.value.trim();
        if (!catName) return;

        if (this.categories.includes(catName)) return;

        try {
            const res = await fetch('backend/api/admin.php?action=categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_name: catName })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || data?.status !== 'success') {
                throw new Error(data?.message || 'The server rejected this category.');
            }
            // Re-pull the authoritative list (with real category_ids) instead of
            // guessing locally, so the product-form dropdown stays in sync.
            await this.loadCategories();
            this.renderAll();
            this.renderAdminModule();
            input.value = '';
            Swal.fire('Category Added', catName, 'success');
        } catch (err) {
            Swal.fire('Could Not Add Category', err.message || 'Could not reach the server.', 'error');
        }
    }

    async removeCategory(catName) {
        const catId = this.categoryIdMap[catName];
        if (!catId) {
            Swal.fire('Could Not Remove Category', 'This category was never confirmed with the server.', 'error');
            return;
        }

        try {
            const res = await fetch(`backend/api/admin.php?action=categories&category_id=${catId}`, { method: 'DELETE' });
            const data = await res.json().catch(() => null);
            if (!res.ok || data?.status !== 'success') {
                throw new Error(data?.message || 'The server rejected this request.');
            }
            await this.loadCategories();
            this.renderAll();
            this.renderAdminModule();
        } catch (err) {
            Swal.fire('Could Not Remove Category', err.message || 'Could not reach the server.', 'error');
        }
    }

    async toggleUserStatus(userId) {
        const user = this.users.find(u => u.id == userId);
        if (!user) return;

        const newStatus = user.status === 'Active' ? 'Suspended' : 'Active';

        try {
            const res = await fetch('backend/api/admin.php?action=users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, status: newStatus })
            });
            const result = await res.json();

            if (!res.ok || result.status !== 'success') {
                throw new Error(result.message || 'Failed to update user status');
            }

            user.status = newStatus;
            localStorage.setItem('vk_users', JSON.stringify(this.users));
            this.renderAdminModule();
        } catch (err) {
            Swal.fire('Update Failed', err.message || 'Could not update user status.', 'error');
        }
    }

    setupDropzone() {
        const dropzone = document.getElementById('file-dropzone');
        const fileInput = document.getElementById('product-file-input');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files.length) this.handleFileSelection(e.dataTransfer.files[0]);
            });
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) this.handleFileSelection(e.target.files[0]);
            });
        }
    }

    handleFileSelection(file) {
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire('File Too Large', 'Maximum size is 5MB as per SRS.', 'error');
            return;
        }
        this.uploadedFileName = file.name;
        document.getElementById('dropzone-file-name').textContent = `Selected: ${file.name}`;
    }

    openModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }

    closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    }

    toggleDrawer(id, show) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', show);
    }
}

// ============================================================
// LOADING SCREEN CONTROLLER
// ============================================================
function runLoadingScreen() {
    const screen    = document.getElementById('loading-screen');
    const statusEl  = document.getElementById('loader-status');

    const messages = [
        'Initializing Vault...',
        'Loading Warranty Data...',
        'Decrypting Documents...',
        'Syncing Service History...',
        'Vault Ready! ✓'
    ];
    let msgIndex = 0;
    const msgInterval = setInterval(() => {
        msgIndex++;
        if (statusEl && messages[msgIndex]) {
            statusEl.style.opacity = '0';
            setTimeout(() => {
                statusEl.textContent = messages[msgIndex];
                statusEl.style.transition = 'opacity 0.3s ease';
                statusEl.style.opacity = '1';
                if (msgIndex === messages.length - 1) {
                    statusEl.style.color = '#10b981';
                }
            }, 200);
        }
        if (msgIndex >= messages.length - 1) clearInterval(msgInterval);
    }, 500);

    // Dismiss loader after 2.8s
    setTimeout(() => {
        if (screen) {
            screen.classList.add('hide');
            screen.addEventListener('transitionend', () => {
                screen.style.display = 'none';
            }, { once: true });
        }
        // Initialize app only after loader is done
        app = new VaultKeepApp();
        // Kick off scroll animations after app is ready
        setTimeout(initScrollAnimations, 100);
    }, 2800);
}

// ============================================================
// SCROLL REVEAL ANIMATION SYSTEM (IntersectionObserver)
// ============================================================
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -60px 0px',
        threshold: 0.12
    };

    function createObserver(className, activeClass) {
        const targets = document.querySelectorAll(`.${className}`);
        if (!targets.length) return;

        const obs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    obs.unobserve(entry.target); // animate once
                }
            });
        }, observerOptions);

        targets.forEach(el => obs.observe(el));
    }

    createObserver('scroll-reveal', 'visible');
    createObserver('scroll-reveal-left', 'visible');
    createObserver('scroll-reveal-right', 'visible');
    createObserver('scroll-reveal-scale', 'visible');

    // Also animate stagger children
    document.querySelectorAll('.scroll-stagger').forEach(container => {
        const children = container.querySelectorAll('.scroll-reveal, .glass-panel');
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    setTimeout(() => entry.target.classList.add('visible'), i * 100);
                    obs.unobserve(entry.target);
                }
            });
        }, { ...observerOptions, threshold: 0.05 });
        children.forEach(child => {
            child.classList.add('scroll-reveal');
            obs.observe(child);
        });
    });

    // Animate metric cards with counter animation
    document.querySelectorAll('.metric-value').forEach(el => {
        const target = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
        if (!target) return;
        const prefix = el.textContent.match(/^[^\d]*/)?.[0] || '';
        const suffix = el.textContent.match(/[^\d]*$/)?.[0] || '';
        let current = 0;
        const step = Math.ceil(target / 40);
        const obsC = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const timer = setInterval(() => {
                    current = Math.min(current + step, target);
                    el.textContent = prefix + current + suffix;
                    if (current >= target) clearInterval(timer);
                }, 30);
                obsC.unobserve(el);
            }
        }, observerOptions);
        obsC.observe(el);
    });
}

// ============================================================
// BOOT: Run Loader then App
// ============================================================
let app;
document.addEventListener('DOMContentLoaded', () => {
    runLoadingScreen();
});

