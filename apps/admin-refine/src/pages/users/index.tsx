import React, { useEffect, useState } from "react";
import { Card, Tabs, Table, Button, Space, Tag, Input, Modal, Form, Popconfirm, message, Typography } from "antd";
import { SearchOutlined, ReloadOutlined, KeyOutlined, StopOutlined, LaptopOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, extractArray } from "../../providers/api";

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pwModal, setPwModal] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([
        apiGet(`/admin/users?size=100${search ? `&search=${encodeURIComponent(search)}` : ""}`),
        apiGet("/admin/notifications/devices").catch(() => []),
      ]);
      setUsers(extractArray(u));
      setDevices(extractArray(d));
    } catch (e: any) {
      message.error(e?.message || "Failed loading users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggleStatus = async (u: any) => {
    const next = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await apiPut(`/admin/users/${u.id}/status`, { status: next });
      message.success(`User marked ${next}`);
      load();
    } catch (e: any) {
      message.error(e?.message || "Status update failed");
    }
  };

  const handleRevokeDevices = async (u: any) => {
    try {
      await apiPost(`/admin/users/${u.id}/revoke-devices`, {});
      message.success("All user devices & sessions revoked");
      load();
    } catch (e: any) {
      message.error(e?.message || "Failed revoking devices");
    }
  };

  const handleResetPw = async (vals: any) => {
    try {
      await apiPost(`/admin/users/${pwModal.id}/reset-password`, { password: vals.password });
      message.success("Password updated");
      setPwModal(null);
      form.resetFields();
    } catch (e: any) {
      message.error(e?.message || "Password reset failed");
    }
  };

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>Users & Devices</Typography.Title>}
      extra={
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="Search email / phone / name..." value={search} onChange={(e) => setSearch(e.target.value)} onPressEnter={load} style={{ width: 240 }} />
          <Button icon={<ReloadOutlined />} onClick={load} />
        </Space>
      }
    >
      <Tabs
        items={[
          {
            key: "users",
            label: `Users (${users.length})`,
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={users}
                pagination={{ pageSize: 15 }}
                columns={[
                  { title: "ID", dataIndex: "id", width: 70 },
                  { title: "User", dataIndex: "fullName", render: (v, r) => <div><strong>{v || r.name || "—"}</strong><div style={{ fontSize: 12, opacity: 0.7 }}>{r.email || r.phoneNumber}</div></div> },
                  { title: "Roles", dataIndex: "roles", render: (roles) => (Array.isArray(roles) ? roles : []).map((rl: string) => <Tag key={rl} color="blue">{rl}</Tag>) },
                  { title: "Plan", dataIndex: "packageName", render: (v) => <Tag color="purple">{v || "Free"}</Tag> },
                  { title: "Status", dataIndex: "status", render: (v) => <Tag color={v === "ACTIVE" ? "green" : "red"}>{v || "ACTIVE"}</Tag> },
                  {
                    title: "Actions",
                    width: 240,
                    render: (_, r) => (
                      <Space>
                        <Button size="small" icon={<KeyOutlined />} onClick={() => setPwModal(r)}>Reset PW</Button>
                        <Popconfirm title="Revoke all devices & active streams?" onConfirm={() => handleRevokeDevices(r)}>
                          <Button size="small" icon={<LaptopOutlined />}>Logout All</Button>
                        </Popconfirm>
                        <Popconfirm title={`Set user ${r.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}?`} onConfirm={() => handleToggleStatus(r)}>
                          <Button size="small" danger={r.status === "ACTIVE"} icon={<StopOutlined />} />
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: "devices",
            label: `Registered Devices (${devices.length})`,
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={devices}
                pagination={{ pageSize: 15 }}
                columns={[
                  { title: "User ID", dataIndex: "userId", width: 90 },
                  { title: "Device", dataIndex: "deviceName", render: (v, r) => v || r.deviceModel || r.deviceId },
                  { title: "Type", dataIndex: "deviceType" },
                  { title: "Active", dataIndex: "isActive", render: (v) => <Tag color={v !== false ? "green" : "default"}>{v !== false ? "ACTIVE" : "REVOKED"}</Tag> },
                  { title: "Last Seen", dataIndex: "lastSeen" },
                ]}
              />
            ),
          },
        ]}
      />
      <Modal title={`Reset Password: ${pwModal?.email || pwModal?.id}`} open={Boolean(pwModal)} onCancel={() => setPwModal(null)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleResetPw}>
          <Form.Item name="password" label="New Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
