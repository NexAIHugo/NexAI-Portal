// js/pages/dong_zhuo.js
window.Pages = window.Pages || {};
window.Pages.dong_zhuo = {
  isImportModalOpen: false,
  modalTab: 'manual', // 'manual' or 'legacy'
  rawJsonInput: '',
  bearerToken: '',
  apiEndpoint: 'https://portal-v2.feedmeapi.com/my/restaurants-pagination?limit=2000&skip=0&sortBy=profile.name&search=&descending=false',
  isSyncing: false,
  importFeedback: '',
  searchQuery: '',

  // Filtering & Sorting State
  filterState: 'All States',
  isStateDropdownOpen: false,
  filterMode: 'all', // 'all', 'today', 'tomorrow', 'this_week', 'next_month', 'custom'
  dateFrom: null,
  dateTo: null,
  isCalendarOpen: false,
  calLeftMonth: null,
  calRightMonth: null,
  tempFrom: null,
  tempTo: null,
  expirySortMode: null, // null (default), 'asc', 'desc'
  statusFilter: 'all', // 'all', 'active', 'inactive', 'soon', 'expired'
  currentPage: 1,
  pageSize: 30,

  // Edit State
  editingCustomerId: null,

  // Renewal State
  renewCustomerId: null,
  renewDuration: '1y', // '1m', '3m', '6m', '1y'

  // Success Prompt State
  showSuccessPrompt: false,
  lastImportStats: { added: 0, skipped: 0 },
  selectedIds: [], // Track bulk selections

  selectedState: null, // Track state selected via map/region list
  malaysiaStates: [
    { name: 'Johor', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Flag_of_Johor.svg/320px-Flag_of_Johor.svg.png' },
    { name: 'Kedah', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Flag_of_Kedah.svg/320px-Flag_of_Kedah.svg.png' },
    { name: 'Kelantan', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Flag_of_Kelantan.svg/320px-Flag_of_Kelantan.svg.png' },
    { name: 'Kuala Lumpur', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Flag_of_Kuala_Lumpur%2C_Malaysia.svg/320px-Flag_of_Kuala_Lumpur%2C_Malaysia.svg.png' },
    { name: 'Melaka', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Flag_of_Malacca.svg/320px-Flag_of_Malacca.svg.png' },
    { name: 'Negeri Sembilan', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Flag_of_Negeri_Sembilan.svg/320px-Flag_of_Negeri_Sembilan.svg.png' },
    { name: 'Pahang', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Flag_of_Pahang.svg/320px-Flag_of_Pahang.svg.png' },
    { name: 'Penang', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Flag_of_Penang.svg/320px-Flag_of_Penang.svg.png' },
    { name: 'Perak', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flag_of_Perak.svg/320px-Flag_of_Perak.svg.png' },
    { name: 'Perlis', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Flag_of_Perlis.svg/320px-Flag_of_Perlis.svg.png' },
    { name: 'Sabah', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Flag_of_Sabah.svg/320px-Flag_of_Sabah.svg.png' },
    { name: 'Sarawak', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Flag_of_Sarawak.svg/320px-Flag_of_Sarawak.svg.png' },
    { name: 'Selangor', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Flag_of_Selangor.svg/320px-Flag_of_Selangor.svg.png' },
    { name: 'Terengganu', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Flag_of_Terengganu.svg/320px-Flag_of_Terengganu.svg.png' }
  ],

  init: function() {
    const now = new Date();
    this.calLeftMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    this.calRightMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  },

  normalizeStateName: function(state) {
    if (!state || state === '-' || typeof state !== 'string') return 'Others';
    const s = state.trim().toLowerCase();
    
    // Exact mapping requested by user
    if (s.includes('kampar')) return 'Perak';
    if (s.includes('selangor darul ehsan')) return 'Selangor';
    if (s.includes('federal territory of kuala lumpur')) return 'Kuala Lumpur';
    if (s.includes('johor darul ta')) return 'Johor';
    if (s.includes('pahang darul makmur')) return 'Pahang';
    if (s.includes('cameron highlands')) return 'Pahang';
    if (s.includes('wilayah persekutuan')) return 'Kuala Lumpur';
    if (s.includes('putrajaya')) return 'Kuala Lumpur';
    if (s.includes('labuan')) return 'Kuala Lumpur';
    if (s === 'pulau pinang') return 'Penang';
    if (s === 'melaka') return 'Melaka';
    if (s === 'negeri sembilan') return 'Negeri Sembilan';
    
    // General Cleanup
    const mainStates = this.malaysiaStates.map(st => st.name.toLowerCase());
    const match = mainStates.find(ms => s.includes(ms));
    if (match) {
      const original = this.malaysiaStates.find(st => st.name.toLowerCase() === match);
      return original ? original.name : 'Others';
    }

    return 'Others';
  },

  toTitleCase: function(str) {
    if (!str || str === '-' || typeof str !== 'string') return '-';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  },

  getDateRange: function() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from = null, to = null;

    switch (this.filterMode) {
      case 'today':
        from = to = today;
        break;
      case 'tomorrow':
        from = to = new Date(today.getTime() + 86400000);
        break;
      case 'this_week': {
        const day = today.getDay();
        from = today;
        to = new Date(today.getTime() + (6 - day) * 86400000);
        break;
      }
      case 'this_month':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'next_month':
        from = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        to = new Date(today.getFullYear(), today.getMonth() + 2, 0);
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

  getFilteredCustomers: function() {
    const state = window.AppState;
    const range = this.getDateRange();
    let list = (state.dongZhuoCustomers || []).map(c => ({
      ...c,
      normalizedState: this.normalizeStateName(c.state)
    }));

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.resId && c.resId.toLowerCase().includes(q)) ||
        (c.normalizedState && c.normalizedState.toLowerCase().includes(q))
      );
    }

    // Combine both dropdown filter and map/list selection
    const activeStateFilter = this.selectedState || (this.filterState !== 'All States' ? this.filterState : null);
    if (activeStateFilter) {
      list = list.filter(c => c.normalizedState === activeStateFilter);
    }

    if (range.from && range.to) {
      list = list.filter(c => {
        if (!c.subExpiry) return false;
        const d = new Date(c.subExpiry);
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return day >= range.from && day <= range.to;
      });
    }

    if (this.expirySortMode !== null) {
      list.sort((a, b) => {
        const expA = a.subExpiry ? new Date(a.subExpiry) : new Date(0);
        const expB = b.subExpiry ? new Date(b.subExpiry) : new Date(0);
        return this.expirySortMode === 'asc' ? expA - expB : expB - expA;
      });
    }

    // Status Filter Logic
    if (this.statusFilter !== 'all') {
      const now = new Date();
      list = list.filter(c => {
        if (this.statusFilter === 'active') return !c.inactive;
        if (this.statusFilter === 'inactive') return !!c.inactive;
        
        // 'soon' and 'expired' only apply to active users
        if (c.inactive) return false;
        if (!c.subExpiry) return false;
        
        const expDate = new Date(c.subExpiry);
        if (this.statusFilter === 'soon') {
          const diff = expDate - now;
          return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
        }
        if (this.statusFilter === 'expired') {
          return expDate <= now;
        }
        return true;
      });
    }

    return list;
  },




  handleExport: function() {
    const data = this.getFilteredCustomers().filter(c => !c.inactive);
    if (!data.length) return alert('No active records to export.');

    // UTF-8 BOM for Excel Chinese character support
    let csv = '\uFEFF';
    csv += 'Customer,Restaurant ID,State,Expiry\n';
    
    data.forEach(c => {
      const name = (c.name || '').replace(/"/g, '""');
      const resId = (c.resId || '').replace(/"/g, '""');
      const state = (c.normalizedState || '').replace(/"/g, '""');
      
      let expFormatted = 'N/A';
      if (c.subExpiry) {
        const d = new Date(c.subExpiry);
        if (!isNaN(d)) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          expFormatted = `${dd}-${mm}-${yyyy}`;
        }
      }
      
      csv += `"${name}","${resId}","${state}","${expFormatted}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Construct dynamic filename
    let datePart = 'All_Time';
    if (this.filterMode !== 'all' && this.dateFrom) {
      const f = this.dateFrom;
      const t = this.dateTo || f;
      const format = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(-2)}`;
      datePart = (f.toDateString() === t.toDateString()) ? format(f) : `${format(f)}_to_${format(t)}`;
    } else {
      const today = new Date();
      datePart = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getFullYear()).slice(-2)}`;
    }

    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `customer license ${datePart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  render: function() {
    if (!this.calLeftMonth) this.init();
    const state = window.AppState;
    const customersList = this.getFilteredCustomers();
    const range = this.getDateRange();

    // Get Unique Normalized States from database
    const activeStates = [...new Set((state.dongZhuoCustomers || []).map(c => this.toTitleCase(c.state)).filter(s => s && s !== '-'))].sort();
    const uniqueStates = ['All States', ...activeStates];

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/icafe.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">老本</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Managing isolated business network.</p>
          </div>
        </div>
        <div style="display:flex; gap: 12px; align-items:center;">
          <input type="text" id="dong-zhuo-search" placeholder="Search customer..." value="${this.searchQuery}" 
                 style="padding: 10px 16px; border-radius: 10px; border: 1.5px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); outline:none; font-size: 0.9rem; width: 240px;">
          <button id="btn-open-sync" class="btn-primary" style="padding: 10px 26px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 1rem; border-radius: 10px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(242, 89, 0, 0.4), 0 0 20px rgba(242, 89, 0, 0.2);">
            Fetch
            <img src="assets/upload.gif" style="width: 22px; height: 22px; object-fit: contain; filter: invert(1) brightness(1.5) drop-shadow(0 0 2px #f25900); mix-blend-mode: screen;" alt=""/>
          </button>
        </div>
      </div>

      <!-- STATUS SCORECARDS -->
      <div class="scorecard-banner" style="flex-wrap: wrap; margin-bottom: 25px;">
        <div class="nex-scorecard scorecard-active status-filter-btn ${this.statusFilter === 'active' ? 'selected' : ''}" data-status="active" style="cursor: pointer; border-width: ${this.statusFilter === 'active' ? '2.5px' : '1.5px'}; transform: ${this.statusFilter === 'active' ? 'scale(1.02)' : 'none'};">
          <div class="scorecard-icon">👥</div>
          <div class="scorecard-data">
            <div class="scorecard-label">Active Users</div>
            <div class="scorecard-value">${(state.dongZhuoCustomers || []).filter(c => !c.inactive).length}</div>
          </div>
        </div>
        <div class="nex-scorecard scorecard-inactive status-filter-btn ${this.statusFilter === 'inactive' ? 'selected' : ''}" data-status="inactive" style="cursor: pointer; border-width: ${this.statusFilter === 'inactive' ? '2.5px' : '1.5px'}; transform: ${this.statusFilter === 'inactive' ? 'scale(1.02)' : 'none'};">
          <div class="scorecard-icon">💤</div>
          <div class="scorecard-data">
            <div class="scorecard-label">Inactive Users</div>
            <div class="scorecard-value">${(state.dongZhuoCustomers || []).filter(c => c.inactive).length}</div>
          </div>
        </div>
        <div class="nex-scorecard scorecard-soon status-filter-btn ${this.statusFilter === 'soon' ? 'selected' : ''}" data-status="soon" style="cursor: pointer; border-width: ${this.statusFilter === 'soon' ? '2.5px' : '1.5px'}; transform: ${this.statusFilter === 'soon' ? 'scale(1.02)' : 'none'};">
          <div class="scorecard-icon">⏳</div>
          <div class="scorecard-data">
            <div class="scorecard-label">Expiry Soon</div>
            <div class="scorecard-value">${(state.dongZhuoCustomers || []).filter(c => {
              if (c.inactive || !c.subExpiry) return false;
              const d = new Date(c.subExpiry);
              const diff = d - new Date();
              return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
            }).length}</div>
          </div>
        </div>
        <div class="nex-scorecard scorecard-expired status-filter-btn ${this.statusFilter === 'expired' ? 'selected' : ''}" data-status="expired" style="cursor: pointer; border-width: ${this.statusFilter === 'expired' ? '2.5px' : '1.5px'}; transform: ${this.statusFilter === 'expired' ? 'scale(1.02)' : 'none'};">
          <div class="scorecard-icon">⚠️</div>
          <div class="scorecard-data">
            <div class="scorecard-label">Expired</div>
            <div class="scorecard-value">${(state.dongZhuoCustomers || []).filter(c => {
              if (c.inactive || !c.subExpiry) return false;
              return new Date(c.subExpiry) <= new Date();
            }).length}</div>
          </div>
        </div>
      </div>



      <!-- FILTERS ROW -->
      <div style="display:flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px;">
        
        <div style="padding-bottom: 5px;">
          <span style="font-size: 0.8rem; font-weight: 800; color: var(--primary); padding: 4px 12px; background: rgba(242, 89, 0, 0.1); border-radius: 8px; border: 1px solid var(--primary);">
            Total <span style="font-family: monospace; font-size: 0.9rem; margin: 0 4px;">${customersList.length}</span> Records in View
          </span>
        </div>

        <div style="display:flex; gap: 15px; align-items: center;">
          <!-- Export Button -->
          <button id="btn-export-customers" title="Export to Excel" style="width: 50px; height: 50px; background: #10b981; border: none; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
            <img src="assets/excel.gif" style="width: 32px; height: 32px; object-fit: contain; filter: invert(1) contrast(2) brightness(1.5) drop-shadow(0 0 2px #f25900); mix-blend-mode: screen;" alt=""/>
          </button>

          <!-- State Dropdown Filter -->
          <div style="position: relative;">
            <div id="state-filter-trigger" style="display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: var(--bg-surface); border: 2px solid ${this.isStateDropdownOpen ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 14px; cursor: pointer; min-width: 200px; transition: all 0.2s;">
              <div style="font-size: 1.2rem;">🏙️</div>
              <div style="flex: 1;">
                <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 0.05em; margin-bottom: 2px;">Filter by State</div>
                <div style="font-weight: 800; color: var(--text-main); font-size: 0.95rem;">${this.filterState}</div>
              </div>
              <div style="color: var(--primary); font-size: 0.8rem; transform: ${this.isStateDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s;">▼</div>
            </div>
            ${this.isStateDropdownOpen ? `
              <div class="dropdown-menu" style="position: absolute; top: calc(100% + 8px); right: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; min-width: 320px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 5000; padding: 12px; animation: modalIn 0.15s ease-out; max-height: 400px; overflow-y: auto;" class="custom-scrollbar">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                  ${uniqueStates.map(s => `
                    <div class="state-opt" data-val="${s}" style="padding: 10px 14px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.85rem; color: ${this.filterState === s ? 'var(--primary)' : 'var(--text-main)'}; background: ${this.filterState === s ? 'rgba(242,89,0,0.08)' : 'transparent'}; transition: all 0.2s;" onmouseover="this.style.background='rgba(242,89,0,0.05)'" onmouseout="this.style.background='${this.filterState === s ? 'rgba(242,89,0,0.08)' : 'transparent'}'">
                      ${s}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Expiry Calendar Filter -->
          <div style="position: relative;">
            <div id="expiry-filter-trigger" style="display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: var(--bg-surface); border: 2px solid ${this.isCalendarOpen ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 14px; cursor: pointer; min-width: 260px; transition: all 0.2s;">
              <div style="font-size: 1.2rem;">📅</div>
              <div style="flex: 1;">
                <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 0.05em; margin-bottom: 2px;">Expiry Range</div>
                <div style="font-weight: 800; color: var(--text-main); font-size: 0.95rem;">
                  ${this.filterMode === 'all' ? 'All Time' : (this.formatSimpleDate(range.from) + ' – ' + this.formatSimpleDate(range.to))}
                </div>
              </div>
            </div>
            ${this.isCalendarOpen ? this.renderCalendar() : ''}
          </div>
        </div>

      </div>
      
      <!-- BULK ACTION BAR (Floating) -->
      ${this.selectedIds.length > 0 ? `
        <div class="bulk-floating-bar">
          <div style="font-weight: 800; color: var(--text-main); font-size: 0.9rem;">
            <span style="color: var(--primary); font-size: 1.1rem;">${this.selectedIds.length}</span> items selected
          </div>
          <div style="flex: 1;"></div>
          <button id="btn-bulk-activate" class="btn" style="background: rgba(0, 255, 136, 0.1); border: 1.5px solid #00ff88; color: #00ff88; padding: 8px 20px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: all 0.2s; margin-right: 10px;">
            Activate
          </button>
          <button id="btn-bulk-deactivate" class="btn" style="background: rgba(255, 77, 77, 0.1); border: 1.5px solid #ff4d4d; color: #ff4d4d; padding: 8px 20px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
            Deactivate
          </button>
          <button id="btn-clear-selection" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-weight: 700; font-size: 0.8rem; text-decoration: underline;">
            Clear selection
          </button>
        </div>
      ` : ''}
      
      <div class="card" style="padding: 0; overflow-x: auto; border-radius: 16px; border: 1px solid var(--border-color);">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead style="background: rgba(255,255,255,0.02); border-bottom: 1.5px solid var(--border-color);">
            <tr style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">
              <th style="padding: 18px 24px; width: 50px;">
                <input type="checkbox" class="nex-checkbox" id="select-all-cust" ${customersList.length > 0 && customersList.every(c => this.selectedIds.includes(c.id)) ? 'checked' : ''}>
              </th>
              <th style="padding: 18px 24px;">Customer</th>
              <th style="padding: 18px 24px;">Restaurant ID</th>
              <th style="padding: 18px 24px;">State</th>
              <th style="padding: 18px 24px;">Heartbeat</th>
              <th style="padding: 18px 24px; cursor: pointer; user-select: none;" id="sort-expiry">
                <div style="display:flex; align-items:center; gap:6px;">
                  Expiry
                  ${this.expirySortMode ? `<span style="color: var(--primary); font-size: 0.7rem;">${this.expirySortMode === 'asc' ? '▲' : '▼'}</span>` : ''}
                </div>
              </th>
              <th style="padding: 18px 24px; text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const totalItems = customersList.length;
              const totalPages = Math.ceil(totalItems / this.pageSize) || 1;
              if (this.currentPage > totalPages) this.currentPage = totalPages;
              
              const startIdx = (this.currentPage - 1) * this.pageSize;
              const pageItems = customersList.slice(startIdx, startIdx + this.pageSize);

              if (pageItems.length === 0) return `<tr><td colspan="7" style="padding: 60px; text-align: center; color: var(--text-muted);">No customers found matching filters.</td></tr>`;

              return pageItems.map(c => {
                const now = new Date();
                const hbDate = c.posHeartbeat ? new Date(c.posHeartbeat) : null;
                const hbString = hbDate && !isNaN(hbDate) ? hbDate.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';
                
                const diffMs = hbDate && !isNaN(hbDate) ? (now - hbDate) : Infinity;
                let hbDotColor = '#00ff88'; // Vibrant Green (< 7 days)
                if (diffMs > 14 * 24 * 60 * 60 * 1000) hbDotColor = '#ff4d4d'; // Red (> 14 days)
                else if (diffMs > 7 * 24 * 60 * 60 * 1000) hbDotColor = '#ffcc00'; // Yellow (7-14 days)
                
                const expDate = c.subExpiry ? new Date(c.subExpiry) : null;
                const expString = expDate && !isNaN(expDate) ? expDate.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
                
                let expColor = '#00f59b'; // Vibrant Neon Green
                if (expDate && !isNaN(expDate)) {
                  if (expDate < now) {
                    expColor = '#ff4d4d'; // Red (Expired)
                  } else if ((expDate - now) < (30 * 24 * 60 * 60 * 1000)) {
                    expColor = '#ffcc00'; // Yellow (Nearing Expiry - 30 days)
                  }
                }

                return `
                  <tr class="${c.inactive ? 'row-inactive' : ''}" style="border-bottom: 1px solid var(--border-color); background: ${this.selectedIds.includes(c.id) ? 'rgba(242, 89, 0, 0.03)' : 'transparent'};">
                    <td style="padding: 18px 24px;">
                      <input type="checkbox" class="nex-checkbox cust-checkbox" data-id="${c.id}" ${this.selectedIds.includes(c.id) ? 'checked' : ''}>
                    </td>
                    <td style="padding: 18px 24px;">
                      <div style="display:flex; flex-direction:column; justify-content:center;">
                        <div style="font-weight: 700; color: var(--text-main); line-height: 1.2;">${c.name}</div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                          ${c.isNew ? `
                            <div style="color: #10b981; font-size: 0.55rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;">
                              <div style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 5px #10b981;"></div>
                              NEW
                            </div>
                          ` : ''}
                          ${c.inactive ? `
                            <div class="status-tag tag-inactive">
                              <div style="width: 6px; height: 6px; border-radius: 50%; background: #ff4d4d; box-shadow: 0 0 5px #ff4d4d;"></div>
                              INACTIVE
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    </td>
                    <td style="padding: 18px 24px;"><span style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted); background: var(--bg-main); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">${c.resId || 'N/A'}</span></td>
                    <td style="padding: 18px 24px; color: var(--text-main); font-weight: 500;">${c.normalizedState}</td>
                    <td style="padding: 18px 24px;">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <div style="font-size: 0.85rem; color: ${hbDotColor}; font-weight: 700;">${hbString}</div>
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${hbDotColor}; box-shadow: 0 0 10px ${hbDotColor}; flex-shrink: 0;"></div>
                      </div>
                    </td>
                    <td style="padding: 18px 24px;"><div style="font-weight: 800; color: ${expColor};">${expString}</div></td>
                    <td style="padding: 18px 24px; text-align: center;">
                      <div style="display: flex; justify-content: center; align-items: center; gap: 8px;">
                        <label class="nex-switch" title="${c.inactive ? 'Activate' : 'Deactivate'}">
                          <input type="checkbox" class="status-toggle" data-id="${c.id}" ${c.inactive ? '' : 'checked'}>
                          <span class="nex-slider"></span>
                        </label>
                        <button class="btn-circle btn-edit" data-id="${c.id}" style="width: 34px; height: 34px; background: rgba(0, 128, 255, 0.1); border: 1px solid #0080ff; color: #0080ff;" title="Edit" ${c.inactive ? 'disabled' : ''}>
                          ${window.Utils.renderHoverGif('edit.gif', 18, '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>')}
                        </button>
                        <button class="btn-circle btn-url-link" data-url="${c.licenseUrl || ''}" style="width: 34px; height: 34px; background: rgba(242, 89, 0, 0.1); border: 1px solid var(--primary); color: var(--primary);" title="Open URL" ${c.inactive ? 'disabled' : ''}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        </button>
                        <button class="btn-circle btn-renew" data-id="${c.id}" style="width: 34px; height: 34px; background: rgba(255, 204, 0, 0.1); border: 1px solid #ffcc00; color: #ffcc00;" title="Renew Expiry" ${c.inactive ? 'disabled' : ''}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>

      <!-- PAGINATION -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; padding: 0 10px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Rows per page:</span>
          <select id="select-pagesize" style="background:var(--bg-surface); border:1px solid var(--border-color); color:var(--text-main); border-radius:8px; padding:4px 8px; font-weight:700; outline:none;">
            ${[30, 50, 100].map(size => `<option value="${size}" ${this.pageSize === size ? 'selected' : ''}>${size}</option>`).join('')}
          </select>
        </div>
        
        <div style="display:flex; align-items:center; gap:8px;">
          ${(() => {
            const totalItems = customersList.length;
            const totalPages = Math.ceil(totalItems / this.pageSize) || 1;
            
            let btns = `
              <button class="btn-page nav-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''} style="padding: 6px 12px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-muted); cursor:pointer;">Previous</button>
            `;

            let start = Math.max(1, this.currentPage - 2);
            let end = Math.min(totalPages, start + 4);
            if (end === totalPages) start = Math.max(1, end - 4);

            for (let i = start; i <= end; i++) {
              btns += `
                <button class="btn-page num-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}"
                        style="width:34px; height:34px; border-radius:8px; border:1px solid ${i === this.currentPage ? 'var(--primary)' : 'var(--border-color)'}; 
                               background:${i === this.currentPage ? 'var(--primary)' : 'transparent'}; 
                               color:${i === this.currentPage ? 'white' : 'var(--text-main)'}; 
                               font-weight:800; cursor:pointer; transition:all 0.2s;">
                  ${i}
                </button>
              `;
            }

            btns += `
              <button class="btn-page nav-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''} style="padding: 6px 12px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-muted); cursor:pointer;">Next</button>
            `;
            return btns;
          })()}
        </div>
      </div>

      <!-- SYNC DIALOG MODAL -->
      ${this.isImportModalOpen ? this.renderSyncModal() : ''}

      <!-- EDIT PROFILE MODAL -->
      ${this.editingCustomerId ? this.renderEditModal() : ''}

      <!-- SUCCESS POPUP -->
      ${this.showSuccessPrompt ? this.renderSuccessPrompt() : ''}

      <!-- RENEW MODAL -->
      ${this.renewCustomerId ? this.renderRenewModal() : ''}

      <style>
        .neon-input { transition: all 0.3s ease; border: 1.5px solid var(--border-color) !important; }
        .neon-input:focus { border-color: #0080ff !important; box-shadow: 0 0 10px rgba(0, 128, 255, 0.5), inset 0 0 5px rgba(0, 128, 255, 0.2) !important; }
        .spinner-small { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .cal-overlay { animation: modalIn 0.2s ease-out; }
        .cal-cell { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; cursor: pointer; border-radius: 8px; transition: all 0.1s; font-weight: 600; }
        .cal-cell.day:hover { background: rgba(255,255,255,0.05); }
        .cal-cell.selected { background: var(--primary); color: white; box-shadow: 0 4px 10px rgba(242,89,0,0.3); }
        .cal-cell.in-range { background: rgba(242,89,0,0.1); color: var(--primary); border-radius: 0; }
        .cal-cell.today { border: 1.5px solid var(--primary); color: var(--primary); }
        .cal-nav-btn { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 6px; background: rgba(255,255,255,0.05); }
      </style>
    `;
  },

  renderEditModal: function() {
    const customer = (window.AppState.dongZhuoCustomers || []).find(c => c.id === this.editingCustomerId);
    if (!customer) return '';

    return `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(8px); animation: modalIn 0.3s ease-out;">
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; width: 550px; max-width: 95vw; box-shadow: 0 40px 80px rgba(0,0,0,0.6); overflow: hidden;">
          <div style="padding: 24px; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.02);">
            <div style="display:flex; align-items:center; gap: 12px;">
              <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--primary);">Edit Customer Profile</h3>
            </div>
            <button id="btn-close-edit-modal" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.8rem;">&times;</button>
          </div>
          <div style="padding: 30px; display: flex; flex-direction: column; gap: 20px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Customer Name</label>
                <input type="text" id="edit-cust-name" value="${customer.name || ''}" class="neon-input" style="width: 100%; padding: 12px; background: var(--bg-main); border: 1.5px solid var(--border-color); border-radius: 8px; color: var(--text-main); font-weight: 700; outline:none;">
              </div>
              <div>
                <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Restaurant ID</label>
                <input type="text" id="edit-cust-resid" value="${customer.resId || ''}" class="neon-input" style="width: 100%; padding: 12px; background: var(--bg-main); border: 1.5px solid var(--border-color); border-radius: 8px; color: var(--text-main); font-family: monospace; outline:none;">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">State</label>
                <input type="text" id="edit-cust-state" value="${customer.state || ''}" class="neon-input" style="width: 100%; padding: 12px; background: var(--bg-main); border: 1.5px solid var(--border-color); border-radius: 8px; color: var(--text-main); outline:none;">
              </div>
              <div>
                <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Expiry Date</label>
                <input type="date" id="edit-cust-expiry" value="${customer.subExpiry ? customer.subExpiry.split('T')[0] : ''}" class="neon-input" style="width: 100%; padding: 12px; background: var(--bg-main); border: 1.5px solid var(--border-color); border-radius: 8px; color: var(--text-main); outline:none;">
              </div>
            </div>
            <div>
              <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">License URL</label>
              <input type="text" id="edit-cust-license" value="${customer.licenseUrl || ''}" placeholder="https://..." class="neon-input" style="width: 100%; padding: 12px; background: var(--bg-main); border: 1.5px solid var(--border-color); border-radius: 8px; color: var(--primary); font-weight: 700; outline:none;">
            </div>
            
            <div style="display: flex; gap: 15px; margin-top: 10px;">
              <button id="btn-undo-edit" style="flex: 1; padding: 14px; background: transparent; border: 1.5px solid var(--border-color); color: var(--text-main); border-radius: 12px; font-weight: 800; cursor: pointer;">Undo</button>
              <button id="btn-save-edit" style="flex: 1; padding: 14px; background: var(--primary); border: none; color: white; border-radius: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(242, 89, 0, 0.4);">Save Profile</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderRenewModal: function() {
    const customer = (window.AppState.dongZhuoCustomers || []).find(c => c.id === this.renewCustomerId);
    if (!customer) return '';

    const options = [
      { id: '1m', label: '1 Month' },
      { id: '3m', label: '3 Months' },
      { id: '6m', label: '6 Months' },
      { id: '1y', label: '1 Year' }
    ];

    return `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(8px); animation: modalIn 0.3s ease-out;">
        <div style="background: var(--bg-surface); border: 2px solid #00ff80; border-radius: 24px; width: 450px; max-width: 90vw; box-shadow: 0 40px 100px rgba(0,255,128,0.2); overflow: hidden; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(0,255,128,0.1); border: 2px solid #00ff80; color: #00ff80; display:flex; align-items:center; justify-content:center; margin: 0 auto 16px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: var(--text-main);">Renew Subscription</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 8px;">Extending expiry for <span style="color:var(--primary); font-weight:800;">${customer.name}</span></p>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px;">
            ${options.map(opt => `
              <label style="display:flex; align-items:center; gap:12px; padding: 14px 20px; background: var(--bg-main); border: 2px solid ${this.renewDuration === opt.id ? '#00ff80' : 'var(--border-color)'}; border-radius: 14px; cursor: pointer; transition: all 0.2s;">
                <input type="radio" name="renew-opt" value="${opt.id}" ${this.renewDuration === opt.id ? 'checked' : ''} style="accent-color: #00ff80; width: 18px; height: 18px;">
                <span style="font-weight: 700; color: ${this.renewDuration === opt.id ? '#00ff80' : 'var(--text-main)'};">${opt.label}</span>
              </label>
            `).join('')}
          </div>

          <div style="display: flex; gap: 12px;">
            <button id="btn-cancel-renew" style="flex: 1; padding: 14px; background: transparent; border: 1.5px solid var(--border-color); color: var(--text-main); border-radius: 14px; font-weight: 800; cursor: pointer; transition: all 0.2s;">Cancel</button>
            <button id="btn-confirm-renew" style="flex: 2; padding: 14px; background: #00ff80; border: none; color: #000; border-radius: 14px; font-weight: 900; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 255, 128, 0.4); transition: transform 0.2s;">Confirm Renewal</button>
          </div>
        </div>
      </div>
    `;
  },


  renderSyncModal: function() {
    return `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(8px); animation: modalIn 0.3s ease-out;">
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; width: 750px; max-width: 95vw; height: 600px; box-shadow: 0 40px 80px rgba(0,0,0,0.6); overflow: hidden; display:flex; flex-direction:column;">
          <div style="padding: 24px; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.02);">
            <div style="display:flex; align-items:center; gap: 12px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(242, 89, 0, 0.1); border: 1px solid var(--primary); color: var(--primary); display:flex; align-items:center; justify-content:center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </div>
              <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800;">Sync Dialog</h3>
            </div>
            <button id="btn-close-sync" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.8rem;">&times;</button>
          </div>
          <div style="display:flex; border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.1);">
              <div class="sync-tab active" style="padding: 15px 25px; font-weight: 700; font-size: 0.82rem; border-bottom: 2px solid var(--primary); color: var(--primary); text-transform: uppercase;">Direct Sync (Token)</div>
          </div>
          <div style="padding: 24px; flex: 1; overflow-y: auto;">
              <div style="display:flex; flex-direction:column; gap: 20px;">
                  <div style="background: rgba(242, 89, 0, 0.05); border: 2px solid var(--primary); border-radius: 12px; padding: 18px;">
                    <p style="font-size: 0.95rem; font-weight: 800; color: var(--primary); margin-bottom: 20px;">Direct Bearer Sync</p>
                    <div style="margin-bottom: 12px;">
                      <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">ENDPOINT URL</label>
                      <input type="text" id="api-endpoint-input" value="${this.apiEndpoint}" class="neon-input" style="width: 100%; padding: 10px; background: var(--bg-main); border: 1.5px solid var(--border-color); border-radius: 8px; color: var(--text-main); font-family: monospace; font-size: 0.75rem; outline:none;">
                    </div>
                    <div style="margin-bottom: 20px;">
                      <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Bearer Token</label>
                      <textarea id="bearer-token-input" placeholder="Bearer eyJhbGciOi..." class="neon-input" style="width: 100%; height: 80px; background: var(--bg-main); border: 1.5px solid var(--border-color); border-radius: 8px; padding: 12px; color: var(--text-main); font-family: monospace; font-size: 0.8rem; outline:none;"></textarea>
                    </div>
                    <button id="btn-direct-sync" class="btn-primary" style="width: 100%; padding: 14px; font-weight: 800; display:flex; align-items:center; justify-content:center; gap:10px;" ${this.isSyncing ? 'disabled' : ''}>
                      ${this.isSyncing ? '<span class="spinner-small"></span> Fetching...' : 'Fetch & Sync'}
                    </button>
                  </div>
              </div>
            <div id="import-status" style="margin-top: 15px; font-size: 1rem; font-weight: 700;">${this.importFeedback}</div>
          </div>
        </div>
      </div>
    `;
  },

  renderSuccessPrompt: function() {
    return `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 11000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(4px); animation: fadeIn 0.3s ease-out;">
        <div style="background: var(--bg-surface); border: 2px solid var(--success); border-radius: 24px; padding: 40px; text-align: center; box-shadow: 0 40px 100px rgba(0,255,128,0.2); max-width: 400px; width: 90%;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(0,255,128,0.1); border: 2px solid var(--success); color: var(--success); display:flex; align-items:center; justify-content:center; margin: 0 auto 24px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style="font-size: 2rem; font-weight: 900; color: var(--text-main); margin-bottom: 12px;">Sync Successfully</h2>
          <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 16px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted); font-weight: 600;">✅ New Customers</span>
              <span style="color: var(--success); font-weight: 900; font-size: 1.2rem;">${this.lastImportStats.added}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted); font-weight: 600;">🛡️ Existing (Skipped)</span>
              <span style="color: var(--primary); font-weight: 900; font-size: 1.2rem;">${this.lastImportStats.skipped}</span>
            </div>
          </div>
          <button id="btn-close-success" style="width: 100%; padding: 14px; background: var(--success); border: none; color: white; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 1rem; transition: transform 0.2s;">Close</button>
        </div>
      </div>
    `;
  },

  renderCalendar: function() {
    const range = this.getDateRange();
    const presets = [
      { label: 'All Time', value: 'all' },
      { label: 'Today', value: 'today' },
      { label: 'Tomorrow', value: 'tomorrow' },
      { label: 'This Week', value: 'this_week' },
      { label: 'This Month', value: 'this_month' },
      { label: 'Next Month', value: 'next_month' },
      { label: 'This Year', value: 'this_year' },
    ];

    return `
      <div id="cal-overlay" style="position: absolute; top: calc(100% + 8px); right: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); z-index: 5000; display: flex; animation: modalIn 0.2s ease-out; overflow: hidden;">
        <div class="cal-presets" style="width: 140px; border-right: 1px solid var(--border-color); padding: 12px 0; display: flex; flex-direction: column;">
          ${presets.map(p => `
            <div class="cal-preset-btn ${this.filterMode === p.value ? 'active' : ''}" data-preset="${p.value}"
                 style="padding: 10px 16px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; font-weight: ${this.filterMode === p.value ? '700' : '500'}; 
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
            <button id="cal-cancel" style="padding: 8px 18px; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-main); cursor: pointer; font-size: 0.8rem; font-weight: 600;">Cancel</button>
            <button id="cal-apply" style="padding: 8px 18px; border-radius: 8px; border: none; background: var(--primary); color: white; cursor: pointer; font-size: 0.8rem; font-weight: 800;">Apply</button>
          </div>
        </div>
      </div>
    `;
  },

  renderCalendarMonth: function(baseDate, side) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += `<div class="cal-cell empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const isToday = cellDate.toDateString() === today.toDateString();
      const isSelected = (this.tempFrom && cellDate.toDateString() === this.tempFrom.toDateString()) || (this.tempTo && cellDate.toDateString() === this.tempTo.toDateString());
      const isInRange = this.tempFrom && this.tempTo && cellDate > this.tempFrom && cellDate < this.tempTo;
      
      let cls = 'cal-cell day';
      if (isSelected) cls += ' selected';
      else if (isInRange) cls += ' in-range';
      else if (isToday) cls += ' today';
      cells += `<div class="${cls}" data-date="${this.formatSimpleDate(cellDate)}">${d}</div>`;
    }

    return `
      <div style="width: 240px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 0 5px;">
          ${side === 'left' ? `<div class="cal-nav-btn" data-action="prev-month">‹</div>` : `<div style="width:24px;"></div>`}
          <span style="font-weight: 800; font-size: 0.9rem; color: var(--text-main);">${monthNames[month]} ${year}</span>
          ${side === 'right' ? `<div class="cal-nav-btn" data-action="next-month">›</div>` : `<div style="width:24px;"></div>`}
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 8px;">
          ${['S','M','T','W','T','F','S'].map(d => `<div style="text-align: center; font-size: 0.7rem; color: var(--text-muted); font-weight: 800;">${d}</div>`).join('')}
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr);">${cells}</div>
      </div>
    `;
  },

  afterRender: function() {
    window.Utils.initHoverGifs();
    // Search
    const searchInp = document.getElementById('dong-zhuo-search');
    if (searchInp) {
      searchInp.oninput = (e) => { 
        this.searchQuery = e.target.value; 
        this.currentPage = 1; // Reset on search
        this.triggerUpdate(); 
      };
      if (this.searchQuery) { searchInp.focus(); searchInp.setSelectionRange(this.searchQuery.length, this.searchQuery.length); }
    }

    // Modal
    const btnOpenSync = document.getElementById('btn-open-sync');
    if (btnOpenSync) btnOpenSync.onclick = () => { this.isImportModalOpen = true; this.importFeedback = ''; this.triggerUpdate(); };

    // Filter Trigger: State
    const stateTrigger = document.getElementById('state-filter-trigger');
    if (stateTrigger) stateTrigger.onclick = (e) => { e.stopPropagation(); this.isStateDropdownOpen = !this.isStateDropdownOpen; this.isCalendarOpen = false; this.triggerUpdate(); };

    // Filter Selection: State
    document.querySelectorAll('.state-opt').forEach(opt => {
      opt.onclick = (e) => { 
        e.stopPropagation(); 
        this.filterState = opt.dataset.val; 
        this.isStateDropdownOpen = false; 
        this.currentPage = 1; // Reset on state change
        this.triggerUpdate(); 
      };
    });

    // Filter Trigger: Calendar
    const expiryTrigger = document.getElementById('expiry-filter-trigger');
    if (expiryTrigger) expiryTrigger.onclick = (e) => { 
      e.stopPropagation(); 
      this.isCalendarOpen = !this.isCalendarOpen; 
      this.isStateDropdownOpen = false;
      const range = this.getDateRange();
      this.tempFrom = range.from; this.tempTo = range.to;
      this.triggerUpdate(); 
    };

    // Calendar Presets
    document.querySelectorAll('.cal-preset-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.filterMode = btn.dataset.preset;
        this.isCalendarOpen = false;
        this.triggerUpdate();
      };
    });

    // Calendar Days
    document.querySelectorAll('.cal-cell.day').forEach(cell => {
      cell.onclick = (e) => {
        e.stopPropagation();
        const clickedDate = new Date(cell.dataset.date + 'T00:00:00');
        if (!this.tempFrom || (this.tempFrom && this.tempTo)) {
          this.tempFrom = clickedDate; this.tempTo = null;
        } else {
          if (clickedDate < this.tempFrom) { this.tempTo = this.tempFrom; this.tempFrom = clickedDate; }
          else { this.tempTo = clickedDate; }
        }
        this.filterMode = 'custom';
        this.triggerUpdate();
      };
    });

    // Calendar Nav
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

    const calApply = document.getElementById('cal-apply');
    if (calApply) calApply.onclick = (e) => {
      e.stopPropagation();
      this.dateFrom = this.tempFrom; this.dateTo = this.tempTo || this.tempFrom;
      this.isCalendarOpen = false; 
      this.currentPage = 1; // Reset on date range change
      this.triggerUpdate();
    };
    
    const calCancel = document.getElementById('cal-cancel')
    if (calCancel) calCancel.onclick = (e) => { e.stopPropagation(); this.isCalendarOpen = false; this.triggerUpdate(); };

    // Sorting
    const sortExp = document.getElementById('sort-expiry');
    if (sortExp) sortExp.onclick = () => {
      if (this.expirySortMode === null) this.expirySortMode = 'asc';
      else if (this.expirySortMode === 'asc') this.expirySortMode = 'desc';
      else this.expirySortMode = null;
      this.triggerUpdate();
    };

    // Success Prompt Close
    const closeSuccess = document.getElementById('btn-close-success');
    if (closeSuccess) closeSuccess.onclick = () => { this.showSuccessPrompt = false; this.triggerUpdate(); };

    // ACTIONS
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => { this.editingCustomerId = btn.dataset.id; this.triggerUpdate(); };
    });

    document.querySelectorAll('.btn-url-link').forEach(btn => {
      btn.onclick = () => {
        const url = btn.dataset.url;
        if (url) window.open(url, '_blank');
        else alert('No License URL recorded for this customer.');
      };
    });

    // Row Toggle
    document.querySelectorAll('.status-toggle').forEach(toggle => {
      toggle.onchange = (e) => {
        const id = toggle.dataset.id;
        const idx = (window.AppState.dongZhuoCustomers || []).findIndex(c => c.id === id);
        if (idx !== -1) {
          window.AppState.dongZhuoCustomers[idx].inactive = !e.target.checked;
          const c = window.AppState.dongZhuoCustomers[idx];
          
          // ⚡ DELTA SYNC
          if (window.firebaseDb) {
              window.firebaseDb.collection("dong_zhuo_module").doc("data").collection("list").doc(c.id).set(c)
                .then(() => { if(window.syncStateToFirestore) window.syncStateToFirestore(true); })
                .catch(err => console.error("Toggle Status Delta Sync Error:", err));
          }
          if (window.saveState) window.saveState();
          this.triggerUpdate();
        }
      };
    });

    // EDIT MODAL BINDINGS
    const closeEdit = document.getElementById('btn-close-edit-modal');
    if (closeEdit) closeEdit.onclick = () => { this.editingCustomerId = null; this.triggerUpdate(); };

    const undoEdit = document.getElementById('btn-undo-edit');
    if (undoEdit) undoEdit.onclick = () => { this.editingCustomerId = null; this.triggerUpdate(); };

    const saveEdit = document.getElementById('btn-save-edit');
    if (saveEdit) saveEdit.onclick = () => this.handleSaveEdit();





    // --- PHASE 3 BINDINGS ---
    
    // Status Scorecard Clicks
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
      btn.onclick = () => {
        const newStatus = btn.dataset.status;
        if (this.statusFilter === newStatus) this.statusFilter = 'all';
        else this.statusFilter = newStatus;
        this.currentPage = 1; // Reset on status filter change
        this.triggerUpdate();
      };
    });

    // Export Button
    const btnExport = document.getElementById('btn-export-customers');
    if (btnExport) btnExport.onclick = () => this.handleExport();

    // Pagination: Page Number Clicks
    document.querySelectorAll('.btn-page').forEach(btn => {
      btn.onclick = () => {
        const page = parseInt(btn.dataset.page);
        if (!isNaN(page)) {
          this.currentPage = page;
          this.triggerUpdate();
        }
      };
    });

    // Pagination: Rows Per Page Select
    const selectPageSize = document.getElementById('select-pagesize');
    if (selectPageSize) {
      selectPageSize.onchange = (e) => {
        this.pageSize = parseInt(e.target.value);
        this.currentPage = 1; // Reset to page 1 on size change
        this.triggerUpdate();
      };
    }

    // Sync Modal Inner
    if (this.isImportModalOpen) {
      const closeBtn = document.getElementById('btn-close-sync');
      if (closeBtn) closeBtn.onclick = () => { this.isImportModalOpen = false; this.triggerUpdate(); };
      const btnDirectSync = document.getElementById('btn-direct-sync');
      if (btnDirectSync) btnDirectSync.onclick = async () => this.handleDirectSync();
    }

    // Renewal Modal Bindings
    document.querySelectorAll('.btn-renew').forEach(btn => {
      btn.onclick = () => { this.renewCustomerId = btn.dataset.id; this.triggerUpdate(); };
    });

    if (this.renewCustomerId) {
      const cancelRenew = document.getElementById('btn-cancel-renew');
      if (cancelRenew) cancelRenew.onclick = () => { this.renewCustomerId = null; this.triggerUpdate(); };

      const confirmRenew = document.getElementById('btn-confirm-renew');
      if (confirmRenew) confirmRenew.onclick = () => this.handleRenewConfirm();

      document.querySelectorAll('input[name="renew-opt"]').forEach(rad => {
        rad.onchange = () => { this.renewDuration = rad.value; this.triggerUpdate(); };
      });
    }

    // --- BULK SELECTION ACTIONS ---
    
    // Select All
    const selectAllCheck = document.getElementById('select-all-cust');
    if (selectAllCheck) {
      selectAllCheck.onchange = (e) => {
        const filtered = this.getFilteredCustomers();
        if (e.target.checked) {
          // Add all visible ones that aren't already selected
          filtered.forEach(c => {
            if (!this.selectedIds.includes(c.id)) this.selectedIds.push(c.id);
          });
        } else {
          // Remove all visible ones
          const filteredIds = filtered.map(c => c.id);
          this.selectedIds = this.selectedIds.filter(id => !filteredIds.includes(id));
        }
        this.triggerUpdate();
      };
    }

    // Row Checkboxes
    document.querySelectorAll('.cust-checkbox').forEach(cb => {
      cb.onchange = (e) => {
        const id = cb.dataset.id;
        if (e.target.checked) {
          if (!this.selectedIds.includes(id)) this.selectedIds.push(id);
        } else {
          this.selectedIds = this.selectedIds.filter(sid => sid !== id);
        }
        this.triggerUpdate();
      };
    });

    // Clear Selection
    const btnClear = document.getElementById('btn-clear-selection');
    if (btnClear) {
      btnClear.onclick = () => {
        this.selectedIds = [];
        this.triggerUpdate();
      };
    }

    // Bulk Status Actions
    const btnBulkActivate = document.getElementById('btn-bulk-activate');
    if (btnBulkActivate) {
      btnBulkActivate.onclick = async () => {
        const changedDocs = [];
        (window.AppState.dongZhuoCustomers || []).forEach(c => {
          if (this.selectedIds.includes(c.id)) {
             c.inactive = false;
             changedDocs.push(c);
          }
        });
        this.selectedIds = [];
        if (window.saveState) window.saveState();
        
        // ⚡ DELTA SYNC BATCH
        if (window.firebaseDb && changedDocs.length > 0) {
            try {
               const db = window.firebaseDb;
               const batch = db.batch();
               changedDocs.forEach(c => {
                   batch.set(db.collection("dong_zhuo_module").doc("data").collection("list").doc(c.id), c);
               });
               await batch.commit();
               if(window.syncStateToFirestore) window.syncStateToFirestore(true);
            } catch(e) { console.error("Bulk Activate Delta Sync Error:", e); }
        }
        this.triggerUpdate();
      };
    }

    const btnBulkDeactivate = document.getElementById('btn-bulk-deactivate');
    if (btnBulkDeactivate) {
      btnBulkDeactivate.onclick = async () => {
        const changedDocs = [];
        (window.AppState.dongZhuoCustomers || []).forEach(c => {
          if (this.selectedIds.includes(c.id)) {
             c.inactive = true;
             changedDocs.push(c);
          }
        });
        this.selectedIds = [];
        if (window.saveState) window.saveState();
        
        // ⚡ DELTA SYNC BATCH
        if (window.firebaseDb && changedDocs.length > 0) {
            try {
               const db = window.firebaseDb;
               const batch = db.batch();
               changedDocs.forEach(c => {
                   batch.set(db.collection("dong_zhuo_module").doc("data").collection("list").doc(c.id), c);
               });
               await batch.commit();
               if(window.syncStateToFirestore) window.syncStateToFirestore(true);
            } catch(e) { console.error("Bulk Deactivate Delta Sync Error:", e); }
        }
        this.triggerUpdate();
      };
    }
  },

  handleSaveEdit: function() {
    const id = this.editingCustomerId;
    const name = document.getElementById('edit-cust-name').value.trim();
    const resId = document.getElementById('edit-cust-resid').value.trim();
    const state = document.getElementById('edit-cust-state').value.trim();
    const expiry = document.getElementById('edit-cust-expiry').value;
    const licenseUrl = document.getElementById('edit-cust-license').value.trim();

    const idx = (window.AppState.dongZhuoCustomers || []).findIndex(c => c.id === id);
    if (idx !== -1) {
      const updatedCustomer = {
        ...window.AppState.dongZhuoCustomers[idx],
        name, resId, state, subExpiry: expiry ? expiry + 'T00:00:00.000Z' : null, licenseUrl
      };
      window.AppState.dongZhuoCustomers[idx] = updatedCustomer;
      
      // ⚡ DELTA SYNC
      if (window.firebaseDb) {
        window.firebaseDb.collection("dong_zhuo_module").doc("data").collection("list").doc(updatedCustomer.id).set(updatedCustomer)
          .then(() => { if(window.syncStateToFirestore) window.syncStateToFirestore(true); }) // silent metadata ping
          .catch(e => console.error("Delta Sync Edit Error:", e));
      }
      if (window.saveState) window.saveState();
      
      this.editingCustomerId = null;
      this.triggerUpdate();
    }
  },

  handleRenewConfirm: function() {
    const id = this.renewCustomerId;
    const duration = this.renewDuration;
    const idx = (window.AppState.dongZhuoCustomers || []).findIndex(c => c.id === id);
    if (idx !== -1) {
      const customer = window.AppState.dongZhuoCustomers[idx];
      let currentExpiry = customer.subExpiry ? new Date(customer.subExpiry) : new Date();
      if (isNaN(currentExpiry)) currentExpiry = new Date();

      if (duration === '1m') currentExpiry.setMonth(currentExpiry.getMonth() + 1);
      else if (duration === '3m') currentExpiry.setMonth(currentExpiry.getMonth() + 3);
      else if (duration === '6m') currentExpiry.setMonth(currentExpiry.getMonth() + 6);
      else if (duration === '1y') currentExpiry.setFullYear(currentExpiry.getFullYear() + 1);

      customer.subExpiry = currentExpiry.toISOString();
      
      // ⚡ DELTA SYNC
      if (window.firebaseDb) {
        window.firebaseDb.collection("dong_zhuo_module").doc("data").collection("list").doc(customer.id).set(customer)
          .then(() => { if(window.syncStateToFirestore) window.syncStateToFirestore(true); })
          .catch(e => console.error("Delta Sync Renew Error:", e));
      }
      if (window.saveState) window.saveState();
      
      this.renewCustomerId = null;
      this.renewDuration = '1y';
      this.triggerUpdate();
    }
  },

  handleDirectSync: async function() {
    const rawToken = document.getElementById('bearer-token-input').value.trim();
    const baseUrl = document.getElementById('api-endpoint-input').value.trim();
    if (!rawToken || !baseUrl) return;
    const token = rawToken.startsWith('Bearer ') ? rawToken : 'Bearer ' + rawToken;
    this.isSyncing = true; this.importFeedback = 'Connecting...'; this.triggerUpdate();
    try {
      const urlObj = new URL(baseUrl);
      const limit = parseInt(urlObj.searchParams.get('limit')) || 1000;
      let allItems = []; let skip = 0; let total = 1;
      while (skip < total) {
        urlObj.searchParams.set('skip', skip);
        const res = await fetch(urlObj.toString(), { headers: { "authorization": token, "accept": "application/json" } });
        if (!res.ok) throw new Error(res.status === 401 ? "Unauthorized" : "Sync Error");
        const data = await res.json();
        allItems.push(...(data.resources || []));
        total = data.totalCount || 0; skip += limit;
        this.importFeedback = `Syncing: ${allItems.length} / ${total}`; this.triggerUpdate();
      }
      await this.processBatch(allItems);
      
      this.isSyncing = false;
      this.isImportModalOpen = false;
      this.showSuccessPrompt = true;
      this.triggerUpdate();
    } catch (e) { this.isSyncing = false; this.importFeedback = '<span style="color:var(--danger)">CORS or Token Error.</span>'; this.triggerUpdate(); }
  },

  deleteCustomer: function(id) {
    window.AppState.dongZhuoCustomers = (window.AppState.dongZhuoCustomers || []).filter(c => c.id !== id);
    
    // ⚡ DELTA SYNC
    if (window.firebaseDb) {
        window.firebaseDb.collection("dong_zhuo_module").doc("data").collection("list").doc(id).delete()
          .then(() => { if(window.syncStateToFirestore) window.syncStateToFirestore(true); })
          .catch(e => console.error("Delta Sync Delete Error:", e));
    }
    if (window.saveState) window.saveState();
    this.triggerUpdate();
  },

  processBatch: async function(resources) {
    let added = 0;
    let skipped = 0;

    // Reset "NEW" status for existing customers before new sync
    if (window.AppState.dongZhuoCustomers) {
      window.AppState.dongZhuoCustomers.forEach(c => c.isNew = false);
    }

    const changedDocs = [];

    resources.forEach(res => {
      const resId = res._id || res.id; if (!resId) return;
      const existingIdx = (window.AppState.dongZhuoCustomers || []).findIndex(c => c.resId === resId);
      
      const data = { 
        resId, 
        name: res.profile ? res.profile.name : 'Unknown', 
        state: (res.profile && res.profile.address) ? (res.profile.address.state || '-') : '-', 
        subExpiry: res.expiredAt || null, 
        posHeartbeat: res.posHeartbeat || null
      };

      if (existingIdx !== -1) {
        // Update heartbeat and expiry for existing customer
        const updated = { 
          ...window.AppState.dongZhuoCustomers[existingIdx], 
          ...data 
        };
        window.AppState.dongZhuoCustomers[existingIdx] = updated;
        changedDocs.push(updated);
        skipped++;
      } else {
        // Add new customer
        if (!window.AppState.dongZhuoCustomers) window.AppState.dongZhuoCustomers = [];
        const newCust = { 
          id: 'c-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), 
          ...data,
          isNew: true 
        };
        window.AppState.dongZhuoCustomers.push(newCust);
        changedDocs.push(newCust);
        added++;
      }
    });
    this.lastImportStats = { added, skipped };
    if (window.saveState) window.saveState();
    
    // ⚡ DELTA SYNC BATCH UPDATE
    if (window.firebaseDb && changedDocs.length > 0) {
       try {
           const db = window.firebaseDb;
           // Firestore batch has a limit of 500 operations, so we chunk it
           const chunks = [];
           for (let i = 0; i < changedDocs.length; i += 400) chunks.push(changedDocs.slice(i, i + 400));
           
           for (const chunk of chunks) {
               const batch = db.batch();
               chunk.forEach(docData => {
                   const ref = db.collection("dong_zhuo_module").doc("data").collection("list").doc(docData.id);
                   batch.set(ref, docData);
               });
               await batch.commit();
           }
           if(window.syncStateToFirestore) window.syncStateToFirestore(true);
           console.log("⚡ Delta Sync complete for Dong Zhuo Batch Fetch");
       } catch (e) {
           console.error("Dong Zhuo Delta Sync Batch Error:", e);
       }
    }
  },

  triggerUpdate: function() { window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'dong_zhuo' })); }
};
