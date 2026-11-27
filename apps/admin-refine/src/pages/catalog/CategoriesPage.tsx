import React, { useEffect, useState } from "react";
import { Tabs, Table, Button, Space, Modal, Form, Input, InputNumber, Switch, Popconfirm, message, Card, Typography } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";

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
  <Card title={<Typography.Title level={4} style={{ margin: 0 }}>Master Taxonomy</Typography.Title>}>
    <Tabs
      items={[
        { key: "categories", label: "Categories", children: <TaxonomyTab endpoint="categories" label="Category" /> },
        { key: "genres", label: "Genres", children: <TaxonomyTab endpoint="genres" label="Genre" /> },
        { key: "languages", label: "Languages", children: <TaxonomyTab endpoint="languages" label="Language" idField="code" /> },
        { key: "content-types", label: "Content Types", children: <TaxonomyTab endpoint="content-types" label="Content Type" /> },
      ]}
    />
  </Card>
);
