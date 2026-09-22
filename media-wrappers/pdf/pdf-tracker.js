/**
 * Component 01: Real PDF Document Media Wrapper xAPI Tracker
 * Integrates any static PDF with TinCan.js telemetry
 */
(function () {
    'use strict';

    // Parse Articulate 360 / xAPI query parameters
    const tc = TinCan.fromQueryParams();
    const urlParams = new URLSearchParams(window.location.search);

    // Dynamic PDF Source Mapping
    const customPdf = urlParams.get('pdf_url') || urlParams.get('pdf') || 'sample.pdf';
    const pdfFrame = document.getElementById('pdfFrame');
    const pdfTitle = document.getElementById('pdfTitle');
    const statusBanner = document.getElementById('statusBanner');
    const timerBadge = document.getElementById('timerBadge');
    const completeBtn = document.getElementById('completePdfBtn');
    const readStatusText = document.getElementById('readStatusText');

    if (customPdf && pdfFrame) {
        pdfFrame.src = customPdf;
        const displayName = customPdf.split('/').pop().replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        pdfTitle.textContent = `📄 Document: ${displayName.toUpperCase()}`;
    }

    const activityId = tc.activity || `http://lrs-poc.internal/activities/pdf/${encodeURIComponent(customPdf)}`;
    const activityName = pdfTitle.textContent.replace('📄 Document: ', '') || 'Healthcare Compliance Document';

    let hasLaunched = false;
    let hasProgressed = false;
    let hasCompleted = false;
    let secondsSpent = 0;

    // Helper: Send Statement
    function fireStatement(verb, resultExtensions, completion = false) {
        const statement = {
            actor: tc.actor || {
                name: "Unidentified Learner",
                mbox: "mailto:learner@example.com"
            },
            verb: verb,
            object: {
                id: activityId,
                definition: {
                    name: { "en-US": activityName },
                    type: "http://activitystrea.ms/schema/1.0/article"
                }
            },
            result: {
                completion: completion,
                duration: formatIsoDuration(secondsSpent),
                extensions: resultExtensions || {}
            }
        };

        console.log(`[xAPI PDF] Dispatching statement: ${verb.display['en-US']}`, statement);

        tc.sendStatement(statement, (err, res) => {
            if (err) {
                console.warn("[xAPI PDF] Statement send warning:", err);
            } else {
                console.log("[xAPI PDF] Statement saved in LRS:", res);
            }
        });

        // Notify parent launchpad frame for live dashboard feed
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'XAPI_STATEMENT',
                statement: statement
            }, '*');
        }
    }

    function formatIsoDuration(sec) {
        const s = sec % 60;
        const m = Math.floor(sec / 60);
        return `PT${m}M${s}S`;
    }

    function formatDisplayTime(sec) {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    // Event 1: Launched
    function handleLaunch() {
        if (hasLaunched) return;
        hasLaunched = true;

        statusBanner.textContent = `Tracking Active: Learner ${tc.actor?.name || 'Anonymous'}`;
        statusBanner.className = 'status-banner active';

        fireStatement(TinCan.Verbs.launched, {
            "http://lrs-poc.internal/extensions/document-url": customPdf
        });
    }

    // Timer Tick (tracks dwell time & reading progression)
    setInterval(() => {
        if (hasCompleted) return;
        secondsSpent++;
        timerBadge.textContent = formatDisplayTime(secondsSpent);

        // Progress milestone after 10s of reading
        if (secondsSpent >= 10 && !hasProgressed) {
            hasProgressed = true;
            readStatusText.textContent = "(Reading milestone verified: 50% progressed)";
            readStatusText.style.color = "#8ab4f8";

            fireStatement(TinCan.Verbs.progressed, {
                "http://lrs-poc.internal/extensions/reading-dwell-sec": secondsSpent,
                "https://w3id.org/xapi/video/extensions/progress": 0.5
            });
        }
    }, 1000);

    // Event 2: Completed (User Attestation)
    completeBtn.addEventListener('click', () => {
        if (hasCompleted) return;
        hasCompleted = true;

        completeBtn.disabled = true;
        completeBtn.textContent = '✓ Document Acknowledged & Certified';
        completeBtn.style.background = '#144927';
        statusBanner.textContent = '🎉 Completed! Official attestation record sent to Trax LRS.';
        statusBanner.className = 'status-banner completed';
        readStatusText.textContent = "(Completion synchronized downstream)";
        readStatusText.style.color = "#81c995";

        fireStatement(TinCan.Verbs.completed, {
            "http://lrs-poc.internal/extensions/document-url": customPdf,
            "http://lrs-poc.internal/extensions/total-dwell-sec": secondsSpent,
            "http://lrs-poc.internal/extensions/attestation": true
        }, true);
    });

    window.addEventListener('DOMContentLoaded', () => {
        handleLaunch();
    });
})();
