import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  PlusOutlined,
  BankOutlined,
  BarChartOutlined,
  ReloadOutlined,
  UserOutlined,
  CreditCardOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  FireOutlined,
  SendOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  WifiOutlined,
  MessageOutlined,
  LaptopOutlined,
} from "@ant-design/icons";
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Tag,
  Progress,
  Table,
  Input,
  Avatar,
  Typography,
  Segmented,
  Empty,
  message,
} from "antd";
import { apiGet, apiPost, extractArray, USER_KEY } from "../../providers/api";

const { Title, Text } = Typography;

interface TrendPoint {
  label: string;
  revenue: number;
  users: number;
  watchHours: number;
  streams: number;
}

const DEFAULT_INFRA = [
  { serviceName: "PostgreSQL Database Engine", meta: "Connected • Port 5432 • Pooled", status: "Healthy", statusClass: "green" },
  { serviceName: "Redis Cache & Session Broker", meta: "Active • Port 6379 • Cluster Ready", status: "Healthy", statusClass: "green" },
  { serviceName: "Bunny.net Stream CDN", meta: "Global Edge Transcoding • Low Latency", status: "Operational", statusClass: "green" },
  { serviceName: "SSAI Dynamic Ad Engine", meta: "VAST 4.2 / VMAP Compliant Insertion", status: "Operational", statusClass: "green" },
];

const CHAT_ROOMS = [
  { id: "general", name: "General Ops" },
  { id: "producers", name: "Producer Ops" },
  { id: "tech", name: "DevOps" },
];

const DEVICE_COLORS = ["#00d2ff", "#1a4cd8", "#c725a3", "#00e676", "#ffab00"];

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d" | "12m">("7d");

  const [metrics, setMetrics] = useState<any>({
    totalUsers: 0,
    activeSubscribers: 0,
    monthlyRevenue: 0,
    totalContent: 0,
    pendingApprovals: 0,
    concurrentStreams: 0,
    storageUsedGb: 0,
    storageTotalGb: 100,
    avgCompletionRate: 0,
    dailyActiveUsers: 0,
    weeklyActiveUsers: 0,
    monthlyActiveUsers: 0,
    totalWatchHoursToday: 0,
    totalViews: 0,
    uniqueViews24h: 0,
  });

  const [trendsMap, setTrendsMap] = useState<Record<string, TrendPoint[]>>({});
  const [weeklyWatchHours, setWeeklyWatchHours] = useState<any[]>([]);
  const [portalEngagement, setPortalEngagement] = useState<any[]>([]);
  const [topTrending, setTopTrending] = useState<any[]>([]);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [deviceBreakdown, setDeviceBreakdown] = useState<any[]>([]);
  const [infra, setInfra] = useState<any[]>(DEFAULT_INFRA);

  // Depth intelligence
  const [arpu, setArpu] = useState(0);
  const [arppu, setArppu] = useState(0);
  const [revenueAttribution, setRevenueAttribution] = useState<any>({});
  const [subscriptionMetrics, setSubscriptionMetrics] = useState<any>({});
  const [paymentMetrics, setPaymentMetrics] = useState<any>({});
  const [engagementMetrics, setEngagementMetrics] = useState<any>({});
  const [funnelMetrics, setFunnelMetrics] = useState<any>({});
  const [geoMetrics, setGeoMetrics] = useState<any>({});

  // Ops Chat
  const [chatRoom, setChatRoom] = useState("general");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [d, live, chatRes] = await Promise.all([
        apiGet<any>("/admin/analytics/dashboard").catch(() => ({})),
        apiGet<any>("/admin/analytics/live").catch(() => ({})),
        apiGet<any>("/admin/dashboard/ops-chat").catch(() => []),
      ]);

      const data = d || {};
      setMetrics({
        totalUsers: data.totalUsers ?? data.total_users ?? 0,
        activeSubscribers: data.activeSubscribers ?? data.active_subscribers ?? 0,
        monthlyRevenue: Number(data.monthlyRevenue ?? data.total_revenue_inr ?? 0),
        totalContent: data.totalContent ?? data.total_titles ?? 0,
        pendingApprovals: data.pendingApprovals ?? data.pending_kyc_reviews ?? 0,
        concurrentStreams: live?.concurrentStreams ?? data.concurrentStreams ?? data.concurrent_streams ?? 0,
        storageUsedGb: Number(data.storageUsedGb ?? data.storage_used_gb ?? 0),
        storageTotalGb: Number(data.storageTotalGb ?? data.storage_total_gb ?? 100),
        avgCompletionRate: Number(data.avgCompletionRate ?? data.avg_completion_rate ?? 0),
        dailyActiveUsers: data.dailyActiveUsers ?? data.daily_active_users ?? 0,
        weeklyActiveUsers: data.weeklyActiveUsers ?? data.weekly_active_users ?? 0,
        monthlyActiveUsers: data.monthlyActiveUsers ?? data.monthly_active_users ?? 0,
        totalWatchHoursToday: Number(data.totalWatchHoursToday ?? data.total_watch_hours_today ?? 0),
        totalViews: data.totalViews ?? data.total_views ?? 0,
        uniqueViews24h: data.uniqueViews24h ?? data.unique_views_24h ?? 0,
      });

      if (data.timeSeriesTrends || data.time_series_trends) {
        setTrendsMap(data.timeSeriesTrends || data.time_series_trends);
      }
      if (Array.isArray(data.weeklyWatchHours || data.weekly_watch_hours)) {
        setWeeklyWatchHours(data.weeklyWatchHours || data.weekly_watch_hours);
      }
      if (Array.isArray(data.portalEngagement || data.portal_engagement)) {
        setPortalEngagement(data.portalEngagement || data.portal_engagement);
      }
      if (Array.isArray(data.deviceBreakdown || data.device_breakdown)) {
        setDeviceBreakdown(data.deviceBreakdown || data.device_breakdown);
      }
      const infraArr = data.infrastructureTelemetry || data.infrastructure_telemetry;
      if (Array.isArray(infraArr) && infraArr.length) {
        setInfra(
          infraArr.map((t: any) => ({
            serviceName: t.serviceName || t.service_name || t.name,
            meta: t.meta || t.description || t.details,
            status: t.status || "Operational",
            statusClass: t.statusClass || t.status_class || "green",
          }))
        );
      }

      const topArr = data.topContent || data.top_content || [];
      if (Array.isArray(topArr) && topArr.length) {
        setTopTrending(topArr);
      } else {
        const mv = await apiGet("/admin/movies?size=6").catch(() => []);
        setTopTrending(
          extractArray(mv).map((m: any) => ({
            title: m.title,
            contentType: m.contentType || "MOVIE",
            totalViews: m.viewCount || m.totalViews || 0,
            watchHours: m.watchHours ? Number(m.watchHours).toFixed(1) : "0",
            totalRevenue: m.totalRevenue || 0,
            rating: m.maturityRating || m.rating || "U/A 13+",
          }))
        );
      }

      setArpu(Number(data.arpu ?? 0));
      setArppu(Number(data.arppu ?? 0));
      setRevenueAttribution(data.revenueAttribution || data.revenue_attribution || {});
      setSubscriptionMetrics(data.subscriptionMetrics || data.subscription_metrics || {});
      setPaymentMetrics(data.paymentMetrics || data.payment_metrics || {});
      setEngagementMetrics(data.engagementMetrics || data.engagement_metrics || {});
      setFunnelMetrics(data.funnelMetrics || data.funnel_metrics || {});
      setGeoMetrics(data.geoMetrics || data.geo_metrics || {});

      setLiveStreams(Array.isArray(live?.activeStreams) ? live.activeStreams : []);
      setChatMessages(extractArray(chatRes));
    } catch (e: any) {
      message.error(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 45000);
    return () => clearInterval(timer);
  }, []);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    setSendingChat(true);
    try {
      let user: any = {};
      try {
        user = JSON.parse(localStorage.getItem(USER_KEY) || "{}");
      } catch {
        // ignore
      }
      await apiPost("/admin/dashboard/ops-chat", {
        room: chatRoom,
        message: chatInput.trim(),
        senderName: user?.fullName || user?.name || user?.email || "Admin",
      });
      setChatInput("");
      const chatRes = await apiGet("/admin/dashboard/ops-chat").catch(() => []);
      setChatMessages(extractArray(chatRes));
    } catch (e: any) {
      message.error(e.message || "Failed to send message");
    } finally {
      setSendingChat(false);
    }
  };

  const fmtCurrency = (v: number) =>
    `₹${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const currentTrends: TrendPoint[] =
    trendsMap[timeframe] ||
    trendsMap["7d"] || [
      { label: "Mon", revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: "Tue", revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: "Wed", revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: "Thu", revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: "Fri", revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: "Sat", revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: "Sun", revenue: metrics.monthlyRevenue, users: metrics.totalUsers, watchHours: metrics.totalWatchHoursToday, streams: metrics.concurrentStreams },
    ];

  const peakRev = Math.max(...currentTrends.map((p) => Number(p.revenue || 0)), 0);
  const peakUsers = Math.max(...currentTrends.map((p) => Number(p.users || 0)), 0);
  const avgWatch = currentTrends.length
    ? currentTrends.reduce((s, p) => s + Number(p.watchHours || 0), 0) / currentTrends.length
    : 0;

  const storagePct =
    metrics.storageTotalGb > 0
      ? Math.min(100, Math.round((metrics.storageUsedGb / metrics.storageTotalGb) * 100))
      : 0;

  const conversionPct = Math.round((metrics.activeSubscribers / Math.max(metrics.totalUsers, 1)) * 100);
  const filteredChat = chatMessages.filter((m) => !m.room || m.room === chatRoom);

  const deviceChartData = deviceBreakdown.map((d: any, i: number) => ({
    name: d.platform || d.device || `Device ${i + 1}`,
    value: Number(d.percentage || d.activeSessions || d.count || 0),
    count: Number(d.activeSessions || d.count || 0),
    color: d.color || DEVICE_COLORS[i % DEVICE_COLORS.length],
  }));

  return (
    <div>
      {/* 1. HEADER & QUICK BAR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <Tag color="blue" style={{ marginBottom: 4 }}>PLATFORM EXECUTIVE INTELLIGENCE &amp; TELEMETRY</Tag>
          <Title level={3} style={{ margin: "0 0 2px" }}>Executive Analytics Dashboard</Title>
          <Text type="secondary">
            Real-time revenue curves, streaming watch hours, platform growth, portal engagement &amp; infrastructure telemetry
          </Text>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/admin/movies/new")}
            style={{ background: "linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%)", border: "none" }}
          >
            Add New Content
          </Button>
          <Button icon={<BankOutlined />} onClick={() => navigate("/admin/payments")}>
            Payment &amp; TVOD History
          </Button>
          <Button icon={<BarChartOutlined />} onClick={() => navigate("/admin/analytics")}>
            Full BI Reports
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadDashboard}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* 2. 7 EXECUTIVE KPI CARDS */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Space style={{ marginBottom: 4 }}><UserOutlined style={{ color: "#00d2ff" }} /><Text type="secondary">Total Registered Users</Text></Space>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{Number(metrics.totalUsers).toLocaleString()}</div>
            <Text style={{ fontSize: 12, color: "#52c41a" }}>{metrics.dailyActiveUsers} active today</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Space style={{ marginBottom: 4 }}><CreditCardOutlined style={{ color: "#c725a3" }} /><Text type="secondary">Active Paid Subscribers</Text></Space>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{Number(metrics.activeSubscribers).toLocaleString()}</div>
            <Text style={{ fontSize: 12, color: "#52c41a" }}>{conversionPct}% conversion rate</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Space style={{ marginBottom: 4 }}><BankOutlined style={{ color: "#ffab00" }} /><Text type="secondary">Monthly Revenue (MRR)</Text></Space>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{fmtCurrency(metrics.monthlyRevenue)}</div>
            <Text style={{ fontSize: 12, color: "#52c41a" }}>ARPU ₹{arpu.toFixed(2)}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Space style={{ marginBottom: 4 }}><WifiOutlined style={{ color: "#00d2ff" }} /><Text type="secondary">Daily Active Users (DAU)</Text></Space>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{Number(metrics.dailyActiveUsers).toLocaleString()}</div>
            <Text style={{ fontSize: 12, color: "#52c41a" }}>{metrics.concurrentStreams} Active Live Streams</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card size="small">
            <Space style={{ marginBottom: 4 }}><EyeOutlined style={{ color: "#00e5ff" }} /><Text type="secondary">Total Platform Views</Text></Space>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{Number(metrics.totalViews).toLocaleString()}</div>
            <Text style={{ fontSize: 12, color: "#52c41a" }}>{Number(metrics.uniqueViews24h || 0).toLocaleString()} unique / 24h</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card size="small">
            <Space style={{ marginBottom: 4 }}><ClockCircleOutlined style={{ color: "#a855f7" }} /><Text type="secondary">Streaming Watch Time</Text></Space>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{metrics.totalWatchHoursToday} Hrs</div>
            <Text style={{ fontSize: 12, color: "#52c41a" }}>{metrics.avgCompletionRate}% Completion Rate</Text>
          </Card>
        </Col>
        <Col xs={24} sm={24} lg={8}>
          <Card size="small">
            <Space style={{ marginBottom: 4 }}><CloudServerOutlined style={{ color: "#c725a3" }} /><Text type="secondary">Bunny.net CDN &amp; Storage</Text></Space>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {metrics.storageUsedGb.toFixed(2)} GB / {metrics.storageTotalGb} GB
            </div>
            <Progress percent={storagePct} size="small" showInfo={false} />
          </Card>
        </Col>
      </Row>

      {/* 3. TWO-COLUMN EXECUTIVE LAYOUT */}
      <Row gutter={[16, 16]}>
        {/* LEFT COLUMN */}
        <Col xs={24} xl={16}>
          {/* GRAPH 1: Revenue & User Growth Trajectory */}
          <Card
            style={{ marginBottom: 16 }}
            title="Revenue & User Growth Trajectory"
            extra={
              <Segmented
                size="small"
                value={timeframe}
                onChange={(v) => setTimeframe(v as any)}
                options={[
                  { label: "7D", value: "7d" },
                  { label: "30D", value: "30d" },
                  { label: "90D", value: "90d" },
                  { label: "12M", value: "12m" },
                ]}
              />
            }
          >
            <Row gutter={12} style={{ marginBottom: 14 }}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>Peak Revenue ({timeframe.toUpperCase()})</Text>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#00d2ff" }}>{fmtCurrency(peakRev)}</div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>Peak Concurrent Viewers</Text>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#c725a3" }}>{peakUsers.toLocaleString()}</div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>Avg Daily Watch Hours</Text>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#52c41a" }}>{avgWatch.toFixed(1)}h</div>
              </Col>
            </Row>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={currentTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252538" />
                <XAxis dataKey="label" stroke="#8e8ea0" fontSize={11} />
                <YAxis stroke="#8e8ea0" fontSize={11} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#1a4cd8" fill="#1a4cd8" fillOpacity={0.28} />
                <Area type="monotone" dataKey="users" name="Active Users" stroke="#c725a3" fill="#c725a3" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* GRAPH 2: Weekly Streaming Traffic */}
          <Card style={{ marginBottom: 16 }} title="Weekly Streaming Traffic & Playback Consumption">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={
                  weeklyWatchHours.length > 0
                    ? weeklyWatchHours
                    : [
                        { day: "Mon", hours: 0, streams: 0 },
                        { day: "Tue", hours: 0, streams: 0 },
                        { day: "Wed", hours: 0, streams: 0 },
                        { day: "Thu", hours: 0, streams: 0 },
                        { day: "Fri", hours: 0, streams: 0 },
                        { day: "Sat", hours: 0, streams: 0 },
                        { day: "Sun", hours: metrics.totalWatchHoursToday, streams: metrics.concurrentStreams },
                      ]
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#252538" vertical={false} />
                <XAxis dataKey="day" stroke="#8e8ea0" fontSize={11} />
                <YAxis stroke="#8e8ea0" fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="hours" name="Watch Hours" fill="#00d2ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="streams" name="Streams" fill="#c725a3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* PORTAL ENGAGEMENT */}
          {portalEngagement.length > 0 && (
            <Card
              style={{ marginBottom: 16 }}
              title="Multi-Portal Ecosystem Engagement"
              extra={<Button type="link" size="small" onClick={() => navigate("/admin/movies")}>Manage Portals</Button>}
            >
              {portalEngagement.map((item: any, idx: number) => (
                <div key={idx} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <strong>{item.portal || item.name}</strong>
                    <Text type="secondary">{Number(item.views || 0).toLocaleString()} views ({item.percentage || 0}%)</Text>
                  </div>
                  <Progress percent={Number(item.percentage || 0)} strokeColor={item.color || "#00d2ff"} showInfo={false} size="small" />
                </div>
              ))}
            </Card>
          )}

          {/* LATEST & TRENDING CONTENT */}
          <Card
            style={{ marginBottom: 16 }}
            title={<Space><FireOutlined style={{ color: "#ff5722" }} /><span>Latest &amp; Trending Movies, Series &amp; Shows</span></Space>}
            extra={<Button type="link" size="small" onClick={() => navigate("/admin/movies")}>View Catalog</Button>}
          >
            <Table
              rowKey={(r, i) => String(r.id || r.title || i)}
              dataSource={topTrending}
              pagination={false}
              size="small"
              columns={[
                { title: "Title", dataIndex: "title", render: (v) => <strong>{v}</strong> },
                { title: "Type", dataIndex: "contentType", render: (v) => <Tag color="blue">{v || "MOVIE"}</Tag> },
                { title: "Views", dataIndex: "totalViews", render: (v) => Number(v || 0).toLocaleString() },
                { title: "Watch Hrs", dataIndex: "watchHours", render: (v) => `${v || 0} hrs` },
                { title: "Revenue", dataIndex: "totalRevenue", render: (v) => <Text style={{ color: "#52c41a" }}>{fmtCurrency(v)}</Text> },
                { title: "Rating", dataIndex: "rating", render: (v) => <Tag>{v || "U/A 13+"}</Tag> },
              ]}
            />
          </Card>

          {/* LIVE ACTIVE STREAMING VIEWERS */}
          <Card
            style={{ marginBottom: 16 }}
            title={<Space><PlayCircleOutlined style={{ color: "#52c41a" }} /><span>Live Active Streaming Viewers</span></Space>}
            extra={<Tag color="green">{metrics.concurrentStreams} Active Stream(s)</Tag>}
          >
            <Table
              rowKey={(r, i) => String(r.sessionId || i)}
              dataSource={liveStreams}
              pagination={false}
              size="small"
              locale={{ emptyText: "No concurrent video streams active right now." }}
              columns={[
                { title: "Title", dataIndex: "title", render: (v) => <strong>{v || "Active Stream"}</strong> },
                { title: "Viewer", dataIndex: "userName", render: (v) => v || "Guest Viewer" },
                { title: "Platform", dataIndex: "deviceType", render: (v) => <Tag color="blue">{v || "WEB"}</Tag> },
                {
                  title: "Progress",
                  render: (_: any, s: any) =>
                    `${Math.round((s.currentPositionSeconds || 0) / 60)}m / ${Math.round((s.totalDurationSeconds || 0) / 60)}m`,
                },
                { title: "Status", render: () => <Tag color="green">Streaming Live</Tag> },
              ]}
            />
          </Card>

          {/* REVENUE, SUBSCRIBER, PAYMENT & MARKET INTELLIGENCE */}
          <Card title="Revenue, Subscriber, Payment & Market Intelligence" style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={12} md={8}>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 11 }}>WAU (7d Active)</Text>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{Number(metrics.weeklyActiveUsers || 0).toLocaleString()}</div>
                  <Text style={{ fontSize: 11, color: "#00d2ff" }}>MAU: {Number(metrics.monthlyActiveUsers || 0).toLocaleString()}</Text>
                </Card>
              </Col>
              <Col xs={12} md={8}>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 11 }}>ARPU / ARPPU</Text>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>₹{arpu.toFixed(2)}</div>
                  <Text style={{ fontSize: 11, color: "#ffab00" }}>ARPPU: ₹{arppu.toFixed(2)}</Text>
                </Card>
              </Col>
              <Col xs={12} md={8}>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 11 }}>Payment Success Rate</Text>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{Number(paymentMetrics?.successRate || 0).toFixed(1)}%</div>
                  <Text style={{ fontSize: 11, color: "#52c41a" }}>Collected: ₹{Number(paymentMetrics?.totalCollected || 0).toLocaleString()}</Text>
                </Card>
              </Col>
              <Col xs={12} md={8}>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 11 }}>Subscription Churn</Text>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{Number(subscriptionMetrics?.churnRate || 0).toFixed(1)}%</div>
                  <Text style={{ fontSize: 11, color: "#c725a3" }}>Cancelled: {Number(subscriptionMetrics?.cancelled || 0).toLocaleString()}</Text>
                </Card>
              </Col>
              <Col xs={12} md={8}>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 11 }}>Retention (30d)</Text>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{Number(engagementMetrics?.retentionRate30d || 0).toFixed(1)}%</div>
                  <Text style={{ fontSize: 11, color: "#00d2ff" }}>Returning: {Number(engagementMetrics?.returningUsers30d || 0).toLocaleString()}</Text>
                </Card>
              </Col>
              <Col xs={12} md={8}>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 11 }}>Signup → Paid</Text>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{Number(funnelMetrics?.signupToPaidRate || 0).toFixed(1)}%</div>
                  <Text style={{ fontSize: 11, color: "#52c41a" }}>Paying: {Number(funnelMetrics?.payingUsers || 0).toLocaleString()}</Text>
                </Card>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Card size="small" title="Revenue Attribution (Monthly)">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>SVOD</span><strong>{fmtCurrency(revenueAttribution?.monthly?.svod)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>TVOD</span><strong>{fmtCurrency(revenueAttribution?.monthly?.tvod)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Ads</span><strong>{fmtCurrency(revenueAttribution?.monthly?.ads)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #202030", paddingTop: 6, color: "#52c41a" }}>
                    <span>Total Attributed</span><strong>{fmtCurrency(revenueAttribution?.monthly?.total)}</strong>
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title="Geo / Top Markets">
                  {Array.isArray(geoMetrics?.topMarkets) && geoMetrics.topMarkets.length > 0 ? (
                    geoMetrics.topMarkets.slice(0, 5).map((m: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                        <span>{m.market || "UNKNOWN"}</span>
                        <Text style={{ color: "#00d2ff" }}>{Number(m.eventsOrUsers || 0).toLocaleString()}</Text>
                      </div>
                    ))
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>No geo/market telemetry recorded yet.</Text>
                  )}
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* RIGHT COLUMN */}
        <Col xs={24} xl={8}>
          {/* DEVICE BREAKDOWN DONUT */}
          <Card
            style={{ marginBottom: 16 }}
            title={<Space><LaptopOutlined style={{ color: "#00d2ff" }} /><span>Device &amp; Platform Distribution</span></Space>}
          >
            {deviceChartData.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No device or platform sessions recorded yet"
              />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={deviceChartData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3}>
                      {deviceChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => `${val}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div>
                  {deviceChartData.map((d, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                      <Space size={6}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, display: "inline-block" }} />
                        <span>{d.name}</span>
                      </Space>
                      <Text type="secondary">{d.value}% ({d.count.toLocaleString()})</Text>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* ADMIN TEAM LIVE OPERATIONS CHAT */}
          <Card
            style={{ marginBottom: 16 }}
            title={<Space><MessageOutlined style={{ color: "#00d2ff" }} /><span>Admin Team Live Operations Chat</span></Space>}
            extra={<Tag color="green">Live</Tag>}
          >
            <Segmented
              block
              size="small"
              value={chatRoom}
              onChange={(v) => setChatRoom(String(v))}
              options={CHAT_ROOMS.map((r) => ({ label: r.name, value: r.id }))}
              style={{ marginBottom: 12 }}
            />
            <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 12, paddingRight: 4 }}>
              {filteredChat.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>No messages in this room yet. Say hello to the ops team!</Text>
              ) : (
                filteredChat.map((m: any, idx: number) => (
                  <div key={m.id || idx} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <Avatar size="small" style={{ backgroundColor: "#1a4cd8", flexShrink: 0 }}>
                      {(m.senderName || "A").charAt(0).toUpperCase()}
                    </Avatar>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11 }}>
                        <strong>{m.senderName || "Admin"}</strong>{" "}
                        <Text type="secondary" style={{ fontSize: 10 }}>{m.timestamp || (m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : "")}</Text>
                      </div>
                      <div style={{ fontSize: 12 }}>{m.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={sendChat}
                placeholder="Type a message to admins..."
              />
              <Button type="primary" icon={<SendOutlined />} loading={sendingChat} onClick={sendChat} />
            </Space.Compact>
          </Card>

          {/* INFRASTRUCTURE TELEMETRY */}
          <Card
            title="Infrastructure Telemetry & Status"
            extra={<Tag color="green">All Systems Operational</Tag>}
          >
            {infra.map((item: any, idx: number) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: idx < infra.length - 1 ? "1px solid #1e2230" : "none",
                }}
              >
                <Space align="start">
                  {item.statusClass === "amber" ? (
                    <WarningOutlined style={{ color: "#faad14", marginTop: 3 }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: "#52c41a", marginTop: 3 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.serviceName}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{item.meta}</Text>
                  </div>
                </Space>
                <Tag color={item.statusClass === "amber" ? "orange" : "green"}>{item.status}</Tag>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
