// js/pages/agents.js
window.Pages = window.Pages || {};
window.Pages.agents = {
  render: function() {
    const state = window.AppState;
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
        <div style="display:flex; align-items:center; gap: 15px;">
          <img src="assets/NexMinion.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Sales Force</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Agent performance and hierarchy management.</p>
          </div>
        </div>
        <button class="btn-primary">+ Add Agent</button>
      </div>
      
      <div class="grid-cols-3">
        ${state.agents.map(agent => {
          const agentInvoices = state.invoices.filter(i => i.agentId === agent.id);
          const agentRev = agentInvoices.reduce((s, i) => s + i.totalSales, 0);
          return `
          <div class="card" style="text-align:center;">
            <div class="avatar" style="width: 64px; height: 64px; font-size: 32px; margin: 0 auto 1rem auto; background: var(--bg-main);">👤</div>
            <h3>${agent.name}</h3>
            <p style="color:var(--text-muted); margin-bottom: 1rem;">${agent.role}</p>
            <div style="background: var(--bg-main); border-radius: 8px; padding: 12px; margin-bottom: 1rem;">
              <div style="font-size: 0.8rem; color:var(--text-muted); text-transform:uppercase;">Total Revenue YTD</div>
              <div style="font-size: 1.4rem; font-weight:bold; color:var(--primary);">$${agentRev}</div>
            </div>
            <button class="btn-primary" style="width: 100%; background-color: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-color);">View Profile</button>
          </div>
          `;
        }).join('')}
      </div>
    `;
  }
};
