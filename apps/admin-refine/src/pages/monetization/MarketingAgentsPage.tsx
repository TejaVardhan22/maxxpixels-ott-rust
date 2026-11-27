import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Form,
  Input,
  Row,
  Col,
  Statistic,
  Alert,
  Drawer,
  Typography,
  message,
} from "antd";
import {
  UserAddOutlined,
  CopyOutlined,
  EyeOutlined,
  UploadOutlined,
  ReloadOutlined,
  CloseOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiUpload, extractArray } from "../../providers/api";

const { Title, Text } = Typography;

export const MarketingAgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [lastCreatedCode, setLastCreatedCode] = useState("");

  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [form] = Form.useForm();
  const aadhaarDocUrl = Form.useWatch("aadhaarDocUrl", form);
  const panDocUrl = Form.useWatch("panDocUrl", form);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/admin/marketing/agents");
      setAgents(extractArray(res));
    } catch (e: any) {
      message.error(e.message || "Unable to load marketing agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>, field: "aadhaarDocUrl" | "panDocUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingField(field);
    try {
      const res = await apiUpload("/storage/upload?folder=marketing-kyc", file);
      const url = res?.url || res?.fileUrl;
      if (url) {
        form.setFieldValue(field, url);
        message.success("Document uploaded");
      }
    } catch (err: any) {
      message.error(err.message || "Document upload failed");
    } finally {
      setUploadingField(null);
      e.target.value = "";
    }
  };

  const handleCreate = async (values: any) => {
    setSaving(true);
    setLastCreatedCode("");
    try {
      const created = await apiPost<any>("/admin/marketing/agents", values);
      const code = created?.agentCode || "";
      setLastCreatedCode(code);
      message.success(`Marketing agent created${code ? ` with code ${code}` : ""}`);
      form.resetFields();
      setShowForm(false);
      loadAgents();
    } catch (e: any) {
      message.error(e.message || "Unable to create marketing agent");
    } finally {
      setSaving(false);
    }
  };

  const viewMembers = async (agent: any) => {
    setSelectedAgent(agent);
    setMembers([]);
    setMembersLoading(true);
    try {
      const res = await apiGet(`/admin/marketing/${agent.id}/members`);
      setMembers(extractArray(res));
    } catch (e: any) {
      message.error(e.message || "Unable to load onboarded members");
    } finally {
      setMembersLoading(false);
    }
  };

  const toggleStatus = async (agent: any) => {
    try {
      await apiPost(`/admin/marketing/${agent.id}/toggle-status`, {});
      message.success("Agent status updated");
      loadAgents();
    } catch (e: any) {
      message.error(e.message || "Unable to update agent status");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    message.success(`Copied code: ${code}`);
  };

  const totalMembers = agents.reduce((sum, a) => sum + Number(a.memberCount || 0), 0);
  const activeAgents = agents.filter((a) => String(a.status || "").toUpperCase() === "ACTIVE").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <Tag color="gold" style={{ marginBottom: 4 }}>GROWTH &amp; REFERRALS</Tag>
          <Title level={3} style={{ margin: "0 0 4px" }}>Marketing Agents</Title>
          <Text type="secondary">
            Onboard agents with KYC, generate a unique code, and track every member they onboard.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAgents} />
          <Button
            type="primary"
            danger
            icon={showForm ? <CloseOutlined /> : <UserAddOutlined />}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Close Form" : "New Marketing Agent"}
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}><Card size="small"><Statistic title="Total Agents" value={agents.length} /></Card></Col>
        <Col xs={24} md={8}><Card size="small"><Statistic title="Members Onboarded" value={totalMembers} valueStyle={{ color: "#1677ff" }} /></Card></Col>
        <Col xs={24} md={8}><Card size="small"><Statistic title="Active Agents" value={activeAgents} valueStyle={{ color: "#52c41a" }} /></Card></Col>
      </Row>

      {lastCreatedCode && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
          message={
            <Space>
              <span>Agent created. Unique code: <strong>{lastCreatedCode}</strong></span>
              <Button size="small" icon={<CopyOutlined />} onClick={() => copyCode(lastCreatedCode)}>
                Copy
              </Button>
            </Space>
          }
        />
      )}

      {showForm && (
        <Card title="Agent Details & KYC" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
                  <Input placeholder="Agent full name" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="mobileNumber" label="Mobile Number" rules={[{ required: true }]}>
                  <Input placeholder="10-digit mobile number" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
                  <Input placeholder="agent@example.com" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="aadhaarNumber" label="Aadhaar Number (Optional)">
                  <Input placeholder="12-digit Aadhaar" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="panNumber" label="PAN Number (Optional)">
                  <Input placeholder="ABCDE1234F" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="aadhaarDocUrl" label="Aadhaar Card Upload *" rules={[{ required: true, message: "Upload Aadhaar document" }]}>
                  <Input placeholder="Uploaded Aadhaar URL" />
                </Form.Item>
                <Space style={{ marginBottom: 12 }}>
                  <label>
                    <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => handleUploadDoc(e, "aadhaarDocUrl")} />
                    <Button
                      icon={<UploadOutlined />}
                      loading={uploadingField === "aadhaarDocUrl"}
                      onClick={(e) => (e.currentTarget.previousSibling as HTMLInputElement)?.click()}
                    >
                      Upload Aadhaar
                    </Button>
                  </label>
                  {aadhaarDocUrl && <a href={aadhaarDocUrl} target="_blank" rel="noreferrer">View uploaded file</a>}
                </Space>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="panDocUrl" label="PAN Card Upload *" rules={[{ required: true, message: "Upload PAN document" }]}>
                  <Input placeholder="Uploaded PAN URL" />
                </Form.Item>
                <Space style={{ marginBottom: 12 }}>
                  <label>
                    <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => handleUploadDoc(e, "panDocUrl")} />
                    <Button
                      icon={<UploadOutlined />}
                      loading={uploadingField === "panDocUrl"}
                      onClick={(e) => (e.currentTarget.previousSibling as HTMLInputElement)?.click()}
                    >
                      Upload PAN Card
                    </Button>
                  </label>
                  {panDocUrl && <a href={panDocUrl} target="_blank" rel="noreferrer">View uploaded file</a>}
                </Space>
              </Col>
            </Row>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="primary" htmlType="submit" loading={saving}>
                Create Agent &amp; Generate Code
              </Button>
            </div>
          </Form>
        </Card>
      )}

      <Card title="Agent Directory">
        <Table
          rowKey={(r) => String(r.id || r.agentCode)}
          loading={loading}
          dataSource={agents}
          locale={{ emptyText: "No marketing agents yet. Create one to generate a unique code." }}
          columns={[
            {
              title: "Agent",
              render: (_: any, r: any) => (
                <div>
                  <strong>{r.fullName || r.name}</strong>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Aadhaar: {r.aadhaarNumber || "—"} · PAN: {r.panNumber || "—"}
                  </div>
                </div>
              ),
            },
            {
              title: "Unique Code",
              dataIndex: "agentCode",
              render: (v) => (
                <Button size="small" type="text" onClick={() => copyCode(v)} style={{ color: "#f5b301", fontFamily: "monospace", fontWeight: 700 }}>
                  {v} <CopyOutlined />
                </Button>
              ),
            },
            {
              title: "Contact",
              render: (_: any, r: any) => (
                <div>
                  <div>{r.mobileNumber || "—"}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{r.email || "—"}</div>
                </div>
              ),
            },
            {
              title: "Members",
              dataIndex: "memberCount",
              width: 100,
              render: (v) => <Tag color="blue">{v ?? 0}</Tag>,
            },
            {
              title: "Status",
              dataIndex: "status",
              width: 110,
              render: (v) => (
                <Tag color={String(v || "").toUpperCase() === "ACTIVE" ? "green" : "red"}>
                  {v || "ACTIVE"}
                </Tag>
              ),
            },
            {
              title: "Actions",
              width: 210,
              render: (_: any, r: any) => (
                <Space>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => viewMembers(r)}>
                    Members
                  </Button>
                  <Button size="small" onClick={() => toggleStatus(r)}>
                    {String(r.status || "").toUpperCase() === "ACTIVE" ? "Disable" : "Enable"}
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title={selectedAgent ? `Members onboarded by ${selectedAgent.fullName || selectedAgent.name} (${selectedAgent.agentCode})` : "Onboarded Members"}
        open={Boolean(selectedAgent)}
        onClose={() => setSelectedAgent(null)}
        width={620}
      >
        <Table
          rowKey={(r) => String(r.id || r.userId)}
          loading={membersLoading}
          dataSource={members}
          locale={{ emptyText: "No members onboarded with this code yet." }}
          columns={[
            { title: "User", render: (_: any, m: any) => m.fullName || `User #${m.userId}` },
            { title: "Phone", dataIndex: "phoneNumber", render: (v) => v || "—" },
            { title: "Email", dataIndex: "email", render: (v) => v || "—" },
            {
              title: "Joined",
              dataIndex: "joinedAt",
              render: (v) => (v ? new Date(v).toLocaleString() : "—"),
            },
          ]}
        />
      </Drawer>
    </div>
  );
};

export default MarketingAgentsPage;
