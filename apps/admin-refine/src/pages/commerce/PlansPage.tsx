import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Typography,
  Alert,
  message,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  GiftOutlined,
  BankOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut, apiDelete, extractArray } from "../../providers/api";

const { Title, Text } = Typography;

const DAY_OPTIONS = [
  { count: 1, label: "1 Day Pass (24 Hours)" },
  { count: 2, label: "2 Days Pass" },
  { count: 3, label: "3 Days Pass" },
  { count: 4, label: "4 Days Pass" },
  { count: 5, label: "5 Days Pass" },
  { count: 6, label: "6 Days Pass" },
  { count: 7, label: "7 Days Pass (1 Week)" },
  { count: 10, label: "10 Days Pass" },
  { count: 14, label: "14 Days Pass (2 Weeks)" },
  { count: 15, label: "15 Days Pass" },
  { count: 20, label: "20 Days Pass" },
  { count: 30, label: "30 Days Pass (1 Month)" },
  { count: 45, label: "45 Days Pass" },
  { count: 60, label: "60 Days Pass (2 Months)" },
  { count: 90, label: "90 Days Pass (3 Months)" },
  { count: 180, label: "180 Days Pass (6 Months)" },
  { count: 365, label: "365 Days Pass (1 Year)" },
];

const MONTH_OPTIONS = [
  { count: 1, label: "1 Month Subscription" },
  { count: 2, label: "2 Months Subscription" },
  { count: 3, label: "3 Months (Quarterly)" },
  { count: 4, label: "4 Months Subscription" },
  { count: 5, label: "5 Months Subscription" },
  { count: 6, label: "6 Months (Half-Yearly)" },
  { count: 9, label: "9 Months Subscription" },
  { count: 12, label: "12 Months (1 Year Annual)" },
  { count: 18, label: "18 Months (1.5 Years)" },
  { count: 24, label: "24 Months (2 Years)" },
  { count: 36, label: "36 Months (3 Years)" },
];

const YEAR_OPTIONS = [
  { count: 1, label: "1 Year Pass (Annual)" },
  { count: 2, label: "2 Years Pass" },
  { count: 3, label: "3 Years Pass" },
  { count: 4, label: "4 Years Pass" },
  { count: 5, label: "5 Years Pass" },
  { count: 10, label: "10 Years Lifetime Pass" },
];

type BillingUnit = "DAY" | "MONTH" | "YEAR" | "ONE_TIME";

function parseBillingPeriod(period?: string): { unit: BillingUnit; count: number } {
  const p = String(period || "MONTHLY").toUpperCase();
  if (p === "ONE_TIME" || p === "LIFETIME") return { unit: "ONE_TIME", count: 1 };
  if (p === "DAILY") return { unit: "DAY", count: 1 };
  if (p === "WEEKLY") return { unit: "DAY", count: 7 };
  if (p.startsWith("DAY_")) return { unit: "DAY", count: Number(p.slice(4)) || 1 };
  if (p === "MONTHLY") return { unit: "MONTH", count: 1 };
  if (p === "QUARTERLY") return { unit: "MONTH", count: 3 };
  if (p === "SEMI_ANNUAL" || p === "HALF_YEARLY") return { unit: "MONTH", count: 6 };
  if (p.startsWith("MONTH_")) return { unit: "MONTH", count: Number(p.slice(6)) || 1 };
  if (p === "ANNUAL" || p === "YEARLY") return { unit: "YEAR", count: 1 };
  if (p.startsWith("YEAR_")) return { unit: "YEAR", count: Number(p.slice(5)) || 1 };
  return { unit: "MONTH", count: 1 };
}

function computeBillingPeriod(unit: BillingUnit, count: number): { billingPeriod: string; durationDays: number } {
  const n = Math.max(1, Number(count) || 1);
  if (unit === "ONE_TIME") return { billingPeriod: "ONE_TIME", durationDays: 3650 };
  if (unit === "DAY") {
    const bp = n === 1 ? "DAILY" : n === 7 ? "WEEKLY" : `DAY_${n}`;
    return { billingPeriod: bp, durationDays: n };
  }
  if (unit === "MONTH") {
    const bp = n === 1 ? "MONTHLY" : n === 3 ? "QUARTERLY" : `MONTH_${n}`;
    return { billingPeriod: bp, durationDays: n * 30 };
  }
  const bp = n === 1 ? "ANNUAL" : `YEAR_${n}`;
  return { billingPeriod: bp, durationDays: n * 365 };
}

function formatBillingLabel(period?: string): string {
  const { unit, count } = parseBillingPeriod(period);
  if (unit === "ONE_TIME") return "One-Time / Lifetime";
  if (unit === "DAY") return count === 1 ? "1 Day Pass (24h)" : `${count} Days Pass`;
  if (unit === "MONTH") return count === 1 ? "Monthly" : `${count} Months`;
  return count === 1 ? "Annual (1 Year)" : `${count} Years`;
}

export const PlansPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  // Filters
  const [search, setSearch] = useState("");
  const [billingFilter, setBillingFilter] = useState<string>("ALL");
  const [autopayFilter, setAutopayFilter] = useState<string>("ALL");
  const [resFilter, setResFilter] = useState<string>("ALL");

  // KPIs
  const [analytics, setAnalytics] = useState<{ totalRevenue: number; activeSubscribers: number; arpu: number }>({
    totalRevenue: 0,
    activeSubscribers: 0,
    arpu: 0,
  });

  const watchedUnit: BillingUnit = Form.useWatch("billingUnit", form) || "MONTH";
  const watchedAutopay: boolean = Form.useWatch("autopayEnabled", form) ?? true;

  const durationOptions =
    watchedUnit === "DAY"
      ? DAY_OPTIONS
      : watchedUnit === "MONTH"
      ? MONTH_OPTIONS
      : watchedUnit === "YEAR"
      ? YEAR_OPTIONS
      : [];

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, statsRes] = await Promise.all([
        apiGet("/admin/plans").catch(() => []),
        apiGet("/admin/payments/analytics").catch(() => ({})),
      ]);
      setRows(extractArray(plansRes));
      const rev = Number(statsRes?.totalRevenue || 0);
      const subs = Number(statsRes?.activeSubscribersCount || statsRes?.totalTransactions || 0);
      setAnalytics({
        totalRevenue: rev,
        activeSubscribers: subs,
        arpu: Number(statsRes?.arpu || (subs > 0 ? Math.round(rev / subs) : 0)),
      });
    } catch (e: any) {
      message.error(e?.message || "Failed loading plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      billingUnit: "DAY",
      billingCount: 1,
      price: 49,
      maxResolution: "1080p",
      maxDevices: 2,
      maxConcurrentStreams: 1,
      maxProfiles: 2,
      trialDays: 0,
      adsEnabled: false,
      downloadsEnabled: true,
      autopayEnabled: true,
      singleUseOnly: false,
      active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (rec: any) => {
    setEditing(rec);
    const parsed = parseBillingPeriod(rec.billingPeriod || rec.billing_period);
    form.setFieldsValue({
      name: rec.name,
      code: rec.code,
      billingUnit: parsed.unit,
      billingCount: parsed.count,
      price: Number(rec.price || 0),
      maxResolution: rec.maxResolution || rec.maxVideoQuality || "1080p",
      maxDevices: Number(rec.maxDevices ?? 2),
      maxConcurrentStreams: Number(rec.maxConcurrentStreams ?? rec.maxStreams ?? 1),
      maxProfiles: Number(rec.maxProfiles ?? 2),
      trialDays: Number(rec.trialDays ?? 0),
      adsEnabled: Boolean(rec.adsEnabled ?? rec.hasAds ?? false),
      downloadsEnabled: rec.downloadsEnabled ?? rec.allowDownloads ?? true,
      autopayEnabled: rec.autopayEnabled ?? rec.autoRenew ?? true,
      razorpayPlanId: rec.razorpayPlanId || "",
      singleUseOnly: Boolean(rec.singleUseOnly),
      active: rec.active ?? rec.isActive ?? true,
    });
    setModalOpen(true);
  };

  const handleSave = async (vals: any) => {
    setSaving(true);
    try {
      const { billingPeriod, durationDays } = computeBillingPeriod(vals.billingUnit, vals.billingCount);
      const payload = {
        name: String(vals.name || "").trim(),
        code: vals.code
          ? String(vals.code).trim().toUpperCase()
          : String(vals.name || "PLAN")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "_"),
        billingPeriod,
        durationDays,
        price: Number(vals.price || 0),
        currency: "INR",
        maxResolution: vals.maxResolution || "1080p",
        maxVideoQuality: vals.maxResolution || "1080p",
        maxDevices: Number(vals.maxDevices || 2),
        maxConcurrentStreams: Number(vals.maxConcurrentStreams || 1),
        maxProfiles: Number(vals.maxProfiles || 2),
        trialDays: Number(vals.trialDays || 0),
        adsEnabled: Boolean(vals.adsEnabled),
        hasAds: Boolean(vals.adsEnabled),
        downloadsEnabled: Boolean(vals.downloadsEnabled),
        allowDownloads: Boolean(vals.downloadsEnabled),
        autopayEnabled: Boolean(vals.autopayEnabled),
        razorpayPlanId: vals.razorpayPlanId ? String(vals.razorpayPlanId).trim() : "",
        singleUseOnly: Boolean(vals.singleUseOnly),
        active: Boolean(vals.active),
        isActive: Boolean(vals.active),
      };

      if (editing?.id) {
        await apiPut(`/admin/plans/${editing.id}`, payload);
        message.success(`Plan "${payload.name}" updated!`);
      } else {
        await apiPost("/admin/plans", payload);
        message.success(`Plan "${payload.name}" published!`);
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (rec: any) => {
    try {
      await apiPost(`/admin/plans/${rec.id}/toggle-status`, {});
      message.success(`Plan "${rec.name}" status updated`);
      load();
    } catch {
      await apiPut(`/admin/plans/${rec.id}`, { ...rec, active: !(rec.active ?? rec.isActive), isActive: !(rec.active ?? rec.isActive) });
      load();
    }
  };

  const filtered = rows.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || String(p.name || "").toLowerCase().includes(q) || String(p.code || "").toLowerCase().includes(q);
    let matchBilling = true;
    if (billingFilter !== "ALL") {
      const parsed = parseBillingPeriod(p.billingPeriod);
      if (billingFilter === "DAILY") matchBilling = parsed.unit === "DAY";
      else if (billingFilter === "ONE_TIME") matchBilling = parsed.unit === "ONE_TIME";
      else if (billingFilter === "MONTHLY") matchBilling = parsed.unit === "MONTH";
      else if (billingFilter === "ANNUAL") matchBilling = parsed.unit === "YEAR" || (parsed.unit === "MONTH" && parsed.count === 12);
    }
    let matchAutopay = true;
    const isAuto = p.autopayEnabled !== false;
    if (autopayFilter === "AUTOPAY") matchAutopay = isAuto;
    else if (autopayFilter === "PREPAID") matchAutopay = !isAuto;

    const res = p.maxResolution || p.maxVideoQuality || "1080p";
    const matchRes = resFilter === "ALL" || res === resFilter;
    return matchSearch && matchBilling && matchAutopay && matchRes;
  });

  const activeCount = rows.filter((p) => (p.active ?? p.isActive) !== false).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <Tag color="blue" style={{ marginBottom: 4 }}>MONETIZATION &amp; SUBSCRIPTION TIERS</Tag>
          <Title level={3} style={{ margin: 0 }}>Subscription Plans &amp; Billing Cycles</Title>
        </div>
        <Space wrap>
          <Button icon={<GiftOutlined />} onClick={() => navigate("/admin/coupons")}>Coupons &amp; Offers</Button>
          <Button icon={<BankOutlined />} onClick={() => navigate("/admin/payments")}>Payments &amp; Refunds</Button>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" danger icon={<PlusOutlined />} onClick={openCreate}>
            Create New Subscription Plan
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Active / Total Plans" value={`${activeCount} / ${rows.length}`} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Active Subscribers" value={analytics.activeSubscribers} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Total Revenue (MRR)" value={analytics.totalRevenue} prefix="₹" precision={2} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="ARPU" value={analytics.arpu} prefix="₹" /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="middle" style={{ width: "100%", justifyContent: "space-between" }}>
          <Space wrap size={6}>
            <Text strong style={{ fontSize: 12 }}>Billing Cycle:</Text>
            {[
              { k: "ALL", l: "All Cycles" },
              { k: "DAILY", l: "Day Pass" },
              { k: "ONE_TIME", l: "One-Time Rental" },
              { k: "MONTHLY", l: "Monthly" },
              { k: "ANNUAL", l: "Annual" },
            ].map((b) => (
              <Button key={b.k} size="small" type={billingFilter === b.k ? "primary" : "default"} onClick={() => setBillingFilter(b.k)}>
                {b.l}
              </Button>
            ))}
          </Space>

          <Space wrap size={6}>
            <Text strong style={{ fontSize: 12 }}>Billing:</Text>
            {[
              { k: "ALL", l: "All" },
              { k: "AUTOPAY", l: "Autopay" },
              { k: "PREPAID", l: "Prepaid" },
            ].map((a) => (
              <Button key={a.k} size="small" type={autopayFilter === a.k ? "primary" : "default"} onClick={() => setAutopayFilter(a.k)}>
                {a.l}
              </Button>
            ))}
            <Select
              size="small"
              value={resFilter}
              onChange={setResFilter}
              style={{ width: 120 }}
              options={[
                { value: "ALL", label: "All Quality" },
                { value: "720p", label: "720p HD" },
                { value: "1080p", label: "1080p FHD" },
                { value: "4K_UHD", label: "4K UHD" },
              ]}
            />
            <Input
              size="small"
              prefix={<SearchOutlined />}
              placeholder="Search plan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 170 }}
            />
          </Space>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          columns={[
            {
              title: "Plan",
              dataIndex: "name",
              render: (v, r) => (
                <div>
                  <strong>{v}</strong>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    <code>{r.code}</code> • {formatBillingLabel(r.billingPeriod)}
                  </div>
                </div>
              ),
            },
            {
              title: "Price",
              dataIndex: "price",
              render: (v, r) => (
                <div>
                  <strong>₹{v}</strong>
                  {r.trialDays > 0 && <div><Tag color="gold">{r.trialDays}d Free Trial</Tag></div>}
                </div>
              ),
            },
            {
              title: "Billing",
              render: (_: any, r: any) => (
                <Space direction="vertical" size={2}>
                  <Tag color={r.autopayEnabled !== false ? "blue" : "default"}>
                    {r.autopayEnabled !== false ? "Autopay" : "Prepaid"}
                  </Tag>
                  {r.singleUseOnly && <Tag color="red">Single-Use</Tag>}
                </Space>
              ),
            },
            {
              title: "Entitlements",
              render: (_: any, r: any) => (
                <Space wrap size={4}>
                  <Tag color="purple">{r.maxResolution || r.maxVideoQuality || "1080p"}</Tag>
                  <Tag color="blue">{r.maxConcurrentStreams ?? 1} stream(s)</Tag>
                  <Tag>{r.maxDevices ?? 2} dev</Tag>
                  <Tag color={(r.adsEnabled || r.hasAds) ? "orange" : "green"}>
                    {(r.adsEnabled || r.hasAds) ? "With Ads" : "Ad-Free"}
                  </Tag>
                </Space>
              ),
            },
            {
              title: "Active",
              width: 90,
              render: (_: any, r: any) => (
                <Switch checked={(r.active ?? r.isActive) !== false} onChange={() => toggleStatus(r)} />
              ),
            },
            {
              title: "Actions",
              width: 110,
              render: (_, r) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                  <Popconfirm title="Delete plan?" onConfirm={async () => { await apiDelete(`/admin/plans/${r.id}`); load(); }}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? `Edit Subscription Tier: ${editing.name}` : "Create New Subscription Plan"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={editing ? "Update Tier" : "Publish Subscription Plan"}
        confirmLoading={saving}
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Subscription Plan Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. 1-Day Event VIP Pass or Premium 4K Ultra" />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="code" label="Plan Code (Unique Identifier)">
                <Input placeholder="e.g. DAY_7_PASS" style={{ textTransform: "uppercase" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="billingUnit" label="Billing Period Unit *" rules={[{ required: true }]}>
                <Select
                  onChange={() => form.setFieldValue("billingCount", 1)}
                  options={[
                    { value: "DAY", label: "📅 Day(s) Pass" },
                    { value: "MONTH", label: "🗓️ Month(s) Subscription" },
                    { value: "YEAR", label: "🏆 Year(s) Annual Pass" },
                    { value: "ONE_TIME", label: "🎟️ One-Time Rental / Lifetime" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          {watchedUnit !== "ONE_TIME" && (
            <Form.Item
              name="billingCount"
              label="Select Duration Number / Count (e.g. 7 Days, 30 Days, 3 Months) *"
              rules={[{ required: true }]}
            >
              <Select options={durationOptions.map((o) => ({ value: o.count, label: o.label }))} />
            </Form.Item>
          )}

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="price" label="Price Amount (₹ INR) *" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} prefix="₹" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="maxResolution" label="Max Stream Resolution">
                <Select
                  options={[
                    { value: "720p", label: "720p Mobile HD" },
                    { value: "1080p", label: "1080p Full HD" },
                    { value: "4K_UHD", label: "4K Ultra HD + HDR" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={8}>
              <Form.Item name="maxDevices" label="Max Devices">
                <InputNumber style={{ width: "100%" }} min={1} max={20} />
              </Form.Item>
            </Col>
            <Col xs={8}>
              <Form.Item name="maxConcurrentStreams" label="Concurrent Streams">
                <InputNumber style={{ width: "100%" }} min={1} max={10} />
              </Form.Item>
            </Col>
            <Col xs={8}>
              <Form.Item name="trialDays" label="Free Trial Days">
                <InputNumber style={{ width: "100%" }} min={0} max={90} />
              </Form.Item>
            </Col>
          </Row>

          <Space size="large" wrap style={{ marginBottom: 14 }}>
            <Form.Item name="adsEnabled" label="Contains Ads (AVOD)" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item name="downloadsEnabled" label="Offline Downloads" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item name="singleUseOnly" label="Single-Use Only" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item name="active" label="Active & Live" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
          </Space>

          <Card size="small" style={{ marginTop: 8 }}>
            <Form.Item name="autopayEnabled" label="🔄 Enable Recurring Autopay (Auto-Debit / e-Mandate)" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch />
            </Form.Item>
            <Alert
              type="info"
              message="When enabled, checkout initializes UPI Autopay / Card / NetBanking e-Mandate renewing automatically each billing cycle until cancelled."
              style={{ marginBottom: watchedAutopay ? 12 : 0 }}
            />
            {watchedAutopay && (
              <Form.Item name="razorpayPlanId" label="Razorpay Subscription Plan ID (Optional e.g. plan_N123456789)" style={{ marginBottom: 0 }}>
                <Input placeholder="e.g. plan_MAXX_MONTHLY_149" />
              </Form.Item>
            )}
          </Card>
        </Form>
      </Modal>
    </div>
  );
};
