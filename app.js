// ─── State ───────────────────────────────────────────────────────────────────
const settings = {
  officialStartTime: '08:00',
  officialEndTime: '17:00',
  lunchStartTime: '12:00',
  lunchEndTime: '13:00',
  requiredHours: 8,
  totalTargetHours: 0,
  excludeWeekends: false,
  gracePeriod: 0,
};

let records = [];

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const settingsToggle   = $('settingsToggle');
const settingsPanel    = $('settingsPanel');
const settingsOverlay  = $('settingsOverlay');
const closeSettings    = $('closeSettings');
const saveSettings     = $('saveSettings');
const btnCalculate     = $('btnCalculate');
const resultsSection   = $('resultsSection');
const recordsCard      = $('recordsCard');
const btnClearRecords  = $('btnClearRecords');
const weekendWarning   = $('weekendWarning');
const dayBadge         = $('dayBadge');

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  loadSettings();
  loadRecords();
  
  // Initialize Flatpickr for the main date input
  flatpickr('#dtrDate', {
    dateFormat: 'Y-m-d',
    disableMobile: true, // Use custom UI on mobile instead of native picker
    onChange: function(selectedDates, dateStr, instance) {
      if (dateStr) {
        updateDayBadge(dateStr);
        loadRecordForDate(dateStr);
      }
    }
  });

  setDefaultDate();
  applySettingsToUI();
  renderRecords();
  attachListeners();
  loadRecordForDate($('dtrDate').value);
}

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const localDateStr = `${yyyy}-${mm}-${dd}`;
  
  // Update flatpickr instance if exists
  const fp = $('dtrDate')._flatpickr;
  if (fp) {
    fp.setDate(localDateStr);
  } else {
    $('dtrDate').value = localDateStr;
  }
  
  updateDayBadge(localDateStr);
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function loadSettings() {
  const stored = localStorage.getItem('dtr_settings');
  if (stored) Object.assign(settings, JSON.parse(stored));
}

function saveSettingsFn() {
  settings.officialStartTime = $('officialStartTime').value || '08:00';
  settings.officialEndTime   = $('officialEndTime').value   || '17:00';
  settings.lunchStartTime    = $('lunchStartTime').value    || '12:00';
  settings.lunchEndTime      = $('lunchEndTime').value      || '13:00';
  settings.requiredHours     = parseFloat($('requiredHours').value) || 8;
  settings.totalTargetHours  = parseFloat($('totalTargetHours').value) || 0;
  settings.excludeWeekends   = $('excludeWeekends').checked;
  settings.gracePeriod       = parseInt($('gracePeriod').value) || 0;
  localStorage.setItem('dtr_settings', JSON.stringify(settings));
  closeSettingsPanel();
  showToast('✓ Settings saved', 'success');
  updateDayBadge($('dtrDate').value);
}

function applySettingsToUI() {
  $('officialStartTime').value  = settings.officialStartTime;
  $('officialEndTime').value    = settings.officialEndTime;
  $('lunchStartTime').value     = settings.lunchStartTime;
  $('lunchEndTime').value       = settings.lunchEndTime;
  $('requiredHours').value      = settings.requiredHours;
  $('totalTargetHours').value   = settings.totalTargetHours;
  $('excludeWeekends').checked  = settings.excludeWeekends;
  $('gracePeriod').value        = settings.gracePeriod;
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function openSettingsPanel() {
  settingsPanel.classList.add('open');
  settingsOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeSettingsPanel() {
  settingsPanel.classList.remove('open');
  settingsOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Date Logic ───────────────────────────────────────────────────────────────
function isWeekend(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

function updateDayBadge(dateStr) {
  if (!dateStr) { dayBadge.textContent = '—'; return; }
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  dayBadge.textContent = days[d.getDay()];
  const weekend = isWeekend(dateStr);
  dayBadge.classList.toggle('weekend', weekend);
  if (settings.excludeWeekends && weekend) {
    weekendWarning.style.display = 'flex';
  } else {
    weekendWarning.style.display = 'none';
  }
}

function loadRecordForDate(dateStr) {
  const existing = records.find(r => r.dateStr === dateStr);
  if (existing) {
    $('morningIn').value = existing.morningIn || '';
    $('morningOut').value = existing.morningOut || '';
    $('afternoonIn').value = existing.afternoonIn || '';
    $('afternoonOut').value = existing.afternoonOut || '';
    $('overtimeIn').value = existing.overtimeIn || '';
    $('overtimeOut').value = existing.overtimeOut || '';
    
    if (existing.overtimeIn || existing.overtimeOut) {
      setOvertimeActive(true);
    } else {
      setOvertimeActive(false);
    }
    
    calculate(true, false); // pass true to indicate auto-load, false to not save again
  } else {
    $('morningIn').value = '';
    $('morningOut').value = '';
    $('afternoonIn').value = '';
    $('afternoonOut').value = '';
    $('overtimeIn').value = '';
    $('overtimeOut').value = '';
    setOvertimeActive(false);
    resultsSection.style.display = 'none';
  }
  updateAllTimeHints();
}

// ─── Time Helpers ─────────────────────────────────────────────────────────────
function toMins(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function toTimeStr(mins) {
  if (mins == null) return '—';
  const totalMins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function toHMStr(totalMins) {
  if (totalMins == null || totalMins < 0) return '0h 0m';
  const h = Math.floor(totalMins / 60);
  const m = Math.round(totalMins % 60);
  return `${h}h ${m}m`;
}

// Overlap helper for lunch deductions
function getOverlap(startMins, endMins, lunchStartMins, lunchEndMins) {
  if (startMins == null || endMins == null) return 0;
  const overlapStart = Math.max(startMins, lunchStartMins);
  const overlapEnd = Math.min(endMins, lunchEndMins);
  if (overlapEnd > overlapStart) {
    return overlapEnd - overlapStart;
  }
  return 0;
}

// Apply official start rule: if arrived before/at official start + grace, clamp to official start
function applyStartRule(rawMins) {
  if (rawMins == null) return null;
  const officialMins = toMins(settings.officialStartTime);
  const graceEnd = officialMins + settings.gracePeriod;
  // If arrived before or within grace period of official start, count from official start
  if (rawMins <= graceEnd) return officialMins;
  return rawMins;
}

// Apply official end rule: cap time out at official end time
function applyEndRule(rawMins) {
  if (rawMins == null) return null;
  const officialEndMins = toMins(settings.officialEndTime);
  if (rawMins > officialEndMins) return officialEndMins;
  return rawMins;
}

// ─── Calculation ──────────────────────────────────────────────────────────────
function calculate(isAutoLoad = false, shouldSave = true) {
  const dateStr       = $('dtrDate').value;
  const rawMorningIn  = $('morningIn').value;
  const rawMorningOut = $('morningOut').value;
  const rawAfternoonIn  = $('afternoonIn').value;
  const rawAfternoonOut = $('afternoonOut').value;
  const rawOvertimeIn   = $('overtimeIn').value;
  const rawOvertimeOut  = $('overtimeOut').value;

  // Validate at least morning in
  if (!rawMorningIn && !rawAfternoonIn && !rawOvertimeIn) {
    showToast('⚠ Please enter at least one Time In', 'error');
    return;
  }

  // Weekend guard
  if (settings.excludeWeekends && isWeekend(dateStr)) {
    showToast('⚠ This is a weekend — excluded from records', 'error');
    return;
  }

  const officialStart = toMins(settings.officialStartTime);
  const requiredMins  = settings.requiredHours * 60;

  const lunchStartMins = toMins(settings.lunchStartTime);
  const lunchEndMins   = toMins(settings.lunchEndTime);

  // Cross-block support: If only first IN and last OUT are filled
  let _morningOutMins = toMins(rawMorningOut);
  let _afternoonInMins = toMins(rawAfternoonIn);
  let morningInMins  = toMins(rawMorningIn);
  let afternoonOutMins = toMins(rawAfternoonOut);
  
  let overtimeInMins = toMins(rawOvertimeIn);
  let overtimeOutMins = toMins(rawOvertimeOut);

  if (morningInMins != null && _morningOutMins == null && _afternoonInMins == null && afternoonOutMins != null) {
     // User just inputted Start and End of the day.
     _morningOutMins = afternoonOutMins; 
     // We compute it all in the Morning block. 
     // And leave afternoonOutMins = null for the variables below to avoid double calculation.
     afternoonOutMins = null;
  }

  // Morning
  let morningOutMins = _morningOutMins;
  let morningHours   = 0;
  let morningInAdj   = false;
  let morningLunchDeduction = 0;

  if (morningInMins != null) {
    const adjusted = applyStartRule(morningInMins);
    morningInAdj = adjusted !== morningInMins;
    morningInMins = adjusted;
  }
  
  if (morningOutMins != null) {
    morningOutMins = applyEndRule(morningOutMins);
  }

  if (morningInMins != null && morningOutMins != null) {
    morningHours = Math.max(0, morningOutMins - morningInMins);
    morningLunchDeduction = getOverlap(morningInMins, morningOutMins, lunchStartMins, lunchEndMins);
    morningHours = Math.max(0, morningHours - morningLunchDeduction);
  }

  // Afternoon
  let afternoonInMins  = _afternoonInMins;
  let afternoonHours   = 0;
  let afternoonLunchDeduction = 0;
  
  if (afternoonOutMins != null) {
    afternoonOutMins = applyEndRule(afternoonOutMins);
  }

  if (afternoonInMins != null && afternoonOutMins != null) {
    afternoonHours = Math.max(0, afternoonOutMins - afternoonInMins);
    afternoonLunchDeduction = getOverlap(afternoonInMins, afternoonOutMins, lunchStartMins, lunchEndMins);
    afternoonHours = Math.max(0, afternoonHours - afternoonLunchDeduction);
  }
  
  // Overtime
  let overtimeHours = 0;
  if (overtimeInMins != null && overtimeOutMins != null) {
    overtimeHours = Math.max(0, overtimeOutMins - overtimeInMins);
  }

  const totalMins   = morningHours + afternoonHours + overtimeHours;
  const remaining   = Math.max(0, requiredMins - totalMins);

  const totalLunchDeduction = morningLunchDeduction + afternoonLunchDeduction;

  // Estimate finish: if afternoon out not set, compute from current accomplished + remaining
  let estimatedFinish = null;
  if (afternoonInMins != null && afternoonOutMins == null) {
    estimatedFinish = afternoonInMins + remaining;
    // Add lunch overlap if they are estimating and haven't passed lunch yet? 
    // Usually if they are in the afternoon, lunch already passed.
  } else if (afternoonOutMins != null) {
    estimatedFinish = afternoonOutMins;
    if (remaining > 0 && afternoonOutMins != null) {
      estimatedFinish = afternoonOutMins + remaining;
    }
  } else if (morningOutMins != null && afternoonInMins == null) {
    // Only morning done — estimate based on last known time
    estimatedFinish = morningOutMins + remaining;
  }

  // Determine status
  let statusText = '—';
  let statusClass = '';
  const officialStartMins = toMins(settings.officialStartTime);
  const rawMorningInMins = toMins(rawMorningIn);

  if (totalMins >= requiredMins) {
    statusText  = 'Complete ✓';
    statusClass = 'status-complete';
  } else if (rawMorningInMins != null && rawMorningInMins > officialStartMins + settings.gracePeriod) {
    statusText  = 'Late';
    statusClass = 'status-late';
  } else if (totalMins > 0) {
    statusText  = 'In Progress';
    statusClass = 'status-partial';
  }

  const pct = Math.min(100, Math.round((totalMins / requiredMins) * 100));

  // ── Render Results ──────────────────────────────────────────────────────────
  $('totalHours').textContent    = toHMStr(totalMins);
  $('finishTime').textContent    = estimatedFinish ? toTimeStr(estimatedFinish) : '—';
  $('attendanceStatus').textContent = statusText;
  $('attendanceStatus').className = 'result-value ' + statusClass;
  $('remainingHours').textContent = remaining > 0 ? toHMStr(remaining) : 'Done ✓';

  $('progressFill').style.width  = pct + '%';
  $('progressPct').textContent   = pct + '%';
  $('progressStart').textContent = toTimeStr(officialStartMins);
  $('progressEnd').textContent   = toTimeStr(officialStartMins + requiredMins);

  // Breakdown
  $('breakdownMorningIn').textContent  = morningInMins != null ? toTimeStr(morningInMins) : '—';
  $('breakdownMorningOut').textContent = morningOutMins != null ? toTimeStr(morningOutMins) : '—';
  $('breakdownMorningHours').textContent = morningHours > 0 ? toHMStr(morningHours) : '—';

  $('breakdownAfternoonIn').textContent  = afternoonInMins != null ? toTimeStr(afternoonInMins) : '—';
  $('breakdownAfternoonOut').textContent = afternoonOutMins != null ? toTimeStr(afternoonOutMins) : '—';
  $('breakdownAfternoonHours').textContent = afternoonHours > 0 ? toHMStr(afternoonHours) : '—';
  
  if ($('overtimeSection').style.display !== 'none') {
    $('breakdownOvertimeRow').style.display = 'grid';
    $('breakdownOvertimeIn').textContent  = overtimeInMins != null ? toTimeStr(overtimeInMins) : '—';
    $('breakdownOvertimeOut').textContent = overtimeOutMins != null ? toTimeStr(overtimeOutMins) : '—';
    $('breakdownOvertimeHours').textContent = overtimeHours > 0 ? toHMStr(overtimeHours) : '—';
  } else {
    $('breakdownOvertimeRow').style.display = 'none';
  }

  $('breakdownTotal').textContent = toHMStr(totalMins);

  // Time status badges
  updateTimeBadge('morningInStatus', rawMorningInMins, morningInAdj ? 'Adjusted' : (rawMorningInMins != null && rawMorningInMins < officialStartMins ? 'Early' : null), morningInAdj);

  // Notes
  const notes = [];
  if (morningInAdj) {
    notes.push(`Morning Time In adjusted from ${toTimeStr(toMins(rawMorningIn))} → ${toTimeStr(officialStartMins)} (official start time applies).`);
  }
  if (rawMorningInMins != null && rawMorningInMins > officialStartMins + settings.gracePeriod) {
    const lateBy = rawMorningInMins - officialStartMins;
    notes.push(`Arrived ${toHMStr(lateBy)} late (official start: ${toTimeStr(officialStartMins)}).`);
  }
  if (totalLunchDeduction > 0) {
    notes.push(`${toHMStr(totalLunchDeduction)} deducted for Lunch Break overlap.`);
  }
  if (remaining > 0 && estimatedFinish) {
    notes.push(`Need ${toHMStr(remaining)} more to complete ${settings.requiredHours}h. Est. finish: ${toTimeStr(estimatedFinish)}.`);
  }

  const notesCard = $('notesCard');
  if (notes.length) {
    $('notesContent').innerHTML = notes.map(n => `• ${n}`).join('<br>');
    notesCard.style.display = 'flex';
  } else {
    notesCard.style.display = 'none';
  }

  resultsSection.style.display = 'block';

  // Save record
  if (shouldSave) {
    saveRecord({ 
      dateStr, morningInMins, morningOutMins, afternoonInMins, afternoonOutMins, totalMins, statusText, 
      rawMorningIn, rawMorningOut, rawAfternoonIn, rawAfternoonOut, rawOvertimeIn, rawOvertimeOut 
    });

    if (!isAutoLoad) {
      showToast('✓ Record saved to logs', 'success');
    }
  } else {
    if (!isAutoLoad) {
      showToast('✓ Preview generated', 'success');
    }
  }

  setTimeout(() => {
    if (!isAutoLoad) resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function updateTimeBadge(id, rawMins, label, isAdj) {
  const el = $(id);
  if (!el || rawMins == null || !label) { if(el) el.style.display = 'none'; return; }
  el.textContent = label;
  el.className = 'time-status ' + (isAdj ? 'adjusted' : 'early');
}

// ─── Records ──────────────────────────────────────────────────────────────────
function loadRecords() {
  const stored = localStorage.getItem('dtr_records');
  if (stored) records = JSON.parse(stored);
}

function saveRecord(data) {
  const entry = {
    dateStr: data.dateStr,
    morningIn: data.rawMorningIn,
    morningOut: data.rawMorningOut,
    afternoonIn: data.rawAfternoonIn,
    afternoonOut: data.rawAfternoonOut,
    overtimeIn: data.rawOvertimeIn,
    overtimeOut: data.rawOvertimeOut,
    totalMins: data.totalMins,
    status: data.statusText,
  };
  const existing = records.findIndex(r => r.dateStr === data.dateStr);
  if (existing >= 0) {
    records[existing] = entry;
  } else {
    records.push(entry);
  }

  // Sort ascending (oldest to newest)
  records.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  localStorage.setItem('dtr_records', JSON.stringify(records));
  renderRecords();
}

let isEditMode = false;

// Custom Confirm Modal Logic
function confirmAction(message) {
  return new Promise((resolve) => {
    const overlay = $('confirmModalOverlay');
    const msgEl = $('confirmModalMessage');
    const btnCancel = $('btnModalCancel');
    const btnConfirm = $('btnModalConfirm');
    
    msgEl.textContent = message;
    overlay.classList.add('show');
    
    const cleanup = () => {
      overlay.classList.remove('show');
      btnCancel.removeEventListener('click', onCancel);
      btnConfirm.removeEventListener('click', onConfirm);
    };
    
    const onCancel = () => { cleanup(); resolve(false); };
    const onConfirm = () => { cleanup(); resolve(true); };
    
    btnCancel.addEventListener('click', onCancel);
    btnConfirm.addEventListener('click', onConfirm);
  });
}

async function deleteRecord(dateStr) {
  const confirmed = await confirmAction(`Are you sure you want to delete the log for ${dateStr}?`);
  if (!confirmed) return;
  
  records = records.filter(r => r.dateStr !== dateStr);
  localStorage.setItem('dtr_records', JSON.stringify(records));
  
  // If the currently selected date in the calendar was deleted, clear the inputs
  if ($('dtrDate').value === dateStr) {
    loadRecordForDate(dateStr); 
  }
  
  renderRecords();
  showToast(`Log for ${dateStr} deleted`, 'success');
}

function renderRecords() {
  const list = $('recordsList');
  const summary = $('recordsSummary');
  const monthFilter = $('monthFilter');

  if (!records.length) {
    recordsCard.style.display = 'none';
    return;
  }
  recordsCard.style.display = 'block';

  // Populate Dropdown
  const currentFilter = monthFilter.value;
  const uniqueMonths = [...new Set(records.map(r => r.dateStr.substring(0, 7)))].sort((a, b) => b.localeCompare(a));
  
  monthFilter.innerHTML = '<option value="all" style="background: #12141f;">All Months</option>';
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  uniqueMonths.forEach(ym => {
    const [y, m] = ym.split('-');
    const label = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
    monthFilter.innerHTML += `<option value="${ym}" style="background: #12141f;">${label}</option>`;
  });
  
  // Restore selection or fallback to 'all'
  if (uniqueMonths.includes(currentFilter) || currentFilter === 'all') {
    monthFilter.value = currentFilter;
  } else {
    monthFilter.value = 'all';
  }

  const activeFilter = monthFilter.value;

  // Filter Records
  let visibleRecords = records;
  if (activeFilter !== 'all') {
    visibleRecords = records.filter(r => r.dateStr.startsWith(activeFilter));
  }

  const totalDays   = visibleRecords.filter(r => !r.status.includes('Weekend')).length;
  const totalHrsMin = visibleRecords.reduce((s, r) => s + (r.totalMins || 0), 0);
  const completed   = visibleRecords.filter(r => r.status.includes('Complete')).length;

  const totalTargetMins = (settings.totalTargetHours || 0) * 60;
  
  let targetProgressHtml = '';
  if (totalTargetMins > 0) {
    // Overall target progress should always calculate using ALL records
    const overallHrsMin = records.reduce((s, r) => s + (r.totalMins || 0), 0);
    const totalRemainingMins = Math.max(0, totalTargetMins - overallHrsMin);
    const targetPct = Math.min(100, Math.round((overallHrsMin / totalTargetMins) * 100));
    
    // Project Completion Date
    let projectedText = '';
    if (totalRemainingMins > 0 && records.length > 0) {
      const requiredMins = settings.requiredHours * 60;
      if (requiredMins > 0) {
        // Start from the latest log date
        let latestDateStr = records[records.length - 1].dateStr;
        let simDate = new Date(latestDateStr + 'T00:00:00');
        let minsLeft = totalRemainingMins;
        
        while (minsLeft > 0) {
          simDate.setDate(simDate.getDate() + 1);
          if (settings.excludeWeekends && (simDate.getDay() === 0 || simDate.getDay() === 6)) {
            continue;
          }
          if (minsLeft > requiredMins) {
            minsLeft -= requiredMins;
          } else {
            // Final day
            const officialStartMins = toMins(settings.officialStartTime) || 480;
            const lunchStart = toMins(settings.lunchStartTime) || 720;
            const lunchEnd = toMins(settings.lunchEndTime) || 780;
            
            let finishMins = officialStartMins + minsLeft;
            // If finish time crosses the start of lunch, add the lunch duration
            if (finishMins > lunchStart) {
              finishMins += (lunchEnd - lunchStart);
            }
            
            const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const dName = dayNames[simDate.getDay()];
            const mName = months[simDate.getMonth()];
            
            projectedText = `<div style="margin-top: 10px; padding: 12px; background: rgba(139,92,246,0.1); border: 1px dashed rgba(139,92,246,0.3); border-radius: 8px; text-align: center;">
              <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Projected Completion</span>
              <span style="font-weight: 700; color: var(--accent); font-size: 0.95rem;">${dName}, ${mName} ${simDate.getDate()}, ${simDate.getFullYear()} at ${toTimeStr(finishMins)}</span>
            </div>`;
            break;
          }
        }
      }
    } else if (totalRemainingMins === 0) {
      projectedText = `<div style="margin-top: 10px; padding: 12px; background: rgba(16,185,129,0.1); border: 1px dashed rgba(16,185,129,0.3); border-radius: 8px; text-align: center;">
        <span style="font-weight: 700; color: var(--green); font-size: 0.95rem;">Goal Accomplished! 🎉</span>
      </div>`;
    }

    targetProgressHtml = `
      <div class="global-target" style="grid-column: 1 / -1; background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2); padding: 16px; border-radius: 10px;">
         <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-weight: 600; font-size: 0.85rem; color: var(--green);">Total Target Progress (Overall)</span>
            <span style="font-weight: 700; color: var(--green);">${targetPct}%</span>
         </div>
         <div style="height: 8px; background: rgba(0,0,0,0.2); border-radius: 99px; overflow: hidden; margin-bottom: 8px;">
            <div style="height: 100%; width: ${targetPct}%; background: var(--green); border-radius: 99px; transition: width 0.8s;"></div>
         </div>
         <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
            <span>${toHMStr(overallHrsMin)} Logged</span>
            <span>${toHMStr(totalRemainingMins)} Remaining of ${settings.totalTargetHours}h</span>
         </div>
         ${projectedText}
      </div>
    `;
  }

  summary.innerHTML = `
    <div class="summary-chip">
      <div class="summary-chip-value">${totalDays}</div>
      <div class="summary-chip-label">Days Logged</div>
    </div>
    <div class="summary-chip">
      <div class="summary-chip-value">${toHMStr(totalHrsMin)}</div>
      <div class="summary-chip-label">Total Hours</div>
    </div>
    <div class="summary-chip">
      <div class="summary-chip-value">${completed}</div>
      <div class="summary-chip-label">Complete Days</div>
    </div>
    ${targetProgressHtml}
  `;

  list.innerHTML = records.map(r => {
    const d = new Date(r.dateStr + 'T00:00:00');
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateLabel = `${dayNames[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
    const isComplete = r.status.includes('Complete');
    const isLate     = r.status.includes('Late');
    const dotClass   = isComplete ? 'dot-complete' : isLate ? 'dot-late' : 'dot-partial';

    const fmt = t => t ? toTimeStr(toMins(t)) : '—';
    const hasOt = r.overtimeIn || r.overtimeOut;
    let timesStr = `${fmt(r.morningIn)} – ${fmt(r.morningOut)} / ${fmt(r.afternoonIn)} – ${fmt(r.afternoonOut)}`;
    if (hasOt) timesStr += ` / OT: ${fmt(r.overtimeIn)} – ${fmt(r.overtimeOut)}`;

    return `
      <div class="record-item" onclick="previewLog('${r.dateStr}')">
        <div class="record-date">
          ${dateLabel}
          <span><span class="record-status-dot ${dotClass}"></span>${r.status}</span>
        </div>
        <div class="record-times">${timesStr}</div>
        <div class="record-hours" style="display: flex; align-items: center; justify-content: flex-end;">
          ${toHMStr(r.totalMins)}
          ${isEditMode ? `
            <div class="btn-delete-record" onclick="event.stopPropagation(); deleteRecord('${r.dateStr}')" title="Delete Log">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function clearRecords() {
  const confirmed = await confirmAction('Clear all saved DTR records?');
  if (!confirmed) return;
  records = [];
  localStorage.removeItem('dtr_records');
  recordsCard.style.display = 'none';
  showToast('Records cleared', 'success');
}

function exportData() {
  const data = { settings, records };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DTR_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Data exported successfully', 'success');
}

function importData() {
  $('importFileInput').click();
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.records && Array.isArray(data.records)) {
        records = data.records;
        localStorage.setItem('dtr_records', JSON.stringify(records));
        
        if (data.settings) {
          Object.assign(settings, data.settings);
          localStorage.setItem('dtr_settings', JSON.stringify(settings));
          applySettingsToUI();
        }
        
        renderRecords();
        loadRecordForDate($('dtrDate').value);
        closeSettingsPanel();
        showToast('Data imported successfully!', 'success');
      } else {
        showToast('Invalid backup file', 'error');
      }
    } catch (err) {
      showToast('Error reading file', 'error');
    }
    $('importFileInput').value = '';
  };
  reader.readAsText(file);
}

function printRecords() {
  if (!records.length) {
    showToast('No records to print', 'error');
    return;
  }
  
  const activeFilter = $('monthFilter').value;
  let visibleRecords = records;
  let subtitle = 'All Records';
  
  if (activeFilter !== 'all') {
    visibleRecords = records.filter(r => r.dateStr.startsWith(activeFilter));
    const [y, m] = activeFilter.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    subtitle = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
  }
  
  const printArea = $('printArea');
  const fmt = t => t ? toTimeStr(toMins(t)) : '';
  
  let rows = visibleRecords.map(r => {
    const d = new Date(r.dateStr + 'T00:00:00');
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dateLabel = `${dayNames[d.getDay()]}, ${r.dateStr}`;
    
    const hasOt = r.overtimeIn || r.overtimeOut;
    
    return `
      <tr>
        <td>${dateLabel}</td>
        <td>${fmt(r.morningIn)} ${r.morningOut ? ' - ' + fmt(r.morningOut) : ''}</td>
        <td>${fmt(r.afternoonIn)} ${r.afternoonOut ? ' - ' + fmt(r.afternoonOut) : ''}</td>
        <td>${hasOt ? (fmt(r.overtimeIn) + (r.overtimeOut ? ' - ' + fmt(r.overtimeOut) : '')) : ''}</td>
        <td><strong>${toHMStr(r.totalMins)}</strong></td>
      </tr>
    `;
  }).join('');
  
  const totalMins = visibleRecords.reduce((s, r) => s + (r.totalMins || 0), 0);
  
  printArea.innerHTML = `
    <h2>Daily Time Record (DTR)</h2>
    <p><strong>Period:</strong> ${subtitle} <br> <strong>Total Accumulated Hours:</strong> ${toHMStr(totalMins)}</p>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Morning (In - Out)</th>
          <th>Afternoon (In - Out)</th>
          <th>Overtime (In - Out)</th>
          <th>Total Hours</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
  
  window.print();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  setTimeout(() => toast.classList.add('show'), 10);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
let isOvertimeActive = false;
function setOvertimeActive(active) {
  isOvertimeActive = active;
  if (active) {
    $('overtimeSection').style.display = 'block';
    $('txtToggleOvertime').textContent = 'Remove Overtime';
    $('iconToggleOvertime').innerHTML = '<path d="M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>';
  } else {
    $('overtimeSection').style.display = 'none';
    $('txtToggleOvertime').textContent = 'Add Overtime';
    $('iconToggleOvertime').innerHTML = '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>';
    $('overtimeIn').value = '';
    $('overtimeOut').value = '';
  }
}

function attachListeners() {
  settingsToggle.addEventListener('click', openSettingsPanel);
  closeSettings.addEventListener('click',  closeSettingsPanel);
  settingsOverlay.addEventListener('click', closeSettingsPanel);
  saveSettings.addEventListener('click', saveSettingsFn);
  
  $('btnToggleOvertime').addEventListener('click', () => {
    setOvertimeActive(!isOvertimeActive);
    if (!isOvertimeActive) calculate(false, false); // recalc when OT is removed
  });
  
  $('btnEditLogs').addEventListener('click', () => {
    isEditMode = !isEditMode;
    const btn = $('btnEditLogs');
    if (isEditMode) {
      btn.style.background = 'rgba(245,158,11,0.2)';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
          <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Done Editing
      `;
    } else {
      btn.style.background = 'rgba(245,158,11,0.1)';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
          <path d="M15.232 5.232l3.536 3.536M16.5 2.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 2.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Edit Logs
      `;
    }
    renderRecords();
  });
  
  $('btnExportData').addEventListener('click', exportData);
  $('btnImportData').addEventListener('click', importData);
  $('importFileInput').addEventListener('change', handleFileImport);
  
  $('btnCalculate').addEventListener('click', () => calculate(false, false));
  $('btnSaveLog').addEventListener('click', () => calculate(false, true));
  
  btnClearRecords.addEventListener('click', clearRecords);
  $('btnPrintRecords').addEventListener('click', printRecords);
  $('monthFilter').addEventListener('change', renderRecords);

  $('btnNextDay').addEventListener('click', (e) => {
    e.preventDefault();
    const currentDate = $('dtrDate').value;
    if (currentDate) {
      let d = new Date(currentDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      
      if (settings.excludeWeekends) {
        while(d.getDay() === 0 || d.getDay() === 6) {
          d.setDate(d.getDate() + 1);
        }
      }
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const newDateStr = `${yyyy}-${mm}-${dd}`;
      previewLog(newDateStr);
    }
  });

  // Flatpickr handles the change event, so we don't strictly need this,  
  // but keep it as a fallback for direct value changes.
  $('dtrDate').addEventListener('change', e => {
    updateDayBadge(e.target.value);
    loadRecordForDate(e.target.value);
  });

  // Live time status hint
  ['morningIn','morningOut','afternoonIn','afternoonOut'].forEach(id => {
    $(id).addEventListener('change', updateAllTimeHints);
  });
}

function updateAllTimeHints() {
  const rawMorningIn = $('morningIn').value;
  if (rawMorningIn) {
    const raw = toMins(rawMorningIn);
    const adj = applyStartRule(raw);
    const official = toMins(settings.officialStartTime);
    const badge = $('morningInStatus');
    if (adj !== raw) {
      badge.textContent = 'Adjusted';
      badge.className = 'time-status adjusted';
    } else if (raw < official) {
      badge.textContent = 'Early';
      badge.className = 'time-status early';
    } else if (raw > official + settings.gracePeriod) {
      badge.textContent = 'Late';
      badge.className = 'time-status adjusted';
    } else {
      badge.className = 'time-status';
    }
  }
}

function previewLog(dateStr) {
  const fp = $('dtrDate')._flatpickr;
  if (fp) {
    fp.setDate(dateStr, true); // true triggers onChange which calls loadRecordForDate
  } else {
    $('dtrDate').value = dateStr;
    updateDayBadge(dateStr);
    loadRecordForDate(dateStr);
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  $('morningIn').focus();
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
