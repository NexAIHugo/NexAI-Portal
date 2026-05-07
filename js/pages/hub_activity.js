// js/pages/hub_activity.js
window.Pages = window.Pages || {};
window.Pages.inventory_activity = {
  filterMode: 'today',
  dateFrom: null,
  dateTo: null,
  isCalendarOpen: false,
  calLeftMonth: null,
  calRightMonth: null,
  tempFrom: null,
  tempTo: null,
  confirmDeleteId: null,
  selectedType: null, // Filter for scorecards (in, out, transfer, delete)

  init: function() {
    const now = new Date();
    this.calLeftMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    this.calRightMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // Set initial date range to today
    const range = this.getDateRange();
    this.dateFrom = range.from;
    this.dateTo = range.to;
  },

  resetFilters: function() {
    this.filterMode = 'today';
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
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'last_month':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'this_year':
        from = new Date(today.getFullYear(), 0, 1);
        to = new Date(today.getFullYear(), 11, 31);
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

  formatSimpleDate: function(d) {
    if (!d) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },

  renderCalendarMonth: function(baseDate, side) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let cells = '';
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

      cells += `<div class="${cls}" data-date="${this.formatSimpleDate(cellDate)}" data-side="${side}">${d}</div>`;
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
    const displayFrom = this.tempFrom ? this.formatSimpleDate(this.tempFrom) : (range.from ? this.formatSimpleDate(range.from) : '—');
    const displayTo = this.tempTo ? this.formatSimpleDate(this.tempTo) : (range.to ? this.formatSimpleDate(range.to) : '—');
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
        <div id="activity-date-trigger" style="display: flex; align-items: center; gap: 10px; padding: 10px 18px; border: 2px solid ${this.isCalendarOpen ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 10px; cursor: pointer; background: var(--bg-main); transition: all 0.2s; min-width: 260px;">
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
              <button id="act-cal-cancel" style="padding: 8px 22px; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-main); cursor: pointer; font-weight: 600; font-size: 0.85rem;">Cancel</button>
              <button id="act-cal-apply" style="padding: 8px 22px; border-radius: 8px; border: none; background: var(--primary); color: white; cursor: pointer; font-weight: 700; font-size: 0.85rem;">Apply</button>
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
    const range = this.getDateRange();
    
    // Filter activities by date range
    let activities = (state.hubActivities || []).slice().reverse();
    if (range.from && range.to) {
      activities = activities.filter(act => {
        const d = new Date(act.date);
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return day >= range.from && day <= range.to;
      });
    }

    // Secondary Filter: Scorecard Type
    if (this.selectedType) {
      activities = activities.filter(act => act.type === this.selectedType);
    }

    const getTypeStyle = (type) => {
      if (type === 'in') {
        return { 
          label: 'STOCK IN', 
          color: '#10B981', 
          bg: 'rgba(16,185,129,0.1)', 
          border: 'rgba(16,185,129,0.4)', 
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 5px rgba(16,185,129,0.8));"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><polyline points="8 10 12 14 16 10"/><line x1="12" y1="2" x2="12" y2="14"/></svg>`
        };
      }
      if (type === 'out') {
        return { 
          label: 'STOCK OUT', 
          color: '#EF4444', 
          bg: 'rgba(239,68,68,0.1)', 
          border: 'rgba(239,68,68,0.4)', 
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 5px rgba(239,68,68,0.8));"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="14"/></svg>`
        };
      }
      if (type === 'transfer') {
        return { 
          label: 'TRANSFER', 
          color: '#3B82F6', 
          bg: 'rgba(59,130,246,0.1)', 
          border: 'rgba(59,130,246,0.4)', 
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 5px rgba(59,130,246,0.8));"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`
        };
      }
      if (type === 'delete') {
        return { 
          label: 'DELETED', 
          color: '#EF4444', 
          bg: 'rgba(239,68,68,0.1)', 
          border: 'rgba(239,68,68,0.4)', 
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 5px rgba(239,68,68,0.8));"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
        };
      }
      return { label: type.toUpperCase(), color: 'var(--text-muted)', bg: 'rgba(128,128,128,0.1)', border: 'rgba(128,128,128,0.3)', icon: '📋' };
    };

    const formatDateStr = (isoStr) => {
      if (!isoStr) return '—';
      const d = new Date(isoStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    };

    return `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/NexInventory.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Activity Log</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Stock movement history within selected date range.</p>
          </div>
        </div>
        ${this.renderDateFilter()}
      </div>

      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
        ${(() => {
          const metrics = (state.hubActivities || []).reduce((acc, a) => {
            if (a.type === 'out') acc.out++;
            else if (a.type === 'in') acc.in++;
            else if (a.type === 'transfer') acc.transfer++;
            else if (a.type === 'delete') acc.deleted++;
            return acc;
          }, { out: 0, in: 0, transfer: 0, deleted: 0 });

          return `
            <!-- Stock Out Card -->
            <div class="card summary-card" data-type="out" style="padding: 24px; text-align: center; border-left: 4px solid #EF4444; cursor: pointer; transition: all 0.2s; position: relative; ${this.selectedType === 'out' ? 'border: 2px solid #EF4444; background: rgba(239, 68, 68, 0.05); box-shadow: 0 0 15px rgba(239, 68, 68, 0.2);' : ''}">
              <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: 800; margin-bottom: 8px;">Stock Out</div>
              <div style="font-size: 2rem; font-weight: 900; color: #EF4444;">${metrics.out}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Activities</div>
              ${this.selectedType === 'out' ? '<div style="position: absolute; top: 10px; right: 10px; color: #EF4444; font-size: 1rem;">●</div>' : ''}
            </div>
            
            <!-- Stock In Card -->
            <div class="card summary-card" data-type="in" style="padding: 24px; text-align: center; border-left: 4px solid #10B981; cursor: pointer; transition: all 0.2s; position: relative; ${this.selectedType === 'in' ? 'border: 2px solid #10B981; background: rgba(16,185,129,0.05); box-shadow: 0 0 15px rgba(16,185,129,0.2);' : ''}">
              <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: 800; margin-bottom: 8px;">Stock In</div>
              <div style="font-size: 2rem; font-weight: 900; color: #10B981;">${metrics.in}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Activities</div>
              ${this.selectedType === 'in' ? '<div style="position: absolute; top: 10px; right: 10px; color: #10B981; font-size: 1rem;">●</div>' : ''}
            </div>

            <!-- Transfer Card -->
            <div class="card summary-card" data-type="transfer" style="padding: 24px; text-align: center; border-left: 4px solid #3B82F6; cursor: pointer; transition: all 0.2s; position: relative; ${this.selectedType === 'transfer' ? 'border: 2px solid #3B82F6; background: rgba(59, 130, 246, 0.05); box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);' : ''}">
              <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: 800; margin-bottom: 8px;">Transfer</div>
              <div style="font-size: 2rem; font-weight: 900; color: #3B82F6;">${metrics.transfer}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Activities</div>
              ${this.selectedType === 'transfer' ? '<div style="position: absolute; top: 10px; right: 10px; color: #3B82F6; font-size: 1rem;">●</div>' : ''}
            </div>

            <!-- Deleted Card -->
            <div class="card summary-card" data-type="delete" style="padding: 24px; text-align: center; border-left: 4px solid var(--text-muted); cursor: pointer; transition: all 0.2s; position: relative; ${this.selectedType === 'delete' ? 'border: 2px solid var(--text-muted); background: rgba(255, 255, 255, 0.05); box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);' : ''}">
              <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: 800; margin-bottom: 8px;">Deleted</div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--text-main);">${metrics.deleted}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Activities</div>
              ${this.selectedType === 'delete' ? '<div style="position: absolute; top: 10px; right: 10px; color: var(--text-muted); font-size: 1rem;">●</div>' : ''}
            </div>
          `;
        })()}
      </div>

      <!-- Activity List -->
      ${activities.length > 0 ? activities.map((act, actIdx) => {
        const ts = getTypeStyle(act.type);
        const groupedItems = {};
        (act.items || []).forEach(item => {
          // Group by both product and area so they don't combine in multi-area cards
          const key = item.area ? `${item.productId}-${item.area}` : item.productId;
          if (!groupedItems[key]) {
            groupedItems[key] = { ...item };
          } else {
            groupedItems[key].qty += item.qty;
          }
        });

        const itemRows = Object.values(groupedItems).map(item => {
          const targetArea = item.area || act.area;
          const invItems = state.inventory.filter(i => i.productId === item.productId && i.area === targetArea);
          const currentBalance = invItems.reduce((sum, i) => sum + i.quantity, 0);
          return { name: item.name, qty: item.qty, area: targetArea, balanceLeft: currentBalance };
        });

        return `
          <div class="card" style="padding: 0; overflow: hidden; border-radius: 16px; border: 1px solid var(--border-color); margin-bottom: 20px; position: relative;">
            <div style="padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.02);">
              <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(0,0,0,0.2); border: 1px solid ${ts.border}; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 10px ${ts.bg};">
                  ${ts.icon}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                    <span style="background: ${ts.bg}; color: ${ts.color}; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; border: 1px solid ${ts.border}; letter-spacing: 0.05em;">
                      ${ts.label}
                    </span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                      via ${(() => {
                        const s = act.source || 'Manual';
                        const match = s.match(/NexInvoice Upload \(Inv# (.+)\)/);
                        if (match) return `Invoice Scanning <span style="color: #8beaff; font-weight: 800;">(#${match[1]})</span>`;
                        return s;
                      })()}
                    </span>
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">
                    <span style="font-weight: 700;">📍 Area: <span style="color: var(--primary);">${act.area}</span></span>
                    <span style="margin-left: 16px;">👤 Agent: ${act.agent || 'Agent 1'}</span>
                    <span style="margin-left: 16px; color: #ffcc00; font-weight: 800;">🛠️ Created By: ${act.createdBy || 'System'}</span>
                    <span style="margin-left: 10px; color: var(--text-muted); font-size: 0.75rem; font-weight: 600;">📅 ${formatDateStr(act.date)}</span>
                  </div>
                </div>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-color); margin-right: 40px;">${Object.keys(groupedItems).length} product(s)</div>
              
              ${(act.type !== 'delete' && !(act.source && act.source.includes('Invoice'))) ? `
                <button class="btn-delete-activity" data-id="${act.id}" style="position: absolute; top: 15px; right: 15px; padding: 6px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); color: var(--danger); cursor: pointer; transition: all 0.2s;" title="Delete & Revert Stock">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              ` : ''}
            </div>

            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.1em; background: rgba(0,0,0,0.15);">
                  <th style="padding: 12px 24px; border-bottom: 1px solid var(--border-color);">Product Name</th>
                  <th style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); text-align: center; width: 120px;">📍 Area</th>
                  <th style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); text-align: center; width: 100px;">Qty</th>
                  <th style="padding: 12px 24px; border-bottom: 1px solid var(--border-color); text-align: right; width: 150px;">Balance Left</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows.map(row => `
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 14px 24px;">
                      <span style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">${row.name}</span>
                    </td>
                    <td style="padding: 14px 16px; text-align: center;">
                      <span style="font-size: 0.75rem; color: var(--primary); font-weight: 800;">${row.area}</span>
                    </td>
                    <td style="padding: 14px 16px; text-align: center;">
                      <span style="font-weight: 900; font-size: 1.05rem; color: ${ts.color};">
                        ${act.type === 'in' ? '+' : '-'}${row.qty}
                      </span>
                    </td>
                    <td style="padding: 14px 24px; text-align: right;">
                      <span style="font-weight: 800; font-size: 1.05rem; color: ${row.balanceLeft < 0 ? 'var(--danger)' : 'var(--text-main)'};">${row.balanceLeft}</span>
                      <span style="font-size: 0.65rem; color: var(--text-muted); margin-left: 4px;">PCS</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('') : `
        <div class="card" style="padding: 80px 40px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">📋</div>
          <h3 style="color: var(--text-main); font-weight: 800; margin: 0 0 8px;">No Activities found</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">
            Try adjusting your date filters to see records from other days.
          </p>
        </div>
      `}

      <!-- DELETE CONFIRMATION MODAL -->
      ${this.confirmDeleteId ? `
        <div class="modal-overlay active" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(8px); animation: modalIn 0.2s ease-out;">
          <div class="modal-content" style="background: var(--bg-surface); border: 1px solid var(--danger); border-radius: 20px; width: 450px; padding: 30px; text-align: center; box-shadow: 0 0 30px rgba(239, 68, 68, 0.2);">
            <div style="width: 64px; height: 64px; background: rgba(239, 68, 68, 0.1); border: 2px solid var(--danger); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: var(--danger);">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <h3 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 10px;">Confirm Deletion?</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 25px; line-height: 1.5;">This will remove the current log AND automatically generate a <b>contra transaction</b> to revert the stock balance.</p>
            <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 12px;">
              <button id="btn-cancel-del" style="padding: 12px; border-radius: 12px; border: 1px solid var(--border-color); background: transparent; color: var(--text-main); font-weight: 700; cursor: pointer;">Maintain Log</button>
              <button id="btn-confirm-revert" style="padding: 12px; border-radius: 12px; border: none; background: var(--danger); color: white; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">Revert & Delete</button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  },

  afterRender: function() {
    const trigger = document.getElementById('activity-date-trigger');
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

    document.querySelectorAll('.cal-preset-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const val = btn.dataset.preset;
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
          default: newFrom = newTo = null;
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

    document.querySelectorAll('.cal-cell.day').forEach(cell => {
      cell.onclick = (e) => {
        e.stopPropagation();
        const dateStr = cell.dataset.date;
        const clickedDate = new Date(dateStr + 'T00:00:00');
        if (!this.tempFrom || (this.tempFrom && this.tempTo)) {
          this.tempFrom = clickedDate;
          this.tempTo = null;
        } else {
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

    const cancelBtn = document.getElementById('act-cal-cancel');
    if (cancelBtn) {
      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        this.isCalendarOpen = false;
        this.triggerUpdate();
      };
    }

    const applyBtn = document.getElementById('act-cal-apply');
    if (applyBtn) {
      applyBtn.onclick = (e) => {
        e.stopPropagation();
        this.dateFrom = this.tempFrom;
        this.dateTo = this.tempTo || this.tempFrom;
        
        this.filterMode = 'custom';
        
        this.isCalendarOpen = false;
        this.triggerUpdate();
      };
    }

    const handleClickOutside = (e) => {
      if (this.isCalendarOpen && !e.target.closest('.cal-overlay') && !e.target.closest('#activity-date-trigger')) {
        this.isCalendarOpen = false;
        this.triggerUpdate();
        document.removeEventListener('click', handleClickOutside);
      }
    };
    document.addEventListener('click', handleClickOutside);

    // Scorecard Filter Handlers
    document.querySelectorAll('.summary-card').forEach(card => {
      card.onclick = () => {
        const type = card.dataset.type;
        if (this.selectedType === type) {
          this.selectedType = null; // Toggle off
        } else {
          this.selectedType = type; // Filter by this type
        }
        this.triggerUpdate();
      };
    });

    // Sidebar & Delete Handlers
    document.querySelectorAll('.btn-delete-activity').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.confirmDeleteId = btn.dataset.id;
        this.triggerUpdate();
      };
    });

    const cancelDel = document.getElementById('btn-cancel-del');
    if (cancelDel) cancelDel.onclick = () => { this.confirmDeleteId = null; this.triggerUpdate(); };

    const confirmRevert = document.getElementById('btn-confirm-revert');
    if (confirmRevert) {
      confirmRevert.onclick = () => {
        this.performReversal(this.confirmDeleteId);
        this.confirmDeleteId = null;
        this.triggerUpdate();
      };
    }
  },

  performReversal: function(activityId) {
    const state = window.AppState;
    const actIdx = state.hubActivities.findIndex(a => a.id === activityId);
    if (actIdx === -1) return;

    const originalAct = state.hubActivities[actIdx];
    
    // 1. REVERSE THE STOCK
    originalAct.items.forEach(item => {
      // Find area: items might have area, or the activity has one
      const targetArea = item.area || originalAct.area;
      let invItem = state.inventory.find(inv => inv.productId === item.productId && inv.area === targetArea);
      
      if (!invItem) {
        // Should rarely happen if we're reversing a log that happened, but for safety:
        invItem = {
          productId: item.productId,
          area: targetArea,
          outlet: ['Hugo','YS','Tai'].includes(targetArea) ? 'Penang' : 'Ipoh',
          quantity: 0
        };
        state.inventory.push(invItem);
      }

      // Reversal Logic
      if (originalAct.type === 'in') {
        invItem.quantity -= item.qty; // Reverse add
      } else if (originalAct.type === 'out') {
        invItem.quantity += item.qty; // Reverse subtract
      } else if (originalAct.type === 'transfer') {
        // Transfer area is like "Hugo -> YS"
        // Move stock back
        const match = targetArea.match(/(.+) ➔ (.+)/);
        if (match) {
          const from = match[1].trim();
          const to = match[2].trim();
          
          // Deduct from destination
          let destInv = state.inventory.find(i => i.productId === item.productId && i.area === to);
          if (destInv) destInv.quantity -= item.qty;
          
          // Add back to source
          let srcInv = state.inventory.find(i => i.productId === item.productId && i.area === from);
          if (srcInv) srcInv.quantity += item.qty;
        }
      }
    });

    // 2. CREATE THE CONTRA LOG
    const contraAct = {
      id: 'act-' + Date.now(),
      type: 'delete',
      source: `CONTRA (${originalAct.source || 'Manual'})`,
      date: new Date().toISOString(),
      area: originalAct.area,
      agent: originalAct.agent || 'Agent 1',
      items: originalAct.items.map(it => ({
        ...it,
        // Visual indicator of contra
        name: `REVERSED: ${it.name}`
      })),
      createdBy: window.AppState.user.displayName
    };

    // 3. UPDATE LOG LIST
    // Remove original, add contra
    state.hubActivities.splice(actIdx, 1);
    state.hubActivities.push(contraAct);

    // Save
    if (window.incInventoryVersion) window.incInventoryVersion();
    if (window.saveState) window.saveState();
  },

  triggerUpdate: function() {
    window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'inventory_activity' }));
  }
};
