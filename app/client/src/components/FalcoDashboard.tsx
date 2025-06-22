import { useEffect, useState } from 'react';
import { Pie, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import "./FalcoDashboard.css";
// Chart.js bileşenlerini kaydet
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardStats {
  priorities: Record<string, number>;
  rules: Record<string, number>;
  timeline_priority: Record<string, Record<string, number>>;
  tags: Record<string, number>;
}

const generateRandomColors = (count: number) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * 200) + 55; // Avoid too dark colors
    const g = Math.floor(Math.random() * 200) + 55;
    const b = Math.floor(Math.random() * 200) + 55;
    colors.push(`rgb(${r}, ${g}, ${b})`);
  }
  return colors;
};

const priorityColors = {
  'Warning': '#FFCE56',
  'Informational': '#36A2EB',
  'Notice': '#4169E1',
  'Error': '#FF6384',
  'Critical': '#DC143C',
  'Debug': '#87CEEB'
};

const FalcoDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filters, setFilters] = useState({
    priority: '',
    rule: '',
    tag: '',
    timeRange: '7d'
  });

  useEffect(() => {
    fetchDashboardStats();
  }, [filters]);

  const fetchDashboardStats = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.priority) queryParams.append('priority', filters.priority);
      if (filters.rule) queryParams.append('rule', filters.rule);
      if (filters.tag) queryParams.append('tag', filters.tag);
      if (filters.timeRange) queryParams.append('time_range', filters.timeRange);

      const response = await fetch(`/api/falco/dashboard?${queryParams.toString()}`);
      const data = await response.json();
      if (data.status === 'success') {
        setStats(data.statistics);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  if (!stats) return <div>Loading dashboard...</div>;

  const priorityChartData = {
    labels: Object.keys(stats.priorities),
    datasets: [{
      data: Object.values(stats.priorities),
      backgroundColor: [
        '#FF6384',  // Critical
        '#FFCE56',  // Warning
        '#36A2EB',  // Notice
        '#4BC0C0'   // Info
      ]
    }]
  };

  const rulesChartData = {
    labels: Object.keys(stats.rules).slice(0, 10), // Top 10 rules
    datasets: [{
      label: 'Rule Occurrences',
      data: Object.values(stats.rules).slice(0, 10),
      backgroundColor: '#36A2EB'
    }]
  };

  const tagsChartData = {
    labels: Object.keys(stats?.tags || {}).map(tag => tag.length > 10 ? tag.slice(0, 10) + '...' : tag),
    datasets: [{
      data: Object.values(stats?.tags || {}),
      backgroundColor: generateRandomColors(Object.keys(stats?.tags || {}).length)
    }]
  };

  return (
    <div className="dashboard-container">
      <div className="filters-container">
        <select
          value={filters.priority}
          onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
          className="filter-select"
        >
          <option value="">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="Warning">Warning</option>
          <option value="Notice">Notice</option>
        </select>

        <select 
          value={filters.timeRange}
          onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))}
          className="filter-select"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>

        <select 
          value={filters.tag}
          onChange={(e) => setFilters(prev => ({ ...prev, tag: e.target.value }))}
          className="filter-select"
        >
          <option value="">All Tags</option>
          {Object.keys(stats.tags).map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        <select 
          value={filters.rule}
          onChange={(e) => setFilters(prev => ({ ...prev, rule: e.target.value }))}
          className="filter-select"
        >
          <option value="">All Rules</option>
          {Object.keys(stats.rules).map(rule => (
            <option key={rule} value={rule}>{rule}</option>
          ))}
        </select>
      </div>

      <div className="summary-grid">
        <div className="summary-item">
          <div className="alert-summary">
            {Object.entries(stats.priorities).map(([priority, count]) => (
              <div key={priority} className={`alert-item ${priority.toLowerCase()}`}>
                <span className="alert-count">{count}</span>
                <span className="alert-label">{priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-item">
          <div className="section-header">
            <h3>Priority Distribution</h3>
          </div>
          <div className="chart-container">
            <Pie 
              data={priorityChartData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                  },
                  legend: {
                    position: 'bottom',
                  }
                },
                hover: {
                  mode: 'nearest',
                  intersect: true
                }
              }}
            />
          </div>
        </div>
        <div className="chart-item">
          <div className="section-header">
            <h3>Tag Distribution</h3>
          </div>
          <div className="chart-container">
            <Pie 
              data={tagsChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                  },
                  legend: {
                    position: 'bottom',
                  }
                },
                hover: {
                  mode: 'nearest',
                  intersect: true
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="chart-item full-width">
        <div className="section-header">
          <h3>Timeline by Priority</h3>
        </div>
        <div className="chart-container">
          <Line
            data={{
              labels: Object.keys(stats.timeline_priority),
              datasets: Object.entries(priorityColors).map(([priority, color]) => ({
                label: priority,
                data: Object.values(stats.timeline_priority).map(hourData => hourData[priority] || 0),
                backgroundColor: color,
                borderColor: color,
                fill: true,
                tension: 0.4
              }))
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: 'index',
                intersect: false,
              },
              plugins: {
                tooltip: {
                  enabled: true,
                  mode: 'index',
                  intersect: false,
                },
                legend: {
                  position: 'top',
                  labels: {
                    usePointStyle: false,
                  }
                }
              },
              scales: {
                y: {
                  stacked: true,
                  beginAtZero: true,
                  grid: {
                    color: '#e2e8f0'
                  }
                },
                x: {
                  grid: {
                    display: false
                  }
                }
              }
            }}
          />
        </div>
      </div>

      <div className="chart-item full-width">
        <div className="section-header">
          <h3>Top 10 Rules</h3>
        </div>
        <div className="chart-container">
          <Bar 
            data={rulesChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                tooltip: {
                  enabled: true,
                  mode: 'index',
                  intersect: false,
                },
                legend: {
                  position: 'bottom',
                }
              },
              scales: {
                y: {
                  beginAtZero: true
                }
              },
              hover: {
                mode: 'nearest',
                intersect: true
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FalcoDashboard;