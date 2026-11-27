import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  message,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  AppstoreAddOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";

const { Title } = Typography;

export const HomeCmsPage: React.FC = () => {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const [itemModal, setItemModal] = useState<{ open: boolean; section?: any }>({ open: false });
  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedContentId, setSelectedContentId] = useState<string | undefined>(undefined);

  const loadSections = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/admin/cms/sections");
      const list = extractArray(res).sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      setSections(list);
    } catch (e: any) {
      message.error(e.message || "Failed to load Home CMS sections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSections();
  }, []);

  const openModal = (rec?: any, preset?: { title: string; sectionType: string; layout: string }) => {
    setEditing(rec || null);
    form.resetFields();
    if (rec) {
      form.setFieldsValue(rec);
    } else if (preset) {
      form.setFieldsValue({
        ...preset,
        targetAudience: "ALL",
        displayOrder: sections.length + 1,
        active: true,
      });
    } else {
      form.setFieldsValue({
        sectionType: "TRENDING_RAIL",
        layout: "PORTRAIT",
        targetAudience: "ALL",
        displayOrder: sections.length + 1,
        active: true,
      });
    }
    setModalOpen(true);
  };

  const saveSection = async () => {
    try {
      const values = await form.validateFields();
      if (editing?.id) {
        await apiPut(`/admin/cms/sections/${editing.id}`, values);
        message.success("Home row updated");
      } else {
        await apiPost("/admin/cms/sections", values);
        message.success("Home row created");
      }
      setModalOpen(false);
      loadSections();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "Failed to save home row");
    }
  };

  const toggleActive = async (rec: any, active: boolean) => {
    try {
      await apiPut(`/admin/cms/sections/${rec.id}`, { ...rec, active, isActive: active });
      loadSections();
    } catch (e: any) {
      message.error(e.message || "Failed to toggle row");
    }
  };

  const moveRow = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    setSections(copy);
    try {
      await Promise.all(
        copy.map((s, idx) =>
          apiPut(`/admin/cms/sections/${s.id}`, { ...s, displayOrder: idx + 1 }).catch(() => null)
        )
      );
      message.success("Row order saved");
      loadSections();
    } catch (e: any) {
      message.error(e.message || "Failed to reorder");
    }
  };

  const deleteSection = async (id: string | number) => {
    try {
      await apiDelete(`/admin/cms/sections/${id}`);
      message.success("Home row deleted");
      loadSections();
    } catch (e: any) {
      message.error(e.message || "Failed to delete row");
    }
  };

  const openAttachModal = async (section: any) => {
    setItemModal({ open: true, section });
    setSelectedContentId(undefined);
    if (!catalog.length) {
      try {
        const res = await apiGet("/admin/movies?size=100");
        setCatalog(extractArray(res));
      } catch {
        setCatalog([]);
      }
    }
  };

  const attachItem = async () => {
    if (!itemModal.section?.id || !selectedContentId) return;
    try {
      await apiPost(`/admin/cms/sections/${itemModal.section.id}/items`, { contentId: selectedContentId });
      message.success("Title attached to home row");
      setItemModal({ open: false });
      loadSections();
    } catch (e: any) {
      message.error(e.message || "Failed to attach item");
    }
  };

  const activeCount = sections.filter((s) => s.active !== false && s.isActive !== false).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Home Screen CMS — Layout Manager</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            New Home Row
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadSections}>
            Refresh
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Total Home Rows" value={sections.length} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Live on Web & App" value={activeCount} valueStyle={{ color: "#52c41a" }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Hero Banners" value={sections.filter((s) => s.sectionType === "HERO_BANNER").length} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Attached Titles" value={sections.reduce((acc, s) => acc + (s.itemCount || s.items?.length || 0), 0)} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ opacity: 0.7 }}>Quick Add Row:</span>
          <Button size="small" onClick={() => openModal(undefined, { title: "Hero Spotlight", sectionType: "HERO_BANNER", layout: "BANNER" })}>+ Hero Banner</Button>
          <Button size="small" onClick={() => openModal(undefined, { title: "Trending Now", sectionType: "TRENDING_RAIL", layout: "PORTRAIT" })}>+ Trending Row</Button>
          <Button size="small" onClick={() => openModal(undefined, { title: "Top 10 in India", sectionType: "TOP_10", layout: "PORTRAIT" })}>+ Top 10 Ranked</Button>
          <Button size="small" onClick={() => openModal(undefined, { title: "Featured Genre", sectionType: "GENRE_TRAY", layout: "LANDSCAPE" })}>+ Genre Row</Button>
          <Button size="small" onClick={() => openModal(undefined, { title: "Continue Watching", sectionType: "CONTINUE_WATCHING", layout: "LANDSCAPE" })}>+ Continue Watching</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey={(r) => String(r.id)}
          loading={loading}
          dataSource={sections}
          pagination={false}
          columns={[
            {
              title: "Order",
              width: 110,
              render: (_: any, __: any, index: number) => (
                <Space size={4}>
                  <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveRow(index, -1)} />
                  <Button size="small" icon={<ArrowDownOutlined />} disabled={index === sections.length - 1} onClick={() => moveRow(index, 1)} />
                </Space>
              ),
            },
            { title: "Row Title", dataIndex: "title", render: (v) => <strong>{v}</strong> },
            { title: "Type", dataIndex: "sectionType", render: (v) => <Tag color="blue">{v || "RAIL"}</Tag> },
            { title: "Layout", dataIndex: "layout", render: (v) => <Tag>{v || "PORTRAIT"}</Tag> },
            { title: "Audience", dataIndex: "targetAudience", render: (v) => <Tag color="purple">{v || "ALL"}</Tag> },
            { title: "Items", render: (_: any, r: any) => r.itemCount ?? r.items?.length ?? 0, width: 80 },
            {
              title: "Active",
              width: 90,
              render: (_: any, r: any) => (
                <Switch
                  checked={r.active !== false && r.isActive !== false}
                  onChange={(val) => toggleActive(r, val)}
                />
              ),
            },
            {
              title: "Actions",
              width: 150,
              render: (_: any, r: any) => (
                <Space>
                  <Button size="small" icon={<AppstoreAddOutlined />} title="Attach Title" onClick={() => openAttachModal(r)} />
                  <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
                  <Popconfirm title="Delete home row?" onConfirm={() => deleteSection(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? "Edit Home Row" : "Create Home Row"}
        open={modalOpen}
        onOk={saveSection}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Row Title" rules={[{ required: true }]}>
            <Input placeholder="Trending Movies in India" />
          </Form.Item>
          <Form.Item name="sectionType" label="Row Type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "HERO_BANNER", label: "Hero Banner" },
                { value: "TRENDING_RAIL", label: "Trending Row" },
                { value: "TOP_10", label: "Top 10 Ranked" },
                { value: "GENRE_TRAY", label: "Genre / Category Row" },
                { value: "CONTINUE_WATCHING", label: "Continue Watching" },
              ]}
            />
          </Form.Item>
          <Form.Item name="layout" label="Card Aspect Ratio" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "PORTRAIT", label: "Portrait Poster (3:4)" },
                { value: "LANDSCAPE", label: "Landscape Card (16:9)" },
                { value: "BANNER", label: "Full-Width Hero Banner" },
                { value: "SQUARE", label: "Square Tile (1:1)" },
              ]}
            />
          </Form.Item>
          <Form.Item name="targetAudience" label="Target Audience">
            <Select
              options={[
                { value: "ALL", label: "All Viewers" },
                { value: "SUBSCRIBERS_ONLY", label: "Paid Subscribers Only" },
                { value: "FREE_TIER", label: "Free / Guest Users Only" },
              ]}
            />
          </Form.Item>
          <Space size="large">
            <Form.Item name="displayOrder" label="Display Order">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={`Attach Title to "${itemModal.section?.title || ""}"`}
        open={itemModal.open}
        onOk={attachItem}
        onCancel={() => setItemModal({ open: false })}
      >
        <Select
          showSearch
          style={{ width: "100%" }}
          placeholder="Select a movie / title to attach"
          optionFilterProp="label"
          value={selectedContentId}
          onChange={setSelectedContentId}
          options={catalog.map((c: any) => ({ value: String(c.id), label: `${c.title} (${c.contentType || "MOVIE"})` }))}
        />
      </Modal>
    </div>
  );
};

export default HomeCmsPage;
