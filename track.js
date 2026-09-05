/* =========================================================
   Digi Saarthi — Service Tracking & Verification
   =========================================================
   Records live in Supabase now. This page never lists the full
   table — it calls the get_service() database function (see
   setup SQL), which returns at most one matching record. That
   function is what actually enforces "customers can't browse
   everyone's data," not anything in this file.
   See config.js for the Supabase URL/key this file uses.
   ========================================================= */

function fromDbTrack(row) {
    return {
        serviceNumber: row.service_number,
        customerName: row.customer_name,
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

async function findServiceByNumber(serviceNumber) {
    const { data, error } = await supabaseClient.rpc('get_service', { p_service_number: serviceNumber });
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return fromDbTrack(data[0]);
}

function formatDate(isoDate) {
    if (!isoDate) return '—';
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d)) return isoDate;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

const STATUS_META = {
    Pending:    { label: 'Pending',    className: 'status-pending',    icon: '⏳' },
    Processing: { label: 'Processing', className: 'status-processing', icon: '⚙️' },
    Completed:  { label: 'Completed',  className: 'status-completed',  icon: '✓' },
    Rejected:   { label: 'Rejected',   className: 'status-rejected',   icon: '✕' },
    Paid:       { label: 'Paid',       className: 'status-completed',  icon: '✓' },
    Unpaid:     { label: 'Unpaid',     className: 'status-rejected',   icon: '✕' },
    Partial:    { label: 'Partial',    className: 'status-pending',    icon: '½' }
};

function statusBadge(statusValue) {
    const meta = STATUS_META[statusValue] || { label: statusValue, className: 'status-pending', icon: '•' };
    return `<span class="status-badge ${meta.className}">${meta.icon} ${meta.label}</span>`;
}

function buildTimeline(record) {
    const steps = [
        { key: 'received', label: 'Application Received' },
        { key: 'payment', label: 'Payment Confirmed' },
        { key: 'processing', label: 'Application Processing' },
        { key: 'final', label: record.serviceStatus === 'Rejected' ? 'Application Rejected' : 'Service Completed' }
    ];

    const paid = record.paymentStatus === 'Paid';
    const entredProcessing = ['Processing', 'Completed', 'Rejected'].includes(record.serviceStatus);
    const completed = record.serviceStatus === 'Completed';
    const rejected = record.serviceStatus === 'Rejected';

    const state = {
        received: 'done',
        payment: paid ? 'done' : 'pending',
        processing: entredProcessing ? 'done' : 'pending',
        final: completed ? 'done' : (rejected ? 'rejected' : 'pending')
    };

    return steps.map(step => {
        const s = state[step.key];
        const icon = s === 'done' ? '✓' : (s === 'rejected' ? '✕' : '○');
        const cls = s === 'done' ? 'done' : (s === 'rejected' ? 'rejected' : 'pending');
        return `
            <li class="timeline-step ${cls}">
                <span class="timeline-icon">${icon}</span>
                <span class="timeline-label">${step.label}</span>
            </li>`;
    }).join('');
}

function buildDocumentButtons(record) {
    let html = '';
    if (record.receiptUrl) {
        html += `<a href="${record.receiptUrl}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-sm">📄 View Receipt</a>`;
    }
    if (record.certificateUrl) {
        html += `<a href="${record.certificateUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">📄 View / Download Certificate</a>`;
    }
    return html;
}

function renderResult(record) {
    const panel = document.getElementById('trackResultPanel');
    const rejectionBlock = record.serviceStatus === 'Rejected' && record.rejectionReason
        ? `<div class="track-reject-note"><strong>Reason:</strong> ${record.rejectionReason}</div>`
        : '';

    const docButtons = buildDocumentButtons(record);
    const docSection = docButtons
        ? `<div class="track-doc-actions">${docButtons}</div>`
        : `<p class="track-doc-empty">Documents will appear here once available.</p>`;

    panel.innerHTML = `
        <div class="track-card">
            <div class="track-card-header">
                <div>
                    <span class="track-field-label">Service Number</span>
                    <span class="track-service-number">${record.serviceNumber}</span>
                </div>
                ${statusBadge(record.serviceStatus)}
            </div>

            <div class="track-grid">
                <div class="track-field">
                    <span class="track-field-label">Customer Name</span>
                    <span class="track-field-value">${record.customerName}</span>
                </div>
                <div class="track-field">
                    <span class="track-field-label">Service</span>
                    <span class="track-field-value">${record.serviceType}</span>
                </div>
                <div class="track-field">
                    <span class="track-field-label">Application Date</span>
                    <span class="track-field-value">${formatDate(record.applicationDate)}</span>
                </div>
                <div class="track-field">
                    <span class="track-field-label">Payment Status</span>
                    <span class="track-field-value">${statusBadge(record.paymentStatus)}</span>
                </div>
            </div>

            ${rejectionBlock}

            <h4 class="track-timeline-title">Service Timeline</h4>
            <ul class="timeline">${buildTimeline(record)}</ul>

            ${docSection}
        </div>
    `;
    panel.classList.add('visible');
}

function renderNotFound() {
    const panel = document.getElementById('trackResultPanel');
    panel.innerHTML = `
        <div class="track-state track-state-empty">
            <div class="track-state-icon">🔍</div>
            <h4>Service Not Found</h4>
            <p>Please check your Service Number and try again.</p>
        </div>`;
    panel.classList.add('visible');
}

function renderError() {
    const panel = document.getElementById('trackResultPanel');
    panel.innerHTML = `
        <div class="track-state track-state-error">
            <div class="track-state-icon">⚠️</div>
            <h4>Something went wrong</h4>
            <p>We couldn't load service records right now. Please try again in a moment, or message us on WhatsApp.</p>
        </div>`;
    panel.classList.add('visible');
}

function renderLoading() {
    const panel = document.getElementById('trackResultPanel');
    panel.innerHTML = `
        <div class="track-state track-state-loading">
            <span class="track-spinner"></span>
            <p>Searching your service record…</p>
        </div>`;
    panel.classList.add('visible');
}

function clearResult() {
    const panel = document.getElementById('trackResultPanel');
    panel.innerHTML = '';
    panel.classList.remove('visible');
}

// Normalizer: cleans user input and builds full DS-YYYY-XXXXX for database
function getCleanFullServiceNumber(rawVal) {
    let val = (rawVal || '').trim().toUpperCase();
    if (!val) return '';

    // Remove user-entered DS prefix if already pasted
    if (val.startsWith('DS-')) {
        val = val.substring(3);
    } else if (val.startsWith('DS_')) {
        val = val.substring(3);
    } else if (val.startsWith('DS')) {
        val = val.substring(2);
    }

    // Convert continuous digits like 202600125 -> 2026-00125
    if (/^\d{9}$/.test(val)) {
        val = `${val.slice(0, 4)}-${val.slice(4)}`;
    }

    // Update input box to display clean number without duplicate DS-
    const input = document.getElementById('trackInput');
    if (input) input.value = val;

    return 'DS-' + val;
}

async function runTrackSearch() {
    const input = document.getElementById('trackInput');
    if (!input) return;

    const fullServiceNumber = getCleanFullServiceNumber(input.value);
    if (!input.value.trim()) {
        clearResult();
        return;
    }

    renderLoading();
    try {
        const match = await findServiceByNumber(fullServiceNumber);
        if (match) renderResult(match);
        else renderNotFound();
    } catch (err) {
        renderError();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('trackForm');
    const input = document.getElementById('trackInput');
    const clearBtn = document.getElementById('trackClearBtn');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        runTrackSearch();
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearResult();
        input.focus();
    });
});