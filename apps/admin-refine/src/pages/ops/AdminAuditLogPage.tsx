import React, { useEffect, useState } from "react";
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Select,
  Input,
  Row,
  Col,
  Statistic,
  Drawer,
  Descriptions,
  Typography,
  message,
} from "antd";
import {
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  DownloadOutlined,
  HistoryOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import { apiGet, extractArray } from "../../providers/api";

const { Title, Text } = Typography;

export const AdminAuditLogPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [serviceLogs, setServiceLogs] = useState<any[]>([]);

  // Filters
  const [actionFilter, setActionFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [logLevel, setLogLevel] = useState("");

  // Inspect Drawer
  const [inspectRow, setInspectRow] = useState<any>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "250" });
      if (actionFilter !== "ALL") qs.set("action", actionFilter);
      if (moduleFilter !== "ALL") qs.set("module", moduleFilter);
      if (search.trim()) qs.set("q", search.trim());

      const svcQs = logLevel ? `?level=${logLevel}&limit=150` : "?limit=150";
      const [actRes, svcRes] = await Promise.all([
        apiGet(`/admin/activity-logs?${qs.toString()}`).catch(() => []),
        apiGet(`/admin/logs${svcQs}`).catch(() => []),
      ]);
      setActivityLogs(extractArray(actRes));
      setServiceLogs(extractArray(svcRes));
    } catch (e: any) {
      message.error(e.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [actionFilter, moduleFilter, logLevel]);

  const exportCsv = () => {
    const header = ["ID", "Action", "Module", "Method", "Path", "Status", "LatencyMs", "Actor", "IP", "CreatedAt"];
    const lines = [
      header.join(","),
      ...activityLogs.map((r) =>
        [
          r.id,
          r.action,
          r.module,
          r.method,
          `"${String(r.path || "").replace(/"/g, '""')}"`,
          r.status,
          r.latencyMs,
          `"${String(r.actorEmail || "").replace(/"/g, '""')}"`,
          r.ip || "",
          r.createdAt || "",
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const creates = activityLogs.filter((r) => r.action === "CREATE").length;
  const updates = activityLogs.filter((r) => r.action === "UPDATE").length;
  const deletes = activityLogs.filter((r) => r.action === "DELETE").length;

  const formatPayload = (raw: string) => {
    if (!raw) return "No JSON body";
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <Tag color="blue" style={{ marginBottom: 4 }}>GLOBAL AUDIT &amp; ACTIVITY TELEMETRY</Tag>
          <Title level={3} style={{ margin: "0 0 2px" }}>Admin Action Logs &amp; Service Logs</Title>
          <Text type="secondary">
            Automatically captures every CREATE, EDIT, and DELETE across all admin modules with actor, path, status, and sanitized payload.
          </Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!activityLogs.length}>
            Export CSV
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadAll}>
            Refresh
          </Button>
        </Space>
      </div>

      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Total Captured Actions" value={activityLogs.length} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Creates (POST)" value={creates} valueStyle={{ color: "#52c41a" }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Edits / Updates (PUT/PATCH)" value={updates} valueStyle={{ color: "#1677ff" }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Deletes (DELETE)" value={deletes} valueStyle={{ color: "#ff4d4f" }} /></Card></Col>
      </Row>

      <Tabs
        items={[
          {
            key: "activity",
            label: <Space size={6}><HistoryOutlined /><span>Admin Actions (Create / Edit / Delete)</span></Space>,
            children: (
              <Card>
                <Space wrap style={{ marginBottom: 14 }}>
                  <Select
                    style={{ width: 150 }}
                    value={actionFilter}
                    onChange={setActionFilter}
                    options={[
                      { value: "ALL", label: "All Actions" },
                      { value: "CREATE", label: "CREATE" },
                      { value: "UPDATE", label: "UPDATE / EDIT" },
                      { value: "DELETE", label: "DELETE" },
                    ]}
                  />
                  <Select
                    style={{ width: 180 }}
                    value={moduleFilter}
                    onChange={setModuleFilter}
                    options={[
                      { value: "ALL", label: "All Modules" },
                      "MOVIES",
                      "SERIES",
                      "LIVE",
                      "PLANS",
                      "USERS",
                      "BANNERS",
                      "CMS",
                      "COUPONS",
                      "SETTINGS",
                      "PLATFORM",
                      "SECURITY",
                      "NOTIFICATIONS",
                      "PRODUCERS",
                      "MARKETING",
                      "BACKUP",
                    ].map((m) => (typeof m === "string" ? { value: m, label: m } : m))}
                  />
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="Search actor, path, module..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onPressEnter={loadAll}
                    style={{ width: 260 }}
                  />
                  <Button type="primary" onClick={loadAll}>Filter</Button>
                </Space>

                <Table
                  rowKey="id"
                  loading={loading}
                  dataSource={activityLogs}
                  size="small"
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: "No admin create/edit/delete actions captured yet." }}
                  columns={[
                    {
                      title: "Action",
                      dataIndex: "action",
                      width: 100,
                      render: (v) => (
                        <Tag color={v === "CREATE" ? "green" : v === "DELETE" ? "red" : "blue"}>
                          {v || "ACTION"}
                        </Tag>
                      ),
                    },
                    { title: "Module", dataIndex: "module", width: 130, render: (v) => <Tag color="purple">{v}</Tag> },
                    {
                      title: "Endpoint",
                      render: (_: any, r: any) => (
                        <Text code style={{ fontSize: 12 }}>
                          {r.method} {r.path}
                        </Text>
                      ),
                    },
                    { title: "Actor", dataIndex: "actorEmail", width: 190, ellipsis: true },
                    {
                      title: "Status",
                      dataIndex: "status",
                      width: 90,
                      render: (v) => (
                        <Tag color={Number(v) >= 400 ? "red" : "green"}>{v}</Tag>
                      ),
                    },
                    { title: "Latency", dataIndex: "latencyMs", width: 85, render: (v) => `${v ?? 0}ms` },
                    {
                      title: "Time",
                      dataIndex: "createdAt",
                      width: 170,
                      render: (v) => (v ? new Date(v).toLocaleString() : "-"),
                    },
                    {
                      title: "View",
                      width: 80,
                      render: (_: any, r: any) => (
                        <Button size="small" icon={<EyeOutlined />} onClick={() => setInspectRow(r)}>
                          View
                        </Button>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "service-logs",
            label: <Space size={6}><FileSearchOutlined /><span>Microservice Logs ({serviceLogs.length})</span></Space>,
            children: (
              <Card
                extra={
                  <Select
                    style={{ width: 150 }}
                    value={logLevel}
                    onChange={setLogLevel}
                    options={[
                      { value: "", label: "All Levels" },
                      { value: "ERROR", label: "ERROR" },
                      { value: "WARN", label: "WARN" },
                      { value: "INFO", label: "INFO" },
                    ]}
                  />
                }
              >
                <Table
                  rowKey={(r, i) => String(r.id || i)}
                  loading={loading}
                  dataSource={serviceLogs}
                  size="small"
                  columns={[
                    { title: "Service", dataIndex: "service", width: 150, render: (v) => <Tag color="geekblue">{v}</Tag> },
                    {
                      title: "Level",
                      dataIndex: "level",
                      width: 85,
                      render: (v) => {
                        const lv = String(v || "INFO").toUpperCase();
                        return <Tag color={lv === "ERROR" ? "red" : lv === "WARN" ? "orange" : "blue"}>{lv}</Tag>;
                      },
                    },
                    { title: "Message", dataIndex: "message", ellipsis: true },
                    { title: "Time", dataIndex: "createdAt", width: 170, render: (v) => (v ? new Date(v).toLocaleString() : "-") },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Drawer
        title={inspectRow ? `Action Detail #${inspectRow.id} — ${inspectRow.action} ${inspectRow.module}` : "Action Detail"}
        open={Boolean(inspectRow)}
        onClose={() => setInspectRow(null)}
        width={600}
      >
        {inspectRow && (
          <div>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Action">
                <Tag color={inspectRow.action === "CREATE" ? "green" : inspectRow.action === "DELETE" ? "red" : "blue"}>
                  {inspectRow.action}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Module">{inspectRow.module}</Descriptions.Item>
              <Descriptions.Item label="Endpoint"><code>{inspectRow.method} {inspectRow.path}</code></Descriptions.Item>
              <Descriptions.Item label="Actor">{inspectRow.actorEmail} (ID: {inspectRow.actorId || "-"})</Descriptions.Item>
              <Descriptions.Item label="Client IP">{inspectRow.ip || "-"}</Descriptions.Item>
              <Descriptions.Item label="HTTP Status / Latency">{inspectRow.status} ({inspectRow.latencyMs}ms)</Descriptions.Item>
              <Descriptions.Item label="Timestamp">{inspectRow.createdAt ? new Date(inspectRow.createdAt).toLocaleString() : "-"}</Descriptions.Item>
            </Descriptions>
            <Title level={5}>Sanitized Request Payload</Title>
            <pre
              style={{
                background: "#0d0f17",
                border: "1px solid #1e2230",
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                overflowX: "auto",
                maxHeight: 340,
              }}
            >
              {formatPayload(inspectRow.payload)}
            </pre>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AdminAuditLogPage;
