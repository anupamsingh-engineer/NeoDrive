import React, { useEffect, useRef } from "react";
import conf from "../../../configs/conf";

// Renders Google's own Sign-In button via Google Identity Services (GSI), loading the
// script on demand so nothing breaks if VITE_GOOGLE_CLIENT_ID isn't configured.
const GoogleSignInButton = ({ onCredential }) => {
  const buttonRef = useRef(null);
  const clientId = conf.googleClientId;
  const isConfigured = clientId && clientId !== "undefined";

  useEffect(() => {
    if (!isConfigured) return;

    const render = () => {
      if (!buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 384,
      });
    };

    if (window.google?.accounts?.id) {
      render();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.body.appendChild(script);
  }, [clientId, isConfigured, onCredential]);

  if (!isConfigured) return null;

  return <div ref={buttonRef} className="flex justify-center" />;
};

export default GoogleSignInButton;
