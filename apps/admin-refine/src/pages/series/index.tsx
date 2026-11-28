import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Drawer,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Popconfirm,
  Row,
  Col,
  Tabs,
  Descriptions,
  Spin,
  Divider,
  Empty,
  message,
  Typography,
  Card,
  Image,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PlaySquareOutlined,
  EyeOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";
import { CalendarDatePicker, TimerPicker } from "../../components/DateTimePickers";

const { Title, Text } = Typography;

function parseDurationToSeconds(raw: string): number {
  if (!raw) return 0;
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return Number(s);
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => Number(p) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  return 0;
}

function secondsToHMS(secs?: number | null): string {
  if (!secs || secs <= 0) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export const SeriesPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Master data dropdowns (DB-driven, matching MovieFormPage)
  const [categories, setCategories] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [producers, setProducers] = useState<string[]>([]);

  // Create / Edit Series Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const watchedMonetization = Form.useWatch("monetization", form) || "SVOD";
  const watchedPoster = Form.useWatch("posterUrl", form) || "";
  const watchedBanner = Form.useWatch("bannerUrl", form) || "";

  // View Series Drawer
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);

  // Seasons & Episodes Manager Drawer
  const [episodesDrawerOpen, setEpisodesDrawerOpen] = useState(false);
  const [activeSeries, setActiveSeries] = useState<any>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [activeSeasonId, setActiveSeasonId] = useState<string>("");
  const [episodesMap, setEpisodesMap] = useState<Record<number, any[]>>({});
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // Add Season Modal
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [seasonForm] = Form.useForm();

  // Add / Edit Episode Modal
  const [epModalOpen, setEpModalOpen] = useState(false);
  const [editingEp, setEditingEp] = useState<any>(null);
  const [epSaving, setEpSaving] = useState(false);
  const [epForm] = Form.useForm();

  const loadMasterData = async () => {
    try {
      const [catRes, genRes, langRes, prodRes] = await Promise.all([
        apiGet("/admin/categories").catch(() => []),
        apiGet("/admin/genres").catch(() => []),
        apiGet("/admin/languages").catch(() => []),
        apiGet("/admin/producers").catch(() => []),
      ]);
      setCategories(extractArray(catRes).map((c: any) => c.name || c).filter(Boolean));
      setGenres(extractArray(genRes).map((g: any) => g.name || g).filter(Boolean));
      setLanguages(extractArray(langRes).map((l: any) => l.name || l).filter(Boolean));
      setProducers(extractArray(prodRes).map((p: any) => p.studioName || p.companyName || p.name).filter(Boolean));
    } catch {}
  };

  const loadSeries = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/admin/series?size=200");
      setRows(extractArray(data));
    } catch (e: any) {
      message.error(e?.message || "Failed to load web series");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    loadSeries();
  }, []);

  const openCreateSeries = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      status: "PUBLISHED",
      monetization: "SVOD",
      ageRating: "UA_13+",
      isPremium: true,
    });
    setDrawerOpen(true);
  };

  const openEditSeries = async (rec: any) => {
    setEditing(rec);
    setDrawerOpen(true);
    try {
      const detail = await apiGet<any>(`/admin/series/${rec.id}`);
      const d = detail || rec;
      form.setFieldsValue({
        title: d.title,
        description: d.description || "",
        language: d.originalLanguage || d.language || d.originalLanguageCode || "",
        categories: Array.isArray(d.categories) ? d.categories : [],
        genres: Array.isArray(d.genres) ? d.genres : [],
        producer: d.producer || d.productionHouse || "",
        ageRating: d.ageRating || "UA_13+",
        releaseDate: d.releaseDate ? String(d.releaseDate).slice(0, 10) : d.releaseYear ? `${d.releaseYear}-01-01` : "",
        monetization: d.monetization || d.accessType || "SVOD",
        rentPrice: d.rentPrice || 0,
        status: d.status || "PUBLISHED",
        isPremium: d.monetization !== "AVOD" && d.monetization !== "FREE",
        posterUrl: d.posterUrl || "",
        bannerUrl: d.bannerUrl || d.landscapeUrl || d.backdropUrl || "",
        trailerUrl: d.trailerUrl || "",
      });
    } catch {
      form.setFieldsValue(rec);
    }
  };

  const handleSaveSeries = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        contentType: "SERIES",
        backdropUrl: values.bannerUrl,
        bannerUrl: values.bannerUrl,
        landscapeUrl: values.bannerUrl,
        accessType: values.monetization,
        isPremium: values.monetization !== "AVOD" && values.monetization !== "FREE",
      };
      if (editing?.id) {
        await apiPut(`/admin/series/${editing.id}`, payload);
        message.success("Web Series updated");
        setDrawerOpen(false);
        loadSeries();
      } else {
        const created = await apiPost<any>("/admin/series", payload);
        message.success("Web Series created! Now add Seasons & Episodes.");
        setDrawerOpen(false);
        await loadSeries();
        if (created?.id) {
          openSeasonsManager(created);
        }
      }
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // --- Seasons & Episodes Manager ---

  const loadSeasonEpisodes = async (seriesId: number, seasonId: number) => {
    setEpisodesLoading(true);
    try {
      const eps = extractArray(await apiGet(`/admin/series/${seriesId}/seasons/${seasonId}/episodes`));
      setEpisodesMap((prev) => ({ ...prev, [seasonId]: eps }));
    } catch {
      setEpisodesMap((prev) => ({ ...prev, [seasonId]: [] }));
    } finally {
      setEpisodesLoading(false);
    }
  };

  const loadSeasons = async (series: any) => {
    if (!series?.id) return;
    setSeasonsLoading(true);
    try {
      const list = extractArray(await apiGet(`/admin/series/${series.id}/seasons`));
      setSeasons(list);
      if (list.length > 0) {
        const firstId = list[0].id;
        setActiveSeasonId(String(firstId));
        await loadSeasonEpisodes(series.id, firstId);
      } else {
        setActiveSeasonId("");
      }
    } catch (e: any) {
      message.error(e?.message || "Failed to load seasons");
    } finally {
      setSeasonsLoading(false);
    }
  };

  const openSeasonsManager = (series: any) => {
    setActiveSeries(series);
    setSeasons([]);
    setEpisodesMap({});
    setEpisodesDrawerOpen(true);
    loadSeasons(series);
  };

  const handleCreateSeason = async (vals: any) => {
    if (!activeSeries?.id) return;
    setSeasonSaving(true);
    try {
      const created = await apiPost<any>(`/admin/series/${activeSeries.id}/seasons`, vals);
      message.success(`Season ${created?.seasonNumber || vals.seasonNumber} added`);
      setSeasonModalOpen(false);
      await loadSeasons(activeSeries);
      if (created?.id) {
        setActiveSeasonId(String(created.id));
      }
    } catch (e: any) {
      message.error(e?.message || "Failed to create season");
    } finally {
      setSeasonSaving(false);
    }
  };

  const handleDeleteSeason = async (seasonId: number) => {
    if (!activeSeries?.id) return;
    try {
      await apiDelete(`/admin/series/${activeSeries.id}/seasons/${seasonId}`);
      message.success("Season deleted");
      loadSeasons(activeSeries);
    } catch (e: any) {
      message.error(e?.message || "Failed to delete season");
    }
  };

  const openAddEpisode = (seasonId: number) => {
    const existing = episodesMap[seasonId] || [];
    const nextNum = existing.length > 0 ? Math.max(...existing.map((e: any) => Number(e.episodeNumber || 0))) + 1 : 1;
    setEditingEp(null);
    epForm.resetFields();
    epForm.setFieldsValue({
      episodeNumber: nextNum,
      title: `Episode ${nextNum}`,
      status: "PUBLISHED",
      accessType: activeSeries?.monetization || "SVOD",
      isFreePreview: nextNum === 1,
    });
    setEpModalOpen(true);
  };

  const openEditEpisode = (ep: any) => {
    setEditingEp(ep);
    epForm.setFieldsValue({
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      description: ep.description || ep.synopsis || "",
      videoUrl: ep.videoUrl || "",
      thumbnailUrl: ep.thumbnailUrl || ep.stillImageUrl || "",
      durationTime: secondsToHMS(ep.durationSeconds || (ep.durationMinutes ? ep.durationMinutes * 60 : 0)),
      releaseDate: ep.releaseDate ? String(ep.releaseDate).slice(0, 10) : "",
      accessType: ep.accessType || "SVOD",
      isFreePreview: Boolean(ep.isFreePreview),
      status: ep.status || "PUBLISHED",
    });
    setEpModalOpen(true);
  };

  const handleSaveEpisode = async (vals: any) => {
    if (!activeSeries?.id || !activeSeasonId) return;
    const sid = Number(activeSeasonId);
    setEpSaving(true);
    try {
      const durSecs = parseDurationToSeconds(vals.durationTime || "");
      const payload = {
        episodeNumber: vals.episodeNumber,
        title: vals.title,
        description: vals.description || "",
        synopsis: vals.description || "",
        videoUrl: vals.videoUrl || "",
        hlsUrl: vals.videoUrl || "",
        thumbnailUrl: vals.thumbnailUrl || "",
        stillImageUrl: vals.thumbnailUrl || "",
        durationSeconds: durSecs || undefined,
        releaseDate: vals.releaseDate || undefined,
        accessType: vals.accessType || "SVOD",
        isFreePreview: Boolean(vals.isFreePreview),
        status: vals.status || "PUBLISHED",
      };
      if (editingEp?.id) {
        await apiPut(`/admin/series/${activeSeries.id}/seasons/${sid}/episodes/${editingEp.id}`, payload);
        message.success("Episode updated");
      } else {
        await apiPost(`/admin/series/${activeSeries.id}/seasons/${sid}/episodes`, payload);
        message.success("Episode added");
      }
      setEpModalOpen(false);
      loadSeasonEpisodes(activeSeries.id, sid);
    } catch (e: any) {
      message.error(e?.message || "Failed to save episode");
    } finally {
      setEpSaving(false);
    }
  };

  const handleDeleteEpisode = async (seasonId: number, epId: number) => {
    if (!activeSeries?.id) return;
    try {
      await apiDelete(`/admin/series/${activeSeries.id}/seasons/${seasonId}/episodes/${epId}`);
      message.success("Episode deleted");
      loadSeasonEpisodes(activeSeries.id, seasonId);
    } catch (e: any) {
      message.error(e?.message || "Failed to delete episode");
    }
  };

  const filteredRows = search.trim()
    ? rows.filter((r) => String(r.title || "").toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>Web Series, Seasons &amp; Episodes</Title>}
      extra={
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search series..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadSeries} />
          <Button type="primary" danger icon={<PlusOutlined />} onClick={openCreateSeries}>
            Add Web Series
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredRows}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: "No web series yet — click 'Add Web Series' to create one" }}
        columns={[
          {
            title: "Poster",
            dataIndex: "posterUrl",
            width: 72,
            render: (v) =>
              v ? <Image src={v} width={48} height={64} style={{ objectFit: "cover", borderRadius: 4 }} /> : "-",
          },
          {
            title: "Series Title",
            dataIndex: "title",
            render: (v, r) => (
              <div>
                <strong>{v}</strong>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {r.originalLanguageCode || r.language || "N/A"}
                  {r.releaseYear ? ` • ${r.releaseYear}` : ""}
                  {r.ageRating ? ` • ${r.ageRating}` : ""}
                </div>
              </div>
            ),
          },
          {
            title: "Access",
            dataIndex: "monetization",
            width: 110,
            render: (v, r) => (
              <Tag color={v === "TVOD" ? "gold" : v === "SVOD" ? "purple" : "green"}>{v || r.accessType || "SVOD"}</Tag>
            ),
          },
          {
            title: "Status",
            dataIndex: "status",
            width: 110,
            render: (v) => <Tag color={v === "PUBLISHED" ? "blue" : "default"}>{v || "DRAFT"}</Tag>,
          },
          {
            title: "Actions",
            width: 280,
            render: (_, r) => (
              <Space wrap>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlaySquareOutlined />}
                  onClick={() => openSeasonsManager(r)}
                >
                  Episodes
                </Button>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  title="View Details"
                  onClick={async () => {
                    setViewItem(r);
                    setViewOpen(true);
                    try {
                      const d = await apiGet<any>(`/admin/series/${r.id}`);
                      if (d) setViewItem({ ...r, ...d });
                    } catch {}
                  }}
                />
                <Button size="small" icon={<EditOutlined />} title="Edit Series" onClick={() => openEditSeries(r)} />
                <Popconfirm
                  title="Delete this series and its seasons?"
                  onConfirm={async () => {
                    await apiDelete(`/admin/series/${r.id}`);
                    message.success("Series deleted");
                    loadSeries();
                  }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} title="Delete" />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {/* 1. CREATE / EDIT WEB SERIES DRAWER */}
      <Drawer
        title={editing ? `Edit Web Series: ${editing.title}` : "Create New Web Series"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={680}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {editing ? "Save Changes" : "Create & Add Episodes"}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSaveSeries}>
          <Form.Item name="title" label="Series Title" rules={[{ required: true, message: "Title is required" }]}>
            <Input size="large" placeholder="e.g. Mirzapur / Panchayat" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="language" label="Original Language">
                <Select
                  showSearch
                  allowClear
                  options={languages.map((l) => ({ value: l, label: l }))}
                  placeholder="Select language"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="releaseDate" label="Release Date">
                <CalendarDatePicker placeholder="Select release date" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="categories" label="Categories">
                <Select mode="tags" options={categories.map((c) => ({ value: c, label: c }))} placeholder="Select categories" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="genres" label="Genres">
                <Select mode="tags" options={genres.map((g) => ({ value: g, label: g }))} placeholder="Select genres" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="producer" label="Producer / Production House">
                <Select allowClear showSearch options={producers.map((p) => ({ value: p, label: p }))} placeholder="Select producer" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="ageRating" label="Maturity Age Rating">
                <Select
                  options={[
                    { value: "U", label: "U (All Ages)" },
                    { value: "UA_7+", label: "U/A 7+" },
                    { value: "UA_13+", label: "U/A 13+" },
                    { value: "UA_16+", label: "U/A 16+" },
                    { value: "A", label: "A 18+" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="monetization" label="Monetization">
                <Select options={["SVOD", "AVOD", "TVOD", "FREE"].map((v) => ({ label: v, value: v }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="status" label="Status">
                <Select options={["PUBLISHED", "DRAFT", "SCHEDULED", "ARCHIVED"].map((v) => ({ label: v, value: v }))} />
              </Form.Item>
            </Col>
            {watchedMonetization === "TVOD" && (
              <Col xs={24} md={8}>
                <Form.Item name="rentPrice" label="Rent Price (₹)">
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Form.Item name="description" label="Synopsis / Description">
            <Input.TextArea rows={3} placeholder="Series storyline..." />
          </Form.Item>

          <Divider>Artwork &amp; Trailer (Bunny Storage / Bunny Stream / Google Drive)</Divider>

          <Form.Item name="posterUrl" label="Vertical Poster (2:3 Ratio)">
            <MediaUpload type="image" folder="posters" />
          </Form.Item>
          {watchedPoster && <Image src={watchedPoster} width={90} height={125} style={{ objectFit: "cover", borderRadius: 6, marginBottom: 12 }} />}

          <Form.Item name="bannerUrl" label="Landscape Banner (16:9 Ratio)">
            <MediaUpload type="image" folder="banners" />
          </Form.Item>
          {watchedBanner && <Image src={watchedBanner} width={220} height={124} style={{ objectFit: "cover", borderRadius: 6, marginBottom: 12 }} />}

          <Form.Item name="trailerUrl" label="Series Trailer (Bunny Stream / Drive)">
            <MediaUpload type="video" folder="trailers" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 2. SEASONS & EPISODES STUDIO DRAWER */}
      <Drawer
        title={
          <Space>
            <PlaySquareOutlined style={{ color: "#1677ff" }} />
            <span>Seasons &amp; Episodes — {activeSeries?.title || "Web Series"}</span>
          </Space>
        }
        open={episodesDrawerOpen}
        onClose={() => setEpisodesDrawerOpen(false)}
        width={900}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              const nextNum =
                seasons.length > 0 ? Math.max(...seasons.map((s: any) => Number(s.seasonNumber || 0))) + 1 : 1;
              seasonForm.resetFields();
              seasonForm.setFieldsValue({ seasonNumber: nextNum, title: `Season ${nextNum}` });
              setSeasonModalOpen(true);
            }}
          >
            Add Season
          </Button>
        }
      >
        <Spin spinning={seasonsLoading}>
          {seasons.length === 0 ? (
            <Empty description="No seasons yet. Click 'Add Season' to create Season 1 and start adding episodes." />
          ) : (
            <Tabs
              activeKey={activeSeasonId}
              onChange={(key) => {
                setActiveSeasonId(key);
                if (activeSeries?.id) loadSeasonEpisodes(activeSeries.id, Number(key));
              }}
              items={seasons.map((season: any) => {
                const eps = episodesMap[season.id] || [];
                return {
                  key: String(season.id),
                  label: `S${season.seasonNumber}: ${season.title || `Season ${season.seasonNumber}`} (${eps.length})`,
                  children: (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                        <Space>
                          <Tag color="blue">Season {season.seasonNumber}</Tag>
                          {season.releaseDate && <Text type="secondary">Release: {String(season.releaseDate).slice(0, 10)}</Text>}
                        </Space>
                        <Space>
                          <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddEpisode(season.id)}>
                            Add Episode
                          </Button>
                          <Popconfirm title="Delete this season and all its episodes?" onConfirm={() => handleDeleteSeason(season.id)}>
                            <Button danger icon={<DeleteOutlined />}>Delete Season</Button>
                          </Popconfirm>
                        </Space>
                      </div>

                      <Table
                        rowKey="id"
                        loading={episodesLoading}
                        dataSource={eps}
                        size="small"
                        pagination={false}
                        locale={{ emptyText: "No episodes in this season yet — click 'Add Episode'" }}
                        columns={[
                          {
                            title: "Ep #",
                            dataIndex: "episodeNumber",
                            width: 65,
                            render: (v) => <Tag color="geekblue">E{v}</Tag>,
                          },
                          {
                            title: "Still",
                            width: 84,
                            render: (_, ep) => {
                              const img = ep.thumbnailUrl || ep.stillImageUrl;
                              return img ? (
                                <Image src={img} width={68} height={40} style={{ objectFit: "cover", borderRadius: 4 }} />
                              ) : (
                                "-"
                              );
                            },
                          },
                          {
                            title: "Episode",
                            dataIndex: "title",
                            render: (v, ep) => (
                              <div>
                                <strong>{v}</strong>
                                <div style={{ fontSize: 11, opacity: 0.7 }}>
                                  {ep.videoUrl ? (
                                    <Tag color="green" icon={<VideoCameraOutlined />}>Video Linked</Tag>
                                  ) : (
                                    <Tag color="orange">No Video</Tag>
                                  )}
                                  {ep.isFreePreview && <Tag color="cyan">Free Preview</Tag>}
                                </div>
                              </div>
                            ),
                          },
                          {
                            title: "Duration",
                            width: 95,
                            render: (_, ep) =>
                              secondsToHMS(ep.durationSeconds || (ep.durationMinutes ? ep.durationMinutes * 60 : 0)) || "-",
                          },
                          {
                            title: "Status",
                            dataIndex: "status",
                            width: 100,
                            render: (v) => <Tag color={v === "PUBLISHED" ? "blue" : "default"}>{v || "PUBLISHED"}</Tag>,
                          },
                          {
                            title: "Actions",
                            width: 110,
                            render: (_, ep) => (
                              <Space>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openEditEpisode(ep)} />
                                <Popconfirm
                                  title="Delete episode?"
                                  onConfirm={() => handleDeleteEpisode(season.id, ep.id)}
                                >
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />
                    </div>
                  ),
                };
              })}
            />
          )}
        </Spin>
      </Drawer>

      {/* 3. ADD SEASON MODAL */}
      <Modal
        title="Add New Season"
        open={seasonModalOpen}
        onCancel={() => setSeasonModalOpen(false)}
        onOk={() => seasonForm.submit()}
        confirmLoading={seasonSaving}
      >
        <Form form={seasonForm} layout="vertical" onFinish={handleCreateSeason}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="seasonNumber" label="Season #" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="title" label="Season Title" rules={[{ required: true }]}>
                <Input placeholder="e.g. Season 1" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="releaseDate" label="Release Date">
            <CalendarDatePicker placeholder="Select season release date" />
          </Form.Item>
          <Form.Item name="description" label="Synopsis">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="posterUrl" label="Season Poster (Optional)">
            <MediaUpload type="image" folder="posters" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 4. ADD / EDIT EPISODE MODAL */}
      <Modal
        title={editingEp ? `Edit Episode E${editingEp.episodeNumber}` : "Add New Episode"}
        open={epModalOpen}
        onCancel={() => setEpModalOpen(false)}
        onOk={() => epForm.submit()}
        confirmLoading={epSaving}
        width={640}
      >
        <Form form={epForm} layout="vertical" onFinish={handleSaveEpisode}>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="episodeNumber" label="Episode #" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item name="title" label="Episode Title" rules={[{ required: true }]}>
                <Input placeholder="e.g. Pilot / The Beginning" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="videoUrl"
            label="Episode Video (Upload to Bunny Stream, Google Drive, or HLS URL)"
            rules={[{ required: true, message: "Upload or link the episode video" }]}
          >
            <MediaUpload type="video" folder="episodes" placeholder="Upload video, import from Drive, or paste .m3u8 URL" />
          </Form.Item>

          <Form.Item name="thumbnailUrl" label="Episode Thumbnail / Still (16:9 Image)">
            <MediaUpload type="image" folder="posters" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="durationTime" label="Duration (HH:MM:SS)">
                <TimerPicker placeholder="00:42:00" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="releaseDate" label="Release Date">
                <CalendarDatePicker placeholder="Select date" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select options={["PUBLISHED", "DRAFT"].map((v) => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="accessType" label="Access">
                <Select options={["SVOD", "AVOD", "FREE"].map((v) => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isFreePreview" label="Free Preview Episode (Watch without subscription)" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Episode Synopsis">
            <Input.TextArea rows={2} placeholder="Short episode summary..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 5. VIEW SERIES DETAILS DRAWER */}
      <Drawer
        title={viewItem?.title || "Series Details"}
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        width={600}
        extra={
          viewItem?.id && (
            <Button
              type="primary"
              icon={<PlaySquareOutlined />}
              onClick={() => {
                setViewOpen(false);
                openSeasonsManager(viewItem);
              }}
            >
              Manage Seasons &amp; Episodes
            </Button>
          )
        }
      >
        {viewItem && (
          <div>
            <Space align="start" size={14} style={{ marginBottom: 16 }}>
              {viewItem.posterUrl && <Image src={viewItem.posterUrl} width={100} height={140} style={{ objectFit: "cover", borderRadius: 6 }} />}
              {(viewItem.bannerUrl || viewItem.landscapeUrl || viewItem.backdropUrl) && (
                <Image
                  src={viewItem.bannerUrl || viewItem.landscapeUrl || viewItem.backdropUrl}
                  width={240}
                  height={140}
                  style={{ objectFit: "cover", borderRadius: 6 }}
                />
              )}
            </Space>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="ID">{viewItem.id}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color="blue">{viewItem.status || "DRAFT"}</Tag></Descriptions.Item>
              <Descriptions.Item label="Language">{viewItem.originalLanguage || viewItem.language || "-"}</Descriptions.Item>
              <Descriptions.Item label="Access"><Tag color="purple">{viewItem.monetization || "SVOD"}</Tag></Descriptions.Item>
              <Descriptions.Item label="Age Rating">{viewItem.ageRating || "-"}</Descriptions.Item>
              <Descriptions.Item label="Release Date">{viewItem.releaseDate ? String(viewItem.releaseDate).slice(0, 10) : "-"}</Descriptions.Item>
              <Descriptions.Item label="Producer" span={2}>{viewItem.producer || viewItem.productionHouse || "-"}</Descriptions.Item>
            </Descriptions>
            {viewItem.description && (
              <>
                <Divider style={{ margin: "12px 0" }} />
                <Typography.Paragraph>{viewItem.description}</Typography.Paragraph>
              </>
            )}
          </div>
        )}
      </Drawer>
    </Card>
  );
};
