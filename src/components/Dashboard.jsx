import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, startOfMonth, eachMonthOfInterval, min, max } from 'date-fns';
import { formatKES } from '../utils/categorize';

const CHART_COLORS = ['#6c8fff','#4ade80','#f87171','#fbbf24','#a78bfa','#2dd4bf','#fb923c','#f472b6','#34d399','#60a5fa'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: '0.7rem 0.9rem', minWidth: 150, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '0.3rem' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.76rem' }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{formatKES(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard({ transactions, categories }) {
  const { totalIn, totalOut, txCount, monthlyData, categoryData } = useMemo(() => {
    if (!transactions.length) return { totalIn:0, totalOut:0, txCount:0, monthlyData:[], categoryData:[] };
    let totalIn = 0, totalOut = 0;
    const catMap = {};
    transactions.forEach(tx => {
      totalIn += tx.paidIn || 0;
      totalOut += tx.withdrawn || 0;
      const cat = tx.customCategory || tx.category || 'other';
      if (!catMap[cat]) catMap[cat] = { in: 0, out: 0 };
      catMap[cat].in += tx.paidIn || 0;
      catMap[cat].out += tx.withdrawn || 0;
    });

    const validDates = transactions.map(t => t.date).filter(Boolean);
    let monthlyData = [];
    if (validDates.length) {
      const months = eachMonthOfInterval({ start: startOfMonth(min(validDates)), end: startOfMonth(max(validDates)) });
      monthlyData = months.map(m => {
        const label = format(m, 'MMM yy');
        const mTxs = transactions.filter(t => t.date && format(t.date,'MMM yy') === label);
        return { month: label, Income: mTxs.reduce((s,t) => s+(t.paidIn||0),0), Expenses: mTxs.reduce((s,t) => s+(t.withdrawn||0),0) };
      });
    }

    const categoryData = Object.entries(catMap)
      .filter(([,v]) => v.out > 0 || v.in > 0)
      .sort((a,b) => (b[1].out+b[1].in) - (a[1].out+a[1].in))
      .slice(0,8)
      .map(([key, val]) => ({ name: categories[key]?.label || key, value: Math.round((val.out+val.in)*100)/100 }));

    return { totalIn, totalOut, txCount: transactions.length, monthlyData, categoryData };
  }, [transactions, categories]);

  if (!transactions.length) return null;
  const net = totalIn - totalOut;
  const netPct = totalIn > 0 ? Math.min(100, (totalIn/(totalIn+totalOut))*100) : 50;

  return (
    <div>
      <div className="stat-grid">
        {[
          { label:'Total Income', val:formatKES(totalIn), sub:`${transactions.filter(t=>t.paidIn>0).length} transactions`, type:'income' },
          { label:'Total Expenses', val:formatKES(totalOut), sub:`${transactions.filter(t=>t.withdrawn>0).length} transactions`, type:'expense' },
          { label:'Net Flow', val:formatKES(Math.abs(net)), sub: net>=0?'▲ Surplus':'▼ Deficit', type:'balance' },
          { label:'Transactions', val:txCount.toLocaleString(), sub:'total records', type:'accounts' },
        ].map((s,i) => (
          <div key={s.label} className={`stat-card ${s.type} fade-up fade-up-${i+1}`}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.type}`}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card fade-up fade-up-4" style={{ marginBottom: '0.85rem', padding: '0.9rem 1.25rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.45rem', fontSize:'0.76rem' }}>
          <span style={{ color:'var(--green)' }}>Income {netPct.toFixed(0)}%</span>
          <span style={{ color:'var(--text3)', fontFamily:'Syne', fontWeight:700, fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Flow Ratio</span>
          <span style={{ color:'var(--red)' }}>Expenses {(100-netPct).toFixed(0)}%</span>
        </div>
        <div className="net-bar">
          <div className="net-bar-in" style={{ width:`${netPct}%` }} />
          <div className="net-bar-out" style={{ width:`${100-netPct}%` }} />
        </div>
      </div>

      {monthlyData.length > 0 && (
        <div className="charts-row fade-up fade-up-5">
          <div className="card" style={{ padding:'1.1rem' }}>
            <div className="section-header" style={{ marginBottom:'0.85rem' }}>
              <div><div className="section-title">Monthly Cash Flow</div><div className="section-sub">Income vs Expenses</div></div>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={monthlyData} margin={{ top:5, right:5, bottom:0, left:0 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.28}/><stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.28}/><stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}K`:v} width={38} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Income" stroke="#4ade80" strokeWidth={2} fill="url(#gIn)" />
                <Area type="monotone" dataKey="Expenses" stroke="#f87171" strokeWidth={2} fill="url(#gOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding:'1.1rem' }}>
            <div className="section-title" style={{ marginBottom:'0.75rem' }}>Spending by Category</div>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={52} outerRadius={76} dataKey="value" paddingAngle={2}>
                  {categoryData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} stroke="none" />)}
                </Pie>
                <Tooltip formatter={v => formatKES(v)} contentStyle={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, fontSize:'0.76rem' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="legend">
              {categoryData.slice(0,5).map((d,i) => (
                <div key={d.name} className="legend-item">
                  <div className="legend-dot" style={{ background: CHART_COLORS[i%CHART_COLORS.length] }} />
                  <span className="legend-label">{d.name}</span>
                  <span className="legend-val" style={{ color: CHART_COLORS[i%CHART_COLORS.length] }}>{formatKES(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
