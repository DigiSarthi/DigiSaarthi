/* =========================================================
   Digi Saarthi — Admin Panel (Connected to Supabase)
   ========================================================= */

const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin'
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

const AUTH_KEY = 'digisaarthi_admin_auth';

/* ============================= SUPABASE CONFIG ============================= */
const SUPABASE_URL = 'https://rimoociqkkcmhisdijsd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbW9vY2lxa2NjbWhpc2RpanNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NzczODgsImV4cCI6MjEwNDE1MzM4OH0.gO0Gglk-oqsSW47mBW_8eGiAmonvLoKyhIhwA8hv_XA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================= DATA LAYER ============================= */
async function loadRecords() {
    try {
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('service_number', { ascending: false });

        if (error) throw error;

        // Map Supabase snake_case columns to app's camelCase variables
        return (data || []).map(r => ({
            serviceNumber: r.service_number,
            customerName: r.customer_name,
            serviceType: r.service_type,
            applicationDate: r.application_date,
            paymentStatus: r.payment_status,
            serviceStatus: r.service_status,
            completionDate: r.completion_date,
            rejectionReason: r.rejection_reason || '',
            receiptUrl: r.receipt_url || '',
            certificateUrl: r.certificate_url || ''
        }));
    } catch (err) {
        console.error('Error fetching records:', err);
        return [];
    }
}

async function persistRecord(record) {
    const payload = {
        service_number: record.serviceNumber,
        customer_name: record.customerName,
        service_type: record.serviceType,
        application_date: record.applicationDate,
        payment_status: record.paymentStatus,
        service_status: record.serviceStatus,
        completion_date: record.completionDate,
        rejection_reason: record.rejectionReason,
        receipt_url: record.receiptUrl,
        certificate_url: record.certificateUrl
    };

    const { error } = await supabase
        .from('services')
        .upsert(payload, { onConflict: 'service_number' });

    if (error) throw error;
}

async function removeRecordFromDB(serviceNumber) {
    const { error } = await supabase
        .from('services')
        .delete()
        .eq('service_number', serviceNumber);

    if (error) throw error;
}
/* ======================================================================= */

let RECORDS = [];
let EDITING_SERVICE_NUMBER = null;

/* ---------- Auth ---------- */
function isLoggedIn() { return sessionStorage.getItem(AUTH_KEY) === 'true'; }

function handleLogin(e) {
    e.preventDefault();

    const u = document.getElementById('adminUsername').value.trim();
    const p = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('adminLoginError');

    if (u === ADMIN_CREDENTIALS.username && p === ADMIN_CREDENTIALS.password) {
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
    document.getElementById('formServiceNumber').readOnly = true;
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

async function handleServiceFormSubmit(e) {
    e.preventDefault();
    const serviceNumber = document.getElementById('formServiceNumber').value.trim().toUpperCase();
    const errorEl = document.getElementById('formError');
    const submitBtn = document.getElementById('submitServiceBtn');
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

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving to Database...';

    try {
        await persistRecord(record);
        RECORDS = await loadRecords();
        closeModal('serviceFormModal');
        renderAll();
    } catch (err) {
        errorEl.textContent = 'Error saving to database: ' + (err.message || err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Service';
    }
}

async function deleteRecord(serviceNumber) {
    if (!confirm(`Permanently delete service ${serviceNumber}? This cannot be undone.`)) return;
    try {
        await removeRecordFromDB(serviceNumber);
        RECORDS = RECORDS.filter(r => r.serviceNumber !== serviceNumber);
        renderAll();
    } catch (err) {
        alert('Could not delete record: ' + (err.message || err));
    }
}

/* ---------- Modal helpers ---------- */
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