import React from 'react';
import { CatalogItem, HomeSection } from '../types';
import { ContentRail, RailVariant } from './ContentRail';
import { MAIN_TYPE_IDS } from '../constants/catalogConstants';

export interface MainTypeRailsProps {
  portalMode: 'kannada' | 'all_indian';
  selectedTypeId: number;
  selectedIndianLanguage: string;
  continueWatching: CatalogItem[];
  moviesPool: CatalogItem[];
  podcastsPool: CatalogItem[];
  songsPool: CatalogItem[];
  seriesPool: CatalogItem[];
  microDramaPool: CatalogItem[];
  shortsPool: CatalogItem[];
  aiCinemaPool: CatalogItem[];
  teluguPool?: CatalogItem[];
  tamilPool?: CatalogItem[];
  hindiPool?: CatalogItem[];
  malayalamPool?: CatalogItem[];
  otherIndianPool?: CatalogItem[];
  teluguMovies?: CatalogItem[];
  tamilMovies?: CatalogItem[];
  hindiMovies?: CatalogItem[];
  malayalamMovies?: CatalogItem[];
  otherIndianMovies?: CatalogItem[];
  teluguSongs?: CatalogItem[];
  tamilSongs?: CatalogItem[];
  hindiSongs?: CatalogItem[];
  malayalamSongs?: CatalogItem[];
  otherIndianSongs?: CatalogItem[];
  teluguSeries?: CatalogItem[];
  tamilSeries?: CatalogItem[];
  hindiSeries?: CatalogItem[];
  malayalamSeries?: CatalogItem[];
  teluguPodcasts?: CatalogItem[];
  tamilPodcasts?: CatalogItem[];
  hindiPodcasts?: CatalogItem[];
  malayalamPodcasts?: CatalogItem[];
  filteredAllItems: CatalogItem[];
  filteredSections: HomeSection[];
  onItemPress: (item: CatalogItem) => void;
  onSeeAllPress: (params: { categoryId?: number; videoType?: number; title: string; initialItems?: CatalogItem[] }) => void;
  onTypeSelect?: (typeId: number) => void;
  onLanguageSelect?: (langKey: string) => void;
}

export const MainTypeRails: React.FC<MainTypeRailsProps> = ({
  portalMode,
  selectedTypeId,
  selectedIndianLanguage,
  continueWatching,
  moviesPool,
  podcastsPool,
  songsPool,
  seriesPool,
  microDramaPool,
  shortsPool,
  aiCinemaPool,
  teluguPool = [],
  tamilPool = [],
  hindiPool = [],
  malayalamPool = [],
  otherIndianPool = [],
  teluguMovies = [],
  tamilMovies = [],
  hindiMovies = [],
  malayalamMovies = [],
  otherIndianMovies = [],
  teluguSongs = [],
  tamilSongs = [],
  hindiSongs = [],
  malayalamSongs = [],
  otherIndianSongs = [],
  teluguSeries = [],
  tamilSeries = [],
  hindiSeries = [],
  malayalamSeries = [],
  teluguPodcasts = [],
  tamilPodcasts = [],
  hindiPodcasts = [],
  malayalamPodcasts = [],
  filteredAllItems,
  filteredSections,
  onItemPress,
  onSeeAllPress,
  onTypeSelect,
  onLanguageSelect,
}) => {
  const isKannada = portalMode === 'kannada';
  const isAllLanguages = selectedIndianLanguage === 'all';
  const langTitlePrefix =
    !isKannada && !isAllLanguages
      ? selectedIndianLanguage.charAt(0).toUpperCase() + selectedIndianLanguage.slice(1)
      : isKannada
      ? 'Kannada'
      : 'Indian';

  // ==========================================
  // 1. MOVIES ONLY
  // ==========================================
  if (selectedTypeId === MAIN_TYPE_IDS.MOVIES) {
    return (
      <>
        {continueWatching.length > 0 && (
          <ContentRail
            title={`Continue Watching ${isKannada ? 'Kannada ' : ''}Movies`}
            items={continueWatching}
            variant={RailVariant.standard}
            showProgress={true}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                title: 'Continue Watching',
                initialItems: continueWatching,
              })
            }
          />
        )}

        <ContentRail
          title={`Top 10 ${langTitlePrefix} Blockbuster Movies Today`}
          items={moviesPool.length > 0 ? moviesPool : filteredAllItems}
          variant={RailVariant.ranked}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `Top 10 ${langTitlePrefix} Movies`,
              initialItems: moviesPool,
            })
          }
        />

        {/* In All Indian portal & 'all' language: Show Language-specific Movie Rails */}
        {!isKannada && isAllLanguages && (
          <>
            {teluguMovies.length > 0 && (
              <ContentRail
                title="Blockbuster Telugu Movies"
                items={teluguMovies}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('telugu')}
              />
            )}
            {tamilMovies.length > 0 && (
              <ContentRail
                title="Superhit Tamil Movies"
                items={tamilMovies}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('tamil')}
              />
            )}
            {hindiMovies.length > 0 && (
              <ContentRail
                title="Popular Hindi Cinema Hits"
                items={hindiMovies}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('hindi')}
              />
            )}
            {malayalamMovies.length > 0 && (
              <ContentRail
                title="Acclaimed Malayalam Cinema"
                items={malayalamMovies}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('malayalam')}
              />
            )}
            {otherIndianMovies.length > 0 && (
              <ContentRail
                title="Regional Indian Cinema (Bengali, Marathi & More)"
                items={otherIndianMovies}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() =>
                  onSeeAllPress({
                    title: 'Regional Movies',
                    initialItems: otherIndianMovies,
                  })
                }
              />
            )}
          </>
        )}

        <ContentRail
          title={`Trending ${langTitlePrefix} Movies & Cinema`}
          items={moviesPool.length > 0 ? moviesPool : filteredAllItems}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `Trending ${langTitlePrefix} Movies`,
              initialItems: moviesPool,
            })
          }
        />

        {filteredSections.map((section, idx) => (
          <ContentRail
            key={section.id || idx}
            title={section.title}
            items={section.data}
            variant={RailVariant.standard}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                categoryId: section.id,
                videoType: section.videoType,
                title: section.title,
                initialItems: section.data,
              })
            }
          />
        ))}
      </>
    );
  }

  // ==========================================
  // 2. PODCASTS ONLY
  // ==========================================
  if (selectedTypeId === MAIN_TYPE_IDS.PODCASTS) {
    return (
      <>
        {continueWatching.length > 0 && (
          <ContentRail
            title="Continue Listening"
            items={continueWatching}
            variant={RailVariant.standard}
            showProgress={true}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                title: 'Continue Listening',
                initialItems: continueWatching,
              })
            }
          />
        )}

        <ContentRail
          title={`Top 10 ${langTitlePrefix} Podcasts Today`}
          items={podcastsPool.length > 0 ? podcastsPool : filteredAllItems}
          variant={RailVariant.ranked}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `Top ${langTitlePrefix} Podcasts`,
              initialItems: podcastsPool,
            })
          }
        />

        {!isKannada && isAllLanguages && (
          <>
            {teluguPodcasts.length > 0 && (
              <ContentRail
                title="Telugu Podcasts & Talk Shows"
                items={teluguPodcasts}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('telugu')}
              />
            )}
            {tamilPodcasts.length > 0 && (
              <ContentRail
                title="Tamil Podcasts & Conversations"
                items={tamilPodcasts}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('tamil')}
              />
            )}
            {hindiPodcasts.length > 0 && (
              <ContentRail
                title="Hindi Celebrity Podcasts & Talks"
                items={hindiPodcasts}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('hindi')}
              />
            )}
            {malayalamPodcasts.length > 0 && (
              <ContentRail
                title="Malayalam Podcasts"
                items={malayalamPodcasts}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('malayalam')}
              />
            )}
          </>
        )}

        <ContentRail
          title={`Exclusive ${langTitlePrefix} Video Podcasts & Talk Shows`}
          items={podcastsPool.length > 0 ? podcastsPool : filteredAllItems}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `${langTitlePrefix} Video Podcasts`,
              initialItems: podcastsPool,
            })
          }
        />

        {filteredSections.map((section, idx) => (
          <ContentRail
            key={section.id || idx}
            title={section.title}
            items={section.data}
            variant={RailVariant.standard}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                categoryId: section.id,
                videoType: section.videoType,
                title: section.title,
                initialItems: section.data,
              })
            }
          />
        ))}
      </>
    );
  }

  // ==========================================
  // 3. SONGS / MUSIC ONLY
  // ==========================================
  if (selectedTypeId === MAIN_TYPE_IDS.SONGS) {
    return (
      <>
        <ContentRail
          title={`Top 10 ${langTitlePrefix} Chartbusters & Hit Songs`}
          items={songsPool.length > 0 ? songsPool : filteredAllItems}
          variant={RailVariant.ranked}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `Top ${langTitlePrefix} Songs`,
              initialItems: songsPool,
            })
          }
        />

        {!isKannada && isAllLanguages && (
          <>
            {teluguSongs.length > 0 && (
              <ContentRail
                title="Telugu Hit Songs & Soundtracks"
                items={teluguSongs}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('telugu')}
              />
            )}
            {tamilSongs.length > 0 && (
              <ContentRail
                title="Tamil Chartbusters & Melody Hits"
                items={tamilSongs}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('tamil')}
              />
            )}
            {hindiSongs.length > 0 && (
              <ContentRail
                title="Hindi Bollywood Hits & Soundtracks"
                items={hindiSongs}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('hindi')}
              />
            )}
            {malayalamSongs.length > 0 && (
              <ContentRail
                title="Malayalam Superhit Songs"
                items={malayalamSongs}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('malayalam')}
              />
            )}
            {otherIndianSongs.length > 0 && (
              <ContentRail
                title="Regional Indian Hit Music"
                items={otherIndianSongs}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() =>
                  onSeeAllPress({
                    title: 'Regional Songs',
                    initialItems: otherIndianSongs,
                  })
                }
              />
            )}
          </>
        )}

        <ContentRail
          title={`Popular ${langTitlePrefix} Soundtracks & Albums`}
          items={songsPool.length > 0 ? songsPool : filteredAllItems}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `Popular ${langTitlePrefix} Albums`,
              initialItems: songsPool,
            })
          }
        />

        {filteredSections.map((section, idx) => (
          <ContentRail
            key={section.id || idx}
            title={section.title}
            items={section.data}
            variant={RailVariant.standard}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                categoryId: section.id,
                videoType: section.videoType,
                title: section.title,
                initialItems: section.data,
              })
            }
          />
        ))}
      </>
    );
  }

  // ==========================================
  // 4. SERIES / SHOWS ONLY
  // ==========================================
  if (selectedTypeId === MAIN_TYPE_IDS.SERIES) {
    return (
      <>
        {continueWatching.length > 0 && (
          <ContentRail
            title={`Continue Watching ${isKannada ? 'Kannada ' : ''}Series`}
            items={continueWatching}
            variant={RailVariant.standard}
            showProgress={true}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                title: 'Continue Watching',
                initialItems: continueWatching,
              })
            }
          />
        )}

        <ContentRail
          title={`Top 10 ${langTitlePrefix} Web Series & Shows`}
          items={seriesPool.length > 0 ? seriesPool : filteredAllItems}
          variant={RailVariant.ranked}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `Top ${langTitlePrefix} Series`,
              initialItems: seriesPool,
            })
          }
        />

        {!isKannada && isAllLanguages && (
          <>
            {teluguSeries.length > 0 && (
              <ContentRail
                title="Trending Telugu Web Series"
                items={teluguSeries}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('telugu')}
              />
            )}
            {tamilSeries.length > 0 && (
              <ContentRail
                title="Popular Tamil Series & Dramas"
                items={tamilSeries}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('tamil')}
              />
            )}
            {hindiSeries.length > 0 && (
              <ContentRail
                title="Binge-Worthy Hindi Web Series"
                items={hindiSeries}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('hindi')}
              />
            )}
            {malayalamSeries.length > 0 && (
              <ContentRail
                title="Malayalam Web Series & Shows"
                items={malayalamSeries}
                variant={RailVariant.standard}
                onItemPress={onItemPress}
                onSeeAllPress={() => onLanguageSelect?.('malayalam')}
              />
            )}
          </>
        )}

        <ContentRail
          title={`Binge-Worthy ${langTitlePrefix} Series & Shows`}
          items={seriesPool.length > 0 ? seriesPool : filteredAllItems}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `Binge-Worthy ${langTitlePrefix} Series`,
              initialItems: seriesPool,
            })
          }
        />

        {filteredSections.map((section, idx) => (
          <ContentRail
            key={section.id || idx}
            title={section.title}
            items={section.data}
            variant={RailVariant.standard}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                categoryId: section.id,
                videoType: section.videoType,
                title: section.title,
                initialItems: section.data,
              })
            }
          />
        ))}
      </>
    );
  }

  // ==========================================
  // 5. MICRO-DRAMA ONLY
  // ==========================================
  if (selectedTypeId === MAIN_TYPE_IDS.MICRO_DRAMA) {
    return (
      <>
        <ContentRail
          title={`Top 10 ${langTitlePrefix} Micro-Dramas`}
          items={microDramaPool.length > 0 ? microDramaPool : filteredAllItems}
          variant={RailVariant.ranked}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `Top ${langTitlePrefix} Micro-Dramas`,
              initialItems: microDramaPool,
            })
          }
        />

        <ContentRail
          title={`${langTitlePrefix} Romantic & Drama Micro-Series`}
          items={microDramaPool.length > 0 ? microDramaPool : filteredAllItems}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `${langTitlePrefix} Micro-Dramas`,
              initialItems: microDramaPool,
            })
          }
        />

        {filteredSections.map((section, idx) => (
          <ContentRail
            key={section.id || idx}
            title={section.title}
            items={section.data}
            variant={RailVariant.standard}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                categoryId: section.id,
                videoType: section.videoType,
                title: section.title,
                initialItems: section.data,
              })
            }
          />
        ))}
      </>
    );
  }

  // ==========================================
  // 6. SHORTS ONLY
  // ==========================================
  if (selectedTypeId === MAIN_TYPE_IDS.SHORTS) {
    return (
      <>
        <ContentRail
          title={`Award-Winning ${langTitlePrefix} Short Films`}
          items={shortsPool.length > 0 ? shortsPool : filteredAllItems}
          variant={RailVariant.ranked}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `${langTitlePrefix} Short Films`,
              initialItems: shortsPool,
            })
          }
        />

        <ContentRail
          title={`Trending ${langTitlePrefix} Shorts & Quick Stories`}
          items={shortsPool.length > 0 ? shortsPool : filteredAllItems}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `Trending ${langTitlePrefix} Shorts`,
              initialItems: shortsPool,
            })
          }
        />

        {filteredSections.map((section, idx) => (
          <ContentRail
            key={section.id || idx}
            title={section.title}
            items={section.data}
            variant={RailVariant.standard}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                categoryId: section.id,
                videoType: section.videoType,
                title: section.title,
                initialItems: section.data,
              })
            }
          />
        ))}
      </>
    );
  }

  // ==========================================
  // 7. AI CINEMA ONLY
  // ==========================================
  if (selectedTypeId === MAIN_TYPE_IDS.AI_CINEMA) {
    return (
      <>
        <ContentRail
          title={`${langTitlePrefix} AI Cinema Spotlight`}
          items={aiCinemaPool.length > 0 ? aiCinemaPool : filteredAllItems}
          variant={RailVariant.ranked}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `${langTitlePrefix} AI Cinema`,
              initialItems: aiCinemaPool,
            })
          }
        />

        <ContentRail
          title={`Generative & Sci-Fi ${langTitlePrefix} AI Cinema`}
          items={aiCinemaPool.length > 0 ? aiCinemaPool : filteredAllItems}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: `${langTitlePrefix} AI Cinema`,
              initialItems: aiCinemaPool,
            })
          }
        />

        {filteredSections.map((section, idx) => (
          <ContentRail
            key={section.id || idx}
            title={section.title}
            items={section.data}
            variant={RailVariant.standard}
            onItemPress={onItemPress}
            onSeeAllPress={() =>
              onSeeAllPress({
                categoryId: section.id,
                videoType: section.videoType,
                title: section.title,
                initialItems: section.data,
              })
            }
          />
        ))}
      </>
    );
  }

  // ==========================================
  // 0. FOR YOU (ALL TYPES COMBINED)
  // ==========================================
  return (
    <>
      {continueWatching.length > 0 && (
        <ContentRail
          title="Continue Watching"
          items={continueWatching}
          variant={RailVariant.standard}
          showProgress={true}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              title: 'Continue Watching',
              initialItems: continueWatching,
            })
          }
        />
      )}

      {/* Hero Ranked Rail */}
      {moviesPool.length > 0 && (
        <ContentRail
          title={`Top 10 ${langTitlePrefix} Movies Today`}
          items={moviesPool}
          variant={RailVariant.ranked}
          onItemPress={onItemPress}
          onSeeAllPress={() => onTypeSelect?.(MAIN_TYPE_IDS.MOVIES)}
        />
      )}

      {/* FOR YOU IN ALL INDIAN LANGUAGES: DEDICATED LANGUAGE RAILS AFTER FOR YOU TOP BLOCK */}
      {!isKannada && isAllLanguages && (
        <>
          {teluguPool.length > 0 && (
            <ContentRail
              title="Trending Telugu Cinema & Shows"
              items={teluguPool}
              variant={RailVariant.standard}
              onItemPress={onItemPress}
              onSeeAllPress={() => onLanguageSelect?.('telugu')}
            />
          )}

          {tamilPool.length > 0 && (
            <ContentRail
              title="Blockbuster Tamil Cinema & Hits"
              items={tamilPool}
              variant={RailVariant.standard}
              onItemPress={onItemPress}
              onSeeAllPress={() => onLanguageSelect?.('tamil')}
            />
          )}

          {hindiPool.length > 0 && (
            <ContentRail
              title="Popular Hindi Movies & Originals"
              items={hindiPool}
              variant={RailVariant.standard}
              onItemPress={onItemPress}
              onSeeAllPress={() => onLanguageSelect?.('hindi')}
            />
          )}

          {malayalamPool.length > 0 && (
            <ContentRail
              title="Superhit Malayalam Cinema"
              items={malayalamPool}
              variant={RailVariant.standard}
              onItemPress={onItemPress}
              onSeeAllPress={() => onLanguageSelect?.('malayalam')}
            />
          )}

          {otherIndianPool.length > 0 && (
            <ContentRail
              title="Regional Indian Spotlight (Bengali, Marathi & More)"
              items={otherIndianPool}
              variant={RailVariant.standard}
              onItemPress={onItemPress}
              onSeeAllPress={() =>
                onSeeAllPress({
                  title: 'Regional Indian Cinema',
                  initialItems: otherIndianPool,
                })
              }
            />
          )}
        </>
      )}

      {/* MAIN TYPE CONTENT RAILS */}
      {seriesPool.length > 0 && (
        <ContentRail
          title={`Trending ${langTitlePrefix} Web Series & Shows`}
          items={seriesPool}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() => onTypeSelect?.(MAIN_TYPE_IDS.SERIES)}
        />
      )}

      {songsPool.length > 0 && (
        <ContentRail
          title={`Popular ${langTitlePrefix} Songs & Albums`}
          items={songsPool}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() => onTypeSelect?.(MAIN_TYPE_IDS.SONGS)}
        />
      )}

      {podcastsPool.length > 0 && (
        <ContentRail
          title={`Top ${langTitlePrefix} Podcasts & Conversations`}
          items={podcastsPool}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() => onTypeSelect?.(MAIN_TYPE_IDS.PODCASTS)}
        />
      )}

      {microDramaPool.length > 0 && (
        <ContentRail
          title={`Trending ${langTitlePrefix} Micro-Dramas`}
          items={microDramaPool}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() => onTypeSelect?.(MAIN_TYPE_IDS.MICRO_DRAMA)}
        />
      )}

      {shortsPool.length > 0 && (
        <ContentRail
          title={`Award-Winning ${langTitlePrefix} Shorts`}
          items={shortsPool}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() => onTypeSelect?.(MAIN_TYPE_IDS.SHORTS)}
        />
      )}

      {aiCinemaPool.length > 0 && (
        <ContentRail
          title={`${langTitlePrefix} AI Cinema Spotlight`}
          items={aiCinemaPool}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() => onTypeSelect?.(MAIN_TYPE_IDS.AI_CINEMA)}
        />
      )}

      {filteredSections.map((section, idx) => (
        <ContentRail
          key={section.id || idx}
          title={section.title}
          items={section.data}
          variant={RailVariant.standard}
          onItemPress={onItemPress}
          onSeeAllPress={() =>
            onSeeAllPress({
              categoryId: section.id,
              videoType: section.videoType,
              title: section.title,
              initialItems: section.data,
            })
          }
        />
      ))}
    </>
  );
};

