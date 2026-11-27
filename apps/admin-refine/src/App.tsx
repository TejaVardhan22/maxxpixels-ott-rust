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
import MovieFormPage from "./pages/movies/MovieFormPage";
import { SeriesPage } from "./pages/series";
import { LiveTVPage } from "./pages/live";
import { CategoriesPage } from "./pages/catalog/CategoriesPage";
import { BannersCmsPage } from "./pages/cms/BannersCmsPage";
import HomeCmsPage from "./pages/cms/HomeCmsPage";
import IntroVideoPage from "./pages/cms/IntroVideoPage";
import LegalPagesPage from "./pages/cms/LegalPagesPage";
import { UsersPage } from "./pages/users";
import { PlansPage } from "./pages/commerce/PlansPage";
import { PaymentsPage } from "./pages/commerce/PaymentsPage";
import { CouponsPage } from "./pages/commerce/CouponsPage";
import { AdsProducersPage } from "./pages/monetization/AdsProducersPage";
import MarketingAgentsPage from "./pages/monetization/MarketingAgentsPage";
import ProducerOnboardingPage from "./pages/monetization/ProducerOnboardingPage";
import ProducerReviewsPage from "./pages/monetization/ProducerReviewsPage";
import NotificationsPage from "./pages/ops/NotificationsPage";
import SystemHealthPage from "./pages/ops/SystemHealthPage";
import SettingsSecurityPage from "./pages/ops/SettingsSecurityPage";
import SystemSettingsPage from "./pages/ops/SystemSettingsPage";
import RolesSecurityPage from "./pages/ops/RolesSecurityPage";
import PlatformAdminPage from "./pages/ops/PlatformAdminPage";

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
        width={260}
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
            onClick={() => navigate("/admin/dashboard")}
          >
            <Avatar
              shape="square"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "linear-gradient(135deg, #e50914 0%, #c725a3 100%)",
                fontWeight: 800,
              }}
            >
              M
            </Avatar>
            <div>
              <Title level={5} style={{ margin: 0, color: "#ffffff", fontWeight: 800, fontSize: 15, lineHeight: 1.15 }}>
                MaxxPixels
              </Title>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#e50914", letterSpacing: 0.6 }}>
                CONSOLE ADMIN
              </span>
            </div>
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
                { label: "System Settings", key: "settings", icon: <SettingOutlined /> },
                { type: "divider" },
                { label: "Sign out", key: "logout", icon: <LogoutOutlined /> },
              ],
              onClick: menuClickHandler,
            }}
          >
            <Avatar style={{ width: 32, height: 32, backgroundColor: "#e50914", cursor: "pointer" }}>
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
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="admin" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="admin/dashboard" element={<DashboardPage />} />
                  <Route path="admin/platform-admin" element={<PlatformAdminPage />} />
                  <Route path="admin/analytics" element={<AnalyticsPage />} />

                  {/* Catalog & Master Data */}
                  <Route path="admin/movies" element={<MoviesPage />} />
                  <Route path="admin/movies/new" element={<MovieFormPage />} />
                  <Route path="admin/movies/:id/edit" element={<MovieFormPage />} />
                  <Route path="admin/movies/edit/:id" element={<MovieFormPage />} />
                  <Route path="admin/series" element={<SeriesPage />} />
                  <Route path="admin/series/new" element={<SeriesPage />} />
                  <Route path="admin/series/:id/edit" element={<SeriesPage />} />
                  <Route path="admin/live" element={<LiveTVPage />} />
                  <Route path="admin/basic-details" element={<CategoriesPage />} />
                  <Route path="admin/master-data" element={<CategoriesPage />} />
                  <Route path="admin/categories" element={<CategoriesPage />} />

                  {/* Home CMS, Banners, Intro Video & Legal */}
                  <Route path="admin/cms" element={<HomeCmsPage />} />
                  <Route path="admin/banners" element={<BannersCmsPage defaultTab="home" />} />
                  <Route path="admin/portal-banners" element={<BannersCmsPage defaultTab="portal" />} />
                  <Route path="admin/intro-video" element={<IntroVideoPage />} />
                  <Route path="admin/legal-pages" element={<LegalPagesPage />} />

                  {/* Producers */}
                  <Route path="admin/producers" element={<AdsProducersPage defaultTab="producers" />} />
                  <Route path="admin/producers/onboard" element={<ProducerOnboardingPage />} />
                  <Route path="admin/producers/onboarding" element={<ProducerOnboardingPage />} />
                  <Route path="admin/producer-reviews" element={<ProducerReviewsPage />} />

                  {/* Users & Commerce */}
                  <Route path="admin/users" element={<UsersPage />} />
                  <Route path="admin/devices" element={<UsersPage />} />
                  <Route path="admin/plans" element={<PlansPage />} />
                  <Route path="admin/subscriptions" element={<PlansPage />} />
                  <Route path="admin/payments" element={<PaymentsPage />} />
                  <Route path="admin/coupons" element={<CouponsPage />} />
                  <Route path="admin/marketing-agents" element={<MarketingAgentsPage />} />
                  <Route path="admin/ads" element={<AdsProducersPage defaultTab="ads" />} />
                  <Route path="admin/ads/ssai" element={<AdsProducersPage defaultTab="ads" />} />

                  {/* Operations & Security */}
                  <Route path="admin/drm" element={<SettingsSecurityPage defaultTab="drm" />} />
                  <Route path="admin/notifications" element={<NotificationsPage />} />
                  <Route path="admin/system-health" element={<SystemHealthPage />} />
                  <Route path="admin/security" element={<RolesSecurityPage />} />
                  <Route path="admin/audit" element={<SettingsSecurityPage defaultTab="audit" />} />
                  <Route path="admin/settings" element={<SystemSettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
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
