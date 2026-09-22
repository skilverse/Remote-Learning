const fs = require('fs');

const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 260 >>
stream
BT
/F1 22 Tf
50 720 Td
(Healthcare Compliance & Data Privacy Guidelines) Tj
0 -40 Td
/F1 12 Tf
(Document ID: SOP-SEC-2026-V1) Tj
0 -30 Td
(1. Mandatory Annual Attestation for all Clinical and Operations Staff.) Tj
0 -20 Td
(2. Personal Health Information [PHI] must remain encrypted at rest and in transit.) Tj
0 -20 Td
(3. In accordance with HIPAA & HITRUST compliance, all training sessions) Tj
0 -20 Td
(   are tracked via xAPI telemetry into Trax LRS and Learning Nexus.) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000224 00000 n 
0000000302 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
614
%%EOF`;

fs.writeFileSync('media-wrappers/pdf/sample.pdf', pdfContent, 'utf8');
console.log('sample.pdf generated at media-wrappers/pdf/sample.pdf');
