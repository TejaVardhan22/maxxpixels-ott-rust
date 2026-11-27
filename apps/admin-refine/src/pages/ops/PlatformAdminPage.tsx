import React, { useEffect, useState } from "react";
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  Typography,
  Badge,
  message,
} from "antd";
import {
  CrownOutlined,
  UserAddOutlined,
  ReloadOutlined,
  RedoOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  LockOutlined,
  LogoutOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  KeyOutlined,
  EditOutlined,
  CloudServerOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, extractArray } from "../../providers/api";

const { Title, Text } = Typography;

const ADMIN_ROLE_OPTIONS = [
  { value: "ROLE_SUPER_ADMIN", label: "Super Admin (Full Root Access)" },
  { value: "ROLE_ADMIN", label: "Platform Admin" },
  { value: "ROLE_CONTENT_MANAGER", label: "Content Operations Manager" },
  { value: "ROLE_FINANCE", label: "Finance & Billing Specialist" },
  { value: "ROLE_ANALYST", label: "BI & Analytics Viewer" },
  { value: "ROLE_MODERATOR", label: "Content Moderator" },
];

function generateStrongPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let pw = "Maxx#";
  for (let i = 0; i < 10; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

export const PlatformAdminPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Dedicated /admin/platform/overview & /admin/platform/admins state
  const [overview, setOverview] = useState<any>({});
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<any[]>([]);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Filters & action spinners
  const [logLevel, setLogLevel] = useState("");
  const [logService, setLogService] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [outboxStatus, setOutboxStatus] = useState("");
  const [retryingOutbox, setRetryingOutbox] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [runningExpiry, setRunningExpiry] = useState(false);

  // Add / Edit Admin Modal
  const [adminModal, setAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminForm] = Form.useForm();

  // Reset Password Modal
  const [pwModal, setPwModal] = useState<{ open: boolean; user?: any }>({ open: false });
  const [newPassword, setNewPassword] = useState("");

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const logParams = new URLSearchParams({ limit: "150" });
      if (logLevel) logParams.set("level", logLevel);
      if (logService) logParams.set("service", logService);
      if (logSearch.trim()) logParams.set("q", logSearch.trim());
      const logQs = `?${logParams.toString()}`;
      const outboxQs = outboxStatus ? `?status=${outboxStatus}&limit=100` : "?limit=100";
      const [ovRes, admRes, lRes, oRes, liveRes, devRes, aRes] = await Promise.all([
        apiGet("/admin/platform/overview").catch(() => ({})),
        apiGet("/admin/platform/admins").catch(() => []),
        apiGet(`/admin/logs${logQs}`).catch(() => []),
        apiGet(`/admin/outbox${outboxQs}`).catch(() => []),
        apiGet("/admin/analytics/live").catch(() => ({})),
        apiGet("/admin/devices").catch(() => []),
        apiGet("/admin/security/audit-logs").catch(() => []),
      ]);
      setOverview(ovRes || {});
      setAdminUsers(extractArray(admRes));
      setLogs(extractArray(lRes));
      setOutbox(extractArray(oRes));
      setLiveStreams(Array.isArray(liveRes?.activeStreams) ? liveRes.activeStreams : []);
      setDevices(extractArray(devRes));
      setAuditLogs(extractArray(aRes));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: any) {
      if (!silent) message.error(e.message || "Failed to load platform monitor");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [logLevel, logService, outboxStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => loadAll(true), 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, logLevel, logService, logSearch, outboxStatus]);

  const summary = overview?.summary || {};
  const services: any[] = Array.isArray(overview?.services) ? overview.services : [];
  const dbStats = overview?.database || {};
  const redisStats = overview?.redis || {};
  const rtStats = overview?.runtime || {};
  const maintenanceMode = Boolean(summary.maintenanceMode);

  const openAddAdmin = () => {
    setEditingAdmin(null);
    adminForm.resetFields();
    adminForm.setFieldsValue({
      role: "ROLE_ADMIN",
      status: "ACTIVE",
      password: generateStrongPassword(),
    });
    setAdminModal(true);
  };

  const openEditAdmin = (rec: any) => {
    setEditingAdmin(rec);
    const currentRole = (Array.isArray(rec.roles) && rec.roles[0]) || "ROLE_ADMIN";
    adminForm.setFieldsValue({
      fullName: rec.fullName || "",
      email: rec.email || "",
      phoneNumber: rec.phoneNumber || "",
      role: currentRole,
      status: rec.status || "ACTIVE",
    });
    setAdminModal(true);
  };

  const saveAdmin = async (values: any) => {
    setSavingAdmin(true);
    try {
      if (editingAdmin?.id) {
        await apiPut(`/admin/platform/admins/${editingAdmin.id}/role`, { role: values.role });
        message.success(`Updated role for "${editingAdmin.fullName || editingAdmin.email}" to ${values.role}`);
      } else {
        await apiPost("/admin/platform/admins", {
          fullName: values.fullName,
          email: values.email,
          phoneNumber: values.phoneNumber,
          password: values.password,
          role: values.role,
          status: values.status || "ACTIVE",
        });
        message.success(`Created new platform admin "${values.fullName}" (${values.role})`);
      }
      setAdminModal(false);
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to save admin account");
    } finally {
      setSavingAdmin(false);
    }
  };

  const toggleStatus = async (u: any) => {
    const nextStatus = String(u.status || "").toUpperCase() === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await apiPost(`/admin/platform/admins/${u.id}/status`, { status: nextStatus });
      message.success(`Admin ${nextStatus === "ACTIVE" ? "activated" : "suspended"}`);
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Status update failed");
    }
  };

  const revokeAllDevices = async (u: any) => {
    try {
      await apiPost(`/admin/users/${u.id}/revoke-devices`, {});
      message.success(`Forced logout on all devices for ${u.email || u.fullName}`);
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to revoke sessions");
    }
  };

  const resetAdminPassword = async () => {
    if (!pwModal.user?.id || !newPassword.trim()) return;
    try {
      await apiPost(`/admin/platform/admins/${pwModal.user.id}/reset-password`, {
        newPassword: newPassword.trim(),
      });
      message.success("Admin password reset & active sessions revoked");
      setPwModal({ open: false });
      setNewPassword("");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to reset password");
    }
  };

  const toggleMaintenance = async (next: boolean) => {
    try {
      await apiPost("/admin/platform/maintenance", { enabled: next });
      message.success(
        next
          ? "Maintenance Mode ENABLED (non-admin traffic returns 503)"
          : "Maintenance Mode DISABLED — Platform is LIVE"
      );
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to toggle maintenance mode");
    }
  };

  const retryOutbox = async () => {
    setRetryingOutbox(true);
    try {
      await apiPost("/admin/outbox/retry", {});
      message.success("Failed outbox events queued for retry");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Outbox retry failed");
    } finally {
      setRetryingOutbox(false);
    }
  };

  const exportBackup = async () => {
    setExportingBackup(true);
    try {
      await apiPost("/admin/backup/export", {});
      message.success("Database backup exported");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Backup export failed");
    } finally {
      setExportingBackup(false);
    }
  };

  const runExpiryNotifications = async () => {
    setRunningExpiry(true);
    try {
      const res = await apiPost("/admin/notifications/run-expiry-check", {});
      message.success(`Plan expiry notifications checked${res?.sent !== undefined ? ` (${res.sent} sent)` : ""}`);
    } catch (e: any) {
      message.error(e.message || "Failed to run expiry check");
    } finally {
      setRunningExpiry(false);
    }
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <Tag color="red" style={{ marginBottom: 4 }}><CrownOutlined /> PLATFORM ADMIN COMMAND CENTER</Tag>
          <Title level={3} style={{ margin: "0 0 2px" }}>Platform Admin &amp; Close Monitoring</Title>
          <Text type="secondary">
            End-to-end live microservice probes, PostgreSQL/Redis telemetry, atomic admin provisioning, outbox &amp; audit trail.
            {lastUpdated ? ` • Updated ${lastUpdated}` : ""}
          </Text>
        </div>
        <Space wrap>
          <Space size={6}>
            <Badge status={autoRefresh ? "processing" : "default"} />
            <Text style={{ fontSize: 12 }}>Live 10s</Text>
            <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
          </Space>
          <Button icon={<DatabaseOutlined />} loading={exportingBackup} onClick={exportBackup}>Backup DB</Button>
          <Button icon={<ThunderboltOutlined />} loading={runningExpiry} onClick={runExpiryNotifications}>Run Expiry Push</Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadAll()}>Refresh</Button>
          <Button type="primary" danger icon={<UserAddOutlined />} onClick={openAddAdmin}>
            Add Platform Admin
          </Button>
        </Space>
      </div>

      {/* 6 WATCHDOG KPI CARDS */}
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={4}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 11 }}>Platform Mode</Text>
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Tag color={maintenanceMode ? "red" : "green"}>{maintenanceMode ? "MAINTENANCE" : "LIVE"}</Tag>
              <Popconfirm
                title={maintenanceMode ? "Disable Maintenance Mode and go LIVE?" : "Enable Maintenance Mode (returns 503 to users)?"}
                onConfirm={() => toggleMaintenance(!maintenanceMode)}
              >
                <Switch size="small" checked={maintenanceMode} />
              </Popconfirm>
            </div>
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card size="small">
            <Statistic
              title="Services Healthy"
              value={`${summary.servicesUp ?? 0} / ${summary.servicesTotal ?? services.length}`}
              prefix={<CloudServerOutlined style={{ color: "#52c41a" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card size="small">
            <Statistic
              title="Admin & Staff"
              value={summary.adminStaffCount ?? adminUsers.length}
              prefix={<SafetyCertificateOutlined style={{ color: "#1677ff" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card size="small">
            <Statistic
              title="Errors (1h / 24h)"
              value={`${summary.errorsLast1h ?? 0} / ${summary.errorsLast24h ?? 0}`}
              valueStyle={{ color: (summary.errorsLast1h ?? 0) > 0 ? "#ff4d4f" : "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card size="small">
            <Statistic
              title="Outbox Failed / Pending"
              value={`${summary.outboxFailed ?? 0} / ${summary.outboxPending ?? 0}`}
              valueStyle={{ color: (summary.outboxFailed ?? 0) > 0 ? "#ff4d4f" : "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card size="small">
            <Statistic title="Backups / Migrations" value={`${summary.backupsCount ?? 0} / ${summary.migrationsCount ?? 0}`} />
          </Card>
        </Col>
      </Row>

      {/* MAIN TABS */}
      <Tabs
        items={[
          {
            key: "monitor",
            label: `Live Microservices & Infra (${summary.servicesUp ?? 0}/${summary.servicesTotal ?? services.length} UP)`,
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={15}>
                  <Card title="Microservices Real-Time Health Probes" size="small">
                    <Table
                      rowKey="name"
                      dataSource={services}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: "Service", dataIndex: "name", render: (v) => <strong>{v}</strong> },
                        {
                          title: "Status",
                          dataIndex: "status",
                          width: 110,
                          render: (v) => <Tag color={v === "UP" ? "green" : v === "DEGRADED" ? "orange" : "red"}>{v}</Tag>,
                        },
                        {
                          title: "Latency",
                          dataIndex: "latencyMs",
                          width: 100,
                          render: (v) => `${v ?? 0} ms`,
                        },
                        { title: "Detail", dataIndex: "detail", ellipsis: true },
                      ]}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={9}>
                  <Space direction="vertical" style={{ width: "100%" }} size="middle">
                    <Card title="PostgreSQL Connection Pool" size="small" extra={<Tag color={dbStats.status === "UP" ? "green" : "red"}>{dbStats.status || "UNKNOWN"}</Tag>}>
                      <Row gutter={8}>
                        <Col span={8}><Statistic title="Open" value={dbStats.openConnections ?? 0} /></Col>
                        <Col span={8}><Statistic title="In Use" value={dbStats.inUse ?? 0} /></Col>
                        <Col span={8}><Statistic title="Ping" value={`${dbStats.latencyMs ?? 0}ms`} /></Col>
                      </Row>
                    </Card>
                    <Card title="Redis Cache & Rate Limiter" size="small" extra={<Tag color={redisStats.status === "UP" ? "green" : "orange"}>{redisStats.status || "UNKNOWN"}</Tag>}>
                      <Statistic title="Ping Latency" value={`${redisStats.latencyMs ?? 0} ms`} />
                    </Card>
                    <Card title="Go Platform Runtime" size="small">
                      <Row gutter={8}>
                        <Col span={8}><Statistic title="Goroutines" value={rtStats.goroutines ?? 0} /></Col>
                        <Col span={8}><Statistic title="Alloc MB" value={Number(rtStats.allocMB || 0).toFixed(1)} /></Col>
                        <Col span={8}><Statistic title="Uptime" value={`${Math.floor((rtStats.uptimeSeconds || 0) / 60)}m`} /></Col>
                      </Row>
                    </Card>
                  </Space>
                </Col>
              </Row>
            ),
          },
          {
            key: "admins",
            label: `Platform Admins & Staff (${adminUsers.length})`,
            children: (
              <Card
                extra={
                  <Button type="primary" danger icon={<UserAddOutlined />} onClick={openAddAdmin}>
                    Add New Admin
                  </Button>
                }
              >
                <Table
                  rowKey="id"
                  loading={loading}
                  dataSource={adminUsers}
                  columns={[
                    {
                      title: "Administrator",
                      render: (_: any, u: any) => (
                        <div>
                          <strong>{u.fullName || "Admin"}</strong>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>{u.email} {u.phoneNumber ? `• ${u.phoneNumber}` : ""}</div>
                        </div>
                      ),
                    },
                    {
                      title: "Roles",
                      render: (_: any, u: any) => (
                        <Space wrap size={4}>
                          {(Array.isArray(u.roles) ? u.roles : []).map((code: string) => (
                            <Tag key={code} color={code === "ROLE_SUPER_ADMIN" ? "red" : "blue"}>
                              {code}
                            </Tag>
                          ))}
                        </Space>
                      ),
                    },
                    {
                      title: "Devices",
                      dataIndex: "activeDevicesCount",
                      width: 90,
                      render: (v) => <Tag>{v ?? 0} active</Tag>,
                    },
                    {
                      title: "Status",
                      dataIndex: "status",
                      width: 110,
                      render: (v) => <Tag color={String(v || "").toUpperCase() === "ACTIVE" ? "green" : "red"}>{v || "ACTIVE"}</Tag>,
                    },
                    {
                      title: "Actions",
                      width: 290,
                      render: (_: any, u: any) => (
                        <Space wrap size={4}>
                          <Button size="small" icon={<EditOutlined />} onClick={() => openEditAdmin(u)}>Role</Button>
                          <Button
                            size="small"
                            icon={<KeyOutlined />}
                            onClick={() => {
                              setNewPassword(generateStrongPassword());
                              setPwModal({ open: true, user: u });
                            }}
                          >
                            Reset PW
                          </Button>
                          <Popconfirm title="Force logout all devices?" onConfirm={() => revokeAllDevices(u)}>
                            <Button size="small" icon={<LogoutOutlined />} title="Force Logout All" />
                          </Popconfirm>
                          <Popconfirm
                            title={String(u.status || "").toUpperCase() === "ACTIVE" ? "Suspend this admin?" : "Activate this admin?"}
                            onConfirm={() => toggleStatus(u)}
                          >
                            <Button
                              size="small"
                              danger={String(u.status || "").toUpperCase() === "ACTIVE"}
                              icon={String(u.status || "").toUpperCase() === "ACTIVE" ? <StopOutlined /> : <CheckCircleOutlined />}
                            />
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "logs",
            label: `Live Service Logs (${logs.length} • ${summary.errorsLast1h ?? 0} err/1h)`,
            children: (
              <Card
                extra={
                  <Space wrap>
                    <Input.Search
                      allowClear
                      placeholder="Search path or message..."
                      style={{ width: 220 }}
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      onSearch={() => loadAll()}
                    />
                    <Select
                      style={{ width: 170 }}
                      value={logService}
                      onChange={setLogService}
                      options={[
                        { value: "", label: "All Services" },
                        { value: "identity-service", label: "identity-service" },
                        { value: "catalog-service", label: "catalog-service" },
                        { value: "streaming-service", label: "streaming-service" },
                        { value: "commerce-service", label: "commerce-service" },
                        { value: "monetization-service", label: "monetization-service" },
                        { value: "platform-service", label: "platform-service" },
                        { value: "admin-audit", label: "admin-audit" },
                        { value: "platform-admin", label: "platform-admin" },
                        { value: "worker-service", label: "worker-service" },
                      ]}
                    />
                    <Select
                      style={{ width: 135 }}
                      value={logLevel}
                      onChange={setLogLevel}
                      options={[
                        { value: "", label: "All Levels" },
                        { value: "ERROR", label: "ERROR Only" },
                        { value: "WARN", label: "WARN" },
                        { value: "INFO", label: "INFO" },
                      ]}
                    />
                  </Space>
                }
              >
                <Table
                  rowKey={(r, i) => String(r.id || i)}
                  dataSource={logs}
                  size="small"
                  pagination={{ pageSize: 25, showSizeChanger: true }}
                  columns={[
                    { title: "Service", dataIndex: "service", width: 155, render: (v) => <Tag color="geekblue">{v}</Tag> },
                    {
                      title: "Level",
                      dataIndex: "level",
                      width: 80,
                      render: (v) => {
                        const lv = String(v || "INFO").toUpperCase();
                        return <Tag color={lv === "ERROR" ? "red" : lv === "WARN" ? "orange" : "blue"}>{lv}</Tag>;
                      },
                    },
                    {
                      title: "HTTP Request",
                      width: 280,
                      render: (_: any, r: any) =>
                        r.path ? (
                          <Space size={4} wrap>
                            {r.method && <Tag>{r.method}</Tag>}
                            {r.status ? (
                              <Tag color={r.status >= 500 ? "red" : r.status >= 400 ? "orange" : "green"}>{r.status}</Tag>
                            ) : null}
                            <Text code style={{ fontSize: 12 }}>{r.path}</Text>
                            {r.durationMs !== undefined && r.durationMs !== null && (
                              <Text type="secondary" style={{ fontSize: 11 }}>{r.durationMs}ms</Text>
                            )}
                          </Space>
                        ) : (
                          <Text type="secondary">-</Text>
                        ),
                    },
                    { title: "Message", dataIndex: "message", ellipsis: true },
                    {
                      title: "Request ID",
                      width: 130,
                      ellipsis: true,
                      render: (_: any, r: any) => (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {r.requestId || r.traceId || "-"}
                        </Text>
                      ),
                    },
                    { title: "Time", dataIndex: "createdAt", width: 165, render: (v) => (v ? new Date(v).toLocaleString() : "-") },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "outbox",
            label: `Outbox & Kafka (${summary.outboxFailed ?? 0} failed)`,
            children: (
              <Card
                extra={
                  <Space>
                    <Select
                      style={{ width: 140 }}
                      value={outboxStatus}
                      onChange={setOutboxStatus}
                      options={[
                        { value: "", label: "All Status" },
                        { value: "FAILED", label: "FAILED" },
                        { value: "PENDING", label: "PENDING" },
                        { value: "PUBLISHED", label: "PUBLISHED" },
                      ]}
                    />
                    <Button type="primary" icon={<RedoOutlined />} loading={retryingOutbox} onClick={retryOutbox}>
                      Retry Failed
                    </Button>
                  </Space>
                }
              >
                <Table
                  rowKey={(r, i) => String(r.id || i)}
                  dataSource={outbox}
                  size="small"
                  columns={[
                    { title: "Topic", dataIndex: "topic", width: 170, render: (v) => <Tag color="purple">{v}</Tag> },
                    { title: "Event", dataIndex: "eventType", width: 170 },
                    {
                      title: "Status",
                      dataIndex: "status",
                      width: 110,
                      render: (v) => <Tag color={v === "PUBLISHED" ? "green" : v === "FAILED" ? "red" : "orange"}>{v}</Tag>,
                    },
                    { title: "Attempts", dataIndex: "attempts", width: 85 },
                    { title: "Last Error", dataIndex: "lastError", ellipsis: true },
                    { title: "Created", dataIndex: "createdAt", width: 170, render: (v) => (v ? new Date(v).toLocaleString() : "-") },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "sessions",
            label: `Active Streams (${liveStreams.length}) & Devices (${devices.length})`,
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title="Live Concurrent Streams" size="small">
                    <Table
                      rowKey={(r, i) => String(r.sessionId || i)}
                      dataSource={liveStreams}
                      size="small"
                      pagination={false}
                      locale={{ emptyText: "No active streams right now" }}
                      columns={[
                        { title: "Title", dataIndex: "title" },
                        { title: "Viewer", dataIndex: "userName", render: (v) => v || "Guest" },
                        { title: "Platform", dataIndex: "deviceType", render: (v) => <Tag>{v || "WEB"}</Tag> },
                      ]}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="Recent Registered Devices" size="small">
                    <Table
                      rowKey={(r, i) => String(r.id || i)}
                      dataSource={devices.slice(0, 20)}
                      size="small"
                      pagination={false}
                      columns={[
                        { title: "Device", dataIndex: "deviceName", render: (v, r) => v || r.platform || "Device" },
                        { title: "User", dataIndex: "userEmail", render: (v, r) => v || r.userId || "-" },
                        {
                          title: "Revoke",
                          width: 90,
                          render: (_: any, r: any) => (
                            <Button
                              size="small"
                              danger
                              onClick={async () => {
                                await apiPost(`/admin/devices/${r.id}/revoke`, {});
                                message.success("Device revoked");
                                loadAll();
                              }}
                            >
                              Revoke
                            </Button>
                          ),
                        },
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "audit",
            label: `Security Audit Trail (${auditLogs.length})`,
            children: (
              <Card>
                <Table
                  rowKey={(r, i) => String(r.id || i)}
                  dataSource={auditLogs}
                  size="small"
                  columns={[
                    { title: "Action", dataIndex: "action", render: (v, r) => <Tag color="blue">{v || r.settingKey || "EVENT"}</Tag> },
                    { title: "Actor", dataIndex: "userEmail", render: (v, r) => v || r.changedBy || "admin" },
                    { title: "Details", dataIndex: "details", ellipsis: true, render: (v, r) => v || `${r.oldValue ?? ""} → ${r.newValue ?? ""}` },
                    { title: "Time", dataIndex: "createdAt", width: 170, render: (v) => (v ? new Date(v).toLocaleString() : "-") },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* ADD / EDIT ADMIN MODAL */}
      <Modal
        title={editingAdmin ? `Change Role: ${editingAdmin.fullName || editingAdmin.email}` : "Add New Platform Admin"}
        open={adminModal}
        onCancel={() => setAdminModal(false)}
        onOk={() => adminForm.submit()}
        okText={editingAdmin ? "Update Role" : "Create Admin Account"}
        confirmLoading={savingAdmin}
        width={540}
      >
        <Form form={adminForm} layout="vertical" onFinish={saveAdmin}>
          {!editingAdmin && (
            <>
              <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Ops Administrator" />
              </Form.Item>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="email" label="Admin Email" rules={[{ required: true, type: "email" }]}>
                    <Input placeholder="ops@maxxpixels.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="phoneNumber" label="Mobile Number (Optional)">
                    <Input placeholder="+919876543210" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="password"
                label="Initial Password"
                rules={[{ required: true, min: 6, message: "Password must be at least 6 characters" }]}
              >
                <Input
                  prefix={<LockOutlined />}
                  addonAfter={
                    <Space size={6}>
                      <a onClick={() => adminForm.setFieldValue("password", generateStrongPassword())}>Generate</a>
                      <a
                        onClick={() => {
                          navigator.clipboard?.writeText(adminForm.getFieldValue("password") || "");
                          message.success("Password copied");
                        }}
                      >
                        <CopyOutlined />
                      </a>
                    </Space>
                  }
                />
              </Form.Item>
            </>
          )}
          <Form.Item name="role" label="Assign Admin Role" rules={[{ required: true }]}>
            <Select options={ADMIN_ROLE_OPTIONS} />
          </Form.Item>
          {!editingAdmin && (
            <Form.Item name="status" label="Account Status">
              <Select options={[{ value: "ACTIVE", label: "ACTIVE" }, { value: "SUSPENDED", label: "SUSPENDED" }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        title={`Reset Password: ${pwModal.user?.email || pwModal.user?.fullName || ""}`}
        open={pwModal.open}
        onOk={resetAdminPassword}
        onCancel={() => setPwModal({ open: false })}
      >
        <Input
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New strong password"
          addonAfter={
            <a
              onClick={() => {
                navigator.clipboard?.writeText(newPassword);
                message.success("Copied");
              }}
            >
              <CopyOutlined />
            </a>
          }
        />
      </Modal>
    </div>
  );
};

export default PlatformAdminPage;
