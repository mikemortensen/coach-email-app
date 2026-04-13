// ============================================================
// STATE
// ============================================================
let teams = [];
let currentSchedule = {};
let currentReminders = []; // { text, isDefault, checked }
let homeworkItems = []; // array of strings

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setDefaultWeek();
  loadTeams();
  setupEmailForm();
  setupTeamForm();
  setupPlayerTeamSelect();
  setupPlayerForm();
  setupScheduleListeners();
  setupReminderInputs();
});

// ============================================================
// NAVIGATION
// ============================================================
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ============================================================
// UTILITY
// ============================================================
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

async function api(url, options = {}) {
  if (options.body && typeof options.body === 'object') {
    options.headers = { 'Content-Type': 'application/json', ...options.headers };
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function getSunday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

function setDefaultWeek() {
  const today = new Date();
  const sunday = getSunday(today.toISOString().split('T')[0]);
  document.getElementById('email-week').value = sunday;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Parse various date formats into YYYY-MM-DD
function parseDateInput(raw) {
  if (!raw) return '';
  raw = raw.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // MM/DD/YYYY or MM-DD-YYYY
  const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }
  return '';
}

// Convert YYYY-MM-DD to MM/DD/YYYY for display
function dateToDisplay(dateStr) {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return dateStr;
}

// ============================================================
// TEAMS
// ============================================================
async function loadTeams() {
  try {
    teams = await api('/api/teams');
    renderTeamsList();
    populateTeamDropdowns();
  } catch (err) {
    console.error('Failed to load teams:', err);
  }
}

function populateTeamDropdowns() {
  const selects = [
    document.getElementById('email-team'),
    document.getElementById('player-team-select')
  ];

  selects.forEach(sel => {
    const currentVal = sel.value;
    // Keep the first option
    while (sel.options.length > 1) sel.remove(1);
    teams.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
    // Restore selection if it still exists
    if (currentVal) sel.value = currentVal;
  });
}

function renderTeamsList() {
  const container = document.getElementById('teams-list');
  if (teams.length === 0) {
    container.innerHTML = '<p class="empty-state">No teams yet. Add one above!</p>';
    return;
  }

  container.innerHTML = teams.map(t => `
    <div class="item-row">
      <div class="item-info">
        <div class="item-name">${escHtml(t.name)}</div>
        <div class="item-detail">Coach ${escHtml(t.coach_name)} &mdash; ${escHtml(t.motto)}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-edit" onclick="editTeam(${t.id})">Edit</button>
        <button class="btn btn-danger" onclick="deleteTeam(${t.id}, '${escHtml(t.name)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function setupTeamForm() {
  document.getElementById('team-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('team-edit-id').value;
    const payload = {
      name: document.getElementById('team-name').value.trim(),
      coach_name: document.getElementById('coach-name').value.trim(),
      ical_url: document.getElementById('ical-url').value.trim(),
      motto: document.getElementById('team-motto').value.trim() || 'Bravery. Resilience. Excellence.',
      salutation: document.getElementById('team-salutation').value.trim(),
      phone: document.getElementById('coach-phone').value.trim(),
      email: document.getElementById('coach-email').value.trim(),
      training_jersey: document.getElementById('training-jersey').value.trim(),
      home_jersey: document.getElementById('home-jersey').value.trim(),
      away_jersey: document.getElementById('away-jersey').value.trim(),
      show_end_time: document.getElementById('show-end-time').checked ? 1 : 0
    };

    try {
      if (editId) {
        await api(`/api/teams/${editId}`, { method: 'PUT', body: payload });
        showToast('Team updated!');
      } else {
        await api('/api/teams', { method: 'POST', body: payload });
        showToast('Team added!');
      }
      cancelTeamEdit();
      loadTeams();
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  });
}

function editTeam(id) {
  const team = teams.find(t => t.id === id);
  if (!team) return;
  document.getElementById('team-edit-id').value = team.id;
  document.getElementById('team-name').value = team.name;
  document.getElementById('coach-name').value = team.coach_name;
  document.getElementById('ical-url').value = team.ical_url || '';
  document.getElementById('team-motto').value = team.motto;
  document.getElementById('team-salutation').value = team.salutation != null ? team.salutation : 'See you all soon!';
  document.getElementById('coach-phone').value = team.phone || '';
  document.getElementById('coach-email').value = team.email || '';
  document.getElementById('training-jersey').value = team.training_jersey || '';
  document.getElementById('home-jersey').value = team.home_jersey || '';
  document.getElementById('away-jersey').value = team.away_jersey || '';
  document.getElementById('show-end-time').checked = team.show_end_time !== 0;
  document.getElementById('team-submit-btn').textContent = 'Update Team';
  document.getElementById('team-cancel-btn').textContent = 'Cancel';
  document.getElementById('team-cancel-btn').style.display = 'inline-flex';
  document.getElementById('team-name').focus();
  loadTeamReminders(team.id);
}

function cancelTeamEdit() {
  document.getElementById('team-edit-id').value = '';
  document.getElementById('team-form').reset();
  document.getElementById('team-motto').value = 'Bravery. Resilience. Excellence.';
  document.getElementById('team-salutation').value = 'See you all soon!';
  document.getElementById('coach-phone').value = '';
  document.getElementById('coach-email').value = '';
  document.getElementById('training-jersey').value = '';
  document.getElementById('home-jersey').value = '';
  document.getElementById('away-jersey').value = '';
  document.getElementById('show-end-time').checked = true;
  document.getElementById('team-submit-btn').textContent = 'Save Team';
  document.getElementById('team-cancel-btn').style.display = 'none';
  document.getElementById('team-reminders-card').style.display = 'none';
}

async function deleteTeam(id, name) {
  if (!confirm(`Delete team "${name}" and all its players?`)) return;
  try {
    await api(`/api/teams/${id}`, { method: 'DELETE' });
    showToast('Team deleted');
    loadTeams();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

// ============================================================
// PLAYERS
// ============================================================
function setupPlayerTeamSelect() {
  document.getElementById('player-team-select').addEventListener('change', (e) => {
    const teamId = e.target.value;
    if (teamId) {
      document.getElementById('player-form').style.display = 'block';
      document.getElementById('players-import-card').style.display = 'block';
      loadPlayers(teamId);
    } else {
      document.getElementById('player-form').style.display = 'none';
      document.getElementById('players-import-card').style.display = 'none';
      document.getElementById('players-list-card').style.display = 'none';
    }
  });
}

async function loadPlayers(teamId) {
  try {
    const players = await api(`/api/teams/${teamId}/players`);
    renderPlayersList(players);
  } catch (err) {
    console.error('Failed to load players:', err);
  }
}

function renderPlayersList(players) {
  const card = document.getElementById('players-list-card');
  const container = document.getElementById('players-list');
  card.style.display = 'block';

  if (players.length === 0) {
    container.innerHTML = '<p class="empty-state">No players on this team yet.</p>';
    return;
  }

  container.innerHTML = players.map(p => `
    <div class="item-row">
      <div class="item-info">
        <div class="item-name">${escHtml(p.name)}</div>
        <div class="item-detail">${p.birthday ? 'Birthday: ' + formatDate(p.birthday) : 'No birthday set'}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-edit" onclick="editPlayer(${p.id}, '${escJs(p.name)}', '${p.birthday || ''}')">Edit</button>
        <button class="btn btn-danger" onclick="deletePlayer(${p.id}, '${escJs(p.name)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function setupPlayerForm() {
  document.getElementById('player-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const teamId = document.getElementById('player-team-select').value;
    const editId = document.getElementById('player-edit-id').value;
    const payload = {
      team_id: parseInt(teamId),
      name: document.getElementById('player-name').value.trim(),
      birthday: parseDateInput(document.getElementById('player-birthday').value)
    };

    try {
      if (editId) {
        await api(`/api/players/${editId}`, { method: 'PUT', body: payload });
        showToast('Player updated!');
      } else {
        await api('/api/players', { method: 'POST', body: payload });
        showToast('Player added!');
      }
      cancelPlayerEdit();
      loadPlayers(teamId);
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  });
}

function editPlayer(id, name, birthday) {
  document.getElementById('player-edit-id').value = id;
  document.getElementById('player-name').value = name;
  document.getElementById('player-birthday').value = dateToDisplay(birthday);
  document.getElementById('player-submit-btn').textContent = 'Update Player';
  document.getElementById('player-cancel-btn').style.display = 'inline-flex';
  document.getElementById('player-name').focus();
}

function cancelPlayerEdit() {
  document.getElementById('player-edit-id').value = '';
  document.getElementById('player-name').value = '';
  document.getElementById('player-birthday').value = '';
  document.getElementById('player-submit-btn').textContent = 'Add Player';
  document.getElementById('player-cancel-btn').style.display = 'none';
}

async function deletePlayer(id, name) {
  if (!confirm(`Remove ${name} from the team?`)) return;
  try {
    await api(`/api/players/${id}`, { method: 'DELETE' });
    showToast('Player removed');
    const teamId = document.getElementById('player-team-select').value;
    loadPlayers(teamId);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

// ============================================================
// SCHEDULE
// ============================================================
function setupScheduleListeners() {
  document.getElementById('email-team').addEventListener('change', () => {
    fetchScheduleIfReady();
    loadEmailReminders();
  });
  document.getElementById('email-week').addEventListener('change', fetchScheduleIfReady);
}

async function fetchScheduleIfReady() {
  const teamId = document.getElementById('email-team').value;
  const weekStart = document.getElementById('email-week').value;
  const section = document.getElementById('schedule-section');

  if (!teamId || !weekStart) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  const hint = document.getElementById('schedule-hint');
  hint.textContent = 'Loading schedule from calendar...';
  hint.style.display = 'block';

  // Build default schedule — each day is an array of events
  currentSchedule = {};
  DAYS.forEach(d => {
    currentSchedule[d] = [{ type: 'Off', time: '', endTime: '', location: '', jersey: '' }];
  });

  try {
    const sunday = getSunday(weekStart);
    const data = await api(`/api/schedule?team_id=${teamId}&week_start=${sunday}`);

    if (data.schedule) {
      // Ensure each day is an array (iCal parser now returns arrays)
      DAYS.forEach(d => {
        const val = data.schedule[d];
        if (Array.isArray(val)) {
          // Add jersey field to each event and auto-assign
          currentSchedule[d] = val.length > 0
            ? val.map(e => ({ ...e, jersey: autoJersey(e.type) }))
            : [{ type: 'Off', time: '', endTime: '', location: '', jersey: '' }];
        } else if (val && typeof val === 'object') {
          // Legacy single-event format
          currentSchedule[d] = [{ ...val, jersey: autoJersey(val.type) }];
        } else {
          currentSchedule[d] = [{ type: 'Off', time: '', endTime: '', location: '', jersey: '' }];
        }
      });
      hint.textContent = 'Schedule loaded from calendar. You can adjust below.';
    } else {
      hint.textContent = data.message || 'No calendar configured. Fill in manually below.';
    }
  } catch (err) {
    hint.textContent = 'Could not load calendar. Fill in manually below.';
  }

  renderScheduleGrid();
}

function getSelectedTeamJerseys() {
  const teamId = document.getElementById('email-team').value;
  const team = teams.find(t => String(t.id) === String(teamId));
  return {
    training: team?.training_jersey || '',
    home: team?.home_jersey || '',
    away: team?.away_jersey || ''
  };
}

function getSelectedTeamShowEndTime() {
  const teamId = document.getElementById('email-team').value;
  const team = teams.find(t => String(t.id) === String(teamId));
  return team ? team.show_end_time !== 0 : true;
}

function autoJersey(eventType) {
  const jerseys = getSelectedTeamJerseys();
  const t = (eventType || '').toLowerCase();
  if (t.startsWith('game @ ') || t.includes('away')) {
    return jerseys.away;
  } else if (t.startsWith('game vs ') || t.startsWith('game') || t === 'scrimmage' || t === 'friendly' || t === 'tournament') {
    return jerseys.home;
  } else if (t === 'training' || t === 'practice' || t === 'session' || t === 'drill') {
    return jerseys.training;
  }
  return '';
}

function renderScheduleGrid() {
  const grid = document.getElementById('schedule-grid');
  grid.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'schedule-grid';
  const showEndTime = getSelectedTeamShowEndTime();

  DAYS.forEach(day => {
    const events = currentSchedule[day] || [{ type: 'Off', time: '', endTime: '', location: '', jersey: '' }];

    const dayBlock = document.createElement('div');
    dayBlock.className = 'schedule-day-block';
    dayBlock.dataset.day = day;

    const dayHeader = document.createElement('div');
    dayHeader.className = 'schedule-day-header';
    dayHeader.innerHTML = `
      <span class="day-label">${day}</span>
      <button type="button" class="btn-add-event" onclick="addEvent('${day}')" title="Add event">+</button>
    `;
    dayBlock.appendChild(dayHeader);

    events.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = 'schedule-event-row';
      const endTimeHtml = showEndTime
        ? `<input type="text" data-day="${day}" data-idx="${idx}" data-field="endTime" placeholder="End" value="${escAttr(entry.endTime || '')}" class="time-input">`
        : '';
      row.innerHTML = `
        <input type="text" list="event-types" data-day="${day}" data-idx="${idx}" data-field="type" placeholder="Off" value="${escAttr(entry.type)}">
        <input type="text" data-day="${day}" data-idx="${idx}" data-field="time" placeholder="Start" value="${escAttr(entry.time)}" class="time-input">${endTimeHtml}
        <input type="text" data-day="${day}" data-idx="${idx}" data-field="jersey" placeholder="Jersey" value="${escAttr(entry.jersey)}" class="jersey-input">
        <input type="text" data-day="${day}" data-idx="${idx}" data-field="location" placeholder="Location" value="${escAttr(entry.location)}">
        ${events.length > 1 ? `<button type="button" class="btn-remove-event" onclick="removeEvent('${day}', ${idx})" title="Remove event">&times;</button>` : ''}
      `;
      dayBlock.appendChild(row);
    });

    container.appendChild(dayBlock);
  });

  // Add datalist for common event types (only once)
  if (!document.getElementById('event-types')) {
    const datalist = document.createElement('datalist');
    datalist.id = 'event-types';
    ['Off', 'Training', 'Game', 'Scrimmage', 'Tournament', 'Practice', 'Meeting', 'Team Building', 'Party', 'Friendly'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      datalist.appendChild(opt);
    });
    document.body.appendChild(datalist);
  }

  grid.appendChild(container);

  // Listen for changes
  grid.querySelectorAll('input').forEach(el => {
    const handler = () => {
      const day = el.dataset.day;
      const idx = parseInt(el.dataset.idx);
      const field = el.dataset.field;
      if (!currentSchedule[day]) currentSchedule[day] = [{ type: 'Off', time: '', endTime: '', location: '', jersey: '' }];
      if (!currentSchedule[day][idx]) return;
      currentSchedule[day][idx][field] = el.value;

      // Auto-assign jersey when event type changes
      if (field === 'type') {
        const jersey = autoJersey(el.value);
        currentSchedule[day][idx].jersey = jersey;
        const jerseyInput = grid.querySelector(`[data-day="${day}"][data-idx="${idx}"][data-field="jersey"]`);
        if (jerseyInput) jerseyInput.value = jersey;
      }
    };
    el.addEventListener('change', handler);
    el.addEventListener('input', handler);
  });
}

function addEvent(day) {
  if (!currentSchedule[day]) currentSchedule[day] = [];
  currentSchedule[day].push({ type: 'Off', time: '', endTime: '', location: '', jersey: '' });
  renderScheduleGrid();
}

function removeEvent(day, idx) {
  if (!currentSchedule[day] || currentSchedule[day].length <= 1) return;
  currentSchedule[day].splice(idx, 1);
  renderScheduleGrid();
}

// ============================================================
// REMINDERS (email form)
// ============================================================

async function loadEmailReminders() {
  const teamId = document.getElementById('email-team').value;
  const section = document.getElementById('reminders-section');

  if (!teamId) {
    section.style.display = 'none';
    currentReminders = [];
    return;
  }

  section.style.display = 'block';

  try {
    const reminders = await api(`/api/teams/${teamId}/reminders`);
    currentReminders = reminders.map(r => ({
      text: r.text,
      isDefault: true,
      checked: true
    }));
  } catch (err) {
    currentReminders = [];
  }

  renderEmailReminders();
}

function renderEmailReminders() {
  const container = document.getElementById('reminders-checklist');

  if (currentReminders.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:0.5rem;">No default reminders for this team.</p>';
    return;
  }

  container.innerHTML = currentReminders.map((r, i) => `
    <div class="reminder-check-item">
      <input type="checkbox" data-reminder-idx="${i}" ${r.checked ? 'checked' : ''}>
      <span class="reminder-text">${escHtml(r.text)}</span>
      ${r.isDefault ? '<span class="reminder-tag">default</span>' : `<button class="btn-remove-reminder" onclick="removeOneOffReminder(${i})" title="Remove">&times;</button>`}
    </div>
  `).join('');

  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.reminderIdx);
      currentReminders[idx].checked = cb.checked;
    });
  });
}

function addOneOffReminder() {
  const input = document.getElementById('reminder-add-input');
  const text = input.value.trim();
  if (!text) return;

  currentReminders.push({ text, isDefault: false, checked: true });
  input.value = '';
  renderEmailReminders();
}

function removeOneOffReminder(idx) {
  currentReminders.splice(idx, 1);
  renderEmailReminders();
}

function setupReminderInputs() {
  document.getElementById('reminder-add-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addOneOffReminder(); }
  });
  document.getElementById('team-reminder-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTeamReminder(); }
  });
  document.getElementById('homework-add-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addHomeworkItem(); }
  });
}

// ============================================================
// REMINDERS (team management)
// ============================================================

async function loadTeamReminders(teamId) {
  const card = document.getElementById('team-reminders-card');
  if (!teamId) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  try {
    const reminders = await api(`/api/teams/${teamId}/reminders`);
    renderTeamReminders(reminders);
  } catch (err) {
    console.error('Failed to load team reminders:', err);
  }
}

function renderTeamReminders(reminders) {
  const container = document.getElementById('team-reminders-list');

  if (reminders.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:0.75rem;">No default reminders yet.</p>';
    return;
  }

  container.innerHTML = reminders.map(r => `
    <div class="item-row">
      <div class="item-info">
        <div class="item-name">${escHtml(r.text)}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-danger" onclick="deleteTeamReminder(${r.id})">Remove</button>
      </div>
    </div>
  `).join('');
}

async function addTeamReminder() {
  const editId = document.getElementById('team-edit-id').value;
  if (!editId) {
    showToast('Save the team first, then add reminders');
    return;
  }

  const input = document.getElementById('team-reminder-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    await api('/api/reminders', { method: 'POST', body: { team_id: parseInt(editId), text } });
    input.value = '';
    showToast('Reminder added!');
    loadTeamReminders(editId);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function deleteTeamReminder(id) {
  const editId = document.getElementById('team-edit-id').value;
  try {
    await api(`/api/reminders/${id}`, { method: 'DELETE' });
    showToast('Reminder removed');
    loadTeamReminders(editId);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

// ============================================================
// HOMEWORK
// ============================================================

function renderHomeworkList() {
  const container = document.getElementById('homework-list');

  if (homeworkItems.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = homeworkItems.map((item, i) => `
    <div class="reminder-check-item">
      <span class="reminder-text">${escHtml(item)}</span>
      <button class="btn-remove-reminder" onclick="removeHomeworkItem(${i})" title="Remove">&times;</button>
    </div>
  `).join('');
}

function addHomeworkItem() {
  const input = document.getElementById('homework-add-input');
  const text = input.value.trim();
  if (!text) return;

  homeworkItems.push(text);
  input.value = '';
  renderHomeworkList();
}

function removeHomeworkItem(idx) {
  homeworkItems.splice(idx, 1);
  renderHomeworkList();
}

// ============================================================
// CSV IMPORT
// ============================================================

async function importPlayersCSV() {
  const teamId = document.getElementById('player-team-select').value;
  if (!teamId) {
    showToast('Please select a team first');
    return;
  }

  const fileInput = document.getElementById('csv-file-input');
  if (!fileInput.files || !fileInput.files[0]) {
    showToast('Please choose a CSV file');
    return;
  }

  const file = fileInput.files[0];
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    // Split on comma, but handle quoted fields
    const parts = line.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    const name = parts[0];

    if (!name) continue;

    // Skip header rows
    if (name.toLowerCase() === 'name' || name.toLowerCase() === 'player') {
      continue;
    }

    // Parse birthday — expect MM/DD/YYYY or similar
    let birthday = '';
    if (parts[1]) {
      const raw = parts[1].trim();
      // Try MM/DD/YYYY
      const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (match) {
        const mm = match[1].padStart(2, '0');
        const dd = match[2].padStart(2, '0');
        const yyyy = match[3];
        birthday = `${yyyy}-${mm}-${dd}`;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        // Already YYYY-MM-DD
        birthday = raw;
      }
    }

    try {
      await api('/api/players', {
        method: 'POST',
        body: { team_id: parseInt(teamId), name, birthday }
      });
      imported++;
    } catch (err) {
      skipped++;
    }
  }

  fileInput.value = '';
  showToast(`Imported ${imported} player${imported !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped` : ''}`);
  loadPlayers(teamId);
}

// ============================================================
// EMAIL GENERATION
// ============================================================
function setupEmailForm() {
  document.getElementById('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const teamId = document.getElementById('email-team').value;
    const weekStart = document.getElementById('email-week').value;

    if (!teamId) {
      showToast('Please select a team');
      return;
    }

    // Read current schedule from the form inputs (multi-event per day)
    const scheduleFromForm = {};
    DAYS.forEach(day => {
      const events = currentSchedule[day] || [{ type: 'Off', time: '', location: '', jersey: '' }];
      scheduleFromForm[day] = events.map((entry, idx) => {
        const typeEl = document.querySelector(`[data-day="${day}"][data-idx="${idx}"][data-field="type"]`);
        const timeEl = document.querySelector(`[data-day="${day}"][data-idx="${idx}"][data-field="time"]`);
        const endTimeEl = document.querySelector(`[data-day="${day}"][data-idx="${idx}"][data-field="endTime"]`);
        const locEl = document.querySelector(`[data-day="${day}"][data-idx="${idx}"][data-field="location"]`);
        const jerseyEl = document.querySelector(`[data-day="${day}"][data-idx="${idx}"][data-field="jersey"]`);

        return {
          type: typeEl ? typeEl.value : entry.type,
          time: timeEl ? timeEl.value : entry.time,
          endTime: endTimeEl ? endTimeEl.value : (entry.endTime || ''),
          location: locEl ? locEl.value : entry.location,
          jersey: jerseyEl ? jerseyEl.value : entry.jersey
        };
      });
    });

    const payload = {
      team_id: parseInt(teamId),
      week_start: getSunday(weekStart),
      schedule: scheduleFromForm,
      team_focus: document.getElementById('team-focus').value,
      homework_items: [...homeworkItems],
      personal_note: document.getElementById('personal-note').value,
      include_quote: document.getElementById('include-quote').checked,
      reminders: currentReminders.filter(r => r.checked).map(r => r.text)
    };

    try {
      const result = await api('/api/generate-email', { method: 'POST', body: payload });
      renderEmailOutput(result.messages);
      document.getElementById('output-card').style.display = 'block';
      document.getElementById('output-card').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      showToast('Error generating email: ' + err.message);
    }
  });
}

function renderEmailOutput(messages) {
  const container = document.getElementById('output-messages');
  container.innerHTML = '';

  messages.forEach((msg, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'email-message-block';

    const label = document.createElement('div');
    label.className = 'email-message-label';
    if (messages.length > 1) {
      label.textContent = `Message ${i + 1} of ${messages.length} (${msg.length} chars)`;
    } else {
      label.textContent = `${msg.length} chars`;
    }
    wrapper.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.className = 'email-output-area';
    textarea.readOnly = true;
    textarea.rows = Math.min(20, msg.split('\n').length + 2);
    textarea.value = msg;
    wrapper.appendChild(textarea);

    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.innerHTML = '&#128203; Copy to Clipboard';
    btn.addEventListener('click', () => copyMessage(btn, textarea));
    wrapper.appendChild(btn);

    container.appendChild(wrapper);
  });
}

function copyMessage(btn, textarea) {
  textarea.select();
  textarea.setSelectionRange(0, 99999);

  navigator.clipboard.writeText(textarea.value).then(() => {
    const originalText = btn.innerHTML;
    btn.innerHTML = '&#10003; Copied!';
    btn.classList.add('btn-copied');
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.classList.remove('btn-copied');
    }, 2000);
  }).catch(() => {
    document.execCommand('copy');
    showToast('Copied to clipboard!');
  });
}

// ============================================================
// ESCAPE HELPERS
// ============================================================
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escJs(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}
