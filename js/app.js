// js/app.js
window.currentView = 'dashboard';
window._profileMenuOpen = false;

window.getGoogleCalendarTokenKey = function(user) {
    const activeUser = user || window.AppState?.user || window.firebaseAuth?.currentUser;
    const identifier = activeUser?.uid || activeUser?.id || activeUser?.email || 'anonymous';
    return 'google_access_token_' + identifier;
};

window.getGoogleCalendarToken = function(user) {
    return localStorage.getItem(window.getGoogleCalendarTokenKey(user));
};

window.setGoogleCalendarToken = function(token, user) {
    if (!token) return;
    localStorage.setItem(window.getGoogleCalendarTokenKey(user), token);
    localStorage.removeItem('google_access_token');
};

window.clearGoogleCalendarToken = function(user) {
    localStorage.removeItem(window.getGoogleCalendarTokenKey(user));
    localStorage.removeItem('google_access_token');
};

// --- AUTHENTICATION & USER PROFILE ---

window.handleGoogleLogin = async function() {
    try {
        const result = await window.firebaseAuth.signInWithPopup(window.googleProvider);
        
        // CHECK: Verify if Google Calendar scope was granted
        // Note: Firebase does not reliably return granted_scopes in additionalUserInfo.profile
        const credential = result.credential;
        
        if (credential && credential.accessToken) {
            window.setGoogleCalendarToken(credential.accessToken, result.user);
        } else {
            console.warn("No access token returned from Google. Calendar features may be restricted.");
        }
        
        await checkAndCreateUserProfile(result.user);
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed: " + error.message);
    }
};

window.handleLogout = function() {
    const currentUser = window.AppState.user || window.firebaseAuth.currentUser;
    window.firebaseAuth.signOut().then(function() {
        window.AppState.user = null;
        window._profileMenuOpen = false;
        window.clearGoogleCalendarToken(currentUser);
        window.AppState.isGoogleLinked = false;
        
        // Reset all page initialization flags so they reload clean on next login
        if (window.Pages) {
            Object.keys(window.Pages).forEach(key => {
                if (window.Pages[key]) {
                    window.Pages[key]._inited = false;
                }
            });
        }
        
        window.saveState();
        renderApp();
    });
};

async function checkAndCreateUserProfile(user) {
    var db = window.firebaseDb;
    var userRef = db.collection("users").doc(user.uid);
    var userSnap = await userRef.get();

    if (!userSnap.exists) {
        // Check if first user
        var isFirstUser = false;
        try {
            var usersSnap = await db.collection("users").limit(1).get();
            isFirstUser = usersSnap.empty;
        } catch (e) {
            console.warn("Could not check if first user, defaulting to Guest.", e);
        }

        var newUser = {
            id: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            role: isFirstUser ? 'SuperAdmin' : 'Guest',
            avatarColor: '',
            profileComplete: false,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        await userRef.set(newUser);
        window.AppState.user = newUser;
        console.log(isFirstUser ? "👑 First user: SuperAdmin" : "👤 New user: Guest");
    } else {
        var userData = userSnap.data();
        if (userData.disabled) {
            alert("Your account has been deactivated. Please contact the administrator.");
            await window.firebaseAuth.signOut();
            throw new Error("User account disabled");
        }
        try {
            await userRef.update({ lastLogin: new Date().toISOString() });
        } catch (updateErr) {
            console.warn("Could not update lastLogin timestamp.", updateErr);
        }
        window.AppState.user = userData;
    }
}

// Save profile from setup screen
window.saveUserProfile = async function(displayName, avatarColor) {
    if (!window.AppState.user) return;
    var db = window.firebaseDb;
    var userRef = db.collection("users").doc(window.AppState.user.id);
    await userRef.update({
        displayName: displayName,
        avatarColor: avatarColor,
        profileComplete: true
    });
    window.AppState.user.displayName = displayName;
    window.AppState.user.avatarColor = avatarColor;
    window.AppState.user.profileComplete = true;
    
    // REDIRECTION: New Guests should land on Schedule Hub
    if (window.AppState.user.role === 'Guest') {
        window.currentView = 'schedule';
    } else {
        window.currentView = 'dashboard';
    }
    
    // Force HRM to refresh the list with the new avatar/name
    if (window.Pages && window.Pages.user_log) {
        window.Pages.user_log.users = [];
        window.Pages.user_log.isLoading = true;
    }
    
    renderApp();
};

// Edit profile (from top-right menu)
window.openProfileEdit = function() {
    window._profileMenuOpen = false;
    var portal = document.getElementById('modal-portal');
    if (portal && window.Pages.profile_setup) {
        window.Pages.profile_setup.selectedColor = window.AppState.user.avatarColor || 'red';
        portal.innerHTML = window.Pages.profile_setup.render();
        window.Pages.profile_setup.afterRender();
        var nameInput = document.getElementById('profile-name');
        if (nameInput) nameInput.value = window.AppState.user.displayName || '';
    }
};

window.toggleProfileMenu = function() {
    window._profileMenuOpen = !window._profileMenuOpen;
    var menu = document.getElementById('profile-dropdown');
    if (menu) {
        menu.style.display = window._profileMenuOpen ? 'block' : 'none';
    }
};

// Close menu on click outside
document.addEventListener('click', function(e) {
    if (window._profileMenuOpen && !e.target.closest('#profile-area')) {
        window._profileMenuOpen = false;
        var menu = document.getElementById('profile-dropdown');
        if (menu) menu.style.display = 'none';
    }
});

// --- FIRESTORE SYNC LOGIC ---

// Helper for chunking large datasets into Firestore batches (max 500 per batch)
async function performChunkedBatch(collectionRef, items, operation = 'set') {
    const CHUNK_SIZE = 450; 
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const batch = window.firebaseDb.batch();
        const chunk = items.slice(i, i + CHUNK_SIZE);
        chunk.forEach(item => {
            const docRef = collectionRef.doc(item.id || item.productId + '_' + item.area); 
            if (operation === 'set') batch.set(docRef, item);
            else if (operation === 'delete') batch.delete(docRef);
        });
        await batch.commit();
    }
}

window.syncStateToFirestore = async function(silent = false) {
    if (!window.AppState.user || window.AppState.isCloudSyncing) return;
    try {
        window.AppState.isCloudSyncing = true;
        var db = window.firebaseDb;
        const timestamp = new Date().toISOString();
        const userEmail = (window.AppState.user.email || 'system').toLowerCase();

        // 1. UPDATE METADATA (Triggers real-time listeners on other devices without burning quota)
        const metaBatch = db.batch();
        const metaData = { updatedAt: timestamp, updatedBy: userEmail };
        metaBatch.set(db.collection("feedme_module").doc("metadata"), metaData);
        metaBatch.set(db.collection("dong_zhuo_module").doc("metadata"), metaData);
        metaBatch.set(db.collection("inventory_module").doc("metadata"), metaData);
        await metaBatch.commit();

        if (!silent) console.log("⚡ Cloud Sync Listeners Triggered (Delta Mode)");
    } catch (e) {
        console.error("Metadata Sync Error:", e);
    } finally {
        window.AppState.isCloudSyncing = false;
    }
};

window.loadStateFromFirestore = async function() {
    try {
        var db = window.firebaseDb;
        
        // Load in parallel
        const [feedmeSnap, dongZhuoSnap, inventorySnap, hubActSnap, invLogSnap, invSnap, schedSnap] = await Promise.all([
            db.collection("feedme_module").doc("data").collection("list").get(),
            db.collection("dong_zhuo_module").doc("data").collection("list").get(),
            db.collection("inventory_module").doc("data").collection("items").get(),
            db.collection("inventory_module").doc("data").collection("hub_activities").get(),
            db.collection("inventory_module").doc("data").collection("inventory_logs").get(),
            db.collection("invoices_v2").get(),
            db.collection("schedules_v2").get()
        ]);

        window.AppState.customers = feedmeSnap.empty ? [] : feedmeSnap.docs.map(doc => doc.data());
        window.AppState.dongZhuoCustomers = dongZhuoSnap.empty ? [] : dongZhuoSnap.docs.map(doc => doc.data());
        if (inventorySnap.empty) {
            if (!window.AppState.inventory || window.AppState.inventory.length === 0) {
                const hardwareItems = (window.AppState.products || []).filter(p => p.type === 'Hardware');
                window.AppState.inventory = [];
                hardwareItems.forEach(h => {
                    ['Hugo', 'YS', 'Tai'].forEach(area => {
                        window.AppState.inventory.push({ productId: h.id, outlet: 'Penang', area: area, quantity: 0 });
                    });
                    ['KT', 'JQ'].forEach(area => {
                        window.AppState.inventory.push({ productId: h.id, outlet: 'Ipoh', area: area, quantity: 0 });
                    });
                });
            } else {
                // Cloud is empty but local has data (sync was interrupted). Preserve local and queue resync.
                setTimeout(() => { if (window.saveStateToCloud) window.saveStateToCloud(); }, 2000);
            }
        } else {
            window.AppState.inventory = inventorySnap.docs.map(doc => doc.data());
        }

        if (hubActSnap.empty && window.AppState.hubActivities && window.AppState.hubActivities.length > 0) {
            // Preserve local data if cloud sync was interrupted
            setTimeout(() => { if (window.saveStateToCloud) window.saveStateToCloud(); }, 2000);
        } else {
            window.AppState.hubActivities = hubActSnap.empty ? [] : hubActSnap.docs.map(doc => doc.data());
        }

        if ((!invLogSnap || invLogSnap.empty) && window.AppState.inventoryLogs && window.AppState.inventoryLogs.length > 0) {
            setTimeout(() => { if (window.saveStateToCloud) window.saveStateToCloud(); }, 2000);
        } else {
            window.AppState.inventoryLogs = !invLogSnap || invLogSnap.empty ? [] : invLogSnap.docs.map(doc => doc.data());
        }

        window.AppState.invoices = invSnap.empty ? [] : invSnap.docs.map(doc => doc.data());
        if (window.incInventoryVersion) window.incInventoryVersion();
        if (window.Pages && window.Pages.inventory && window.Pages.inventory._invalidateCache) {
            window.Pages.inventory._invalidateCache();
        }

        window.AppState.schedules = schedSnap.empty ? [] : schedSnap.docs.map(doc => doc.data());
        
        console.log("☁️ State loaded from subcollections (Size Optimized)");
    } catch (e) {
        console.error("Load Error:", e);
    }
};

window.saveInvoiceToFirestore = async function(invoice) {
    if (!window.AppState.user) return;
    try {
        var db = window.firebaseDb;
        await db.collection("invoices_v2").doc(invoice.id).set(invoice);
        console.log("☁️ Invoice " + invoice.id + " saved to dedicated collection");
        // Also update global state timestamp to notify other users
        if (window.syncStateToFirestore) {
            window.syncStateToFirestore().catch(e => console.warn("Background module sync failed:", e));
        }
    } catch (e) {
        console.error("Invoice Save Error:", e);
    }
};

window.deleteInvoiceFromFirestore = async function(invoiceId) {
    if (!window.AppState.user) return;
    try {
        var db = window.firebaseDb;
        await db.collection("invoices_v2").doc(invoiceId).delete();
        console.log("☁️ Invoice " + invoiceId + " deleted from cloud");
        if (window.syncStateToFirestore) {
            window.syncStateToFirestore().catch(e => console.warn("Background module sync failed:", e));
        }
    } catch (e) {
        console.error("Invoice Delete Error:", e);
    }
};

window.resetFirestoreModules = async function(modules) {
    if (!window.AppState.user) return;
    try {
        modules = modules || [];
        if (modules.includes('invoices') && !modules.includes('inventory')) {
            modules = modules.concat('inventory');
        }

        var db = window.firebaseDb;
        const timestamp = new Date().toISOString();
        const userEmail = (window.AppState.user.email || 'system').toLowerCase();

        if (modules.includes('invoices')) {
            const invSnap = await db.collection("invoices_v2").get();
            const batch = db.batch();
            invSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log("☁️ Invoices cleared");
        }

        if (modules.includes('schedules')) {
            const schedSnap = await db.collection("schedules_v2").get();
            const batch = db.batch();
            schedSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log("☁️ Schedules cleared");
        }

        if (modules.includes('feedme')) {
            const listSnap = await db.collection("feedme_module").doc("data").collection("list").get();
            await performChunkedBatch(db.collection("feedme_module").doc("data").collection("list"), listSnap.docs.map(d => ({id: d.id})), 'delete');
            await db.collection("feedme_module").doc("metadata").set({ updatedAt: timestamp, updatedBy: userEmail });
            console.log("☁️ FeedMe subcollection cleared");
        }

        if (modules.includes('dongzhuo')) {
            const listSnap = await db.collection("dong_zhuo_module").doc("data").collection("list").get();
            await performChunkedBatch(db.collection("dong_zhuo_module").doc("data").collection("list"), listSnap.docs.map(d => ({id: d.id})), 'delete');
            await db.collection("dong_zhuo_module").doc("metadata").set({ updatedAt: timestamp, updatedBy: userEmail });
            console.log("☁️ Dong Zhuo subcollection cleared");
        }

        if (modules.includes('inventory')) {
            const itemsSnap = await db.collection("inventory_module").doc("data").collection("items").get();
            await performChunkedBatch(db.collection("inventory_module").doc("data").collection("items"), itemsSnap.docs.map(d => ({id: d.id})), 'delete');
            
            const hubActSnap = await db.collection("inventory_module").doc("data").collection("hub_activities").get();
            await performChunkedBatch(db.collection("inventory_module").doc("data").collection("hub_activities"), hubActSnap.docs.map(d => ({id: d.id})), 'delete');

            const invLogSnap = await db.collection("inventory_module").doc("data").collection("inventory_logs").get();
            await performChunkedBatch(db.collection("inventory_module").doc("data").collection("inventory_logs"), invLogSnap.docs.map(d => ({id: d.id})), 'delete');

            await db.collection("inventory_module").doc("metadata").set({ updatedAt: timestamp, updatedBy: userEmail });
            console.log("☁️ Inventory & Activity Logs cleared");
        }

        console.log("☁️ Selected module subcollections reset in cloud");
        
    } catch (e) {
        console.error("Reset Firestore Modules Error:", e);
        throw e;
    }
};

window.resetFirestoreData = async function() {
    await window.resetFirestoreModules(['feedme', 'dongzhuo', 'inventory', 'invoices', 'schedules']);
};

window.saveScheduleToFirestore = async function(schedule) {
    if (!window.AppState.user) return;
    try {
        var db = window.firebaseDb;
        await db.collection("schedules_v2").doc(schedule.id).set(schedule);
        console.log("☁️ Schedule " + schedule.id + " saved to dedicated collection");
        if (window.syncStateToFirestore) {
            window.syncStateToFirestore().catch(e => console.warn("Background module sync failed:", e));
        }
    } catch (e) {
        console.error("Schedule Save Error:", e);
    }
};

window.deleteScheduleFromFirestore = async function(scheduleId) {
    if (!window.AppState.user) return;
    try {
        var db = window.firebaseDb;
        await db.collection("schedules_v2").doc(scheduleId).delete();
        console.log("☁️ Schedule " + scheduleId + " deleted from cloud");
        if (window.syncStateToFirestore) {
            window.syncStateToFirestore().catch(e => console.warn("Background module sync failed:", e));
        }
    } catch (e) {
        console.error("Schedule Delete Error:", e);
    }
};

// --- USER MANAGEMENT ---

window.fetchUsers = async function() {
    if (window.AppState.user?.role !== 'SuperAdmin') return [];
    var db = window.firebaseDb;
    var snap = await db.collection("users").get();
    return snap.docs
        .map(function(d) { return Object.assign({ id: d.id }, d.data()); });
};

window.updateUserRole = async function(uid, newRole) {
    if (window.AppState.user?.role !== 'SuperAdmin') return;
    var db = window.firebaseDb;
    await db.collection("users").doc(uid).update({ role: newRole });
};

window.blockUser = async function(uid) {
    if (window.AppState.user?.role !== 'SuperAdmin') return;
    var db = window.firebaseDb;
    await db.collection("users").doc(uid).update({ disabled: true, blockedAt: new Date().toISOString() });
};

window.unblockUser = async function(uid) {
    if (window.AppState.user?.role !== 'SuperAdmin') return;
    var db = window.firebaseDb;
    await db.collection("users").doc(uid).update({ disabled: false, blockedAt: null });
};

window.removeUser = async function(uid) {
    if (window.AppState.user?.role !== 'SuperAdmin') return;
    var db = window.firebaseDb;
    await db.collection("users").doc(uid).delete();
};

// --- AUTH STATE LISTENER ---

// Force logout if URL has ?logout=true
if (window.location.search.includes('logout=true')) {
    window.firebaseAuth.signOut().then(function() {
        window.location.href = window.location.pathname; // Remove query param
    });
}

window.firebaseAuth.onAuthStateChanged(async function(user) {
    if (user) {
        try {
            await checkAndCreateUserProfile(user);
        } catch (e) {
            console.warn("Auth check failed:", e);
            window.AppState.user = null;
            renderApp();
            return;
        }
        
        // FIX: If user logged in before profileComplete existed, auto-complete their profile
        if (window.AppState.user && window.AppState.user.profileComplete === undefined) {
            window.AppState.user.profileComplete = true;
            window.AppState.user.avatarColor = window.AppState.user.avatarColor || 'red';
            var db = window.firebaseDb;
            try {
                await db.collection("users").doc(user.uid).update({
                    profileComplete: true,
                    avatarColor: window.AppState.user.avatarColor || 'red'
                });
            } catch(e) { console.warn('Profile update failed:', e); }
        }
        
        await window.loadStateFromFirestore();
        
        // Safety: If no access token exists locally, the account cannot be "linked" on this device yet
        const userCalendarToken = window.getGoogleCalendarToken(user);
        if (userCalendarToken) {
            window.AppState.isGoogleLinked = true;
            if (window.gapi?.client?.setToken) {
                window.gapi.client.setToken({ access_token: userCalendarToken });
            }
        } else {
            window.AppState.isGoogleLinked = false;
            window.saveState();
            if (window.gapi?.client?.setToken) {
                window.gapi.client.setToken(null);
            }
        }

        if (window.currentView === 'login') {
            const role = window.AppState.user.role;
            if (role === 'Guest') {
                window.currentView = 'schedule';
            } else {
                window.currentView = 'dashboard';
            }
        }

        // Live role sync listener
        window.firebaseDb.collection("users").doc(user.uid)
            .onSnapshot(function(doc) {
                if (doc.exists) {
                    var data = doc.data();
                    if (data.role !== window.AppState.user.role) {
                        console.log("🔄 Role updated to:", data.role);
                        window.AppState.user = data;
                        renderApp();
                    }
                }
            });

        // Live module sync listeners
        const moduleDocs = [
            { collection: "feedme_module", doc: "metadata" },
            { collection: "dong_zhuo_module", doc: "metadata" },
            { collection: "inventory_module", doc: "metadata" }
        ];

        moduleDocs.forEach(m => {
            window.firebaseDb.collection(m.collection).doc(m.doc)
                .onSnapshot(function(snapDoc) {
                    if (snapDoc.exists && !window.AppState.isCloudSyncing) {
                        var data = snapDoc.data();
                        const userEmail = (window.AppState.user?.email || '').toLowerCase();
                        if (data.updatedBy !== userEmail) {
                            window.loadStateFromFirestore().then(function() { 
                                renderApp(); 
                            });
                        }
                    }
                });
        });

        // Live Schedules sync listener
        window.firebaseDb.collection("schedules_v2")
            .onSnapshot(function(snap) {
                if (!window.AppState.isCloudSyncing) {
                    window.loadStateFromFirestore().then(function() { 
                        if (window.currentView === 'schedule') {
                            renderApp(); 
                            if (window.Pages && window.Pages.schedule && window.Pages.schedule.fetchEvents && window.AppState.isGoogleLinked) {
                                window.Pages.schedule.fetchEvents().catch(err => console.warn(err));
                            }
                        }
                    });
                }
            });
    } else {
        window.AppState.user = null;
    }
    renderApp();
});

// --- NAVIGATION & ROUTING ---

var NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', iconGif: 'assets/Dashboard.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech', 'Marketing'] },
  { id: 'reports', label: 'Report', iconGif: 'assets/NexData.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech', 'Marketing'] },
  { id: 'hub_activity', label: 'Performance', iconGif: 'assets/NexPerformance.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m4.93 10.93 2.83 2.83"/><path d="M2 18h20"/><path d="M12 18v-4"/><path d="m19.07 10.93-2.83 2.83"/><path d="M22 18A10 10 0 0 0 2 18"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech', 'Marketing'] },
  { id: 'schedule', label: 'Schedule', iconGif: 'assets/Schedule.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M15 15h2v2"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech', 'Guest'] },
  { id: 'invoices', label: 'Invoices', iconGif: 'assets/NexInvoice.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech'] },
  { 
    id: 'inventory_group', 
    label: 'Inventory', 
    iconGif: 'assets/NexInventory.gif', 
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>', 
    roles: ['SuperAdmin', 'Sales', 'Tech'],
    subItems: [
        { id: 'inventory', label: 'Hardware Hub' },
        { id: 'inventory_logs', label: 'Hub In/Out' },
        { id: 'inventory_activity', label: 'Activity Log' }
    ]
  },
  { id: 'customers', label: 'FeedMe', iconGif: 'assets/Feedmebot.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>', roles: ['SuperAdmin', 'Sales', 'Marketing', 'Guest'] },
  { id: 'dong_zhuo', label: '老总', iconGif: 'assets/icafe.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="m19 19-4-4v-3"/></svg>', roles: ['SuperAdmin', 'Sales'] },
  { id: 'agents', label: 'Sales Force', iconGif: 'assets/NexMinion.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech', 'Marketing'] },
  { id: 'catalog', label: 'Listing', iconGif: 'assets/ProductServices.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><circle cx="14" cy="13" r="3"/><path d="m16.12 15.12 2.83 2.83"/></svg>', roles: ['SuperAdmin', 'Sales', 'Marketing'] },
  { id: 'stocks_list', label: 'Stocks List', iconGif: 'assets/ProductServices.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>', roles: ['SuperAdmin', 'Sales', 'Marketing'] },
  { id: 'user_log', label: 'HRM', iconGif: 'assets/NexAI Fans.gif', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', roles: ['SuperAdmin'] }
];

function renderSidebar() {
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    var userRole = window.AppState.user?.role || 'Guest';

    window.toggleNavGroup = function(el) {
        el.classList.toggle('expanded');
        var chevron = el.querySelector('.chevron');
        if (chevron) chevron.style.transform = el.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0)';
        var subNav = el.nextElementSibling;
        if (subNav && subNav.classList.contains('sub-nav')) {
            subNav.classList.toggle('active');
        }
    };
    
    nav.innerHTML = NAV_ITEMS
        .filter(function(item) { return item.roles.includes(userRole); })
        .map(function(item) {
            var isGroupActive = item.id === window.currentView || (item.subItems && item.subItems.some(sub => sub.id === window.currentView));
            var filterStyle = item.id === 'customers' ? '' : 'filter: invert(1); mix-blend-mode: screen;';
            
            var html = '<div class="nav-group-container">';
            
            var clickHandler = item.subItems ? 'toggleNavGroup(this)' : 'navigateTo(\'' + item.id + '\')';
            var activeClass = isGroupActive && !item.subItems ? 'active' : '';
            var groupClass = item.subItems ? 'has-children ' + (isGroupActive ? 'expanded' : '') : '';
            
            html += '<div class="nav-item ' + activeClass + ' ' + groupClass + '" onclick="' + clickHandler + '" ' +
                    'onmouseenter="if(this.querySelector(\'.gif-icon\')) { this.querySelector(\'.gif-icon\').style.display=\'block\'; this.querySelector(\'.static-icon\').style.display=\'none\'; }" ' +
                    'onmouseleave="if(!this.classList.contains(\'active\') && this.querySelector(\'.gif-icon\')) { this.querySelector(\'.gif-icon\').style.display=\'none\'; this.querySelector(\'.static-icon\').style.display=\'block\'; }">' +
                '<span class="icon" style="width:28px; height:28px; display:flex; align-items:center; justify-content:center;">' +
                    '<canvas class="static-icon" data-src="' + item.iconGif + '" style="width:100%; height:100%; object-fit:contain; ' + filterStyle + ' display: ' + (activeClass ? 'none' : 'block') + ';"></canvas>' +
                    '<img class="gif-icon" src="' + item.iconGif + '" style="width:100%; height:100%; object-fit:contain; ' + filterStyle + ' display: ' + (activeClass ? 'block' : 'none') + ';" alt="">' +
                '</span>' +
                '<span class="text">' + item.label + '</span>' +
            '</div>';

            if (item.subItems) {
                html += '<div class="sub-nav ' + (isGroupActive ? 'active' : '') + '">';
                item.subItems.forEach(function(sub) {
                    var isSubActive = window.currentView === sub.id;
                    html += '<div class="nav-sub-item ' + (isSubActive ? 'active' : '') + '" onclick="navigateTo(\'' + sub.id + '\')">' + sub.label + '</div>';
                });
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        }).join('');
    
    // Pin Footer to the very bottom of the sidebar (outside the scrollable nav)
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        var footer = sidebar.querySelector('.sidebar-footer-pinned');
        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'sidebar-footer-pinned';
            sidebar.appendChild(footer);
        }
        
        if (userRole === 'SuperAdmin') {
            footer.innerHTML = `
                <div style="padding: 15px; border-top: 1px solid var(--border-color); background: var(--bg-sidebar);">
                  <div style="background: rgba(255, 77, 77, 0.05); border: 1.5px solid rgba(255, 77, 77, 0.3); border-radius: 12px; padding: 12px; display:flex; align-items:center; gap: 12px; cursor: pointer; transition: all 0.2s;" 
                       onclick="if(window.Pages.user_log) window.Pages.user_log.showResetOptionsModal()"
                       onmouseover="this.style.background='rgba(255, 77, 77, 0.1)'; this.style.borderColor='rgba(255, 77, 77, 0.5)';"
                       onmouseout="this.style.background='rgba(255, 77, 77, 0.05)'; this.style.borderColor='rgba(255, 77, 77, 0.3)';"
                       >
                    <div style="color: #ff4d4d; font-size: 1.2rem;">🗑️</div>
                    <span style="font-weight: 800; font-size: 0.85rem; color: #ff4d4d;">Reset Database</span>
                  </div>
                </div>
            `;
        } else {
            footer.innerHTML = '';
        }
    }
    
    // Safely draw the first frame of each GIF to the canvas for the static state
    nav.querySelectorAll('.static-icon').forEach(function(canvas) {
        var img = new Image();
        var draw = function() {
            // Use native image resolution for crispness
            canvas.width = img.naturalWidth || img.width || 200;
            canvas.height = img.naturalHeight || img.height || 200;
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.onload = draw;
        img.src = canvas.getAttribute('data-src');
        if (img.complete) draw();
    });
}

window.navigateTo = function(viewId) {
    var userRole = window.AppState.user?.role || 'Guest';
    var item = NAV_ITEMS.find(function(i) { return i.id === viewId; });
    
    if (item && !item.roles.includes(userRole)) {
        alert("Access Denied: You do not have permission to view this module.");
        return;
    }
    
    window.currentView = viewId;
    console.log("🚀 Navigating to:", viewId);
    renderApp();
};

function renderApp() {
    var sidebar = document.querySelector('.sidebar');
    var main = document.querySelector('.main-content');
    var portal = document.getElementById('modal-portal');
    var viewContainer = document.getElementById('app-view');
    var pageTitle = document.getElementById('page-title');
    var profile = document.querySelector('.user-profile');

    // --- STATE 1: Not logged in -> Show Login ---
    if (!window.AppState.user) {
        if (portal) {
            portal.innerHTML = window.Pages.login.render();
            window.Pages.login.afterRender();
        }
        if (sidebar) sidebar.style.display = 'none';
        if (main) main.style.display = 'none';
        return;
    }

    // --- STATE 2: Logged in but profile not complete -> Show Profile Setup ---
    if (!window.AppState.user.profileComplete) {
        if (portal && window.Pages.profile_setup) {
            portal.innerHTML = window.Pages.profile_setup.render();
            window.Pages.profile_setup.afterRender();
        }
        if (sidebar) sidebar.style.display = 'none';
        if (main) main.style.display = 'none';
        return;
    }

    if (portal) portal.innerHTML = '';
    if (sidebar) sidebar.style.display = 'flex';
    if (main) main.style.display = 'flex';

    // RBAC Safety: Ensure currentView is allowed for the user's role
    var userRole = window.AppState.user?.role || 'Guest';
    var navItem = NAV_ITEMS.find(function(i) { return i.id === window.currentView; });
    if (navItem && !navItem.roles.includes(userRole)) {
        console.warn("🚫 Unauthorized access attempt to", window.currentView, "for role", userRole);
        window.currentView = userRole === 'Guest' ? 'schedule' : 'dashboard';
        // Recursively call renderApp to show the allowed page
        renderApp();
        return;
    }

    renderSidebar();
    
    // Render top-right profile area
    if (profile) {
        var u = window.AppState.user;
        var avatarSvg = window.AmongUsAvatar ? window.AmongUsAvatar.getSvg(u.avatarColor || 'red', 44) : '👤';
        var roleColors = { SuperAdmin: '#EF4444', Sales: '#10B981', Tech: '#00B4FF', Marketing: '#9333EA', Guest: '#9CA3AF' };
        var roleDisplayNames = { SuperAdmin: 'The Ruler', Sales: 'The Hunter', Tech: 'The Engineer', Marketing: 'The Artisan', Guest: 'The Nomad' };
        var roleColor = roleColors[u.role] || '#9CA3AF';
        var displayRole = roleDisplayNames[u.role] || u.role;
        
        profile.innerHTML = 
            '<div id="profile-area" onclick="toggleProfileMenu()" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:6px 14px; border-radius:12px; transition:all 0.2s; border:1px solid transparent; position:relative;">' +
                '<div style="width:44px; height:44px; display:flex; align-items:center; justify-content:center; filter:drop-shadow(0 0 8px rgba(242,89,0,0.4));">' + avatarSvg + '</div>' +
                '<div style="display:flex; flex-direction:column; text-align:left;">' +
                    '<span style="font-weight:800; font-size:1.25rem; color:#fffb00; text-shadow: 0 0 8px #fffb00, 0 0 15px rgba(255,251,0,0.5); letter-spacing: 0.03em;">' + u.displayName + '</span>' +
                    '<span style="font-size:0.65rem; color:' + roleColor + '; font-weight:900; text-transform:uppercase; letter-spacing:0.1em; line-height: 1; margin-top: 2px;">' + displayRole + '</span>' +
                '</div>' +
                
                '<div id="profile-dropdown" style="display:none; position:absolute; top:calc(100% + 8px); right:0; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:16px; width:220px; padding:8px; box-shadow:0 15px 40px rgba(0,0,0,0.5); z-index:1000;">' +
                    '<div style="padding:12px 14px; display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--border-color); margin-bottom:6px;">' +
                        '<div style="width:32px; height:32px; display:flex; align-items:center; justify-content:center;">' + (window.AmongUsAvatar ? window.AmongUsAvatar.getSvg(u.avatarColor || 'red', 32) : '👤') + '</div>' +
                        '<div>' +
                            '<div style="font-size:0.85rem; font-weight:700; color:var(--text-main);">' + u.displayName + '</div>' +
                            '<div style="font-size:0.65rem; color:var(--text-muted);">' + u.email + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div onclick="event.stopPropagation(); openProfileEdit();" style="padding:10px 14px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:10px; color:var(--text-main); font-size:0.85rem; font-weight:600;" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'transparent\'">' +
                        '<span>✏️</span> Edit Profile' +
                    '</div>' +
                    '<div onclick="event.stopPropagation(); handleLogout();" style="padding:10px 14px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:10px; color:#EF4444; font-size:0.85rem; font-weight:600;" onmouseover="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseout="this.style.background=\'transparent\'">' +
                        '<span>🚪</span> Logout' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    try {
        var page = window.Pages[window.currentView];
        if (page) {
            if (page.init && !page._inited) {
                page.init();
                page._inited = true;
            }
            var navItem = NAV_ITEMS.find(function(i) { return i.id === window.currentView; });
            if (pageTitle) pageTitle.textContent = navItem ? navItem.label : 'Dashboard';
            if (viewContainer) viewContainer.innerHTML = page.render();
            if (page.afterRender) page.afterRender();
        }
    } catch (e) {
        console.error("🚨 Render Error in " + window.currentView + ":", e);
        if (viewContainer) viewContainer.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><h3>Module Load Error</h3><p>' + e.message + '</p></div>';
    }
}

window.Utils = {
    debounce: function(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },
    hexToRgb: function(hex) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h.split('').map(x => x + x).join('');
        return parseInt(h.substring(0, 2), 16) + ',' +
               parseInt(h.substring(2, 4), 16) + ',' +
               parseInt(h.substring(4, 6), 16);
    },
    renderHoverGif: function(gifName, size, svgFallback) {
        // Replace with direct image to avoid freeze loops, or fallback SVG if preferred.
        return '<img src="assets/' + gifName + '" style="width:' + size + 'px; height:' + size + 'px; object-fit:contain; filter: invert(1); mix-blend-mode: screen;" alt="" />';
    },
    initHoverGifs: function() {
        // Disabled complex hover logic to completely prevent browser hanging.
    }
};

// Global Re-render listener
window.addEventListener('re-render-view', function(e) {
    window.currentView = e.detail;
    renderApp();
});

// Start the app
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 NexAI Hub: App Loaded");
    renderApp();
});
