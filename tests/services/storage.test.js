// jest.mock hoisted to top; jest.resetModules() in beforeEach forces storage.js
// re-evaluation so the module-level drive client picks up the new config mock.
jest.mock('googleapis');

describe('storage — Drive configured', () => {
  let uploadImage, getImageUrl;
  let mockFilesCreate, mockPermCreate;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config', () => ({
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account' }),
      GOOGLE_DRIVE_FOLDER_ID: 'test-folder-id'
    }));
    const { google } = require('googleapis');
    mockFilesCreate = jest.fn().mockResolvedValue({ data: { id: 'file-id-123' } });
    mockPermCreate = jest.fn().mockResolvedValue({});
    google.auth.GoogleAuth = jest.fn().mockImplementation(() => ({}));
    google.drive = jest.fn().mockReturnValue({
      files: { create: mockFilesCreate },
      permissions: { create: mockPermCreate }
    });
    ({ uploadImage, getImageUrl } = require('../../src/services/storage'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.clearAllMocks());

  it('uploadImage calls drive.files.create with correct name and parent folder', async () => {
    const buf = Buffer.from('imgdata');
    const fileId = await uploadImage('U123_42.jpg', buf);
    expect(mockFilesCreate).toHaveBeenCalledWith({
      requestBody: { name: 'U123_42.jpg', parents: ['test-folder-id'] },
      media: expect.objectContaining({ mimeType: 'image/jpeg' }),
      fields: 'id'
    });
    expect(fileId).toBe('file-id-123');
  });

  it('uploadImage sets file permission to anyone reader', async () => {
    await uploadImage('U123_42.jpg', Buffer.from('x'));
    expect(mockPermCreate).toHaveBeenCalledWith({
      fileId: 'file-id-123',
      requestBody: { role: 'reader', type: 'anyone' }
    });
  });

  it('uploadImage returns null on Drive API error', async () => {
    mockFilesCreate.mockRejectedValue(new Error('Drive API error'));
    const result = await uploadImage('U123_42.jpg', Buffer.from('x'));
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('getImageUrl returns correct Drive download URL', () => {
    expect(getImageUrl('file-id-123')).toBe(
      'https://drive.google.com/uc?id=file-id-123&export=download'
    );
  });

  it('getImageUrl returns null for null fileId', () => {
    expect(getImageUrl(null)).toBeNull();
  });
});

describe('storage — Drive not configured', () => {
  let uploadImage, getImageUrl;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config', () => ({
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account' }),
      GOOGLE_DRIVE_FOLDER_ID: ''
    }));
    ({ uploadImage, getImageUrl } = require('../../src/services/storage'));
  });

  afterEach(() => jest.clearAllMocks());

  it('uploadImage returns null when not configured', async () => {
    const { google } = require('googleapis');
    const result = await uploadImage('key.jpg', Buffer.from('x'));
    expect(result).toBeNull();
    expect(google.drive).not.toHaveBeenCalled();
  });

  it('getImageUrl still constructs URL when given a fileId', () => {
    expect(getImageUrl('some-id')).toBe(
      'https://drive.google.com/uc?id=some-id&export=download'
    );
  });
});
