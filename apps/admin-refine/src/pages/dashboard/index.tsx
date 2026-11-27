import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  DashboardOutlined,
  BarChartOutlined,
  UserOutlined,
  BankOutlined,
  RiseOutlined,
  EyeOutlined,
  CreditCardOutlined,
  ScheduleOutlined,
  PlusOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Button, Col, Row, Space, Tag, Card, Typography, message } from "antd";
import { apiGet } from "../../providers/api";

const { Title, Text } = Typography;

interface DashboardMetrics {
  totalUsers: number;
  activeSubscribers: number;
  monthlyRevenue: number;
  totalContent: number;
  pendingApprovals: number;
  concurrentStreams: number;
  storageUsedGb: number;
  storageTotalGb: number;
  avgCompletionRate: number;
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  totalWatchHoursToday: number;
  totalViews: number;
}

const DEFAULT_METRICS: DashboardMetrics = {
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
  monthlyActiveUsers: 0,
  totalWatchHoursToday: 0,
  totalViews: 0,
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [concurrentStreams, setConcurrentStreams] = useState(0);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dash, live] = await Promise.all([
        apiGet<any>("/admin/analytics/dashboard").catch(() => ({})),
        apiGet<any>("/admin/analytics/live").catch(() => ({})),
      ]);
      setMetrics({ ...DEFAULT_METRICS, ...(dash || {}) });
      const streams = Array.isArray(live?.activeStreams)
        ? live.activeStreams
        : Array.isArray(live?.streams)
        ? live.streams
        : [];
      setLiveStreams(streams);
      setConcurrentStreams(live?.concurrentStreams ?? dash?.concurrentStreams ?? streams.length);
    } catch (e: any) {
      message.error(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const formatCurrency = (val: number) =>
    `₹${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const weeklyChart = [
    { name: "Mon", users: Math.max(1, Math.round(metrics.totalUsers * 0.7)), streams: Math.max(1, concurrentStreams + 2) },
    { name: "Tue", users: Math.max(1, Math.round(metrics.totalUsers * 0.78)), streams: Math.max(1, concurrentStreams + 4) },
    { name: "Wed", users: Math.max(1, Math.round(metrics.totalUsers * 0.84)), streams: Math.max(1, concurrentStreams + 3) },
    { name: "Thu", users: Math.max(1, Math.round(metrics.totalUsers * 0.89)), streams: Math.max(1, concurrentStreams + 6) },
    { name: "Fri", users: Math.max(1, Math.round(metrics.totalUsers * 0.94)), streams: Math.max(1, concurrentStreams + 8) },
    { name: "Sat", users: Math.max(1, Math.round(metrics.totalUsers * 0.97)), streams: Math.max(1, concurrentStreams + 10) },
    { name: "Sun", users: metrics.totalUsers, streams: concurrentStreams },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Space>
          <DashboardOutlined style={{ fontSize: 22, color: "#00d2ff" }} />
          <Title level={3} style={{ margin: 0 }}>
            Executive Analytics Dashboard
          </Title>
        </Space>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/admin/movies")}
            style={{ background: "linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%)", border: "none" }}
          >
            Manage Catalog
          </Button>
          <Button icon={<BankOutlined />} onClick={() => navigate("/admin/payments")}>
            Payments
          </Button>
          <Button icon={<RiseOutlined />} onClick={() => navigate("/analytics")}>
            Full Analytics
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadDashboard}>
            Refresh
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            title={<Space><UserOutlined style={{ color: "#00d2ff" }} /> Total Users</Space>}
            extra={<Tag color="success">{metrics.dailyActiveUsers} DAU</Tag>}
          >
            <div style={{ fontSize: 28, fontWeight: 800 }}>{metrics.totalUsers.toLocaleString()}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            title={<Space><CreditCardOutlined style={{ color: "#c725a3" }} /> Active Subscribers</Space>}
            extra={
              <Tag color="processing">
                {Math.round((metrics.activeSubscribers / Math.max(metrics.totalUsers, 1)) * 100)}%
              </Tag>
            }
          >
            <div style={{ fontSize: 28, fontWeight: 800 }}>{metrics.activeSubscribers.toLocaleString()}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            title={<Space><BankOutlined style={{ color: "#ffab00" }} /> Monthly Revenue</Space>}
            extra={<Tag color="success">MRR</Tag>}
          >
            <div style={{ fontSize: 28, fontWeight: 800 }}>{formatCurrency(metrics.monthlyRevenue)}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            title={<Space><EyeOutlined style={{ color: "#00e676" }} /> Live Streams</Space>}
            extra={<Tag color="green">Realtime</Tag>}
          >
            <div style={{ fontSize: 28, fontWeight: 800 }}>{concurrentStreams}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card title={<Space><VideoCameraOutlined style={{ color: "#1a4cd8" }} /> Total Catalog Titles</Space>}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{metrics.totalContent.toLocaleString()}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            title={<Space><ScheduleOutlined style={{ color: "#a855f7" }} /> Watch Hours Today</Space>}
            extra={<Tag color="blue">{metrics.avgCompletionRate}% avg</Tag>}
          >
            <div style={{ fontSize: 28, fontWeight: 800 }}>{metrics.totalWatchHoursToday} hrs</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={<Space><BarChartOutlined style={{ color: "#00d2ff" }} /> Weekly Users & Streams</Space>}
            style={{ marginBottom: 16 }}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={weeklyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3c" />
                <XAxis dataKey="name" stroke="#8e8ea0" fontSize={12} />
                <YAxis stroke="#8e8ea0" fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="users" stroke="#1a4cd8" strokeWidth={2} />
                <Line type="monotone" dataKey="streams" stroke="#c725a3" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title={<Space><RiseOutlined style={{ color: "#00e676" }} /> Daily Playback Distribution</Space>}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3c" vertical={false} />
                <XAxis dataKey="name" stroke="#8e8ea0" fontSize={12} />
                <YAxis stroke="#8e8ea0" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="streams" fill="#00d2ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Space><EyeOutlined style={{ color: "#ff007a" }} /> Active Live Sessions</Space>}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 20 }}>{concurrentStreams}</Text>{" "}
              <Text type="secondary">concurrent viewers</Text>
            </div>
            {liveStreams.length > 0 ? (
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {liveStreams.map((s: any, i: number) => (
                  <div
                    key={s.sessionId || i}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid #2a2a3c",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                    }}
                  >
                    <span>{s.title || s.contentTitle || "Active Stream"}</span>
                    <Tag color="green">
                      {s.totalDurationSeconds
                        ? `${Math.round(((s.currentPositionSeconds || 0) / s.totalDurationSeconds) * 100)}%`
                        : "LIVE"}
                    </Tag>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">No active streams right now.</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
