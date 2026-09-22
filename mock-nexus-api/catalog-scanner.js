/**
 * Catalog Scanner Engine
 * Dynamically discovers, inspects, and classifies learning objects
 * placed in the media-wrappers directory.
 */
const fs = require('fs');
const path = require('path');

/**
 * Parses XML string using lightweight regex to extract tincan activity metadata
 */
function parseTinCanXml(xmlContent) {
    const activityMatch = xmlContent.match(/<activity[^>]*id=["']([^"']+)["']/i);
    const nameMatch = xmlContent.match(/<name[^>]*>([^<]+)<\/name>/i);
    const descMatch = xmlContent.match(/<description[^>]*>([^<]+)<\/description>/i);
    const launchMatch = xmlContent.match(/<launch[^>]*>([^<]+)<\/launch>/i);

    return {
        activityId: activityMatch ? activityMatch[1].trim() : null,
        name: nameMatch ? nameMatch[1].trim() : null,
        description: descMatch ? descMatch[1].trim() : null,
        launch: launchMatch ? launchMatch[1].trim() : null
    };
}

/**
 * Extracts <title>...</title> from an HTML file
 */
function extractHtmlTitle(htmlContent) {
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Converts a string like 'golf_example_tcapi' or 'Toll Collector' into a clean Title Case
 */
function formatDisplayName(str) {
    return str
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Inspects a single directory to determine its learning object specification
 */
function inspectFolder(folderPath, relativePathPrefix, folderKey) {
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        return null;
    }

    const files = fs.readdirSync(folderPath);

    // 1. Check for tincan.xml manifest (Standard xAPI Package)
    const tincanXmlFile = files.find(f => f.toLowerCase() === 'tincan.xml');
    if (tincanXmlFile) {
        try {
            const xml = fs.readFileSync(path.join(folderPath, tincanXmlFile), 'utf8');
            const parsed = parseTinCanXml(xml);
            const launchFile = parsed.launch || files.find(f => /^(index|launch|story|tetris)\.html?$/i.test(f)) || 'index.html';
            const title = parsed.name || formatDisplayName(folderKey);
            const description = parsed.description || `Interactive xAPI learning object (${title}).`;

            return {
                id: folderKey.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase(),
                title: title,
                type: 'xapi',
                typeLabel: 'xAPI Package',
                badgeClass: 'badge-xapi',
                badgeColor: '#16a34a',
                path: `${relativePathPrefix}/${launchFile}`,
                activityId: parsed.activityId || `http://lrs-poc.internal/activities/${folderKey}`,
                description: description
            };
        } catch (e) {
            console.warn(`[Catalog Scanner] Error parsing tincan.xml in ${folderPath}:`, e.message);
        }
    }

    // 2. Check for HTML Course Packages (index_lms.html, story.html, launch.html, index.html)
    const htmlEntry = files.find(f => /^(index_lms|story|launch|index)\.html?$/i.test(f));
    if (htmlEntry) {
        try {
            const html = fs.readFileSync(path.join(folderPath, htmlEntry), 'utf8');
            const pageTitle = extractHtmlTitle(html);
            const isXapi = /tincan|xapi|TinCanJS|sendStatement/i.test(html) || files.some(f => /tincan|xapi/i.test(f));

            const title = pageTitle || formatDisplayName(folderKey);
            return {
                id: folderKey.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase(),
                title: title,
                type: isXapi ? 'xapi' : 'web',
                typeLabel: isXapi ? 'xAPI Course' : 'Web Module',
                badgeClass: isXapi ? 'badge-xapi' : 'badge-web',
                badgeColor: isXapi ? '#0f766e' : '#475569',
                path: `${relativePathPrefix}/${htmlEntry}`,
                activityId: `http://lrs-poc.internal/activities/${folderKey}`,
                description: `Interactive learning module (${title}).`
            };
        } catch (e) {
            console.warn(`[Catalog Scanner] Error reading HTML in ${folderPath}:`, e.message);
        }
    }

    // 3. Check for Standalone PDF Documents
    const pdfFile = files.find(f => /\.pdf$/i.test(f));
    if (pdfFile) {
        const cleanName = formatDisplayName(pdfFile.replace(/\.pdf$/i, ''));
        return {
            id: folderKey.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase(),
            title: `${cleanName} (PDF)`,
            type: 'pdf',
            typeLabel: 'PDF Document Wrapper',
            badgeClass: 'badge-pdf',
            badgeColor: '#0284c7',
            path: `../media-wrappers/pdf/index.html?pdf_url=${relativePathPrefix}/${encodeURIComponent(pdfFile)}`,
            activityId: `http://lrs-poc.internal/activities/pdf/${encodeURIComponent(pdfFile)}`,
            description: `Clinical SOP document (${pdfFile}) with dwell tracking and attestation.`
        };
    }

    // 4. Check for Standalone Video Files
    const videoFile = files.find(f => /\.(mp4|webm|ogv|mov|m4v)$/i.test(f));
    if (videoFile) {
        const cleanName = formatDisplayName(videoFile.replace(/\.[a-z0-9]+$/i, ''));
        return {
            id: folderKey.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase(),
            title: `${cleanName} (Video)`,
            type: 'video',
            typeLabel: 'Video Stream Wrapper',
            badgeClass: 'badge-video',
            badgeColor: '#d97706',
            path: `../media-wrappers/video/index.html?video_url=${relativePathPrefix}/${encodeURIComponent(videoFile)}`,
            activityId: `http://lrs-poc.internal/activities/video/${encodeURIComponent(videoFile)}`,
            description: `Video training module (${videoFile}) with 25%, 50%, 75%, 100% telemetry.`
        };
    }

    return null;
}

/**
 * Recursively scans the media-wrappers directory and produces an array of learning objects.
 * Built-in wrappers (pdf, video, articulate-mock) receive curated enterprise metadata.
 */
function scanMediaWrappers(mediaWrappersDir) {
    if (!fs.existsSync(mediaWrappersDir)) {
        console.warn(`[Catalog Scanner] Directory does not exist: ${mediaWrappersDir}`);
        return [];
    }

    const entries = fs.readdirSync(mediaWrappersDir, { withFileTypes: true });
    const catalog = [];

    // Blacklist folders that are not learning objects
    const IGNORED_DIRS = new Set(['lib', 'node_modules', '.git', '.system_generated']);

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) {
            continue;
        }

        const folderName = entry.name;
        const folderPath = path.join(mediaWrappersDir, folderName);

        // Curated Built-in 1: PDF Wrapper
        if (folderName === 'pdf') {
            catalog.push({
                id: 'pdf',
                title: 'Hospital Compliance & Data Privacy Guidelines (PDF)',
                type: 'pdf',
                typeLabel: 'PDF Document Wrapper',
                badgeClass: 'badge-pdf',
                badgeColor: '#0284c7',
                path: '../media-wrappers/pdf/index.html',
                activityId: 'http://lrs-poc.internal/activities/pdf/sample.pdf',
                description: 'Mandatory SOP document with dwell tracking, page reading progression, and official completion attestation.',
                pdfFile: 'sample.pdf'
            });
            continue;
        }

        // Curated Built-in 2: Video Wrapper
        if (folderName === 'video') {
            catalog.push({
                id: 'video',
                title: 'Clinical Safety & Infection Control Protocol (MP4 Video)',
                type: 'video',
                typeLabel: 'MP4 Video Wrapper',
                badgeClass: 'badge-video',
                badgeColor: '#d97706',
                path: '../media-wrappers/video/index.html',
                activityId: 'http://lrs-poc.internal/activities/compliance-video-module',
                description: 'Standardized HTML5 video player with TinCan.js telemetry tracking quartiles (25%, 50%, 75%, 100%).'
            });
            continue;
        }

        // Curated Built-in 3: Articulate 360 Mock
        if (folderName === 'articulate-mock') {
            catalog.push({
                id: 'articulate',
                title: 'Annual HIPAA Knowledge Check (Articulate 360)',
                type: 'xapi',
                typeLabel: 'Articulate 360',
                badgeClass: 'badge-articulate',
                badgeColor: '#16a34a',
                path: '../media-wrappers/articulate-mock/index_lms.html',
                activityId: 'http://lrs-poc.internal/activities/articulate-storyline-course',
                description: 'Articulate Storyline 360 / Rise 360 package verifying native query string parsing and score reporting.'
            });
            continue;
        }

        // Multi-course suite check: Check if subdirectories have tincan.xml (e.g., in tincan_prototypes)
        let subCoursesFound = false;
        try {
            const subEntries = fs.readdirSync(folderPath, { withFileTypes: true });
            for (const sub of subEntries) {
                if (sub.isDirectory() && !sub.name.startsWith('.')) {
                    const subPath = path.join(folderPath, sub.name);
                    const subFiles = fs.readdirSync(subPath);
                    if (subFiles.some(f => f.toLowerCase() === 'tincan.xml')) {
                        const item = inspectFolder(
                            subPath,
                            `../media-wrappers/${folderName}/${sub.name}`,
                            `${folderName}_${sub.name}`
                        );
                        if (item) {
                            catalog.push(item);
                            subCoursesFound = true;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn(`[Catalog Scanner] Error scanning subdirectories of ${folderName}:`, err.message);
        }

        // If no subcourses were registered, treat the folder itself as the learning object
        if (!subCoursesFound) {
            const item = inspectFolder(
                folderPath,
                `../media-wrappers/${folderName}`,
                folderName
            );
            if (item) {
                catalog.push(item);
            }
        }
    }

    return catalog;
}

module.exports = {
    scanMediaWrappers,
    parseTinCanXml,
    inspectFolder
};
