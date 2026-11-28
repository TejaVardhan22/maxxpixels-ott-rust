import React, { useEffect, useState } from "react";
import { Tabs, Table, Button, Space, Modal, Form, Input, InputNumber, Switch, Select, Avatar, Tag, Popconfirm, message, Card, Typography } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";

const CAST_ROLES = [
  "ACTOR",
  "ACTRESS",
  "DIRECTOR",
  "PRODUCER",
  "WRITER",
  "MUSIC_DIRECTOR",
  "CINEMATOGRAPHER",
  "EDITOR",
  "SINGER",
  "HOST",
  "CREW",
];

const CastCrewTab: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const watchedImage = Form.useWatch("imageUrl", form);

  const load = async () => {
    setLoading(true);
    try {
      setRows(extractArray(await apiGet("/admin/cast")));
    } catch (e: any) {
      message.error(e?.message || "Failed loading Cast & Crew");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (vals: any) => {
    try {
      const payload = {
        name: vals.name,
        role: vals.role || "ACTOR",
        bio: vals.bio || "",
        imageUrl: vals.imageUrl || "",
        profileImageUrl: vals.imageUrl || "",
      };
      if (editing?.id) {
        await apiPut(`/admin/cast/${editing.id}`, payload);
      } else {
        await apiPost("/admin/cast", payload);
      }
      message.success("Cast member saved");
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 12, justifyContent: "flex-end", width: "100%" }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ role: "ACTOR", imageUrl: "" });
            setOpen(true);
          }}
        >
          Add Cast Member
        </Button>
      </Space>
      <Table
        rowKey={(r) => String(r.id || r.name)}
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 15 }}
        columns={[
          {
            title: "Photo",
            width: 72,
            render: (_, r) => {
              const img = r.imageUrl || r.image_url || r.profileImageUrl;
              return img ? (
                <Avatar src={img} size={42} />
              ) : (
                <Avatar icon={<UserOutlined />} size={42} />
              );
            },
          },
          { title: "Name", dataIndex: "name", render: (v) => <strong>{v}</strong> },
          { title: "Role", dataIndex: "role", width: 150, render: (v) => <Tag color="blue">{v || "ACTOR"}</Tag> },
          { title: "Bio", dataIndex: "bio", ellipsis: true, render: (v) => v || "-" },
          {
            title: "Actions",
            width: 120,
            render: (_, r) => (
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(r);
                    form.setFieldsValue({
                      name: r.name,
                      role: r.role || "ACTOR",
                      bio: r.bio || "",
                      imageUrl: r.imageUrl || r.image_url || r.profileImageUrl || "",
                    });
                    setOpen(true);
                  }}
                />
                <Popconfirm title="Delete cast member?" onConfirm={async () => { await apiDelete(`/admin/cast/${r.id}`); load(); }}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "Edit Cast / Crew Member" : "Add Cast / Crew Member"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="e.g. Prabhas" />
          </Form.Item>
          <Form.Item name="role" label="Role / Department">
            <Select
              showSearch
              options={CAST_ROLES.map((r) => ({ value: r, label: r.replace(/_/g, " ") }))}
            />
          </Form.Item>
          <Form.Item name="imageUrl" label="Profile Photo (Upload or Google Drive)">
            <MediaUpload type="image" folder="avatars" placeholder="Upload photo or import from Google Drive" />
          </Form.Item>
          {watchedImage && (
            <div style={{ marginBottom: 14 }}>
              <Avatar src={watchedImage} size={64} />
            </div>
          )}
          <Form.Item name="bio" label="Biography">
            <Input.TextArea rows={3} placeholder="Short bio..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const TaxonomyTab: React.FC<{ endpoint: string; label: string; idField?: string }> = ({ endpoint, label, idField = "id" }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setRows(extractArray(await apiGet(`/admin/${endpoint}`)));
    } catch (e: any) {
      message.error(e?.message || `Failed loading ${label}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [endpoint]);

  const handleSave = async (vals: any) => {
    try {
      if (editing) {
        await apiPut(`/admin/${endpoint}/${editing[idField]}`, vals);
      } else {
        await apiPost(`/admin/${endpoint}`, vals);
      }
      message.success(`${label} saved`);
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 12, justifyContent: "flex-end", width: "100%" }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ isActive: true, displayOrder: 0 }); setOpen(true); }}>
          Add {label}
        </Button>
      </Space>
      <Table
        rowKey={(r) => r[idField] ?? r.code ?? r.name}
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 15 }}
        columns={[
          { title: "ID / Code", dataIndex: idField, width: 100 },
          { title: "Name", dataIndex: "name" },
          { title: "Slug", dataIndex: "slug" },
          { title: "Order", dataIndex: "displayOrder", width: 90 },
          {
            title: "Actions",
            width: 120,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }} />
                <Popconfirm title={`Delete ${label}?`} onConfirm={async () => { await apiDelete(`/admin/${endpoint}/${r[idField]}`); load(); }}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={editing ? `Edit ${label}` : `New ${label}`} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          {idField === "code" ? (
            <Form.Item name="code" label="Language Code (e.g. te, hi, en)" rules={[{ required: true }]}><Input /></Form.Item>
          ) : (
            <Form.Item name="slug" label="Slug"><Input /></Form.Item>
          )}
          <Form.Item name="displayOrder" label="Display Order"><InputNumber style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export const CategoriesPage: React.FC = () => (
  <Card title={<Typography.Title level={4} style={{ margin: 0 }}>Basic Details &amp; Master Taxonomy</Typography.Title>}>
    <Tabs
      items={[
        { key: "categories", label: "Categories", children: <TaxonomyTab endpoint="categories" label="Category" /> },
        { key: "genres", label: "Genres", children: <TaxonomyTab endpoint="genres" label="Genre" /> },
        { key: "languages", label: "Languages", children: <TaxonomyTab endpoint="languages" label="Language" idField="code" /> },
        { key: "content-types", label: "Content Types", children: <TaxonomyTab endpoint="content-types" label="Content Type" /> },
        { key: "cast", label: "Cast & Crew", children: <CastCrewTab /> },
      ]}
    />
  </Card>
);
