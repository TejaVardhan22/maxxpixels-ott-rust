import React, { useEffect, useState } from "react";
import { Card, Tabs, Table, Button, Space, Tag, message, Typography } from "antd";
import { ReloadOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { apiGet, apiPost, extractArray } from "../../providers/api";

export const AdsProducersPage: React.FC = () => {
  const [ads, setAds] = useState<any[]>([]);
  const [producers, setProducers] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, p, m] = await Promise.all([
        apiGet("/admin/ads/campaigns").catch(() => []),
        apiGet("/admin/producers").catch(() => []),
        apiGet("/admin/marketing/agents").catch(() => []),
      ]);
      setAds(extractArray(a));
      setProducers(extractArray(p));
      setAgents(extractArray(m));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>Advertising, Producers & Marketing</Typography.Title>}
      extra={<Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>}
    >
      <Tabs
        items={[
          {
            key: "ads",
            label: `Ad Campaigns (${ads.length})`,
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={ads}
                columns={[
                  { title: "Campaign", dataIndex: "campaignName", render: (v, r) => v || r.name },
                  { title: "Impressions", dataIndex: "impressionsCount", render: (v) => v ?? 0 },
                  { title: "Clicks", dataIndex: "clicksCount", render: (v) => v ?? 0 },
                  { title: "Status", dataIndex: "status", render: (v) => <Tag color={v === "ACTIVE" ? "green" : "default"}>{v || "ACTIVE"}</Tag> },
                ]}
              />
            ),
          },
          {
            key: "producers",
            label: `Producers (${producers.length})`,
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={producers}
                columns={[
                  { title: "Producer / Studio", dataIndex: "companyName", render: (v, r) => v || r.name || r.email },
                  { title: "Email", dataIndex: "email" },
                  { title: "KYC", dataIndex: "kycStatus", render: (v) => <Tag>{v || "PENDING"}</Tag> },
                  { title: "Status", dataIndex: "status", render: (v) => <Tag color={v === "APPROVED" ? "green" : v === "REJECTED" ? "red" : "orange"}>{v || "PENDING"}</Tag> },
                  {
                    title: "Action",
                    render: (_, r) => (
                      <Space>
                        <Button size="small" type="primary" icon={<CheckOutlined />} onClick={async () => { await apiPost(`/admin/producers/${r.id}/approve`, {}); message.success("Producer approved"); load(); }}>Approve</Button>
                        <Button size="small" danger icon={<CloseOutlined />} onClick={async () => { await apiPost(`/admin/producers/${r.id}/reject`, { reason: "Incomplete KYC" }); message.info("Producer rejected"); load(); }}>Reject</Button>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: "agents",
            label: `Marketing Agents (${agents.length})`,
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={agents}
                columns={[
                  { title: "Name", dataIndex: "name" },
                  { title: "Code", dataIndex: "agentCode", render: (v) => <Tag color="purple">{v}</Tag> },
                  { title: "Status", dataIndex: "status", render: (v) => <Tag color="green">{v || "ACTIVE"}</Tag> },
                ]}
              />
            ),
          },
        ]}
      />
    </Card>
  );
};
