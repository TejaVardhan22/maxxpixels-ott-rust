import React, { useEffect, useState } from "react";
import {
  Card,
  Tabs,
  Table,
  Checkbox,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  Input,
  InputNumber,
  Form,
  Switch,
  Popconfirm,
  Typography,
  Spin,
  message,
} from "antd";
import {
  SaveOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  AppstoreOutlined,
  TeamOutlined,
  LockOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";

const { Title, Text } = Typography;

interface PermissionMatrixRow {
  permissionCode: string;
  category: string;
  description: string;
  superAdmin: boolean;
  admin: boolean;
  contentManager: boolean;
  producer: boolean;
  finance: boolean;
  analyst: boolean;
}

interface RoleDto {
  id: number | string;
  code: string;
  name: string;
  description: string;
  userCount: number;
  systemRole: boolean;
}

const DEFAULT_ROLES: RoleDto[] = [
  { id: 1, code: "ROLE_SUPER_ADMIN", name: "Super Administrator", description: "Full unrestricted root access to all OTT modules and security policies", userCount: 2, systemRole: true },
  { id: 2, code: "ROLE_ADMIN", name: "Platform Administrator", description: "Manages movies, web series, producer approvals, and system users", userCount: 5, systemRole: true },
  { id: 3, code: "ROLE_CONTENT_MANAGER", name: "Content Operations Manager", description: "Manages catalog titles, transcode queues, and Home CMS rails", userCount: 8, systemRole: true },
  { id: 4, code: "ROLE_PRODUCER", name: "Studio Content Producer", description: "Producer portal access to view studio performance, payout details, and analytics", userCount: 14, systemRole: true },
  { id: 5, code: "ROLE_FINANCE", name: "Finance & Billing Specialist", description: "Manages subscription pricing, payment refunds, and revenue share payouts", userCount: 4, systemRole: true },
  { id: 6, code: "ROLE_ANALYST", name: "Business Intelligence Analyst", description: "View-only access to streaming analytics, SSAI ad metrics, and user growth", userCount: 6, systemRole: true },
];

const DEFAULT_MATRIX: PermissionMatrixRow[] = [
  { permissionCode: "CONTENT_VIEW", category: "CONTENT", description: "View movie, series, and live streaming catalog", superAdmin: true, admin: true, contentManager: true, producer: true, finance: false, analyst: true },
  { permissionCode: "CONTENT_CREATE", category: "CONTENT", description: "Upload master video files and submit metadata", superAdmin: true, admin: true, contentManager: true, producer: true, finance: false, analyst: false },
  { permissionCode: "CONTENT_UPDATE", category: "CONTENT", description: "Edit title metadata, genres, cast, and posters", superAdmin: true, admin: true, contentManager: true, producer: false, finance: false, analyst: false },
  { permissionCode: "CONTENT_APPROVE", category: "CONTENT", description: "Approve or reject producer submissions & initiate transcode", superAdmin: true, admin: true, contentManager: true, producer: false, finance: false, analyst: false },
  { permissionCode: "CONTENT_DELETE", category: "CONTENT", description: "Completely delete content entries and media assets", superAdmin: true, admin: true, contentManager: false, producer: false, finance: false, analyst: false },
  { permissionCode: "USER_VIEW", category: "USER", description: "View user directory and profile metadata", superAdmin: true, admin: true, contentManager: false, producer: false, finance: true, analyst: true },
  { permissionCode: "USER_MANAGE", category: "USER", description: "Ban/unban users, edit roles, and reset passwords", superAdmin: true, admin: true, contentManager: false, producer: false, finance: false, analyst: false },
  { permissionCode: "PRODUCER_ONBOARD", category: "USER", description: "Onboard producer studio and provision login account", superAdmin: true, admin: true, contentManager: false, producer: false, finance: false, analyst: false },
  { permissionCode: "PAYMENT_VIEW", category: "FINANCIAL", description: "View subscription transactions and revenue logs", superAdmin: true, admin: true, contentManager: false, producer: false, finance: true, analyst: true },
  { permissionCode: "PAYMENT_REFUND", category: "FINANCIAL", description: "Issue refunds for failed transactions", superAdmin: true, admin: true, contentManager: false, producer: false, finance: true, analyst: false },
  { permissionCode: "PRODUCER_PAYOUT", category: "FINANCIAL", description: "Process 70% revenue share bank payouts", superAdmin: true, admin: true, contentManager: false, producer: false, finance: true, analyst: false },
  { permissionCode: "SYSTEM_SECURITY", category: "SYSTEM", description: "Modify security settings, CIDR rules, and MFA policies", superAdmin: true, admin: false, contentManager: false, producer: false, finance: false, analyst: false },
  { permissionCode: "SYSTEM_AUDIT_LOGS", category: "SYSTEM", description: "Inspect immutable security audit logs", superAdmin: true, admin: true, contentManager: false, producer: false, finance: false, analyst: true },
];

export const RolesSecurityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("MATRIX");
  const [roles, setRoles] = useState<RoleDto[]>(DEFAULT_ROLES);
  const [matrix, setMatrix] = useState<PermissionMatrixRow[]>(DEFAULT_MATRIX);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [savingMatrix, setSavingMatrix] = useState(false);

  // Role form
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);
  const [roleCode, setRoleCode] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  // Security settings form
  const [secForm] = Form.useForm();
  const [savingSettings, setSavingSettings] = useState(false);
  const jwtHours = Form.useWatch("jwtExpirationHours", secForm) ?? 24;
  const mfaAdmin = Form.useWatch("enforceMfaAdmin", secForm) ?? true;

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadAll = async () => {
    try {
      const [rRes, mRes, sRes] = await Promise.all([
        apiGet("/admin/security/roles").catch(() => []),
        apiGet("/admin/security/matrix").catch(() => []),
        apiGet("/admin/security/settings").catch(() => ({})),
      ]);
      const rArr = extractArray<RoleDto>(rRes);
      if (rArr.length > 0) setRoles(rArr);
      const mArr = extractArray<PermissionMatrixRow>(mRes);
      if (mArr.length > 0) setMatrix(mArr);
      if (sRes && typeof sRes === "object" && !Array.isArray(sRes)) {
        secForm.setFieldsValue({
          jwtExpirationHours: 24,
          refreshTokenExpirationDays: 30,
          maxFailedLoginAttempts: 5,
          allowedIpCidrBlocks: "10.0.0.0/8, 192.168.1.0/24",
          enforceMfaAdmin: true,
          enforceMfaProducer: true,
          ...sRes,
        });
      }
    } catch (e: any) {
      message.error(e.message || "Failed to load RBAC security data");
    }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await apiGet("/admin/security/audit-logs");
      setAuditLogs(extractArray(res));
    } catch (e: any) {
      message.error(e.message || "Failed to load security audit logs");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    secForm.setFieldsValue({
      jwtExpirationHours: 24,
      refreshTokenExpirationDays: 30,
      maxFailedLoginAttempts: 5,
      allowedIpCidrBlocks: "10.0.0.0/8, 192.168.1.0/24",
      enforceMfaAdmin: true,
      enforceMfaProducer: true,
    });
    loadAll();
  }, []);

  const toggleMatrixCell = (permCode: string, field: keyof PermissionMatrixRow, val: boolean) => {
    setMatrix((prev) =>
      prev.map((row) => (row.permissionCode === permCode ? { ...row, [field]: val } : row))
    );
  };

  const saveMatrix = async () => {
    setSavingMatrix(true);
    try {
      await apiPut("/admin/security/matrix", matrix);
      message.success("Role Permission Matrix saved to security registry!");
    } catch (e: any) {
      message.error(e.message || "Failed to save permission matrix");
    } finally {
      setSavingMatrix(false);
    }
  };

  const openNewRole = () => {
    setEditingRole(null);
    setRoleCode("");
    setRoleDesc("");
    setShowRoleForm(true);
  };

  const openEditRole = (role: RoleDto) => {
    setEditingRole(role);
    setRoleCode(role.code);
    setRoleDesc(role.description || "");
    setShowRoleForm(true);
  };

  const saveRole = async () => {
    if (!roleCode.trim()) return;
    setSavingRole(true);
    try {
      const payload = { code: roleCode.trim(), name: roleCode.trim(), description: roleDesc.trim() };
      if (editingRole?.id) {
        await apiPut(`/admin/security/roles/${editingRole.id}`, payload);
        message.success("RBAC role updated!");
      } else {
        await apiPost("/admin/security/roles", payload);
        message.success("Custom RBAC role created!");
      }
      setShowRoleForm(false);
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to save role");
    } finally {
      setSavingRole(false);
    }
  };

  const deleteRole = async (role: RoleDto) => {
    try {
      await apiDelete(`/admin/security/roles/${role.id}`);
      message.success(`Role ${role.code} archived`);
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Unable to delete role");
    }
  };

  const saveSecuritySettings = async (values?: any) => {
    try {
      const dto = values || (await secForm.validateFields());
      setSavingSettings(true);
      await apiPut("/admin/security/settings", dto);
      message.success("System Security & MFA Policies saved and logged!");
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "Failed to save security policies");
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredMatrix = matrix.filter((r) => {
    const matchCat = categoryFilter === "ALL" || r.category === categoryFilter;
    const q = search.toLowerCase().trim();
    const matchQ =
      !q ||
      r.permissionCode.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const totalAssignedUsers = roles.reduce((sum, r) => sum + (Number(r.userCount) || 0), 0);

  return (
    <div>
      {/* 1. EXECUTIVE HEADER */}
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
          <Tag color="blue" style={{ marginBottom: 6 }}>SYSTEM SECURITY &amp; ACCESS CONTROL</Tag>
          <Title level={3} style={{ margin: "0 0 4px" }}>
            RBAC Role Permission Matrix &amp; Security Policies
          </Title>
          <Text type="secondary">
            Super Admin control over system roles, granular module permissions, JWT authentication, and MFA enforcement
          </Text>
        </div>
        <Space>
          {activeTab === "MATRIX" && (
            <Button type="primary" icon={<SaveOutlined />} loading={savingMatrix} onClick={saveMatrix}>
              Save Permission Matrix
            </Button>
          )}
          {activeTab === "ROLES" && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openNewRole}>
              Create Custom Role
            </Button>
          )}
          {activeTab === "SETTINGS" && (
            <Button type="primary" icon={<SafetyCertificateOutlined />} loading={savingSettings} onClick={() => saveSecuritySettings()}>
              Save Security Policies
            </Button>
          )}
          {activeTab === "AUDIT" && (
            <Button type="primary" icon={<ReloadOutlined />} onClick={loadAudit}>
              Refresh Audit Log
            </Button>
          )}
        </Space>
      </div>

      {/* 2. EXECUTIVE KPI CARDS */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Active RBAC Roles" value={`${roles.length} Roles`} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Active Permissions" value={`${matrix.length} Module Keys`} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Assigned Accounts" value={totalAssignedUsers} /></Card></Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Security Protocol" value={`JWT ${jwtHours}h • ${mfaAdmin ? "MFA ON" : "MFA OFF"}`} />
          </Card>
        </Col>
      </Row>

      {/* 3. TABS */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k);
          if (k === "AUDIT") loadAudit();
        }}
        items={[
          {
            key: "MATRIX",
            label: <Space size={6}><AppstoreOutlined /><span>Role Permission Matrix</span></Space>,
            children: (
              <div>
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
                    <Space wrap size={6}>
                      <Text strong style={{ fontSize: 12 }}>Module Category:</Text>
                      {[
                        { k: "ALL", l: "All Modules" },
                        { k: "CONTENT", l: "🎬 Content" },
                        { k: "USER", l: "👥 Users & Producers" },
                        { k: "FINANCIAL", l: "💰 Financial & Payouts" },
                        { k: "SYSTEM", l: "⚙️ System Security" },
                      ].map((c) => (
                        <Button key={c.k} size="small" type={categoryFilter === c.k ? "primary" : "default"} onClick={() => setCategoryFilter(c.k)}>
                          {c.l}
                        </Button>
                      ))}
                    </Space>
                    <Input
                      size="small"
                      prefix={<SearchOutlined />}
                      placeholder="Search permission code..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ width: 240 }}
                    />
                  </Space>
                </Card>

                <Card>
                  <Table
                    rowKey="permissionCode"
                    dataSource={filteredMatrix}
                    pagination={false}
                    scroll={{ x: 860 }}
                    columns={[
                      {
                        title: "Permission Code & Scope",
                        width: 320,
                        render: (_: any, r: PermissionMatrixRow) => (
                          <div>
                            <Space size={6}>
                              <Text code strong>{r.permissionCode}</Text>
                              <Tag color={r.category === "FINANCIAL" ? "green" : r.category === "SYSTEM" ? "purple" : "blue"}>
                                {r.category}
                              </Tag>
                            </Space>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>{r.description}</div>
                          </div>
                        ),
                      },
                      {
                        title: "Super Admin",
                        align: "center",
                        render: (_: any, r: PermissionMatrixRow) => <Checkbox checked={r.superAdmin} disabled />,
                      },
                      {
                        title: "Admin",
                        align: "center",
                        render: (_: any, r: PermissionMatrixRow) => (
                          <Checkbox checked={r.admin} onChange={(e) => toggleMatrixCell(r.permissionCode, "admin", e.target.checked)} />
                        ),
                      },
                      {
                        title: "Content Mgr",
                        align: "center",
                        render: (_: any, r: PermissionMatrixRow) => (
                          <Checkbox checked={r.contentManager} onChange={(e) => toggleMatrixCell(r.permissionCode, "contentManager", e.target.checked)} />
                        ),
                      },
                      {
                        title: "Producer",
                        align: "center",
                        render: (_: any, r: PermissionMatrixRow) => (
                          <Checkbox checked={r.producer} onChange={(e) => toggleMatrixCell(r.permissionCode, "producer", e.target.checked)} />
                        ),
                      },
                      {
                        title: "Finance",
                        align: "center",
                        render: (_: any, r: PermissionMatrixRow) => (
                          <Checkbox checked={r.finance} onChange={(e) => toggleMatrixCell(r.permissionCode, "finance", e.target.checked)} />
                        ),
                      },
                      {
                        title: "Analyst",
                        align: "center",
                        render: (_: any, r: PermissionMatrixRow) => (
                          <Checkbox checked={r.analyst} onChange={(e) => toggleMatrixCell(r.permissionCode, "analyst", e.target.checked)} />
                        ),
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: "ROLES",
            label: <Space size={6}><TeamOutlined /><span>System Roles Directory</span></Space>,
            children: (
              <div>
                {showRoleForm && (
                  <Card
                    title={editingRole ? "Edit RBAC Role" : "Create Custom RBAC Role"}
                    style={{ marginBottom: 16 }}
                  >
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 6 }}>Role Code (e.g. ROLE_MODERATOR)</div>
                        <Input
                          value={roleCode}
                          disabled={Boolean(editingRole?.systemRole)}
                          onChange={(e) => setRoleCode(e.target.value)}
                          placeholder="ROLE_MODERATOR"
                        />
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 6 }}>Role Description</div>
                        <Input
                          value={roleDesc}
                          onChange={(e) => setRoleDesc(e.target.value)}
                          placeholder="Describe permissions and scope"
                        />
                      </Col>
                    </Row>
                    <Space style={{ marginTop: 14, justifyContent: "flex-end", width: "100%" }}>
                      <Button onClick={() => setShowRoleForm(false)}>Cancel</Button>
                      <Button type="primary" loading={savingRole} disabled={!roleCode.trim()} onClick={saveRole}>
                        {editingRole ? "Update Role" : "Create Role"}
                      </Button>
                    </Space>
                  </Card>
                )}

                <Row gutter={[16, 16]}>
                  {roles.map((role) => (
                    <Col xs={24} md={12} lg={8} key={String(role.id || role.code)}>
                      <Card
                        title={
                          <div>
                            <div style={{ fontWeight: 700 }}>{role.name || role.code}</div>
                            <Text code style={{ fontSize: 11 }}>{role.code}</Text>
                          </div>
                        }
                        extra={
                          <Space size={4}>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openEditRole(role)} />
                            {!role.systemRole && (
                              <Popconfirm title={`Delete role ${role.code}?`} onConfirm={() => deleteRole(role)}>
                                <Button size="small" danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            )}
                          </Space>
                        }
                      >
                        <Text type="secondary" style={{ display: "block", minHeight: 42, marginBottom: 12 }}>
                          {role.description || "Custom platform role"}
                        </Text>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Tag color="blue">{role.userCount ?? 0} Users Assigned</Tag>
                          <Tag color={role.systemRole ? "green" : "cyan"}>
                            {role.systemRole ? "System Protected" : "Custom Role"}
                          </Tag>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            ),
          },
          {
            key: "SETTINGS",
            label: <Space size={6}><LockOutlined /><span>Security &amp; MFA Policies</span></Space>,
            children: (
              <Card title="System Authentication & MFA Enforcement Rules">
                <Form form={secForm} layout="vertical" onFinish={saveSecuritySettings}>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="jwtExpirationHours" label="JWT Access Token Expiration (Hours)" rules={[{ required: true }]}>
                        <InputNumber min={1} max={720} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="refreshTokenExpirationDays" label="Refresh Token Expiration (Days)" rules={[{ required: true }]}>
                        <InputNumber min={1} max={365} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="maxFailedLoginAttempts" label="Max Failed Login Attempts Before Lockout" rules={[{ required: true }]}>
                        <InputNumber min={1} max={50} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="allowedIpCidrBlocks" label="Allowed Admin IP CIDR Blocks" rules={[{ required: true }]}>
                        <Input placeholder="10.0.0.0/8, 192.168.1.0/24" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Card size="small" title="MFA & Two-Factor Enforcement Rules" style={{ marginBottom: 16 }}>
                    <Form.Item
                      name="enforceMfaAdmin"
                      label="Enforce MFA for Administrators & Staff (ROLE_ADMIN / ROLE_SUPER_ADMIN)"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      name="enforceMfaProducer"
                      label="Enforce MFA for Content Producers (studio payout access)"
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}
                    >
                      <Switch />
                    </Form.Item>
                  </Card>

                  <Button type="primary" htmlType="submit" block size="large" icon={<SafetyCertificateOutlined />} loading={savingSettings}>
                    Save &amp; Apply Security Policy Rules
                  </Button>
                </Form>
              </Card>
            ),
          },
          {
            key: "AUDIT",
            label: <Space size={6}><HistoryOutlined /><span>Security Audit Trail</span></Space>,
            children: (
              <Card title="Security, RBAC & Configuration Audit Trail">
                <Spin spinning={auditLoading}>
                  {auditLogs.length === 0 ? (
                    <Text type="secondary">
                      No security audit events recorded yet. Role, matrix, and policy changes will appear here automatically.
                    </Text>
                  ) : (
                    <Space direction="vertical" style={{ width: "100%" }}>
                      {auditLogs.map((log: any, idx: number) => (
                        <Card
                          key={String(log.id || idx)}
                          size="small"
                          title={<Tag color="blue">{log.action || log.settingKey || "SECURITY_EVENT"}</Tag>}
                          extra={
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              by <strong>{log.userEmail || log.changedBy || "admin"}</strong>
                              {log.createdAt ? ` • ${new Date(log.createdAt).toLocaleString()}` : ""}
                            </Text>
                          }
                        >
                          <Text code style={{ fontSize: 12 }}>
                            {log.details || log.target || `${log.oldValue ?? ""} → ${log.newValue ?? ""}`}
                          </Text>
                        </Card>
                      ))}
                    </Space>
                  )}
                </Spin>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default RolesSecurityPage;
