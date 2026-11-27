import React, { useEffect, useState } from "react";
import { Tabs, Table, Button, Space, Drawer, Form, Input, InputNumber, Switch, Popconfirm, message, Card, Typography, Image, Tag } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";

export const BannersCmsPage: React.FC<{ defaultTab?: "home" | "portal" }> = ({ defaultTab = "home" }) => {
  const [banners, setBanners] = useState<any[]>([]);
  const [portalBanners, setPortalBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<"banners" | "portal-banners">("banners");
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [b, pb] = await Promise.all([
        apiGet("/admin/cms/banners").catch(() => []),
        apiGet("/admin/portal-banners").catch(() => []),
      ]);
      setBanners(extractArray(b));
      setPortalBanners(extractArray(pb));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (vals: any) => {
    try {
      const base = target === "banners" ? "/admin/cms/banners" : "/admin/portal-banners";
      if (editing?.id) {
        await apiPut(`${base}/${editing.id}`, vals);
      } else {
        await apiPost(base, vals);
      }
      message.success("Banner saved");
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    }
  };

  const renderTable = (rows: any[], kind: "banners" | "portal-banners") => (
    <div>
      <Space style={{ marginBottom: 12, justifyContent: "flex-end", width: "100%" }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTarget(kind); setEditing(null); form.resetFields(); form.setFieldsValue({ isActive: true, displayOrder: 0 }); setOpen(true); }}>
          Add Banner
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: "Preview", dataIndex: "imageUrl", width: 110, render: (v) => v ? <Image src={v} width={96} height={54} style={{ objectFit: "cover", borderRadius: 4 }} /> : "-" },
          { title: "Title", dataIndex: "title" },
          { title: "Link", dataIndex: "targetUrl", ellipsis: true },
          { title: "Active", dataIndex: "isActive", render: (v) => <Tag color={v !== false ? "green" : "default"}>{v !== false ? "ACTIVE" : "HIDDEN"}</Tag> },
          {
            title: "Actions",
            width: 120,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => { setTarget(kind); setEditing(r); form.setFieldsValue(r); setOpen(true); }} />
                <Popconfirm title="Delete banner?" onConfirm={async () => { await apiDelete(`${kind === "banners" ? "/admin/cms/banners" : "/admin/portal-banners"}/${r.id}`); load(); }}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );

  return (
    <Card title={<Typography.Title level={4} style={{ margin: 0 }}>Banners & CMS</Typography.Title>}>
      <Tabs
        defaultActiveKey={defaultTab}
        key={defaultTab}
        items={[
          { key: "home", label: "Home Banners", children: renderTable(banners, "banners") },
          { key: "portal", label: "Portal Banners", children: renderTable(portalBanners, "portal-banners") },
        ]}
      />
      <Drawer title={editing ? "Edit Banner" : "New Banner"} open={open} onClose={() => setOpen(false)} width={520} extra={<Button type="primary" onClick={() => form.submit()}>Save</Button>}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="subtitle" label="Subtitle"><Input /></Form.Item>
          <Form.Item name="imageUrl" label="Banner Image (Upload or Google Drive)" rules={[{ required: true }]}><MediaUpload type="image" folder="banners" /></Form.Item>
          <Form.Item name="targetUrl" label="Target URL / Action Link"><Input /></Form.Item>
          <Form.Item name="displayOrder" label="Order"><InputNumber style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
};
