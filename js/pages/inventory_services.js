// js/pages/inventory_services.js
window.Pages = window.Pages || {};

let activeServiceTab = 'Surftek';

window.Pages.catalog = {
  render: function() {
    const state = window.AppState;
    
    const catalogs = ['Surftek', 'Mdot', 'Swisspac', 'FeedMe', 'Bukku', 'EZYPOS', 'Service', 'Benefit', 'Other'];
    
    // Ensure 'Others' hasn't disappeared if there are no items yet
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
      return '#ED8F03';
    };
    
    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/ProductServices.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Products & Services Catalog</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Global hardware and service definitions.</p>
          </div>
        </div>
        <button id="btn-add-product" class="btn-primary" style="display:flex; align-items:center; gap:8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          Add Product
        </button>
      </div>
      
      <div style="display:flex; align-items:flex-end; padding-left: 12px; position:relative; top:1px; z-index:2; overflow-x:auto;">
        ${catalogs.map(cat => {
          const isActive = activeServiceTab === cat;
          return `
            <button class="service-tab-btn ${isActive ? 'active' : ''}" data-target="${cat}" style="
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
    
    // Get products for the active tab (Showing all, active or not)
    const activeProducts = state.products.filter(p => p.supplier === activeServiceTab);
    
    html += `
      <div class="card" style="padding: 0; overflow-x: auto; margin-bottom: 24px; position:relative; z-index:1; border-top-left-radius: 4px; border-top: 2px solid ${getSupplierColor(activeServiceTab)};">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead style="background-color: rgba(${window.Utils.hexToRgb(getSupplierColor(activeServiceTab))}, 0.03);">
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
            ${activeProducts.length === 0 ? `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">No active items found in this catalog.</td></tr>` : ''}
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
                  <button class="btn-edit-prod" data-id="${p.id}" style="background: rgba(0, 128, 255, 0.1); border: 1px solid #0080ff; color: #0080ff; cursor: pointer; padding: 6px; border-radius: 50%; display:flex; align-items:center; justify-content:center;">
                    ${window.Utils.renderHoverGif('edit.gif', 18, '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>')}
                  </button>
                  <label class="nex-switch" title="Toggle Active Status">
                    <input type="checkbox" class="toggle-active-prod" data-id="${p.id}" ${p.active !== false ? 'checked' : ''}>
                    <span class="nex-slider"></span>
                  </label>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Product Modal (Hidden by default) -->
      <div id="product-modal" class="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(8px); animation: fadeIn 0.3s ease;">
        <div class="card" style="width: 100%; max-width: 550px; padding: 40px; position:relative; border: 1px solid rgba(255,255,255,0.1); background: #1a1a1a; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border-radius: 24px;">
          <h2 id="product-modal-title" style="margin-bottom: 30px; font-size: 1.8rem; font-weight: 800; color: #fff; letter-spacing: -0.02em;">Add Product</h2>
          
          <input type="hidden" id="prod-id" />
          
          <div class="form-group" style="margin-bottom: 24px;">
            <label style="display:block; margin-bottom:10px; color:var(--text-muted); font-size:0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Description (Name)</label>
            <input type="text" id="prod-name" class="inventory-input" 
                   style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px; border-radius: 12px; outline: none; transition: all 0.2s;" 
                   onfocus="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 0 0 3px rgba(242, 89, 0, 0.1)';" 
                   onblur="this.style.borderColor='#333'; this.style.boxShadow='none';"
                   placeholder="Product Name" />
          </div>
          
          <div style="display:flex; gap:20px; margin-bottom: 24px;">
            <div class="form-group" style="flex: 1.2;">
              <label style="display:block; margin-bottom:10px; color:var(--text-muted); font-size:0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">SKU</label>
              <input type="text" id="prod-sku" class="inventory-input" 
                     style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px; border-radius: 12px; outline: none; transition: all 0.2s;" 
                     onfocus="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 0 0 3px rgba(242, 89, 0, 0.1)';" 
                     onblur="this.style.borderColor='#333'; this.style.boxShadow='none';"
                     placeholder="SKU Number" />
            </div>
            <div class="form-group" style="flex: 0.8;">
              <label style="display:block; margin-bottom:10px; color:var(--text-muted); font-size:0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Group (Catalog)</label>
              <div style="position: relative;">
                <div id="modal-group-trigger" style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s;">
                  <span id="modal-group-display" style="font-weight: 600;">Loading...</span>
                  <span id="modal-group-arrow" style="font-size: 0.7rem; color: var(--primary); transition: transform 0.2s; transform: rotate(0deg)">▼</span>
                </div>
                
                <input type="hidden" id="prod-group" />
                
                <div id="modal-group-menu" style="display: none; position: absolute; top: calc(100% + 8px); left: 0; right: 0; background: #1a1a1a; border: 1px solid #333; border-radius: 16px; z-index: 10001; padding: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(10px);">
                  ${catalogs.map(cat => `
                    <div class="modal-group-opt" data-value="${cat}" style="padding: 10px 12px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
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
                <input type="number" id="prod-cost" class="inventory-input" 
                       style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px 12px 30px; border-radius: 12px; outline: none;" 
                       min="0" step="0.01" />
              </div>
            </div>
            
            <div class="form-group" style="flex:1;">
              <label style="display:block; margin-bottom:10px; color:var(--text-muted); font-size:0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Selling Price ($)</label>
              <div style="position: relative;">
                <span style="position: absolute; left: 14px; top: 12px; color: #666;">$</span>
                <input type="number" id="prod-price" class="inventory-input" 
                       style="width: 100%; background: #0f0f0f; border: 1px solid #333; color: #fff; padding: 12px 16px 12px 30px; border-radius: 12px; outline: none;" 
                       min="0" step="0.01" />
              </div>
            </div>
          </div>
          
          <div style="display:flex; gap:16px; justify-content:flex-end;">
            <button id="btn-cancel-prod" style="padding: 14px 28px; border-radius: 14px; background: transparent; border: 1px solid #333; color: var(--text-muted); cursor: pointer; font-weight: 700; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#fff';" onmouseout="this.style.background='transparent'; this.style.color='var(--text-muted)';">Cancel</button>
            <button id="btn-save-prod" class="btn-primary" style="padding: 14px 35px; border-radius: 14px; box-shadow: 0 10px 20px rgba(242, 89, 0, 0.2);">Save Product Changes</button>
          </div>
        </div>
      </div>
    `;
    
    return html;
  },
  
  afterRender: function() {
    const state = window.AppState;
    
    // Tab switching
    document.querySelectorAll('.service-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        activeServiceTab = e.target.dataset.target;
        window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'catalog' }));
      });
    });
    
    // Modals & UI Elements
    const modal = document.getElementById('product-modal');
    const modalTitle = document.getElementById('product-modal-title');
    const prodIdInput = document.getElementById('prod-id');
    const prodNameInput = document.getElementById('prod-name');
    const prodSkuInput = document.getElementById('prod-sku');
    const prodGroupSelect = document.getElementById('prod-group');
    const prodCostInput = document.getElementById('prod-cost');
    const prodPriceInput = document.getElementById('prod-price');
    
    const closeModal = () => {
      modal.style.display = 'none';
      const menu = document.getElementById('modal-group-menu');
      if (menu) menu.style.display = 'none';
      prodIdInput.value = '';
      prodNameInput.value = '';
      prodSkuInput.value = '';
      prodCostInput.value = '';
      prodPriceInput.value = '';
    };
    
    const updateDropdownUI = (val) => {
      const display = document.getElementById('modal-group-display');
      if (display) display.textContent = val;
      if (prodGroupSelect) prodGroupSelect.value = val;
    };
    
    // Add logic
    const addBtn = document.getElementById('btn-add-product');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        modalTitle.textContent = 'Add New Product';
        prodIdInput.value = '';
        prodNameInput.value = '';
        prodSkuInput.value = '';
        updateDropdownUI(activeServiceTab);
        prodCostInput.value = '0.00';
        prodPriceInput.value = '0.00';
        modal.style.display = 'flex';
      });
    }
    
    // Group Dropdown Logic
    const groupTrigger = document.getElementById('modal-group-trigger');
    const groupMenu = document.getElementById('modal-group-menu');
    const groupArrow = document.getElementById('modal-group-arrow');
    
    if (groupTrigger && groupMenu) {
      groupTrigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = groupMenu.style.display === 'block';
        groupMenu.style.display = isOpen ? 'none' : 'block';
        groupTrigger.style.borderColor = isOpen ? '#333' : 'var(--primary)';
        if (groupArrow) groupArrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      };
    }

    document.querySelectorAll('.modal-group-opt').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        updateDropdownUI(val);
        groupMenu.style.display = 'none';
        groupTrigger.style.borderColor = '#333';
        if (groupArrow) groupArrow.style.transform = 'rotate(0deg)';
      };
    });
    
    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
       if (groupMenu && groupMenu.style.display === 'block' && !e.target.closest('#modal-group-trigger') && !e.target.closest('#modal-group-menu')) {
          groupMenu.style.display = 'none';
          groupTrigger.style.borderColor = '#333';
          if (groupArrow) groupArrow.style.transform = 'rotate(0deg)';
       }
    });
    
    // Edit logic
    document.querySelectorAll('.btn-edit-prod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const product = state.products.find(p => p.id === id);
        if (product) {
          modalTitle.textContent = 'Edit Product';
          prodIdInput.value = product.id;
          prodNameInput.value = product.name;
          prodSkuInput.value = product.sku || '';
          updateDropdownUI(product.supplier);
          prodCostInput.value = product.cost.toFixed(2);
          prodPriceInput.value = product.price.toFixed(2);
          modal.style.display = 'flex';
        }
      });
    });
    
    // Deactivate / Toggle logic
    document.querySelectorAll('.toggle-active-prod').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.currentTarget.dataset.id;
        const product = state.products.find(p => p.id === id);
        if (product) {
          product.active = e.target.checked;
          window.saveState();
          window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'catalog' }));
        }
      });
    });
    
    // Initialize GIF hover logic
    window.Utils.initHoverGifs();
    
    // Modal buttons
    document.getElementById('btn-cancel-prod').addEventListener('click', closeModal);
    
    document.getElementById('btn-save-prod').addEventListener('click', () => {
      const name = prodNameInput.value.trim();
      const sku = prodSkuInput.value.trim();
      const group = prodGroupSelect.value;
      const cost = parseFloat(prodCostInput.value) || 0;
      const price = parseFloat(prodPriceInput.value) || 0;
      
      if (!name) return alert('Description is required.');
      
      if (prodIdInput.value) {
        // Edit existing
        const p = state.products.find(p => p.id === prodIdInput.value);
        if (p) {
          p.name = name;
          p.sku = sku;
          p.supplier = group;
          p.cost = cost;
          p.price = price;
        }
      } else {
        // Add new
        const id = 'custom-' + Date.now();
        state.products.push({
          id,
          name,
          sku,
          supplier: group,
          type: 'Hardware', // Assumed default, could be mapped based on supplier
          cost,
          price,
          active: true
        });
      }
      
      window.saveState();
      
      if (this.isSupplierDropdownOpen && !e.target.closest('#supplier-filter-menu') && !e.target.closest('#supplier-filter-trigger')) {
        this.isSupplierDropdownOpen = false;
        window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'catalog' }));
      }
      
      closeModal();
      // Ensure the table we are looking at stays relevant
      activeServiceTab = group;
      window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'inventory_services' }));
    });
  }
};
