jest.mock('googleapis');
jest.mock('../../src/config', () => ({
  GOOGLE_SHEET_ID: 'sheet-id-123',
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    type: 'service_account',
    project_id: 'test',
    private_key: 'fake-key',
    client_email: 'test@test.iam.gserviceaccount.com'
  })
}));

const { google } = require('googleapis');
const mockAppend = jest.fn().mockResolvedValue({
  data: { updates: { updatedRange: 'Sheet1!A2:H2' } }
});

google.auth = {
  GoogleAuth: jest.fn().mockImplementation(() => ({ getClient: jest.fn() }))
};
google.sheets = jest.fn().mockReturnValue({
  spreadsheets: { values: { append: mockAppend } }
});

describe('appendReceiptRow', () => {
  let sheets;
  beforeEach(() => {
    jest.resetModules();
    jest.mock('googleapis');
    jest.mock('../../src/config', () => ({
      GOOGLE_SHEET_ID: 'sheet-id-123',
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account', client_email: 'x@y.com', private_key: 'k' })
    }));
    const { google: g } = require('googleapis');
    g.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };
    g.sheets = jest.fn().mockReturnValue({
      spreadsheets: { values: { append: mockAppend } }
    });
    sheets = require('../../src/services/sheets');
  });

  it('calls sheets.append with correct row data', async () => {
    const receipt = {
      store_name: 'ร้านกาแฟ',
      date_on_receipt: '2026-05-14',
      category: 'อาหาร/เครื่องดื่ม',
      items: [{ name: 'กาแฟ', amount: 65 }],
      total_amount: 65,
      line_display_name: 'Pupa',
      line_user_id: 'U123'
    };

    await sheets.appendReceiptRow(receipt);

    expect(mockAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: 'sheet-id-123',
        range: 'Sheet1!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: expect.objectContaining({
          values: expect.arrayContaining([
            expect.arrayContaining(['ร้านกาแฟ', 'อาหาร/เครื่องดื่ม', 65, 'Pupa', 'U123'])
          ])
        })
      })
    );
  });
});
