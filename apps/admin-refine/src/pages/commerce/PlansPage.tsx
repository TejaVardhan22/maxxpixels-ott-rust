import React, { useEffect, useState } from "react";
import { Card, Table, Button, Space, Tag, Drawer, Form, Input, InputNumber, Select, Switch, Popconfirm, message, Typography } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";

export const PlansPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setRows(extractArray(await apiGet("/admin/plans")));
    } catch (e: any) {
      message.error(e?.message || "Failed loading plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (vals: any) => {
    try {
      if (editing?.id) {
        await apiPut(`/admin/plans/${editing.id}`, vals);
      } else {
        await apiPost("/admin/plans", vals);
      }
      message.success("Plan saved");
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    }
  };

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>Subscription Plans & Entitlements</Typography.Title>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ currency: "INR", billingPeriod: "MONTHLY", durationDays: 30, maxConcurrentStreams: 2, maxDevices: 3, maxProfiles: 2, maxVideoQuality: "1080p", adsEnabled: false, allowDownloads: true, isActive: true }); setOpen(true); }}>
            New Plan
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: "Plan", dataIndex: "name", render: (v, r) => <div><strong>{v}</strong><div style={{ fontSize: 12, opacity: 0.7 }}>{r.code} • {r.billingPeriod}</div></div> },
          { title: "Price", dataIndex: "price", render: (v, r) => `₹${v} ${r.discountPrice ? `(₹${r.discountPrice})` : ""}` },
          { title: "Streams", dataIndex: "maxConcurrentStreams", render: (v) => <Tag color="blue">{v ?? 1} screen(s)</Tag> },
          { title: "Devices", dataIndex: "maxDevices", render: (v) => v ?? 2 },
          { title: "Quality", dataIndex: "maxVideoQuality", render: (v, r) => <Tag color="purple">{v || r.maxResolution || "1080p"}</Tag> },
          { title: "Ads", dataIndex: "adsEnabled", render: (v, r) => <Tag color={(v || r.hasAds) ? "orange" : "green"}>{(v || r.hasAds) ? "With Ads" : "Ad-Free"}</Tag> },
          { title: "Downloads", dataIndex: "allowDownloads", render: (v) => v ? "Yes" : "No" },
          {
            title: "Actions",
            width: 120,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }} />
                <Popconfirm title="Deactivate plan?" onConfirm={async () => { await apiDelete(`/admin/plans/${r.id}`); load(); }}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Drawer title={editing ? `Edit Plan: ${editing.name}` : "Create Plan"} open={open} onClose={() => setOpen(false)} width={560} extra={<Button type="primary" onClick={() => form.submit()}>Save</Button>}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="name" label="Plan Name" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="code" label="Plan Code" rules={[{ required: true }]} style={{ flex: 1 }}><Input placeholder="PREMIUM_4K" /></Form.Item>
          </Space>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="price" label="Price (INR)" rules={[{ required: true }]} style={{ flex: 1 }}><InputNumber style={{ width: "100%" }} min={0} /></Form.Item>
            <Form.Item name="durationDays" label="Duration (Days)" style={{ flex: 1 }}><InputNumber style={{ width: "100%" }} min={1} /></Form.Item>
            <Form.Item name="billingPeriod" label="Cycle" style={{ flex: 1 }}><Select options={["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY"].map((v) => ({ label: v, value: v }))} /></Form.Item>
          </Space>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="maxConcurrentStreams" label="Max Streams" style={{ flex: 1 }}><InputNumber style={{ width: "100%" }} min={1} max={10} /></Form.Item>
            <Form.Item name="maxDevices" label="Max Devices" style={{ flex: 1 }}><InputNumber style={{ width: "100%" }} min={1} max={20} /></Form.Item>
            <Form.Item name="maxProfiles" label="Max Profiles" style={{ flex: 1 }}><InputNumber style={{ width: "100%" }} min={1} max={10} /></Form.Item>
          </Space>
          <Form.Item name="maxVideoQuality" label="Max Video Quality">
            <Select options={["480p", "720p", "1080p", "4K"].map((v) => ({ label: v, value: v }))} />
          </Form.Item>
          <Space size="large">
            <Form.Item name="adsEnabled" label="Show Ads" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="allowDownloads" label="Allow Downloads" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item>
          </Space>
        </Form>
      </Drawer>
    </Card>
  );
};
