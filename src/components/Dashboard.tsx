'use client';

import React, { useState, useEffect } from 'react';
import Button from 'antd/es/button';               // [V1] internal import path
import { Card, Table, Space, Tag, Modal, Form, Input, Select, ConfigProvider } from 'antd';
import type { ColumnsType } from 'antd/es/table';   // [V2] internal import path (type)
import styles from './Dashboard.module.css';

// ─── Types ────────────────────────────────────────────

interface MetricCard {
  title: string;
  value: number;
  change: number;
  icon: string;
}

interface ProjectRow {
  key: string;
  name: string;
  owner: string;
  status: 'active' | 'paused' | 'completed' | 'at_risk';
  progress: number;
  updated: string;
}

// ─── Data ─────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: '#52c41a',      // [V3] hardcoded token: colorSuccess
  paused: '#faad14',      // [V4] hardcoded token: colorWarning
  completed: '#1677ff',   // [V5] hardcoded token: colorPrimary
  at_risk: '#ff4d4f',     // [V6] hardcoded token: colorError
};

// ─── Subcomponents ────────────────────────────────────

function StatCard({ metric }: { metric: MetricCard }) {
  // [V7] inline style on Card — forbidden pattern 5a
  // [V8] wrapper div — composition pattern 6a violation
  return (
    <div className={styles.cardWrapper}>
      <Card
        style={{
          borderRadius: '12px',         // [V9] hardcoded token: borderRadius
          padding: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        {/* [V10] manual structure instead of Card.Meta — composition pattern 6b */}
        <div className={styles.metricHeader}>
          <img src={`/icons/${metric.icon}.svg`} alt="" width={24} height={24} />
          {/* [V11] raw <img> instead of Image */}
          <h3>{metric.title}</h3>
          {/* [V12] raw <h3> instead of Typography.Title level={4} */}
        </div>
        <p style={{ fontSize: '28px', fontWeight: 600, margin: 0 }}>
          {/* [V13] raw <p> instead of Typography.Text/Title, hardcoded fontSize */}
          {metric.value.toLocaleString()}
        </p>
        <p
          style={{
            color: metric.change >= 0 ? '#52c41a' : '#ff4d4f',  // [V14] hardcoded tokens
            fontSize: '14px',                                     // [V15] hardcoded fontSize
          }}
        >
          {metric.change >= 0 ? '↑' : '↓'} {Math.abs(metric.change)}%
        </p>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  // Correct: uses Tag component from antd ✓
  return (
    <Tag color={STATUS_COLORS[status]}>
      {status.replace('_', ' ').toUpperCase()}
    </Tag>
  );
}

// ─── Main component ───────────────────────────────────

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  useEffect(() => {
    // Simulated fetch — would be SWR/React Query in production
    setMetrics([
      { title: 'Active Projects', value: 142, change: 12, icon: 'folder' },
      { title: 'Team Members', value: 38, change: 3, icon: 'users' },
      { title: 'Tasks Completed', value: 1847, change: -2, icon: 'check' },
      { title: 'Avg Velocity', value: 94, change: 7, icon: 'speed' },
    ]);
    setProjects([
      { key: '1', name: 'Platform Redesign', owner: 'Sarah Chen', status: 'active', progress: 72, updated: '2026-03-28' },
      { key: '2', name: 'API v3 Migration', owner: 'Marcus Webb', status: 'at_risk', progress: 45, updated: '2026-03-30' },
      { key: '3', name: 'Mobile App Launch', owner: 'Priya Patel', status: 'paused', progress: 88, updated: '2026-03-25' },
      { key: '4', name: 'Data Pipeline Refactor', owner: 'Jake Torres', status: 'completed', progress: 100, updated: '2026-03-20' },
    ]);
  }, []);

  // Correct: proper Table columns definition with antd types ✓
  const columns: ColumnsType<ProjectRow> = [
    {
      title: 'Project',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Owner',
      dataIndex: 'owner',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: string) => <StatusBadge status={status} />,
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Paused', value: 'paused' },
        { text: 'Completed', value: 'completed' },
        { text: 'At Risk', value: 'at_risk' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      sorter: (a, b) => a.progress - b.progress,
      render: (progress: number) => (
        // [V16] raw div for progress bar instead of antd Progress component
        <div style={{ width: '100%', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          <div
            style={{
              width: `${progress}%`,
              height: '8px',
              backgroundColor: progress === 100 ? '#52c41a' : '#1677ff',  // [V17] hardcoded tokens
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      ),
    },
    {
      title: 'Updated',
      dataIndex: 'updated',
      sorter: (a, b) => new Date(a.updated).getTime() - new Date(b.updated).getTime(),
    },
    {
      title: '',
      key: 'actions',
      render: (_, record) => (
        // Correct: uses Space for button group ✓
        <Space>
          <Button type="link" size="small">View</Button>
          {/* [V18] raw <button> instead of antd Button */}
          <button
            className={styles.dangerBtn}
            onClick={() => console.log('archive', record.key)}
          >
            Archive
          </button>
        </Space>
      ),
    },
  ];

  const filteredProjects = statusFilter.length
    ? projects.filter((p) => statusFilter.includes(p.status))
    : projects;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      {/* [V19] raw div with display:flex instead of Flex or Layout — layout §3 */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* ── Header ────────────────────────────── */}
        {/* [V20] raw <div> for header instead of Layout.Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f0f0f0' }}>
          {/* [V21] raw <div> with display:flex instead of Flex justify="space-between" */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '24px' }}>
              {/* [V22] raw <h2> instead of Typography.Title level={2} */}
              Project Dashboard
            </h2>
            <Space>
              <Button onClick={() => setFilterOpen(true)}>Filters</Button>
              <Button type="primary">New Project</Button>
            </Space>
          </div>
        </div>

        {/* ── Content ───────────────────────────── */}
        {/* [V23] raw <div> with padding instead of Layout.Content */}
        <div style={{ padding: '24px 32px', flex: 1 }}>
          {/* ── Metric cards row ──────────────── */}
          {/* [V24] display:grid instead of Row + Col */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',                               // [V25] hardcoded gap instead of Space
              marginBottom: '24px',                       // [V26] hardcoded margin instead of Space vertical
            }}
          >
            {metrics.map((m) => (
              <StatCard key={m.title} metric={m} />
            ))}
          </div>

          {/* ── Section label ─────────────────── */}
          {/* [V27] raw <h3> instead of Typography.Title level={3} */}
          <h3 style={{ marginBottom: '16px' }}>All Projects</h3>

          {/* Correct: proper antd Table with columns, sorting, filtering ✓ */}
          <Table
            className={styles.projectTable}   // [V28] className on antd v6 component — forbidden 5b
            columns={columns}
            dataSource={filteredProjects}
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        </div>
      </div>

      {/* ── Filter modal ──────────────────────── */}
      <Modal
        title="Filter Projects"
        open={filterOpen}
        onCancel={() => setFilterOpen(false)}
        className={styles.filterModal}           // [V29] className on Modal — forbidden 5b
        onOk={() => setFilterOpen(false)}
      >
        {/* Correct: proper Form.Item usage ✓ */}
        <Form layout="vertical">
          <Form.Item label="Status">
            <Select
              mode="multiple"
              placeholder="Select statuses"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Paused', value: 'paused' },
                { label: 'Completed', value: 'completed' },
                { label: 'At Risk', value: 'at_risk' },
              ]}
            />
          </Form.Item>
          {/* [V30] manual form row instead of Form.Item — composition 6c */}
          <div className={styles.formRow}>
            <label>Date Range</label>
            <input type="date" className={styles.dateInput} />
            <span style={{ margin: '0 8px' }}>to</span>
            <input type="date" className={styles.dateInput} />
          </div>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}
