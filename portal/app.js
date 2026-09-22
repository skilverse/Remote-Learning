/**
 * ApexCare HIS (Health Information System) In-App Portal Controller
 * Simulates an enterprise HIS application with session-based clinician login,
 * contextual Help Icon launching GCS-hosted xAPI learning objects, and
 * downstream Learning Record Store (Trax LRS) telemetry reporting.
 */
(function () {
    'use strict';

    // DOM Elements
    const loginModalBackdrop = document.getElementById('loginModalBackdrop');
    const hisLoginForm = document.getElementById('hisLoginForm');
    const inputUserName = document.getElementById('inputUserName');
    const inputUserEmail = document.getElementById('inputUserEmail');
    const inputUserDept = document.getElementById('inputUserDept');

    const userProfileWidget = document.getElementById('userProfileWidget');
    const headerUserName = document.getElementById('headerUserName');
    const headerUserEmail = document.getElementById('headerUserEmail');
    const userAvatarText = document.getElementById('userAvatarText');
    const displayDomain = document.getElementById('displayDomain');
    const userComplianceScore = document.getElementById('userComplianceScore');

    const helpIconBtn = document.getElementById('helpIconBtn');
    const helpDrawer = document.getElementById('helpDrawer');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const sidebarTrainingLink = document.getElementById('sidebarTrainingLink');
    const drawerActorDisplay = document.getElementById('drawerActorDisplay');

    const playerModalBackdrop = document.getElementById('playerModalBackdrop');
    const playerModalTitle = document.getElementById('playerModalTitle');
    const playerModalActor = document.getElementById('playerModalActor');
    const trainingIframe = document.getElementById('trainingIframe');
    const openExternalBtn = document.getElementById('openExternalBtn');
    const closePlayerBtn = document.getElementById('closePlayerBtn');

    const hisToast = document.getElementById('hisToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');

    // Host & Endpoint Auto-Configuration
    const currentHost = window.location.hostname || 'localhost';
    if (displayDomain) displayDomain.textContent = currentHost;

    // Detect LRS Endpoint (uses localhost:8000 for local docker, or current origin for custom domain like lrs.lxdhq.in)
    const LRS_ENDPOINT = (currentHost === 'localhost' || currentHost === '127.0.0.1')
        ? 'http://localhost:8000/xapi/'
        : `${window.location.origin}/xapi/`;
    const LRS_AUTH = 'Basic cG9jX3VzZXI6cG9jX3Bhc3M=';

    // Learning Object Paths
    const ASSET_REGISTRY = {
        pdf: {
            title: 'Hospital Compliance & Data Privacy Guidelines (PDF)',
            path: '../media-wrappers/pdf/index.html',
            activityId: 'http://lrs-poc.internal/activities/pdf/sample.pdf',
            pdfFile: 'sample.pdf'
        },
        video: {
            title: 'Clinical Safety & Infection Control Protocol (MP4 Video)',
            path: '../media-wrappers/video/index.html',
            activityId: 'http://lrs-poc.internal/activities/compliance-video-module'
        },
        articulate: {
            title: 'Annual HIPAA Knowledge Check (Articulate 360)',
            path: '../media-wrappers/articulate-mock/index_lms.html',
            activityId: 'http://lrs-poc.internal/activities/articulate-storyline-course'
        }
    };

    // =========================================================================
    // 1. Session & Actor Management (sessionStorage)
    // =========================================================================
    function getSessionActor() {
        try {
            const raw = sessionStorage.getItem('his_actor');
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.warn('Error reading session actor:', e);
        }
        return null;
    }

    function saveSessionActor(actor) {
        sessionStorage.setItem('his_actor', JSON.stringify(actor));
        applyActorToUI(actor);
    }

    function applyActorToUI(actor) {
        if (!actor) return;

        headerUserName.textContent = actor.name;
        headerUserEmail.textContent = actor.email;
        if (drawerActorDisplay) drawerActorDisplay.textContent = `${actor.name} (${actor.email})`;

        // Generate Initials for Avatar
        const initials = actor.name
            .replace(/^Dr\.\s*/i, '')
            .split(' ')
            .filter(Boolean)
            .map(part => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'MD';
        userAvatarText.textContent = initials;

        // Update Patient Census Table attending physician column
        document.querySelectorAll('.patient-attending').forEach(td => {
            td.textContent = actor.name;
        });

        updateComplianceProgress();
    }

    // Check session on page load
    function initSession() {
        const actor = getSessionActor();
        if (!actor) {
            // Show Sign-in Modal
            loginModalBackdrop.classList.remove('hidden');
        } else {
            loginModalBackdrop.classList.add('hidden');
            applyActorToUI(actor);
        }
    }

    // Handle Sign-in Submission
    hisLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = inputUserName.value.trim() || 'Dr. Sarah Jenkins';
        const email = inputUserEmail.value.trim() || 's.jenkins@hospital-system.org';
        const dept = inputUserDept.value;

        const actor = { name, email, dept, loginTime: new Date().toISOString() };
        saveSessionActor(actor);

        // Hide modal
        loginModalBackdrop.classList.add('hidden');
        showToast('Clinician Authenticated', `Welcome, ${name}. Your xAPI actor session is active.`);
    });

    // Switch User / Logout
    userProfileWidget.addEventListener('click', () => {
        if (confirm('Do you want to switch clinician user? (This will clear your local session)')) {
            sessionStorage.removeItem('his_actor');
            sessionStorage.removeItem('his_completions');
            loginModalBackdrop.classList.remove('hidden');
            inputUserName.value = '';
            inputUserEmail.value = '';
        }
    });

    // =========================================================================
    // 2. Help Icon & Training Drawer Controls
    // =========================================================================
    function openHelpDrawer() {
        helpDrawer.classList.add('open');
    }

    function closeHelpDrawer() {
        helpDrawer.classList.remove('open');
    }

    helpIconBtn.addEventListener('click', openHelpDrawer);
    if (sidebarTrainingLink) sidebarTrainingLink.addEventListener('click', openHelpDrawer);
    closeDrawerBtn.addEventListener('click', closeHelpDrawer);

    // =========================================================================
    // 3. Dynamic URL Construction & In-App Learning Object Launch
    // =========================================================================
    /**
     * Constructs Articulate 360 & TinCan query string schema:
     * [BASE_URL]?endpoint=[LRS_URL]&auth=[LRS_AUTH]&actor={"name":["<User_Name>"],"mbox":["mailto:<User_Email>"]}
     */
    function buildLaunchUrl(assetKey) {
        const asset = ASSET_REGISTRY[assetKey];
        if (!asset) return null;

        const actor = getSessionActor() || {
            name: 'Dr. Sarah Jenkins',
            email: 's.jenkins@hospital-system.org'
        };

        const actorObj = {
            name: [actor.name],
            mbox: [`mailto:${actor.email}`]
        };

        const urlParams = new URLSearchParams();
        urlParams.set('endpoint', LRS_ENDPOINT);
        urlParams.set('auth', LRS_AUTH);
        urlParams.set('actor', JSON.stringify(actorObj));
        urlParams.set('activity_id', asset.activityId);

        if (assetKey === 'pdf' && asset.pdfFile) {
            urlParams.set('pdf_url', asset.pdfFile);
        }

        return `${asset.path}?${urlParams.toString()}`;
    }

    function launchLearningModule(assetKey) {
        const asset = ASSET_REGISTRY[assetKey];
        const launchUrl = buildLaunchUrl(assetKey);
        if (!launchUrl) return;

        const actor = getSessionActor();

        playerModalTitle.textContent = asset.title;
        playerModalActor.textContent = `Tracking as: ${actor.name} (${actor.email})`;
        trainingIframe.src = launchUrl;
        openExternalBtn.href = launchUrl;

        playerModalBackdrop.classList.remove('hidden');
        closeHelpDrawer();

        console.log(`[HIS Portal] Launching ${assetKey} with dynamic actor:`, launchUrl);
    }

    // Attach click listeners to all "Launch Training" buttons
    document.querySelectorAll('.btn-launch-training').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const assetKey = btn.getAttribute('data-asset');
            launchLearningModule(assetKey);
        });
    });

    // Close Player Modal
    closePlayerBtn.addEventListener('click', () => {
        playerModalBackdrop.classList.add('hidden');
        trainingIframe.src = 'about:blank';
    });

    // =========================================================================
    // 4. Telemetry Listener & Real-Time Completion Sync
    // =========================================================================
    function getCompletedActivities() {
        try {
            const raw = sessionStorage.getItem('his_completions');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return [];
    }

    function markActivityCompleted(activityId) {
        const list = getCompletedActivities();
        if (!list.includes(activityId)) {
            list.push(activityId);
            sessionStorage.setItem('his_completions', JSON.stringify(list));
        }
        updateComplianceProgress();
    }

    function updateComplianceProgress() {
        const list = getCompletedActivities();
        const total = Object.keys(ASSET_REGISTRY).length;

        // Update badges in drawer
        for (const [key, asset] of Object.entries(ASSET_REGISTRY)) {
            const statusEl = document.getElementById(`status-${key}`);
            if (statusEl) {
                if (list.includes(asset.activityId)) {
                    statusEl.textContent = 'Completed ✓';
                    statusEl.className = 'training-status completed';
                } else {
                    statusEl.textContent = 'Not Started';
                    statusEl.className = 'training-status';
                }
            }
        }

        // Update metrics card
        if (userComplianceScore) {
            if (list.length === 0) {
                userComplianceScore.textContent = '0 / 3 Modules';
                userComplianceScore.style.color = '#d97706';
            } else if (list.length >= total) {
                userComplianceScore.textContent = '100% Certified ✓';
                userComplianceScore.style.color = '#16a34a';
            } else {
                userComplianceScore.textContent = `${list.length} / ${total} Certified`;
                userComplianceScore.style.color = '#0284c7';
            }
        }
    }

    // Cross-window Message Listener for Iframe xAPI Telemetry
    window.addEventListener('message', (event) => {
        if (!event.data || event.data.type !== 'XAPI_STATEMENT') return;

        const stmt = event.data.statement;
        const verbDisplay = stmt.verb?.display?.['en-US'] || '';
        const activityId = stmt.object?.id || '';
        const courseTitle = stmt.object?.definition?.name?.['en-US'] || 'Course';

        console.log(`[HIS In-App Telemetry] Received ${verbDisplay} from wrapper:`, stmt);

        if (verbDisplay === 'completed' || verbDisplay === 'passed') {
            markActivityCompleted(activityId);
            showToast(
                '🎉 Module Certified & Completed!',
                `${courseTitle} has been verified and logged to Trax LRS. Learning Nexus registry updated.`
            );
        }
    });

    // Toast Notification Helper
    let toastTimeout = null;
    function showToast(title, message) {
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        hisToast.classList.add('show');

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            hisToast.classList.remove('show');
        }, 5000);
    }

    // Initialize session on load
    window.addEventListener('DOMContentLoaded', () => {
        initSession();
    });
})();
