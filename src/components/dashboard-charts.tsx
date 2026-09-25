"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ProjectsBarChart({ data }: { data: { name: string; value: number; color?: string }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis dataKey="name" type="category" width={118} tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
          <Bar dataKey="value" name="Etapas" fill="#06b6d4" radius={[0, 6, 6, 0]} barSize={20} label={{ position: "right", fill: "#475569", fontSize: 11, fontWeight: 600 }}>
            {data.map((d, i) => <Cell key={i} fill={d.color ?? "#06b6d4"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const COLORS = ["#0f5f9d", "#06b6d4", "#60a5fa", "#94a3b8", "#f59e0b"];

export function ContractsDonut({ data }: { data: { name: string; value: number; color?: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[190px_1fr]">
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={55} outerRadius={78} paddingAngle={2} stroke="none">
              {data.map((d, index) => <Cell key={index} fill={d.color ?? COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-2xl font-bold text-slate-950">{total}</p><p className="text-[10px] text-slate-400">contratos</p></div></div>
      </div>
      <div className="space-y-2.5">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color ?? COLORS[index % COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-slate-600">{item.name}</span>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

