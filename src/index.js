import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Required until simple-peer offers a release as an ES6 module
import * as process from "process";
window.global = window;
window.process = process;
window.Buffer = [];

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
