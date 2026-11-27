import React from "react";
import { Refine } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import "@refinedev/antd/dist/reset.css";

import { App as AntdApp, Layout, Dropdown, Avatar, Typography } from "antd";
import { BrowserRouter, Route, Routes, Outlet, Navigate, useNavigate } from "react-router";
import routerProvider, { UnsavedChangesNotifier, DocumentTitleHandler } from "@refinedev/react-router";
import { LogoutOutlined, SettingOutlined } from "@ant-design/icons";

import { ColorModeContextProvider } from "./contexts/color-mode";
import { dataProvider } from "./providers/data";
import { authProvider } from "./providers/auth";
import { getToken, TOKEN_KEY, USER_KEY } from "./providers/api";
import Sidebar from "./components/sidebar";

import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";
import AnalyticsPage from "./pages/analytics";
import { MoviesPage } from "./pages/movies";
import { SeriesPage } from "./pages/series";
import { LiveTVPage } from "./pages/live";
import { CategoriesPage } from "./pages/catalog/CategoriesPage";
import { BannersCmsPage } from "./pages/cms/BannersCmsPage";
import { UsersPage } from "./pages/users";
import { PlansPage } from "./pages/commerce/PlansPage";
import { PaymentsPage } from "./pages/commerce/PaymentsPage";
import { CouponsPage } from "./pages/commerce/CouponsPage";
import { AdsProducersPage } from "./pages/monetization/AdsProducersPage";
import NotificationsPage from "./pages/ops/NotificationsPage";
import SystemHealthPage from "./pages/ops/SystemHealthPage";
import SettingsSecurityPage from "./pages/ops/SettingsSecurityPage";

const { Sider, Header, Content } = Layout;
const { Title } = Typography;

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "{}");
  } catch {
    return {};
  }
};

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const token = getToken();
  const user = getUser();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    navigate("/login", { replace: true });
  };

  const menuClickHandler = ({ key }: { key: React.Key }) => {
    if (key === "logout") handleLogout();
    if (key === "settings") navigate("/admin/settings");
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "#0a0b0e" }}>
      <Sider
        width={240}
        style={{
          background: "#0e1017",
          borderRight: "1px solid #1e2230",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderBottom: "1px solid #1e2230",
              cursor: "pointer",
            }}
            onClick={() => navigate("/dashboard")}
          >
            <Avatar
              shape="square"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%)",
                fontWeight: 800,
              }}
            >
              M
            </Avatar>
            <Title level={5} style={{ margin: 0, color: "#ffffff", fontWeight: 800, fontSize: 16 }}>
              MaxxPixels Admin
            </Title>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Sidebar />
          </div>
        </div>
      </Sider>
      <Layout style={{ background: "#0a0b0e" }}>
        <Header
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            height: 56,
            padding: "0 24px",
            background: "#12151c",
            borderBottom: "1px solid #1e2230",
          }}
        >
          <Dropdown
            menu={{
              items: [
                { label: "Settings", key: "settings", icon: <SettingOutlined /> },
                { type: "divider" },
                { label: "Sign out", key: "logout", icon: <LogoutOutlined /> },
              ],
              onClick: menuClickHandler,
            }}
          >
            <Avatar style={{ width: 32, height: 32, backgroundColor: "#1a4cd8", cursor: "pointer" }}>
              {(user?.fullName || user?.name || user?.email || "A").charAt(0).toUpperCase()}
            </Avatar>
          </Dropdown>
        </Header>
        <Content style={{ padding: 24, overflow: "auto" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <AntdApp>
            <Refine
              dataProvider={dataProvider}
              authProvider={authProvider}
              routerProvider={routerProvider}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
              }}
            >
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<MainLayout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="admin/analytics" element={<AnalyticsPage />} />

                  {/* Catalog & CMS */}
                  <Route path="admin/movies" element={<MoviesPage />} />
                  <Route path="admin/series" element={<SeriesPage />} />
                  <Route path="admin/live" element={<LiveTVPage />} />
                  <Route path="admin/categories" element={<CategoriesPage />} />
                  <Route path="admin/banners" element={<BannersCmsPage />} />

                  {/* Users & Commerce */}
                  <Route path="admin/users" element={<UsersPage />} />
                  <Route path="admin/devices" element={<UsersPage />} />
                  <Route path="admin/plans" element={<PlansPage />} />
                  <Route path="admin/subscriptions" element={<PlansPage />} />
                  <Route path="admin/payments" element={<PaymentsPage />} />
                  <Route path="admin/coupons" element={<CouponsPage />} />
                  <Route path="admin/ads" element={<AdsProducersPage />} />
                  <Route path="admin/producers" element={<AdsProducersPage />} />

                  {/* Operations */}
                  <Route path="admin/notifications" element={<NotificationsPage />} />
                  <Route path="admin/system-health" element={<SystemHealthPage />} />
                  <Route path="admin/security" element={<SettingsSecurityPage defaultTab="roles" />} />
                  <Route path="admin/audit" element={<SettingsSecurityPage defaultTab="audit" />} />
                  <Route path="admin/settings" element={<SettingsSecurityPage defaultTab="settings" />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              <RefineKbar />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
          </AntdApp>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
