import './FalcoPage.css';
import PageTemplate from '../components/PageTemplate';
import { Tabs, Tab, Box } from '@mui/material';
import { useState } from 'react';
import FalcoDashboard from '../components/FalcoDashboard';
import FalcoEvents from '../components/FalcoEvents';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const FalcoPage = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <PageTemplate title="Falco Security Scanner" color="#00796B">
      <div className="falco-content">
        <div className="tabs-container">
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Dashboard" />
            <Tab label="Events" />
            <Tab label="Info" />
          </Tabs>
        </div>

        <TabPanel value={tabValue} index={0}>
          <FalcoDashboard />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <div className="events-container">
            <FalcoEvents />
          </div>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <div className="page-header">
            <h2>Info</h2>
            <p className="header-description">Learn about Falco and its configuration</p>
          </div>
          <div className="info-container">
            <div>
              <h3>About Falco</h3>
              <p>
                Falco is a cloud-native runtime security tool designed to detect
                anomalous activity in your applications and containers.
              </p>
            </div>
            <div>
              <h3>Configuration</h3>
              <ul>
                <li>Version: 0.33.1</li>
                <li>Rules: Default ruleset enabled</li>
                <li>Status: Active</li>
              </ul>
            </div>
            <div>
              <h3>Documentation</h3>
              <p>
                For more information, visit the{' '}
                <a href="https://falco.org/docs" target="_blank" rel="noopener noreferrer">
                  official Falco documentation
                </a>
              </p>
            </div>
          </div>
        </TabPanel>
      </div>
    </PageTemplate>
  );
};

export default FalcoPage;