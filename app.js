/* =========================================================================
   Η λίστα των προϊόντων έρχεται πλέον ΑΥΤΟΜΑΤΑ από το Excel
   μέσω του αρχείου data.js. Επομένως δεν χρειάζεται να πειράξεις κάτι εδώ!
   ========================================================================= */

// Αν για κάποιο λόγο δεν υπάρχουν προϊόντα (π.χ. δεν έτρεξε η μακροεντολή)
if (typeof products === 'undefined' || products.length === 0) {
    alert("Δεν βρέθηκαν προϊόντα. Παρακαλώ τρέξτε τη μακροεντολή στο Excel για να δημιουργηθεί το αρχείο data.js.");
}

// ===== LICENSE SYSTEM =====
const LICENSE_SECRET_SALT = 4827;
const LICENSE_XOR_KEY = 58291;
const LICENSE_MOD_BASE = 46656; // 36^3

function validateLicenseKey(key) {
    if (!key || typeof key !== 'string') return null;
    
    key = key.trim().toUpperCase();
    const parts = key.split('-');
    
    // Πρέπει να είναι: VC-XXXXX-XXX
    if (parts.length !== 3 || parts[0] !== 'VC') return null;
    
    // Decode date
    const dateNum = parseInt(parts[1], 36) ^ LICENSE_XOR_KEY;
    if (isNaN(dateNum) || dateNum < 20200101 || dateNum > 20501231) return null;
    
    // Verify checksum
    const expectedChecksum = ((dateNum * 7 + LICENSE_SECRET_SALT) % LICENSE_MOD_BASE).toString(36).toUpperCase().padStart(3, '0');
    if (expectedChecksum !== parts[2].padStart(3, '0')) return null;
    
    // Extract date
    const year = Math.floor(dateNum / 10000);
    const month = Math.floor((dateNum % 10000) / 100);
    const day = dateNum % 100;
    
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    
    return new Date(year, month - 1, day, 23, 59, 59);
}

function isLicenseValid() {
    const storedKey = localStorage.getItem('vcLicenseKey');
    if (!storedKey) return false;
    
    const expiryDate = validateLicenseKey(storedKey);
    if (!expiryDate) return false;
    
    return new Date() <= expiryDate;
}

function getLicenseExpiry() {
    const storedKey = localStorage.getItem('vcLicenseKey');
    if (!storedKey) return null;
    return validateLicenseKey(storedKey);
}

function checkLicense() {
    const licenseScreen = document.getElementById('license-screen');
    const app = document.getElementById('app');
    const btnActivate = document.getElementById('btn-activate');
    const licenseInput = document.getElementById('license-input');
    const licenseError = document.getElementById('license-error');
    
    if (isLicenseValid()) {
        // Άδεια ισχύει — δείξε την εφαρμογή
        licenseScreen.classList.add('hidden');
        app.classList.remove('app-locked');
        init();
        return;
    }
    
    // Αν η άδεια έληξε, δείξε μήνυμα
    const expiry = getLicenseExpiry();
    if (expiry) {
        licenseError.textContent = `Η άδεια έληξε στις ${expiry.toLocaleDateString('el-GR')}. Παρακαλώ εισάγετε νέο κλειδί.`;
        licenseError.classList.remove('hidden');
        localStorage.removeItem('vcLicenseKey');
    }
    
    // Δείξε lock screen
    licenseScreen.classList.remove('hidden');
    app.classList.add('app-locked');
    
    // Event listener για ενεργοποίηση
    btnActivate.addEventListener('click', () => {
        const key = licenseInput.value.trim();
        
        if (!key) {
            licenseError.textContent = 'Παρακαλώ εισάγετε ένα κλειδί αδείας.';
            licenseError.classList.remove('hidden');
            return;
        }
        
        const expiryDate = validateLicenseKey(key);
        
        if (!expiryDate) {
            licenseError.textContent = 'Μη έγκυρο κλειδί. Ελέγξτε και δοκιμάστε ξανά.';
            licenseError.classList.remove('hidden');
            licenseInput.classList.add('shake');
            setTimeout(() => licenseInput.classList.remove('shake'), 500);
            return;
        }
        
        if (new Date() > expiryDate) {
            licenseError.textContent = `Αυτό το κλειδί έχει λήξει (${expiryDate.toLocaleDateString('el-GR')}).`;
            licenseError.classList.remove('hidden');
            return;
        }
        
        // Επιτυχία!
        localStorage.setItem('vcLicenseKey', key.toUpperCase());
        licenseError.classList.add('hidden');
        
        // Animation
        btnActivate.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Ενεργοποιήθηκε!';
        btnActivate.style.background = '#10b981';
        
        setTimeout(() => {
            licenseScreen.classList.add('hidden');
            app.classList.remove('app-locked');
            init();
        }, 800);
    });
    
    // Enter key
    licenseInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnActivate.click();
    });
}

// Εξαγωγή μοναδικών προμηθευτών
const suppliers = [...new Set(products.map(p => p.supplier))];

// State (Κατάσταση Εφαρμογής)
let activeSupplier = ""; // Κενό = όλοι οι προμηθευτές
let activeCategory = "Όλα";
let searchQuery = "";
let orderQuantities = {}; // Μορφή: { 1: 2, 5: 1 } (id: quantity)
let orderNotes = {};      // Μορφή: { 1: "Παγωμένα", 5: "Χωρίς ζάχαρη" }


// Οπτικά Στοιχεία (DOM Elements)
const supplierSelect = document.getElementById("supplier-select");
const categorySlicer = document.getElementById("category-slicer");
const searchInput = document.getElementById("search-input");
const productList = document.getElementById("product-list");
const btnCart = document.getElementById("btn-cart");
const cartCount = document.getElementById("cart-count");
const cartModal = document.getElementById("cart-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const cartItemsContainer = document.getElementById("cart-items");
const btnSendEmail = document.getElementById("btn-send-email");
const btnReset = document.getElementById("btn-reset");
const btnPrintOrder = document.getElementById("btn-print-order");

// Νέα DOM Elements
const btnFullSummary = document.getElementById("btn-full-summary");
const fullSummaryModal = document.getElementById("full-summary-modal");
const btnCloseFullSummary = document.getElementById("btn-close-full-summary");
const fullSummaryItems = document.getElementById("full-summary-items");
const btnPrintFullSummary = document.getElementById("btn-print-full-summary");
const btnSendAllEmails = document.getElementById("btn-send-all-emails");
const btnSettings = document.getElementById("btn-settings");
const settingsModal = document.getElementById("settings-modal");
const btnCloseSettings = document.getElementById("btn-close-settings");
const btnSaveSettings = document.getElementById("btn-save-settings");
const supplierEmailList = document.getElementById("supplier-email-list");
const btnExportEmails = document.getElementById("btn-export-emails");
const btnImportEmails = document.getElementById("btn-import-emails");
const importFileInput = document.getElementById("import-file-input");

// ===== SETTINGS: Supplier Emails (localStorage) =====
function getSupplierEmails() {
    const stored = localStorage.getItem('supplierEmails');
    return stored ? JSON.parse(stored) : {};
}

function saveSupplierEmails(emailMap) {
    localStorage.setItem('supplierEmails', JSON.stringify(emailMap));
}

function getEmailForSupplier(supplierName) {
    const emails = getSupplierEmails();
    return emails[supplierName] || "";
}

// Αρχικοποίηση
function init() {
    if (suppliers.length === 0) return; // Αν δεν υπάρχουν δεδομένα, σταματάμε
    
    renderSuppliers();
    
    // Ακούμε για αλλαγή προμηθευτή
    supplierSelect.addEventListener("change", (e) => {
        activeSupplier = e.target.value;
        activeCategory = "Όλα"; // Επαναφορά κατηγορίας στο "Όλα"
        renderCategories();
        renderProducts();
        updateCartButton(); // Ενημέρωση καλαθιού για να δείχνει μόνο τα του προμηθευτή
    });
    
    renderCategories();
    renderProducts();
    updateCartButton();
    
    // Event Listeners — Υπάρχοντα
    btnCart.addEventListener("click", openCart);
    btnCloseModal.addEventListener("click", closeCart);
    btnSendEmail.addEventListener("click", sendEmail);
    btnReset.addEventListener("click", resetOrder);
    btnPrintOrder.addEventListener("click", printOrderPage);
    
    // Event Listeners — Γενική Σύνοψη
    btnFullSummary.addEventListener("click", openFullSummary);
    btnCloseFullSummary.addEventListener("click", closeFullSummary);
    btnPrintFullSummary.addEventListener("click", printFullSummaryPage);
    btnSendAllEmails.addEventListener("click", sendEmailsToAllSuppliers);
    fullSummaryModal.addEventListener("click", (e) => {
        if (e.target === fullSummaryModal) closeFullSummary();
    });
    
    // Event Listeners — Ρυθμίσεις
    btnSettings.addEventListener("click", openSettings);
    btnCloseSettings.addEventListener("click", closeSettings);
    btnSaveSettings.addEventListener("click", saveSettings);
    btnExportEmails.addEventListener("click", exportEmails);
    btnImportEmails.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", importEmails);
    settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) closeSettings();
    });
    
    // Αναζήτηση
    searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        renderProducts();
    });
    
    // Κλείσιμο modal αν κάνεις κλικ έξω από αυτό
    cartModal.addEventListener("click", (e) => {
        if (e.target === cartModal) closeCart();
    });
}

// Render Suppliers
function renderSuppliers() {
    supplierSelect.innerHTML = "";
    
    // Placeholder: όλοι οι προμηθευτές
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Επιλέξτε προμηθευτή";
    if (activeSupplier === "") defaultOption.selected = true;
    supplierSelect.appendChild(defaultOption);
    
    suppliers.forEach(sup => {
        const option = document.createElement("option");
        option.value = sup;
        option.textContent = sup;
        if (sup === activeSupplier) option.selected = true;
        supplierSelect.appendChild(option);
    });
}

// Render Categories (Slicers) - Εξαρτώνται από τον επιλεγμένο προμηθευτή
function renderCategories() {
    categorySlicer.innerHTML = "";
    
    // Βρίσκουμε τις κατηγορίες ανάλογα τον επιλεγμένο προμηθευτή
    const sourceProducts = activeSupplier 
        ? products.filter(p => p.supplier === activeSupplier)
        : products;
    
    // Φιλτράρουμε κενές κατηγορίες
    const allCategories = [...new Set(sourceProducts.map(p => p.category))].filter(c => c !== "");
    const categories = ["Όλα", ...allCategories];
    
    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = `slicer-btn ${cat === activeCategory ? "active" : ""}`;
        btn.textContent = cat;
        btn.onclick = () => {
            activeCategory = cat;
            renderCategories(); // re-render to update active class
            renderProducts();
        };
        categorySlicer.appendChild(btn);
    });
}

// Render Products
function renderProducts() {
    productList.innerHTML = "";
    
    // Φιλτράρισμα ανά Προμηθευτή (κενό = όλοι)
    let filteredProducts = activeSupplier 
        ? products.filter(p => p.supplier === activeSupplier)
        : [...products];
    
    // Φιλτράρισμα ανά Κατηγορία (αν δεν είναι "Όλα")
    if (activeCategory !== "Όλα") {
        filteredProducts = filteredProducts.filter(p => p.category === activeCategory);
    }
    
    // Φιλτράρισμα ανά Αναζήτηση
    if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase().trim();
        filteredProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(query));
    }
    
    // Εμφάνιση προμηθευτή όταν βλέπουμε όλους
    const showSupplierTag = !activeSupplier;
        
    filteredProducts.forEach(product => {
        const qty = orderQuantities[product.id] || 0;
        const note = orderNotes[product.id] || "";
        
        const card = document.createElement("div");
        card.className = "product-card";
        
        // HTML για το πάνω μέρος (Πληροφορίες & Ποσότητα)
        let html = `
            <div class="product-card-top">
                <div class="product-info">
                    <span class="product-name">${product.name}</span>
                    <span class="product-category">${product.category}${showSupplierTag ? ` <span class="product-supplier-tag">${product.supplier}</span>` : ''}</span>
                </div>
                <div class="quantity-controls">
                    <button class="qty-btn" onclick="updateQuantity(${product.id}, -1)">
                        <span class="material-symbols-rounded">remove</span>
                    </button>
                    <span class="qty-value ${qty > 0 ? 'has-value' : ''}">${qty}</span>
                    <button class="qty-btn" onclick="updateQuantity(${product.id}, 1)">
                        <span class="material-symbols-rounded">add</span>
                    </button>
                </div>
            </div>
        `;
        
        // Αν η ποσότητα είναι > 0, δείχνουμε το πεδίο για σχόλια
        if (qty > 0) {
            html += `
            <div class="product-note-container">
                <span class="material-symbols-rounded product-note-icon">edit_note</span>
                <input type="text" class="product-note-input" 
                       placeholder="Προσθήκη σχολίου (π.χ. παγωμένα)..." 
                       value="${note}" 
                       onchange="updateNote(${product.id}, this.value)">
            </div>
            `;
        }
        
        card.innerHTML = html;
        productList.appendChild(card);
    });
}

// Update Quantity
window.updateQuantity = function(productId, change) {
    const currentQty = orderQuantities[productId] || 0;
    const newQty = currentQty + change;
    
    if (newQty < 0) return; // Δεν πάμε κάτω από 0
    
    if (newQty === 0) {
        delete orderQuantities[productId];
        delete orderNotes[productId]; // Διαγραφή σημείωσης αν μηδενιστεί η ποσότητα
    } else {
        orderQuantities[productId] = newQty;
    }
    
    renderProducts();
    updateCartButton();
};

// Update Note
window.updateNote = function(productId, text) {
    if (text.trim() === "") {
        delete orderNotes[productId];
    } else {
        orderNotes[productId] = text;
    }
};

// Update Cart Floating Button
function updateCartButton() {
    const totalItems = Object.keys(orderQuantities).length;
    
    if (activeSupplier) {
        // Στο καλάθι μετράμε ΜΟΝΟ τα είδη του τρέχοντος προμηθευτή
        const currentSupplierItemsCount = Object.keys(orderQuantities).filter(id => {
            const p = products.find(prod => prod.id == id);
            return p && p.supplier === activeSupplier;
        }).length;
        
        cartCount.textContent = currentSupplierItemsCount;
        
        if (currentSupplierItemsCount > 0) {
            btnCart.classList.remove("hidden");
        } else {
            btnCart.classList.add("hidden");
            closeCart();
        }
    } else {
        // Όταν βλέπουμε όλους τους προμηθευτές, δείχνουμε το σύνολο
        cartCount.textContent = totalItems;
        if (totalItems > 0) {
            btnCart.classList.remove("hidden");
        } else {
            btnCart.classList.add("hidden");
            closeCart();
        }
    }
    
    // Ενημέρωση κουμπιού Γενικής Σύνοψης
    if (totalItems > 0) {
        btnFullSummary.classList.remove("hidden");
    } else {
        btnFullSummary.classList.add("hidden");
    }
}

// Open/Close Cart
function openCart() {
    cartItemsContainer.innerHTML = "";
    
    // Φιλτράρισμα παραγγελιών μόνο για τον ενεργό προμηθευτή
    const supplierOrders = Object.keys(orderQuantities).filter(id => {
        const p = products.find(prod => prod.id == id);
        return p && p.supplier === activeSupplier;
    });
    
    supplierOrders.forEach(id => {
        const product = products.find(p => p.id == id);
        const qty = orderQuantities[id];
        const note = orderNotes[id];
        
        const div = document.createElement("div");
        div.className = "cart-item";
        
        let itemHtml = `
            <div class="cart-item-top">
                <span class="cart-item-name">${product.name}</span>
                <span class="cart-item-qty">${qty}</span>
            </div>
        `;
        
        if (note) {
            itemHtml += `<span class="cart-item-note">Σημείωση: ${note}</span>`;
        }
        
        div.innerHTML = itemHtml;
        cartItemsContainer.appendChild(div);
    });
    
    cartModal.classList.remove("hidden");
}

function closeCart() {
    cartModal.classList.add("hidden");
}

// ===== ΕΚΤΥΠΩΣΗ (Mobile-friendly) =====
function getPrintStyles() {
    return `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 24px;
            color: #1f2937;
            line-height: 1.5;
        }
        .print-header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid #2563eb;
        }
        .print-header h1 {
            font-size: 1.3rem;
            font-weight: 700;
            color: #1f2937;
        }
        .print-header .print-date {
            font-size: 0.85rem;
            color: #6b7280;
            margin-top: 4px;
        }
        .print-supplier {
            font-size: 1.1rem;
            font-weight: 700;
            margin: 16px 0 8px;
            padding: 8px 12px;
            background: #f3f4f6;
            border-left: 4px solid #2563eb;
            border-radius: 4px;
        }
        .print-supplier-count {
            font-weight: 400;
            font-size: 0.85rem;
            color: #6b7280;
            margin-left: 8px;
        }
        .print-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .print-item:last-child { border-bottom: none; }
        .print-item-name { font-size: 0.9rem; }
        .print-item-qty {
            font-weight: 700;
            color: #2563eb;
            min-width: 40px;
            text-align: right;
        }
        .print-item-note {
            font-size: 0.8rem;
            color: #6b7280;
            font-style: italic;
            padding: 2px 12px 6px;
        }
        .print-total {
            margin-top: 20px;
            padding: 12px;
            background: #1f2937;
            color: white;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 0.95rem;
        }
        @media print {
            body { padding: 0; }
        }
    `;
}

function openPrintWindow(title, bodyHtml) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Ο browser μπλόκαρε το παράθυρο εκτύπωσης. Παρακαλώ επιτρέψτε τα pop-ups για αυτή τη σελίδα.');
        return;
    }
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('el-GR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    
    printWindow.document.write(`<!DOCTYPE html>
<html lang="el">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${getPrintStyles()}</style>
</head>
<body>
    <div class="print-header">
        <h1>Vathi Cove Order</h1>
        <div class="print-date">${dateStr} — ${timeStr}</div>
    </div>
    ${bodyHtml}
    <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
}

function printOrderPage() {
    // Εκτύπωση σύνοψης ενός προμηθευτή
    const supplierOrders = Object.keys(orderQuantities).filter(id => {
        const p = products.find(prod => prod.id == id);
        return p && p.supplier === activeSupplier;
    });
    
    if (supplierOrders.length === 0) return;
    
    let html = `<div class="print-supplier">${activeSupplier}<span class="print-supplier-count">${supplierOrders.length} είδη</span></div>`;
    
    supplierOrders.forEach(id => {
        const product = products.find(p => p.id == id);
        const qty = orderQuantities[id];
        const note = orderNotes[id];
        
        html += `<div class="print-item">
            <span class="print-item-name">${product.name}</span>
            <span class="print-item-qty">${qty}</span>
        </div>`;
        if (note) {
            html += `<div class="print-item-note">📝 ${note}</div>`;
        }
    });
    
    openPrintWindow(`Παραγγελία: ${activeSupplier}`, html);
}

function printFullSummaryPage() {
    // Εκτύπωση γενικής σύνοψης (όλοι οι προμηθευτές)
    const ordersBySupplier = {};
    Object.keys(orderQuantities).forEach(id => {
        const product = products.find(p => p.id == id);
        if (!product) return;
        if (!ordersBySupplier[product.supplier]) {
            ordersBySupplier[product.supplier] = [];
        }
        ordersBySupplier[product.supplier].push({
            product,
            qty: orderQuantities[id],
            note: orderNotes[id] || ""
        });
    });
    
    if (Object.keys(ordersBySupplier).length === 0) return;
    
    let html = '';
    let totalItemCount = 0;
    
    Object.keys(ordersBySupplier).forEach(supplierName => {
        const items = ordersBySupplier[supplierName];
        totalItemCount += items.length;
        
        html += `<div class="print-supplier">${supplierName}<span class="print-supplier-count">${items.length} είδη</span></div>`;
        
        items.forEach(item => {
            html += `<div class="print-item">
                <span class="print-item-name">${item.product.name}</span>
                <span class="print-item-qty">${item.qty}</span>
            </div>`;
            if (item.note) {
                html += `<div class="print-item-note">📝 ${item.note}</div>`;
            }
        });
    });
    
    html += `<div class="print-total">
        <span>Σύνολο:</span>
        <strong>${totalItemCount} είδη από ${Object.keys(ordersBySupplier).length} προμηθευτές</strong>
    </div>`;
    
    openPrintWindow('Γενική Σύνοψη Παραγγελίας', html);
}

// Reset Order (ΓΙΑ ΟΛΟΥΣ ΤΟΥΣ ΠΡΟΜΗΘΕΥΤΕΣ)
function resetOrder() {
    if (Object.keys(orderQuantities).length === 0) {
        alert(`Δεν υπάρχουν επιλεγμένα είδη στο καλάθι.`);
        return;
    }
    
    if (confirm(`Είστε σίγουροι ότι θέλετε να μηδενίσετε εντελώς ΤΙΣ ΠΑΡΑΓΓΕΛΙΕΣ ΓΙΑ ΟΛΟΥΣ ΤΟΥΣ ΠΡΟΜΗΘΕΥΤΕΣ;`)) {
        orderQuantities = {};
        orderNotes = {};
        renderProducts();
        updateCartButton();
        closeCart();
        closeFullSummary();
    }
}

// Send Email
function sendEmail() {
    // Βρίσκουμε το email του τρέχοντος προμηθευτή από τις ρυθμίσεις (localStorage)
    const emailTo = getEmailForSupplier(activeSupplier);
    
    if (!emailTo) {
        if (confirm(`Δεν έχει οριστεί email για τον προμηθευτή "${activeSupplier}".\n\nΘέλετε να ανοίξετε τις Ρυθμίσεις για να το προσθέσετε;`)) {
            closeCart();
            openSettings();
        }
        return;
    }
    
    const subject = encodeURIComponent(`Νέα Παραγγελία: ${activeSupplier}`);
    
    let bodyText = `Γεια σας,\n\nΠαρακαλώ όπως προχωρήσετε στην παρακάτω παραγγελία:\n\n`;
    
    const supplierOrders = Object.keys(orderQuantities).filter(id => {
        const p = products.find(prod => prod.id == id);
        return p && p.supplier === activeSupplier;
    });
    
    supplierOrders.forEach(id => {
        const product = products.find(p => p.id == id);
        const qty = orderQuantities[id];
        const note = orderNotes[id];
        
        bodyText += `- ${product.name} (Ποσότητα: ${qty})`;
        if (note) {
            bodyText += ` [Σημείωση: ${note}]`;
        }
        bodyText += `\n`;
    });
    
    bodyText += "\nΕυχαριστώ πολύ.";
    const body = encodeURIComponent(bodyText);
    
    // Άνοιγμα του προεπιλεγμένου προγράμματος mail
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
    closeCart();
}

// ===== ΓΕΝΙΚΗ ΣΥΝΟΨΗ ΠΑΡΑΓΓΕΛΙΑΣ (Όλοι οι Προμηθευτές) =====
function openFullSummary() {
    fullSummaryItems.innerHTML = "";
    
    // Ομαδοποίηση ειδών ανά προμηθευτή
    const ordersBySupplier = {};
    Object.keys(orderQuantities).forEach(id => {
        const product = products.find(p => p.id == id);
        if (!product) return;
        if (!ordersBySupplier[product.supplier]) {
            ordersBySupplier[product.supplier] = [];
        }
        ordersBySupplier[product.supplier].push({
            product,
            qty: orderQuantities[id],
            note: orderNotes[id] || ""
        });
    });
    
    if (Object.keys(ordersBySupplier).length === 0) {
        fullSummaryItems.innerHTML = '<p class="empty-summary">Δεν υπάρχουν επιλεγμένα είδη.</p>';
        fullSummaryModal.classList.remove("hidden");
        return;
    }
    
    // Ημερομηνία
    const now = new Date();
    const dateStr = now.toLocaleDateString('el-GR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'summary-date';
    dateDiv.innerHTML = `<span class="material-symbols-rounded">calendar_today</span> ${dateStr} — ${timeStr}`;
    fullSummaryItems.appendChild(dateDiv);
    
    let totalItemCount = 0;
    
    // Render ανά προμηθευτή
    Object.keys(ordersBySupplier).forEach(supplierName => {
        const items = ordersBySupplier[supplierName];
        
        const section = document.createElement('div');
        section.className = 'summary-supplier-section';
        
        let sectionHtml = `
            <div class="summary-supplier-header">
                <span class="material-symbols-rounded">local_shipping</span>
                <span class="summary-supplier-name">${supplierName}</span>
                <span class="summary-supplier-count">${items.length} είδη</span>
            </div>
            <div class="summary-items-list">
        `;
        
        items.forEach(item => {
            totalItemCount++;
            sectionHtml += `
                <div class="summary-item">
                    <span class="summary-item-name">${item.product.name}</span>
                    <span class="summary-item-qty">${item.qty}</span>
                </div>
            `;
            if (item.note) {
                sectionHtml += `<span class="summary-item-note">📝 ${item.note}</span>`;
            }
        });
        
        sectionHtml += '</div>';
        section.innerHTML = sectionHtml;
        fullSummaryItems.appendChild(section);
    });
    
    // Συνολικό footer
    const totalDiv = document.createElement('div');
    totalDiv.className = 'summary-total';
    totalDiv.innerHTML = `
        <span>Σύνολο:</span>
        <strong>${totalItemCount} είδη</strong> από <strong>${Object.keys(ordersBySupplier).length} προμηθευτές</strong>
    `;
    fullSummaryItems.appendChild(totalDiv);
    
    fullSummaryModal.classList.remove("hidden");
}

function closeFullSummary() {
    fullSummaryModal.classList.add("hidden");
}

// ===== ΡΥΘΜΙΣΕΙΣ (Settings) =====
function openSettings() {
    supplierEmailList.innerHTML = "";
    const savedEmails = getSupplierEmails();
    
    // Εμφάνιση τρεχόντων προμηθευτών
    suppliers.forEach(sup => {
        const currentEmail = savedEmails[sup] || "";
        const row = document.createElement('div');
        row.className = 'settings-email-row';
        row.innerHTML = `
            <label class="settings-email-label">${sup}</label>
            <div class="settings-email-input-wrapper">
                <span class="material-symbols-rounded settings-email-icon">mail</span>
                <input type="email" class="settings-email-input" 
                       data-supplier="${sup}" 
                       value="${currentEmail}" 
                       placeholder="email@example.com">
            </div>
        `;
        supplierEmailList.appendChild(row);
    });
    
    // Εμφάνιση «ορφανών» emails (αποθηκευμένα emails για προμηθευτές που δεν υπάρχουν πλέον στο data.js)
    const orphanedSuppliers = Object.keys(savedEmails).filter(s => !suppliers.includes(s));
    if (orphanedSuppliers.length > 0) {
        const orphanTitle = document.createElement('div');
        orphanTitle.className = 'settings-orphan-title';
        orphanTitle.innerHTML = `<span class="material-symbols-rounded" style="font-size:18px;vertical-align:middle;margin-right:4px">warning</span> Παλαιότερα emails (δεν αντιστοιχούν σε τρέχοντα προμηθευτή)`;
        supplierEmailList.appendChild(orphanTitle);
        
        orphanedSuppliers.forEach(sup => {
            const row = document.createElement('div');
            row.className = 'settings-email-row settings-orphan-row';
            row.innerHTML = `
                <label class="settings-email-label">${sup}</label>
                <div class="settings-email-input-wrapper">
                    <span class="material-symbols-rounded settings-email-icon">mail</span>
                    <input type="email" class="settings-email-input" 
                           data-supplier="${sup}" 
                           value="${savedEmails[sup]}" 
                           placeholder="email@example.com">
                </div>
            `;
            supplierEmailList.appendChild(row);
        });
    }
    
    settingsModal.classList.remove("hidden");
}

function closeSettings() {
    settingsModal.classList.add("hidden");
}

function saveSettings() {
    const emailMap = {};
    const inputs = supplierEmailList.querySelectorAll('.settings-email-input');
    
    inputs.forEach(input => {
        const supplier = input.getAttribute('data-supplier');
        const email = input.value.trim();
        if (email) {
            emailMap[supplier] = email;
        }
    });
    
    saveSupplierEmails(emailMap);
    
    // Visual feedback
    btnSaveSettings.innerHTML = '<span class="material-symbols-rounded">check</span> Αποθηκεύτηκε!';
    btnSaveSettings.style.background = '#10b981';
    setTimeout(() => {
        btnSaveSettings.innerHTML = '<span class="material-symbols-rounded">save</span> Αποθήκευση';
        btnSaveSettings.style.background = '';
        closeSettings();
    }, 1200);
}

// ===== ΕΞΑΓΩΓΗ / ΕΙΣΑΓΩΓΗ EMAILS =====
function exportEmails() {
    const emails = getSupplierEmails();
    if (Object.keys(emails).length === 0) {
        alert('Δεν υπάρχουν αποθηκευμένα emails για εξαγωγή.');
        return;
    }
    const blob = new Blob([JSON.stringify(emails, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vathicove_supplier_emails.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Visual feedback στο κουμπί export
    btnExportEmails.innerHTML = '<span class="material-symbols-rounded">check</span> Έγινε!';
    setTimeout(() => {
        btnExportEmails.innerHTML = '<span class="material-symbols-rounded">download</span> Εξαγωγή';
    }, 1500);
}

function importEmails(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (typeof imported !== 'object' || Array.isArray(imported)) {
                throw new Error('Μη έγκυρη μορφή');
            }
            
            // Merge: τα νέα emails αντικαθιστούν τα παλιά, αλλά κρατάμε όσα δεν υπάρχουν στο import
            const current = getSupplierEmails();
            const merged = { ...current, ...imported };
            saveSupplierEmails(merged);
            
            // Ανανέωση της φόρμας
            openSettings();
            
            alert(`Επιτυχής εισαγωγή ${Object.keys(imported).length} emails!`);
        } catch (err) {
            alert('Σφάλμα κατά την εισαγωγή. Βεβαιωθείτε ότι το αρχείο είναι σωστό JSON.');
        }
    };
    reader.readAsText(file);
    // Reset input ώστε να μπορεί να ξαναεπιλεγεί το ίδιο αρχείο
    event.target.value = '';
}

// ===== ΑΠΟΣΤΟΛΗ EMAIL ΣΕ ΟΛΟΥΣ ΤΟΥΣ ΠΡΟΜΗΘΕΥΤΕΣ =====
function sendEmailsToAllSuppliers() {
    // Ομαδοποίηση ειδών ανά προμηθευτή
    const ordersBySupplier = {};
    Object.keys(orderQuantities).forEach(id => {
        const product = products.find(p => p.id == id);
        if (!product) return;
        if (!ordersBySupplier[product.supplier]) {
            ordersBySupplier[product.supplier] = [];
        }
        ordersBySupplier[product.supplier].push({
            product,
            qty: orderQuantities[id],
            note: orderNotes[id] || ""
        });
    });
    
    const supplierNames = Object.keys(ordersBySupplier);
    if (supplierNames.length === 0) {
        alert('Δεν υπάρχουν επιλεγμένα είδη.');
        return;
    }
    
    // Έλεγχος emails
    const savedEmails = getSupplierEmails();
    const missingEmails = supplierNames.filter(s => !savedEmails[s]);
    
    if (missingEmails.length > 0) {
        const msg = `Λείπουν emails για τους εξής προμηθευτές:\n\n${missingEmails.join('\n')}\n\nΘέλετε να ανοίξετε τις Ρυθμίσεις;`;
        if (confirm(msg)) {
            closeFullSummary();
            openSettings();
        }
        return;
    }
    
    // Επιβεβαίωση
    const confirmMsg = `Θα ανοιχθούν ${supplierNames.length} ξεχωριστά email για τους εξής προμηθευτές:\n\n${supplierNames.map(s => `• ${s} (${ordersBySupplier[s].length} είδη)`).join('\n')}\n\nΣυνέχεια;`;
    if (!confirm(confirmMsg)) return;
    
    // Διαδοχικό άνοιγμα mailto links
    supplierNames.forEach((supplierName, index) => {
        const emailTo = savedEmails[supplierName];
        const items = ordersBySupplier[supplierName];
        const subject = encodeURIComponent(`Νέα Παραγγελία: ${supplierName}`);
        
        let bodyText = `Γεια σας,\n\nΠαρακαλώ όπως προχωρήσετε στην παρακάτω παραγγελία:\n\n`;
        items.forEach(item => {
            bodyText += `- ${item.product.name} (Ποσότητα: ${item.qty})`;
            if (item.note) {
                bodyText += ` [Σημείωση: ${item.note}]`;
            }
            bodyText += `\n`;
        });
        bodyText += `\nΕυχαριστώ πολύ.`;
        const body = encodeURIComponent(bodyText);
        
        // Χρήση timeout για να μη μπλοκάρει ο browser
        setTimeout(() => {
            window.open(`mailto:${emailTo}?subject=${subject}&body=${body}`, '_blank');
        }, index * 800);
    });
    
    closeFullSummary();
}

// Εκκίνηση: Πρώτα έλεγχος αδείας, μετά η εφαρμογή
checkLicense();
