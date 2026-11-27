import React, { useEffect, useState } from "react";
import { Card, Row, Col, Statistic, Table, Tag, Button, Typography, message } from "antd";
import {
  UserOutlined,
  PlayCircleOutlined,
  DollarOutlined,
  EyeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { apiGet } from "../../providers/api";

const { Title } = Typography;

export const AnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<any>({});
  const [realtime, setRealtime] = useState<any>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [ov, rt] = await Promise.all([
        apiGet("/admin/analytics/overview").catch(() => ({})),
        apiGet("/admin/analytics/realtime").catch(() => ({})),
      ]);
      setOverview(ov || {});
      setRealtime(rt || {});
    } catch (e: any) {
      message.error(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeStreams: any[] = Array.isArray(realtime?.activeStreams)
    ? realtime.activeStreams
    : Array.isArray(realtime?.streams)
    ? realtime.streams
    : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Analytics & Realtime Telemetry</Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={overview.totalUsers ?? 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Active Subscribers"
              value={overview.activeSubscribers ?? 0}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Monthly Revenue (INR)"
              value={overview.monthlyRevenue ?? 0}
              precision={2}
              prefix="₹"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Live Concurrent Streams"
              value={realtime.concurrentStreams ?? overview.concurrentStreams ?? activeStreams.length}
              prefix={<PlayCircleOutlined style={{ color: "#52c41a" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Total Catalog Titles" value={overview.totalContent ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Daily Active Users (DAU)" value={overview.dailyActiveUsers ?? 0} prefix={<EyeOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Watch Hours Today" value={overview.totalWatchHoursToday ?? 0} suffix="hrs" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Total Views" value={overview.totalViews ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card title={`Active Realtime Streams (${activeStreams.length})`}>
        <Table
          rowKey={(r, i) => String(r.sessionId || r.id || i)}
          loading={loading}
          dataSource={activeStreams}
          locale={{ emptyText: "No active playback sessions right now" }}
          columns={[
            { title: "Title", dataIndex: "title", render: (v, r) => v || r.contentTitle || r.contentId || "-" },
            { title: "User", dataIndex: "userEmail", render: (v, r) => v || r.userId || "-" },
            { title: "Device", dataIndex: "deviceName", render: (v, r) => v || r.platform || "-" },
            {
              title: "Quality",
              dataIndex: "quality",
              width: 100,
              render: (v) => <Tag color="blue">{v || "AUTO"}</Tag>,
            },
            {
              title: "Progress",
              width: 120,
              render: (_: any, r: any) => {
                if (!r.totalDurationSeconds) return "-";
                return `${Math.round(((r.currentPositionSeconds || 0) / r.totalDurationSeconds) * 100)}%`;
              },
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AnalyticsPage;
