/* =========================================================
   Digi Saarthi — Admin Panel (Auto Drive Upload Integrated)
   ========================================================= */

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

/* ============================= DATA LAYER ============================= */
function fromDb(row) {
    return {
        serviceNumber: row.service_number,
        customerName: row.customer_name,
        mobileNumber: row.mobile_number || '',
        serviceType: row.service_type,
        applicationDate: row.application_date || '',
        paymentStatus: row.payment_status,
        serviceStatus: row.service_status,
        completionDate: row.completion_date || '',
        rejectionReason: row.rejection_reason || '',
        receiptUrl: row.receipt_url || '',
        certificateUrl: row.certificate_url || ''
    };
}

function toDb(record) {
    return {
        service_number: record.serviceNumber,
        customer_name: record.customerName,
        mobile_number: record.mobileNumber || null,
        service_type: record.serviceType,
        application_date: record.applicationDate || null,
        payment_status: record.paymentStatus,
        service_status: record.serviceStatus,
        completion_date: record.completionDate || null,
        rejection_reason: record.rejectionReason || null,
        receipt_url: record.receiptUrl || null,
        certificate_url: record.certificateUrl || null
    };
}

async function loadRecords() {
    const { data, error } = await supabaseClient
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) {
        alert('Could not load services: ' + error.message);
        return [];
    }
    return data.map(fromDb);
}

async function upsertRecord(record) {
    const { error } = await supabaseClient
        .from('services')
        .upsert(toDb(record), { onConflict: 'service_number' });
    if (error) throw error;
}

async function deleteRecordRemote(serviceNumber) {
    const { error } = await supabaseClient
        .from('services')
        .delete()
        .eq('service_number', serviceNumber);
    if (error) throw error;
}
/* ======================================================================= */

let RECORDS = [];
let EDITING_SERVICE_NUMBER = null;

function normalizeMobile(raw) {
    const digits = (raw || '').replace(/\D/g, '');
    return digits.slice(-10);
}

function isValidIndianMobile(number) {
    return /^[6-9]\d{9}$/.test(number);
}

/* ---------- WhatsApp notification ---------- */
/* ---------- WhatsApp notification ---------- */
const WHATSAPP_TEMPLATES = {
    Completed: (r) =>
`Dear ${r.customerName},

Your service for ${r.serviceType} has been successfully completed! 🎉

Your Service Number is:
*${r.serviceNumber}*

Track your application and download documents here:
https://digisarthi.github.io/DigiSaarthi/track.html

(Simply tap and copy the Service Number above, then paste it on the tracking page)

Thank you for choosing DigiSaarthi. 🙏`
};
const NOTIFY_ON_STATUSES = ['Completed'];

function openWhatsAppNotifyModal(record) {
    const template = WHATSAPP_TEMPLATES[record.serviceStatus];
    if (!template) return;

    const message = template(record);
    const mobile = normalizeMobile(record.mobileNumber);
    const mobileValid = isValidIndianMobile(mobile);

    document.getElementById('waNotifyName').textContent = record.customerName;
    document.getElementById('waNotifyService').textContent = record.serviceType;
    document.getElementById('waNotifyServiceNumber').textContent = record.serviceNumber;
    document.getElementById('waNotifyMobile').textContent = mobileValid ? mobile : (record.mobileNumber || '—');
    document.getElementById('waNotifyMessage').value = message;

    const sendBtn = document.getElementById('waSendBtn');
    const hint = document.getElementById('waNotifyHint');

    if (mobileValid) {
        sendBtn.disabled = false;
        hint.textContent = '';
        sendBtn.onclick = () => {
            const waLink = `https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`;
            window.open(waLink, '_blank');
        };
    } else {
        sendBtn.disabled = true;
        hint.textContent = 'Add a valid 10-digit mobile number to this service to enable WhatsApp sending.';
        sendBtn.onclick = null;
    }

    document.getElementById('waCopyBtn').onclick = () => {
        navigator.clipboard.writeText(message)
            .then(() => alert('Message copied!'))
            .catch(() => alert('Could not copy — please select and copy the text manually.'));
    };

    openModal('whatsappNotifyModal');
}

/* ---------- Auth ---------- */
async function isLoggedIn() {
    const { data } = await supabaseClient.auth.getSession();
    return !!data.session;
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('adminLoginError');
    errorEl.classList.remove('show');

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        errorEl.textContent = 'Incorrect email or password.';
        errorEl.classList.add('show');
        return;
    }
    showDashboard();
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

async function showDashboard() {
    document.getElementById('adminLoginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    RECORDS = await loadRecords();
    renderAll();
}

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

function renderStats() {
    const counts = { Pending: 0, Processing: 0, Completed: 0, Rejected: 0 };
    RECORDS.forEach(r => { if (counts[r.serviceStatus] !== undefined) counts[r.serviceStatus]++; });
    document.getElementById('statTotal').textContent = RECORDS.length;
    document.getElementById('statPending').textContent = counts.Pending;
    document.getElementById('statProcessing').textContent = counts.Processing;
    document.getElementById('statCompleted').textContent = counts.Completed;
    document.getElementById('statRejected').textContent = counts.Rejected;
}

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

/* ---------- Google Drive Auto-Upload Helpers ---------- */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.includes(',') 
                ? reader.result.split(',')[1] 
                : reader.result;
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function uploadToDrive(file, serviceNumber, docType) {
    if (typeof GDRIVE_UPLOAD_URL === 'undefined' || !GDRIVE_UPLOAD_URL || GDRIVE_UPLOAD_URL.includes('PASTE_YOUR_')) {
        throw new Error('config.js me GDRIVE_UPLOAD_URL sahi se set nahi hai.');
    }

    const base64Data = await fileToBase64(file);
    const fileName = `${serviceNumber}_${docType}.pdf`;

    const response = await fetch(GDRIVE_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            serviceNumber: serviceNumber,
            fileName: fileName,
            fileData: base64Data
        })
    });

    const result = await response.json();
    if (!result || !result.success) {
        throw new Error(result?.error || `${docType} upload fail ho gaya.`);
    }
    return result.url;
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
    document.getElementById('formMobileNumber').value = record.mobileNumber || '';
    document.getElementById('formServiceType').value = record.serviceType || '';
    document.getElementById('formApplicationDate').value = record.applicationDate || '';
    document.getElementById('formPaymentStatus').value = record.paymentStatus || 'Unpaid';
    document.getElementById('formServiceStatus').value = record.serviceStatus || 'Pending';
    document.getElementById('formCompletionDate').value = record.completionDate || '';
    document.getElementById('formRejectionReason').value = record.rejectionReason || '';
    document.getElementById('formReceiptUrl').value = record.receiptUrl || '';
    document.getElementById('formCertificateUrl').value = record.certificateUrl || '';

    if (record.receiptUrl) {
        document.getElementById('fileReceiptStatus').innerHTML = `Current: <a href="${record.receiptUrl}" target="_blank">View File</a> (choose new PDF to replace)`;
    }
    if (record.certificateUrl) {
        document.getElementById('fileCertificateStatus').innerHTML = `Current: <a href="${record.certificateUrl}" target="_blank">View File</a> (choose new PDF to replace)`;
    }

    openModal('serviceFormModal');
}

function resetForm() {
    document.getElementById('serviceForm').reset();
    document.getElementById('formError').textContent = '';
    const rStatus = document.getElementById('fileReceiptStatus');
    const cStatus = document.getElementById('fileCertificateStatus');
    const statusText = document.getElementById('uploadStatusText');
    if (rStatus) rStatus.textContent = '';
    if (cStatus) cStatus.textContent = '';
    if (statusText) statusText.style.display = 'none';
}

function openViewModal(serviceNumber) {
    const r = RECORDS.find(x => x.serviceNumber === serviceNumber);
    if (!r) return;
    document.getElementById('viewModalBody').innerHTML = `
        <dl class="admin-view-grid">
            <div><dt>Service Number</dt><dd>${r.serviceNumber}</dd></div>
            <div><dt>Customer Name</dt><dd>${r.customerName}</dd></div>
            <div><dt>Mobile Number</dt><dd>${r.mobileNumber || '—'}</dd></div>
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
    const statusText = document.getElementById('uploadStatusText');
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

    const mobileRaw = document.getElementById('formMobileNumber').value.trim();
    const mobileNormalized = normalizeMobile(mobileRaw);
    if (mobileRaw && !isValidIndianMobile(mobileNormalized)) {
        errorEl.textContent = 'Please enter a valid 10-digit Indian mobile number, or leave it blank.';
        return;
    }

    const previousRecord = EDITING_SERVICE_NUMBER ? RECORDS.find(r => r.serviceNumber === EDITING_SERVICE_NUMBER) : null;
    const previousStatus = previousRecord ? previousRecord.serviceStatus : null;

    const receiptFileInput = document.getElementById('fileReceipt');
    const certFileInput = document.getElementById('fileCertificate');
    const receiptFile = receiptFileInput ? receiptFileInput.files[0] : null;
    const certFile = certFileInput ? certFileInput.files[0] : null;

    if (receiptFile && receiptFile.type !== 'application/pdf') {
        errorEl.textContent = 'Receipt must be a valid PDF file.';
        return;
    }
    if (certFile && certFile.type !== 'application/pdf') {
        errorEl.textContent = 'Certificate must be a valid PDF file.';
        return;
    }

    const saveBtn = document.querySelector('#serviceForm button[type="submit"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Uploading files...';
    if (statusText) statusText.style.display = 'block';

    let receiptUrl = document.getElementById('formReceiptUrl').value.trim();
    let certificateUrl = document.getElementById('formCertificateUrl').value.trim();

    try {
        if (receiptFile) {
            if (statusText) statusText.textContent = '⏳ Uploading Receipt PDF to Google Drive...';
            receiptUrl = await uploadToDrive(receiptFile, serviceNumber, 'Receipt');
            document.getElementById('formReceiptUrl').value = receiptUrl;
            document.getElementById('fileReceiptStatus').innerHTML = `✓ Uploaded: <a href="${receiptUrl}" target="_blank">View File</a>`;
            receiptFileInput.value = '';
        }

        if (certFile) {
            if (statusText) statusText.textContent = '⏳ Uploading Certificate PDF to Google Drive...';
            certificateUrl = await uploadToDrive(certFile, serviceNumber, 'Certificate');
            document.getElementById('formCertificateUrl').value = certificateUrl;
            document.getElementById('fileCertificateStatus').innerHTML = `✓ Uploaded: <a href="${certificateUrl}" target="_blank">View File</a>`;
            certFileInput.value = '';
        }

        if (statusText) statusText.textContent = '💾 Saving to Supabase database...';

        const record = {
            serviceNumber,
            customerName: document.getElementById('formCustomerName').value.trim(),
            mobileNumber: mobileNormalized,
            serviceType: document.getElementById('formServiceType').value,
            applicationDate: document.getElementById('formApplicationDate').value,
            paymentStatus: document.getElementById('formPaymentStatus').value,
            serviceStatus: document.getElementById('formServiceStatus').value,
            completionDate: document.getElementById('formCompletionDate').value,
            rejectionReason: document.getElementById('formRejectionReason').value.trim(),
            receiptUrl: receiptUrl,
            certificateUrl: certificateUrl
        };

        const shouldNotify = NOTIFY_ON_STATUSES.includes(record.serviceStatus) && previousStatus !== record.serviceStatus;

        await upsertRecord(record);
        RECORDS = await loadRecords();
        closeModal('serviceFormModal');
        renderAll();

        if (shouldNotify) {
            openWhatsAppNotifyModal(record);
        }
    } catch (err) {
        errorEl.textContent = 'Upload or Save failed: ' + err.message + '. Any previously uploaded document URLs are preserved in the form.';
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Service';
        if (statusText) statusText.style.display = 'none';
    }
}

function deleteRecord(serviceNumber) {
    if (!confirm(`Delete service ${serviceNumber}? This permanently removes it from the database.`)) return;
    deleteRecordRemote(serviceNumber)
        .then(async () => {
            RECORDS = await loadRecords();
            renderAll();
        })
        .catch(err => alert('Could not delete: ' + err.message));
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = 'auto';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (await isLoggedIn()) showDashboard();

    document.getElementById('adminLoginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('addServiceBtn').addEventListener('click', openAddModal);
    document.getElementById('serviceForm').addEventListener('submit', handleServiceFormSubmit);

    const fileReceiptInput = document.getElementById('fileReceipt');
    if (fileReceiptInput) {
        fileReceiptInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) document.getElementById('fileReceiptStatus').textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        });
    }

    const fileCertificateInput = document.getElementById('fileCertificate');
    if (fileCertificateInput) {
        fileCertificateInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) document.getElementById('fileCertificateStatus').textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        });
    }

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