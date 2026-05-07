// js/pages/reports.js
window.Pages = window.Pages || {};
window.Pages.reports = {
  filter: {
    type: 'all', // 'today', 'month', 'year', 'custom', 'all'
    start: '',
    end: ''
  },

  render: function() {
    const invoices = this.getFilteredInvoices();
    const metrics = this.calculateMetrics(invoices);
    
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/NexData.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Reports</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Business analytics and performance tracking.</p>
          </div>
        </div>
        <button id="btn-export-reports" title="Export Data (.csv)" style="width: 50px; height: 50px; background: #10b981; border: none; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
          <img src="assets/excel.gif" style="width: 32px; height: 32px; object-fit: contain; filter: invert(1) contrast(2) brightness(1.5) drop-shadow(0 0 2px #f25900); mix-blend-mode: screen;" alt=""/>
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <button class="filter-btn ${this.filter.type === 'today' ? 'active' : ''}" data-type="today">Today</button>
          <button class="filter-btn ${this.filter.type === 'month' ? 'active' : ''}" data-type="month">This Month</button>
          <button class="filter-btn ${this.filter.type === 'year' ? 'active' : ''}" data-type="year">This Year</button>
          <button class="filter-btn ${this.filter.type === 'all' ? 'active' : ''}" data-type="all">All Time</button>
          <button class="filter-btn ${this.filter.type === 'custom' ? 'active' : ''}" data-type="custom">Custom</button>
        </div>
        
        <div id="custom-date-inputs" style="display: ${this.filter.type === 'custom' ? 'flex' : 'none'}; gap: 8px; align-items: center;">
          <input type="date" class="date-input" id="start-date" value="${this.filter.start}">
          <span style="color:var(--text-muted)">to</span>
          <input type="date" class="date-input" id="end-date" value="${this.filter.end}">
          <button id="btn-apply-custom" class="btn-primary" style="padding: 4px 12px; font-size: 0.8rem;">Apply</button>
        </div>
      </div>

      <!-- Metrics Row -->
      <div class="metrics-row">
        <div class="metric-card">
          <span class="metric-label">Gross Revenue</span>
          <span class="metric-value">$${metrics.grossRev.toFixed(2)}</span>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Before Benefits/Discounts</p>
        </div>
        <div class="metric-card warning">
          <span class="metric-label">Actual Benefits</span>
          <span class="metric-value" style="color: var(--warning)">-$${metrics.totalDiscount.toFixed(2)}</span>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Discounts Given</p>
        </div>
        <div class="metric-card success">
          <span class="metric-label">Net Revenue</span>
          <span class="metric-value" style="color: var(--success)">$${metrics.netRev.toFixed(2)}</span>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Billed To Customers</p>
        </div>
        <div class="metric-card primary">
          <span class="metric-label">Net Profit</span>
          <span class="metric-value">$${metrics.netProfit.toFixed(2)}</span>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Margin vs Cost</p>
        </div>
      </div>

      <div class="grid-cols-2">
        <!-- Agent Leaderboard -->
        <div class="card">
          <h3 style="margin-bottom: 1.5rem; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            Sales Agent Performance
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="text-align: left; color: var(--text-muted); font-size: 0.85rem;">
                <th style="padding: 8px;">Agent</th>
                <th style="padding: 8px;">Net Sales</th>
                <th style="padding: 8px;">Profit</th>
                <th style="padding: 8px; text-align: right;">Margin %</th>
              </tr>
            </thead>
            <tbody>
              ${metrics.agentStats.map(stat => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 12px 8px; font-weight: 600;">${stat.name}</td>
                  <td style="padding: 12px 8px;">$${stat.sales.toFixed(2)}</td>
                  <td style="padding: 12px 8px; color: var(--success);">$${stat.profit.toFixed(2)}</td>
                  <td style="padding: 12px 8px; text-align: right; font-weight: bold;">
                    ${stat.sales > 0 ? ((stat.profit / stat.sales) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Profit Trend -->
        <div class="card">
           <h3 style="margin-bottom: 1.5rem; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            Service vs. Discount Impact
          </h3>
          <div style="margin-top: 24px;">
            <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
              <span>Setup Fees Revenue (Net)</span>
              <span style="font-weight: bold;">$${metrics.feeRev.toFixed(2)}</span>
            </div>
            <div style="height: 12px; background: var(--bg-main); border-radius: 6px; overflow: hidden; margin-bottom: 24px;">
              <div style="height: 100%; width: ${Math.min(100, (metrics.feeRev / (metrics.grossRev || 1)) * 100)}%; background: var(--primary);"></div>
            </div>

            <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
              <span>Discounts Applied</span>
              <span style="font-weight: bold; color: var(--danger);">-$${metrics.totalDiscount.toFixed(2)}</span>
            </div>
            <div style="height: 12px; background: var(--bg-main); border-radius: 6px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, (metrics.totalDiscount / (metrics.grossRev || 1)) * 100)}%; background: var(--danger);"></div>
            </div>
          </div>
          <p style="margin-top: 32px; font-size: 0.85rem; color: var(--text-muted);">
            Currently, discounts represent <b>${(metrics.totalDiscount / (metrics.grossRev || 1) * 100).toFixed(1)}%</b> of your gross volume.
          </p>
        </div>
      </div>
    `;
  },

  getFilteredInvoices: function() {
    const all = window.AppState.invoices || [];
    const now = new Date();
    
    const parse = (s) => {
      if (!s || !s.includes('/')) return new Date(s);
      const p = s.split('/');
      return new Date(p[2], p[1]-1, p[0]);
    };

    const isToday = (d) => {
      const t = new Date();
      return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
    };

    const isThisMonth = (d) => {
      const t = new Date();
      return d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
    };

    const isThisYear = (d) => {
      return d.getFullYear() === new Date().getFullYear();
    };

    return all.filter(inv => {
      const invDay = parse(inv.date);
      if (this.filter.type === 'today') return isToday(invDay);
      if (this.filter.type === 'month') return isThisMonth(invDay);
      if (this.filter.type === 'year') return isThisYear(invDay);
      if (this.filter.type === 'custom') {
        const start = this.filter.start ? new Date(this.filter.start + 'T00:00:00') : null;
        const end = this.filter.end ? new Date(this.filter.end + 'T23:59:59') : null;
        return (!start || invDay >= start) && (!end || invDay <= end);
      }
      return true; // 'all'
    });
  },

  calculateMetrics: function(invoices) {
    const state = window.AppState;
    let metrics = {
      grossRev: 0,
      totalDiscount: 0,
      netRev: 0,
      netProfit: 0,
      feeRev: 0,
      agentStats: state.agents.map(a => ({ id: a.id, name: a.name, sales: 0, profit: 0 }))
    };

    invoices.forEach(inv => {
      metrics.netRev += inv.totalSales;
      metrics.netProfit += (inv.totalSales - inv.totalCost);

      if (inv.items) {
        inv.items.forEach(item => {
          const product = state.products.find(p => p.id === item.productId);
          if (product) {
            // Gross calculation: use the product's base price * qty
            if (product.id !== 'f2') { // Don't add 'Discount' items to gross
               metrics.grossRev += (product.price * item.qty);
            }

            // Specific Fee tracking
            if (product.type === 'Fee' || product.type === 'Service') {
              if (product.id !== 'f2') metrics.feeRev += item.netAmt;
            }
          }
        });
      }

      // Agent Stats
      const agent = metrics.agentStats.find(s => s.id === inv.agentId);
      if (agent) {
        agent.sales += inv.totalSales;
        agent.profit += (inv.totalSales - inv.totalCost);
      }
    });

    // Total Discount is simply the difference between what we *could* have charged (Gross)
    // and what we actually charged (Net).
    metrics.totalDiscount = Math.max(0, metrics.grossRev - metrics.netRev);

    return metrics;
  },

  afterRender: function() {
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filter.type = btn.dataset.type;
        window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'reports' }));
      });
    });

    const applyCustom = document.getElementById('btn-apply-custom');
    if (applyCustom) {
      applyCustom.addEventListener('click', () => {
        this.filter.start = document.getElementById('start-date').value;
        this.filter.end = document.getElementById('end-date').value;
        window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'reports' }));
      });
    }

    // Initialize GIF hover logic
    window.Utils.initHoverGifs();
  }
};
