// js/pages/agents.js — Sales Force Module
window.Pages = window.Pages || {};
window.Pages.agents = {
  editingAgent: null,
  viewingAgent: null,
  viewFilterMonth: null,
  viewFilterYear: null,
  viewActiveYear: null,
  isViewCalendarOpen: false,

  getSalesAgents: function() {
    const invoices = window.AppState.invoices || [];
    const agentMap = {};
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Aggregate from all invoices that have salesAgent
    invoices.forEach(inv => {
      const name = (inv.salesAgent || '').trim();
      if (!name) return;

      if (!agentMap[name]) {
        agentMap[name] = { name: name, totalYTD: 0, totalMonth: 0, target: 0, invoiceIds: [], monthInvoices: [] };
      }

      const amt = parseFloat(inv.totalSales) || 0;

      // Parse invoice date (dd/mm/yyyy) for YTD and monthly tracking
      let invDate = null;
      if (inv.date) {
        const parts = inv.date.split('/');
        if (parts.length === 3) {
          invDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        }
      }

      // Total Revenue: all invoices for this agent
      agentMap[name].totalYTD += amt;

      // Current month: based on invoice date
      if (invDate && invDate.getFullYear() === currentYear && invDate.getMonth() === currentMonth) {
        agentMap[name].totalMonth += amt;
        agentMap[name].monthInvoices.push(inv);
      }

      agentMap[name].invoiceIds.push(inv.id);
    });

    // Load saved targets from localStorage
    const savedTargets = this.loadTargets();
    Object.keys(agentMap).forEach(name => {
      if (savedTargets[name] !== undefined) {
        agentMap[name].target = savedTargets[name];
      }
    });

    return Object.values(agentMap).sort((a, b) => b.totalYTD - a.totalYTD);
  },

  loadTargets: function() {
    try {
      const raw = localStorage.getItem('nexai_sales_targets');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  },

  saveTarget: function(name, target) {
    const targets = this.loadTargets();
    targets[name] = target;
    localStorage.setItem('nexai_sales_targets', JSON.stringify(targets));

    // Also sync targets to Firestore
    if (window.firebaseDb && window.AppState.user) {
      window.firebaseDb.collection('sales_targets').doc('targets').set(targets)
        .then(() => console.log('☁️ Sales targets synced'))
        .catch(e => console.error('Target sync error:', e));
    }
  },

  loadTargetsFromFirestore: async function() {
    if (!window.firebaseDb || !window.AppState.user) return;
    try {
      const doc = await window.firebaseDb.collection('sales_targets').doc('targets').get();
      if (doc.exists) {
        const data = doc.data();
        localStorage.setItem('nexai_sales_targets', JSON.stringify(data));
      }
    } catch (e) { console.error('Load targets error:', e); }
  },

  init: function() {
    this.loadTargetsFromFirestore();
  },

  render: function() {
    const agents = this.getSalesAgents();

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/NexMinion.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Sales Force</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Live agent performance tracked from invoice data.</p>
          </div>
        </div>
      </div>

      ${agents.length === 0 ? `
        <div class="card" style="text-align:center; padding: 60px;">
          <div style="font-size: 4rem; margin-bottom: 20px;">🧑‍💼</div>
          <h3 style="color: var(--text-muted); margin-bottom: 10px;">No Sales Agents Detected</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Upload invoices with a <b>"Sales"</b> field to populate this module automatically.</p>
        </div>
      ` : `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin-bottom: 2rem;">
          ${agents.map((agent, idx) => this.renderAgentCard(agent, idx)).join('')}
        </div>
      `}

      ${this.renderViewModal()}
      ${this.renderEditModal()}
    `;
  },

  renderAgentCard: function(agent, idx) {
    const hitTarget = agent.target > 0 && agent.totalMonth >= agent.target;
    const missTarget = agent.target > 0 && agent.totalMonth < agent.target;
    
    // Ticker symbol construction ($KT, $Tai)
    const ticker = '$' + agent.name.trim().replace(/\s+/g, '');
    const rankNum = idx + 1;

    // Progress bar percentage calculation
    const progress = agent.target > 0 ? Math.min((agent.totalMonth / agent.target) * 100, 100) : 0;

    // Target performance gain/loss calculations
    let gainBadge = '';
    if (agent.target > 0) {
      if (hitTarget) {
        const gainVal = ((agent.totalMonth / agent.target) - 1) * 100;
        gainBadge = `<span class="stock-gain-badge positive">▲ +${gainVal.toFixed(1)}%</span>`;
      } else {
        const gapVal = (1 - (agent.totalMonth / agent.target)) * 100;
        gainBadge = `<span class="stock-gain-badge negative">▼ -${gapVal.toFixed(1)}%</span>`;
      }
    } else {
      gainBadge = '<span class="stock-gain-badge neutral">● UNLISTED</span>';
    }

    // 1. Dynamic SVG Sparkline - Real chronological invoice trend
    const allInvoices = (window.AppState.invoices || []).filter(inv => (inv.salesAgent || '').trim() === agent.name);
    // Sort chronologically
    allInvoices.sort((a, b) => {
      const parseD = d => { if (!d) return 0; const p = d.split('/'); return new Date(+p[2], +p[1]-1, +p[0]).getTime(); };
      return parseD(a.date) - parseD(b.date);
    });

    const invoiceVals = allInvoices.map(inv => parseFloat(inv.totalSales) || 0);
    let sparklineHtml = '';
    if (invoiceVals.length > 0) {
      // Pad to at least 2 values to plot a line
      const points = invoiceVals.length === 1 ? [invoiceVals[0], invoiceVals[0]] : invoiceVals;
      const min = Math.min(...points);
      const max = Math.max(...points);
      const range = max - min || 1;

      // Coordinate scaling for SVG: width 120, height 30
      const w = 120;
      const h = 30;
      const svgPoints = points.map((val, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((val - min) / range) * (h - 6) - 3; // Keep padded
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

      sparklineHtml = `
        <svg width="120" height="35" style="overflow: visible;" title="Chronological Invoice Trajectory">
          <defs>
            <linearGradient id="sparkGrad-${agent.name.replace(/\s+/g, '')}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <polygon points="0,35 ${svgPoints} 120,35" fill="url(#sparkGrad-${agent.name.replace(/\s+/g, '')})" style="opacity: 0.4;" />
          <polyline points="${svgPoints}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      `;
    } else {
      sparklineHtml = `<span style="font-size: 0.65rem; color: var(--text-muted); font-style: italic;">No volume chart</span>`;
    }

    return `
      <div class="stock-card ${rankNum === 1 ? 'rank-1' : ''}">
        <!-- Card Header: Ticker & Status Badge -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="stock-badge-live-orange">● LIVE</span>
          </div>
        </div>

        <!-- Agent Name Header & Invoices count -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <div style="font-size: 1.25rem; font-weight: 900; color: var(--primary); line-height: 1.2; font-family: monospace; letter-spacing: 0.5px;">${ticker}</div>
            <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-top: 4px;">${agent.invoiceIds.length} Invoice${agent.invoiceIds.length !== 1 ? 's' : ''} Tracked</div>
          </div>
          <!-- Real SVG Sparkline overlay -->
          <div style="display: flex; align-items: flex-end; justify-content: flex-end;">
            ${sparklineHtml}
          </div>
        </div>

        <!-- Financial Metrics Container -->
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; flex: 1;">
          <!-- YTD Revenue (Market Cap) -->
          <div style="padding: 12px 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Market Cap (YTD)</div>
              <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-main);">RM ${agent.totalYTD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
            <div>
              ${gainBadge}
            </div>
          </div>

          <!-- Monthly Sales (Volume) -->
          <div style="padding: 12px 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 10px;">
            <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Volume (Month)</div>
            <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-main);">RM ${agent.totalMonth.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>

          <!-- Target Pacing Bar (Matching User Screenshot Layout) -->
          <div style="margin-top: 4px; margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Target</span>
              <span style="font-size: 0.8rem; font-weight: 800; color: var(--primary);">RM ${agent.target > 0 ? agent.target.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '—'}</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color);">
              <div style="width: ${progress}%; height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.5s ease; box-shadow: 0 0 6px var(--primary);"></div>
            </div>
            <div style="text-align: right; font-size: 0.6rem; color: var(--text-muted); margin-top: 4px; font-weight: 600;">${progress.toFixed(0)}%</div>
          </div>
        </div>

        <!-- Outlined Action Buttons footer -->
        <div style="display: flex; gap: 10px; border-top: 1px dashed var(--border-color); padding-top: 16px; margin-top: auto;">
          <button class="btn-stock-action-view btn-sf-view" data-name="${agent.name}">
            👁️ View
          </button>
          <button class="btn-stock-action-edit btn-sf-edit" data-name="${agent.name}">
            ✏️ Edit
          </button>
        </div>
      </div>
    `;
  },


  getMonthName: function(monthIndex) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[monthIndex];
  },

  getMonthShortName: function(idx) {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[idx];
  },

  renderMonthYearDropdown: function() {
    const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.viewActiveYear = this.viewActiveYear || new Date().getFullYear();

    return `
      <div id="sf-month-year-dropdown" style="position: absolute; top: calc(100% + 6px); right: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 5000; padding: 14px; width: 240px; display: flex; flex-direction: column; gap: 12px; animation: modalIn 0.15s ease-out;">
        <!-- Year Header Selector -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
          <button id="sf-prev-year" style="background: rgba(255,255,255,0.05); border: none; border-radius: 4px; color: var(--text-main); font-weight: 800; padding: 4px 10px; cursor: pointer; font-size: 0.85rem;"
                  onmouseover="this.style.background='rgba(242,89,0,0.1)'; this.style.color='var(--primary)';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='var(--text-main)';">
            &lt;
          </button>
          <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${this.viewActiveYear}</span>
          <button id="sf-next-year" style="background: rgba(255,255,255,0.05); border: none; border-radius: 4px; color: var(--text-main); font-weight: 800; padding: 4px 10px; cursor: pointer; font-size: 0.85rem;"
                  onmouseover="this.style.background='rgba(242,89,0,0.1)'; this.style.color='var(--primary)';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='var(--text-main)';">
            &gt;
          </button>
        </div>

        <!-- Months Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          ${monthShortNames.map((m, idx) => {
            const isSelected = this.viewFilterMonth === idx && this.viewFilterYear === this.viewActiveYear;
            const bg = isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.02)';
            const color = isSelected ? 'white' : 'var(--text-main)';
            const border = isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)';
            
            return `
              <button class="sf-month-opt" data-month="${idx}" style="padding: 10px 6px; border-radius: 8px; border: ${border}; background: ${bg}; color: ${color}; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;"
                      onmouseover="${isSelected ? '' : "this.style.background='rgba(242,89,0,0.1)'; this.style.color='var(--primary)'; this.style.borderColor='var(--primary)';"}"
                      onmouseout="${isSelected ? '' : "this.style.background='rgba(255,255,255,0.02)'; this.style.color='var(--text-main)'; this.style.borderColor='var(--border-color)';"}"
              >
                ${m}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Footer / Clear Filter -->
        <button id="sf-clear-date-filter" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.04); border: 1px dashed var(--border-color); border-radius: 8px; color: var(--text-muted); font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;"
                onmouseover="this.style.background='rgba(239,68,68,0.08)'; this.style.color='#ef4444'; this.style.borderColor='#ef4444';"
                onmouseout="this.style.background='rgba(255,255,255,0.04)'; this.style.color='var(--text-muted)'; this.style.borderColor='var(--border-color)';">
          Clear Filter (All Time)
        </button>
      </div>
    `;
  },

  renderViewModal: function() {
    if (!this.viewingAgent) return '';
    const agents = this.getSalesAgents();
    const agent = agents.find(a => a.name === this.viewingAgent);
    if (!agent) return '';

    const allInvoices = (window.AppState.invoices || []).filter(inv => (inv.salesAgent || '').trim() === agent.name);
    // Sort by date descending
    allInvoices.sort((a, b) => {
      const parseD = d => { if (!d) return 0; const p = d.split('/'); return new Date(+p[2], +p[1]-1, +p[0]).getTime(); };
      return parseD(b.date) - parseD(a.date);
    });

    // Filter displayed invoices by selected month & year
    let displayedInvoices = [...allInvoices];
    if (this.viewFilterMonth !== null && this.viewFilterYear !== null) {
      displayedInvoices = allInvoices.filter(inv => {
        if (!inv.date) return false;
        const parts = inv.date.split('/');
        if (parts.length === 3) {
          const invMonth = parseInt(parts[1], 10) - 1; // 0-indexed
          const invYear = parseInt(parts[2], 10);
          return invMonth === this.viewFilterMonth && invYear === this.viewFilterYear;
        }
        return false;
      });
    }

    // Dynamic metrics totals based on selected period
    let selectedMonthTotal = 0;
    displayedInvoices.forEach(inv => {
      selectedMonthTotal += parseFloat(inv.totalSales) || 0;
    });

    const monthLabel = this.viewFilterMonth !== null && this.viewFilterYear !== null 
      ? `${this.getMonthShortName(this.viewFilterMonth)} ${this.viewFilterYear}`
      : 'This Month';
    
    const displayMonthTotal = this.viewFilterMonth !== null && this.viewFilterYear !== null
      ? selectedMonthTotal
      : agent.totalMonth;

    return `
      <div class="modal-overlay active">
        <div class="modal-container" style="max-width: 750px;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #ff6b35); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; color: white; font-weight: 900;">${agent.name.charAt(0).toUpperCase()}</div>
              <div>
                <h3 style="margin:0; font-size: 1.2rem;">${agent.name}</h3>
                <p style="margin:0; font-size: 0.75rem; color: var(--text-muted);">${allInvoices.length} total invoices</p>
              </div>
            </div>
            <button id="btn-sf-close-view" style="background:none; border:none; font-size: 2rem; cursor:pointer; color:var(--text-main); line-height:1;">&times;</button>
          </div>
          <div class="modal-body" style="padding: 24px; max-height: 500px; overflow-y: auto;">
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
              <div style="background: rgba(255,251,0,0.05); border: 1px solid rgba(255,251,0,0.2); border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">YTD Revenue</div>
                <div style="font-size: 1.2rem; font-weight: 900; color: #fffb00;">RM ${agent.totalYTD.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
              </div>
              <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2); border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">${monthLabel}</div>
                <div style="font-size: 1.2rem; font-weight: 900; color: #10b981;">RM ${displayMonthTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
              </div>
              <div style="background: rgba(242,89,0,0.05); border: 1px solid rgba(242,89,0,0.2); border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Target</div>
                <div style="font-size: 1.2rem; font-weight: 900; color: var(--primary);">RM ${agent.target > 0 ? agent.target.toLocaleString(undefined, {minimumFractionDigits:2}) : '—'}</div>
              </div>
            </div>

            <!-- Invoice List Header with Month/Year Filter -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; position: relative;">
              <h4 style="margin: 0; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Invoice History</h4>
              
              <!-- Month/Year Dropdown Filter -->
              <div style="position: relative;" id="sf-date-filter-container">
                <button id="sf-date-filter-trigger" style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: 8px; cursor: pointer; color: var(--text-main); font-weight: 700; font-size: 0.85rem; transition: all 0.2s; outline: none;"
                        onmouseover="this.style.border='1.5px solid var(--primary)'" onmouseout="this.style.border='1.5px solid var(--border-color)'">
                  📅 ${this.viewFilterMonth !== null && this.viewFilterYear !== null ? `${this.getMonthShortName(this.viewFilterMonth)} ${this.viewFilterYear}` : 'All Time'}
                  <span style="font-size: 0.6rem; color: var(--primary); margin-left: 2px;">▼</span>
                </button>
                
                ${this.isViewCalendarOpen ? this.renderMonthYearDropdown() : ''}
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">
                  <th style="padding: 10px 8px; border-bottom: 1px solid var(--border-color);">Invoice No.</th>
                  <th style="padding: 10px 8px; border-bottom: 1px solid var(--border-color);">Date</th>
                  <th style="padding: 10px 8px; border-bottom: 1px solid var(--border-color);">Client</th>
                  <th style="padding: 10px 8px; border-bottom: 1px solid var(--border-color); text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${displayedInvoices.map(inv => `
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px 8px; font-weight: 700;">${inv.id}</td>
                    <td style="padding: 12px 8px;">${inv.date}</td>
                    <td style="padding: 12px 8px;">${inv.customerName || '—'}</td>
                    <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: var(--success);">RM ${(parseFloat(inv.totalSales) || 0).toFixed(2)}</td>
                  </tr>
                `).join('')}
                ${displayedInvoices.length === 0 ? '<tr><td colspan="4" style="padding: 30px; text-align: center; color: var(--text-muted);">No invoices found.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  renderEditModal: function() {
    if (!this.editingAgent) return '';
    const agents = this.getSalesAgents();
    const agent = agents.find(a => a.name === this.editingAgent);
    if (!agent) return '';

    return `
      <div class="modal-overlay active">
        <div class="modal-container" style="max-width: 450px;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0;">Edit Target — ${agent.name}</h3>
            <div style="display:flex; gap:12px; align-items:center;">
              <button id="btn-sf-cancel-edit" 
                      style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #ff4d4d; background: rgba(255,77,77,0.1); color: #ff4d4d; cursor: pointer; display: flex; align-items: center; justify-content: center; padding:0;" title="Cancel">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <button id="btn-sf-save-edit" 
                      style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--success); background: rgba(16,185,129,0.1); color: var(--success); cursor: pointer; display: flex; align-items: center; justify-content: center; padding:0;" title="Save">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          </div>
          <div class="modal-body" style="padding: 24px;">
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 20px;">Set the monthly sales target for <b>${agent.name}</b>. When the agent hits target, the amount turns <span style="color:#10b981; font-weight:700;">green</span>. Otherwise it shows <span style="color:#ef4444; font-weight:700;">red</span>.</p>
            
            <label style="display:block; font-size: 0.85rem; color:var(--text-muted); margin-bottom: 6px; font-weight: 500;">Monthly Target (RM)</label>
            <input type="number" id="sf-target-input" value="${agent.target || ''}" placeholder="e.g. 50000" step="100" min="0"
                   style="width:100%; padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); font-weight: 700; font-size: 1.1rem; outline: none;" />

            <div style="margin-top: 16px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                <span style="color: var(--text-muted);">Current Month Sales:</span>
                <span style="font-weight: 800; color: var(--success);">RM ${agent.totalMonth.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  afterRender: function() {
    // View buttons
    document.querySelectorAll('.btn-sf-view').forEach(btn => {
      btn.onclick = () => {
        this.viewingAgent = btn.dataset.name;
        this.viewFilterMonth = null;
        this.viewFilterYear = null;
        this.isViewCalendarOpen = false;
        this.viewActiveYear = new Date().getFullYear();
        this.triggerUpdate();
      };
    });

    // Edit buttons
    document.querySelectorAll('.btn-sf-edit').forEach(btn => {
      btn.onclick = () => {
        this.editingAgent = btn.dataset.name;
        this.triggerUpdate();
      };
    });

    // Close view modal
    const closeView = document.getElementById('btn-sf-close-view');
    if (closeView) {
      closeView.onclick = () => { 
        this.viewingAgent = null; 
        this.viewFilterMonth = null;
        this.viewFilterYear = null;
        this.isViewCalendarOpen = false;
        this.triggerUpdate(); 
      };
    }

    // Date Filter Dropdown elements
    const dateFilterTrigger = document.getElementById('sf-date-filter-trigger');
    if (dateFilterTrigger) {
      dateFilterTrigger.onclick = (e) => {
        e.stopPropagation();
        this.isViewCalendarOpen = !this.isViewCalendarOpen;
        this.triggerUpdate();
      };
    }

    const prevYear = document.getElementById('sf-prev-year');
    if (prevYear) {
      prevYear.onclick = (e) => {
        e.stopPropagation();
        this.viewActiveYear = (this.viewActiveYear || new Date().getFullYear()) - 1;
        this.triggerUpdate();
      };
    }

    const nextYear = document.getElementById('sf-next-year');
    if (nextYear) {
      nextYear.onclick = (e) => {
        e.stopPropagation();
        this.viewActiveYear = (this.viewActiveYear || new Date().getFullYear()) + 1;
        this.triggerUpdate();
      };
    }

    document.querySelectorAll('.sf-month-opt').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        this.viewFilterMonth = parseInt(opt.dataset.month, 10);
        this.viewFilterYear = this.viewActiveYear || new Date().getFullYear();
        this.isViewCalendarOpen = false;
        this.triggerUpdate();
      };
    });

    const clearDateFilter = document.getElementById('sf-clear-date-filter');
    if (clearDateFilter) {
      clearDateFilter.onclick = (e) => {
        e.stopPropagation();
        this.viewFilterMonth = null;
        this.viewFilterYear = null;
        this.isViewCalendarOpen = false;
        this.triggerUpdate();
      };
    }

    // Document click listener to close dropdown when clicking outside
    if (this.isViewCalendarOpen) {
      const dropdown = document.getElementById('sf-month-year-dropdown');
      const trigger = document.getElementById('sf-date-filter-trigger');
      
      const outsideClickListener = (event) => {
        if (dropdown && !dropdown.contains(event.target) && trigger && !trigger.contains(event.target)) {
          this.isViewCalendarOpen = false;
          this.triggerUpdate();
          document.removeEventListener('click', outsideClickListener);
        }
      };
      document.addEventListener('click', outsideClickListener);
    }

    // Cancel edit modal
    const cancelEdit = document.getElementById('btn-sf-cancel-edit');
    if (cancelEdit) cancelEdit.onclick = () => { this.editingAgent = null; this.triggerUpdate(); };

    // Save edit
    const saveEdit = document.getElementById('btn-sf-save-edit');
    if (saveEdit) {
      saveEdit.onclick = () => {
        const input = document.getElementById('sf-target-input');
        const val = parseFloat(input?.value) || 0;
        this.saveTarget(this.editingAgent, val);
        this.editingAgent = null;
        this.triggerUpdate();
      };
    }
  },

  triggerUpdate: function() {
    window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'agents' }));
  }
};
