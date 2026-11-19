import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { EngagementService } from '../../services/engagementService';
import { AuthService } from '../../services/authService';
import { CatalogItem, parseCatalogItem } from '../../types';
import { Toast } from '../../components/Toast';

export interface EngagementState {
  watchlistMap: Record<string, boolean>;
  continueWatching: CatalogItem[];
  loading: boolean;
}

const initialState: EngagementState = {
  watchlistMap: {},
  continueWatching: [],
  loading: false,
};

export const fetchWatchlist = createAsyncThunk(
  'engagement/fetchWatchlist',
  async (_, { rejectWithValue }) => {
    if (!AuthService.authToken) return {};
    try {
      const items = await EngagementService.getWatchlist();
      return Object.fromEntries(items.map((item) => [String(item.contentId ?? item.id), true]));
    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

export const fetchContinueWatching = createAsyncThunk(
  'engagement/fetchContinueWatching',
  async (_, { rejectWithValue }) => {
    try {
      const items = await EngagementService.getContinueWatching();
      if (Array.isArray(items)) {
        return items.map((item: any) => parseCatalogItem(item));
      }
      return [];
    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

export const toggleWatchlistThunk = createAsyncThunk(
  'engagement/toggleWatchlist',
  async (item: CatalogItem, { getState, rejectWithValue }) => {
    if (!AuthService.authToken) {
      Toast.info('Sign in to save your watchlist.');
      return rejectWithValue('Unauthenticated');
    }
    const state = getState() as { engagement: EngagementState };
    const key = String(item.id);
    const removing = Boolean(state.engagement.watchlistMap[key]);

    try {
      const saved = removing
        ? await EngagementService.removeWatchlist(item.id)
        : await EngagementService.addWatchlist(item.id);

      if (!saved) {
        Toast.info('Unable to update watchlist. Please try again.');
        return rejectWithValue('Failed');
      }

      Toast.success(removing ? 'Removed from Watchlist' : 'Added to Watchlist');
      return { id: key, isWatchlisted: !removing };
    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

export const engagementSlice = createSlice({
  name: 'engagement',
  initialState,
  reducers: {
    clearEngagement: (state) => {
      state.watchlistMap = {};
      state.continueWatching = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWatchlist.fulfilled, (state, action) => {
        state.watchlistMap = action.payload;
      })
      .addCase(fetchContinueWatching.fulfilled, (state, action) => {
        state.continueWatching = action.payload;
      })
      .addCase(toggleWatchlistThunk.fulfilled, (state, action) => {
        state.watchlistMap[action.payload.id] = action.payload.isWatchlisted;
      });
  },
});

export const { clearEngagement } = engagementSlice.actions;

export default engagementSlice.reducer;
