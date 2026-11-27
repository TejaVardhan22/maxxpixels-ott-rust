package outbox

import "testing"

func TestRenderTemplate(t *testing.T) {
	tpl := "Hi {{userName}}, your {{planName}} plan expires in {{daysLeft}} days ({{expiryDate}})."
	got := RenderTemplate(tpl, map[string]string{
		"userName":   "Teja",
		"planName":   "Premium 4K",
		"daysLeft":   "3",
		"expiryDate": "30 Nov 2026",
	})
	want := "Hi Teja, your Premium 4K plan expires in 3 days (30 Nov 2026)."
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}
