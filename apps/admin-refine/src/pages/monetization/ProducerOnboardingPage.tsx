import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Row,
  Col,
  Space,
  Alert,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined, CopyOutlined } from "@ant-design/icons";
import { apiPost } from "../../providers/api";

const { Title, Text } = Typography;

export const ProducerOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const res = await apiPost<any>("/admin/producers/onboard", values);
      setReceipt(res || values);
      message.success("Studio onboarded & ROLE_PRODUCER credentials provisioned");
    } catch (e: any) {
      message.error(e.message || "Failed to onboard producer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Producer Studio Onboarding Hub</Title>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/producers")}>
          Back to Producers Directory
        </Button>
      </div>

      {receipt && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
          message={`Studio "${receipt.studioName || receipt.companyName}" Provisioned!`}
          description={
            <Space direction="vertical" size={4}>
              <Text>Login Email: <strong>{receipt.contactEmail}</strong></Text>
              {receipt.loginPassword && (
                <Space>
                  <Text>Provisioned Password: <code>{receipt.loginPassword}</code></Text>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard?.writeText(receipt.loginPassword);
                      message.success("Password copied");
                    }}
                  >
                    Copy
                  </Button>
                </Space>
              )}
              <Text>Revenue Share: <strong>{receipt.defaultRevenueSharePercentage ?? receipt.revenueShare ?? 70}%</strong></Text>
            </Space>
          }
        />
      )}

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ businessType: "PRIVATE_LIMITED", defaultRevenueSharePercentage: 70 }}
        >
          <Title level={5}>1. Studio Legal Identity</Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="studioName" label="Studio / Company Legal Name" rules={[{ required: true }]}>
                <Input placeholder="Apex Digital Entertainment Pvt Ltd" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="studioRegistrationNumber" label="Registration / CIN Number" rules={[{ required: true }]}>
                <Input placeholder="U74999TG2026PTC109283" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="businessType" label="Corporate Entity Type">
                <Select
                  options={[
                    { value: "PRIVATE_LIMITED", label: "Private Limited (Pvt Ltd)" },
                    { value: "LLP", label: "LLP" },
                    { value: "PROPRIETORSHIP", label: "Sole Proprietorship" },
                    { value: "STUDIO_PRODUCTION", label: "Independent Film Studio" },
                    { value: "GLOBAL_DISTRIBUTOR", label: "International Distributor" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="contactEmail" label="Official Login Email" rules={[{ required: true, type: "email" }]}>
                <Input placeholder="partner@studio.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="contactPhone" label="Contact Phone" rules={[{ required: true }]}>
                <Input placeholder="+919876543210" />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5}>2. Revenue Share, Tax & Bank Settlement</Title>
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="defaultRevenueSharePercentage" label="Net Revenue Share (%)">
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="panNumber" label="PAN Number">
                <Input placeholder="ABCDE1234F" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="gstNumber" label="GSTIN (optional)">
                <Input placeholder="36ABCDE1234F1Z5" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="bankName" label="Bank Name">
                <Input placeholder="HDFC Bank" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="bankAccountNumber" label="Bank Account Number">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="ifscCode" label="IFSC Code">
                <Input placeholder="HDFC0001234" />
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Provision Studio & Create Login
            </Button>
            <Button onClick={() => { form.resetFields(); setReceipt(null); }}>
              Reset
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default ProducerOnboardingPage;
