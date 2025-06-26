// utils/generateBloodRequestPDF.js
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

function generateBloodRequestPDF(requests = [], callback) {
  const tableBody = [
    ['Patient Name', 'Hospital', 'Blood Group', 'Units', 'City', 'Date', 'Requested By'],
    ...requests.map(req => [
      req.patientName,
      req.hospitalName,
      req.bloodGroup,
      String(req.unitsNeeded),
      req.city,
      new Date(req.requestedAt).toLocaleDateString(),
      `${req.requestedBy?.name} (${req.requestedBy?.phoneno})`
    ])
  ];

  const docDefinition = {
    content: [
      { text: '📝 Blood Requesters List', style: 'header' },
      '\n',
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*', '*', '*'],
          body: tableBody
        }
      }
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
  const fileName = `Blood_Request_List_${Date.now()}.pdf`;
  const filePath = path.join(__dirname, '../public', fileName);
  const stream = fs.createWriteStream(filePath);

  pdfDoc.pipe(stream);
  pdfDoc.end();

  stream.on('finish', () => callback(null, filePath));
  stream.on('error', err => callback(err, null));
}

module.exports = generateBloodRequestPDF;
