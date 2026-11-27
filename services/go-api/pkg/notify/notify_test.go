package notify

import "testing"

func TestFormatIndianMobile(t *testing.T) {
	cases := map[string]string{
		"9876543210":     "919876543210",
		"+919876543210":  "919876543210",
		"91 98765 43210": "919876543210",
	}
	for in, want := range cases {
		if got := FormatIndianMobile(in); got != want {
			t.Fatalf("FormatIndianMobile(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsMSG91BodyError(t *testing.T) {
	if !isMSG91BodyError([]byte(`{"type":"error","message":"Invalid template"}`)) {
		t.Fatal("expected error detection for type=error")
	}
	if isMSG91BodyError([]byte(`{"type":"success","request_id":"abc"}`)) {
		t.Fatal("expected success response not to be flagged as error")
	}
}

func TestFCMUnconfiguredDoesNotClaimSuccess(t *testing.T) {
	c := &FCMClient{configured: false}
	if c.SendToTarget(t.Context(), "tok123", "Hello", "World", "", "") {
		t.Fatal("unconfigured FCM client must return false")
	}
}
