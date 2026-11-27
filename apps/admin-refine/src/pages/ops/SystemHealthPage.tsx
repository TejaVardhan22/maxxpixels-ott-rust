import React, { useEffect, useState } from "react";
import {
  Card,
  Tabs,
  Table,
  Button,
  Tag,
  Space,
  Select,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  message,
} from "antd";
import {
  ReloadOutlined,
  CloudDownloadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  RedoOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiDelete, extractArray, API_BASE } from "../../providers/api";

const { Title, Text } = Typography;

export const SystemHealthPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [migrations, setMigrations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<any[]>([]);
  const [logLevel, setLogLevel] = useState<string>("");
  const [outboxStatus, setOutboxStatus] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const logQuery = logLevel ? `?level=${logLevel}&limit=100` : "?limit=100";
      const outboxQuery = outboxStatus ? `?status=${outboxStatus}&limit=100` : "?limit=100";
      const [bRes, mRes, lRes, oRes] = await Promise.all([
        apiGet("/admin/backup/list").catch(() => []),
        apiGet("/admin/backup/migrations").catch(() => []),
        apiGet(`/admin/logs${logQuery}`).catch(() => []),
        apiGet(`/admin/outbox${outboxQuery}`).catch(() => []),
      ]);
      setBackups(extractArray(bRes));
      setMigrations(extractArray(mRes));
      setLogs(extractArray(lRes));
      setOutbox(extractArray(oRes));
    } catch (e: any) {
      message.error(e.message || "Failed to load system health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [logLevel, outboxStatus]);

  const triggerBackup = async () => {
    setExporting(true);
    try {
      await apiPost("/admin/backup/export");
      message.success("Database backup exported");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Backup export failed");
    } finally {
      setExporting(false);
    }
  };

  const deleteBackup = async (filename: string) => {
    try {
      await apiDelete(`/admin/backup/${encodeURIComponent(filename)}`);
      message.success("Backup deleted");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to delete backup");
    }
  };

  const retryOutbox = async () => {
    setRetrying(true);
    try {
      await apiPost("/admin/outbox/retry");
      message.success("Failed outbox events queued for retry");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  const failedOutboxCount = outbox.filter((e) => e.status === "FAILED").length;
  const errorLogsCount = logs.filter((l) => (l.level || "").toUpperCase() === "ERROR").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>System Health, Backups, Logs & Outbox</Title>
        <Space>
          <Button type="primary" icon={<DatabaseOutlined />} loading={exporting} onClick={triggerBackup}>
            Export DB Backup
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadAll}>
            Refresh
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Backups Stored" value={backups.length} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Goose Migrations"
              value={migrations.length}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Recent Error Logs"
              value={errorLogsCount}
              valueStyle={{ color: errorLogsCount > 0 ? "#ff4d4f" : "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Failed Outbox Events"
              value={failedOutboxCount}
              valueStyle={{ color: failedOutboxCount > 0 ? "#ff4d4f" : "#52c41a" }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: "backups",
            label: `Backups (${backups.length})`,
            children: (
              <Card>
                <Table
                  rowKey={(r) => r.filename || r.name || String(Math.random())}
                  loading={loading}
                  dataSource={backups}
                  columns={[
                    { title: "Filename", dataIndex: "filename", render: (v, r) => v || r.name },
                    {
                      title: "Size",
                      dataIndex: "size",
                      width: 120,
                      render: (v) => (v ? `${(v / 1024).toFixed(1)} KB` : "-"),
                    },
                    {
                      title: "Created",
                      dataIndex: "createdAt",
                      width: 200,
                      render: (v, r) => {
                        const d = v || r.modTime || r.modifiedAt;
                        return d ? new Date(d).toLocaleString() : "-";
                      },
                    },
                    {
                      title: "Actions",
                      width: 160,
                      render: (_: any, r: any) => {
                        const fn = r.filename || r.name;
                        return (
                          <Space>
                            <Button
                              size="small"
                              icon={<CloudDownloadOutlined />}
                              href={`${API_BASE}/admin/backup/download/${encodeURIComponent(fn)}`}
                              target="_blank"
                            >
                              Download
                            </Button>
                            <Popconfirm title="Delete backup?" onConfirm={() => deleteBackup(fn)}>
                              <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        );
                      },
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "migrations",
            label: `DB Migrations (${migrations.length})`,
            children: (
              <Card>
                <Table
                  rowKey={(r) => String(r.version_id || r.version || r.id || Math.random())}
                  loading={loading}
                  dataSource={migrations}
                  columns={[
                    { title: "Version", dataIndex: "version_id", render: (v, r) => v ?? r.version ?? r.id },
                    { title: "Description / Script", dataIndex: "description", render: (v, r) => v || r.script || "Goose migration" },
                    {
                      title: "Status",
                      dataIndex: "is_applied",
                      width: 120,
                      render: (v) => <Tag color={v === false ? "orange" : "green"}>{v === false ? "Pending" : "Applied"}</Tag>,
                    },
                    {
                      title: "Applied At",
                      dataIndex: "tstamp",
                      width: 200,
                      render: (v, r) => {
                        const d = v || r.installed_on || r.appliedAt;
                        return d ? new Date(d).toLocaleString() : "-";
                      },
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "logs",
            label: `Service Logs (${logs.length})`,
            children: (
              <Card
                extra={
                  <Select
                    style={{ width: 150 }}
                    value={logLevel}
                    onChange={setLogLevel}
                    options={[
                      { value: "", label: "All Levels" },
                      { value: "INFO", label: "INFO" },
                      { value: "WARN", label: "WARN" },
                      { value: "ERROR", label: "ERROR" },
                    ]}
                  />
                }
              >
                <Table
                  rowKey={(r) => String(r.id || Math.random())}
                  loading={loading}
                  dataSource={logs}
                  size="small"
                  columns={[
                    { title: "Service", dataIndex: "service", width: 150, render: (v) => <Tag color="geekblue">{v}</Tag> },
                    {
                      title: "Level",
                      dataIndex: "level",
                      width: 90,
                      render: (v) => {
                        const lv = (v || "INFO").toUpperCase();
                        return <Tag color={lv === "ERROR" ? "red" : lv === "WARN" ? "orange" : "blue"}>{lv}</Tag>;
                      },
                    },
                    { title: "Message", dataIndex: "message", ellipsis: true },
                    { title: "Trace ID", dataIndex: "traceId", width: 160, ellipsis: true },
                    {
                      title: "Time",
                      dataIndex: "createdAt",
                      width: 180,
                      render: (v) => <Text type="secondary">{v ? new Date(v).toLocaleString() : "-"}</Text>,
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "outbox",
            label: `Transactional Outbox (${outbox.length})`,
            children: (
              <Card
                extra={
                  <Space>
                    <Select
                      style={{ width: 150 }}
                      value={outboxStatus}
                      onChange={setOutboxStatus}
                      options={[
                        { value: "", label: "All Statuses" },
                        { value: "PENDING", label: "PENDING" },
                        { value: "PUBLISHED", label: "PUBLISHED" },
                        { value: "FAILED", label: "FAILED" },
                      ]}
                    />
                    <Button icon={<RedoOutlined />} loading={retrying} onClick={retryOutbox}>
                      Retry Failed
                    </Button>
                  </Space>
                }
              >
                <Table
                  rowKey={(r) => String(r.id || Math.random())}
                  loading={loading}
                  dataSource={outbox}
                  size="small"
                  columns={[
                    { title: "Topic", dataIndex: "topic", width: 180, render: (v) => <Tag color="purple">{v}</Tag> },
                    { title: "Event Type", dataIndex: "eventType", width: 180 },
                    {
                      title: "Status",
                      dataIndex: "status",
                      width: 110,
                      render: (v) => (
                        <Tag color={v === "PUBLISHED" ? "green" : v === "FAILED" ? "red" : "orange"}>{v}</Tag>
                      ),
                    },
                    { title: "Attempts", dataIndex: "attempts", width: 90 },
                    { title: "Last Error", dataIndex: "lastError", ellipsis: true },
                    {
                      title: "Created",
                      dataIndex: "createdAt",
                      width: 180,
                      render: (v) => <Text type="secondary">{v ? new Date(v).toLocaleString() : "-"}</Text>,
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default SystemHealthPage;
