// js/pages/stocks_list.js
window.Pages = window.Pages || {};

window.Pages.stocks_list = {
  activeStocksTab: 'Surftek',
  isImportModalOpen: false,
  importFeedback: '',
  isSyncing: false,
  showSuccessPrompt: false,
  lastImportStats: { added: 0, skipped: 0 },
  apiEndpoint: 'https://nexaiinfinity.bukku.my/api/products?is_archived=false&page=1&page_size=30&sort_by=name&sort_dir=asc',

  render: function() {
    const state = window.AppState;
    
    // Dynamically get catalogs from existing products + defaults
    const defaultCatalogs = ['Surftek', 'Mdot', 'Swisspac', 'FeedMe', 'Bukku', 'EZYPOS', 'Service', 'Benefit', 'Other'];
    const currentCatalogs = [...new Set(state.products.map(p => p.supplier))];
    const catalogs = [...new Set([...defaultCatalogs, ...currentCatalogs])].filter(c => c).sort((a, b) => {
      if (a === '-') return 1;
      if (b === '-') return -1;
      return a.localeCompare(b);
    });

    const getSupplierColor = (s) => {
      if (s === 'Surftek') return '#00b4ff';
      if (s === 'Mdot') return '#EF4444';
      if (s === 'Swisspac') return '#9333ea';
      if (s === 'Other') return '#C8A2C8';
      if (s === 'FeedMe') return '#f25900';
      if (s === 'Bukku') return '#00FFFF';
      if (s === 'Service') return '#fbbf24';
      if (s === 'Benefit') return '#10B981';
      if (s === 'EZYPOS') return '#f43f5e';
      if (s === '-') return '#94a3b8';
      return '#ED8F03';
    };
    
    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/ProductServices.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Stocks List</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Bukku synced products & services stock overview.</p>
          </div>
        </div>
        <div style="display:flex; gap:12px;">
          <button id="sl-btn-fetch" class="btn-primary" style="padding: 10px 26px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 1rem; border-radius: 10px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(242, 89, 0, 0.4), 0 0 20px rgba(242, 89, 0, 0.2);">
            Fetch
            <img src="assets/upload.gif" style="width: 22px; height: 22px; object-fit: contain; filter: invert(1) brightness(1.5) drop-shadow(0 0 2px #f25900); mix-blend-mode: screen;" alt=""/>
          </button>
          <button id="sl-btn-add-product" class="btn-primary" style="display:flex; align-items:center; gap:8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Add Product
          </button>
        </div>
      </div>
      
      <div style="display:flex; align-items:flex-end; padding-left: 12px; position:relative; top:1px; z-index:2; overflow-x:auto;">
        ${catalogs.map(cat => {
          const isActive = this.activeStocksTab === cat;
          return `
            <button class="sl-tab-btn ${isActive ? 'active' : ''}" data-target="${cat}" style="
              padding: 12px 24px;
              background: ${isActive ? `rgba(${window.Utils.hexToRgb(getSupplierColor(cat))}, 0.1)` : 'var(--bg-main)'};
              color: ${isActive ? getSupplierColor(cat) : 'var(--text-muted)'};
              border: 1px solid ${isActive ? getSupplierColor(cat) : 'var(--border-color)'};
              border-bottom: ${isActive ? 'none' : '1px solid var(--border-color)'};
              border-radius: 12px 12px 0 0;
              cursor: pointer;
              font-weight: ${isActive ? '800' : '600'};
              margin-right: 6px;
              outline: none;
              white-space: nowrap;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              box-shadow: ${isActive ? `0 -5px 15px rgba(${window.Utils.hexToRgb(getSupplierColor(cat))}, 0.15)` : 'none'};
            " onmouseover="if(!this.classList.contains('active')) { this.style.borderColor='${getSupplierColor(cat)}'; this.style.color='${getSupplierColor(cat)}'; }" 
              onmouseout="if(!this.classList.contains('active')) { this.style.borderColor='var(--border-color)'; this.style.color='var(--text-muted)'; }">
              ${cat}
            </button>
          `;
        }).join('')}
      </div>
    `;
    
    // Get products for the active tab
    const activeProducts = state.products.filter(p => p.supplier === this.activeStocksTab);
    
    html += `
      <div class="card" style="padding: 0; overflow-x: auto; margin-bottom: 24px; position:relative; z-index:1; border-top-left-radius: 4px; border-top: 2px solid ${getSupplierColor(this.activeStocksTab)};">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead style="background-color: rgba(${window.Utils.hexToRgb(getSupplierColor(this.activeStocksTab))}, 0.03);">
            <tr>
              <th style="padding: 16px; border-bottom: 1px solid var(--border-color);">Description</th>
              <th style="padding: 16px; border-bottom: 1px solid var(--border-color);">SKU</th>
              <th style="padding: 16px; border-bottom: 1px solid var(--border-color);">Group</th>
              <th style="padding: 16px; border-bottom: 1px solid var(--border-color);">Cost Price</th>
              <th style="padding: 16px; border-bottom: 1px solid var(--border-color);">Selling Price</th>
              <th style="padding: 16px; border-bottom: 1px solid var(--border-color); text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${activeProducts.length === 0 ? `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">No items found in this catalog.</td></tr>` : ''}
            ${activeProducts.map(p => `
              <tr style="border-bottom: 1px solid var(--border-color); ${p.active === false ? 'opacity: 0.5; filter: grayscale(0.8);' : ''}">
                <td style="padding: 16px; font-weight: 500; color: var(--text-main);">${p.name}</td>
                <td style="padding: 16px; font-family: monospace;"><span class="sku-text-neon">${p.sku || '-'}</span></td>
                <td style="padding: 16px;">
                  <span style="background:rgba(${window.Utils.hexToRgb(getSupplierColor(p.supplier))}, 0.1); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; color: ${getSupplierColor(p.supplier)}; border: 1px solid rgba(${window.Utils.hexToRgb(getSupplierColor(p.supplier))}, 0.2);">${p.supplier}</span>
                </td>
                <td style="padding: 16px; color: var(--text-muted); font-size: 0.85rem;">$${(p.cost || 0).toFixed(2)}</td>
                <td style="padding: 16px; font-weight: 500;"><span class="price-text-green">$${(p.price || 0).toFixed(2)}</span></td>
                <td style="padding: 16px; display:flex; gap:12px; justify-content:center; align-items:center;">
                  <button class="sl-btn-edit-prod" data-id="${p.id}" style="background: rgba(0, 128, 255, 0.1); border: 1px solid #0080ff; color: #0080ff; cursor: pointer; padding: 6px; border-radius: 50%; display:flex; align-items:center; justify-content:center;">
                    ${window.Utils.renderHoverGif('edit.gif', 18, '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>')}
                  </button>
                  <label class="nex-switch" title="Toggle Active Status">
                    <input type="checkbox" class="sl-toggle-active-prod" data-id="${p.id}" ${p.active !== false ? 'checked' : ''}>
                    <span class="nex-slider"></span>
                  </label>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Product Modal -->
      ${this.renderProductModal(catalogs, getSupplierColor)}

      <!-- Sync Modal -->
      ${this.isImportModalOpen ? this.renderSyncModal() : ''}

      <!-- Success Popup -->
      ${this.showSuccessPrompt ? this.renderSuccessPrompt() : ''}

      <style>
        .neon-input { transition: all 0.3s ease; border: 1.5px solid var(--border-color) !important; }
        .neon-input:focus { border-color: var(--primary) !important; box-shadow: 0 0 10px rgba(242, 89, 0, 0.3) !important; }
        .spinner-small { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
    `;
    
    return html;
  },

  renderProductModal: function(catalogs, getSupplierColor) {
    return `
      <div id="sl-product-modal" class="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(8px); animation: fadeIn 0.3s ease;">
        <div class="card" style="width: 100%; max-width: 550px; padding: 40px; position:relative; border: 1px solid rgba(255,255,255,0.1); background: #1a1a1a; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border-radius: 24px;">
          <h2 id="sl-product-modal-title" style="margin-bottom: 30px; font-size: 1.8rem; font-weight: 800; color: #fff; letter-spacing: -0.02em;">Add Product</h2>
          
          <input type="hidden" id="sl-prod-id" />
          
          <div class="form-group" style="margin-bottom: 24px;">
            <label style="display:block; margin-bottom:10px; color:var(--text-muted); font-size:0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Description (Name)</label>
            <input type="text" id="sl-prod-name" class="inventory-input" 
                   style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px; border-radius: 12px; outline: none; transition: all 0.2s;" 
                   placeholder="Product Name" />
          </div>
          
          <div style="display:flex; gap:20px; margin-bottom: 24px;">
            <div class="form-group" style="flex: 1.2;">
              <label style="display:block; margin-bottom:10px; color:var(--text-muted); font-size:0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">SKU</label>
              <input type="text" id="sl-prod-sku" class="inventory-input" 
                     style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px; border-radius: 12px; outline: none; transition: all 0.2s;" 
                     placeholder="SKU Number" />
            </div>
            <div class="form-group" style="flex: 0.8;">
              <label style="display:block; margin-bottom:10px; color:var(--text-muted); font-size:0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Group (Catalog)</label>
              <div style="position: relative;">
                <div id="sl-modal-group-trigger" style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s;">
                  <span id="sl-modal-group-display" style="font-weight: 600;">Loading...</span>
                  <span id="sl-modal-group-arrow" style="font-size: 0.7rem; color: var(--primary); transition: transform 0.2s; transform: rotate(0deg)">▼</span>
                </div>
                <input type="hidden" id="sl-prod-group" />
                <div id="sl-modal-group-menu" style="display: none; position: absolute; top: calc(100% + 8px); left: 0; right: 0; background: #1a1a1a; border: 1px solid #333; border-radius: 16px; z-index: 10001; padding: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(10px); max-height: 200px; overflow-y: auto;">
                  ${catalogs.map(cat => `
                    <div class="sl-modal-group-opt" data-value="${cat}" style="padding: 10px 12px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s;">
                      <div style="width: 8px; height: 8px; border-radius: 50%; background: ${getSupplierColor(cat)};"></div>
                      <span style="font-size: 0.9rem; color: #fff;">${cat}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
          
          <div style="display:flex; gap:20px; margin-bottom: 40px;">
            <div class="form-group" style="flex:1;">
              <label style="display:block; margin-bottom:10px; color:var(--text-muted); font-size:0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Cost Price ($)</label>
              <div style="position: relative;">
                <span style="position: absolute; left: 14px; top: 12px; color: #666;">$</span>
                <input type="number" id="sl-prod-cost" class="inventory-input" 
                       style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px 12px 30px; border-radius: 12px; outline: none;" 
                       min="0" step="0.01" />
              </div>
            </div>
            <div class="form-group" style="flex:1;">
              <label style="display:block; margin-bottom:10px; color:var(--text-muted); font-size:0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Selling Price ($)</label>
              <div style="position: relative;">
                <span style="position: absolute; left: 14px; top: 12px; color: #666;">$</span>
                <input type="number" id="sl-prod-price" class="inventory-input" 
                       style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px 12px 30px; border-radius: 12px; outline: none;" 
                       min="0" step="0.01" />
              </div>
            </div>
          </div>
          
          <div style="display:flex; gap:16px; justify-content:flex-end;">
            <button id="sl-btn-cancel-prod" style="padding: 14px 28px; border-radius: 14px; background: transparent; border: 1px solid #333; color: var(--text-muted); cursor: pointer; font-weight: 700; transition: all 0.2s;">Cancel</button>
            <button id="sl-btn-save-prod" class="btn-primary" style="padding: 14px 35px; border-radius: 14px; box-shadow: 0 10px 20px rgba(242, 89, 0, 0.2);">Save Product</button>
          </div>
        </div>
      </div>
    `;
  },

  renderSyncModal: function() {
    return `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(8px); animation: modalIn 0.3s ease-out;">
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; width: 600px; max-width: 95vw; box-shadow: 0 40px 80px rgba(0,0,0,0.6); overflow: hidden; display:flex; flex-direction:column;">
          <div style="padding: 24px; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.02);">
            <div style="display:flex; align-items:center; gap: 12px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(242, 89, 0, 0.1); border: 1px solid var(--primary); color: var(--primary); display:flex; align-items:center; justify-content:center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </div>
              <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800;">Bukku Sync</h3>
            </div>
            <button id="sl-btn-close-sync" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.8rem;">&times;</button>
          </div>
          <div style="padding: 24px;">
            <div style="background: rgba(242, 89, 0, 0.05); border: 2px solid var(--primary); border-radius: 12px; padding: 18px;">
              <p style="font-size: 0.95rem; font-weight: 800; color: var(--primary); margin-bottom: 20px;">Import from Bukku API</p>
              <div style="margin-bottom: 12px;">
                <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">ENDPOINT URL</label>
                <input type="text" id="sl-api-endpoint-input" value="${this.apiEndpoint}" class="neon-input" style="width: 100%; padding: 10px; background: var(--bg-main); border: 1.5px solid var(--border-color); border-radius: 8px; color: var(--text-main); font-family: monospace; font-size: 0.75rem; outline:none;" readonly>
              </div>
              <div style="margin-bottom: 20px;">
                <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Bearer Token</label>
                <textarea id="sl-bearer-token-input" placeholder="Bearer eyJhbGciOi..." class="neon-input" style="width: 100%; height: 80px; background: var(--bg-main); border: 1.5px solid var(--border-color); border-radius: 8px; padding: 12px; color: var(--text-main); font-family: monospace; font-size: 0.8rem; outline:none;"></textarea>
              </div>
              <button id="sl-btn-direct-sync" class="btn-primary" style="width: 100%; padding: 14px; font-weight: 800; display:flex; align-items:center; justify-content:center; gap:10px;" ${this.isSyncing ? 'disabled' : ''}>
                ${this.isSyncing ? '<span class="spinner-small"></span> Fetching...' : 'Fetch & Import'}
              </button>
            </div>
            <div id="sl-import-status" style="margin-top: 15px; font-size: 0.9rem; font-weight: 700; text-align:center;">${this.importFeedback}</div>
          </div>
        </div>
      </div>
    `;
  },

  renderSuccessPrompt: function() {
    return `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 11000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(4px); animation: fadeIn 0.3s ease-out;">
        <div style="background: var(--bg-surface); border: 2px solid #10b981; border-radius: 24px; padding: 40px; text-align: center; box-shadow: 0 40px 100px rgba(16, 185, 129, 0.2); max-width: 400px; width: 90%;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); border: 2px solid #10b981; color: #10b981; display:flex; align-items:center; justify-content:center; margin: 0 auto 24px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style="font-size: 2rem; font-weight: 900; color: var(--text-main); margin-bottom: 12px;">Sync Successful</h2>
          <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 16px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted); font-weight: 600;">✅ New Items</span>
              <span style="color: #10b981; font-weight: 900; font-size: 1.2rem;">${this.lastImportStats.added}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted); font-weight: 600;">🛡️ Already Exist</span>
              <span style="color: var(--primary); font-weight: 900; font-size: 1.2rem;">${this.lastImportStats.skipped}</span>
            </div>
          </div>
          <button id="sl-btn-close-success" style="width: 100%; padding: 14px; background: #10b981; border: none; color: white; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 1rem;">Close</button>
        </div>
      </div>
    `;
  },

  afterRender: function() {
    const state = window.AppState;
    
    // Tab switching
    document.querySelectorAll('.sl-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeStocksTab = e.target.dataset.target;
        this.triggerUpdate();
      });
    });
    
    // Modals & UI Elements
    const modal = document.getElementById('sl-product-modal');
    const modalTitle = document.getElementById('sl-product-modal-title');
    const prodIdInput = document.getElementById('sl-prod-id');
    const prodNameInput = document.getElementById('sl-prod-name');
    const prodSkuInput = document.getElementById('sl-prod-sku');
    const prodGroupSelect = document.getElementById('sl-prod-group');
    const prodCostInput = document.getElementById('sl-prod-cost');
    const prodPriceInput = document.getElementById('sl-prod-price');
    
    const closeModal = () => {
      modal.style.display = 'none';
      const menu = document.getElementById('sl-modal-group-menu');
      if (menu) menu.style.display = 'none';
    };
    
    const updateDropdownUI = (val) => {
      const display = document.getElementById('sl-modal-group-display');
      if (display) display.textContent = val;
      if (prodGroupSelect) prodGroupSelect.value = val;
    };
    
    // Header Buttons
    const addBtn = document.getElementById('sl-btn-add-product');
    if (addBtn) {
      addBtn.onclick = () => {
        modalTitle.textContent = 'Add New Product';
        prodIdInput.value = '';
        prodNameInput.value = '';
        prodSkuInput.value = '';
        updateDropdownUI(this.activeStocksTab);
        prodCostInput.value = '0.00';
        prodPriceInput.value = '0.00';
        modal.style.display = 'flex';
      };
    }

    const fetchBtn = document.getElementById('sl-btn-fetch');
    if (fetchBtn) {
      fetchBtn.onclick = () => {
        this.isImportModalOpen = true;
        this.importFeedback = '';
        this.triggerUpdate();
      };
    }

    // Modal Inner logic
    if (this.isImportModalOpen) {
      const closeSync = document.getElementById('sl-btn-close-sync');
      if (closeSync) closeSync.onclick = () => { this.isImportModalOpen = false; this.triggerUpdate(); };
      
      const btnDirectSync = document.getElementById('sl-btn-direct-sync');
      if (btnDirectSync) btnDirectSync.onclick = () => this.handleDirectSync();
    }

    if (this.showSuccessPrompt) {
      const closeSuccess = document.getElementById('sl-btn-close-success');
      if (closeSuccess) closeSuccess.onclick = () => { this.showSuccessPrompt = false; this.triggerUpdate(); };
    }
    
    // Group Dropdown Logic
    const groupTrigger = document.getElementById('sl-modal-group-trigger');
    const groupMenu = document.getElementById('sl-modal-group-menu');
    const groupArrow = document.getElementById('sl-modal-group-arrow');
    
    if (groupTrigger && groupMenu) {
      groupTrigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = groupMenu.style.display === 'block';
        groupMenu.style.display = isOpen ? 'none' : 'block';
        groupTrigger.style.borderColor = isOpen ? '#333' : 'var(--primary)';
        if (groupArrow) groupArrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      };
    }

    document.querySelectorAll('.sl-modal-group-opt').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        updateDropdownUI(val);
        groupMenu.style.display = 'none';
        groupTrigger.style.borderColor = '#333';
        if (groupArrow) groupArrow.style.transform = 'rotate(0deg)';
      };
    });
    
    // Edit logic
    document.querySelectorAll('.sl-btn-edit-prod').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.dataset.id;
        const product = state.products.find(p => p.id === id);
        if (product) {
          modalTitle.textContent = 'Edit Product';
          prodIdInput.value = product.id;
          prodNameInput.value = product.name;
          prodSkuInput.value = product.sku || '';
          updateDropdownUI(product.supplier);
          prodCostInput.value = (product.cost || 0).toFixed(2);
          prodPriceInput.value = (product.price || 0).toFixed(2);
          modal.style.display = 'flex';
        }
      };
    });
    
    // Deactivate / Toggle logic
    document.querySelectorAll('.sl-toggle-active-prod').forEach(input => {
      input.onchange = (e) => {
        const id = e.currentTarget.dataset.id;
        const product = state.products.find(p => p.id === id);
        if (product) {
          product.active = e.target.checked;
          window.saveState();
          this.triggerUpdate();
        }
      };
    });
    
    // Initialize GIF hover logic
    window.Utils.initHoverGifs();
    
    // Modal buttons
    const cancelProd = document.getElementById('sl-btn-cancel-prod');
    if (cancelProd) cancelProd.onclick = closeModal;
    
    const saveProd = document.getElementById('sl-btn-save-prod');
    if (saveProd) {
      saveProd.onclick = () => {
        const name = prodNameInput.value.trim();
        const sku = prodSkuInput.value.trim();
        const group = prodGroupSelect.value;
        const cost = parseFloat(prodCostInput.value) || 0;
        const price = parseFloat(prodPriceInput.value) || 0;
        
        if (!name) return alert('Description is required.');
        
        if (prodIdInput.value) {
          const p = state.products.find(p => p.id === prodIdInput.value);
          if (p) {
            p.name = name; p.sku = sku; p.supplier = group; p.cost = cost; p.price = price;
          }
        } else {
          state.products.push({
            id: 'custom-' + Date.now(),
            name, sku, supplier: group, type: 'Hardware', cost, price, active: true
          });
        }
        
        window.saveState();
        closeModal();
        this.activeStocksTab = group;
        this.triggerUpdate();
      };
    }
  },

  handleDirectSync: async function() {
    const tokenInput = document.getElementById('sl-bearer-token-input');
    const rawToken = tokenInput.value.trim();
    if (!rawToken) return alert('Please provide a Bearer token.');

    const token = rawToken.startsWith('Bearer ') ? rawToken : 'Bearer ' + rawToken;
    this.isSyncing = true;
    this.importFeedback = 'Connecting to Bukku API...';
    this.triggerUpdate();

    try {
      // Fetch all products (user mentions 110, so let's try to get more if needed, but for now follow user URL)
      // Note: User URL has page_size=30. We'll stick to it but maybe loop if there's more?
      // Actually, user just said "fetch the data i want" with that URL.
      // But if there are 110, we should probably handle pagination if the API supports it.
      // Bukku typically uses page and page_size.
      
      let allResources = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        const url = `https://nexaiinfinity.bukku.my/api/products?is_archived=false&page=${currentPage}&page_size=100&sort_by=name&sort_dir=asc`;
        
        const res = await fetch(url, {
          headers: {
            "Authorization": token,
            "Accept": "application/json"
          }
        });

        if (!res.ok) {
          if (res.status === 401) throw new Error("Unauthorized (Invalid Token)");
          throw new Error("API Sync Error: " + res.status);
        }

        const data = await res.json();
        const resources = data.data || []; // Bukku response is usually { data: [...] }
        allResources.push(...resources);

        // Check if we got a full page, if so there might be more
        if (resources.length < 100) {
          hasMore = false;
        } else {
          currentPage++;
        }
        
        this.importFeedback = `Fetching: ${allResources.length} items...`;
        this.triggerUpdate();
      }

      this.processBatch(allResources);
      
      this.isSyncing = false;
      this.isImportModalOpen = false;
      this.showSuccessPrompt = true;
      this.triggerUpdate();

    } catch (e) {
      console.error(e);
      this.isSyncing = false;
      this.importFeedback = `<span style="color:#ff4d4d">${e.message}</span>`;
      this.triggerUpdate();
    }
  },

  processBatch: function(resources) {
    const state = window.AppState;
    let added = 0;
    let skipped = 0;

    resources.forEach(item => {
      // Mapping: name->name, sku->sku, purchase_price->cost, sales_price->price
      const name = item.name || 'Unknown Product';
      const sku = item.sku || '-';
      const cost = parseFloat(item.purchase_price) || 0;
      const price = parseFloat(item.sales_price) || 0;

      // Duplicate check: Check by Name + SKU
      const exists = state.products.some(p => p.name === name && p.sku === sku);

      if (exists) {
        skipped++;
      } else {
        state.products.push({
          id: 'bukku-' + (item.id || Date.now() + Math.random()),
          name,
          sku,
          supplier: '-', // Default group as requested
          type: 'Hardware',
          cost,
          price,
          active: true
        });
        added++;
      }
    });

    this.lastImportStats = { added, skipped };
    if (window.saveState) window.saveState();
  },

  triggerUpdate: function() {
    window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'stocks_list' }));
  }
};
