package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/singleflight"
)

// Store wraps go-redis with singleflight stampede protection and sliding-window rate limiting.
type Store struct {
	client *redis.Client
	sf     singleflight.Group
}

func New(redisURL string) *Store {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		slog.Warn("invalid REDIS_URL, using default localhost:6379", "err", err)
		opts = &redis.Options{Addr: "localhost:6379"}
	}
	opts.PoolSize = 64
	opts.MinIdleConns = 8
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = 2 * time.Second
	opts.WriteTimeout = 2 * time.Second

	return &Store{
		client: redis.NewClient(opts),
	}
}

func (s *Store) Client() *redis.Client { return s.client }

func (s *Store) Ping(ctx context.Context) error {
	if s == nil || s.client == nil {
		return errors.New("redis unavailable")
	}
	return s.client.Ping(ctx).Err()
}

func (s *Store) Get(ctx context.Context, key string) (string, bool) {
	if s == nil || s.client == nil {
		return "", false
	}
	v, err := s.client.Get(ctx, key).Result()
	if err != nil {
		return "", false
	}
	return v, true
}

func (s *Store) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	if s == nil || s.client == nil {
		return nil
	}
	return s.client.Set(ctx, key, value, ttl).Err()
}

func (s *Store) Del(ctx context.Context, keys ...string) error {
	if s == nil || s.client == nil || len(keys) == 0 {
		return nil
	}
	return s.client.Del(ctx, keys...).Err()
}

// GetOrLoadJSON prevents cache stampedes under high concurrency using singleflight.
func GetOrLoadJSON[T any](ctx context.Context, s *Store, key string, ttl time.Duration, loader func(context.Context) (T, error)) (T, error) {
	var zero T
	if raw, ok := s.Get(ctx, key); ok {
		var cached T
		if err := json.Unmarshal([]byte(raw), &cached); err == nil {
			return cached, nil
		}
	}

	val, err, _ := s.sf.Do(key, func() (any, error) {
		if raw, ok := s.Get(ctx, key); ok {
			var cached T
			if err := json.Unmarshal([]byte(raw), &cached); err == nil {
				return cached, nil
			}
		}
		fresh, err := loader(ctx)
		if err != nil {
			return zero, err
		}
		if b, mErr := json.Marshal(fresh); mErr == nil {
			_ = s.Set(ctx, key, string(b), ttl)
		}
		return fresh, nil
	})
	if err != nil {
		return zero, err
	}
	return val.(T), nil
}

// AllowRate enforces a fixed-window Redis rate limit per key (e.g., OTP/login throttling).
func (s *Store) AllowRate(ctx context.Context, key string, limit int64, window time.Duration) (bool, int64) {
	if s == nil || s.client == nil {
		return true, limit
	}
	rKey := fmt.Sprintf("rl:%s", key)
	pipe := s.client.TxPipeline()
	incr := pipe.Incr(ctx, rKey)
	pipe.ExpireNX(ctx, rKey, window)
	if _, err := pipe.Exec(ctx); err != nil {
		return true, limit // fail-open if Redis is temporarily unreachable
	}
	count := incr.Val()
	return count <= limit, max(0, limit-count)
}
