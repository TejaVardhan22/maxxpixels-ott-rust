import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Table, Button, Space, Tag, Input, Popconfirm, message, Typography, Image, Card, Select,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
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
            width: 140,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/admin/movies/${r.id}/edit`)} />
                <Popconfirm title="Delete content?" onConfirm={() => handleDelete(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
};
