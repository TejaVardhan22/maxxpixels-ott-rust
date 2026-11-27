import React, { useEffect, useState } from "react";
import {
  Card,
  Tabs,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  Popconfirm,
  Typography,
  message,
} from "antd";
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";

const { Title, Text } = Typography;

export const SettingsSecurityPage: React.FC<{ defaultTab?: string }> = ({ defaultTab = "settings" }) => {
  const [loading, setLoading] = useState(false);
  const [settingsMap, setSettingsMap] = useState<Record<string, any>>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [drmRules, setDrmRules] = useState<any[]>([]);

  const [settingModal, setSettingModal] = useState<{ open: boolean; key?: string; value?: string }>({ open: false });
  const [settingForm] = Form.useForm();

  const [drmOpen, setDrmOpen] = useState(false);
  const [editingDrm, setEditingDrm] = useState<any>(null);
  const [drmForm] = Form.useForm();

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, aRes, rRes, dRes] = await Promise.all([
        apiGet("/admin/settings").catch(() => ({})),
        apiGet("/admin/audit-logs").catch(() => []),
        apiGet("/admin/security/roles").catch(() => []),
        apiGet("/admin/drm/rules").catch(() => []),
      ]);
      if (sRes && typeof sRes === "object" && !Array.isArray(sRes)) {
        setSettingsMap(sRes);
      } else if (Array.isArray(sRes)) {
        const mapped: Record<string, any> = {};
        sRes.forEach((item: any) => {
          if (item?.key) mapped[item.key] = item.value;
        });
        setSettingsMap(mapped);
      }
      setAuditLogs(extractArray(aRes));
      setRoles(extractArray(rRes));
      setDrmRules(extractArray(dRes));
    } catch (e: any) {
      message.error(e.message || "Failed to load settings & security");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openSettingEdit = (k?: string, v?: any) => {
    settingForm.resetFields();
    settingForm.setFieldsValue({
      key: k || "",
      value: v !== undefined ? (typeof v === "object" ? JSON.stringify(v) : String(v)) : "",
    });
    setSettingModal({ open: true, key: k });
  };

  const saveSetting = async () => {
    try {
      const { key, value } = await settingForm.validateFields();
      await apiPut(`/admin/settings/key/${encodeURIComponent(key)}`, { value });
      message.success(`Setting "${key}" saved`);
      setSettingModal({ open: false });
      loadAll();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "Failed to save setting");
    }
  };

  const deleteSetting = async (key: string) => {
    try {
      await apiDelete(`/admin/settings/key/${encodeURIComponent(key)}`);
      message.success("Setting deleted");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to delete setting");
    }
  };

  const openDrmModal = (rec?: any) => {
    setEditingDrm(rec || null);
    drmForm.resetFields();
    if (rec) {
      drmForm.setFieldsValue(rec);
    } else {
      drmForm.setFieldsValue({ isActive: true, allowScreenCapture: false, watermarkEnabled: true });
    }
    setDrmOpen(true);
  };

  const saveDrm = async () => {
    try {
      const values = await drmForm.validateFields();
      if (editingDrm?.id) {
        await apiPut(`/admin/drm/rules/${editingDrm.id}`, values);
        message.success("DRM rule updated");
      } else {
        await apiPost("/admin/drm/rules", values);
        message.success("DRM rule created");
      }
      setDrmOpen(false);
      loadAll();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "Failed to save DRM rule");
    }
  };

  const deleteDrm = async (id: string) => {
    try {
      await apiDelete(`/admin/drm/rules/${id}`);
      message.success("DRM rule deleted");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to delete DRM rule");
    }
  };

  const settingsRows = Object.entries(settingsMap).map(([key, value]) => ({
    key,
    value: typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Settings, Security, Audit & DRM</Title>
        <Button icon={<ReloadOutlined />} onClick={loadAll}>
          Refresh
        </Button>
      </div>

      <Tabs
        key={defaultTab}
        defaultActiveKey={defaultTab}
        items={[
          {
            key: "settings",
            label: `System Settings (${settingsRows.length})`,
            children: (
              <Card
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openSettingEdit()}>
                    Add / Update Key
                  </Button>
                }
              >
                <Table
                  rowKey="key"
                  loading={loading}
                  dataSource={settingsRows}
                  size="small"
                  columns={[
                    { title: "Key", dataIndex: "key", width: 260, render: (v) => <Text code>{v}</Text> },
                    { title: "Value", dataIndex: "value", ellipsis: true },
                    {
                      title: "Actions",
                      width: 110,
                      render: (_: any, r: any) => (
                        <Space>
                          <Button size="small" icon={<EditOutlined />} onClick={() => openSettingEdit(r.key, r.value)} />
                          <Popconfirm title="Delete setting?" onConfirm={() => deleteSetting(r.key)}>
                            <Button size="small" danger icon={<DeleteOutlined />} />
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
            key: "audit",
            label: `Audit Logs (${auditLogs.length})`,
            children: (
              <Card>
                <Table
                  rowKey={(r) => String(r.id || Math.random())}
                  loading={loading}
                  dataSource={auditLogs}
                  size="small"
                  columns={[
                    { title: "Key / Resource", dataIndex: "settingKey", render: (v, r) => v || r.resource || r.action },
                    { title: "Old Value", dataIndex: "oldValue", ellipsis: true },
                    { title: "New Value", dataIndex: "newValue", ellipsis: true },
                    { title: "Changed By", dataIndex: "changedBy", width: 160 },
                    {
                      title: "Timestamp",
                      dataIndex: "createdAt",
                      width: 180,
                      render: (v) => (v ? new Date(v).toLocaleString() : "-"),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "roles",
            label: `RBAC Roles (${roles.length})`,
            children: (
              <Card>
                <Table
                  rowKey={(r) => String(r.id || r.name)}
                  loading={loading}
                  dataSource={roles}
                  columns={[
                    { title: "Role", dataIndex: "name", render: (v) => <Tag color="blue">{v}</Tag> },
                    { title: "Description", dataIndex: "description" },
                    {
                      title: "Permissions",
                      dataIndex: "permissions",
                      render: (v) =>
                        Array.isArray(v)
                          ? v.slice(0, 6).map((p: string) => <Tag key={p}>{p}</Tag>)
                          : String(v || "-"),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "drm",
            label: `DRM Rules (${drmRules.length})`,
            children: (
              <Card
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrmModal()}>
                    Add DRM Rule
                  </Button>
                }
              >
                <Table
                  rowKey={(r) => String(r.id || r.name)}
                  loading={loading}
                  dataSource={drmRules}
                  columns={[
                    { title: "Rule Name", dataIndex: "name" },
                    { title: "Provider / Scope", dataIndex: "provider", render: (v, r) => v || r.scope || "Widevine/FairPlay" },
                    {
                      title: "Watermark",
                      dataIndex: "watermarkEnabled",
                      render: (v) => <Tag color={v ? "green" : "default"}>{v ? "Enabled" : "Off"}</Tag>,
                    },
                    {
                      title: "Status",
                      dataIndex: "isActive",
                      render: (v) => <Tag color={v !== false ? "green" : "default"}>{v !== false ? "Active" : "Off"}</Tag>,
                    },
                    {
                      title: "Actions",
                      width: 110,
                      render: (_: any, r: any) => (
                        <Space>
                          <Button size="small" icon={<EditOutlined />} onClick={() => openDrmModal(r)} />
                          <Popconfirm title="Delete DRM rule?" onConfirm={() => deleteDrm(r.id)}>
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={settingModal.key ? `Edit Setting: ${settingModal.key}` : "Add Setting"}
        open={settingModal.open}
        onOk={saveSetting}
        okText="Save"
        okButtonProps={{ icon: <SaveOutlined /> }}
        onCancel={() => setSettingModal({ open: false })}
      >
        <Form form={settingForm} layout="vertical">
          <Form.Item name="key" label="Setting Key" rules={[{ required: true }]}>
            <Input disabled={Boolean(settingModal.key)} placeholder="site.name" />
          </Form.Item>
          <Form.Item name="value" label="Value" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingDrm ? "Edit DRM Rule" : "Add DRM Rule"}
        open={drmOpen}
        onOk={saveDrm}
        onCancel={() => setDrmOpen(false)}
      >
        <Form form={drmForm} layout="vertical">
          <Form.Item name="name" label="Rule Name" rules={[{ required: true }]}>
            <Input placeholder="4K Premium Widevine L1" />
          </Form.Item>
          <Form.Item name="provider" label="DRM Provider">
            <Input placeholder="WIDEVINE / FAIRPLAY / PLAYREADY" />
          </Form.Item>
          <Space size="large">
            <Form.Item name="watermarkEnabled" label="Watermark" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="allowScreenCapture" label="Allow Screen Capture" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default SettingsSecurityPage;
