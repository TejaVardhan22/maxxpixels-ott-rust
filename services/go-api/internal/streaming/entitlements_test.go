package streaming

import (
	"testing"

	"github.com/maxxpixels/go-api/pkg/models"
)

func TestResolveEntitlementsFromPlan(t *testing.T) {
	// 1. Free tier (no active plan)
	free := resolveEntitlementsFromPlan(nil)
	if free.HasActivePlan || free.MaxConcurrentStreams != 1 || free.MaxVideoQuality != "480p" || !free.AdsEnabled || free.AllowDownloads {
		t.Fatalf("unexpected free tier entitlements: %+v", free)
	}

	// 2. Ad-supported Mobile plan (1 stream, 720p, ads enabled, no downloads)
	s1 := int32(1)
	d2 := int32(2)
	q720 := "720p"
	tBool := true
	fBool := false
	mobile := resolveEntitlementsFromPlan(&models.Plan{
		Code:                 "MOBILE",
		Name:                 "Mobile Plan",
		MaxConcurrentStreams: &s1,
		MaxDevices:           &d2,
		MaxVideoQuality:      &q720,
		AdsEnabled:           &tBool,
		AllowDownloads:       &fBool,
	})
	if !mobile.HasActivePlan || mobile.MaxConcurrentStreams != 1 || mobile.MaxVideoQuality != "720p" || !mobile.AdsEnabled || mobile.AllowDownloads {
		t.Fatalf("unexpected mobile plan entitlements: %+v", mobile)
	}

	// 3. Premium 4K plan (4 streams, 5 devices, 4K, ad-free, downloads allowed)
	s4 := int32(4)
	d5 := int32(5)
	q4k := "4K"
	prem := resolveEntitlementsFromPlan(&models.Plan{
		Code:                 "PREMIUM_4K",
		Name:                 "Premium 4K",
		MaxConcurrentStreams: &s4,
		MaxRegisteredDevices: &d5,
		MaxResolution:        &q4k,
		AdsEnabled:           &fBool,
		HasAds:               &fBool,
		DownloadsEnabled:     &tBool,
	})
	if !prem.HasActivePlan || prem.MaxConcurrentStreams != 4 || prem.MaxDevices != 5 || prem.MaxVideoQuality != "4K" || prem.AdsEnabled || !prem.AllowDownloads {
		t.Fatalf("unexpected premium plan entitlements: %+v", prem)
	}
}
