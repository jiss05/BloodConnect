const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

const fonts = {
  Roboto: {
    normal: path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, '../fonts/Roboto-Bold.ttf'),
    italics: path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '../fonts/Roboto-BoldItalic.ttf')
  }
};

const printer = new PdfPrinter(fonts);

function generateInventoryListPDF(inventories = [], callback) {
  const tableBody = [
    ['Hospital Name', 'Blood Group', 'Units', 'City', 'Contact']
  ];

  inventories.forEach(i => {
    i.bloodgroups.forEach(bg => {
      tableBody.push([
        i.hospitalName,
        bg.bloodGroup,
        String(bg.units),
        i.city,
        i.contactNumber
      ]);
    });
  });

  const docDefinition = {
    content: [
      { text: '🧾 Blood Inventory Report', style: 'header' },
      '\n',
      inventories.length > 0 ? {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*'],
          body: tableBody
        }
      } : { text: 'No blood inventories found.', italics: true }
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        alignment: 'center'
      }
    }
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const fileName = `Blood_Inventory_Report_${Date.now()}.pdf`;
  const filePath = path.join(__dirname, '../public', fileName);
  const stream = fs.createWriteStream(filePath);

  pdfDoc.pipe(stream);
  pdfDoc.end();

  stream.on('finish', () => callback(null, filePath));
  stream.on('error', (err) => callback(err, null));
}

module.exports = generateInventoryListPDF;
