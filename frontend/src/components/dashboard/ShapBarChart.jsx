import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function ShapBarChart({ features }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={features}
        layout="vertical"
        margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
      >
        <XAxis type="number" domain={[0, 0.6]} tick={{ fill: '#9b968c', fontSize: 9, fontFamily: '"JetBrains Mono"' }} tickFormatter={v => v.toFixed(1)} />
        <YAxis dataKey="name" type="category" width={160} tick={{ fill: '#eeeae1', fontSize: 9, fontFamily: '"Inter"' }} />
        <Tooltip
          contentStyle={{ background: '#17141a', border: '1px solid #2a2530', borderRadius: 6, fontFamily: '"JetBrains Mono"', fontSize: 11 }}
          labelStyle={{ color: '#eeeae1' }}
          itemStyle={{ color: '#e5484d' }}
          formatter={v => [v.toFixed(3), 'SHAP']}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {features.map((entry, index) => (
            <Cell
              key={index}
              fill={index === 0 ? '#e5484d' : index === 1 ? '#c9a227' : `rgba(229,72,77,${0.6 - index * 0.1})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
