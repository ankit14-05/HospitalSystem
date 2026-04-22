const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fs = require('fs');

async function testRotations() {
  const pdfDoc = await PDFDocument.create();
  
  // Create 4 pages, test all 4 rotations
  const rotations = [0, 90, 180, 270];
  
  // Original UNROTATED size (landscape)
  const rawW = 842;
  const rawH = 595;

  for (let rot of rotations) {
    const page = pdfDoc.addPage([rawW, rawH]);
    page.setRotation(degrees(rot));

    let angle = page.getRotation().angle;
    // Normalize angle to positive
    angle = ((angle % 360) + 360) % 360; 

    // We want a corner stamp: visual width 290, visual height 65.
    const vW = 290;
    const vH = 65;
    const paddingRight = 20;
    const paddingBottom = 30;

    let boxX, boxY, boxW, boxH, tRot;

    if (angle === 0) {
      boxX = rawW - paddingRight - vW;
      boxY = paddingBottom;
      boxW = vW;
      boxH = vH;
      tRot = 0;
    } else if (angle === 90) {
      // +90 visually rotates clockwise.
      // Unrotated system: X goes "up" visual, Y goes "left" visual.
      // Wait. Origin (0,0) is bottom-left unrotated. 
      // If rotated 90CW around some origin... pdf-lib rotates around center? Or corners?
      // pdf-lib's setRotation rotates the coordinate system.
      // Let's rely on standard rotation coords
      boxX = rawH - paddingBottom - vH;
      boxY = rawW - paddingRight - vW;
      boxW = vH;
      boxH = vW;
    } else if (angle === 180) {
      boxX = paddingRight;
      boxY = rawH - paddingBottom - vH;
      boxW = vW;
      boxH = vH;
    } else if (angle === 270) {
      boxX = paddingBottom;
      boxY = paddingRight;
      boxW = vH;
      boxH = vW;
    }

    page.drawRectangle({
      x: boxX, y: boxY, width: boxW, height: boxH,
      borderColor: rgb(1, 0, 0),
      borderWidth: 2,
    });
    // Draw text inside
    // let's not worry about text rotation yet, just see if the box is in visual bottom-right.
  }
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test_rotated_boxes.pdf', pdfBytes);
  console.log('Saved test_rotated_boxes.pdf');
}

testRotations();
