import React from "react";
import { Menu, Button, Typography, Avatar, Space } from "antd";
import { useLocation, useNavigate } from "react-router";
import {
  DashboardOutlined,
  BarChartOutlined,
  VideoCameraOutlined,
  PlaySquareOutlined,
  WifiOutlined,
  AppstoreOutlined,
  PictureOutlined,
  TeamOutlined,
  CreditCardOutlined,
  BankOutlined,
  TagOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  HeartOutlined,
  ShopOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { TOKEN_KEY, USER_KEY } from "../providers/api";

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "{}");
  } catch {
    return {};
  }
};

const menuGroups = [
  {
    type: "group" as const,
    label: "Overview",
    children: [
      { key: "/dashboard", label: "Dashboard", icon: <DashboardOutlined /> },
      { key: "/analytics", label: "Analytics & BI", icon: <BarChartOutlined /> },
    ],
  },
  {
    type: "group" as const,
    label: "Catalog & CMS",
    children: [
      { key: "/admin/movies", label: "Movies", icon: <VideoCameraOutlined /> },
      { key: "/admin/series", label: "Series", icon: <PlaySquareOutlined /> },
      { key: "/admin/live", label: "Live TV", icon: <WifiOutlined /> },
      { key: "/admin/categories", label: "Taxonomy", icon: <AppstoreOutlined /> },
      { key: "/admin/banners", label: "Banners & CMS", icon: <PictureOutlined /> },
    ],
  },
  {
    type: "group" as const,
    label: "Users & Commerce",
    children: [
      { key: "/admin/users", label: "Users & Devices", icon: <TeamOutlined /> },
      { key: "/admin/plans", label: "Plans", icon: <CreditCardOutlined /> },
      { key: "/admin/payments", label: "Payments & TVOD", icon: <BankOutlined /> },
      { key: "/admin/coupons", label: "Coupons", icon: <TagOutlined /> },
      { key: "/admin/ads", label: "Ads & Producers", icon: <ShopOutlined /> },
    ],
  },
  {
    type: "group" as const,
    label: "Operations",
    children: [
      { key: "/admin/notifications", label: "Notifications", icon: <NotificationOutlined /> },
      { key: "/admin/system-health", label: "Health, Logs & Outbox", icon: <HeartOutlined /> },
      { key: "/admin/security", label: "Security & Audit", icon: <SafetyCertificateOutlined /> },
      { key: "/admin/settings", label: "Settings", icon: <SettingOutlined /> },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    navigate("/login");
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0e1017", borderRight: "1px solid #1e2230" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={menuGroups}
          style={{ background: "transparent", borderInlineEnd: 0 }}
        />
      </div>
      <div style={{ padding: 16, borderTop: "1px solid #1e2230" }}>
        <Space align="center" style={{ width: "100%", marginBottom: 10 }}>
          <Avatar size="small" style={{ backgroundColor: "#1a4cd8" }}>
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
