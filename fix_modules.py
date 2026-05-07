import os
import re

base_dir = r"c:\Users\leeho\.gemini\antigravity\scratch\business_app"
pages_dir = os.path.join(base_dir, "js", "pages")

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# 1. READ ALL CURRENT FILES
inventory_js = read_file(os.path.join(pages_dir, "inventory.js"))
inventory_logs_js = read_file(os.path.join(pages_dir, "inventory_logs.js")) # This is Hub In/Out
inventory_services_js = read_file(os.path.join(pages_dir, "inventory_services.js")) # This is Listing
catalog_js = read_file(os.path.join(pages_dir, "catalog.js")) # This is Performance Analysis
hub_activity_js = read_file(os.path.join(pages_dir, "hub_activity.js")) # This is Activity Log

# 2. FIX CATALOG.JS (LISTING)
new_catalog = inventory_services_js.replace("window.Pages.inventory_services", "window.Pages.catalog")
new_catalog = new_catalog.replace("'inventory_services'", "'catalog'")
write_file(os.path.join(pages_dir, "catalog.js"), new_catalog)

# 3. FIX HUB_ACTIVITY.JS (PERFORMANCE ANALYSIS)
new_hub_activity = catalog_js.replace("window.Pages.catalog", "window.Pages.hub_activity")
new_hub_activity = new_hub_activity.replace("'catalog'", "'hub_activity'")
write_file(os.path.join(pages_dir, "hub_activity.js"), new_hub_activity)

# 4. CREATE INVENTORY_ACTIVITY.JS (ACTIVITY LOG)
new_inventory_activity = hub_activity_js.replace("window.Pages.hub_activity", "window.Pages.inventory_activity")
new_inventory_activity = new_inventory_activity.replace("'hub_activity'", "'inventory_activity'")
write_file(os.path.join(pages_dir, "inventory_activity.js"), new_inventory_activity)

# 5. FIX INVENTORY.JS (MAKE IT A TAB CONTAINER)
inventory_hardware_code = inventory_js.replace("window.Pages.inventory = {", "window.Pages.inventory_hardware = {")
inventory_hardware_code = inventory_hardware_code.replace("'inventory'", "'inventory_hardware'")

new_inventory_js = f"""// js/pages/inventory.js
window.Pages = window.Pages || {{}};

{inventory_hardware_code}

window.Pages.inventory = {{
  activeTab: 'hardware',
  
  render: function() {{
    const tabsHtml = `
      <div style="display:flex; gap:12px; margin-bottom: 24px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; position: sticky; top: 0; background: var(--bg-main); z-index: 100;">
        <button class="inv-tab-btn ${{this.activeTab === 'hardware' ? 'active' : ''}}" data-tab="hardware" style="padding: 10px 20px; border-radius: 12px; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; background: ${{this.activeTab === 'hardware' ? 'rgba(242, 89, 0, 0.1)' : 'transparent'}}; color: ${{this.activeTab === 'hardware' ? 'var(--primary)' : 'var(--text-muted)'}};">Hardware Hub</button>
        <button class="inv-tab-btn ${{this.activeTab === 'logs' ? 'active' : ''}}" data-tab="logs" style="padding: 10px 20px; border-radius: 12px; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; background: ${{this.activeTab === 'logs' ? 'rgba(242, 89, 0, 0.1)' : 'transparent'}}; color: ${{this.activeTab === 'logs' ? 'var(--primary)' : 'var(--text-muted)'}};">Hub In/Out</button>
        <button class="inv-tab-btn ${{this.activeTab === 'activity' ? 'active' : ''}}" data-tab="activity" style="padding: 10px 20px; border-radius: 12px; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; background: ${{this.activeTab === 'activity' ? 'rgba(242, 89, 0, 0.1)' : 'transparent'}}; color: ${{this.activeTab === 'activity' ? 'var(--primary)' : 'var(--text-muted)'}};">Activity Log</button>
      </div>
    `;
    
    let contentHtml = '';
    if (this.activeTab === 'hardware') contentHtml = window.Pages.inventory_hardware.render();
    else if (this.activeTab === 'logs') contentHtml = window.Pages.inventory_logs.render();
    else if (this.activeTab === 'activity') contentHtml = window.Pages.inventory_activity.render();
    
    return tabsHtml + `<div id="inv-tab-content" style="animation: fadeIn 0.3s ease;">${{contentHtml}}</div>`;
  }},
  
  afterRender: function() {{
    document.querySelectorAll('.inv-tab-btn').forEach(btn => {{
      btn.onclick = (e) => {{
        this.activeTab = e.target.dataset.tab;
        window.dispatchEvent(new CustomEvent('re-render-view', {{ detail: 'inventory' }}));
      }}
    }});

    if (this.activeTab === 'hardware') window.Pages.inventory_hardware.afterRender();
    else if (this.activeTab === 'logs') window.Pages.inventory_logs.afterRender();
    else if (this.activeTab === 'activity') window.Pages.inventory_activity.afterRender();
  }}
}};
"""
write_file(os.path.join(pages_dir, "inventory.js"), new_inventory_js)

# 6. FIX APP.JS SVGs
app_js = read_file(os.path.join(base_dir, "js", "app.js"))

nav_items_replacement = """var NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech', 'Marketing', 'Guest'] },
  { id: 'reports', label: 'Report', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech', 'Marketing'] },
  { id: 'hub_activity', label: 'Performance', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m4.93 10.93 2.83 2.83"/><path d="M2 18h20"/><path d="M12 18v-4"/><path d="m19.07 10.93-2.83 2.83"/><path d="M22 18A10 10 0 0 0 2 18"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech', 'Marketing'] },
  { id: 'schedule', label: 'Schedule', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M15 15h2v2"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech'] },
  { id: 'invoices', label: 'Invoices', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech'] },
  { id: 'inventory', label: 'Inventory', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech'] },
  { id: 'customers', label: 'FeedMe', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>', roles: ['SuperAdmin', 'Sales', 'Marketing'] },
  { id: 'dong_zhuo', label: '老本', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="m19 19-4-4v-3"/></svg>', roles: ['SuperAdmin', 'Sales'] },
  { id: 'agents', label: 'Sales Force', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', roles: ['SuperAdmin', 'Sales', 'Tech', 'Marketing'] },
  { id: 'catalog', label: 'Listing', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><circle cx="14" cy="13" r="3"/><path d="m16.12 15.12 2.83 2.83"/></svg>', roles: ['SuperAdmin', 'Sales', 'Marketing'] },
  { id: 'user_log', label: 'User Log', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', roles: ['SuperAdmin'] }
];"""

old_nav_items_regex = r"var NAV_ITEMS = \[.*?\];"
app_js = re.sub(old_nav_items_regex, nav_items_replacement, app_js, flags=re.DOTALL)

app_js = app_js.replace("""'<span class="icon"><img src="' + item.icon + '" style="width: 22px; height: 22px; object-fit: contain; filter: invert(1); mix-blend-mode: screen;" alt=""></span>' +""", """'<span class="icon" style="display:flex; align-items:center; justify-content:center;">' + item.icon + '</span>' +""")

write_file(os.path.join(base_dir, "js", "app.js"), app_js)

# 7. UPDATE INDEX.HTML TO LOAD INVENTORY_ACTIVITY.JS
index_html = read_file(os.path.join(base_dir, "index.html"))
# Replace inventory_services.js with inventory_activity.js
index_html = index_html.replace('<script src="js/pages/inventory_services.js"></script>', '<script src="js/pages/inventory_activity.js"></script>')
write_file(os.path.join(base_dir, "index.html"), index_html)

print("All modules and UI fixed successfully.")
