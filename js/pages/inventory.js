// js/pages/inventory.js
window.Pages = window.Pages || {};

// NUCLEAR: Global handlers that ALWAYS work
window._whClose = function() {
  const p = window.Pages.inventory;
  p.isStockOutModalOpen = false; p.isStockInModalOpen = false; p.isTransferModalOpen = false;
  p.isStockInSummaryOpen = false; p.isStockOutSummaryOpen = false; p.isTransferSummaryOpen = false;
  // Clear drafts on cancel
  p.stockInDraft = {}; p.stockOutDraft = {}; p.transferDraft = {};
  p.triggerUpdate();
};
window._whTick = function() {
  const p = window.Pages.inventory;
  if (p.isStockInModalOpen) p.isStockInSummaryOpen = true;
  else if (p.isStockOutModalOpen) p.isStockOutSummaryOpen = true;
  else if (p.isTransferModalOpen) p.isTransferSummaryOpen = true;
  p.triggerUpdate(true);
};
window._whFinal = function() {
  const p = window.Pages.inventory;
  const state = window.AppState;
  if (!state.hubActivities) state.hubActivities = [];
  const products = state.products || [];
  let total = 0;
  let activityItems = [];
  let activityArea = '';

  if (p.isStockInSummaryOpen) {
    for (let ar in p.stockInDraft) {
      const draft = p.stockInDraft[ar]; if(!draft) continue;
      for (let pid in draft) {
        if (!draft[pid] || draft[pid] <= 0) continue;
        const inv = state.inventory.find(i => i.productId === pid && i.area === ar);
        if (inv) inv.quantity += draft[pid]; else state.inventory.push({ productId: pid, area: ar, quantity: draft[pid], outlet: ['Hugo','YS','Tai'].includes(ar) ? 'Penang' : 'Ipoh' });
        const prod = products.find(pp => pp.id === pid);
        activityItems.push({ productId: pid, name: prod ? prod.name : pid, qty: draft[pid], area: ar });
        total += draft[pid];
      }
    }
    activityArea = Object.keys(p.stockInDraft).filter(a => Object.values(p.stockInDraft[a] || {}).some(v => v > 0)).join(', ');
    if (total > 0) state.hubActivities.push({ id: 'act-' + Date.now(), type: 'in', source: 'Warehouse', date: new Date().toISOString(), area: activityArea, agent: 'Agent 1', items: activityItems, createdBy: window.AppState.user.displayName });
  } else if (p.isStockOutSummaryOpen) {
    for (let ar in p.stockOutDraft) {
      const draft = p.stockOutDraft[ar]; if(!draft) continue;
      for (let pid in draft) {
        if (!draft[pid] || draft[pid] <= 0) continue;
        const inv = state.inventory.find(i => i.productId === pid && i.area === ar);
        if (inv) inv.quantity -= draft[pid];
        const prod = products.find(pp => pp.id === pid);
        activityItems.push({ productId: pid, name: prod ? prod.name : pid, qty: draft[pid], area: ar });
        total += draft[pid];
      }
    }
    activityArea = Object.keys(p.stockOutDraft).filter(a => Object.values(p.stockOutDraft[a] || {}).some(v => v > 0)).join(', ');
    if (total > 0) state.hubActivities.push({ id: 'act-' + Date.now(), type: 'out', source: 'Warehouse', date: new Date().toISOString(), area: activityArea, agent: 'Agent 1', items: activityItems, createdBy: window.AppState.user.displayName });
  } else if (p.isTransferSummaryOpen) {
    const draft = p.transferDraft[p.transferFromArea] || {};
    activityArea = p.transferFromArea + ' ➔ ' + p.transferToArea;
    for (let pid in draft) {
      if (!draft[pid] || draft[pid] <= 0) continue;
      const f = state.inventory.find(i => i.productId === pid && i.area === p.transferFromArea); if(f) f.quantity -= draft[pid];
      let to = state.inventory.find(i => i.productId === pid && i.area === p.transferToArea);
      if (to) to.quantity += draft[pid]; else state.inventory.push({ productId: pid, area: p.transferToArea, quantity: draft[pid], outlet: ['Hugo','YS','Tai'].includes(p.transferToArea) ? 'Penang' : 'Ipoh' });
      const prod = products.find(pp => pp.id === pid);
      activityItems.push({ productId: pid, name: prod ? prod.name : pid, qty: draft[pid], area: activityArea });
      total += draft[pid];
    }
    if (total > 0) state.hubActivities.push({ id: 'act-' + Date.now(), type: 'transfer', source: 'Warehouse', date: new Date().toISOString(), area: activityArea, agent: 'Agent 1', items: activityItems, createdBy: window.AppState.user.displayName });
  }
  p.successMessage = (total > 0) ? 'Action recorded successfully.' : 'No changes detected.';
  p.showSuccessOverlay = true; p.triggerUpdate(true);
  
  setTimeout(async function() {
    // --- ⚡ ULTRA FAST DELTA SYNC TO FIRESTORE ---
    if (total > 0 && window.firebaseDb) {
        try {
            const db = window.firebaseDb;
            const batch = db.batch();
            
            // 1. Update the specific inventory items that were changed
            const changedProducts = Object.keys(p.isStockInSummaryOpen ? p.stockInDraft : (p.isStockOutSummaryOpen ? p.stockOutDraft : p.transferDraft));
            
            if (p.isTransferSummaryOpen) {
                // Update BOTH areas for transfers
                changedProducts.forEach(pid => {
                    const fromInv = state.inventory.find(i => i.productId === pid && i.area === p.transferFromArea);
                    const toInv = state.inventory.find(i => i.productId === pid && i.area === p.transferToArea);
                    if (fromInv) batch.set(db.collection("inventory_module").doc("data").collection("items").doc(fromInv.productId + '_' + fromInv.area), fromInv);
                    if (toInv) batch.set(db.collection("inventory_module").doc("data").collection("items").doc(toInv.productId + '_' + toInv.area), toInv);
                });
            } else {
                // Update specific areas for stock in/out
                const draftObj = p.isStockInSummaryOpen ? p.stockInDraft : p.stockOutDraft;
                for (let ar in draftObj) {
                    for (let pid in draftObj[ar]) {
                        if (draftObj[ar][pid] > 0) {
                            const inv = state.inventory.find(i => i.productId === pid && i.area === ar);
                            if (inv) batch.set(db.collection("inventory_module").doc("data").collection("items").doc(inv.productId + '_' + inv.area), inv);
                        }
                    }
                }
            }
            
            // 2. Write the new activity log
            const latestAct = state.hubActivities[state.hubActivities.length - 1];
            if (latestAct && latestAct.items && latestAct.items.length > 0) {
                batch.set(db.collection("inventory_module").doc("data").collection("hub_activities").doc(latestAct.id), latestAct);
            }
            
            await batch.commit();
            console.log("⚡ Delta Sync complete for Warehouse Operation");
        } catch (e) {
            console.error("Warehouse Delta Sync Error:", e);
        }
    }

    if (window.saveState) window.saveState(); // Fallback for localStorage only, doesn't mass-sync anymore

    p.showSuccessOverlay = false;
    p.isStockInModalOpen = false; p.isStockOutModalOpen = false; p.isTransferModalOpen = false;
    p.isStockInSummaryOpen = false; p.isStockOutSummaryOpen = false; p.isTransferSummaryOpen = false;
    p.stockInDraft = {}; p.stockOutDraft = {}; p.transferDraft = {};
    p._invalidateCache(); p.triggerUpdate();
  }, 1500);
};

window.Pages.inventory = {
  searchQuery: '',
  filterArea: 'All Areas',
  isDropdownOpen: false,
  isStockOutModalOpen: false,
  stockOutSearchQuery: '',
  stockOutAreaFilter: 'Hugo',
  stockOutGroupFilter: 'All',
  isStockOutSummaryOpen: false,
  stockOutDraft: {}, 
  isStockInModalOpen: false,
  stockInSearchQuery: '',
  stockInAreaFilter: 'Hugo',
  stockInGroupFilter: 'All',
  isStockInSummaryOpen: false,
  stockInDraft: {},
  isTransferModalOpen: false,
  transferSearchQuery: '',
  transferFromArea: 'Hugo',
  transferToArea: 'YS',
  transferGroupFilter: 'All',
  isTransferSummaryOpen: false,
  isTransferFromDropdownOpen: false,
  isTransferToDropdownOpen: false,
  transferDraft: {},
  isStockInAreaDropdownOpen: false,
  isStockOutAreaDropdownOpen: false,
  showSuccessOverlay: false,
  successMessage: '',
  _cachedHardwareProducts: null,
  _cachedMetricsHtml: null,
  _cachedBackgroundTablesHtml: null,
  _lastCacheKey: null,
  _invIndexFast: null,

  _getHardwareProducts: function() {
    if (this._cachedHardwareProducts) return this._cachedHardwareProducts;
    this._cachedHardwareProducts = window.AppState.products.filter(p => p.type === 'Hardware');
    return this._cachedHardwareProducts;
  },

  _whFinal: function() {
    window.incInventoryVersion(); // Force refresh
    window._whFinal();
  },
  _invalidateCache: function() {
    this._cachedHardwareProducts = null;
    this._cachedMetricsHtml = null;
    this._cachedBackgroundTablesHtml = null;
    this._lastCacheKey = null;
  },

  render: function() {
    const portal = document.getElementById('modal-portal');
    if (portal) portal.innerHTML = this.renderModal();
    return this.renderBackground();
  },

  renderBackground: function() {
    const state = window.AppState;
    const hardware = this._getHardwareProducts();
    const inventorySignature = (state.inventory || []).map(inv => `${inv.productId}:${inv.area}:${inv.quantity}`).join('|');
    const currentKey = `${this.filterArea}|${this.searchQuery}|${state.inventory.length}|${state.inventoryVersion || 0}|${inventorySignature}`;
    
    let styleBlock = `<style>
      #modal-portal input::-webkit-outer-spin-button, #modal-portal input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      #modal-portal input[type=number] { -moz-appearance: textfield; }
      .group-pill { padding: 12px 24px; background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); border-radius: 12px 12px 0 0; cursor: pointer; font-weight: 600; margin-right: 6px; outline: none; white-space: nowrap; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
      .group-pill.active { background: rgba(242, 89, 0, 0.1); color: var(--primary); border: 1px solid var(--primary); border-bottom: none; font-weight: 800; box-shadow: 0 -5px 15px rgba(242, 89, 0, 0.15); }
      .group-pill:hover:not(.active) { border-color: var(--primary); color: var(--primary); }
      #btn-modal-final:active, #btn-modal-tick:active { transform: scale(0.9) !important; filter: brightness(1.2); }
      .modal-area-menu { display:none; position:absolute; top:calc(100% + 8px); right:0; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:12px; padding:8px; width:180px; z-index:100; box-shadow:0 15px 40px rgba(0,0,0,0.6); }
      .modal-area-menu.active { display:block; animation: modalIn 0.2s ease-out; }
      @keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    </style>`;

    if (this._lastCacheKey !== currentKey || !this._cachedBackgroundTablesHtml) {
       const idx = {}; 
       state.inventory.forEach(inv => {
         if (!idx[inv.productId]) idx[inv.productId] = { total: 0, ipoh: 0, penang: 0, areas: {} };
         idx[inv.productId].total += inv.quantity;
         if (inv.outlet === 'Ipoh') idx[inv.productId].ipoh += inv.quantity;
         if (inv.outlet === 'Penang') idx[inv.productId].penang += inv.quantity;
         idx[inv.productId].areas[inv.area] = inv.quantity;
       });
       this._invIndexFast = idx;

       const isHub = ['All Areas', 'Penang', 'Ipoh'].includes(this.filterArea);
       let data = hardware.map(p => {
         const s = idx[p.id] || { total: 0, ipoh: 0, penang: 0, areas: {} };
         let q = 0;
         if (isHub) {
            if (this.filterArea === 'All Areas') q = s.total; else if (this.filterArea === 'Ipoh') q = s.ipoh; else q = s.penang;
         } else q = s.areas[this.filterArea] || 0;
         return { ...p, quantity: q };
       });

       const t = { Surftek: 0, Mdot: 0, Swisspac: 0, Low: 0 };
       data.forEach(it => {
         if (it.supplier === 'Surftek') t.Surftek += it.quantity;
         if (it.supplier === 'Mdot') t.Mdot += it.quantity;
         if (it.supplier === 'Swisspac') t.Swisspac += it.quantity;
         if (it.quantity !== 0 && it.quantity < 10) t.Low++;
       });

       this._cachedMetricsHtml = `
         <div class="metric-card" style="border-left: 4px solid #00b4ff; margin:0;"><span class="metric-label">Surftek Stock</span><span class="metric-value" style="color:#00b4ff;">${t.Surftek} <small style="font-size:0.6em; color:var(--text-muted);">PCS</small></span></div>
         <div class="metric-card" style="border-left: 4px solid #EF4444; margin:0;"><span class="metric-label">Mdot Stock</span><span class="metric-value" style="color:#EF4444;">${t.Mdot} <small style="font-size:0.6em; color:var(--text-muted);">PCS</small></span></div>
         <div class="metric-card" style="border-left: 4px solid #9333ea; margin:0;"><span class="metric-label">Swisspac Stock</span><span class="metric-value" style="color:#9333ea;">${t.Swisspac} <small style="font-size:0.6em; color:var(--text-muted);">PCS</small></span></div>
         <div class="metric-card" style="border-left: 4px solid #FFCC00; background:rgba(255,204,0,0.05); margin:0;"><span class="metric-label" style="color:#FFCC00;">Urgent Low Stock</span><span class="metric-value" style="color:#FFCC00;">${t.Low} <small style="font-size:0.6em; color:#FFCC00;">ITEMS</small></span></div>`;

       if (this.searchQuery) {
         const q = this.searchQuery.toLowerCase();
         data = data.filter(it => it.name.toLowerCase().includes(q) || it.supplier.toLowerCase().includes(q));
       }

       this._cachedBackgroundTablesHtml = ['Surftek', 'Mdot', 'Swisspac', 'Other'].map(sup => {
         const sData = data.filter(it => it.supplier === sup && it.quantity !== 0);
         if (this.searchQuery && sData.length === 0) return '';
         const clr = { Surftek:'#00b4ff', Mdot:'#EF4444', Swisspac:'#9333ea', Other:'#C8A2C8' }[sup] || 'var(--text-main)';
         return `
           <div class="card" style="padding: 0; border-radius: 16px; margin-bottom: 30px; border: 1px solid var(--border-color); overflow:hidden;">
             <div style="padding: 18px 24px; border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: space-between;">
               <div style="display:flex; align-items:center; gap: 12px;"><div style="width: 10px; height: 10px; border-radius: 50%; background: ${clr}; box-shadow: 0 0 10px ${clr}"></div><h3 style="margin: 0; font-size: 1.1rem; color: ${clr}; font-weight: 800;">${sup} Hub</h3></div>
               <span style="color: var(--text-muted); font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">${sData.length} Items</span>
             </div>
             <table style="width: 100%; border-collapse: collapse;">
               <thead><tr style="font-size: 0.7rem; color: var(--text-muted); background: rgba(255,255,255,0.01); text-transform:uppercase; letter-spacing:0.1em;"><th style="padding: 15px 24px; text-align:left; width:60%;">Product Name</th><th style="padding:15px; text-align:center;">Balance</th><th style="padding:15px 24px; text-align:right;">Status</th></tr></thead>
               <tbody>${sData.map(it => `<tr style="border-bottom: 1px solid var(--border-color);"><td style="padding: 18px 24px; font-weight: 700;">${it.name}</td><td style="padding: 15px; text-align: center;"><div style="background: var(--bg-main); padding: 8px 12px; border-radius: 8px; border: 1.5px solid var(--border-color); font-weight: 800; color: ${it.quantity < 10 ? '#FFCC00' : 'var(--text-main)'}">${it.quantity} <small style="font-size:0.65em; color:var(--text-muted); font-weight:800; margin-left:2px;">PCS</small></div></td><td style="padding: 18px 24px; text-align: right;"><span style="background: ${it.quantity < 10 ? 'rgba(255, 204, 0, 0.1)' : 'rgba(16,185,129,0.1)'}; color: ${it.quantity < 10 ? '#FFCC00' : 'var(--success)'}; padding: 6px 14px; border-radius: 25px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${it.quantity < 10 ? 'rgba(255, 204, 0, 0.3)' : 'var(--success)'};">${it.quantity < 10 ? 'LOW STOCK' : 'HEALTHY'}</span></td></tr>`).join('')}</tbody>
             </table>
           </div>`;
       }).join('');
       this._lastCacheKey = currentKey;
    }

    const opts = [
      { label: 'All Global Stock', value: 'All Areas', icon: '🌍' },
      { label: 'Penang Hub (Total)', value: 'Penang', icon: '🏙️' },
      { label: 'Ipoh Hub (Total)', value: 'Ipoh', icon: '🏙️' },
      { label: 'Area: Hugo', value: 'Hugo', icon: '📍' },
      { label: 'Area: YS', value: 'YS', icon: '📍' },
      { label: 'Area: Tai', value: 'Tai', icon: '📍' },
      { label: 'Area: KT', value: 'KT', icon: '📍' },
      { label: 'Area: JQ', value: 'JQ', icon: '📍' }
    ];

    return styleBlock + `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/NexInventory.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Inventory Hub</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Real-time warehouse management & inventory oversight.</p>
          </div>
        </div>
      </div>
      <div class="metrics-row" style="margin-bottom: 30px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">${this._cachedMetricsHtml}</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; background: var(--bg-surface); padding: 20px; border-radius: 16px; border: 1px solid var(--border-color); position:relative;">
         <div id="custom-area-trigger" style="display:flex; align-items:center; background: var(--bg-main); border: 2px solid ${this.isDropdownOpen?'var(--primary)':'var(--border-color)'}; padding: 10px 20px; border-radius: 12px; cursor: pointer; transition: all 0.3s; box-shadow: ${this.isDropdownOpen ? '0 0 15px rgba(242, 89, 0, 0.2)' : 'none'};">
            <span style="font-size: 1.2rem; margin-right: 12px;">🏙️</span>
            <div style="display:flex; flex-direction:column;"><span style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 0.05em;">Current View</span><span style="font-weight: 800; color: var(--text-main); font-size: 1.05rem;">${this.filterArea}</span></div>
            <span style="color: var(--primary); font-size: 0.8rem; margin-left: 15px; transition: transform 0.3s; transform: ${this.isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
            ${this.isDropdownOpen ? `<div id="custom-area-menu" style="position: absolute; top: calc(100% + 5px); left: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; width: 220px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 10px; animation: modalIn 0.2s ease-out;">${opts.map(o => `<div class="area-opt" data-value="${o.value}" style="padding: 12px 15px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s; background: ${this.filterArea === o.value ? 'rgba(242, 89, 0, 0.1)' : 'transparent'}; border: 1px solid ${this.filterArea === o.value ? 'var(--primary)' : 'transparent'}"><span style="font-size: 1.1rem;">${o.icon}</span><span style="font-weight: ${this.filterArea === o.value ? '700' : '500'}; color: ${this.filterArea === o.value ? 'var(--primary)' : 'var(--text-main)'}; font-size: 0.95rem;">${o.label}</span></div>`).join('')}</div>` : ''}
         </div>
         <div style="display: flex; align-items: center; gap: 12px;">
            <button id="btn-stock-in" style="width: 44px; height: 44px; border-radius: 50%; border: 2px solid #10B981; background: rgba(16, 185, 129, 0.15); color: #10B981; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);" title="Stock In"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><polyline points="8 10 12 14 16 10"/><line x1="12" y1="2" x2="12" y2="14"/></svg></button>
            <button id="btn-stock-out" title="Manual Stock Out" style="width: 44px; height: 44px; border-radius: 50%; border: 2px solid #EF4444; background: rgba(239, 68, 68, 0.15); color: #EF4444; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="14"/></svg></button>
            <button id="btn-stock-transfer" title="Stock Transfer" style="width: 44px; height: 44px; border-radius: 50%; border: 2px solid #00b4ff; background: rgba(0, 180, 255, 0.15); color: #00b4ff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 0 15px rgba(0, 180, 255, 0.6);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg></button>
            <input type="text" id="inventory-search" placeholder="Search product..." value="${this.searchQuery}" style="padding: 12px 20px; border: 2px solid var(--border-color); border-radius: 12px; background: var(--bg-main); color: var(--text-main); width: 280px; outline: none; font-size: 0.95rem;">
         </div>
      </div>
      ${this._cachedBackgroundTablesHtml}`;
  },

  renderModal: function() {
    if (this.showSuccessOverlay) {
       const clr = this.isStockInModalOpen ? '#10B981' : (this.isTransferModalOpen ? '#00b4ff' : '#EF4444');
       return `<div class="modal-overlay active" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 10002; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(10px); animation: modalIn 0.3s;"><div style="text-align: center; color: white;"><div style="width: 80px; height: 80px; border-radius: 50%; background: ${clr}; display:flex; align-items:center; justify-content:center; margin: 0 auto 24px; box-shadow: 0 0 30px ${clr}80;"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 10px;">Done!</h2><p style="font-size: 1.1rem; opacity: 0.9;">${this.successMessage}</p></div></div>`;
    }
    const idx = this._invIndexFast || {};
    const hardware = this._getHardwareProducts();
    const groups = ['All', 'Surftek', 'Mdot', 'Swisspac', 'Other'];
    const areas = ['Hugo', 'YS', 'Tai', 'KT', 'JQ'];

    const renderHeader = (title, areaLabel, currentArea, isDropdownOpen, triggerId, icon, mode='edit', draftObj={}) => {
      const isRed = title.includes('Out');
      const isBlue = title.includes('Transfer');
      const primaryClr = isRed ? '#EF4444' : (isBlue ? '#00b4ff' : '#10B981');
      const draftAreasCount = Object.keys(draftObj).filter(a => Object.values(draftObj[a]).some(v => v > 0)).length;
      return `<div style="padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.02); flex-shrink: 0;">
                <div style="display:flex; align-items:center; gap: 12px;">
                  <div style="width: 40px; height: 40px; border-radius: 12px; background: ${primaryClr}1A; border: 1.5px solid ${primaryClr}; color: ${primaryClr}; display:flex; align-items:center; justify-content:center; flex-shrink: 0;">${icon}</div>
                  <h3 style="margin: 0; color: var(--text-main); font-size: 1.15rem; font-weight: 800; letter-spacing:-0.02em;">${title}</h3>
                </div>
                <div style="display:flex; align-items:center; gap: 16px;">
                  ${mode === 'edit' ? `<div id="${triggerId}" style="display:flex; align-items:center; gap:8px; cursor:pointer; background:${primaryClr}1A; padding:10px 16px; border-radius:10px; border: 1px solid ${primaryClr}33; position:relative; min-width:140px;">
                        <div style="display:flex; flex-direction:column;">
                          <span style="font-size:0.65rem; color:${primaryClr}; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:1px;">${areaLabel}</span>
                          <span style="font-size:0.95rem; font-weight:900; color:${primaryClr};">${currentArea}</span>
                        </div>
                        <span style="font-size:0.7rem; color:${primaryClr}; margin-left:auto;">▼</span>
                        <div class="modal-area-menu" id="${triggerId}-menu">${areas.map(a => `<div class="${triggerId.replace('trigger','opt')}" data-area="${a}" style="padding:10px 12px; border-radius:8px; font-weight:800; font-size:0.9rem; color:${currentArea===a?primaryClr:'var(--text-main)'}; background:${currentArea===a?primaryClr+'1A':'transparent'}; margin-bottom:4px; cursor:pointer;">${a}</div>`).join('')}</div>
                    </div>` : `<div style="text-align:right;"><span style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block;">Batch Status</span><span style="font-size:0.9rem; font-weight:900; color:var(--text-main);">${draftAreasCount} Areas Selected</span></div>`}
                  <div style="width:1px; height:30px; background:var(--border-color); margin:0 4px;"></div>
                  <div style="display:flex; align-items:center; gap: 10px;">
                    <button id="btn-modal-close" onclick="window._whClose()" style="width: 44px; height: 44px; border-radius: 50%; background: #EF44441A; color: #EF4444; border: 1.5px solid #EF444433; cursor: pointer; display:flex; justify-content:center; align-items:center;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    ${mode === 'edit' ? `<button id="btn-modal-tick" onclick="window._whTick()" style="width: 44px; height: 44px; border-radius: 50%; background: ${primaryClr}; color: white; border: none; cursor: pointer; display:flex; justify-content:center; align-items:center; box-shadow: 0 0 20px ${primaryClr}66;"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>` : 
                     `<button id="btn-modal-final" onclick="window._whFinal()" style="width: 44px; height: 44px; border-radius: 50%; background: ${primaryClr}; color: white; border: none; cursor: pointer; display:flex; justify-content:center; align-items:center; box-shadow: 0 0 20px ${primaryClr}66;"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>`}
                  </div>
                </div>
              </div>`;
    };

    const renderFilterBar = (currentGroup, type) => {
      return `<div style="display:flex; align-items:flex-end; padding: 0 24px; background: rgba(0,0,0,0.05); position:relative; top:1px; z-index:2; overflow-x:auto; scrollbar-width: none; border-bottom: 1px solid var(--border-color);">
                ${groups.map(g => `<div class="group-pill ${currentGroup===g?'active':''}" data-group="${g}" data-type="${type}">${g}</div>`).join('')}
              </div>`;
    };

    if (this.isStockOutModalOpen) {
       if (this.isStockOutSummaryOpen) {
          return `<div class="modal-overlay active" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(8px);">
            <div class="modal-content" style="background: var(--bg-surface); border: 1.5px solid #EF4444; border-radius: 24px; width: 560px; max-height: 70vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 0 40px rgba(239, 68, 68, 0.2); animation: modalIn 0.3s;">
              ${renderHeader('Stock Out Summary', 'Source', this.stockOutAreaFilter, false, '', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2.5"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="14"/></svg>', 'summary', this.stockOutDraft)}
              <div style="flex:1; overflow-y:auto; padding:16px 20px;">
                 ${Object.keys(this.stockOutDraft).map(area => {
                    const d = this.stockOutDraft[area]; if(!d) return '';
                    const items = Object.keys(d).filter(pid => d[pid] > 0);
                    if (items.length === 0) return '';
                    const areaTotal = items.reduce((s, pid) => s + d[pid], 0);
                    return `<div style="margin-bottom:12px; border-radius:10px; overflow:hidden; border:1px solid rgba(239,68,68,0.2);">
                      <div style="padding:8px 14px; background:rgba(239,68,68,0.08); display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.8rem; font-weight:800; color:#EF4444; letter-spacing:0.05em;">📍 ${area}</span>
                        <span style="font-size:0.7rem; font-weight:700; color:#EF4444; background:rgba(239,68,68,0.15); padding:3px 10px; border-radius:12px;">-${areaTotal} PCS</span>
                      </div>
                      <table style="width:100%; border-collapse:collapse;">
                        ${items.map(pid => `<tr style="border-top:1px solid var(--border-color);"><td style="padding:8px 14px; font-size:0.78rem; font-weight:600; color:var(--text-main);">${hardware.find(p=>p.id===pid)?.name}</td><td style="padding:8px 14px; text-align:right; font-size:0.78rem; font-weight:800; color:#EF4444; white-space:nowrap;">-${d[pid]}</td></tr>`).join('')}
                      </table>
                    </div>`;
                 }).join('')}
              </div>
              <div style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15); border-top:1px solid var(--border-color);">
                <button id="btn-summary-back" style="padding:8px 18px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-main); font-weight:700; font-size:0.8rem; cursor:pointer;">← Back</button>
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">Click ✓ to confirm</span>
              </div>
            </div></div>`;
       }
       const soFilter = this.stockOutGroupFilter;
       return `<div class="modal-overlay active" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px);">
            <div class="modal-content" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; width: 900px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: modalIn 0.3s;">
              ${renderHeader('Stock Out Form', 'Source', this.stockOutAreaFilter, this.isStockOutAreaDropdownOpen, 'so-area-trigger', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2.5"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="14"/></svg>', 'edit', this.stockOutDraft)}
              ${renderFilterBar(this.stockOutGroupFilter, 'so')}
              <div style="flex:1; overflow-y:auto; padding:0; background:var(--bg-main);">
                <table style="width:100%; border-collapse:collapse;">
                  <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:10;"><tr style="font-size:0.7rem; color:var(--text-muted);"><th style="padding:16px 24px; text-align:left;">Product</th><th style="padding:16px 24px; text-align:center;">Balance</th><th style="padding:16px 24px; text-align:right;">Reduction</th></tr></thead>
                  <tbody>${hardware.map(it => `<tr data-supplier="${it.supplier}" style="border-bottom: 1px solid var(--border-color); ${soFilter !== 'All' && it.supplier !== soFilter ? 'display:none;' : ''}"><td style="padding:16px 24px; font-weight:700;">${it.name}</td><td style="padding:16px 24px; text-align:center;">${idx[it.id]?.areas[this.stockOutAreaFilter] || 0}</td><td style="padding:16px 24px; text-align:right;"><input type="number" class="so-bulk-qty-input" data-pid="${it.id}" value="${this.stockOutDraft[this.stockOutAreaFilter]?.[it.id] || ''}" style="width:80px; padding:10px; border-radius:8px; background:var(--bg-surface); color:white; border:1px solid var(--border-color); text-align:center;"></td></tr>`).join('')}</tbody>
                </table>
              </div>
            </div>
          </div>`;
    }

    if (this.isStockInModalOpen) {
        if (this.isStockInSummaryOpen) {
            return `<div class="modal-overlay active" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(8px);">
              <div class="modal-content" style="background: var(--bg-surface); border: 2px solid #10B981; border-radius: 20px; width: 560px; max-height: 70vh; display: flex; flex-direction: column; overflow: hidden; animation: modalIn 0.3s;">
                ${renderHeader('Summary', 'Target', this.stockInAreaFilter, false, '', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2.5"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><polyline points="8 10 12 14 16 10"/><line x1="12" y1="2" x2="12" y2="14"/></svg>', 'summary', this.stockInDraft)}
                <div style="flex:1; overflow-y:auto; padding:16px 20px;">
                   ${Object.keys(this.stockInDraft).map(area => {
                      const d = this.stockInDraft[area]; if(!d) return '';
                      const items = Object.keys(d).filter(pid => d[pid] > 0);
                      if (items.length === 0) return '';
                      const areaTotal = items.reduce((s, pid) => s + d[pid], 0);
                      return `<div style="margin-bottom:12px; border-radius:10px; overflow:hidden; border:1px solid rgba(16,185,129,0.2);">
                        <div style="padding:8px 14px; background:rgba(16,185,129,0.08); display:flex; justify-content:space-between; align-items:center;">
                          <span style="font-size:0.8rem; font-weight:800; color:#10B981; letter-spacing:0.05em;">📍 ${area}</span>
                          <span style="font-size:0.7rem; font-weight:700; color:#10B981; background:rgba(16,185,129,0.15); padding:3px 10px; border-radius:12px;">+${areaTotal} PCS</span>
                        </div>
                        <table style="width:100%; border-collapse:collapse;">
                          ${items.map(pid => `<tr style="border-top:1px solid var(--border-color);"><td style="padding:8px 14px; font-size:0.78rem; font-weight:600; color:var(--text-main);">${hardware.find(p=>p.id===pid)?.name}</td><td style="padding:8px 14px; text-align:right; font-size:0.78rem; font-weight:800; color:#10B981; white-space:nowrap;">+${d[pid]}</td></tr>`).join('')}
                        </table>
                      </div>`;
                   }).join('')}
                </div>
                <div style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15); border-top:1px solid var(--border-color);">
                  <button id="btn-summary-back" style="padding:8px 18px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-main); font-weight:700; font-size:0.8rem; cursor:pointer;">← Back</button>
                  <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">Click ✓ to confirm</span>
                </div>
              </div></div>`;
        }
        const siFilter = this.stockInGroupFilter;
        return `<div class="modal-overlay active" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px);">
            <div class="modal-content" style="background: var(--bg-surface); border: 2px solid #10B981; border-radius: 20px; width: 900px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; animation: modalIn 0.3s;">
              ${renderHeader('Stock In Form', 'Target', this.stockInAreaFilter, this.isStockInAreaDropdownOpen, 'si-area-trigger', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2.5"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><polyline points="8 10 12 14 16 10"/><line x1="12" y1="2" x2="12" y2="14"/></svg>', 'edit', this.stockInDraft)}
              ${renderFilterBar(this.stockInGroupFilter, 'si')}
              <div style="flex:1; overflow-y:auto; padding:0; background:var(--bg-main);">
                <table style="width:100%; border-collapse:collapse;">
                  <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:10;"><tr style="font-size:0.7rem; color:var(--text-muted);"><th style="padding:16px 24px; text-align:left;">Product (${hardware.filter(it => siFilter === 'All' || it.supplier === siFilter).length})</th><th style="padding:16px 24px; text-align:center;">Current</th><th style="padding:16px 24px; text-align:right;">Add Qty</th></tr></thead>
                  <tbody>${hardware.map(it => `<tr data-supplier="${it.supplier}" style="border-bottom: 1px solid var(--border-color); ${siFilter !== 'All' && it.supplier !== siFilter ? 'display:none;' : ''}"><td style="padding:16px 24px; font-weight:700;">${it.name}</td><td style="padding:16px 24px; text-align:center;">${idx[it.id]?.areas[this.stockInAreaFilter] || 0}</td><td style="padding:16px 24px; text-align:right;"><input type="number" class="si-bulk-qty-input" data-pid="${it.id}" value="${this.stockInDraft[this.stockInAreaFilter]?.[it.id] || ''}" style="width:80px; padding:10px; border-radius:8px; background:var(--bg-surface); color:white; border:1px solid var(--border-color); text-align:center;"></td></tr>`).join('')}</tbody>
                </table>
              </div>
            </div>
          </div>`;
    }

    if (this.isTransferModalOpen) {
       if (this.isTransferSummaryOpen) {
          const trDraft = this.transferDraft[this.transferFromArea] || {};
          const trItems = Object.keys(trDraft).filter(pid => trDraft[pid] > 0);
          const trTotal = trItems.reduce((s, pid) => s + trDraft[pid], 0);
          return `<div class="modal-overlay active" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(8px);">
            <div class="modal-content" style="background: var(--bg-surface); border: 1.5px solid #00b4ff; border-radius: 24px; width: 560px; max-height: 70vh; display: flex; flex-direction: column; overflow: hidden; animation: modalIn 0.3s;">
              ${renderHeader('Transfer Verification', 'Route', `${this.transferFromArea} ➔ ${this.transferToArea}`, false, '', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>', 'summary')}
              <div style="flex:1; overflow-y:auto; padding:16px 20px;">
                <div style="margin-bottom:12px; border-radius:10px; overflow:hidden; border:1px solid rgba(0,180,255,0.2);">
                  <div style="padding:8px 14px; background:rgba(0,180,255,0.08); display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem; font-weight:800; color:#00b4ff; letter-spacing:0.05em;">📍 ${this.transferFromArea} ➔ ${this.transferToArea}</span>
                    <span style="font-size:0.7rem; font-weight:700; color:#00b4ff; background:rgba(0,180,255,0.15); padding:3px 10px; border-radius:12px;">${trTotal} PCS</span>
                  </div>
                  <table style="width:100%; border-collapse:collapse;">
                    ${trItems.map(pid => `<tr style="border-top:1px solid var(--border-color);"><td style="padding:8px 14px; font-size:0.78rem; font-weight:600; color:var(--text-main);">${hardware.find(p=>p.id===pid)?.name}</td><td style="padding:8px 14px; text-align:right; font-size:0.78rem; font-weight:800; color:#00b4ff; white-space:nowrap;">${trDraft[pid]}</td></tr>`).join('')}
                  </table>
                </div>
              </div>
              <div style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15); border-top:1px solid var(--border-color);">
                <button id="btn-summary-back" style="padding:8px 18px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-main); font-weight:700; font-size:0.8rem; cursor:pointer;">← Back</button>
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">Click ✓ to confirm</span>
              </div>
            </div></div>`;
       }
       const trFromArea = this.transferFromArea;
       return `<div class="modal-overlay active" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px);">
          <div class="modal-content" style="background: var(--bg-surface); border: 2px solid #00b4ff; border-radius: 20px; width: 850px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; animation: modalIn 0.3s;">
            <div style="padding: 18px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(0, 180, 255, 0.03); border-radius: 20px 20px 0 0; flex-shrink:0; position:relative; z-index:20;">
              <div style="display:flex; align-items:center; gap: 12px;">
                 <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(0, 180, 255, 0.1); border: 1.5px solid #00b4ff; color: #00b4ff; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg></div>
                 <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color:var(--text-main);">Transfer Request</h3>
              </div>
              <div style="display:flex; align-items:center; gap: 10px;">
                <div id="tr-from-trigger" style="display:flex; align-items:center; gap:8px; cursor:pointer; background:rgba(0,180,255,0.1); padding:10px 16px; border-radius:10px; border:1px solid #00b4ff33; position:relative; min-width: 170px;">
                  <div style="display:flex; flex-direction:column;"><span style="font-size:0.6rem; color:#00b4ff; font-weight:800; text-transform:uppercase; letter-spacing:0.05em;">FROM</span><span style="font-size:0.95rem; font-weight:900; color:#00b4ff;">${this.transferFromArea}</span></div>
                  <span style="font-size:0.7rem; color:#00b4ff; margin-left:auto;">▼</span>
                  <div class="modal-area-menu" id="tr-from-trigger-menu" style="right:0; left:auto; width:160px;">${areas.map(a => `<div class="tr-from-area-opt" data-area="${a}" style="padding:12px 16px; font-size:0.9rem; font-weight:700; color:${this.transferFromArea===a?'#00b4ff':'white'}; background:${this.transferFromArea===a?'rgba(0,180,255,0.1)':'transparent'}; cursor:pointer; border-radius:8px; margin-bottom:2px;">${a}</div>`).join('')}</div>
                </div>
                <span style="color:#00b4ff; font-size:1.2rem; font-weight:800;">➔</span>
                <div id="tr-to-trigger" style="display:flex; align-items:center; gap:8px; cursor:pointer; background:rgba(0,180,255,0.1); padding:10px 16px; border-radius:10px; border:1px solid #00b4ff33; position:relative; min-width: 170px;">
                  <div style="display:flex; flex-direction:column;"><span style="font-size:0.6rem; color:#00b4ff; font-weight:800; text-transform:uppercase; letter-spacing:0.05em;">TO</span><span style="font-size:0.95rem; font-weight:900; color:#00b4ff;">${this.transferToArea}</span></div>
                  <span style="font-size:0.7rem; color:#00b4ff; margin-left:auto;">▼</span>
                  <div class="modal-area-menu" id="tr-to-trigger-menu" style="right:0; left:auto; width:160px;">${areas.map(a => `<div class="tr-to-area-opt" data-area="${a}" style="padding:12px 16px; font-size:0.9rem; font-weight:700; color:${this.transferToArea===a?'#00b4ff':'white'}; background:${this.transferToArea===a?'rgba(0,180,255,0.1)':'transparent'}; cursor:pointer; border-radius:8px; margin-bottom:2px;">${a}</div>`).join('')}</div>
                </div>
                <div style="width:1px; height:30px; background:var(--border-color); margin:0 4px;"></div>
                <button id="btn-modal-close" onclick="window._whClose()" style="width: 42px; height: 42px; border-radius: 50%; background: #EF44441A; color: #EF4444; border: 1.5px solid #EF444433; cursor: pointer; display:flex; align-items:center; justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                <button id="btn-modal-tick" onclick="window._whTick()" style="width: 42px; height: 42px; border-radius: 50%; background: #00b4ff; color: white; border:none; box-shadow: 0 0 15px #00b4ff66; cursor:pointer; display:flex; align-items:center; justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></button>
              </div>
            </div>
            <div style="flex:1; overflow-y:auto;">
              <table style="width:100%; border-collapse:collapse;">
                <thead style="position:sticky; top:0; background:var(--bg-surface);"><tr style="font-size:0.7rem; color:var(--text-muted);"><th style="padding:16px 24px; text-align:left;">Product (${hardware.filter(it => (idx[it.id]?.areas[trFromArea] || 0) > 0).length})</th><th style="padding:16px 24px; text-align:center;">Available (From)</th><th style="padding:16px 24px; text-align:center;">Move</th><th style="padding:16px 24px; text-align:right;">Available (To)</th></tr></thead>
                <tbody>${hardware.map(it => { const availFrom = idx[it.id]?.areas[trFromArea] || 0; const availTo = idx[it.id]?.areas[this.transferToArea] || 0; return `<tr style="border-bottom: 1px solid var(--border-color); ${availFrom <= 0 ? 'display:none;' : ''}"><td style="padding:16px 24px; font-weight:700;">${it.name}</td><td style="padding:16px 24px; text-align:center;">${availFrom}</td><td style="padding:16px 24px; text-align:center;"><input type="number" class="tr-bulk-qty-input" data-pid="${it.id}" data-max="${availFrom}" value="${this.transferDraft[trFromArea]?.[it.id] || ''}" style="width:80px; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-surface); text-align:center; color:white;"></td><td style="padding:16px 24px; text-align:right;">${availTo}</td></tr>`; }).join('')}</tbody>
              </table>
            </div>
          </div>
       </div>`;
    }

    return '';
  },

  afterRender: function() {
    const p = window.Pages.inventory;
    const bindEl = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    const bindAll = (sel, fn, evtType = 'click') => { 
        document.querySelectorAll(sel).forEach(el => {
            if (evtType === 'input') el.oninput = fn;
            else el.onclick = fn;
        }); 
    };

    // Fast Toggles (No Re-render)
    const toggleMenu = (triggerId) => {
        const menu = document.getElementById(triggerId + '-menu');
        if (menu) menu.classList.toggle('active');
    };

    bindEl('btn-modal-close', () => { p.isStockOutModalOpen = false; p.isStockInModalOpen = false; p.isTransferModalOpen = false; p.triggerUpdate(); });
    
    bindEl('btn-modal-tick', () => { 
        if (p.isStockInModalOpen) p.isStockInSummaryOpen = true; 
        else if (p.isStockOutModalOpen) p.isStockOutSummaryOpen = true; 
        else if (p.isTransferModalOpen) p.isTransferSummaryOpen = true; 
        p.triggerUpdate(true); 
    });

    bindEl('btn-modal-final', () => { window._whFinal(); });

    bindEl('btn-summary-back', () => { p.isStockInSummaryOpen = false; p.isStockOutSummaryOpen = false; p.isTransferSummaryOpen = false; p.triggerUpdate(true); });

    // Background Layer
    bindEl('btn-stock-in', (e) => { e.stopPropagation(); p.isStockInModalOpen = true; p.triggerUpdate(true); });
    bindEl('btn-stock-out', (e) => { e.stopPropagation(); p.isStockOutModalOpen = true; p.triggerUpdate(true); });
    bindEl('btn-stock-transfer', (e) => { e.stopPropagation(); p.isTransferModalOpen = true; p.triggerUpdate(true); });
    bindEl('custom-area-trigger', (e) => { e.stopPropagation(); p.isDropdownOpen = !p.isDropdownOpen; p.triggerUpdate(); });
    bindAll('.area-opt', (e) => { e.stopPropagation(); p.filterArea = e.currentTarget.dataset.value; p.isDropdownOpen = false; p.triggerUpdate(); });
    
    // Search (debounced to prevent lag)
    const sInp = document.getElementById('inventory-search');
    if (sInp) {
      let _searchTimer;
      sInp.oninput = (e) => { 
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => { p.searchQuery = e.target.value; p.triggerUpdate(); }, 300);
      };
    }

    // Modal Area Toggles - FAST DOM PATCHING (no re-render)
    const fastAreaSwitch = (areaKey, newArea, inputClass, draftGetter, triggerEl) => {
      const idx = p._invIndexFast || {};
      // 1. Close dropdown
      const menu = document.getElementById(triggerEl + '-menu');
      if (menu) menu.classList.remove('active');
      // 2. Update the label text
      const trigger = document.getElementById(triggerEl);
      if (trigger) {
        const label = trigger.querySelector('span[style*="font-weight:900"]') || trigger.querySelector('span:last-of-type');
        if (label) label.textContent = newArea;
      }
      // 3. Patch each row's "Current" value and restore saved draft
      const draft = draftGetter(newArea);
      document.querySelectorAll('.' + inputClass).forEach(inp => {
        const pid = inp.dataset.pid;
        const row = inp.closest('tr');
        const avail = idx[pid]?.areas[newArea] || 0;
        if (row) {
          const cells = row.querySelectorAll('td');
          if (cells[1]) cells[1].textContent = avail;
        }
        inp.dataset.max = avail;
        inp.value = draft?.[pid] || '';
      });
    };

    bindEl('si-area-trigger', () => toggleMenu('si-area-trigger'));
    bindAll('.si-area-opt', (e) => {
      e.stopPropagation();
      const newArea = e.currentTarget.dataset.area;
      p.stockInAreaFilter = newArea;
      fastAreaSwitch('stockInAreaFilter', newArea, 'si-bulk-qty-input', (a) => p.stockInDraft[a], 'si-area-trigger');
    });
    
    bindEl('so-area-trigger', () => toggleMenu('so-area-trigger'));
    bindAll('.so-area-opt', (e) => {
      e.stopPropagation();
      const newArea = e.currentTarget.dataset.area;
      p.stockOutAreaFilter = newArea;
      fastAreaSwitch('stockOutAreaFilter', newArea, 'so-bulk-qty-input', (a) => p.stockOutDraft[a], 'so-area-trigger');
    });
    
    bindEl('tr-from-trigger', () => toggleMenu('tr-from-trigger'));
    bindAll('.tr-from-area-opt', (e) => {
      e.stopPropagation();
      const newArea = e.currentTarget.dataset.area;
      p.transferFromArea = newArea;
      // Close menu
      const menu = document.getElementById('tr-from-trigger-menu');
      if (menu) menu.classList.remove('active');
      // Update label
      const trigger = document.getElementById('tr-from-trigger');
      if (trigger) { const lbl = trigger.querySelector('span[style*="font-weight:900"]'); if (lbl) lbl.textContent = newArea; }
      // Update Available column + show/hide rows based on stock
      const idx = p._invIndexFast || {};
      document.querySelectorAll('.tr-bulk-qty-input').forEach(inp => {
        const pid = inp.dataset.pid;
        const row = inp.closest('tr');
        const avail = idx[pid]?.areas[newArea] || 0;
        if (row) {
          const cells = row.querySelectorAll('td');
          if (cells[1]) cells[1].textContent = avail;
          row.style.display = avail > 0 ? '' : 'none';
        }
        inp.dataset.max = avail; // Update max for validation
        const draft = p.transferDraft[newArea];
        inp.value = draft?.[pid] || '';
      });
    });
    
    bindEl('tr-to-trigger', () => toggleMenu('tr-to-trigger'));
    bindAll('.tr-to-area-opt', (e) => {
      e.stopPropagation();
      const newArea = e.currentTarget.dataset.area;
      p.transferToArea = newArea;
      // Close menu
      const menu = document.getElementById('tr-to-trigger-menu');
      if (menu) menu.classList.remove('active');
      // Update label
      const trigger = document.getElementById('tr-to-trigger');
      if (trigger) { const lbl = trigger.querySelector('span[style*="font-weight:900"]'); if (lbl) lbl.textContent = newArea; }
      // Patch Available (To) column (index 3)
      const idx = p._invIndexFast || {};
      document.querySelectorAll('.tr-bulk-qty-input').forEach(inp => {
        const pid = inp.dataset.pid;
        const row = inp.closest('tr');
        if (row) {
          const cells = row.querySelectorAll('td');
          if (cells[3]) cells[3].textContent = idx[pid]?.areas[newArea] || 0;
        }
      });
    });

    // Group Pills - FAST DOM SHOW/HIDE (no re-render)
    bindAll('.group-pill', (e) => {
        const type = e.currentTarget.dataset.type;
        const group = e.currentTarget.dataset.group;
        if (type === 'so') p.stockOutGroupFilter = group;
        if (type === 'si') p.stockInGroupFilter = group;
        // 1. Update active pill styling
        document.querySelectorAll('.group-pill[data-type="' + type + '"]').forEach(pill => {
            pill.classList.toggle('active', pill.dataset.group === group);
        });
        // 2. Show/hide rows by supplier
        const inputClass = type === 'si' ? 'si-bulk-qty-input' : 'so-bulk-qty-input';
        document.querySelectorAll('.' + inputClass).forEach(inp => {
            const row = inp.closest('tr');
            if (row) {
                const sup = row.dataset.supplier;
                row.style.display = (group === 'All' || sup === group) ? '' : 'none';
            }
        });
    }, 'click');

    // Quantity Inputs (NO RE-RENDER - NO LAG)
    bindAll('.si-bulk-qty-input', (e) => { if(!p.stockInDraft[p.stockInAreaFilter]) p.stockInDraft[p.stockInAreaFilter] = {}; p.stockInDraft[p.stockInAreaFilter][e.target.dataset.pid] = parseInt(e.target.value) || 0; }, 'input');
    bindAll('.so-bulk-qty-input', (e) => { if(!p.stockOutDraft[p.stockOutAreaFilter]) p.stockOutDraft[p.stockOutAreaFilter] = {}; p.stockOutDraft[p.stockOutAreaFilter][e.target.dataset.pid] = parseInt(e.target.value) || 0; }, 'input');
    bindAll('.tr-bulk-qty-input', (e) => { 
        let val = parseInt(e.target.value) || 0;
        const max = parseInt(e.target.dataset.max) || 0;
        if (val > max) { val = max; e.target.value = max; }
        if(!p.transferDraft[p.transferFromArea]) p.transferDraft[p.transferFromArea] = {}; 
        p.transferDraft[p.transferFromArea][e.target.dataset.pid] = val; 
    }, 'input');
  },

  triggerUpdate: function(onlyPortal = false) {
    if (onlyPortal) {
      const p = document.getElementById('modal-portal');
      if (p) { p.innerHTML = this.renderModal(); this.afterRender(); return; }
    }
    // FAST PATH: Skip navigateTo overhead, update DOM directly
    const viewContainer = document.getElementById('app-view');
    const portal = document.getElementById('modal-portal');
    this._invalidateCache();
    if (portal) portal.innerHTML = this.renderModal();
    if (viewContainer) viewContainer.innerHTML = this.renderBackground();
    this.afterRender();
  }
};
