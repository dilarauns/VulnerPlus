import React from 'react';
import './PageTemplate.css';

interface PageTemplateProps {
  title: string;
  color: string;
  children: React.ReactNode;
}

const PageTemplate = ({ title, color, children }: PageTemplateProps) => {
  return (
    <div className="page-container" style={{ '--primary-color': color } as any}>
      <h1 className="page-title">{title}</h1>
      <div className="page-content">
        {children}
      </div>
    </div>
  );
};

export default PageTemplate; 