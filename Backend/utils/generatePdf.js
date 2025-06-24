// utils/generatePdf.js

const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

const fonts = {
  Roboto: {
    normal:path.join(__dirname,'../fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, '../fonts/Roboto-Bold.ttf'),
    italics:path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
    bolditalics:path.join(__dirname,'../fonts/Roboto-BoldItalic.ttf')
  }
};

const printer = new PdfPrinter(fonts);

function generateBloodMatchPDF(donors = [], inventory = [], callback) {
  const donorTableBody = [
    ['Name', 'Gender', 'Age', 'Blood Group', 'City', 'Contact'],
    ...donors.map(d => [
      d.name,
      d.gender,
      String(d.age),
      d.bloodGroup,
      d.city,
      d.contactNumber
    ])
  ];

  const inventoryTableBody = [
    ['Hospital Name', 'Blood Group', 'Units', 'City', 'Contact'],
    ...inventory.map(i => [
      i.hospitalName,
      i.bloodGroup,
      String(i.units),
      i.city,
      i.contactNumber
    ])
  ];

  const docDefinition = {
    content: [
      { text: '🩸 Blood Match Report', style: 'header' },
      '\n',
      { text: 'Matched Donors', style: 'subheader' },
      donors.length > 0 ? {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*', '*'],
          body: donorTableBody
        }
      } : { text: 'No eligible donors found within 10km radius.', italics: true },

      '\n\n',

      { text: 'Matched Hospital Inventories', style: 'subheader' },
      inventory.length > 0 ? {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*'],
          body: inventoryTableBody
        }
      } : { text: 'No matching blood inventory found within 10km radius.', italics: true }
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        alignment: 'center'
      },
      subheader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 5]
      }
    }
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const fileName = `Blood_Match_Report_${Date.now()}.pdf`;
  const filePath = path.join(__dirname, '../public', fileName);
  const stream = fs.createWriteStream(filePath);

  pdfDoc.pipe(stream);
  pdfDoc.end();

  stream.on('finish', () => callback(null, filePath));
  stream.on('error', (err) => callback(err, null));
}

module.exports = generateBloodMatchPDF;
