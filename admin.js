/* =========================================================
   Digi Saarthi — Admin Panel
   =========================================================
   HOW THIS WORKS (read this before editing):

   - There is no backend. Records live in the browser's
     localStorage, seeded once from services.json.
   - Editing here does NOT change the live customer-facing
     site by itself. You must click "Export services.json"
     and commit that file to your GitHub repo for changes
     to actually go live.
   - The login below is NOT real security — it only hides the
     panel from casual visitors. Anyone who reads the page
     source can see the credentials. Do not rely on this for
     protecting sensitive data.
   - When you're ready for a real multi-device system, replace
     the functions in the "DATA LAYER" section with calls to
     a real backend (Firebase/Supabase/etc). The UI code below
     does not need to change.
   ========================================================= */

/* ---------- Change this before publishing ---------- */
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'digisaarthi2026'
};

const SERVICE_TYPES = [
    'Caste Certificate',
    'Residence Certificate',
    'Income Certificate',
    'Ration Card',
    'e-District Service',
    'Online Application',
    'Printing',
    'Scanning',
    'Other'
];

const STORAGE_KEY = 'digisaarthi_admin_records';
const AUTH_KEY = 'digisaarthi_admin_auth';

/* ============================= DATA LAYER =============================
   Swap these three functions later to talk to a real backend instead
   of localStorage. Everything else in this file only calls these.
   ======================================================================= */
async function loadRecords() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) return JSON.parse(cached);
    const res = await fetch('services.json', { cache: 'no-store' });
    const data = await res.json();
    const records = data.records || [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return records;
}

function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function exportRecords(records) {
    const payload = {
        _readme: "Each object is one service record. Add new records to the 'records' array below. Never commit Aadhaar numbers, bank details, OTPs or passwords into this file — only the fields listed here.",
        records
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'services.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
/* ======================================================================= */

let RECORDS = [];
let EDITING_SERVICE_NUMBER = null; // null = adding new

/* ---------- Auth ---------- */
function isLoggedIn() { return sessionStorage.getItem(AUTH_KEY) === 'true'; }

function handleLogin(e) {
    e.preventDefault();

    const u = document.getElementById('adminUsername').value.trim();
    const p = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('adminLoginError');

    if (u === 'admin' && p === 'admin') {
        sessionStorage.setItem(AUTH_KEY, 'true');
        showDashboard();
    } else {
        errorEl.textContent = 'Incorrect username or password.';
        errorEl.classList.add('show');
    }
}

function handleLogout() {
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
}

async function showDashboard() {
    document.getElementById('adminLoginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    RECORDS = await loadRecords();
    renderAll();
}

/* ---------- Next service number ---------- */
function suggestNextServiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `DS-${year}-`;
    let max = 0;
    RECORDS.forEach(r => {
        if (r.serviceNumber && r.serviceNumber.startsWith(prefix)) {
            const n = parseInt(r.serviceNumber.slice(prefix.length), 10);
            if (!isNaN(n) && n > max) max = n;
        }
    });
    return prefix + String(max + 1).padStart(5, '0');
}

/* ---------- Rendering: stats ---------- */
function renderStats() {
    const counts = { Pending: 0, Processing: 0, Completed: 0, Rejected: 0 };
    RECORDS.forEach(r => { if (counts[r.serviceStatus] !== undefined) counts[r.serviceStatus]++; });
    document.getElementById('statTotal').textContent = RECORDS.length;
    document.getElementById('statPending').textContent = counts.Pending;
    document.getElementById('statProcessing').textContent = counts.Processing;
    document.getElementById('statCompleted').textContent = counts.Completed;
    document.getElementById('statRejected').textContent = counts.Rejected;
}

/* ---------- Rendering: table ---------- */
function getFilteredRecords() {
    const q = document.getElementById('filterSearch').value.trim().toLowerCase();
    const type = document.getElementById('filterType').value;
    const status = document.getElementById('filterStatus').value;
    const payment = document.getElementById('filterPayment').value;

    return RECORDS.filter(r => {
        const matchesQ = !q || r.serviceNumber.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q);
        const matchesType = !type || r.serviceType === type;
        const matchesStatus = !status || r.serviceStatus === status;
        const matchesPayment = !payment || r.paymentStatus === payment;
        return matchesQ && matchesType && matchesStatus && matchesPayment;
    });
}

function renderTable() {
    const tbody = document.getElementById('adminTableBody');
    const rows = getFilteredRecords();

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="admin-empty">No services match this search/filter.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => `
        <tr>
            <td>${r.serviceNumber}</td>
            <td>${r.customerName}</td>
            <td>${r.serviceType}</td>
            <td><span class="status-badge ${statusClass(r.paymentStatus)}">${r.paymentStatus}</span></td>
            <td><span class="status-badge ${statusClass(r.serviceStatus)}">${r.serviceStatus}</span></td>
            <td>${r.applicationDate || '—'}</td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-outline btn-sm" onclick="openViewModal('${r.serviceNumber}')">View</button>
                    <button class="btn btn-outline-primary btn-sm" onclick="openEditModal('${r.serviceNumber}')">Edit</button>
                    <button class="btn btn-outline btn-sm" style="color:#A63A2C; border-color:#E3B4AC;" onclick="deleteRecord('${r.serviceNumber}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function statusClass(value) {
    const map = {
        Pending: 'status-pending', Processing: 'status-processing',
        Completed: 'status-completed', Rejected: 'status-rejected',
        Paid: 'status-completed', Unpaid: 'status-rejected', Partial: 'status-pending'
    };
    return map[value] || 'status-pending';
}

function renderAll() {
    renderStats();
    renderTable();
    populateTypeFilter();
}

function populateTypeFilter() {
    const select = document.getElementById('filterType');
    if (select.dataset.populated) return;
    SERVICE_TYPES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        select.appendChild(opt);
    });
    select.dataset.populated = 'true';
}

/* ---------- Add / Edit modal ---------- */
function openAddModal() {
    EDITING_SERVICE_NUMBER = null;
    document.getElementById('formModalTitle').textContent = 'Add New Service';
    resetForm();
    document.getElementById('formServiceNumber').value = suggestNextServiceNumber();
    document.getElementById('formServiceNumber').readOnly = false;
    openModal('serviceFormModal');
}

function openEditModal(serviceNumber) {
    const record = RECORDS.find(r => r.serviceNumber === serviceNumber);
    if (!record) return;
    EDITING_SERVICE_NUMBER = serviceNumber;
    document.getElementById('formModalTitle').textContent = 'Edit Service';
    resetForm();
    document.getElementById('formServiceNumber').value = record.serviceNumber;
    document.getElementById('formServiceNumber').readOnly = true; // service number should not change once issued
    document.getElementById('formCustomerName').value = record.customerName || '';
    document.getElementById('formServiceType').value = record.serviceType || '';
    document.getElementById('formApplicationDate').value = record.applicationDate || '';
    document.getElementById('formPaymentStatus').value = record.paymentStatus || 'Unpaid';
    document.getElementById('formServiceStatus').value = record.serviceStatus || 'Pending';
    document.getElementById('formCompletionDate').value = record.completionDate || '';
    document.getElementById('formRejectionReason').value = record.rejectionReason || '';
    document.getElementById('formReceiptUrl').value = record.receiptUrl || '';
    document.getElementById('formCertificateUrl').value = record.certificateUrl || '';
    openModal('serviceFormModal');
}

function resetForm() {
    document.getElementById('serviceForm').reset();
    document.getElementById('formError').textContent = '';
}

function openViewModal(serviceNumber) {
    const r = RECORDS.find(x => x.serviceNumber === serviceNumber);
    if (!r) return;
    document.getElementById('viewModalBody').innerHTML = `
        <dl class="admin-view-grid">
            <div><dt>Service Number</dt><dd>${r.serviceNumber}</dd></div>
            <div><dt>Customer Name</dt><dd>${r.customerName}</dd></div>
            <div><dt>Service Type</dt><dd>${r.serviceType}</dd></div>
            <div><dt>Application Date</dt><dd>${r.applicationDate || '—'}</dd></div>
            <div><dt>Payment Status</dt><dd>${r.paymentStatus}</dd></div>
            <div><dt>Service Status</dt><dd>${r.serviceStatus}</dd></div>
            <div><dt>Completion Date</dt><dd>${r.completionDate || '—'}</dd></div>
            <div><dt>Rejection Reason</dt><dd>${r.rejectionReason || '—'}</dd></div>
        </dl>
        <div class="admin-form-actions">
            ${r.receiptUrl ? `<a href="${r.receiptUrl}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-sm">View Receipt</a>` : ''}
            ${r.certificateUrl ? `<a href="${r.certificateUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">View Certificate</a>` : ''}
        </div>
    `;
    openModal('viewServiceModal');
}

function handleServiceFormSubmit(e) {
    e.preventDefault();
    const serviceNumber = document.getElementById('formServiceNumber').value.trim().toUpperCase();
    const errorEl = document.getElementById('formError');
    errorEl.textContent = '';

    if (!/^DS-\d{4}-\d{5}$/.test(serviceNumber)) {
        errorEl.textContent = 'Service Number must look like DS-2026-00001.';
        return;
    }

    const isDuplicate = RECORDS.some(r => r.serviceNumber === serviceNumber && serviceNumber !== EDITING_SERVICE_NUMBER);
    if (isDuplicate) {
        errorEl.textContent = 'This Service Number already exists. Each one must be unique.';
        return;
    }

    const record = {
        serviceNumber,
        customerName: document.getElementById('formCustomerName').value.trim(),
        serviceType: document.getElementById('formServiceType').value,
        applicationDate: document.getElementById('formApplicationDate').value,
        paymentStatus: document.getElementById('formPaymentStatus').value,
        serviceStatus: document.getElementById('formServiceStatus').value,
        completionDate: document.getElementById('formCompletionDate').value,
        rejectionReason: document.getElementById('formRejectionReason').value.trim(),
        receiptUrl: document.getElementById('formReceiptUrl').value.trim(),
        certificateUrl: document.getElementById('formCertificateUrl').value.trim()
    };

    if (EDITING_SERVICE_NUMBER) {
        const idx = RECORDS.findIndex(r => r.serviceNumber === EDITING_SERVICE_NUMBER);
        RECORDS[idx] = record;
    } else {
        RECORDS.push(record);
    }

    saveRecords(RECORDS);
    closeModal('serviceFormModal');
    renderAll();
}

function deleteRecord(serviceNumber) {
    if (!confirm(`Delete service ${serviceNumber}? This cannot be undone here (though it stays in services.json on GitHub until you re-export).`)) return;
    RECORDS = RECORDS.filter(r => r.serviceNumber !== serviceNumber);
    saveRecords(RECORDS);
    renderAll();
}

/* ---------- Modal helpers (shared pattern with rest of site) ---------- */
function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = 'auto';
}

/* ---------- Wire up ---------- */
document.addEventListener('DOMContentLoaded', () => {
    if (isLoggedIn()) showDashboard();

    document.getElementById('adminLoginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('addServiceBtn').addEventListener('click', openAddModal);
    document.getElementById('serviceForm').addEventListener('submit', handleServiceFormSubmit);
    document.getElementById('exportBtn').addEventListener('click', () => exportRecords(RECORDS));

    ['filterSearch', 'filterType', 'filterStatus', 'filterPayment'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderTable);
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });
});
