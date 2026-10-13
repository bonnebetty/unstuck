/**
 * Unstuck — Learning Support Companion
 * Vanilla JavaScript (No frameworks, No external APIs, LocalStorage persistence)
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // CONSTANTS & TAXONOMY DATA
  // ---------------------------------------------------------------------------

  const STORAGE_KEY = 'unstuck_confusions_v1';

  // Q2: Detailed confusion sub-options
  const Q2_OPTIONS_MAP = {
    meaning: [
      "I don't understand some terms.",
      "I don't understand what this concept means.",
      "I don't understand what the material is saying."
    ],
    logic: [
      "I couldn't follow the explanation.",
      "I don't understand why this conclusion follows.",
      "I understand individual steps, but not the overall reasoning."
    ],
    connection: [
      "I can't connect this to what I already know.",
      "I can't distinguish it from similar concepts.",
      "I don't understand how different ideas relate."
    ],
    application: [
      "I understand the idea but don't know how to use it.",
      "I don't know how to start the task.",
      "I don't understand what the assignment requires."
    ],
    uncertain: [
      "I'm not sure exactly what I don't understand.",
      "I'm not sure whether my understanding is correct.",
      "I feel lost and don't know where to start."
    ]
  };

  // Q3: Detailed help preference sub-options
  const Q3_OPTIONS_MAP = {
    explain: [
      "Explain the concept in a different way.",
      "Explain an unfamiliar term.",
      "Walk through the explanation again."
    ],
    example: [
      "Give me a concrete example.",
      "Give me a real-world example.",
      "Show me a counterexample."
    ],
    connect: [
      "Compare two similar concepts.",
      "Explain how different concepts relate.",
      "Connect this topic to something I already know."
    ],
    guide: [
      "Walk me through the steps.",
      "Show me how to apply the concept.",
      "Help me figure out where to start."
    ],
    check: [
      "Check whether my understanding is correct.",
      "Give feedback on my reasoning.",
      "Confirm whether I'm approaching the task correctly."
    ]
  };

  // Date & Time formatting helper (e.g., "Oct 12, 2026 · 2:15 PM")
  function formatDateTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${dateStr} · ${timeStr}`;
  }

  // Initial Sample Cards
  const INITIAL_SAMPLE_CARDS = [
    {
      id: 'sample-1',
      source: 'Slides / PPT',
      quickNote: 'Slide 12 — Schema Theory',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      statusUpdatedAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      status: 'Partially Resolved',
      q1Understanding: 'I understand that schemas are organized knowledge structures.',
      q1Unsure: false,
      q2StuckOptions: ["I don't understand why this conclusion follows."],
      q2PrimaryConcern: null,
      q3HelpPreferences: ['Give me a concrete example.'],
      studentQuestion: 'Could you give an example of how schemas are organized when learning new concepts?'
    },
    {
      id: 'sample-2',
      source: "Teacher's Explanation",
      quickNote: 'Gradient descent learning rate alpha',
      createdAt: new Date(Date.now() - 14400000).toISOString(),
      statusUpdatedAt: new Date(Date.now() - 10800000).toISOString(),
      updatedAt: new Date(Date.now() - 10800000).toISOString(),
      status: 'Need Help',
      q1Understanding: '',
      q1Unsure: true,
      q2StuckOptions: ["I don't understand some terms."],
      q2PrimaryConcern: null,
      q3HelpPreferences: ['Explain an unfamiliar term.'],
      studentQuestion: ''
    }
  ];

  // ---------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ---------------------------------------------------------------------------

  let confusions = [];
  let currentActiveId = null;
  let activeQ2Category = null;
  let activeQ3Category = null;
  let isQuestionSectionOpen = false;
  let isHintOpen = false;
  let isSampleOpen = false;
  let cardPendingDeleteId = null;

  // ---------------------------------------------------------------------------
  // STORAGE FUNCTIONS
  // ---------------------------------------------------------------------------

  function loadConfusions() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        confusions = JSON.parse(stored);
      } else {
        // Preload sample cards on first launch
        confusions = JSON.parse(JSON.stringify(INITIAL_SAMPLE_CARDS));
        saveConfusions();
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
      confusions = JSON.parse(JSON.stringify(INITIAL_SAMPLE_CARDS));
    }

    // Ensure all confusions have createdAt and status timestamps
    let modified = false;
    confusions.forEach(c => {
      if (!c.createdAt) {
        c.createdAt = new Date().toISOString();
        modified = true;
      }
      if (!c.status) {
        c.status = 'Not Reviewed';
        modified = true;
      }
    });
    if (modified) saveConfusions();
  }

  function saveConfusions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(confusions));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  function getActiveConfusion() {
    return confusions.find(c => c.id === currentActiveId) || null;
  }

  function updateActiveConfusion(updates) {
    const item = getActiveConfusion();
    if (!item) return;
    Object.assign(item, updates);
    item.updatedAt = new Date().toISOString();
    saveConfusions();
  }

  // ---------------------------------------------------------------------------
  // VIEW NAVIGATION (Home, Add, Detail)
  // ---------------------------------------------------------------------------

  const viewHome = document.getElementById('view-home');
  const viewAdd = document.getElementById('view-add');
  const viewDetail = document.getElementById('view-detail');

  function showView(viewName, confusionId) {
    viewHome.classList.remove('active');
    viewAdd.classList.remove('active');
    viewDetail.classList.remove('active');

    window.scrollTo({ top: 0, behavior: 'instant' });

    if (viewName === 'add') {
      viewAdd.classList.add('active');
      resetAddForm();
    } else if (viewName === 'detail') {
      currentActiveId = confusionId;
      viewDetail.classList.add('active');
      renderDetailView();
    } else {
      // Default: Home
      currentActiveId = null;
      viewHome.classList.add('active');
      renderHomeCards();
    }
  }

  // ---------------------------------------------------------------------------
  // VIEW 1: HOME CONTROLLER
  // ---------------------------------------------------------------------------

  const confusionsListEl = document.getElementById('confusions-list');
  const emptyStateEl = document.getElementById('empty-state');

  function renderHomeCards() {
    confusionsListEl.innerHTML = '';

    if (confusions.length === 0) {
      emptyStateEl.style.display = 'block';
      confusionsListEl.style.display = 'none';
      return;
    }

    emptyStateEl.style.display = 'none';
    confusionsListEl.style.display = 'flex';

    confusions.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'confusion-card';
      cardEl.setAttribute('role', 'listitem');
      cardEl.tabIndex = 0;

      const sourceLabel = card.source || 'General';
      const statusLabel = card.status || 'Not Reviewed';
      const createdFormatted = formatDateTime(card.createdAt);

      // Question prepared preview
      let questionPreviewHtml = '';
      if (card.studentQuestion && card.studentQuestion.trim()) {
        questionPreviewHtml = `
          <div class="card-meta-row" style="color: var(--accent-hover); font-weight: 500;">
            <span>✎ My Question: “${escapeHtml(card.studentQuestion)}”</span>
          </div>
        `;
      }

      // Build timestamps display: Created time + Status marked time if marked
      let timestampsHtml = `<span class="card-date-time" title="Captured time">Created: ${escapeHtml(createdFormatted)}</span>`;
      if (card.statusUpdatedAt && card.status !== 'Not Reviewed') {
        const markedFormatted = formatDateTime(card.statusUpdatedAt);
        timestampsHtml += `<span class="card-status-time" title="Status marked time">Marked: ${escapeHtml(markedFormatted)}</span>`;
      }

      cardEl.innerHTML = `
        <div class="card-top-row">
          <span class="card-source-badge">${escapeHtml(sourceLabel)}</span>
          <div class="card-timestamps-group">
            ${timestampsHtml}
          </div>
        </div>
        <div class="card-note-text">${escapeHtml(card.quickNote)}</div>
        ${questionPreviewHtml}
        <div class="card-status-bar">
          <span class="card-status-label">Mark Status:</span>
          <button type="button" class="card-status-btn ${statusLabel === 'Not Reviewed' ? 'active status-not-reviewed' : ''}" data-set-status="Not Reviewed">Not Reviewed</button>
          <button type="button" class="card-status-btn ${statusLabel === 'Need Help' ? 'active status-need-help' : ''}" data-set-status="Need Help">Need Help</button>
          <button type="button" class="card-status-btn ${statusLabel === 'Partially Resolved' ? 'active status-partially-resolved' : ''}" data-set-status="Partially Resolved">Partially</button>
          <button type="button" class="card-status-btn ${statusLabel === 'Resolved' ? 'active status-resolved' : ''}" data-set-status="Resolved">Resolved</button>
        </div>
      `;

      // Status buttons inside card (Marking confusion records time automatically)
      cardEl.querySelectorAll('.card-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetStatus = btn.getAttribute('data-set-status');
          const nowIso = new Date().toISOString();
          card.status = targetStatus;
          card.statusUpdatedAt = nowIso;
          card.updatedAt = nowIso;
          saveConfusions();
          renderHomeCards();
          showToast(`Marked as "${targetStatus}"`);
        });
      });

      cardEl.addEventListener('click', () => {
        showView('detail', card.id);
      });

      cardEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showView('detail', card.id);
        }
      });

      confusionsListEl.appendChild(cardEl);
    });
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: ADD CONFUSION CONTROLLER
  // ---------------------------------------------------------------------------

  const formAddEl = document.getElementById('form-add-confusion');
  const inputQuickNoteEl = document.getElementById('input-quick-note');
  const categoryPillsContainer = document.getElementById('category-pills');
  let selectedCategory = '';

  function resetAddForm() {
    inputQuickNoteEl.value = '';
    selectedCategory = '';
    const btns = categoryPillsContainer.querySelectorAll('.category-btn');
    btns.forEach(btn => btn.classList.remove('selected'));
    inputQuickNoteEl.focus();
  }

  categoryPillsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (!btn) return;
    const cat = btn.getAttribute('data-category');

    const btns = categoryPillsContainer.querySelectorAll('.category-btn');
    if (selectedCategory === cat) {
      // Deselect
      selectedCategory = '';
      btn.classList.remove('selected');
    } else {
      selectedCategory = cat;
      btns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    }
  });

  formAddEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const noteText = inputQuickNoteEl.value.trim();
    if (!noteText) {
      inputQuickNoteEl.focus();
      return;
    }

    const nowIso = new Date().toISOString();
    const newConfusion = {
      id: 'c_' + Date.now(),
      source: selectedCategory || 'General',
      quickNote: noteText,
      createdAt: nowIso,
      statusUpdatedAt: null,
      updatedAt: nowIso,
      status: 'Not Reviewed',
      q1Understanding: '',
      q1Unsure: false,
      q2StuckOptions: [],
      q2PrimaryConcern: null,
      q3HelpPreferences: [],
      studentQuestion: ''
    };

    confusions.unshift(newConfusion);
    saveConfusions();
    showView('home');
    showToast('Saved to My Confusions!');
  });

  document.getElementById('btn-cancel-add').addEventListener('click', () => {
    showView('home');
  });

  document.getElementById('btn-back-from-add').addEventListener('click', () => {
    showView('home');
  });

  document.getElementById('btn-open-add').addEventListener('click', () => {
    showView('add');
  });

  document.getElementById('btn-empty-add').addEventListener('click', () => {
    showView('add');
  });

  // Reset sample data link in footer
  document.getElementById('btn-reset-data').addEventListener('click', () => {
    if (confirm('Reset to the initial 2 sample confusions? This will replace your current cards.')) {
      confusions = JSON.parse(JSON.stringify(INITIAL_SAMPLE_CARDS));
      saveConfusions();
      renderHomeCards();
      showToast('Sample confusions reloaded');
    }
  });

  // ---------------------------------------------------------------------------
  // VIEW 3: CLARIFY & DETAIL CONTROLLER
  // ---------------------------------------------------------------------------

  const detailSourceBadgeEl = document.getElementById('detail-source-badge');
  const detailOriginalNoteEl = document.getElementById('detail-original-note');
  const detailDatetimeBadgeEl = document.getElementById('detail-datetime-badge');

  // Q1 elements
  const q1TextareaEl = document.getElementById('q1-textarea');
  const q1UnsureCheckboxEl = document.getElementById('q1-unsure-checkbox');

  // Q2 elements
  const q2KeywordsContainer = document.getElementById('q2-keywords');
  const q2SubOptionsBox = document.getElementById('q2-sub-options-box');
  const q2SelectedTagsContainer = document.getElementById('q2-selected-tags');
  const q2PrimaryConcernBox = document.getElementById('q2-primary-concern-box');
  const q2PrimaryConcernOptions = document.getElementById('q2-primary-concern-options');

  // Q3 elements
  const q3KeywordsContainer = document.getElementById('q3-keywords');
  const q3SubOptionsBox = document.getElementById('q3-sub-options-box');
  const q3SelectedTagsContainer = document.getElementById('q3-selected-tags');

  // Recommendations elements
  const recommendationsContent = document.getElementById('recommendations-content');

  // Question Scaffolding elements (Collapsible, hidden by default)
  const btnToggleQuestionSection = document.getElementById('btn-toggle-question-section');
  const questionSectionChevron = document.getElementById('question-section-chevron');
  const questionSectionBody = document.getElementById('question-section-body');
  const questionSavedIndicator = document.getElementById('question-saved-indicator');

  const studentQuestionTextarea = document.getElementById('student-question-textarea');
  const btnSaveStudentQuestion = document.getElementById('btn-save-student-question');

  const btnToggleHint = document.getElementById('btn-toggle-hint');
  const hintContainer = document.getElementById('hint-container');
  const hintSectionsList = document.getElementById('hint-sections-list');

  const btnToggleSample = document.getElementById('btn-toggle-sample');
  const sampleQuestionContainer = document.getElementById('sample-question-container');
  const sampleQuestionText = document.getElementById('sample-question-text');
  const btnCopySample = document.getElementById('btn-copy-sample');

  function renderDetailView() {
    const card = getActiveConfusion();
    if (!card) {
      showView('home');
      return;
    }

    // Reset interaction sub-states for a fresh card visit
    activeQ2Category = null;
    activeQ3Category = null;
    isQuestionSectionOpen = false;
    isHintOpen = false;
    isSampleOpen = false;

    // Header card
    detailSourceBadgeEl.textContent = card.source || 'General';
    detailOriginalNoteEl.textContent = card.quickNote;
    if (detailDatetimeBadgeEl) {
      detailDatetimeBadgeEl.textContent = `Captured: ${formatDateTime(card.createdAt)}`;
    }

    // Q1 Populate
    q1TextareaEl.value = card.q1Understanding || '';
    q1UnsureCheckboxEl.checked = !!card.q1Unsure;
    q1TextareaEl.disabled = !!card.q1Unsure;

    // Q2 Render
    renderQ2Keywords();
    renderQ2SubOptions();
    renderQ2SelectedTags();
    renderQ2PrimaryConcern();

    // Q3 Render
    renderQ3Keywords();
    renderQ3SubOptions();
    renderQ3SelectedTags();

    // Render Recommendations (Rule-based)
    renderRecommendations();

    // Question Preparation Section state: Hidden by default
    updateQuestionSectionCollapse();

    // Student Question Textarea
    studentQuestionTextarea.value = card.studentQuestion || '';
    updateQuestionSavedBadge();

    // Hint and Sample hidden by default
    hintContainer.style.display = 'none';
    sampleQuestionContainer.style.display = 'none';
  }

  // --- Q1 Handlers ---
  q1TextareaEl.addEventListener('input', () => {
    updateActiveConfusion({ q1Understanding: q1TextareaEl.value });
    renderRecommendations();
    if (isHintOpen) renderHints();
  });

  q1UnsureCheckboxEl.addEventListener('change', () => {
    const isUnsure = q1UnsureCheckboxEl.checked;
    q1TextareaEl.disabled = isUnsure;
    if (isUnsure) {
      q1TextareaEl.value = '';
    }
    updateActiveConfusion({
      q1Unsure: isUnsure,
      q1Understanding: isUnsure ? '' : q1TextareaEl.value
    });
    renderRecommendations();
    if (isHintOpen) renderHints();
  });

  // --- Q2 Progressive Disclosure ---
  function renderQ2Keywords() {
    const btns = q2KeywordsContainer.querySelectorAll('.keyword-btn');
    btns.forEach(btn => {
      const cat = btn.getAttribute('data-q2-cat');
      btn.classList.toggle('active', cat === activeQ2Category);
    });
  }

  q2KeywordsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.keyword-btn');
    if (!btn) return;
    const cat = btn.getAttribute('data-q2-cat');

    if (activeQ2Category === cat) {
      // Toggle close
      activeQ2Category = null;
    } else {
      activeQ2Category = cat;
    }

    renderQ2Keywords();
    renderQ2SubOptions();
  });

  function renderQ2SubOptions() {
    if (!activeQ2Category || !Q2_OPTIONS_MAP[activeQ2Category]) {
      q2SubOptionsBox.style.display = 'none';
      q2SubOptionsBox.innerHTML = '';
      return;
    }

    q2SubOptionsBox.style.display = 'flex';
    q2SubOptionsBox.innerHTML = '';

    const card = getActiveConfusion();
    const selectedList = card ? (card.q2StuckOptions || []) : [];
    const options = Q2_OPTIONS_MAP[activeQ2Category];

    options.forEach(optText => {
      const isSelected = selectedList.includes(optText);
      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.className = 'sub-option-btn' + (isSelected ? ' selected' : '');
      optBtn.textContent = optText;

      optBtn.addEventListener('click', () => {
        handleQ2OptionToggle(optText);
      });

      q2SubOptionsBox.appendChild(optBtn);
    });
  }

  function handleQ2OptionToggle(optText) {
    const card = getActiveConfusion();
    if (!card) return;

    let list = Array.isArray(card.q2StuckOptions) ? [...card.q2StuckOptions] : [];

    if (list.includes(optText)) {
      list = list.filter(item => item !== optText);
    } else {
      // Allow multi-select up to 2 options maximum
      if (list.length >= 2) {
        showToast('You can select up to 2 options. Tap a selected one to replace it.');
        return;
      }
      list.push(optText);
    }

    // Check primary concern sanity
    let primary = card.q2PrimaryConcern;
    if (!list.includes(primary)) {
      primary = null;
    }

    updateActiveConfusion({ q2StuckOptions: list, q2PrimaryConcern: primary });
    renderQ2SubOptions();
    renderQ2SelectedTags();
    renderQ2PrimaryConcern();
    renderRecommendations();
    if (isHintOpen) renderHints();
  }

  function renderQ2SelectedTags() {
    const card = getActiveConfusion();
    const list = card ? (card.q2StuckOptions || []) : [];
    q2SelectedTagsContainer.innerHTML = '';

    list.forEach(optText => {
      const tag = document.createElement('span');
      tag.className = 'selected-tag';
      tag.innerHTML = `
        <span>${escapeHtml(optText)}</span>
        <span class="remove-tag-btn" role="button" aria-label="Remove tag">&times;</span>
      `;
      tag.querySelector('.remove-tag-btn').addEventListener('click', () => {
        handleQ2OptionToggle(optText);
      });
      q2SelectedTagsContainer.appendChild(tag);
    });
  }

  function renderQ2PrimaryConcern() {
    const card = getActiveConfusion();
    const list = card ? (card.q2StuckOptions || []) : [];

    if (list.length === 2) {
      q2PrimaryConcernBox.style.display = 'block';
      q2PrimaryConcernOptions.innerHTML = '';

      list.forEach((optText) => {
        const isChecked = card.q2PrimaryConcern === optText;
        const label = document.createElement('label');
        label.className = 'radio-row';
        label.innerHTML = `
          <input type="radio" name="q2_primary_radio" value="${escapeHtml(optText)}" ${isChecked ? 'checked' : ''} />
          <span>${escapeHtml(optText)}</span>
        `;
        label.querySelector('input').addEventListener('change', () => {
          updateActiveConfusion({ q2PrimaryConcern: optText });
          renderRecommendations();
          if (isHintOpen) renderHints();
        });
        q2PrimaryConcernOptions.appendChild(label);
      });
    } else {
      q2PrimaryConcernBox.style.display = 'none';
      q2PrimaryConcernOptions.innerHTML = '';
    }
  }

  // --- Q3 Progressive Disclosure (Multi-select up to 2 options) ---
  function renderQ3Keywords() {
    const btns = q3KeywordsContainer.querySelectorAll('.keyword-btn');
    btns.forEach(btn => {
      const cat = btn.getAttribute('data-q3-cat');
      btn.classList.toggle('active', cat === activeQ3Category);
    });
  }

  q3KeywordsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.keyword-btn');
    if (!btn) return;
    const cat = btn.getAttribute('data-q3-cat');

    if (activeQ3Category === cat) {
      activeQ3Category = null;
    } else {
      activeQ3Category = cat;
    }

    renderQ3Keywords();
    renderQ3SubOptions();
  });

  function renderQ3SubOptions() {
    if (!activeQ3Category || !Q3_OPTIONS_MAP[activeQ3Category]) {
      q3SubOptionsBox.style.display = 'none';
      q3SubOptionsBox.innerHTML = '';
      return;
    }

    q3SubOptionsBox.style.display = 'flex';
    q3SubOptionsBox.innerHTML = '';

    const card = getActiveConfusion();
    const currentList = card ? (card.q3HelpPreferences || []) : [];
    const options = Q3_OPTIONS_MAP[activeQ3Category];

    options.forEach(optText => {
      const isSelected = currentList.includes(optText);
      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.className = 'sub-option-btn' + (isSelected ? ' selected' : '');
      optBtn.textContent = optText;

      optBtn.addEventListener('click', () => {
        handleQ3OptionToggle(optText);
      });

      q3SubOptionsBox.appendChild(optBtn);
    });
  }

  function handleQ3OptionToggle(optText) {
    const card = getActiveConfusion();
    if (!card) return;

    let list = Array.isArray(card.q3HelpPreferences) ? [...card.q3HelpPreferences] : [];

    if (list.includes(optText)) {
      list = list.filter(item => item !== optText);
    } else {
      // Allow multi-select up to 2 preferences
      if (list.length >= 2) {
        showToast('You can select up to 2 help preferences. Tap a selected one to replace it.');
        return;
      }
      list.push(optText);
    }

    updateActiveConfusion({ q3HelpPreferences: list });
    renderQ3SubOptions();
    renderQ3SelectedTags();
    renderRecommendations();
    if (isHintOpen) renderHints();
  }

  function renderQ3SelectedTags() {
    const card = getActiveConfusion();
    const list = card ? (card.q3HelpPreferences || []) : [];
    q3SelectedTagsContainer.innerHTML = '';

    list.forEach(optText => {
      const tag = document.createElement('span');
      tag.className = 'selected-tag';
      tag.innerHTML = `
        <span>${escapeHtml(optText)}</span>
        <span class="remove-tag-btn" role="button" aria-label="Remove tag">&times;</span>
      `;
      tag.querySelector('.remove-tag-btn').addEventListener('click', () => {
        handleQ3OptionToggle(optText);
      });
      q3SelectedTagsContainer.appendChild(tag);
    });
  }

  // --- Rule-Based Recommendations (Displayed before Prepare My Question) ---
  function renderRecommendations() {
    const card = getActiveConfusion();
    if (!card) return;

    let primaryCat = null;
    const stuckList = card.q2StuckOptions || [];
    for (const [catKey, options] of Object.entries(Q2_OPTIONS_MAP)) {
      if (stuckList.some(s => options.includes(s))) {
        primaryCat = catKey;
        break;
      }
    }

    const recMap = {
      meaning: "Ask the instructor or a classmate for a simpler, everyday analogy, or review the course glossary definitions.",
      logic: "Ask for a step-by-step walkthrough or work through another concrete example slowly together.",
      connection: "Try comparing the two concepts side by side, or sketch a quick 2-box concept diagram showing how they link.",
      application: "Ask to see one completed worked example, or walk through just the very first step during office hours.",
      uncertain: "Ask someone to help identify the very first sentence or slide where you started to feel lost."
    };

    const helpList = Array.isArray(card.q3HelpPreferences) ? card.q3HelpPreferences : [];

    let html = '';
    if (helpList.length > 0) {
      html += `<div class="rec-item"><strong>Your requested help:</strong> ${helpList.map(h => escapeHtml(h)).join(' · ')}</div>`;
    }

    const suggestion = (primaryCat && recMap[primaryCat])
      ? recMap[primaryCat]
      : "Ask someone to help you pinpoint where the explanation first stopped making sense.";

    html += `<div class="rec-item"><strong>Suggested approach:</strong> ${escapeHtml(suggestion)}</div>`;

    recommendationsContent.innerHTML = html;
  }

  // --- PREPARE MY QUESTION: COLLAPSIBLE & PROGRESSIVE SCAFFOLDING ---

  function updateQuestionSectionCollapse() {
    if (isQuestionSectionOpen) {
      questionSectionBody.style.display = 'block';
      questionSectionChevron.classList.add('open');
      btnToggleQuestionSection.setAttribute('aria-expanded', 'true');
    } else {
      questionSectionBody.style.display = 'none';
      questionSectionChevron.classList.remove('open');
      btnToggleQuestionSection.setAttribute('aria-expanded', 'false');
    }
  }

  function updateQuestionSavedBadge() {
    const card = getActiveConfusion();
    const hasQuestion = card && card.studentQuestion && card.studentQuestion.trim().length > 0;
    if (hasQuestion) {
      questionSavedIndicator.style.display = 'inline-block';
    } else {
      questionSavedIndicator.style.display = 'none';
    }
  }

  // Toggle button for the entire "Prepare My Question" section (Hidden by default)
  btnToggleQuestionSection.addEventListener('click', () => {
    isQuestionSectionOpen = !isQuestionSectionOpen;
    updateQuestionSectionCollapse();
  });

  // Student's own textarea live persistence
  studentQuestionTextarea.addEventListener('input', () => {
    updateActiveConfusion({ studentQuestion: studentQuestionTextarea.value });
    updateQuestionSavedBadge();
  });

  // Save button
  btnSaveStudentQuestion.addEventListener('click', () => {
    const qText = studentQuestionTextarea.value.trim();
    updateActiveConfusion({ studentQuestion: qText });
    updateQuestionSavedBadge();
    showToast('Your question was saved!');
  });

  // --- SCAFFOLDING 2: NEED A HINT? ---
  btnToggleHint.addEventListener('click', () => {
    isHintOpen = !isHintOpen;
    if (isHintOpen) {
      hintContainer.style.display = 'block';
      renderHints();
    } else {
      hintContainer.style.display = 'none';
    }
  });

  function renderHints() {
    const card = getActiveConfusion();
    if (!card) return;

    hintSectionsList.innerHTML = '';
    let hasAnyResponse = false;

    // What I know (from Q1)
    if (!card.q1Unsure && card.q1Understanding && card.q1Understanding.trim()) {
      hasAnyResponse = true;
      const block = document.createElement('div');
      block.className = 'hint-block';
      block.innerHTML = `
        <span class="hint-block-label">&bull; What I know</span>
        <p class="hint-block-content">${escapeHtml(card.q1Understanding.trim())}</p>
      `;
      hintSectionsList.appendChild(block);
    } else if (card.q1Unsure) {
      hasAnyResponse = true;
      const block = document.createElement('div');
      block.className = 'hint-block';
      block.innerHTML = `
        <span class="hint-block-label">&bull; What I know</span>
        <p class="hint-block-content">You noted: Not sure where to start yet.</p>
      `;
      hintSectionsList.appendChild(block);
    }

    // Where I'm stuck (from Q2)
    if (card.q2StuckOptions && card.q2StuckOptions.length > 0) {
      hasAnyResponse = true;
      const block = document.createElement('div');
      block.className = 'hint-block';
      const itemsHtml = card.q2StuckOptions.map(opt => `<div>${escapeHtml(opt)}</div>`).join('');
      block.innerHTML = `
        <span class="hint-block-label">&bull; Where I'm stuck</span>
        <div class="hint-block-content">${itemsHtml}</div>
      `;
      hintSectionsList.appendChild(block);
    }

    // What I need (from Q3)
    if (card.q3HelpPreferences && card.q3HelpPreferences.length > 0) {
      hasAnyResponse = true;
      const block = document.createElement('div');
      block.className = 'hint-block';
      const itemsHtml = card.q3HelpPreferences.map(opt => `<div>${escapeHtml(opt)}</div>`).join('');
      block.innerHTML = `
        <span class="hint-block-label">&bull; What I need</span>
        <div class="hint-block-content">${itemsHtml}</div>
      `;
      hintSectionsList.appendChild(block);
    }

    // Only show responses that the student actually provided.
    // If student has answered none of Q1, Q2, Q3 yet:
    if (!hasAnyResponse) {
      const emptyNote = document.createElement('div');
      emptyNote.className = 'hint-block';
      emptyNote.innerHTML = `
        <p class="hint-block-content" style="color: var(--text-muted); font-style: italic;">
          No reflection notes added yet. Fill in any of Q1, Q2, or Q3 above to see your notes organized here!
        </p>
      `;
      hintSectionsList.appendChild(emptyNote);
    }
  }

  // --- SCAFFOLDING 3: SEE AN EXAMPLE (Rule-based sample question) ---
  btnToggleSample.addEventListener('click', () => {
    isSampleOpen = !isSampleOpen;
    if (isSampleOpen) {
      sampleQuestionContainer.style.display = 'block';
      renderSampleQuestion();
    } else {
      sampleQuestionContainer.style.display = 'none';
    }
  });

  function renderSampleQuestion() {
    const card = getActiveConfusion();
    if (!card) return;

    const sampleText = buildRuleBasedSampleQuestion(card);
    sampleQuestionText.textContent = sampleText;
  }

  function buildRuleBasedSampleQuestion(card) {
    const topic = card.quickNote.trim();
    const prior = (!card.q1Unsure && card.q1Understanding) ? card.q1Understanding.trim() : '';

    // Determine stuck point from Q2
    let stuck = '';
    if (card.q2PrimaryConcern) {
      stuck = card.q2PrimaryConcern;
    } else if (card.q2StuckOptions && card.q2StuckOptions.length > 0) {
      stuck = card.q2StuckOptions[0];
    }

    // Determine help preferences from Q3
    const helpList = Array.isArray(card.q3HelpPreferences) ? card.q3HelpPreferences : [];

    const helpRequestMap = {
      "Explain the concept in a different way.": "Could you explain this concept in a different way?",
      "Explain an unfamiliar term.": "Could you help clarify what this unfamiliar term means?",
      "Walk through the explanation again.": "Could you walk through that explanation one more time?",
      "Give me a concrete example.": "Could you give a concrete example to help illustrate this?",
      "Give me a real-world example.": "Could you share a real-world example of how this applies?",
      "Show me a counterexample.": "Could you show a counterexample to clarify the boundaries?",
      "Compare two similar concepts.": "Could you clarify how this differs from similar concepts we covered?",
      "Explain how different concepts relate.": "Could you explain how these concepts connect to each other?",
      "Connect this topic to something I already know.": "Could you help connect this to what we learned previously?",
      "Walk me through the steps.": "Could you walk through the intermediate steps to make sure I followed?",
      "Show me how to apply the concept.": "Could you show how to approach applying this in practice?",
      "Help me figure out where to start.": "Could you help point me toward where to start?",
      "Check whether my understanding is correct.": "Could you check whether I am interpreting this correctly?",
      "Give feedback on my reasoning.": "Could you give quick feedback on whether my reasoning makes sense?",
      "Confirm whether I'm approaching the task correctly.": "Could you confirm whether my approach is on the right track?"
    };

    const helpActionShortMap = {
      "Explain the concept in a different way.": "explain it in a different way",
      "Explain an unfamiliar term.": "clarify what this term means",
      "Walk through the explanation again.": "walk through the explanation again",
      "Give me a concrete example.": "give a concrete example",
      "Give me a real-world example.": "provide a real-world example",
      "Show me a counterexample.": "show a counterexample",
      "Compare two similar concepts.": "compare this with similar concepts",
      "Explain how different concepts relate.": "explain how these concepts connect",
      "Connect this topic to something I already know.": "connect this to our earlier material",
      "Walk me through the steps.": "walk through the steps together",
      "Show me how to apply the concept.": "show how to apply this in practice",
      "Help me figure out where to start.": "point me toward where to start",
      "Check whether my understanding is correct.": "check whether my interpretation is correct",
      "Give feedback on my reasoning.": "give feedback on my reasoning",
      "Confirm whether I'm approaching the task correctly.": "confirm if my approach is on track"
    };

    let closingAsk = "Could you help me clarify this?";
    if (helpList.length === 1) {
      closingAsk = helpRequestMap[helpList[0]] || "Could you help me clarify this?";
    } else if (helpList.length >= 2) {
      const a1 = helpActionShortMap[helpList[0]] || helpList[0].toLowerCase().replace(/\.$/, '');
      const a2 = helpActionShortMap[helpList[1]] || helpList[1].toLowerCase().replace(/\.$/, '');
      closingAsk = `Could you ${a1}, and also ${a2}?`;
    }

    const stuckPhraseMap = {
      "I don't understand some terms.": `I'm having trouble understanding some of the terms used in "${topic}"`,
      "I don't understand what this concept means.": `I'm not quite clear on what the concept behind "${topic}" means`,
      "I don't understand what the material is saying.": `I'm struggling to unpack what the material is conveying about "${topic}"`,
      "I couldn't follow the explanation.": `I couldn't quite follow the explanation for "${topic}"`,
      "I don't understand why this conclusion follows.": `I don't completely see why this conclusion follows for "${topic}"`,
      "I understand individual steps, but not the overall reasoning.": `I can follow the individual steps for "${topic}", but I'm missing the overall reasoning`,
      "I can't connect this to what I already know.": `I'm having trouble connecting "${topic}" to what we covered previously`,
      "I can't distinguish it from similar concepts.": `I'm having trouble distinguishing "${topic}" from related concepts`,
      "I don't understand how different ideas relate.": `I don't quite see how the different ideas connect in "${topic}"`,
      "I understand the idea but don't know how to use it.": `I understand the idea behind "${topic}", but I'm unsure how to put it into practice`,
      "I don't know how to start the task.": `I'm stuck on how to get started with the task for "${topic}"`,
      "I don't understand what the assignment requires.": `I'm unclear on what is expected for "${topic}"`,
      "I'm not sure exactly what I don't understand.": `I'm feeling stuck on "${topic}", but I'm not sure where the breakdown happened`,
      "I'm not sure whether my understanding is correct.": `I think I might understand "${topic}", but I want to make sure I'm not misinterpreting it`,
      "I feel lost and don't know where to start.": `I'm feeling a bit lost on "${topic}" and don't know where to start`
    };

    const stuckLead = stuckPhraseMap[stuck] || `I'm having trouble with "${topic}"`;

    // 1. Both prior understanding and stuck point exist
    if (prior && stuck) {
      const priorClean = prior.replace(/^I understand that\s*/i, '');
      return `I understand that ${priorClean}, but ${stuckLead.charAt(0).toLowerCase() + stuckLead.slice(1)}. ${closingAsk}`;
    }

    // 2. Prior understanding exists, but no stuck point selected
    if (prior && !stuck) {
      const priorClean = prior.replace(/^I understand that\s*/i, '');
      return `I understand that ${priorClean}, but I'm feeling a bit stuck on "${topic}". ${closingAsk}`;
    }

    // 3. Stuck point exists, but no prior understanding
    if (stuck) {
      if (stuck === "I'm not sure exactly what I don't understand." || stuck === "I feel lost and don't know where to start.") {
        return `I'm having trouble with "${topic}", but I'm not sure exactly where I'm getting stuck. Could you help me work through it?`;
      }
      return `${stuckLead}. ${closingAsk}`;
    }

    // 4. Only original note and requested help exist
    if (helpList.length > 0) {
      return `I'm having trouble with "${topic}". ${closingAsk}`;
    }

    // 5. Minimal information (shorter, general sample question)
    return `I'm having trouble understanding "${topic}". Could you help me clarify it?`;
  }

  // Copy sample question button
  btnCopySample.addEventListener('click', () => {
    const text = sampleQuestionText.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Sample question copied to clipboard!');
    }).catch(() => {
      showToast('Failed to copy. Please select and copy manually.');
    });
  });

  // --- Delete Card with Modal Confirmation ---
  const modalDeleteEl = document.getElementById('modal-delete');
  const btnDeleteConfusionEl = document.getElementById('btn-delete-confusion');
  const btnCancelDeleteEl = document.getElementById('btn-cancel-delete');
  const btnConfirmDeleteEl = document.getElementById('btn-confirm-delete');

  btnDeleteConfusionEl.addEventListener('click', () => {
    cardPendingDeleteId = currentActiveId;
    modalDeleteEl.classList.add('active');
  });

  btnCancelDeleteEl.addEventListener('click', () => {
    cardPendingDeleteId = null;
    modalDeleteEl.classList.remove('active');
  });

  btnConfirmDeleteEl.addEventListener('click', () => {
    if (!cardPendingDeleteId) return;

    confusions = confusions.filter(c => c.id !== cardPendingDeleteId);
    saveConfusions();
    cardPendingDeleteId = null;
    modalDeleteEl.classList.remove('active');
    showView('home');
    showToast('Confusion card deleted');
  });

  modalDeleteEl.addEventListener('click', (e) => {
    if (e.target === modalDeleteEl) {
      modalDeleteEl.classList.remove('active');
      cardPendingDeleteId = null;
    }
  });

  document.getElementById('btn-done-detail').addEventListener('click', () => {
    showView('home');
  });

  document.getElementById('btn-back-from-detail').addEventListener('click', () => {
    showView('home');
  });

  // ---------------------------------------------------------------------------
  // TOAST NOTIFICATION UTILITY
  // ---------------------------------------------------------------------------

  const toastEl = document.getElementById('app-toast');
  let toastTimer = null;

  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2400);
  }

  // Simple HTML Escaper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  function init() {
    loadConfusions();
    showView('home');
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
