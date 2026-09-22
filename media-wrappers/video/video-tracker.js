/**
 * Component 01: Video Media Wrapper xAPI Tracker
 * Standardized TinCan.js integration for MP4 video playback
 */
(function () {
    'use strict';

    // Parse Articulate 360 / xAPI query parameters:
    // ?endpoint=...&auth=...&actor={"name":["..."],"mbox":["mailto:..."]}&activity_id=...
    const tc = TinCan.fromQueryParams();

    const video = document.getElementById('mediaVideo');
    const statusBanner = document.getElementById('statusBanner');
    const milestonePills = {
        25: document.getElementById('milestone25'),
        50: document.getElementById('milestone50'),
        75: document.getElementById('milestone75'),
        100: document.getElementById('milestone100')
    };

    const activityId = tc.activity || 'http://lrs-poc.internal/activities/compliance-video-module';
    const activityName = 'Mandatory Healthcare Compliance Video';

    // Telemetry state tracking
    const milestonesReached = { 25: false, 50: false, 75: false, 100: false };
    let hasLaunched = false;
    let hasCompleted = false;

    // Helper to send xAPI statement via TinCan.js and postMessage to parent frame
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
                    type: "https://w3id.org/xapi/video/activity-type/video"
                }
            },
            context: {
                contextActivities: {
                    category: [{
                        id: "https://w3id.org/xapi/video"
                    }]
                }
            },
            result: {
                completion: completion,
                duration: formatIsoDuration(video.currentTime || 0),
                extensions: resultExtensions || {}
            }
        };

        console.log(`[xAPI Video] Dispatching statement: ${verb.display['en-US']}`, statement);

        // Send through TinCan.js to configured LRS
        tc.sendStatement(statement, (err, res) => {
            if (err) {
                console.warn("[xAPI Video] Statement send error (LRS might be offline):", err);
            } else {
                console.log("[xAPI Video] Statement stored successfully in LRS:", res);
            }
        });

        // Notify parent launchpad frame for live visualization
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'XAPI_STATEMENT',
                statement: statement
            }, '*');
        }
    }

    // Helper: ISO 8601 Duration format (e.g. PT1M30S)
    function formatIsoDuration(seconds) {
        const sec = Math.floor(seconds % 60);
        const min = Math.floor((seconds / 60) % 60);
        const hrs = Math.floor(seconds / 3600);
        let str = 'PT';
        if (hrs > 0) str += hrs + 'H';
        if (min > 0) str += min + 'M';
        str += sec + 'S';
        return str;
    }

    // Event 1: Launched / Initialized
    function handleLaunch() {
        if (hasLaunched) return;
        hasLaunched = true;

        statusBanner.textContent = `Tracking Active: Learner ${tc.actor?.name || 'Anonymous'}`;
        statusBanner.className = 'status-banner active';

        fireStatement(TinCan.Verbs.launched, {
            "https://w3id.org/xapi/video/extensions/session-id": "sess-" + Date.now()
        });
    }

    // Event 2: Progressed (Milestones at 25%, 50%, 75%)
    function handleTimeUpdate() {
        if (!video.duration) return;

        const percent = (video.currentTime / video.duration) * 100;

        [25, 50, 75].forEach(milestone => {
            if (percent >= milestone && !milestonesReached[milestone]) {
                milestonesReached[milestone] = true;
                if (milestonePills[milestone]) {
                    milestonePills[milestone].classList.add('reached');
                }

                fireStatement(TinCan.Verbs.progressed, {
                    "https://w3id.org/xapi/video/extensions/progress": milestone / 100,
                    "https://w3id.org/xapi/video/extensions/time": video.currentTime
                });
            }
        });

        // Check if finished (or 95% threshold)
        if (percent >= 95 && !milestonesReached[100]) {
            handleCompletion();
        }
    }

    // Event 3: Completed
    function handleCompletion() {
        if (hasCompleted) return;
        hasCompleted = true;
        milestonesReached[100] = true;

        if (milestonePills[100]) {
            milestonePills[100].classList.add('reached');
        }

        statusBanner.textContent = '🎉 Video Completed! Completion statement sent to LRS.';
        statusBanner.className = 'status-banner completed';

        fireStatement(TinCan.Verbs.completed, {
            "https://w3id.org/xapi/video/extensions/progress": 1.0,
            "https://w3id.org/xapi/video/extensions/time": video.duration
        }, true);
    }

    // Bind listeners
    video.addEventListener('play', handleLaunch);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleCompletion);

    // Initial launch statement on DOM load
    window.addEventListener('DOMContentLoaded', () => {
        handleLaunch();
    });

    // Provide quick seek buttons for test efficiency
    window.testSeek = function (targetSeconds) {
        video.currentTime = targetSeconds;
    };
})();
