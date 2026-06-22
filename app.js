(() => {
  "use strict";

  const STORAGE_KEYS = {
    settings: "usrnsie:settings",
    streak: "usrnsie:streak",
    sessions: "usrnsie:sessions"
  };

  const DEFAULT_SETTINGS = { examDate: null, dailyGoal: 30, theme: "default", resource: "" };
  const DEFAULT_STREAK = { current: 0, longest: 0, lastStudiedDate: null, studyDays: [] };

  // ---------- storage helpers ----------
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return JSON.parse(JSON.stringify(fallback));
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`Could not read ${key}, using default.`, err);
      return JSON.parse(JSON.stringify(fallback));
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, readJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
  }
  function saveSettings(settings) {
    writeJSON(STORAGE_KEYS.settings, settings);
  }

  function getStreakData() {
    return Object.assign({}, DEFAULT_STREAK, readJSON(STORAGE_KEYS.streak, DEFAULT_STREAK));
  }
  function saveStreakData(streak) {
    writeJSON(STORAGE_KEYS.streak, streak);
  }

  function getSessions() {
    const sessions = readJSON(STORAGE_KEYS.sessions, []);
    return Array.isArray(sessions) ? sessions : [];
  }
  function saveSessions(sessions) {
    writeJSON(STORAGE_KEYS.sessions, sessions);
  }

  // ---------- date helpers ----------
  function todayStr() {
    return formatDateLocal(new Date());
  }

  function formatDateLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDateLocal(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function daysBetween(aStr, bStr) {
    const a = parseDateLocal(aStr);
    const b = parseDateLocal(bStr);
    return Math.round((b - a) / 86400000);
  }

  function formatLongDate(date) {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  // ---------- streak math (always recomputed from the full set of study days) ----------
  function computeStreak(studyDays) {
    const uniqueDays = Array.from(new Set(studyDays)).sort();
    if (uniqueDays.length === 0) return { current: 0, longest: 0 };

    let longest = 1;
    let runLength = 1;

    for (let i = 1; i < uniqueDays.length; i++) {
      const diff = daysBetween(uniqueDays[i - 1], uniqueDays[i]);
      runLength = diff === 1 ? runLength + 1 : 1;
      longest = Math.max(longest, runLength);
    }

    const lastDay = uniqueDays[uniqueDays.length - 1];
    const gapToToday = daysBetween(lastDay, todayStr());
    // Streak survives until a full day passes with no session: gap 0 = studied
    // today, gap 1 = studied yesterday and today isn't over yet.
    const current = gapToToday <= 1 ? runLength : 0;

    return { current, longest };
  }

  function refreshStreakFromSessions() {
    const sessions = getSessions();
    const uniqueDays = Array.from(new Set(sessions.map((s) => s.date))).sort();
    const { current, longest } = computeStreak(uniqueDays);
    const streak = {
      current,
      longest,
      lastStudiedDate: uniqueDays.length ? uniqueDays[uniqueDays.length - 1] : null,
      studyDays: uniqueDays
    };
    saveStreakData(streak);
    return streak;
  }

  // ---------- countdown ----------
  function renderCountdown() {
    const card = document.getElementById("countdown-card");
    const settings = getSettings();
    const hasDate = Boolean(settings.examDate);

    let heroBlock;
    if (!hasDate) {
      heroBlock = `
        <div class="hero-label">${formatLongDate(new Date())}</div>
        <div class="hero-sub">Set your exam date to start the countdown.</div>
      `;
    } else {
      const diff = daysBetween(todayStr(), settings.examDate);
      let sub;
      if (diff > 1) sub = `${diff} days to go`;
      else if (diff === 1) sub = "1 day to go";
      else if (diff === 0) sub = "Exam day is today — good luck";
      else sub = `Exam day was ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} ago`;

      heroBlock = `
        <div class="hero-label">Exam countdown</div>
        <div class="hero-number">${Math.abs(diff)}</div>
        <div class="hero-sub">${sub}</div>
      `;
    }

    card.innerHTML = `
      <div class="hero">
        ${heroBlock}
        <div class="inline-edit">
          <label for="exam-date-input">Exam date</label>
          <input type="date" id="exam-date-input" value="${hasDate ? settings.examDate : ""}" />
          ${hasDate ? '<button class="tiny-btn" id="clear-exam-date-btn" type="button">Clear</button>' : ""}
        </div>
      </div>
    `;

    document.getElementById("exam-date-input").addEventListener("change", (e) => {
      const s = getSettings();
      s.examDate = e.target.value || null;
      saveSettings(s);
      renderCountdown();
    });

    const clearBtn = document.getElementById("clear-exam-date-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        const s = getSettings();
        s.examDate = null;
        saveSettings(s);
        renderCountdown();
      });
    }
  }

  // ---------- shared Reference-B style progress card (curved line + glow) ----------
  const PROGRESS_CURVE_PATH = "M5,50 C90,10 210,10 295,50";

  function progressCurveSvg(status) {
    return `
      <svg class="progress-curve" viewBox="0 0 300 70" preserveAspectRatio="none">
        <path class="track" d="${PROGRESS_CURVE_PATH}" />
        <path class="fill status-${status}" d="${PROGRESS_CURVE_PATH}" />
      </svg>
    `;
  }

  function setupCurveFill(card, pct) {
    const path = card.querySelector(".progress-curve .fill");
    const len = path.getTotalLength();
    const clamped = Math.max(0, Math.min(1, pct));
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len * (1 - clamped)}`;
  }

  // ---------- streak + goal ----------
  function renderStreak() {
    const card = document.getElementById("streak-card");
    const settings = getSettings();
    const streak = getStreakData();
    const sessions = getSessions();
    const today = todayStr();
    const attemptedToday = sessions
      .filter((s) => s.date === today)
      .reduce((sum, s) => sum + s.attempted, 0);
    const goal = settings.dailyGoal || 0;
    const todaysFill = goal > 0 ? attemptedToday / goal : 0;

    let status;
    if (streak.current === 0) status = "red";
    else if (streak.current <= 2) status = "amber";
    else status = "green";

    card.className = `card progress-card status-${status}`;
    card.innerHTML = `
      <div class="progress-card-top">🔥 <span>Daily streak</span></div>
      ${progressCurveSvg(status)}
      <div class="progress-status-line">${streak.current} ${streak.current === 1 ? "day" : "days"} in a row</div>
      <div class="progress-substatus">${attemptedToday}/${goal || "—"} questions today · longest ${streak.longest}</div>
      <div class="inline-edit">
        <label for="daily-goal-input">Daily goal</label>
        <input type="number" id="daily-goal-input" min="1" step="1" value="${goal}" />
      </div>
    `;

    setupCurveFill(card, todaysFill);

    document.getElementById("daily-goal-input").addEventListener("change", (e) => {
      const value = parseInt(e.target.value, 10);
      const s = getSettings();
      s.dailyGoal = Number.isFinite(value) && value > 0 ? value : s.dailyGoal;
      saveSettings(s);
      renderStreak();
    });
  }

  // ---------- readiness band ----------
  function computeReadiness() {
    const sessions = getSessions();
    const totals = sessions.reduce(
      (acc, s) => {
        acc.attempted += s.attempted;
        acc.correct += s.correct;
        return acc;
      },
      { attempted: 0, correct: 0 }
    );

    if (totals.attempted === 0) {
      return { hasData: false, pct: 0, band: null, status: "neutral" };
    }

    const pct = totals.correct / totals.attempted;
    let band, status;
    if (pct < 0.6) {
      band = "Low";
      status = "red";
    } else if (pct < 0.7) {
      band = "Borderline";
      status = "amber";
    } else if (pct < 0.85) {
      band = "High";
      status = "green";
    } else {
      band = "Very High";
      status = "green";
    }

    return { hasData: true, pct, band, status };
  }

  function renderReadiness() {
    const card = document.getElementById("readiness-card");
    if (!card) return;

    const settings = getSettings();
    const readiness = computeReadiness();

    let daysText = "";
    if (settings.examDate) {
      const diff = daysBetween(todayStr(), settings.examDate);
      if (diff > 0) daysText = ` · ${diff} day${diff === 1 ? "" : "s"} to exam`;
      else if (diff === 0) daysText = " · exam day is today";
      else daysText = " · exam date passed";
    }

    const statusLine = readiness.hasData
      ? `${readiness.band} readiness${daysText}`
      : `Log a session to see your readiness${daysText}`;

    const substatus = readiness.hasData
      ? `${Math.round(readiness.pct * 100)}% overall accuracy`
      : "Based on overall accuracy across logged sessions";

    card.className = `card progress-card status-${readiness.status}`;
    card.innerHTML = `
      <div class="progress-card-top">🎯 <span>Readiness band</span></div>
      ${progressCurveSvg(readiness.status)}
      <div class="progress-status-line">${statusLine}</div>
      <div class="progress-substatus">${substatus}</div>
    `;

    setupCurveFill(card, readiness.hasData ? readiness.pct : 0);
  }

  // ---------- encouragement ----------
  const ENCOURAGEMENT_LINES = [
    "You've got this 💪",
    "Small steps still move you forward.",
    "Future-you is already proud of today's work.",
    "Progress, not perfection.",
    "One more session, one step closer."
  ];

  function renderEncouragement() {
    const el = document.getElementById("encouragement-card");
    if (!el) return;
    const dayIndex = Math.floor(Date.now() / 86400000);
    el.textContent = ENCOURAGEMENT_LINES[dayIndex % ENCOURAGEMENT_LINES.length];
  }

  // ---------- tab navigation ----------
  function showScreen(tab) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.hidden = el.dataset.screen !== tab;
    });
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    if (tab === "progress") renderReadiness();
  }

  function initNav() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => showScreen(btn.dataset.tab));
    });
    showScreen("home");
  }

  // ---------- log a session ----------
  function populateSubjectSelect() {
    const select = document.getElementById("session-subject");
    select.innerHTML = SUBJECT_GROUPS.map((g) => {
      const options = g.items
        .map((item) => `<option value="${item.id}">${item.label}</option>`)
        .join("");
      return `<optgroup label="${g.group}">${options}</optgroup>`;
    }).join("");
  }

  function subjectLabel(id) {
    for (const g of SUBJECT_GROUPS) {
      const found = g.items.find((item) => item.id === id);
      if (found) return found.label;
    }
    return id;
  }

  function updateAccuracyPreview() {
    const attempted = parseInt(document.getElementById("session-attempted").value, 10);
    const correct = parseInt(document.getElementById("session-correct").value, 10);
    const preview = document.getElementById("accuracy-preview");
    if (Number.isFinite(attempted) && attempted > 0 && Number.isFinite(correct) && correct >= 0) {
      preview.textContent = `${Math.round((correct / attempted) * 100)}% correct`;
    } else {
      preview.textContent = "";
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderSessionList() {
    const list = document.getElementById("session-list");
    const sessions = getSessions()
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 10);

    if (sessions.length === 0) {
      list.innerHTML = `<li class="empty-state">No sessions logged yet.</li>`;
      return;
    }

    list.innerHTML = sessions
      .map((s) => {
        const pct = s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0;
        return `
          <li class="session-item">
            <div class="session-top">
              <span>${escapeHtml(subjectLabel(s.subjectId))}</span>
              <span>${pct}%</span>
            </div>
            <div class="session-meta">${formatLongDate(parseDateLocal(s.date))} · ${s.correct}/${s.attempted} correct</div>
            ${s.note ? `<div class="session-note">${escapeHtml(s.note)}</div>` : ""}
          </li>
        `;
      })
      .join("");
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function handleSessionSubmit(event) {
    event.preventDefault();
    const errorEl = document.getElementById("session-error");
    errorEl.textContent = "";

    const date = document.getElementById("session-date").value;
    const subjectId = document.getElementById("session-subject").value;
    const attempted = parseInt(document.getElementById("session-attempted").value, 10);
    const correct = parseInt(document.getElementById("session-correct").value, 10);
    const note = document.getElementById("session-note").value.trim();

    if (!date) {
      errorEl.textContent = "Pick a date.";
      return;
    }
    if (!subjectId) {
      errorEl.textContent = "Pick a subject.";
      return;
    }
    if (!Number.isFinite(attempted) || attempted < 1) {
      errorEl.textContent = "Questions attempted must be at least 1.";
      return;
    }
    if (!Number.isFinite(correct) || correct < 0) {
      errorEl.textContent = "Correct can't be negative.";
      return;
    }
    if (correct > attempted) {
      errorEl.textContent = "Correct can't be more than attempted.";
      return;
    }

    const sessions = getSessions();
    sessions.push({ id: generateId(), date, subjectId, attempted, correct, note });
    saveSessions(sessions);
    refreshStreakFromSessions();

    document.getElementById("session-form").reset();
    document.getElementById("session-date").value = todayStr();
    document.getElementById("accuracy-preview").textContent = "";

    renderStreak();
    renderSessionList();
  }

  // ---------- export / import backup ----------
  function exportBackup() {
    const data = {};
    Object.values(STORAGE_KEYS).forEach((storageKey) => {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) data[storageKey] = JSON.parse(raw);
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usrnsie-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    const errorEl = document.getElementById("backup-error");
    const successEl = document.getElementById("backup-success");
    errorEl.textContent = "";
    successEl.textContent = "";

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const knownKeys = Object.values(STORAGE_KEYS);
        const hasKnownKey = typeof data === "object" && data !== null && knownKeys.some((key) => key in data);
        if (!hasKnownKey) {
          throw new Error("This file doesn't look like a USRNsie backup.");
        }

        const ok = window.confirm("This replaces your current data with the backup. Continue?");
        if (!ok) return;

        knownKeys.forEach((key) => {
          if (key in data) localStorage.setItem(key, JSON.stringify(data[key]));
        });

        successEl.textContent = "Backup restored. Reloading…";
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        errorEl.textContent = err.message || "Could not read that file.";
      }
    };
    reader.onerror = () => {
      errorEl.textContent = "Could not read that file.";
    };
    reader.readAsText(file);
  }

  // ---------- init ----------
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Service worker failed to register", err);
      });
    }
  }

  function init() {
    populateSubjectSelect();
    document.getElementById("session-date").value = todayStr();

    renderCountdown();
    renderStreak();
    renderSessionList();
    renderEncouragement();
    renderReadiness();
    initNav();

    document.getElementById("session-form").addEventListener("submit", handleSessionSubmit);
    document.getElementById("session-attempted").addEventListener("input", updateAccuracyPreview);
    document.getElementById("session-correct").addEventListener("input", updateAccuracyPreview);

    document.getElementById("export-btn").addEventListener("click", exportBackup);
    document.getElementById("import-input").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importBackup(file);
      e.target.value = "";
    });

    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
