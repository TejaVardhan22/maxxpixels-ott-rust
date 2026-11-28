import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Row,
  Col,
  Radio,
  Tag,
  Progress,
  Modal,
  Typography,
  Divider,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  CloudUploadOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  CloudSyncOutlined,
  KeyOutlined,
  FolderOpenOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiUpload, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";
import { CalendarDatePicker, CalendarDateTimePicker, TimerPicker } from "../../components/DateTimePickers";

const { Title, Text } = Typography;

const CONTENT_WARNINGS = [
  "Violence",
  "Strong Language",
  "Substance Use",
  "Smoking",
  "Flashing Lights",
  "Sexual Content",
  "Mild Themes",
  "Horror / Fear",
];

const QUALITY_BADGES = [
  "4K UHD",
  "Full HD 1080p",
  "HD 720p",
  "HDR10",
  "Dolby Vision",
  "Dolby Atmos",
  "5.1 Surround",
];

function parseDurationToSeconds(raw: string): number {
  if (!raw) return 0;
  const s = raw.trim();
  if (/^\d+$/.test(s)) return Number(s) * 60;
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => Number(p) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  let total = 0;
  const h = s.match(/(\d+)\s*h/i);
  const m = s.match(/(\d+)\s*m/i);
  const sec = s.match(/(\d+)\s*s/i);
  if (h) total += Number(h[1]) * 3600;
  if (m) total += Number(m[1]) * 60;
  if (sec) total += Number(sec[1]);
  return total;
}

function formatDurationSummary(raw: string): string {
  const secs = parseDurationToSeconds(raw);
  if (!secs) return "0m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h ? `${h}h ` : ""}${m}m${s ? ` ${s}s` : ""} (${Math.round(secs / 60)} mins)`;
}

export const MovieFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  // Master data dropdowns (100% DB-driven)
  const [mainTypes, setMainTypes] = useState<{ value: string; label: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["Telugu", "Hindi", "Tamil", "English", "Kannada", "Malayalam"]);
  const [castList, setCastList] = useState<any[]>([]);
  const [producers, setProducers] = useState<string[]>([]);

  // Inline add cast
  const [showAddCast, setShowAddCast] = useState(false);
  const [newCastName, setNewCastName] = useState("");
  const [newCastRole, setNewCastRole] = useState("Actor");
  const [newCastBio, setNewCastBio] = useState("");
  const [newCastPhoto, setNewCastPhoto] = useState("");

  // Quick-add taxonomy modal
  const [quickAdd, setQuickAdd] = useState<{ open: boolean; kind?: "category" | "genre" | "language" | "content-type"; value: string; code: string }>({
    open: false,
    value: "",
    code: "",
  });

  // Video inspector & Google Drive -> Bunny Stream state
  const [showInspector, setShowInspector] = useState(false);
  const [gdriveLink, setGdriveLink] = useState("");
  const [gdriveStreaming, setGdriveStreaming] = useState(false);
  const [gdriveProgress, setGdriveProgress] = useState(0);
  const [gdriveStatus, setGdriveStatus] = useState("");
  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [showGdriveBrowser, setShowGdriveBrowser] = useState(false);
  const [gdriveScope, setGdriveScope] = useState<"shared" | "my">("shared");
  const [gdriveSearch, setGdriveSearch] = useState("");
  const [gdriveFiles, setGdriveFiles] = useState<any[]>([]);
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [bunnyUploading, setBunnyUploading] = useState(false);

  const watchedType = Form.useWatch("contentType", form) || "";
  const watchedStatus = Form.useWatch("status", form) || "PUBLISHED";
  const watchedMonetization = Form.useWatch("monetization", form) || "SVOD";
  const watchedDuration = Form.useWatch("durationTime", form) || "";
  const watchedStreamUrl = Form.useWatch("masterPlaylistUrl", form) || "";
  const watchedPoster = Form.useWatch("posterUrl", form) || "";
  const watchedBanner = Form.useWatch("bannerUrl", form) || "";
  const watchedLogo = Form.useWatch("logoImageUrl", form) || "";
  const watchedRentPrice = Form.useWatch("rentPrice", form);
  const watchedValidity = Form.useWatch("validityHours", form);

  const loadMasterData = async () => {
    try {
      const [ctRes, catRes, genRes, langRes, castRes, prodRes] = await Promise.all([
        apiGet("/admin/content-types").catch(() => []),
        apiGet("/admin/categories").catch(() => []),
        apiGet("/admin/genres").catch(() => []),
        apiGet("/admin/languages").catch(() => []),
        apiGet("/admin/cast").catch(() => []),
        apiGet("/admin/producers").catch(() => []),
      ]);
      const cts = extractArray(ctRes);
      setMainTypes(
        cts
          .map((c: any) => {
            const label = c.title || c.name || c.slug || "";
            const value = String(c.slug || c.code || c.title || c.name || "")
              .trim()
              .toUpperCase()
              .replace(/[\s-]+/g, "_");
            return { value, label };
          })
          .filter((c: any) => c.value && c.label)
      );
      setCategories(extractArray(catRes).map((c: any) => c.name || c).filter(Boolean));
      setGenres(extractArray(genRes).map((g: any) => g.name || g).filter(Boolean));
      const langs = extractArray(langRes).map((l: any) => l.name || l).filter(Boolean);
      if (langs.length) setLanguages(langs);
      setCastList(extractArray(castRes));
      setProducers(extractArray(prodRes).map((p: any) => p.studioName || p.companyName || p.name).filter(Boolean));
    } catch {
      // ignore
    }
  };

  const loadMovie = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const rec = await apiGet<any>(`/admin/movies/${id}`);
      const secs = rec.durationSeconds || (rec.durationMinutes ? rec.durationMinutes * 60 : 0);
      const durStr = secs
        ? [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60]
            .map((n) => String(n).padStart(2, "0"))
            .join(":")
        : "";
      form.setFieldsValue({
        title: rec.title,
        contentType: rec.contentType || undefined,
        category: Array.isArray(rec.categories) ? rec.categories : rec.category ? [rec.category] : [],
        genres: Array.isArray(rec.genres) ? rec.genres : [],
        originalLanguage: rec.originalLanguage || rec.language || "Telugu",
        cast: Array.isArray(rec.cast) ? rec.cast : [],
        producer: rec.producer || rec.productionHouse || "",
        releaseDate: rec.releaseDate
          ? String(rec.releaseDate).slice(0, 10)
          : rec.releaseYear
          ? `${rec.releaseYear}-01-01`
          : "",
        durationTime: durStr,
        maturityRating: rec.maturityRating || "UA_13+",
        masterPlaylistUrl: rec.masterPlaylistUrl || rec.streamUrl || rec.hlsUrl || rec.videoUrl || "",
        trailerType: rec.trailerType || "Server Video",
        trailerUrl: rec.trailerUrl || "",
        subtitles: Array.isArray(rec.subtitles) && rec.subtitles.length ? rec.subtitles : [{ languageName: "English", fileUrl: "" }],
        audioTracks: Array.isArray(rec.audioTracks) ? rec.audioTracks : [],
        description: rec.description || rec.synopsis || "",
        posterUrl: rec.posterUrl || rec.thumbnailUrl || "",
        bannerUrl: rec.bannerUrl || rec.landscapeUrl || rec.backdropUrl || "",
        logoImageUrl: rec.logoImageUrl || "",
        contentWarnings: Array.isArray(rec.contentWarnings) ? rec.contentWarnings : [],
        qualityBadges: Array.isArray(rec.qualityBadges) ? rec.qualityBadges : [],
        monetization: rec.monetization || rec.accessType || "SVOD",
        rentPrice: rec.rentPrice ?? 99,
        validityHours: rec.validityHours ?? 48,
        drmSystem: rec.drmSystem || "NONE",
        geoRestrictions: Array.isArray(rec.geoRestrictions) ? rec.geoRestrictions : ["GLOBAL"],
        skipIntroStart: rec.skipIntroStart || "",
        skipIntroEnd: rec.skipIntroEnd || "",
        skipOutroStart: rec.skipOutroStart || "",
        seoKeywords: rec.seoKeywords || "",
        status: rec.status || "PUBLISHED",
        scheduledPublishAt: rec.scheduledPublishAt ? String(rec.scheduledPublishAt).slice(0, 16) : "",
        expiresAt: rec.expiresAt ? String(rec.expiresAt).slice(0, 16) : "",
      });
    } catch (e: any) {
      message.error(e.message || "Failed to load movie");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    if (isEdit) {
      loadMovie();
    } else {
      form.setFieldsValue({
        originalLanguage: "Telugu",
        maturityRating: "UA_13+",
        trailerType: "Server Video",
        monetization: "SVOD",
        rentPrice: 99,
        validityHours: 48,
        drmSystem: "NONE",
        geoRestrictions: ["GLOBAL"],
        status: "PUBLISHED",
        subtitles: [{ languageName: "English", fileUrl: "" }],
        audioTracks: [],
      });
    }
  }, [id]);

  const scrollToSection = (secId: string, step: number) => {
    setActiveStep(step);
    document.getElementById(secId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const triggerAiAutoFill = () => {
    const title = form.getFieldValue("title") || "Untitled Blockbuster";
    const lang = form.getFieldValue("originalLanguage") || "Telugu";
    const type = form.getFieldValue("contentType") || "content";
    form.setFieldsValue({
      description: `${title} is an acclaimed ${lang} ${type.toLowerCase()} delivering gripping storytelling, cinematic visuals, and unforgettable performances on MaxxPixels OTT.`,
      seoKeywords: `${title.toLowerCase()}, ${lang.toLowerCase()} ${type.toLowerCase()}, watch online, maxxpixels ott`,
      qualityBadges: ["4K UHD", "Dolby Atmos"],
      maturityRating: form.getFieldValue("maturityRating") || "UA_13+",
    });
    message.success("AI metadata & SEO tags generated");
  };

  const handleQuickAddTaxonomy = async () => {
    if (!quickAdd.kind || !quickAdd.value.trim()) return;
    try {
      const endpointMap = {
        category: "/admin/categories",
        genre: "/admin/genres",
        language: "/admin/languages",
        "content-type": "/admin/content-types",
      };
      const payload =
        quickAdd.kind === "language"
          ? { name: quickAdd.value.trim(), code: quickAdd.code.trim() || quickAdd.value.trim().slice(0, 2).toLowerCase() }
          : { name: quickAdd.value.trim(), slug: quickAdd.value.trim().toLowerCase().replace(/\s+/g, "-") };
      await apiPost(endpointMap[quickAdd.kind], payload);
      message.success(`Added "${quickAdd.value.trim()}"`);
      setQuickAdd({ open: false, value: "", code: "" });
      loadMasterData();
    } catch (e: any) {
      message.error(e.message || "Failed to add item");
    }
  };

  const saveNewCastPerson = async () => {
    if (!newCastName.trim()) {
      message.warning("Enter cast person name");
      return;
    }
    try {
      await apiPost("/admin/cast", {
        name: newCastName.trim(),
        role: newCastRole.trim() || "Actor",
        bio: newCastBio.trim(),
        photoUrl: newCastPhoto,
      });
      message.success(`Added ${newCastName.trim()} to Cast`);
      const current = form.getFieldValue("cast") || [];
      form.setFieldValue("cast", [...current, newCastName.trim()]);
      setNewCastName("");
      setNewCastBio("");
      setNewCastPhoto("");
      setShowAddCast(false);
      loadMasterData();
    } catch (e: any) {
      message.error(e.message || "Failed to save cast person");
    }
  };

  const connectGoogleDrive = async () => {
    try {
      const res = await fetch("/api/gdrive/auth-url");
      const json = await res.json();
      if (json?.url) {
        window.open(json.url, "_blank", "noopener,noreferrer");
        message.info("Complete Google Drive sign-in in the opened tab, then click Browse.");
      } else {
        message.error(json?.error || "Could not get Google Drive auth URL");
      }
    } catch (e: any) {
      message.error(e.message || "Failed to contact media-streamer");
    }
  };

  const loadGdriveVideos = async (scope: "shared" | "my") => {
    setGdriveScope(scope);
    setShowGdriveBrowser(true);
    setGdriveLoading(true);
    try {
      const qs = new URLSearchParams({ scope, media: "video" });
      if (gdriveSearch.trim()) qs.set("q", gdriveSearch.trim());
      const res = await fetch(`/api/gdrive/files?${qs.toString()}`);
      const json = await res.json();
      setGdriveConnected(Boolean(json?.connected ?? true));
      setGdriveFiles(Array.isArray(json?.files) ? json.files : []);
    } catch (e: any) {
      message.error(e.message || "Failed to browse Google Drive");
    } finally {
      setGdriveLoading(false);
    }
  };

  const streamFromGDrive = async (urlOrId: string, overrideTitle?: string) => {
    if (!urlOrId.trim()) {
      message.warning("Paste a Google Drive video link first");
      return;
    }
    setGdriveStreaming(true);
    setGdriveProgress(5);
    setGdriveStatus("Starting zero-disk stream to Bunny Stream...");
    try {
      const res = await fetch("/api/stream-gdrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gdrive_url: urlOrId.trim(),
          title: overrideTitle || form.getFieldValue("title") || "MaxxPixels Video",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to start GDrive stream");
      const jobId = json?.job_id || json?.jobId;
      if (json?.hls_url || json?.hlsUrl) {
        form.setFieldValue("masterPlaylistUrl", json.hls_url || json.hlsUrl);
        setGdriveProgress(100);
        setGdriveStreaming(false);
        message.success("Stream ready on Bunny CDN!");
        return;
      }
      if (jobId) {
        const poll = setInterval(async () => {
          try {
            const jRes = await fetch(`/api/jobs/${jobId}`);
            const jData = await jRes.json();
            if (typeof jData?.progress === "number") setGdriveProgress(jData.progress);
            if (jData?.status) setGdriveStatus(jData.message || jData.status);
            if (jData?.hls_url || jData?.hlsUrl || jData?.status === "completed") {
              clearInterval(poll);
              if (jData.hls_url || jData.hlsUrl) {
                form.setFieldValue("masterPlaylistUrl", jData.hls_url || jData.hlsUrl);
              }
              setGdriveProgress(100);
              setGdriveStreaming(false);
              message.success("Video streamed to Bunny CDN!");
            } else if (jData?.status === "failed" || jData?.error) {
              clearInterval(poll);
              setGdriveStreaming(false);
              message.error(jData.error || "Google Drive stream failed");
            }
          } catch {
            clearInterval(poll);
            setGdriveStreaming(false);
          }
        }, 2500);
      }
    } catch (e: any) {
      setGdriveStreaming(false);
      message.error(e.message || "Google Drive stream error");
    }
  };

  const handleDirectBunnyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBunnyUploading(true);
    try {
      const res = await apiUpload("/storage/upload-video", file);
      const url = res?.hlsUrl || res?.streamUrl || res?.url || res?.fileUrl;
      if (url) {
        form.setFieldValue("masterPlaylistUrl", url);
        message.success("Video uploaded and linked!");
      }
    } catch (err: any) {
      message.error(err.message || "Video upload failed");
    } finally {
      setBunnyUploading(false);
      e.target.value = "";
    }
  };

  const submitWithStatus = async (status: "DRAFT" | "SCHEDULED" | "PUBLISHED") => {
    form.setFieldValue("status", status);
    try {
      const values = await form.validateFields();
      if (status === "SCHEDULED" && !values.scheduledPublishAt) {
        message.warning("Pick a Schedule Auto-Publish Date & Time in Section 01");
        scrollToSection("sec-1", 1);
        return;
      }
      setSaving(true);
      const durationSeconds = parseDurationToSeconds(values.durationTime || "");
      const payload = {
        ...values,
        status,
        language: values.originalLanguage,
        durationSeconds: durationSeconds || undefined,
        durationMinutes: durationSeconds ? Math.round(durationSeconds / 60) : undefined,
        streamUrl: values.masterPlaylistUrl,
        hlsUrl: values.masterPlaylistUrl,
        videoUrl: values.masterPlaylistUrl,
        backdropUrl: values.bannerUrl,
        thumbnailUrl: values.posterUrl,
        accessType: values.monetization,
        isPremium: values.monetization !== "AVOD",
      };
      if (isEdit && id) {
        await apiPut(`/admin/movies/${id}`, payload);
        message.success(`Updated (${status})`);
      } else {
        await apiPost("/admin/movies", payload);
        message.success(`Created & saved as ${status}`);
      }
      navigate("/admin/movies");
    } catch (e: any) {
      if (e?.errorFields) {
        message.error("Please fill all required fields (Title & Original Language)");
        return;
      }
      message.error(e.message || "Failed to save content");
    } finally {
      setSaving(false);
    }
  };

  const isPodcast = watchedType === "PODCAST";
  const isStageDrama = watchedType === "STAGE_DRAMA";
  const isDocumentary = watchedType === "DOCUMENTARY";

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", paddingBottom: 80 }}>
      {/* 0. STICKY QUICK NAVIGATION BAR */}
      <Card
        size="small"
        style={{
          position: "sticky",
          top: 8,
          zIndex: 50,
          marginBottom: 16,
          background: "rgba(22, 22, 34, 0.96)",
          borderColor: "#28283a",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Space wrap size={6}>
            {[
              { id: "sec-1", step: 1, label: "01 Metadata" },
              { id: "sec-2", step: 2, label: "02 Video Sources" },
              { id: "sec-3", step: 3, label: "03 Subtitles" },
              { id: "sec-4", step: 4, label: "04 Monetization" },
              { id: "sec-5", step: 5, label: "05 DRM & Geo" },
              { id: "sec-6", step: 6, label: "06 SEO & Chapters" },
            ].map((p) => (
              <Button
                key={p.id}
                size="small"
                type={activeStep === p.step ? "primary" : "default"}
                danger={activeStep === p.step}
                onClick={() => scrollToSection(p.id, p.step)}
              >
                {p.label}
              </Button>
            ))}
          </Space>
          <Space wrap size={6}>
            <Button size="small" icon={<ThunderboltOutlined />} onClick={triggerAiAutoFill}>
              AI Auto-Fill
            </Button>
            <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/movies")}>
              Catalog
            </Button>
            <Button size="small" icon={<FileTextOutlined />} loading={saving} onClick={() => submitWithStatus("DRAFT")}>
              Save Draft
            </Button>
            <Button size="small" icon={<ClockCircleOutlined />} loading={saving} onClick={() => submitWithStatus("SCHEDULED")}>
              Schedule
            </Button>
            <Button
              size="small"
              type="primary"
              danger
              icon={isEdit ? <SaveOutlined /> : <CloudUploadOutlined />}
              loading={saving}
              onClick={() => submitWithStatus("PUBLISHED")}
            >
              {isEdit ? "Update & Publish" : "Publish Now"}
            </Button>
          </Space>
        </div>
      </Card>

      <Form form={form} layout="vertical" disabled={loading}>
        <Card style={{ marginBottom: 16 }}>
          <Tag color="red" style={{ marginBottom: 8 }}>CONTENT STUDIO · {watchedType}</Tag>
          <Title level={3} style={{ margin: "0 0 4px" }}>
            {isEdit ? "Edit Catalog Title" : "Create & Publish New Content"}
          </Title>
          <Text type="secondary">
            Configure metadata, Bunny Stream / Google Drive video feeds, subtitles, artwork, monetization, DRM, and SEO.
          </Text>
        </Card>

        {/* 01. GENERAL METADATA */}
        <Card
          id="sec-1"
          style={{ marginBottom: 16 }}
          title={<Space><Tag color="red">01</Tag><span>General Metadata</span></Space>}
          extra={<Button size="small" icon={<ThunderboltOutlined />} onClick={triggerAiAutoFill}>AI Auto-Fill</Button>}
        >
          {watchedStatus === "SCHEDULED" && (
            <Card size="small" style={{ marginBottom: 16, borderColor: "#38bdf8" }} title="Schedule Auto-Publish Date & Time">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="scheduledPublishAt" label="Publish Date & Time *">
                    <CalendarDateTimePicker placeholder="Pick publish date & time" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="expiresAt" label="Auto-Expire / License End (Optional)">
                    <CalendarDateTimePicker placeholder="Pick expiry date & time" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          <Form.Item name="title" label="Content Title" rules={[{ required: true, message: "Title is required" }]}>
            <Input size="large" placeholder="e.g. Kalki 2898 AD" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="contentType"
                label={
                  <Space>
                    <span>Main Type</span>
                    <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setQuickAdd({ open: true, kind: "content-type", value: "", code: "" })}>
                      Add New
                    </Button>
                  </Space>
                }
                rules={[{ required: true }]}
              >
                <Select
                  options={mainTypes}
                  placeholder="Select main type (from Content Types)"
                  notFoundContent="No content types yet — click + Add New"
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="category"
                label={
                  <Space>
                    <span>Category (Sub Type)</span>
                    <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setQuickAdd({ open: true, kind: "category", value: "", code: "" })}>
                      Add New
                    </Button>
                  </Space>
                }
              >
                <Select mode="tags" options={categories.map((c) => ({ value: c, label: c }))} placeholder="Select or type categories" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="genres"
                label={
                  <Space>
                    <span>Genres / Sub-Types</span>
                    <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setQuickAdd({ open: true, kind: "genre", value: "", code: "" })}>
                      Add New
                    </Button>
                  </Space>
                }
              >
                <Select mode="tags" options={genres.map((g) => ({ value: g, label: g }))} placeholder="Action, Sci-Fi, Thriller..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="originalLanguage"
                label={
                  <Space>
                    <span>Original Language</span>
                    <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setQuickAdd({ open: true, kind: "language", value: "", code: "" })}>
                      Add New
                    </Button>
                  </Space>
                }
                rules={[{ required: true }]}
              >
                <Select showSearch options={languages.map((l) => ({ value: l, label: l }))} />
              </Form.Item>
            </Col>
          </Row>

          {/* Specialized boxes for Podcast / Stage Drama / Documentary */}
          {isPodcast && (
            <Card size="small" style={{ marginBottom: 16 }} title="YouTube Sync & Podcast Feed Options">
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="youtubeOption" label="YouTube Channel / Episode Name"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="podcastHost" label="Podcast Host Name"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="podcastGuest" label="Guest Speaker(s)"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="podcastAudioUrl" label="Master Audio URL (.mp3 / RSS)"><Input /></Form.Item></Col>
              </Row>
            </Card>
          )}
          {isStageDrama && (
            <Card size="small" style={{ marginBottom: 16 }} title="Traditional Stage Drama Details">
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="dramaTroupe" label="Drama Troupe / Theater Company"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="playwright" label="Playwright / Script Writer"><Input /></Form.Item></Col>
              </Row>
            </Card>
          )}
          {isDocumentary && (
            <Card size="small" style={{ marginBottom: 16 }} title="Documentary Details">
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="docTopic" label="Subject / Historical Theme"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="docNarrator" label="Narrator / Voiceover Artist"><Input /></Form.Item></Col>
              </Row>
            </Card>
          )}

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="cast"
                label={
                  <Space>
                    <span>Cast Members</span>
                    <Button type="link" size="small" icon={<UserAddOutlined />} onClick={() => setShowAddCast(!showAddCast)}>
                      {showAddCast ? "Close" : "Add Cast Person"}
                    </Button>
                  </Space>
                }
              >
                <Select
                  mode="tags"
                  options={castList.map((c: any) => ({
                    value: c.name || c,
                    label: `${c.name || c}${c.role ? ` (${c.role})` : ""}`,
                  }))}
                  placeholder="Select cast members"
                />
              </Form.Item>
              {showAddCast && (
                <Card size="small" style={{ marginBottom: 16 }} title="Add New Cast Person">
                  <Row gutter={8}>
                    <Col span={12}><Input placeholder="Person Name *" value={newCastName} onChange={(e) => setNewCastName(e.target.value)} style={{ marginBottom: 8 }} /></Col>
                    <Col span={12}><Input placeholder="Role (Actor, Director)" value={newCastRole} onChange={(e) => setNewCastRole(e.target.value)} style={{ marginBottom: 8 }} /></Col>
                  </Row>
                  <Input placeholder="Short Bio (optional)" value={newCastBio} onChange={(e) => setNewCastBio(e.target.value)} style={{ marginBottom: 8 }} />
                  <MediaUpload type="image" folder="avatars" value={newCastPhoto} onChange={setNewCastPhoto} />
                  <Button type="primary" size="small" style={{ marginTop: 8 }} onClick={saveNewCastPerson}>Save Cast Person</Button>
                </Card>
              )}
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="producer" label="Producer / Production House">
                <Select allowClear showSearch options={producers.map((p) => ({ value: p, label: p }))} placeholder="Select producer" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="releaseDate" label="Release Date">
                <CalendarDatePicker placeholder="Select release date" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="durationTime"
                label="Run Time / Duration"
                extra={<Text type="secondary">Parsed: <strong>{formatDurationSummary(watchedDuration)}</strong></Text>}
              >
                <TimerPicker placeholder="Select duration (HH:MM:SS)" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="maturityRating" label="Maturity Age Rating">
                <Select
                  options={[
                    { value: "U", label: "U (Universal - All Ages)" },
                    { value: "UA_7+", label: "U/A 7+ (Parental Guidance 7+)" },
                    { value: "UA_13+", label: "U/A 13+ (Parental Guidance 13+)" },
                    { value: "UA_16+", label: "U/A 16+ (Parental Guidance 16+)" },
                    { value: "A", label: "A 18+ (Adults Only)" },
                    { value: "PG-13", label: "PG-13 (International)" },
                    { value: "TV-MA", label: "TV-MA (Mature Audience)" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 02. MULTI-RESOLUTION VIDEO FEEDS & BUNNY STREAM / GOOGLE DRIVE PIPELINE */}
        <Card
          id="sec-2"
          style={{ marginBottom: 16 }}
          title={<Space><Tag color="red">02</Tag><span>Bunny.net Stream HLS &amp; Google Drive Pipeline</span></Space>}
          extra={
            <Button size="small" icon={<PlayCircleOutlined />} onClick={() => setShowInspector(!showInspector)}>
              {showInspector ? "Close Inspector" : "Inspect Stream"}
            </Button>
          }
        >
          {showInspector && (
            <Card size="small" style={{ marginBottom: 16, background: "#0b0d14" }} title={`Stream Playback Inspector — ${watchedStreamUrl || "No Stream Loaded"}`}>
              {watchedStreamUrl ? (
                <video src={watchedStreamUrl} controls style={{ width: "100%", maxHeight: 360, borderRadius: 8 }} />
              ) : (
                <Text type="secondary">Enter a video HLS URL or stream from Google Drive below to preview.</Text>
              )}
            </Card>
          )}

          <Space wrap style={{ marginBottom: 12 }}>
            <label>
              <input type="file" accept="video/*" style={{ display: "none" }} onChange={handleDirectBunnyUpload} />
              <Button icon={<CloudUploadOutlined />} loading={bunnyUploading} onClick={(e) => (e.currentTarget.previousSibling as HTMLInputElement)?.click()}>
                Upload Video Directly
              </Button>
            </label>
            <Button icon={<KeyOutlined />} onClick={connectGoogleDrive}>
              {gdriveConnected ? "Reconnect Google Drive (Connected)" : "Login Google Drive (Private Files)"}
            </Button>
            <Button icon={<FolderOpenOutlined />} onClick={() => loadGdriveVideos("shared")}>
              Browse Shared with Me
            </Button>
            <Button icon={<FolderOpenOutlined />} onClick={() => loadGdriveVideos("my")}>
              Browse My Drive
            </Button>
          </Space>

          {showGdriveBrowser && (
            <Card
              size="small"
              style={{ marginBottom: 14 }}
              title={`Google Drive Videos (${gdriveScope === "shared" ? "Shared with me" : "My Drive"})`}
              extra={<Button size="small" onClick={() => setShowGdriveBrowser(false)}>Close</Button>}
            >
              <Space style={{ marginBottom: 10, width: "100%" }}>
                <Input
                  size="small"
                  placeholder="Filter by filename..."
                  value={gdriveSearch}
                  onChange={(e) => setGdriveSearch(e.target.value)}
                  onPressEnter={() => loadGdriveVideos(gdriveScope)}
                />
                <Button size="small" onClick={() => loadGdriveVideos(gdriveScope)}>Search</Button>
              </Space>
              {gdriveLoading ? (
                <Text type="secondary">Loading videos from Google Drive...</Text>
              ) : gdriveFiles.length === 0 ? (
                <Text type="secondary">No video files found. Click "Login Google Drive" first if not connected.</Text>
              ) : (
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {gdriveFiles.map((vf: any) => (
                    <div
                      key={vf.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 8px",
                        borderBottom: "1px solid #1e2230",
                      }}
                    >
                      <Text ellipsis style={{ maxWidth: "75%" }}>{vf.name}</Text>
                      <Button
                        size="small"
                        type="primary"
                        icon={<CloudSyncOutlined />}
                        disabled={gdriveStreaming}
                        onClick={() => {
                          const link = `https://drive.google.com/file/d/${vf.id}/view`;
                          setGdriveLink(link);
                          streamFromGDrive(link, vf.name);
                        }}
                      >
                        Stream
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Row gutter={8} style={{ marginBottom: 12 }}>
            <Col flex="1">
              <Input
                value={gdriveLink}
                onChange={(e) => setGdriveLink(e.target.value)}
                placeholder="Paste Google Drive Video Link (1 GB - 100+ GB Zero-Disk Stream)"
                disabled={gdriveStreaming}
              />
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<CloudSyncOutlined />}
                loading={gdriveStreaming}
                onClick={() => streamFromGDrive(gdriveLink)}
              >
                Stream from GDrive
              </Button>
            </Col>
          </Row>

          {gdriveStreaming && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">{gdriveStatus}</Text>
              <Progress percent={gdriveProgress} status="active" />
            </div>
          )}

          <Form.Item name="masterPlaylistUrl" label="Bunny Stream HLS URL / Master Playlist (.m3u8) or Video GUID">
            <Input
              placeholder="https://vz-xxxx.b-cdn.net/<video-guid>/playlist.m3u8"
              addonAfter={
                watchedStreamUrl ? (
                  <Space size={4}>
                    <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    <a onClick={() => setShowInspector(true)}>Inspect</a>
                  </Space>
                ) : null
              }
            />
          </Form.Item>
        </Card>

        {/* 03. TRAILERS, SUBTITLES & DUBBED AUDIO TRACKS */}
        <Card
          id="sec-3"
          style={{ marginBottom: 16 }}
          title={<Space><Tag color="red">03</Tag><span>Trailers, Subtitles &amp; Dubbed Audio Tracks</span></Space>}
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="trailerType" label="Trailer Format">
                <Select
                  options={[
                    { value: "Server Video", label: "Server Video File" },
                    { value: "Youtube Embed", label: "YouTube / Vimeo Embed" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="trailerUrl" label="Trailer Video (Upload, GDrive, or URL)">
                <MediaUpload type="video" folder="trailers" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Multi-Language Subtitle Tracks (.vtt / .srt)</Divider>
          <Form.List name="subtitles">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                    <Col xs={24} md={7}>
                      <Form.Item {...rest} name={[name, "languageName"]} style={{ marginBottom: 0 }}>
                        <Input placeholder="Language (e.g. English, Telugu)" />
                      </Form.Item>
                    </Col>
                    <Col xs={20} md={15}>
                      <Form.Item {...rest} name={[name, "fileUrl"]} style={{ marginBottom: 0 }}>
                        <Input placeholder="Subtitle .vtt / .srt URL" />
                      </Form.Item>
                    </Col>
                    <Col xs={4} md={2}>
                      <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ languageName: "", fileUrl: "" })}>
                  Add Subtitle Language
                </Button>
              </>
            )}
          </Form.List>

          <Divider plain>Multi-Language Audio / Dubbed Video Tracks</Divider>
          <Form.List name="audioTracks">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                    <Col xs={24} md={7}>
                      <Form.Item {...rest} name={[name, "languageName"]} style={{ marginBottom: 0 }}>
                        <Input placeholder="Audio Language (e.g. Hindi, Tamil)" />
                      </Form.Item>
                    </Col>
                    <Col xs={20} md={15}>
                      <Form.Item {...rest} name={[name, "url"]} style={{ marginBottom: 0 }}>
                        <Input placeholder="Dubbed HLS (.m3u8) / Audio File URL" />
                      </Form.Item>
                    </Col>
                    <Col xs={4} md={2}>
                      <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ languageName: "", url: "" })}>
                  Add Dubbed Language Track
                </Button>
              </>
            )}
          </Form.List>
        </Card>

        {/* 04. ARTWORK & MONETIZATION */}
        <Card
          id="sec-4"
          style={{ marginBottom: 16 }}
          title={<Space><Tag color="red">04</Tag><span>Artwork &amp; Monetization</span></Space>}
        >
          <Form.Item name="description" label="Synopsis / Description">
            <Input.TextArea rows={4} placeholder="Enter storyline description..." />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="posterUrl" label="Poster Image (3:4 Ratio)">
                <MediaUpload type="image" folder="posters" />
              </Form.Item>
              {watchedPoster && (
                <img src={watchedPoster} alt="Poster" style={{ height: 140, borderRadius: 8, objectFit: "cover", marginBottom: 12 }} />
              )}
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="bannerUrl" label="Landscape Banner (16:9 Ratio)">
                <MediaUpload type="image" folder="banners" />
              </Form.Item>
              {watchedBanner && (
                <img src={watchedBanner} alt="Banner" style={{ height: 140, width: "100%", borderRadius: 8, objectFit: "cover", marginBottom: 12 }} />
              )}
            </Col>
          </Row>

          <Form.Item name="logoImageUrl" label="Transparent Title Logo (PNG — Optional for Hero Banner)">
            <MediaUpload type="image" folder="branding" />
          </Form.Item>
          {watchedLogo && (
            <div style={{ marginBottom: 14, padding: 10, background: "#000", display: "inline-block", borderRadius: 8 }}>
              <img src={watchedLogo} alt="Title Logo" style={{ maxHeight: 52 }} />
            </div>
          )}

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="contentWarnings" label="Content Advisory Descriptors (IT Rules)">
                <Select mode="multiple" options={CONTENT_WARNINGS.map((w) => ({ value: w, label: w }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="qualityBadges" label="Quality & Audio Badges">
                <Select mode="multiple" options={QUALITY_BADGES.map((b) => ({ value: b, label: b }))} />
              </Form.Item>
            </Col>
          </Row>

          {watchedStatus !== "SCHEDULED" && (
            <Form.Item name="expiresAt" label="License Expiry Date & Time (Optional)">
              <CalendarDateTimePicker placeholder="Pick expiry date & time" style={{ maxWidth: 320 }} />
            </Form.Item>
          )}

          <Divider plain>Monetization Model *</Divider>
          <Form.Item name="monetization">
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio.Button value="AVOD">AVOD (Ad-Supported Free)</Radio.Button>
              <Radio.Button value="TVOD">TVOD / Rent (Pay-Per-View)</Radio.Button>
              <Radio.Button value="SVOD">SVOD (Subscription)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {watchedMonetization === "TVOD" && (
            <Card size="small" title="Transactional Video On Demand (Rental) Settings">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="rentPrice" label="Rental Price (INR ₹)">
                    <InputNumber min={0} prefix="₹" style={{ width: "100%" }} />
                  </Form.Item>
                  <Space wrap size={4}>
                    {[49, 99, 149, 199].map((p) => (
                      <Button key={p} size="small" type={watchedRentPrice === p ? "primary" : "default"} onClick={() => form.setFieldValue("rentPrice", p)}>
                        ₹{p}
                      </Button>
                    ))}
                  </Space>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="validityHours" label="Rental Validity (Hours)">
                    <InputNumber min={1} suffix="Hours" style={{ width: "100%" }} />
                  </Form.Item>
                  <Space wrap size={4}>
                    {[
                      { h: 24, label: "24h" },
                      { h: 48, label: "48h" },
                      { h: 72, label: "72h" },
                      { h: 168, label: "7 Days" },
                    ].map((v) => (
                      <Button key={v.h} size="small" type={watchedValidity === v.h ? "primary" : "default"} onClick={() => form.setFieldValue("validityHours", v.h)}>
                        {v.label}
                      </Button>
                    ))}
                  </Space>
                </Col>
              </Row>
            </Card>
          )}
        </Card>

        {/* 05. DRM & REGIONAL RESTRICTIONS */}
        <Card
          id="sec-5"
          style={{ marginBottom: 16 }}
          title={<Space><Tag color="red">05</Tag><span>DRM &amp; Regional Restrictions</span></Space>}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="drmSystem" label="DRM Protection System">
                <Select
                  options={[
                    { value: "NONE", label: "None (Standard HLS)" },
                    { value: "WIDEVINE", label: "Google Widevine Modular L1/L3" },
                    { value: "FAIRPLAY", label: "Apple FairPlay Streaming (FPS)" },
                    { value: "MULTI_DRM", label: "Multi-DRM (Widevine + FairPlay + PlayReady)" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="geoRestrictions" label="Geo-Restriction Fencing">
                <Select
                  mode="multiple"
                  options={[
                    { value: "GLOBAL", label: "Global (All Countries Allowed)" },
                    { value: "IN", label: "India (IN)" },
                    { value: "US", label: "North America (US / CA)" },
                    { value: "EU", label: "European Union (EU)" },
                    { value: "APAC", label: "Asia-Pacific (APAC)" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 06. SEO & SKIP CHAPTER TIMESTAMPS */}
        <Card
          id="sec-6"
          style={{ marginBottom: 16 }}
          title={<Space><Tag color="red">06</Tag><span>SEO &amp; Skip Chapter Timestamps</span></Space>}
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="skipIntroStart" label="Skip Intro Start (HH:MM:SS)">
                <TimerPicker placeholder="00:01:15" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="skipIntroEnd" label="Skip Intro End (HH:MM:SS)">
                <TimerPicker placeholder="00:02:40" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="skipOutroStart" label="Skip Outro / Credits Start (HH:MM:SS)">
                <TimerPicker placeholder="02:35:10" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="seoKeywords" label="SEO Keywords (Comma Separated)">
                <Input placeholder="action, sci-fi, telugu movie 2026" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* STICKY BOTTOM SUBMIT FOOTER */}
        <Card
          size="small"
          style={{
            position: "sticky",
            bottom: 8,
            zIndex: 50,
            background: "rgba(22, 22, 34, 0.96)",
            borderColor: "#28283a",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <Space>
              <Tag color={watchedStatus === "PUBLISHED" ? "green" : watchedStatus === "SCHEDULED" ? "blue" : "orange"}>
                Status: {watchedStatus}
              </Tag>
              <Form.Item name="status" hidden><Input /></Form.Item>
            </Space>
            <Space wrap>
              <Button onClick={() => navigate("/admin/movies")}>Cancel</Button>
              <Button icon={<FileTextOutlined />} loading={saving} onClick={() => submitWithStatus("DRAFT")}>
                Save Draft
              </Button>
              <Button icon={<ClockCircleOutlined />} loading={saving} onClick={() => submitWithStatus("SCHEDULED")}>
                Schedule Publish
              </Button>
              <Button
                type="primary"
                danger
                icon={isEdit ? <SaveOutlined /> : <CloudUploadOutlined />}
                loading={saving}
                onClick={() => submitWithStatus("PUBLISHED")}
              >
                {isEdit ? "Update & Publish" : "Publish Now"}
              </Button>
            </Space>
          </div>
        </Card>
      </Form>

      <Modal
        title={`Add New ${quickAdd.kind || ""}`}
        open={quickAdd.open}
        onOk={handleQuickAddTaxonomy}
        onCancel={() => setQuickAdd({ open: false, value: "", code: "" })}
      >
        <Input
          placeholder="Name"
          value={quickAdd.value}
          onChange={(e) => setQuickAdd({ ...quickAdd, value: e.target.value })}
          style={{ marginBottom: 10 }}
        />
        {quickAdd.kind === "language" && (
          <Input
            placeholder="Language Code (e.g. te, hi, ta)"
            value={quickAdd.code}
            onChange={(e) => setQuickAdd({ ...quickAdd, code: e.target.value })}
          />
        )}
      </Modal>
    </div>
  );
};

export default MovieFormPage;
