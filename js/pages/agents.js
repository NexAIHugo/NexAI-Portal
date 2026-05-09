// js/pages/agents.js — Sales Force Module
window.Pages = window.Pages || {};
window.Pages.agents = {
  editingAgent: null,
  viewingAgent: null,

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

      // Parse invoice date (dd/mm/yyyy) for YTD
      let invDate = null;
      if (inv.date) {
        const parts = inv.date.split('/');
        if (parts.length === 3) {
          invDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        }
      }

      // Parse loaded date (dd/mm/yyyy) for monthly tracking
      let loadDate = null;
      if (inv.loadedDate) {
        const lp = inv.loadedDate.split('/');
        if (lp.length === 3) {
          loadDate = new Date(+lp[2], +lp[1] - 1, +lp[0]);
        }
      }

      // Total Revenue: all invoices for this agent
      agentMap[name].totalYTD += amt;

      // Current month: based on loaded/upload date
      if (loadDate && loadDate.getFullYear() === currentYear && loadDate.getMonth() === currentMonth) {
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
          ${agents.map(agent => this.renderAgentCard(agent)).join('')}
        </div>
      `}

      ${this.renderViewModal()}
      ${this.renderEditModal()}
    `;
  },

  renderAgentCard: function(agent) {
    const hitTarget = agent.target > 0 && agent.totalMonth >= agent.target;
    const missTarget = agent.target > 0 && agent.totalMonth < agent.target;
    const monthColor = hitTarget ? '#10b981' : (missTarget ? '#ef4444' : 'var(--text-main)');
    const monthBg = hitTarget ? 'rgba(16,185,129,0.08)' : (missTarget ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)');
    const monthBorder = hitTarget ? 'rgba(16,185,129,0.3)' : (missTarget ? 'rgba(239,68,68,0.3)' : 'var(--border-color)');

    // Progress bar percentage
    const progress = agent.target > 0 ? Math.min((agent.totalMonth / agent.target) * 100, 100) : 0;
    const progressColor = hitTarget ? '#10b981' : (missTarget ? '#ef4444' : 'var(--primary)');

    return `
      <div class="card" style="padding: 0; overflow: hidden; border: 1px solid var(--border-color); transition: all 0.3s; position: relative;">
        <!-- Header -->
        <div style="padding: 24px 24px 16px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid var(--border-color);">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #ff6b35); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: white; font-weight: 900; flex-shrink: 0; box-shadow: 0 4px 12px rgba(242,89,0,0.4);">
            ${agent.name.charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${agent.name}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">${agent.invoiceIds.length} Invoice${agent.invoiceIds.length !== 1 ? 's' : ''} Tracked</div>
          </div>
          ${hitTarget ? '<div style="font-size: 1.4rem;" title="Target Hit!">🏆</div>' : ''}
        </div>

        <!-- Metrics -->
        <div style="padding: 20px 24px;">
          <!-- Total Revenue YTD -->
          <div style="margin-bottom: 16px; padding: 14px; background: rgba(255,251,0,0.05); border: 1px solid rgba(255,251,0,0.2); border-radius: 10px;">
            <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Total Revenue (YTD)</div>
            <div style="font-size: 1.5rem; font-weight: 900; color: #fffb00; text-shadow: 0 0 10px rgba(255,251,0,0.3);">RM ${agent.totalYTD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>

          <!-- Total Sales Month -->
          <div style="margin-bottom: 16px; padding: 14px; background: ${monthBg}; border: 1px solid ${monthBorder}; border-radius: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Total Sales (Month)</div>
              ${hitTarget ? '<span style="font-size: 0.6rem; font-weight: 800; color: #10b981; background: rgba(16,185,129,0.15); padding: 2px 8px; border-radius: 4px;">✓ HIT</span>' : ''}
              ${missTarget ? '<span style="font-size: 0.6rem; font-weight: 800; color: #ef4444; background: rgba(239,68,68,0.15); padding: 2px 8px; border-radius: 4px;">✗ MISS</span>' : ''}
            </div>
            <div style="font-size: 1.5rem; font-weight: 900; color: ${monthColor};">RM ${agent.totalMonth.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>

          <!-- Target -->
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Target</span>
              <span style="font-size: 0.85rem; font-weight: 800; color: var(--primary);">RM ${agent.target > 0 ? agent.target.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '—'}</span>
            </div>
            ${agent.target > 0 ? `
              <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
                <div style="width: ${progress}%; height: 100%; background: ${progressColor}; border-radius: 3px; transition: width 0.5s ease;"></div>
              </div>
              <div style="text-align: right; font-size: 0.6rem; color: var(--text-muted); margin-top: 4px; font-weight: 600;">${progress.toFixed(0)}%</div>
            ` : ''}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; border-top: 1px solid var(--border-color);">
          <button class="btn-sf-view" data-name="${agent.name}" style="flex: 1; padding: 14px; background: none; border: none; color: var(--primary); font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; border-right: 1px solid var(--border-color);"
                  onmouseover="this.style.background='rgba(242,89,0,0.08)'" onmouseout="this.style.background='none'">
            👁️ View
          </button>
          <button class="btn-sf-edit" data-name="${agent.name}" style="flex: 1; padding: 14px; background: none; border: none; color: #00b8ff; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;"
                  onmouseover="this.style.background='rgba(0,184,255,0.08)'" onmouseout="this.style.background='none'">
            ✏️ Edit
          </button>
        </div>
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
                <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">This Month</div>
                <div style="font-size: 1.2rem; font-weight: 900; color: #10b981;">RM ${agent.totalMonth.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
              </div>
              <div style="background: rgba(242,89,0,0.05); border: 1px solid rgba(242,89,0,0.2); border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Target</div>
                <div style="font-size: 1.2rem; font-weight: 900; color: var(--primary);">RM ${agent.target > 0 ? agent.target.toLocaleString(undefined, {minimumFractionDigits:2}) : '—'}</div>
              </div>
            </div>

            <!-- Invoice List -->
            <h4 style="margin: 0 0 12px 0; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Invoice History</h4>
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
                ${allInvoices.map(inv => `
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px 8px; font-weight: 700;">${inv.id}</td>
                    <td style="padding: 12px 8px;">${inv.date}</td>
                    <td style="padding: 12px 8px;">${inv.customerName || '—'}</td>
                    <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: var(--success);">RM ${(parseFloat(inv.totalSales) || 0).toFixed(2)}</td>
                  </tr>
                `).join('')}
                ${allInvoices.length === 0 ? '<tr><td colspan="4" style="padding: 30px; text-align: center; color: var(--text-muted);">No invoices found.</td></tr>' : ''}
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
    if (closeView) closeView.onclick = () => { this.viewingAgent = null; this.triggerUpdate(); };

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
