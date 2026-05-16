jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('storage — R2 configured', () => {
  let uploadImage, getSignedUrl, mockSend;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config', () => ({
      R2_ACCOUNT_ID: 'acct-123',
      R2_ACCESS_KEY_ID: 'key-id',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'test-bucket'
    }));
    const { S3Client } = require('@aws-sdk/client-s3');
    mockSend = jest.fn().mockResolvedValue({});
    S3Client.mockImplementation(() => ({ send: mockSend }));
    ({ uploadImage, getSignedUrl } = require('../../src/services/storage'));
  });

  it('uploadImage calls PutObjectCommand with correct bucket, key, body', async () => {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const buf = Buffer.from('imgdata');
    await uploadImage('receipts/U1/42.jpg', buf);
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'receipts/U1/42.jpg',
      Body: buf,
      ContentType: 'image/jpeg'
    });
    expect(mockSend).toHaveBeenCalled();
  });

  it('getSignedUrl calls aws getSignedUrl with correct expiry', async () => {
    const { getSignedUrl: awsSign } = require('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    awsSign.mockResolvedValue('https://r2.example.com/key?sig=abc');
    const url = await getSignedUrl('receipts/U1/42.jpg', 3600);
    expect(url).toBe('https://r2.example.com/key?sig=abc');
    expect(awsSign).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(GetObjectCommand),
      { expiresIn: 3600 }
    );
  });

  it('getSignedUrl returns null on error', async () => {
    const { getSignedUrl: awsSign } = require('@aws-sdk/s3-request-presigner');
    awsSign.mockRejectedValue(new Error('network error'));
    const url = await getSignedUrl('receipts/U1/42.jpg', 3600);
    expect(url).toBeNull();
  });
});

describe('storage — R2 not configured', () => {
  let uploadImage, getSignedUrl;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config', () => ({
      R2_ACCOUNT_ID: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET_NAME: ''
    }));
    ({ uploadImage, getSignedUrl } = require('../../src/services/storage'));
  });

  it('uploadImage is a no-op', async () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    await expect(uploadImage('key', Buffer.from('x'))).resolves.toBeUndefined();
    expect(S3Client).not.toHaveBeenCalled();
  });

  it('getSignedUrl returns null', async () => {
    const url = await getSignedUrl('key', 3600);
    expect(url).toBeNull();
  });
});
