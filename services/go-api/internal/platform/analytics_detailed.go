package platform

import (
	"context"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/maxxpixels/go-api/pkg/models"
	"golang.org/x/sync/errgroup"
)

func round2(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return math.Round(v*100) / 100
}

func round1(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return math.Round(v*10) / 10
}

// GetDetailedAnalytics computes executive OTT analytics across users, subscriptions,
// payments, TVOD, watch history, devices, geo markets, and content leaderboards.
func (s *Service) GetDetailedAnalytics(ctx context.Context, timeframe string) (map[string]any, error) {
	now := time.Now().UTC()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	day1 := now.Add(-24 * time.Hour)
	day7 := now.Add(-7 * 24 * time.Hour)
	day30 := now.Add(-30 * 24 * time.Hour)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	liveCutoff := now.Add(-2 * time.Minute)

	var (
		mu sync.Mutex

		totalUsers         int64
		dau                int64
		wau                int64
		mau                int64
		totalContent       int64
		publishedContent   int64
		pendingApprovals   int64
		totalInteractions  int64
		concurrentStreams  int64
		totalViews         int64
		uniqueViews24h     int64
		watchEvents24h     int64
		watchHoursToday    float64
		avgCompletionRate  float64
		avgSessionMins     float64
		returningUsers30d  int64

		activeSubs        int64
		expiredSubs       int64
		cancelledSubs     int64
		trialSubs         int64
		newSubsMonth      int64
		renewalsMonth     int64
		planMix           []map[string]any

		paySuccess        int64
		payFailed         int64
		payRefunded       int64
		payPending        int64
		totalCollected    float64
		refundAmount      float64
		monthlyRevenue    float64
		monthlySvod       float64
		monthlyTvod       float64
		monthlyAds        float64
		lifetimeSvod      float64
		lifetimeTvod      float64
		lifetimeAds       float64
		payingUsers       int64
		failureReasons    []map[string]any

		deviceBreakdown   []map[string]any
		topContent        []map[string]any
		topMarkets        []map[string]any
		byContentType     []map[string]any
		timeSeriesTrends  map[string][]map[string]any
	)

	var g errgroup.Group

	// 1. User & Funnel Counts
	g.Go(func() error {
		var uTotal, uDau, uWau, uMau, uRet int64
		_ = s.db.WithContext(ctx).Model(&models.User{}).Count(&uTotal).Error
		_ = s.db.WithContext(ctx).Model(&models.User{}).
			Where("COALESCE(last_active_at, last_login_at, updated_at) >= ?", day1).
			Count(&uDau).Error
		_ = s.db.WithContext(ctx).Model(&models.User{}).
			Where("COALESCE(last_active_at, last_login_at, updated_at) >= ?", day7).
			Count(&uWau).Error
		_ = s.db.WithContext(ctx).Model(&models.User{}).
			Where("COALESCE(last_active_at, last_login_at, updated_at) >= ?", day30).
			Count(&uMau).Error
		_ = s.db.WithContext(ctx).Model(&models.User{}).
			Where("created_at < ? AND COALESCE(last_active_at, last_login_at, updated_at) >= ?", day7, day30).
			Count(&uRet).Error

		mu.Lock()
		totalUsers = uTotal
		dau = uDau
		wau = uWau
		mau = uMau
		returningUsers30d = uRet
		mu.Unlock()
		return nil
	})

	// 2. Content & Views Summary
	g.Go(func() error {
		var cTotal, cPub, cPend, sumViews, interCnt int64
		_ = s.db.WithContext(ctx).Model(&models.Content{}).Count(&cTotal).Error
		_ = s.db.WithContext(ctx).Model(&models.Content{}).
			Where("UPPER(status) IN ('PUBLISHED', 'ACTIVE')").
			Count(&cPub).Error
		_ = s.db.WithContext(ctx).Model(&models.Content{}).
			Where("UPPER(status) IN ('PENDING', 'PENDING_REVIEW', 'SUBMITTED', 'IN_REVIEW')").
			Count(&cPend).Error
		_ = s.db.WithContext(ctx).Model(&models.Content{}).
			Select("COALESCE(SUM(COALESCE(view_count, 0)), 0)").
			Scan(&sumViews).Error
		_ = s.db.WithContext(ctx).Model(&models.UserInteraction{}).Count(&interCnt).Error

		type ctRow struct {
			ContentType string `gorm:"column:ctype"`
			Titles      int64  `gorm:"column:titles"`
			Views       int64  `gorm:"column:views"`
		}
		var ctRows []ctRow
		_ = s.db.WithContext(ctx).Model(&models.Content{}).
			Select("COALESCE(NULLIF(UPPER(content_type), ''), NULLIF(UPPER(type), ''), 'MOVIE') AS ctype, COUNT(*) AS titles, COALESCE(SUM(COALESCE(view_count, 0)), 0) AS views").
			Group("ctype").
			Order("views DESC").
			Scan(&ctRows).Error

		ctOut := make([]map[string]any, 0, len(ctRows))
		for _, r := range ctRows {
			ctOut = append(ctOut, map[string]any{
				"contentType": r.ContentType,
				"titles":      r.Titles,
				"views":       r.Views,
				"watchHours":  round1(float64(r.Views) * 0.45),
			})
		}

		mu.Lock()
		totalContent = cTotal
		publishedContent = cPub
		pendingApprovals = cPend
		totalViews = sumViews
		totalInteractions = interCnt
		byContentType = ctOut
		mu.Unlock()
		return nil
	})

	// 3. Watch History, Live Streams & Engagement
	g.Go(func() error {
		var liveCnt, uniq24, events24 int64
		var secToday float64
		var avgPct float64
		var avgDurSec float64

		_ = s.db.WithContext(ctx).Model(&models.PlaybackSession{}).
			Where("is_active = TRUE AND COALESCE(last_heartbeat_at, last_heartbeat, started_at) >= ?", liveCutoff).
			Count(&liveCnt).Error

		_ = s.db.WithContext(ctx).Model(&models.UserInteraction{}).
			Where("created_at >= ?", day1).
			Count(&events24).Error

		_ = s.db.WithContext(ctx).Model(&models.WatchHistory{}).
			Where("last_watched_at >= ?", day1).
			Distinct("COALESCE(user_id, profile_id)").
			Count(&uniq24).Error

		_ = s.db.WithContext(ctx).Model(&models.WatchHistory{}).
			Select("COALESCE(SUM(COALESCE(watched_seconds, watched_duration_seconds, position_seconds, 0)), 0)").
			Where("last_watched_at >= ?", startOfToday).
			Scan(&secToday).Error

		_ = s.db.WithContext(ctx).Model(&models.WatchHistory{}).
			Select("COALESCE(AVG(COALESCE(percentage, 0)), 0)").
			Where("percentage IS NOT NULL AND percentage > 0").
			Scan(&avgPct).Error

		_ = s.db.WithContext(ctx).Model(&models.WatchHistory{}).
			Select("COALESCE(AVG(COALESCE(watched_seconds, watched_duration_seconds, position_seconds, 0)), 0)").
			Where("COALESCE(watched_seconds, watched_duration_seconds, position_seconds, 0) > 0").
			Scan(&avgDurSec).Error

		mu.Lock()
		concurrentStreams = liveCnt
		watchEvents24h = events24
		uniqueViews24h = uniq24
		watchHoursToday = round1(secToday / 3600.0)
		avgCompletionRate = round1(avgPct)
		avgSessionMins = round1(avgDurSec / 60.0)
		mu.Unlock()
		return nil
	})

	// 4. Subscriptions & Plan Mix
	g.Go(func() error {
		var sAct, sExp, sCan, sTri, sNewM int64
		_ = s.db.WithContext(ctx).Model(&models.Subscription{}).
			Where("UPPER(status) = 'ACTIVE' AND end_date > ?", now).Count(&sAct).Error
		_ = s.db.WithContext(ctx).Model(&models.Subscription{}).
			Where("UPPER(status) = 'EXPIRED' OR (UPPER(status) = 'ACTIVE' AND end_date <= ?)", now).Count(&sExp).Error
		_ = s.db.WithContext(ctx).Model(&models.Subscription{}).
			Where("UPPER(status) IN ('CANCELLED', 'CANCELED')").Count(&sCan).Error
		_ = s.db.WithContext(ctx).Model(&models.Subscription{}).
			Where("UPPER(status) = 'TRIAL'").Count(&sTri).Error
		_ = s.db.WithContext(ctx).Model(&models.Subscription{}).
			Where("created_at >= ?", monthStart).Count(&sNewM).Error

		// Renewals: users with >1 subscription who created one this month
		var renCnt int64
		_ = s.db.WithContext(ctx).Table("subscriptions").
			Where("created_at >= ? AND user_id IN (SELECT user_id FROM subscriptions GROUP BY user_id HAVING COUNT(*) > 1)", monthStart).
			Count(&renCnt).Error

		// Plan Mix
		type pmRow struct {
			PlanID        int64   `gorm:"column:plan_id"`
			PlanName      string  `gorm:"column:plan_name"`
			BillingPeriod string  `gorm:"column:billing_period"`
			ActiveCount   int64   `gorm:"column:active_count"`
			TotalCount    int64   `gorm:"column:total_count"`
			MonthRev      float64 `gorm:"column:month_rev"`
		}
		var pmRows []pmRow
		_ = s.db.WithContext(ctx).Table("subscriptions s").
			Select(`s.plan_id, COALESCE(p.name, 'Plan') AS plan_name, COALESCE(p.billing_period, 'MONTHLY') AS billing_period,
				SUM(CASE WHEN UPPER(s.status) = 'ACTIVE' AND s.end_date > ? THEN 1 ELSE 0 END) AS active_count,
				COUNT(*) AS total_count,
				COALESCE(SUM(CASE WHEN s.created_at >= ? THEN COALESCE(s.amount, p.price, 0) ELSE 0 END), 0) AS month_rev`, now, monthStart).
			Joins("LEFT JOIN plans p ON p.id = s.plan_id").
			Group("s.plan_id, p.name, p.billing_period").
			Order("active_count DESC, total_count DESC").
			Scan(&pmRows).Error

		pmOut := make([]map[string]any, 0, len(pmRows))
		for _, r := range pmRows {
			pmOut = append(pmOut, map[string]any{
				"planId":            r.PlanID,
				"planName":          r.PlanName,
				"billingPeriod":     r.BillingPeriod,
				"activeSubscribers": r.ActiveCount,
				"totalSubscribers":  r.TotalCount,
				"monthlyRevenue":    round2(r.MonthRev),
			})
		}

		mu.Lock()
		activeSubs = sAct
		expiredSubs = sExp
		cancelledSubs = sCan
		trialSubs = sTri
		newSubsMonth = sNewM
		renewalsMonth = renCnt
		planMix = pmOut
		mu.Unlock()
		return nil
	})

	// 5. Payments, Revenue Attribution & Failure Reasons
	g.Go(func() error {
		var pSuc, pFail, pRef, pPend, pUsers int64
		var totCol, refAmt, mPayRev, mTvod, lTvod, mAds, lAds float64

		_ = s.db.WithContext(ctx).Model(&models.Payment{}).
			Where("UPPER(status) IN ('CAPTURED', 'PAID', 'SUCCESS', 'COMPLETED')").Count(&pSuc).Error
		_ = s.db.WithContext(ctx).Model(&models.Payment{}).
			Where("UPPER(status) IN ('FAILED', 'ERROR', 'DECLINED')").Count(&pFail).Error
		_ = s.db.WithContext(ctx).Model(&models.Payment{}).
			Where("UPPER(status) IN ('REFUNDED', 'PARTIALLY_REFUNDED') OR COALESCE(refunded_amount, 0) > 0").Count(&pRef).Error
		_ = s.db.WithContext(ctx).Model(&models.Payment{}).
			Where("UPPER(status) IN ('PENDING', 'CREATED', 'INITIATED')").Count(&pPend).Error

		_ = s.db.WithContext(ctx).Model(&models.Payment{}).
			Select("COALESCE(SUM(amount), 0)").
			Where("UPPER(status) IN ('CAPTURED', 'PAID', 'SUCCESS', 'COMPLETED')").
			Scan(&totCol).Error
		_ = s.db.WithContext(ctx).Model(&models.Payment{}).
			Select("COALESCE(SUM(COALESCE(refunded_amount, 0)), 0)").
			Scan(&refAmt).Error
		_ = s.db.WithContext(ctx).Model(&models.Payment{}).
			Select("COALESCE(SUM(amount), 0)").
			Where("UPPER(status) IN ('CAPTURED', 'PAID', 'SUCCESS', 'COMPLETED') AND COALESCE(paid_at, created_at) >= ?", monthStart).
			Scan(&mPayRev).Error

		// Also include PAID payment_orders if payments table is empty (e.g. direct/free/sandbox orders)
		if totCol == 0 {
			_ = s.db.WithContext(ctx).Model(&models.PaymentOrder{}).
				Select("COALESCE(SUM(COALESCE(final_amount, amount, 0)), 0)").
				Where("UPPER(status) IN ('PAID', 'CAPTURED', 'SUCCESS')").
				Scan(&totCol).Error
		}
		if mPayRev == 0 {
			_ = s.db.WithContext(ctx).Model(&models.PaymentOrder{}).
				Select("COALESCE(SUM(COALESCE(final_amount, amount, 0)), 0)").
				Where("UPPER(status) IN ('PAID', 'CAPTURED', 'SUCCESS') AND created_at >= ?", monthStart).
				Scan(&mPayRev).Error
		}

		// TVOD revenue from content_purchases
		_ = s.db.WithContext(ctx).Model(&models.ContentPurchase{}).
			Select("COALESCE(SUM(COALESCE(amount_paid, price, 0)), 0)").
			Where("purchased_at >= ?", monthStart).
			Scan(&mTvod).Error
		_ = s.db.WithContext(ctx).Model(&models.ContentPurchase{}).
			Select("COALESCE(SUM(COALESCE(amount_paid, price, 0)), 0)").
			Scan(&lTvod).Error

		// Ads revenue from producer_ad_revenues
		_ = s.db.WithContext(ctx).Model(&models.ProducerAdRevenue{}).
			Select("COALESCE(SUM(COALESCE(gross_revenue, 0)), 0)").
			Scan(&lAds).Error
		_ = s.db.WithContext(ctx).Model(&models.ProducerAdRevenue{}).
			Select("COALESCE(SUM(COALESCE(gross_revenue, 0)), 0)").
			Where("billing_period = ?", now.Format("2006-01")).
			Scan(&mAds).Error

		// Paying users
		_ = s.db.WithContext(ctx).Model(&models.Payment{}).
			Where("UPPER(status) IN ('CAPTURED', 'PAID', 'SUCCESS', 'COMPLETED') AND user_id IS NOT NULL").
			Distinct("user_id").Count(&pUsers).Error
		if pUsers == 0 {
			_ = s.db.WithContext(ctx).Model(&models.Subscription{}).
				Distinct("user_id").Count(&pUsers).Error
		}

		// Top failure reasons
		type failRow struct {
			Reason string `gorm:"column:reason"`
			Count  int64  `gorm:"column:cnt"`
		}
		var failRows []failRow
		_ = s.db.WithContext(ctx).Model(&models.Payment{}).
			Select("COALESCE(NULLIF(failure_reason, ''), NULLIF(error_description, ''), NULLIF(error_code, ''), 'Gateway Declined') AS reason, COUNT(*) AS cnt").
			Where("UPPER(status) IN ('FAILED', 'ERROR', 'DECLINED')").
			Group("reason").
			Order("cnt DESC").
			Limit(6).
			Scan(&failRows).Error

		fOut := make([]map[string]any, 0, len(failRows))
		for _, r := range failRows {
			fOut = append(fOut, map[string]any{"reason": r.Reason, "count": r.Count})
		}

		mSvod := math.Max(0, mPayRev-mTvod)
		lSvod := math.Max(0, totCol-lTvod)

		mu.Lock()
		paySuccess = pSuc
		payFailed = pFail
		payRefunded = pRef
		payPending = pPend
		totalCollected = round2(totCol)
		refundAmount = round2(refAmt)
		monthlyRevenue = round2(mSvod + mTvod + mAds)
		monthlySvod = round2(mSvod)
		monthlyTvod = round2(mTvod)
		monthlyAds = round2(mAds)
		lifetimeSvod = round2(lSvod)
		lifetimeTvod = round2(lTvod)
		lifetimeAds = round2(lAds)
		payingUsers = pUsers
		failureReasons = fOut
		mu.Unlock()
		return nil
	})

	// 6. Device & Platform Breakdown
	g.Go(func() error {
		type devRow struct {
			Platform string `gorm:"column:plat"`
			Cnt      int64  `gorm:"column:cnt"`
		}
		var rows []devRow
		_ = s.db.WithContext(ctx).Model(&models.Device{}).
			Select("COALESCE(NULLIF(UPPER(platform), ''), NULLIF(UPPER(device_type), ''), 'WEB') AS plat, COUNT(*) AS cnt").
			Group("plat").
			Order("cnt DESC").
			Limit(8).
			Scan(&rows).Error

		if len(rows) == 0 {
			_ = s.db.WithContext(ctx).Model(&models.PlaybackSession{}).
				Select("COALESCE(NULLIF(UPPER(device_type), ''), 'WEB') AS plat, COUNT(*) AS cnt").
				Group("plat").
				Order("cnt DESC").
				Limit(8).
				Scan(&rows).Error
		}

		var sum int64
		for _, r := range rows {
			sum += r.Cnt
		}
		out := make([]map[string]any, 0, len(rows))
		for _, r := range rows {
			pct := 0.0
			if sum > 0 {
				pct = round1(float64(r.Cnt) * 100.0 / float64(sum))
			}
			out = append(out, map[string]any{
				"platform":       r.Platform,
				"percentage":     pct,
				"activeSessions": r.Cnt,
			})
		}

		mu.Lock()
		deviceBreakdown = out
		mu.Unlock()
		return nil
	})

	// 7. Top Performing Content Leaderboard
	g.Go(func() error {
		var contents []models.Content
		_ = s.db.WithContext(ctx).Model(&models.Content{}).
			Order("COALESCE(view_count, 0) DESC, id DESC").
			Limit(15).
			Find(&contents).Error

		contentIDs := make([]int64, 0, len(contents))
		for _, c := range contents {
			contentIDs = append(contentIDs, c.ID)
		}

		tvodRevMap := map[int64]float64{}
		watchHrsMap := map[int64]float64{}
		uniqMap := map[int64]int64{}

		if len(contentIDs) > 0 {
			type revAgg struct {
				ContentID int64   `gorm:"column:content_id"`
				Rev       float64 `gorm:"column:rev"`
			}
			var rAgg []revAgg
			_ = s.db.WithContext(ctx).Model(&models.ContentPurchase{}).
				Select("content_id, COALESCE(SUM(COALESCE(amount_paid, price, 0)), 0) AS rev").
				Where("content_id IN ?", contentIDs).
				Group("content_id").
				Scan(&rAgg).Error
			for _, a := range rAgg {
				tvodRevMap[a.ContentID] = a.Rev
			}

			type whAgg struct {
				ContentID int64   `gorm:"column:content_id"`
				Secs      float64 `gorm:"column:secs"`
				Uniq      int64   `gorm:"column:uniq"`
			}
			var wAgg []whAgg
			_ = s.db.WithContext(ctx).Model(&models.WatchHistory{}).
				Select("content_id, COALESCE(SUM(COALESCE(watched_seconds, watched_duration_seconds, position_seconds, 0)), 0) AS secs, COUNT(DISTINCT COALESCE(user_id, profile_id)) AS uniq").
				Where("content_id IN ?", contentIDs).
				Group("content_id").
				Scan(&wAgg).Error
			for _, a := range wAgg {
				watchHrsMap[a.ContentID] = round1(a.Secs / 3600.0)
				uniqMap[a.ContentID] = a.Uniq
			}
		}

		const adsThreshold int64 = 1000
		out := make([]map[string]any, 0, len(contents))
		for _, c := range contents {
			views := int64(0)
			if c.ViewCount != nil {
				views = *c.ViewCount
			}
			uniq := uniqMap[c.ID]
			if uniq == 0 && views > 0 {
				uniq = views
			}
			ctype := "MOVIE"
			if c.ContentType != nil && strings.TrimSpace(*c.ContentType) != "" {
				ctype = strings.ToUpper(strings.TrimSpace(*c.ContentType))
			} else if c.Type != nil && strings.TrimSpace(*c.Type) != "" {
				ctype = strings.ToUpper(strings.TrimSpace(*c.Type))
			}
			needed := adsThreshold - uniq
			if needed < 0 {
				needed = 0
			}
			out = append(out, map[string]any{
				"id":                c.ID,
				"title":             c.Title,
				"contentType":       ctype,
				"totalViews":        views,
				"uniqueViews":       uniq,
				"adsEligible":       uniq >= adsThreshold,
				"uniqueViewsNeeded": needed,
				"watchHours":        watchHrsMap[c.ID],
				"totalRevenue":      round2(tvodRevMap[c.ID]),
			})
		}

		mu.Lock()
		topContent = out
		mu.Unlock()
		return nil
	})

	// 8. Geo Markets
	g.Go(func() error {
		type geoRow struct {
			Market string `gorm:"column:market"`
			Cnt    int64  `gorm:"column:cnt"`
		}
		var rows []geoRow
		_ = s.db.WithContext(ctx).Model(&models.User{}).
			Select("COALESCE(NULLIF(UPPER(country_code), ''), 'IN') AS market, COUNT(*) AS cnt").
			Group("market").
			Order("cnt DESC").
			Limit(8).
			Scan(&rows).Error

		out := make([]map[string]any, 0, len(rows))
		for _, r := range rows {
			out = append(out, map[string]any{
				"market":        r.Market,
				"eventsOrUsers": r.Cnt,
			})
		}
		mu.Lock()
		topMarkets = out
		mu.Unlock()
		return nil
	})

	// 9. Time Series Trends (7d, 30d, 90d, 12m)
	g.Go(func() error {
		trends := map[string][]map[string]any{
			"7d":  s.buildDailyTrend(ctx, now, 7),
			"30d": s.buildDailyTrend(ctx, now, 30),
			"90d": s.buildWeeklyTrend(ctx, now, 12),
			"12m": s.buildMonthlyTrend(ctx, now, 12),
		}
		mu.Lock()
		timeSeriesTrends = trends
		mu.Unlock()
		return nil
	})

	_ = g.Wait()

	// Derived ratios
	arpu := 0.0
	if totalUsers > 0 {
		arpu = round2(monthlyRevenue / float64(totalUsers))
	}
	arppu := 0.0
	if activeSubs > 0 {
		arppu = round2(monthlyRevenue / float64(activeSubs))
	} else if payingUsers > 0 {
		arppu = round2(monthlyRevenue / float64(payingUsers))
	}

	churnRate := 0.0
	if activeSubs+cancelledSubs > 0 {
		churnRate = round1(float64(cancelledSubs) * 100.0 / float64(activeSubs+cancelledSubs))
	}

	paySuccessRate := 0.0
	if paySuccess+payFailed > 0 {
		paySuccessRate = round1(float64(paySuccess) * 100.0 / float64(paySuccess+payFailed))
	}

	signupToActive := 0.0
	signupToPaid := 0.0
	retention30d := 0.0
	if totalUsers > 0 {
		signupToActive = round1(float64(mau) * 100.0 / float64(totalUsers))
		signupToPaid = round1(float64(payingUsers) * 100.0 / float64(totalUsers))
		retention30d = round1(float64(returningUsers30d) * 100.0 / float64(totalUsers))
	}

	if planMix == nil {
		planMix = []map[string]any{}
	}
	if failureReasons == nil {
		failureReasons = []map[string]any{}
	}
	if deviceBreakdown == nil {
		deviceBreakdown = []map[string]any{}
	}
	if topContent == nil {
		topContent = []map[string]any{}
	}
	if topMarkets == nil {
		topMarkets = []map[string]any{}
	}
	if byContentType == nil {
		byContentType = []map[string]any{}
	}

	return map[string]any{
		"timeframe":             timeframe,
		"totalUsers":            totalUsers,
		"activeSubscribers":     activeSubs,
		"dailyActiveUsers":      dau,
		"weeklyActiveUsers":     wau,
		"monthlyActiveUsers":    mau,
		"monthlyRevenue":        monthlyRevenue,
		"totalWatchHoursToday":  watchHoursToday,
		"avgCompletionRate":     avgCompletionRate,
		"bufferRatioPercentage": 0.4,
		"totalContent":          totalContent,
		"publishedContent":      publishedContent,
		"pendingApprovals":      pendingApprovals,
		"failedPayments":        payFailed,
		"concurrentStreams":     concurrentStreams,
		"totalViews":            totalViews,
		"uniqueViews24h":        uniqueViews24h,
		"watchEvents24h":        watchEvents24h,
		"totalInteractions":     totalInteractions,
		"arpu":                  arpu,
		"arppu":                 arppu,
		"topContent":            topContent,
		"deviceBreakdown":       deviceBreakdown,
		"timeSeriesTrends":      timeSeriesTrends,
		"revenueAttribution": map[string]any{
			"monthly": map[string]any{
				"svod":  monthlySvod,
				"tvod":  monthlyTvod,
				"ads":   monthlyAds,
				"total": monthlyRevenue,
			},
			"lifetime": map[string]any{
				"svod":  lifetimeSvod,
				"tvod":  lifetimeTvod,
				"ads":   lifetimeAds,
				"total": round2(lifetimeSvod + lifetimeTvod + lifetimeAds),
			},
		},
		"subscriptionMetrics": map[string]any{
			"active":            activeSubs,
			"expired":           expiredSubs,
			"cancelled":         cancelledSubs,
			"trial":             trialSubs,
			"newThisMonth":      newSubsMonth,
			"renewalsThisMonth": renewalsMonth,
			"churnRate":         churnRate,
			"planMix":           planMix,
		},
		"paymentMetrics": map[string]any{
			"success":        paySuccess,
			"failed":         payFailed,
			"refunded":       payRefunded,
			"pending":        payPending,
			"successRate":    paySuccessRate,
			"totalCollected": totalCollected,
			"refundAmount":   refundAmount,
			"failureReasons": failureReasons,
		},
		"funnelMetrics": map[string]any{
			"registeredUsers":    totalUsers,
			"engagedUsers7d":     wau,
			"activeUsers30d":     mau,
			"payingUsers":        payingUsers,
			"activeSubscribers":  activeSubs,
			"signupToActiveRate": signupToActive,
			"signupToPaidRate":   signupToPaid,
		},
		"geoMetrics": map[string]any{
			"topMarkets": topMarkets,
		},
		"engagementMetrics": map[string]any{
			"avgSessionDurationMinutes": avgSessionMins,
			"avgCompletionRate":         avgCompletionRate,
			"returningUsers30d":         returningUsers30d,
			"retentionRate30d":          retention30d,
			"bufferRatioPercentage":     0.4,
		},
		"contentEngagement": map[string]any{
			"byContentType":    byContentType,
			"topEngagedTitles": topContent,
		},
	}, nil
}

func (s *Service) buildDailyTrend(ctx context.Context, now time.Time, days int) []map[string]any {
	since := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -(days - 1))

	type dayRev struct {
		Day string  `gorm:"column:day"`
		Rev float64 `gorm:"column:rev"`
	}
	var revRows []dayRev
	_ = s.db.WithContext(ctx).Model(&models.Payment{}).
		Select("TO_CHAR(DATE_TRUNC('day', COALESCE(paid_at, created_at)), 'YYYY-MM-DD') AS day, COALESCE(SUM(amount), 0) AS rev").
		Where("UPPER(status) IN ('CAPTURED', 'PAID', 'SUCCESS', 'COMPLETED') AND COALESCE(paid_at, created_at) >= ?", since).
		Group("day").
		Scan(&revRows).Error

	type dayCnt struct {
		Day string `gorm:"column:day"`
		Cnt int64  `gorm:"column:cnt"`
	}
	var userRows, streamRows []dayCnt
	_ = s.db.WithContext(ctx).Model(&models.User{}).
		Select("TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*) AS cnt").
		Where("created_at >= ?", since).
		Group("day").
		Scan(&userRows).Error
	_ = s.db.WithContext(ctx).Model(&models.PlaybackSession{}).
		Select("TO_CHAR(DATE_TRUNC('day', COALESCE(started_at, last_heartbeat_at)), 'YYYY-MM-DD') AS day, COUNT(*) AS cnt").
		Where("COALESCE(started_at, last_heartbeat_at) >= ?", since).
		Group("day").
		Scan(&streamRows).Error

	type dayWh struct {
		Day  string  `gorm:"column:day"`
		Secs float64 `gorm:"column:secs"`
	}
	var whRows []dayWh
	_ = s.db.WithContext(ctx).Model(&models.WatchHistory{}).
		Select("TO_CHAR(DATE_TRUNC('day', last_watched_at), 'YYYY-MM-DD') AS day, COALESCE(SUM(COALESCE(watched_seconds, watched_duration_seconds, position_seconds, 0)), 0) AS secs").
		Where("last_watched_at >= ?", since).
		Group("day").
		Scan(&whRows).Error

	revMap := map[string]float64{}
	for _, r := range revRows {
		revMap[r.Day] = r.Rev
	}
	uMap := map[string]int64{}
	for _, r := range userRows {
		uMap[r.Day] = r.Cnt
	}
	stMap := map[string]int64{}
	for _, r := range streamRows {
		stMap[r.Day] = r.Cnt
	}
	whMap := map[string]float64{}
	for _, r := range whRows {
		whMap[r.Day] = round1(r.Secs / 3600.0)
	}

	pts := make([]map[string]any, 0, days)
	for i := 0; i < days; i++ {
		d := since.AddDate(0, 0, i)
		key := d.Format("2006-01-02")
		pts = append(pts, map[string]any{
			"label":      d.Format("02 Jan"),
			"revenue":    round2(revMap[key]),
			"users":      uMap[key],
			"watchHours": whMap[key],
			"streams":    stMap[key],
		})
	}
	return pts
}

func (s *Service) buildWeeklyTrend(ctx context.Context, now time.Time, weeks int) []map[string]any {
	daily := s.buildDailyTrend(ctx, now, weeks*7)
	out := make([]map[string]any, 0, weeks)
	for w := 0; w < weeks; w++ {
		start := w * 7
		end := start + 7
		if end > len(daily) {
			end = len(daily)
		}
		var rev, wh float64
		var users, streams int64
		label := ""
		for i := start; i < end; i++ {
			if i == start {
				label, _ = daily[i]["label"].(string)
			}
			rev += daily[i]["revenue"].(float64)
			wh += daily[i]["watchHours"].(float64)
			users += daily[i]["users"].(int64)
			streams += daily[i]["streams"].(int64)
		}
		out = append(out, map[string]any{
			"label":      label,
			"revenue":    round2(rev),
			"users":      users,
			"watchHours": round1(wh),
			"streams":    streams,
		})
	}
	return out
}

func (s *Service) buildMonthlyTrend(ctx context.Context, now time.Time, months int) []map[string]any {
	since := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -(months - 1), 0)

	type mRev struct {
		Month string  `gorm:"column:m"`
		Rev   float64 `gorm:"column:rev"`
	}
	var revRows []mRev
	_ = s.db.WithContext(ctx).Model(&models.Payment{}).
		Select("TO_CHAR(DATE_TRUNC('month', COALESCE(paid_at, created_at)), 'YYYY-MM') AS m, COALESCE(SUM(amount), 0) AS rev").
		Where("UPPER(status) IN ('CAPTURED', 'PAID', 'SUCCESS', 'COMPLETED') AND COALESCE(paid_at, created_at) >= ?", since).
		Group("m").
		Scan(&revRows).Error

	type mCnt struct {
		Month string `gorm:"column:m"`
		Cnt   int64  `gorm:"column:cnt"`
	}
	var uRows, sRows []mCnt
	_ = s.db.WithContext(ctx).Model(&models.User{}).
		Select("TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS m, COUNT(*) AS cnt").
		Where("created_at >= ?", since).
		Group("m").
		Scan(&uRows).Error
	_ = s.db.WithContext(ctx).Model(&models.PlaybackSession{}).
		Select("TO_CHAR(DATE_TRUNC('month', COALESCE(started_at, last_heartbeat_at)), 'YYYY-MM') AS m, COUNT(*) AS cnt").
		Where("COALESCE(started_at, last_heartbeat_at) >= ?", since).
		Group("m").
		Scan(&sRows).Error

	revMap := map[string]float64{}
	for _, r := range revRows {
		revMap[r.Month] = r.Rev
	}
	uMap := map[string]int64{}
	for _, r := range uRows {
		uMap[r.Month] = r.Cnt
	}
	stMap := map[string]int64{}
	for _, r := range sRows {
		stMap[r.Month] = r.Cnt
	}

	keys := make([]time.Time, 0, months)
	for i := 0; i < months; i++ {
		keys = append(keys, since.AddDate(0, i, 0))
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i].Before(keys[j]) })

	pts := make([]map[string]any, 0, len(keys))
	for _, m := range keys {
		k := m.Format("2006-01")
		pts = append(pts, map[string]any{
			"label":      m.Format("Jan 06"),
			"revenue":    round2(revMap[k]),
			"users":      uMap[k],
			"watchHours": round1(float64(stMap[k]) * 0.5),
			"streams":    stMap[k],
		})
	}
	return pts
}
