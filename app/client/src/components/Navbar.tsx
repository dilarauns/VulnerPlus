import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="nav-brand">Security Scanner Dashboard</div>
      <div className="nav-links">
        <Link to="/falco" className="nav-link">Falco</Link>
        <Link to="/trivy" className="nav-link">Trivy</Link>
        <Link to="/pmd" className="nav-link">PMD</Link>
      </div>
    </nav>
  );
};

export default Navbar; 