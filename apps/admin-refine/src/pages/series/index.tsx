import React, { useEffect, useState } from "react";
import { Table, Button, Space, Tag, Drawer, Form, Input, Select, Switch, Popconfirm, message, Typography, Card, Image } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";

export const SeriesPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/admin/series?size=100");
      setRows(extractArray(data));
    } catch (e: any) {
      message.error(e?.message || "Failed to load series");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await apiPut(`/admin/series/${editing.id}`, values);
        message.success("Series updated");
      } else {
        await apiPost("/admin/series", values);
        message.success("Series created");
      }
      setDrawerOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>Web Series</Typography.Title>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: "PUBLISHED", monetization: "SVOD", isPremium: true }); setDrawerOpen(true); }}>
            Add Series
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 15 }}
        columns={[
          { title: "Poster", dataIndex: "posterUrl", width: 70, render: (v) => v ? <Image src={v} width={44} height={60} style={{ objectFit: "cover", borderRadius: 4 }} /> : "-" },
          { title: "Title", dataIndex: "title", render: (v, r) => <div><strong>{v}</strong><div style={{ fontSize: 12, opacity: 0.7 }}>{r.language}</div></div> },
          { title: "Access", dataIndex: "monetization", render: (v) => <Tag color="purple">{v || "SVOD"}</Tag> },
          { title: "Status", dataIndex: "status", render: (v) => <Tag color={v === "PUBLISHED" ? "blue" : "default"}>{v || "DRAFT"}</Tag> },
          {
            title: "Actions",
            width: 130,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setDrawerOpen(true); }} />
                <Popconfirm title="Delete series?" onConfirm={async () => { await apiDelete(`/admin/series/${r.id}`); message.success("Deleted"); load(); }}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={editing ? `Edit Series: ${editing.title}` : "Create Series"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={580}
        extra={<Button type="primary" loading={saving} onClick={() => form.submit()}>Save</Button>}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="language" label="Language"><Input placeholder="Telugu / Hindi / English" /></Form.Item>
          <Form.Item name="monetization" label="Monetization"><Select options={["FREE", "AVOD", "SVOD", "TVOD"].map((v) => ({ label: v, value: v }))} /></Form.Item>
          <Form.Item name="status" label="Status"><Select options={["DRAFT", "PUBLISHED", "ARCHIVED"].map((v) => ({ label: v, value: v }))} /></Form.Item>
          <Form.Item name="isPremium" label="Premium" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="posterUrl" label="Poster"><MediaUpload type="image" folder="posters" /></Form.Item>
          <Form.Item name="backdropUrl" label="Backdrop"><MediaUpload type="image" folder="backdrops" /></Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
};
