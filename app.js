// ===== VedaAI Assignment Management - App Logic =====

// ===== CONFIG =====
const API_BASE_URL = "https://vedaai-fullstack-assignment.onrender.com";
const API_BASE = `${API_BASE_URL}/api`;

// ===== STATE =====
// [Zustand Implementation] Proxy legacy variables to useAppStore
Object.defineProperty(window, 'currentUser', { 
    get: () => window.useAppStore ? window.useAppStore.getState().currentUser : null,
    set: (val) => window.useAppStore && window.useAppStore.getState().setCurrentUser(val)
});
Object.defineProperty(window, 'assignments', { 
    get: () => window.useAppStore ? window.useAppStore.getState().assignments : [],
    set: (val) => window.useAppStore && window.useAppStore.getState().setAssignments(val)
});
Object.defineProperty(window, 'groups', { 
    get: () => window.useAppStore ? window.useAppStore.getState().groups : [],
    set: (val) => window.useAppStore && window.useAppStore.getState().setGroups(val)
});
Object.defineProperty(window, 'schools', { 
    get: () => window.useAppStore ? window.useAppStore.getState().schools : [],
    set: (val) => window.useAppStore && window.useAppStore.getState().setSchools(val)
});
let socket = null;
let currentView = 'empty';
let viewHistory = [];
let selectedCardIndex = null;
let questionTypeCounter = 0;

const questionTypeOptions = [
    'Multiple Choice Questions',
    'Short Questions',
    'Diagram/Graph-Based Questions',
    'Numerical Problems',
    'Long Answer Questions',
    'True/False',
    'Fill in the Blanks',
    'Match the Following'
];

// ===== AUTH HELPERS =====
function getToken() {
    return localStorage.getItem('vedaai_token');
}

function saveToken(token) {
    localStorage.setItem('vedaai_token', token);
}

function clearToken() {
    localStorage.removeItem('vedaai_token');
}

function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    };
}

// ===== AUTH FORM TOGGLE =====
function toggleAuthForm(form) {
    if (form === 'signup') {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('signupForm').classList.remove('hidden');
    } else {
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    }
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('signupError').classList.add('hidden');
}

function showAuthError(formId, message) {
    const el = document.getElementById(formId);
    el.textContent = message;
    el.classList.remove('hidden');
}

// ===== SIGNUP =====
async function handleSignup() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;

    if (!name) { showAuthError('signupError', 'Please enter your full name'); return; }
    if (!email || !email.includes('@')) { showAuthError('signupError', 'Please enter a valid email address'); return; }
    if (password.length < 6) { showAuthError('signupError', 'Password must be at least 6 characters'); return; }

    try {
        const res = await fetch(API_BASE + '/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
            showAuthError('signupError', data.message || 'Signup failed');
            return;
        }

        saveToken(data.token);
        currentUser = data.user;
        enterApp();
        showToast('Account created! Welcome, ' + currentUser.name.split(' ')[0] + '!', 'success');

    } catch (error) {
        console.error('Signup error:', error);
        showAuthError('signupError', 'Server connection failed. Is the backend running?');
    }
}

// ===== LOGIN =====
async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    if (!email) { showAuthError('loginError', 'Please enter your email address'); return; }
    if (!password) { showAuthError('loginError', 'Please enter your password'); return; }

    try {
        const res = await fetch(API_BASE + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
            showAuthError('loginError', data.message || 'Invalid email or password');
            return;
        }

        saveToken(data.token);
        currentUser = data.user;
        enterApp();
        showToast('Welcome back, ' + currentUser.name.split(' ')[0] + '!', 'success');

    } catch (error) {
        console.error('Login error:', error);
        showAuthError('loginError', 'Server connection failed. Is the backend running?');
    }
}

// ===== LOGOUT =====
function handleLogout() {
    clearToken();
    currentUser = null;
    assignments = [];

    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('userDropdown').classList.add('hidden');

    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('signupName').value = '';
    document.getElementById('signupEmail').value = '';
    document.getElementById('signupPassword').value = '';
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('signupError').classList.add('hidden');

    toggleAuthForm('login');
}

// ===== SESSION RESTORE =====
async function restoreSession() {
    const token = getToken();
    if (!token) return false;

    try {
        const res = await fetch(API_BASE + '/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) {
            clearToken();
            return false;
        }

        const data = await res.json();
        currentUser = data.user;
        return true;

    } catch (error) {
        console.error('Session restore failed:', error);
        clearToken();
        return false;
    }
}

// ===== ENTER APP =====
async function enterApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');

    if (typeof io !== 'undefined' && !socket) {
        socket = io(API_BASE_URL);
        socket.on('connect', () => {
            if (currentUser) socket.emit('join', currentUser.id);
        });

        socket.on('generation-started', (statusText) => {
            const overlay = document.getElementById('loadingOverlay');
            const pText = document.getElementById('progressText');
            if (overlay) overlay.classList.remove('hidden');
            if (pText) pText.textContent = statusText || 'Starting generation...';
        });

        socket.on('generation-progress', (statusText) => {
            const pText = document.getElementById('progressText');
            if (pText) pText.textContent = statusText;
        });

        socket.on('generation-completed', (statusText) => {
            const pText = document.getElementById('progressText');
            if (pText) pText.textContent = statusText;
        });

        socket.on('generation-error', (errorMsg) => {
            const pText = document.getElementById('progressText');
            if (pText) {
                pText.textContent = errorMsg;
                pText.style.color = 'red';
            }
            showToast(errorMsg, 'error');
            setTimeout(() => {
                const overlay = document.getElementById('loadingOverlay');
                if (overlay) overlay.classList.add('hidden');
            }, 3000);
        });
    }

    updateUserUI();

    const overlay = document.getElementById('loadingOverlay');
    const pText = document.getElementById('progressText');
    if (overlay && pText) {
        pText.style.color = 'var(--text-color)';
        pText.textContent = 'Loading workspace...';
        overlay.classList.remove('hidden');
    }

    await loadAssignmentsFromServer();
    await loadSchoolsFromServer();
    await loadGroupsFromServer();

    if (overlay) {
        overlay.classList.add('hidden');
        pText.style.color = 'var(--primary)'; // Reset for next time
    }

    // Update dashboard and library with real data
    updateDashboardStats();
    renderLibrary();
    populateSettings();

    if (assignments.length > 0) {
        showView('assignments');
        renderAssignments();
        updateBadge();
    } else {
        showView('empty');
    }

    // Reset create form
    const qtContainer = document.getElementById('questionTypes');
    qtContainer.innerHTML = '';
    questionTypeCounter = 0;
    addQuestionType('Multiple Choice Questions', 4, 1);
    addQuestionType('Short Questions', 2, 2);
    addQuestionType('Diagram/Graph-Based Questions', 5, 5);
    addQuestionType('Numerical Problems', 5, 5);
    updateTotals();

    setupDragDrop();
}

// ===== UPDATE USER UI =====
function updateUserUI() {
    if (!currentUser) return;

    const firstName = currentUser.name.split(' ')[0];
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    document.getElementById('headerAvatar').textContent = initials;
    document.getElementById('headerName').textContent = firstName;
    document.getElementById('dropdownAvatar').textContent = initials;
    document.getElementById('dropdownName').textContent = currentUser.name;
    document.getElementById('dropdownEmail').textContent = currentUser.email;

    const welcomeEl = document.getElementById('welcomeTitle');
    if (welcomeEl) welcomeEl.textContent = 'Welcome, ' + firstName + '! 👋';
}

function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('hidden');
}

// ===== ASSIGNMENTS — SERVER API =====
async function loadAssignmentsFromServer() {
    try {
        const res = await fetch(API_BASE + '/assignments', {
            headers: authHeaders()
        });

        const data = await res.json();

        if (data.success && Array.isArray(data.assignments)) {
            assignments = data.assignments.map(a => ({
                _id: a._id,
                title: a.title,
                assignedDate: formatDate(new Date(a.createdAt)),
                dueDate: a.dueDate ? formatDate(new Date(a.dueDate)) : 'N/A',
                generatedPaper: a.generatedPaper,
                createdAt: a.createdAt
            }));
        } else {
            assignments = [];
        }
    } catch (error) {
        console.error('Failed to load assignments:', error);
        assignments = [];
    }
}

async function loadSchoolsFromServer() {
    try {
        const res = await fetch(API_BASE + '/schools', {
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.schools)) {
            schools = data.schools;
        } else {
            schools = [];
        }
    } catch (error) {
        console.error('Failed to load schools:', error);
        schools = [];
    }
}

async function loadGroupsFromServer() {
    try {
        const res = await fetch(API_BASE + '/groups', {
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.groups)) {
            groups = data.groups;
        } else {
            groups = [];
        }
    } catch (error) {
        console.error('Failed to load groups:', error);
        groups = [];
    }
}

async function deleteAssignmentFromServer(id) {
    try {
        await fetch(API_BASE + '/assignments/' + id, {
            method: 'DELETE',
            headers: authHeaders()
        });
    } catch (error) {
        console.error('Failed to delete assignment:', error);
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Try to restore existing session
    const restored = await restoreSession();
    if (restored) {
        enterApp();
    } else {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('appContainer').classList.add('hidden');
    }

    // Close context menu / dropdown on click outside
    document.addEventListener('click', (e) => {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu.classList.contains('hidden') && !e.target.closest('.btn-card-menu')) {
            contextMenu.classList.add('hidden');
        }
        const dropdown = document.getElementById('userDropdown');
        if (!dropdown.classList.contains('hidden') && !e.target.closest('.user-profile') && !e.target.closest('.user-dropdown')) {
            dropdown.classList.add('hidden');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('contextMenu').classList.add('hidden');
            document.getElementById('userDropdown').classList.add('hidden');
        }
    });

    document.getElementById('loginPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('loginEmail').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('signupPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSignup();
    });
}

// ===== VIEW MANAGEMENT =====
function showView(viewName) {
    const views = {
        'empty': 'viewEmpty',
        'assignments': 'viewAssignments',
        'create': 'viewCreate',
        'output': 'viewOutput',
        'home': 'viewHome',
        'groups': 'viewGroups',
        'toolkit': 'viewToolkit',
        'library': 'viewLibrary',
        'settings': 'viewSettings'
    };

    if (currentView !== viewName) {
        viewHistory.push(currentView);
    }
    currentView = viewName;

    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

    const targetId = views[viewName];
    if (targetId) {
        document.getElementById(targetId).classList.remove('hidden');
    }

    const btnBack = document.getElementById('btnBack');
    if (viewName === 'create' || viewName === 'output') {
        btnBack.style.display = 'flex';
    } else {
        btnBack.style.display = 'none';
    }

    const titles = {
        'empty': 'Assignment', 'assignments': 'Assignment', 'create': 'Create Assignment',
        'output': 'Assignment Output', 'home': 'Home', 'groups': 'My Groups',
        'toolkit': 'AI Teacher\'s Toolkit', 'library': 'My Library', 'settings': 'Settings'
    };
    const icons = {
        'empty': 'assignment', 'assignments': 'assignment', 'create': 'note_add',
        'output': 'description', 'home': 'home', 'groups': 'groups',
        'toolkit': 'auto_awesome', 'library': 'local_library', 'settings': 'settings'
    };
    document.getElementById('topBarTitle').textContent = titles[viewName] || 'Assignment';
    document.querySelector('.top-bar-icon').textContent = icons[viewName] || 'assignment';

    if (viewName === 'home') {
        const statEl = document.getElementById('statAssignments');
        if (statEl) statEl.textContent = assignments.length;
        updateUserUI();
    }
}

function goBack() {
    if (viewHistory.length > 0) {
        const prev = viewHistory.pop();
        if ((prev === 'empty' || prev === 'assignments') && assignments.length > 0) {
            showView('assignments');
            renderAssignments();
        } else if (prev === 'empty' || prev === 'assignments') {
            showView('empty');
        } else {
            showView(prev);
        }
        viewHistory.pop();
    } else {
        if (assignments.length > 0) {
            showView('assignments');
            renderAssignments();
        } else {
            showView('empty');
        }
    }
}

// ===== NAVIGATION =====
function navigateTo(page, el) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (el) el.classList.add('active');

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    switch (page) {
        case 'assignments':
            if (assignments.length > 0) {
                showView('assignments');
                renderAssignments();
            } else {
                showView('empty');
            }
            break;
        case 'home': showView('home'); break;
        case 'groups': showView('groups'); break;
        case 'toolkit': showView('toolkit'); break;
        case 'library': showView('library'); break;
        case 'settings': showView('settings'); break;
        default: showView('home');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

// ===== ASSIGNMENT CRUD =====
function showCreateAssignment() {
    showView('create');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const assignmentsNav = document.querySelectorAll('.sidebar-nav .nav-item')[2];
    if (assignmentsNav) assignmentsNav.classList.add('active');
}

function renderAssignments() {
    const grid = document.getElementById('assignmentsGrid');
    grid.innerHTML = '';

    const sortSelect = document.getElementById('sortAssignments');
    if (sortSelect) {
        const order = sortSelect.value;
        assignments.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.assignedDate).getTime();
            const dateB = new Date(b.createdAt || b.assignedDate).getTime();
            return order === 'oldest' ? dateA - dateB : dateB - dateA;
        });
    }

    assignments.forEach((assignment, index) => {
        const card = document.createElement('div');
        card.className = 'assignment-card';
        card.style.animationDelay = `${index * 0.05}s`;
        card.onclick = (e) => {
            if (!e.target.closest('.btn-card-menu')) {
                showOutputForAssignment(index);
            }
        };

        card.innerHTML = `
            <div class="assignment-card-header">
                <h3 class="assignment-card-title">${assignment.title}</h3>
                <button class="btn-card-menu" onclick="showContextMenu(event, ${index})">
                    <span class="material-icons-outlined">more_vert</span>
                </button>
            </div>
            <div class="assignment-card-meta">
                <div class="meta-item">
                    <span class="meta-label">Assigned on</span>
                    <span class="meta-value">${assignment.assignedDate}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Due</span>
                    <span class="meta-value">${assignment.dueDate}</span>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

function showContextMenu(event, index) {
    event.stopPropagation();
    selectedCardIndex = index;

    const menu = document.getElementById('contextMenu');
    menu.classList.remove('hidden');

    const rect = event.target.closest('.btn-card-menu').getBoundingClientRect();
    let left = rect.right + 4;
    let top = rect.top;

    if (left + 200 > window.innerWidth) left = rect.left - 200;
    if (top + 100 > window.innerHeight) top = window.innerHeight - 110;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function viewAssignment() {
    document.getElementById('contextMenu').classList.add('hidden');
    if (selectedCardIndex !== null) {
        showOutputForAssignment(selectedCardIndex);
    }
}

let deleteContext = { type: null, index: null };

function closeDeleteModal() {
    deleteContext = { type: null, index: null };
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('hidden');
    const btn = document.getElementById('confirmDeleteBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Delete';
    }
}

async function confirmDelete() {
    const { type, index } = deleteContext;
    if (type === null || index === null) return;

    const btn = document.getElementById('confirmDeleteBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Deleting...';
    }

    if (type === 'assignment') {
        const assignment = assignments[index];
        if (assignment && assignment._id) {
            await deleteAssignmentFromServer(assignment._id);
            window.useAppStore.getState().removeAssignment(assignment._id);
            updateBadge();
            updateDashboardStats();
            renderLibrary();
            if (assignments.length > 0) {
                renderAssignments();
            } else {
                showView('empty');
            }
            showToast('Assignment deleted', 'error');
        }
    } else if (type === 'group') {
        const group = groups[index];
        if (group && group._id) {
            try {
                const res = await fetch(API_BASE + '/groups/' + group._id, {
                    method: 'DELETE',
                    headers: authHeaders()
                });
                const data = await res.json();
                if (data.success) {
                    window.useAppStore.getState().removeGroup(group._id);
                    renderGroups();
                    updateDashboardStats();
                    showToast('Group deleted', 'error');
                } else {
                    showToast(data.message || 'Failed to delete group', 'error');
                }
            } catch (error) {
                console.error('Delete group error:', error);
                showToast('Failed to delete group', 'error');
            }
        }
    }

    closeDeleteModal();
}

function deleteAssignment() {
    document.getElementById('contextMenu').classList.add('hidden');
    if (selectedCardIndex !== null) {
        deleteContext = { type: 'assignment', index: selectedCardIndex };
        const modal = document.getElementById('deleteModal');
        if (modal) modal.classList.remove('hidden');
    }
}

function deleteAssignmentByIndex(index) {
    deleteContext = { type: 'assignment', index };
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('hidden');
}

// ===== SHOW OUTPUT FOR ASSIGNMENT =====
function showOutputForAssignment(index) {
    const assignment = assignments[index];
    showView('output');

    // Update AI message with real user name and assignment title
    const aiMsg = document.getElementById('aiMessageText');
    if (aiMsg && currentUser) {
        const firstName = currentUser.name.split(' ')[0];
        aiMsg.textContent = `Here's your customized "${assignment.title}" question paper, ${firstName}! Generated using AI based on your specifications.`;
    }

    renderGeneratedPaper(assignment);
}

function renderGeneratedPaper(assignment) {
    const container = document.getElementById('paperPreview');
    if (!container) return;

    let paper = assignment.generatedPaper;

    // Parse if string
    if (typeof paper === 'string') {
        try {
            paper = JSON.parse(paper.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        } catch (e) {
            container.innerHTML = `<div class="paper-sheet"><p>Could not parse the generated paper.</p><pre style="white-space:pre-wrap;font-size:0.8rem;color:#666;">${paper}</pre></div>`;
            return;
        }
    }

    if (!paper || (!paper.sections && !paper.questions)) {
        container.innerHTML = `<div class="paper-sheet"><p style="text-align:center;color:var(--text-muted);padding:40px;">No generated content available for this assignment.</p></div>`;
        return;
    }

    // If it has flat `questions` array but no `sections`, wrap it
    if (paper.questions && !paper.sections) {
        paper.sections = [{
            title: 'Section A',
            instruction: 'Answer all questions.',
            questions: paper.questions
        }];
    }

    const title = paper.title || assignment.title || 'Question Paper';
    const totalMarks = paper.totalMarks || '';
    const duration = paper.duration || '';

    let html = `<div class="paper-sheet">`;

    // Header
    html += `<div class="paper-header-school">
        <h2>${title}</h2>
        <div class="paper-meta-row">
            ${totalMarks ? `<span>Maximum Marks: ${totalMarks}</span>` : ''}
        </div>
        ${duration ? `<div class="paper-meta-row"><span>Time Allowed: ${duration}</span></div>` : ''}
    </div>`;

    // Student info fields
    html += `<div class="paper-fields">
        <p>Name: ____________________</p>
        <p>Roll Number: ____________________</p>
        <p>Section: ____________________</p>
    </div>`;

    html += `<p class="paper-note">All questions are compulsory unless stated otherwise.</p>`;

    // Sections
    let globalQ = 1;
    paper.sections.forEach(section => {
        html += `<div class="paper-section-title">${section.title || 'Section'}</div>`;

        if (section.instruction) {
            html += `<div class="paper-section-heading">
                <p>${section.instruction}</p>
            </div>`;
        }

        html += `<ol class="paper-questions" start="${globalQ}">`;

        (section.questions || []).forEach(q => {
            const diffClass = (q.difficulty || '').toLowerCase();
            html += `<li>
                <span class="difficulty">[${q.difficulty || 'N/A'}]</span>
                ${q.question || q.text || ''}
                ${q.marks ? `[${q.marks} Mark${q.marks > 1 ? 's' : ''}]` : ''}
            `;

            // Render MCQ options
            if (q.options && Array.isArray(q.options) && q.options.length > 0) {
                html += `<div style="margin-top:6px;margin-left:8px;">`;
                q.options.forEach(opt => {
                    html += `<div style="margin-bottom:3px;font-size:0.85rem;">${opt}</div>`;
                });
                html += `</div>`;
            }

            html += `</li>`;
            globalQ++;
        });

        html += `</ol>`;
    });

    html += `<p class="paper-end"><strong>End of Question Paper</strong></p>`;

    // Answer Key
    if (paper.answerKey && Array.isArray(paper.answerKey) && paper.answerKey.length > 0) {
        html += `<div class="answer-key-section">
            <h3>Answer Key:</h3>
            <ol class="answer-list">`;
        paper.answerKey.forEach(ak => {
            html += `<li>${ak.answer || ak}</li>`;
        });
        html += `</ol></div>`;
    }

    html += `</div>`;

    container.innerHTML = html;

    // Update AI message
    const aiText = document.querySelector('#viewOutput .ai-text p');
    if (aiText && currentUser) {
        aiText.textContent = `Here is your generated question paper for "${assignment.title}". You can download it as a PDF below.`;
    }
}

function filterAssignments() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.assignment-card');
    let visibleCount = 0;

    cards.forEach((card, index) => {
        const title = assignments[index].title.toLowerCase();
        if (title.includes(query)) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const emptyState = document.getElementById('searchEmptyState');
    if (emptyState) {
        if (visibleCount === 0 && assignments.length > 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    }
}

// ===== CREATE ASSIGNMENT FORM =====
function addQuestionType(type, numQ, marks) {
    questionTypeCounter++;
    const container = document.getElementById('questionTypes');

    const row = document.createElement('div');
    row.className = 'question-type-row';
    row.dataset.id = questionTypeCounter;

    let optionsHTML = questionTypeOptions.map(opt =>
        `<option value="${opt}" ${opt === type ? 'selected' : ''}>${opt}</option>`
    ).join('');

    row.innerHTML = `
        <select class="question-type-select" onchange="updateTotals()">
            ${optionsHTML}
        </select>
        <div class="num-input-group">
            <span class="num-input-label">No. of Questions</span>
            <input type="number" class="num-input" value="${numQ || 1}" min="1" max="50" oninput="updateTotals()">
        </div>
        <div class="num-input-group">
            <span class="num-input-label">Marks</span>
            <input type="number" class="num-input" value="${marks || 1}" min="1" max="20" oninput="updateTotals()">
        </div>
        <button class="btn-remove-type" onclick="removeQuestionType(this)">
            <span class="material-icons-outlined">close</span>
        </button>
    `;

    container.appendChild(row);
    updateTotals();
}

function removeQuestionType(btn) {
    const row = btn.closest('.question-type-row');
    row.style.animation = 'fadeOut 0.2s ease forwards';
    setTimeout(() => {
        row.remove();
        updateTotals();
    }, 200);
}

function updateTotals() {
    const rows = document.querySelectorAll('.question-type-row');
    let totalQ = 0;
    let totalM = 0;

    rows.forEach(row => {
        const inputs = row.querySelectorAll('.num-input');
        const numQ = parseInt(inputs[0].value) || 0;
        const marks = parseInt(inputs[1].value) || 0;
        totalQ += numQ;
        totalM += numQ * marks;
    });

    document.getElementById('totalQuestions').textContent = totalQ;
    document.getElementById('totalMarks').textContent = totalM;
}

// ===== FILE UPLOAD =====
function setupDragDrop() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) showUploadedFile(file.name);
    });

    uploadArea.addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
}

function handleFileUpload(input) {
    if (input.files.length > 0) showUploadedFile(input.files[0].name);
}

function showUploadedFile(name) {
    document.getElementById('uploadArea').classList.add('hidden');
    document.getElementById('uploadedFile').classList.remove('hidden');
    document.getElementById('fileName').textContent = name;
}

function removeFile() {
    document.getElementById('uploadArea').classList.remove('hidden');
    document.getElementById('uploadedFile').classList.add('hidden');
    document.getElementById('fileInput').value = '';
}

// ===== GENERATE ASSIGNMENT (BACKEND + GROQ) =====
async function generateAssignment() {
    try {
        document.getElementById('loadingOverlay').classList.remove('hidden');

        // Collect form data
        const dueDate = document.getElementById('dueDate').value;
        const additionalInfo = document.getElementById('additionalInfo') ? document.getElementById('additionalInfo').value : '';

        // Collect question types from the form
        const rows = document.querySelectorAll('.question-type-row');
        const questionTypes = [];
        rows.forEach(row => {
            const select = row.querySelector('.question-type-select');
            const inputs = row.querySelectorAll('.num-input');
            questionTypes.push({
                type: select.value,
                count: parseInt(inputs[0].value) || 1,
                marks: parseInt(inputs[1].value) || 1
            });
        });

        const titleInput = document.getElementById('assignmentTitle');
        const title = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : 'Assignment';

        // Use FormData to send file + fields
        const formData = new FormData();
        formData.append('title', title);
        formData.append('dueDate', dueDate || '');
        formData.append('questionTypes', JSON.stringify(questionTypes));
        formData.append('additionalInfo', additionalInfo);

        // Attach the actual file if one was selected
        const fileInput = document.getElementById('fileInput');
        if (fileInput && fileInput.files.length > 0) {
            formData.append('file', fileInput.files[0]);
        }

        const token = getToken();
        const res = await fetch(API_BASE + '/assignments/generate', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        });

        const data = await res.json();

        document.getElementById('loadingOverlay').classList.add('hidden');

        if (!data.success) {
            showToast(data.message || 'Generation failed', 'error');
            return;
        }

        // Add to local list
        const a = data.assignment;
        const newAssignment = {
            _id: a._id,
            title: a.title,
            assignedDate: formatDate(new Date(a.createdAt)),
            dueDate: a.dueDate ? formatDate(new Date(a.dueDate)) : 'N/A',
            generatedPaper: a.generatedPaper,
            createdAt: a.createdAt
        };
        window.useAppStore.getState().addAssignment(newAssignment);
        updateBadge();
        updateDashboardStats();
        renderLibrary();

        // Show output
        showOutputForAssignment(0);
        showToast('Assignment generated successfully!', 'success');

    } catch (error) {
        console.error('Generate error:', error);
        document.getElementById('loadingOverlay').classList.add('hidden');
        showToast('Failed to generate assignment. Check your connection.', 'error');
    }
}

// ===== DOWNLOAD PDF =====
function downloadPDF() {
    const paperContent = document.getElementById('paperPreview');
    if (!paperContent) return;

    showToast('Generating PDF...', 'success');

    const opt = {
        margin:       [10, 10, 10, 10],
        filename:     'VedaAI_Question_Paper.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(paperContent).save().then(() => {
        showToast('PDF downloaded successfully!', 'success');
    }).catch(err => {
        console.error('PDF generation failed:', err);
        showToast('PDF generation failed', 'error');
    });
}

// ===== UTILITY =====
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) return 'N/A';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

function updateBadge() {
    const badge = document.getElementById('assignmentBadge');
    if (assignments.length > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = assignments.length;
    } else {
        badge.style.display = 'none';
    }
}

function showToast(message, type = 'success') {
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check_circle' : 'error';
    toast.innerHTML = `<span class="material-icons-outlined">${icon}</span> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// ===== LIBRARY TAB SWITCHING =====
function switchLibraryTab(btn, tab) {
    document.querySelectorAll('.library-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderLibrary(tab);
}

// ===== LIBRARY — RENDER FROM MONGODB =====
function renderLibrary(filter) {
    const grid = document.getElementById('libraryGrid');
    const empty = document.getElementById('libraryEmpty');
    if (!grid) return;

    const emptyMessages = {
        templates: { icon: 'dashboard_customize', title: 'No templates yet', desc: 'Custom templates will appear here once created.' },
        notes:     { icon: 'sticky_note_2',       title: 'No notes yet',     desc: 'Your saved notes and summaries will appear here.' }
    };

    // Templates and Notes have no data — show specific empty state
    if (filter === 'templates' || filter === 'notes') {
        grid.innerHTML = '';
        if (empty) {
            const msg = emptyMessages[filter];
            empty.querySelector('.material-icons-outlined').textContent = msg.icon;
            empty.querySelector('.empty-title').textContent = msg.title;
            empty.querySelector('.empty-description').textContent = msg.desc;
            empty.querySelector('.btn-create-first').classList.add('hidden');
            empty.classList.remove('hidden');
        }
        return;
    }

    // 'all' and 'papers' both show generated question papers
    const items = assignments.filter(a => a.generatedPaper);

    if (items.length === 0) {
        grid.innerHTML = '';
        if (empty) {
            empty.querySelector('.material-icons-outlined').textContent = 'local_library';
            empty.querySelector('.empty-title').textContent = 'Your library is empty';
            empty.querySelector('.empty-description').textContent = 'Generated question papers will appear here automatically.';
            empty.querySelector('.btn-create-first').classList.remove('hidden');
            empty.classList.remove('hidden');
        }
        return;
    }

    if (empty) empty.classList.add('hidden');

    const iconColors = [
        { bg: '#FFEBEE', color: '#E53935' },
        { bg: '#E3F2FD', color: '#1E88E5' },
        { bg: '#FFF3E0', color: '#FB8C00' },
        { bg: '#F3E5F5', color: '#8E24AA' },
        { bg: '#E8F5E9', color: '#43A047' },
        { bg: '#E0F7FA', color: '#00897B' }
    ];

    grid.innerHTML = items.map((a, i) => {
        const c = iconColors[i % iconColors.length];
        const paper = a.generatedPaper;
        const qCount = paper && paper.sections
            ? paper.sections.reduce((sum, s) => sum + (s.questions ? s.questions.length : 0), 0)
            : 0;
        const totalMarks = paper ? paper.totalMarks || '' : '';
        const timeAgo = getTimeAgo(a.createdAt);

        return `<div class="library-card" onclick="showOutputForAssignment(${assignments.indexOf(a)})" style="cursor:pointer;">
            <div class="library-card-icon" style="background: ${c.bg}; color: ${c.color};">
                <span class="material-icons-outlined">description</span>
            </div>
            <div class="library-card-info">
                <h4>${a.title}</h4>
                <p>${qCount} questions${totalMarks ? ' · ' + totalMarks + ' marks' : ''} · ${timeAgo}</p>
            </div>
            <button class="btn-icon" onclick="event.stopPropagation(); deleteAssignmentByIndex(${assignments.indexOf(a)})">
                <span class="material-icons-outlined">delete_outline</span>
            </button>
        </div>`;
    }).join('');
}

// ===== DASHBOARD STATS — FROM MONGODB =====
function updateDashboardStats() {
    const el = (id) => document.getElementById(id);

    // Real data from assignments array
    if (el('statAssignments')) el('statAssignments').textContent = assignments.length;
    
    // Library resources (just assignments since templates/notes are disabled)
    if (el('statGenerations')) el('statGenerations').textContent = assignments.length;

    // Groups stats
    if (el('statGroups')) el('statGroups').textContent = groups.length;
    
    // Generated this week
    const oneWeekAgo = new Date().getTime() - (7 * 24 * 60 * 60 * 1000);
    const generatedThisWeek = assignments.filter(a => {
        const date = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.assignedDate).getTime();
        return date > oneWeekAgo;
    }).length;
    if (el('statStudents')) el('statStudents').textContent = generatedThisWeek;

    // Render recent activity from mixed feed (Assignments + Groups)
    const activityList = document.querySelector('.activity-list');
    if (activityList) {
        let feed = [];
        assignments.forEach(a => {
            feed.push({ type: 'assignment', title: a.title, date: new Date(a.createdAt || a.assignedDate) });
        });
        groups.forEach(g => {
            feed.push({ type: 'group', title: g.name, date: new Date(g.createdAt) });
        });

        feed.sort((a, b) => b.date - a.date);

        if (feed.length === 0) {
            activityList.innerHTML = `<div class="activity-item" style="justify-content: center; padding: 32px 20px;">
                <div class="activity-content" style="text-align: center;">
                    <p class="activity-text" style="color: var(--text-muted);">No recent activity yet</p>
                </div>
            </div>`;
        } else {
            const recent = feed.slice(0, 5);
            activityList.innerHTML = recent.map(item => {
                const timeAgo = getTimeAgo(item.date);
                if (item.type === 'assignment') {
                    return `<div class="activity-item">
                        <div class="activity-icon" style="background: linear-gradient(135deg, #E53935, #FF7043); color: #fff; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <span class="material-icons-outlined" style="font-size:18px;">auto_awesome</span>
                        </div>
                        <div class="activity-content">
                            <p class="activity-text">Generated <strong>${item.title}</strong></p>
                            <span class="activity-time">${timeAgo}</span>
                        </div>
                    </div>`;
                } else {
                    return `<div class="activity-item">
                        <div class="activity-icon" style="background: linear-gradient(135deg, #4CAF50, #81C784); color: #fff; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <span class="material-icons-outlined" style="font-size:18px;">groups</span>
                        </div>
                        <div class="activity-content">
                            <p class="activity-text">Added Group: <strong>${item.title}</strong></p>
                            <span class="activity-time">${timeAgo}</span>
                        </div>
                    </div>`;
                }
            }).join('');
        }
    }
}

function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + ' min ago';
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return diffHrs + 'h ago';
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return diffDays + 'd ago';
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return diffWeeks + 'w ago';
    return formatDate(date);
}

// ===== SETTINGS — POPULATE & SAVE =====
function populateSettings() {
    if (!currentUser) return;
    const el = (id) => document.getElementById(id);
    if (el('settingsName')) el('settingsName').value = currentUser.name || '';
    if (el('settingsEmail')) el('settingsEmail').value = currentUser.email || '';
    
    // Populate school dropdown
    const schoolSelect = el('settingsSchool');
    if (schoolSelect) {
        let optionsHtml = '<option value="">Select your school...</option>';
        schools.forEach(s => {
            optionsHtml += `<option value="${s.name}">${s.name}</option>`;
        });
        schoolSelect.innerHTML = optionsHtml;
        schoolSelect.value = currentUser.school || '';
    }
}

async function saveProfile() {
    const name = document.getElementById('settingsName').value.trim();
    const school = document.getElementById('settingsSchool').value.trim();

    if (!name) {
        showToast('Name cannot be empty', 'error');
        return;
    }

    try {
        const res = await fetch(API_BASE + '/auth/profile', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ name, school })
        });

        const data = await res.json();

        if (data.success) {
            // Update local state
            currentUser.name = data.user.name;
            currentUser.school = data.user.school;

            // Refresh all UI that shows user info
            updateUserUI();
            showToast('Profile saved successfully!', 'success');
        } else {
            showToast(data.message || 'Failed to save profile', 'error');
        }
    } catch (error) {
        console.error('Save profile error:', error);
        showToast('Failed to save profile. Check your connection.', 'error');
    }
}

// ===== SCHOOL MODAL =====
function showSchoolModal() {
    const modal = document.getElementById('schoolModal');
    if (modal) {
        document.getElementById('newSchoolName').value = '';
        document.getElementById('newSchoolAddress').value = '';
        modal.classList.remove('hidden');
    }
}

function closeSchoolModal() {
    const modal = document.getElementById('schoolModal');
    if (modal) modal.classList.add('hidden');
}

async function createSchool() {
    const name = document.getElementById('newSchoolName').value.trim();
    const address = document.getElementById('newSchoolAddress').value.trim();

    if (!name) {
        showToast('School name is required', 'error');
        return;
    }

    try {
        const res = await fetch(API_BASE + '/schools', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ name, address })
        });
        const data = await res.json();

        if (data.success) {
            window.useAppStore.getState().addSchool(data.school);
            populateSettings();
            closeSchoolModal();
            showToast('School added successfully!', 'success');
        } else {
            showToast(data.message || 'Failed to add school', 'error');
        }
    } catch (error) {
        console.error('Create school error:', error);
        showToast('Failed to add school. Check your connection.', 'error');
    }
}

// ===== GROUPS FEATURE =====
function showGroupModal() {
    const modal = document.getElementById('groupModal');
    if (modal) {
        document.getElementById('newGroupName').value = '';
        document.getElementById('newGroupDesc').value = '';
        modal.classList.remove('hidden');
    }
}

function closeGroupModal() {
    const modal = document.getElementById('groupModal');
    if (modal) modal.classList.add('hidden');
}

async function createGroup() {
    const name = document.getElementById('newGroupName').value.trim();
    const description = document.getElementById('newGroupDesc').value.trim();

    if (!name) {
        showToast('Group name is required', 'error');
        return;
    }

    try {
        const res = await fetch(API_BASE + '/groups', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ name, description })
        });
        const data = await res.json();

        if (data.success) {
            window.useAppStore.getState().addGroup(data.group);
            closeGroupModal();
            renderGroups();
            updateDashboardStats();
            showToast('Group created successfully!', 'success');
        } else {
            showToast(data.message || 'Failed to create group', 'error');
        }
    } catch (error) {
        console.error('Create group error:', error);
        showToast('Failed to create group. Check connection.', 'error');
    }
}

function renderGroups() {
    const grid = document.getElementById('groupsGrid');
    const empty = document.getElementById('groupsEmpty');
    if (!grid) return;

    if (groups.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    grid.innerHTML = groups.map((g, i) => {
        const timeAgo = getTimeAgo(g.createdAt);
        return `<div class="library-card" style="cursor:default;">
            <div class="library-card-icon" style="background: #E3F2FD; color: #1E88E5;">
                <span class="material-icons-outlined">group</span>
            </div>
            <div class="library-card-info">
                <h4>${g.name}</h4>
                <p>${g.description || 'No description'} · ${timeAgo}</p>
            </div>
            <button class="btn-icon" onclick="deleteGroupByIndex(${i})">
                <span class="material-icons-outlined">delete_outline</span>
            </button>
        </div>`;
    }).join('');
}

function deleteGroupByIndex(index) {
    deleteContext = { type: 'group', index };
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('hidden');
}

// ===== VIEW NAVIGATION OVERRIDE =====
const originalShowView = showView;
showView = function(viewId) {
    originalShowView(viewId);
    if (viewId === 'groups') {
        renderGroups();
    }
};

// ===== DYNAMIC STYLES =====
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(-10px); height: 0; padding: 0; margin: 0; overflow: hidden; }
    }
`;
document.head.appendChild(styleSheet);
