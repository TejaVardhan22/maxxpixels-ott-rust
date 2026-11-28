import { normalizeApiBaseUrl } from '@ott/shared';

const GRAPHQL_TIMEOUT_MS = 10_000;

function resolveGraphqlEndpoint(): string {
  if (typeof window !== 'undefined') {
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
    return `${base}/graphql`;
  }
  const rawServerBase = process.env.API_BACKEND_URL?.trim();
  const rawPublicBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const raw =
    rawServerBase ||
    (rawPublicBase && !rawPublicBase.startsWith('/')
      ? rawPublicBase
      : 'http://127.0.0.1:8081/api/v1');
  const base = normalizeApiBaseUrl(raw);
  return `${base}/graphql`;
}

export async function executeWebGraphQL<T = any>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const endpoint = resolveGraphqlEndpoint();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables: variables || {} }),
    cache: 'no-store',
    signal: AbortSignal.timeout(GRAPHQL_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message?: string }> };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message || 'GraphQL execution error');
  }
  if (!json.data) {
    throw new Error('Empty GraphQL data payload');
  }
  return json.data;
}

export const WEB_HOME_GRAPHQL_QUERY = `
  query WebHome($platform: String, $language: String) {
    home(platform: $platform, language: $language) {
      banners {
        id
        title
        subtitle
        imageUrl
        mobileImageUrl
        actionUrl
        contentId
        displayOrder
        platform
      }
      sections {
        id
        title
        subtitle
        layout
        items {
          id
          title
          slug
          contentType
          status
          description
          shortDescription
          posterUrl
          backdropUrl
          bannerUrl
          trailerUrl
          language
          releaseYear
          ageRating
          durationSeconds
          monetization
          accessType
          isPremium
          isFeatured
          isTrending
          rentPrice
          viewCount
        }
      }
      categories {
        id
        name
        slug
      }
    }
    browse(size: 100) {
      items {
        id
        title
        slug
        contentType
        status
        description
        shortDescription
        posterUrl
        backdropUrl
        bannerUrl
        trailerUrl
        language
        releaseYear
        ageRating
        durationSeconds
        monetization
        accessType
        isPremium
        isFeatured
        isTrending
        rentPrice
        viewCount
      }
    }
  }
`;

export const WEB_CONTENT_DETAIL_GRAPHQL_QUERY = `
  query WebContentDetail($idOrSlug: String!) {
    content(idOrSlug: $idOrSlug) {
      id
      title
      slug
      contentType
      status
      description
      shortDescription
      posterUrl
      backdropUrl
      bannerUrl
      trailerUrl
      language
      releaseYear
      releaseDate
      ageRating
      durationSeconds
      durationMinutes
      monetization
      accessType
      isPremium
      isFeatured
      isTrending
      rentPrice
      viewCount
      masterPlaylistUrl
      categories
      genres
      seasons {
        id
        seasonNumber
        title
        description
        posterUrl
        releaseDate
        episodes {
          id
          episodeNumber
          title
          description
          thumbnailUrl
          hlsUrl
          videoUrl
          durationSeconds
          isFreePreview
          releaseDate
        }
      }
    }
  }
`;
