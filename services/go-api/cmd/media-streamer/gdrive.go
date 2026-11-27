package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"mime"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"
)

var (
	gdriveFileIDRegex = regexp.MustCompile(`(?:/file/d/|id=)([a-zA-Z0-9_-]{20,})`)
	formTagRegex      = regexp.MustCompile(`(?i)<form\s+[^>]*>`)
	actionAttrRegex   = regexp.MustCompile(`(?i)action=["']?([^"'\s>]+)["']?`)
	methodAttrRegex   = regexp.MustCompile(`(?i)method=["']?([^"'\s>]+)["']?`)
	inputTagRegex     = regexp.MustCompile(`(?i)<input\s+[^>]*>`)
	nameAttrRegex     = regexp.MustCompile(`(?i)name=["']?([^"'\s>]+)["']?`)
	valueAttrRegex    = regexp.MustCompile(`(?i)value=["']?([^"'\s>]*)["']?`)
	linkTagRegex      = regexp.MustCompile(`(?i)<a\s+[^>]*href=["']?([^"'\s>]+)["']?[^>]*>`)
	uuidRegex         = regexp.MustCompile(`(?i)(?:uuid=|name=["']uuid["']\s+value=["'])([a-zA-Z0-9_-]{10,})`)
	confirmRegex      = regexp.MustCompile(`(?i)(?:confirm=|name=["']confirm["']\s+value=["'])([a-zA-Z0-9_-]+)`)
)

type GDriveStreamInfo struct {
	Body          io.ReadCloser
	FileName      string
	ContentLength int64
}

type oauthDesktopClient struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

type cachedOAuthToken struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	Expiry       time.Time `json:"expiry"`
}

// ExtractGDriveFileID parses Google Drive URL or returns the ID if already clean
func ExtractGDriveFileID(input string) (string, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return "", fmt.Errorf("empty Google Drive URL or File ID provided")
	}

	matches := gdriveFileIDRegex.FindStringSubmatch(input)
	if len(matches) > 1 {
		return matches[1], nil
	}

	rawRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]{20,60}$`)
	if rawRegex.MatchString(input) {
		return input, nil
	}

	return "", fmt.Errorf("unable to extract Google Drive File ID from: %s", input)
}

func downloadViaDriveAPI(ctx context.Context, client *http.Client, fileID, bearerToken string) (*GDriveStreamInfo, error) {
	apiUrl := fmt.Sprintf("https://www.googleapis.com/drive/v3/files/%s?alt=media&supportsAllDrives=true", fileID)
	req, err := http.NewRequestWithContext(ctx, "GET", apiUrl, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create drive api request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+bearerToken)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google drive api request failed: %w", err)
	}

	if resp.StatusCode == http.StatusOK && !strings.Contains(resp.Header.Get("Content-Type"), "text/html") {
		fileName := parseFileName(resp.Header.Get("Content-Disposition"), fileID+".mp4")
		return &GDriveStreamInfo{
			Body:          resp.Body,
			FileName:      fileName,
			ContentLength: resp.ContentLength,
		}, nil
	}
	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	resp.Body.Close()
	return nil, fmt.Errorf("google drive api status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
}

// DownloadGDriveStream initiates download with cookie jar and handles large-file virus confirmation
func DownloadGDriveStream(ctx context.Context, fileIDOrURL string, bearerToken string) (*GDriveStreamInfo, error) {
	fileID, err := ExtractGDriveFileID(fileIDOrURL)
	if err != nil {
		return nil, err
	}

	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar:     jar,
		Timeout: 0, // No timeout for large video streams
	}

	// 1. If OAuth/Bearer token is provided, use Google Drive v3 API direct media stream
	if bearerToken != "" {
		if info, err := downloadViaDriveAPI(ctx, client, fileID, bearerToken); err == nil {
			return info, nil
		}
	}

	// 2. Initial request to Google Drive download endpoint
	initialUrl := fmt.Sprintf("https://drive.google.com/uc?export=download&id=%s", fileID)
	req, err := http.NewRequestWithContext(ctx, "GET", initialUrl, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create initial download request: %w", err)
	}
	setDefaultHeaders(req, "")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("initial google drive download request failed: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")

	// If direct binary download returned immediately (smaller files)
	if resp.StatusCode == http.StatusOK && !strings.Contains(contentType, "text/html") {
		fileName := parseFileName(resp.Header.Get("Content-Disposition"), fileID+".mp4")
		return &GDriveStreamInfo{
			Body:          resp.Body,
			FileName:      fileName,
			ContentLength: resp.ContentLength,
		}, nil
	}

	// 3. Virus warning page detected: Read full HTML body
	htmlBytes, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to read virus warning response: %w", err)
	}
	htmlContent := string(htmlBytes)

	// Extract form parameters and candidates
	parsedForm := parseWarningHTML(htmlContent, fileID)

	// Check cookies for download_warning token
	u, _ := url.Parse("https://drive.google.com")
	for _, cookie := range jar.Cookies(u) {
		if strings.HasPrefix(cookie.Name, "download_warning") && parsedForm.Confirm == "" {
			parsedForm.Confirm = cookie.Value
		}
	}
	if parsedForm.Confirm == "" {
		parsedForm.Confirm = "t"
	}
	parsedForm.Values.Set("confirm", parsedForm.Confirm)

	// Strategy 1: If form method is POST (Modern Google Drive behavior on drive.usercontent.google.com)
	if strings.EqualFold(parsedForm.Method, "POST") && parsedForm.Action != "" {
		postBody := parsedForm.Values.Encode()
		reqPost, err := http.NewRequestWithContext(ctx, "POST", parsedForm.Action, strings.NewReader(postBody))
		if err == nil {
			setDefaultHeaders(reqPost, "https://drive.google.com")
			reqPost.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			reqPost.Header.Set("Origin", "https://drive.google.com")

			respPost, err := client.Do(reqPost)
			if err == nil {
				if respPost.StatusCode == http.StatusOK && !strings.Contains(respPost.Header.Get("Content-Type"), "text/html") {
					fileName := parseFileName(respPost.Header.Get("Content-Disposition"), fileID+".mp4")
					return &GDriveStreamInfo{
						Body:          respPost.Body,
						FileName:      fileName,
						ContentLength: respPost.ContentLength,
					}, nil
				}
				respPost.Body.Close()
			}
		}
	}

	// Strategy 2: If a direct download link was found in the HTML (e.g. uc-download-link or usercontent link)
	for _, candUrl := range parsedForm.CandidateURLs {
		reqLink, err := http.NewRequestWithContext(ctx, "GET", candUrl, nil)
		if err != nil {
			continue
		}
		setDefaultHeaders(reqLink, "https://drive.google.com")

		respLink, err := client.Do(reqLink)
		if err == nil {
			if respLink.StatusCode == http.StatusOK && !strings.Contains(respLink.Header.Get("Content-Type"), "text/html") {
				fileName := parseFileName(respLink.Header.Get("Content-Disposition"), fileID+".mp4")
				return &GDriveStreamInfo{
					Body:          respLink.Body,
					FileName:      fileName,
					ContentLength: respLink.ContentLength,
				}, nil
			}
			respLink.Body.Close()
		}
	}

	// Strategy 3: GET request to parsed form action with all query parameters
	if parsedForm.Action != "" {
		actionGetUrl := parsedForm.Action
		if !strings.Contains(actionGetUrl, "?") {
			actionGetUrl += "?" + parsedForm.Values.Encode()
		} else {
			actionGetUrl += "&" + parsedForm.Values.Encode()
		}
		reqActionGet, err := http.NewRequestWithContext(ctx, "GET", actionGetUrl, nil)
		if err == nil {
			setDefaultHeaders(reqActionGet, "https://drive.google.com")
			respActionGet, err := client.Do(reqActionGet)
			if err == nil {
				if respActionGet.StatusCode == http.StatusOK && !strings.Contains(respActionGet.Header.Get("Content-Type"), "text/html") {
					fileName := parseFileName(respActionGet.Header.Get("Content-Disposition"), fileID+".mp4")
					return &GDriveStreamInfo{
						Body:          respActionGet.Body,
						FileName:      fileName,
						ContentLength: respActionGet.ContentLength,
					}, nil
				}
				respActionGet.Body.Close()
			}
		}
	}

	// Strategy 4: Fallback combinations on drive.usercontent.google.com and drive.google.com
	fallbackURLs := []string{
		fmt.Sprintf("https://drive.usercontent.google.com/download?id=%s&export=download&confirm=%s&uuid=%s", fileID, parsedForm.Confirm, parsedForm.UUID),
		fmt.Sprintf("https://drive.usercontent.google.com/download?id=%s&export=download&confirm=%s", fileID, parsedForm.Confirm),
		fmt.Sprintf("https://drive.google.com/uc?export=download&confirm=%s&id=%s&uuid=%s", parsedForm.Confirm, fileID, parsedForm.UUID),
		fmt.Sprintf("https://drive.google.com/uc?export=download&confirm=%s&id=%s", parsedForm.Confirm, fileID),
	}

	for _, fbUrl := range fallbackURLs {
		reqFb, err := http.NewRequestWithContext(ctx, "GET", fbUrl, nil)
		if err != nil {
			continue
		}
		setDefaultHeaders(reqFb, "https://drive.google.com")

		respFb, err := client.Do(reqFb)
		if err == nil {
			if respFb.StatusCode == http.StatusOK && !strings.Contains(respFb.Header.Get("Content-Type"), "text/html") {
				fileName := parseFileName(respFb.Header.Get("Content-Disposition"), fileID+".mp4")
				return &GDriveStreamInfo{
					Body:          respFb.Body,
					FileName:      fileName,
					ContentLength: respFb.ContentLength,
				}, nil
			}
			respFb.Body.Close()
		}
	}

	// Strategy 5: Automatic OAuth 2.0 PKCE Desktop Login via credentials.json (bypasses all virus/quota/permission walls)
	if oauthToken, oauthErr := obtainDesktopOAuthToken(); oauthErr == nil && oauthToken != "" {
		info, apiErr := downloadViaDriveAPI(ctx, client, fileID, oauthToken)
		if apiErr == nil {
			return info, nil
		}
		return nil, fmt.Errorf("google drive oauth stream failed for file %s: %w", fileID, apiErr)
	}

	return nil, fmt.Errorf("unable to bypass Google Drive virus scan interstitial for file %s. Verify the link is shared with 'Anyone with the link' or supply an OAuth Bearer token (-token)", fileID)
}

func obtainDesktopOAuthToken() (string, error) {
	credsBytes, err := os.ReadFile("credentials.json")
	if err != nil {
		return "", err
	}

	var cfg struct {
		Installed oauthDesktopClient `json:"installed"`
	}
	if err := json.Unmarshal(credsBytes, &cfg); err != nil || cfg.Installed.ClientID == "" {
		return "", errors.New("invalid credentials.json")
	}

	// 1. Check cached token.json (supports persisted /app/data/token.json in Docker)
	if tokBytes, err := os.ReadFile(tokenFilePath()); err == nil {
		var cached cachedOAuthToken
		if json.Unmarshal(tokBytes, &cached) == nil {
			if cached.AccessToken != "" && time.Now().Add(60*time.Second).Before(cached.Expiry) {
				return cached.AccessToken, nil
			}
			if cached.RefreshToken != "" {
				if refreshed, err := refreshDesktopToken(cfg.Installed, cached.RefreshToken); err == nil {
					saveDesktopToken(refreshed)
					return refreshed.AccessToken, nil
				}
			}
		}
	}

	// 2. Interactive browser PKCE login
	tok, err := interactiveDesktopLogin(cfg.Installed)
	if err != nil {
		return "", err
	}
	saveDesktopToken(tok)
	return tok.AccessToken, nil
}

func refreshDesktopToken(client oauthDesktopClient, refreshToken string) (cachedOAuthToken, error) {
	resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"client_id":     {client.ClientID},
		"client_secret": {client.ClientSecret},
		"refresh_token": {refreshToken},
		"grant_type":    {"refresh_token"},
	})
	if err != nil {
		return cachedOAuthToken{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return cachedOAuthToken{}, fmt.Errorf("refresh token HTTP %d", resp.StatusCode)
	}
	var res struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil || res.AccessToken == "" {
		return cachedOAuthToken{}, errors.New("empty refreshed access token")
	}
	return cachedOAuthToken{
		AccessToken:  res.AccessToken,
		RefreshToken: refreshToken,
		Expiry:       time.Now().Add(time.Duration(res.ExpiresIn) * time.Second),
	}, nil
}

func interactiveDesktopLogin(client oauthDesktopClient) (cachedOAuthToken, error) {
	state, err := randomURLString()
	if err != nil {
		return cachedOAuthToken{}, err
	}
	verifier, err := randomURLString()
	if err != nil {
		return cachedOAuthToken{}, err
	}
	hash := sha256.Sum256([]byte(verifier))

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return cachedOAuthToken{}, err
	}
	redirectURI := "http://" + listener.Addr().String() + "/callback"

	type callbackResult struct {
		code string
		err  error
	}
	results := make(chan callbackResult, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("state") != state {
			http.Error(w, "State mismatch", http.StatusBadRequest)
			return
		}
		code := r.URL.Query().Get("code")
		if code == "" {
			select {
			case results <- callbackResult{err: errors.New("authorization declined")}:
			default:
			}
			http.Error(w, "Authorization declined", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintln(w, "<html><body style='font-family:sans-serif;text-align:center;padding:40px;'><h2>Google Drive Authorized!</h2><p>You can close this tab and return to your terminal.</p></body></html>")
		select {
		case results <- callbackResult{code: code}:
		default:
		}
	})

	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	defer srv.Close()
	go func() { _ = srv.Serve(listener) }()

	params := url.Values{
		"client_id":             {client.ClientID},
		"redirect_uri":          {redirectURI},
		"response_type":         {"code"},
		"scope":                 {"https://www.googleapis.com/auth/drive.readonly"},
		"state":                 {state},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(hash[:])},
		"code_challenge_method": {"S256"},
		"access_type":           {"offline"},
		"prompt":                {"consent"},
	}
	authURL := "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode()
	fmt.Printf("\n🔐 Google Drive requires authentication for this file.\n   Opening browser to sign in (or copy & open this URL):\n   %s\n\n", authURL)
	openBrowserURL(authURL)

	var code string
	select {
	case r := <-results:
		if r.err != nil {
			return cachedOAuthToken{}, r.err
		}
		code = r.code
	case <-time.After(5 * time.Minute):
		return cachedOAuthToken{}, errors.New("oauth login timed out")
	}

	resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"client_id":     {client.ClientID},
		"client_secret": {client.ClientSecret},
		"code":          {code},
		"code_verifier": {verifier},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		return cachedOAuthToken{}, err
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil || tokenResp.AccessToken == "" {
		return cachedOAuthToken{}, errors.New("token exchange failed")
	}

	return cachedOAuthToken{
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		Expiry:       time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second),
	}, nil
}

func saveDesktopToken(tok cachedOAuthToken) {
	b, err := json.MarshalIndent(tok, "", "  ")
	if err == nil {
		_ = os.WriteFile("token.json", b, 0600)
	}
}

func randomURLString() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func openBrowserURL(u string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", u)
	case "darwin":
		cmd = exec.Command("open", u)
	default:
		cmd = exec.Command("xdg-open", u)
	}
	_ = cmd.Start()
}

type parsedWarning struct {
	Action        string
	Method        string
	Values        url.Values
	Confirm       string
	UUID          string
	CandidateURLs []string
}

func parseWarningHTML(htmlContent, fileID string) parsedWarning {
	res := parsedWarning{
		Values:        make(url.Values),
		CandidateURLs: make([]string, 0),
	}
	res.Values.Set("id", fileID)
	res.Values.Set("export", "download")

	// 1. Extract Form tag & attributes
	if formTag := formTagRegex.FindString(htmlContent); formTag != "" {
		if actionMatch := actionAttrRegex.FindStringSubmatch(formTag); len(actionMatch) > 1 {
			res.Action = html.UnescapeString(actionMatch[1])
			if strings.HasPrefix(res.Action, "/") {
				res.Action = "https://drive.google.com" + res.Action
			}
		}
		if methodMatch := methodAttrRegex.FindStringSubmatch(formTag); len(methodMatch) > 1 {
			res.Method = strings.ToUpper(methodMatch[1])
		}
	}
	if res.Action == "" {
		res.Action = "https://drive.usercontent.google.com/download"
	}
	if res.Method == "" {
		res.Method = "POST"
	}

	// 2. Extract input fields inside form
	inputTags := inputTagRegex.FindAllString(htmlContent, -1)
	for _, inputTag := range inputTags {
		nameMatch := nameAttrRegex.FindStringSubmatch(inputTag)
		valueMatch := valueAttrRegex.FindStringSubmatch(inputTag)
		if len(nameMatch) > 1 && len(valueMatch) > 1 {
			k := nameMatch[1]
			v := html.UnescapeString(valueMatch[1])
			res.Values.Set(k, v)
			if strings.EqualFold(k, "confirm") {
				res.Confirm = v
			}
			if strings.EqualFold(k, "uuid") {
				res.UUID = v
			}
		}
	}

	// 3. Fallback regex for uuid and confirm
	if res.UUID == "" {
		if m := uuidRegex.FindStringSubmatch(htmlContent); len(m) > 1 {
			res.UUID = m[1]
			res.Values.Set("uuid", res.UUID)
		}
	}
	if res.Confirm == "" {
		if m := confirmRegex.FindStringSubmatch(htmlContent); len(m) > 1 {
			res.Confirm = m[1]
			res.Values.Set("confirm", res.Confirm)
		}
	}

	// 4. Extract any anchor download link
	links := linkTagRegex.FindAllStringSubmatch(htmlContent, -1)
	for _, link := range links {
		if len(link) > 1 {
			href := html.UnescapeString(link[1])
			if strings.Contains(href, "download") || strings.Contains(href, "confirm=") || strings.Contains(href, "export=") {
				if strings.HasPrefix(href, "/") {
					href = "https://drive.google.com" + href
				}
				res.CandidateURLs = append(res.CandidateURLs, href)
			}
		}
	}

	return res
}

func setDefaultHeaders(req *http.Request, referer string) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	if referer != "" {
		req.Header.Set("Referer", referer)
	}
}

func parseFileName(contentDisposition, fallback string) string {
	if contentDisposition == "" {
		return fallback
	}
	_, params, err := mime.ParseMediaType(contentDisposition)
	if err == nil {
		if val, ok := params["filename"]; ok && val != "" {
			return val
		}
	}
	return fallback
}

func FormatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
