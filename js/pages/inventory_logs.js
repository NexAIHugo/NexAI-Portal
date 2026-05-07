// js/pages/inventory_logs.js
window.Pages = window.Pages || {};
window.Pages.inventory_logs = {
  filterMode: 'today', // 'all', 'today', 'yesterday', 'this_week', 'last_week', 'last_7', 'this_month', 'last_month', 'this_year', 'custom'
  dateFrom: null,
  dateTo: null,
  isCalendarOpen: false,
  calLeftMonth: null, // Date obj for left calendar
  calRightMonth: null, // Date obj for right calendar
  tempFrom: null,
  tempTo: null,
  selectedGroup: 'all',
  isGroupDropdownOpen: false,


  init: function() {
    const now = new Date();
    this.calLeftMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    this.calRightMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  },

  getDateRange: function() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from = null, to = null;

    switch (this.filterMode) {
      case 'today':
        from = to = today;
        break;
      case 'yesterday':
        from = to = new Date(today.getTime() - 86400000);
        break;
      case 'this_week': {
        const day = today.getDay();
        from = new Date(today.getTime() - day * 86400000);
        to = today;
        break;
      }
      case 'last_week': {
        const day = today.getDay();
        const thisWeekStart = new Date(today.getTime() - day * 86400000);
        from = new Date(thisWeekStart.getTime() - 7 * 86400000);
        to = new Date(thisWeekStart.getTime() - 86400000);
        break;
      }
      case 'last_7':
        from = new Date(today.getTime() - 6 * 86400000);
        to = today;
        break;
      case 'this_month':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of this month
        break;
      case 'last_month':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'this_year':
        from = new Date(today.getFullYear(), 0, 1);
        to = new Date(today.getFullYear(), 11, 31); // Dec 31st
        break;
      case 'custom':
        from = this.dateFrom;
        to = this.dateTo;
        break;
      default: // 'all'
        return { from: null, to: null };
    }
    return { from, to };
  },

  formatDate: function(d) {
    if (!d) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },

  parseInvDate: function(dateStr) {
    if (!dateStr) return null;
    // Supports dd/mm/yyyy or yyyy-mm-dd
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    return new Date(dateStr);
  },

  renderCalendarMonth: function(baseDate, side) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let cells = '';
    // Empty leading cells
    for (let i = 0; i < firstDay; i++) {
      cells += `<div class="cal-cell empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const isToday = cellDate.toDateString() === today.toDateString();
      const isSelected = (this.tempFrom && cellDate.toDateString() === this.tempFrom.toDateString()) ||
                         (this.tempTo && cellDate.toDateString() === this.tempTo.toDateString());
      const isInRange = this.tempFrom && this.tempTo && 
                        cellDate > this.tempFrom && cellDate < this.tempTo;
      
      let cls = 'cal-cell day';
      if (isSelected) cls += ' selected';
      else if (isInRange) cls += ' in-range';
      else if (isToday) cls += ' today';

      cells += `<div class="${cls}" data-date="${this.formatDate(cellDate)}" data-side="${side}">${d}</div>`;
    }

    return `
      <div class="cal-month">
        <div class="cal-month-header">
          ${side === 'left' ? `<div class="cal-nav-btn" data-action="prev-month">‹</div>` : `<div style="width:24px;"></div>`}
          <span class="cal-month-title">${monthNames[month]} ${year}</span>
          ${side === 'right' ? `<div class="cal-nav-btn" data-action="next-month">›</div>` : `<div style="width:24px;"></div>`}
        </div>
        <div class="cal-weekdays">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-wk">${d}</div>`).join('')}
        </div>
        <div class="cal-grid">${cells}</div>
      </div>
    `;
  },

  renderDateFilter: function() {
    const range = this.getDateRange();
    const displayFrom = this.tempFrom ? this.formatDate(this.tempFrom) : (range.from ? this.formatDate(range.from) : '—');
    const displayTo = this.tempTo ? this.formatDate(this.tempTo) : (range.to ? this.formatDate(range.to) : '—');
    const isAll = this.filterMode === 'all';

    const presets = [
      { label: 'All Time', value: 'all' },
      { label: 'Today', value: 'today' },
      { label: 'Yesterday', value: 'yesterday' },
      { label: 'This Week', value: 'this_week' },
      { label: 'Last Week', value: 'last_week' },
      { label: 'Last 7 Days', value: 'last_7' },
      { label: 'This Month', value: 'this_month' },
      { label: 'Last Month', value: 'last_month' },
      { label: 'This Year', value: 'this_year' },
    ];

    return `
      <div style="position: relative; display: inline-block;">
        <div id="date-range-trigger" style="display: flex; align-items: center; gap: 10px; padding: 10px 18px; border: 2px solid ${this.isCalendarOpen ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 10px; cursor: pointer; background: var(--bg-main); transition: all 0.2s; min-width: 260px;">
          <span style="font-size: 1rem;">📅</span>
          <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${isAll ? 'All Time' : displayFrom + '  –  ' + displayTo}</span>
        </div>

        ${this.isCalendarOpen ? `
        <div class="cal-overlay" style="position: absolute; top: calc(100% + 8px); right: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); z-index: 5000; display: flex; animation: modalIn 0.2s ease-out; overflow: hidden;">
          
          <div class="cal-presets" style="width: 140px; border-right: 1px solid var(--border-color); padding: 12px 0; display: flex; flex-direction: column;">
            ${presets.map(p => `
              <div class="cal-preset-btn ${this.filterMode === p.value ? 'active' : ''}" data-preset="${p.value}"
                   style="padding: 8px 16px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; font-weight: ${this.filterMode === p.value ? '700' : '500'}; 
                          color: ${this.filterMode === p.value ? 'var(--primary)' : 'var(--text-muted)'}; 
                          background: ${this.filterMode === p.value ? 'rgba(242,89,0,0.08)' : 'transparent'};">
                ${p.label}
              </div>
            `).join('')}
          </div>

          <div style="padding: 16px; display: flex; flex-direction: column;">
            <div style="display: flex; gap: 20px;">
              ${this.renderCalendarMonth(this.calLeftMonth, 'left')}
              ${this.renderCalendarMonth(this.calRightMonth, 'right')}
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
              <button id="cal-cancel" style="padding: 8px 22px; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-main); cursor: pointer; font-weight: 600; font-size: 0.85rem;">Cancel</button>
              <button id="cal-apply" style="padding: 8px 22px; border-radius: 8px; border: none; background: var(--primary); color: white; cursor: pointer; font-weight: 700; font-size: 0.85rem;">Apply</button>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  },

  render: function() {
    if (!this.calLeftMonth) this.init();
    
    const state = window.AppState;
    let allProducts = state.products.filter(p => p.type === 'Hardware');

    // Filter by selected Group
    if (this.selectedGroup && this.selectedGroup !== 'all') {
      allProducts = allProducts.filter(p => {
        const sup = (p.supplier || '').toLowerCase();
        if (this.selectedGroup === 'other') {
          return !['surftek', 'mdot', 'swisspac'].includes(sup);
        }
        return sup === this.selectedGroup;
      });
    }

    const range = this.getDateRange();
    
    // We use hubActivities as the primary source of truth for reporting history
    const allActivities = state.hubActivities || [];
    
    // Preparation: Map activities to products and timeframes
    const stats = {}; // productId -> { open, in, out }
    
    // Sort all activities by date to ensure proper balance calculation
    const sortedActivities = allActivities.slice().sort((a,b) => new Date(a.date) - new Date(b.date));

    allProducts.forEach(p => {
      let open = 0;
      let inQty = 0;
      let outQty = 0;
      
      sortedActivities.forEach(act => {
        const d = new Date(act.date);
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        
        // Find if this product is in this activity
        const item = (act.items || []).find(it => it.productId === p.id);
        if (!item) return;

        const qty = item.qty;

        if (range.from && day < range.from) {
          // BEFORE RANGE: Affects Open Balance
          if (act.type === 'in') open += qty;
          else if (act.type === 'out') open -= qty;
          else if (act.type === 'delete') {
            // A delete activity is a contra - it reverses the original
            // If the user says delete invoice = stock back in, then 'delete' type adds to stock
            open += qty;
          }
        } else if (!range.from || (day >= range.from && (!range.to || day <= range.to))) {
          // DURING RANGE: Affects columns
          if (act.type === 'in') inQty += qty;
          else if (act.type === 'out') outQty += qty;
          else if (act.type === 'delete') {
             // Deletions are treated as 'In' for the report history
             inQty += qty;
          }
        }
      });

      stats[p.id] = {
        name: p.name,
        supplier: p.supplier,
        openBalance: open,
        inQty: inQty,
        outQty: outQty,
        balance: open + inQty - outQty,
        status: (open + inQty - outQty) < 10 && (open + inQty - outQty) !== 0 ? 'LOW STOCK' : ((open + inQty - outQty) === 0 && inQty === 0 && outQty === 0 ? 'NO ACTIVITY' : ((open + inQty - outQty) >= 10 ? 'HEALTHY' : 'LOW STOCK'))
      };
    });

    const filteredLogs = Object.values(stats)
      .filter(l => l.openBalance !== 0 || l.inQty !== 0 || l.outQty !== 0)
      .sort((a, b) => (a.supplier || '').localeCompare(b.supplier || ''));


    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <img src="assets/NexInventory.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Hub In/Out</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Comprehensive historical record of stock movements (In vs Out).</p>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; background: var(--bg-surface); padding: 20px; border-radius: 16px; border: 1px solid var(--border-color); position: relative;">
        <div style="display: flex; align-items: center; gap: 15px;">
           <span style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em;">Quick Filters</span>
        </div>

        <div style="display: flex; align-items: center; gap: 16px;">
          <!-- Group Filter -->
          <div style="position: relative;">
            <div id="group-filter-trigger" style="display:flex; align-items:center; background: var(--bg-main); border: 2px solid ${this.isGroupDropdownOpen ? 'var(--primary)' : 'var(--border-color)'}; padding: 8px 18px; border-radius: 12px; cursor: pointer; transition: all 0.3s; min-width: 170px; box-shadow: ${this.isGroupDropdownOpen ? '0 0 15px rgba(242, 89, 0, 0.2)' : 'none'};">
              <div style="display:flex; flex-direction:column;">
                <span style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 0.05em;">Group Filter</span>
                <span style="font-weight: 800; color: var(--text-main); font-size: 0.95rem; text-transform: capitalize;">${this.selectedGroup === 'all' ? 'All Groups' : this.selectedGroup}</span>
              </div>
              <span style="color: var(--primary); font-size: 0.7rem; margin-left: 12px; transition: transform 0.3s; transform: ${this.isGroupDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
            </div>

            ${this.isGroupDropdownOpen ? `
              <div id="group-filter-menu" style="position: absolute; top: calc(100% + 8px); right: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; width: 180px; z-index: 6000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 8px; animation: modalIn 0.2s ease-out;">
                 ${['all', 'surftek', 'mdot', 'swisspac', 'other'].map(group => `
                   <div class="group-opt" data-value="${group}" 
                        style="padding: 10px 12px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s; 
                                background: ${this.selectedGroup === group ? 'rgba(242, 89, 0, 0.1)' : 'transparent'};">
                      <span style="font-weight: ${this.selectedGroup === group ? '700' : '500'}; color: ${this.selectedGroup === group ? 'var(--primary)' : 'var(--text-main)'}; font-size: 0.9rem; text-transform: capitalize;">${group === 'all' ? 'All Groups' : group}</span>
                   </div>
                 `).join('')}
              </div>
            ` : ''}
          </div>

          ${this.renderDateFilter()}
        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden; border-radius: 16px; border: 1px solid var(--border-color);">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.02); display: flex; justify-content: space-between; align-items: center;">
            <p style="margin: 0; font-weight: 800; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Balance Summary</p>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary); background: rgba(242,89,0,0.1); padding: 4px 12px; border-radius: 20px;">${filteredLogs.length} Active Records</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.1em; background: rgba(0,0,0,0.2);">
              <th style="padding: 15px 24px; border-bottom: 1px solid var(--border-color);">Product Name</th>
              <th style="padding: 15px; border-bottom: 1px solid var(--border-color); text-align: left;">Group</th>
              <th style="padding: 15px; border-bottom: 1px solid var(--border-color); text-align: center;">Open Balance</th>
              <th style="padding: 15px; border-bottom: 1px solid var(--border-color); text-align: center; color: var(--success);">In (+)</th>
              <th style="padding: 15px; border-bottom: 1px solid var(--border-color); text-align: center; color: var(--danger);">Out (-)</th>
              <th style="padding: 15px; border-bottom: 1px solid var(--border-color); text-align: center; background: rgba(255,255,255,0.02);">Balance</th>
              <th style="padding: 15px 24px; border-bottom: 1px solid var(--border-color); text-align: right;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLogs.length > 0 ? filteredLogs.map(l => {
              const statusColor = l.status === 'LOW STOCK' ? '#FFCC00' : (l.status === 'NO STOCK' ? 'var(--text-muted)' : 'var(--success)');
              const isNegative = l.balance < 0;
              
              return `
                <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.95rem;">
                  <td style="padding: 18px 24px;">
                    <div style="font-weight: 700; color: var(--text-main);">${l.name}</div>
                  </td>
                  <td style="padding: 15px; text-align: left;">
                    ${(() => {
                      const sup = l.supplier;
                      let color = 'var(--text-main)';
                      let bg = 'rgba(255,255,255,0.05)';
                      let border = 'var(--border-color)';
                      
                      if (sup === 'Surftek') { color = '#00b4ff'; bg = 'rgba(0,180,255,0.1)'; border = 'rgba(0,180,255,0.3)'; }
                      else if (sup === 'Mdot') { color = '#EF4444'; bg = 'rgba(239,68,68,0.1)'; border = 'rgba(239,68,68,0.3)'; }
                      else if (sup === 'Swisspac') { color = '#9333ea'; bg = 'rgba(147,51,234,0.1)'; border = 'rgba(147,51,234,0.3)'; }
                      else { color = '#C8A2C8'; bg = 'rgba(200,162,200,0.1)'; border = 'rgba(200,162,200,0.3)'; }
                      
                      return `<span style="background: ${bg}; color: ${color}; border: 1px solid ${border}; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase;">${sup || 'Other'}</span>`;
                    })()}
                  </td>
                  <td style="padding: 15px; text-align: center; font-weight: 700;">${l.openBalance}</td>
                  <td style="padding: 15px; text-align: center; font-weight: 800; color: var(--success); opacity: ${l.inQty > 0 ? 1 : 0.3};">${l.inQty}</td>
                  <td style="padding: 15px; text-align: center; font-weight: 800; color: var(--danger); opacity: ${l.outQty > 0 ? 1 : 0.3};">${l.outQty}</td>
                  <td style="padding: 15px; text-align: center; background: rgba(255,255,255,0.01);">
                     <div style="font-weight: 900; font-size: 1.1rem; color: ${isNegative ? 'var(--danger)' : 'var(--text-main)'}">${l.balance}</div>
                  </td>
                  <td style="padding: 18px 24px; text-align: right;">
                    <span style="background: ${l.status === 'LOW STOCK' ? 'rgba(255, 204, 0, 0.1)' : (l.status === 'NO STOCK' ? 'rgba(128,128,128,0.1)' : 'rgba(16,185,129,0.1)')}; 
                           color: ${statusColor}; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; 
                           border: 1px solid ${l.status === 'LOW STOCK' ? 'rgba(255, 204, 0, 0.3)' : (l.status === 'NO STOCK' ? 'rgba(128,128,128,0.3)' : 'rgba(16,185,129,0.3)')};">
                      ${l.status}
                    </span>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="6" style="padding: 100px 0; text-align: center;">
                  <p style="color: var(--text-muted); font-size: 1.1rem;">No inventory movements detected yet.</p>
                  <p style="font-size: 0.8rem; color: var(--text-muted); opacity: 0.7;">Stock deductions occur automatically upon NexAI Hub imports.</p>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  },

  afterRender: function() {
    // Custom Group Filter Trigger
    const groupTrigger = document.getElementById('group-filter-trigger');
    if (groupTrigger) {
      groupTrigger.onclick = (e) => {
        e.stopPropagation();
        this.isGroupDropdownOpen = !this.isGroupDropdownOpen;
        this.triggerUpdate();
      };
    }

    // Group Option Selection
    document.querySelectorAll('.group-opt').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        this.selectedGroup = opt.dataset.value;
        this.isGroupDropdownOpen = false;
        this.triggerUpdate();
      };
    });

    // Date range trigger
    const trigger = document.getElementById('date-range-trigger');
    if (trigger) {
      trigger.onclick = (e) => {
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

    // Preset buttons
    document.querySelectorAll('.cal-preset-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const val = btn.dataset.preset;
        // When preset is clicked, only update temp range and calendar view.
        // We do NOT update this.filterMode here anymore to avoid premature re-render of data.
        let newFrom, newTo;
        const now = new Date();
        const todayAtZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (val) {
          case 'today': newFrom = newTo = todayAtZero; break;
          case 'yesterday': newFrom = newTo = new Date(todayAtZero.getTime() - 86400000); break;
          case 'this_week': {
            const day = todayAtZero.getDay();
            newFrom = new Date(todayAtZero.getTime() - day * 86400000);
            newTo = todayAtZero;
            break;
          }
          case 'last_week': {
            const day = todayAtZero.getDay();
            const thisWeekStart = new Date(todayAtZero.getTime() - day * 86400000);
            newFrom = new Date(thisWeekStart.getTime() - 7 * 86400000);
            newTo = new Date(thisWeekStart.getTime() - 86400000);
            break;
          }
          case 'last_7': newFrom = new Date(todayAtZero.getTime() - 6 * 86400000); newTo = todayAtZero; break;
          case 'this_month':
            newFrom = new Date(todayAtZero.getFullYear(), todayAtZero.getMonth(), 1);
            newTo = new Date(todayAtZero.getFullYear(), todayAtZero.getMonth() + 1, 0);
            break;
          case 'last_month':
            newFrom = new Date(todayAtZero.getFullYear(), todayAtZero.getMonth() - 1, 1);
            newTo = new Date(todayAtZero.getFullYear(), todayAtZero.getMonth(), 0);
            break;
          case 'this_year':
            newFrom = new Date(todayAtZero.getFullYear(), 0, 1);
            newTo = new Date(todayAtZero.getFullYear(), 11, 31);
            break;
          default: // all
            newFrom = newTo = null;
        }

        this.tempFrom = newFrom;
        this.tempTo = newTo;

        if (newFrom) {
          this.calLeftMonth = new Date(newFrom.getFullYear(), newFrom.getMonth(), 1);
          this.calRightMonth = new Date(this.calLeftMonth.getFullYear(), this.calLeftMonth.getMonth() + 1, 1);
        }
        
        this.triggerUpdate();
      };
    });

    // Calendar day clicks
    document.querySelectorAll('.cal-cell.day').forEach(cell => {
      cell.onclick = (e) => {
        e.stopPropagation();
        const dateStr = cell.dataset.date;
        const clickedDate = new Date(dateStr + 'T00:00:00');
        
        if (!this.tempFrom || (this.tempFrom && this.tempTo)) {
          // Start new selection
          this.tempFrom = clickedDate;
          this.tempTo = null;
        } else {
          // Complete the range
          if (clickedDate < this.tempFrom) {
            this.tempTo = this.tempFrom;
            this.tempFrom = clickedDate;
          } else {
            this.tempTo = clickedDate;
          }
        }
        this.filterMode = 'custom';
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

    // Cancel button
    const cancelBtn = document.getElementById('cal-cancel');
    if (cancelBtn) {
      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        this.isCalendarOpen = false;
        this.triggerUpdate();
      };
    }

    // Apply button
    const applyBtn = document.getElementById('cal-apply');
    if (applyBtn) {
      applyBtn.onclick = (e) => {
        e.stopPropagation();
        this.dateFrom = this.tempFrom;
        this.dateTo = this.tempTo || this.tempFrom;
        
        // Update filterMode based on what was selected in temp
        if (this.tempFrom && this.tempTo) {
           // We can't easily map back to presets here without more logic, 
           // so we just use 'custom' if it's not a direct preset match.
           // However, to keep it simple and fix the user's issue:
           this.filterMode = 'custom';
        }

        this.isCalendarOpen = false;
        this.triggerUpdate();
      };
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      let changed = false;
      if (this.isCalendarOpen && !e.target.closest('.cal-overlay') && !e.target.closest('#date-range-trigger')) {
        this.isCalendarOpen = false;
        changed = true;
      }
      if (this.isGroupDropdownOpen && !e.target.closest('#group-filter-menu') && !e.target.closest('#group-filter-trigger')) {
        this.isGroupDropdownOpen = false;
        changed = true;
      }
      if (changed) this.triggerUpdate();
    });
  },

  triggerUpdate: function() {
    window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'inventory_logs' }));
  },

  resetFilters: function() {
    this.filterMode = 'today';
    this.selectedGroup = 'all';
    this.isGroupDropdownOpen = false;
    const range = this.getDateRange();
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.tempFrom = range.from;
    this.tempTo = range.to;
    this.isCalendarOpen = false;
    if (this.dateFrom) {
       this.calLeftMonth = new Date(this.dateFrom.getFullYear(), this.dateFrom.getMonth(), 1);
       this.calRightMonth = new Date(this.calLeftMonth.getFullYear(), this.calLeftMonth.getMonth() + 1, 1);
    }
  }
};
