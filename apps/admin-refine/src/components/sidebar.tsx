import React, { useEffect, useState } from "react";
import { Menu, Button, Typography, Avatar, Space, Badge } from "antd";
import type { MenuProps } from "antd";
import { useLocation, useNavigate } from "react-router";
import {
  DashboardOutlined,
  BarChartOutlined,
  PlusSquareOutlined,
  VideoCameraOutlined,
  PlaySquareOutlined,
  WifiOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  CustomerServiceOutlined,
  PlayCircleOutlined,
  AudioOutlined,
  PictureOutlined,
  LayoutOutlined,
  FileTextOutlined,
  TeamOutlined,
  CreditCardOutlined,
  BankOutlined,
  TagOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  HeartOutlined,
  ShopOutlined,
  UserAddOutlined,
  AuditOutlined,
  LockOutlined,
  HistoryOutlined,
  LogoutOutlined,
  FundProjectionScreenOutlined,
  SoundOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import { apiGet, extractArray, TOKEN_KEY, USER_KEY } from "../providers/api";

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "{}");
  } catch {
    return {};
  }
};

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const [pendingReviews, setPendingReviews] = useState(0);

  useEffect(() => {
    let active = true;
    const loadPending = async () => {
      try {
        const subRes = await apiGet("/admin/content/submissions?status=ALL");
        if (!active) return;
        const list = extractArray(subRes);
        const count = list.filter((item: any) => {
          const st = String(item?.status || "").toUpperCase();
          return st === "SUBMITTED" || st === "KYC_SUBMITTED";
        }).length;
        setPendingReviews(count);
      } catch {
        // ignore background badge error
      }
    };
    loadPending();
    const timer = setInterval(loadPending, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    navigate("/login");
  };

  const currentKey = `${location.pathname}${location.search || ""}`;

  const menuItems: MenuProps["items"] = [
    { key: "/admin/platform-admin", label: "Platform Admin", icon: <CrownOutlined /> },
    { key: "/admin/dashboard", label: "Dashboard", icon: <DashboardOutlined /> },
    { key: "/admin/analytics", label: "Analytics & BI", icon: <BarChartOutlined /> },
    {
      key: "content-create",
      label: "Content",
      icon: <PlusSquareOutlined />,
      children: [
        { key: "/admin/movies/new", label: "Single (Movies, Songs...)", icon: <VideoCameraOutlined /> },
        { key: "/admin/series/new", label: "Series & Episodes", icon: <PlaySquareOutlined /> },
      ],
    },
    { key: "/admin/basic-details", label: "Basic Details", icon: <DatabaseOutlined /> },
    { key: "/admin/movies?type=ALL", label: "All Catalog", icon: <AppstoreOutlined /> },
    { key: "/admin/series", label: "Series", icon: <PlaySquareOutlined /> },
    { key: "/admin/live", label: "Live TV & Sports", icon: <WifiOutlined /> },
    { type: "divider" },
    { key: "/admin/producers", label: "Producers Directory", icon: <ShopOutlined /> },
    { key: "/admin/producers/onboard", label: "Producer Onboarding", icon: <UserAddOutlined /> },
    {
      key: "/admin/producer-reviews",
      label: (
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Producer Reviews</span>
          {pendingReviews > 0 && <Badge count={pendingReviews} size="small" />}
        </span>
      ),
      icon: <AuditOutlined />,
    },
    { type: "divider" },
    { key: "/admin/cms", label: "Home CMS", icon: <LayoutOutlined /> },
    { key: "/admin/banners", label: "Hero Banners", icon: <PictureOutlined /> },
    { key: "/admin/intro-video", label: "Intro Video", icon: <PlayCircleOutlined /> },
    { key: "/admin/portal-banners", label: "Portal Banners", icon: <PictureOutlined /> },
    { key: "/admin/legal-pages", label: "Legal Pages", icon: <FileTextOutlined /> },
    { type: "divider" },
    { key: "/admin/users", label: "Users", icon: <TeamOutlined /> },
    { key: "/admin/plans", label: "Subscription Plans", icon: <CreditCardOutlined /> },
    { key: "/admin/payments", label: "Payment Transactions", icon: <BankOutlined /> },
    { key: "/admin/coupons", label: "Coupons & Offers", icon: <TagOutlined /> },
    { key: "/admin/marketing-agents", label: "Marketing Agents", icon: <SoundOutlined /> },
    { key: "/admin/ads", label: "Ad Monetization & IMA", icon: <ShopOutlined /> },
    { key: "/admin/ads/ssai", label: "SSAI Video Campaigns", icon: <FundProjectionScreenOutlined /> },
    { key: "/admin/drm", label: "Multi-DRM Security", icon: <LockOutlined /> },
    { key: "/admin/notifications", label: "Notifications", icon: <NotificationOutlined /> },
    { type: "divider" },
    { key: "/admin/audit", label: "Security Audit Logs", icon: <HistoryOutlined /> },
    { key: "/admin/system-health", label: "System Health", icon: <HeartOutlined /> },
    { key: "/admin/security", label: "Roles & Security", icon: <SafetyCertificateOutlined /> },
    { key: "/admin/settings", label: "System Settings", icon: <SettingOutlined /> },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0e1017", borderRight: "1px solid #1e2230" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingTop: 6 }}>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[currentKey, location.pathname]}
          onClick={({ key }) => {
            if (key.startsWith("/")) navigate(key);
          }}
          items={menuItems}
          style={{ background: "transparent", borderInlineEnd: 0 }}
        />
      </div>
      <div style={{ padding: 14, borderTop: "1px solid #1e2230" }}>
        <Space align="center" style={{ width: "100%", marginBottom: 8 }}>
          <Avatar size="small" style={{ backgroundColor: "#e50914" }}>
            {(user?.fullName || user?.name || user?.email || "A").charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ overflow: "hidden" }}>
            <Typography.Text ellipsis style={{ color: "#fff", fontSize: 12, display: "block" }}>
              {user?.fullName || user?.name || "Admin"}
            </Typography.Text>
            <Typography.Text ellipsis style={{ color: "#8e8ea0", fontSize: 10, display: "block" }}>
              {user?.email || ""}
            </Typography.Text>
          </div>
        </Space>
        <Button onClick={handleLogout} type="text" danger block size="small" icon={<LogoutOutlined />}>
          Sign out
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
