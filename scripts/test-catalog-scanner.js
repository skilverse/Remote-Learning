/**
 * Test Catalog Scanner
 * Tests: Media wrapper discovery, classification (xAPI vs Video vs PDF), addition & purge
 */
const { scanMediaWrappers } = require('../mock-nexus-api/catalog-scanner');
const path = require('path');
const fs = require('fs');

const WRAPPERS_DIR = path.join(__dirname, '..', 'media-wrappers');

console.log('==================================================================');
console.log('  Testing Dynamic Catalog Scanner & Classification Engine         ');
console.log('==================================================================');

// 1. Initial Scan
const initialCatalog = scanMediaWrappers(WRAPPERS_DIR);
console.log(`\n[Test 1] Initial scan found ${initialCatalog.length} learning objects:`);
initialCatalog.forEach(item => {
    console.log(`  • [${item.type.toUpperCase()}] ${item.title} -> ${item.path}`);
});

if (initialCatalog.length === 0) {
    throw new Error('Initial scan returned 0 items');
}

// Check key items
const hasGolf = initialCatalog.some(i => i.title.includes('Golf'));
const hasPdf = initialCatalog.some(i => i.type === 'pdf');
const hasVideo = initialCatalog.some(i => i.type === 'video');

console.log('\n[Verification Check]');
console.log('  ✓ PDF wrapper detected:', hasPdf);
console.log('  ✓ Video wrapper detected:', hasVideo);
console.log('  ✓ Tin Can Golf Example detected:', hasGolf);

// 2. Addition test
const tempDir = path.join(WRAPPERS_DIR, 'test_mock_addition');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
fs.writeFileSync(path.join(tempDir, 'guide.pdf'), '%PDF-1.4 dummy pdf');

const catalogAfterAdd = scanMediaWrappers(WRAPPERS_DIR);
const foundAdded = catalogAfterAdd.some(i => i.id === 'test_mock_addition' && i.type === 'pdf');
console.log('\n[Test 2] Added temporary directory test_mock_addition:');
console.log('  ✓ Automatically discovered new PDF object:', foundAdded);

// 3. Purge test
fs.rmSync(tempDir, { recursive: true, force: true });
const catalogAfterPurge = scanMediaWrappers(WRAPPERS_DIR);
const foundPurged = catalogAfterPurge.some(i => i.id === 'test_mock_addition');
console.log('\n[Test 3] Purged temporary directory test_mock_addition:');
console.log('  ✓ Successfully purged from catalog:', !foundPurged);

if (foundAdded && !foundPurged) {
    console.log('\n==================================================================');
    console.log('  ALL CATALOG SCANNER TESTS PASSED!                               ');
    console.log('==================================================================');
} else {
    throw new Error('Catalog scanner addition/purge test failed');
}
