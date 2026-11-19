import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { CatalogService } from '../../services/catalogService';
import { CatalogItem, CatalogLanguage, HomeSection } from '../../types';
import { MAIN_TYPE_IDS } from '../../constants/catalogConstants';

export interface CatalogState {
  portalMode: 'kannada' | 'all_indian';
  selectedTypeId: number;
  selectedIndianLanguage: string;
  banners: CatalogItem[];
  sections: HomeSection[];
  latest: CatalogItem[];
  languages: CatalogLanguage[];
  languageContent: Record<string, CatalogItem[]>;
  loading: boolean;
  refreshing: boolean;
  loadingLanguage: boolean;
  error: string | null;
}

const initialState: CatalogState = {
  portalMode: 'kannada',
  selectedTypeId: MAIN_TYPE_IDS.ALL,
  selectedIndianLanguage: 'all',
  banners: [],
  sections: [],
  latest: [],
  languages: [],
  languageContent: {},
  loading: true,
  refreshing: false,
  loadingLanguage: false,
  error: null,
};

// Async thunk to fetch home catalog data
export const fetchHomeCatalog = createAsyncThunk(
  'catalog/fetchHomeCatalog',
  async (
    { typeId, isRefresh = false }: { typeId: number; isRefresh?: boolean },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { catalog: CatalogState };
      const portalMode = state.catalog?.portalMode || 'kannada';
      const langParam = portalMode === 'kannada' ? 'kannada' : 'all-indian';
      const [res, langList, nonKannadaList] = await Promise.all([
        CatalogService.getHomeCatalog(typeId, langParam),
        CatalogService.getLanguages().catch(() => []),
        portalMode === 'all_indian' ? CatalogService.getContentNonKannada().catch(() => []) : Promise.resolve([]),
      ]);
      const combinedLatest = [
        ...res.latest,
        ...(Array.isArray(nonKannadaList) ? nonKannadaList : []),
      ];
      return {
        banners: res.banners,
        sections: res.sections,
        latest: combinedLatest,
        languages: Array.isArray(langList) ? langList : [],
        isRefresh,
      };
    } catch (e: any) {
      return rejectWithValue(e.message || 'Failed to load catalog');
    }
  }
);

// Async thunk to fetch language-specific content
export const fetchLanguageContent = createAsyncThunk(
  'catalog/fetchLanguageContent',
  async (langName: string, { getState, rejectWithValue }) => {
    if (!langName || langName === 'all' || langName === 'all_indian' || langName === 'non-kannada') {
      const items = await CatalogService.getContentNonKannada();
      return { key: 'all_indian', items: Array.isArray(items) ? items : [] };
    }
    const key = langName.toLowerCase().trim();
    const state = getState() as { catalog: CatalogState };
    if (state.catalog.languageContent[key]?.length > 0) {
      return { key, items: state.catalog.languageContent[key] };
    }

    try {
      const languages = state.catalog.languages || [];
      const matched = languages.find(
        (l) => l.name.toLowerCase() === key || (l.code && l.code.toLowerCase() === key)
      );
      const queryParam = matched ? (matched.code || matched.name || matched.id) : key;
      const items = await CatalogService.getContentByLanguage(queryParam);
      return { key, items: Array.isArray(items) ? items : [] };
    } catch (e: any) {
      return rejectWithValue(e.message || 'Failed to fetch language content');
    }
  }
);

export const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    setPortalMode: (state, action: PayloadAction<'kannada' | 'all_indian'>) => {
      state.portalMode = action.payload;
    },
    setSelectedTypeId: (state, action: PayloadAction<number>) => {
      state.selectedTypeId = action.payload;
    },
    setSelectedIndianLanguage: (state, action: PayloadAction<string>) => {
      state.selectedIndianLanguage = action.payload.toLowerCase().trim();
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchHomeCatalog
      .addCase(fetchHomeCatalog.pending, (state, action) => {
        if (action.meta.arg.isRefresh) {
          state.refreshing = true;
        } else {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchHomeCatalog.fulfilled, (state, action) => {
        state.loading = false;
        state.refreshing = false;
        state.banners = action.payload.banners;
        state.sections = action.payload.sections;
        state.latest = action.payload.latest;
        if (action.payload.languages.length > 0) {
          state.languages = action.payload.languages;
        }
      })
      .addCase(fetchHomeCatalog.rejected, (state, action) => {
        state.loading = false;
        state.refreshing = false;
        state.error = (action.payload as string) || 'Failed to load catalog';
      })

      // fetchLanguageContent
      .addCase(fetchLanguageContent.pending, (state) => {
        state.loadingLanguage = true;
      })
      .addCase(fetchLanguageContent.fulfilled, (state, action) => {
        state.loadingLanguage = false;
        if (action.payload.key && action.payload.items.length > 0) {
          state.languageContent[action.payload.key] = action.payload.items;
        }
      })
      .addCase(fetchLanguageContent.rejected, (state) => {
        state.loadingLanguage = false;
      });
  },
});

export const {
  setPortalMode,
  setSelectedTypeId,
  setSelectedIndianLanguage,
} = catalogSlice.actions;

export default catalogSlice.reducer;
