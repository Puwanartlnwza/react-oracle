import React from "react";
import "./Navbar.css";
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="logo">Routing</div>
      <ul className="nav-links">
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/employee">Employees</Link>
        </li>
        <li>
          <Link to="/customer">Customers</Link>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
