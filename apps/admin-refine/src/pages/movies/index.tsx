import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Table, Button, Space, Tag, Input, Popconfirm, message, Typography, Image, Card, Select, Drawer, Descriptions, Spin, Divider,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, EyeOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { apiGet, apiDelete, extractArray } from "../../providers/api";

function formatTypeLabel(slug: string): string {
  if (!slug || slug === "ALL") return "All Catalog";
  return slug
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const MoviesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = (searchParams.get("type") || "ALL").toUpperCase();
  const [rows, setRows] = useState<any[]>([]);
  const [contentTypes, setContentTypes] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);

  const openView = async (rec: any) => {
    setViewOpen(true);
    setViewItem(rec);
    setViewLoading(true);
    try {
      const detail = await apiGet<any>(`/admin/movies/${rec.id}`);
      setViewItem({ ...rec, ...(detail || {}) });
    } catch (e: any) {
      message.error(e?.message || "Failed to load full content details");
    } finally {
      setViewLoading(false);
    }
  };

  useEffect(() => {
    apiGet("/admin/content-types")
      .then((res) => {
        const list = extractArray(res);
        setContentTypes(
          list
            .map((c: any) => {
              const label = c.title || c.name || c.slug || "";
              const value = String(c.slug || c.code || c.title || c.name || "")
                .trim()
                .toUpperCase()
                .replace(/[\s-]+/g, "_");
              return { value, label };
            })
            .filter((c: any) => c.value && c.label)
        );
      })
      .catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ size: "200" });
      if (search) qs.set("q", search);
      if (typeFilter && typeFilter !== "ALL") qs.set("contentType", typeFilter);
      const data = await apiGet(`/admin/movies?${qs.toString()}`);
      const list = extractArray(data);
      const filtered =
        typeFilter && typeFilter !== "ALL"
          ? list.filter((item: any) => String(item.contentType || item.type || "").toUpperCase() === typeFilter)
          : list;
      setRows(filtered);
    } catch (e: any) {
      message.error(e?.message || "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [typeFilter]);

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/admin/movies/${id}`);
      message.success("Content deleted");
      load();
    } catch (e: any) {
      message.error(e?.message || "Delete failed");
    }
  };

  const pageTitle =
    typeFilter === "ALL"
      ? "All Catalog"
      : contentTypes.find((t) => t.value === typeFilter)?.label || formatTypeLabel(typeFilter);

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>{pageTitle}</Typography.Title>}
      extra={
        <Space wrap>
          <Select
            style={{ width: 170 }}
            value={typeFilter}
            onChange={(val) => setSearchParams(val === "ALL" ? {} : { type: val })}
            options={[{ value: "ALL", label: "All Types" }, ...contentTypes]}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search catalog..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={load}
            style={{ width: 220 }}
          />
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" danger icon={<PlusOutlined />} onClick={() => navigate("/admin/movies/new")}>
            Add Content
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 15 }}
        columns={[
          {
            title: "Poster",
            dataIndex: "posterUrl",
            width: 72,
            render: (v) => v ? <Image src={v} width={48} height={64} style={{ objectFit: "cover", borderRadius: 4 }} /> : "-",
          },
          {
            title: "Title",
            dataIndex: "title",
            render: (v, r) => (
              <div>
                <strong>{v}</strong>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {r.contentType || "MOVIE"} • {r.originalLanguage || r.language || "N/A"}{r.releaseYear ? ` • ${r.releaseYear}` : ""}
                </div>
              </div>
            ),
          },
          { title: "Access", dataIndex: "monetization", render: (v, r) => <Tag color={v === "TVOD" ? "gold" : v === "SVOD" ? "purple" : "green"}>{v || r.accessType || "SVOD"}</Tag> },
          { title: "Views", dataIndex: "viewCount", render: (v) => v ?? 0 },
          { title: "Status", dataIndex: "status", render: (v) => <Tag color={v === "PUBLISHED" ? "blue" : v === "SCHEDULED" ? "cyan" : "default"}>{v || "DRAFT"}</Tag> },
          {
            title: "Actions",
            width: 170,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EyeOutlined />} title="View Details" onClick={() => openView(r)} />
                <Button size="small" icon={<EditOutlined />} title="Edit" onClick={() => navigate(`/admin/movies/${r.id}/edit`)} />
                <Popconfirm title="Delete content?" onConfirm={() => handleDelete(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} title="Delete" />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={viewItem?.title || "Content Details"}
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        width={640}
        extra={
          viewItem?.id ? (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setViewOpen(false);
                navigate(`/admin/movies/${viewItem.id}/edit`);
              }}
            >
              Edit Content
            </Button>
          ) : null
        }
      >
        <Spin spinning={viewLoading}>
          {viewItem && (
            <div>
              <Space align="start" size={16} style={{ marginBottom: 16 }}>
                {viewItem.posterUrl && (
                  <Image
                    src={viewItem.posterUrl}
                    width={110}
                    height={155}
                    style={{ objectFit: "cover", borderRadius: 8 }}
                  />
                )}
                { (viewItem.bannerUrl || viewItem.backdropUrl || viewItem.landscapeUrl) && (
                  <Image
                    src={viewItem.bannerUrl || viewItem.backdropUrl || viewItem.landscapeUrl}
                    width={260}
                    height={155}
                    style={{ objectFit: "cover", borderRadius: 8 }}
                  />
                )}
              </Space>

              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="ID">{viewItem.id}</Descriptions.Item>
                <Descriptions.Item label="Main Type">
                  <Tag color="geekblue">{viewItem.contentType || "-"}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={viewItem.status === "PUBLISHED" ? "blue" : viewItem.status === "SCHEDULED" ? "cyan" : "default"}>
                    {viewItem.status || "DRAFT"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Access / Monetization">
                  <Tag color={viewItem.monetization === "TVOD" ? "gold" : viewItem.monetization === "SVOD" ? "purple" : "green"}>
                    {viewItem.monetization || viewItem.accessType || "SVOD"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Language">
                  {viewItem.originalLanguage || viewItem.language || viewItem.originalLanguageCode || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Age Rating">{viewItem.ageRating || viewItem.maturityRating || "-"}</Descriptions.Item>
                <Descriptions.Item label="Duration">
                  {viewItem.durationSeconds
                    ? `${Math.floor(viewItem.durationSeconds / 60)}m ${viewItem.durationSeconds % 60}s`
                    : viewItem.durationMinutes
                    ? `${viewItem.durationMinutes}m`
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Views">{Number(viewItem.viewCount || 0).toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="Producer" span={2}>
                  {viewItem.producer || viewItem.productionHouse || "-"}
                </Descriptions.Item>
                {Number(viewItem.rentPrice || 0) > 0 && (
                  <Descriptions.Item label="Rent Price">
                    ₹{viewItem.rentPrice} {viewItem.validityHours ? `(${viewItem.validityHours}h)` : ""}
                  </Descriptions.Item>
                )}
                {viewItem.releaseDate && (
                  <Descriptions.Item label="Release Date">{String(viewItem.releaseDate).slice(0, 10)}</Descriptions.Item>
                )}
                <Descriptions.Item label="Slug" span={2}>
                  <Typography.Text code>{viewItem.slug || "-"}</Typography.Text>
                </Descriptions.Item>
              </Descriptions>

              {((Array.isArray(viewItem.categories) && viewItem.categories.length > 0) ||
                (Array.isArray(viewItem.genres) && viewItem.genres.length > 0)) && (
                <>
                  <Divider style={{ margin: "14px 0" }} />
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {Array.isArray(viewItem.categories) && viewItem.categories.length > 0 && (
                      <div>
                        <Typography.Text type="secondary" style={{ marginRight: 8 }}>Categories:</Typography.Text>
                        {viewItem.categories.map((c: string) => <Tag key={c} color="cyan">{c}</Tag>)}
                      </div>
                    )}
                    {Array.isArray(viewItem.genres) && viewItem.genres.length > 0 && (
                      <div>
                        <Typography.Text type="secondary" style={{ marginRight: 8 }}>Genres:</Typography.Text>
                        {viewItem.genres.map((g: string) => <Tag key={g} color="purple">{g}</Tag>)}
                      </div>
                    )}
                  </Space>
                </>
              )}

              {viewItem.description && (
                <>
                  <Divider style={{ margin: "14px 0" }} />
                  <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4 }}>Description</Typography.Text>
                  <Typography.Paragraph style={{ marginBottom: 0 }}>{viewItem.description}</Typography.Paragraph>
                </>
              )}

              {(viewItem.masterPlaylistUrl || viewItem.hlsUrl || viewItem.streamUrl || viewItem.videoUrl || viewItem.trailerUrl) && (
                <>
                  <Divider style={{ margin: "14px 0" }} />
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {(viewItem.masterPlaylistUrl || viewItem.hlsUrl || viewItem.streamUrl || viewItem.videoUrl) && (
                      <div>
                        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 2 }}>
                          <PlayCircleOutlined /> Master Stream / HLS URL
                        </Typography.Text>
                        <Typography.Text copyable code style={{ fontSize: 12 }}>
                          {viewItem.masterPlaylistUrl || viewItem.hlsUrl || viewItem.streamUrl || viewItem.videoUrl}
                        </Typography.Text>
                      </div>
                    )}
                    {viewItem.trailerUrl && (
                      <div>
                        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 2 }}>
                          Trailer URL
                        </Typography.Text>
                        <Typography.Text copyable code style={{ fontSize: 12 }}>
                          {viewItem.trailerUrl}
                        </Typography.Text>
                      </div>
                    )}
                  </Space>
                </>
              )}
            </div>
          )}
        </Spin>
      </Drawer>
    </Card>
  );
};
