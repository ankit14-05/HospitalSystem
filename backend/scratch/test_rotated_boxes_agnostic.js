const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fs = require('fs');

async function testRotationsAgnostic() {
  const pdfDoc = await PDFDocument.create();
  
  const rotations = [0, 90, 180, 270];
  const rawW = 842;
  const rawH = 595;

  for (let rot of rotations) {
    const page = pdfDoc.addPage([rawW, rawH]);
    page.setRotation(degrees(rot));

    let angle = page.getRotation().angle;
    angle = ((angle % 360) + 360) % 360; 

    const vPageW = (angle === 90 || angle === 270) ? rawH : rawW;
    const vPageH = (angle === 90 || angle === 270) ? rawW : rawH;

    const toPhysical = (vx, vy) => {
      if (angle === 0) return [vx, vy];
      if (angle === 90) return [rawW - vy, vx];
      if (angle === 180) return [rawW - vx, rawH - vy];
      if (angle === 270) return [vy, rawH - vx];
    };

    const vW = 290;
    const vH = 75;
    const padR = 20;
    const padB = 30;

    const vx = vPageW - padR - vW;
    const vy = padB;
    const [unrotX, unrotY] = toPhysical(vx, vy);

    page.drawRectangle({
      x: unrotX, y: unrotY,
      width: vW, height: vH,
      rotate: degrees(angle),
      borderColor: rgb(1, 0, 0),
      borderWidth: 2,
    });

    const txtVx = vx + 10;
    const txtVy = vy + 14;
    const [txtUx, txtUy] = toPhysical(txtVx, txtVy);

    page.drawText('MediCore HMS — Verified Result', {
      x: txtUx, y: txtUy,
      size: 14,
      rotate: degrees(angle),
      color: rgb(0, 0.5, 0)
    });
  }
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test_rotated_boxes_agnostic.pdf', pdfBytes);
  console.log('Saved test_rotated_boxes_agnostic.pdf');
}

testRotationsAgnostic();
