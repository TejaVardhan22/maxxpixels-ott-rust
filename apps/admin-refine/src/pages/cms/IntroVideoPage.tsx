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
  InputNumber,
  Switch,
  Popconfirm,
  Typography,
  message,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";

const { Title } = Typography;

export const IntroVideoPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/admin/intro-video");
      setItems(extractArray(res));
    } catch (e: any) {
      message.error(e.message || "Failed to load intro videos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openModal = (rec?: any) => {
    setEditing(rec || null);
    form.resetFields();
    if (rec) {
      form.setFieldsValue(rec);
    } else {
      form.setFieldsValue({ isActive: true, displayOrder: items.length + 1, ctaLabel: "Watch Intro" });
    }
    setModalOpen(true);
  };

  const saveItem = async () => {
    try {
      const values = await form.validateFields();
      if (editing?.id) {
        await apiPut(`/admin/intro-video/${editing.id}`, values);
        message.success("Intro video updated");
      } else {
        await apiPost("/admin/intro-video", values);
        message.success("Intro video created");
      }
      setModalOpen(false);
      loadItems();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "Failed to save intro video");
    }
  };

  const activate = async (id: string | number) => {
    try {
      await apiPost(`/admin/intro-video/${id}/activate`, {});
      message.success("Intro video activated");
      loadItems();
    } catch (e: any) {
      message.error(e.message || "Failed to activate");
    }
  };

  const remove = async (id: string | number) => {
    try {
      await apiDelete(`/admin/intro-video/${id}`);
      message.success("Intro video deleted");
      loadItems();
    } catch (e: any) {
      message.error(e.message || "Failed to delete");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>App & Web Intro Video</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            New Intro Video
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadItems}>
            Refresh
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          rowKey={(r) => String(r.id)}
          loading={loading}
          dataSource={items}
          columns={[
            {
              title: "Poster",
              dataIndex: "posterUrl",
              width: 100,
              render: (v) =>
                v ? <img src={v} alt="" style={{ width: 76, height: 44, objectFit: "cover", borderRadius: 6 }} /> : "-",
            },
            {
              title: "Title",
              dataIndex: "title",
              render: (v, r) => (
                <div>
                  <strong>{v}</strong>
                  {r.description && <div style={{ fontSize: 12, opacity: 0.7 }}>{r.description}</div>}
                </div>
              ),
            },
            {
              title: "Video",
              dataIndex: "videoUrl",
              render: (v) => (v ? <a href={v} target="_blank" rel="noreferrer">Open video</a> : "-"),
            },
            { title: "Order", dataIndex: "displayOrder", width: 80 },
            {
              title: "Status",
              dataIndex: "isActive",
              width: 110,
              render: (v) => <Tag color={v ? "green" : "default"}>{v ? "ACTIVE" : "INACTIVE"}</Tag>,
            },
            {
              title: "Actions",
              width: 210,
              render: (_: any, r: any) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)}>Edit</Button>
                  {!r.isActive && (
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => activate(r.id)}>
                      Activate
                    </Button>
                  )}
                  <Popconfirm title="Delete intro video?" onConfirm={() => remove(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? "Edit Intro Video" : "Add Intro Video"}
        open={modalOpen}
        onOk={saveItem}
        onCancel={() => setModalOpen(false)}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Welcome to MaxxPixels" />
          </Form.Item>
          <Form.Item name="ctaLabel" label="Button Label">
            <Input placeholder="Watch Intro" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="videoUrl" label="Intro Video" rules={[{ required: true }]}>
            <MediaUpload type="video" folder="intro-video" />
          </Form.Item>
          <Form.Item name="posterUrl" label="Poster Image">
            <MediaUpload type="image" folder="intro-video" />
          </Form.Item>
          <Space size="large">
            <Form.Item name="displayOrder" label="Display Order">
              <InputNumber min={0} />
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

export default IntroVideoPage;
