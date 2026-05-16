const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = require('../config');

const client = R2_ACCOUNT_ID ? new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
}) : null;

async function uploadImage(key, buffer) {
  if (!client) return;
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg'
  }));
}

async function getSignedUrl(key, expirySeconds = 3600) {
  if (!client) return null;
  try {
    return await awsGetSignedUrl(
      client,
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
      { expiresIn: expirySeconds }
    );
  } catch (err) {
    console.error('getSignedUrl error:', err);
    return null;
  }
}

module.exports = { uploadImage, getSignedUrl };
