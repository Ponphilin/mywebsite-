/* app.js - mockup multi-role leave system with notifications and multi-step approvals
   Storage:
   - KEY_USERS: array of users {username,password,roles:[...],dept,mentor,supervisor}
   - KEY_LEAVES: array of leave records
   Session:
   - sessionStorage 'ls_user' stores current user object
*/

// Keys
const KEY_USERS = 'ls_users_multi';
const KEY_LEAVES = 'ls_leaves_multi';

// Seed sample users (run once)
function seedData(){
  if(!localStorage.getItem(KEY_USERS)){
    const users = [
      {username:'alice', password:'pass', roles:['employee'], dept:'HR', supervisor:'sup_hr'},
      {username:'bob', password:'pass', roles:['employee','intern'], dept:'IT', mentor:'mentor_lee', supervisor:'sup_it'},
      {username:'carl', password:'pass', roles:['employee','contract'], dept:'Maintenance', supervisor:'sup_maint'},
      {username:'mentor_lee', password:'pass', roles:['mentor','employee'], dept:'IT'},
      {username:'sup_it', password:'pass', roles:['supervisor','employee'], dept:'IT'},
      {username:'sup_hr', password:'pass', roles:['supervisor','employee'], dept:'HR'},
      {username:'admin', password:'pass', roles:['admin']}
    ];
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  }
  if(!localStorage.getItem(KEY_LEAVES)) localStorage.setItem(KEY_LEAVES, JSON.stringify([]));
}

// Auth helpers
function setCurrentUser(u){ sessionStorage.setItem('ls_user', JSON.stringify(u)); }
function getCurrentUser(){ return JSON.parse(sessionStorage.getItem('ls_user') || 'null'); }
function logout(){
  sessionStorage.removeItem('ls_user');
  location.href = 'index.html';
}

// Register (simple)
function registerSubmit(evt){
  evt && evt.preventDefault();
  const u = document.getElementById('reg_username').value.trim();
  const p = document.getElementById('reg_password').value.trim();
  const roles = Array.from(document.getElementById('reg_roles').selectedOptions).map(o=>o.value);
  const dept = document.getElementById('reg_dept')?.value.trim() || '';
  if(!u||!p||roles.length===0){ alert('กรอกข้อมูลให้ครบ'); return; }
  const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  if(users.find(x=>x.username===u)){ alert('มีผู้ใช้นี้แล้ว'); return; }
  users.push({username:u, password:p, roles, dept});
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
  alert('สมัครเรียบร้อย ล็อกอินได้เลย');
  location.href = 'index.html';
}

// Login
function loginSubmit(evt){
  evt && evt.preventDefault();
  const u = document.getElementById('login_username').value.trim();
  const p = document.getElementById('login_password').value.trim();
  const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  const user = users.find(x=>x.username===u && x.password===p);
  if(!user){ alert('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); return; }
  setCurrentUser(user);
  // choose landing page: if admin -> admin_dashboard, else if has supervisor -> supervisor page? We'll show dashboard menu
  // land to unified "menu" page based on predominant role: admin > supervisor > mentor > employee
  if(user.roles.includes('admin')) location.href='admin-dashboard.html';
  else if(user.roles.includes('supervisor')) location.href='supervisor-dashboard.html';
  else if(user.roles.includes('mentor')) location.href='mentor-dashboard.html';
  else location.href='user-dashboard.html';
}

// Submit leave
function leaveSubmit(evt){
  evt && evt.preventDefault();
  const user = getCurrentUser(); if(!user){ alert('กรุณาล็อกอิน'); location.href='index.html'; return; }
  const category = document.getElementById('leave_category').value;
  const start = document.getElementById('start_date').value;
  const end = document.getElementById('end_date').value;
  const reason = document.getElementById('reason').value.trim();
  if(!start||!end){ alert('เลือกวันที่ให้ถูกต้อง'); return; }
  const days = Math.floor((new Date(end) - new Date(start))/(1000*60*60*24)) + 1;
  // build approvalSteps dynamically:
  // intern -> mentor -> supervisor -> admin
  // others -> supervisor -> admin
  let steps = [];
  if(user.roles.includes('intern')){
    steps.push({role:'mentor', actorUsername: getMentorForUser(user.username) || null, status:'pending', note:''});
  } else {
    steps.push({role:'mentor', actorUsername:null, status:'skipped', note:''});
  }
  steps.push({role:'supervisor', actorUsername: user.supervisor || null, status:'pending', note:''});
  steps.push({role:'admin', actorUsername:null, status:'pending', note:''});
  const leaves = JSON.parse(localStorage.getItem(KEY_LEAVES) || '[]');
  const rec = {
    id: Date.now(),
    username: user.username,
    roles: user.roles,
    dept: user.dept || '',
    category, start, end, days, reason,
    approvalSteps: steps,
    created_at: new Date().toISOString()
  };
  leaves.push(rec);
  localStorage.setItem(KEY_LEAVES, JSON.stringify(leaves));
  // notify - notifications are dynamic (count shown on dashboards)
  alert('ส่งคำขอเรียบร้อยแล้ว (ระบบจะแจ้งเตือนไปยังผู้อนุมัติที่เกี่ยวข้อง)');
  location.href = 'user-dashboard.html';
}

// Helper: find mentor username for a user (from users list)
function getMentorForUser(username){
  const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  // if user has "mentor" relation saved (for simplicity in seed), return that; else find any mentor in same dept
  const u = users.find(x=>x.username===username);
  if(u && u.mentor) return u.mentor;
  if(u && u.dept){
    const mentor = users.find(x=>x.roles && x.roles.includes('mentor') && x.dept===u.dept);
    return mentor? mentor.username : null;
  }
  return null;
}

// Utilities
function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function getLeaves(){ return JSON.parse(localStorage.getItem(KEY_LEAVES) || '[]'); }
function saveLeaves(arr){ localStorage.setItem(KEY_LEAVES, JSON.stringify(arr)); }

// Status display
function computeStatus(rec){
  // if any approval is 'rejected' => "ไม่อนุมัติ"
  if(rec.approvalSteps.some(s=>s.status==='rejected')) return 'ไม่อนุมัติ';
  // if all required steps are approved or skipped => 'อนุมัติ'
  if(rec.approvalSteps.every(s => s.status==='approved' || s.status==='skipped')) return 'อนุมัติ';
  return 'รออนุมัติ';
}
function statusClassText(rec){
  const st = computeStatus(rec);
  if(st==='อนุมัติ') return 'status-approved';
  if(st==='ไม่อนุมัติ') return 'status-rejected';
  return 'status-pending';
}

// Render helpers for headers (show current user)
function renderHeader(elId){
  const el = document.getElementById(elId);
  if(!el) return;
  const u = getCurrentUser();
  if(!u){ el.innerHTML = `<a href="index.html">Login</a>`; return; }
  el.innerHTML = `<span class="badge">${escapeHtml(u.username)} (${u.roles.join(',')})</span> <a href="#" onclick="logout()" class="small">Logout</a>`;
}

// Render user dashboard header + notifications link
function renderUserDashboard(){
  renderHeader('hdr_user');
  // no extra notifications for normal users; show quick links
}

// Render my leave history
function renderMyLeaves(){
  renderHeader('hdr_user');
  const u = getCurrentUser(); if(!u) return;
  document.getElementById('my_user').textContent = `${u.username} (${u.roles.join(',')})`;
  const rowsEl = document.getElementById('my_table');
  const leaves = getLeaves().filter(l=>l.username===u.username).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  rowsEl.innerHTML = '';
  if(leaves.length===0){ rowsEl.innerHTML = `<tr><td colspan="8">ยังไม่มีรายการ</td></tr>`; return; }
  // compute sequence number and totals
  leaves.forEach((l, idx)=>{
    const st = computeStatus(l);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${idx+1}</td><td>${escapeHtml(l.start)}</td><td>${escapeHtml(l.end)}</td><td>${l.days}</td><td>${escapeHtml(l.category)}</td><td>${escapeHtml(l.reason)}</td><td class="${statusClassText(l)}">${st}</td><td>${escapeHtml(l.approvalSteps.map(s=>s.role+':'+s.status).join(', '))}</td>`;
    rowsEl.appendChild(tr);
  });
  // summary
  const approvedLeaves = leaves.filter(l=>computeStatus(l)==='อนุมัติ');
  const totalDays = approvedLeaves.reduce((a,b)=>a+(b.days||0),0);
  document.getElementById('summary_count').textContent = leaves.length;
  document.getElementById('summary_days').textContent = totalDays;
}

// Render supervisor dashboard: show requests for same dept
function renderSupervisor(){
  renderHeader('hdr_user');
  const u = getCurrentUser(); if(!u || !u.roles.includes('supervisor')){ alert('ต้องล็อกอินด้วยหัวหน้าส่วน'); location.href='index.html'; return; }
  const leaves = getLeaves().filter(l=>l.dept === u.dept).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const tbody = document.getElementById('sup_table'); tbody.innerHTML='';
  if(leaves.length===0){ tbody.innerHTML = `<tr><td colspan="8">ไม่มีคำขอจากหน่วยงานนี้</td></tr>`; return; }
  leaves.forEach(l=>{
    const st = computeStatus(l);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(l.username)}</td><td>${escapeHtml(l.role||'')}</td><td>${escapeHtml(l.start)} ถึง ${escapeHtml(l.end)}</td><td>${l.days}</td><td>${escapeHtml(l.category)}</td><td>${escapeHtml(l.reason)}</td><td class="${statusClassText(l)}">${st}</td>
      <td>
        <button onclick="openApprove(${l.id})">รายละเอียด</button>
        <button onclick="supervisorApprove(${l.id})">✔</button>
        <button onclick="supervisorReject(${l.id})">✖</button>
      </td>`;
    tbody.appendChild(tr);
  });
  // notification count
  const pendingCount = leaves.filter(l => l.approvalSteps.some(s=>s.role==='supervisor' && s.status==='pending')).length;
  const notifEl = document.getElementById('sup_notif'); if(notifEl) notifEl.textContent = `แจ้งเตือนใหม่: ${pendingCount}`;
}

// Supervisor approve/reject functions
function supervisorApprove(id){
  const leaves = getLeaves();
  const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].approvalSteps = leaves[idx].approvalSteps.map(s => s.role==='supervisor' ? {...s, status:'approved'} : s);
  saveLeaves(leaves);
  alert('อนุมัติโดยหัวหน้าแล้ว');
  renderSupervisor();
}
function supervisorReject(id){
  const leaves = getLeaves();
  const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].approvalSteps = leaves[idx].approvalSteps.map(s => s.role==='supervisor' ? {...s, status:'rejected'} : s);
  saveLeaves(leaves);
  alert('ปฏิเสธโดยหัวหน้าแล้ว');
  renderSupervisor();
}

// Render mentor dashboard: show interns assigned to this mentor
function renderMentor(){
  renderHeader('hdr_user');
  const u = getCurrentUser(); if(!u || !u.roles.includes('mentor')){ alert('ต้องล็อกอินด้วยพี่เลี้ยง'); location.href='index.html'; return; }
  const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  const interns = users.filter(x=>x.roles && x.roles.includes('intern') && (x.mentor===u.username || x.dept===u.dept)).map(x=>x.username);
  const leaves = getLeaves().filter(l=>interns.includes(l.username)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const tbody = document.getElementById('mentor_table'); tbody.innerHTML='';
  if(leaves.length===0){ tbody.innerHTML = `<tr><td colspan="7">ไม่มีคำขอสำหรับคุณ</td></tr>`; return; }
  leaves.forEach(l=>{
    const st = computeStatus(l);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(l.username)}</td><td>${escapeHtml(l.start)} ถึง ${escapeHtml(l.end)}</td><td>${l.days}</td><td>${escapeHtml(l.category)}</td><td>${escapeHtml(l.reason)}</td><td class="${statusClassText(l)}">${st}</td>
      <td><button onclick="openApprove(${l.id})">รายละเอียด</button> <button onclick="mentorApprove(${l.id})">✔</button> <button onclick="mentorReject(${l.id})">✖</button></td>`;
    tbody.appendChild(tr);
  });
  const pending = leaves.filter(l=>l.approvalSteps.some(s=>s.role==='mentor' && s.status==='pending')).length;
  const notifEl = document.getElementById('mentor_notif'); if(notifEl) notifEl.textContent = `แจ้งเตือนใหม่: ${pending}`;
}
function mentorApprove(id){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].approvalSteps = leaves[idx].approvalSteps.map(s => s.role==='mentor' ? {...s, status:'approved'} : s);
  saveLeaves(leaves); alert('อนุมัติโดยพี่เลี้ยงแล้ว'); renderMentor();
}
function mentorReject(id){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].approvalSteps = leaves[idx].approvalSteps.map(s => s.role==='mentor' ? {...s, status:'rejected'} : s);
  saveLeaves(leaves); alert('พี่เลี้ยงปฏิเสธคำขอ'); renderMentor();
}

// Admin: view all, final confirm
function renderAdmin(){
  renderHeader('hdr_user');
  const leaves = getLeaves().sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const tbody = document.getElementById('admin_table'); tbody.innerHTML='';
  if(leaves.length===0){ tbody.innerHTML = `<tr><td colspan="9">ยังไม่มีคำขอ</td></tr>`; return; }
  leaves.forEach(l=>{
    const st = computeStatus(l);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(l.username)}</td><td>${escapeHtml(l.dept)}</td><td>${escapeHtml(l.start)} ถึง ${escapeHtml(l.end)}</td><td>${l.days}</td><td>${escapeHtml(l.category)}</td><td>${escapeHtml(l.reason)}</td><td class="${statusClassText(l)}">${st}</td><td>${escapeHtml(l.approvalSteps.map(s=>s.role+':'+s.status).join('; '))}</td><td><button onclick="openApprove(${l.id})">รายละเอียด</button> <button onclick="adminConfirm(${l.id})">Confirm</button></td>`;
    tbody.appendChild(tr);
  });
  renderAdminStats();
}
function adminConfirm(id){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  const rec = leaves[idx];
  // validate previous approvals
  const mentorStep = rec.approvalSteps.find(s=>s.role==='mentor');
  const supStep = rec.approvalSteps.find(s=>s.role==='supervisor');
  if(mentorStep && mentorStep.status==='pending'){ alert('รอการอนุมัติจากพี่เลี้ยง'); return; }
  if(supStep && supStep.status!=='approved'){ alert('รอการอนุมัติจากหัวหน้า'); return; }
  // set admin approved
  rec.approvalSteps = rec.approvalSteps.map(s=> s.role==='admin' ? {...s, status:'approved'} : s);
  saveLeaves(leaves);
  alert('ยืนยันโดยแอดมินแล้ว (อนุมัติเรียบร้อย)');
  renderAdmin();
}

// Admin stats: total requests, per-role counts, top leave-days per user
function renderAdminStats(){
  const leaves = getLeaves();
  document.getElementById('stat_total').textContent = leaves.length;
  const counts = leaves.reduce((acc,l)=>{ acc[l.category] = (acc[l.category]||0)+1; return acc; },{});
  // per-role counts (requests submitted by role)
  const byRole = leaves.reduce((acc,l)=>{ const r = (l.roles && l.roles[0]) || 'user'; acc[r]=(acc[r]||0)+1; return acc; },{});
  document.getElementById('stat_by_role').innerText = JSON.stringify(byRole);
  // total approved days per user
  const totals = {};
  leaves.forEach(l=>{
    if(computeStatus(l)==='อนุมัติ'){ totals[l.username] = (totals[l.username]||0) + (l.days||0); }
  });
  const el = document.getElementById('top_days'); el.innerHTML = '';
  if(Object.keys(totals).length===0) el.innerHTML = '<div class="small">ยังไม่มีการลาอนุมัติ</div>';
  else {
    Object.entries(totals).sort((a,b)=>b[1]-a[1]).forEach(([u,d])=>{
      el.innerHTML += `<div>${escapeHtml(u)}: ${d} วัน</div>`;
    });
  }
}

// Approve detail page opener: opens approve.html with query ?id=...
function openApprove(id){
  location.href = `approve.html?id=${id}`;
}

// Approve page render
function renderApprovePage(){
  renderHeader('hdr_user');
  const params = new URLSearchParams(location.search);
  const id = Number(params.get('id'));
  if(!id){ document.getElementById('approve_body').innerHTML = '<div>ไม่พบคำขอ</div>'; return; }
  const leaves = getLeaves();
  const rec = leaves.find(x=>x.id===id);
  if(!rec){ document.getElementById('approve_body').innerHTML = '<div>ไม่พบคำขอ</div>'; return; }
  // show details
  const html = `
    <h3>คำขอของ: ${escapeHtml(rec.username)}</h3>
    <div>ประเภท: ${escapeHtml(rec.category)}</div>
    <div>วันที่: ${escapeHtml(rec.start)} ถึง ${escapeHtml(rec.end)} (${rec.days} วัน)</div>
    <div>เหตุผล: ${escapeHtml(rec.reason)}</div>
    <h4>สถานะการอนุมัติ</h4>
    <ul>
      ${rec.approvalSteps.map(s=>`<li>${s.role}: ${s.status}${s.actorUsername ? ' ('+s.actorUsername+')' : ''}</li>`).join('')}
    </ul>
  `;
  document.getElementById('approve_body').innerHTML = html;
  // show action buttons if current user has role and the step is pending
  const cur = getCurrentUser();
  if(!cur) return;
  // find step that current user can act on
  const myRoles = cur.roles || [];
  let actionHtml = '';
  rec.approvalSteps.forEach(step=>{
    if(step.status === 'pending' && myRoles.includes(step.role)){
      // allow approve/reject
      actionHtml += `<div class="controls"><button onclick="doApprove(${rec.id},'${step.role}')">Approve (${step.role})</button><button onclick="doReject(${rec.id},'${step.role}')">Reject (${step.role})</button></div>`;
    }
  });
  document.getElementById('approve_actions').innerHTML = actionHtml || '<div class="small">ไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้</div>';
}

// perform approve/reject on approve.html
function doApprove(id, role){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].approvalSteps = leaves[idx].approvalSteps.map(s => s.role===role ? {...s, status:'approved'} : s);
  saveLeaves(leaves); alert(`อนุมัติ ${role} เรียบร้อย`); renderApprovePage();
}
function doReject(id, role){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].approvalSteps = leaves[idx].approvalSteps.map(s => s.role===role ? {...s, status:'rejected'} : s);
  saveLeaves(leaves); alert(`ปฏิเสธ ${role}`); renderApprovePage();
}

// search helper for admin
function adminSearch(evt){
  evt && evt.preventDefault();
  const kw = document.getElementById('admin_search').value.trim().toLowerCase();
  const leaves = getLeaves().filter(l=>l.username.toLowerCase().includes(kw));
  const tbody = document.getElementById('admin_table'); tbody.innerHTML = '';
  if(leaves.length===0){ tbody.innerHTML = '<tr><td colspan="9">ไม่พบผล</td></tr>'; return; }
  leaves.forEach(l=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(l.username)}</td><td>${escapeHtml(l.dept)}</td><td>${escapeHtml(l.start)} ถึง ${escapeHtml(l.end)}</td><td>${l.days}</td><td>${escapeHtml(l.category)}</td><td>${escapeHtml(l.reason)}</td><td class="${statusClassText(l)}">${computeStatus(l)}</td><td>${escapeHtml(l.approvalSteps.map(s=>s.role+':'+s.status).join('; '))}</td><td><button onclick="openApprove(${l.id})">รายละเอียด</button></td>`;
    tbody.appendChild(tr);
  });
}

// Init seed on load
document.addEventListener('DOMContentLoaded', seedData);
