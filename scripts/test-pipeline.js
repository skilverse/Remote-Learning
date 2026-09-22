/**
 * Automated Verification Script for LRS Pipeline POC
 * Tests: Statement Injection -> LRS Persistence -> Data Bridge Polling -> Learning Nexus Sync
 */

const LRS_URL = process.env.LRS_ENDPOINT || 'http://localhost:8000/xapi/';
const NEXUS_URL = process.env.NEXUS_API_URL || 'http://localhost:4000/api/v1/completions';

const TEST_ACTOR = {
    name: ["Dr. Sarah Jenkins"],
    mbox: ["mailto:s.jenkins@hospital-system.org"]
};

const ACTIVITY_ID = "http://lrs-poc.internal/activities/compliance-video-module";

async function runTest() {
    console.log("==================================================================");
    console.log("  Running Automated Verification: LRS Pipeline Telemetry Loop    ");
    console.log("==================================================================");

    // 1. Post 'launched' statement
    console.log("\n[Step 1] Dispatching 'launched' statement to LRS...");
    const launchStmt = {
        actor: { name: TEST_ACTOR.name[0], mbox: TEST_ACTOR.mbox[0] },
        verb: { id: "http://adlnet.gov/expapi/verbs/launched", display: { "en-US": "launched" } },
        object: {
            id: ACTIVITY_ID,
            definition: { name: { "en-US": "Healthcare Compliance Video" } }
        },
        timestamp: new Date().toISOString()
    };

    const lrsRes1 = await fetch(LRS_URL + 'statements', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Experience-API-Version': '1.0.3',
            'Authorization': 'Basic cG9jX3VzZXI6cG9jX3Bhc3M='
        },
        body: JSON.stringify([launchStmt])
    });

    if (!lrsRes1.ok) {
        throw new Error(`Failed to post launch statement to LRS: ${lrsRes1.status} ${await lrsRes1.text()}`);
    }
    const stmtId1 = await lrsRes1.json();
    console.log("✓ 'launched' statement stored with ID:", stmtId1);

    // 2. Post 'completed' statement
    console.log("\n[Step 2] Dispatching 'completed' statement with score 100%...");
    const completeStmt = {
        actor: { name: TEST_ACTOR.name[0], mbox: TEST_ACTOR.mbox[0] },
        verb: { id: "http://adlnet.gov/expapi/verbs/completed", display: { "en-US": "completed" } },
        object: {
            id: ACTIVITY_ID,
            definition: { name: { "en-US": "Healthcare Compliance Video" } }
        },
        result: {
            completion: true,
            success: true,
            score: { scaled: 1.0, raw: 100, min: 0, max: 100 }
        },
        timestamp: new Date().toISOString()
    };

    const lrsRes2 = await fetch(LRS_URL + 'statements', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Experience-API-Version': '1.0.3',
            'Authorization': 'Basic cG9jX3VzZXI6cG9jX3Bhc3M='
        },
        body: JSON.stringify([completeStmt])
    });

    if (!lrsRes2.ok) {
        throw new Error(`Failed to post complete statement to LRS: ${lrsRes2.status}`);
    }
    const stmtId2 = await lrsRes2.json();
    console.log("✓ 'completed' statement stored with ID:", stmtId2);

    // 3. Trigger Data Bridge Poll
    console.log("\n[Step 3] Triggering Data Bridge poll and sync...");
    const { pollAndSync } = require('../data-bridge/index.js');
    const syncResult = await pollAndSync();
    console.log("✓ Data Bridge sync result:", syncResult);

    // 4. Query Learning Nexus
    console.log("\n[Step 4] Querying Learning Nexus completions registry...");
    const nexusRes = await fetch(NEXUS_URL);
    if (!nexusRes.ok) {
        throw new Error(`Failed to query Nexus API: ${nexusRes.status}`);
    }
    const nexusData = await nexusRes.json();
    console.log(`✓ Total completions in Learning Nexus: ${nexusData.count}`);

    const matched = nexusData.completions.find(c => c.user?.email === "s.jenkins@hospital-system.org");
    if (matched) {
        console.log("\n==================================================================");
        console.log("  TEST PASSED! VERIFIED COMPLETION FOUND IN LEARNING NEXUS:       ");
        console.log("==================================================================");
        console.log(JSON.stringify(matched, null, 2));
    } else {
        throw new Error("Verification failed: Sarah Jenkins completion not found in Learning Nexus!");
    }
}

runTest().catch(err => {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exit(1);
});
