// js/pages/schedule.js
window.Pages = window.Pages || {};
window.Pages.schedule = {
  viewMode: 'month',
  currentDate: new Date(),
  isAddModalOpen: false,
  selectedType: 'Project',
  selectedColorId: '6', // Tangerine (Default for Projects)
  editingItem: null, // { id: string, source: 'local' | 'google' }
  
  // Google API Config
  CLIENT_ID: '804385826589-8pe5gv4srskvpjb8n3q7m5hbgech2ruk.apps.googleusercontent.com',
  API_KEY: 'AIzaSyA7SuM06KXJMhXdzuDEkCzdFBA_HhBGWYQ',
  DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
  SCOPES: 'https://www.googleapis.com/auth/calendar.events email profile',
  
  tokenClient: null,
  gapiInited: false,
  gsiInited: false,
  googleEvents: [],
  modalDraft: {
      client: '',
      date: '',
      time: '',
      agent: '',
      status: 'Onsite Project (New)'
  },
  isSaving: false,
    
  // Helper to parse YYYY-MM-DD string into a local Date object reliably
  parseDate: function(dateStr) {
      if (!dateStr) return new Date();
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
  },

  // Helper to format Date object into YYYY-MM-DD local string
  formatLocalDate: function(date) {
      const y = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${d}`;
  },

  init: function() {
    this.currentDate = new Date();
    this.loadGoogleScripts();
    
    // Auto-poll every 60 seconds (Reduced from 10s to prevent interrupting user input)
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
        if (window.AppState.isGoogleLinked && !this.isAddModalOpen) {
            console.log('🔄 Auto-syncing with Google Calendar (60s)...');
            this.fetchEvents();
        }
    }, 60000);

    // Immediate sync on load if linked
    if (window.AppState.isGoogleLinked) {
        setTimeout(() => this.fetchEvents(), 1000);
    }
  },

  switchToDate: function(y, m, d) {
    console.log(`📅 [Schedule Hub] Switching to: ${y}-${m+1}-${d}`);
    try {
        const selected = new Date(y, m, d, 12, 0, 0);
        if (isNaN(selected.getTime())) throw new Error("Invalid Date");
        
        this.currentDate = selected;
        this.viewMode = 'today';
        
        if (window.renderApp) {
            window.renderApp();
        } else {
            this.triggerUpdate();
        }
    } catch (e) {
        console.error("❌ Failed to switch date:", e);
    }
  },

  loadGoogleScripts: function() {
    if (this.gapiInited && this.gsiInited) return;
    
    const self = this;
    const gapiLoaded = () => {
      gapi.load('client', async () => {
          await gapi.client.init({
              apiKey: self.API_KEY,
              discoveryDocs: [self.DISCOVERY_DOC],
          });
          self.gapiInited = true;
          console.log('GAPI Inited');
          if (window.AppState.isGoogleLinked) self.fetchEvents();
      });
    };

    const gsiLoaded = () => {
      self.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: self.CLIENT_ID,
          scope: self.SCOPES,
          callback: '', // defined at usage
      });
      self.gsiInited = true;
      console.log('GSI Inited');
      
      // Token will be applied from localStorage in fetchEvents() if needed
      if (window.AppState.isGoogleLinked) {
          console.log('Google Service ready, waiting for fetch...');
      }
    };

    // Better detection: Use a retry loop and check for presence
    const checkGapi = setInterval(() => {
        if (typeof gapi !== 'undefined' && gapi.load) {
            clearInterval(checkGapi);
            gapiLoaded();
        }
    }, 100);

    const checkGsi = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
            clearInterval(checkGsi);
            gsiLoaded();
        }
    }, 100);

    // Safety timeout to stop checking after 10 seconds
    setTimeout(() => { clearInterval(checkGapi); clearInterval(checkGsi); }, 10000);
  },

  handleAuthClick: function() {
    // If we are already logged in via Firebase, we can try to use that token
    const firebaseToken = localStorage.getItem('google_access_token');
    
    if (firebaseToken) {
        gapi.client.setToken({ access_token: firebaseToken });
        window.AppState.isGoogleLinked = true;
        this.fetchEvents();
        this.syncLocalTasksToGoogle();
        this.triggerUpdate();
        return;
    }

    if (!this.gsiInited || !this.tokenClient) {
        console.warn('GSI not inited');
        return;
    }
    
    const self = this;
    this.tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error('Auth Error:', resp);
            return;
        }
        localStorage.setItem('google_access_token', resp.access_token);
        window.AppState.isGoogleLinked = true;
        window.saveState();
        await self.fetchEvents();
        await self.syncLocalTasksToGoogle();
        self.triggerUpdate();
    };

    this.tokenClient.requestAccessToken({prompt: 'consent'});
  },

  fetchEvents: async function() {
    if (!window.AppState.isGoogleLinked || !this.gapiInited) return;
    
    // Ensure token is set in gapi client
    if (!gapi.client.getToken()) {
        const token = localStorage.getItem('google_access_token');
        if (token) {
            gapi.client.setToken({ access_token: token });
        } else {
            console.warn('Sync enabled but no token found. Resetting link status.');
            window.AppState.isGoogleLinked = false;
            window.saveState();
            this.triggerUpdate();
            return;
        }
    }
    
    try {
        if (!gapi.client.calendar) {
            console.error('Google Calendar API not loaded. Discovery doc might have failed.');
            return;
        }
        
        // Broaden fetch range: -1 month to +3 months from current view
        const timeMin = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1).toISOString();
        const timeMax = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 4, 0).toISOString();
        
        const response = await gapi.client.calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            timeMax: timeMax,
            showDeleted: false,
            singleEvents: true,
            maxResults: 500,
            orderBy: 'startTime',
        });
        
        this.googleEvents = response.result.items || [];
        console.log(`✅ Synced ${this.googleEvents.length} events from Google`);
        if (this.googleEvents.length === 0) {
            console.warn('No events found in the selected time range for this account.');
        }

        // TWO-WAY SYNC CLEANUP: 
        // If a local task has a googleEventId that is missing from the recent fetch (within range), delete it locally.
        const remoteIds = this.googleEvents.map(e => e.id);
        const localSchedules = window.AppState.schedules || [];
        const initialCount = localSchedules.length;
        
        // Safety range: Only cleanup tasks within the time window we just fetched
        const minTime = new Date(timeMin).getTime();
        const maxTime = new Date(timeMax).getTime();

        window.AppState.schedules = localSchedules.filter(sch => {
            if (!sch.googleEventId) return true; // Keep local-only tasks
            
            const schDate = window.Pages.schedule.parseDate(sch.date).getTime();
            // If the task is outside our fetch range, we can't be sure if it's deleted, so keep it.
            if (schDate < minTime || schDate > maxTime) return true;
            
            // If it's in range but the ID is missing from Google, it was likely deleted.
            const exists = remoteIds.includes(sch.googleEventId);
            if (!exists) console.log(`🗑️ Auto-cleaning task deleted from mobile: ${sch.client}`);
            return exists;
        });

        if (window.AppState.schedules.length !== initialCount) {
            window.saveState();
        }

        this.triggerUpdate();
    } catch (err) {
        console.warn('Sync failed (likely expired token), attempting silent re-auth...');
        if (err.status === 401) {
            localStorage.removeItem('google_access_token');
            window.AppState.isGoogleLinked = false;
            window.saveState();
            this.triggerUpdate();
        }
    }
  },

  GOOGLE_COLORS: {
    '1': '#a4bdfc', // Lavender
    '2': '#7ae7bf', // Sage
    '3': '#dbadff', // Grape
    '4': '#ff887c', // Flamingo
    '5': '#fbd75b', // Banana
    '6': '#ffb878', // Tangerine
    '7': '#46d6db', // Peacock
    '8': '#e1e1e1', // Graphite
    '9': '#5484ed', // Blueberry
    '10': '#51b749', // Basil
    '11': '#dc2127'  // Tomato
  },

  getGoogleColor: function(colorId) {
    return this.GOOGLE_COLORS[colorId] || '#5484ed'; // Default to Blueberry
  },

  createGoogleEvent: async function(sch) {
    if (!window.AppState.isGoogleLinked || !this.gapiInited) return;
    
    // Construct time for Google (Default to 1 hour duration)
    const [year, month, day] = sch.date.split('-').map(Number);
    const [hour, min] = (sch.time || '09:00').split(':').map(Number);
    
    const start = new Date(year, month - 1, day, hour, min);
    const end = new Date(start.getTime() + (60 * 60 * 1000));

    const event = {
        'summary': `${sch.type}: ${sch.client}`,
        'description': `Status: ${sch.status}\nAssignee: ${sch.assignee || 'Unassigned'}\nAssignor: ${sch.assignor || 'Agent 1'}\nCreated via NexAI Infinity Portal`,
        'start': { 'dateTime': start.toISOString() },
        'end': { 'dateTime': end.toISOString() },
        'colorId': sch.colorId || (sch.type === 'Project' ? '6' : '2')
    };

    try {
        const resp = await gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event
        });
        console.log('🚀 Event synced to mobile successfully:', resp.result);
        await this.fetchEvents();
        return resp.result.id; // Return the ID for internal tracking
    } catch (err) {
        console.error('❌ Failed to push to Google:', err);
        if (err.status === 401) {
            localStorage.removeItem('google_access_token');
            window.AppState.isGoogleLinked = false;
            window.saveState();
            this.triggerUpdate();
        }
        return null;
    }
  },

  syncLocalTasksToGoogle: async function() {
    if (!window.AppState.isGoogleLinked || !this.gapiInited) return;
    
    console.log('📦 Starting Retroactive Bulk Sync...');
    const unsynced = (window.AppState.schedules || []).filter(s => !s.googleEventId);
    
    if (unsynced.length === 0) {
        console.log('✅ No unsynced tasks found.');
        return;
    }

    let syncCount = 0;
    for (const sch of unsynced) {
        const eventId = await this.createGoogleEvent(sch);
        if (eventId) {
            // Mark as synced with the unique digital fingerprint
            const idx = window.AppState.schedules.findIndex(s => s.id === sch.id);
            if (idx !== -1) {
                window.AppState.schedules[idx].googleEventId = eventId;
                syncCount++;
            }
        }
    }

    if (syncCount > 0) {
        window.saveState();
        console.log(`🚀 Bulk Sync Complete: ${syncCount} tasks pushed to Google.`);
    }
  },

  updateGoogleEvent: async function(eventId, sch) {
    if (!window.AppState.isGoogleLinked) return;
    
    const startDateTime = `${sch.date}T${sch.time || '09:00'}:00`;
    const endDateTime = `${sch.date}T${(parseInt(sch.time?.split(':')[0] || '09') + 1).toString().padStart(2,'0')}:${sch.time?.split(':')[1] || '00'}:00`;

    const eventPatch = {
        'summary': `${sch.type}: ${sch.client}`,
        'description': `Status: ${sch.status}\nAssignee: ${sch.assignee || 'Unassigned'}\nAssignor: ${sch.assignor || 'Agent 1'}`,
        'start': { 'dateTime': new Date(startDateTime).toISOString() },
        'end': { 'dateTime': new Date(endDateTime).toISOString() },
        'colorId': sch.colorId
    };

    try {
        await gapi.client.calendar.events.patch({
            'calendarId': 'primary',
            'eventId': eventId,
            'resource': eventPatch
        });
        await this.fetchEvents();
    } catch (err) {
        console.error('Error updating event:', err);
    }
  },

  deleteGoogleEvent: async function(eventId) {
    if (!window.AppState.isGoogleLinked) return;
    try {
        await gapi.client.calendar.events.delete({
            'calendarId': 'primary',
            'eventId': eventId
        });
        await this.fetchEvents();
    } catch (err) {
        console.error('Error deleting event:', err);
    }
  },

  openEditModal: function(id, source) {
    console.log(`🔍 [Schedule Hub] Opening Edit Modal - ID: ${id}, Source: ${source}`);
    try {
        if (source === 'local') {
            const item = window.AppState.schedules.find(s => s.id === id);
            if (!item) throw new Error("Local schedule item not found");
            
            this.editingItem = { id, source };
            this.selectedType = item.type;
            this.selectedColorId = item.colorId || (item.type === 'Project' ? '6' : '2');
            
            this.modalDraft = {
                client: item.client || '',
                date: item.date || '',
                time: item.time || '',
                agent: item.assignee || '',
                status: item.status || 'Onsite Project (New)'
            };
        } else {
            const item = this.googleEvents.find(e => e.id === id);
            if (!item) throw new Error("Google event item not found");

            this.editingItem = { id, source };
            const summary = item.summary || '';
            this.selectedType = (summary.startsWith('Project:') || summary.includes('Project')) ? 'Project' : 'Sales';
            this.selectedColorId = item.colorId || (this.selectedType === 'Project' ? '6' : '2');
            
            const start = item.start.dateTime || item.start.date;
            const startDate = new Date(start);
            const desc = item.description || '';
            const statusMatch = desc.match(/Status: (.*)/);
            const agentMatch = desc.match(/Assignee: (.*)/);

            this.modalDraft = {
                client: summary.replace(/^(Project|Sales): /, ''),
                date: startDate.toISOString().split('T')[0],
                time: item.start.dateTime ? new Date(item.start.dateTime).toTimeString().substring(0,5) : '',
                agent: agentMatch ? agentMatch[1] : '',
                status: (this.selectedType === 'Project' && statusMatch) ? statusMatch[1] : 'Onsite Project (New)'
            };
        }
        this.isAddModalOpen = true;
        this.triggerUpdate();
    } catch (e) {
        console.error("❌ Error opening edit modal:", e);
    }
  },

  render: function() {
    const state = window.AppState;
    const viewDate = this.currentDate;
    
    const styleBlock = `
      <style>
        .calendar-container { background: var(--bg-surface); border-radius: 20px; border: 1px solid var(--border-color); overflow: visible; display: flex; flex-direction: column; height: auto; margin-bottom: 40px; }
        .calendar-header { padding: 20px 30px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); border-collapse: collapse; flex: none; }
        .calendar-day-header { padding: 12px; text-align: center; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.2); }
        .calendar-cell { border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); padding: 15px; position: relative; transition: background 0.2s; min-height: 165px; cursor: pointer; }
        .calendar-cell:hover { background: rgba(255,255,255,0.05); }
        .calendar-cell:nth-child(7n) { border-right: none; }
        .calendar-cell.today { background: rgba(242, 89, 0, 0.03); }
        .calendar-cell.other-month { opacity: 0.3; }
        .day-number { font-size: 1.1rem; font-weight: 800; color: var(--text-muted); margin-bottom: 12px; display: block; opacity: 0.6; }
        .today .day-number { color: var(--primary); font-size: 1.3rem; opacity: 1; }
        
        .event-bar { font-size: 0.7rem; padding: 4px 8px; border-radius: 6px; margin-bottom: 4px; font-weight: 700; cursor: pointer; transition: transform 0.1s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
        .event-bar:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .event-project { background: rgba(255, 184, 120, 0.15); color: #ffb878; border: 1.5px solid rgba(255, 184, 120, 0.3); }
        .event-sales { background: rgba(122, 231, 191, 0.15); color: #7ae7bf; border: 1.5px solid rgba(122, 231, 191, 0.3); }
        .event-google { border-style: dashed; }
        
        .view-pill { padding: 8px 18px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s; border: 1px solid var(--border-color); color: var(--text-muted); }
        .view-pill.active { background: var(--primary); color: white; border-color: var(--primary); box-shadow: 0 0 15px rgba(242, 89, 0, 0.3); }
        
        .nav-btn { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--border-color); background: var(--bg-main); color: var(--text-main); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .nav-btn:hover { border-color: var(--primary); color: var(--primary); }
      </style>
    `;

    return styleBlock + `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 25px;">
        <div style="display:flex; align-items:center; gap: 15px;">
           <img src="assets/Schedule.gif" style="width: 48px; height: 48px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""/>
           <div>
             <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">Schedule Hub</h2>
             <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Centralized project setup and sales demo planning. 
               <span id="sync-status-msg" style="color: var(--success); font-size: 0.75rem; margin-left: 10px; font-weight: 800; display: ${window.AppState.isGoogleLinked ? 'inline' : 'none'};">● Linked & Active</span>
             </p>
           </div>
        </div>
        <div style="display:flex; gap: 12px; align-items: center;">

            <div id="google-link-status" style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 12px; background: ${window.AppState.isGoogleLinked ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 77, 77, 0.1)'}; border: 1.5px solid ${window.AppState.isGoogleLinked ? '#00ff88' : '#ff4d4d'};">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 262" preserveAspectRatio="xMidYMid"><path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v50.854h70.028c-2.176 13.925-11.319 32.185-28.583 45.023l-.22.146 41.139 31.848.286.2c26.242-24.225 42.678-59.858 42.678-101.381"/><path fill="#34A853" d="M130.55 261.1c35.242 0 64.839-11.605 86.453-31.622l-41.205-31.994c-11.319 7.834-26.101 13.06-45.248 13.06-34.808 0-64.405-23.069-74.996-54.834l-.479.041-42.743 33.102-.559.458C33.342 235.158 79.176 261.1 130.55 261.1"/><path fill="#FBBC05" d="M55.554 155.751c-2.756-8.124-4.351-16.83-4.351-25.751 0-8.92 1.595-17.627 4.206-25.751l-.058-.696-42.76-33.204-.555.267C3.047 88.75 0 108.625 0 129.999c0 21.375 3.047 41.25 9.04 59.382l46.514-33.63"/><path fill="#EB4335" d="M130.55 51.157c24.367 0 41.139 10.59 50.422 19.294l37.863-36.988C194.989 12.839 164.512 0 130.55 0 79.176 0 33.342 25.942 9.04 63.383l46.441 36.05c10.591-31.765 40.188-54.833 75.069-54.833"/></svg>
              <span style="font-size:0.85rem; font-weight:800; color:${window.AppState.isGoogleLinked ? '#00ff88' : '#ff4d4d'}">${window.AppState.isGoogleLinked ? 'Synced' : 'Link Google'}</span>
            </div>
           <button id="btn-add-schedule" style="padding: 10px 22px; border-radius: 12px; border: none; background: var(--primary); color: white; cursor: pointer; font-weight: 800; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(242, 89, 0, 0.4); display: flex; align-items: center; gap: 10px;">
             <span>+</span> New
           </button>
        </div>
      </div>

      <div class="calendar-container">
        <div class="calendar-header">
          <div style="display:flex; align-items:center; gap: 20px;">
            <div style="display:flex; align-items:center; gap: 8px;">
              <button class="nav-btn" id="cal-prev">‹</button>
              <button class="nav-btn" id="cal-next">›</button>
            </div>
            <h3 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main);">${this.getHeaderTitle()}</h3>
            <button id="cal-today" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); padding: 6px 16px; border-radius: 8px; color: var(--text-main); font-weight: 700; cursor: pointer;">Today</button>
          </div>
          
          <div style="display:flex; gap: 8px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 24px; border: 1px solid var(--border-color);">
            <div class="view-pill ${this.viewMode === 'today' ? 'active' : ''}" data-view="today">Today</div>
            <div class="view-pill ${this.viewMode === 'week' ? 'active' : ''}" data-view="week">Week</div>
            <div class="view-pill ${this.viewMode === 'month' ? 'active' : ''}" data-view="month">Month</div>
          </div>
        </div>
        
        <div class="calendar-grid" id="calendar-grid">
          ${this.renderCalendarBody()}
        </div>
      </div>
      
      ${this.renderModal()}
    `;
  },

  getHeaderTitle: function() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (this.viewMode === 'month') {
      return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    } else if (this.viewMode === 'week') {
      const start = this.getStartOfWeek(this.currentDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      if (start.getMonth() === end.getMonth()) {
        return `${months[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${months[this.currentDate.getMonth()]} ${this.currentDate.getDate()}, ${this.currentDate.getFullYear()}`;
  },

  renderCalendarBody: function() {
    if (this.viewMode === 'month') return this.renderMonthBody();
    if (this.viewMode === 'week') return this.renderWeekBody();
    return this.renderTodayBody();
  },

  renderMonthBody: function() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();
    
    let html = ['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => `<div class="calendar-day-header">${d}</div>`).join('');
    const todayStr = new Date().toDateString();

    for (let i = firstDay; i > 0; i--) {
      const d = prevLastDate - i + 1;
      html += `<div class="calendar-cell other-month" data-y="${year}" data-m="${month - 1}" data-d="${d}"><span class="day-number">${d}</span></div>`;
    }

    for (let d = 1; d <= lastDate; d++) {
      const dObj = new Date(year, month, d);
      const isToday = dObj.toDateString() === todayStr;
      html += `<div class="calendar-cell ${isToday ? 'today' : ''}" data-y="${year}" data-m="${month}" data-d="${d}">
                <span class="day-number">${d}</span>
                ${this.renderCombinedEvents(dObj)}
              </div>`;
    }

    const totalCells = html.split('calendar-cell').length - 1;
    const padding = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= padding; i++) html += `<div class="calendar-cell other-month" data-y="${year}" data-m="${month + 1}" data-d="${i}"><span class="day-number">${i}</span></div>`;


    return html;
  },

  renderWeekBody: function() {
    const start = this.getStartOfWeek(this.currentDate);
    let html = ['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => `<div class="calendar-day-header">${d}</div>`).join('');
    const todayStr = new Date().toDateString();

    for (let i = 0; i < 7; i++) {
      const dObj = new Date(start);
      dObj.setDate(start.getDate() + i);
      const isToday = dObj.toDateString() === todayStr;
      html += `<div class="calendar-cell ${isToday ? 'today' : ''}" data-y="${dObj.getFullYear()}" data-m="${dObj.getMonth()}" data-d="${dObj.getDate()}" style="height: 100%;">
                <span class="day-number">${dObj.getDate()}</span>
                ${this.renderCombinedEvents(dObj)}
              </div>`;
    }
    return html;
  },

  renderTodayBody: function() {
      const isToday = this.currentDate.toDateString() === new Date().toDateString();
      return `
        <div class="calendar-day-header" style="grid-column: span 7;">Daily Operations Detail</div>
        <div class="calendar-cell ${isToday ? 'today' : ''}" style="grid-column: span 7; min-height: 500px; padding: 40px; background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
                <div>
                    <h2 style="margin: 0 0 8px 0; color: var(--text-main); font-size: 2.2rem; font-weight: 800;">${this.getHeaderTitle()}</h2>
                    <p style="color: var(--text-muted); font-size: 1rem; margin: 0;">Detailed breakdown of all scheduled activities.</p>
                </div>
                ${isToday ? '<span style="background: var(--primary); color: white; padding: 6px 16px; border-radius: 20px; font-weight: 800; font-size: 0.8rem; box-shadow: 0 0 20px rgba(242, 89, 0, 0.4);">LIVE TODAY</span>' : ''}
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px;">
                <div>
                    <h4 style="color: #ffb878; text-transform: uppercase; font-size: 0.85rem; font-weight: 900; letter-spacing: 0.15em; margin-bottom: 25px; display: flex; align-items: center; gap: 10px;">
                      <span style="width: 10px; height: 10px; border-radius: 50%; background: #ffb878; box-shadow: 0 0 15px #ffb878"></span> Projects
                    </h4>
                    <div style="max-height: 600px; overflow-y: auto; padding-right: 10px;">
                        ${this.renderCombinedEventsByType(this.currentDate, 'Project')}
                    </div>
                </div>
                <div>
                    <h4 style="color: #7ae7bf; text-transform: uppercase; font-size: 0.85rem; font-weight: 900; letter-spacing: 0.15em; margin-bottom: 25px; display: flex; align-items: center; gap: 10px;">
                      <span style="width: 10px; height: 10px; border-radius: 50%; background: #7ae7bf; box-shadow: 0 0 15px #7ae7bf"></span> Sales Demos
                    </h4>
                    <div style="max-height: 600px; overflow-y: auto; padding-right: 10px;">
                        ${this.renderCombinedEventsByType(this.currentDate, 'Sales')}
                    </div>
                </div>
                <div>
                    <h4 style="color: var(--primary); text-transform: uppercase; font-size: 0.85rem; font-weight: 900; letter-spacing: 0.15em; margin-bottom: 25px; display: flex; align-items: center; gap: 10px;">
                      <span style="width: 10px; height: 10px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 15px var(--primary)"></span> Pending Requests
                    </h4>
                    <div style="max-height: 600px; overflow-y: auto; padding-right: 10px;">
                        ${this.renderCombinedEventsByType(this.currentDate, 'Google')}
                    </div>
                </div>
            </div>
        </div>
      `;
  },

  renderCombinedEvents: function(date) {
    const ds = date.toDateString();
    // Local - use safe parsing
    const localSchedules = window.AppState.schedules || [];
    const local = localSchedules.filter(s => {
        const dObj = window.Pages.schedule.parseDate(s.date);
        return dObj.toDateString() === ds;
    });
    
    // Ensure all local tasks are recognized as shared/synchronized for logic consistency
    local.forEach(s => s.isShared = true);

    // Google - hide if already assigned/claimed OR if name/date match (Safety Net)
    const assignedGoogleIds = localSchedules.filter(s => s.googleEventId).map(s => s.googleEventId);
    const localTitles = local.map(s => (s.client || '').toLowerCase());
    
    const google = this.googleEvents.filter(e => {
        if (assignedGoogleIds.includes(e.id)) return false;
        
        // Safety match: If the title (without "Project: " etc) and date match a local task, hide it
        const normalizedSummary = (e.summary || '').replace(/^(Project|Sales): /, '').toLowerCase();
        if (localTitles.includes(normalizedSummary)) return false;

        const start = e.start.dateTime || e.start.date;
        return new Date(start).toDateString() === ds;
    });

    let html = local.map(e => {
        const color = this.GOOGLE_COLORS[e.colorId] || (e.type === 'Project' ? '#f25900' : '#10b981');
        return `
            <div class="event-bar" 
                 onclick="event.stopPropagation(); window.Pages.schedule.openEditModal('${e.id}', 'local')"
                 style="background: ${color}26; color: ${color}; border-left: 3px solid ${color};"
                 title="${e.client}">
                <span style="opacity: 0.7;">${e.time || '--:--'}</span>
                <span>${e.client}</span>
            </div>
        `;
    }).join('');

    html += google.map(e => {
        const color = this.getGoogleColor(e.colorId);
        return `
            <div class="event-bar event-google" 
                 onclick="event.stopPropagation(); window.Pages.schedule.openEditModal('${e.id}', 'google')"
                 style="background: ${color}26; color: ${color}; border: 1.2px dashed ${color}80;" title="${e.summary}">
                <span style="opacity: 0.7;">G</span>
                <span>${e.summary}</span>
            </div>
        `;
    }).join('');

    return html;
  },

  renderCombinedEventsByType: function(date, typeOrSource) {
    const ds = date.toDateString();
    let events = [];

    if (typeOrSource === 'Google') {
        const localSchedules = window.AppState.schedules || [];
        const assignedGoogleIds = localSchedules.filter(s => s.googleEventId).map(s => s.googleEventId);
        
        // Get local titles for this specific date to fuzzy match
        const localTitlesToday = localSchedules.filter(s => {
            const dObj = this.parseDate(s.date);
            return dObj.toDateString() === date.toDateString();
        }).map(s => (s.client || '').toLowerCase());

        events = this.googleEvents.filter(e => {
            // Filter out events already "Assigned" in our system by ID
            if (assignedGoogleIds.includes(e.id)) return false;

            const startStr = e.start.dateTime || e.start.date;
            const eventDate = new Date(startStr);
            const isSameDate = eventDate.getFullYear() === date.getFullYear() && 
                               eventDate.getMonth() === date.getMonth() && 
                               eventDate.getDate() === date.getDate();
            
            if (!isSameDate) return false;

            // FUZZY MATCH SAFETY: Filter out by title as well
            const normalizedSummary = (e.summary || '').replace(/^(Project|Sales): /, '').toLowerCase();
            if (localTitlesToday.includes(normalizedSummary)) return false;

            return true;
        }).map(e => ({
            id: e.id,
            client: e.summary,
            time: (e.start.dateTime ? new Date(e.start.dateTime).toTimeString().substring(0,5) : 'All Day'),
            assignee: 'Unassigned',
            assignor: (e.creator ? (e.creator.displayName || e.creator.email) : 'Google User'),
            status: 'Pending',
            source: 'google',
            color: this.getGoogleColor(e.colorId)
        }));
    } else {
        events = (window.AppState.schedules || [])
            .filter(s => {
                const eventDate = this.parseDate(s.date);
                return eventDate.getFullYear() === date.getFullYear() && 
                       eventDate.getMonth() === date.getMonth() && 
                       eventDate.getDate() === date.getDate() &&
                       s.type === typeOrSource;
            })
            .map(s => ({ ...s, source: 'local' }));
    }
    
    if (events.length === 0) return `<p style="color: var(--text-muted); font-size: 0.9rem; font-style: italic;">No ${typeOrSource === 'Google' ? 'Pending Requests' : typeOrSource + 's'} scheduled</p>`;
    
    return events.map(e => {
        const isGoogle = e.source === 'google';
        const accent = isGoogle ? e.color : (this.GOOGLE_COLORS[e.colorId] || (e.type === 'Project' ? '#ffb878' : '#7ae7bf'));
        return `
            <div onclick="event.stopPropagation(); window.Pages.schedule.openEditModal('${e.id}', '${e.source}')" 
                 style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 16px; padding: 18px; margin-bottom: 15px; border-left: 5px solid ${accent}; transition: all 0.2s; cursor: pointer; position: relative; overflow: hidden;"
                 onmouseover="this.style.background='rgba(255,255,255,0.06)'; this.style.transform='translateX(5px)'"
                 onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.transform='translateX(0)'">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; pointer-events: none;">
                    <span style="font-weight: 800; color: var(--text-main); font-size: 1.15rem;">${e.client}</span>
                    <span style="padding: 5px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; background: ${accent}1A; color: ${accent}; border: 1px solid ${accent}33;">${e.status || (isGoogle ? 'Pending' : 'Scheduled')}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr; gap: 8px; color: var(--text-muted); font-size: 0.9rem; pointer-events: none;">
                    <span style="display:flex; align-items:center; gap:8px;">🕒 <span style="font-weight:700; color:var(--text-main); opacity:0.8;">Time:</span> ${e.time || 'All Day'}</span>
                    <span style="display:flex; align-items:center; gap:8px;">📤 <span style="font-weight:700; color:var(--text-main); opacity:0.8;">Assignor:</span> ${e.assignor || 'Agent 1'}</span>
                    <span style="display:flex; align-items:center; gap:8px;">👤 <span style="font-weight:700; color:var(--text-main); opacity:0.8;">Assignee:</span> ${e.assignee || 'Unassigned'}</span>
                </div>
                ${isGoogle ? `<div style="position:absolute; top:0; right:0; padding: 5px 10px; font-size:0.6rem; background: ${accent}22; color: ${accent}; font-weight:900; border-bottom-left-radius: 10px;">G</div>` : ''}
            </div>
        `;
    }).join('');
  },

  getStartOfWeek: function(d) {
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.getFullYear(), d.getMonth(), diff);
  },

  renderModal: function() {
    if (!this.isAddModalOpen) return '';
    const agents = window.AppState.agents || [];
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

    const colorNames = [
      { id: '11', name: 'Tomato', hex: '#dc2127' },
      { id: '6',  name: 'Tangerine', hex: '#ffb878' },
      { id: '5',  name: 'Banana', hex: '#fbd75b' },
      { id: '10', name: 'Basil', hex: '#51b749' },
      { id: '2',  name: 'Sage', hex: '#7ae7bf' },
      { id: '7',  name: 'Peacock', hex: '#46d6db' },
      { id: '9',  name: 'Blueberry', hex: '#5484ed' },
      { id: '1',  name: 'Lavender', hex: '#a4bdfc' },
      { id: '3',  name: 'Grape', hex: '#dbadff' },
      { id: '4',  name: 'Flamingo', hex: '#ff887c' },
      { id: '8',  name: 'Graphite', hex: '#e1e1e1' }
    ];

    return `
      <div class="modal-overlay active" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 10001; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(15px);">
        <div class="modal-container" style="background: var(--bg-surface); width: 550px; border-radius: 28px; border: 1px solid var(--border-color); box-shadow: 0 40px 80px rgba(0,0,0,0.6); overflow: hidden; animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
          <div style="padding: 24px 30px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <h3 style="margin: 0; color: var(--text-main); font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em;">${this.editingItem ? 'Edit' : 'Create New'} Schedule</h3>
            <div style="display: flex; gap: 12px; align-items: center;">
              ${this.editingItem ? `<button id="btn-delete-schedule" style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1.5px solid rgba(239, 68, 68, 0.2); padding: 8px 16px; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 0.85rem; transition: 0.2s;">Delete Task</button>` : ''}
              <button id="modal-close" style="width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,0.05); color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.2s;">✕</button>
            </div>
          </div>
          
          <div style="padding: 35px; max-height: 80vh; overflow-y: auto;">
            <!-- TYPE SELECTOR -->
            <div style="display: flex; gap: 12px; margin-bottom: 30px; background: rgba(0,0,0,0.25); padding: 6px; border-radius: 16px;">
                <div class="type-btn ${this.selectedType === 'Project' ? 'active' : ''}" data-type="Project" style="flex: 1; text-align: center; padding: 12px; border-radius: 12px; cursor: pointer; font-weight: 800; font-size: 0.95rem; color: ${this.selectedType === 'Project' ? 'white' : 'var(--text-muted)'}; background: ${this.selectedType === 'Project' ? '#ff9f43' : 'transparent'}; transition: all 0.3s; box-shadow: ${this.selectedType === 'Project' ? '0 4px 15px rgba(255,159,67,0.3)' : 'none'};">Project</div>
                <div class="type-btn ${this.selectedType === 'Sales' ? 'active' : ''}" data-type="Sales" style="flex: 1; text-align: center; padding: 12px; border-radius: 12px; cursor: pointer; font-weight: 800; font-size: 0.95rem; color: ${this.selectedType === 'Sales' ? 'white' : 'var(--text-muted)'}; background: ${this.selectedType === 'Sales' ? '#10b981' : 'transparent'}; transition: all 0.3s; box-shadow: ${this.selectedType === 'Sales' ? '0 4px 15px rgba(16,185,129,0.3)' : 'none'};">Sales Demo</div>
            </div>

            <!-- CLIENT NAME -->
            <div class="form-group" style="margin-bottom: 25px;">
              <label style="display: block; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 10px;">Client Overview</label>
              <div style="position: relative;">
                <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); opacity: 0.5;">🏬</span>
                <input type="text" id="sch-client" placeholder="e.g. McDonald's HQ" value="${this.modalDraft.client}" style="width: 100%; padding: 14px 16px 14px 45px; border-radius: 12px; border: 2px solid var(--border-color); background: var(--bg-main); color: var(--text-main); font-size: 1rem; outline: none; transition: 0.2s; box-sizing: border-box;">
              </div>
            </div>

            <!-- DATE & TIME -->
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 25px;">
                <div class="form-group">
                  <label style="display: block; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 10px;">Scheduled Date</label>
                  <div style="position: relative;">
                    <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); opacity: 0.5;">📅</span>
                    <input type="date" id="sch-date" value="${this.modalDraft.date || this.formatLocalDate(this.currentDate)}" style="width: 100%; padding: 14px 16px 14px 45px; border-radius: 12px; border: 2px solid var(--border-color); background: var(--bg-main); color: var(--text-main); font-size: 1rem; outline: none; box-sizing: border-box;">
                  </div>
                </div>
                <div class="form-group">
                  <label style="display: block; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 10px;">Schedule Time</label>
                  <div style="position: relative;">
                    <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); opacity: 0.5;">🕒</span>
                    <input type="time" id="sch-time" value="${this.modalDraft.time || (this.editingItem ? '' : currentTime)}" style="width: 100%; padding: 14px 16px 14px 45px; border-radius: 12px; border: 2px solid var(--border-color); background: var(--bg-main); color: var(--text-main); font-size: 1rem; outline: none; box-sizing: border-box;">
                  </div>
                </div>
            </div>

            <!-- STATUS SELECTOR (Only for Project) -->
            ${this.selectedType === 'Project' ? `
            <div class="form-group" style="margin-bottom: 25px;">
              <label style="display: block; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 10px;">Project Status</label>
              <div style="position: relative;">
                <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); opacity: 0.5;">🛠️</span>
                <select id="sch-status" style="width: 100%; padding: 14px 16px 14px 45px; border-radius: 12px; border: 2px solid var(--border-color); background: var(--bg-main); color: var(--text-main); font-size: 1rem; outline: none; appearance: none; cursor: pointer; box-sizing: border-box;">
                  <option value="Onsite Project (New)" ${this.modalDraft.status === 'Onsite Project (New)' ? 'selected' : ''}>Onsite Project (New)</option>
                  <option value="Onsite Re-Training" ${this.modalDraft.status === 'Onsite Re-Training' ? 'selected' : ''}>Onsite Re-Training</option>
                  <option value="Online Project (New)" ${this.modalDraft.status === 'Online Project (New)' ? 'selected' : ''}>Online Project (New)</option>
                  <option value="Online Re-Training" ${this.modalDraft.status === 'Online Re-Training' ? 'selected' : ''}>Online Re-Training</option>
                  <option value="Hardware Setup" ${this.modalDraft.status === 'Hardware Setup' ? 'selected' : ''}>Hardware Setup</option>
                  <option value="Checking" ${this.modalDraft.status === 'Checking' ? 'selected' : ''}>Checking</option>
                </select>
                <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5;">▼</span>
              </div>
            </div>
            ` : ''}

            <!-- AGENT ASSIGNMENT -->
            <div class="form-group" style="margin-bottom: 30px;">
              <label style="display: block; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 10px;">Assignee</label>
              <div style="position: relative;">
                <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); opacity: 0.5;">👤</span>
                <select id="sch-agent" style="width: 100%; padding: 14px 16px 14px 45px; border-radius: 12px; border: 2px solid var(--border-color); background: var(--bg-main); color: var(--text-main); font-size: 1rem; outline: none; appearance: none; cursor: pointer; box-sizing: border-box;">
                  <option value="">Unassigned</option>
                  ${agents.map(a => `<option value="${a.name}" ${this.modalDraft.agent === a.name ? 'selected' : ''}>${a.name} (${a.role})</option>`).join('')}
                </select>
                <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5;">▼</span>
              </div>
            </div>

            <!-- COLOR PICKER -->
            <div class="form-group" style="margin-bottom: 35px;">
              <label style="display: block; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 15px;">Task Color (Google Sync)</label>
              <div style="display: flex; flex-wrap: wrap; gap: 12px; background: rgba(0,0,0,0.15); padding: 15px; border-radius: 16px; border: 1px solid var(--border-color);">
                ${colorNames.map(c => `
                  <div class="color-opt ${this.selectedColorId === c.id ? 'active' : ''}" 
                       data-id="${c.id}" 
                       title="${c.name}"
                       style="width: 28px; height: 28px; border-radius: 50%; background: ${c.hex}; cursor: pointer; transition: all 0.2s; border: 3px solid ${this.selectedColorId === c.id ? 'white' : 'transparent'}; box-shadow: ${this.selectedColorId === c.id ? '0 0 10px ' + c.hex : 'none'}; transform: ${this.selectedColorId === c.id ? 'scale(1.2)' : 'scale(1)'}">
                  </div>
                `).join('')}
              </div>
            </div>

            <button id="btn-save-schedule" ${this.isSaving ? 'disabled' : ''} style="width: 100%; padding: 16px; border-radius: 16px; border: none; background: ${this.isSaving ? 'var(--text-muted)' : 'var(--primary)'}; color: white; font-weight: 900; font-size: 1.15rem; cursor: ${this.isSaving ? 'not-allowed' : 'pointer'}; box-shadow: 0 10px 25px rgba(242, 89, 0, 0.4); transition: transform 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px;">
                ${this.isSaving ? `
                  <div class="spinner-small" style="width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                  Saving...
                ` : 'Save'}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  afterRender: function() {
    const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
    
    bind('cal-prev', () => {
      if (this.viewMode === 'month') this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      else if (this.viewMode === 'week') this.currentDate.setDate(this.currentDate.getDate() - 7);
      else this.currentDate.setDate(this.currentDate.getDate() - 1);
      this.fetchEvents(); // Refresh data for new range
      this.triggerUpdate();
    });

    bind('cal-next', () => {
      if (this.viewMode === 'month') this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      else if (this.viewMode === 'week') this.currentDate.setDate(this.currentDate.getDate() + 7);
      else this.currentDate.setDate(this.currentDate.getDate() + 1);
      this.fetchEvents(); // Refresh data for new range
      this.triggerUpdate();
    });

    bind('cal-today', () => {
      this.currentDate = new Date();
      this.triggerUpdate();
    });

    document.querySelectorAll('.view-pill').forEach(el => {
      el.onclick = () => { this.viewMode = el.dataset.view; this.triggerUpdate(); };
    });

    bind('google-link-status', () => this.handleAuthClick());
    
    bind('btn-sync-cloud', async () => {
        const btn = document.getElementById('btn-sync-cloud');
        if (btn) btn.innerHTML = 'Syncing...';
        this.isCloudSyncing = true;
        try {
            if (window.loadStateFromFirestore) {
                await window.loadStateFromFirestore();
                console.log("☁️ Manual cloud sync complete");
            }
            if (window.AppState.isGoogleLinked) await this.fetchEvents();
        } catch (e) {
            console.error("Manual Sync Error:", e);
        }
        this.isCloudSyncing = false;
        if(window.renderApp) window.renderApp();
    });

    // Calendar Cell Clicks
    const calendar = document.getElementById('calendar-grid');
    if (calendar) {
        calendar.addEventListener('click', (e) => {
            const cell = e.target.closest('.calendar-cell');
            if (cell && !e.target.closest('.event-bar')) {
                const y = parseInt(cell.getAttribute('data-y'));
                const m = parseInt(cell.getAttribute('data-m'));
                const d = parseInt(cell.getAttribute('data-d'));
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                    this.switchToDate(y, m, d);
                }
            }
        });
    }

    bind('btn-add-schedule', () => { 
        this.editingItem = null; 
        this.modalDraft = { client: '', date: this.formatLocalDate(this.currentDate), time: '', agent: '', status: 'Onsite Project (New)' };
        this.isAddModalOpen = true; 
        this.triggerUpdate(); 
    });
    bind('modal-close', () => { this.isAddModalOpen = false; this.editingItem = null; this.triggerUpdate(); });

    // Track input changes in real-time
    ['sch-client', 'sch-date', 'sch-time', 'sch-agent', 'sch-status'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.oninput = (e) => {
                const key = id.replace('sch-', '');
                this.modalDraft[key] = e.target.value;
            };
        }
    });

    bind('btn-delete-schedule', async () => {
      if (!this.editingItem || !confirm('Are you sure you want to delete this task?')) return;
      
      const { id, source } = this.editingItem;
      
      if (source === 'local') {
          const sch = window.AppState.schedules.find(s => s.id === id);
          if (sch && sch.googleEventId && window.AppState.isGoogleLinked) {
              await this.deleteGoogleEvent(sch.googleEventId);
          }
          window.AppState.schedules = window.AppState.schedules.filter(s => s.id !== id);
          if (window.deleteScheduleFromFirestore) window.deleteScheduleFromFirestore(id);
          window.saveState();
      } else {
          await this.deleteGoogleEvent(id);
      }
      
      this.isAddModalOpen = false;
      this.editingItem = null;
      this.triggerUpdate();
    });

    document.querySelectorAll('.type-btn').forEach(el => {
      el.onclick = () => { 
          // Capture current values before re-render to prevent data loss
          const clientEl = document.getElementById('sch-client');
          if (clientEl) this.modalDraft.client = clientEl.value;
          const dateEl = document.getElementById('sch-date');
          if (dateEl) this.modalDraft.date = dateEl.value;
          const timeEl = document.getElementById('sch-time');
          if (timeEl) this.modalDraft.time = timeEl.value;
          const agentEl = document.getElementById('sch-agent');
          if (agentEl) this.modalDraft.agent = agentEl.value;
          const statusEl = document.getElementById('sch-status');
          if (statusEl) this.modalDraft.status = statusEl.value;

          this.selectedType = el.dataset.type; 
          this.selectedColorId = (this.selectedType === 'Project' ? '6' : '2');
          this.triggerUpdate(); 
      }
    });

    document.querySelectorAll('.color-opt').forEach(el => {
        el.onclick = () => { this.selectedColorId = el.dataset.id; this.triggerUpdate(); }
    });

    bind('btn-save-schedule', async () => {
      if (this.isSaving) return;
      const client = document.getElementById('sch-client').value.trim();
      const date = document.getElementById('sch-date').value;
      const time = document.getElementById('sch-time').value;
      const agent = document.getElementById('sch-agent').value;
      const status = this.selectedType === 'Project' ? document.getElementById('sch-status').value : 'Demo';

      if (!client) {
          const input = document.getElementById('sch-client');
          input.style.borderColor = '#EF4444';
          input.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.2)';
          input.placeholder = '⚠️ Client name is required!';
          input.focus();
          return;
      }

      this.isSaving = true;
      this.triggerUpdate();

      try {
          if (this.editingItem) {
              const { id, source } = this.editingItem;
              if (source === 'local') {
                  const idx = window.AppState.schedules.findIndex(s => s.id === id);
                  if (idx !== -1) {
                      window.AppState.schedules[idx] = { 
                          ...window.AppState.schedules[idx], 
                          client, date, time, 
                          type: this.selectedType, 
                          assignee: agent, 
                          status,
                          colorId: this.selectedColorId 
                      };
                      if (window.saveScheduleToFirestore) await window.saveScheduleToFirestore(window.AppState.schedules[idx]);
                      window.saveState();
                      if (window.AppState.schedules[idx].googleEventId && window.AppState.isGoogleLinked) {
                          await this.updateGoogleEvent(window.AppState.schedules[idx].googleEventId, window.AppState.schedules[idx]);
                      }
                  }
              } else {
                  const gItem = this.googleEvents.find(e => e.id === id);
                  const assignor = gItem && gItem.creator ? (gItem.creator.displayName || gItem.creator.email) : 'Google User';
                  const newSch = {
                    id: 'sch-' + Date.now(),
                    googleEventId: id,
                    client, date, time,
                    type: this.selectedType,
                    assignee: agent,
                    status,
                    assignor: assignor,
                    colorId: this.selectedColorId
                  };
                  if (!window.AppState.schedules) window.AppState.schedules = [];
                  window.AppState.schedules.push(newSch);
                  if (window.saveScheduleToFirestore) await window.saveScheduleToFirestore(newSch);
                  window.saveState();
                  if (window.AppState.isGoogleLinked) await this.updateGoogleEvent(id, newSch);
              }
          } else {
              const newSch = {
                id: 'sch-' + Date.now(),
                client, date, time,
                type: this.selectedType,
                assignee: agent,
                status,
                assignor: 'Agent 1',
                colorId: this.selectedColorId
              };
              if (!window.AppState.schedules) window.AppState.schedules = [];
              window.AppState.schedules.push(newSch);
              if (window.AppState.isGoogleLinked) {
                  const gId = await this.createGoogleEvent(newSch);
                  if (gId) {
                      newSch.googleEventId = gId;
                  }
              }
              if (window.saveScheduleToFirestore) await window.saveScheduleToFirestore(newSch);
              window.saveState();
          }
      } catch (err) {
          console.error("❌ Save Schedule Failed:", err);
          alert("Save failed. Please check your connection.");
      } finally {
          this.isSaving = false;
          this.isAddModalOpen = false;
          this.editingItem = null;
          const savedDate = this.parseDate(date);
          savedDate.setHours(12, 0, 0, 0);
          this.currentDate = savedDate;
          this.viewMode = 'today';
          this.triggerUpdate();
          if (window.renderApp) window.renderApp();
      }
    });
  },

  triggerUpdate: function() {
    // Fix: Allow re-rendering even if a modal is open so the modal itself can be rendered
    if (window.currentView === 'schedule') {
        window.dispatchEvent(new CustomEvent('re-render-view', { detail: 'schedule' }));
    }
  },

  resetFilters: function() {
    this.viewMode = 'month';
    this.currentDate = new Date();
  }
};

// Start loading scripts immediately
window.Pages.schedule.loadGoogleScripts();
