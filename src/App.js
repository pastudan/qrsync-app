import React, { useState, useEffect } from "react";
import Peer from "simple-peer";
import { nanoid } from "nanoid";
import { QRCodeSVG } from "qrcode.react";
import TextAreaAutosize from "react-textarea-autosize";

let ws = null;
let peer = null;

function copy(text) {
  if (!navigator.clipboard) {
    console.error(
      "WARNING! Clipboard API not available... are you in a secure context (HTTPS)? Attempting to copy using deprecated execCommand API."
    );
    deprecatedCopy(text);
    return;
  }
  navigator.clipboard.writeText(text);
}

function deprecatedCopy(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand("copy");
  } catch (err) {
    console.error("Unable to copy to clipboard", err);
  }
  document.body.removeChild(textArea);
}

function SimplePeerChat() {
  const [channelId, setChannelId] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState(null);
  const [initiator, setInitiator] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let id = window.location.pathname.substring(1);
    let key = window.location.hash.substring(1);
    let isInitiator;
    if (!id) {
      isInitiator = true;
      id = nanoid();
      key = nanoid(43); // ~256 bits of entropy
    } else {
      isInitiator = false;
      if (!key) {
        setError("No encryption key provided");
      }
    }

    window.history.replaceState(null, null, "/");

    setChannelId(id);
    setEncryptionKey(key);
    setInitiator(isInitiator);

    function startPeering() {
      peer = new Peer({ initiator: isInitiator, trickle: true });
      peer.on("signal", (data) => ws.send(JSON.stringify(data)));
      peer.on("connect", () => setConnected(true));
      peer.on("data", (data) => {
        const type = String.fromCharCode(data[0]);
        if (type === "p") {
          // Password message
          const { username, password } = JSON.parse(data.slice(1));
          setUsername(username);
          setPassword(password);
        } else if (type === "t") {
          // Text message
          const message = data.slice(1).toString();
          setMessages((prevMessages) => [...prevMessages, message]);
        }
      });
    }

    function connectWs() {
      ws = new WebSocket(`ws://${window.location.hostname}:4000/${id}`);
      ws.onopen = () => {
        console.log("ws open");
      };
      ws.onmessage = (event) => {
        if (event.data === "START_PEERING") {
          startPeering();
          return;
        }
        peer.signal(event.data);
      };
      ws.onclose = () => {
        setError("Connection lost");
        setTimeout(connectWs, 1000);
      };
    }
    connectWs();
  }, []);

  function sendMessage() {
    setMessages([...messages, inputValue]);
    peer.send(`t${inputValue}`);
    setInputValue("");
  }

  function sendPassword() {
    peer.send(`p${JSON.stringify({ username, password })}`);
  }

  const url = `${window.location.origin}/${channelId}#${encryptionKey}`;

  return (
    <div className="simple-peer-chat" style={{ marginLeft: "20px" }}>
      {connected ? (
        <div>
          <h3>Connected!</h3>
          <p>
            You <b>{initiator ? "started" : "joined"}</b> the session.
          </p>
          <div className="messages">
            {messages.map((message, index) => (
              <div key={index}>{message}</div>
            ))}
          </div>
          <TextAreaAutosize
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button onClick={sendMessage}>Send</button>
          <hr />
          <h3>Share Username & Password</h3>
          <div>
            <label>
              Username
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <span onClick={() => copy(username)}>COPY</span>
          </div>
          <div>
            <label>
              Password
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <span onClick={() => copy(password)}>COPY</span>
          </div>

          <button onClick={sendPassword}>Send</button>
        </div>
      ) : (
        <div>
          <h3>Scan this QR Code to join the session:</h3>
          <QRCodeSVG value={url} />
          <h3>Channel ID</h3>
          <div>{channelId}</div>
          <h3>Encryption Key</h3>
          <div>{encryptionKey}</div>
          <h3>URL</h3>
          <a href={url} target="_blank">
            {url}
          </a>
          {error && (
            <div style={{ background: "red" }}>
              <h3>Error</h3>
              <div>{error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SimplePeerChat;
