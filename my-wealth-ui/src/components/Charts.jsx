import { formatCurrency } from '../data/mockData';
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export function NetWorthChart({ data }) {
  return (
    <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
      <h3 className="text-white font-semibold mb-4">Net Worth Trend</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#16384B" />
          <XAxis dataKey="date" stroke="#7A8FA3" style={{ fontSize: '12px' }} />
          <YAxis stroke="#7A8FA3" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0D2235',
              border: '1px solid #1C5265',
              borderRadius: '8px'
            }}
            formatter={(value) => formatCurrency(value)}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#22E6E0"
            strokeWidth={3}
            dot={{ fill: '#20E58A', r: 5 }}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AllocationChart({ data }) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    name: value.label,
    value: value.allocation,
  })).filter(item => item.value > 0);

  const colors = ['#248BFF', '#8B7CFF', '#E8C65A', '#22E6E0'];

  return (
    <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
      <h3 className="text-white font-semibold mb-4">Investment Allocation</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${value.toFixed(1)}%`}
            contentStyle={{
              backgroundColor: '#0D2235',
              border: '1px solid #1C5265',
              borderRadius: '8px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 mt-4">
        {chartData.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="text-text-secondary text-xs">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CashFlowChart({ income, expense, saving }) {
  const data = [
    { name: 'Income', actual: income, plan: income },
    { name: 'Expense', actual: expense, plan: expense },
    { name: 'Saving', actual: saving, plan: saving },
  ];

  return (
    <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
      <h3 className="text-white font-semibold mb-4">Monthly Cash Flow</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#16384B" />
          <XAxis dataKey="name" stroke="#7A8FA3" style={{ fontSize: '12px' }} />
          <YAxis stroke="#7A8FA3" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0D2235',
              border: '1px solid #1C5265',
              borderRadius: '8px'
            }}
            formatter={(value) => formatCurrency(value)}
          />
          <Bar dataKey="actual" fill="#22E6E0" radius={[8, 8, 0, 0]} />
          <Bar dataKey="plan" fill="#8B7CFF" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleLineChart({ data, dataKey, color = '#22E6E0', height = 150 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#16384B" vertical={false} />
        <XAxis dataKey="date" stroke="#7A8FA3" style={{ fontSize: '11px' }} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          dot={false}
          strokeWidth={2}
          isAnimationActive={true}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
