import React, { useEffect, useState } from "react";
import { Button, Input, Space, Modal, Segmented, List, Tag, message, Spin, Image } from "antd";
import { UploadOutlined, CloudOutlined, LinkOutlined, SearchOutlined } from "@ant-design/icons";
import { apiUpload, getToken } from "../providers/api";

interface MediaUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  type?: "image" | "video";
  folder?: string;
  placeholder?: string;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({
  value,
  onChange,
  type = "image",
  folder = "posters",
  placeholder = "Paste URL or upload / import from Google Drive",
}) => {
  const [uploading, setUploading] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [scope, setScope] = useState<string>("shared");
  const [searchQ, setSearchQ] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);

  const loadDriveFiles = async (nextScope = scope, nextQ = searchQ) => {
    setDriveLoading(true);
    try {
      const res = await fetch(
        `/api/gdrive/files?scope=${encodeURIComponent(nextScope)}&type=${type}&q=${encodeURIComponent(nextQ)}`
      );
      const data = await res.json();
      setDriveConnected(Boolean(data?.connected !== false && !data?.error));
      setDriveFiles(Array.isArray(data?.files) ? data.files : []);
    } catch {
      setDriveConnected(false);
    } finally {
      setDriveLoading(false);
    }
  };

  useEffect(() => {
    if (driveOpen) loadDriveFiles(scope, searchQ);
  }, [driveOpen, scope]);

  const handleConnectDrive = async () => {
    try {
      const res = await fetch("/api/gdrive/auth-url");
      const data = await res.json();
      if (data?.authUrl) {
        window.open(data.authUrl, "_blank", "width=600,height=700");
        message.info("Complete Google sign-in in the popup, then click Refresh.");
      } else {
        message.error(data?.error || "Google Drive OAuth not configured");
      }
    } catch (e: any) {
      message.error(e?.message || "Failed to start Google Drive OAuth");
    }
  };

  const handleDirectUpload = async (file: File) => {
    setUploading(true);
    try {
      const endpoint = type === "video" ? "/storage/upload-video" : `/storage/upload?folder=${folder}`;
      const data = await apiUpload(endpoint, file);
      const url = data?.url || data?.hlsUrl || data?.streamUrl || data?.path || "";
      if (url) {
        onChange?.(url);
        message.success("Uploaded successfully");
      } else {
        message.warning("Upload succeeded but no URL returned");
      }
    } catch (e: any) {
      message.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleImportDrive = async (file: any) => {
    setImportingId(file.id);
    try {
      if (type === "image") {
        const res = await fetch("/api/gdrive/import-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ fileId: file.id, fileName: file.name, folder }),
        });
        const data = await res.json();
        const url = data?.url || data?.data?.url;
        if (url) {
          onChange?.(url);
          message.success(`Imported ${file.name}`);
          setDriveOpen(false);
        } else {
          message.error(data?.error || "Image import failed");
        }
      } else {
        const res = await fetch("/api/stream-gdrive", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ fileId: file.id, title: file.name }),
        });
        const data = await res.json();
        const url = data?.hlsUrl || data?.streamUrl || data?.guid;
        if (url) {
          onChange?.(url);
          message.success(`Streaming ${file.name} to Bunny Stream`);
          setDriveOpen(false);
        } else if (data?.jobId) {
          message.success(`Started Drive -> Bunny Stream job (${data.jobId})`);
          setDriveOpen(false);
        } else {
          message.error(data?.error || "Video import failed");
        }
      }
    } catch (e: any) {
      message.error(e?.message || "Drive import failed");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="small">
      <Space.Compact style={{ width: "100%" }}>
        <Input
          prefix={<LinkOutlined />}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
        />
        <Button loading={uploading} icon={<UploadOutlined />} onClick={() => {
          const inp = document.createElement("input");
          inp.type = "file";
          inp.accept = type === "video" ? "video/*" : "image/*";
          inp.onchange = () => {
            if (inp.files?.[0]) handleDirectUpload(inp.files[0]);
          };
          inp.click();
        }}>
          Upload
        </Button>
        <Button icon={<CloudOutlined />} onClick={() => setDriveOpen(true)}>
          Drive
        </Button>
      </Space.Compact>

      {type === "image" && value && (
        <Image src={value} height={80} style={{ borderRadius: 6, objectFit: "cover" }} fallback="" />
      )}

      <Modal
        title={`Import ${type === "video" ? "Video" : "Image"} from Google Drive`}
        open={driveOpen}
        onCancel={() => setDriveOpen(false)}
        footer={null}
        width={680}
      >
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }} wrap>
          <Segmented
            value={scope}
            onChange={(v) => setScope(String(v))}
            options={[
              { label: "Shared with me", value: "shared" },
              { label: "My Drive", value: "my" },
              { label: "All", value: "all" },
            ]}
          />
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search Drive..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onPressEnter={() => loadDriveFiles(scope, searchQ)}
              style={{ width: 180 }}
            />
            <Button onClick={() => loadDriveFiles(scope, searchQ)}>Refresh</Button>
            {!driveConnected && (
              <Button type="primary" onClick={handleConnectDrive}>
                Connect Google Drive
              </Button>
            )}
          </Space>
        </Space>

        {driveLoading ? (
          <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>
        ) : !driveConnected ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <p>Google Drive is not connected yet.</p>
            <Button type="primary" icon={<CloudOutlined />} onClick={handleConnectDrive}>
              Connect Google Drive
            </Button>
          </div>
        ) : (
          <List
            dataSource={driveFiles}
            locale={{ emptyText: "No matching files found in Drive" }}
            renderItem={(item: any) => (
              <List.Item
                actions={[
                  <Button
                    key="imp"
                    type="primary"
                    size="small"
                    loading={importingId === item.id}
                    onClick={() => handleImportDrive(item)}
                  >
                    Import
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={item.name}
                  description={
                    <Space size="small">
                      <Tag>{item.mimeType}</Tag>
                      {item.size && <span>{(Number(item.size) / (1024 * 1024)).toFixed(1)} MB</span>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </Space>
  );
};
