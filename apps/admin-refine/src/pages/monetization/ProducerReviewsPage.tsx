import React, { useEffect, useState } from "react";
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Input,
  Row,
  Col,
  Statistic,
  Typography,
  message,
} from "antd";
import { CheckOutlined, CloseOutlined, ReloadOutlined, EyeOutlined } from "@ant-design/icons";
import { apiGet, apiPost, extractArray } from "../../providers/api";

const { Title, Text } = Typography;

export const ProducerReviewsPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [kycList, setKycList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; kind?: "CONTENT" | "KYC"; id?: string | number }>({ open: false });
  const [rejectNotes, setRejectNotes] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [subRes, kycRes] = await Promise.all([
        apiGet("/admin/content/submissions?status=ALL").catch(() => []),
        apiGet("/admin/producers/onboardings").catch(() => []),
      ]);
      setSubmissions(extractArray(subRes));
      setKycList(extractArray(kycRes));
    } catch (e: any) {
      message.error(e.message || "Failed to load producer review queues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const reviewContent = async (id: string | number, action: "APPROVE" | "REJECT", notes = "") => {
    try {
      await apiPost(`/admin/content/submissions/${id}/review`, {
        action,
        notes,
        rejectionReason: notes,
      });
      message.success(`Submission ${action === "APPROVE" ? "approved" : "rejected"}`);
      setRejectModal({ open: false });
      setRejectNotes("");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Review action failed");
    }
  };

  const reviewKyc = async (id: string | number, action: "APPROVE" | "REJECT", notes = "") => {
    try {
      await apiPost(`/admin/producers/onboardings/${id}/review`, {
        action,
        notes,
        rejectionReason: notes,
      });
      message.success(`KYC ${action === "APPROVE" ? "approved" : "rejected"}`);
      setRejectModal({ open: false });
      setRejectNotes("");
      loadAll();
    } catch (e: any) {
      message.error(e.message || "KYC review action failed");
    }
  };

  const verifyDoc = async (id: string | number, docType: string) => {
    try {
      await apiPost(`/admin/producers/onboardings/${id}/review`, { docType, docStatus: "VERIFIED" });
      message.success(`${docType} marked VERIFIED`);
      loadAll();
    } catch (e: any) {
      message.error(e.message || "Document verification failed");
    }
  };

  const pendingSubmissions = submissions.filter((s) =>
    ["SUBMITTED", "KYC_SUBMITTED", "PENDING"].includes(String(s.status || "").toUpperCase())
  ).length;
  const pendingKyc = kycList.filter((k) =>
    ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(String(k.onboardingStatus || k.status || "").toUpperCase())
  ).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Producer Reviews & Approvals Center</Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={loadAll}>
          Refresh Queue
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Total Submissions" value={submissions.length} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Pending Content Reviews" value={pendingSubmissions} valueStyle={{ color: "#faad14" }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Total KYC Applications" value={kycList.length} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Pending KYC Verifications" value={pendingKyc} valueStyle={{ color: "#1677ff" }} /></Card></Col>
      </Row>

      <Tabs
        items={[
          {
            key: "content",
            label: `Content Submissions Queue (${pendingSubmissions} pending)`,
            children: (
              <Card>
                <Table
                  rowKey={(r) => String(r.id)}
                  loading={loading}
                  dataSource={submissions}
                  columns={[
                    {
                      title: "Title",
                      dataIndex: "title",
                      render: (v, r) => (
                        <div>
                          <strong>{v}</strong>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>{r.producerName || r.productionName || r.producerEmail}</div>
                        </div>
                      ),
                    },
                    { title: "Type", dataIndex: "contentType", width: 120, render: (v) => <Tag color="blue">{v || "MOVIE"}</Tag> },
                    { title: "Language", dataIndex: "language", width: 100 },
                    {
                      title: "Status",
                      dataIndex: "status",
                      width: 130,
                      render: (v) => {
                        const st = String(v || "").toUpperCase();
                        return <Tag color={st === "APPROVED" || st === "PUBLISHED" ? "green" : st === "REJECTED" ? "red" : "orange"}>{st}</Tag>;
                      },
                    },
                    {
                      title: "Media",
                      width: 110,
                      render: (_: any, r: any) =>
                        r.rawVideoUrl || r.googleDriveLink ? (
                          <Button size="small" icon={<EyeOutlined />} href={r.rawVideoUrl || r.googleDriveLink} target="_blank">
                            Inspect
                          </Button>
                        ) : (
                          "-"
                        ),
                    },
                    {
                      title: "Actions",
                      width: 190,
                      render: (_: any, r: any) => (
                        <Space>
                          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => reviewContent(r.id, "APPROVE")}>
                            Approve
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => setRejectModal({ open: true, kind: "CONTENT", id: r.id })}
                          >
                            Reject
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "kyc",
            label: `Producer KYC Requests (${pendingKyc} pending)`,
            children: (
              <Card>
                <Table
                  rowKey={(r) => String(r.id)}
                  loading={loading}
                  dataSource={kycList}
                  columns={[
                    {
                      title: "Studio",
                      render: (_: any, r: any) => (
                        <div>
                          <strong>{r.studioName || r.companyName}</strong>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>{r.contactEmail} · {r.contactPhone}</div>
                        </div>
                      ),
                    },
                    {
                      title: "PAN",
                      render: (_: any, r: any) => (
                        <Space direction="vertical" size={2}>
                          <Text code>{r.panNumber || "N/A"}</Text>
                          <Space size={4}>
                            <Tag color={r.panStatus === "VERIFIED" ? "green" : "orange"}>{r.panStatus || "PENDING"}</Tag>
                            {r.panStatus !== "VERIFIED" && (
                              <Button size="small" type="link" onClick={() => verifyDoc(r.id, "PAN")}>Verify</Button>
                            )}
                          </Space>
                        </Space>
                      ),
                    },
                    {
                      title: "Aadhaar",
                      render: (_: any, r: any) => (
                        <Space direction="vertical" size={2}>
                          <Text code>{r.aadharNumber || "N/A"}</Text>
                          <Space size={4}>
                            <Tag color={r.aadharStatus === "VERIFIED" ? "green" : "orange"}>{r.aadharStatus || "PENDING"}</Tag>
                            {r.aadharStatus !== "VERIFIED" && (
                              <Button size="small" type="link" onClick={() => verifyDoc(r.id, "AADHAAR")}>Verify</Button>
                            )}
                          </Space>
                        </Space>
                      ),
                    },
                    {
                      title: "Status",
                      render: (_: any, r: any) => {
                        const st = String(r.onboardingStatus || r.status || "PENDING").toUpperCase();
                        return <Tag color={st === "APPROVED" ? "green" : st === "REJECTED" ? "red" : "orange"}>{st}</Tag>;
                      },
                    },
                    {
                      title: "Actions",
                      width: 190,
                      render: (_: any, r: any) => (
                        <Space>
                          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => reviewKyc(r.id, "APPROVE")}>
                            Approve
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => setRejectModal({ open: true, kind: "KYC", id: r.id })}
                          >
                            Reject
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="Rejection Reason"
        open={rejectModal.open}
        onOk={() => {
          if (!rejectModal.id) return;
          if (rejectModal.kind === "CONTENT") reviewContent(rejectModal.id, "REJECT", rejectNotes);
          else reviewKyc(rejectModal.id, "REJECT", rejectNotes);
        }}
        onCancel={() => setRejectModal({ open: false })}
      >
        <Input.TextArea
          rows={3}
          value={rejectNotes}
          onChange={(e) => setRejectNotes(e.target.value)}
          placeholder="Explain why this submission/KYC was rejected..."
        />
      </Modal>
    </div>
  );
};

export default ProducerReviewsPage;
