// js/pages/dashboard.js
window.Pages = window.Pages || {};
window.Pages.dashboard = {
  render: function() {
    const state = window.AppState;
    
    const totalRev = state.invoices.reduce((sum, inv) => sum + inv.totalSales, 0);
    const totalCost = state.invoices.reduce((sum, inv) => sum + inv.totalCost, 0);
    const profit = totalRev - totalCost;
    const margin = totalRev > 0 ? ((profit / totalRev) * 100).toFixed(1) : 0;
    
    const lowStock = state.inventory.filter(i => i.quantity < 10).length;
    const expiringSubsCount = 1; 

    return `
      <div class="dashboard-header mb-4">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
          <div style="display:flex; align-items:center; gap: 15px;">
            <img src="assets/Dashboard.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
            <div>
              <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Dashboard</h2>
              <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Welcome back, Agent 1 👋 Here is your overall business summary.</p>
            </div>
          </div>
        </div>
        
        <div class="grid-cols-4" style="margin-bottom: 2rem;">
          <div class="card">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Total Revenue (YTD)</div>
            <div style="font-size: 1.8rem; font-weight: 700;">$${totalRev.toLocaleString()}</div>
          </div>
          <div class="card">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Total Profit</div>
            <div style="font-size: 1.8rem; font-weight: 700; color: var(--success);">$${profit.toLocaleString()}</div>
          </div>
          <div class="card">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Overall Margin</div>
            <div style="font-size: 1.8rem; font-weight: 700; color: var(--primary);">${margin}%</div>
          </div>
          <div class="card">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Low Stock Alerts</div>
            <div style="font-size: 1.8rem; font-weight: 700; color: var(--warning);">${lowStock} items</div>
          </div>
        </div>
        
        ${expiringSubsCount > 0 ? `
          <div class="card" style="border-left: 4px solid var(--danger); margin-bottom: 2rem;">
            <h3 style="color: var(--danger); margin-bottom: 8px;">⚠️ Immediate Action Required</h3>
            <p>You have <strong>${expiringSubsCount} customer subscriptions</strong> expiring within the next 30 days. Please check the Customers tab and reach out to them for renewal.</p>
          </div>
        ` : ''}
        
        <div class="grid-cols-2">
          <div class="card">
            <h3 style="margin-bottom: 1rem;">Recent Transactions</h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <th style="padding: 8px 0; color: var(--text-muted);">Invoice</th>
                  <th style="padding: 8px 0; color: var(--text-muted);">Date</th>
                  <th style="padding: 8px 0; color: var(--text-muted);">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${state.invoices.map(inv => `
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px 0;"><strong>${inv.id}</strong></td>
                    <td style="padding: 12px 0;">${inv.date}</td>
                    <td style="padding: 12px 0;">$${inv.totalSales}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="card">
            <h3 style="margin-bottom: 1rem;">Top Sales Agents</h3>
            <ul style="list-style: none;">
              ${state.agents.map(agent => `
                <li style="display:flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                  <div style="display:flex; align-items:center; gap: 8px;">
                    <div class="avatar" style="width:28px; height:28px; font-size:12px;">👤</div>
                    <span>${agent.name}</span>
                  </div>
                  <strong>$${state.invoices.filter(i => i.agentId === agent.id).reduce((s, i) => s + i.totalSales, 0)}</strong>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  }
};
