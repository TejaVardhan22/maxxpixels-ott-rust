package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/graphql-go/graphql"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/models"
	"golang.org/x/sync/errgroup"
)

type graphQLRequest struct {
	Query         string         `json:"query"`
	OperationName string         `json:"operationName"`
	Variables     map[string]any `json:"variables"`
}

var (
	gqlOnce   sync.Once
	gqlSchema graphql.Schema
	gqlErr    error
)

func (h *Handler) ensureGraphQLSchema() (graphql.Schema, error) {
	gqlOnce.Do(func() {
		gqlSchema, gqlErr = buildCatalogGraphQLSchema(h.svc)
	})
	return gqlSchema, gqlErr
}

// handleGraphQL executes GraphQL queries (POST JSON or GET ?query=...) and serves a lightweight
// interactive GraphQL Explorer on GET without a query param.
func (h *Handler) handleGraphQL(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet && strings.TrimSpace(r.URL.Query().Get("query")) == "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(graphQLPlaygroundHTML))
		return
	}

	schema, err := h.ensureGraphQLSchema()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "GraphQL schema initialization failed: "+err.Error())
		return
	}

	var req graphQLRequest
	if r.Method == http.MethodGet {
		req.Query = r.URL.Query().Get("query")
		req.OperationName = r.URL.Query().Get("operationName")
		if rawVars := strings.TrimSpace(r.URL.Query().Get("variables")); rawVars != "" {
			_ = json.Unmarshal([]byte(rawVars), &req.Variables)
		}
	} else {
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpx.Error(w, http.StatusBadRequest, "Invalid GraphQL JSON payload")
			return
		}
	}

	req.Query = strings.TrimSpace(req.Query)
	if req.Query == "" {
		httpx.Error(w, http.StatusBadRequest, "GraphQL query is required")
		return
	}
	if len(req.Query) > 32*1024 {
		httpx.Error(w, http.StatusRequestEntityTooLarge, "GraphQL query exceeds maximum length")
		return
	}
	if estimateBracesDepth(req.Query) > 10 {
		httpx.Error(w, http.StatusBadRequest, "GraphQL query exceeds maximum nesting depth (10)")
		return
	}

	result := graphql.Do(graphql.Params{
		Schema:         schema,
		RequestString:  req.Query,
		VariableValues: req.Variables,
		OperationName:  req.OperationName,
		Context:        r.Context(),
	})

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(result)
}

func estimateBracesDepth(q string) int {
	depth, maxDepth := 0, 0
	inStr := false
	for i := 0; i < len(q); i++ {
		ch := q[i]
		if ch == '"' && (i == 0 || q[i-1] != '\\') {
			inStr = !inStr
			continue
		}
		if inStr {
			continue
		}
		if ch == '{' {
			depth++
			if depth > maxDepth {
				maxDepth = depth
			}
		} else if ch == '}' {
			depth--
		}
	}
	return maxDepth
}

func buildCatalogGraphQLSchema(svc *Service) (graphql.Schema, error) {
	episodeType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Episode",
		Fields: graphql.Fields{
			"id":              &graphql.Field{Type: graphql.Int},
			"episodeNumber":   &graphql.Field{Type: graphql.Int},
			"title":           &graphql.Field{Type: graphql.String},
			"description":     &graphql.Field{Type: graphql.String},
			"thumbnailUrl":    &graphql.Field{Type: graphql.String},
			"hlsUrl":          &graphql.Field{Type: graphql.String},
			"videoUrl":        &graphql.Field{Type: graphql.String},
			"durationSeconds": &graphql.Field{Type: graphql.Int},
			"isFreePreview":   &graphql.Field{Type: graphql.Boolean},
			"releaseDate":     &graphql.Field{Type: graphql.String},
		},
	})

	seasonType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Season",
		Fields: graphql.Fields{
			"id":           &graphql.Field{Type: graphql.Int},
			"seasonNumber": &graphql.Field{Type: graphql.Int},
			"title":        &graphql.Field{Type: graphql.String},
			"description":  &graphql.Field{Type: graphql.String},
			"posterUrl":    &graphql.Field{Type: graphql.String},
			"releaseDate":  &graphql.Field{Type: graphql.String},
			"episodes": &graphql.Field{
				Type: graphql.NewList(episodeType),
				Resolve: func(p graphql.ResolveParams) (any, error) {
					m := toMap(p.Source)
					if eps, ok := m["episodes"]; ok && eps != nil {
						return eps, nil
					}
					sid := int64Val(m, "id")
					if sid <= 0 {
						return []map[string]any{}, nil
					}
					eps, err := svc.ListSeasonEpisodes(p.Context, sid)
					if err != nil {
						return nil, err
					}
					return episodesToMaps(eps), nil
				},
			},
		},
	})

	contentType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Content",
		Fields: graphql.Fields{
			"id":                &graphql.Field{Type: graphql.Int},
			"title":             &graphql.Field{Type: graphql.String},
			"slug":              &graphql.Field{Type: graphql.String},
			"contentType":       &graphql.Field{Type: graphql.String},
			"status":            &graphql.Field{Type: graphql.String},
			"description":       &graphql.Field{Type: graphql.String},
			"shortDescription":  &graphql.Field{Type: graphql.String},
			"posterUrl":         &graphql.Field{Type: graphql.String},
			"backdropUrl":       &graphql.Field{Type: graphql.String},
			"bannerUrl":         &graphql.Field{Type: graphql.String},
			"trailerUrl":        &graphql.Field{Type: graphql.String},
			"language":          &graphql.Field{Type: graphql.String},
			"releaseYear":       &graphql.Field{Type: graphql.Int},
			"releaseDate":       &graphql.Field{Type: graphql.String},
			"ageRating":         &graphql.Field{Type: graphql.String},
			"durationSeconds":   &graphql.Field{Type: graphql.Int},
			"durationMinutes":   &graphql.Field{Type: graphql.Int},
			"monetization":      &graphql.Field{Type: graphql.String},
			"accessType":        &graphql.Field{Type: graphql.String},
			"isPremium":         &graphql.Field{Type: graphql.Boolean},
			"isFeatured":        &graphql.Field{Type: graphql.Boolean},
			"isTrending":        &graphql.Field{Type: graphql.Boolean},
			"rentPrice":         &graphql.Field{Type: graphql.Float},
			"viewCount":         &graphql.Field{Type: graphql.Int},
			"imdbRating":        &graphql.Field{Type: graphql.Float},
			"masterPlaylistUrl": &graphql.Field{Type: graphql.String},
			"categories":        &graphql.Field{Type: graphql.NewList(graphql.String)},
			"genres":            &graphql.Field{Type: graphql.NewList(graphql.String)},
			"seasons": &graphql.Field{
				Type: graphql.NewList(seasonType),
				Resolve: func(p graphql.ResolveParams) (any, error) {
					m := toMap(p.Source)
					if secs, ok := m["seasons"]; ok && secs != nil {
						return secs, nil
					}
					cid := int64Val(m, "id")
					if cid <= 0 {
						return []map[string]any{}, nil
					}
					seasons, err := svc.AdminListSeasons(p.Context, cid)
					if err != nil {
						return []map[string]any{}, nil
					}
					return seasonsToMaps(seasons), nil
				},
			},
		},
	})

	bannerType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Banner",
		Fields: graphql.Fields{
			"id":             &graphql.Field{Type: graphql.Int},
			"title":          &graphql.Field{Type: graphql.String},
			"subtitle":       &graphql.Field{Type: graphql.String},
			"imageUrl":       &graphql.Field{Type: graphql.String},
			"mobileImageUrl": &graphql.Field{Type: graphql.String},
			"actionUrl":      &graphql.Field{Type: graphql.String},
			"contentId":      &graphql.Field{Type: graphql.Int},
			"displayOrder":   &graphql.Field{Type: graphql.Int},
			"platform":       &graphql.Field{Type: graphql.String},
		},
	})

	sectionType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Section",
		Fields: graphql.Fields{
			"id":       &graphql.Field{Type: graphql.Int},
			"title":    &graphql.Field{Type: graphql.String},
			"subtitle": &graphql.Field{Type: graphql.String},
			"layout":   &graphql.Field{Type: graphql.String},
			"items":    &graphql.Field{Type: graphql.NewList(contentType)},
		},
	})

	contentTypeItem := graphql.NewObject(graphql.ObjectConfig{
		Name: "ContentTypeItem",
		Fields: graphql.Fields{
			"id":           &graphql.Field{Type: graphql.Int},
			"name":         &graphql.Field{Type: graphql.String},
			"title":        &graphql.Field{Type: graphql.String},
			"slug":         &graphql.Field{Type: graphql.String},
			"displayOrder": &graphql.Field{Type: graphql.Int},
		},
	})

	languageItem := graphql.NewObject(graphql.ObjectConfig{
		Name: "LanguageItem",
		Fields: graphql.Fields{
			"id":         &graphql.Field{Type: graphql.Int},
			"name":       &graphql.Field{Type: graphql.String},
			"code":       &graphql.Field{Type: graphql.String},
			"nativeName": &graphql.Field{Type: graphql.String},
		},
	})

	categoryItem := graphql.NewObject(graphql.ObjectConfig{
		Name: "CategoryItem",
		Fields: graphql.Fields{
			"id":   &graphql.Field{Type: graphql.Int},
			"name": &graphql.Field{Type: graphql.String},
			"slug": &graphql.Field{Type: graphql.String},
		},
	})

	genreItem := graphql.NewObject(graphql.ObjectConfig{
		Name: "GenreItem",
		Fields: graphql.Fields{
			"id":   &graphql.Field{Type: graphql.Int},
			"name": &graphql.Field{Type: graphql.String},
			"slug": &graphql.Field{Type: graphql.String},
		},
	})

	liveChannelType := graphql.NewObject(graphql.ObjectConfig{
		Name: "LiveChannel",
		Fields: graphql.Fields{
			"id":            &graphql.Field{Type: graphql.Int},
			"name":          &graphql.Field{Type: graphql.String},
			"slug":          &graphql.Field{Type: graphql.String},
			"category":      &graphql.Field{Type: graphql.String},
			"languageCode":  &graphql.Field{Type: graphql.String},
			"streamUrl":     &graphql.Field{Type: graphql.String},
			"hlsStreamUrl":  &graphql.Field{Type: graphql.String},
			"logoUrl":       &graphql.Field{Type: graphql.String},
			"posterUrl":     &graphql.Field{Type: graphql.String},
			"accessType":    &graphql.Field{Type: graphql.String},
			"channelNumber": &graphql.Field{Type: graphql.Int},
			"isLive":        &graphql.Field{Type: graphql.Boolean},
			"isPremium":     &graphql.Field{Type: graphql.Boolean},
		},
	})

	liveEventType := graphql.NewObject(graphql.ObjectConfig{
		Name: "LiveEvent",
		Fields: graphql.Fields{
			"id":           &graphql.Field{Type: graphql.Int},
			"title":        &graphql.Field{Type: graphql.String},
			"slug":         &graphql.Field{Type: graphql.String},
			"description":  &graphql.Field{Type: graphql.String},
			"streamUrl":    &graphql.Field{Type: graphql.String},
			"hlsStreamUrl": &graphql.Field{Type: graphql.String},
			"posterUrl":    &graphql.Field{Type: graphql.String},
			"status":       &graphql.Field{Type: graphql.String},
			"startTime":    &graphql.Field{Type: graphql.String},
			"endTime":      &graphql.Field{Type: graphql.String},
			"accessType":   &graphql.Field{Type: graphql.String},
			"isPpv":        &graphql.Field{Type: graphql.Boolean},
			"ppvPrice":     &graphql.Field{Type: graphql.Float},
		},
	})

	homeScreenType := graphql.NewObject(graphql.ObjectConfig{
		Name: "HomeScreen",
		Fields: graphql.Fields{
			"banners":      &graphql.Field{Type: graphql.NewList(bannerType)},
			"sections":     &graphql.Field{Type: graphql.NewList(sectionType)},
			"featured":     &graphql.Field{Type: graphql.NewList(contentType)},
			"trending":     &graphql.Field{Type: graphql.NewList(contentType)},
			"contentTypes": &graphql.Field{Type: graphql.NewList(contentTypeItem)},
			"languages":    &graphql.Field{Type: graphql.NewList(languageItem)},
			"categories":   &graphql.Field{Type: graphql.NewList(categoryItem)},
			"genres":       &graphql.Field{Type: graphql.NewList(genreItem)},
		},
	})

	browseResultType := graphql.NewObject(graphql.ObjectConfig{
		Name: "BrowseResult",
		Fields: graphql.Fields{
			"items":   &graphql.Field{Type: graphql.NewList(contentType)},
			"total":   &graphql.Field{Type: graphql.Int},
			"page":    &graphql.Field{Type: graphql.Int},
			"size":    &graphql.Field{Type: graphql.Int},
			"hasMore": &graphql.Field{Type: graphql.Boolean},
		},
	})

	rootQuery := graphql.NewObject(graphql.ObjectConfig{
		Name: "Query",
		Fields: graphql.Fields{
			"home": &graphql.Field{
				Type:        homeScreenType,
				Description: "Single round-trip Home screen payload for mobile & web apps",
				Args: graphql.FieldConfigArgument{
					"platform": &graphql.ArgumentConfig{Type: graphql.String, DefaultValue: "MOBILE"},
					"language": &graphql.ArgumentConfig{Type: graphql.String, DefaultValue: ""},
				},
				Resolve: func(p graphql.ResolveParams) (any, error) {
					platform, _ := p.Args["platform"].(string)
					language, _ := p.Args["language"].(string)
					var (
						banners  []models.Banner
						sections []map[string]any
						featured []models.Content
						trending []models.Content
						meta     map[string]any
					)
					g, gctx := errgroup.WithContext(p.Context)
					g.Go(func() error {
						var err error
						banners, err = svc.ListBanners(gctx, platform, "")
						return err
					})
					g.Go(func() error {
						var err error
						sections, err = svc.ListSections(gctx, language)
						return err
					})
					g.Go(func() error {
						var err error
						featured, _, err = svc.Browse(gctx, BrowseFilter{Featured: true, Language: language, Size: 15})
						return err
					})
					g.Go(func() error {
						var err error
						trending, _, err = svc.Browse(gctx, BrowseFilter{Trending: true, Language: language, Size: 15})
						return err
					})
					g.Go(func() error {
						var err error
						meta, err = svc.GetMetadata(gctx)
						return err
					})
					if err := g.Wait(); err != nil {
						return nil, err
					}
					normalizedSections := make([]map[string]any, 0, len(sections))
					for _, sec := range sections {
						cp := map[string]any{
							"id":       sec["id"],
							"title":    sec["title"],
							"subtitle": sec["subtitle"],
							"layout":   sec["layout"],
						}
						if items, ok := sec["items"].([]models.Content); ok {
							cp["items"] = contentsToMaps(items)
						} else {
							cp["items"] = toSliceMaps(sec["items"])
						}
						normalizedSections = append(normalizedSections, cp)
					}
					return map[string]any{
						"banners":      bannersToMaps(banners),
						"sections":     normalizedSections,
						"featured":     contentsToMaps(featured),
						"trending":     contentsToMaps(trending),
						"contentTypes": toSliceMaps(meta["contentTypes"]),
						"languages":    toSliceMaps(meta["languages"]),
						"categories":   toSliceMaps(meta["categories"]),
						"genres":       toSliceMaps(meta["genres"]),
					}, nil
				},
			},
			"browse": &graphql.Field{
				Type:        browseResultType,
				Description: "Search and filter movies, series, shorts, podcasts, and more",
				Args: graphql.FieldConfigArgument{
					"query":       &graphql.ArgumentConfig{Type: graphql.String},
					"contentType": &graphql.ArgumentConfig{Type: graphql.String},
					"language":    &graphql.ArgumentConfig{Type: graphql.String},
					"category":    &graphql.ArgumentConfig{Type: graphql.String},
					"genre":       &graphql.ArgumentConfig{Type: graphql.String},
					"featured":    &graphql.ArgumentConfig{Type: graphql.Boolean},
					"trending":    &graphql.ArgumentConfig{Type: graphql.Boolean},
					"page":        &graphql.ArgumentConfig{Type: graphql.Int, DefaultValue: 0},
					"size":        &graphql.ArgumentConfig{Type: graphql.Int, DefaultValue: 20},
				},
				Resolve: func(p graphql.ResolveParams) (any, error) {
					page, _ := p.Args["page"].(int)
					size, _ := p.Args["size"].(int)
					if size <= 0 || size > 60 {
						size = 20
					}
					f := BrowseFilter{
						Query:       argStr(p.Args, "query"),
						ContentType: argStr(p.Args, "contentType"),
						Language:    argStr(p.Args, "language"),
						Category:    argStr(p.Args, "category"),
						Genre:       argStr(p.Args, "genre"),
						Featured:    argBool(p.Args, "featured"),
						Trending:    argBool(p.Args, "trending"),
						Page:        page,
						Size:        size,
					}
					items, total, err := svc.Browse(p.Context, f)
					if err != nil {
						return nil, err
					}
					return map[string]any{
						"items":   contentsToMaps(items),
						"total":   int(total),
						"page":    page,
						"size":    size,
						"hasMore": int64((page+1)*size) < total,
					}, nil
				},
			},
			"content": &graphql.Field{
				Type:        contentType,
				Description: "Full movie or web series detail (with nested seasons & episodes)",
				Args: graphql.FieldConfigArgument{
					"idOrSlug": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				},
				Resolve: func(p graphql.ResolveParams) (any, error) {
					idOrSlug, _ := p.Args["idOrSlug"].(string)
					detail, err := svc.GetDetail(p.Context, idOrSlug)
					if err != nil {
						return nil, err
					}
					return normalizeDetailMap(detail), nil
				},
			},
			"trending": &graphql.Field{
				Type: graphql.NewList(contentType),
				Args: graphql.FieldConfigArgument{
					"limit": &graphql.ArgumentConfig{Type: graphql.Int, DefaultValue: 15},
				},
				Resolve: func(p graphql.ResolveParams) (any, error) {
					limit, _ := p.Args["limit"].(int)
					if limit <= 0 || limit > 50 {
						limit = 15
					}
					items, _, err := svc.Browse(p.Context, BrowseFilter{Trending: true, Size: limit})
					if err != nil {
						return nil, err
					}
					return contentsToMaps(items), nil
				},
			},
			"featured": &graphql.Field{
				Type: graphql.NewList(contentType),
				Args: graphql.FieldConfigArgument{
					"limit": &graphql.ArgumentConfig{Type: graphql.Int, DefaultValue: 15},
				},
				Resolve: func(p graphql.ResolveParams) (any, error) {
					limit, _ := p.Args["limit"].(int)
					if limit <= 0 || limit > 50 {
						limit = 15
					}
					items, _, err := svc.Browse(p.Context, BrowseFilter{Featured: true, Size: limit})
					if err != nil {
						return nil, err
					}
					return contentsToMaps(items), nil
				},
			},
			"contentTypes": metadataListField(svc, contentTypeItem, "contentTypes"),
			"languages":    metadataListField(svc, languageItem, "languages"),
			"categories":   metadataListField(svc, categoryItem, "categories"),
			"genres":       metadataListField(svc, genreItem, "genres"),
			"liveChannels": &graphql.Field{
				Type: graphql.NewList(liveChannelType),
				Resolve: func(p graphql.ResolveParams) (any, error) {
					rows, err := svc.ListLiveChannels(p.Context)
					if err != nil {
						return nil, err
					}
					return toSliceMaps(rows), nil
				},
			},
			"liveEvents": &graphql.Field{
				Type: graphql.NewList(liveEventType),
				Resolve: func(p graphql.ResolveParams) (any, error) {
					rows, err := svc.ListLiveEvents(p.Context)
					if err != nil {
						return nil, err
					}
					return toSliceMaps(rows), nil
				},
			},
		},
	})

	return graphql.NewSchema(graphql.SchemaConfig{Query: rootQuery})
}

func metadataListField(svc *Service, itemType *graphql.Object, key string) *graphql.Field {
	return &graphql.Field{
		Type: graphql.NewList(itemType),
		Resolve: func(p graphql.ResolveParams) (any, error) {
			meta, err := svc.GetMetadata(p.Context)
			if err != nil {
				return nil, err
			}
			return toSliceMaps(meta[key]), nil
		},
	}
}

func argStr(args map[string]any, key string) string {
	if v, ok := args[key].(string); ok {
		return strings.TrimSpace(v)
	}
	return ""
}

func argBool(args map[string]any, key string) bool {
	if v, ok := args[key].(bool); ok {
		return v
	}
	return false
}

func toMap(v any) map[string]any {
	if m, ok := v.(map[string]any); ok {
		return m
	}
	b, err := json.Marshal(v)
	if err != nil {
		return map[string]any{}
	}
	var out map[string]any
	_ = json.Unmarshal(b, &out)
	return out
}

func toSliceMaps(v any) []map[string]any {
	if v == nil {
		return []map[string]any{}
	}
	b, err := json.Marshal(v)
	if err != nil {
		return []map[string]any{}
	}
	var out []map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		return []map[string]any{}
	}
	return out
}

func formatOptTime(t *time.Time) string {
	if t == nil || t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

func contentsToMaps(items []models.Content) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for _, c := range items {
		banner := ""
		for _, cand := range []*string{c.BannerImageUrl, c.LandscapeImageUrl, c.BackdropUrl} {
			if cand != nil && strings.TrimSpace(*cand) != "" {
				banner = *cand
				break
			}
		}
		m := map[string]any{
			"id":               int(c.ID),
			"title":            c.Title,
			"slug":             c.Slug,
			"contentType":      c.ContentType,
			"status":           c.Status,
			"description":      derefStr(c.Description),
			"shortDescription": derefStr(c.ShortDescription),
			"posterUrl":        derefStr(c.PosterUrl),
			"backdropUrl":      banner,
			"bannerUrl":        banner,
			"trailerUrl":       derefStr(c.TrailerUrl),
			"language":         derefStr(c.OriginalLanguageCode),
			"releaseDate":      formatOptTime(c.ReleaseDate),
			"ageRating":        derefStr(c.AgeRating),
			"monetization":     derefStr(c.Monetization),
			"accessType":       derefStr(c.AccessType),
			"isPremium":        derefBool(c.IsPremium),
			"isFeatured":       derefBool(c.IsFeatured),
			"isTrending":       derefBool(c.IsTrending),
			"rentPrice":        derefFloat(c.RentPrice),
			"imdbRating":       0.0,
		}
		if c.ReleaseYear != nil {
			m["releaseYear"] = int(*c.ReleaseYear)
		}
		if c.DurationSeconds != nil {
			m["durationSeconds"] = int(*c.DurationSeconds)
			m["durationMinutes"] = int(*c.DurationSeconds) / 60
		}
		if c.ViewCount != nil {
			m["viewCount"] = int(*c.ViewCount)
		}
		out = append(out, m)
	}
	return out
}

func bannersToMaps(items []models.Banner) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for _, b := range items {
		m := map[string]any{
			"id":             int(b.ID),
			"title":          b.Title,
			"subtitle":       derefStr(b.Subtitle),
			"imageUrl":       derefStr(b.ImageUrl),
			"mobileImageUrl": derefStr(b.MobileImageUrl),
			"actionUrl":      derefStr(b.ActionUrl),
			"platform":       derefStr(b.Placement),
		}
		if b.ContentId != nil {
			m["contentId"] = int(*b.ContentId)
		}
		if b.DisplayOrder != nil {
			m["displayOrder"] = int(*b.DisplayOrder)
		}
		out = append(out, m)
	}
	return out
}

func seasonsToMaps(items []models.Season) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for _, s := range items {
		out = append(out, map[string]any{
			"id":           int(s.ID),
			"seasonNumber": int(s.SeasonNumber),
			"title":        s.Title,
			"description":  derefStr(s.Description),
			"posterUrl":    derefStr(s.PosterUrl),
			"releaseDate":  formatOptTime(s.ReleaseDate),
		})
	}
	return out
}

func episodesToMaps(items []models.Episode) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for _, e := range items {
		dur := 0
		if e.DurationSeconds != nil {
			dur = int(*e.DurationSeconds)
		}
		thumb := derefStr(e.ThumbnailUrl)
		if thumb == "" {
			thumb = derefStr(e.StillImageUrl)
		}
		vid := derefStr(e.VideoUrl)
		out = append(out, map[string]any{
			"id":              int(e.ID),
			"episodeNumber":   int(e.EpisodeNumber),
			"title":           e.Title,
			"description":     derefStr(e.Description),
			"thumbnailUrl":    thumb,
			"hlsUrl":          vid,
			"videoUrl":        vid,
			"durationSeconds": dur,
			"isFreePreview":   derefBool(e.IsFreePreview),
			"releaseDate":     formatOptTime(e.ReleaseDate),
		})
	}
	return out
}

func normalizeDetailMap(d map[string]any) map[string]any {
	out := toMap(d)
	if seasonsRaw, ok := d["seasons"]; ok && seasonsRaw != nil {
		out["seasons"] = toSliceMaps(seasonsRaw)
	}
	return out
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func derefBool(p *bool) bool {
	if p == nil {
		return false
	}
	return *p
}

func derefFloat(p *float64) float64 {
	if p == nil {
		return 0
	}
	return *p
}

// Keep unused context import satisfied if needed
var _ context.Context

const graphQLPlaygroundHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MaxxPixels OTT — GraphQL Explorer</title>
  <style>
    body { margin: 0; background: #0e1017; color: #e6e9f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    header { padding: 14px 24px; background: #141824; border-bottom: 1px solid #242a3d; display: flex; justify-content: space-between; align-items: center; }
    h1 { margin: 0; font-size: 16px; }
    .badge { background: #e50914; color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 999px; font-weight: 700; }
    main { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px 24px; height: calc(100vh - 64px); box-sizing: border-box; }
    textarea, pre { width: 100%; height: calc(100% - 46px); background: #12151f; color: #e6e9f0; border: 1px solid #242a3d; border-radius: 10px; padding: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; box-sizing: border-box; overflow: auto; }
    button { background: #e50914; color: #fff; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  </style>
</head>
<body>
  <header>
    <h1>MaxxPixels OTT GraphQL API</h1>
    <span class="badge">GO CATALOG SERVICE</span>
  </header>
  <main>
    <div>
      <div class="bar">
        <strong>Query</strong>
        <button id="run">Run Query (Cmd+Enter)</button>
      </div>
      <textarea id="q">query MobileHome {
  home(platform: "MOBILE") {
    contentTypes { id name slug }
    languages { id name code }
    banners { id title imageUrl actionUrl }
    trending { id title contentType posterUrl accessType }
  }
}</textarea>
    </div>
    <div>
      <div class="bar"><strong>Response</strong><span id="ms" style="font-size:12px;color:#8e96b0"></span></div>
      <pre id="out">Click "Run Query" to test...</pre>
    </div>
  </main>
  <script>
    async function run() {
      const t0 = performance.now();
      const res = await fetch(location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: document.getElementById('q').value })
      });
      const json = await res.json();
      document.getElementById('ms').textContent = Math.round(performance.now() - t0) + ' ms';
      document.getElementById('out').textContent = JSON.stringify(json, null, 2);
    }
    document.getElementById('run').onclick = run;
    document.getElementById('q').addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
    });
  </script>
</body>
</html>`

var _ = fmt.Sprintf
