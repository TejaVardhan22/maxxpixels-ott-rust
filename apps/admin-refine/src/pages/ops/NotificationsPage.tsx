import React, { useEffect, useState } from "react";
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Select,
  Switch,
  InputNumber,
  Popconfirm,
  Typography,
  message,
} from "antd";
import {
  SendOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";

const { Title, Text } = Typography;

export const NotificationsPage: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [runningExpiry, setRunningExpiry] = useState(false);

  const [tplOpen, setTplOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<any>(null);
  const [tplForm] = Form.useForm();
  const [pushForm] = Form.useForm();
  const [smsForm] = Form.useForm();

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tRes, hRes] = await Promise.all([
        apiGet("/admin/notifications/templates").catch(() => []),
        apiGet("/admin/notifications/history").catch(() => []),
      ]);
      setTemplates(extractArray(tRes));
      setHistory(extractArray(hRes));
    } catch (e: any) {
      message.error(e.message || "Failed to load notifications data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const sendPush = async (values: any) => {
    setSending(true);
    try {
      if (values.userId) {
        await apiPost(`/admin/notifications/push/user/${values.userId}`, {
          title: values.title,
          body: values.body,
          imageUrl: values.imageUrl || undefined,
        });
      } else {
        await apiPost("/admin/notifications/push/topic", {
          topic: values.topic || "all",
          title: values.title,
          body: values.body,
          imageUrl: values.imageUrl || undefined,
        });
      }
      message.success("FCM push notification sent");
      pushForm.resetFields();
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to send push");
    } finally {
      setSending(false);
    }
  };

  const sendSMS = async (values: any) => {
    setSending(true);
    try {
      await apiPost("/admin/notifications/sms/send", values);
      message.success("SMS sent via MSG91");
      smsForm.resetFields();
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const runExpiryCheck = async () => {
    setRunningExpiry(true);
    try {
      const res = await apiPost("/admin/notifications/run-expiry-check");
      message.success(
        `Expiry check complete${res?.sent !== undefined ? ` (${res.sent} sent)` : ""}`
      );
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to run expiry check");
    } finally {
      setRunningExpiry(false);
    }
  };

  const openTplModal = (rec?: any) => {
    setEditingTpl(rec || null);
    tplForm.resetFields();
    if (rec) {
      tplForm.setFieldsValue(rec);
    } else {
      tplForm.setFieldsValue({
        channel: "PUSH",
        daysBeforeExpiry: 3,
        isActive: true,
      });
    }
    setTplOpen(true);
  };

  const saveTpl = async () => {
    try {
      const values = await tplForm.validateFields();
      if (editingTpl?.id) {
        await apiPut(`/admin/notifications/templates/${editingTpl.id}`, values);
        message.success("Template updated");
      } else {
        await apiPost("/admin/notifications/templates", values);
        message.success("Template created");
      }
      setTplOpen(false);
      loadAll();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "Failed to save template");
    }
  };

  const deleteTpl = async (id: string) => {
    try {
      await apiDelete(`/admin/notifications/templates/${id}`);
      message.success("Template deleted");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Failed to delete template");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Notifications & Expiry Templates</Title>
        <Space>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={runningExpiry}
            onClick={runExpiryCheck}
          >
            Run Plan Expiry Check
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadAll}>
            Refresh
          </Button>
        </Space>
      </div>

      <Tabs
        items={[
          {
            key: "templates",
            label: `Expiry & System Templates (${templates.length})`,
            children: (
              <Card
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openTplModal()}>
                    New Template
                  </Button>
                }
              >
                <Table
                  rowKey={(r) => r.id || r.code}
                  loading={loading}
                  dataSource={templates}
                  columns={[
                    { title: "Code", dataIndex: "code", render: (v) => <Tag color="blue">{v}</Tag> },
                    { title: "Title", dataIndex: "title" },
                    { title: "Body", dataIndex: "body", ellipsis: true },
                    {
                      title: "Trigger (Days)",
                      dataIndex: "daysBeforeExpiry",
                      width: 120,
                      render: (v) => (v !== undefined && v !== null ? `${v}d` : "-"),
                    },
                    { title: "Channel", dataIndex: "channel", width: 100, render: (v) => <Tag>{v || "PUSH"}</Tag> },
                    {
                      title: "Active",
                      dataIndex: "isActive",
                      width: 90,
                      render: (v) => <Tag color={v !== false ? "green" : "default"}>{v !== false ? "Active" : "Off"}</Tag>,
                    },
                    {
                      title: "Actions",
                      width: 110,
                      render: (_: any, r: any) => (
                        <Space>
                          <Button size="small" icon={<EditOutlined />} onClick={() => openTplModal(r)} />
                          <Popconfirm title="Delete template?" onConfirm={() => deleteTpl(r.id)}>
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
            key: "push",
            label: "Send FCM Push",
            children: (
              <Card style={{ maxWidth: 640 }}>
                <Form form={pushForm} layout="vertical" onFinish={sendPush} initialValues={{ topic: "all" }}>
                  <Form.Item name="topic" label="Topic (e.g. all, vip, android)">
                    <Input placeholder="all" />
                  </Form.Item>
                  <Form.Item name="userId" label="Or Specific User ID (overrides topic)">
                    <Input placeholder="Optional UUID" />
                  </Form.Item>
                  <Form.Item name="title" label="Title" rules={[{ required: true }]}>
                    <Input placeholder="New Release!" />
                  </Form.Item>
                  <Form.Item name="body" label="Message Body" rules={[{ required: true }]}>
                    <Input.TextArea rows={3} placeholder="Stream our latest blockbuster now." />
                  </Form.Item>
                  <Form.Item name="imageUrl" label="Image URL (optional)">
                    <Input placeholder="https://..." />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sending}>
                    Send Push Notification
                  </Button>
                </Form>
              </Card>
            ),
          },
          {
            key: "sms",
            label: "Send SMS (MSG91)",
            children: (
              <Card style={{ maxWidth: 640 }}>
                <Form form={smsForm} layout="vertical" onFinish={sendSMS}>
                  <Form.Item name="phone" label="Phone Number (with country code)" rules={[{ required: true }]}>
                    <Input placeholder="+919876543210" />
                  </Form.Item>
                  <Form.Item name="message" label="SMS Message" rules={[{ required: true }]}>
                    <Input.TextArea rows={3} placeholder="Your MaxxPixels notification..." />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sending}>
                    Send SMS
                  </Button>
                </Form>
              </Card>
            ),
          },
          {
            key: "history",
            label: `Dispatch History (${history.length})`,
            children: (
              <Card>
                <Table
                  rowKey={(r) => r.id || `${r.createdAt}-${Math.random()}`}
                  loading={loading}
                  dataSource={history}
                  columns={[
                    { title: "Title", dataIndex: "title" },
                    { title: "Body", dataIndex: "body", ellipsis: true },
                    { title: "Channel", dataIndex: "channel", width: 100, render: (v) => <Tag>{v || "PUSH"}</Tag> },
                    { title: "Status", dataIndex: "status", width: 100, render: (v) => <Tag color={v === "FAILED" ? "red" : "green"}>{v || "SENT"}</Tag> },
                    {
                      title: "Sent At",
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

      <Modal
        title={editingTpl ? "Edit Notification Template" : "Create Notification Template"}
        open={tplOpen}
        onOk={saveTpl}
        onCancel={() => setTplOpen(false)}
        width={600}
      >
        <Form form={tplForm} layout="vertical">
          <Form.Item name="code" label="Template Code" rules={[{ required: true }]}>
            <Input placeholder="plan_expiry_3d" disabled={Boolean(editingTpl)} />
          </Form.Item>
          <Form.Item name="title" label="Title (supports {{plan_name}}, {{days_left}})" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body" label="Body" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space size="large">
            <Form.Item name="channel" label="Channel">
              <Select
                style={{ width: 140 }}
                options={[
                  { value: "PUSH", label: "PUSH (FCM)" },
                  { value: "SMS", label: "SMS" },
                  { value: "EMAIL", label: "EMAIL" },
                ]}
              />
            </Form.Item>
            <Form.Item name="daysBeforeExpiry" label="Days Before Expiry">
              <InputNumber min={-30} max={365} />
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

export default NotificationsPage;
