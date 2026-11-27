package kafka

import (
	"context"
	"log/slog"
	"sync"
	"time"

	kafkago "github.com/segmentio/kafka-go"
)

// Publisher wraps kafka-go writers per topic (pure Go, zero CGo).
type Publisher struct {
	enabled bool
	brokers []string
	mu      sync.Mutex
	writers map[string]*kafkago.Writer
}

func NewPublisher(enabled bool, brokers []string) *Publisher {
	return &Publisher{
		enabled: enabled && len(brokers) > 0,
		brokers: brokers,
		writers: make(map[string]*kafkago.Writer),
	}
}

func (p *Publisher) Enabled() bool {
	return p != nil && p.enabled
}

func (p *Publisher) writerFor(topic string) *kafkago.Writer {
	p.mu.Lock()
	defer p.mu.Unlock()
	if w, ok := p.writers[topic]; ok {
		return w
	}
	w := &kafkago.Writer{
		Addr:                   kafkago.TCP(p.brokers...),
		Topic:                  topic,
		Balancer:               &kafkago.LeastBytes{},
		BatchTimeout:           50 * time.Millisecond,
		RequiredAcks:           kafkago.RequireOne,
		AllowAutoTopicCreation: true,
	}
	p.writers[topic] = w
	return w
}

func (p *Publisher) Publish(ctx context.Context, topic, key string, value []byte) error {
	if !p.Enabled() {
		return nil
	}
	w := p.writerFor(topic)
	return w.WriteMessages(ctx, kafkago.Message{
		Key:   []byte(key),
		Value: value,
		Time:  time.Now().UTC(),
	})
}

func (p *Publisher) Close() {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, w := range p.writers {
		_ = w.Close()
	}
}

// ConsumeTopic runs a resilient Kafka consumer loop until ctx is canceled.
func ConsumeTopic(ctx context.Context, brokers []string, groupID, topic string, handler func(ctx context.Context, key string, value []byte) error) {
	if len(brokers) == 0 {
		return
	}
	r := kafkago.NewReader(kafkago.ReaderConfig{
		Brokers:        brokers,
		GroupID:        groupID,
		Topic:          topic,
		MinBytes:       1,
		MaxBytes:       10e6,
		MaxWait:        2 * time.Second,
		CommitInterval: time.Second,
	})
	defer r.Close()

	slog.Info("kafka consumer started", "topic", topic, "group", groupID)
	for {
		m, err := r.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			slog.Warn("kafka read error; backing off", "topic", topic, "err", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(3 * time.Second):
			}
			continue
		}
		if err := handler(ctx, string(m.Key), m.Value); err != nil {
			slog.Warn("kafka handler error", "topic", topic, "offset", m.Offset, "err", err)
		}
	}
}
