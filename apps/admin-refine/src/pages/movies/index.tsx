import React, { useEffect, useState } from "react";
import {
  Table, Button, Space, Tag, Drawer, Form, Input, InputNumber, Select, Switch,
  Popconfirm, message, Typography, Image, Card,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";

export const MoviesPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/admin/movies?size=100${search ? `&q=${encodeURIComponent(search)}` : ""}`);
      setRows(extractArray(data));
    } catch (e: any) {
      message.error(e?.message || "Failed to load movies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: "PUBLISHED", monetization: "SVOD", isPremium: true, language: "Telugu" });
    setDrawerOpen(true);
  };

  const openEdit = (rec: any) => {
    setEditing(rec);
    form.setFieldsValue({
      title: rec.title,
      description: rec.description || rec.synopsis,
      releaseYear: rec.releaseYear,
      durationMinutes: rec.durationMinutes || (rec.durationSeconds ? Math.round(rec.durationSeconds / 60) : 120),
      language: rec.language,
      maturityRating: rec.maturityRating || "U/A 13+",
      monetization: rec.monetization || rec.accessType || "SVOD",
      rentPrice: rec.rentPrice,
      isPremium: rec.isPremium ?? true,
      status: rec.status || "PUBLISHED",
      posterUrl: rec.posterUrl || rec.thumbnailUrl,
      backdropUrl: rec.backdropUrl,
      trailerUrl: rec.trailerUrl,
      streamUrl: rec.streamUrl || rec.hlsUrl || rec.videoUrl,
    });
    setDrawerOpen(true);
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        durationSeconds: values.durationMinutes ? Number(values.durationMinutes) * 60 : undefined,
        hlsUrl: values.streamUrl,
        videoUrl: values.streamUrl,
      };
      if (editing?.id) {
        await apiPut(`/admin/movies/${editing.id}`, payload);
        message.success("Movie updated");
      } else {
        await apiPost("/admin/movies", payload);
        message.success("Movie created");
      }
      setDrawerOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/admin/movies/${id}`);
      message.success("Movie deleted");
      load();
    } catch (e: any) {
      message.error(e?.message || "Delete failed");
    }
  };

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>Movies Catalog</Typography.Title>}
      extra={
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search movies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={load}
            style={{ width: 220 }}
          />
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Movie</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 15 }}
        columns={[
          {
            title: "Poster",
            dataIndex: "posterUrl",
            width: 72,
            render: (v) => v ? <Image src={v} width={48} height={64} style={{ objectFit: "cover", borderRadius: 4 }} /> : "-",
          },
          { title: "Title", dataIndex: "title", render: (v, r) => <div><strong>{v}</strong><div style={{ fontSize: 12, opacity: 0.7 }}>{r.language} {r.releaseYear ? `• ${r.releaseYear}` : ""}</div></div> },
          { title: "Access", dataIndex: "monetization", render: (v, r) => <Tag color={v === "TVOD" ? "gold" : v === "SVOD" ? "purple" : "green"}>{v || r.accessType || "SVOD"}</Tag> },
          { title: "Views", dataIndex: "viewCount", render: (v) => v ?? 0 },
          { title: "Status", dataIndex: "status", render: (v) => <Tag color={v === "PUBLISHED" ? "blue" : "default"}>{v || "DRAFT"}</Tag> },
          {
            title: "Actions",
            width: 140,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="Delete movie?" onConfirm={() => handleDelete(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={editing ? `Edit Movie: ${editing.title}` : "Create New Movie"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>Save</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Movie title" />
          </Form.Item>
          <Form.Item name="description" label="Synopsis">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="releaseYear" label="Year" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={1950} max={2035} />
            </Form.Item>
            <Form.Item name="durationMinutes" label="Duration (min)" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={1} />
            </Form.Item>
            <Form.Item name="language" label="Language" style={{ flex: 1 }}>
              <Input placeholder="Telugu / Hindi / English" />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="monetization" label="Monetization" style={{ flex: 1 }}>
              <Select options={["FREE", "AVOD", "SVOD", "TVOD"].map((v) => ({ label: v, value: v }))} />
            </Form.Item>
            <Form.Item name="rentPrice" label="TVOD Rent Price (INR)" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>
            <Form.Item name="status" label="Status" style={{ flex: 1 }}>
              <Select options={["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"].map((v) => ({ label: v, value: v }))} />
            </Form.Item>
          </Space>
          <Form.Item name="isPremium" label="Premium Content" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="posterUrl" label="Poster Image (Direct Upload or Google Drive)">
            <MediaUpload type="image" folder="posters" />
          </Form.Item>
          <Form.Item name="backdropUrl" label="Backdrop Image">
            <MediaUpload type="image" folder="backdrops" />
          </Form.Item>
          <Form.Item name="streamUrl" label="Main Video (Bunny Stream / Google Drive Streamer)">
            <MediaUpload type="video" />
          </Form.Item>
          <Form.Item name="trailerUrl" label="Trailer Video">
            <MediaUpload type="video" />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
};
