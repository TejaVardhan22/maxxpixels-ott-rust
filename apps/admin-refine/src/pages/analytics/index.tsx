import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Segmented,
  Progress,
  Switch,
  Badge,
  Typography,
  Divider,
  Empty,
  message,
} from "antd";
import {
  BarChartOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  DollarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  DesktopOutlined,
  FundOutlined,
  HourglassOutlined,
} from "@ant-design/icons";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { apiGet } from "../../providers/api";

const { Title, Text } = Typography;

type TimeframeKey = "7d" | "30d" | "90d" | "ytd";

const TIMEFRAME_LABELS: Record<TimeframeKey, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  ytd: "Year to Date (YTD)",
};

function escapeCsv(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtMoney(v: unknown, digits = 2): string {
  return `₹${Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export const AnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("30d");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [analytics, setAnalytics] = useState<any>({});
  const [realtime, setRealtime] = useState<any>({});

  const loadData = async (tf: TimeframeKey = timeframe, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ov, rt] = await Promise.all([
        apiGet(`/admin/analytics?timeframe=${tf}`).catch(() => ({})),
        apiGet("/admin/analytics/realtime").catch(() => ({})),
      ]);
      setAnalytics(ov || {});
      setRealtime(rt || {});
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: any) {
      if (!silent) message.error(e.message || "Failed to load analytics");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(timeframe);
  }, [timeframe]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => loadData(timeframe, true), 15000);
    return () => clearInterval(timer);
  }, [autoRefresh, timeframe]);

  const trendKey = timeframe === "ytd" ? "12m" : timeframe;
  const chartPoints: any[] = useMemo(() => {
    const trends = analytics?.timeSeriesTrends || {};
    const pts = trends[trendKey] || trends["30d"] || trends["7d"] || [];
    return Array.isArray(pts) ? pts : [];
  }, [analytics, trendKey]);

  const deviceBreakdown: any[] = Array.isArray(analytics?.deviceBreakdown) ? analytics.deviceBreakdown : [];
  const topContent: any[] = Array.isArray(analytics?.topContent) ? analytics.topContent : [];
  const activeStreams: any[] = Array.isArray(realtime?.activeStreams)
    ? realtime.activeStreams
    : Array.isArray(realtime?.streams)
    ? realtime.streams
    : [];

  const revAttr = analytics?.revenueAttribution || {};
  const subM = analytics?.subscriptionMetrics || {};
  const payM = analytics?.paymentMetrics || {};
  const funnelM = analytics?.funnelMetrics || {};
  const geoM = analytics?.geoMetrics || {};
  const engM = analytics?.engagementMetrics || {};
  const contentEng = analytics?.contentEngagement || {};

  const concurrentStreams = realtime?.concurrentStreams ?? analytics?.concurrentStreams ?? activeStreams.length;
  const uniqueViews24h = realtime?.uniqueViews24h ?? analytics?.uniqueViews24h ?? 0;

  const exportCsv = () => {
    const a = analytics || {};
    const rows: string[][] = [];
    const push = (sec: string, k: string, v: unknown) => rows.push([sec, k, String(v ?? "")]);

    push("Summary", "Timeframe", TIMEFRAME_LABELS[timeframe]);
    push("Summary", "Total Users", a.totalUsers || 0);
    push("Summary", "Active Subscribers", a.activeSubscribers || 0);
    push("Summary", "DAU", a.dailyActiveUsers || 0);
    push("Summary", "WAU", a.weeklyActiveUsers || 0);
    push("Summary", "MAU", a.monthlyActiveUsers || 0);
    push("Summary", "Monthly Revenue (INR)", a.monthlyRevenue || 0);
    push("Summary", "ARPU (INR)", a.arpu || 0);
    push("Summary", "ARPPU (INR)", a.arppu || 0);
    push("Summary", "Watch Hours Today", a.totalWatchHoursToday || 0);
    push("Summary", "Avg Completion Rate (%)", a.avgCompletionRate || 0);
    push("Summary", "Concurrent Streams", concurrentStreams);

    rows.push([]);
    rows.push(["Trend", "Label", "Revenue", "Users", "WatchHours", "Streams"]);
    for (const p of chartPoints) {
      rows.push(["Trend", p.label, String(p.revenue ?? 0), String(p.users ?? 0), String(p.watchHours ?? 0), String(p.streams ?? 0)]);
    }

    rows.push([]);
    rows.push(["Device", "Platform", "Percentage", "ActiveSessions"]);
    for (const d of deviceBreakdown) {
      rows.push(["Device", d.platform, String(d.percentage ?? 0), String(d.activeSessions ?? 0)]);
    }

    rows.push([]);
    rows.push(["TopContent", "Title", "Type", "TotalViews", "UniqueViews", "WatchHours", "TVODRevenue", "AdsEligible"]);
    for (const c of topContent) {
      rows.push([
        "TopContent",
        c.title || "",
        c.contentType || "",
        String(c.totalViews ?? 0),
        String(c.uniqueViews ?? 0),
        String(c.watchHours ?? 0),
        String(c.totalRevenue ?? 0),
        c.adsEligible ? "YES" : "NO",
      ]);
    }

    const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `maxxpixels-analytics-${timeframe}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.success("CSV analytics report downloaded");
  };

  const exportPrintablePdf = () => {
    const a = analytics || {};
    const trendRows = chartPoints
      .map(
        (p) =>
          `<tr><td>${escapeHtml(p.label)}</td><td>${fmtMoney(p.revenue)}</td><td>${p.users || 0}</td><td>${p.watchHours || 0}</td><td>${p.streams || 0}</td></tr>`
      )
      .join("");
    const contentRows = topContent
      .map(
        (c, i) =>
          `<tr><td>#${i + 1}</td><td>${escapeHtml(c.title)}</td><td>${escapeHtml(c.contentType)}</td><td>${c.totalViews || 0}</td><td>${c.uniqueViews || 0}</td><td>${c.watchHours || 0}h</td><td>${fmtMoney(c.totalRevenue)}</td></tr>`
      )
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>MaxxPixels Analytics Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1,h2{margin:0 0 8px} p{margin:0 0 16px;color:#555}
        table{width:100%;border-collapse:collapse;margin:10px 0 22px}
        th,td{border:1px solid #ddd;padding:7px;font-size:12px;text-align:left}
        th{background:#f5f5f5} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}
        .card{border:1px solid #ddd;padding:10px;border-radius:6px} .label{font-size:11px;color:#666} .val{font-size:16px;font-weight:700}
      </style></head><body>
      <h1>MaxxPixels Platform Analytics Report</h1>
      <p>Timeframe: ${escapeHtml(TIMEFRAME_LABELS[timeframe])} • Generated: ${new Date().toLocaleString()}</p>
      <div class="grid">
        <div class="card"><div class="label">Monthly Revenue (MRR)</div><div class="val">${fmtMoney(a.monthlyRevenue)}</div></div>
        <div class="card"><div class="label">ARPU / ARPPU</div><div class="val">${fmtMoney(a.arpu)} / ${fmtMoney(a.arppu)}</div></div>
        <div class="card"><div class="label">DAU / WAU / MAU</div><div class="val">${a.dailyActiveUsers || 0} / ${a.weeklyActiveUsers || 0} / ${a.monthlyActiveUsers || 0}</div></div>
        <div class="card"><div class="label">Live Concurrent Streams</div><div class="val">${concurrentStreams}</div></div>
        <div class="card"><div class="label">Churn / 30d Retention</div><div class="val">${Number(subM.churnRate || 0).toFixed(1)}% / ${Number(engM.retentionRate30d || 0).toFixed(1)}%</div></div>
        <div class="card"><div class="label">Payment Success Rate</div><div class="val">${Number(payM.successRate || 0).toFixed(1)}%</div></div>
      </div>
      <h2>Trend (${escapeHtml(trendKey.toUpperCase())})</h2>
      <table><thead><tr><th>Label</th><th>Revenue</th><th>Users</th><th>Watch Hours</th><th>Streams</th></tr></thead><tbody>${trendRows || '<tr><td colspan="5">No data</td></tr>'}</tbody></table>
      <h2>Top Performing Content</h2>
      <table><thead><tr><th>Rank</th><th>Title</th><th>Type</th><th>Views</th><th>Unique</th><th>Watch Hours</th><th>TVOD Revenue</th></tr></thead><tbody>${contentRows || '<tr><td colspan="7">No data</td></tr>'}</tbody></table>
      <script>window.onload=()=>window.print();</script>
      </body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      message.info("Popup blocked — please allow popups to open the printable PDF report.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div>
      {/* 1. EXECUTIVE HEADER & EXPORTS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <Tag color="cyan" style={{ marginBottom: 4 }}>
            <BarChartOutlined /> BUSINESS INTELLIGENCE &amp; PLATFORM TELEMETRY
          </Tag>
          <Title level={3} style={{ margin: "0 0 2px" }}>
            Platform Insights, Performance &amp; Revenue Analytics
          </Title>
          <Text type="secondary">
            DAU/WAU/MAU trends, watch time completion, device telemetry, top content leaderboards &amp; financial intelligence
            {lastUpdated ? ` • Updated ${lastUpdated}` : ""}
          </Text>
        </div>
        <Space wrap>
          <Space size={6}>
            <Badge status={autoRefresh ? "processing" : "default"} />
            <Text style={{ fontSize: 12 }}>Live 15s</Text>
            <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
          </Space>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>
            Export CSV
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={exportPrintablePdf}>
            Export PDF
          </Button>
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => loadData(timeframe)}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* 2. 5 EXECUTIVE KPI CARDS */}
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={4} xl={4} style={{ flex: "1 1 200px" }}>
          <Card size="small">
            <Statistic
              title="Live Active Streams"
              value={concurrentStreams}
              prefix={<PlayCircleOutlined style={{ color: "#13c2c2" }} />}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {uniqueViews24h.toLocaleString()} unique views / 24h
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5} style={{ flex: "1 1 200px" }}>
          <Card size="small">
            <Statistic
              title="Monthly Revenue (MRR)"
              value={analytics.monthlyRevenue ?? 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: "#faad14" }} />}
              formatter={(v) => fmtMoney(v)}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {analytics.activeSubscribers ?? 0} active subscribers
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5} style={{ flex: "1 1 200px" }}>
          <Card size="small">
            <Statistic
              title="Daily Active Users (DAU)"
              value={analytics.dailyActiveUsers ?? 0}
              prefix={<UserOutlined style={{ color: "#1677ff" }} />}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              Total registered: {(analytics.totalUsers ?? 0).toLocaleString()}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5} style={{ flex: "1 1 200px" }}>
          <Card size="small">
            <Statistic
              title="Total Play Hours Today"
              value={analytics.totalWatchHoursToday ?? 0}
              suffix="hrs"
              prefix={<ClockCircleOutlined style={{ color: "#722ed1" }} />}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              QoE Streaming Telemetry
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5} style={{ flex: "1 1 200px" }}>
          <Card size="small">
            <Statistic
              title="Avg Completion Rate"
              value={analytics.avgCompletionRate ?? 0}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {(analytics.totalViews ?? 0).toLocaleString()} total plays
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 3. TIMEFRAME FILTER BAR */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space wrap>
            <Text strong>Time Period:</Text>
            <Segmented
              value={timeframe}
              onChange={(v) => setTimeframe(v as TimeframeKey)}
              options={[
                { label: "Last 7 Days", value: "7d" },
                { label: "Last 30 Days", value: "30d" },
                { label: "Last 90 Days", value: "90d" },
                { label: "Year to Date (YTD)", value: "ytd" },
              ]}
            />
          </Space>
          <Space>
            <Tag color="green">LIVE TELEMETRY</Tag>
            <Tag color="blue">Global (All Regions)</Tag>
          </Space>
        </div>
      </Card>

      {/* 4. REVENUE & ENGAGEMENT TREND + DEVICE BREAKDOWN */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title={`Revenue & Engagement Trend (${TIMEFRAME_LABELS[timeframe]})`}
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Revenue (₹) vs New/Active Users</Text>}
          >
            {chartPoints.length > 0 ? (
              <div style={{ width: "100%", height: 290 }}>
                <ResponsiveContainer>
                  <ComposedChart data={chartPoints} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue (₹)"
                      stroke="#eb2f96"
                      fill="#eb2f96"
                      fillOpacity={0.18}
                      strokeWidth={2.5}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="users"
                      name="Users"
                      stroke="#13c2c2"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="streams"
                      name="Streams"
                      stroke="#faad14"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="No trend data available for this timeframe yet." />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Space><DesktopOutlined /> Device &amp; Platform Share</Space>} style={{ height: "100%" }}>
            {deviceBreakdown.length === 0 ? (
              <Empty description="No device playback telemetry recorded yet." />
            ) : (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                {deviceBreakdown.map((d: any, idx: number) => (
                  <div key={d.platform || idx}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text strong>{d.platform}</Text>
                      <Text type="secondary">
                        <strong>{d.percentage}%</strong> ({Number(d.activeSessions || 0).toLocaleString()} devices)
                      </Text>
                    </div>
                    <Progress percent={Number(d.percentage || 0)} showInfo={false} strokeColor="#1677ff" size="small" />
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* 5. TOP PERFORMING CONTENT LEADERBOARD */}
      <Card
        title={
          <Space>
            <TrophyOutlined style={{ color: "#faad14" }} />
            <span>Top Performing Content Leaderboard</span>
          </Space>
        }
        extra={<Text type="secondary">Highest engagement, watch hours &amp; TVOD revenue per title</Text>}
        style={{ marginBottom: 16 }}
      >
        <Table
          rowKey={(r, i) => String(r.id || r.title || i)}
          loading={loading}
          dataSource={topContent}
          size="small"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: "No top performing content recorded yet." }}
          columns={[
            {
              title: "Rank & Title",
              render: (_: any, item: any, idx: number) => (
                <Space>
                  <Tag color={idx === 0 ? "gold" : idx === 1 ? "cyan" : idx === 2 ? "purple" : "default"}>
                    #{idx + 1}
                  </Tag>
                  <Text strong>{item.title}</Text>
                </Space>
              ),
            },
            {
              title: "Format",
              dataIndex: "contentType",
              width: 110,
              render: (v) => <Tag color={v === "SERIES" ? "purple" : "blue"}>{v || "MOVIE"}</Tag>,
            },
            {
              title: "Total Plays",
              dataIndex: "totalViews",
              width: 120,
              render: (v) => `${Number(v || 0).toLocaleString()} Plays`,
            },
            {
              title: "Unique Viewers",
              dataIndex: "uniqueViews",
              width: 130,
              render: (v) => <Text style={{ color: "#13c2c2", fontWeight: 600 }}>{Number(v || 0).toLocaleString()}</Text>,
            },
            {
              title: "Watch Hours",
              dataIndex: "watchHours",
              width: 120,
              render: (v) => `${Number(v || 0).toLocaleString()} hrs`,
            },
            {
              title: "TVOD Revenue",
              dataIndex: "totalRevenue",
              width: 130,
              render: (v) => <Text style={{ color: "#faad14", fontWeight: 700 }}>{fmtMoney(v)}</Text>,
            },
            {
              title: "VAST Ads",
              width: 165,
              render: (_: any, item: any) =>
                item.adsEligible ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>Ads Live</Tag>
                ) : (
                  <Tag color="orange" icon={<HourglassOutlined />}>
                    {Number(item.uniqueViewsNeeded || 0).toLocaleString()} more needed
                  </Tag>
                ),
            },
          ]}
        />
      </Card>

      {/* 6. EXECUTIVE METRICS DEPTH */}
      <Card
        title={
          <Space>
            <FundOutlined style={{ color: "#1677ff" }} />
            <span>Executive Metrics Depth (Monetization, Subscriptions, Payments, Funnel &amp; Cohorts)</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}>
            <Card size="small">
              <Statistic title="WAU (7d)" value={analytics.weeklyActiveUsers ?? 0} />
              <Text type="secondary" style={{ fontSize: 11 }}>MAU: {(analytics.monthlyActiveUsers ?? 0).toLocaleString()}</Text>
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small">
              <Statistic title="ARPU" value={analytics.arpu ?? 0} formatter={(v) => fmtMoney(v)} />
              <Text type="secondary" style={{ fontSize: 11 }}>ARPPU: {fmtMoney(analytics.arppu)}</Text>
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small">
              <Statistic title="Churn Rate" value={subM.churnRate ?? 0} precision={1} suffix="%" />
              <Text type="secondary" style={{ fontSize: 11 }}>Cancelled: {subM.cancelled ?? 0}</Text>
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small">
              <Statistic title="Payment Success" value={payM.successRate ?? 0} precision={1} suffix="%" />
              <Text type="secondary" style={{ fontSize: 11 }}>Collected: {fmtMoney(payM.totalCollected, 0)}</Text>
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small">
              <Statistic title="Retention (30d)" value={engM.retentionRate30d ?? 0} precision={1} suffix="%" />
              <Text type="secondary" style={{ fontSize: 11 }}>Returning: {engM.returningUsers30d ?? 0}</Text>
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small">
              <Statistic title="Signup → Paid" value={funnelM.signupToPaidRate ?? 0} precision={1} suffix="%" />
              <Text type="secondary" style={{ fontSize: 11 }}>Paying: {funnelM.payingUsers ?? 0}</Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* Revenue Attribution */}
          <Col xs={24} md={12} lg={6}>
            <Card size="small" title="Revenue Attribution" style={{ height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span>SVOD (Monthly)</span>
                <strong style={{ color: "#faad14" }}>{fmtMoney(revAttr?.monthly?.svod)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid rgba(128,128,128,0.15)" }}>
                <span>TVOD (Monthly)</span>
                <strong>{fmtMoney(revAttr?.monthly?.tvod)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid rgba(128,128,128,0.15)" }}>
                <span>Ads (Monthly)</span>
                <strong>{fmtMoney(revAttr?.monthly?.ads)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(128,128,128,0.25)" }}>
                <strong>Total (Monthly)</strong>
                <strong style={{ color: "#13c2c2" }}>{fmtMoney(revAttr?.monthly?.total)}</strong>
              </div>
              <Divider style={{ margin: "8px 0" }} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Lifetime: SVOD {fmtMoney(revAttr?.lifetime?.svod, 0)} • TVOD {fmtMoney(revAttr?.lifetime?.tvod, 0)} • Ads{" "}
                {fmtMoney(revAttr?.lifetime?.ads, 0)}
              </Text>
            </Card>
          </Col>

          {/* Subscriptions & Funnel */}
          <Col xs={24} md={12} lg={6}>
            <Card size="small" title="Subscriptions & Funnel" style={{ height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                <span>Active / Exp / Canc</span>
                <strong>
                  {subM.active ?? 0} / {subM.expired ?? 0} / {subM.cancelled ?? 0}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(128,128,128,0.15)" }}>
                <span>New / Renewals (Mo)</span>
                <strong>
                  {subM.newThisMonth ?? 0} / {subM.renewalsThisMonth ?? 0}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(128,128,128,0.15)" }}>
                <span>Signup → Active</span>
                <strong>{Number(funnelM.signupToActiveRate || 0).toFixed(1)}%</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(128,128,128,0.15)" }}>
                <span>Signup → Paid</span>
                <strong>{Number(funnelM.signupToPaidRate || 0).toFixed(1)}%</strong>
              </div>
              {Array.isArray(subM.planMix) && subM.planMix.length > 0 && (
                <>
                  <Divider style={{ margin: "8px 0" }} />
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                    Top Plan Mix
                  </Text>
                  {subM.planMix.slice(0, 4).map((p: any, i: number) => (
                    <div key={p.planId || i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                      <span>{p.planName || `Plan #${p.planId}`}</span>
                      <Tag color="green" style={{ margin: 0 }}>{p.activeSubscribers || 0} active</Tag>
                    </div>
                  ))}
                </>
              )}
            </Card>
          </Col>

          {/* Payments, Refunds & Failures */}
          <Col xs={24} md={12} lg={6}>
            <Card size="small" title="Payments, Refunds & Failures" style={{ height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                <span>Success / Failed / Pend</span>
                <strong>
                  {payM.success ?? 0} / {payM.failed ?? 0} / {payM.pending ?? 0}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(128,128,128,0.15)" }}>
                <span>Refunded Count</span>
                <strong>{payM.refunded ?? 0}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(128,128,128,0.15)" }}>
                <span>Refund Amount</span>
                <strong>{fmtMoney(payM.refundAmount)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(128,128,128,0.15)" }}>
                <span>Total Collected</span>
                <strong style={{ color: "#52c41a" }}>{fmtMoney(payM.totalCollected)}</strong>
              </div>
              {Array.isArray(payM.failureReasons) && payM.failureReasons.length > 0 && (
                <>
                  <Divider style={{ margin: "8px 0" }} />
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                    Top Failure Reasons
                  </Text>
                  {payM.failureReasons.slice(0, 4).map((f: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                      <Text ellipsis style={{ maxWidth: 160 }}>{f.reason}</Text>
                      <Tag color="orange" style={{ margin: 0 }}>{f.count}</Tag>
                    </div>
                  ))}
                </>
              )}
            </Card>
          </Col>

          {/* Geo, Engagement & Content Cohorts */}
          <Col xs={24} md={12} lg={6}>
            <Card size="small" title="Geo, Engagement & Cohorts" style={{ height: "100%" }}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                Avg session: <strong>{Number(engM.avgSessionDurationMinutes || 0).toFixed(1)} min</strong> • Buffer:{" "}
                <strong>{Number(engM.bufferRatioPercentage || 0).toFixed(1)}%</strong>
              </Text>
              {Array.isArray(geoM.topMarkets) && geoM.topMarkets.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                    Top Markets
                  </Text>
                  {geoM.topMarkets.slice(0, 4).map((m: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                      <span>{m.market || "IN"}</span>
                      <Tag color="blue" style={{ margin: 0 }}>{Number(m.eventsOrUsers || 0).toLocaleString()}</Tag>
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(contentEng.byContentType) && contentEng.byContentType.length > 0 && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                    Engagement by Format
                  </Text>
                  {contentEng.byContentType.slice(0, 4).map((c: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                      <span>{c.contentType}</span>
                      <Text strong style={{ color: "#faad14" }}>
                        {Number(c.views || 0).toLocaleString()} views ({c.titles || 0} titles)
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 7. ACTIVE REALTIME STREAMS TABLE */}
      <Card title={`Active Realtime Streams (${activeStreams.length})`}>
        <Table
          rowKey={(r, i) => String(r.sessionId || r.id || i)}
          loading={loading}
          dataSource={activeStreams}
          size="small"
          pagination={false}
          locale={{ emptyText: "No active playback sessions right now" }}
          columns={[
            { title: "Title", dataIndex: "title", render: (v, r) => v || r.contentTitle || r.contentId || "-" },
            { title: "User", dataIndex: "userEmail", render: (v, r) => v || r.userId || "-" },
            { title: "Device", dataIndex: "deviceName", render: (v, r) => v || r.platform || "-" },
            { title: "Quality", dataIndex: "quality", width: 100, render: (v) => <Tag color="blue">{v || "AUTO"}</Tag> },
            {
              title: "Progress",
              width: 120,
              render: (_: any, r: any) =>
                r.totalDurationSeconds
                  ? `${Math.round(((r.currentPositionSeconds || 0) / r.totalDurationSeconds) * 100)}%`
                  : "-",
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AnalyticsPage;
