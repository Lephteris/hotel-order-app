/* =========================================================================
   Η λίστα των προϊόντων έρχεται πλέον ΑΥΤΟΜΑΤΑ από το Excel
   μέσω του αρχείου data.js. Επομένως δεν χρειάζεται να πειράξεις κάτι εδώ!
   ========================================================================= */

// Αν για κάποιο λόγο δεν υπάρχουν προϊόντα (π.χ. δεν έτρεξε η μακροεντολή)
if (typeof products === 'undefined' || products.length === 0) {
    alert("Δεν βρέθηκαν προϊόντα. Παρακαλώ τρέξτε τη μακροεντολή στο Excel για να δημιουργηθεί το αρχείο data.js.");
}

// Εξαγωγή μοναδικών προμηθευτών
const suppliers = [...new Set(products.map(p => p.supplier))];

// State (Κατάσταση Εφαρμογής)
let activeSupplier = suppliers.length > 0 ? suppliers[0] : ""; // Προεπιλογή ο 1ος προμηθευτής
let activeCategory = "Όλα";
let orderQuantities = {}; // Μορφή: { 1: 2, 5: 1 } (id: quantity)
let orderNotes = {};      // Μορφή: { 1: "Παγωμένα", 5: "Χωρίς ζάχαρη" }

// Οπτικά Στοιχεία (DOM Elements)
const supplierSelect = document.getElementById("supplier-select");
const categorySlicer = document.getElementById("category-slicer");
const productList = document.getElementById("product-list");
const btnCart = document.getElementById("btn-cart");
const cartCount = document.getElementById("cart-count");
const cartModal = document.getElementById("cart-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const cartItemsContainer = document.getElementById("cart-items");
const btnSendEmail = document.getElementById("btn-send-email");
const btnReset = document.getElementById("btn-reset");
const btnPrintOrder = document.getElementById("btn-print-order");

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
    
    // Event Listeners
    btnCart.addEventListener("click", openCart);
    btnCloseModal.addEventListener("click", closeCart);
    btnSendEmail.addEventListener("click", sendEmail);
    btnReset.addEventListener("click", resetOrder);
    btnPrintOrder.addEventListener("click", () => window.print());
    
    // Κλείσιμο modal αν κάνεις κλικ έξω από αυτό
    cartModal.addEventListener("click", (e) => {
        if (e.target === cartModal) closeCart();
    });
}

// Render Suppliers
function renderSuppliers() {
    supplierSelect.innerHTML = "";
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
    
    // Βρίσκουμε τις κατηγορίες μόνο για τον ενεργό προμηθευτή
    const supplierProducts = products.filter(p => p.supplier === activeSupplier);
    const categories = ["Όλα", ...new Set(supplierProducts.map(p => p.category))];
    
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
    
    // Φιλτράρισμα ανά Προμηθευτή
    let filteredProducts = products.filter(p => p.supplier === activeSupplier);
    
    // Φιλτράρισμα ανά Κατηγορία (αν δεν είναι "Όλα")
    if (activeCategory !== "Όλα") {
        filteredProducts = filteredProducts.filter(p => p.category === activeCategory);
    }
        
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
                    <span class="product-category">${product.category}</span>
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
        closeCart(); // Κλείσε το καλάθι αν μηδενιστούν τα πάντα για τον προμηθευτή
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
    }
}

// Send Email
function sendEmail() {
    // Βρίσκουμε το email του τρέχοντος προμηθευτή από το πρώτο του προϊόν
    const supplierProduct = products.find(p => p.supplier === activeSupplier);
    const emailTo = supplierProduct ? supplierProduct.supplierEmail : "";
    
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

// Εκκίνηση της εφαρμογής
init();
