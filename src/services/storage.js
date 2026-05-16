const { google } = require('googleapis');
const { Readable } = require('stream');
const { GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID } = require('../config');

function getDriveClient() {
  if (!GOOGLE_DRIVE_FOLDER_ID) return null;
  try {
    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    return google.drive({ version: 'v3', auth });
  } catch (err) {
    console.error('Drive client init failed:', err);
    return null;
  }
}

const drive = getDriveClient();

async function uploadImage(fileName, buffer) {
  if (!drive) return null;
  try {
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [GOOGLE_DRIVE_FOLDER_ID]
      },
      media: {
        mimeType: 'image/jpeg',
        body: Readable.from(buffer)
      },
      fields: 'id'
    });
    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });
    return res.data.id;
  } catch (err) {
    console.error(`Drive upload failed for ${fileName}:`, err);
    return null;
  }
}

function getImageUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

module.exports = { uploadImage, getImageUrl };
