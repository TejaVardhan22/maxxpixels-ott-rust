import React, { useEffect, useMemo, useState } from "react";
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
  message,
  Typography,
  Card,
  Tabs,
  Row,
  Col,
  Statistic,
  Badge,
  Divider,
  Tooltip,
  Descriptions,
  Image,
  Alert,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  WifiOutlined,
  TrophyOutlined,
  CopyOutlined,
  EyeOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  StopOutlined,
  LinkOutlined,
  LockOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";
import { CalendarDateTimePicker } from "../../components/DateTimePickers";

const { Title, Text } = Typography;

const CHANNEL_CATEGORIES = [
  { value: "SPORTS", label: "Sports & Matches", color: "green" },
  { value: "GAMES", label: "Live Games & Esports", color: "purple" },
  { value: "NEWS", label: "News & Current Affairs", color: "blue" },
  { value: "ENTERTAINMENT", label: "Entertainment & TV", color: "magenta" },
  { value: "MOVIES", label: "Movies 24x7", color: "red" },
  { value: "MUSIC", label: "Music & Concerts", color: "cyan" },
  { value: "KIDS", label: "Kids & Cartoons", color: "gold" },
  { value: "DEVOTIONAL", label: "Devotional & Spiritual", color: "orange" },
  { value: "REGIONAL", label: "Regional", color: "geekblue" },
];

const ACCESS_OPTIONS = [
  { value: "FREE", label: "Free (All Users)" },
  { value: "SUBSCRIPTION", label: "Subscription Only" },
  { value: "PREMIUM", label: "Premium Tier" },
  { value: "PPV", label: "Pay-Per-View (PPV)" },
];

const EVENT_STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "Scheduled (Upcoming)" },
  { value: "LIVE", label: "LIVE NOW (On Air)" },
  { value: "ENDED", label: "Ended" },
  { value: "CANCELLED", label: "Cancelled" },
];

function getCategoryColor(cat?: string): string {
  const found = CHANNEL_CATEGORIES.find((c) => c.value === String(cat || "").toUpperCase());
  return found?.color || "default";
}

function getEmbedUrl(rawUrl: string): { kind: "iframe" | "video"; src: string } {
  const url = String(rawUrl || "").trim();
  if (!url) return { kind: "video", src: "" };

  // YouTube watch / live / youtu.be -> embed iframe
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (ytMatch?.[1]) {
    return { kind: "iframe", src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1` };
  }
  // Twitch / Bunny / Vimeo / generic embed iframe
  if (/player\.twitch\.tv|iframe\.mediadelivery\.net|player\.vimeo\.com|\/embed\//i.test(url)) {
    return { kind: "iframe", src: url };
  }
  return { kind: "video", src: url };
}

export const LiveTVPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("channels");

  // Data state
  const [channels, setChannels] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Filters
  const [channelSearch, setChannelSearch] = useState("");
  const [channelCategoryFilter, setChannelCategoryFilter] = useState<string>("ALL");
  const [channelStatusFilter, setChannelStatusFilter] = useState<string>("ALL");
  const [eventSearch, setEventSearch] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState<string>("ALL");

  // Channel Drawer
  const [channelDrawerOpen, setChannelDrawerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelForm] = Form.useForm();
  const channelDrmWatch = Form.useWatch("isDrmProtected", channelForm);

  // Event Drawer
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventForm] = Form.useForm();
  const eventPpvWatch = Form.useWatch("isPpv", eventForm);
  const eventAccessWatch = Form.useWatch("accessType", eventForm);

  // View & Stream Preview Modals
  const [previewStream, setPreviewStream] = useState<{ title: string; url: string; subtitle?: string } | null>(null);
  const [viewingItem, setViewingItem] = useState<{ kind: "channel" | "event"; data: any } | null>(null);

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const data = await apiGet("/admin/live/channels");
      setChannels(extractArray(data));
    } catch (e: any) {
      message.error(e?.message || "Failed to load live channels");
    } finally {
      setLoadingChannels(false);
    }
  };

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const data = await apiGet("/admin/live/events");
      setEvents(extractArray(data));
    } catch (e: any) {
      message.error(e?.message || "Failed to load live events");
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadLanguages = async () => {
    try {
      const data = await apiGet("/languages");
      setLanguages(extractArray(data));
    } catch {
      // non-fatal
    }
  };

  const loadAll = () => {
    loadChannels();
    loadEvents();
  };

  useEffect(() => {
    loadAll();
    loadLanguages();
  }, []);

  // Derived metrics
  const metrics = useMemo(() => {
    const liveChannelsOnAir = channels.filter((c) => c.isActive !== false && c.isLive !== false).length;
    const liveEventsNow = events.filter((e) => String(e.status || "").toUpperCase() === "LIVE").length;
    const upcomingEvents = events.filter((e) => String(e.status || "").toUpperCase() === "SCHEDULED").length;
    const ppvOrPremium =
      channels.filter((c) => c.isPremium || String(c.accessType || "").toUpperCase() === "PREMIUM").length +
      events.filter((e) => e.isPpv || String(e.accessType || "").toUpperCase() === "PPV").length;
    return {
      totalChannels: channels.length,
      liveChannelsOnAir,
      totalEvents: events.length,
      liveEventsNow,
      upcomingEvents,
      ppvOrPremium,
    };
  }, [channels, events]);

  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    return channels.filter((c) => {
      if (q) {
        const hay = `${c.name || ""} ${c.category || ""} ${c.languageCode || ""} ${c.streamUrl || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (channelCategoryFilter !== "ALL") {
        if (String(c.category || "").toUpperCase() !== channelCategoryFilter) return false;
      }
      if (channelStatusFilter === "LIVE" && !(c.isActive !== false && c.isLive !== false)) return false;
      if (channelStatusFilter === "OFFLINE" && c.isActive !== false && c.isLive !== false) return false;
      return true;
    });
  }, [channels, channelSearch, channelCategoryFilter, channelStatusFilter]);

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return events.filter((ev) => {
      if (q) {
        const hay = `${ev.title || ""} ${ev.description || ""} ${ev.streamUrl || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (eventStatusFilter !== "ALL") {
        if (String(ev.status || "").toUpperCase() !== eventStatusFilter) return false;
      }
      return true;
    });
  }, [events, eventSearch, eventStatusFilter]);

  const channelMap = useMemo(() => {
    const map = new Map<number, any>();
    channels.forEach((c) => map.set(Number(c.id), c));
    return map;
  }, [channels]);

  // --- Channel Handlers ---
  const openCreateChannel = (presetCategory?: string) => {
    setEditingChannel(null);
    channelForm.resetFields();
    channelForm.setFieldsValue({
      category: presetCategory || "SPORTS",
      accessType: "FREE",
      isActive: true,
      isLive: true,
      isPremium: false,
      isDrmProtected: false,
      displayOrder: channels.length + 1,
    });
    setChannelDrawerOpen(true);
  };

  const openEditChannel = (record: any) => {
    setEditingChannel(record);
    channelForm.resetFields();
    channelForm.setFieldsValue({
      ...record,
      isActive: record.isActive !== false,
      isLive: record.isLive !== false,
      isPremium: Boolean(record.isPremium),
      isDrmProtected: Boolean(record.isDrmProtected),
      accessType: record.accessType || (record.isPremium ? "PREMIUM" : "FREE"),
    });
    setChannelDrawerOpen(true);
  };

  const handleSaveChannel = async (values: any) => {
    setSavingChannel(true);
    try {
      const payload = {
        ...values,
        hlsStreamUrl: values.hlsStreamUrl || values.streamUrl,
        isPremium: values.isPremium || values.accessType === "PREMIUM",
      };
      if (editingChannel?.id) {
        await apiPut(`/admin/live/channels/${editingChannel.id}`, payload);
        message.success("Live channel updated");
      } else {
        await apiPost("/admin/live/channels", payload);
        message.success("Live channel created");
      }
      setChannelDrawerOpen(false);
      loadChannels();
    } catch (e: any) {
      message.error(e?.message || "Failed to save channel");
    } finally {
      setSavingChannel(false);
    }
  };

  const handleToggleChannelLive = async (record: any, nextLive: boolean) => {
    try {
      await apiPut(`/admin/live/channels/${record.id}`, { isLive: nextLive, isActive: nextLive });
      message.success(`${record.name} is now ${nextLive ? "ON AIR (LIVE)" : "OFFLINE"}`);
      loadChannels();
    } catch (e: any) {
      message.error(e?.message || "Failed to update channel status");
    }
  };

  const handleDeleteChannel = async (id: number) => {
    try {
      await apiDelete(`/admin/live/channels/${id}`);
      message.success("Channel deleted");
      loadChannels();
    } catch (e: any) {
      message.error(e?.message || "Delete failed");
    }
  };

  // --- Event / Match / Game Handlers ---
  const openCreateEvent = () => {
    setEditingEvent(null);
    eventForm.resetFields();
    const start = dayjs().add(15, "minute").format("YYYY-MM-DDTHH:mm");
    const end = dayjs().add(2, "hour").add(15, "minute").format("YYYY-MM-DDTHH:mm");
    eventForm.setFieldsValue({
      status: "SCHEDULED",
      accessType: "FREE",
      isPpv: false,
      ppvPrice: 0,
      isPremium: false,
      isDrmProtected: false,
      startTime: start,
      endTime: end,
    });
    setEventDrawerOpen(true);
  };

  const openEditEvent = (record: any) => {
    setEditingEvent(record);
    eventForm.resetFields();
    eventForm.setFieldsValue({
      ...record,
      startTime: record.startTime ? dayjs(record.startTime).format("YYYY-MM-DDTHH:mm") : "",
      endTime: record.endTime ? dayjs(record.endTime).format("YYYY-MM-DDTHH:mm") : "",
      status: record.status || "SCHEDULED",
      accessType: record.accessType || (record.isPpv ? "PPV" : record.isPremium ? "SUBSCRIPTION" : "FREE"),
      isPpv: Boolean(record.isPpv),
      isPremium: Boolean(record.isPremium),
      isDrmProtected: Boolean(record.isDrmProtected),
    });
    setEventDrawerOpen(true);
  };

  const handleSaveEvent = async (values: any) => {
    setSavingEvent(true);
    try {
      const payload = {
        ...values,
        hlsStreamUrl: values.hlsStreamUrl || values.streamUrl,
        isPpv: Boolean(values.isPpv || values.accessType === "PPV"),
        isPremium: Boolean(values.isPremium || values.accessType === "PREMIUM" || values.accessType === "SUBSCRIPTION"),
      };
      if (editingEvent?.id) {
        await apiPut(`/admin/live/events/${editingEvent.id}`, payload);
        message.success("Live event updated");
      } else {
        await apiPost("/admin/live/events", payload);
        message.success("Live event created");
      }
      setEventDrawerOpen(false);
      loadEvents();
    } catch (e: any) {
      message.error(e?.message || "Failed to save event");
    } finally {
      setSavingEvent(false);
    }
  };

  const handleEventStatusChange = async (record: any, status: string) => {
    try {
      await apiPut(`/admin/live/events/${record.id}`, { status });
      message.success(`"${record.title}" marked as ${status}`);
      loadEvents();
    } catch (e: any) {
      message.error(e?.message || "Failed to change status");
    }
  };

  const handleDeleteEvent = async (id: number) => {
    try {
      await apiDelete(`/admin/live/events/${id}`);
      message.success("Live event deleted");
      loadEvents();
    } catch (e: any) {
      message.error(e?.message || "Delete failed");
    }
  };

  const copyUrl = (url?: string) => {
    if (!url) return;
    navigator.clipboard?.writeText(url);
    message.success("Stream URL copied");
  };

  const renderEventStatusTag = (status?: string) => {
    const st = String(status || "SCHEDULED").toUpperCase();
    if (st === "LIVE") return <Tag color="red" icon={<WifiOutlined />}>LIVE NOW</Tag>;
    if (st === "SCHEDULED") return <Tag color="blue">SCHEDULED</Tag>;
    if (st === "CANCELLED") return <Tag color="orange">CANCELLED</Tag>;
    return <Tag color="default">ENDED</Tag>;
  };

  const previewInfo = useMemo(() => (previewStream ? getEmbedUrl(previewStream.url) : null), [previewStream]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Header & KPI Strip */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ background: "#141824", borderColor: "#1e2230" }}>
            <Statistic
              title="Live Channels"
              value={metrics.totalChannels}
              prefix={<WifiOutlined style={{ color: "#52c41a" }} />}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>({metrics.liveChannelsOnAir} On Air)</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ background: "#141824", borderColor: "#1e2230" }}>
            <Statistic
              title="Live Matches & Games Now"
              value={metrics.liveEventsNow}
              valueStyle={{ color: metrics.liveEventsNow > 0 ? "#ff4d4f" : undefined }}
              prefix={<ThunderboltOutlined style={{ color: "#ff4d4f" }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ background: "#141824", borderColor: "#1e2230" }}>
            <Statistic
              title="Scheduled Events & Games"
              value={metrics.upcomingEvents}
              prefix={<TrophyOutlined style={{ color: "#1677ff" }} />}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>/ {metrics.totalEvents} total</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ background: "#141824", borderColor: "#1e2230" }}>
            <Statistic
              title="Premium / PPV Streams"
              value={metrics.ppvOrPremium}
              prefix={<LockOutlined style={{ color: "#faad14" }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Studio Card */}
      <Card
        title={
          <Space>
            <WifiOutlined style={{ color: "#e50914", fontSize: 18 }} />
            <Title level={4} style={{ margin: 0 }}>Live Streaming, Channels, Sports & Games Studio</Title>
          </Space>
        }
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
            {activeTab === "channels" ? (
              <>
                <Button icon={<TrophyOutlined />} onClick={() => openCreateChannel("GAMES")}>
                  Add Live Game Channel
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateChannel("SPORTS")}>
                  Add Live Channel
                </Button>
              </>
            ) : (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateEvent}>
                Add Live Event / Match / Game
              </Button>
            )}
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "channels",
              label: (
                <Space>
                  <WifiOutlined />
                  <span>24×7 Live Channels</span>
                  <Badge count={metrics.totalChannels} showZero style={{ backgroundColor: "#1677ff" }} />
                </Space>
              ),
              children: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} md={10}>
                      <Input
                        prefix={<SearchOutlined />}
                        placeholder="Search channel name, category, language, stream URL..."
                        value={channelSearch}
                        onChange={(e) => setChannelSearch(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={12} md={7}>
                      <Select
                        value={channelCategoryFilter}
                        onChange={setChannelCategoryFilter}
                        style={{ width: "100%" }}
                        options={[
                          { value: "ALL", label: "All Categories (TV, Sports, Games...)" },
                          ...CHANNEL_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
                        ]}
                      />
                    </Col>
                    <Col xs={12} md={7}>
                      <Select
                        value={channelStatusFilter}
                        onChange={setChannelStatusFilter}
                        style={{ width: "100%" }}
                        options={[
                          { value: "ALL", label: "All Broadcast Statuses" },
                          { value: "LIVE", label: "On Air (LIVE)" },
                          { value: "OFFLINE", label: "Offline" },
                        ]}
                      />
                    </Col>
                  </Row>

                  <Table
                    rowKey="id"
                    loading={loadingChannels}
                    dataSource={filteredChannels}
                    pagination={{ pageSize: 12 }}
                    scroll={{ x: 960 }}
                    columns={[
                      {
                        title: "Channel",
                        dataIndex: "name",
                        width: 240,
                        render: (v, r) => (
                          <Space>
                            {r.logoUrl || r.posterUrl ? (
                              <Image
                                src={r.logoUrl || r.posterUrl}
                                width={42}
                                height={42}
                                style={{ objectFit: "cover", borderRadius: 8, background: "#1e2230" }}
                                preview={false}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 8,
                                  background: "#1e2230",
                                  display: "grid",
                                  placeItems: "center",
                                }}
                              >
                                <WifiOutlined style={{ color: "#8e8ea0" }} />
                              </div>
                            )}
                            <div>
                              <Text strong style={{ display: "block" }}>
                                {r.channelNumber ? `#${r.channelNumber} ` : ""}
                                {v || r.title}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {r.languageCode ? r.languageCode.toUpperCase() : "Multi-Lang"}
                                {r.isDrmProtected ? " • DRM" : ""}
                              </Text>
                            </div>
                          </Space>
                        ),
                      },
                      {
                        title: "Category",
                        dataIndex: "category",
                        width: 150,
                        render: (v) =>
                          v ? <Tag color={getCategoryColor(v)}>{String(v).toUpperCase()}</Tag> : <Tag>GENERAL</Tag>,
                      },
                      {
                        title: "Access",
                        dataIndex: "accessType",
                        width: 120,
                        render: (v, r) => {
                          const acc = String(v || (r.isPremium ? "PREMIUM" : "FREE")).toUpperCase();
                          const color = acc === "FREE" ? "green" : acc === "PPV" ? "purple" : "gold";
                          return <Tag color={color}>{acc}</Tag>;
                        },
                      },
                      {
                        title: "Stream URL",
                        dataIndex: "streamUrl",
                        ellipsis: true,
                        render: (v) => (
                          <Space size={4}>
                            <Text ellipsis style={{ maxWidth: 220 }} code>
                              {v || "-"}
                            </Text>
                            {v && (
                              <Tooltip title="Copy Stream URL">
                                <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copyUrl(v)} />
                              </Tooltip>
                            )}
                          </Space>
                        ),
                      },
                      {
                        title: "On Air",
                        width: 110,
                        render: (_, r) => {
                          const onAir = r.isActive !== false && r.isLive !== false;
                          return (
                            <Switch
                              checked={onAir}
                              checkedChildren="LIVE"
                              unCheckedChildren="OFF"
                              onChange={(checked) => handleToggleChannelLive(r, checked)}
                            />
                          );
                        },
                      },
                      {
                        title: "Actions",
                        width: 180,
                        fixed: "right",
                        render: (_, r) => (
                          <Space size={4}>
                            <Tooltip title="Preview Live Stream">
                              <Button
                                size="small"
                                type="primary"
                                ghost
                                icon={<PlayCircleOutlined />}
                                disabled={!r.streamUrl}
                                onClick={() =>
                                  setPreviewStream({
                                    title: r.name,
                                    url: r.streamUrl || r.hlsStreamUrl,
                                    subtitle: `${r.category || "Live Channel"} • ${r.accessType || "FREE"}`,
                                  })
                                }
                              />
                            </Tooltip>
                            <Tooltip title="View Details">
                              <Button
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => setViewingItem({ kind: "channel", data: r })}
                              />
                            </Tooltip>
                            <Tooltip title="Edit Channel">
                              <Button size="small" icon={<EditOutlined />} onClick={() => openEditChannel(r)} />
                            </Tooltip>
                            <Popconfirm title="Delete this live channel?" onConfirm={() => handleDeleteChannel(r.id)}>
                              <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: "events",
              label: (
                <Space>
                  <TrophyOutlined />
                  <span>Live Events, Matches & Games</span>
                  <Badge
                    count={metrics.liveEventsNow > 0 ? metrics.liveEventsNow : metrics.totalEvents}
                    showZero
                    style={{ backgroundColor: metrics.liveEventsNow > 0 ? "#ff4d4f" : "#722ed1" }}
                  />
                </Space>
              ),
              children: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} md={14}>
                      <Input
                        prefix={<SearchOutlined />}
                        placeholder="Search match, tournament, game, concert, stream URL..."
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} md={10}>
                      <Select
                        value={eventStatusFilter}
                        onChange={setEventStatusFilter}
                        style={{ width: "100%" }}
                        options={[
                          { value: "ALL", label: "All Event Statuses" },
                          ...EVENT_STATUS_OPTIONS,
                        ]}
                      />
                    </Col>
                  </Row>

                  <Table
                    rowKey="id"
                    loading={loadingEvents}
                    dataSource={filteredEvents}
                    pagination={{ pageSize: 12 }}
                    scroll={{ x: 1020 }}
                    columns={[
                      {
                        title: "Event / Match / Game",
                        dataIndex: "title",
                        width: 260,
                        render: (v, r) => {
                          const linkedChannel = r.channelId ? channelMap.get(Number(r.channelId)) : null;
                          return (
                            <Space>
                              {r.posterUrl ? (
                                <Image
                                  src={r.posterUrl}
                                  width={64}
                                  height={38}
                                  style={{ objectFit: "cover", borderRadius: 6 }}
                                  preview={false}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 64,
                                    height: 38,
                                    borderRadius: 6,
                                    background: "#1e2230",
                                    display: "grid",
                                    placeItems: "center",
                                  }}
                                >
                                  <TrophyOutlined style={{ color: "#faad14" }} />
                                </div>
                              )}
                              <div>
                                <Text strong style={{ display: "block" }}>{v}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {linkedChannel ? `Channel: ${linkedChannel.name}` : "Standalone Live Stream"}
                                </Text>
                              </div>
                            </Space>
                          );
                        },
                      },
                      {
                        title: "Status",
                        dataIndex: "status",
                        width: 120,
                        render: (v) => renderEventStatusTag(v),
                      },
                      {
                        title: "Schedule (Start → End)",
                        width: 210,
                        render: (_, r) => (
                          <div style={{ fontSize: 12 }}>
                            <div>Start: {r.startTime ? dayjs(r.startTime).format("DD MMM YYYY, HH:mm") : "-"}</div>
                            <Text type="secondary">
                              End: {r.endTime ? dayjs(r.endTime).format("DD MMM YYYY, HH:mm") : "-"}
                            </Text>
                          </div>
                        ),
                      },
                      {
                        title: "Monetization",
                        width: 130,
                        render: (_, r) => {
                          if (r.isPpv || String(r.accessType || "").toUpperCase() === "PPV") {
                            return <Tag color="purple">PPV ₹{Number(r.ppvPrice || 0).toFixed(0)}</Tag>;
                          }
                          const acc = String(r.accessType || (r.isPremium ? "SUBSCRIPTION" : "FREE")).toUpperCase();
                          return <Tag color={acc === "FREE" ? "green" : "gold"}>{acc}</Tag>;
                        },
                      },
                      {
                        title: "Broadcast Control",
                        width: 130,
                        render: (_, r) => {
                          const st = String(r.status || "SCHEDULED").toUpperCase();
                          if (st === "LIVE") {
                            return (
                              <Popconfirm
                                title="End this live stream now?"
                                onConfirm={() => handleEventStatusChange(r, "ENDED")}
                              >
                                <Button size="small" danger icon={<StopOutlined />}>
                                  End Live
                                </Button>
                              </Popconfirm>
                            );
                          }
                          return (
                            <Button
                              size="small"
                              type="primary"
                              style={{ background: "#e50914", borderColor: "#e50914" }}
                              icon={<ThunderboltOutlined />}
                              onClick={() => handleEventStatusChange(r, "LIVE")}
                            >
                              Go Live
                            </Button>
                          );
                        },
                      },
                      {
                        title: "Actions",
                        width: 170,
                        fixed: "right",
                        render: (_, r) => (
                          <Space size={4}>
                            <Tooltip title="Preview Stream">
                              <Button
                                size="small"
                                type="primary"
                                ghost
                                icon={<PlayCircleOutlined />}
                                disabled={!r.streamUrl && !r.hlsStreamUrl}
                                onClick={() =>
                                  setPreviewStream({
                                    title: r.title,
                                    url: r.streamUrl || r.hlsStreamUrl,
                                    subtitle: `Status: ${r.status || "SCHEDULED"}`,
                                  })
                                }
                              />
                            </Tooltip>
                            <Tooltip title="View Details">
                              <Button
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => setViewingItem({ kind: "event", data: r })}
                              />
                            </Tooltip>
                            <Tooltip title="Edit Event">
                              <Button size="small" icon={<EditOutlined />} onClick={() => openEditEvent(r)} />
                            </Tooltip>
                            <Popconfirm title="Delete this live event?" onConfirm={() => handleDeleteEvent(r.id)}>
                              <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* Create / Edit Live Channel Drawer */}
      <Drawer
        title={editingChannel ? `Edit Live Channel: ${editingChannel.name}` : "Add New Live Channel"}
        open={channelDrawerOpen}
        onClose={() => setChannelDrawerOpen(false)}
        width={680}
        extra={
          <Space>
            <Button onClick={() => setChannelDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={savingChannel} onClick={() => channelForm.submit()}>
              {editingChannel ? "Save Changes" : "Create Channel"}
            </Button>
          </Space>
        }
      >
        <Form form={channelForm} layout="vertical" onFinish={handleSaveChannel}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="name" label="Channel Name" rules={[{ required: true, message: "Enter channel name" }]}>
                <Input placeholder="e.g., Maxx Sports HD, Maxx Esports Live, News 24x7" />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="channelNumber" label="Channel #">
                <InputNumber min={1} style={{ width: "100%" }} placeholder="101" />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="displayOrder" label="Sort Order">
                <InputNumber min={0} style={{ width: "100%" }} placeholder="1" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Select category"
                  options={CHANNEL_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="languageCode" label="Language">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select language"
                  options={languages.map((l) => ({
                    value: l.code || l.slug || l.name,
                    label: l.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "12px 0" }}>Live Stream Source</Divider>
          <Form.Item
            name="streamUrl"
            label="Primary Stream URL (HLS .m3u8, DASH, YouTube Live, Twitch or Embed URL)"
            rules={[{ required: true, message: "Enter live stream URL" }]}
          >
            <Input
              placeholder="https://.../live/master.m3u8 or https://youtube.com/live/..."
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, height: "auto" }}
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    const url = channelForm.getFieldValue("streamUrl");
                    if (!url) {
                      message.warning("Enter a Stream URL first");
                      return;
                    }
                    setPreviewStream({
                      title: channelForm.getFieldValue("name") || "Stream Preview",
                      url,
                    });
                  }}
                >
                  Test
                </Button>
              }
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="hlsStreamUrl" label="Backup / Alternate HLS URL (Optional)">
                <Input placeholder="https://.../backup.m3u8" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="epgUrl" label="EPG XMLTV Guide URL (Optional)">
                <Input placeholder="https://.../epg.xml" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "12px 0" }}>Channel Artwork</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="logoUrl" label="Channel Logo (Square / Transparent)">
                <MediaUpload type="image" folder="logos" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="posterUrl" label="Channel Banner / Preview Poster (16:9)">
                <MediaUpload type="image" folder="banners" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "12px 0" }}>Access, DRM & Broadcast Controls</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="accessType" label="Access Tier">
                <Select options={ACCESS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Space size={24} style={{ marginTop: 30 }}>
                <Form.Item name="isLive" label="On Air (LIVE)" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch checkedChildren="LIVE" unCheckedChildren="OFF" />
                </Form.Item>
                <Form.Item name="isActive" label="Active" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <Form.Item name="isDrmProtected" label="DRM" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
              </Space>
            </Col>
          </Row>

          {channelDrmWatch && (
            <Form.Item name="drmLicenseUrl" label="DRM License Server URL">
              <Input placeholder="https://license.widevine.com/..." />
            </Form.Item>
          )}

          <Form.Item name="description" label="Channel Description">
            <Input.TextArea rows={3} placeholder="Describe what plays on this live channel..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Create / Edit Live Event / Match / Game Drawer */}
      <Drawer
        title={editingEvent ? `Edit Live Event: ${editingEvent.title}` : "Add Live Event / Match / Game Stream"}
        open={eventDrawerOpen}
        onClose={() => setEventDrawerOpen(false)}
        width={680}
        extra={
          <Space>
            <Button onClick={() => setEventDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={savingEvent} onClick={() => eventForm.submit()}>
              {editingEvent ? "Save Changes" : "Create Event"}
            </Button>
          </Space>
        }
      >
        <Form form={eventForm} layout="vertical" onFinish={handleSaveEvent}>
          <Form.Item
            name="title"
            label="Event / Match / Game Title"
            rules={[{ required: true, message: "Enter event title" }]}
          >
            <Input placeholder="e.g., IND vs AUS Live T20, BGMI Championship Finals, Live Concert" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="channelId" label="Broadcast on Channel (Optional)">
                <Select
                  allowClear
                  showSearch
                  placeholder="Standalone or pick a live channel"
                  options={channels.map((c) => ({
                    value: c.id,
                    label: `${c.channelNumber ? `#${c.channelNumber} ` : ""}${c.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Broadcast Status" rules={[{ required: true }]}>
                <Select options={EVENT_STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "12px 0" }}>Schedule (Date & Time)</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startTime" label="Start Date & Time" rules={[{ required: true }]}>
                <CalendarDateTimePicker placeholder="Select start date & time" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="End Date & Time" rules={[{ required: true }]}>
                <CalendarDateTimePicker placeholder="Select end date & time" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "12px 0" }}>Stream Source & Artwork</Divider>
          <Form.Item
            name="streamUrl"
            label="Live Stream URL (HLS .m3u8, YouTube Live, Twitch, Bunny Live or Embed)"
          >
            <Input
              placeholder="https://.../match/live.m3u8 or https://youtube.com/live/..."
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, height: "auto" }}
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    const url = eventForm.getFieldValue("streamUrl");
                    if (!url) {
                      message.warning("Enter a Stream URL first");
                      return;
                    }
                    setPreviewStream({
                      title: eventForm.getFieldValue("title") || "Event Stream Preview",
                      url,
                    });
                  }}
                >
                  Test
                </Button>
              }
            />
          </Form.Item>

          <Form.Item name="hlsStreamUrl" label="Backup HLS Stream URL (Optional)">
            <Input placeholder="https://.../backup.m3u8" />
          </Form.Item>

          <Form.Item name="posterUrl" label="Event / Match Banner (16:9 Ratio)">
            <MediaUpload type="image" folder="banners" />
          </Form.Item>

          <Divider style={{ margin: "12px 0" }}>Monetization & Security</Divider>
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="accessType" label="Access Tier">
                <Select options={ACCESS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="isPpv" label="Pay-Per-View (PPV)" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="isDrmProtected" label="DRM Protected" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          {(eventPpvWatch || eventAccessWatch === "PPV") && (
            <Form.Item name="ppvPrice" label="PPV Ticket Price (₹)">
              <InputNumber min={0} prefix="₹" style={{ width: 220 }} placeholder="99" />
            </Form.Item>
          )}

          <Form.Item name="description" label="Event / Match Details">
            <Input.TextArea rows={3} placeholder="Teams, tournament info, commentary languages, etc." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Stream Preview Modal */}
      <Modal
        title={
          <Space>
            <PlayCircleOutlined style={{ color: "#e50914" }} />
            <span>{previewStream?.title || "Live Stream Preview"}</span>
            {previewStream?.subtitle && <Tag color="red">{previewStream.subtitle}</Tag>}
          </Space>
        }
        open={Boolean(previewStream)}
        onCancel={() => setPreviewStream(null)}
        width={820}
        destroyOnClose
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={() => copyUrl(previewStream?.url)}>
            Copy URL
          </Button>,
          <Button
            key="open"
            icon={<LinkOutlined />}
            onClick={() => previewStream?.url && window.open(previewStream.url, "_blank", "noopener")}
          >
            Open in New Tab
          </Button>,
          <Button key="close" type="primary" onClick={() => setPreviewStream(null)}>
            Close
          </Button>,
        ]}
      >
        {previewInfo && (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <div
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                background: "#000",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {previewInfo.kind === "iframe" ? (
                <iframe
                  src={previewInfo.src}
                  title={previewStream?.title}
                  style={{ width: "100%", height: "100%", border: 0 }}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={previewInfo.src}
                  controls
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              )}
            </div>
            <Alert
              type="info"
              showIcon
              message={
                <span>
                  Stream URL: <Text code>{previewStream?.url}</Text>
                </span>
              }
              description="HLS (.m3u8) plays natively in Safari and mobile/TV apps. If Chrome blocks an HLS preview here, click 'Open in New Tab' or test in the web/mobile player."
            />
          </Space>
        )}
      </Modal>

      {/* View Details Drawer */}
      <Drawer
        title={
          viewingItem?.kind === "channel"
            ? `Channel Details: ${viewingItem.data?.name}`
            : `Event Details: ${viewingItem?.data?.title}`
        }
        open={Boolean(viewingItem)}
        onClose={() => setViewingItem(null)}
        width={560}
      >
        {viewingItem?.kind === "channel" && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {(viewingItem.data.posterUrl || viewingItem.data.logoUrl) && (
              <Image
                src={viewingItem.data.posterUrl || viewingItem.data.logoUrl}
                style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10 }}
              />
            )}
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Channel Name">{viewingItem.data.name}</Descriptions.Item>
              <Descriptions.Item label="Channel #">{viewingItem.data.channelNumber || "-"}</Descriptions.Item>
              <Descriptions.Item label="Category">{viewingItem.data.category || "GENERAL"}</Descriptions.Item>
              <Descriptions.Item label="Language">{viewingItem.data.languageCode || "-"}</Descriptions.Item>
              <Descriptions.Item label="Access">{viewingItem.data.accessType || "FREE"}</Descriptions.Item>
              <Descriptions.Item label="Status">
                {viewingItem.data.isActive !== false && viewingItem.data.isLive !== false ? (
                  <Tag color="green">ON AIR (LIVE)</Tag>
                ) : (
                  <Tag>OFFLINE</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Stream URL">
                <Text copyable code>{viewingItem.data.streamUrl || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="EPG URL">{viewingItem.data.epgUrl || "-"}</Descriptions.Item>
              <Descriptions.Item label="Description">{viewingItem.data.description || "-"}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
        {viewingItem?.kind === "event" && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {viewingItem.data.posterUrl && (
              <Image
                src={viewingItem.data.posterUrl}
                style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10 }}
              />
            )}
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Title">{viewingItem.data.title}</Descriptions.Item>
              <Descriptions.Item label="Status">{renderEventStatusTag(viewingItem.data.status)}</Descriptions.Item>
              <Descriptions.Item label="Start">
                {viewingItem.data.startTime ? dayjs(viewingItem.data.startTime).format("DD MMM YYYY, HH:mm") : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="End">
                {viewingItem.data.endTime ? dayjs(viewingItem.data.endTime).format("DD MMM YYYY, HH:mm") : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Access">
                {viewingItem.data.isPpv
                  ? `PPV ₹${Number(viewingItem.data.ppvPrice || 0).toFixed(0)}`
                  : viewingItem.data.accessType || "FREE"}
              </Descriptions.Item>
              <Descriptions.Item label="Stream URL">
                <Text copyable code>{viewingItem.data.streamUrl || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Description">{viewingItem.data.description || "-"}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Drawer>
    </Space>
  );
};
