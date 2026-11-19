import { payload } from '../api/services';

describe('payload helpers', () => {
  it('builds section_list body', () => {
    const ctx = { userId: 1, deviceId: 'dev-1', isKidsProfile: false };
    expect(payload.sectionList(ctx, 2, 1, 3)).toEqual({
      user_id: 1,
      type_id: 2,
      is_home_screen: 1,
      device_id: 'dev-1',
      is_kids_profile: 0,
      page_no: 3,
    });
  });
});
