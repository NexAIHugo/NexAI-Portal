// js/pages/invoices.js
window.Pages = window.Pages || {};
window.Pages.invoices = {
  previewData: null,
  rawText: "",
  isProcessing: false,
  isRecording: false,
  isSuccess: false,
  isRejected: false,
  rejectedFileName: '',
  deletingId: null,
  activeModalId: null,
  editingId: null,
  uploadedFileUrl: null,
  searchQuery: '',
  isSelectingFile: false,
  uploadQueue: [],
  lastUploadedBlob: null,

  init: function() {
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }
  },

  render: function() {
    this.init();

    if (this.isRejected) {
      return `
        <div class="recording-overlay">
          <div class="recording-card" style="max-width: 500px;">
            <div style="font-size: 4rem; margin-bottom: 15px;">🚫</div>
            <h2 style="font-size: 1.8rem; margin-bottom: 10px; color: #ff4d4d;">Invoice Rejected</h2>
            <p style="color: rgba(255,255,255,0.8); margin-bottom: 8px; font-size: 1.05rem;">This PDF is not a valid <b>NexAI Infinity</b> invoice.</p>
            <p style="color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-bottom: 25px;">File: ${this.rejectedFileName}</p>
            <button id="btn-reject-dismiss" class="btn-primary" style="padding: 12px 40px; border-radius: 10px; cursor: pointer; font-weight: 700;">Dismiss</button>
          </div>
        </div>
        ${this.renderMainView()}
      `;
    }

    if (this.isRecording) {
      return `
        <div class="recording-overlay">
          <div class="recording-card">
            <div class="spinner-orange"></div>
            <h2 style="font-size: 2rem; margin-bottom: 10px;">Recording to Invoice Hub...</h2>
            <p style="color: rgba(255,255,255,0.7);">Your document is being securely archived.</p>
          </div>
        </div>
        ${this.renderVerification(this.previewData)}
      `;
    }

    if (this.isSuccess) {
      return `
        <div class="recording-overlay">
          <div class="recording-card">
            <div class="success-icon-circle">✓</div>
            <h2 style="font-size: 2.2rem; margin-bottom: 10px;">Upload Completed</h2>
            <p style="color: rgba(255,255,255,0.7);">AI Scanning & Sync Complete. Bringing you back to Hub...</p>
          </div>
        </div>
        ${this.renderVerification(this.previewData)}
      `;
    }

    if (this.deletingId) {
      return `
        <div class="recording-overlay">
          <div class="recording-card" style="max-width: 450px;">
             <div style="font-size: 4rem; color: #ffbc00; margin-bottom: 20px;">⚠️</div>
             <h2 style="font-size: 1.8rem; margin-bottom: 15px;">Confirm Removal</h2>
             <p style="color: rgba(255,255,255,0.8); margin-bottom: 30px; font-size: 1.1rem; line-height:1.4;">Are you sure to remove this invoice record?</p>
             <div style="display:flex; justify-content:center; gap:15px;">
                <button id="btn-undo-delete" class="btn" style="padding: 12px 30px; border-radius:8px; border: 1px solid rgba(255,255,255,0.2); background:none; color:white; cursor:pointer;">Undo</button>
                <button id="btn-final-remove" class="btn" style="padding: 12px 40px; border-radius:8px; background: #ff4d4d; border:none; color:white; cursor:pointer; font-weight:700;">Remove</button>
             </div>
          </div>
        </div>
        ${this.renderMainView()}
      `;
    }

    if (this.isProcessing) return this.renderLoading();
    if (this.previewData) return this.renderVerification(this.previewData);

    return this.renderMainView();
  },

  renderMainView: function() {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/NexInvoice.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Invoice Dropbox</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Secured archival and AI-powered document mapping.</p>
          </div>
        </div>
      </div>

      ${this.renderUploadSection()}
      
      <!-- Scorecard Section -->
      <div id="invoice-scorecards-container">
        ${this.renderScorecards()}
      </div>

      ${this.renderHistoryList()}
      ${this.renderInvoiceModal()}
      ${this.renderEditModal()}
      ${this.renderFileSelectionModal()}
    `;
  },

  renderUploadSection: function() {
    return `
      <div class="card" style="text-align: center; padding: 2.5rem; border-style: dashed; border-width: 2px; margin-bottom: 2rem; border-color: var(--primary);">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">🔍</div>
        <h3>AI Scanning</h3>
        <p style="color:var(--text-muted); margin-bottom: 1.5rem;">Drop or Upload your PDF invoice here. AI will help you.</p>
        <input type="file" id="invoice-file-input" accept=".pdf" multiple style="display: none;">
        <button id="btn-upload-file" class="btn-primary" style="padding: 10px 26px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 1rem; border-radius: 10px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(242, 89, 0, 0.4), 0 0 20px rgba(242, 89, 0, 0.2);">
          Dump Here
          <img src="assets/upload.gif" style="width: 22px; height: 22px; object-fit: contain; filter: invert(1) brightness(2); mix-blend-mode: screen;" alt=""/>
        </button>
      </div>
    `;
  },

  renderScorecards: function() {
    const state = window.AppState || {};
    const invoices = state.invoices || [];
    
    // Calculate metrics
    const totalCount = invoices.length;
    const totalAmt = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalSales) || 0), 0);
    
    const now = new Date();
    const todayStr = String(now.getDate()).padStart(2,'0') + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + now.getFullYear();
    const todayCount = invoices.filter(inv => inv.loadedDate === todayStr).length;
    
    const deletedCount = state.deletedInvoicesCount || 0;

    const cards = [
      { label: 'Total Invoice', value: totalCount, icon: '📄', color: 'var(--primary)' },
      { label: 'Invoice Amt', value: `RM ${totalAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: '💰', color: '#10b981' },
      { label: 'Invoice (Today)', value: todayCount, icon: '📅', color: '#3b82f6' },
      { label: 'Total Delete', value: deletedCount, icon: '🗑️', color: '#ef4444' }
    ];

    return `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 2rem; width: 100%;">
        ${cards.map(card => `
          <div class="card" style="padding: 1.5rem; display: flex; align-items: center; gap: 15px; background: var(--bg-surface); border: 1px solid var(--border-color); position: relative; overflow: hidden; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="font-size: 2rem; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 10px;">${card.icon}</div>
            <div style="flex: 1;">
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${card.label}</div>
              <div style="font-size: 1.3rem; font-weight: 800; color: ${card.color};">${card.value}</div>
            </div>
            <div style="position: absolute; right: -5px; bottom: -10px; font-size: 4rem; opacity: 0.05; transform: rotate(-15deg); pointer-events: none;">${card.icon}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderHistoryList: function() {
    const state = window.AppState || { invoices: [], customers: [], products: [] };
    let invoicesData = [...(state.invoices || [])];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      invoicesData = invoicesData.filter(inv => {
        return (inv.id || "").toLowerCase().includes(q) || (inv.customerName || "").toLowerCase().includes(q);
      });
    }

    // Sort by latest loaded date first (dd/mm/yyyy format)
    invoicesData.sort((a,b) => {
      const parseLD = (d) => { if (!d) return 0; const p = d.split('/'); return new Date(+p[2], +p[1]-1, +p[0]).getTime(); };
      return parseLD(b.loadedDate) - parseLD(a.loadedDate);
    });

    return `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
           <h3 style="margin:0;">Invoice History</h3>
           <div style="display: flex; gap: 12px; align-items: center;">
             <button onclick="if(confirm('Wipe all invoice and inventory data?')) window.resetData()" class="btn" style="padding: 6px 14px; border-radius: 8px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); font-size: 0.8rem; font-weight: 700; transition: all 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'">
               🗑️ Reset All Data
             </button>
             <input type="text" id="invoice-search" placeholder="Search saved records..." value="${this.searchQuery}" 
                    style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-surface); color: var(--text-main); width: 250px;">
           </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background-color: var(--bg-main); font-size: 0.85rem; text-transform: uppercase;">
              <th style="padding: 12px; border-bottom: 1px solid var(--border-color);">No.</th>
              <th style="padding: 12px; border-bottom: 1px solid var(--border-color);">Loaded Date</th>
              <th style="padding: 12px; border-bottom: 1px solid var(--border-color);">Inv. Date</th>
              <th style="padding: 12px; border-bottom: 1px solid var(--border-color);">Client</th>
              <th style="padding: 12px; border-bottom: 1px solid var(--border-color);">Total Amt</th>
              <th style="padding: 12px; border-bottom: 1px solid var(--border-color); text-align: center;">Uploaded By</th>
              <th style="padding: 12px; border-bottom: 1px solid var(--border-color); text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${invoicesData.length > 0 ? invoicesData.map(inv => {
                return `
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 14px 12px; font-weight: 700;">${inv.id}</td>
                    <td style="padding: 14px 12px;">${inv.loadedDate || '—'}</td>
                    <td style="padding: 14px 12px;">${inv.date}</td>
                    <td style="padding: 14px 12px;">
                      <div style="display: inline-block; max-width: 100%; position: relative;">
                        <div style="font-weight: 600; line-height: 1.2; text-align: left;">${inv.customerName || 'Detected Client'}</div>
                        ${inv.picName 
                          ? `<div style="color:var(--primary); font-size:0.55rem; font-weight:800; position: absolute; top: 100%; left: 0; margin-top: 2px; white-space: nowrap;">👤 ${inv.picName}</div>` 
                          : `<div style="color:var(--text-muted); font-size:0.55rem; font-weight:800; position: absolute; top: 100%; left: 0; margin-top: 2px; white-space: nowrap; opacity:0.6;">No PIC Assigned</div>`}
                      </div>
                    </td>
                    <td style="padding: 14px 12px; color: var(--success); font-weight: 700;">RM ${inv.totalSales.toFixed(2)}</td>
                    <td style="padding: 14px 12px; text-align: center;">
                       <span style="font-size: 0.75rem; font-weight: 800; color: #fffb00; background: rgba(255,251,0,0.1); padding: 4px 10px; border-radius: 6px; border: 1px solid #fffb00; text-shadow: 0 0 5px rgba(255,251,0,0.3);">${inv.createdBy || 'System'}</span>
                    </td>
                    <td style="padding: 14px 12px; text-align: right; white-space: nowrap; width: 140px;">
                      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding-right: 4px;">
                        <button class="btn-delete-invoice-action inv-action-btn" data-id="${inv.id}" style="width: 34px; height: 34px; background: rgba(255,0,0,0.1); border: 1px solid #ff4d4d; color: #ff4d4d; cursor:pointer; border-radius:8px; font-size: 1.1rem; font-weight:bold; display: inline-flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0;" title="Remove Record">&times;</button>
                        <button class="btn-edit-invoice-action inv-action-btn" data-id="${inv.id}" style="width: 34px; height: 34px; background: rgba(0, 184, 255, 0.1); border: 1px solid #00b8ff; color: #00b8ff; cursor:pointer; border-radius:8px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0; overflow: hidden;" title="Edit Storage">
                          ${window.Utils.renderHoverGif('edit.gif', 20, '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>')}
                        </button>
                        <button class="btn-view-invoice-action inv-action-btn" data-id="${inv.id}" style="width: 34px; height: 34px; background: rgba(242, 122, 0, 0.1); border: 1px solid var(--primary); color: var(--primary); cursor:pointer; border-radius:8px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0; overflow: hidden;" title="View Data">
                          ${window.Utils.renderHoverGif('view.gif', 22, '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>')}
                        </button>
                      </div>
                      <style>
                        .inv-action-btn:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 10; }
                        .inv-action-btn:active { transform: translateY(0) scale(0.95); }
                      </style>
                    </td>
                  </tr>
                `;
            }).join('') : '<tr><td colspan="7" style="padding:40px; text-align:center; color:var(--text-muted);">No records mirrored yet. Click Import above.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  renderInvoiceModal: function() {
    return `
      <div id="invoice-modal" class="modal-overlay ${this.activeModalId ? 'active' : ''}">
        <div class="modal-container">
          <div class="modal-header"><h3>Secure Digital Bill</h3><button id="btn-close-invoice" style="background:none; border:none; font-size: 2rem; cursor:pointer; color:var(--text-main);">&times;</button></div>
          <div class="modal-body" style="background:#f4f7f9; padding:2rem;">
            ${this.activeModalId ? this.renderInvoicePDFMockup(this.activeModalId) : ''}
          </div>
        </div>
      </div>
    `;
  },

  renderEditModal: function() {
    const inv = (window.AppState.invoices || []).find(i => i.id === this.editingId);
    if (!inv) return '';

    return `
      <div class="modal-overlay active">
        <div class="modal-container" style="max-width: 600px;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
             <h3 style="margin:0;">Update Storage Location</h3>
             <div style="display:flex; gap:12px; align-items:center;">
                <!-- Undo Button (X Circle) -->
                <button onclick="window.Pages.invoices.editingId = null; window.Pages.invoices.triggerUpdate();" 
                        style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #ff4d4d; background: rgba(255,77,77,0.1); color: #ff4d4d; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; padding:0; line-height:1;" title="Undo">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <!-- Amend Button (Tick Circle) -->
                <button id="btn-direct-amend" 
                        style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--success); background: rgba(16,185,129,0.1); color: var(--success); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; padding:0; line-height:1;" title="Amend">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
             </div>
          </div>
          <div class="modal-body" style="padding: 24px;">
            <p style="color:var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">Correcting details for <b>${inv.id}</b></p>
            
            <div style="display:flex; gap:15px; margin-bottom: 24px;">
               <div style="flex:1;">
                  <label style="display:block; font-size: 0.85rem; color:var(--text-muted); margin-bottom: 6px; font-weight: 500;">Customer Name</label>
                  <input type="text" id="edit-inv-customer" value="${inv.customerName || ''}" style="width:100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); font-weight: 600; outline: none;" />
               </div>
               <div style="flex:1;">
                  <label style="display:block; font-size: 0.85rem; color:var(--text-muted); margin-bottom: 6px; font-weight: 500;">PIC Name</label>
                  <input type="text" id="edit-inv-pic" value="${inv.picName || ''}" style="width:100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); font-weight: 600; outline: none;" />
               </div>
            </div>

            <table style="width: 100%; border-collapse: collapse;">
               <thead>
                 <tr style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">
                   <th style="padding: 10px 0; text-align: left;">Product</th>
                   <th style="padding: 10px 0; text-align: right;">Location</th>
                 </tr>
               </thead>
               <tbody>
                 ${(inv.items || []).map((it, idx) => {
                   const prod = window.AppState.products.find(p => p.id === it.productId);
                   return `
                     <tr style="border-bottom: 1px solid var(--border-color);">
                       <td style="padding: 15px 0; font-weight: 700;">${prod ? prod.name : 'Hardware'}</td>
                       <td style="padding: 15px 0; text-align: right; position: relative;">
                         ${(prod && prod.type === 'Hardware') ? `
                           <div class="edit-area-trigger" data-idx="${idx}" 
                                style="display:inline-flex; align-items:center; gap:8px; border: 1.5px solid #00b8ff; color: #00b8ff; background: rgba(0,184,255,0.05); padding: 5px 12px; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 0.85rem;">
                              <span>📍</span> ${it.area || 'Hugo'} <span>▼</span>
                           </div>

                           ${this.openEditAreaIdx === idx ? `
                             <div class="custom-row-area-menu" style="position:absolute; top:calc(100% + 5px); right:0; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:12px; width:100px; z-index:5000; box-shadow:0 8px 20px rgba(0,0,0,0.5); padding:5px;">
                                ${['Hugo','YS','Tai','KT','JQ'].map(a => `
                                  <div class="edit-area-opt" data-idx="${idx}" data-val="${a}" style="padding:8px; cursor:pointer; border-radius:6px; font-size:0.8rem; font-weight:700; text-align:left; color:${it.area === a ? 'var(--primary)' : 'var(--text-main)'}; background:${it.area === a ? 'rgba(242,89,0,0.1)' : 'transparent'};">
                                     ${a}
                                  </div>
                                `).join('')}
                             </div>
                           ` : ''}
                         ` : '<span style="color:var(--text-muted); opacity:0.5;">—</span>'}
                       </td>
                     </tr>
                   `;
                 }).join('')}
               </tbody>
            </table>

            <!-- Bottom area removed as buttons moved to header -->
          </div>
        </div>
      </div>
    `;
  },

  renderFileSelectionModal: function() {
    if (!this.isSelectingFile) return '';
    const mockFiles = [
      { name: 'Invoice - IV-00118.pdf', icon: '📄', url: 'file:///C:/Users/leeho/OneDrive/Desktop/Invoice - IV-00118.pdf' },
      { name: 'Invoice - IV-00120.pdf', icon: '📄', url: 'file:///C:/Users/leeho/OneDrive/Desktop/Invoice - IV-00120.pdf' },
      { name: 'Invoice - IV-00027.pdf', icon: '📄', url: 'file:///C:/Users/leeho/OneDrive/Desktop/Invoice - IV-00027.pdf' },
      { name: '101.pdf', icon: '📄', url: 'file:///C:/Users/leeho/OneDrive/Desktop/101.pdf' },
      { name: 'Invoice - IV-00105.pdf', icon: '📄', url: 'file:///C:/Users/leeho/OneDrive/Desktop/Invoice - IV-00105.pdf' },
      { name: 'GM8949.pdf', icon: '📄', url: 'file:///C:/Users/leeho/OneDrive/Desktop/GM8949.pdf' }
    ];
    return `
      <div class="modal-overlay active">
        <div class="modal-container" style="max-width: 600px;">
          <div class="modal-header">
            <h3 style="margin:0;">Select PDF to Scan from Desktop</h3>
            <button id="btn-close-picker" style="background:none; border:none; font-size: 2rem; cursor:pointer;">&times;</button>
          </div>
          <div class="modal-body" style="padding: 24px;">
            <div class="file-selection-container">
              <div class="file-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
                ${mockFiles.map(file => `
                  <div class="file-item simulated-file" data-name="${file.name}" data-url="${file.url}">
                    <div class="file-icon" style="font-size: 2rem;">${file.icon}</div>
                    <div class="file-name" style="font-size: 0.8rem; word-break: break-all; margin-top: 10px;">${file.name}</div>
                  </div>
                `).join('')}
              </div>
              <button id="btn-browse-local" class="btn-show-all">Show all files</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderInvoicePDFMockup: function(invId) {
    const inv = (window.AppState.invoices || [])
      .sort((a,b) => (b.id || "").localeCompare(a.id || "", undefined, {numeric: true}))
      .find(i => i.id === invId);

    if (!inv) return `<div class="pdf-paper"><h3>Invoice not found in Hub.</h3></div>`;

    // Priority 1: Actual PDF File Link (if session is active)
    if (inv.fileUrl) {
      return `<iframe src="${inv.fileUrl}" style="width:100%; height:800px; border:none; border-radius:8px;"></iframe>`;
    }

    // Priority 2: High-Precision Digital Mirror (Fallback)
    return `
      <div class="pdf-paper" style="padding: 40px; background: white; color: #333; min-height: 500px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
        <div style="display:flex; justify-content:space-between; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px;">
           <div>
             <h1 style="margin:0; font-size: 2rem;">NexAI Archive</h1>
             <p style="color:#666;">Digital Mirror Copy</p>
           </div>
           <div style="text-align:right;">
             <h2 style="margin:0;">${inv.id}</h2>
             <p style="margin:0;">Date: ${inv.date}</p>
           </div>
        </div>

        <div style="margin-bottom: 30px;">
           <p style="font-size: 0.8rem; color: #999; margin:0;">CLIENT</p>
           <p style="font-size: 1.2rem; font-weight: 700; margin:0;">${inv.customerName}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
          <thead>
            <tr style="border-bottom: 2px solid #333; text-align: left; font-size: 0.8rem; color: #666;">
              <th style="padding: 10px 0;">DESCRIPTION</th>
              <th style="padding: 10px 0; text-align:center;">QTY</th>
              <th style="padding: 10px 0; text-align:center;">AREA</th>
              <th style="padding: 10px 0; text-align:right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${(inv.items || []).map(it => {
              const prod = window.AppState.products.find(p => p.id === it.productId);
              return `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; font-weight: 600;">${prod ? prod.name : 'Unknown Hardware'}</td>
                  <td style="padding: 12px 0; text-align:center;">${it.qty}</td>
                  <td style="padding: 12px 0; text-align:center;"><span style="background:#f0f4f8; padding:2px 8px; border-radius:4px; font-size:0.75rem;">${it.area || '—'}</span></td>
                  <td style="padding: 12px 0; text-align:right; font-weight: 700;">RM ${it.netAmt.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="text-align:right; border-top: 2px solid #333; padding-top: 20px;">
           <h2 style="margin:0;">TOTAL: RM ${inv.totalSales.toFixed(2)}</h2>
        </div>
      </div>
    `;
  },

  renderLoading: function() {
    return `<div style="padding:150px 0; text-align:center;"><div class="spinner" style="margin: 0 auto 20px;"></div><h2 style="color:var(--primary)">NexAI Intelligence...</h2><p>Mapping 6-column spatial metadata.</p></div>`;
  },

  renderVerification: function(data) {
    let subTotalSum = 0;
    return `
      <div class="card" style="max-width: 950px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h2 style="margin:0;">NexAI Verification</h2>
          <div style="background:rgba(0,180,255,0.1); color:#00b4ff; padding: 6px 14px; border-radius: 20px; font-weight: 700; border: 1px solid #00b4ff; font-size:0.8rem;">
            Spatial Alignment Active 📐
          </div>
        </div>
        
        <div style="display:flex; justify-content:space-between; gap:20px; margin-bottom: 40px; padding: 25px; background: var(--bg-main); border-radius: 12px; border: 1px solid var(--border-color);">
           <div style="flex:1;">
             <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">CUSTOMER MATCH</p>
             <p style="font-size: 1.2rem; font-weight: 700; color:var(--primary); margin-bottom: 0;">${data.customerName}</p>
             ${data.picName ? `<p style="font-size: 0.95rem; font-weight:600; color:var(--text-main); margin-top:4px; display:flex; align-items:center; gap:6px;"><span style="color:var(--primary); font-size:1.1rem;">👤</span> ${data.picName}</p>` : ''}
           </div>
           <div style="flex:1; text-align:right;">
             <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">INVOICE NO.</p>
             <p style="font-size: 1.2rem; font-weight: 800;">${data.invoiceNo}</p>
             <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 15px; margin-bottom: 4px;">DATE</p>
             <p style="font-size: 1.2rem; font-weight: 700;">${data.date}</p>
           </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 30px;">
          <thead>
            <tr style="color:var(--text-muted); font-size: 0.8rem; border-bottom: 2px solid var(--border-color);">
              <th style="padding:12px 0;">Description</th>
              <th style="padding:12px 0; text-align:center;">Area</th>
              <th style="text-align:center; padding:12px 0;">Qty</th>
              <th style="text-align:right; padding:12px 0;">Amt (Subtotal)</th>
              <th style="text-align:right; padding:12px 0;">Disc</th>
              <th style="text-align:right; padding:12px 0;">Net Amt</th>
            </tr>
          </thead>
          <tbody>
            ${(data.items || []).map((it, idx) => {
              subTotalSum += it.netAmt;
              const currentArea = it.area || 'Hugo';
              return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding:15px 0;">
                    <p style="font-weight: 600; margin:0;">${it.name}</p>
                  </td>
                  <td style="padding:15px 10px; text-align:center; position:relative;">
                    ${it.type === 'Hardware' ? `
                    <div class="custom-row-area-trigger" data-index="${idx}" 
                         style="display:inline-flex; align-items:center; gap:8px; background:rgba(242, 89, 0, 0.05); border: 1.5px solid var(--primary); padding:6px 12px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:800; color:var(--primary); transition:all 0.2s;">
                       <span>📍</span> ${currentArea} <span style="font-size:0.6rem; opacity:0.7;">▼</span>
                    </div>
                    
                    ${this.openAreaIdx === idx ? `
                    <div class="custom-row-area-menu" 
                         style="position:absolute; top:calc(100% + 5px); left:50%; transform:translateX(-50%); background:var(--bg-surface); border:1px solid var(--border-color); border-radius:12px; width:120px; z-index:2000; box-shadow:0 10px 25px rgba(0,0,0,0.4); padding:6px; animation:modalIn 0.15s ease-out;">
                       ${['Hugo','YS','Tai','KT','JQ'].map(a => `
                         <div class="area-row-opt" data-index="${idx}" data-val="${a}" 
                              style="padding:8px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:700; transition:all 0.2s; text-align:left;
                                     color:${currentArea === a ? 'var(--primary)' : 'var(--text-main)'};
                                     background:${currentArea === a ? 'rgba(242, 89, 0, 0.08)' : 'transparent'};">
                           ${a}
                         </div>
                       `).join('')}
                    </div>
                    ` : ''}
                    ` : '<span style="color:var(--text-muted); opacity: 0.5;">—</span>'}
                  </td>
                  <td style="text-align:center; font-weight: 700;">${it.qty}</td>
                  <td style="text-align:right; font-weight: 700;">RM ${it.subTotal.toFixed(2)}</td>
                  <td style="text-align:right; font-weight: 700; color:var(--danger);">RM ${it.disc.toFixed(2)}</td>
                  <td style="text-align:right; font-weight: 800; color:var(--success);">RM ${it.netAmt.toFixed(2)}</td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="5" style="padding:30px; text-align:center; color:var(--text-muted);">Processing...</td></tr>'}
          </tbody>
        </table>

        ${(() => {
          const isDup = (window.AppState.invoices || []).some(inv => inv.id === data.invoiceNo);
          if (isDup) {
            return `
              <div style="background: rgba(255, 77, 77, 0.1); border: 1px solid #ff4d4d; color: #ff4d4d; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: 700;">
                 ⚠️ DUPLICATE DETECTED: This Invoice (No. ${data.invoiceNo}) is already recorded in NexAI Hub.
              </div>
            `;
          }
          return '';
        })()}

        <div style="display:flex; justify-content:flex-end; align-items:center; border-top: 3px solid var(--primary); padding-top: 25px;">
           <h2 style="margin:0; font-size: 2.2rem; font-weight: 900;">TOTAL: RM ${subTotalSum.toFixed(2)}</h2>
        </div>

        <div style="display:flex; justify-content:flex-end; gap: 15px; margin-top: 50px;">
           <button id="btn-cancel-import" class="btn" style="padding:14px 35px; border-radius:10px; background: #ff4d4d; color: white; border: none; cursor: pointer; font-weight: 600;">Cancel</button>
           <button id="btn-submit-invoice" class="btn-primary" 
                   style="padding:14px 55px; font-weight:800; font-size:1.1rem; border-radius:10px; cursor:pointer; 
                          ${(window.AppState.invoices || []).some(inv => inv.id === data.invoiceNo) ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;' : ''}">
              Submit
           </button>
        </div>

        <div style="margin-top: 45px; padding: 15px; background: rgba(0,255,0,0.05); border: 1px solid rgba(0,255,0,0.2); border-radius: 8px; font-family: monospace; font-size: 0.75rem;">
           <p style="color:#0f0; margin:0 0 8px 0; font-weight:700;">🧩 True-Scan Stream Snapshot (Right-to-Left Scan)</p>
           <div style="max-height: 100px; overflow-y: auto; color:#8f8; white-space: pre-line;">${this.rawText}</div>
        </div>
      </div>
    `;
  },

  afterRender: function() {
    window.Utils.initHoverGifs();
    try {
      const fileInp = document.getElementById('invoice-file-input');
      const uploadBtn = document.getElementById('btn-upload-file');
      if (uploadBtn) uploadBtn.onclick = () => { fileInp.click(); }; // File selection modal temporarily disabled
      
      const closePicker = document.getElementById('btn-close-picker');
      if (closePicker) closePicker.onclick = () => { this.isSelectingFile = false; this.triggerUpdate(); };

      const browseLocal = document.getElementById('btn-browse-local');
      if (browseLocal) browseLocal.onclick = () => { 
        this.isSelectingFile = false; 
        this.triggerUpdate(); 
        setTimeout(() => fileInp.click(), 100); 
      };

      document.querySelectorAll('.simulated-file').forEach(item => {
        item.onclick = async () => {
          const fileName = item.dataset.name;
          const absoluteUrl = item.dataset.url;
          this.isSelectingFile = false;
          this.triggerUpdate();
          
          try {
            const response = await fetch(absoluteUrl);
            if (!response.ok) throw new Error("Could not load from Desktop: " + fileName);
            const blob = await response.blob();
            const mockFile = new File([blob], fileName, { type: "application/pdf" });
            this.handleFileUpload(mockFile);
          } catch (err) {
            console.error("Failed to load live mock file:", err);
            alert("Live Sync Error: " + err.message);
          }
        };
      });

      if (fileInp) fileInp.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        // Queue all files and start processing the first one
        this.uploadQueue = files.slice(1);
        this.handleFileUpload(files[0]);
        fileInp.value = ''; // Reset so same files can be re-selected
      };

      const searchInp = document.getElementById('invoice-search');
      if (searchInp) {
        searchInp.oninput = window.Utils.debounce((e) => { this.searchQuery = e.target.value; this.triggerUpdate(); }, 250);
        if (this.searchQuery) { searchInp.focus(); searchInp.setSelectionRange(this.searchQuery.length, this.searchQuery.length); }
      }
      
      document.querySelectorAll('.btn-view-invoice-action').forEach(btn => { 
        btn.onclick = async () => { 
          const id = btn.dataset.id;
          this.activeModalId = id; 
          this.triggerUpdate(); 
          // Async load the PDF blob if needed
          await this.ensureFileUrl(id);
          this.triggerUpdate();
        }; 
      });
      const closeBtn = document.getElementById('btn-close-invoice');
      if (closeBtn) closeBtn.onclick = () => { this.activeModalId = null; this.triggerUpdate(); };
      
      // CUSTOM AREA DROPDOWN LOGIC
      document.querySelectorAll('.custom-row-area-trigger').forEach(trigger => {
        trigger.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(trigger.dataset.index);
          this.openAreaIdx = (this.openAreaIdx === idx) ? null : idx;
          this.triggerUpdate();
        };
      });

      document.querySelectorAll('.area-row-opt').forEach(opt => {
        opt.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(opt.dataset.index);
          const val = opt.dataset.val;
          if(this.previewData && this.previewData.items[idx]) {
            this.previewData.items[idx].area = val;
            this.openAreaIdx = null;
            this.triggerUpdate();
          }
        };
      });

      document.querySelectorAll('.btn-edit-invoice-action').forEach(btn => {
        btn.onclick = () => { this.editingId = btn.dataset.id; this.triggerUpdate(); };
      });
      
      // EDIT MODAL DROPDOWN LOGIC
      document.querySelectorAll('.edit-area-trigger').forEach(trigger => {
        trigger.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(trigger.dataset.idx);
          this.openEditAreaIdx = (this.openEditAreaIdx === idx) ? null : idx;
          this.triggerUpdate();
        };
      });

      document.querySelectorAll('.edit-area-opt').forEach(opt => {
        opt.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(opt.dataset.idx);
          const newVal = opt.dataset.val;
          this.updateInvoiceArea(this.editingId, idx, newVal);
        };
      });

      const originalDocumentClick = document.onclick;
      document.onclick = (e) => {
        if (originalDocumentClick) originalDocumentClick(e);
        if (this.openAreaIdx !== null || this.openEditAreaIdx != null) {
          this.openAreaIdx = null;
          this.openEditAreaIdx = null;
          this.triggerUpdate();
        }
      };

      // INTERACTIVE DELETE BINDINGS
      document.querySelectorAll('.btn-delete-invoice-action').forEach(btn => {
        btn.onclick = () => { this.deletingId = btn.dataset.id; this.triggerUpdate(); };
      });
      const finalRemoveBtn = document.getElementById('btn-final-remove');
      if (finalRemoveBtn) finalRemoveBtn.onclick = () => { 
         const targetId = this.deletingId;
         this.deletingId = null; 
         this.deleteInvoice(targetId); 
      };
      const undoBtn = document.getElementById('btn-undo-delete');
      if (undoBtn) undoBtn.onclick = () => { this.deletingId = null; this.triggerUpdate(); };

      // DIRECT AMEND EXECUTION
      const directAmendBtn = document.getElementById('btn-direct-amend');
      if (directAmendBtn) {
        directAmendBtn.onclick = () => {
           const inv = window.AppState.invoices.find(i => i.id === this.editingId);
           if (inv) {
               const custInp = document.getElementById('edit-inv-customer');
               const picInp = document.getElementById('edit-inv-pic');
               if (custInp) inv.customerName = custInp.value;
               if (picInp) inv.picName = picInp.value;
           }
           this.editingId = null; 
           this.triggerUpdate();
        };
      }

      const submitBtn = document.getElementById('btn-submit-invoice');
      if (submitBtn) submitBtn.onclick = () => this.processImport();

      const cancelBtn = document.getElementById('btn-cancel-import');
      if (cancelBtn) cancelBtn.onclick = () => { this.previewData = null; this.processNextInQueue(); };

      const rejectDismiss = document.getElementById('btn-reject-dismiss');
      if (rejectDismiss) rejectDismiss.onclick = () => { this.isRejected = false; this.rejectedFileName = ''; this.processNextInQueue(); };

    } catch(err) { console.error("afterRender failed:", err); }
  },

  deleteInvoice: function(id) {
    const inv = window.AppState.invoices.find(i => i.id === id);
    if (!inv) return;

    // 1. REVERSE STOCK DEDUCTIONS
    const activityItems = [];
    (inv.items || []).forEach(it => {
      const prod = window.AppState.products.find(p => p.id === it.productId);
      if (prod && prod.type === 'Hardware') {
        if (it.area) {
          const invObj = window.AppState.inventory.find(inv => inv.productId === it.productId && inv.area === it.area);
          if (invObj) {
            invObj.quantity = (invObj.quantity || 0) + it.qty;
          }
        }
        activityItems.push({ productId: it.productId, name: prod.name, qty: it.qty, area: it.area });
      }
    });

    // 2. LOG THE DELETION REVERSAL
    if (activityItems.length > 0) {
      if (!window.AppState.hubActivities) window.AppState.hubActivities = [];
      window.AppState.hubActivities.push({
        id: 'act-' + Date.now(),
        type: 'delete',
        source: 'Invoice Removal (Inv# ' + id + ')',
        date: new Date().toISOString(),
        area: activityItems[0].area || 'Unknown',
        agent: 'Agent 1',
        items: activityItems,
        createdBy: window.AppState.user.displayName
      });
    }

    // 3. CLEANUP DATA
    if (inv.fileUrl) URL.revokeObjectURL(inv.fileUrl);
    if (window.PDFStorage) {
      window.PDFStorage.deletePDF(id);
      window.PDFStorage.deleteFromCloud(id);
    }
    window.AppState.invoices = window.AppState.invoices.filter(inv => inv.id !== id);
    if (window.deleteInvoiceFromFirestore) window.deleteInvoiceFromFirestore(id);
    window.AppState.deletedInvoicesCount = (window.AppState.deletedInvoicesCount || 0) + 1;
    if (window.incInventoryVersion) window.incInventoryVersion();
    if (window.saveState) window.saveState();
    this.triggerUpdate();
  },

  updateInvoiceArea: function(invId, itemIdx, newArea) {
    const state = window.AppState;
    const inv = state.invoices.find(i => i.id === invId);
    if (!inv || !inv.items[itemIdx]) return;

    const item = inv.items[itemIdx];
    const oldArea = item.area;
    if (oldArea === newArea) return;

    // 1. REVERSE STOCK FROM OLD AREA
    if (oldArea) {
      const oldInv = state.inventory.find(i => i.productId === item.productId && i.area === oldArea);
      if (oldInv) oldInv.quantity += item.qty; 
    }

    // 2. APPLY STOCK TO NEW AREA
    let newInv = state.inventory.find(i => i.productId === item.productId && i.area === newArea);
    
    if (!newInv) {
      const outlet = ['Hugo', 'YS', 'Tai'].includes(newArea) ? 'Penang' : 'Ipoh';
      newInv = { productId: item.productId, outlet, area: newArea, quantity: 0 };
      state.inventory.push(newInv);
    }
    newInv.quantity -= item.qty;

    // 3. UPDATE THE RECORD
    item.area = newArea;
    if (window.incInventoryVersion) window.incInventoryVersion();
    this.openEditAreaIdx = null;
    this.triggerUpdate();
  },

  triggerUpdate: function() { window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'invoices' })); },

  ensureFileUrl: async function(id) {
    const inv = (window.AppState.invoices || []).find(i => i.id === id);
    if (!inv) return;
    
    // Check if fileUrl is still valid (blob URLs expire on refresh)
    let isValid = false;
    if (inv.fileUrl && inv.fileUrl.startsWith('blob:')) {
      try {
        const resp = await fetch(inv.fileUrl);
        if (resp.ok) isValid = true;
      } catch (e) { isValid = false; }
    }

    // If cloud URL exists and it's not a blob, it's already persistent
    if (inv.fileUrl && (inv.fileUrl.startsWith('http') && !inv.fileUrl.startsWith('blob:'))) {
        isValid = true;
    }
    
    
    if (!isValid && window.PDFStorage) {
      const blob = await window.PDFStorage.getPDF(id);
      if (blob) {
        inv.fileUrl = URL.createObjectURL(blob);
      }
    }
  },

  handleFileUpload: async function(file) {
    this.lastUploadedBlob = file;
    this.uploadedFileUrl = URL.createObjectURL(file);
    this.isProcessing = true;
    this.triggerUpdate();

    try {
      const text = await this.extractPDFText(file);
      this.rawText = text;

      // VALIDATION: Check if this is a valid NexAI Infinity invoice
      const upperText = text.toUpperCase();
      const hasCompanyMarker = upperText.includes('NEXAI INFINITY') || upperText.includes('NEXAIINFINITY');
      const hasInvoiceNo = /NO\.?\s*IV-\d+/i.test(text);
      
      if (!hasCompanyMarker && !hasInvoiceNo) {
        // REJECT: Not a NexAI Infinity invoice
        this.isProcessing = false;
        this.isRejected = true;
        this.rejectedFileName = file.name;
        this.triggerUpdate();
        return;
      }

      const parsed = this.parseExtractedText(text);
      
      // Also reject if zero items were matched
      if (!parsed.items || parsed.items.length === 0) {
        this.isProcessing = false;
        this.isRejected = true;
        this.rejectedFileName = file.name;
        this.triggerUpdate();
        return;
      }

      this.previewData = parsed;
      this.isProcessing = false;
      this.triggerUpdate();
    } catch (error) {
      console.error('Scan Error:', error);
      this.isProcessing = false;
      this.isRejected = true;
      this.rejectedFileName = file.name;
      this.triggerUpdate();
    }
  },

  processNextInQueue: function() {
    if (this.uploadQueue.length > 0) {
      const next = this.uploadQueue.shift();
      this.handleFileUpload(next);
    } else {
      this.triggerUpdate();
    }
  },

  extractPDFText: function(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader(); r.readAsArrayBuffer(file);
      r.onload = async (e) => {
        try {
          const pdf = await window.pdfjsLib.getDocument({ data: e.target.result }).promise;
          let textArr = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const items = content.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
            const rows = {};
            items.forEach(it => {
              const key = Math.round(it.y / 3) * 3;
              if (!rows[key]) rows[key] = [];
              rows[key].push(it);
            });
            const sortedYKeys = Object.keys(rows).sort((a,b) => b - a);
            sortedYKeys.forEach(yKey => {
              const rowItems = rows[yKey].sort((a,b) => a.x - b.x);
              textArr.push(rowItems.map(it => it.str).join(" "));
            });
          }
          resolve(textArr.join('\n'));
        } catch (err) { reject(err); }
      };
    });
  },

  parseExtractedText: function(text) {
    // Optimization: Pre-calculate match-ready names to avoid redundant work in the loop
    const products = (window.AppState.products || []).map(p => ({
      ...p,
      matchName: p.name.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ')
    })).sort((a,b) => b.name.length - a.name.length);
    const ivMatch = text.match(/No\.\s*(IV-\d+)/i);
    const dateMatch = text.match(/Date\s+([0-9/]{8,10})/i);
    const clientMatch = text.match(/Bill To\s+([\s\S]+)/i);
    
    const itemsFound = [];
    const lines = text.split('\n');
    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      
      // For MATCHING: strip ALL special chars and collapse whitespace on BOTH sides
      const matchLine = upperLine.replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ');
      
      let matchedProduct = null;
      for (const p of products) {
        if (matchLine.includes(p.matchName)) {
          matchedProduct = p;
          break;
        }
      }

      // FALLBACK: Handle "PROJECT MANAMENT" typo on invoice → default to ONSITE
      if (!matchedProduct && /PROJECT\s*MANA\w*MENT/i.test(upperLine)) {
        matchedProduct = products.find(p => p.id === 'p-61'); // p-61 = PROJECT MANAGEMENT - ONSITE 
      }
      
      if (matchedProduct) {
        // For NUMBERS: use ORIGINAL line to preserve comma/period formatting in amounts
        const allNums = upperLine.match(/-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2,3})|\b\d+\b/g) || [];
        
        // 8-COLUMN FORMAT: A:No, B:Desc, C:Qty, D:U/Price, E:Amt, F:Disc, G:Tax Amt, H:Net Amt
        // Count from right: H=N-1, G=N-2, F=N-3, E=N-4, D=N-5, C=N-6
        if (allNums.length >= 6) {
          const netAmt = parseFloat(allNums[allNums.length - 1].replace(/,/g, ''));
          const discAmt = parseFloat(allNums[allNums.length - 3].replace(/,/g, ''));
          const grossAmt = parseFloat(allNums[allNums.length - 4].replace(/,/g, ''));
          const qty = parseInt(allNums[allNums.length - 6]);

          itemsFound.push({ 
            productId: matchedProduct.id, 
            name: matchedProduct.name, 
            qty: isNaN(qty) ? 1 : qty, 
            subTotal: isNaN(grossAmt) ? netAmt : grossAmt,
            disc: isNaN(discAmt) ? 0 : discAmt,
            netAmt: isNaN(netAmt) ? 0 : netAmt,
            type: matchedProduct.type,
            area: 'Hugo' 
          });
        }
      }
    });

    let cName = "Detect Client";
    let picName = "";
    if (clientMatch) {
       let extracted = clientMatch[1].trim().split('\n').filter(l => l.trim() !== '');
       cName = extracted[0].trim();
       if (cName.toUpperCase() === 'SHIP TO' && extracted.length > 1) {
          extracted.shift();
          cName = extracted[0].trim();
       }
       
       // Handle cases where PDF groups company and PIC on the same line horizontally 
       const mixMatch = cName.match(/^([A-Z0-9\s.,&'-]+)\s+([A-Z][a-z].*)$/);
       if (mixMatch && mixMatch[1] && mixMatch[1].trim().length > 3) {
           cName = mixMatch[1].trim();
           picName = mixMatch[2].trim();
       } else if (extracted.length > 1) {
           const candidatePic = extracted[1].trim();
           const upper = candidatePic.toUpperCase();
           // Filter out lines that are clearly NOT a PIC name
           const isTableHeader = /\b(DESCRIPTION|QTY|U\/PRICE|NET AMT|TAX AMT|DISC)\b/i.test(upper);
           const isRegInfo = upper.includes('REG NO') || upper.includes('PHONE NO') || upper.includes('LOT ') || upper.includes('JALAN ') || upper.includes('BANDAR ');
           const isAddress = /^\d+[\s,]/.test(candidatePic) || /MALAYSIA/i.test(upper) || /SELANGOR|PERAK|PENANG|JOHOR|SABAH|SARAWAK|KEDAH|KELANTAN|PAHANG|PERLIS|MELAKA|NEGERI|PULAU|KUALA/i.test(upper);
           
           if (!isTableHeader && !isRegInfo && !isAddress && candidatePic.length > 0 && candidatePic.length < 50) {
               picName = candidatePic;
           }
       }
       
       // Final safety check
       if (/\b(DESCRIPTION|QTY|U\/PRICE|NET AMT|TAX AMT|DISC|REG NO|PHONE NO)\b/i.test(picName)) picName = '';
    }

    return {
      invoiceNo: ivMatch ? ivMatch[1] : "IV-MIRROR",
      date: dateMatch ? dateMatch[1] : new Date().toLocaleDateString('en-GB'),
      customerId: 'c1',
      customerName: cName,
      picName: picName,
      items: itemsFound
    };
  },

  processImport: function() {
    try {
      const d = this.previewData;
      if (!d) throw new Error("Preview lost.");

      this.isRecording = true;
      this.triggerUpdate();

      // Performance: Asynchronous processing to prevent UI lockup
      setTimeout(async () => {
        try {
          // Save PDF to IndexedDB for persistence and Firebase Storage for database backup
          if (this.lastUploadedBlob && window.PDFStorage) {
            await window.PDFStorage.savePDF(d.invoiceNo, this.lastUploadedBlob);
            const cloudUrl = await window.PDFStorage.uploadToCloud(d.invoiceNo, this.lastUploadedBlob);
            if (cloudUrl) this.uploadedFileUrl = cloudUrl;
          }

          const state = window.AppState;
          let totalS = 0, totalC = 0, finalItems = [];

        d.items.forEach(it => {
          totalS += it.netAmt;
          const prod = state.products.find(p => p.id === it.productId);
          if (prod) {
            totalC += (prod.cost * it.qty);
            if (prod.type === 'Hardware' && it.area) {
              let invObj = state.inventory.find(inv => inv.productId === it.productId && inv.area === it.area);
              if (!invObj) {
                const outlet = ['Hugo', 'YS', 'Tai'].includes(it.area) ? 'Penang' : 'Ipoh';
                invObj = { productId: it.productId, outlet: outlet, area: it.area, quantity: 0 };
                state.inventory.push(invObj);
              }
              // Allow negative values as requested
              invObj.quantity = (invObj.quantity || 0) - it.qty;
            }
          }
          finalItems.push({ productId: it.productId, qty: it.qty, netAmt: it.netAmt, area: it.area });
        });

        if (!state.invoices) state.invoices = [];
        const now = new Date();
        const loadedDate = String(now.getDate()).padStart(2,'0') + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + now.getFullYear();
        const newInv = { 
          id: d.invoiceNo, 
          date: d.date, 
          loadedDate: loadedDate,
          customerId: d.customerId, 
          customerName: d.customerName,
          picName: d.picName,
          agentId: 'a1', 
          totalSales: totalS, 
          totalCost: totalC, 
          items: finalItems,
          fileUrl: this.uploadedFileUrl,
          createdBy: window.AppState.user.displayName
        };
        state.invoices.push(newInv);
        if (window.saveInvoiceToFirestore) window.saveInvoiceToFirestore(newInv);
        
        // Log the activity for Hub Activity module
        if (!state.hubActivities) state.hubActivities = [];
        const activityItems = finalItems.filter(it => {
          const p = state.products.find(pp => pp.id === it.productId);
          return p && p.type === 'Hardware';
        }).map(it => {
          const p = state.products.find(pp => pp.id === it.productId);
          return { productId: it.productId, name: p ? p.name : 'Unknown', qty: it.qty, area: it.area };
        });
        if (activityItems.length > 0) {
          const hardwareAreas = [...new Set(activityItems.map(it => it.area).filter(Boolean))];
          state.hubActivities.push({
            id: 'act-' + Date.now(),
            type: 'out',
            source: 'NexInvoice Upload (Inv# ' + d.invoiceNo + ')',
            date: new Date().toISOString(),
            area: hardwareAreas.join(', ') || 'Unknown',
            agent: 'Agent 1',
            items: activityItems,
            createdBy: window.AppState.user.displayName
          });
        }

          // Force Warehouse refresh
          if (window.incInventoryVersion) window.incInventoryVersion();

          setTimeout(() => {
            this.isRecording = false;
            this.isSuccess = true;
            this.triggerUpdate();

            setTimeout(() => {
               this.isSuccess = false;
               this.previewData = null;
               this.processNextInQueue();
            }, 2000);

          }, 1500);
        } catch (err) {
          console.error("Async Process Error:", err);
          this.isRecording = false;
          this.triggerUpdate();
          alert("Processing Error: " + err.message);
        }
      }, 0);

    } catch (e) {
      this.isRecording = false;
      this.isSuccess = false;
      alert("Submit Error: " + e.message);
      this.triggerUpdate();
    }
  }
};
