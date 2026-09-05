/* =========================================================
   Digi Saarthi — Service Tracking & Verification (Supabase)
   ========================================================= */

const SUPABASE_URL = 'https://rimoociqkkcmhisdijsd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbW9vY2lxa2NjbWhpc2RpanNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NzczODgsImV4cCI6MjEwNDE1MzM4OH0.gO0Gglk-oqsSW47mBW_8eGiAmonvLoKyhIhwA8hv_XA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchServiceRecord(serviceNumber) {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('service_number', serviceNumber)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
        serviceNumber: data.service_number,
        customerName: data.customer_name,
        serviceType: data.service_type,
        applicationDate: data.application_date,
        paymentStatus: data.payment_status,
        serviceStatus: data.service_status,
        completionDate: data.completion_date,
        rejectionReason: data.rejection_reason || '',
        receiptUrl: data.receipt_url || '',
        certificateUrl: data.certificate_url || ''
    };
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
    const enteredProcessing = ['Processing', 'Completed', 'Rejected'].includes(record.serviceStatus);
    const completed = record.serviceStatus === 'Completed';
    const rejected = record.serviceStatus === 'Rejected';

    const state = {
        received: 'done',
        payment: paid ? 'done' : 'pending',
        processing: enteredProcessing ? 'done' : 'pending',
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

async function runTrackSearch() {
    const input = document.getElementById('trackInput');
    const query = input.value.trim().toUpperCase();
    if (!query) { clearResult(); return; }

    renderLoading();
    try {
        const match = await fetchServiceRecord(query);
        if (match) renderResult(match);
        else renderNotFound();
    } catch (err) {
        console.error(err);
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