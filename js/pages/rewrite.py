import sys
import re

path = 'c:\\\\Users\\\\leeho\\\\.gemini\\\\antigravity\\\\scratch\\\\business_app\\\\js\\\\pages\\\\inventory.js'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update state variables
code = code.replace(
    '''stockOutAreaFilter: 'Hugo',''',
    '''stockOutAreaFilter: 'Hugo',\n  stockOutGroupFilter: 'All',\n  stockOutDraft: {},\n  confirmBulkStockOutData: null,'''
)

# 2. Add Group Filter Logic
code = code.replace(
    '''        let modalData = state.inventory;
        if (this.stockOutAreaFilter !== 'All Areas') {
          modalData = modalData.filter(i => i.area === this.stockOutAreaFilter);
        }''',
    '''        let modalData = state.inventory.filter(i => i.area === this.stockOutAreaFilter);'''
)

code = code.replace(
    '''        if (this.stockOutSearchQuery) {''',
    '''        if (this.stockOutGroupFilter !== 'All') {\n          modalDisplayList = modalDisplayList.filter(item => item.supplier === this.stockOutGroupFilter);\n        }\n\n        if (this.stockOutSearchQuery) {'''
)

# 3. Remove Top Right X
code = code.replace(
    '''<button id=\"so-close-modal\" style=\"background: none; border: none; color: var(--text-muted); cursor: pointer; display:flex; align-items:center; justify-content:center; width: 32px; height: 32px; border-radius: 50%; transition: all 0.2s; font-size: 1.5rem; line-height: 1;\">&times;</button>''',
    ''''''
)

# 4. Add Group Dropdown & Edit Area Dropdown
code = code.replace(
    '''                 <div style=\"position:relative; width: 220px;\">
                    <select id=\"so-area-select\" style=\"width: 100%; appearance: none; padding: 12px 40px 12px 16px; border-radius: 10px; border: 1.5px solid var(--border-color); background: var(--bg-main); color: var(--text-main); outline:none; font-size: 0.95rem; cursor: pointer;\">
                      <option value=\"All Areas\" ${this.stockOutAreaFilter === 'All Areas' ? 'selected' : ''}>All Areas</option>
                      ${availableAreas.map(a => `<option value=\"${a}\" ${this.stockOutAreaFilter === a ? 'selected' : ''}>Area: ${a}</option>`).join('')}
                    </select>
                    <span style=\"position:absolute; right: 15px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted); font-size: 0.8rem;\">▼</span>
                 </div>''',
    '''                 <div style=\"position:relative; width: 170px;\">
                    <select id=\"so-group-select\" style=\"width: 100%; appearance: none; padding: 12px 30px 12px 16px; border-radius: 10px; border: 1.5px solid var(--border-color); background: var(--bg-main); color: var(--text-main); outline:none; font-size: 0.95rem; cursor: pointer;\">
                      <option value=\"All\" ${this.stockOutGroupFilter === 'All' ? 'selected' : ''}>All Groups</option>
                      ${['Surftek', 'Mdot', 'Swisspac', 'Other'].map(g => `<option value=\"${g}\" ${this.stockOutGroupFilter === g ? 'selected' : ''}>Group: ${g}</option>`).join('')}
                    </select>
                    <span style=\"position:absolute; right: 15px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted); font-size: 0.8rem;\">▼</span>
                 </div>
                 
                 <div style=\"position:relative; width: 150px;\">
                    <select id=\"so-area-select\" style=\"width: 100%; appearance: none; padding: 12px 30px 12px 16px; border-radius: 10px; border: 1.5px solid var(--border-color); background: var(--bg-main); color: var(--text-main); outline:none; font-size: 0.95rem; cursor: pointer;\">
                      ${availableAreas.map(a => `<option value=\"${a}\" ${this.stockOutAreaFilter === a ? 'selected' : ''}>Area: ${a}</option>`).join('')}
                    </select>
                    <span style=\"position:absolute; right: 15px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted); font-size: 0.8rem;\">▼</span>
                 </div>'''
)

# 5. Fix Table Row action column inside the map loop definition
code = re.sub(
    r'\$\{this\.activeStockOutId === item\.invId \? `.*?`\}',
    '''<input type="number" class="so-bulk-qty-input" data-id="${item.invId}" value="${this.stockOutDraft[item.invId] || ''}" min="1" placeholder="0" style="width: 70px; padding: 10px 4px; border-radius: 8px; background: var(--bg-surface); color: var(--text-main); border: 1.5px solid var(--border-color); text-align:center; font-weight: 700; font-size: 1rem; outline:none; transition: border-color 0.2s;">''',
    code,
    flags=re.DOTALL
)

# 6. Add Global Action Footer and Replace Modal Overlay
code = code.replace(
'''               </div>
            </div>

            <!-- Double Confirmation Modal overlay -->''',
'''               </div>
               
               <div style="padding: 20px 24px; border-top: 1px solid var(--border-color); background: var(--bg-surface); display:flex; justify-content: flex-end; gap: 15px;">
                  <button id="btn-so-global-cross" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 2px solid rgba(239, 68, 68, 0.3); cursor: pointer; display:flex; justify-content:center; align-items:center; transition: all 0.2s;" title="Cancel & Close">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                  <button id="btn-so-global-tick" style="width: 50px; height: 50px; border-radius: 50%; background: #10B981; color: white; border: none; cursor: pointer; display:flex; justify-content:center; align-items:center; box-shadow: 0 4px 15px rgba(16,185,129,0.3); transition: transform 0.2s;" title="Confirm Stock Out">
                     <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
               </div>
            </div>

            <!-- Double Confirmation Modal overlay -->'''
)

code = re.sub(
    r'\$\{this\.confirmStockOutData \? `.*?` : \'\'\}',
    '''${this.confirmBulkStockOutData ? `
              <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.8); z-index: 10001; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(8px); animation: modalIn 0.2s ease-out; border-radius: inherit;">
                <div style="background: var(--bg-surface); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 20px; width: 600px; max-width: 90%; box-shadow: 0 30px 60px rgba(0,0,0,0.8), 0 0 40px rgba(239, 68, 68, 0.15); overflow: hidden; display: flex; flex-direction: column; max-height: 90%;">
                  
                  <div style="padding: 24px; text-align: center; border-bottom: 1px solid var(--border-color); background: rgba(239, 68, 68, 0.03);">
                    <h3 style="margin: 0; color: var(--danger); font-size: 1.3rem;">Confirm Bulk Stock Out</h3>
                    <p style="margin: 6px 0 0; color: var(--text-muted); font-size: 0.85rem;">You are about to deduct the following quantities:</p>
                  </div>

                  <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                    ${this.confirmBulkStockOutData.map((cdata, j) => `
                      <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                         <div style="font-weight: 800; color: var(--text-main); font-size: 1.05rem; margin-bottom: 8px;">${j+1}. ${cdata.name}</div>
                         <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">AREA: <span style="color:var(--primary);">📍 ${cdata.area}</span></span>
                            <span style="font-weight: 900; color: var(--danger); font-size: 1.2rem;">- ${cdata.qtyToDeduct} <small style="font-size:0.6em;">PCS</small></span>
                         </div>
                      </div>
                    `).join('')}
                  </div>

                  <div style="padding: 20px 24px; border-top: 1px solid var(--border-color); display: flex; gap: 15px; background: rgba(255,255,255,0.01);">
                     <button id="btn-so-confirm-cancel" style="flex: 1; padding: 14px; background: transparent; border: 1.5px solid var(--border-color); color: var(--text-main); font-weight: 700; border-radius: 10px; cursor: pointer; transition: all 0.2s;">
                       Cancel
                     </button>
                     <button id="btn-so-confirm-proceed" style="flex: 1; padding: 14px; background: var(--danger); border: none; color: white; font-weight: 700; font-size: 1rem; border-radius: 10px; cursor: pointer; transition: all 0.2s; box-shadow: 0 6px 15px rgba(239, 68, 68, 0.4);">
                       Confirm & Deduct All
                     </button>
                  </div>
                </div>
              </div>
            ` : ''}''',
    code,
    flags=re.DOTALL
)

# 7. Replace `afterRender` modal handlers completely
after_render_replace = '''    // Modal Handlers
    if (this.isStockOutModalOpen) {
      const globalCrossBtn = document.getElementById('btn-so-global-cross');
      if (globalCrossBtn) {
        globalCrossBtn.onclick = () => {
          this.isStockOutModalOpen = false;
          this.stockOutDraft = {};
          this.triggerUpdate();
        };
      }
      
      const soGroup = document.getElementById('so-group-select');
      if (soGroup) {
        soGroup.onchange = (e) => {
          this.stockOutGroupFilter = e.target.value;
          this.triggerUpdate();
        };
      }

      const soSearch = document.getElementById('so-search-input');
      if (soSearch) {
        soSearch.oninput = (e) => {
          this.stockOutSearchQuery = e.target.value;
          this.triggerUpdate();
        };
        if (this.stockOutSearchQuery) {
          soSearch.focus();
          soSearch.setSelectionRange(this.stockOutSearchQuery.length, this.stockOutSearchQuery.length);
        }
      }

      const soArea = document.getElementById('so-area-select');
      if (soArea) {
        soArea.onchange = (e) => {
          this.stockOutAreaFilter = e.target.value;
          this.triggerUpdate();
        };
      }

      document.querySelectorAll('.so-bulk-qty-input').forEach(inp => {
        inp.oninput = (e) => {
          const val = parseInt(e.target.value);
          if (val > 0) {
             this.stockOutDraft[e.target.dataset.id] = val;
             e.target.style.borderColor = 'var(--primary)';
          } else {
             delete this.stockOutDraft[e.target.dataset.id];
             e.target.style.borderColor = 'var(--border-color)';
          }
        };
      });

      const tickBtn = document.getElementById('btn-so-global-tick');
      if (tickBtn) {
        tickBtn.onclick = () => {
          const keys = Object.keys(this.stockOutDraft);
          if (keys.length === 0) {
             alert('Please enter at least one valid deduction quantity.');
             return;
          }
          
          const bulkData = [];
          for (let invId of keys) {
             const qty = this.stockOutDraft[invId];
             const invItem = window.AppState.inventory.find(i => i.id === invId);
             if (invItem) {
               const prod = window.AppState.products.find(p => p.id === invItem.productId);
               bulkData.push({
                 invId: invItem.id,
                 productId: prod.id,
                 name: prod ? prod.name : 'Unknown',
                 area: invItem.area,
                 qtyToDeduct: qty
               });
             }
          }
          
          this.confirmBulkStockOutData = bulkData;
          this.triggerUpdate();
        };
      }

      // Handlers for Custom Confirm Dialog
      if (this.confirmBulkStockOutData) {
         const btnConfirmCancel = document.getElementById('btn-so-confirm-cancel');
         if (btnConfirmCancel) {
            btnConfirmCancel.onclick = () => {
               this.confirmBulkStockOutData = null; // dismiss dialog
               this.triggerUpdate();
            };
         }
         
         const btnConfirmProceed = document.getElementById('btn-so-confirm-proceed');
         if (btnConfirmProceed) {
            btnConfirmProceed.onclick = () => {
               const bulkData = this.confirmBulkStockOutData;
               let totalDeducted = 0;
               
               bulkData.forEach(cdata => {
                  const invItem = window.AppState.inventory.find(i => i.id === cdata.invId);
                  if (invItem && cdata.qtyToDeduct > 0) {
                     invItem.quantity -= cdata.qtyToDeduct;
                     
                     if (!window.AppState.inventoryLogs) window.AppState.inventoryLogs = [];
                     window.AppState.inventoryLogs.push({
                        id: 'log-' + Date.now() + Math.random().toString(36).substr(2,5),
                        productId: cdata.productId,
                        type: 'out',
                        quantity: cdata.qtyToDeduct,
                        area: invItem.area,
                        date: new Date().toISOString(),
                        agent: 'Agent 1'
                     });
                     totalDeducted += cdata.qtyToDeduct;
                  }
               });
               
               if (window.saveState) window.saveState();
               alert('✅ Successfully deducted ' + totalDeducted + ' total unit(s)!');
               
               this.confirmBulkStockOutData = null;
               this.stockOutDraft = {};
               this.triggerUpdate();
            };
         }
      }
    }'''

code = re.sub(
    r'    // Modal Handlers\n    if \(this\.isStockOutModalOpen\) \{.*    \}\n  \},\n\n  triggerUpdate:',
    after_render_replace + '\n  },\n\n  triggerUpdate:',
    code,
    flags=re.DOTALL
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated inventory.js")
