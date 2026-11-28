import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Popconfirm,
  message,
  Typography,
  Image,
  Card,
  Select,
  Drawer,
  Descriptions,
  Spin,
  Divider,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  ClearOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { apiGet, apiDelete, extractArray } from "../../providers/api";

function formatTypeLabel(slug: string): string {
  if (!slug || slug === "ALL") return "All Catalog";
  return slug
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACCESS_OPTIONS = [
  { value: "ALL", label: "All Access" },
  { value: "SVOD", label: "SVOD (Subscription)" },
  { value: "TVOD", label: "TVOD (Rent / PPV)" },
  { value: "AVOD", label: "AVOD (Ad-Supported)" },
  { value: "FREE", label: "Free" },
  { value: "PREMIUM", label: "Premium" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "ARCHIVED", label: "Archived" },
];

export const MoviesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = (searchParams.get("type") || "ALL").toUpperCase();

  const [rows, setRows] = useState<any[]>([]);
  const [contentTypes, setContentTypes] = useState<{ value: string; label: string }[]>([]);
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState<string>("ALL");
  const [accessFilter, setAccessFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // View Drawer
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
    Promise.all([
      apiGet("/admin/content-types").catch(() => []),
      apiGet("/admin/languages").catch(() => []),
    ]).then(([typesRes, langsRes]) => {
      const typeList = extractArray(typesRes);
      setContentTypes(
        typeList
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

      const langList = extractArray(langsRes);
      setLanguages(
        langList
          .map((l: any) => ({
            code: String(l.code || l.slug || l.name || "").trim(),
            name: String(l.name || l.code || "").trim(),
          }))
          .filter((l: any) => l.code && l.name)
      );
    });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ size: "500" });
      if (statusFilter && statusFilter !== "ALL") qs.set("status", statusFilter);
      const data = await apiGet(`/admin/movies?${qs.toString()}`);
      setRows(extractArray(data));
    } catch (e: any) {
      message.error(e?.message || "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const langLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    languages.forEach((l) => {
      m.set(l.code.toLowerCase(), l.name);
      m.set(l.name.toLowerCase(), l.name);
    });
    return m;
  }, [languages]);

  const resolveLangLabel = (rec: any): string => {
    const raw = String(rec.originalLanguage || rec.language || rec.originalLanguageCode || "").trim();
    if (!raw) return "N/A";
    return langLabelMap.get(raw.toLowerCase()) || raw.toUpperCase();
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const selLang = languageFilter.toLowerCase();
    const selLangName = (langLabelMap.get(selLang) || "").toLowerCase();

    return rows.filter((item) => {
      if (typeFilter && typeFilter !== "ALL") {
        const itemType = String(item.contentType || item.type || "")
          .trim()
          .toUpperCase()
          .replace(/[\s-]+/g, "_");
        if (itemType !== typeFilter) return false;
      }
      if (languageFilter !== "ALL") {
        const rawLang = String(
          item.originalLanguageCode || item.language || item.originalLanguage || ""
        )
          .trim()
          .toLowerCase();
        const resolved = (langLabelMap.get(rawLang) || rawLang).toLowerCase();
        if (rawLang !== selLang && resolved !== selLang && (!selLangName || resolved !== selLangName)) {
          return false;
        }
      }
      if (accessFilter !== "ALL") {
        const acc = String(item.monetization || item.accessType || "SVOD")
          .trim()
          .toUpperCase();
        if (acc !== accessFilter) return false;
      }
      if (statusFilter !== "ALL") {
        const st = String(item.status || "DRAFT").trim().toUpperCase();
        if (st !== statusFilter) return false;
      }
      if (q) {
        const hay = `${item.title || ""} ${item.slug || ""} ${item.contentType || ""} ${resolveLangLabel(item)} ${item.monetization || item.accessType || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, languageFilter, accessFilter, statusFilter, search, langLabelMap]);

  const hasActiveFilters =
    typeFilter !== "ALL" ||
    languageFilter !== "ALL" ||
    accessFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    search.trim() !== "";

  const clearFilters = () => {
    setSearch("");
    setLanguageFilter("ALL");
    setAccessFilter("ALL");
    setStatusFilter("ALL");
    if (typeFilter !== "ALL") setSearchParams({});
  };

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
      title={
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {pageTitle}
          </Typography.Title>
          <Tag color="geekblue">
            {filteredRows.length}
            {filteredRows.length !== rows.length ? ` / ${rows.length}` : ""} items
          </Tag>
        </Space>
      }
      extra={
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={load}>
            Refresh
          </Button>
          <Button type="primary" danger icon={<PlusOutlined />} onClick={() => navigate("/admin/movies/new")}>
            Add Content
          </Button>
        </Space>
      }
    >
      {/* Multi-Filter Bar */}
      <Row gutter={[10, 10]} align="middle" style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search title, slug, language..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Select
            style={{ width: "100%" }}
            value={typeFilter}
            onChange={(val) => setSearchParams(val === "ALL" ? {} : { type: val })}
            options={[{ value: "ALL", label: "All Types" }, ...contentTypes]}
            suffixIcon={<FilterOutlined />}
          />
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Select
            style={{ width: "100%" }}
            value={languageFilter}
            onChange={setLanguageFilter}
            showSearch
            optionFilterProp="label"
            options={[
              { value: "ALL", label: "All Languages" },
              ...languages.map((l) => ({ value: l.code, label: l.name })),
            ]}
          />
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Select
            style={{ width: "100%" }}
            value={accessFilter}
            onChange={setAccessFilter}
            options={ACCESS_OPTIONS}
          />
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Select
            style={{ width: "100%" }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />
        </Col>
        <Col xs={24} md={2}>
          {hasActiveFilters && (
            <Button block icon={<ClearOutlined />} onClick={clearFilters}>
              Clear
            </Button>
          )}
        </Col>
      </Row>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredRows}
        pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "30", "50", "100"] }}
        columns={[
          {
            title: "Poster",
            dataIndex: "posterUrl",
            width: 72,
            render: (v) =>
              v ? <Image src={v} width={48} height={64} style={{ objectFit: "cover", borderRadius: 4 }} /> : "-",
          },
          {
            title: "Title",
            dataIndex: "title",
            render: (v, r) => (
              <div>
                <strong>{v}</strong>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {formatTypeLabel(String(r.contentType || "MOVIE"))}
                  {r.releaseYear ? ` • ${r.releaseYear}` : ""}
                </div>
              </div>
            ),
          },
          {
            title: "Language",
            width: 120,
            render: (_, r) => <Tag color="cyan">{resolveLangLabel(r)}</Tag>,
          },
          {
            title: "Access",
            dataIndex: "monetization",
            width: 110,
            render: (v, r) => {
              const acc = String(v || r.accessType || "SVOD").toUpperCase();
              const color = acc === "TVOD" ? "gold" : acc === "SVOD" || acc === "PREMIUM" ? "purple" : "green";
              return <Tag color={color}>{acc}</Tag>;
            },
          },
          {
            title: "Views",
            dataIndex: "viewCount",
            width: 90,
            sorter: (a, b) => Number(a.viewCount || 0) - Number(b.viewCount || 0),
            render: (v) => Number(v ?? 0).toLocaleString(),
          },
          {
            title: "Status",
            dataIndex: "status",
            width: 120,
            render: (v) => {
              const st = String(v || "DRAFT").toUpperCase();
              const color =
                st === "PUBLISHED" ? "blue" : st === "SCHEDULED" || st === "UPCOMING" ? "cyan" : "default";
              return <Tag color={color}>{st}</Tag>;
            },
          },
          {
            title: "Actions",
            width: 150,
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
                {(viewItem.bannerUrl || viewItem.backdropUrl || viewItem.landscapeUrl) && (
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
                <Descriptions.Item label="Language">{resolveLangLabel(viewItem)}</Descriptions.Item>
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
