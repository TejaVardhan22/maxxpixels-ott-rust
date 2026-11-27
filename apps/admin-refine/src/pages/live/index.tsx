import React, { useEffect, useState } from "react";
import { Table, Button, Space, Tag, Drawer, Form, Input, Switch, Popconfirm, message, Typography, Card } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";

export const LiveTVPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/admin/live-channels");
      setRows(extractArray(data));
    } catch (e: any) {
      message.error(e?.message || "Failed to load live channels");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (values: any) => {
    try {
      if (editing?.id) {
        await apiPut(`/admin/live-channels/${editing.id}`, values);
      } else {
        await apiPost("/admin/live-channels", values);
      }
      message.success("Live channel saved");
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    }
  };

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>Live TV Channels</Typography.Title>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ isActive: true, isLive: true }); setOpen(true); }}>
            Add Channel
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: "Channel", dataIndex: "name", render: (v, r) => v || r.title },
          { title: "Stream URL", dataIndex: "streamUrl", ellipsis: true },
          { title: "Status", dataIndex: "isActive", render: (v) => <Tag color={v !== false ? "green" : "default"}>{v !== false ? "LIVE" : "OFFLINE"}</Tag> },
          {
            title: "Actions",
            width: 120,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }} />
                <Popconfirm title="Delete channel?" onConfirm={async () => { await apiDelete(`/admin/live-channels/${r.id}`); load(); }}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Drawer title={editing ? "Edit Live Channel" : "New Live Channel"} open={open} onClose={() => setOpen(false)} width={520} extra={<Button type="primary" onClick={() => form.submit()}>Save</Button>}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Channel Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="streamUrl" label="HLS Stream URL" rules={[{ required: true }]}><Input placeholder="https://.../live.m3u8" /></Form.Item>
          <Form.Item name="logoUrl" label="Logo"><MediaUpload type="image" folder="logos" /></Form.Item>
          <Form.Item name="category" label="Category"><Input /></Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
};
