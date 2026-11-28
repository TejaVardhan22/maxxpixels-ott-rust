import React, { useEffect, useState } from "react";
import {
  Card,
  Tabs,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Row,
  Col,
  Tag,
  Popconfirm,
  Typography,
  Alert,
  Divider,
  Spin,
  message,
} from "antd";
import {
  SaveOutlined,
  UndoOutlined,
  SearchOutlined,
  GlobalOutlined,
  DollarOutlined,
  ToolOutlined,
  HistoryOutlined,
  RollbackOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, extractArray } from "../../providers/api";
import { MediaUpload } from "../../components/MediaUpload";

const { Title, Text } = Typography;

interface AuditHistoryRecord {
  id: number | string;
  action?: string;
  entityName?: string;
  entityId?: string;
  userEmail?: string;
  changedBy?: string;
  details?: string;
  settingKey?: string;
  oldValue?: string;
  newValue?: string;
  createdAt?: string;
}

function coerceSettings(raw: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...raw };
  const aliases: Record<string, string[]> = {
    logoUrl: ["logoUrl", "APP_LOGO_URL", "appLogoUrl", "logo_url"],
    darkLogoUrl: ["darkLogoUrl", "DARK_LOGO_URL", "dark_logo_url"],
    maintenanceMode: ["maintenanceMode", "MAINTENANCE_MODE_ENABLED", "maintenanceModeEnabled"],
  };
  for (const [target, keys] of Object.entries(aliases)) {
    if (normalized[target] === undefined || normalized[target] === null || normalized[target] === "") {
      for (const k of keys) {
        if (normalized[k] !== undefined && normalized[k] !== null && normalized[k] !== "") {
          normalized[target] = normalized[k];
          break;
        }
      }
    }
  }
  if (typeof normalized.maintenanceMode === "string") {
    normalized.maintenanceMode =
      normalized.maintenanceMode.toLowerCase() === "true" || normalized.maintenanceMode === "1";
  }
  if (typeof normalized.admobEnabled === "boolean") {
    normalized.admobEnabled = normalized.admobEnabled ? "true" : "false";
  }
  if (typeof normalized.admobTestMode === "boolean") {
    normalized.admobTestMode = normalized.admobTestMode ? "true" : "false";
  }
  return normalized;
}

export const SystemSettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("BRANDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<AuditHistoryRecord[]>([]);

  const appName = Form.useWatch("appName", form);
  const maintenanceMode = Form.useWatch("maintenanceMode", form);
  const admobEnabled = Form.useWatch("admobEnabled", form);
  const admobTestMode = Form.useWatch("admobTestMode", form);
  const logoUrl = Form.useWatch("logoUrl", form);
  const darkLogoUrl = Form.useWatch("darkLogoUrl", form);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await apiGet<Record<string, any>>("/admin/settings");
      const raw =
        res && typeof res === "object" && !Array.isArray(res)
          ? res.settings && typeof res.settings === "object" && !Array.isArray(res.settings)
            ? res.settings
            : res
          : {};
      form.setFieldsValue({
        admobEnabled: "false",
        admobTestMode: "false",
        maintenanceMode: false,
        ...coerceSettings(raw),
      });
      setDirty(false);
    } catch (e: any) {
      message.error(e.message || "Failed to load system settings");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await apiGet("/admin/settings/history");
      setHistoryRecords(extractArray(res));
    } catch (e: any) {
      message.error(e.message || "Failed to load configuration audit history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    const q = val.toLowerCase().trim();
    if (!q) return;
    if (q.includes("brand") || q.includes("logo") || q.includes("seo") || q.includes("social")) {
      setActiveTab("BRANDING");
    } else if (q.includes("ad") || q.includes("admob") || q.includes("banner")) {
      setActiveTab("ADMOB");
    } else if (q.includes("maint")) {
      setActiveTab("MAINTENANCE");
    } else if (q.includes("hist") || q.includes("audit") || q.includes("rollback")) {
      setActiveTab("HISTORY");
      loadHistory();
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(values || {})) {
        if (v === undefined) continue;
        payload[k] = v === null ? "" : String(v);
      }
      const res = await apiPut<any>("/admin/settings", payload);
      const count = res?.updated;
      message.success(
        typeof count === "number" && count === 0
          ? "No changes detected — configuration is already up to date."
          : `Platform settings saved${count !== undefined ? ` (${count} updated)` : ""} and cache refreshed!`
      );
      setDirty(false);
      window.dispatchEvent(new Event("branding-updated"));
      await loadSettings();
      if (activeTab === "HISTORY") {
        loadHistory();
      }
    } catch (e: any) {
      if (e?.errorFields) {
        message.error("Please fill in all required fields before saving.");
        return;
      }
      message.error(e.message || "Unable to save platform settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (auditLogId: number | string) => {
    try {
      await apiPost(`/admin/settings/rollback/${auditLogId}`, {});
      message.success("Configuration rolled back successfully!");
      loadSettings();
      loadHistory();
    } catch (e: any) {
      message.error(e.message || "Rollback failed");
    }
  };

  return (
    <div>
      {/* 1. EXECUTIVE HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <Tag color="blue" style={{ marginBottom: 6 }}>PLATFORM INFRASTRUCTURE &amp; CONFIGURATION</Tag>
          <Title level={3} style={{ margin: "0 0 4px" }}>
            System Settings &amp; Central Control Studio
          </Title>
          <Text type="secondary">
            Manage platform branding, Google AdMob, Maintenance Mode, and configuration audit rollback
          </Text>
        </div>
        <Space>
          {dirty && (
            <Tag icon={<WarningOutlined />} color="warning">
              Unsaved Changes
            </Tag>
          )}
          {dirty && (
            <Popconfirm title="Discard all unsaved changes and reload?" onConfirm={loadSettings}>
              <Button icon={<UndoOutlined />}>Discard</Button>
            </Popconfirm>
          )}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            style={{ background: "linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%)", border: "none" }}
          >
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </Space>
      </div>

      {/* 2. EXECUTIVE KPI SUMMARY CARDS */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>Platform Brand</Text>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#52c41a", marginTop: 4 }}>
              {appName || "Not Set"}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>Platform Status</Text>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: maintenanceMode ? "#ff4d4f" : "#52c41a",
                marginTop: 4,
              }}
            >
              {maintenanceMode ? "🔴 Maintenance Active" : "🟢 Live & Operational"}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>Google AdMob</Text>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: admobEnabled === "true" ? "#52c41a" : "#ff4d4f",
                marginTop: 4,
              }}
            >
              {admobEnabled === "true"
                ? admobTestMode === "true"
                  ? "🧪 Test Mode"
                  : "🟢 Live Ads"
                : "🔴 Disabled"}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 3. SEARCH & QUICK FILTER BAR */}
      <Input
        prefix={<SearchOutlined />}
        allowClear
        size="large"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search settings (e.g. branding, admob, maintenance, audit)..."
        style={{ marginBottom: 16 }}
      />

      {/* 4. CATEGORY TABS */}
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => setDirty(true)}
          onFinish={handleSave}
        >
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              if (key === "HISTORY") loadHistory();
            }}
            items={[
              {
                key: "BRANDING",
                label: (
                  <Space size={6}>
                    <GlobalOutlined />
                    <span>Branding &amp; Identity</span>
                  </Space>
                ),
                children: (
                  <Card title="General Branding, Contact & Public URLs">
                    <Divider plain>Platform Identity</Divider>
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="appName" label="Application Platform Name" rules={[{ required: true }]}>
                          <Input placeholder="MaxxPixels OTT" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="appShortName" label="Short App Name" rules={[{ required: true }]}>
                          <Input maxLength={30} placeholder="MaxxPixels" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="companyName" label="Legal Company Name" rules={[{ required: true }]}>
                          <Input placeholder="MaxxPixels Entertainment Pvt Ltd" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="websiteUrl" label="Public Website URL" rules={[{ required: true }]}>
                          <Input placeholder="https://maxxpixels.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="logoUrl" label="Primary Logo URL" rules={[{ required: true }]}>
                          <MediaUpload type="image" folder="branding" />
                        </Form.Item>
                        {logoUrl && (
                          <img src={logoUrl} alt="Primary Logo" style={{ maxHeight: 48, marginBottom: 12, borderRadius: 6 }} />
                        )}
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="darkLogoUrl" label="Dark Mode / Mobile Logo URL">
                          <MediaUpload type="image" folder="branding" />
                        </Form.Item>
                        {darkLogoUrl && (
                          <img src={darkLogoUrl} alt="Dark Logo" style={{ maxHeight: 48, marginBottom: 12, borderRadius: 6 }} />
                        )}
                      </Col>
                    </Row>

                    <Divider plain>Customer Support &amp; Legal Links</Divider>
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="supportEmail" label="Customer Support Email" rules={[{ required: true }]}>
                          <Input type="email" placeholder="support@maxxpixels.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="supportPhone" label="Customer Support Phone" rules={[{ required: true }]}>
                          <Input placeholder="+91 98765 43210" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="termsUrl" label="Terms of Service URL" rules={[{ required: true }]}>
                          <Input placeholder="https://maxxpixels.com/legal/terms-of-service" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="privacyPolicyUrl" label="Privacy Policy URL" rules={[{ required: true }]}>
                          <Input placeholder="https://maxxpixels.com/legal/privacy-policy" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Divider plain>SEO &amp; App Store Links</Divider>
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="seoTitle" label="SEO Meta Title" rules={[{ required: true }]}>
                          <Input maxLength={70} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="androidAppUrl" label="Android Play Store App URL">
                          <Input placeholder="https://play.google.com/store/apps/details?id=..." />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Form.Item name="seoDescription" label="SEO Meta Description" rules={[{ required: true }]}>
                          <Input.TextArea rows={2} maxLength={170} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Divider plain>Social Media Links (Shown in Website Footer)</Divider>
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="facebookUrl" label="Facebook Page URL">
                          <Input placeholder="https://www.facebook.com/maxxpixels" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="instagramUrl" label="Instagram Profile URL">
                          <Input placeholder="https://www.instagram.com/maxxpixels" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="twitterUrl" label="X (Twitter) Profile URL">
                          <Input placeholder="https://x.com/maxxpixels" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="youtubeUrl" label="YouTube Channel URL">
                          <Input placeholder="https://www.youtube.com/@maxxpixels" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Button type="primary" htmlType="submit" block size="large" icon={<SaveOutlined />} loading={saving}>
                      Save Branding Configuration
                    </Button>
                  </Card>
                ),
              },
              {
                key: "ADMOB",
                label: (
                  <Space size={6}>
                    <DollarOutlined />
                    <span>Google AdMob</span>
                  </Space>
                ),
                children: (
                  <Card title="Google AdMob (Mobile App)">
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="admobEnabled" label="AdMob Status" rules={[{ required: true }]}>
                          <Select
                            options={[
                              { value: "true", label: "🟢 Active (Serve Live In-App Ads)" },
                              { value: "false", label: "🔴 Disabled (Ad-Free for All Users)" },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="admobTestMode" label="AdMob Mode (Live vs. Test Ads)">
                          <Select
                            options={[
                              { value: "false", label: "🚀 Production Mode (Real Ad Units)" },
                              { value: "true", label: "🧪 Test Mode (Guaranteed Google Test Ads)" },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="admobBannerId" label="Banner Ad Unit ID">
                          <Input placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="admobInterstitialId" label="Interstitial Ad Unit ID">
                          <Input placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="admobRewardedId" label="Rewarded Video Ad Unit ID">
                          <Input placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Button type="primary" htmlType="submit" block size="large" icon={<SaveOutlined />} loading={saving}>
                      Save AdMob Settings
                    </Button>
                  </Card>
                ),
              },
              {
                key: "MAINTENANCE",
                label: (
                  <Space size={6}>
                    <ToolOutlined />
                    <span>Maintenance Mode</span>
                  </Space>
                ),
                children: (
                  <Card title="Platform Maintenance Mode">
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message="Platform Maintenance Mode"
                      description="When active, Web & Mobile show the maintenance screen and non-admin API routes return HTTP 503. Admins can still log in and manage the console."
                    />
                    <Form.Item name="maintenanceMode" label="Enable Maintenance Mode" valuePropName="checked">
                      <Switch checkedChildren="ON" unCheckedChildren="OFF" />
                    </Form.Item>
                    <Form.Item name="maintenanceMessage" label="Custom Maintenance Message for End Users">
                      <Input.TextArea
                        rows={3}
                        placeholder="We are currently performing scheduled maintenance. Please check back shortly."
                      />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block size="large" icon={<SaveOutlined />} loading={saving}>
                      Save Maintenance Settings
                    </Button>
                  </Card>
                ),
              },
              {
                key: "HISTORY",
                label: (
                  <Space size={6}>
                    <HistoryOutlined />
                    <span>Audit &amp; Rollback</span>
                  </Space>
                ),
                children: (
                  <Card title="Configuration Change Audit Trail & One-Click Rollback">
                    <Spin spinning={historyLoading}>
                      {historyRecords.length === 0 ? (
                        <Text type="secondary">
                          No configuration changes recorded yet. Changes will be tracked automatically upon save.
                        </Text>
                      ) : (
                        <Space direction="vertical" style={{ width: "100%" }} size="middle">
                          {historyRecords.map((rec) => (
                            <Card
                              key={String(rec.id)}
                              size="small"
                              title={
                                <Space>
                                  <Tag color="blue">{rec.action || rec.settingKey || "UPDATE"}</Tag>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    by <strong>{rec.userEmail || rec.changedBy || "admin"}</strong>
                                    {rec.createdAt ? ` • ${new Date(rec.createdAt).toLocaleString()}` : ""}
                                  </Text>
                                </Space>
                              }
                              extra={
                                <Popconfirm
                                  title="Rollback to this configuration state?"
                                  description="Unsaved changes will be discarded."
                                  onConfirm={() => handleRollback(rec.id)}
                                >
                                  <Button size="small" danger icon={<RollbackOutlined />}>
                                    Rollback to this state
                                  </Button>
                                </Popconfirm>
                              }
                            >
                              <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", opacity: 0.85 }}>
                                {rec.details || `${rec.oldValue ?? ""} → ${rec.newValue ?? ""}`}
                              </pre>
                            </Card>
                          ))}
                        </Space>
                      )}
                    </Spin>
                  </Card>
                ),
              },
            ]}
          />
        </Form>
      </Spin>
    </div>
  );
};

export default SystemSettingsPage;
