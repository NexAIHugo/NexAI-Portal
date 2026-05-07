// js/pages/login.js
window.Pages = window.Pages || {};

// Among Us character SVG generator
window.AmongUsAvatar = {
  colors: [
    { id: 'red', name: 'Red', body: '#C51111', shadow: '#7A0838' },
    { id: 'blue', name: 'Blue', body: '#132ED1', shadow: '#09158E' },
    { id: 'green', name: 'Green', body: '#117F2D', shadow: '#0A4D2E' },
    { id: 'pink', name: 'Pink', body: '#ED54BA', shadow: '#AB2BAD' },
    { id: 'orange', name: 'Orange', body: '#EF7D0D', shadow: '#B33E15' },
    { id: 'yellow', name: 'Yellow', body: '#F5F557', shadow: '#C38823' },
    { id: 'black', name: 'Black', body: '#3F474E', shadow: '#1E1F26' },
    { id: 'white', name: 'White', body: '#D6E0F0', shadow: '#8394BF' },
    { id: 'purple', name: 'Purple', body: '#6B2FBB', shadow: '#3B177C' },
    { id: 'brown', name: 'Brown', body: '#71491E', shadow: '#5E2615' },
    { id: 'cyan', name: 'Cyan', body: '#38FEDC', shadow: '#24A8BE' },
    { id: 'lime', name: 'Lime', body: '#50EF39', shadow: '#15A742' },
    { id: 'maroon', name: 'Maroon', body: '#6B2C3B', shadow: '#3E0614' },
    { id: 'rose', name: 'Rose', body: '#EC7578', shadow: '#B6464A' },
    { id: 'banana', name: 'Banana', body: '#FFFFBE', shadow: '#DED386' },
    { id: 'gray', name: 'Gray', body: '#708496', shadow: '#47555E' },
    { id: 'tan', name: 'Tan', body: '#928776', shadow: '#5E4633' },
    { id: 'coral', name: 'Coral', body: '#EC7578', shadow: '#B6464A' }
  ],

  getSvg: function(colorId, size) {
    size = size || 40;
    const c = this.colors.find(x => x.id === colorId) || this.colors[0];
    return `<svg viewBox="-20 -10 230 280" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- Floor Shadow -->
      <ellipse cx="105" cy="250" rx="100" ry="18" fill="#000000" opacity="0.3" />
      
      <!-- Backpack -->
      <rect x="-10" y="100" width="60" height="95" rx="25" fill="${c.body}" stroke="#111" stroke-width="14" />
      <!-- Backpack Shadow -->
      <path d="M -10,150 L 50,150 L 50,170 A 25,25 0 0,1 25,195 L 15,195 A 25,25 0 0,1 -10,170 Z" fill="${c.shadow}" />
      
      <!-- Main Body Base -->
      <path d="M 25,80 A 80,80 0 0,1 185,80 L 185,220 A 37,37 0 0,1 111,220 L 111,190 A 6,6 0 0,0 99,190 L 99,220 A 37,37 0 0,1 25,220 Z" fill="${c.body}" />
      
      <!-- Body Shadow -->
      <path d="M 25,180 C 75,190 140,170 185,150 L 185,220 A 37,37 0 0,1 111,220 L 111,190 A 6,6 0 0,0 99,190 L 99,220 A 37,37 0 0,1 25,220 Z" fill="${c.shadow}" />
      
      <!-- Main Body Outline -->
      <path d="M 25,80 A 80,80 0 0,1 185,80 L 185,220 A 37,37 0 0,1 111,220 L 111,190 A 6,6 0 0,0 99,190 L 99,220 A 37,37 0 0,1 25,220 Z" fill="none" stroke="#111" stroke-width="14" stroke-linejoin="round" />
      
      <!-- Visor -->
      <rect x="65" y="65" width="130" height="80" rx="40" fill="#22516B" stroke="#111" stroke-width="14" />
      <rect x="85" y="69" width="100" height="60" rx="30" fill="#9CDCF3" />
      <rect x="135" y="75" width="45" height="20" rx="10" fill="#FFFFFF" />
    </svg>`;
  }
};

window.Pages.login = {
  render: function() {
    return `
      <div class="login-overlay" style="position: fixed; inset: 0; background: #000; z-index: 10005; display: flex; align-items: center; justify-content: center; overflow: hidden; font-family: 'Inter', sans-serif;">
        <!-- Animated Background -->
        <div style="position: absolute; width: 150vw; height: 150vh; background: radial-gradient(circle at 20% 30%, #F25900 0%, transparent 40%), radial-gradient(circle at 80% 70%, #00B4FF 0%, transparent 40%); opacity: 0.2; filter: blur(100px); animation: pulse 15s infinite alternate;"></div>
        
        <div class="login-card" style="position: relative; width: 420px; padding: 50px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 32px; backdrop-filter: blur(20px); text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: cardFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);">
          <div style="margin-bottom: 40px;">
             <div style="width: 80px; height: 80px; background: var(--primary); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 0 30px rgba(242, 89, 0, 0.5); overflow: hidden;">
                <img src="assets/logo.png" style="width: 70%; height: 70%; object-fit: contain; filter: brightness(0) invert(1);" onerror="this.outerHTML='<span style=\'font-size:2.5rem; color:white;\'>∞</span>'">
             </div>
             <h1 style="color: white; font-size: 2rem; font-weight: 800; margin: 0; letter-spacing: -0.02em;">NexAI Hub</h1>
             <p style="color: rgba(255,255,255,0.6); font-size: 0.95rem; margin-top: 10px; font-weight: 600;">Welcome to the board, NexAI Member</p>
          </div>

          <div style="margin-bottom: 30px;">
            <button id="btn-login-google" style="width: 100%; padding: 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: white; color: #000; font-weight: 700; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: all 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.85 0-5.27-1.92-6.13-4.51H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.87 14.13c-.22-.67-.35-1.39-.35-2.13s.13-1.46.35-2.13V7.03H2.18C.79 9.83 0 11.33 0 12s.79 2.17 2.18 4.97l3.69-2.84z"/><path fill="#EB4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.03l3.69 2.84c.86-2.59 3.28-4.51 6.13-4.51z"/></svg>
              Sign in with Google
            </button>
          </div>

          <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem;">
            By signing in, you agree to our Terms of Service <br> and Privacy Policy.
          </p>
        </div>

        <style>
          @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.1); } }
          @keyframes cardFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          #btn-login-google:hover { background: #f8f8f8; transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
          #btn-login-google:active { transform: translateY(0); }
        </style>
      </div>
    `;
  },

  afterRender: function() {
    const btn = document.getElementById('btn-login-google');
    if (btn) {
      btn.onclick = async () => {
        try {
          if (window.handleGoogleLogin) {
            await window.handleGoogleLogin();
          } else {
            console.error('Login handler not found');
          }
        } catch (err) {
          console.error('Login failed:', err);
          alert('Login failed. Please try again.');
        }
      };
    }
  }
};

// --- PROFILE SETUP PAGE (shown after first login) ---
window.Pages.profile_setup = {
  selectedColor: 'red',
  
  render: function() {
    const colors = window.AmongUsAvatar.colors;
    const user = window.AppState.user || {};
    
    return `
      <div class="login-overlay" style="position: fixed; inset: 0; background: #000; z-index: 10005; display: flex; align-items: center; justify-content: center; overflow: hidden; font-family: 'Inter', sans-serif;">
        <div style="position: absolute; width: 150vw; height: 150vh; background: radial-gradient(circle at 30% 20%, #F25900 0%, transparent 35%), radial-gradient(circle at 70% 80%, #00B4FF 0%, transparent 35%); opacity: 0.15; filter: blur(100px); animation: pulse 15s infinite alternate;"></div>
        
        <div style="position: relative; width: 520px; padding: 45px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 32px; backdrop-filter: blur(20px); text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: cardFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <!-- Preview Avatar -->
          <div id="avatar-preview" style="margin: 0 auto 20px; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 20px rgba(242,89,0,0.3));">
            ${window.AmongUsAvatar.getSvg(this.selectedColor, 100)}
          </div>
          
          <h2 style="color: white; font-size: 1.6rem; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.02em;">Select Character</h2>
          <p style="color: rgba(255,255,255,0.5); font-size: 0.85rem; margin: 0 0 30px 0;">Fill up your nickname and crewmate</p>
          
          <!-- Display Name Input -->
          <div style="margin-bottom: 28px; text-align: left;">
            <label style="display: block; color: rgba(255,255,255,0.5); font-size: 0.7rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; margin-bottom: 8px;">Display Name</label>
            <input type="text" id="profile-name" value="${user.displayName || ''}" placeholder="Enter your name" style="width: 100%; padding: 14px 18px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; font-size: 1rem; font-weight: 600; outline: none; box-sizing: border-box; transition: border 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>
          
          <!-- Character Color Picker -->
          <div style="margin-bottom: 30px; text-align: left;">
            <label style="display: block; color: rgba(255,255,255,0.5); font-size: 0.7rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; margin-bottom: 12px;">Choose Your Crewmate</label>
            <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 8px; background: rgba(0,0,0,0.3); padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06);">
              ${colors.map(c => `
                <div class="crew-color-opt" data-color="${c.id}" title="${c.name}" 
                  style="width: 100%; aspect-ratio: 1; border-radius: 12px; background: ${c.body}; cursor: pointer; transition: all 0.2s; border: 3px solid ${this.selectedColor === c.id ? 'white' : 'transparent'}; transform: ${this.selectedColor === c.id ? 'scale(1.15)' : 'scale(1)'}; box-shadow: ${this.selectedColor === c.id ? '0 0 15px ' + c.body + '80' : 'none'}; display: flex; align-items: center; justify-content: center;">
                  ${this.selectedColor === c.id ? '<span style="font-size: 0.7rem;">✓</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- Save Button -->
          <button id="btn-save-profile" style="width: 100%; padding: 16px; border-radius: 14px; border: none; background: var(--primary); color: white; font-weight: 800; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 20px rgba(242,89,0,0.4); transition: all 0.2s; letter-spacing: 0.02em;">
            🚀 Let's Roll !
          </button>
        </div>
        
        <style>
          @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.1); } }
          @keyframes cardFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .crew-color-opt:hover { transform: scale(1.2) !important; z-index: 2; }
          #btn-save-profile:hover { filter: brightness(1.15); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(242,89,0,0.5); }
          #btn-save-profile:active { transform: translateY(0); }
        </style>
      </div>
    `;
  },

  afterRender: function() {
    const self = this;
    
    // Color selection
    document.querySelectorAll('.crew-color-opt').forEach(el => {
      el.onclick = () => {
        self.selectedColor = el.dataset.color;
        // Update preview without full re-render
        const preview = document.getElementById('avatar-preview');
        if (preview) preview.innerHTML = window.AmongUsAvatar.getSvg(self.selectedColor, 100);
        // Update border highlights
        document.querySelectorAll('.crew-color-opt').forEach(opt => {
          const isActive = opt.dataset.color === self.selectedColor;
          opt.style.border = isActive ? '3px solid white' : '3px solid transparent';
          opt.style.transform = isActive ? 'scale(1.15)' : 'scale(1)';
          opt.style.boxShadow = isActive ? '0 0 15px rgba(255,255,255,0.3)' : 'none';
          opt.innerHTML = isActive ? '<span style="font-size: 0.7rem;">✓</span>' : '';
        });
      };
    });
    
    // Save profile
    const saveBtn = document.getElementById('btn-save-profile');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const nameInput = document.getElementById('profile-name');
        const displayName = nameInput ? nameInput.value.trim() : '';
        
        if (!displayName) {
          nameInput.style.borderColor = '#EF4444';
          nameInput.placeholder = 'Please enter a name!';
          return;
        }
        
        if (window.saveUserProfile) {
          await window.saveUserProfile(displayName, self.selectedColor);
        }
      };
    }
  }
};
