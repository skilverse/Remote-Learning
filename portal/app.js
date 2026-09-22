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
    const helpNotificationBadge = document.getElementById('helpNotificationBadge');
    const helpDrawer = document.getElementById('helpDrawer');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const sidebarTrainingLink = document.getElementById('sidebarTrainingLink');
    const drawerActorDisplay = document.getElementById('drawerActorDisplay');
    const trainingCardsContainer = document.getElementById('trainingCardsContainer');

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

    const urlParams = new URLSearchParams(window.location.search);
    const queryEndpoint = urlParams.get('endpoint');

    // Detect LRS Endpoint (uses https://lrs.lxdhq.in/xapi/ for custom domain, localhost for dev, or current origin)
    const LRS_ENDPOINT = queryEndpoint || (
        (currentHost === 'his.lxdhq.in' || currentHost.includes('his.lxdhq.in'))
            ? 'https://lrs.lxdhq.in/xapi/'
            : (currentHost === 'localhost' || currentHost === '127.0.0.1')
                ? 'http://localhost:8000/xapi/'
                : `${window.location.origin}/xapi/`
    );
    const LRS_AUTH = urlParams.get('auth') || 'Basic cG9jX3VzZXI6cG9jX3Bhc3M=';

    // Learning Objects Dynamic Registry
    let ASSET_REGISTRY = {
        pdf: {
            id: 'pdf',
            title: 'Hospital Compliance & Data Privacy Guidelines (PDF)',
            type: 'pdf',
            typeLabel: 'PDF Document Wrapper',
            badgeColor: '#0284c7',
            path: '../media-wrappers/pdf/index.html',
            activityId: 'http://lrs-poc.internal/activities/pdf/sample.pdf',
            description: 'Mandatory SOP document with dwell tracking, page reading progression, and official completion attestation.',
            pdfFile: 'sample.pdf'
        },
        video: {
            id: 'video',
            title: 'Clinical Safety & Infection Control Protocol (MP4 Video)',
            type: 'video',
            typeLabel: 'MP4 Video Wrapper',
            badgeColor: '#d97706',
            path: '../media-wrappers/video/index.html',
            activityId: 'http://lrs-poc.internal/activities/compliance-video-module',
            description: 'Standardized HTML5 video player with TinCan.js telemetry tracking quartiles (25%, 50%, 75%, 100%).'
        },
        articulate: {
            id: 'articulate',
            title: 'Annual HIPAA Knowledge Check (Articulate 360)',
            type: 'xapi',
            typeLabel: 'Articulate 360',
            badgeColor: '#16a34a',
            path: '../media-wrappers/articulate-mock/index_lms.html',
            activityId: 'http://lrs-poc.internal/activities/articulate-storyline-course',
            description: 'Articulate Storyline 360 / Rise 360 package verifying native query string parsing and score reporting.'
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
        loadCatalog(); // Dynamically discover additions or deletions every time drawer opens
    }

    function closeHelpDrawer() {
        helpDrawer.classList.remove('open');
    }

    helpIconBtn.addEventListener('click', openHelpDrawer);
    if (sidebarTrainingLink) sidebarTrainingLink.addEventListener('click', openHelpDrawer);
    closeDrawerBtn.addEventListener('click', closeHelpDrawer);

    // =========================================================================
    // 3. Dynamic Catalog Auto-Discovery & In-App Learning Object Launch
    // =========================================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderTrainingCards() {
        if (!trainingCardsContainer) return;

        const assetKeys = Object.keys(ASSET_REGISTRY);
        if (assetKeys.length === 0) {
            trainingCardsContainer.innerHTML = `
                <div style="text-align: center; color: #64748b; padding: 24px; font-size: 0.85rem;">
                    📁 No learning objects found in <code>media-wrappers/</code>.
                </div>
            `;
            if (helpNotificationBadge) helpNotificationBadge.textContent = '0';
            return;
        }

        if (helpNotificationBadge) {
            helpNotificationBadge.textContent = assetKeys.length;
        }

        const completedList = getCompletedActivities();

        let html = '';
        for (const key of assetKeys) {
            const asset = ASSET_REGISTRY[key];
            const isCompleted = completedList.includes(asset.activityId);

            let tagBg = '#e0f2fe';
            let tagColor = asset.badgeColor || '#0284c7';
            if (asset.type === 'video') {
                tagBg = '#fef3c7';
                tagColor = '#d97706';
            } else if (asset.type === 'xapi') {
                tagBg = '#dcfce7';
                tagColor = '#16a34a';
            }

            const launchLabel = asset.type === 'pdf' ? 'Launch PDF Document'
                : asset.type === 'video' ? 'Launch Video Training'
                : 'Launch Course';

            html += `
                <div class="training-item-card" data-card-id="${asset.id}">
                    <div class="training-item-header">
                        <span class="training-tag" style="background: ${tagBg}; color: ${tagColor};">
                            ${asset.typeLabel || 'Interactive Object'}
                        </span>
                        <span class="training-status ${isCompleted ? 'completed' : ''}" id="status-${asset.id}">
                            ${isCompleted ? 'Completed ✓' : 'Not Started'}
                        </span>
                    </div>
                    <div class="training-item-title">${escapeHtml(asset.title)}</div>
                    <div class="training-item-desc">${escapeHtml(asset.description || '')}</div>
                    <button class="btn-launch-training" data-asset="${asset.id}">
                        <span>▶</span>
                        <span>${launchLabel}</span>
                    </button>
                </div>
            `;
        }

        trainingCardsContainer.innerHTML = html;

        // Rebind click listeners to all dynamically created "Launch Training" buttons
        trainingCardsContainer.querySelectorAll('.btn-launch-training').forEach(btn => {
            btn.addEventListener('click', () => {
                const assetKey = btn.getAttribute('data-asset');
                launchLearningModule(assetKey);
            });
        });
    }

    async function loadCatalog() {
        try {
            let catalogList = null;

            // 1. Live server discovery scan (detects added/removed folders in real-time)
            try {
                const res = await fetch('/api/v1/learning-objects');
                if (res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.catalog) && data.catalog.length > 0) {
                        catalogList = data.catalog;
                    }
                }
            } catch (apiErr) {
                console.warn('[HIS Portal] Direct discovery API unavailable, attempting static catalog.json fallback:', apiErr);
            }

            // 2. Static catalog.json fallback (for pure GCS or offline backend deployment)
            if (!catalogList) {
                try {
                    const staticRes = await fetch('../media-wrappers/catalog.json');
                    if (staticRes.ok) {
                        catalogList = await staticRes.json();
                    }
                } catch (staticErr) {
                    console.warn('[HIS Portal] Static catalog.json fallback unavailable:', staticErr);
                }
            }

            if (Array.isArray(catalogList) && catalogList.length > 0) {
                ASSET_REGISTRY = {};
                catalogList.forEach(item => {
                    ASSET_REGISTRY[item.id] = item;
                });
            }
        } catch (e) {
            console.error('[HIS Portal] Failed to load learning objects catalog:', e);
        }

        renderTrainingCards();
        updateComplianceProgress();
    }

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

        if (asset.type === 'pdf' && asset.pdfFile) {
            urlParams.set('pdf_url', asset.pdfFile);
        }

        const joinChar = asset.path.includes('?') ? '&' : '?';
        return `${asset.path}${joinChar}${urlParams.toString()}`;
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
                userComplianceScore.textContent = `0 / ${total} Modules`;
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

    // Initialize session and dynamic catalog on load
    window.addEventListener('DOMContentLoaded', () => {
        initSession();
        loadCatalog();
    });
})();
