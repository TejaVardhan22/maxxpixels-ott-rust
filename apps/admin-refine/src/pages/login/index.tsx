import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, Input, Typography, Checkbox, message } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { apiPost, TOKEN_KEY, USER_KEY } from "../../providers/api";

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      message.warning("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost<any>("/auth/login", { email, password });
      const token = data?.accessToken || data?.token;
      if (!token) {
        throw new Error("Invalid login response from server");
      }
      localStorage.setItem(TOKEN_KEY, token);
      if (data?.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      } else {
        localStorage.setItem(USER_KEY, JSON.stringify({ email, name: email.split("@")[0] }));
      }
      message.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      message.error(err?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#0a0b0e",
      }}
    >
      <Card
        style={{
          width: 400,
          backgroundColor: "#12151c",
          border: "1px solid #1e2230",
          borderRadius: 12,
        }}
        styles={{ body: { padding: 36 } }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: "linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <UserOutlined style={{ fontSize: 24, color: "#ffffff" }} />
          </div>
          <Title level={3} style={{ color: "#ffffff", marginBottom: 6 }}>
            MaxxPixels Admin
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Sign in with your administrator credentials
          </Text>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder="admin@maxxpixels.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="large"
              prefix={<MailOutlined />}
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Input.Password
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              size="large"
              prefix={<LockOutlined />}
              autoComplete="current-password"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
              Remember me
            </Checkbox>
          </div>

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
            style={{
              height: 44,
              fontWeight: 700,
              background: "linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%)",
              border: "none",
            }}
          >
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
