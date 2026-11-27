import React, { useEffect, useState } from "react";
import { Card, Table, Button, Space, Tag, Input, Popconfirm, message, Typography } from "antd";
import { SearchOutlined, ReloadOutlined, RollbackOutlined } from "@ant-design/icons";
import { apiGet, apiPost, extractArray } from "../../providers/api";

export const PaymentsPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/admin/payments?size=100${search ? `&search=${encodeURIComponent(search)}` : ""}`);
      setRows(extractArray(data));
    } catch (e: any) {
      message.error(e?.message || "Failed loading payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRefund = async (p: any) => {
    try {
      await apiPost(`/admin/payments/${p.id}/refund`, { reason: "Admin refund" });
      message.success("Refund initiated");
      load();
    } catch (e: any) {
      message.error(e?.message || "Refund failed");
    }
  };

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>Payments & Transactions</Typography.Title>}
      extra={
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="Search order / payment ID..." value={search} onChange={(e) => setSearch(e.target.value)} onPressEnter={load} style={{ width: 240 }} />
          <Button icon={<ReloadOutlined />} onClick={load} />
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 15 }}
        columns={[
          { title: "ID", dataIndex: "id", width: 70 },
          { title: "Transaction / Payment ID", dataIndex: "transactionId", render: (v, r) => v || r.providerPaymentId || r.orderId },
          { title: "User ID", dataIndex: "userId", width: 90 },
          { title: "Amount", dataIndex: "amount", render: (v, r) => `${r.currency || "INR"} ${v}` },
          { title: "Provider", dataIndex: "provider", render: (v) => <Tag>{v || "RAZORPAY"}</Tag> },
          { title: "Status", dataIndex: "status", render: (v) => <Tag color={v === "CAPTURED" || v === "PAID" ? "green" : v === "REFUNDED" ? "orange" : "red"}>{v}</Tag> },
          { title: "Date", dataIndex: "createdAt" },
          {
            title: "Action",
            width: 110,
            render: (_, r) => (r.status === "CAPTURED" || r.status === "PAID") ? (
              <Popconfirm title="Issue Razorpay refund?" onConfirm={() => handleRefund(r)}>
                <Button size="small" danger icon={<RollbackOutlined />}>Refund</Button>
              </Popconfirm>
            ) : null,
          },
        ]}
      />
    </Card>
  );
};
