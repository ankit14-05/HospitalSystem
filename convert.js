const fs = require('fs');
try {
  const content = fs.readFileSync('backend/src/database.sql', 'utf16le');
  fs.writeFileSync('backend/src/database_utf8.sql', content, 'utf8');
  console.log('Conversion successful.');
} catch (e) {
  console.error(e);
}
