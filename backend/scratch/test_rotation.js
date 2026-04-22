const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fs = require('fs');

async function testRotation() {
  const pdfDoc = await PDFDocument.create();
  
  // Create a page rotated by 90 degrees (like a scanned PDF)
  // Portrait view
  const page = pdfDoc.addPage([595, 842]);
  page.setRotation(degrees(90)); 
  // Wait, if it's 595x842, and rotated 90 degrees, it will look like landscape, 842x595.
  // Oh, wait, the user's screenshot is portrait!
  // If the screenshot is portrait, and the page was rotated 90 degrees, the original unrotated page was LANDSCAPE!
  // Let's mimic that: Original is landscape, rotated 90 deg clockwise -> becomes portrait visually.
  const pageLandscape = pdfDoc.addPage([842, 595]);
  pageLandscape.setRotation(degrees(-90)); 

  // We want to put a corner stamp at VISUAL bottom-right of pageLandscape.
  // Visual width = 595. Visual height = 842.
  
  const rawW = 842;
  const rawH = 595;
  const angle = pageLandscape.getRotation().angle;
  console.log('Angle:', angle); // Could be -90 or 270

  let boxW = 290;
  let boxH = 65;
  let visualMarginRight = 20;
  let visualMarginBottom = 30;

  // Let's find the correct coordinates for the unrotated space so it appears at visual bottom right.
  let x, y, rectW, rectH, tRot;

  // Function to map Visual coords to Unrotated coords
  // Visual bounds: (0,0) is bottom-left, (V_W, V_H) is top-right.
  // If angle == 90 (clock-wise):
  // visual (0,0) corresponds to unrotated (0, rawH)
  // X_unrotated = Y_visual
  // Y_unrotated = rawH - X_visual
  
  // Actually, we can just use setRotation?
  pageLandscape.drawText('Test', { x: 100, y: 100, size: 24, color: rgb(1,0,0) });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test_rotated.pdf', pdfBytes);
}

testRotation();
