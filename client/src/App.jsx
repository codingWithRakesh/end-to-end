import React, { useState, useEffect } from "react";
import { arrayBufferToBase64, base64ToArrayBuffer } from "./utils";

const API_URL = import.meta.env.VITE_APP_API_URL;

function App() {
  const [userId, setUserId] = useState("");
  const [groupId] = useState("group1");
  const [publicKeys, setPublicKeys] = useState({});
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      (async () => {
        await initKeys();
        await fetchPublicKeys();
        await fetchGroupMessages();
      })();
    }
  }, [isLoggedIn]);

  // Generate or reuse key pair
  async function initKeys() {
    const resPrivateKey = await fetch(`${API_URL}/api/get-private-key?userId=${userId}`);
    const { privateKey: existingPrivateKey } = await resPrivateKey.json();
    // console.log({ existinGPublicKey });

    const resPublicKey = await fetch(`${API_URL}/api/get-public-key?userId=${userId}`);
    const { publicKey: existingPublicKey } = await resPublicKey.json();
    // console.log({ existingPrivateKey }); 

    // const existingPrivateKey = localStorage.getItem("privateKey");
    // const existingPublicKey = localStorage.getItem("publicKey");
    console.log({ existingPrivateKey, existingPublicKey });

    if (existingPrivateKey && existingPublicKey) {
      console.log("✅ Reusing existing key pair");

      // make sure server has your latest public key
      await fetch(`${API_URL}/api/save-private-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          privateKey: existingPrivateKey
        }),
      });

      await fetch(`${API_URL}/api/save-public-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          publicKey: existingPublicKey,
        }),
      });
      return; // <-- 🔴 DO NOT regenerate keys
    }

    console.log("🔑 Generating new key pair...");
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    const publicKeyB64 = arrayBufferToBase64(publicKey);
    const privateKeyB64 = arrayBufferToBase64(privateKey);

    // save locally
    // localStorage.setItem("privateKey", privateKeyB64);
    // localStorage.setItem("publicKey", publicKeyB64);

    // save to server

    await fetch(`${API_URL}/api/save-private-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, privateKey: privateKeyB64 }),
    });

    await fetch(`${API_URL}/api/save-public-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, publicKey: publicKeyB64 }),
    });

    console.log("✅ Key pair generated and saved");
  }


  async function fetchPublicKeys() {
    try {
      const res = await fetch(`${API_URL}/api/public-keys`);
      const keys = await res.json();
      setPublicKeys(keys);
    } catch (error) {
      console.error("Error fetching public keys:", error);
    }
  }

  async function sendGroupMessage() {
    if (!publicKeys[userId]) {
      console.error("❌ Your own public key is missing!");
      return;
    }

    const encryptedMessages = {};

    for (const [receiverId, publicKeyBase64] of Object.entries(publicKeys)) {
      if (!publicKeyBase64) continue;

      try {
        const publicKey = await window.crypto.subtle.importKey(
          "spki",
          base64ToArrayBuffer(publicKeyBase64),
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["encrypt"]
        );

        const encrypted = await window.crypto.subtle.encrypt(
          { name: "RSA-OAEP" },
          publicKey,
          new TextEncoder().encode(message)
        );

        encryptedMessages[receiverId] = arrayBufferToBase64(encrypted);
      } catch (error) {
        console.error(`⚠️ Failed to encrypt for ${receiverId}:`, error);
      }
    }

    try {
      await fetch(`${API_URL}/api/send-group-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: userId, groupId, encryptedMessages }),
      });

      setMessage("");
      await fetchGroupMessages();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  async function fetchGroupMessages() {
    try {
      const res = await fetch(`${API_URL}/api/get-group-messages?groupId=${groupId}`);
      const msgs = await res.json();

      // const privateKeyBase64 = localStorage.getItem("privateKey");
      const resPrivateKey = await fetch(`${API_URL}/api/get-private-key?userId=${userId}`);
      const { privateKey: privateKeyBase64 } = await resPrivateKey.json();

      // const privateKeyBase64 = localStorage.getItem("privateKey");
      if (!privateKeyBase64) {
        console.error("❌ Private key missing");
        return;
      }
      console.log({ privateKeyBase64 });

      const privateKey = await window.crypto.subtle.importKey(
        "pkcs8",
        base64ToArrayBuffer(privateKeyBase64),
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
      );

      const decryptedMessages = await Promise.all(
        msgs.map(async (msg) => {
          const encryptedBase64 = msg.encryptedMessages[userId];
          if (!encryptedBase64) return null;

          try {
            const decryptedBuffer = await window.crypto.subtle.decrypt(
              { name: "RSA-OAEP" },
              privateKey,
              base64ToArrayBuffer(encryptedBase64)
            );

            return {
              sender: msg.senderId,
              text: new TextDecoder().decode(decryptedBuffer),
            };
          } catch (err) {
            console.error(`❌ Decryption failed for ${msg.senderId}:`, err);
            return {
              sender: msg.senderId,
              text: "*** Decryption Failed (Key mismatch) ***",
            };
          }
        })
      );

      setMessages(decryptedMessages.filter(Boolean));
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    if (userId.trim()) {
      setIsLoggedIn(true);
    }
  }

  if (!isLoggedIn) {
    return (
      <div style={{ padding: "20px" }}>
        <h1>Enter Your User ID</h1>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Your User ID"
          />
          <button type="submit">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Logged in as: {userId}</h1>

      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message"
        />
        <button onClick={sendGroupMessage}>Send</button>
      </div>

      <h2>Messages</h2>
      <ul>
        {messages.map((m, idx) => (
          <li key={idx}>
            <b>{m.sender}:</b> {m.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
