// js/pages/user_log.js
window.Pages = window.Pages || {};

window.Pages.user_log = {
  users: [],
  isLoading: true,
  openDropdownUid: null,

  // Mapping of internal roles to display names
  ROLE_DISPLAY_MAP: {
    'SuperAdmin': 'The Ruler',
    'Sales': 'The Hunter',
    'Tech': 'The Engineer',
    'Marketing': 'The Artisan',
    'Guest': 'The Nomad'
  },

  // Role order for rows
  ROLE_ORDER: ['SuperAdmin', 'Sales', 'Tech', 'Marketing', 'Guest'],

  render: function() {
    if (this.isLoading && this.users.length === 0) {
      return `<div style="display:flex; justify-content:center; align-items:center; height:400px;"><div class="loader"></div></div>`;
    }

    if (this.users.length === 0 && !this.isLoading) {
      return `
        <div style="margin-bottom: 30px;">
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 8px;">Team Member</h2>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0;">Manage platform access and assign user roles.</p>
        </div>
        <div style="padding: 60px; text-align: center; color: var(--text-muted); background: var(--bg-surface); border-radius: 16px; border: 1px dashed var(--border-color);">
          No users registered yet.
        </div>
      `;
    }

    // Split users into active and blocked
    const activeUsers = this.users.filter(u => !u.disabled);
    const blockedUsers = this.users.filter(u => u.disabled);

    // Sort active users by creation date (oldest first)
    const sortedActive = [...activeUsers].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateA - dateB;
    });

    let contentHtml = `
      <style>
        .user-card-hover { position: relative; }
        .user-card-hover .btn-delete { opacity: 0; transform: scale(0.8); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; }
        .user-card-hover:hover .btn-delete { opacity: 1; transform: scale(1); pointer-events: auto; }
        .user-card-hover .btn-delete:hover { background: rgba(239, 68, 68, 0.2) !important; box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); }
        .role-row-container { margin-bottom: 40px; }
        .role-row-title { font-size: 0.8rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; }
        .role-row-title::after { content: ""; flex: 1; height: 1px; background: linear-gradient(to right, var(--border-color), transparent); }
        .user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 24px; }

        /* Ejected Card Styles */
        .ejected-card { 
          position: relative; 
          overflow: hidden; 
          background: radial-gradient(circle at center, #1b1b2f 0%, #0d0d17 100%);
          border: 1px solid rgba(255, 77, 77, 0.2);
          box-shadow: inset 0 0 40px rgba(0,0,0,0.8);
        }
        .ejected-stars {
          position: absolute; inset: 0; z-index: 1;
          background-image: 
            radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 70px 90px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 150px 40px, rgba(255,255,255,0.7), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 200px 140px, #ffffff, rgba(0,0,0,0));
          background-size: 250px 250px;
          animation: spaceDrift 100s linear infinite;
          opacity: 0.6;
          pointer-events: none;
        }
        @keyframes spaceDrift { 0% { background-position: 0 0; } 100% { background-position: -500px -500px; } }
        
        .floating-avatar {
          animation: floatRotate 8s ease-in-out infinite alternate;
          filter: drop-shadow(0 0 15px rgba(255,77,77,0.3));
        }
        @keyframes floatRotate {
          0% { transform: translateY(-5px) rotate(-8deg); }
          100% { transform: translateY(5px) rotate(12deg); }
        }

        .ejected-stamp {
          position: absolute; top: 18px; left: -25px; z-index: 10;
          background: #ef4444; color: white;
          font-weight: 900; text-transform: uppercase; letter-spacing: 3px; font-size: 0.65rem;
          padding: 6px 30px; transform: rotate(-40deg);
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }

        .ejected-card .btn-release {
          position: absolute; top: 14px; right: 14px; z-index: 10;
          background: rgba(16, 185, 129, 0.1); border: 1.5px solid rgba(16, 185, 129, 0.4); color: #10b981;
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
          opacity: 0; transform: scale(0.8); pointer-events: none;
        }
        .ejected-card:hover .btn-release { opacity: 1; transform: scale(1); pointer-events: auto; }
        .ejected-card .btn-release:hover { background: rgba(16, 185, 129, 0.25) !important; box-shadow: 0 0 12px rgba(16, 185, 129, 0.4); }
        .blacklist-header { font-size: 0.8rem; font-weight: 900; color: #ff4d4d; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; }
        .blacklist-header::after { content: ""; flex: 1; height: 1px; background: linear-gradient(to right, rgba(255, 77, 77, 0.4), transparent); }
      </style>

      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 8px;">Team Member</h2>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0;">Manage platform access and assign user roles.</p>
      </div>
    `;

    // Render active users by role rows
    this.ROLE_ORDER.forEach(roleKey => {
      const usersInRole = sortedActive.filter(u => u.role === roleKey);
      if (usersInRole.length === 0) return;

      contentHtml += `
        <div class="role-row-container">
          <div class="role-row-title">${this.ROLE_DISPLAY_MAP[roleKey]}</div>
          <div class="user-grid">
            ${usersInRole.map(u => this.renderUserCard(u)).join('')}
          </div>
        </div>
      `;
    });

    // Render Blacklist section if there are blocked users
    if (blockedUsers.length > 0) {
      contentHtml += `
        <div style="margin-top: 50px; padding-top: 40px; border-top: 2px solid rgba(255, 77, 77, 0.2);">
          <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 24px;">
            <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(255, 77, 77, 0.1); border: 1.5px solid rgba(255, 77, 77, 0.3); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">🔒</div>
            <div>
              <h2 style="font-size: 1.3rem; font-weight: 900; color: #ff4d4d; margin: 0; letter-spacing: 0.5px;">Blacklist</h2>
              <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0; margin-top: 2px;">${blockedUsers.length} blocked user${blockedUsers.length !== 1 ? 's' : ''} — permanently restricted from access.</p>
            </div>
          </div>
          <div class="user-grid">
            ${blockedUsers.map(u => this.renderJailCard(u)).join('')}
          </div>
        </div>
      `;
    }

    return contentHtml;
  },

  renderUserCard: function(u) {
    const displayRole = this.ROLE_DISPLAY_MAP[u.role] || u.role;
    return `
      <div class="card user-card-hover" style="text-align:center; transition: transform 0.2s, box-shadow 0.2s; padding: 28px 24px; display: flex; flex-direction: column; align-items: center;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--shadow-md)';">
        
        <button class="btn-delete" data-uid="${u.id}" style="position: absolute; top: 12px; right: 12px; background: rgba(239, 68, 68, 0.05); border: 1px solid #EF4444; color: #EF4444; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10;" title="Delete User">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>

        <div class="avatar" style="width: 86px; height: 86px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.2rem auto; background: var(--bg-main); border-radius: 50%; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.3)); border: 2px solid rgba(255,255,255,0.05);">
          ${window.AmongUsAvatar ? window.AmongUsAvatar.getSvg(u.avatarColor || 'gray', 60) : '👤'}
        </div>
        
        <h3 style="font-size: 1.6rem; font-weight: 900; color: #ffcc00; margin-bottom: 2px; letter-spacing: 0.5px; text-shadow: 0 0 12px rgba(255, 204, 0, 0.4);">${u.displayName || 'Unnamed User'}</h3>
        <p style="color:var(--text-muted); font-size: 0.8rem; margin-bottom: 2rem; opacity: 0.8;">${u.email}</p>
        
        <div style="background: var(--bg-main); border-radius: 16px; padding: 18px 16px; width: 100%; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 16px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);">
          
          <div>
            <div style="font-size: 0.65rem; color:var(--text-muted); text-transform:uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 4px;">Last Activity</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">
              ${u.lastLogin ? new Date(u.lastLogin).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Never'}
            </div>
          </div>

          <div style="width: 100%; height: 1px; background: var(--border-color); opacity: 0.5;"></div>
          
          <div>
            <div style="font-size: 0.65rem; color:var(--text-muted); text-transform:uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 8px;">System Role</div>
            
            <div style="position: relative; width: 90%; margin: 0 auto; z-index: ${this.openDropdownUid === u.id ? '100' : '1'};">
              <div class="role-custom-trigger" data-uid="${u.id}" style="display: flex; align-items: center; justify-content: center; padding: 10px 16px; background: ${this.getRoleColor(u.role)}1A; border: 2px solid ${this.openDropdownUid === u.id ? this.getRoleColor(u.role) : this.getRoleColor(u.role)+'40'}; border-radius: 12px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='${this.getRoleColor(u.role)}30'" onmouseout="this.style.background='${this.getRoleColor(u.role)}1A'">
                <div style="font-weight: 900; font-size: 0.85rem; color: ${this.getRoleColor(u.role)}; text-align: center; width: 100%; text-transform: uppercase; pointer-events: none;">${displayRole}</div>
              </div>
              
              ${this.openDropdownUid === u.id ? `
                <div class="dropdown-menu" style="position: absolute; bottom: calc(100% + 8px); left: 0; width: 100%; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 -10px 40px rgba(0,0,0,0.6); z-index: 5000; padding: 8px; animation: modalIn 0.15s ease-out; text-align: left;">
                  ${this.ROLE_ORDER.map(rKey => `
                    <div class="role-opt" data-uid="${u.id}" data-role="${rKey}" style="padding: 10px 14px; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 0.8rem; color: ${u.role === rKey ? this.getRoleColor(rKey) : 'var(--text-main)'}; background: ${u.role === rKey ? this.getRoleColor(rKey)+'1A' : 'transparent'}; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; transition: all 0.2s;" onmouseover="this.style.background='${u.role === rKey ? this.getRoleColor(rKey)+'2A' : 'rgba(255,255,255,0.05)'}'" onmouseout="this.style.background='${u.role === rKey ? this.getRoleColor(rKey)+'1A' : 'transparent'}'">
                      <span style="pointer-events: none;">${this.ROLE_DISPLAY_MAP[rKey]}</span>
                      ${u.role === rKey ? `<span style="color: ${this.getRoleColor(rKey)}; font-size: 1rem; pointer-events: none;">✓</span>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  getRoleColor: function(role) {
    switch(role) {
      case 'SuperAdmin': return '#EF4444';
      case 'Sales': return '#10B981';
      case 'Tech': return '#00B4FF';
      case 'Marketing': return '#9333EA';
      default: return '#9CA3AF';
    }
  },

  renderJailCard: function(u) {
    const blockedDate = u.blockedAt ? new Date(u.blockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
    return `
      <div class="card ejected-card" style="text-align:center; padding: 28px 24px; display: flex; flex-direction: column; align-items: center;">
        <div class="ejected-stars"></div>
        <div class="ejected-stamp">EJECTED</div>

        <button class="btn-release" data-uid="${u.id}" title="Airlock Override (Release)">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 12l6-6M3 12l6 6"/></svg>
        </button>

        <div style="position: relative; z-index: 6; display: flex; flex-direction: column; align-items: center; width: 100%;">
          <div class="floating-avatar" style="width: 86px; height: 86px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.2rem auto;">
            ${window.AmongUsAvatar ? window.AmongUsAvatar.getSvg(u.avatarColor || 'gray', 60) : '👤'}
          </div>
          
          <h3 style="font-size: 1.4rem; font-weight: 900; color: rgba(255, 255, 255, 0.9); margin-bottom: 2px; letter-spacing: 1px; text-shadow: 0 0 10px rgba(239,68,68,0.5);">${u.displayName || 'Unnamed User'}</h3>
          <p style="color: var(--text-muted); font-size: 0.75rem; margin-bottom: 1.5rem; opacity: 0.7;">${u.email}</p>
          
          <div style="background: rgba(0,0,0,0.4); border-radius: 14px; padding: 16px 14px; width: 100%; border: 1px solid rgba(255, 77, 77, 0.2); display: flex; flex-direction: column; gap: 12px; backdrop-filter: blur(4px);">
            <div>
              <div style="font-size: 0.6rem; color: rgba(255, 77, 77, 0.8); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 3px;">Ejected On</div>
              <div style="font-size: 0.9rem; font-weight: 700; color: #ff9999;">${blockedDate}</div>
            </div>
            <div style="width: 100%; height: 1px; background: rgba(255, 77, 77, 0.2);"></div>
            <div>
              <div style="font-size: 0.6rem; color: rgba(255, 77, 77, 0.8); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 3px;">Status</div>
              <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: rgba(239, 68, 68, 0.15); border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 10px;">
                <div style="width: 7px; height: 7px; border-radius: 50%; background: #ff4d4d; box-shadow: 0 0 8px #ff4d4d; animation: pulse 2s infinite;"></div>
                <span style="font-weight: 900; font-size: 0.75rem; color: #ff4d4d; text-transform: uppercase; letter-spacing: 1px;">Drifting in Space</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  initGlobalListeners: function() {
    if (window._userLogListenersBound) return;
    
    document.body.addEventListener('click', async (e) => {
      // Only process clicks if we are on the user log view
      const viewContainer = document.getElementById('app-view');
      if (!viewContainer || !viewContainer.innerHTML.includes('role-custom-trigger')) return;

      // 1. Dropdown Trigger
      const trigger = e.target.closest('.role-custom-trigger');
      if (trigger) {
        e.stopPropagation();
        const uid = trigger.dataset.uid;
        this.openDropdownUid = this.openDropdownUid === uid ? null : uid;
        this.reRenderOnly();
        return;
      }

      // 2. Dropdown Option
      const opt = e.target.closest('.role-opt');
      if (opt) {
        e.stopPropagation();
        const uid = opt.dataset.uid;
        const newRole = opt.dataset.role;
        this.openDropdownUid = null;
        
        // OPTIMISTIC UI UPDATE: Instantly change the role in local memory
        // so the UI feels perfectly responsive immediately.
        const userIndex = this.users.findIndex(u => u.id === uid);
        let oldRole = null;
        if (userIndex !== -1) {
            oldRole = this.users[userIndex].role;
            this.users[userIndex].role = newRole;
        }

        this.reRenderOnly(); // Close UI and instantly show new role
        
        if (window.updateUserRole) {
          window.updateUserRole(uid, newRole).catch(err => {
            // Revert on failure
            if (userIndex !== -1 && oldRole) {
                this.users[userIndex].role = oldRole;
                this.reRenderOnly();
            }
            alert("Error updating role: " + err.message);
          });
        }
        return;
      }

      // 3. Delete Button
      const btnDelete = e.target.closest('.btn-delete');
      if (btnDelete) {
        e.stopPropagation();
        const uid = btnDelete.dataset.uid;
        this.showDeleteModal(uid);
        return;
      }

      // 4. Release Button
      const btnRelease = e.target.closest('.btn-release');
      if (btnRelease) {
        e.stopPropagation();
        const uid = btnRelease.dataset.uid;
        const userIndex = this.users.findIndex(u => u.id === uid);
        const user = userIndex !== -1 ? this.users[userIndex] : null;
        const name = user ? user.displayName : 'this user';
        
        if (confirm(`Release "${name}" from the blacklist? They will be able to register and log in again as a Nomad.`)) {
          // OPTIMISTIC UI UPDATE
          let oldDisabled = null;
          let oldRole = null;
          if (user) {
              oldDisabled = user.disabled;
              oldRole = user.role;
              user.disabled = false;
              user.role = 'Guest';
              this.reRenderOnly(); // Instantly move them out of blacklist
          }

          try {
            if (window.unblockUser) await window.unblockUser(uid);
            if (window.updateUserRole) await window.updateUserRole(uid, 'Guest');
            this.triggerUpdate(); // Refresh fully in background
          } catch (err) {
            // Revert on error
            if (user && oldDisabled !== null) {
                user.disabled = oldDisabled;
                user.role = oldRole;
                this.reRenderOnly();
            }
            alert("Error releasing user: " + err.message);
          }
        }
        return;
      }

      // 5. Global click to close dropdown
      if (this.openDropdownUid && !e.target.closest('.role-custom-trigger') && !e.target.closest('.dropdown-menu')) {
        this.openDropdownUid = null;
        this.reRenderOnly();
      }
    });

    window._userLogListenersBound = true;
  },

  afterRender: function() {
    if (this.isLoading && this.users.length === 0) {
      this.triggerUpdate();
    }
  },

  showResetOptionsModal: function() {
    const overlay = document.createElement('div');
    overlay.className = 'reset-modal-overlay';
    overlay.style = "position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 10005; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(12px); animation: fadeIn 0.3s ease;";
    
    overlay.innerHTML = `
      <style>
        .reset-tile {
          display: flex; align-items: center; justify-content: space-between; 
          padding: 18px 24px; background: rgba(255,255,255,0.03); 
          border: 2px solid var(--border-color); border-radius: 20px; 
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative; overflow: hidden;
        }
        .reset-tile:hover {
          background: rgba(255, 77, 77, 0.05);
          border-color: rgba(255, 77, 77, 0.4);
          box-shadow: 0 10px 20px rgba(0,0,0,0.4);
        }
        
        /* Icon Toggling */
        .static-tile-icon { display: block !important; }
        .tile-icon-gif { display: none !important; }
        
        .reset-tile:hover .static-tile-icon,
        .reset-tile input:checked + .tile-content .static-tile-icon { display: none !important; }
        
        .reset-tile:hover .tile-icon-gif,
        .reset-tile input:checked + .tile-content .tile-icon-gif { display: block !important; }

        /* Selection Circle Animation */
        .reset-tile input:checked + .tile-content + .selection-circle {
          background: transparent;
          border-color: #ff4d4d;
          box-shadow: 0 0 15px rgba(255, 77, 77, 0.4);
        }
        .reset-tile input:checked + .tile-content + .selection-circle::after {
          content: ""; 
          width: 12px; height: 12px; 
          background: #ff4d4d; 
          border-radius: 50%;
          display: block;
          animation: scaleIn 0.2s ease-out;
        }
        @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }

        .reset-tile input:checked + .tile-content { color: white; }
        .selection-circle {
          width: 24px; height: 24px; border: 2.5px solid var(--border-color); 
          border-radius: 50%; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .reset-tile input { display: none; }
      </style>

      <div style="background: var(--bg-surface); padding: 40px; border-radius: 32px; border: 1px solid rgba(255, 77, 77, 0.2); width: 520px; box-shadow: 0 50px 100px rgba(0,0,0,0.8); animation: modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
         <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(255, 77, 77, 0.1); border: 2px solid #ff4d4d; color: #ff4d4d; display:flex; align-items:center; justify-content:center; margin: 0 auto 20px; box-shadow: 0 0 30px rgba(255, 77, 77, 0.2);">
               <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </div>
            <h3 style="color: white; font-size: 1.8rem; margin: 0; font-weight: 900; letter-spacing: -0.5px;">Factory Reset</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 10px; opacity: 0.8;">Choose a module to permanent erase.</p>
         </div>
         
         <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 40px;">
            ${[
              { id: 'feedme', label: 'FeedMe Module', desc: 'Wipe all customer records', gif: 'assets/Feedmebot.gif' },
              { id: 'dongzhuo', label: '老总 Module', desc: 'Clear all regional business data', gif: 'assets/icafe.gif' },
              { id: 'inventory', label: 'Inventory Hub', desc: 'Reset all stock levels to 0', gif: 'assets/NexInventory.gif' },
              { id: 'invoices', label: 'Invoices & Sales', desc: 'Delete all scanned documents', gif: 'assets/NexInvoice.gif' },
              { id: 'schedules', label: 'Schedule Hub', desc: 'Clear all tasks and events', gif: 'assets/Schedule.gif' }
            ].map(opt => `
              <label class="reset-tile">
                <input type="radio" name="reset-module-opt" class="reset-radio" value="${opt.id}">
                <div class="tile-content" style="display: flex; align-items: center; gap: 20px; flex: 1;">
                  <div style="width: 32px; height: 32px; position: relative; flex-shrink: 0;">
                    <canvas class="static-tile-icon" data-src="${opt.gif}" style="width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; filter: brightness(1.1);"></canvas>
                    <img src="${opt.gif}" class="tile-icon-gif" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; filter: brightness(1.1);" alt=""/>
                  </div>
                  <div>
                    <div style="font-weight: 800; font-size: 1.05rem; transition: color 0.2s;">${opt.label}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${opt.desc}</div>
                  </div>
                </div>
                <div class="selection-circle"></div>
              </label>
            `).join('')}
         </div>
         
         <div style="display: flex; gap: 16px;">
            <button id="btn-cancel-reset" style="flex: 1; padding: 16px; background: transparent; border: 1.5px solid var(--border-color); color: var(--text-muted); border-radius: 18px; font-weight: 800; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.color='white'; this.style.borderColor='white';" onmouseout="this.style.color='var(--text-muted)'; this.style.borderColor='var(--border-color)';">Cancel</button>
            <button id="btn-confirm-reset" style="flex: 2; padding: 16px; background: #ff4d4d; border: none; color: white; border-radius: 18px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 25px rgba(255, 77, 77, 0.4); font-size: 1.05rem; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 30px rgba(255, 77, 77, 0.5)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 25px rgba(255, 77, 77, 0.4)';">Clear Now</button>
         </div>
      </div>
    `;

    // Draw static frames for icons
    overlay.querySelectorAll('.static-tile-icon').forEach(canvas => {
      const img = new Image();
      const draw = () => {
        canvas.width = img.naturalWidth || 200;
        canvas.height = img.naturalHeight || 200;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.onload = draw;
      img.src = canvas.getAttribute('data-src');
      if (img.complete) draw();
    });

    document.body.appendChild(overlay);

    document.getElementById('btn-cancel-reset').onclick = () => overlay.remove();
    document.getElementById('btn-confirm-reset').onclick = async () => {
      const selectedRadio = overlay.querySelector('.reset-radio:checked');
      if (!selectedRadio) return alert('Please select a module to reset.');
      const selected = [selectedRadio.value];
      
      if (confirm(`CRITICAL ACTION: You are about to permanently delete all data for the ${selected[0].toUpperCase()} module. This cannot be undone. Proceed?`)) {
        const btn = document.getElementById('btn-confirm-reset');
        btn.innerHTML = '<div class="loader" style="width: 18px; height: 18px; border-width: 2px; border-top-color: white; border-right-color: white; margin: 0 auto;"></div>';
        btn.disabled = true;

        try {
          if (window.resetSpecificModules) {
            await window.resetSpecificModules(selected);
          }
          overlay.remove();
          alert('System data updated. The selected module has been cleared.');
        } catch (e) {
          alert('Error: ' + e.message);
          btn.innerHTML = 'Clear Now';
          btn.disabled = false;
        }
      }
    };
  },

  showDeleteModal: function(uid) {
    var self = this;
    var user = this.users.find(function(u) { return u.id === uid; });
    var userName = user ? user.displayName : 'this user';

    var overlay = document.createElement('div');
    overlay.className = 'delete-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10005;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);';

    var html = '<div style="background:var(--bg-surface);padding:32px;border-radius:24px;border:1px solid var(--border-color);width:420px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.5);animation:modalIn 0.3s ease-out;">';
    html += '<h3 style="color:white;font-size:1.4rem;margin-top:0;font-weight:800;">Remove User</h3>';
    html += '<p style="color:var(--text-muted);font-size:0.95rem;margin-bottom:24px;">How do you want to handle <b>' + userName + '</b>\'s account?</p>';
    html += '<div style="display:flex;flex-direction:column;gap:14px;">';
    
    html += '<button id="btn-action-remove" style="padding:16px;border-radius:14px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:white;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:4px;transition:all 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.08)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.03)\'">';
    html += '<span style="font-weight:700;font-size:1.05rem;pointer-events:none;">Remove</span>';
    html += '<span style="font-size:0.8rem;color:rgba(255,255,255,0.5);pointer-events:none;">Deletes the account. User can re-register again.</span>';
    html += '</button>';
    
    html += '<button id="btn-action-block" style="padding:16px;border-radius:14px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.05);color:#EF4444;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:4px;transition:all 0.2s;" onmouseover="this.style.background=\'rgba(239, 68, 68, 0.15)\'" onmouseout="this.style.background=\'rgba(239, 68, 68, 0.05)\'">';
    html += '<span style="font-weight:700;font-size:1.05rem;pointer-events:none;">Block & Delete</span>';
    html += '<span style="font-size:0.8rem;color:rgba(239,68,68,0.7);pointer-events:none;">Permanently blocks this email from logging in again.</span>';
    html += '</button>';
    
    html += '<button id="btn-action-cancel" style="padding:14px;border-radius:12px;border:none;background:transparent;color:var(--text-muted);font-weight:600;cursor:pointer;margin-top:8px;" onmouseover="this.style.color=\'white\'" onmouseout="this.style.color=\'var(--text-muted)\'">Cancel</button>';
    html += '</div></div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    var btnRemove = overlay.querySelector('#btn-action-remove');
    var btnBlock = overlay.querySelector('#btn-action-block');
    var btnCancel = overlay.querySelector('#btn-action-cancel');

    btnRemove.onclick = function() {
        btnRemove.innerHTML = '<div class="loader" style="width:16px;height:16px;border-width:2px;margin:0 auto;"></div>';
        btnRemove.disabled = true;
        btnBlock.disabled = true;

        var userIndex = self.users.findIndex(function(u) { return u.id === uid; });
        var removedUser = null;
        if (userIndex !== -1) {
            removedUser = self.users[userIndex];
            self.users.splice(userIndex, 1);
        }

        overlay.remove();
        self.reRenderOnly();

        if (window.removeUser) {
            window.removeUser(uid).catch(function(err) {
                alert("Remove Error: " + err.message);
                if (removedUser) {
                    self.users.splice(userIndex, 0, removedUser);
                    self.reRenderOnly();
                }
            });
        }
    };
    
    btnBlock.onclick = function() {
        btnBlock.innerHTML = '<div class="loader" style="width:16px;height:16px;border-width:2px;border-top-color:#EF4444;border-right-color:#EF4444;margin:0 auto;"></div>';
        btnRemove.disabled = true;
        btnBlock.disabled = true;

        var userIndex = self.users.findIndex(function(u) { return u.id === uid; });
        var oldDisabled = false;
        var oldBlockedAt = null;
        if (userIndex !== -1) {
            oldDisabled = self.users[userIndex].disabled;
            oldBlockedAt = self.users[userIndex].blockedAt;
            self.users[userIndex].disabled = true;
            self.users[userIndex].blockedAt = new Date().toISOString();
        }

        overlay.remove();
        self.reRenderOnly();

        if (window.blockUser) {
            window.blockUser(uid).catch(function(err) {
                alert("Block Error: " + err.message);
                if (userIndex !== -1) {
                    self.users[userIndex].disabled = oldDisabled;
                    self.users[userIndex].blockedAt = oldBlockedAt;
                    self.reRenderOnly();
                }
            });
        }
    };

    btnCancel.onclick = function() {
       overlay.remove();
    };
  },




  reRenderOnly: function() {
    const viewContainer = document.getElementById('app-view');
    if (viewContainer) {
      viewContainer.innerHTML = this.render();
      this.afterRender();
    }
  },

  triggerUpdate: async function() {
    if (window.fetchUsers) {
      this.isLoading = true;
      const viewContainer = document.getElementById('app-view');
      // If first load, show loader
      if (viewContainer && this.users.length === 0) viewContainer.innerHTML = this.render();
      
      try {
        this.users = await window.fetchUsers();
      } catch (e) {
        console.error("Error fetching users:", e);
        this.users = [];
      }
      this.isLoading = false;
      
      if (viewContainer) {
        viewContainer.innerHTML = this.render();
        this.afterRender();
      }
    }
  }
};

// Initialize robust global event listeners once the script loads
window.Pages.user_log.initGlobalListeners();
