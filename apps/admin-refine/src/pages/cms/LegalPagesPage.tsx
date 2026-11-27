import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  List,
  Tag,
  Button,
  Form,
  Input,
  Space,
  Segmented,
  Typography,
  message,
} from "antd";
import { SaveOutlined, PlusOutlined, FileTextOutlined, CopyOutlined } from "@ant-design/icons";
import { apiGet, apiPost, apiPut, extractArray } from "../../providers/api";

const { Title, Text } = Typography;

const DEFAULT_PAGES = [
  { slug: "privacy-policy", label: "Privacy Policy", description: "User data & privacy disclosures" },
  { slug: "terms-of-service", label: "Terms of Service", description: "Platform terms & conditions" },
  { slug: "refund-policy", label: "Refund Policy", description: "Cancellation & refund rules" },
  { slug: "cookie-policy", label: "Cookie Policy", description: "Cookies & local storage usage" },
  { slug: "about-us", label: "About Us", description: "Company & platform overview" },
  { slug: "contact-us", label: "Contact Us", description: "Support hours & help desk" },
  { slug: "grievance-redressal", label: "Grievance Redressal", description: "IT Rules compliance officer" },
];

const STARTER_TEMPLATES: Record<string, string> = {
  "privacy-policy": `<h2>Privacy Policy</h2><p>MaxxPixels OTT respects your privacy and protects your personal information.</p><h3>1. Information We Collect</h3><ul><li>Name, mobile number, and email address during registration.</li><li>Watch history and device sessions to improve playback quality.</li></ul>`,
  "terms-of-service": `<h2>Terms &amp; Conditions</h2><p>By using MaxxPixels OTT, you agree to these terms. All streams are licensed for personal, non-commercial viewing only.</p>`,
  "refund-policy": `<h2>Refund &amp; Cancellation Policy</h2><p>Cancel auto-renewal anytime from Account Settings. Verified duplicate charges are refunded within 5–7 business days.</p>`,
  "cookie-policy": `<h2>Cookie Policy</h2><p>MaxxPixels OTT uses essential cookies to keep you signed in and remember playback preferences.</p>`,
  "about-us": `<h2>About MaxxPixels OTT</h2><p>MaxxPixels delivers movies, web series, microdramas, short films, music, and live entertainment across Web, Mobile, and Smart TV.</p>`,
  "contact-us": `<h2>Contact Support</h2><p>Support Hours: Monday – Sunday, 9:00 AM – 9:00 PM IST.</p>`,
  "grievance-redressal": `<h2>Grievance Redressal Officer</h2><p>All content or compliance grievances are acknowledged within 24 hours and resolved within 15 days.</p>`,
};

export const LegalPagesPage: React.FC = () => {
  const [pagesMap, setPagesMap] = useState<Record<string, any>>({});
  const [selectedSlug, setSelectedSlug] = useState("privacy-policy");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const contentValue = Form.useWatch("content", form) || "";

  const loadPages = async () => {
    try {
      const res = await apiGet("/admin/legal");
      const arr = extractArray(res);
      const map: Record<string, any> = {};
      arr.forEach((p: any) => {
        if (p?.slug) map[p.slug] = p;
      });
      setPagesMap(map);
      selectSlug(selectedSlug, map);
    } catch (e: any) {
      message.error(e.message || "Failed to load legal pages");
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  const selectSlug = (slug: string, map = pagesMap) => {
    setCreating(false);
    setSelectedSlug(slug);
    const existing = map[slug];
    const def = DEFAULT_PAGES.find((d) => d.slug === slug);
    form.setFieldsValue({
      slug,
      title: existing?.title || def?.label || slug,
      content: existing?.content || "",
    });
  };

  const startNew = () => {
    setCreating(true);
    form.setFieldsValue({ slug: "", title: "", content: "" });
  };

  const useTemplate = () => {
    const tpl = STARTER_TEMPLATES[form.getFieldValue("slug") || selectedSlug];
    if (tpl) {
      form.setFieldValue("content", tpl);
      message.info("Starter template inserted");
    }
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (pagesMap[values.slug]) {
        await apiPut(`/admin/legal/${values.slug}`, values);
      } else {
        await apiPost("/admin/legal", values);
      }
      message.success(`"${values.title}" saved & published live`);
      setCreating(false);
      setSelectedSlug(values.slug);
      await loadPages();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "Failed to publish legal page");
    } finally {
      setSaving(false);
    }
  };

  const allSlugs = [
    ...DEFAULT_PAGES,
    ...Object.keys(pagesMap)
      .filter((s) => !DEFAULT_PAGES.some((d) => d.slug === s))
      .map((s) => ({ slug: s, label: pagesMap[s]?.title || s, description: "Custom policy page" })),
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Legal & Compliance Pages</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={startNew}>
          Add Legal Page
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={7}>
          <Card title={`Policy Pages (${allSlugs.length})`} size="small">
            <List
              dataSource={allSlugs}
              renderItem={(item) => {
                const isLive = Boolean(pagesMap[item.slug]);
                const active = !creating && selectedSlug === item.slug;
                return (
                  <List.Item
                    onClick={() => selectSlug(item.slug)}
                    style={{
                      cursor: "pointer",
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: active ? "rgba(26, 76, 216, 0.18)" : "transparent",
                    }}
                  >
                    <List.Item.Meta
                      avatar={<FileTextOutlined />}
                      title={item.label}
                      description={<Text type="secondary" style={{ fontSize: 11 }}>{item.description}</Text>}
                    />
                    <Tag color={isLive ? "green" : "default"}>{isLive ? "LIVE" : "DRAFT"}</Tag>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>

        <Col xs={24} md={17}>
          <Card
            title={creating ? "Create Legal Page" : form.getFieldValue("title") || selectedSlug}
            extra={
              <Space>
                <Button size="small" onClick={useTemplate}>Use Template</Button>
                <Segmented
                  size="small"
                  value={mode}
                  onChange={(v) => setMode(v as "edit" | "preview")}
                  options={[
                    { label: "Edit HTML", value: "edit" },
                    { label: "Live Preview", value: "preview" },
                  ]}
                />
              </Space>
            }
          >
            <Form form={form} layout="vertical">
              <Row gutter={12}>
                <Col xs={24} md={14}>
                  <Form.Item name="title" label="Page Title" rules={[{ required: true }]}>
                    <Input placeholder="Privacy Policy" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={10}>
                  <Form.Item name="slug" label="Public URL Slug (/legal/:slug)" rules={[{ required: true }]}>
                    <Input disabled={!creating} placeholder="privacy-policy" />
                  </Form.Item>
                </Col>
              </Row>

              {mode === "edit" ? (
                <Form.Item name="content" label="Policy Content (HTML)" rules={[{ required: true }]}>
                  <Input.TextArea rows={14} placeholder="<h2>Policy Heading</h2><p>...</p>" />
                </Form.Item>
              ) : (
                <Card
                  size="small"
                  style={{ minHeight: 300, marginBottom: 16 }}
                  title="Viewer Preview"
                >
                  <div dangerouslySetInnerHTML={{ __html: contentValue || "<p>No content yet.</p>" }} />
                </Card>
              )}

              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard?.writeText(`/legal/${form.getFieldValue("slug") || selectedSlug}`);
                    message.success("Public path copied");
                  }}
                >
                  Copy /legal/{form.getFieldValue("slug") || selectedSlug}
                </Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
                  Save & Publish Live
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LegalPagesPage;
