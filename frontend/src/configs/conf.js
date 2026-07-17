const conf = {
  googleClientId: String(import.meta.env.VITE_GOOGLE_CLIENT_ID),
  facebookAppId: String(import.meta.env.VITE_FACEBOOK_APP_ID),
  ipInfoToken: String(import.meta.env.VITE_IP_INFO_TOKEN),
  paypalClientId: String(import.meta.env.VITE_PAYPAL_CLIENT_ID),
  mixPaneltoken: String(import.meta.env.VITE_MIXPANEL_TOKEN),
  gaId: String(import.meta.env.VITE_GOOGLE_ANALYTICS_ID),
};

export default conf;
