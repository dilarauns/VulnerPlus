import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TablePagination, TextField, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

interface FalcoLog {
  id: number;
  log_json: {
    rule: string;
    priority: string;
    output: string;
    time: string;
  };
}

const formatTimestamp = (isoTimestamp: string) => {
  try {
    if (!isoTimestamp) return '-';
    
    // Remove timezone and microseconds
    const cleanTimestamp = isoTimestamp.split('.')[0];
    
    // Split into date and time
    const [datePart, timePart] = cleanTimestamp.split('T');
    if (!datePart || !timePart) return '-';
    
    const [hour, minute] = timePart.split(':');
    return `${datePart} ${hour}:${minute}`;
  } catch (error) {
    console.error('Error formatting timestamp:', error, 'Input:', isoTimestamp);
    return '-';
  }
};

// HighlightedText component
const HighlightedText = ({ text, searchTerm }: { text: string, searchTerm: string }) => {
  if (!searchTerm) return <>{text}</>;

  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <span key={i} style={{ backgroundColor: '#ffeb3b', padding: '2px' }}>
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

const FalcoEvents = () => {
  const [logs, setLogs] = useState<FalcoLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [timeRange, setTimeRange] = useState('7d');
  const [ruleFilter, setRuleFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [outputFilter, setOutputFilter] = useState('');
  const [uniqueRules, setUniqueRules] = useState<string[]>([]);
  const [uniquePriorities, setUniquePriorities] = useState<string[]>([]);

  const fetchAllLogs = async () => {
    try {
      const response = await fetch(`/api/falco/events?limit=1000&time_range=${timeRange}`);
      const data = await response.json();
      if (data.status === 'success') {
        setLogs(data.logs);
        setTotalLogs(data.total);

        const rules = [...new Set(data.logs.map((log: FalcoLog) => log?.log_json?.rule).filter(Boolean))] as string[];
        const priorities = [...new Set(data.logs.map((log: FalcoLog) => log?.log_json?.priority).filter(Boolean))] as string[];
        
        setUniqueRules(rules);
        setUniquePriorities(priorities);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  useEffect(() => {
    fetchAllLogs();
  }, [timeRange]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredLogs = logs.filter(log => {
    if (!log || !log.log_json) return false;
    
    return (
      (log.log_json.rule?.toLowerCase() || '').includes(ruleFilter.toLowerCase()) &&
      (log.log_json.priority?.toLowerCase() || '').includes(priorityFilter.toLowerCase()) &&
      (log.log_json.output?.toLowerCase() || '').includes(outputFilter.toLowerCase())
    );
  });

  return (
    <div>
      {logs.length > 0 ? (
        <>
          <div className="filter-container" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <FormControl size="small" style={{ minWidth: 120 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                label="Time Range"
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" style={{ minWidth: 120 }}>
              <InputLabel>Rule</InputLabel>
              <Select
                value={ruleFilter}
                label="Rule"
                onChange={(e) => setRuleFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {uniqueRules.map((rule) => (
                  <MenuItem key={rule} value={rule}>{rule}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" style={{ minWidth: 120 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priorityFilter}
                label="Priority"
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {uniquePriorities.map((priority) => (
                  <MenuItem key={priority} value={priority}>{priority}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Output Filter"
              variant="outlined"
              size="small"
              value={outputFilter}
              onChange={(e) => setOutputFilter(e.target.value)}
            />
          </div>
          <TableContainer component={Paper}>
            <Table style={{ borderCollapse: 'separate', borderSpacing: '0 0' }}>
              <TableHead>
                <TableRow>
                  <TableCell style={{ minWidth: 180, width: '20%', padding: '12px 8px' }}>Time</TableCell>
                  <TableCell style={{ minWidth: 200, width: '25%', padding: '12px 8px' }}>Rule</TableCell>
                  <TableCell style={{ minWidth: 120, width: '15%', padding: '12px 8px' }}>Priority</TableCell>
                  <TableCell style={{ width: '40%', padding: '12px 8px' }}>Output</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell style={{ minWidth: 180, width: '20%', padding: '12px 8px' }}>{formatTimestamp(log.log_json.time)}</TableCell>
                    <TableCell style={{ minWidth: 200, width: '25%', padding: '12px 8px' }}>{log?.log_json?.rule || '-'}</TableCell>
                    <TableCell style={{ minWidth: 120, width: '15%', padding: '12px 8px' }}>{log?.log_json?.priority || '-'}</TableCell>
                    <TableCell style={{ width: '40%', padding: '12px 8px' }}>
                      <HighlightedText 
                        text={log?.log_json?.output || '-'} 
                        searchTerm={outputFilter} 
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalLogs}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      ) : (
        <p>No security violations detected</p>
      )}
    </div>
  );
};

export default FalcoEvents;
