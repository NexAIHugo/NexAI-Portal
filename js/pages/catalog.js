// js/pages/catalog.js
window.Pages = window.Pages || {};
window.Pages.hub_activity = {
  selectedType: 'all', 
  selectedSupplier: 'all',
  isSupplierDropdownOpen: false,

  filterMode: 'all', // 'all', 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom'
  dateFrom: null,
  dateTo: null,
  isCalendarOpen: false,
  calLeftMonth: null,
  calRightMonth: null,
  tempFrom: null,
  tempTo: null,

  init: function() {
    if (!this.calLeftMonth) {
      const now = new Date();
      this.calLeftMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      this.calRightMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  },

  getDateRange: function() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from = null, to = null;

    switch (this.filterMode) {
      case 'today': from = to = today; break;
      case 'yesterday': from = to = new Date(today.getTime() - 86400000); break;
      case 'this_week': {
        const day = today.getDay();
        from = new Date(today.getTime() - day * 86400000);
        to = today;
        break;
      }
      case 'this_month':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'last_month':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'custom':
        from = this.dateFrom;
        to = this.dateTo;
        break;
      default: return { from: null, to: null };
    }
    return { from, to };
  },

  formatDate: function(d) {
    if (!d) return '—';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  parseInvDate: function(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr);
  },

  renderProfitChart: function(filteredInvoices, range) {
    if (!filteredInvoices || filteredInvoices.length === 0) return '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.8rem;">No data for chart</div>';

    // Group margins by day (or month if range is long)
    const points = {};
    filteredInvoices.forEach(inv => {
      const d = this.parseInvDate(inv.date);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!points[key]) points[key] = { rev: 0, profit: 0 };
      
      inv.items.forEach(item => {
        const prod = window.AppState.products.find(p => p.id === item.productId);
        if (prod) {
          const rev = prod.price * item.qty;
          const cost = prod.cost * item.qty;
          points[key].rev += rev;
          points[key].profit += (rev - cost);
        }
      });
    });

    const sortedKeys = Object.keys(points).sort();
    if (sortedKeys.length === 0) return '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.8rem;">No sales data found</div>';

    const margins = sortedKeys.map(k => points[k].rev > 0 ? (points[k].profit / points[k].rev) * 100 : 0);
    const maxMargin = Math.max(...margins, 10);
    const minMargin = Math.min(...margins, 0);
    const rangeVal = (maxMargin - minMargin) || 1; // Prevent division by zero

    const width = 450;
    const height = 140;
    const padding = 20;

    const getX = (i) => {
      if (margins.length === 1) return width / 2; // Center the single point
      return padding + (i / (margins.length - 1)) * (width - padding * 2);
    };
    const getY = (m) => height - padding - ((m - minMargin) / rangeVal) * (height - padding * 2);

    let path = `M ${getX(0)} ${getY(margins[0])}`;
    if (margins.length > 1) {
      for (let i = 1; i < margins.length; i++) {
          const cp1x = getX(i - 0.5);
          const cp1y = getY(margins[i - 1]);
          const cp2x = getX(i - 0.5);
          const cp2y = getY(margins[i]);
          path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${getX(i)} ${getY(margins[i])}`;
      }
    } else {
      // For a single point, just draw a small horizontal line to make it visible
      path = `M ${getX(0)-20} ${getY(margins[0])} L ${getX(0)+20} ${getY(margins[0])}`;
    }

    const fillPath = `${path} L ${getX(margins.length - 1)} ${height} L ${getX(0)} ${height} Z`;

    return `
      <div style="width: 100%; height: 100%; background: rgba(255,255,255,0.02); border-radius: 20px; border: 1px solid var(--border-color); padding: 15px; position: relative; overflow: hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
          <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Profit Margin Trend (%)</span>
          <span style="font-size: 0.8rem; font-weight: 800; color: #fbbf24;">${margins[margins.length-1].toFixed(1)}% Current</span>
        </div>
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: calc(100% - 25px); overflow: visible;">
          <defs>
            <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#fbbf24" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d="${fillPath}" fill="url(#marginGrad)" />
          <path d="${path}" fill="none" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          ${margins.map((m, i) => `
            <circle cx="${getX(i)}" cy="${getY(m)}" r="4" fill="var(--bg-surface)" stroke="#fbbf24" stroke-width="2" />
          `).join('')}
        </svg>
      </div>
    `;
  },

  renderCalendarMonth: function(monthDate, position) {
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
    const monthName = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const range = { from: this.tempFrom || this.dateFrom, to: this.tempTo || this.dateTo };
    const today = new Date();
    today.setHours(0,0,0,0);

    let daysHtml = '';
    // Paddings
    for (let i = 0; i < firstDay; i++) daysHtml += '<div class="cal-cell empty" style="width:34px; height:34px;"></div>';
    
    for (let d = 1; d <= daysInMonth; d++) {
      const cur = new Date(monthDate.getFullYear(), monthDate.getMonth(), d);
      const dateStr = this.formatDate(cur);
      
      const isSelected = range.from && dateStr === this.formatDate(range.from);
      const isEnd = range.to && dateStr === this.formatDate(range.to);
      const inRange = range.from && range.to && cur > range.from && cur < range.to;
      const isToday = cur.getTime() === today.getTime();

      let bg = 'transparent';
      let color = 'var(--text-main)';
      let borderRadius = '8px';

      if (isSelected || isEnd) { 
        bg = 'var(--primary)'; 
        color = 'white'; 
      } else if (inRange) { 
        bg = 'rgba(242, 89, 0, 0.1)'; 
        color = 'var(--primary)'; 
      } else if (isToday) { 
        color = 'var(--primary)'; 
        bg = 'rgba(242, 89, 0, 0.05)';
      }

      daysHtml += `<div class="cal-cell day" data-date="${dateStr}" style="width:34px; height:34px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.75rem; font-weight:700; border-radius:${borderRadius}; background:${bg}; color:${color}; transition:all 0.2s;">${d}</div>`;
    }

    return `
      <div style="width: 250px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; padding: 0 4px;">
          <button class="cal-nav-btn" data-action="prev-month" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem; opacity: ${position === 'right' ? '0' : '1'}; pointer-events: ${position === 'right' ? 'none' : 'auto'}">◀</button>
          <span style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">${monthName}</span>
          <button class="cal-nav-btn" data-action="next-month" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem; opacity: ${position === 'left' ? '0' : '1'}; pointer-events: ${position === 'left' ? 'none' : 'auto'}">▶</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align:center;">
          ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(day => `<div style="font-size:0.6rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">${day}</div>`).join('')}
          ${daysHtml}
        </div>
      </div>
    `;
  },

  render: function() {
    this.init();
    const state = window.AppState;
    const range = this.getDateRange();
    
    // Define range and filter invoices first
    const sequence = ['Surftek', 'Mdot', 'Swisspac', 'Other', 'FeedMe', 'Bukku', 'EZYPOS'];
    const rangeInvoices = (state.invoices || []).filter(inv => {
      const invDate = this.parseInvDate(inv.date);
      if (!invDate) return false;
      if (!range.from) return true;
      const invDay = new Date(invDate.getFullYear(), invDate.getMonth(), invDate.getDate());
      return invDay >= range.from && invDay <= range.to;
    });

    // Performance: Unified single-pass calculation
    const soldQtys = {};
    const profitsMap = { subscription: { profit: 0, rev: 0 }, suppliers: {} };
    
    rangeInvoices.forEach(inv => {
      inv.items?.forEach(item => {
        const p = state.products.find(prod => prod.id === item.productId);
        if (!p) return;
        
        const qty = item.qty || 0;
        const rev = (p.price || 0) * qty;
        const cost = (p.cost || 0) * qty;
        const profit = rev - cost;
        
        soldQtys[p.id] = (soldQtys[p.id] || 0) + qty;
        
        if (p.type === 'Hardware') {
          profitsMap.suppliers[p.supplier] = profitsMap.suppliers[p.supplier] || { profit: 0, rev: 0 };
          profitsMap.suppliers[p.supplier].profit += profit;
          profitsMap.suppliers[p.supplier].rev += rev;
        } else if (p.type === 'Subscription') {
          profitsMap.subscription.profit += profit;
          profitsMap.subscription.rev += rev;
        }
      });
    });


    // Group products by supplier dynamically

    const rawSuppliers = [...new Set(state.products.map(p => p.supplier))];
    const suppliers = sequence.filter(s => rawSuppliers.includes(s));
    rawSuppliers.forEach(s => { if (!suppliers.includes(s)) suppliers.push(s); });

    const getSupplierColor = (s) => {
      if (s === 'Surftek') return '#00b4ff';
      if (s === 'Mdot') return '#EF4444';
      if (s === 'Swisspac') return '#9333ea';
      if (s === 'Other') return '#C8A2C8';
      if (s === 'FeedMe') return '#f25900';
      if (s === 'Bukku') return '#00FFFF';
      if (s === 'EZYPOS') return '#f43f5e';
      return '#ED8F03';
    };

    // Performance Optimization: Group invoices by supplier once
    const invoicesBySupplier = rangeInvoices.reduce((acc, inv) => {
      acc[inv.supplier] = acc[inv.supplier] || [];
      acc[inv.supplier].push(inv);
      return acc;
    }, {});
    
    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/NexPerformance.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Performance Analysis</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Comprehensive profit tracking across Hardware & Subscriptions.</p>
          </div>
        </div>
        
        <div style="display:flex; align-items:center; gap: 16px;">
          <!-- Supplier Filter Dropdown -->
          <div style="position: relative;">
            <div id="supplier-filter-trigger" style="display:flex; align-items:center; background: var(--bg-surface); border: 2px solid ${this.isSupplierDropdownOpen ? 'var(--primary)' : 'var(--border-color)'}; padding: 8px 18px; border-radius: 12px; cursor: pointer; transition: all 0.3s; min-width: 170px; box-shadow: ${this.isSupplierDropdownOpen ? '0 0 15px rgba(242, 89, 0, 0.2)' : 'none'};">
              <div style="display:flex; flex-direction:column;">
                <span style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 0.05em;">Group Filter</span>
                <span style="font-weight: 800; color: var(--text-main); font-size: 0.95rem; text-transform: capitalize;">${this.selectedSupplier === 'all' ? 'All Groups' : this.selectedSupplier}</span>
              </div>
              <span style="color: var(--primary); font-size: 0.7rem; margin-left: 12px; transition: transform 0.3s; transform: ${this.isSupplierDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
            </div>

            ${this.isSupplierDropdownOpen ? `
              <div id="supplier-filter-menu" style="position: absolute; top: calc(100% + 8px); right: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; width: 200px; z-index: 6000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 8px; animation: modalIn 0.2s ease-out;">
                 <div class="supplier-opt" data-value="all" 
                      style="padding: 10px 12px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s; 
                              background: ${this.selectedSupplier === 'all' ? 'rgba(242, 89, 0, 0.1)' : 'transparent'};">
                    <span style="font-weight: ${this.selectedSupplier === 'all' ? '700' : '500'}; color: ${this.selectedSupplier === 'all' ? 'var(--primary)' : 'var(--text-main)'}; font-size: 0.95rem;">All Groups</span>
                 </div>
                 ${suppliers.map(s => `
                   <div class="supplier-opt" data-value="${s}" 
                        style="padding: 10px 12px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s; 
                                background: ${this.selectedSupplier === s ? 'rgba(242, 89, 0, 0.1)' : 'transparent'};">
                      <div style="width: 8px; height: 8px; border-radius: 50%; background: ${getSupplierColor(s)};"></div>
                      <span style="font-weight: ${this.selectedSupplier === s ? '700' : '500'}; color: ${this.selectedSupplier === s ? 'var(--primary)' : 'var(--text-main)'}; font-size: 0.95rem;">${s}</span>
                   </div>
                 `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Calendar Picker -->
          <div style="position: relative;">
            <div id="catalog-date-trigger" style="display: flex; align-items: center; gap: 10px; padding: 8px 18px; border: 2px solid ${this.isCalendarOpen ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 12px; cursor: pointer; background: var(--bg-surface); transition: all 0.3s; min-width: 240px;">
              <div style="display:flex; flex-direction:column;">
                <span style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 0.05em;">Performance Range</span>
                <span style="font-weight: 800; color: var(--text-main); font-size: 0.95rem;">${this.filterMode === 'all' ? 'All Time' : (this.formatDate(range.from) + ' – ' + this.formatDate(range.to))}</span>
              </div>
              <span style="color: var(--primary); font-size: 0.7rem; margin-left: auto;">▼</span>
            </div>

            ${this.isCalendarOpen ? `
              <div id="catalog-cal-overlay" style="position: absolute; top: calc(100% + 8px); right: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); z-index: 5000; display: flex; animation: modalIn 0.2s ease-out; overflow: hidden;">
                <div class="cal-presets" style="width: 140px; border-right: 1px solid var(--border-color); padding: 12px 0;">
                  ${['all', 'today', 'yesterday', 'this_week', 'this_month', 'last_month'].map(p => {
                    const label = p.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    return `<div class="cal-preset-btn ${this.filterMode === p ? 'active' : ''}" data-preset="${p}" style="padding: 10px 16px; font-size: 0.8rem; cursor: pointer; color: ${this.filterMode === p ? 'var(--primary)' : 'var(--text-muted)'}; background: ${this.filterMode === p ? 'rgba(242,89,0,0.08)' : 'transparent'}; font-weight: ${this.filterMode === p ? '700' : '500'};">${label}</div>`;
                  }).join('')}
                </div>
                <div style="padding: 16px;">
                  <div style="display: flex; gap: 20px;">
                    ${this.renderCalendarMonth(this.calLeftMonth, 'left')}
                    ${this.renderCalendarMonth(this.calRightMonth, 'right')}
                  </div>
                  <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                    <button id="cat-cal-apply" style="padding: 8px 22px; border-radius: 8px; border: none; background: var(--primary); color: white; cursor: pointer; font-weight: 700;">Apply Range</button>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- PERFORMANCE HEADER SECTION -->
      <div style="display: flex; gap: 24px; margin-bottom: 40px; align-items: stretch;">
        <!-- Left Part: Scorecards Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; flex: 1.2;">
          ${['Surftek', 'Mdot', 'Swisspac', 'Other'].map(s => {
            const data = profitsMap.suppliers[s] || { profit: 0, rev: 0 };
            const margin = data.rev > 0 ? (data.profit / data.rev * 100).toFixed(1) : '0.0';
            const color = getSupplierColor(s);
            const isActive = this.selectedSupplier === s && this.selectedType === 'Hardware';
            return `
              <div class="perf-card type-filter-btn ${isActive ? 'active' : ''}" data-supplier="${s}" data-type="Hardware"
                   style="padding: 15px; border-radius: 16px; border: 1px solid ${isActive ? color : 'var(--border-color)'}; background: ${isActive ? `${color}11` : 'rgba(255,255,255,0.02)'}; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 12px; position: relative;">
                <div style="font-size: 1.5rem;">${s==='Surftek'?'⌨️':s==='Mdot'?'📟':s==='Swisspac'?'📱':'📦'}</div>
                <div style="display:flex; flex-direction:column;">
                  <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800;">${s} (Total)</span>
                  <div style="display:flex; align-items:baseline; gap: 10px;">
                    <span style="font-size: 1.15rem; font-weight: 900; color: ${color};">$${data.profit.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                    <span style="font-size: 0.75rem; font-weight: 800; color: #fbbf24; opacity: 0.9;">${margin}%</span>
                  </div>
                </div>
                ${isActive ? `<div style="position: absolute; right: 10px; top: 10px; width: 6px; height: 6px; border-radius: 50%; background: ${color};"></div>` : ''}
              </div>
            `;
          }).join('')}
          
          <!-- Subscriptions Card (Spanning or last slot) -->
          <div class="perf-card type-filter-btn ${this.selectedType === 'Subscription' ? 'active' : ''}" data-supplier="all" data-type="Subscription"
               style="padding: 15px; grid-column: span 2; border-radius: 16px; border: 1px solid ${this.selectedType === 'Subscription' ? 'var(--primary)' : 'var(--border-color)'}; background: ${this.selectedType === 'Subscription' ? 'rgba(242,89,0,0.1)' : 'rgba(255,255,255,0.02)'}; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 12px; position: relative;">
            <div style="font-size: 1.5rem;">🔄</div>
            <div style="display:flex; flex-direction:column;">
              <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800;">Subscription (Total)</span>
              <div style="display:flex; align-items:baseline; gap: 12px;">
                <span style="font-size: 1.25rem; font-weight: 900; color: var(--primary);">$${profitsMap.subscription.profit.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                <span style="font-size: 0.9rem; font-weight: 800; color: #fbbf24;">${profitsMap.subscription.rev > 0 ? (profitsMap.subscription.profit / profitsMap.subscription.rev * 100).toFixed(1) : '0.0'}%</span>
              </div>
            </div>
            ${this.selectedType === 'Subscription' ? `<div style="position: absolute; right: 10px; top: 10px; width: 6px; height: 6px; border-radius: 50%; background: var(--primary);"></div>` : ''}
          </div>
        </div>

        <!-- Right Part: Chart -->
        <div style="flex: 1.5; min-width: 0;">
          ${this.renderProfitChart(rangeInvoices, range)}
        </div>
      </div>
    `;
    
    suppliers.forEach(supplier => {
        if (this.selectedSupplier !== 'all' && this.selectedSupplier !== supplier) return;

        const supplierProducts = state.products.filter(p => p.supplier === supplier);
        const supplierHardware = (profitsMap.suppliers[supplier] || {profit: 0}).profit;
        const sColor = getSupplierColor(supplier);

        // Sub-group by type
        let types = [...new Set(supplierProducts.map(p => p.type))].sort();
        if (this.selectedType !== 'all') {
          types = types.filter(t => t === this.selectedType);
        }

        if (types.length === 0) return;

        html += `
          <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top: 50px; margin-bottom: 12px; border-bottom: 2px solid ${sColor}; padding-bottom: 8px;">
            <h3 style="margin: 0; color: ${sColor}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
              ${supplier} Summary
            </h3>
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">
              Total Hardware Profit: <span style="color: var(--success); font-size: 1rem; margin-left: 8px;">$${supplierHardware.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>
        `;

        types.forEach(type => {
          const typeProducts = supplierProducts.filter(p => p.type === type);
          html += `
            <div style="margin-bottom: 8px; margin-top: 16px; display:flex; align-items:center; gap: 8px;">
              <div style="width: 4px; height: 16px; background: ${sColor}; border-radius: 4px;"></div>
              <h4 style="margin: 0; font-size: 0.85rem; font-weight: 800; color: var(--text-main); text-transform: uppercase; opacity: 0.8;">${type}s</h4>
            </div>
            <div class="card" style="padding: 0; overflow-x: auto; margin-bottom: 24px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(255,255,255,0.01); border-top: 2px solid ${sColor};">
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead style="background-color: rgba(${window.Utils.hexToRgb(sColor)}, 0.03);">
                  <tr>
                    <th style="padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Item Name</th>
                    <th style="padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Qty Sold</th>
                    <th style="padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Unit Cost</th>
                    <th style="padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Total Cost</th>
                    <th style="padding: 16px; border-bottom: 1px solid var(--border-color); text-align: right; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Total Selling</th>
                    <th style="padding: 16px; border-bottom: 1px solid var(--border-color); text-align: right; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Profit Margin</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...typeProducts].sort((a, b) => {
                    const sellA = a.price * (soldQtys[a.id] || 0);
                    const sellB = b.price * (soldQtys[b.id] || 0);
                    return sellB - sellA;
                  }).map(p => {
                    const qty = soldQtys[p.id] || 0;
                    const totalCost = p.cost * qty;
                    const totalPrice = p.price * qty;
                    const marginAmount = totalPrice - (totalCost || 0);
                    const marginPct = totalPrice > 0 
                       ? ((marginAmount / totalPrice) * 100).toFixed(1) 
                       : (p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(1) : 0);
                       
                    return `
                      <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 16px; font-weight: 500;">
                          <div style="font-weight: 700; color: var(--text-main);">${p.name}</div>
                          <div style="margin-top: 4px;">
                            <span style="background:rgba(${window.Utils.hexToRgb(sColor)}, 0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; color: ${sColor}; border: 1px solid rgba(${window.Utils.hexToRgb(sColor)}, 0.2);">${p.supplier}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.7; margin-left: 8px;">SKU: ${p.sku || '-'}</span>
                          </div>
                        </td>
                        <td style="padding: 16px;">
                          <span style="font-weight: 800; padding: 4px 10px; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 6px; color: ${qty > 0 ? 'var(--text-main)' : 'var(--text-muted)'}">${qty}</span>
                        </td>
                        <td style="padding: 16px; color: var(--text-muted);">$${(p.cost || 0).toFixed(2)}</td>
                        <td style="padding: 16px; font-weight: 500;">$${(totalCost || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td style="padding: 16px; font-weight: 700; text-align: right;">$${(totalPrice || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td style="padding: 16px; text-align: right;">
                          <div style="font-weight: 800; color: ${marginAmount > 0 ? 'var(--success)' : 'var(--text-muted)'}; font-size: 1rem;">
                            $${(marginAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} 
                            <span style="font-size: 0.82rem; color: #fbbf24; font-weight: 800; text-shadow: 0 0 5px rgba(251, 191, 36, 0.3);">(${marginPct}%)</span>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        });
    });
    
    return html;
  },
  
  afterRender: function() {
    // Supplier Filter Trigger
    const supplierTrigger = document.getElementById('supplier-filter-trigger');
    if (supplierTrigger) {
      supplierTrigger.onclick = (e) => {
        e.stopPropagation();
        this.isSupplierDropdownOpen = !this.isSupplierDropdownOpen;
        this.triggerUpdate();
      };
    }

    // Date Trigger
    const dateTrigger = document.getElementById('catalog-date-trigger');
    if (dateTrigger) {
      dateTrigger.onclick = (e) => {
        e.stopPropagation();
        this.isCalendarOpen = !this.isCalendarOpen;
        if (this.isCalendarOpen) {
          const range = this.getDateRange();
          this.tempFrom = range.from;
          this.tempTo = range.to;
        }
        this.triggerUpdate();
      };
    }

    // Presets
    document.querySelectorAll('.cal-preset-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.filterMode = btn.dataset.preset;
        const range = this.getDateRange();
        this.tempFrom = range.from;
        this.tempTo = range.to;
        if (this.tempFrom) {
          this.calLeftMonth = new Date(this.tempFrom.getFullYear(), this.tempFrom.getMonth(), 1);
          this.calRightMonth = new Date(this.tempFrom.getFullYear(), this.tempFrom.getMonth() + 1, 1);
        }
        this.triggerUpdate();
      };
    });

    // Calendar navigation
    document.querySelectorAll('.cal-nav-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (btn.dataset.action === 'prev-month') {
          this.calLeftMonth = new Date(this.calLeftMonth.getFullYear(), this.calLeftMonth.getMonth() - 1, 1);
          this.calRightMonth = new Date(this.calLeftMonth.getFullYear(), this.calLeftMonth.getMonth() + 1, 1);
        } else {
          this.calRightMonth = new Date(this.calRightMonth.getFullYear(), this.calRightMonth.getMonth() + 1, 1);
          this.calLeftMonth = new Date(this.calRightMonth.getFullYear(), this.calRightMonth.getMonth() - 1, 1);
        }
        this.triggerUpdate();
      };
    });

    // Day Selection
    document.querySelectorAll('.cal-cell.day').forEach(cell => {
      cell.onclick = (e) => {
        e.stopPropagation();
        const d = new Date(cell.dataset.date + 'T00:00:00');
        if (!this.tempFrom || (this.tempFrom && this.tempTo)) { 
          this.tempFrom = d; this.tempTo = null; 
        } else {
          if (d < this.tempFrom) { this.tempTo = this.tempFrom; this.tempFrom = d; }
          else this.tempTo = d;
        }
        this.filterMode = 'custom';
        this.triggerUpdate();
      };
    });

    // Apply
    const applyBtn = document.getElementById('cat-cal-apply');
    if (applyBtn) {
      applyBtn.onclick = (e) => {
        e.stopPropagation();
        this.dateFrom = this.tempFrom;
        this.dateTo = this.tempTo || this.tempFrom;
        this.isCalendarOpen = false;
        this.triggerUpdate();
      };
    }

    // Supplier Options
    document.querySelectorAll('.supplier-opt').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        this.selectedSupplier = opt.dataset.value;
        this.isSupplierDropdownOpen = false;
        this.triggerUpdate();
      };
    });

    // Type Filter Selection
    document.querySelectorAll('.type-filter-btn').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.type;
        const supplier = btn.dataset.supplier;
        
        if (this.selectedType === type && (this.selectedSupplier === supplier || supplier === 'all')) {
          this.selectedType = 'all';
          this.selectedSupplier = 'all';
        } else {
          this.selectedType = type;
          this.selectedSupplier = supplier || 'all';
        }
        this.triggerUpdate();
      };
    });

    // Outside Click
    document.addEventListener('click', (e) => {
      let changed = false;
      if (this.isCalendarOpen && !e.target.closest('#catalog-cal-overlay') && !e.target.closest('#catalog-date-trigger')) {
        this.isCalendarOpen = false;
        changed = true;
      }
      if (this.isSupplierDropdownOpen && !e.target.closest('#supplier-filter-menu') && !e.target.closest('#supplier-filter-trigger')) {
        this.isSupplierDropdownOpen = false;
        changed = true;
      }
      if (changed) this.triggerUpdate();
    });
  },

  triggerUpdate: function() {
    window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'hub_activity' }));
  }
};
