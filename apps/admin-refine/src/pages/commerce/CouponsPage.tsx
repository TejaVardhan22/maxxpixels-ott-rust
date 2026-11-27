import React, { useEffect, useState } from "react";
import { Card, Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, Switch, Popconfirm, message, Typography } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";

export const CouponsPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setRows(extractArray(await apiGet("/admin/coupons")));
    } catch (e: any) {
      message.error(e?.message || "Failed loading coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (vals: any) => {
    try {
      if (editing?.id) {
        await apiPut(`/admin/coupons/${editing.id}`, vals);
      } else {
        await apiPost("/admin/coupons", vals);
      }
      message.success("Coupon saved");
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    }
  };

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>Promo Coupons</Typography.Title>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ discountType: "PERCENTAGE", discountValue: 20, maxUses: 100, isActive: true }); setOpen(true); }}>
            New Coupon
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: "Code", dataIndex: "code", render: (v) => <Tag color="blue">{v}</Tag> },
          { title: "Discount", render: (_, r) => r.discountType === "PERCENTAGE" ? `${r.discountValue}%` : `₹${r.discountValue}` },
          { title: "Used / Max", render: (_, r) => `${r.usedCount ?? 0} / ${r.maxUses ?? "∞"}` },
          { title: "Active", dataIndex: "isActive", render: (v) => <Tag color={v !== false ? "green" : "default"}>{v !== false ? "ACTIVE" : "OFF"}</Tag> },
          {
            title: "Actions",
            width: 120,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }} />
                <Popconfirm title="Delete coupon?" onConfirm={async () => { await apiDelete(`/admin/coupons/${r.id}`); load(); }}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={editing ? "Edit Coupon" : "Create Coupon"} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="code" label="Coupon Code" rules={[{ required: true }]}><Input placeholder="MAXX50" /></Form.Item>
          <Form.Item name="discountType" label="Discount Type"><Select options={[{ label: "Percentage (%)", value: "PERCENTAGE" }, { label: "Flat (INR)", value: "FIXED" }]} /></Form.Item>
          <Form.Item name="discountValue" label="Discount Value" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} min={1} /></Form.Item>
          <Form.Item name="maxUses" label="Max Uses"><InputNumber style={{ width: "100%" }} min={1} /></Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
